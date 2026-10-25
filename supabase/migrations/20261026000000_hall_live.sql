-- Hall of Snakes live: Neuer Spieler, neuer Skin, neuer Name, Silber oder geloeschter Spieler erscheinen sofort bei allen.
-- Das Profil selbst bleibt aus Realtime heraus (private Spalte code). Stattdessen zaehlt die kleine Tabelle hall_signal
-- bei jeder solchen Aenderung hoch, und nur diese Zahl geht live raus. Neue Rekorde kommen wie bisher ueber score.
-- Laesst sich wiederholt ausfuehren.

create table if not exists public.hall_signal (
  id smallint primary key default 1 check (id = 1),
  stand bigint not null default 0,
  at timestamptz not null default now()
);
insert into public.hall_signal (id) values (1) on conflict (id) do nothing;
alter table public.hall_signal enable row level security;
drop policy if exists hall_signal_lesen on public.hall_signal;
create policy hall_signal_lesen on public.hall_signal for select using (true);
revoke all on public.hall_signal from anon, authenticated;
grant select on public.hall_signal to anon, authenticated;

create or replace function public.hall_signal_geben() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name and new.skin is not distinct from old.skin
     and new.silber is not distinct from old.silber then
    return null;
  end if;
  update public.hall_signal set stand = stand + 1, at = now() where id = 1;
  return null;
end $$;

drop trigger if exists hall_signal_profil on public.profile;
create trigger hall_signal_profil after insert or update or delete on public.profile
  for each row execute function public.hall_signal_geben();

do $$ begin
  alter publication supabase_realtime add table public.hall_signal;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
