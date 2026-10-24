-- ============================================================================================
-- NACHHOLEN: alle Datenbank-Aenderungen seit Version 1.27 in einem Stueck (Stand 1.39).
-- Fuer alle, bei denen die Aenderungen nicht automatisch ankommen (GitHub-Secrets aus
-- docs/ONLINE-EINRICHTEN.md, Schritt 8 fehlen). Einmal komplett im Supabase SQL Editor ausfuehren.
-- Laesst sich gefahrlos wiederholen. Enthaelt:
--   20261021000100_einladen_alle.sql, 20261022000000_sieg_drei_leben.sql, 20261024000000_konto_loeschen.sql
--   (ersetzt 20261021000000_admin_loeschen.sql und 20261023000000_admin_loeschen_fix.sql)
--   und 20261025000000_profil_reparatur.sql (Spieler zuverlaessig in der Hall of Snakes, Freundes-Code, Rekorde)
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
