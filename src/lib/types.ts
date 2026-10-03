export type Lang = 'de' | 'fr' | 'en';

export interface BookEntry {
  id: string;
  title: string;
  title_pt: string;
  author: string;
  year: number;
  lang: Lang;
  level: string;
  blurb: string;
  cover: string;
  /** Total segments in book.json (positions are indices into it). */
  segments: number;
}

export interface WordToken {
  token: string;
  lemma?: string;
  translation: string;
}

export type ExerciseType =
  | 'word_select' | 'word_order' | 'fill_blank' | 'yes_no' | 'translate_word'
  // Made on the fly from the page (see lib/generate.ts).
  | 'meaning' | 'cloze' | 'listen';

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  chips?: string[];
  answer: string;
  /** Small label above the prompt ("Vocabulário", "Ouvido"...). */
  label?: string;
  /** Sentence shown under the prompt; `target` is highlighted (or blanked, for cloze). */
  context?: string;
  target?: string;
  /** Text the card reads aloud (listening exercises). */
  audio?: string;
  /** Options are in the book's language, so they use the reading font and can be heard. */
  foreignOptions?: boolean;
  /** Saved-word key: answering also counts as a review of that word. */
  review?: string;
  /** Book questions: the segments (by id) the question is about. */
  source_segment_ids?: number[];
  /** The passage a comprehension question is about, shown on request. */
  passage?: string;
}

export interface Segment {
  id: number;
  segment_type?: 'paragraph' | 'chapter_title' | 'section_break';
  text: string;
  image_url?: string | null;
  words: WordToken[];
  exercise: Exercise | null;
}

export interface Book {
  meta: { id: string; title: string; author: string; year: number; source_language: Lang };
  segments: Segment[];
}

/** A reading session: a chapter heading (optional) plus a handful of sentences. */
export interface Page {
  index: number;
  title: string | null;
  /** Indices into book.segments of the readable segments on this page. */
  segs: number[];
}
