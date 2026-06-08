-- Biblioteca pessoal
create table if not exists user_library (
  user_id    uuid references auth.users on delete cascade,
  book_id    text not null,
  added_at   timestamptz default now(),
  primary key (user_id, book_id)
);

-- Progresso por segmento
create table if not exists user_progress (
  user_id           uuid references auth.users on delete cascade,
  book_id           text not null,
  segment_id        int not null,
  listened          boolean default false,
  exercise_done     boolean default false,
  exercise_correct  boolean,
  done_at           timestamptz,
  primary key (user_id, book_id, segment_id)
);

-- Resumo por livro
create table if not exists user_book_stats (
  user_id          uuid references auth.users on delete cascade,
  book_id          text not null,
  last_segment_id  int default 0,
  segments_done    int default 0,
  exercises_done   int default 0,
  correct_count    int default 0,
  last_active      timestamptz default now(),
  primary key (user_id, book_id)
);

-- RLS
alter table user_library enable row level security;
alter table user_progress enable row level security;
alter table user_book_stats enable row level security;

create policy "users own library" on user_library
  for all using (auth.uid() = user_id);

create policy "users own progress" on user_progress
  for all using (auth.uid() = user_id);

create policy "users own stats" on user_book_stats
  for all using (auth.uid() = user_id);

-- Função: upsert stats ao marcar segmento concluído
create or replace function upsert_book_stats_on_segment(
  p_user_id uuid,
  p_book_id text,
  p_segment_id int
) returns void language plpgsql security definer as $$
begin
  insert into user_book_stats (user_id, book_id, last_segment_id, segments_done, last_active)
  values (p_user_id, p_book_id, p_segment_id, 1, now())
  on conflict (user_id, book_id) do update
    set last_segment_id = greatest(user_book_stats.last_segment_id, p_segment_id),
        segments_done   = user_book_stats.segments_done + 1,
        last_active     = now();
end;
$$;

-- Função: upsert stats ao marcar exercício
create or replace function upsert_book_stats_on_exercise(
  p_user_id uuid,
  p_book_id text,
  p_correct boolean
) returns void language plpgsql security definer as $$
begin
  insert into user_book_stats (user_id, book_id, exercises_done, correct_count, last_active)
  values (p_user_id, p_book_id, 1, case when p_correct then 1 else 0 end, now())
  on conflict (user_id, book_id) do update
    set exercises_done = user_book_stats.exercises_done + 1,
        correct_count  = user_book_stats.correct_count + case when p_correct then 1 else 0 end,
        last_active    = now();
end;
$$;
