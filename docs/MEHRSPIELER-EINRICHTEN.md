# Mehrspieler einrichten (Schritt für Schritt)

Mit Version 1.17.0 kann man mit bis zu 4 Freunden spielen: **Gegeneinander**, **Wettrennen** und **Koop**. Dafür braucht
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
| **Supabase** | Name, Spielerliste mit Skin und Rekord, wer gerade online ist, Einladungen. |

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
4. Kontrolle: Die Adresse im Browser öffnen. Es erscheint `Snake-Server, Protokoll 1`.

## Schritt 5: Die App mit dem Server verbinden (Variable)

1. GitHub → **Settings** → **Secrets and variables** → **Actions** → Reiter **Variables** → **New repository variable**:

   | Name | Wert |
   |---|---|
   | `VITE_SNAKE_SERVER` | die Adresse aus Schritt 4, z. B. `https://snake-server.jannis.workers.dev` (ohne `/` am Ende) |

2. Neu bauen: **Actions** → **Web-App (GitHub Pages)** → **Run workflow**, danach **Android-APK** → **Run workflow**.
   (Oder einfach beim nächsten Merge.)

## Schritt 6: Supabase ergänzen (dritte SQL-Datei)

Für den Skin in der Spielerliste: im Supabase **SQL Editor** → **New snippet** → den Inhalt von
`supabase/migrations/20261018000200_skin_und_online.sql` einfügen → **Run** → „Success“.

Ohne diesen Schritt geht der Mehrspieler trotzdem, nur zeigt die Spielerliste alle Schlangen in Grün.

## Spielen

1. App öffnen (vom Home-Bildschirm), Startmenü → **Mehrspieler** → **Raum erstellen**.
2. Freunde dazuholen, auf einem dieser Wege:
   - **Code teilen** (WhatsApp usw.): der andere tippt in **Mehrspieler** den Code bei „Mit Code beitreten“ ein.
   - **Einladen**: In der Lobby unter „Freunde einladen“ oder in **Bestenliste → Alle Spieler** (grüner Punkt = online)
     auf **Einladen** tippen. Beim anderen erscheint „… lädt dich ein“ mit **Annehmen**.
3. Der Gastgeber wählt den Modus und tippt **Starten** (ab 2 Spielern). Nach 3, 2, 1 geht es los.

### Die Regeln

| | Gegeneinander | Wettrennen | Koop |
|---|---|---|---|
| Feld | ein gemeinsames | jeder seine eigene Welt, die anderen als Geist | ein gemeinsames |
| Andere Schlange | ist ein Hindernis (Kopf an Kopf: beide verlieren ein Leben) | Geist, keine Berührung | man fährt hindurch |
| Leben | 3 je Spieler, nach einem Tod 5 s später zurück (kurz als Geist) | wie Gegeneinander | 3 gemeinsam |
| Raus | ohne Leben, oder 5 Äpfel hinter dem Führenden (alle 20 Äpfel des Führenden einer mehr) | wie Gegeneinander | wenn die gemeinsamen Leben weg sind, ist das Spiel vorbei |
| Neues Gebiet | abwechselnd einer, alle 10 / 5 / 3 Äpfel (2 / 3 / 4 Spieler). Nur er sieht die gelben Wände | abwechselnd einer, wie im Einzelspiel alle 20 Level, kommt bei allen an dieselbe Stelle | abwechselnd einer, alle 15 Level |
| Sieg | der Letzte | der Letzte | gemeinsam so weit wie möglich |

Oben im Spiel: Herzen (Leben), Äpfel und die **Lebensleiste**. Bei 2 Spielern ein Tauziehen (der Punkt wandert zum
Führenden), bei 3 oder 4 eine Zeile je Spieler: Der Balken zeigt, wie viel Luft bis zum Ausscheiden bleibt.

Mehrspieler-Runden zählen nicht für Rekord, Statistik und Äpfel-Vorrat.

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
