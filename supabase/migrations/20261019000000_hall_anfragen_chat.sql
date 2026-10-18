-- Hall of Snakes, Freundschaftsanfragen, Sperren und Chat unter Freunden.
-- Nachrichten bleiben 30 Tage. Laesst sich wiederholt ausfuehren.

/* ---------------- Hall of Snakes: alle Spieler mit Skin, Rekord und Trophaeen ---------------- */
create or replace view public.hall_of_snakes with (security_invoker = on) as
  select p.id as user_id, p.name, p.skin,
         coalesce((select max(s.level) from public.score s where s.user_id = p.id), 0) as rekord,
         coalesce((select sum(g.gegner) from public.sieg g where g.user_id = p.id), 0)::int as trophaeen
  from public.profile p;
grant select on public.hall_of_snakes to anon, authenticated;

/* ---------------- Sperren (wer gesperrt ist, kann keine Anfrage schicken) ---------------- */
create table if not exists public.sperre (
  von uuid not null references public.profile (id) on delete cascade,
  an uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (von, an),
  check (von <> an)
);
alter table public.sperre enable row level security;
drop policy if exists sperre_lesen on public.sperre;
create policy sperre_lesen on public.sperre for select to authenticated using ((select auth.uid()) = von);
grant select on public.sperre to authenticated;

create or replace function public.gesperrt(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sperre where (von = a and an = b) or (von = b and an = a))
$$;
revoke all on function public.gesperrt(uuid, uuid) from public;
grant execute on function public.gesperrt(uuid, uuid) to authenticated;

create or replace view public.meine_sperren with (security_invoker = on) as
  select s.an as user_id, p.name
  from public.sperre s join public.profile p on p.id = s.an
  where s.von = auth.uid();
grant select on public.meine_sperren to authenticated;

/* ---------------- Freundschaftsanfragen ---------------- */
create table if not exists public.freund_anfrage (
  von uuid not null references public.profile (id) on delete cascade,
  an uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (von, an),
  check (von <> an)
);
alter table public.freund_anfrage enable row level security;
drop policy if exists anfrage_lesen on public.freund_anfrage;
create policy anfrage_lesen on public.freund_anfrage for select to authenticated using ((select auth.uid()) in (von, an));
grant select on public.freund_anfrage to authenticated;

-- Gibt 'gesendet' oder 'freunde' zurueck (hatte der andere schon gefragt, seid ihr sofort Freunde)
create or replace function public.anfrage_senden(ziel uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null or not exists (select 1 from public.profile where id = ich) then
    raise exception 'Erst einen Namen eintragen' using errcode = 'P0001';
  end if;
  if ziel = ich then raise exception 'Das bist du selbst' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profile where id = ziel) then raise exception 'Spieler unbekannt' using errcode = 'P0001'; end if;
  if exists (select 1 from public.freund where von = ich and an = ziel) then return 'freunde'; end if;
  if public.gesperrt(ich, ziel) then raise exception 'Anfrage nicht moeglich' using errcode = 'P0001'; end if;
  if exists (select 1 from public.freund_anfrage where von = ziel and an = ich) then
    insert into public.freund (von, an) values (ich, ziel), (ziel, ich) on conflict do nothing;
    delete from public.freund_anfrage where (von = ziel and an = ich) or (von = ich and an = ziel);
    return 'freunde';
  end if;
  if (select count(*) from public.freund_anfrage where von = ich and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Zu viele Anfragen heute' using errcode = 'P0001';
  end if;
  insert into public.freund_anfrage (von, an) values (ich, ziel) on conflict do nothing;
  return 'gesendet';
end $$;
revoke all on function public.anfrage_senden(uuid) from public;
grant execute on function public.anfrage_senden(uuid) to authenticated;

create or replace function public.anfrage_annehmen(von_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
begin
  if not exists (select 1 from public.freund_anfrage where von = von_id and an = ich) then
    raise exception 'Anfrage gibt es nicht mehr' using errcode = 'P0001';
  end if;
  insert into public.freund (von, an) values (ich, von_id), (von_id, ich) on conflict do nothing;
  delete from public.freund_anfrage where (von = von_id and an = ich) or (von = ich and an = von_id);
end $$;
revoke all on function public.anfrage_annehmen(uuid) from public;
grant execute on function public.anfrage_annehmen(uuid) to authenticated;

-- Ablehnen (eingehend) oder zurueckziehen (ausgehend)
create or replace function public.anfrage_loeschen(andere uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.freund_anfrage where (von = auth.uid() and an = andere) or (von = andere and an = auth.uid())
$$;
revoke all on function public.anfrage_loeschen(uuid) from public;
grant execute on function public.anfrage_loeschen(uuid) to authenticated;

create or replace view public.meine_anfragen with (security_invoker = on) as
  select case when a.von = auth.uid() then 'aus' else 'ein' end as richtung,
         case when a.von = auth.uid() then a.an else a.von end as user_id,
         p.name, p.skin, a.created_at
  from public.freund_anfrage a
  join public.profile p on p.id = case when a.von = auth.uid() then a.an else a.von end
  where auth.uid() in (a.von, a.an);
grant select on public.meine_anfragen to authenticated;

-- Sperren: Freundschaft und Anfragen weg, keine neuen Anfragen und Nachrichten mehr
create or replace function public.sperren(ziel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null or ziel = ich then return; end if;
  insert into public.sperre (von, an) values (ich, ziel) on conflict do nothing;
  delete from public.freund where (von = ich and an = ziel) or (von = ziel and an = ich);
  delete from public.freund_anfrage where (von = ich and an = ziel) or (von = ziel and an = ich);
end $$;
revoke all on function public.sperren(uuid) from public;
grant execute on function public.sperren(uuid) to authenticated;

create or replace function public.entsperren(ziel uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.sperre where von = auth.uid() and an = ziel
$$;
revoke all on function public.entsperren(uuid) from public;
grant execute on function public.entsperren(uuid) to authenticated;

/* ---------------- Chat (nur unter Freunden, 30 Tage) ---------------- */
create table if not exists public.nachricht (
  id bigserial primary key,
  von uuid not null references public.profile (id) on delete cascade,
  an uuid not null references public.profile (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  gelesen boolean not null default false,
  created_at timestamptz not null default now(),
  check (von <> an)
);
create index if not exists nachricht_paar on public.nachricht (least(von, an), greatest(von, an), created_at desc);
create index if not exists nachricht_ungelesen on public.nachricht (an) where not gelesen;
create index if not exists nachricht_alter on public.nachricht (created_at);

alter table public.nachricht enable row level security;
drop policy if exists nachricht_lesen on public.nachricht;
create policy nachricht_lesen on public.nachricht for select to authenticated using ((select auth.uid()) in (von, an));
drop policy if exists nachricht_schreiben on public.nachricht;
create policy nachricht_schreiben on public.nachricht for insert to authenticated with check (
  (select auth.uid()) = von
  and exists (select 1 from public.freund f where f.von = nachricht.von and f.an = nachricht.an)
);
grant select on public.nachricht to authenticated;
grant insert (von, an, text) on public.nachricht to authenticated;
grant usage, select on sequence public.nachricht_id_seq to authenticated;

-- Hoechstens 30 Nachrichten pro Minute; nebenbei alles loeschen, was aelter als 30 Tage ist
create or replace function public.nachricht_pruefen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.nachricht where von = new.von and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Zu viele Nachrichten, kurz warten' using errcode = 'P0001';
  end if;
  new.text := btrim(new.text);
  delete from public.nachricht where created_at < now() - interval '30 days';
  return new;
end $$;
drop trigger if exists nachricht_pruefen on public.nachricht;
create trigger nachricht_pruefen before insert on public.nachricht for each row execute function public.nachricht_pruefen();

create or replace function public.chat_gelesen(partner uuid) returns void
language sql security definer set search_path = public as $$
  update public.nachricht set gelesen = true where an = auth.uid() and von = partner and not gelesen
$$;
revoke all on function public.chat_gelesen(uuid) from public;
grant execute on function public.chat_gelesen(uuid) to authenticated;

-- Je Gespraechspartner: letzte Nachricht und wie viele ungelesen
create or replace view public.meine_chats with (security_invoker = on) as
  select case when n.von = auth.uid() then n.an else n.von end as user_id,
         max(n.created_at) as zuletzt,
         (count(*) filter (where n.an = auth.uid() and not n.gelesen))::int as ungelesen
  from public.nachricht n
  where auth.uid() in (n.von, n.an) and n.created_at > now() - interval '30 days'
  group by 1;
grant select on public.meine_chats to authenticated;

/* ---------------- Live-Updates (Realtime prueft dabei die Leserechte) ---------------- */
do $$ begin
  alter publication supabase_realtime add table public.nachricht;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.freund_anfrage;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.freund;
exception when duplicate_object then null;
end $$;
