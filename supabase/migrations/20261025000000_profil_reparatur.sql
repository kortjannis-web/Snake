-- Hall of Snakes zuverlaessig: Spieler, die online "unsichtbar" waren (kein Freundes-Code, fehlen in der Hall,
-- Skin und Rekord kommen nicht an). Laesst sich wiederholt ausfuehren.
--
-- 1. profil_speichern: Die App schreibt ihr Profil (Name, Skin, Silber) ueber diese eine Funktion. Sie legt die Zeile
--    an oder aktualisiert sie in einem Schritt (ohne die Spaltenrechte und Regeln einer direkten Tabellen-Aenderung),
--    gibt den Freundes-Code zurueck und meldet einen vergebenen Namen eindeutig (23505).
-- 2. Ergebnisse: hoechstens eins je 3 Sekunden statt je 10. Mit 10 s ging beim Nachsenden mehrerer gespeicherter
--    Runden alles ausser der ersten verloren (die App wartet jetzt zusaetzlich und wirft nichts mehr weg).
-- 3. konto_status: Was die Datenbank ueber das eigene Konto weiss (fuer die Anzeige "Online eingetragen" in der App).

create or replace function public.profil_speichern(p_name text, p_skin text default null, p_silber bigint default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  n text := btrim(coalesce(p_name, ''));
  c text;
begin
  if ich is null then
    raise exception 'Nicht angemeldet.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = ich) then
    raise exception 'Konto gibt es nicht mehr.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profile where lower(name) = lower(n) and id <> ich) then
    raise exception 'Diesen Namen gibt es schon.' using errcode = '23505';
  end if;
  insert into public.profile as p (id, name, skin, silber, updated_at)
  values (ich, n, coalesce(nullif(left(p_skin, 32), ''), 'klassik'), greatest(coalesce(p_silber, 0), 0), now())
  on conflict (id) do update set
    name = excluded.name,
    skin = coalesce(nullif(left(p_skin, 32), ''), p.skin),
    silber = greatest(p.silber, coalesce(p_silber, 0)),
    updated_at = now()
  returning p.code into c;
  -- Aeltere Zeilen ohne Code (vor dem Freundes-Code angelegt): jetzt einen geben
  if c is null then
    update public.profile set code = upper(substr(md5(gen_random_uuid()::text), 1, 6)) where id = ich returning code into c;
  end if;
  return c;
end $$;
revoke all on function public.profil_speichern(text, text, bigint) from public;
revoke all on function public.profil_speichern(text, text, bigint) from anon;
grant execute on function public.profil_speichern(text, text, bigint) to authenticated;

-- Schummelschutz fuer Ergebnisse wie bisher, nur 3 statt 10 Sekunden Abstand
create or replace function public.score_pruefen() returns trigger
language plpgsql as $$
begin
  if new.level - 1 > new.dauer_ms / 200.0 then
    raise exception 'unplausibles Ergebnis';
  end if;
  if exists (
    select 1 from public.score
    where user_id = new.user_id and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'zu schnell hintereinander';
  end if;
  return new;
end $$;

create or replace function public.konto_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'angemeldet', auth.uid() is not null,
    'profil', exists (select 1 from public.profile where id = auth.uid()),
    'name', (select name from public.profile where id = auth.uid()),
    'code', (select code from public.profile where id = auth.uid()),
    'rekord', coalesce((select max(level) from public.score where user_id = auth.uid()), 0)
  )
$$;
revoke all on function public.konto_status() from public;
grant execute on function public.konto_status() to authenticated;

notify pgrst, 'reload schema';
