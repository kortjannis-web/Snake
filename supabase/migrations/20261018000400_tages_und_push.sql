-- Tages-Herausforderung (alle spielen dieselbe Welt) und Push-Einladungen. Laesst sich wiederholt ausfuehren.

/* ---------------- Tages-Herausforderung ---------------- */
alter table public.score add column if not exists tages boolean not null default false;
create index if not exists score_tages on public.score (tag, level desc) where tages;

create or replace view public.bestenliste_tages with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at, p.skin
  from public.score s join public.profile p on p.id = s.user_id
  where s.tages and s.tag = (now() at time zone 'Europe/Berlin')::date
  order by s.user_id, s.level desc, s.dauer_ms asc;
grant select on public.bestenliste_tages to anon, authenticated;
