-- Kampagne in der Cloud (seit 1.55.3): geschaffte Missionen und wie weit die Schlange auf der Karte ist, je Account.
-- Vorher lag die Kampagne nur auf dem Geraet: neues Handy, App statt Browser oder geloeschte Daten hiessen Kampagne 0.
--
-- Der Stand kann hier NUR WACHSEN: Die App schreibt nicht selbst in die Tabelle, sondern ruft kampagne_abgleichen auf.
-- Die Funktion legt die geschickten Missionen zu den gespeicherten (Vereinigung) und nimmt je Welt den hoeheren Wert.
-- Entfernt wird nie etwas, auch nicht von einer alten oder fehlerhaften App. Nur wenn der Account geloescht wird
-- (Admin oder selbst), geht sein Stand mit. Eigene Tabelle statt Feld in `spielstand`: aeltere Apps schreiben
-- `spielstand.daten` als Ganzes und wuerden ein Feld darin wieder entfernen. Laesst sich wiederholt ausfuehren.

create table if not exists public.kampagne (
  id uuid primary key references auth.users (id) on delete cascade,
  geschafft text[] not null default '{}',
  erreicht jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.kampagne enable row level security;

-- Lesen: nur der eigene Stand. Schreiben: nur ueber die Funktion unten (kann nichts loeschen)
drop policy if exists kampagne_lesen on public.kampagne;
create policy kampagne_lesen on public.kampagne for select to authenticated using (id = auth.uid());
revoke all on public.kampagne from anon, authenticated;
grant select on public.kampagne to authenticated;

-- Hoechstens 64 KB je Stand (30 Missionen brauchen unter 1 KB)
alter table public.kampagne drop constraint if exists kampagne_groesse;
alter table public.kampagne add constraint kampagne_groesse check (pg_column_size(geschafft) + pg_column_size(erreicht) < 65536);

-- Abgleich: Missionen dazulegen, je Welt das Hoehere behalten, den ganzen Stand zurueckgeben.
-- Ungueltige Eintraege (falsches Format, unsinnige Zahlen) werden still weggelassen, nie gespeichert.
create or replace function public.kampagne_abgleichen(p_geschafft text[], p_erreicht jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  g text[];
  e jsonb;
  r public.kampagne;
begin
  if ich is null then
    raise exception 'Nicht angemeldet.' using errcode = 'P0001';
  end if;
  g := array(select distinct x from unnest(coalesce(p_geschafft, '{}')) as x where x ~ '^[a-z0-9-]{1,40}$' order by x limit 500);
  e := coalesce((
    select jsonb_object_agg(k, v::int) from jsonb_each_text(case when jsonb_typeof(p_erreicht) = 'object' then p_erreicht else '{}'::jsonb end) as t(k, v)
    where k ~ '^[a-z0-9-]{1,40}$' and v ~ '^[0-9]{1,4}$'
  ), '{}'::jsonb);

  insert into public.kampagne as k (id, geschafft, erreicht) values (ich, g, e)
  on conflict (id) do update set
    geschafft = array(select distinct x from unnest(k.geschafft || excluded.geschafft) as x order by x),
    erreicht = (
      select coalesce(jsonb_object_agg(s.welt, s.nr), '{}'::jsonb) from (
        select a.key as welt, max(a.value::int) as nr
        from (select * from jsonb_each_text(k.erreicht) union all select * from jsonb_each_text(excluded.erreicht)) as a
        group by a.key
      ) as s
    ),
    updated_at = now()
  returning * into r;

  return jsonb_build_object('geschafft', to_jsonb(r.geschafft), 'erreicht', r.erreicht);
end $$;
revoke all on function public.kampagne_abgleichen(text[], jsonb) from public;
revoke all on function public.kampagne_abgleichen(text[], jsonb) from anon;
grant execute on function public.kampagne_abgleichen(text[], jsonb) to authenticated;

notify pgrst, 'reload schema';
