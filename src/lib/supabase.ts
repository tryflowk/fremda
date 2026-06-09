import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type BookRow = {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  source_language: string;
  target_language: string;
  total_segments: number;
  estimated_minutes: number | null;
  cover_gradient: string | null;
  published: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      books: {
        Row: BookRow;
        Insert: Omit<BookRow, 'created_at'>;
        Update: Partial<Omit<BookRow, 'id' | 'created_at'>>;
      };
      user_library: {
        Row: { user_id: string; book_id: string; added_at: string };
        Insert: { user_id: string; book_id: string };
        Update: Partial<{ added_at: string }>;
      };
      user_progress: {
        Row: {
          user_id: string;
          book_id: string;
          segment_id: number;
          listened: boolean;
          exercise_done: boolean;
          exercise_correct: boolean | null;
          done_at: string | null;
        };
        Insert: {
          user_id: string;
          book_id: string;
          segment_id: number;
          listened?: boolean;
          exercise_done?: boolean;
          exercise_correct?: boolean | null;
          done_at?: string;
        };
        Update: Partial<{
          listened: boolean;
          exercise_done: boolean;
          exercise_correct: boolean | null;
          done_at: string;
        }>;
      };
      user_book_stats: {
        Row: {
          user_id: string;
          book_id: string;
          last_segment_id: number;
          segments_done: number;
          exercises_done: number;
          correct_count: number;
          last_active: string;
        };
        Insert: {
          user_id: string;
          book_id: string;
          last_segment_id?: number;
          segments_done?: number;
          exercises_done?: number;
          correct_count?: number;
        };
        Update: Partial<{
          last_segment_id: number;
          segments_done: number;
          exercises_done: number;
          correct_count: number;
          last_active: string;
        }>;
      };
    };
  };
};
