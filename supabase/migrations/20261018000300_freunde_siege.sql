-- Freunde, eindeutige Namen, Koop-Bestenliste und Siege.
-- Laesst sich wiederholt ausfuehren.

/* ---------------- Freundes-Code (nur fuer einen selbst sichtbar) ---------------- */
alter table public.profile add column if not exists code text;
update public.profile set code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 6)) where code is null;
alter table public.profile alter column code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));
create unique index if not exists profile_code on public.profile (code);

-- Andere sehen nur Name und Skin, nicht den Code
revoke select on public.profile from anon, authenticated;
grant select (id, name, skin, updated_at) on public.profile to anon, authenticated;

create or replace function public.mein_code() returns text
language sql stable security definer set search_path = public as $$
  select code from public.profile where id = auth.uid()
$$;
revoke all on function public.mein_code() from public;
grant execute on function public.mein_code() to authenticated;

/* ---------------- Namen: eindeutig und ohne Schimpfwoerter ---------------- */
-- Schon doppelte Namen bekommen eine Nummer, bevor die Regel greift
with d as (select id, row_number() over (partition by lower(name) order by updated_at, id) as n from public.profile)
update public.profile p set name = left(p.name, 13) || ' ' || d.n from d where d.id = p.id and d.n > 1;
create unique index if not exists profile_name_eindeutig on public.profile (lower(name));

create or replace function public.name_pruefen() returns trigger
language plpgsql as $$
declare
  n text := translate(lower(new.name), '0134578@$', 'oieastbas');
begin
  n := regexp_replace(n, '[^a-zäöüß]', '', 'g');
  if n ~ '(arsch|fick|fotze|hure|nazi|hitler|wichser|schlampe|spast|missgeburt|neger|nigg|penis|vagina|porno|fuck|shit|bitch|cunt|whore|slut|hurensohn|kanake|schwuchtel)' then
    raise exception 'Name nicht erlaubt' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists name_pruefen on public.profile;
create trigger name_pruefen before insert or update of name on public.profile
  for each row execute function public.name_pruefen();

/* ---------------- Freunde (nur ueber den Code) ---------------- */
create table if not exists public.freund (
  von uuid not null references public.profile (id) on delete cascade,
  an uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (von, an),
  check (von <> an)
);
alter table public.freund enable row level security;
drop policy if exists freund_lesen on public.freund;
create policy freund_lesen on public.freund for select to authenticated using ((select auth.uid()) in (von, an));
grant select on public.freund to authenticated;

-- Wer den Code kennt, wird Freund (in beide Richtungen)
create or replace function public.freund_hinzufuegen(freund_code text) returns table (id uuid, name text)
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  er_id uuid;
  er_name text;
begin
  if ich is null then raise exception 'nicht angemeldet' using errcode = 'P0001'; end if;
  select p.id, p.name into er_id, er_name from public.profile p where p.code = upper(trim(freund_code));
  if er_id is null then raise exception 'Code unbekannt' using errcode = 'P0001'; end if;
  if er_id = ich then raise exception 'Das ist dein eigener Code' using errcode = 'P0001'; end if;
  insert into public.freund (von, an) values (ich, er_id), (er_id, ich) on conflict do nothing;
  return query select er_id, er_name;
end $$;
revoke all on function public.freund_hinzufuegen(text) from public;
grant execute on function public.freund_hinzufuegen(text) to authenticated;

create or replace function public.freund_entfernen(freund_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.freund where (von = auth.uid() and an = freund_id) or (von = freund_id and an = auth.uid())
$$;
revoke all on function public.freund_entfernen(uuid) from public;
grant execute on function public.freund_entfernen(uuid) to authenticated;

create or replace view public.meine_freunde with (security_invoker = on) as
  select f.an as user_id, p.name, p.skin, coalesce(b.level, 0) as level
  from public.freund f
  join public.profile p on p.id = f.an
  left join lateral (select max(s.level) as level from public.score s where s.user_id = f.an) b on true
  where f.von = auth.uid();
grant select on public.meine_freunde to authenticated;

/* ---------------- Koop-Bestenliste ---------------- */
create table if not exists public.koop_ergebnis (
  id bigserial primary key,
  von uuid not null references public.profile (id) on delete cascade,
  spieler text[] not null check (array_length(spieler, 1) between 2 and 4),
  level int not null check (level between 1 and 5000),
  dauer_ms int not null check (dauer_ms > 0),
  tag date not null default ((now() at time zone 'Europe/Berlin')::date),
  created_at timestamptz not null default now()
);
create index if not exists koop_level on public.koop_ergebnis (level desc);

create or replace function public.koop_pruefen() returns trigger
language plpgsql as $$
begin
  -- Zu zweit hoechstens doppelt so schnell wie allein (ein Level je 100 ms)
  if new.level - 1 > new.dauer_ms / 100.0 then raise exception 'unplausibles Ergebnis'; end if;
  if exists (select 1 from public.koop_ergebnis where von = new.von and created_at > now() - interval '20 seconds') then
    raise exception 'zu schnell hintereinander';
  end if;
  return new;
end $$;
drop trigger if exists koop_pruefen on public.koop_ergebnis;
create trigger koop_pruefen before insert on public.koop_ergebnis for each row execute function public.koop_pruefen();

alter table public.koop_ergebnis enable row level security;
drop policy if exists koop_lesen on public.koop_ergebnis;
create policy koop_lesen on public.koop_ergebnis for select using (true);
drop policy if exists koop_eintragen on public.koop_ergebnis;
create policy koop_eintragen on public.koop_ergebnis for insert to authenticated with check ((select auth.uid()) = von);
grant select on public.koop_ergebnis to anon, authenticated;
grant insert on public.koop_ergebnis to authenticated;
grant usage, select on sequence public.koop_ergebnis_id_seq to authenticated;

/* ---------------- Siege ---------------- */
create table if not exists public.sieg (
  id bigserial primary key,
  user_id uuid not null references public.profile (id) on delete cascade,
  modus text not null check (modus in ('vs', 'rennen', 'jagd', 'royale')),
  gegner int not null check (gegner between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists sieg_user on public.sieg (user_id);

create or replace function public.sieg_pruefen() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.sieg where user_id = new.user_id and created_at > now() - interval '30 seconds') then
    raise exception 'zu schnell hintereinander';
  end if;
  return new;
end $$;
drop trigger if exists sieg_pruefen on public.sieg;
create trigger sieg_pruefen before insert on public.sieg for each row execute function public.sieg_pruefen();

alter table public.sieg enable row level security;
drop policy if exists sieg_lesen on public.sieg;
create policy sieg_lesen on public.sieg for select using (true);
drop policy if exists sieg_eintragen on public.sieg;
create policy sieg_eintragen on public.sieg for insert to authenticated with check ((select auth.uid()) = user_id);
grant select on public.sieg to anon, authenticated;
grant insert on public.sieg to authenticated;
grant usage, select on sequence public.sieg_id_seq to authenticated;

create or replace view public.sieger_liste with (security_invoker = on) as
  select s.user_id, p.name, p.skin, count(*)::int as level
  from public.sieg s join public.profile p on p.id = s.user_id
  group by s.user_id, p.name, p.skin;
grant select on public.sieger_liste to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.sieg;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.koop_ergebnis;
exception when duplicate_object then null;
end $$;

-- Das Profil hat jetzt eine private Spalte (code): nicht mehr live uebertragen
do $$ begin
  alter publication supabase_realtime drop table public.profile;
exception when undefined_object then null;
end $$;
