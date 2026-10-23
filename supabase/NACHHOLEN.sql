-- ============================================================================================
-- NACHHOLEN: alle Datenbank-Aenderungen seit Version 1.27 in einem Stueck.
-- Fuer alle, bei denen die Aenderungen nicht automatisch ankommen (GitHub-Secrets aus
-- docs/ONLINE-EINRICHTEN.md, Schritt 8 fehlen). Einmal komplett im Supabase SQL Editor ausfuehren.
-- Laesst sich gefahrlos wiederholen. Enthaelt:
--   20261021000100_einladen_alle.sql, 20261022000000_sieg_drei_leben.sql, 20261024000000_konto_loeschen.sql
--   (die letzte ersetzt 20261021000000_admin_loeschen.sql und 20261023000000_admin_loeschen_fix.sql)
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

notify pgrst, 'reload schema';

