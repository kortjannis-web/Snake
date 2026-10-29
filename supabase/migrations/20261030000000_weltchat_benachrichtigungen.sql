-- Weltchat (alle angemeldeten Spieler, Nachrichten 7 Tage) und Benachrichtigungen mit Einstellungen:
-- private Nachrichten, Weltchat und Einladungen einzeln an- und ausschaltbar, einzelne Spieler stumm.
-- Der Snake-Server holt sich die Push-Abos ueber push_nachricht und push_welt (nur mit dem Token des Absenders,
-- nur fuer eine frische eigene Nachricht, jede Nachricht nur einmal). Laesst sich wiederholt ausfuehren.

/* ---------------- Einstellungen der Benachrichtigungen (privat, nur ueber die Funktionen) ---------------- */
-- {"nachrichten": true, "welt": true, "einladungen": true, "stumm": ["<uuid>", ...]}; fehlt ein Wert, gilt "an"
alter table public.profile add column if not exists push_einstellung jsonb not null default '{}'::jsonb;

create or replace function public.push_einstellung_setzen(e jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profile set push_einstellung = jsonb_build_object(
    'nachrichten', coalesce((e ->> 'nachrichten')::boolean, true),
    'welt', coalesce((e ->> 'welt')::boolean, true),
    'einladungen', coalesce((e ->> 'einladungen')::boolean, true),
    'stumm', coalesce((
      select jsonb_agg(x) from (
        select distinct x from jsonb_array_elements_text(case when jsonb_typeof(e -> 'stumm') = 'array' then e -> 'stumm' else '[]'::jsonb end) as t(x)
        where x ~* '^[0-9a-f-]{36}$' limit 500
      ) s), '[]'::jsonb)
  ) where id = auth.uid()
$$;
revoke all on function public.push_einstellung_setzen(jsonb) from public;
grant execute on function public.push_einstellung_setzen(jsonb) to authenticated;

create or replace function public.meine_push_einstellung() returns jsonb
language sql stable security definer set search_path = public as $$
  select push_einstellung from public.profile where id = auth.uid()
$$;
revoke all on function public.meine_push_einstellung() from public;
grant execute on function public.meine_push_einstellung() to authenticated;

-- Einladungen aufs Handy nur, wenn der Empfaenger sie nicht ausgeschaltet hat
create or replace function public.push_fuer(ziel uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.push from public.profile p
  where p.id = ziel
    and auth.uid() is not null
    and auth.uid() <> ziel
    and not public.gesperrt(auth.uid(), ziel)
    and coalesce((p.push_einstellung ->> 'einladungen')::boolean, true)
$$;
revoke all on function public.push_fuer(uuid) from public;
grant execute on function public.push_fuer(uuid) to authenticated;

/* ---------------- Push fuer private Nachrichten ---------------- */
alter table public.nachricht add column if not exists gepusht boolean not null default false;

-- Gibt {abo, name, text} zurueck oder null (Empfaenger hat es aus, den Absender stumm, kein Abo, schon gepusht).
-- Hoechstens ein Push je Absender und Empfaenger alle 20 s, damit das Handy nicht dauernd brummt
create or replace function public.push_nachricht(nid bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  n record;
  p record;
begin
  if ich is null then return null; end if;
  select * into n from public.nachricht where id = nid and von = ich and not gepusht and created_at > now() - interval '2 minutes';
  if not found then return null; end if;
  update public.nachricht set gepusht = true where id = nid;
  if exists (select 1 from public.nachricht where von = ich and an = n.an and gepusht and id <> nid and created_at > now() - interval '20 seconds') then
    return null;
  end if;
  select push, push_einstellung into p from public.profile where id = n.an;
  if p.push is null or not coalesce((p.push_einstellung ->> 'nachrichten')::boolean, true)
     or coalesce(p.push_einstellung -> 'stumm' ? ich::text, false) then
    return null;
  end if;
  return jsonb_build_object('abo', p.push, 'name', (select name from public.profile where id = ich), 'text', left(n.text, 140));
end $$;
revoke all on function public.push_nachricht(bigint) from public;
grant execute on function public.push_nachricht(bigint) to authenticated;

/* ---------------- Weltchat ---------------- */
create table if not exists public.weltchat (
  id bigserial primary key,
  von uuid not null references public.profile (id) on delete cascade,
  name text not null default '',
  skin text,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  gepusht boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weltchat_zeit on public.weltchat (created_at desc);

alter table public.weltchat enable row level security;
drop policy if exists weltchat_lesen on public.weltchat;
create policy weltchat_lesen on public.weltchat for select to authenticated using (true);
drop policy if exists weltchat_schreiben on public.weltchat;
create policy weltchat_schreiben on public.weltchat for insert to authenticated with check ((select auth.uid()) = von);
revoke all on public.weltchat from anon, authenticated;
grant select on public.weltchat to authenticated;
grant insert (von, text) on public.weltchat to authenticated;
grant usage, select on sequence public.weltchat_id_seq to authenticated;

-- Name und Skin vom Profil, hoechstens 8 Nachrichten pro Minute, nebenbei alles loeschen, was aelter als 7 Tage ist
create or replace function public.weltchat_pruefen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.weltchat where von = new.von and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'Zu viele Nachrichten, kurz warten' using errcode = 'P0001';
  end if;
  select name, skin into new.name, new.skin from public.profile where id = new.von;
  if new.name is null then raise exception 'Erst anmelden' using errcode = 'P0001'; end if;
  new.text := btrim(new.text);
  new.gepusht := false;
  new.created_at := now();
  delete from public.weltchat where created_at < now() - interval '7 days';
  return new;
end $$;
drop trigger if exists weltchat_pruefen on public.weltchat;
create trigger weltchat_pruefen before insert on public.weltchat for each row execute function public.weltchat_pruefen();

-- Admin (Master-Passwort): eine Nachricht aus dem Weltchat loeschen
create extension if not exists pgcrypto with schema extensions;
create or replace function public.admin_weltchat_loeschen(code text, ziel bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from public.weltchat where weltchat.id = ziel;
end $$;
revoke all on function public.admin_weltchat_loeschen(text, bigint) from public;
grant execute on function public.admin_weltchat_loeschen(text, bigint) to anon, authenticated;

/* ---------------- Push fuer den Weltchat ---------------- */
-- Wann jeder zuletzt einen Weltchat-Push bekam: hoechstens einer alle 10 Minuten
create table if not exists public.push_zuletzt (
  user_id uuid primary key references public.profile (id) on delete cascade,
  welt timestamptz not null default now()
);
alter table public.push_zuletzt enable row level security;
revoke all on public.push_zuletzt from anon, authenticated;

-- Je Aufruf bis zu 40 Empfaenger (der Snake-Server darf im Gratis-Tarif nur ~50 Anfragen je Aufruf stellen).
-- Die gelieferten werden sofort als benachrichtigt eingetragen, der naechste Aufruf bekommt also die naechsten 40.
-- ohne: wer gerade online ist (sieht es ohnehin in der App)
create or replace function public.push_welt(nid bigint, ohne uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
  m record;
  liste jsonb;
begin
  select * into m from public.weltchat where id = nid and von = ich and created_at > now() - interval '2 minutes';
  if not found then return jsonb_build_object('abos', '[]'::jsonb, 'fertig', true); end if;
  update public.weltchat set gepusht = true where id = nid;
  with ziele as (
    select p.id, p.push from public.profile p
    left join public.push_zuletzt z on z.user_id = p.id
    where p.push is not null and p.id <> ich and not (p.id = any (coalesce(ohne, '{}')))
      and coalesce((p.push_einstellung ->> 'welt')::boolean, true)
      and (z.welt is null or z.welt < now() - interval '10 minutes')
      and not public.gesperrt(ich, p.id)
    order by p.id
    limit 40
  ), eingetragen as (
    insert into public.push_zuletzt (user_id, welt) select id, now() from ziele
    on conflict (user_id) do update set welt = excluded.welt
    returning user_id
  )
  select coalesce(jsonb_agg(z.push), '[]'::jsonb) into liste from ziele z join eingetragen e on e.user_id = z.id;
  return jsonb_build_object('abos', liste, 'fertig', jsonb_array_length(liste) < 40, 'name', m.name, 'text', left(m.text, 140));
end $$;
revoke all on function public.push_welt(bigint, uuid[]) from public;
grant execute on function public.push_welt(bigint, uuid[]) to authenticated;

/* ---------------- Live ---------------- */
do $$ begin
  alter publication supabase_realtime add table public.weltchat;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
