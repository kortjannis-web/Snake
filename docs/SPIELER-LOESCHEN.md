# Spieler löschen, fehlende Spieler und Anmelde-Grenzen (Anleitung fürs Handy)

Alles geht am Handy im Browser (Chrome oder Safari). Du brauchst dein Supabase-Login und das Admin-Passwort der App.
Alle Einstellungen und der Selbsttest der Datenbank: [SUPABASE-KOMPLETT.md](SUPABASE-KOMPLETT.md).

> **Sperren ist nicht Löschen.** Der Knopf mit dem durchgestrichenen Kreis (in Anfragen und im Chat) **sperrt** nur:
> Ihr könnt euch dann keine Anfragen und Nachrichten mehr schicken, der Spieler bleibt aber da.
> Wieder entsperren: in der App **Mehrspieler → Gesperrte Spieler**.

---

## Teil 0: Ein Spieler fehlt in der Hall of Snakes (kein Freundes-Code, Skin oder Rekord kommen nicht an)

Seit Version 1.39 merkt die App das selbst: In der **Hall of Snakes** steht dann unter dem Namen ein roter Hinweis
(„… fehlst noch in der Hall of Snakes“, darunter der genaue Fehler) mit dem Knopf **Neu verbinden**; bei den Freunden
steht unter dem leeren Code „Du bist noch nicht online eingetragen. Neu verbinden“. Die App versucht es beim Öffnen der
Hall auch einmal von selbst. Fehlt nur der Rekord (früher gingen Ergebnisse verloren), trägt die App den Rekord vom Gerät einmal nach.

1. Zuerst **Teil 1** machen (die Datei `NACHHOLEN.sql` enthält jetzt auch die neue Funktion `profil_speichern`).
2. Auf dem Handy des fehlenden Spielers: App **ganz schließen und neu öffnen** (Web-App holt so die neue Version;
   die Android-APK muss neu installiert werden, siehe Startbildschirm „Neue Version“).
3. **Hall of Snakes** öffnen. Kommt der rote Hinweis: **Neu verbinden** tippen. Steht dort „Supabase bremst gerade“,
   ein paar Minuten warten (Teil 4 prüfen) und noch einmal tippen.
4. Klappt es immer noch nicht: Die kleine graue Zeile unter dem Hinweis (z. B. `invalid_credentials · 400 · …`) abfotografieren
   und mir schicken, damit sieht man die genaue Ursache.

**Wer fehlt? (im SQL Editor, nur lesen, verändert nichts)**
```sql
-- Alle in der Hall: Name, Skin, Rekord, Freundes-Code, wann zuletzt aktualisiert
select p.name, p.skin, p.code, p.updated_at,
       (select max(s.level) from public.score s where s.user_id = p.id) as rekord
from public.profile p
order by p.updated_at desc;

-- Konten ohne Hall-Eintrag ("Unsichtbare"): angemeldet, aber nie eingetragen
select u.id, u.email, u.is_anonymous, u.created_at, u.last_sign_in_at
from auth.users u
left join public.profile p on p.id = u.id
where p.id is null
order by u.last_sign_in_at desc nulls last;
```

**Doppelter Eintrag (z. B. „Jannko“ und „Jannko 57“):** Konnte die App den Namen nicht übernehmen, weil er schon einem
anderen Konto gehört, trägt sie den Spieler mit einer Nummer ein. Den alten Eintrag löschen (Teil 2 oder 3), dann in der
Hall den Namen ohne Nummer eingeben und **Ändern** tippen.

---

## Teil 1: Einmalig die Datenbank auf den neuen Stand bringen

Ohne diesen Schritt kann die App niemanden löschen (die Löschfunktion fehlt in der Datenbank), und ab 1.39 fehlt die
Funktion, mit der die App Spieler zuverlässig in die Hall of Snakes einträgt (die App geht dann den alten Weg). Die Datei
enthält alles seit Version 1.27 und lässt sich gefahrlos mehrmals ausführen. Nach jeder neuen Version mit Datenbank-Änderung
einmal wiederholen (oder Teil 5 einrichten).

1. Im Browser **github.com/kortjannis-web/Snake** öffnen.
2. Den Ordner **supabase** antippen, dann die Datei **NACHHOLEN.sql**.
3. Oben rechts über dem Text auf **Copy raw file** tippen (Symbol: zwei Quadrate). Jetzt ist alles kopiert.
   *Kein Symbol zu sehen?* Auf **Raw** tippen, lange auf den Text drücken, **Alles auswählen**, **Kopieren**.
4. Neuer Tab: **supabase.com/dashboard** öffnen, anmelden, dein **Snake-Projekt** antippen.
5. Oben links das **Menü** (drei Striche) öffnen, dann **SQL Editor**.
6. Auf **+** bzw. **New query** tippen.
7. Lange ins leere Feld drücken, **Einfügen**.
8. Unten rechts auf **Run** tippen (oder **Ctrl + Enter**).
9. Unten steht **Success. No rows returned**: fertig.
   Kommt eine Warnung „destructive operation“: auf **Run this query** tippen, das ist hier gewollt.

---

## Teil 2: Spieler in der App löschen (der einfache Weg)

**Variante A: über die Hall of Snakes**
1. Einmal das Admin-Passwort eingeben: **Optionen → Admin** → Passwort → **OK**.
2. Zurück, **Hall of Snakes** öffnen.
3. Den Spieler antippen. Unten auf der Karte steht jetzt **Spieler löschen (Admin)** (rot).
4. Antippen, die Frage mit **OK** bestätigen. Oben erscheint „Gelöscht“.

**Variante B: über die Admin-Seite**
1. **Optionen → Admin** → Passwort eingeben.
2. **Spieler verwalten** aufklappen.
3. Den Namen ins Suchfeld tippen.
4. Rechts neben dem Spieler auf den **Mülleimer** tippen, mit **OK** bestätigen.

Weg sind dann: Profil, Rekorde, Trophäen, Freundschaften und Nachrichten. Gibt jemand den Namen später neu ein,
bekommt er ein neues, leeres Konto.

**Fehlermeldungen**

| Meldung | Was tun |
|---|---|
| „Die Löschfunktion fehlt in der Datenbank …“ | Teil 1 machen. |
| „Falsches Passwort.“ | In **Optionen → Admin** das Passwort neu eingeben (genau wie freigeschaltet). |
| „Das hat nicht geklappt. Bist du online?“ | Internet prüfen; ist das Supabase-Projekt pausiert, im Dashboard **Restore project**. |
| Es passiert gar nichts, keine Rückfrage | Der Browser hat Rückfragen blockiert (Häkchen „keine weiteren Dialoge“). App ganz schließen und neu öffnen. |

---

## Teil 3: Spieler direkt in Supabase löschen (falls die App nicht geht)

**Alle Spieler ansehen**
1. Dashboard → Menü → **Table Editor** → links die Tabelle **profile**. In der Spalte **name** stehen alle Spieler.

(Unter *Authentication → Users* stehen nur verschlüsselte Adressen wie `snake-3f9a…@topsichtbar.de`, da sieht man
keine Namen. Deshalb über den Namen löschen:)

**Einen Spieler löschen**
1. Menü → **SQL Editor** → **New query**.
2. Einfügen und **Zoe2** durch den genauen Namen ersetzen (die Anführungszeichen bleiben):
   ```sql
   delete from auth.users
   where id in (select id from public.profile where lower(name) = lower('Zoe2'));
   ```
3. **Run**. Danach in **Table Editor → profile** prüfen, ob der Name weg ist.

**Alte Gast-Konten ohne Namen aufräumen (optional, unsichtbar für alle)**
```sql
delete from auth.users
where is_anonymous and id not in (select id from public.profile);
```

---

## Teil 4: Mehr Anmeldungen erlauben (Anmelde-Grenzen)

Eine feste Spielerzahl gibt es nicht: Der Gratis-Tarif erlaubt etwa 50.000 Spieler im Monat und 200 gleichzeitig online.
Was bremst, sind die Anmelde-Grenzen **pro Internetanschluss** (viele Spieler im selben WLAN):

1. Dashboard → Menü → **Authentication**.
2. Unter **Configuration** auf **Rate Limits**.
3. Ändern:
   - **Rate limit for anonymous users**: auf **200** (pro Stunde)
   - **Rate limit for sign ups and sign ins**: auf **150** (pro 5 Minuten)
   - **Rate limit for token refreshes**: mindestens **300** (pro 5 Minuten)
   - Zusätzlich unter **Authentication → Sign In / Providers → Email**: **Confirm email** aus, und falls vorhanden
     **Secure password change** aus (sonst scheitert das Umbenennen nach 24 Stunden)
   - E-Mail-Grenze nicht anfassen (die App schickt keine E-Mails)
4. Unten **Save changes**. Gilt sofort.

---

## Teil 5 (einmalig, empfohlen): Datenbank-Änderungen künftig automatisch

Damit Teil 1 nie wieder nötig ist: die drei Secrets aus [ONLINE-EINRICHTEN.md, Schritt 8](ONLINE-EINRICHTEN.md) in GitHub
eintragen. Dann spielt jeder Merge die Datenbank-Änderungen selbst ein.
