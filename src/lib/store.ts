import { useSyncExternalStore } from 'react';
import type { Lang } from './types';

// Progress lives on the device first, so reading never waits on the network. With an
// account it is also copied to the cloud (lib/sync.ts) and merged across devices.

export interface SavedWord {
  key: string;
  token: string;
  translation: string;
  lang: Lang;
  bookId: string;
  sentence: string;
  /** Leitner box: how many times in a row it was remembered. */
  box: number;
  due: string;
  added: string;
  /** Last change (ms), so the newest copy wins when devices are merged. */
  updated?: number;
}

export interface DayLog {
  sentences: number;
  answered: number;
  correct: number;
  reviewed: number;
}

export interface Settings {
  goal: number;
  /** 1 = normal, below 1 = slower voice. */
  voiceRate: number;
  /** Dotted underline under words that have a translation. */
  hints: boolean;
  /** Bring saved words back as exercises between pages. */
  reviewInReading: boolean;
  updated?: number;
}

export interface State {
  books: Record<string, { pos: number }>;
  words: Record<string, SavedWord>;
  /** Words removed on this device (key → ms), so a merge doesn't bring them back. */
  removed: Record<string, number>;
  days: Record<string, DayLog>;
  settings: Settings;
  lastBook: string | null;
}

const KEY = 'verba:v1';
export const DEFAULT_SETTINGS: Settings = { goal: 15, voiceRate: 1, hints: true, reviewInReading: true };
const EMPTY: State = { books: {}, words: {}, removed: {}, days: {}, settings: DEFAULT_SETTINGS, lastBook: null };

/** Fill in fields older saves don't have. */
export function normalize(raw: Partial<State> & { goal?: number }): State {
  const settings = { ...DEFAULT_SETTINGS, ...(raw.goal ? { goal: raw.goal } : {}), ...raw.settings };
  return {
    books: raw.books ?? {},
    words: raw.words ?? {},
    removed: raw.removed ?? {},
    days: raw.days ?? {},
    settings,
    lastBook: raw.lastBook ?? null,
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state = load();
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach(l => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getState(): State {
  return state;
}

/** Replace everything, e.g. with the result of merging in the cloud copy. */
export function replaceState(next: State) {
  set(next);
}

/** The whole (immutable) state; derive what you need with the helpers below. */
export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function today(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv'); // YYYY-MM-DD in local time
}

function bumpDay(patch: Partial<DayLog>) {
  const t = today();
  const cur = state.days[t] ?? { sentences: 0, answered: 0, correct: 0, reviewed: 0 };
  const next = { ...cur };
  for (const k of Object.keys(patch) as (keyof DayLog)[]) next[k] += patch[k] ?? 0;
  return { ...state.days, [t]: next };
}

/**
 * Days until a word comes back, by box. Box 0 is "still learning": it comes back on the
 * next page you read, until you get it right once.
 */
const INTERVALS = [0, 1, 3, 7, 16, 35];

export const actions = {
  readSentence(bookId: string, nextPos: number) {
    const prev = state.books[bookId]?.pos ?? 0;
    set({
      ...state,
      lastBook: bookId,
      books: { ...state.books, [bookId]: { pos: Math.max(prev, nextPos) } },
      days: nextPos > prev ? bumpDay({ sentences: 1 }) : state.days,
    });
  },
  openBook(bookId: string) {
    if (state.lastBook !== bookId) set({ ...state, lastBook: bookId });
  },
  answer(correct: boolean) {
    set({ ...state, days: bumpDay({ answered: 1, correct: correct ? 1 : 0 }) });
  },
  saveWord(w: Omit<SavedWord, 'box' | 'due' | 'added' | 'updated'>) {
    if (state.words[w.key]) return;
    const removed = { ...state.removed };
    delete removed[w.key];
    set({
      ...state,
      removed,
      words: { ...state.words, [w.key]: { ...w, box: 0, due: today(), added: today(), updated: Date.now() } },
    });
  },
  removeWord(key: string) {
    if (!state.words[key]) return;
    const words = { ...state.words };
    delete words[key];
    set({ ...state, words, removed: { ...state.removed, [key]: Date.now() } });
  },
  review(key: string, remembered: boolean) {
    const w = state.words[key];
    if (!w) return;
    const box = remembered ? Math.min(w.box + 1, INTERVALS.length - 1) : 0;
    const due = today(remembered ? INTERVALS[box] : 0);
    set({
      ...state,
      words: { ...state.words, [key]: { ...w, box, due, updated: Date.now() } },
      days: bumpDay({ reviewed: 1 }),
    });
  },
  setSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch, updated: Date.now() } });
  },
};

export function wordKey(lang: Lang, token: string) {
  return `${lang}:${token.toLocaleLowerCase()}`;
}

export function dueWords(s: State): SavedWord[] {
  const t = today();
  return Object.values(s.words)
    .filter(w => w.due <= t)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due));
}

/** Consecutive days with reading, ending today (or yesterday, if today hasn't started yet). */
export function streakOf(days: State['days']): number {
  const active = (d: string) => (days[d]?.sentences ?? 0) > 0;
  let n = 0;
  let off = active(today()) ? 0 : -1;
  while (active(today(off))) {
    n++;
    off--;
  }
  return n;
}

export function todayLog(s: State): DayLog {
  return s.days[today()] ?? { sentences: 0, answered: 0, correct: 0, reviewed: 0 };
}

/** Combine two copies of the progress (this device and the cloud) without losing anything. */
export function merge(a: State, b: State): State {
  const books: State['books'] = { ...a.books };
  for (const [id, v] of Object.entries(b.books)) books[id] = { pos: Math.max(books[id]?.pos ?? 0, v.pos) };

  const removed: State['removed'] = { ...a.removed };
  for (const [k, t] of Object.entries(b.removed)) removed[k] = Math.max(removed[k] ?? 0, t);

  const words: State['words'] = {};
  for (const w of [...Object.values(a.words), ...Object.values(b.words)]) {
    const cur = words[w.key];
    if (!cur || (w.updated ?? 0) > (cur.updated ?? 0)) words[w.key] = w;
  }
  for (const [k, t] of Object.entries(removed)) if (words[k] && (words[k].updated ?? 0) < t) delete words[k];
  // A word saved again after being removed clears its tombstone.
  for (const k of Object.keys(words)) delete removed[k];

  const days: State['days'] = { ...a.days };
  for (const [d, v] of Object.entries(b.days)) {
    const c = days[d];
    days[d] = c
      ? {
          sentences: Math.max(c.sentences, v.sentences),
          answered: Math.max(c.answered, v.answered),
          correct: Math.max(c.correct, v.correct),
          reviewed: Math.max(c.reviewed, v.reviewed),
        }
      : v;
  }

  const settings = (b.settings.updated ?? 0) > (a.settings.updated ?? 0) ? b.settings : a.settings;
  return { books, words, removed, days, settings, lastBook: a.lastBook ?? b.lastBook };
}
