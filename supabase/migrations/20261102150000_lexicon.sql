-- Sport & Gesundheit (02.11.2026): Lexikon, ein Nachschlagewerk zu Gesundheitsthemen.
-- Nur additiv: eine Hilfsfunktion, drei Tabellen, Startkategorien.
--   1. private.can_write_lexicon(): wer Einträge und Kategorien schreiben darf. Vorerst nur Admins (Wunsch des
--      Nutzers). Später freigeben = nur diese Funktion per Migration ändern, die Policies bleiben.
--   2. lexicon_categories: Kategorien mit Farbe und Reihenfolge, eine Ebene Unterkategorien (parent_id)
--   3. lexicon_entries: Begriff, Fakten (Bezeichnung + Wert), Inhalt (Textfelder und Tabellen in beliebiger
--      Reihenfolge), Stichworte, Quelle, öffentlich ja/nein. Nicht öffentliche Einträge (Entwürfe) sehen nur ihr
--      Ersteller und Admins.
--   4. lexicon_entry_categories: Zuordnung Eintrag ↔ Kategorie (mehrere möglich)

create or replace function private.can_write_lexicon()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_admin();
$$;
grant execute on function private.can_write_lexicon() to authenticated;

create table public.lexicon_categories (
  id uuid primary key default gen_random_uuid(),
  -- gesetzt = Unterkategorie (nur eine Ebene, siehe Trigger)
  parent_id uuid references public.lexicon_categories (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Farbschlüssel aus der Palette der App (wie bei Getränken und Habits)
  color text not null check (color ~ '^[a-z]{2,16}$'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index lexicon_categories_name_idx on public.lexicon_categories (parent_id, lower(btrim(name))) nulls not distinct;
create index lexicon_categories_parent_idx on public.lexicon_categories (parent_id, position);
create trigger lexicon_categories_set_updated_at
  before update on public.lexicon_categories
  for each row execute function private.set_updated_at();

-- Unterkategorien nur unter Hauptkategorien, nie unter sich selbst
create or replace function private.lexicon_category_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id
       or exists (select 1 from public.lexicon_categories c where c.id = new.parent_id and c.parent_id is not null)
       or exists (select 1 from public.lexicon_categories c where c.parent_id = new.id) then
      raise exception 'Unterkategorien gibt es nur eine Ebene tief.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger lexicon_categories_depth
  before insert or update of parent_id on public.lexicon_categories
  for each row execute function private.lexicon_category_depth();

create table public.lexicon_entries (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(btrim(term)) between 1 and 80),
  -- [{ "label": "Höchstmenge", "value": "…" }, …]
  facts jsonb not null default '[]' check (jsonb_typeof(facts) = 'array' and jsonb_array_length(facts) <= 50),
  -- [{ "type": "text", "text": "…" } | { "type": "table", "rows": [["Kopf", …], [ … ]] }, …]
  blocks jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 50),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  source text check (source is null or char_length(source) <= 1000),
  -- false = Entwurf: nur für Ersteller und Admins sichtbar
  is_public boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(facts::text) + octet_length(blocks::text) <= 200000)
);
-- Begriffe eindeutig (Groß-/Kleinschreibung egal), damit [[Begriff]]-Links eindeutig sind
create unique index lexicon_entries_term_idx on public.lexicon_entries (lower(btrim(term)));
create index lexicon_entries_created_by_idx on public.lexicon_entries (created_by);
create trigger lexicon_entries_set_updated_at
  before update on public.lexicon_entries
  for each row execute function private.set_updated_at();

create table public.lexicon_entry_categories (
  entry_id uuid not null references public.lexicon_entries (id) on delete cascade,
  category_id uuid not null references public.lexicon_categories (id) on delete cascade,
  primary key (entry_id, category_id)
);
create index lexicon_entry_categories_category_idx on public.lexicon_entry_categories (category_id);

alter table public.lexicon_categories enable row level security;
alter table public.lexicon_entries enable row level security;
alter table public.lexicon_entry_categories enable row level security;

-- Kategorien: alle lesen, schreiben nur wer das Lexikon schreiben darf
create policy "lexicon_categories_select" on public.lexicon_categories
  for select to authenticated using (true);
create policy "lexicon_categories_write" on public.lexicon_categories
  for all to authenticated
  using ((select private.can_write_lexicon()))
  with check ((select private.can_write_lexicon()));

-- Einträge: öffentliche alle, Entwürfe nur Ersteller und Admins
create policy "lexicon_entries_select" on public.lexicon_entries
  for select to authenticated
  using (is_public or created_by = (select auth.uid()) or (select private.is_admin()));
create policy "lexicon_entries_insert" on public.lexicon_entries
  for insert to authenticated
  with check ((select private.can_write_lexicon()) and created_by = (select auth.uid()));
-- Ändern und Löschen: eigene Einträge, Admins alle
create policy "lexicon_entries_update" on public.lexicon_entries
  for update to authenticated
  using ((select private.can_write_lexicon()) and (created_by = (select auth.uid()) or (select private.is_admin())))
  with check ((select private.can_write_lexicon()) and (created_by = (select auth.uid()) or (select private.is_admin())));
create policy "lexicon_entries_delete" on public.lexicon_entries
  for delete to authenticated
  using ((select private.can_write_lexicon()) and (created_by = (select auth.uid()) or (select private.is_admin())));

-- Zuordnungen: sichtbar wie der Eintrag (die Unterabfrage unterliegt der RLS der Einträge)
create policy "lexicon_entry_categories_select" on public.lexicon_entry_categories
  for select to authenticated
  using (exists (select 1 from public.lexicon_entries e where e.id = entry_id));
create policy "lexicon_entry_categories_write" on public.lexicon_entry_categories
  for all to authenticated
  using (
    (select private.can_write_lexicon())
    and exists (
      select 1 from public.lexicon_entries e
      where e.id = entry_id and (e.created_by = (select auth.uid()) or (select private.is_admin()))
    )
  )
  with check (
    (select private.can_write_lexicon())
    and exists (
      select 1 from public.lexicon_entries e
      where e.id = entry_id and (e.created_by = (select auth.uid()) or (select private.is_admin()))
    )
  );

revoke all on public.lexicon_categories, public.lexicon_entries, public.lexicon_entry_categories from anon;
grant select, insert, update, delete on public.lexicon_categories, public.lexicon_entries, public.lexicon_entry_categories to authenticated;

-- Startkategorien (lassen sich in der App umbenennen, umfärben, sortieren und löschen)
insert into public.lexicon_categories (name, color, position) values
  ('Training', 'rot', 0),
  ('Übungen', 'blau', 1),
  ('Ernährung', 'orange', 2),
  ('Supplements', 'lila', 3),
  ('Regeneration & Schlaf', 'tuerkis', 4),
  ('Anatomie', 'braun', 5),
  ('Gesundheit', 'gruen', 6),
  ('Begriffe', 'gelb', 7),
  ('Blutwerte', 'pink', 8);
insert into public.lexicon_categories (parent_id, name, color, position)
  select id, 'Aminosäuren', 'orange', 0 from public.lexicon_categories where name = 'Ernährung' and parent_id is null;
