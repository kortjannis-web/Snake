-- Admin: Spieler loeschen. Die Funktion prueft das Admin-Passwort selbst (nur der SHA-256-Hash steht hier,
-- derselbe wie MASTER_HASH in src/storage.ts) und loescht den Nutzer samt Profil, Ergebnissen, Freunden und Nachrichten.
-- Ersetzt eine aeltere, von Hand angelegte Fassung (mit altem Passwort).
do $$
declare r record;
begin
  for r in select oid::regprocedure as f from pg_proc where proname = 'admin_spieler_loeschen' and pronamespace = 'public'::regnamespace loop
    execute 'drop function ' || r.f;
  end loop;
end $$;

create function public.admin_spieler_loeschen(code text, ziel uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from auth.users where id = ziel;
end $$;
revoke all on function public.admin_spieler_loeschen(text, uuid) from public;
grant execute on function public.admin_spieler_loeschen(text, uuid) to authenticated;
