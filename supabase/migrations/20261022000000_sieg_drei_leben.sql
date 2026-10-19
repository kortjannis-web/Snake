-- Mehrspieler mit 3 Leben: der Sieger bekommt doppelt so viele Gold-Trophaeen (je besiegtem Gegner 2).
-- Die Spalte "gegner" zaehlt die Trophaeen eines Siegs, also jetzt 1 bis 6. Laesst sich wiederholt ausfuehren.
alter table public.sieg drop constraint if exists sieg_gegner_check;
alter table public.sieg add constraint sieg_gegner_check check (gegner between 1 and 6);
