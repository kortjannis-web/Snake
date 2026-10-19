-- Tageslevel: die Bestenliste des Tages zeigt auch die Zeit. Sortiert wird im Spiel nach geholten Aepfeln
-- (alle = geschafft), dann nach der kuerzeren Zeit. Laesst sich wiederholt ausfuehren.
create or replace view public.bestenliste_tages with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at, p.skin, s.dauer_ms
  from public.score s join public.profile p on p.id = s.user_id
  where s.tages and s.tag = (now() at time zone 'Europe/Berlin')::date
  order by s.user_id, s.level desc, s.dauer_ms asc;
grant select on public.bestenliste_tages to anon, authenticated;
