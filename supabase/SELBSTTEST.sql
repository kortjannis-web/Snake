-- ============================================================================================
-- SELBSTTEST: Ist die Datenbank vollstaendig? Liest nur, aendert nichts. Im Supabase SQL Editor ausfuehren.
-- Jede Zeile sollte "ok" zeigen. Steht irgendwo "FEHLT", sagt die Spalte "loesung", welche Datei hilft
-- (Anleitung: docs/SUPABASE-KOMPLETT.md, Teil 3). Unten stehen ausserdem ein paar Zahlen.
-- ============================================================================================
with soll(was, name, datei) as (
  values
    ('Tabelle', 'profile', '20261018000000_bestenliste.sql'),
    ('Tabelle', 'score', '20261018000000_bestenliste.sql'),
    ('Tabelle', 'freund', '20261018000300_freunde_siege.sql'),
    ('Tabelle', 'sieg', '20261018000300_freunde_siege.sql'),
    ('Tabelle', 'koop_ergebnis', '20261018000300_freunde_siege.sql'),
    ('Tabelle', 'sperre', '20261019000000_hall_anfragen_chat.sql'),
    ('Tabelle', 'freund_anfrage', '20261019000000_hall_anfragen_chat.sql'),
    ('Tabelle', 'nachricht', '20261019000000_hall_anfragen_chat.sql'),
    ('Spalte', 'profile.skin', '20261018000200_skin_und_online.sql'),
    ('Spalte', 'profile.code', '20261018000300_freunde_siege.sql'),
    ('Spalte', 'profile.push', '20261018000400_tages_und_push.sql'),
    ('Spalte', 'profile.silber', '20261020000200_silber.sql'),
    ('Spalte', 'score.tages', '20261018000400_tages_und_push.sql'),
    ('Ansicht', 'spieler_alle', '20261018000200_skin_und_online.sql'),
    ('Ansicht', 'meine_freunde', '20261018000300_freunde_siege.sql'),
    ('Ansicht', 'sieger_liste', '20261018000300_freunde_siege.sql'),
    ('Ansicht', 'bestenliste_tages', '20261020000000_tageslevel.sql'),
    ('Ansicht', 'hall_of_snakes', '20261020000200_silber.sql'),
    ('Ansicht', 'meine_anfragen', '20261019000000_hall_anfragen_chat.sql'),
    ('Ansicht', 'meine_chats', '20261019000000_hall_anfragen_chat.sql'),
    ('Ansicht', 'meine_sperren', '20261019000000_hall_anfragen_chat.sql'),
    ('Funktion', 'mein_code', '20261018000300_freunde_siege.sql'),
    ('Funktion', 'freund_hinzufuegen', '20261018000300_freunde_siege.sql'),
    ('Funktion', 'push_setzen', '20261018000400_tages_und_push.sql'),
    ('Funktion', 'gesperrt', '20261019000000_hall_anfragen_chat.sql'),
    ('Funktion', 'anfrage_senden', '20261019000000_hall_anfragen_chat.sql'),
    ('Funktion', 'chat_gelesen', '20261019000000_hall_anfragen_chat.sql'),
    ('Funktion', 'push_fuer', 'NACHHOLEN.sql'),
    ('Funktion', 'admin_spieler_loeschen', 'NACHHOLEN.sql'),
    ('Funktion', 'konto_loeschen', 'NACHHOLEN.sql'),
    ('Funktion', 'profil_speichern', 'NACHHOLEN.sql'),
    ('Funktion', 'konto_status', 'NACHHOLEN.sql'),
    ('Live', 'score', '20261018000000_bestenliste.sql'),
    ('Live', 'sieg', '20261018000300_freunde_siege.sql'),
    ('Live', 'koop_ergebnis', '20261018000300_freunde_siege.sql'),
    ('Live', 'nachricht', '20261019000000_hall_anfragen_chat.sql'),
    ('Live', 'freund_anfrage', '20261019000000_hall_anfragen_chat.sql'),
    ('Live', 'freund', '20261019000000_hall_anfragen_chat.sql')
)
select s.was, s.name,
  case when (
    case s.was
      when 'Tabelle' then to_regclass('public.' || s.name) is not null
      when 'Ansicht' then to_regclass('public.' || s.name) is not null
      when 'Spalte' then exists (select 1 from information_schema.columns c
                                 where c.table_schema = 'public' and c.table_name = split_part(s.name, '.', 1) and c.column_name = split_part(s.name, '.', 2))
      when 'Funktion' then exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = s.name)
      when 'Live' then exists (select 1 from pg_publication_tables t where t.pubname = 'supabase_realtime' and t.schemaname = 'public' and t.tablename = s.name)
    end) then 'ok' else 'FEHLT' end as stand,
  s.datei as loesung
from soll s
union all
select 'Zahl', 'Spieler in der Hall of Snakes', (select count(*)::text from public.profile), ''
union all
select 'Zahl', 'Konten ohne Hall-Eintrag (unsichtbar)', (select count(*)::text from auth.users u left join public.profile p on p.id = u.id where p.id is null), 'meist alte Gaeste, siehe SPIELER-LOESCHEN.md Teil 0'
union all
select 'Zahl', 'Profile ohne Freundes-Code', (select count(*)::text from public.profile where code is null), 'NACHHOLEN.sql (profil_speichern vergibt ihn)'
union all
select 'Zahl', 'Ergebnisse gesamt', (select count(*)::text from public.score), ''
union all
select 'Zahl', 'Datenbank-Groesse', pg_size_pretty(pg_database_size(current_database())), 'Gratis-Tarif: bis 500 MB';
