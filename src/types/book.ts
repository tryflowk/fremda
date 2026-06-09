export interface WordToken {
  token: string;
  lemma?: string;
  translation: string;
}

export type ExerciseType =
  | 'word_select'
  | 'word_order'
  | 'fill_blank'
  | 'yes_no'
  | 'translate_word';

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  options?: string[];
  chips?: string[];
  answer: string;
  target_token?: string;
  segment_id?: number;
  source_segment_ids: number[];
}

export type SegmentType = 'paragraph' | 'chapter_title' | 'section_break';

export interface Segment {
  id: number;
  segment_type?: SegmentType;
  text: string;
  tts_prompt: string;
  image_url?: string | null;
  words: WordToken[];
  exercise: Exercise | null;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  year: number;
  source_language: string;
  target_language: string;
  cover_image: string;
  tts_voice: string;
  total_segments: number;
  estimated_minutes: number;
  exercise_every_n_segments: number;
}

export interface Book {
  meta: BookMeta;
  segments: Segment[];
}

export interface UserBookStats {
  user_id: string;
  book_id: string;
  last_segment_id: number;
  segments_done: number;
  exercises_done: number;
  correct_count: number;
  last_active: string;
}
