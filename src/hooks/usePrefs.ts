import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Prefs {
  library_lang: string | null;
  next_button_side: 'left' | 'right';
}

const DEFAULTS: Prefs = { library_lang: null, next_button_side: 'right' };

export function usePrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_prefs')
      .select('library_lang,next_button_side')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs({ ...DEFAULTS, ...data });
        setLoaded(true);
      });
  }, [userId]);

  const save = useCallback(async (patch: Partial<Prefs>) => {
    const merged = { ...prefsRef.current, ...patch };
    setPrefs(merged);
    if (!userId) return;
    await supabase.from('user_prefs').upsert({
      user_id: userId,
      ...merged,
      updated_at: new Date().toISOString(),
    });
  }, [userId]);

  return { prefs, loaded, save };
}
