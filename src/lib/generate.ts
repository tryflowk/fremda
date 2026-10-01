import type { Book, Exercise, Lang, Page, Segment, WordToken } from './types';
import { isSupported } from './exercises';
import { canSpeak } from './tts';
import { dueWords, type State } from './store';

// Exercises made on the fly from the page being read, mixed in with the book's own
// comprehension questions so every page practices vocabulary, spelling and listening.

export type Step = { kind: 'seg'; seg: number } | { kind: 'ex'; ex: Exercise } | { kind: 'done' };

function rngOf(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = ReturnType<typeof rngOf>;

const pick = <T,>(xs: T[], rnd: Rng) => xs[Math.floor(rnd() * xs.length)];
const lower = (s: string) => s.toLocaleLowerCase();
const letters = (s: string) => s.replace(/[^\p{L}]/gu, '').length;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function occursIn(text: string, token: string) {
  return new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(token)}(?![\\p{L}\\p{M}])`, 'u').test(text);
}

/** Every distinct glossed word in the book, the pool for wrong answers. */
const pools = new WeakMap<Book, WordToken[]>();
function poolOf(book: Book): WordToken[] {
  let pool = pools.get(book);
  if (!pool) {
    const seen = new Set<string>();
    pool = [];
    for (const s of book.segments)
      for (const w of s.words) {
        const k = lower(w.token);
        if (!seen.has(k) && letters(w.token) >= 3 && w.translation) {
          seen.add(k);
          pool.push(w);
        }
      }
    pools.set(book, pool);
  }
  return pool;
}

/** Three wrong answers close in length to the right one, so length gives nothing away. */
function distractors(right: string, candidates: string[], rnd: Rng, n = 3): string[] {
  const r = lower(right);
  const uniq = [...new Set(candidates.filter(c => lower(c) !== r && !lower(c).includes(r) && !r.includes(lower(c))))];
  const near = uniq
    .map(c => ({ c, d: Math.abs(c.length - right.length) + rnd() * 3 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 14)
    .map(x => x.c);
  const out: string[] = [];
  while (out.length < n && near.length) out.push(near.splice(Math.floor(rnd() * near.length), 1)[0]);
  return out;
}

/** A word worth asking about: long enough, actually in the sentence, not a cognate. */
function candidateWords(seg: Segment, skip: Set<string>): WordToken[] {
  return seg.words
    .filter(w =>
      letters(w.token) >= 4 &&
      !/\d/.test(w.token) &&
      lower(w.token) !== lower(w.translation) &&
      !skip.has(lower(w.token)) &&
      occursIn(seg.text, w.token),
    )
    .sort((a, b) => b.token.length - a.token.length);
}

function meaning(book: Book, segs: number[], rnd: Rng, skip: Set<string>): Exercise | null {
  const options = segs.flatMap(i => candidateWords(book.segments[i], skip).slice(0, 4).map(w => ({ w, i })));
  if (!options.length) return null;
  const { w, i } = pick(options, rnd);
  const wrong = distractors(w.translation, poolOf(book).filter(p => lower(p.lemma ?? '') !== lower(w.lemma ?? '-')).map(p => p.translation), rnd);
  if (wrong.length < 3) return null;
  skip.add(lower(w.token));
  return {
    id: `gen-meaning-${i}-${w.token}`,
    type: 'meaning',
    label: 'Vocabulário',
    prompt: `O que significa “${w.token}”?`,
    context: book.segments[i].text,
    target: w.token,
    options: [w.translation, ...wrong],
    answer: w.translation,
  };
}

function cloze(book: Book, segs: number[], rnd: Rng, skip: Set<string>): Exercise | null {
  const options = segs
    .filter(i => book.segments[i].text.length <= 240)
    .flatMap(i => candidateWords(book.segments[i], skip).slice(0, 4).map(w => ({ w, i })));
  if (!options.length) return null;
  const { w, i } = pick(options, rnd);
  // Same capitalization as the answer (German nouns!), so case is no clue.
  const upper = (s: string) => s[0] !== s[0].toLocaleLowerCase();
  const wrong = distractors(
    w.token,
    poolOf(book).filter(p => upper(p.token) === upper(w.token) && !p.token.includes(' ')).map(p => p.token),
    rnd,
  );
  if (wrong.length < 3) return null;
  skip.add(lower(w.token));
  return {
    id: `gen-cloze-${i}-${w.token}`,
    type: 'cloze',
    label: 'Complete a frase',
    prompt: `Qual palavra significa “${w.translation}”?`,
    context: book.segments[i].text,
    target: w.token,
    options: [w.token, ...wrong],
    answer: w.token,
    foreignOptions: true,
  };
}

function listen(book: Book, segs: number[], rnd: Rng): Exercise | null {
  if (!canSpeak) return null;
  const texts = [...new Set(segs.map(i => book.segments[i].text.trim()))].filter(
    t => t.length >= 15 && t.length <= 150 && letters(t) >= 10,
  );
  if (texts.length < 3) return null;
  const answer = pick(texts, rnd);
  const others = texts.filter(t => t !== answer).sort(() => rnd() - 0.5).slice(0, 2);
  return {
    id: `gen-listen-${answer.slice(0, 24)}`,
    type: 'listen',
    label: 'Ouvido',
    prompt: 'Qual destas frases você ouviu?',
    audio: answer,
    options: [answer, ...others],
    answer,
    foreignOptions: true,
  };
}

function savedWord(book: Book, lang: Lang, state: State, rnd: Rng): Exercise | null {
  const w = dueWords(state).find(d => d.lang === lang);
  if (!w) return null;
  const wrong = distractors(w.translation, poolOf(book).map(p => p.translation), rnd);
  if (wrong.length < 3) return null;
  return {
    id: `gen-saved-${w.key}`,
    type: 'meaning',
    label: 'Palavra que você guardou',
    prompt: `Você lembra o que significa “${w.token}”?`,
    context: w.sentence,
    target: w.token,
    options: [w.translation, ...wrong],
    answer: w.translation,
    review: w.key,
  };
}

/** Old exercise prompts sometimes mention segment numbers, which mean nothing to a reader. */
function tidy(ex: Exercise): Exercise {
  const prompt = ex.prompt
    .replace(/\s*\(?\b(?:n[oa]s?|d[oa]s?|em|entre)\s+(?:os\s+)?segmentos?\s+[\d\s,–-]+(?:e\s+\d+)?\)?/giu, '')
    .replace(/\s+([?.!])/g, '$1');
  return { ...ex, prompt };
}

export function pageSteps(book: Book, page: Page, lang: Lang, state: State): Step[] {
  const rnd = rngOf(`${book.meta.id}:${page.index}`);
  const skip = new Set<string>();
  const steps: Step[] = [];
  const n = page.segs.length;
  const mid = Math.floor(n / 2);
  const generate = n >= 3;

  page.segs.forEach((i, k) => {
    steps.push({ kind: 'seg', seg: i });
    const ex = book.segments[i].exercise;
    if (ex && isSupported(ex)) steps.push({ kind: 'ex', ex: tidy(ex) });
    else if (generate && k === mid - 1) {
      const m = meaning(book, page.segs.slice(0, k + 1), rnd, skip);
      if (m) steps.push({ kind: 'ex', ex: m });
    }
  });

  if (generate) {
    const second = page.index % 2 === 0 ? listen(book, page.segs, rnd) ?? cloze(book, page.segs, rnd, skip) : cloze(book, page.segs, rnd, skip);
    if (second) steps.push({ kind: 'ex', ex: second });
    const saved = savedWord(book, lang, state, rnd);
    if (saved) steps.push({ kind: 'ex', ex: saved });
  }

  steps.push({ kind: 'done' });
  return steps;
}
