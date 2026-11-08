-- Spielstand: der Server ist die einzige Wahrheit (seit 1.56.0).
--
-- Bisher hat die App das ganze `spielstand.daten` selbst zusammengefuehrt und geschrieben. Jetzt schickt sie nur noch,
-- was sie hat (`p_lokal`) und welchen Stand des Servers sie zuletzt kannte (`p_basis`). Die Datenbank fuehrt zusammen:
-- - Zaehler (Aepfel, Spiele, Spielzeit ...): Server + was das Geraet seit `p_basis` dazubekam oder ausgab, nie unter 0
-- - Bestwerte (Rekord, laengste Schlange, Bestwert je Welt ...): nur nach oben
-- - Listen (Skins, Welten, Erfolge ...): nur vereinigen, nie etwas weg
-- - Auswahl und Text (Skin, Aussehen, Welt ...): was das Geraet geaendert hat, sonst der Server
-- Ohne `p_basis` (erster Abgleich eines Geraets) gilt bei Zahlen das Groessere: nichts zaehlt doppelt.
--
-- Jede Anfrage hat eine Kennung (`p_vorgang`). Kommt dieselbe noch einmal (Antwort ging im Funkloch verloren und die App
-- schickt sie erneut), wird sie nicht noch einmal eingerechnet: ein Kauf oder ein Spiel zaehlt nie doppelt.
--
-- Alte Apps (bis 1.55.3) schreiben weiter direkt in die Tabelle. Damit sie nichts kaputt machen, prueft ein Trigger jedes
-- direkte Schreiben: Listen und Bestwerte koennen dabei nicht schrumpfen, Felder, die die alte App nicht kennt, bleiben.
--
-- Live-Abgleich: `spielstand` und `kampagne` stehen in der Realtime-Publication. Jedes Geraet hoert auf seine eigene Zeile
-- (die Leserechte gelten auch dort) und holt sich Aenderungen sofort. Laesst sich wiederholt ausfuehren.

-- Schluessel mit Sonderregeln (wie in src/cloud.ts: BESTWERTE, AUSWAHL)
create or replace function public.ss_bestwert(k text) returns boolean language sql immutable as $$
  select k in ('best', 'longest', 'maxGebiete', 'verdient', 'weltBest', 'weltchat')
$$;

-- Drei-Wege-Zusammenfuehrung eines Werts (b = Basis, l = Geraet, c = Server). SQL-NULL heisst "fehlt".
create or replace function public.ss_zusammen(b jsonb, l jsonb, c jsonb, best boolean default false, wahl boolean default false)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  tl text;
  tc text;
  tb text;
  k text;
  aus jsonb := '{}'::jsonb;
begin
  if c is null then return l; end if;
  if l is null then return c; end if;
  if wahl then
    return case when b is not null and l is distinct from b then l else c end;
  end if;
  tl := jsonb_typeof(l);
  tc := jsonb_typeof(c);
  tb := jsonb_typeof(b);
  if tl = 'number' and tc = 'number' then
    if best or tb is distinct from 'number' then
      return to_jsonb(greatest(l::numeric, c::numeric));
    end if;
    return to_jsonb(greatest(0::numeric, c::numeric + (l::numeric - b::numeric)));
  end if;
  if tl = 'array' and tc = 'array' then
    -- Vereinigung: erst die vom Server, dann die neuen vom Geraet (Reihenfolge bleibt)
    return coalesce((
      select jsonb_agg(s.e order by s.o) from (
        select a.e, min(a.o) as o from (
          select e, o from jsonb_array_elements(c) with ordinality as x(e, o)
          union all
          select e, o + 1000000 from jsonb_array_elements(l) with ordinality as y(e, o)
        ) as a group by a.e
      ) as s
    ), '[]'::jsonb);
  end if;
  if tl = 'object' and tc = 'object' then
    for k in select jsonb_object_keys(c) union select jsonb_object_keys(l) loop
      aus := aus || jsonb_build_object(k, public.ss_zusammen(
        case when tb = 'object' then b -> k end, l -> k, c -> k, best or public.ss_bestwert(k), k = 'look'));
    end loop;
    return aus;
  end if;
  return case when b is not null and l is distinct from b then l else c end;
end $$;

-- Ganzer Spielstand: zusammenfuehren, Tagesbestwert nur fuer denselben Tag, angefangene Aepfel (wallet.rest) gehoeren
-- zum Geraet und werden vom Server nicht uebernommen
create or replace function public.ss_spielstand(b jsonb, l jsonb, c jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  aus jsonb;
  lh jsonb := l #> '{stats,heute}';
  ch jsonb := c #> '{stats,heute}';
begin
  l := l #- '{wallet,rest}';
  b := b #- '{wallet,rest}';
  aus := public.ss_zusammen(b, l, c);
  if jsonb_typeof(lh) = 'object' and jsonb_typeof(ch) = 'object' and jsonb_typeof(aus -> 'stats') = 'object' then
    aus := jsonb_set(aus, '{stats,heute}',
      case
        when lh ->> 'datum' = ch ->> 'datum' then jsonb_build_object('datum', lh -> 'datum', 'best',
          greatest(coalesce((lh ->> 'best')::numeric, 0), coalesce((ch ->> 'best')::numeric, 0)))
        when coalesce(lh ->> 'datum', '') > coalesce(ch ->> 'datum', '') then lh
        else ch
      end);
  end if;
  return aus;
end $$;

-- Schutz bei direktem Schreiben (alte Apps): Listen vereinigen, Bestwerte nur nach oben, unbekannte Felder behalten.
-- Zaehler und Auswahl kommen wie geschrieben (die alte App hat sie schon selbst zusammengefuehrt).
create or replace function public.ss_schutz(alt jsonb, neu jsonb, best boolean default false) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  k text;
  aus jsonb := '{}'::jsonb;
begin
  if neu is null then return alt; end if;
  if alt is null then return neu; end if;
  if jsonb_typeof(alt) = 'number' and jsonb_typeof(neu) = 'number' then
    return case when best then to_jsonb(greatest(alt::numeric, neu::numeric)) else neu end;
  end if;
  if jsonb_typeof(alt) = 'array' and jsonb_typeof(neu) = 'array' then
    return public.ss_zusammen(null, alt, neu);
  end if;
  if jsonb_typeof(alt) = 'object' and jsonb_typeof(neu) = 'object' then
    for k in select jsonb_object_keys(alt) union select jsonb_object_keys(neu) loop
      aus := aus || jsonb_build_object(k,
        case when k in ('heute', 'look') then coalesce(neu -> k, alt -> k)
             else public.ss_schutz(alt -> k, neu -> k, best or public.ss_bestwert(k)) end);
    end loop;
    return aus;
  end if;
  return neu;
end $$;

create or replace function public.spielstand_schutz() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('snake.abgleich', true), '') = '1' then
    return new;
  end if;
  new.daten := public.ss_schutz(old.daten, new.daten);
  return new;
end $$;
drop trigger if exists spielstand_schutz on public.spielstand;
create trigger spielstand_schutz before update on public.spielstand
  for each row execute function public.spielstand_schutz();

-- Schon eingerechnete Anfragen (je Account, 30 Tage)
create table if not exists public.spielstand_vorgang (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  angelegt timestamptz not null default now()
);
create index if not exists spielstand_vorgang_user on public.spielstand_vorgang (user_id, angelegt);
alter table public.spielstand_vorgang enable row level security;
revoke all on public.spielstand_vorgang from anon, authenticated;

-- Abgleich: zusammenfuehren, speichern (nur wenn sich etwas aendert), den ganzen Stand zurueckgeben.
-- p_lokal null: nur lesen (z. B. Wechsel zu einem Account, der schon einen Spielstand hat)
create or replace function public.spielstand_abgleichen(p_vorgang uuid, p_basis jsonb, p_lokal jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  r public.spielstand;
  neu jsonb;
begin
  if ich is null then
    raise exception 'Nicht angemeldet.' using errcode = 'P0001';
  end if;
  insert into public.spielstand (id) values (ich) on conflict (id) do nothing;
  select * into r from public.spielstand where id = ich for update;

  if p_vorgang is not null and exists (select 1 from public.spielstand_vorgang v where v.id = p_vorgang) then
    return jsonb_build_object('daten', r.daten, 'stand', r.stand, 'doppelt', true);
  end if;

  if p_lokal is not null and jsonb_typeof(p_lokal) = 'object' then
    neu := public.ss_spielstand(case when jsonb_typeof(p_basis) = 'object' then p_basis end, p_lokal, r.daten);
    if neu is distinct from r.daten then
      perform set_config('snake.abgleich', '1', true);
      update public.spielstand set daten = neu, stand = r.stand + 1, updated_at = now() where id = ich returning * into r;
      perform set_config('snake.abgleich', '', true);
    end if;
  end if;

  if p_vorgang is not null then
    insert into public.spielstand_vorgang (id, user_id) values (p_vorgang, ich) on conflict (id) do nothing;
    delete from public.spielstand_vorgang v where v.user_id = ich and v.angelegt < now() - interval '30 days';
  end if;
  return jsonb_build_object('daten', r.daten, 'stand', r.stand);
end $$;
revoke all on function public.spielstand_abgleichen(uuid, jsonb, jsonb) from public;
revoke all on function public.spielstand_abgleichen(uuid, jsonb, jsonb) from anon;
grant execute on function public.spielstand_abgleichen(uuid, jsonb, jsonb) to authenticated;

-- Live: Geraete hoeren auf ihre eigene Zeile
do $$ begin
  alter publication supabase_realtime add table public.spielstand;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.kampagne;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
