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
