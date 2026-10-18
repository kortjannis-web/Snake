-- Skin im Profil: in "Alle Spieler" sieht man, wie die Schlange der anderen aussieht.
-- Der Rekord kommt weiter aus den gemeldeten Runden (mit Schummelschutz), nicht aus dem Profil.
alter table public.profile add column if not exists skin text not null default 'klassik' check (char_length(skin) between 1 and 32);

-- Neue Spalten nur hinten anhaengen (sonst laesst Postgres "create or replace view" nicht zu)
create or replace view public.spieler_alle with (security_invoker = on) as
  select p.id as user_id, p.name,
         coalesce(b.level, 0) as level,
         coalesce(b.tempo, 'normal') as tempo,
         p.updated_at as created_at,
         p.skin
  from public.profile p
  left join lateral (
    select s.level, s.tempo from public.score s
    where s.user_id = p.id
    order by s.level desc, s.dauer_ms asc
    limit 1
  ) b on true;

create or replace view public.bestenliste_heute with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at, p.skin
  from public.score s join public.profile p on p.id = s.user_id
  where s.tag = (now() at time zone 'Europe/Berlin')::date
  order by s.user_id, s.level desc, s.dauer_ms asc;

create or replace view public.bestenliste_immer with (security_invoker = on) as
  select distinct on (s.user_id) s.user_id, p.name, s.level, s.tempo, s.created_at, p.skin
  from public.score s join public.profile p on p.id = s.user_id
  order by s.user_id, s.level desc, s.dauer_ms asc;

grant select on public.spieler_alle, public.bestenliste_heute, public.bestenliste_immer to anon, authenticated;
