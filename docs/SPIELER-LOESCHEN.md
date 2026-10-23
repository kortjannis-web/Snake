# Spieler löschen und Anmelde-Grenzen (Anleitung fürs Handy)

Alles geht am Handy im Browser (Chrome oder Safari). Du brauchst dein Supabase-Login und das Admin-Passwort der App.

> **Sperren ist nicht Löschen.** Der Knopf mit dem durchgestrichenen Kreis (in Anfragen und im Chat) **sperrt** nur:
> Ihr könnt euch dann keine Anfragen und Nachrichten mehr schicken, der Spieler bleibt aber da.
> Wieder entsperren: in der App **Mehrspieler → Gesperrte Spieler**.

---

## Teil 1: Einmalig die Datenbank auf den neuen Stand bringen

Ohne diesen Schritt kann die App niemanden löschen (die Löschfunktion fehlt in der Datenbank). Danach nie wieder nötig,
außer die App meldet es.

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
   - **Rate limit for token refreshes**: mindestens **300**
   - E-Mail-Grenze nicht anfassen (die App schickt keine E-Mails)
4. Unten **Save changes**. Gilt sofort.

---

## Teil 5 (einmalig, empfohlen): Datenbank-Änderungen künftig automatisch

Damit Teil 1 nie wieder nötig ist: die drei Secrets aus [ONLINE-EINRICHTEN.md, Schritt 8](ONLINE-EINRICHTEN.md) in GitHub
eintragen. Dann spielt jeder Merge die Datenbank-Änderungen selbst ein.
