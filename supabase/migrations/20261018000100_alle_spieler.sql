-- Alle Spieler (auch ohne Ergebnis) mit ihrem besten Level. Level 0 = noch nicht gespielt.
create or replace view public.spieler_alle with (security_invoker = on) as
  select p.id as user_id, p.name,
         coalesce(b.level, 0) as level,
         coalesce(b.tempo, 'normal') as tempo,
         p.updated_at as created_at
  from public.profile p
  left join lateral (
    select s.level, s.tempo from public.score s
    where s.user_id = p.id
    order by s.level desc, s.dauer_ms asc
    limit 1
  ) b on true;

grant select on public.spieler_alle to anon, authenticated;

-- Live: neue Spieler und Namensaenderungen gehen ebenfalls per Realtime an alle offenen Apps
do $$ begin
  alter publication supabase_realtime add table public.profile;
exception when duplicate_object then null;
end $$;
