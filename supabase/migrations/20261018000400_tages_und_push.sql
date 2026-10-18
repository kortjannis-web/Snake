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

/* ---------------- Push-Einladungen ---------------- */
-- Push-Abo im Profil (privat: nicht in den lesbaren Spalten)
alter table public.profile add column if not exists push jsonb;

-- Eigenes Abo setzen oder loeschen (null)
create or replace function public.push_setzen(abo jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profile set push = abo where id = auth.uid()
$$;
revoke all on function public.push_setzen(jsonb) from public;
grant execute on function public.push_setzen(jsonb) to authenticated;

-- Abo eines Freundes (nur wenn man befreundet ist): der Snake-Server schickt damit die Einladung
create or replace function public.push_fuer(ziel uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.push from public.profile p
  where p.id = ziel and exists (select 1 from public.freund f where f.von = auth.uid() and f.an = ziel)
$$;
revoke all on function public.push_fuer(uuid) from public;
grant execute on function public.push_fuer(uuid) to authenticated;
