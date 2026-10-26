-- Übungsdatenbank im Profilmenü (26.10.2026): Admins dürfen den Grundbestand (created_by null) ändern und löschen
-- (Wunsch des Nutzers; gilt für alle). Eigene Übungen ändern weiterhin nur ihre Ersteller (Policies seit S1).
-- Nur additiv: zwei zusätzliche Policies, die bestehenden bleiben unverändert.

create policy "exercises_update_seed_admin" on public.exercises
  for update to authenticated
  using (created_by is null and (select private.is_admin()))
  with check (created_by is null and (select private.is_admin()));

create policy "exercises_delete_seed_admin" on public.exercises
  for delete to authenticated
  using (created_by is null and (select private.is_admin()));
