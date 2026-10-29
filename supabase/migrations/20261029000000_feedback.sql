-- Feedback der Spieler (Knopf mit dem orangen Ausrufezeichen oben im Startmenue): mehrere einzelne Punkte je Nachricht.
-- Schreiben nur ueber feedback_senden (auch ohne Anmeldung), lesen und loeschen nur der Admin (Admin-Passwort).
-- Laesst sich wiederholt ausfuehren.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  name text,
  punkte text[] not null,
  version text,
  erstellt timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
create index if not exists feedback_erstellt on public.feedback (erstellt desc);

create or replace function public.feedback_senden(p_punkte text[], p_name text default null, p_version text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  liste text[];
begin
  select coalesce(array_agg(left(btrim(p), 1000)), '{}') into liste
  from unnest(coalesce(p_punkte, '{}')) as t(p) where btrim(p) <> '';
  if cardinality(liste) = 0 then
    raise exception 'Schreib erst etwas.' using errcode = 'P0001';
  end if;
  if cardinality(liste) > 20 then
    raise exception 'Höchstens 20 Punkte auf einmal.' using errcode = 'P0001';
  end if;
  -- Bremse gegen Spam: je Account 10 Nachrichten pro Stunde, insgesamt 300 pro Stunde
  if auth.uid() is not null and (select count(*) from public.feedback where user_id = auth.uid() and erstellt > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast gerade schon viel geschickt. Versuch es später noch mal.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.feedback where erstellt > now() - interval '1 hour') >= 300 then
    raise exception 'Gerade kommt sehr viel an. Versuch es später noch mal.' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, name, punkte, version)
  values (auth.uid(), left(nullif(btrim(p_name), ''), 32), liste, left(p_version, 20));
end $$;
revoke all on function public.feedback_senden(text[], text, text) from public;
grant execute on function public.feedback_senden(text[], text, text) to anon, authenticated;

create or replace function public.admin_feedback(code text)
returns table (id bigint, name text, punkte text[], version text, erstellt timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  return query select f.id, f.name, f.punkte, f.version, f.erstellt from public.feedback f order by f.erstellt desc limit 500;
end $$;
revoke all on function public.admin_feedback(text) from public;
grant execute on function public.admin_feedback(text) to anon, authenticated;

create or replace function public.admin_feedback_loeschen(code text, ziel bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if encode(extensions.digest('snake-master:' || upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') <> '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d' then
    raise exception 'Falsches Passwort.' using errcode = 'P0001';
  end if;
  delete from public.feedback where feedback.id = ziel;
end $$;
revoke all on function public.admin_feedback_loeschen(text, bigint) from public;
grant execute on function public.admin_feedback_loeschen(text, bigint) to anon, authenticated;

notify pgrst, 'reload schema';
