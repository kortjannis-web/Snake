-- Spielstand in der Cloud: Aepfel, Skins, Welten, Rekorde, Statistik und Erfolge je Account. Wer sich mit Name und
-- Passwort auf einem anderen Geraet anmeldet, hat dort alles wieder. Nur der Account selbst kann ihn lesen und schreiben.
-- `stand` zaehlt jedes Speichern hoch (die App schreibt nur, wenn sich seit dem Lesen nichts geaendert hat).
-- Wird der Account geloescht (Admin oder selbst), geht der Spielstand mit. Laesst sich wiederholt ausfuehren.

create table if not exists public.spielstand (
  id uuid primary key references auth.users (id) on delete cascade,
  daten jsonb not null default '{}'::jsonb,
  stand bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.spielstand enable row level security;

drop policy if exists spielstand_lesen on public.spielstand;
create policy spielstand_lesen on public.spielstand for select to authenticated using (id = auth.uid());
drop policy if exists spielstand_anlegen on public.spielstand;
create policy spielstand_anlegen on public.spielstand for insert to authenticated with check (id = auth.uid());
drop policy if exists spielstand_aendern on public.spielstand;
create policy spielstand_aendern on public.spielstand for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.spielstand from anon, authenticated;
grant select, insert, update on public.spielstand to authenticated;

-- Hoechstens 256 KB je Spielstand (die App braucht wenige KB)
alter table public.spielstand drop constraint if exists spielstand_groesse;
alter table public.spielstand add constraint spielstand_groesse check (pg_column_size(daten) < 262144);

notify pgrst, 'reload schema';
