import type { Book, BookEntry, Lang, Page, Segment } from './types';

const base = import.meta.env.BASE_URL;

let catalog: Promise<BookEntry[]> | null = null;
const cache = new Map<string, Promise<Book>>();

export function loadCatalog(): Promise<BookEntry[]> {
  catalog ??= fetch(`${base}content/index.json`).then(r => r.json());
  return catalog;
}

export function loadBook(id: string): Promise<Book> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${base}content/${id}/book.json`).then(r => {
      if (!r.ok) throw new Error(`Livro não encontrado: ${id}`);
      return r.json();
    });
    cache.set(id, p);
  }
  return p;
}

/** Book JSON stores images as absolute /content/... paths; resolve against the app base. */
export function assetUrl(url: string): string {
  return url.startsWith('/') ? base + url.slice(1) : url;
}

export const LANG_NAME: Record<Lang, string> = { de: 'alemão', fr: 'francês', en: 'inglês' };
export const LANG_CODE: Record<Lang, string> = { de: 'DE', fr: 'FR', en: 'EN' };
export const SPEECH_LANG: Record<Lang, string> = { de: 'de-DE', fr: 'fr-FR', en: 'en-GB' };

const PAGE_MIN = 6;
const PAGE_MAX = 9;

/**
 * Splits a book into short reading sessions. A chapter title always opens a new
 * page; otherwise a page closes after PAGE_MIN sentences at the next exercise
 * (so a page ends on a question), or at PAGE_MAX regardless.
 */
export function paginate(book: Book): Page[] {
  const pages: Page[] = [];
  let cur: Page = { index: 0, title: null, segs: [] };
  const close = () => {
    if (cur.segs.length) pages.push(cur);
    cur = { index: pages.length, title: null, segs: [] };
  };
  book.segments.forEach((s, i) => {
    if (s.segment_type === 'chapter_title') {
      close();
      cur.title = s.text;
      return;
    }
    if (s.segment_type === 'section_break' || !s.text.trim()) return;
    cur.segs.push(i);
    const n = cur.segs.length;
    if ((n >= PAGE_MIN && s.exercise) || n >= PAGE_MAX) close();
  });
  close();
  return pages;
}

/** The chapter a page belongs to: pages from one titled page up to the next. */
export function chapterOf(pages: Page[], pageIdx: number) {
  let start = pageIdx;
  while (start > 0 && pages[start].title === null) start--;
  let end = pageIdx;
  while (end + 1 < pages.length && pages[end + 1].title === null) end++;
  return { title: pages[start].title, start, end };
}

export function pageOf(pages: Page[], segIndex: number): number {
  const i = pages.findIndex(p => p.segs[p.segs.length - 1] >= segIndex);
  return i === -1 ? pages.length - 1 : i;
}

export interface Piece {
  text: string;
  /** Tappable word or phrase. */
  word: boolean;
  gloss?: { token: string; translation: string; lemma?: string };
}

const LETTER = /[\p{L}\p{M}'’-]/u;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lines up the segment's glossed tokens (which may be phrases like "grande personne")
 * with the running text, then splits the rest into plain words and punctuation.
 */
export function piecesOf(seg: Segment): Piece[] {
  const text = seg.text;
  const spans: { start: number; end: number; w: Segment['words'][number] }[] = [];
  let cursor = 0;
  for (const w of seg.words) {
    const re = new RegExp(`(?<![\\p{L}\\p{M}])${escapeRe(w.token)}(?![\\p{L}\\p{M}])`, 'gu');
    const find = (from: number) => {
      re.lastIndex = from;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const s = m.index, e = s + m[0].length;
        if (!spans.some(sp => s < sp.end && e > sp.start)) return { s, e };
      }
      return null;
    };
    const hit = find(cursor) ?? find(0);
    if (!hit) continue;
    spans.push({ start: hit.s, end: hit.e, w });
    cursor = hit.e;
  }
  spans.sort((a, b) => a.start - b.start);

  const out: Piece[] = [];
  const pushPlain = (chunk: string) => {
    let buf = '';
    let inWord = false;
    for (const ch of chunk) {
      const isL = LETTER.test(ch);
      if (buf && isL !== inWord) {
        out.push({ text: buf, word: inWord });
        buf = '';
      }
      inWord = isL;
      buf += ch;
    }
    if (buf) out.push({ text: buf, word: inWord });
  };
  let pos = 0;
  for (const sp of spans) {
    if (sp.start > pos) pushPlain(text.slice(pos, sp.start));
    out.push({ text: text.slice(sp.start, sp.end), word: true, gloss: sp.w });
    pos = sp.end;
  }
  if (pos < text.length) pushPlain(text.slice(pos));
  return out;
}

/** True when most words carry a translation (short graded texts), so hints would be noise. */
export function denselyGlossed(seg: Segment): boolean {
  const words = seg.text.split(/\s+/).filter(Boolean).length;
  return words > 0 && seg.words.length / words > 0.6;
}
