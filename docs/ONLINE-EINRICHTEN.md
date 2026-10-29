# Online-Bestenliste einrichten (Schritt für Schritt)

> Läuft schon? Dann lieber [SUPABASE-KOMPLETT.md](SUPABASE-KOMPLETT.md): alle Schalter, Selbsttest, automatische Updates und Fehlersuche an einem Ort.

Ziel: Freunde installieren das Spiel **einmal**, es aktualisiert sich bei jedem Merge von selbst, und alle sehen
**live** eine gemeinsame Bestenliste („Heute“ und „Für immer“). Alles kostenlos.

Der Code ist fertig (Version 1.16.0). Was fehlt, sind **einmalige Klicks bei Supabase und GitHub**, weil nur du
dort eingeloggt bist. Dauer: ca. 20 Minuten.

## Überblick: was läuft wo

| Teil | Wo | Kosten |
|---|---|---|
| Spiel (Web-App/PWA) | GitHub Pages | 0 € |
| Android-APK | GitHub Release `latest` | 0 € |
| Bestenliste, Namen, Live-Updates | Supabase (Datenbank + Realtime + anonyme Gast-Anmeldung) | 0 € im Gratis-Tarif |

Ohne die Schritte 1 bis 5 läuft das Spiel genauso wie bisher, nur ohne den Menüpunkt „Bestenliste“.

---

## Schritt 1: Supabase-Projekt anlegen

1. Öffne <https://supabase.com> und klicke **Start your project** / **Sign in**. Am einfachsten: **Continue with GitHub**.
2. Lege bei Aufforderung eine **Organization** an (Name egal, Typ „Personal“, Plan **Free**).
3. Klicke **New project** und trage ein:
   - **Name:** `snake`
   - **Database Password:** auf **Generate a password** klicken und **in deinem Passwortmanager speichern** (wird nur für den optionalen Schritt 8 gebraucht).
   - **Region:** `Central EU (Frankfurt)`
   - **Plan:** Free
4. **Create new project** und 1 bis 2 Minuten warten, bis das Projekt bereit ist.

## Schritt 2: Anonyme Gast-Anmeldung einschalten

Spieler bekommen so eine feste Nutzer-Id, ohne ein Konto oder Passwort anzulegen.

1. Im Projekt links **Authentication** öffnen.
2. **Sign In / Providers** (je nach Fassung auch **Sign In / Up**) öffnen.
3. Den Schalter **Allow anonymous sign-ins** einschalten und **Save** klicken.

> Ist der Schalter aus, erscheint im Spiel beim Speichern des Namens „Das hat nicht geklappt“.

## Schritt 2b: Account per Name einschalten (ab Version 1.22)

Der **Name ist der Account**: Wer auf einem anderen Gerät denselben Namen eingibt (Groß-/Kleinschreibung egal), landet im selben
Account, ohne Passwort. Dafür legt die App im Hintergrund pro Name ein Supabase-Konto mit einer abgeleiteten E-Mail-Adresse und
einem abgeleiteten Passwort an. Es wird nie eine E-Mail verschickt. Einmal im Dashboard:

1. **Authentication → Sign In / Providers → Email** öffnen.
2. **Enable Email provider** an lassen.
3. **Confirm email** **ausschalten** (sonst kann sich niemand per Name anmelden) und **Save** klicken.
4. Falls es die Option gibt: **Secure password change** ausschalten.

> Solange 3. nicht gemacht ist, läuft alles wie vorher (ein Gast pro Gerät). Sobald es umgestellt ist, werden bestehende Spieler beim
> nächsten Start automatisch auf ihren Namen umgestellt (gleiche Nutzer-Id, nichts geht verloren).
> Wichtig für Bestandsspieler: Einen Namen, der noch zu einem alten Gast gehört, kann ein neues Gerät erst nutzen, wenn die App
> auf dem **alten** Gerät einmal gestartet wurde.

Die Adressen sehen aus wie `snake-<zufall>@topsichtbar.de` (Domain über die Variable `VITE_KONTO_DOMAIN` änderbar). Sicherheit: Wer den
Namen kennt, kommt in den Account. Das ist für den Familien- und Freundeskreis gewollt. **Äpfel, Skins und Statistik** bleiben pro Gerät,
im Account liegen Name, Hall-of-Snakes-Eintrag, Ergebnisse, Freunde und Chat.

## Schritt 3: Datenbank einrichten (ein Mal Kopieren und Einfügen)

1. Links **SQL Editor** öffnen und **New query** klicken.
2. In GitHub die Datei `supabase/migrations/20261018000000_bestenliste.sql` öffnen, **Copy raw file** (zwei Quadrate oben rechts) → alles kopieren.
3. In den SQL Editor einfügen und **Run** klicken (oder Strg/Cmd + Enter).
4. Erwartet: „Success. No rows returned“.
5. **Das Gleiche noch einmal** mit einer **neuen Query** und der Datei `supabase/migrations/20261018000100_alle_spieler.sql`
   (sie schaltet die Liste „Alle Spieler“ frei), danach mit `supabase/migrations/20261018000200_skin_und_online.sql`
   (Skin in der Spielerliste), `supabase/migrations/20261018000300_freunde_siege.sql` (Freunde, eindeutige Namen, Siege und Koop)
   und `supabase/migrations/20261018000400_tages_und_push.sql` (Tages-Herausforderung, Push-Einladungen).
   Immer der Reihe nach, jede Datei in ein eigenes, leeres Feld.
6. Kontrolle: links **Table Editor** → Du siehst die Tabellen `profile` und `score`.

Das Skript legt an: Tabellen, Schutzregeln (jeder darf lesen, schreiben nur das Eigene, nichts ändern oder löschen),
einen **Schummelschutz** (kein Level schneller als eines je 0,2 s, höchstens ein Ergebnis je 10 s), die beiden Ranglisten und
die Live-Funktion. Du kannst es gefahrlos ein zweites Mal ausführen.

## Schritt 4: Zugangsdaten kopieren

1. Links unten **Project Settings** (Zahnrad) → **API** (heißt je nach Fassung **API Keys**).
2. Notiere dir zwei Werte:
   - **Project URL**, z. B. `https://abcdefgh.supabase.co`
   - **anon public** Key (alter Name) oder **Publishable key** (beginnt mit `sb_publishable_`).
3. **Niemals** den **service_role** / **secret** Key verwenden oder weitergeben. Der Anon-/Publishable-Key ist dafür gedacht,
   in der App zu stehen; die Sicherheit kommt aus den Regeln aus Schritt 3.

## Schritt 5: Werte in GitHub eintragen

1. Öffne dein Repository `kortjannis-web/Snake` auf GitHub.
2. **Settings** → links **Secrets and variables** → **Actions**.
3. Oben den Reiter **Variables** wählen (nicht „Secrets“) → **New repository variable**:

   | Name | Wert |
   |---|---|
   | `VITE_SUPABASE_URL` | die Project URL |
   | `VITE_SUPABASE_ANON_KEY` | der anon / Publishable Key |

   Beide Namen exakt so schreiben (Groß-/Kleinschreibung).

## Schritt 6: Veröffentlichen (Merge) und GitHub Pages einschalten

> **Wichtig:** Die Workflows veröffentlichen nur vom **Standardzweig** des Repos (bei dir `main`, früher
> `ccr-f3b75153-2ubdai`). Änderungen sind erst für alle da, wenn sie dort gelandet sind.

1. Auf GitHub öffnest du den Zweig mit den Änderungen und klickst **Compare & pull request** → **Create pull request** →
   **Merge pull request**. (Oder sag mir Bescheid, dann erstelle ich den Pull Request für dich.)
2. **Settings** → **Pages** → bei **Source** **GitHub Actions** wählen. (Nur beim allerersten Mal.)
3. Reiter **Actions**: Zwei Läufe starten, **Web-App (GitHub Pages)** und **Android-APK**. Warte, bis beide ein grünes Häkchen
   haben (APK ca. 5 bis 8 Minuten). Falls der Pages-Lauf rot ist, weil Pages erst in Schritt 2 eingeschaltet wurde:
   **Re-run all jobs**.
4. Deine Web-Adresse (steht auch unter Settings → Pages): **`https://kortjannis-web.github.io/Snake/`**

## Schritt 7: Auf den Handys installieren

**Du schickst nur den Link** (`https://kortjannis-web.github.io/Snake/`). Öffnet ihn jemand mit dem **Handy im Browser**,
sieht er **nicht das Spiel**, sondern eine **bebilderte Anleitung** für sein Gerät (iPhone oder Android, wird erkannt,
oben lässt es sich umschalten). Gespielt wird erst, wenn Snake **als App auf dem Home-/Startbildschirm** liegt.
Am Computer gibt es diese Pflicht nicht, dort läuft das Spiel direkt im Browser.

Die Anleitung zeigt:

**iPhone** (in **Safari**, kein Entwicklerkonto nötig): Teilen-Symbol → „Zum Home-Bildschirm“ → „Hinzufügen“ → Snake vom
Home-Bildschirm öffnen. Kommt jemand aus WhatsApp, Instagram oder Chrome, weist die Seite darauf hin, den Link in Safari
zu öffnen, und bietet „Link kopieren“ an.

**Android** (in **Chrome**): Auf Chrome erscheint ein Knopf **Jetzt installieren**. Alternativ: ⋮ → „App installieren“ →
„Installieren“ → Snake vom Startbildschirm öffnen. Zusätzlich gibt es unten einen Link zur **APK** (nur, wenn das Repo öffentlich ist).

**Updates:** Die installierte Web-App holt neue Versionen beim Start von selbst. Die APK zeigt auf dem Startbildschirm
**„Neue Version: jetzt laden“**, sobald eine neuere da ist (dann drüberinstallieren, die Spielstände bleiben).

**Erster Start in der App (jeder Spieler):** Ein Fenster fragt nach dem **Namen** (2 bis 16 Zeichen). Den Account legt die App aus dem Namen selbst an, ein Passwort
gibt es nicht. Rekord, Äpfel und Skins bleiben lokal auf dem Handy. Online liegen nur der Name und die
Ergebnisse. Der Name lässt sich jederzeit unter **Bestenliste** ändern.

> Der Account gehört zum Namen (siehe Schritt 2b). Wer die App neu installiert oder ein anderes Gerät benutzt, gibt einfach denselben Namen
> ein und ist wieder im selben Account. Äpfel und Skins liegen nur auf dem Gerät.

---

## Schritt 8 (optional): Datenbank-Änderungen automatisch ausliefern

Nur nötig, wenn später das Datenbankschema geändert wird (neue Datei in `supabase/migrations/`). Statt Schritt 3 von Hand
zu wiederholen, erledigt das der Workflow `Supabase-Datenbank` bei jedem Merge.

1. Im Supabase-Dashboard rechts oben dein Profil → **Account Preferences** → **Access Tokens** → **Generate new token**
   (Name `github`) und kopieren.
2. Die **Project Reference** findest du unter **Project Settings → General → Reference ID** (oder der Teil vor `.supabase.co`).
3. GitHub: **Settings → Secrets and variables → Actions → Secrets** → **New repository secret**, drei Stück:

   | Name | Wert |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | der Token aus 1. |
   | `SUPABASE_PROJECT_REF` | die Reference ID aus 2. |
   | `SUPABASE_DB_PASSWORD` | das Datenbankpasswort aus Schritt 1 |

Ohne diese Secrets überspringt der Workflow still. Bereits von Hand ausgeführtes SQL ist kein Problem, die Datei ist wiederholbar.

---

## So testest du es mit einem Freund

1. Beide öffnen die App und tragen einen Namen ein.
2. Beide öffnen **Bestenliste**: oben rechts steht **LIVE**.
3. Einer spielt eine Runde bis zum Ende. Beim anderen taucht das Ergebnis nach wenigen Sekunden von selbst auf.

## Was zählt in der Bestenliste

- Nur normale Runden: kein Kreativ-Modus (dort gibt es auch keine Äpfel), keine Sandbox, keine geänderten **Master-Einstellungen**, kein `?level=`.
- Reiter **Heute**, **Für immer** und **Alle Spieler**. In „Alle Spieler“ steht jeder, der einen Namen eingetragen hat, auch wer noch nicht gespielt hat („–“).
- Außerdem **Trophäen** (eine je besiegtem Gegner in Mehrspieler-Siegen), **Koop** (bestes Team) und **Täglich** (Tages-Herausforderung von heute).
- Gewertet wird der **höchste erreichte Level** der Runde. „Heute“ gilt nach deutscher Zeit, „Für immer“ ist die Bestzeit überhaupt.
- Das Tempo (langsam / normal / schnell) steht hinter dem Namen, wenn es nicht „normal“ ist.
- Ergebnisse ohne Netz werden auf dem Handy gemerkt (bis zu 20) und später gesendet.

## Kosten und Grenzen (Stand Herbst 2026, bitte auf supabase.com/pricing gegenprüfen)

- Der Gratis-Tarif reicht für einen Freundeskreis deutlich: ca. 500 MB Datenbank, 50.000 aktive Nutzer pro Monat,
  ca. 200 gleichzeitige Live-Verbindungen, 2 Gratis-Projekte.
- **Gratis-Projekte werden nach etwa 1 Woche ohne Aktivität pausiert.** Dann im Dashboard **Restore project** klicken.
  Bei regelmäßigem Spielen passiert das nicht.
- Nicht nötig und nicht gebucht: Apple Developer (99 $/Jahr), Google Play (25 $ einmalig).

## Fehlersuche

| Beobachtung | Ursache und Lösung |
|---|---|
| Reiter „Alle Spieler“ zeigt „Keine Verbindung“ | Die zweite SQL-Datei aus Schritt 3 wurde noch nicht ausgeführt. |
| Kein Menüpunkt „Bestenliste“ | Die Variablen aus Schritt 5 fehlen oder heißen anders. Eintragen und danach einen neuen Build auslösen (Actions → Web-App → **Run workflow**). |
| „Diesen Namen gibt es schon (alter Gast-Account)“ | Der Name gehört zu einem Spieler von vor Version 1.22. Die App einmal auf dessen Gerät starten, dann geht der Name überall. |
| Name auf zweitem Gerät landet in einem neuen Account | Schritt 2b nicht gemacht (Confirm email an): alles läuft noch als Gast pro Gerät. |
| „Das hat nicht geklappt. Bist du online?“ beim Namen | Schritt 2 (Anonyme Anmeldung) nicht aktiv, Schritt 3 nicht ausgeführt, oder Projekt pausiert. |
| „Keine Verbindung“ in der Liste | Kein Internet, Projekt pausiert oder falsche URL in Schritt 5. |
| Ergebnis fehlt in der Liste | Beim Speichern war kein Netz (kommt später von selbst), Master-Einstellungen geändert, Kreativ-Modus, oder die Runde war unter 2 Level. |
| Liste aktualisiert sich nicht live | Beim Anlegen der Datenbank gab es einen Fehler: SQL aus Schritt 3 erneut ausführen. Notfalls schließt und öffnet die Seite die Liste neu. |
| Am Handy erscheint die Anleitung, obwohl Snake schon installiert ist | Snake muss **vom Home-/Startbildschirm** geöffnet werden, nicht aus Safari oder Chrome. |
| Update erscheint nicht auf dem iPhone | App vom Home-Bildschirm komplett schließen und neu öffnen (die neue Version wird beim Start geholt). |
| Spieler fehlt in der Hall, kein Freundes-Code, Skin/Rekord kommen nicht an | `supabase/NACHHOLEN.sql` ausführen, App neu öffnen, in der Hall **Neu verbinden**. Anleitung: [SPIELER-LOESCHEN.md](SPIELER-LOESCHEN.md), Teil 0. |
| Spieler löschen geht nicht („Löschfunktion fehlt“) | Die Datenbank-Änderungen sind nicht angekommen (Schritt 8 fehlt): einmal `supabase/NACHHOLEN.sql` ausführen, Anleitung [SPIELER-LOESCHEN.md](SPIELER-LOESCHEN.md). |
| Pages-Lauf rot | Settings → Pages → Source auf **GitHub Actions** stellen, dann **Re-run all jobs**. |
