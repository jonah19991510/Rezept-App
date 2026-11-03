-- Sport & Gesundheit (03.11.2026): Trainings posten wie bei Strava (Phase C3).
-- Nur additiv: drei Tabellen.
--   1. workout_posts: ein geteiltes Training mit eigenem Text und einer festen Zusammenfassung (Dauer, Übungen,
--      bester Satz, Volumen, Bestwerte). Die Zusammenfassung baut der Server beim Teilen aus dem eigenen Training;
--      die Trainings selbst bleiben privat. Training gelöscht = Post weg.
--   2. post_kudos: Anfeuern (einmal je Person und Post, nicht beim eigenen).
--   3. post_comments: Kommentare.
-- Alle Eingeloggten lesen alles; schreiben nur für sich selbst.

create table public.workout_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- je Training höchstens ein Post
  workout_id uuid not null unique references public.workouts (id) on delete cascade,
  body text check (body is null or char_length(body) <= 1000),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  -- Startzeit des Trainings (Reihenfolge im Feed: wann trainiert, nicht wann geteilt)
  trained_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_posts_trained_at_idx on public.workout_posts (trained_at desc);
create index workout_posts_user_idx on public.workout_posts (user_id);
create trigger workout_posts_set_updated_at
  before update on public.workout_posts
  for each row execute function private.set_updated_at();

create table public.post_kudos (
  post_id uuid not null references public.workout_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_kudos_user_idx on public.post_kudos (user_id);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.workout_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_user_idx on public.post_comments (user_id);

-- Eigenes, beendetes Training?
create or replace function private.owns_finished_workout(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workouts
    where id = p_workout_id and user_id = (select auth.uid()) and ended_at is not null
  );
$$;
grant execute on function private.owns_finished_workout(uuid) to authenticated;

-- Wem gehört ein Post? (Kudos nicht beim eigenen, Kommentare darf der Post-Autor löschen)
create or replace function private.post_owner(p_post_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.workout_posts where id = p_post_id;
$$;
grant execute on function private.post_owner(uuid) to authenticated;

alter table public.workout_posts enable row level security;
alter table public.post_kudos enable row level security;
alter table public.post_comments enable row level security;

create policy "workout_posts_select" on public.workout_posts
  for select to authenticated
  using (true);
create policy "workout_posts_insert_own" on public.workout_posts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.owns_finished_workout(workout_id));
create policy "workout_posts_update_own" on public.workout_posts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.owns_finished_workout(workout_id));
create policy "workout_posts_delete_own_or_admin" on public.workout_posts
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "post_kudos_select" on public.post_kudos
  for select to authenticated
  using (true);
create policy "post_kudos_insert_own" on public.post_kudos
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.post_owner(post_id) is distinct from (select auth.uid()));
create policy "post_kudos_delete_own" on public.post_kudos
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "post_comments_select" on public.post_comments
  for select to authenticated
  using (true);
create policy "post_comments_insert_own" on public.post_comments
  for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Löschen: wer geschrieben hat, wem der Post gehört, Admins
create policy "post_comments_delete" on public.post_comments
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.post_owner(post_id) = (select auth.uid())
    or (select private.is_admin())
  );

revoke all on public.workout_posts, public.post_kudos, public.post_comments from anon;
grant select, insert, update, delete on public.workout_posts to authenticated;
grant select, insert, delete on public.post_kudos, public.post_comments to authenticated;
revoke update on public.post_kudos, public.post_comments from authenticated;
-- Posts: nur Text und Zusammenfassung ändern, nicht Autor, Training oder Zeitpunkt
revoke update on public.workout_posts from authenticated;
grant update (body, summary) on public.workout_posts to authenticated;
