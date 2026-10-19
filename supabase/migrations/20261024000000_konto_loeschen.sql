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
