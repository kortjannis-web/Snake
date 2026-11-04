-- 1.55.3: Hall of Snakes
--  * Der Rekord zaehlt nur noch mit normalem Tempo oder im Speedrun (Abenteuer, tempo 'langsam', nicht mehr)
--  * Jedes Ergebnis traegt die Welt, in der es gespielt wurde; die Hall zeigt die Welt des Rekords (Symbol)
--  * Spielzeit gesamt im Profil (jeder schreibt nur sein eigenes Profil, bestehende Regeln)
-- Laesst sich wiederholt ausfuehren.
alter table public.score add column if not exists welt text;
alter table public.score drop constraint if exists score_welt_pruefen;
alter table public.score add constraint score_welt_pruefen
  check (welt is null or welt in ('wiese', 'wueste', 'winter', 'bergwerk', 'zauberwald', 'gruselwald', 'vulkan'));

alter table public.profile add column if not exists spielzeit_ms bigint not null default 0;
alter table public.profile drop constraint if exists profile_spielzeit_pruefen;
alter table public.profile add constraint profile_spielzeit_pruefen check (spielzeit_ms >= 0 and spielzeit_ms < 100000 * 3600000::bigint);
grant select (spielzeit_ms) on public.profile to anon, authenticated;
grant update (spielzeit_ms) on public.profile to authenticated;

create or replace view public.hall_of_snakes with (security_invoker = on) as
  select p.id as user_id, p.name, p.skin,
         coalesce(b.level, 0) as rekord,
         coalesce((select sum(g.gegner) from public.sieg g where g.user_id = p.id), 0)::int as trophaeen,
         p.silber,
         b.welt as rekord_welt,
         p.spielzeit_ms
  from public.profile p
  left join lateral (
    select s.level, s.welt from public.score s
    where s.user_id = p.id and s.tempo <> 'langsam'
    order by s.level desc, s.created_at asc
    limit 1
  ) b on true;
grant select on public.hall_of_snakes to anon, authenticated;

-- Freundesliste: dieselbe Wertung (ohne Abenteuer)
create or replace view public.meine_freunde with (security_invoker = on) as
  select f.an as user_id, p.name, p.skin, coalesce(b.level, 0) as level
  from public.freund f
  join public.profile p on p.id = f.an
  left join lateral (select max(s.level) as level from public.score s where s.user_id = f.an and s.tempo <> 'langsam') b on true
  where f.von = auth.uid();
grant select on public.meine_freunde to authenticated;

notify pgrst, 'reload schema';
