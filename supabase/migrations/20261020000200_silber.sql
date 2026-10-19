-- Silber-Trophaeen (alle je verdienten Aepfel) im Profil, damit die Hall of Snakes danach sortieren kann.
-- Jeder schreibt nur sein eigenes Profil (bestehende Regeln). Laesst sich wiederholt ausfuehren.
alter table public.profile add column if not exists silber bigint not null default 0;
grant select (silber) on public.profile to anon, authenticated;

create or replace view public.hall_of_snakes with (security_invoker = on) as
  select p.id as user_id, p.name, p.skin,
         coalesce((select max(s.level) from public.score s where s.user_id = p.id), 0) as rekord,
         coalesce((select sum(g.gegner) from public.sieg g where g.user_id = p.id), 0)::int as trophaeen,
         p.silber
  from public.profile p;
grant select on public.hall_of_snakes to anon, authenticated;
