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

export type ExerciseType = 'word_select' | 'word_order' | 'fill_blank' | 'yes_no' | 'translate_word';

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  chips?: string[];
  answer: string;
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
