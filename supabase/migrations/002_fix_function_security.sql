-- Revoke anon access to stats functions
revoke execute on function public.upsert_book_stats_on_segment(uuid, text, int) from anon;
revoke execute on function public.upsert_book_stats_on_exercise(uuid, text, boolean) from anon;

-- Recreate with pinned search_path and SECURITY INVOKER
-- RLS on user_book_stats already restricts access to own rows
create or replace function public.upsert_book_stats_on_segment(
  p_user_id uuid,
  p_book_id text,
  p_segment_id int
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.user_book_stats (user_id, book_id, last_segment_id, segments_done, last_active)
  values (p_user_id, p_book_id, p_segment_id, 1, now())
  on conflict (user_id, book_id) do update
    set last_segment_id = greatest(public.user_book_stats.last_segment_id, p_segment_id),
        segments_done   = public.user_book_stats.segments_done + 1,
        last_active     = now();
end;
$$;

create or replace function public.upsert_book_stats_on_exercise(
  p_user_id uuid,
  p_book_id text,
  p_correct boolean
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.user_book_stats (user_id, book_id, exercises_done, correct_count, last_active)
  values (p_user_id, p_book_id, 1, case when p_correct then 1 else 0 end, now())
  on conflict (user_id, book_id) do update
    set exercises_done = public.user_book_stats.exercises_done + 1,
        correct_count  = public.user_book_stats.correct_count + case when p_correct then 1 else 0 end,
        last_active    = now();
end;
$$;

grant execute on function public.upsert_book_stats_on_segment(uuid, text, int) to authenticated;
grant execute on function public.upsert_book_stats_on_exercise(uuid, text, boolean) to authenticated;
