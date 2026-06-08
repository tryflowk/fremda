import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserBookStats } from '@/types/book';

export function useProgress(userId: string | undefined) {
  const getStats = useCallback(
    async (bookId: string): Promise<UserBookStats | null> => {
      if (!userId) return null;
      const { data } = await supabase
        .from('user_book_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .maybeSingle();
      return data as UserBookStats | null;
    },
    [userId]
  );

  const markSegmentDone = useCallback(
    async (bookId: string, segmentId: number) => {
      if (!userId) return;
      const now = new Date().toISOString();

      await supabase.from('user_progress').upsert(
        { user_id: userId, book_id: bookId, segment_id: segmentId, listened: true, done_at: now },
        { onConflict: 'user_id,book_id,segment_id' }
      );

      await supabase.rpc('upsert_book_stats_on_segment', {
        p_user_id: userId,
        p_book_id: bookId,
        p_segment_id: segmentId,
      });
    },
    [userId]
  );

  const markExerciseDone = useCallback(
    async (bookId: string, segmentId: number, correct: boolean) => {
      if (!userId) return;

      await supabase.from('user_progress').upsert(
        {
          user_id: userId,
          book_id: bookId,
          segment_id: segmentId,
          exercise_done: true,
          exercise_correct: correct,
          done_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,book_id,segment_id' }
      );

      await supabase.rpc('upsert_book_stats_on_exercise', {
        p_user_id: userId,
        p_book_id: bookId,
        p_correct: correct,
      });
    },
    [userId]
  );

  const ensureInLibrary = useCallback(
    async (bookId: string) => {
      if (!userId) return;
      await supabase
        .from('user_library')
        .upsert({ user_id: userId, book_id: bookId }, { onConflict: 'user_id,book_id' });
    },
    [userId]
  );

  return { getStats, markSegmentDone, markExerciseDone, ensureInLibrary };
}
