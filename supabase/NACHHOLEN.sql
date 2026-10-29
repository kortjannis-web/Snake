-- ============================================================================================
-- NACHHOLEN: alle Datenbank-Aenderungen seit Version 1.27 in einem Stueck (Stand 1.55).
-- Fuer alle, bei denen die Aenderungen nicht automatisch ankommen (GitHub-Secrets aus
-- docs/ONLINE-EINRICHTEN.md, Schritt 8 fehlen). Einmal komplett im Supabase SQL Editor ausfuehren.
-- Laesst sich gefahrlos wiederholen. Enthaelt:
--   20261021000100_einladen_alle.sql, 20261022000000_sieg_drei_leben.sql, 20261024000000_konto_loeschen.sql
--   (ersetzt 20261021000000_admin_loeschen.sql und 20261023000000_admin_loeschen_fix.sql)
--   und 20261025000000_profil_reparatur.sql (Spieler zuverlaessig in der Hall of Snakes, Freundes-Code, Rekorde)
--   und 20261026000000_hall_live.sql (Hall of Snakes live: neue Spieler, Skins und Namen sofort sichtbar)
--   und 20261026000100_spielstand.sql (Spielstand in der Cloud je Account)
--   und 20261029000000_feedback.sql (Feedback der Spieler, im Admin-Bereich lesbar)
--   und 20261030000000_weltchat_benachrichtigungen.sql (Weltchat, Benachrichtigungen fuer Nachrichten und Weltchat, Einstellungen)
-- Anleitung fuers Handy: docs/SPIELER-LOESCHEN.md
-- ============================================================================================

-- ---------------- 20261021000100_einladen_alle.sql ----------------
-- Einladungen aufs Handy (Push) nicht mehr nur an Freunde: jeder angemeldete Spieler kann jeden anderen
-- zum Gefecht einladen, ausser einer von beiden hat den anderen gesperrt. Laesst sich wiederholt ausfuehren.
-- Der Snake-Server bremst Einladungen (je Empfaenger alle 10 s, je Absender 30 pro Stunde).
create or replace function public.push_fuer(ziel uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.push from public.profile p
  where p.id = ziel
    and auth.uid() is not null
    and auth.uid() <> ziel
    and not public.gesperrt(auth.uid(), ziel)
$$;
revoke all on function public.push_fuer(uuid) from public;
grant execute on function public.push_fuer(uuid) to authenticated;

-- ---------------- 20261022000000_sieg_drei_leben.sql ----------------
-- Mehrspieler mit 3 Leben: der Sieger bekommt doppelt so viele Gold-Trophaeen (je besiegtem Gegner 2).
-- Die Spalte "gegner" zaehlt die Trophaeen eines Siegs, also jetzt 1 bis 6. Laesst sich wiederholt ausfuehren.
alter table public.sieg drop constraint if exists sieg_gegner_check;
alter table public.sieg add constraint sieg_gegner_check check (gegner between 1 and 6);

-- ---------------- 20261024000000_konto_loeschen.sql ----------------
-- Jeder Spieler kann sein eigenes Online-Konto loeschen (Profil, Ergebnisse, Freunde, Nachrichten).
-- Dazu: PostgREST den Schema-Cache neu laden lassen, damit auch admin_spieler_loeschen (PGRST202) sofort gefunden wird.
create or replace function public.konto_loeschen() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = 'P0001';
  end if;
  delete from public.profile where id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.konto_loeschen() from public;
revoke all on function public.konto_loeschen() from anon;
grant execute on function public.konto_loeschen() to authenticated;

-- Admin-Funktion zur Sicherheit noch einmal (wiederholbar), damit sie sicher vorhanden ist
create extension if not exists pgcrypto with schema extensions;
do $$
declare r record;
begin
  for r in select oid::regprocedure as f from pg_proc where proname = 'admin_spieler_loeschen' and pronamespace = 'public'::regnamespace loop
    execute 'drop function ' || r.f;
  end loop;
end $$;
create function public.admin_spieler_loeschen(code text, ziel uuid) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from public.profile where id = ziel;
  delete from auth.users where id = ziel;
end $$;
revoke all on function public.admin_spieler_loeschen(text, uuid) from public;
grant execute on function public.admin_spieler_loeschen(text, uuid) to authenticated;

-- ---------------- 20261025000000_profil_reparatur.sql ----------------
-- Hall of Snakes zuverlaessig: Spieler, die online "unsichtbar" waren (kein Freundes-Code, fehlen in der Hall,
-- Skin und Rekord kommen nicht an). Laesst sich wiederholt ausfuehren.
--
-- 1. profil_speichern: Die App schreibt ihr Profil (Name, Skin, Silber) ueber diese eine Funktion. Sie legt die Zeile
--    an oder aktualisiert sie in einem Schritt (ohne die Spaltenrechte und Regeln einer direkten Tabellen-Aenderung),
--    gibt den Freundes-Code zurueck und meldet einen vergebenen Namen eindeutig (23505).
-- 2. Ergebnisse: hoechstens eins je 3 Sekunden statt je 10. Mit 10 s ging beim Nachsenden mehrerer gespeicherter
--    Runden alles ausser der ersten verloren (die App wartet jetzt zusaetzlich und wirft nichts mehr weg).
-- 3. konto_status: Was die Datenbank ueber das eigene Konto weiss (fuer die Anzeige "Online eingetragen" in der App).

create or replace function public.profil_speichern(p_name text, p_skin text default null, p_silber bigint default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  n text := btrim(coalesce(p_name, ''));
  c text;
begin
  if ich is null then
    raise exception 'Nicht angemeldet.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = ich) then
    raise exception 'Konto gibt es nicht mehr.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profile where lower(name) = lower(n) and id <> ich) then
    raise exception 'Diesen Namen gibt es schon.' using errcode = '23505';
  end if;
  insert into public.profile as p (id, name, skin, silber, updated_at)
  values (ich, n, coalesce(nullif(left(p_skin, 32), ''), 'klassik'), greatest(coalesce(p_silber, 0), 0), now())
  on conflict (id) do update set
    name = excluded.name,
    skin = coalesce(nullif(left(p_skin, 32), ''), p.skin),
    silber = greatest(p.silber, coalesce(p_silber, 0)),
    updated_at = now()
  returning p.code into c;
  -- Aeltere Zeilen ohne Code (vor dem Freundes-Code angelegt): jetzt einen geben
  if c is null then
    update public.profile set code = upper(substr(md5(gen_random_uuid()::text), 1, 6)) where id = ich returning code into c;
  end if;
  return c;
end $$;
revoke all on function public.profil_speichern(text, text, bigint) from public;
revoke all on function public.profil_speichern(text, text, bigint) from anon;
grant execute on function public.profil_speichern(text, text, bigint) to authenticated;

-- Schummelschutz fuer Ergebnisse wie bisher, nur 3 statt 10 Sekunden Abstand
create or replace function public.score_pruefen() returns trigger
language plpgsql as $$
begin
  if new.level - 1 > new.dauer_ms / 200.0 then
    raise exception 'unplausibles Ergebnis';
  end if;
  if exists (
    select 1 from public.score
    where user_id = new.user_id and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'zu schnell hintereinander';
  end if;
  return new;
end $$;

create or replace function public.konto_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'angemeldet', auth.uid() is not null,
    'profil', exists (select 1 from public.profile where id = auth.uid()),
    'name', (select name from public.profile where id = auth.uid()),
    'code', (select code from public.profile where id = auth.uid()),
    'rekord', coalesce((select max(level) from public.score where user_id = auth.uid()), 0)
  )
$$;
revoke all on function public.konto_status() from public;
grant execute on function public.konto_status() to authenticated;

notify pgrst, 'reload schema';

-- ---------------- 20261026000000_hall_live.sql ----------------
-- Hall of Snakes live: Neuer Spieler, neuer Skin, neuer Name, Silber oder geloeschter Spieler erscheinen sofort bei allen.
-- Das Profil selbst bleibt aus Realtime heraus (private Spalte code). Stattdessen zaehlt die kleine Tabelle hall_signal
-- bei jeder solchen Aenderung hoch, und nur diese Zahl geht live raus. Neue Rekorde kommen wie bisher ueber score.
-- Laesst sich wiederholt ausfuehren.

create table if not exists public.hall_signal (
  id smallint primary key default 1 check (id = 1),
  stand bigint not null default 0,
  at timestamptz not null default now()
);
insert into public.hall_signal (id) values (1) on conflict (id) do nothing;
alter table public.hall_signal enable row level security;
drop policy if exists hall_signal_lesen on public.hall_signal;
create policy hall_signal_lesen on public.hall_signal for select using (true);
revoke all on public.hall_signal from anon, authenticated;
grant select on public.hall_signal to anon, authenticated;

create or replace function public.hall_signal_geben() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.skin is not distinct from old.skin
     and new.silber is not distinct from old.silber then
    return null;
  end if;
  update public.hall_signal set stand = stand + 1, at = now() where id = 1;
  return null;
end $$;

drop trigger if exists hall_signal_profil on public.profile;
create trigger hall_signal_profil after insert or update or delete on public.profile
  for each row execute function public.hall_signal_geben();

do $$ begin
  alter publication supabase_realtime add table public.hall_signal;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

-- ---------------- 20261026000100_spielstand.sql ----------------
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

-- ---------------- 20261029000000_feedback.sql ----------------
-- Feedback der Spieler (Knopf mit dem orangen Ausrufezeichen oben im Startmenue): mehrere einzelne Punkte je Nachricht.
-- Schreiben nur ueber feedback_senden (auch ohne Anmeldung), lesen und loeschen nur der Admin (Admin-Passwort).
-- Laesst sich wiederholt ausfuehren.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  name text,
  punkte text[] not null,
  version text,
  erstellt timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
create index if not exists feedback_erstellt on public.feedback (erstellt desc);

create or replace function public.feedback_senden(p_punkte text[], p_name text default null, p_version text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  liste text[];
begin
  select coalesce(array_agg(left(btrim(p), 1000)), '{}') into liste
  from unnest(coalesce(p_punkte, '{}')) as t(p) where btrim(p) <> '';
  if cardinality(liste) = 0 then
    raise exception 'Schreib erst etwas.' using errcode = 'P0001';
  end if;
  if cardinality(liste) > 20 then
    raise exception 'Höchstens 20 Punkte auf einmal.' using errcode = 'P0001';
  end if;
  -- Bremse gegen Spam: je Account 10 Nachrichten pro Stunde, insgesamt 300 pro Stunde
  if auth.uid() is not null and (select count(*) from public.feedback where user_id = auth.uid() and erstellt > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast gerade schon viel geschickt. Versuch es später noch mal.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.feedback where erstellt > now() - interval '1 hour') >= 300 then
    raise exception 'Gerade kommt sehr viel an. Versuch es später noch mal.' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, name, punkte, version)
  values (auth.uid(), left(nullif(btrim(p_name), ''), 32), liste, left(p_version, 20));
end $$;
revoke all on function public.feedback_senden(text[], text, text) from public;
grant execute on function public.feedback_senden(text[], text, text) to anon, authenticated;

create or replace function public.admin_feedback(code text)
returns table (id bigint, name text, punkte text[], version text, erstellt timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  return query select f.id, f.name, f.punkte, f.version, f.erstellt from public.feedback f order by f.erstellt desc limit 500;
end $$;
revoke all on function public.admin_feedback(text) from public;
grant execute on function public.admin_feedback(text) to anon, authenticated;

create or replace function public.admin_feedback_loeschen(code text, ziel bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from public.feedback where feedback.id = ziel;
end $$;
revoke all on function public.admin_feedback_loeschen(text, bigint) from public;
grant execute on function public.admin_feedback_loeschen(text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------- 20261030000000_weltchat_benachrichtigungen.sql ----------------
-- Weltchat (alle angemeldeten Spieler, Nachrichten 7 Tage) und Benachrichtigungen mit Einstellungen:
-- private Nachrichten, Weltchat und Einladungen einzeln an- und ausschaltbar, einzelne Spieler stumm.
-- Der Snake-Server holt sich die Push-Abos ueber push_nachricht und push_welt (nur mit dem Token des Absenders,
-- nur fuer eine frische eigene Nachricht, jede Nachricht nur einmal). Laesst sich wiederholt ausfuehren.

/* ---------------- Einstellungen der Benachrichtigungen (privat, nur ueber die Funktionen) ---------------- */
-- {"nachrichten": true, "welt": true, "einladungen": true, "stumm": ["<uuid>", ...]}; fehlt ein Wert, gilt "an"
alter table public.profile add column if not exists push_einstellung jsonb not null default '{}'::jsonb;

create or replace function public.push_einstellung_setzen(e jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profile set push_einstellung = jsonb_build_object(
    'nachrichten', coalesce((e ->> 'nachrichten')::boolean, true),
    'welt', coalesce((e ->> 'welt')::boolean, true),
    'einladungen', coalesce((e ->> 'einladungen')::boolean, true),
    'stumm', coalesce((
      select jsonb_agg(x) from (
        select distinct x from jsonb_array_elements_text(case when jsonb_typeof(e -> 'stumm') = 'array' then e -> 'stumm' else '[]'::jsonb end) as t(x)
        where x ~* '^[0-9a-f-]{36}$' limit 500
      ) s), '[]'::jsonb)
  ) where id = auth.uid()
$$;
revoke all on function public.push_einstellung_setzen(jsonb) from public;
grant execute on function public.push_einstellung_setzen(jsonb) to authenticated;

create or replace function public.meine_push_einstellung() returns jsonb
language sql stable security definer set search_path = public as $$
  select push_einstellung from public.profile where id = auth.uid()
$$;
revoke all on function public.meine_push_einstellung() from public;
grant execute on function public.meine_push_einstellung() to authenticated;

-- Einladungen aufs Handy nur, wenn der Empfaenger sie nicht ausgeschaltet hat
create or replace function public.push_fuer(ziel uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.push from public.profile p
  where p.id = ziel
    and auth.uid() is not null
    and auth.uid() <> ziel
    and not public.gesperrt(auth.uid(), ziel)
    and coalesce((p.push_einstellung ->> 'einladungen')::boolean, true)
$$;
revoke all on function public.push_fuer(uuid) from public;
grant execute on function public.push_fuer(uuid) to authenticated;

/* ---------------- Push fuer private Nachrichten ---------------- */
alter table public.nachricht add column if not exists gepusht boolean not null default false;

-- Gibt {abo, name, text} zurueck oder null (Empfaenger hat es aus, den Absender stumm, kein Abo, schon gepusht).
-- Hoechstens ein Push je Absender und Empfaenger alle 20 s, damit das Handy nicht dauernd brummt
create or replace function public.push_nachricht(nid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  n record;
  p record;
begin
  if ich is null then return null; end if;
  select * into n from public.nachricht where id = nid and von = ich and not gepusht and created_at > now() - interval '2 minutes';
  if not found then return null; end if;
  update public.nachricht set gepusht = true where id = nid;
  if exists (select 1 from public.nachricht where von = ich and an = n.an and gepusht and id <> nid and created_at > now() - interval '20 seconds') then
    return null;
  end if;
  select push, push_einstellung into p from public.profile where id = n.an;
  if p.push is null or not coalesce((p.push_einstellung ->> 'nachrichten')::boolean, true)
     or coalesce(p.push_einstellung -> 'stumm' ? ich::text, false) then
    return null;
  end if;
  return jsonb_build_object('abo', p.push, 'name', (select name from public.profile where id = ich), 'text', left(n.text, 140));
end $$;
revoke all on function public.push_nachricht(bigint) from public;
grant execute on function public.push_nachricht(bigint) to authenticated;

/* ---------------- Weltchat ---------------- */
create table if not exists public.weltchat (
  id bigserial primary key,
  von uuid not null references public.profile (id) on delete cascade,
  name text not null default '',
  skin text,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  gepusht boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weltchat_zeit on public.weltchat (created_at desc);

alter table public.weltchat enable row level security;
drop policy if exists weltchat_lesen on public.weltchat;
create policy weltchat_lesen on public.weltchat for select to authenticated using (true);
drop policy if exists weltchat_schreiben on public.weltchat;
create policy weltchat_schreiben on public.weltchat for insert to authenticated with check ((select auth.uid()) = von);
revoke all on public.weltchat from anon, authenticated;
grant select on public.weltchat to authenticated;
grant insert (von, text) on public.weltchat to authenticated;
grant usage, select on sequence public.weltchat_id_seq to authenticated;

-- Name und Skin vom Profil, hoechstens 8 Nachrichten pro Minute, nebenbei alles loeschen, was aelter als 7 Tage ist
create or replace function public.weltchat_pruefen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.weltchat where von = new.von and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'Zu viele Nachrichten, kurz warten' using errcode = 'P0001';
  end if;
  select name, skin into new.name, new.skin from public.profile where id = new.von;
  if new.name is null then raise exception 'Erst anmelden' using errcode = 'P0001'; end if;
  new.text := btrim(new.text);
  new.gepusht := false;
  new.created_at := now();
  delete from public.weltchat where created_at < now() - interval '7 days';
  return new;
end $$;
drop trigger if exists weltchat_pruefen on public.weltchat;
create trigger weltchat_pruefen before insert on public.weltchat for each row execute function public.weltchat_pruefen();

-- Admin (Master-Passwort): eine Nachricht aus dem Weltchat loeschen
create extension if not exists pgcrypto with schema extensions;
create or replace function public.admin_weltchat_loeschen(code text, ziel bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from public.weltchat where weltchat.id = ziel;
end $$;
revoke all on function public.admin_weltchat_loeschen(text, bigint) from public;
grant execute on function public.admin_weltchat_loeschen(text, bigint) to anon, authenticated;

/* ---------------- Push fuer den Weltchat ---------------- */
-- Wann jeder zuletzt einen Weltchat-Push bekam: hoechstens einer alle 10 Minuten
create table if not exists public.push_zuletzt (
  user_id uuid primary key references public.profile (id) on delete cascade,
  welt timestamptz not null default now()
);
alter table public.push_zuletzt enable row level security;
revoke all on public.push_zuletzt from anon, authenticated;

-- Je Aufruf bis zu 40 Empfaenger (der Snake-Server darf im Gratis-Tarif nur ~50 Anfragen je Aufruf stellen).
-- Die gelieferten werden sofort als benachrichtigt eingetragen, der naechste Aufruf bekommt also die naechsten 40.
-- ohne: wer gerade online ist (sieht es ohnehin in der App)
create or replace function public.push_welt(nid bigint, ohne uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  m record;
  liste jsonb;
begin
  select * into m from public.weltchat where id = nid and von = ich and created_at > now() - interval '2 minutes';
  if not found then return jsonb_build_object('abos', '[]'::jsonb, 'fertig', true); end if;
  update public.weltchat set gepusht = true where id = nid;
  with ziele as (
    select p.id, p.push from public.profile p
    left join public.push_zuletzt z on z.user_id = p.id
    where p.push is not null and p.id <> ich and not (p.id = any (coalesce(ohne, '{}')))
      and coalesce((p.push_einstellung ->> 'welt')::boolean, true)
      and (z.welt is null or z.welt < now() - interval '10 minutes')
      and not public.gesperrt(ich, p.id)
    order by p.id
    limit 40
  ), eingetragen as (
    insert into public.push_zuletzt (user_id, welt) select id, now() from ziele
    on conflict (user_id) do update set welt = excluded.welt
    returning user_id
  )
  select coalesce(jsonb_agg(z.push), '[]'::jsonb) into liste from ziele z join eingetragen e on e.user_id = z.id;
  return jsonb_build_object('abos', liste, 'fertig', jsonb_array_length(liste) < 40, 'name', m.name, 'text', left(m.text, 140));
end $$;
revoke all on function public.push_welt(bigint, uuid[]) from public;
grant execute on function public.push_welt(bigint, uuid[]) to authenticated;

/* ---------------- Live ---------------- */
do $$ begin
  alter publication supabase_realtime add table public.weltchat;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
