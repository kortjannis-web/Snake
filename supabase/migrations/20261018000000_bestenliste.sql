-- Bestenliste fuer Snake Endlos.
-- Spieler sind anonyme Gaeste (Supabase "Anonymous Sign-Ins"): feste Nutzer-Id ohne Passwort.
-- Lesen darf jeder, schreiben nur das eigene Profil und eigene Ergebnisse.

create table if not exists public.profile (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 2 and 16),
  updated_at timestamptz not null default now()
);

create table if not exists public.score (
  id bigserial primary key,
  user_id uuid not null references public.profile (id) on delete cascade,
  level int not null check (level between 2 and 5000),
  dauer_ms int not null check (dauer_ms > 0),
  tempo text not null check (tempo in ('langsam', 'normal', 'schnell')),
  version text not null default '',
  tag date not null default ((now() at time zone 'Europe/Berlin')::date),
  created_at timestamptz not null default now()
);
create index if not exists score_tag_level on public.score (tag, level desc);
create index if not exists score_level on public.score (level desc);
create index if not exists score_user on public.score (user_id, created_at desc);

-- Schummelschutz (unter Freunden reicht grob): schneller als ein Level je 200 ms ist
-- nicht zu schaffen, und hoechstens ein Ergebnis alle 10 Sekunden je Spieler.
create or replace function public.score_pruefen() returns trigger
language plpgsql as $$
begin
  if new.level - 1 > new.dauer_ms / 200.0 then
    raise exception 'unplausibles Ergebnis';
  end if;
  if exists (
    select 1 from public.score
    where user_id = new.user_id and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'zu schnell hintereinander';
  end if;
  return new;
end $$;

drop trigger if exists score_pruefen on public.score;
create trigger score_pruefen before insert on public.score
  for each row execute function public.score_pruefen();

alter table public.profile enable row level security;
alter table public.score enable row level security;

drop policy if exists profile_lesen on public.profile;
create policy profile_lesen on public.profile for select using (true);
drop policy if exists profile_eintragen on public.profile;
create policy profile_eintragen on public.profile for insert to authenticated
  with check ((select auth.uid()) = id);
drop policy if exists profile_aendern on public.profile;
create policy profile_aendern on public.profile for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists score_lesen on public.score;
create policy score_lesen on public.score for select using (true);
drop policy if exists score_eintragen on public.score;
create policy score_eintragen on public.score for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- kein update / delete: Ergebnisse sind endgueltig

-- Bester Lauf je Spieler: heute (Berliner Tag) und fuer immer
create or replace view public.bestenliste_heute with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at
  from public.score s join public.profile p on p.id = s.user_id
  where s.tag = (now() at time zone 'Europe/Berlin')::date
  order by s.user_id, s.level desc, s.dauer_ms asc;

create or replace view public.bestenliste_immer with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at
  from public.score s join public.profile p on p.id = s.user_id
  order by s.user_id, s.level desc, s.dauer_ms asc;

grant select on public.profile, public.score, public.bestenliste_heute, public.bestenliste_immer to anon, authenticated;
grant insert, update on public.profile to authenticated;
grant insert on public.score to authenticated;
grant usage, select on sequence public.score_id_seq to authenticated;

-- Live-Aktualisierung: neue Ergebnisse gehen per Realtime an alle offenen Apps
do $$ begin
  alter publication supabase_realtime add table public.score;
exception when duplicate_object then null;
end $$;
