import { useSyncExternalStore } from 'react';
import type { Lang } from './types';

// Everything lives on the device for now (no account needed to start reading).

export interface SavedWord {
  key: string;
  token: string;
  translation: string;
  lang: Lang;
  bookId: string;
  sentence: string;
  box: number;
  due: string;
  added: string;
}

export interface DayLog {
  sentences: number;
  answered: number;
  correct: number;
  reviewed: number;
}

export interface State {
  books: Record<string, { pos: number }>;
  words: Record<string, SavedWord>;
  days: Record<string, DayLog>;
  goal: number;
  lastBook: string | null;
}

const KEY = 'verba:v1';
const EMPTY: State = { books: {}, words: {}, days: {}, goal: 15, lastBook: null };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
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

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getState(): State {
  return state;
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
  setPos(bookId: string, pos: number) {
    set({ ...state, books: { ...state.books, [bookId]: { pos } } });
  },
  answer(correct: boolean) {
    set({ ...state, days: bumpDay({ answered: 1, correct: correct ? 1 : 0 }) });
  },
  toggleWord(w: Omit<SavedWord, 'box' | 'due' | 'added'>) {
    const words = { ...state.words };
    if (words[w.key]) delete words[w.key];
    else words[w.key] = { ...w, box: 0, due: today(1), added: today() };
    set({ ...state, words });
  },
  review(key: string, remembered: boolean) {
    const w = state.words[key];
    if (!w) return;
    const box = remembered ? Math.min(w.box + 1, INTERVALS.length - 1) : 0;
    const due = remembered ? today(INTERVALS[box]) : today();
    set({
      ...state,
      words: { ...state.words, [key]: { ...w, box, due } },
      days: bumpDay({ reviewed: 1 }),
    });
  },
  setGoal(goal: number) {
    set({ ...state, goal });
  },
};

/** Days until the next review, by box (a light Leitner schedule). */
const INTERVALS = [1, 2, 4, 8, 16, 32];

export function wordKey(lang: Lang, token: string) {
  return `${lang}:${token.toLocaleLowerCase()}`;
}

export function dueWords(s: State): SavedWord[] {
  const t = today();
  return Object.values(s.words)
    .filter(w => w.due <= t)
    .sort((a, b) => a.due.localeCompare(b.due));
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
