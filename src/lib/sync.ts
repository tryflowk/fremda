import { useSyncExternalStore } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { getState, merge, normalize, replaceState, subscribe, type State } from './store';

// Cloud copy of the progress, for people who sign in. One row per person holds the whole
// state; each device merges it with what it has (see merge in store.ts), so reading keeps
// working offline and nothing is lost when two devices were used.

const url = import.meta.env.VITE_VERBA_SUPABASE_URL ?? 'https://vpftkzboelxgncieblqf.supabase.co';
// Publishable key: safe to ship in the browser, access is limited by row-level security.
const key = import.meta.env.VITE_VERBA_SUPABASE_KEY ?? 'sb_publishable_sH5DYrdYrDynMcbbxQ_DQA_RtdB7pgL';

export const supabase = createClient(url, key, {
  // PKCE puts the sign-in code in ?code=, which doesn't collide with the hash router.
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

type Status = 'off' | 'syncing' | 'saved' | 'error';
let session: Session | null = null;
let status: Status = 'off';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function setStatus(s: Status) {
  status = s;
  emit();
}

let pushing: ReturnType<typeof setTimeout> | undefined;
let applying = false;

async function pull() {
  if (!session) return;
  setStatus('syncing');
  const { data, error } = await supabase.from('verba_progress').select('state').eq('user_id', session.user.id).maybeSingle();
  if (error) return setStatus('error');
  const merged = data?.state ? merge(getState(), normalize(data.state as Partial<State>)) : getState();
  applying = true;
  replaceState(merged);
  applying = false;
  await push();
}

async function push() {
  if (!session) return;
  setStatus('syncing');
  const { error } = await supabase
    .from('verba_progress')
    .upsert({ user_id: session.user.id, state: getState(), updated_at: new Date().toISOString() });
  setStatus(error ? 'error' : 'saved');
}

export function startSync() {
  supabase.auth.onAuthStateChange((event, s) => {
    const wasIn = !!session;
    session = s;
    if (!s) setStatus('off');
    else if (!wasIn || event === 'SIGNED_IN') void pull();
    emit();
    // Drop the one-time ?code= from the address bar after signing in.
    if (s && location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  });
  subscribe(() => {
    if (!session || applying) return;
    clearTimeout(pushing);
    pushing = setTimeout(() => void push(), 1500);
  });
  // Pick up changes made on another device when coming back to the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pull();
  });
}

export async function sendLoginLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  return error?.message ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function useSync() {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot(),
  );
}

let last: { email: string | null; status: Status } = { email: null, status: 'off' };
function snapshot() {
  const email = session?.user.email ?? null;
  if (last.email !== email || last.status !== status) last = { email, status };
  return last;
}
