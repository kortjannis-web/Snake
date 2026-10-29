# Mehrspieler einrichten (Schritt für Schritt)

Seit Version 1.17.0 kann man mit bis zu 4 Freunden spielen, seit 1.18.0 in fünf Modi: **Gegeneinander**, **Wettrennen**,
**Koop**, **Apfeljagd** und **Zone**. Dafür braucht
es einen kleinen Server bei Cloudflare (kostenlos). Die Online-Bestenliste aus
[`ONLINE-EINRICHTEN.md`](ONLINE-EINRICHTEN.md) muss schon laufen, weil der Mehrspieler den Namen und die Online-Liste braucht.

Dauer: ca. 15 Minuten. Ohne diese Schritte läuft alles wie bisher, nur ohne den Knopf „Mehrspieler“.

## So funktioniert es

| Teil | Aufgabe |
|---|---|
| **Snake-Server** (Cloudflare Worker, je Raum ein Durable Object) | Räume mit Code, wer ist Gastgeber, wer rechnet, Stand merken, Wettrennen-Regeln (Abstand, wer wählt, Sieger) |
| **Ein Handy rechnet** (Gegeneinander, Koop) | Anfangs der Gastgeber. Es schickt den Spielstand (nur Änderungen) über den Server an die anderen, die anderen schicken nur ihre Wischer. |
| **Automatische Übernahme** | Fällt das rechnende Handy aus (Netz weg, App im Hintergrund, ausgestiegen), rechnet nach ca. 2 Sekunden ein anderes mit dem gespeicherten Stand weiter. |
| **Wettrennen** | Jedes Handy rechnet seine eigene Welt, die anderen erscheinen als Geist. |
| **Supabase** | Name, Spielerliste mit Skin und Rekord, Freunde, wer gerade online ist, Einladungen, Sieges- und Koop-Bestenliste. |
| **Push-Einladungen** (optional) | Der Snake-Server schickt eine Benachrichtigung an Freunde, die Snake gerade nicht offen haben. |

Warum rechnet nicht der Server selbst? Im Gratis-Tarif von Cloudflare darf ein Aufruf nur sehr kurz rechnen. Eine
Spielschleife, die ständig läuft, wäre dort nicht zuverlässig. Deshalb rechnet ein Handy und der Server passt auf.
Wer später 5 $/Monat für Cloudflare zahlt, könnte die Rechnung auf den Server verlegen: die Spiellogik ist dieselbe Datei.

## Schritt 1: Cloudflare-Konto

1. <https://dash.cloudflare.com/sign-up> öffnen, mit E-Mail und Passwort registrieren, E-Mail bestätigen. Kostenlos, keine Kreditkarte.
2. Links im Menü **Workers & Pages** (je nach Fassung **Compute (Workers)**) öffnen.
3. Beim ersten Mal fragt Cloudflare nach einer **workers.dev-Subdomain**. Einen Namen wählen, z. B. `jannis`.
   Der Server heißt später `https://snake-server.jannis.workers.dev`.

## Schritt 2: Account-ID und API-Token kopieren

**Account-ID:**
1. In **Workers & Pages** rechts unter **Account details** steht die **Account ID**. Kopieren.
   (Sie steht auch in der Adresszeile: `dash.cloudflare.com/<Account-ID>/…`.)

**API-Token** (damit GitHub den Server für dich veröffentlichen darf):
1. Rechts oben auf das Profil-Symbol → **My Profile** (Profil) → **API Tokens**.
2. **Create Token** → bei der Vorlage **Edit Cloudflare Workers** auf **Use template**.
3. Bei **Account Resources**: *Include* → dein Konto. **Zone Resources** kann auf *All zones* bleiben.
4. **Continue to summary** → **Create Token**.
5. Den Token **sofort kopieren**, er wird nur einmal angezeigt.

> Den Token niemandem schicken und nicht in den Chat kopieren. Er gehört nur in die GitHub-Secrets.

## Schritt 3: In GitHub eintragen (Secrets)

1. GitHub → Repo `kortjannis-web/Snake` → **Settings** → **Secrets and variables** → **Actions**.
2. Reiter **Secrets** (nicht Variables) → **New repository secret**, zwei Stück:

   | Name | Wert |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | der Token aus Schritt 2 |
   | `CLOUDFLARE_ACCOUNT_ID` | die Account-ID aus Schritt 2 |

## Schritt 4: Server veröffentlichen

1. GitHub → Reiter **Actions** → links **Snake-Server (Cloudflare)** → rechts **Run workflow** → **Run workflow**.
   (Nach jedem Merge, der den Server oder die Spiellogik ändert, passiert das künftig von selbst.)
2. Warten, bis der Lauf grün ist (ca. 1 Minute).
3. Auf den Lauf klicken → **deploy** → Schritt **Veroeffentlichen** aufklappen. Dort steht eine Zeile wie
   `https://snake-server.jannis.workers.dev`. Diese Adresse kopieren.
4. Kontrolle: Die Adresse im Browser öffnen. Es erscheint `Snake-Server, Protokoll 2`.

## Schritt 5: Die App mit dem Server verbinden (Variable)

1. GitHub → **Settings** → **Secrets and variables** → **Actions** → Reiter **Variables** → **New repository variable**:

   | Name | Wert |
   |---|---|
   | `VITE_SNAKE_SERVER` | die Adresse aus Schritt 4, z. B. `https://snake-server.jannis.workers.dev` (ohne `/` am Ende) |

2. Neu bauen: **Actions** → **Web-App (GitHub Pages)** → **Run workflow**, danach **Android-APK** → **Run workflow**.
   (Oder einfach beim nächsten Merge.)

## Schritt 6: Supabase ergänzen (SQL-Dateien 3, 4 und 5)

Im Supabase **SQL Editor** jede dieser Dateien der Reihe nach ausführen, jede in einem eigenen, leeren Feld
(**New snippet** → Inhalt einfügen → **Run** → „Success“). Schon ausgeführte Dateien kann man überspringen.

| Datei | Wofür |
|---|---|
| `supabase/migrations/20261018000200_skin_und_online.sql` | Skin in der Spielerliste |
| `supabase/migrations/20261018000300_freunde_siege.sql` | Freunde per Code, eindeutige Namen mit Wortfilter, Sieges- und Koop-Bestenliste |
| `supabase/migrations/20261018000400_tages_und_push.sql` | Tages-Herausforderung und Push-Einladungen |

Hinweis zu Datei 4: Gibt es einen Namen schon doppelt (z. B. zweimal „Max“), bekommt der spätere eine Nummer („Max 2“).
Danach kann jeder Name nur einmal vergeben werden.

Ohne Datei 4 gibt es keine Freunde: dann sieht niemand jemanden online. Ohne Datei 5 fehlen die Tages-Bestenliste und Push.

Seit 1.20.0 außerdem Datei 6:

| Datei | Wofür |
|---|---|
| `supabase/migrations/20261019000000_hall_anfragen_chat.sql` | Hall of Snakes, Freundschaftsanfragen, Sperren, Chat unter Freunden (Nachrichten 30 Tage) |

Ohne Datei 6 zeigt die Hall of Snakes „Keine Verbindung“ und es gibt keine Anfragen und keinen Chat.

## Schritt 7 (optional): Einladungen aufs Handy (Push)

> Seit 1.55 gibt es Benachrichtigungen auch für Nachrichten und den Weltchat, und für die Android-APK über Firebase.
> Die vollständige Anleitung steht in [`BENACHRICHTIGUNGEN.md`](BENACHRICHTIGUNGEN.md); dieser Schritt hier ist dort Teil 2.

Damit Freunde eine Benachrichtigung bekommen, wenn sie Snake gerade nicht offen haben. Geht in der Web-App auf Android
(Chrome) und auf dem iPhone ab iOS 16.4, wenn Snake **vom Home-Bildschirm** geöffnet wurde. In der Android-APK nicht
(dort bitte die Web-App nutzen oder den Raum-Code schicken).

1. Am Computer im Repo einmal `npm install` und dann `npm run vapid` ausführen. Es erscheinen zwei Werte:
   ein **öffentlicher** (lang, beginnt mit `B`) und ein **geheimer** Schlüssel.
   (Ohne eigenen Computer: GitHub → **Code** → **Codespaces** → **Create codespace**, dort im Terminal dieselben Befehle.)
2. GitHub → **Settings** → **Secrets and variables** → **Actions**:
   - Reiter **Variables** → **New repository variable**: Name `VITE_VAPID_PUBLIC_KEY`, Wert der **öffentliche** Schlüssel.
   - Reiter **Secrets** → **New repository secret**: Name `VAPID_PRIVATE_KEY`, Wert der **geheime** Schlüssel.

   > Den geheimen Schlüssel niemandem schicken und nicht in den Chat kopieren. Er gehört nur in die GitHub-Secrets.
3. **Actions** → **Snake-Server (Cloudflare)** → **Run workflow** (der Server bekommt die Schlüssel und die
   Supabase-Adresse), danach **Web-App (GitHub Pages)** → **Run workflow**.
4. In der App: **Online** (unten im Startmenü) → bei „Einladungen aufs Handy“ **Einschalten** → Benachrichtigungen erlauben.

Die Schlüssel nur einmal erzeugen. Wer sie später austauscht, muss bei allen Spielern Push neu einschalten.

## Spielen

1. App öffnen (vom Home-Bildschirm), unten im Startmenü → **Online**.
2. **Freunde hinzufügen** (einmalig): Unter „Freunde“ steht dein **Freundes-Code**. **Code teilen** und dein Freund tippt
   ihn bei „Freund hinzufügen“ ein (oder umgekehrt). Danach seid ihr gegenseitig Freunde.
   Nur Freunde sehen sich online und können sich einladen.
3. **Raum erstellen** und Freunde dazuholen:
   - **Einladen** in der Freundesliste: Ist der Freund online, erscheint bei ihm „… lädt dich ein“ mit **Annehmen**.
     Ist er nicht online und hat Push eingeschaltet, bekommt er eine Benachrichtigung; ein Tipp darauf bringt ihn in den Raum.
   - Oder **Code teilen** (WhatsApp usw.): der andere tippt den Raum-Code bei „Mit Code beitreten“ ein.
4. Der Gastgeber wählt **Modus**, **Tempo** und ob **Klassisch** (nur Wände und Äpfel). Die anderen tippen **Bereit**.
   Sind alle bereit, tippt der Gastgeber **Starten**. Ändert er danach noch etwas, müssen alle neu „Bereit“ tippen.
5. Im Spiel: unten rechts der Knopf für **Reaktionen** (👍 😂 😱 😡 🔥 👋), sie erscheinen über deiner Schlange.
   Wer raus ist, **schaut zu**: die Kamera folgt einem, der noch lebt, Wischen wechselt zum nächsten.

### Die Regeln

| | Gegeneinander | Wettrennen | Koop | Apfeljagd | Zone |
|---|---|---|---|---|---|
| Feld | ein gemeinsames | jeder seine eigene Welt, die anderen als Geist | ein gemeinsames | ein gemeinsames | ein gemeinsames, größer, schrumpft |
| Andere Schlange | Hindernis (Kopf an Kopf: beide verlieren ein Leben) | Geist, keine Berührung | man fährt hindurch | Hindernis | Hindernis |
| Leben | 3 je Spieler, nach einem Tod 5 s später zurück (kurz als Geist) | wie Gegeneinander | 3 gemeinsam | unendlich, jeder Tod kostet 3 Äpfel, 3 s später zurück | wie Gegeneinander |
| Raus | ohne Leben, oder zu weit hinter dem Führenden (siehe unten) | wie Gegeneinander | gemeinsame Leben weg: Spiel vorbei | niemand | ohne Leben |
| Neues Gebiet | abwechselnd einer, alle 10 Äpfel insgesamt und sofort, wenn es eng wird | abwechselnd einer, alle 20 Level, bei allen an derselben Stelle | wie Gegeneinander | wie Gegeneinander | keins: ab 20 s wird alle 12 s der Rand tödlich (3 s vorher rot gestrichelt) |
| Sieg | der Letzte | der Letzte | gemeinsam so weit wie möglich | nach 3 Minuten die meisten Äpfel | der Letzte |

- **Abstand:** Raus ist, wer 5 (2 Spieler), 6 (3 Spieler) oder 7 Äpfel (4 Spieler) hinter dem Führenden liegt.
  Alle 20 Äpfel des Führenden kommt einer dazu.
- **Gleichstand** (alle scheiden im selben Moment aus): Es gewinnt, wer mehr Äpfel hat.
- **Gleicher Platz pro Kopf:** Die Karte startet mit einem Block je Spieler (mindestens zwei, bei der Zone doppelt so
  viele) und wird kompakt angebaut. Weil jede Schlange um ihre eigenen Äpfel wächst, kommt alle 10 Äpfel insgesamt ein
  Block dazu, egal wie viele mitspielen. Hat eine lebende Schlange im Schnitt weniger als 60 freie Felder, gibt es sofort
  einen Block extra.
- **Duell-Power-ups** (Gegeneinander, Apfeljagd, Zone): Die **Schere** kürzt die nächste fremde Schlange,
  die **Zeitlupe** bremst alle anderen.
- **Vorausberechnung:** Die eigene Schlange reagiert sofort auf den Wischer, auch wenn ein anderes Handy rechnet.

Oben im Spiel: Herzen (Leben), Äpfel und die **Lebensleiste**. Bei 2 Spielern ein Tauziehen (der Punkt wandert zum
Führenden), bei 3 oder 4 eine Zeile je Spieler. Bei der Apfeljagd stehen dort die Uhr und die Äpfel aller.

### Belohnung

Mehrspieler-Runden zählen nicht für den Einzelspieler-Rekord. Dafür gibt es:
- **Trophäen** 🏆 für jeden Sieg: eine je besiegtem Gegner (zu zweit 1, zu dritt 2, zu viert 3). Man sammelt sie, sie
  stehen oben im Startmenü neben den Äpfeln und in der Bestenliste (Reiter **Trophäen**).
- **Äpfel** für den Vorrat: Sieg 30 je Gegner, sonst 5. Koop: der halbe erreichte Level (mindestens 5).
- **Erfolge** (erster Mehrspieler, 1 / 10 / 50 Siege, Apfeljagd gewonnen, Zone gewonnen, Koop Level 50).
- In der **Bestenliste** die Reiter **Trophäen** und **Koop** (bestes Team).

## Tages-Herausforderung

Im Startmenü **Tages-Herausforderung**: Heute spielen alle dieselbe Welt (wechselt um Mitternacht deutscher Zeit),
mit eigener Bestenliste (Reiter **Täglich**).

## Kosten und Grenzen (bitte auf cloudflare.com gegenprüfen)

- Workers im Gratis-Tarif: 100.000 Anfragen am Tag. Eingehende Spielnachrichten zählen nur im Verhältnis 20:1, ausgehende gar nicht.
  Das reicht für viele Stunden Spiel am Tag.
- Durable Objects sind im Gratis-Tarif enthalten (mit SQLite, so ist der Server eingestellt).
- Das rechnende Handy hat minimal weniger Verzögerung als die anderen. Unter Freunden fällt das kaum auf.

## Fehlersuche

| Beobachtung | Ursache und Lösung |
|---|---|
| Kein Knopf „Mehrspieler“ | `VITE_SNAKE_SERVER` fehlt oder es wurde danach nicht neu gebaut (Schritt 5). Ohne Namen/Supabase erscheint er auch nicht. |
| Workflow „Snake-Server“ grün, aber nichts veröffentlicht | Secrets fehlen (der Lauf schreibt dann „Cloudflare-Secrets fehlen“). Schritt 3 prüfen. |
| „Keine Verbindung zum Server“ | Adresse in `VITE_SNAKE_SERVER` falsch (Schritt 4, Punkt 4 testen). |
| „Bitte aktualisiere die App“ | Einer hat eine alte Version. App schließen und neu öffnen (Web-App) bzw. neue APK laden. |
| „Das Spiel in diesem Raum läuft schon“ | In einen laufenden Raum kann niemand Neues. Nach dem Spiel „Nochmal“, dann beitreten. |
| Kurz „Verbindung weg, verbinde neu …“ | Funkloch. Die App verbindet sich selbst neu und spielt weiter. |
| Freund nicht online zu sehen | Ihr müsst Freunde sein (Code eintragen) und SQL-Datei 4 muss ausgeführt sein (Schritt 6). |
| „Diesen Namen gibt es schon“ | Namen gibt es nur einmal. Einen anderen wählen. |
| „Dieser Name ist nicht erlaubt“ | Der Name enthält ein gesperrtes Wort. |
| Keine Zeile „Einladungen aufs Handy“ | `VITE_VAPID_PUBLIC_KEY` fehlt (Schritt 7), oder es ist die Android-APK, oder auf dem iPhone nicht vom Home-Bildschirm geöffnet. |
| „Push ist auf dem Server noch nicht eingerichtet“ | Secret `VAPID_PRIVATE_KEY` fehlt, oder der Workflow „Snake-Server“ lief danach nicht (Schritt 7, Punkt 3). |
| „Hat keine Benachrichtigungen an“ | Der Freund hat Push nicht eingeschaltet. Raum-Code schicken. |
