# Snake Endlos

Snake im Endlos-Modus, als Web-App (PWA, installierbar und offline) und als Android-App.
Grundlage ist das Snake aus dem Hero-Telefon von topsichtbar.de (weicher Takt,
gepufferte Eingaben, Sofort-Wende, Mauern Feld für Feld, Teiche).

## Herunterladen

- **Android:** unter *Releases → latest* `snake-endlos.apk` auf dem Handy öffnen und installieren
  (einmalig „Installation aus unbekannten Quellen“ erlauben). Jeder Push baut die APK neu
  (*Actions → Android-APK*, auch als Artefakt).
- **Am Handy im Browser** erscheint statt des Spiels eine bebilderte Installationsanleitung (iPhone und Android); gespielt wird erst als App vom Home-Bildschirm. Zum Entwickeln überspringt `?browser=1` die Anleitung, am Computer und im Dev-Server gibt es sie nicht.
- **Web/iPhone:** über GitHub Pages (einmalig in *Settings → Pages* die Quelle „GitHub Actions“
  wählen). Im Browser „Zum Home-Bildschirm“ macht daraus eine App im Vollbild.

## Online-Bestenliste und Updates

Mit Supabase (kostenlos) gibt es die Hall of Snakes (fehlt ein Spieler oder kommen Skin und Rekord nicht an: [`docs/SPIELER-LOESCHEN.md`](docs/SPIELER-LOESCHEN.md), Teil 0) (der **Name ist zugleich der Account**: derselbe Name auf einem anderen Gerät = derselbe Account, ohne Passwort; Einrichtung Schritt 2b): alle Spieler nach Rekord, Gold oder Silber sortiert, dazu Freunde und das Tageslevel.
Einrichtung Schritt für Schritt: [`docs/ONLINE-EINRICHTEN.md`](docs/ONLINE-EINRICHTEN.md). **Alle Supabase-Einstellungen, Selbsttest, automatische Updates, Fehlersuche und Ideen fürs Online-Erlebnis:** [`docs/SUPABASE-KOMPLETT.md`](docs/SUPABASE-KOMPLETT.md). Ohne Einrichtung läuft das
Spiel unverändert, nur ohne den Menüpunkt. Die Web-App aktualisiert sich bei jedem Merge von selbst, die Android-App
weist auf dem Startbildschirm auf eine neuere APK hin.

## Mehrspieler

Bis zu 4 Spieler, wahlweise mit **1 Leben (Standard) oder 3 Leben** (dann doppelt so viele Trophäen für den Sieg), fünf Modi: **Gegeneinander** (ein Feld, wer zu weit zurückliegt, ist raus), **Wettrennen**
(eigene Welt, die anderen als Geist), **Koop** (zusammen, 3 gemeinsame Leben), **Apfeljagd** (3 Minuten, die meisten Äpfel
gewinnen) und **Zone** (die Karte schrumpft). Der Gastgeber wählt „Klassisch“, alle tippen „Bereit“. Freunde
fügt man per Code hinzu; alle Online-Spieler sehen sich und können sich einladen, auch per Benachrichtigung aufs Handy.
Jeden Spieler kann man in der Hall of Snakes antippen und zum Gefecht einladen (online sofort, sonst als Benachrichtigung), im Ergebnis gibt es eine Revanche-Abstimmung. Ein Handy rechnet, ein kleiner Cloudflare-Server (`server/`) verteilt und übernimmt, wenn es ausfällt. Einrichtung:
[`docs/MEHRSPIELER-EINRICHTEN.md`](docs/MEHRSPIELER-EINRICHTEN.md). Hintergrund: [`docs/MULTIPLAYER-PLAN.md`](docs/MULTIPLAYER-PLAN.md).

**Kampagne** (Startmenü → Kampagne): feste Missionen je Welt auf einer eigenen Karte, auf der die eigene Schlange von Mission zu Mission wächst. Die Wiese hat **20 Missionen**, alle spielbar und immer schwerer (Bäche, Froschteich, Mauern, giftige Wiese, Hügel mit Eis und Gegner-Schlangen, ab Mission 8 enge Pässe), in allen Missionen weniger Giftäpfel als früher. **Ab Mission 5** kommen Ameisen, Bäume (kommt der Kopf auf 5 Felder heran, kippen sie nach 1 bis 8 Sekunden) und Häuser dazu, deren Fensterlicht alle 4 Sekunden wechselt (nie auf die Schlange; hineinlaufen ist vorbei). Mission 5 und 15 sind Schatz-Level (Edelsteine bringen Äpfel extra), Mission 10 der Boss: der **Steingolem** in drei Räumen hinter Steintoren. Kristalle zum Sockel gleicher Farbe bringen (Raum 1: 3, Raum 2: 4, Raum 3: 6, dort in Kammern und Gassen), leuchten alle, bannt der Kreis den Golem, dann durch ihn hindurchfahren; je Raum ein Treffer, danach öffnet sich das Tor zum nächsten. Drei angekündigte Attacken (Stampfen, Ansturm-Streifen mit Felsbrocken, Sprung), drei Herzen; Belohnung Skin Steingolem. **Missionen 11 bis 20** (dieselbe Wiese, schwerer: engere Pässe, größere Gebiete bis 3 Blöcke breit, weniger Frösche): **kleine Steingolems** (laufen zufällig, sehen 7 Felder weit nach vorn (seit 1.48.1, vorher 5), jagen den Kopf, bis etwas die Sicht versperrt (Wegfahren reicht nicht), und schlagen nach einer halben Sekunde zu: rundum 2 Felder oder geradeaus 4, nur der Kopf zählt), Giftwolken aus Quellen, Lava, die sich ausbreitet, große Tannen (fallen 6 Felder weit), ab Mission 16 Leuchttürme mit drehendem Kegel, dazu Bienenstöcke, Igel und Gegner-Schlangen. Seit 1.48 bringt **jede Mission eine neue Sache** (5 Bäume, 6 kleiner Golem, 7 Eis, 8 Häuser, 9 Ameisen, 11 Igel, 12 Giftwolken, 13 Lava und große Tanne, 16 Mini-Ent, 17 Bienen, 18 der Leuchtturm), **keine Gegner-Schlangen** und nur **einen Leuchtturm**: Mission 18 baut sich ringsum um ihn (Felsring mit Lücken, Mauerring mit Toren); seit 1.48.2 fällt sein Licht durch die Lücken 16 Felder weit über die Wiese und er dreht sich schneller (alle 2,4 s); seit 1.48.3 trifft er auch direkt (nur der Kopf zählt, der Körper darf im Licht liegen), 0,7 s vor jeder Drehung zeigt er schwach, wohin. **Boss-Räume** (Golem, Ent) haben seit 1.48.2 dieselbe Feldgröße wie die anderen Missionen, die Kamera folgt dem Kopf im Raum. **In den Boss-Kämpfen hat die Schlange keine Herzen**: ein Treffer am Kopf ist vorbei, nur Golem und Ent haben drei Leben. Die kleinen Steingolems kommen langsam **ab Mission 6** (1, 1, 2, 3, im Boss-Kampf 3) und kündigen den Golem an; ab Mission 11 gibt es keine mehr. **Ab Mission 16 stehen Mini-Ents** (1, 2, 2, 3): sie bewegen sich nicht, bemerken den Kopf auf 4 Felder in jede Richtung und werfen dann Blätterbomben (Schatten, dann Plus), bis etwas die Sicht versperrt und packen zu, wenn man direkt vorbeifährt (dann bleibt eine halbe Sekunde, um von ihnen wegzuwischen). **Mission 20 ist der Ent** (zweiter Boss): Er steht verwurzelt am Rand einer Waldlichtung und greift aus der Ferne an (Wurzeln durch ganze Zeilen und Spalten, Wurzelstoß, Dornenfächer, Eichelmörser, ab Phase 2 Rankenwände, Setzlinge, Laubsturm). Phase 1: Flamme an der Glutschale holen, alle 3 Holzstapel anzünden, dann durch den freiliegenden Herzknoten fahren. Ab Phase 2: Seine Wurzeln fangen an brennenden Feuern Feuer und die Flamme läuft zu ihm zurück; er wandert zwischen Baumstümpfen, in Phase 3 wächst die Lichtung zu. Ein Treffer am Kopf ist vorbei; Belohnung Skin **Waldgeist**. Der Schatzhüter gehört jetzt zur Schatzhöhle (Mission 15). Am PC (Querformat) ist jede Mission um 90 Grad gedreht: man spielt von links nach rechts, mit deutlich größeren Feldern. Details: [`docs/SPIELFUNKTIONEN.md`](docs/SPIELFUNKTIONEN.md) 16-0a und 16-0b.

Außerdem: die **Tages-Herausforderung** (alle spielen am selben Tag dasselbe Level, eigener Tab in der Hall of Snakes), drei **Spielmodi** (Abenteuer: 25 % langsamer und 25 % weniger Äpfel, Normal, Speedrun: 25 % schneller mit Zeitlimit je Apfel und 25 % mehr Äpfel, ab Orange 50 % mehr; nur volle Äpfel zählen, der Rest wird zwischengespeichert), **Effekte** (Auren, freigeschaltet mit Silber- und Gold-Trophäen) und die
**Hall of Snakes** (alle Spieler mit Schlange, Rekord, Gold und Silber; zugleich die Bestenliste) mit Freundschaftsanfragen und einem **Chat unter
Freunden** (Nachrichten 30 Tage). Details: [`docs/SPIELFUNKTIONEN.md`](docs/SPIELFUNKTIONEN.md) 16c.

## Spielregeln

Level = gegessene Äpfel + 1. Alle Werte stehen in `src/game/rules.ts`.

**Stufen (seit 1.38, Reihenfolge seit 1.41):** Alles außer den Welt-Gefahren kommt in Stufen: **häufig** (etwa alle 3 Level), **mittel** (etwa alle 8), **selten** (etwa alle 20) oder **aus**. Mauern sind immer häufig. Wiese: Wasser und Frösche häufig, alles andere mittel. Wüste: Palmen, Springmäuse und Feuerameisen häufig. In den anderen Welten ist nur die Mauer häufig. **Neues kommt selten und nacheinander**, damit man nicht überhäuft wird: als Erstes die **Mauern ab Level 5**, dann ab **Level 15 etwa alle 15 Level** eins (erst das Häufige, dann das Mittlere, zuletzt das Seltene; die Tiere der Welt verteilt dazwischen). Was zu nah an einer festen Zeit läge, rückt dahinter. In der Wiese also Mauern 5, Power-ups 10, Wasser 15, Frösche 30, Jägertürme 50, Giftäpfel 65, lila Gegner 75, Igel 90, Bäume 105 … Gegner-Schlangen 225. Feste Zeiten: **Jägertürme ab Level 50**, **ab Level 75 der lila Gegner** (immer nur einer). Die Gefahren der Welten sind je Welt klar von häufig nach selten abgestuft. Im Admin stehen nur noch die Wahrscheinlichkeiten (wann Neues kommt, Stufen je Welt und Ding mit „ab Level“, Gefahren mit Chance je Apfel).

Standardwerte (in `src/game/rules.ts`; die Wahrscheinlichkeiten im Admin änderbar, nur mit Master-Code, siehe `docs/SPIELFUNKTIONEN.md` 16b):

| Ab Level | Was passiert |
|---|---|
| 1 | Zwei Kartenblöcke (je ein halber Bildschirm plus ein Feld in jede Richtung, die Karte ist also etwas größer als der Bildschirm), das **Bild steht still**, bis das erste neue Gebiet dazukommt. **Endlos:** Jede Runde liegt die Welt woanders (Wurzeln, Steine, Erze und Lava im Stein sind neu verteilt), und die Ränder sind nie ganz gerade. Die Schlange wächst **alle 2 Äpfel** ein Glied (ab 50 alle 4, ab 300 alle 6). **Lava im Stein:** In 30 % der Blöcke rund um die Karte steckt ein einzelnes Lavafeld. |
| 5 | **Mauern:** 2 Felder, alle 8 Level eins mehr bis 6, dann eine neue mit 2. Nach jedem Apfel woanders. |
| 15 | Das erste Neue der Welt, danach etwa alle 15 Level das nächste in seiner Stufe: Teiche, Frösche, Giftäpfel, Bäume, Bärenfallen, Hütten (große Häuser 50 Level später), Eis, Giftwolken, Ameisen, rote Gegner-Schlangen und die Tiere der Welt. |
| 10 | **Power-ups** (Schild, Zeitlupe, Geist, Schere, Füttern, Magnet, Spitzhacke). |
| 20 | **Neues Gebiet** alle 20 Level, ab 300 alle 30, ab 500 alle 50: die Wände glühen 30 s, wo ein Block passt; dagegenfahren baut ihn genau dort an, sonst kommt er zufällig. |
| 50 | **Jägertürme** (feste Zeit, danach mittel), **Goldene Schere** (selten), Äpfel ×2 wert. |
| 50 / 53 / 56 / 58 | **Wiese:** je ein **kleiner Steingolem** kündigt den Boss an. |
| 60 | **Wiese:** einmal der **Boss**, der Steingolem mitten auf der Karte (4 Sockel um einen Bannkreis, kein Apfel, bis er besiegt ist: 25 × Apfelwert; ein Treffer am Kopf ist vorbei). Besiegt, zerfallen die kleinen Golems. Dazu ab jetzt **große Tannen** (alle 30 Level, fallen 6 Felder weit). |
| 75 | **Lila Gegner** (feste Zeit): 5 lang, 20 % schneller, immer nur einer. |
| 90 | **Maulwurf** als Power-up. |
| 90 / 93 / 96 / 98 | **Wiese:** je ein **Mini-Ent** kündigt den Ent an (wirft Blätterbomben, packt zu). |
| 100 | **Wiese:** einmal der **Ent** auf einer Lichtung (Glutschale, 3 Holzstapel: brennen alle, liegt sein Herzknoten frei; ein Treffer, 40 × Apfelwert). Besiegt, welken die Mini-Ents. |
| 170 / 230 / 290 | Mindestens 1 / 2 / 3 Ereignisse (Falle, Wolke, Frosch) gleichzeitig. |
| 190 | Alle zufälligen Abstände 1 Level kürzer. |

**Level zurück:** Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war,
danach ist sie gut 2 s geschützt (blinkt). Was schon da ist, bleibt, beim zweiten Erreichen eines
Levels kommt nichts doppelt. Rekord ist der höchste erreichte Level.

**Äpfel als Währung und Aussehen:** Jeder Apfel kommt in den Vorrat, ab Level 50 doppelt so viel wert, ab 100 dreifach usw.
Die Farbe zeigt den Wert: Rot, Orange (×2), Gelb, Grün, Türkis, Blau, Lila, Rosa, Blau→Rosa, Lila→Rosa.
Aussehen mit Farben (auch zwei- und dreifarbig), 45 Skins (dazu die Belohnungen der Welten und der Kampagne), 32 Accessoires und 12 Spuren, dazu sieben Welten: das Ziel-Level einer Welt schaltet die nächste frei (Wiese 60 → Wüstenoase 80 → Winterwald 100 → Bergwerk 110 → Zauberwald 120 → Gruselwald 130 → Vulkan), und jede Welt belohnt mit einem Skin (100), einem Accessoire (150) und einem epischen Skin mit Spur (200). Die Wüste ist eine Insel mit Sandsturm, Flut und Sandwurm. Der Vulkan ist eine Plattform über dem Lava-Abgrund: größere Blöcke, Krater überall, Lava sprudelt hoch. Außerhalb der Karte ist Erde mit Steinen, Kohle,
Skeletten, Lavafeldern, **Golderz (3 ×)**, **Diamant (6 ×)**, **Rubin (10 ×)** und leuchtendem **Opal (20 ×)**. Spätestens nach 8 Äpfeln kommt ein Power-up;
die **Spitzhacke** legt ein zufälliges Erz auf die Karte. **Tagesrekord** und **Erfolge** (Statistik). **Power-ups** ab Level 10: Schild (ein Leben mehr,
läuft nicht ab, bis zu 3, oben rechts angezeigt), Zeitlupe (30 s, −30 %), Geist,
Schere (schneidet dauerhaft ab, was in 3 Leveln gewachsen ist, das Stück liegt noch 1 s), ab Level 50 selten die goldene Schere (8 Level), Füttern (20 s Tiere und Gegner fressen und durch sich selbst), Magnet (15 s, holt alles im
2-Felder-Umkreis sofort), ab Level 90 Maulwurf (20 s durch die Erde graben, ohne Grenze, Warndreieck, wenn du in 2 s umkehren musst,
zurück auf der Karte wird der Gang samt Eingeschlossenem Spielfeld). **Minikarte** unten links, sobald die Karte größer als ein Bildschirm ist:
grün der Block mit der Schlange, in Apfelfarbe der Block mit dem Apfel.

**Kreativ-Modus** (nur im Admin-Zugang: Stift oben rechts im Startmenü oder Admin → Kreativ-Modus): Welt wählen (jede, auch ohne Freischaltung),
Level einstellen (die Welt wird passend aufgebaut), an- und abschalten, was kommen kann (Mauern, Power-ups, alle Dinge und Tiere der Welt,
lila Gegner, die Gefahren der Welt), dann „Spielen“. Zählt nicht für den Rekord und die Online-Bestenliste, Äpfel gibt es dort keine.

**Kamera** (es gibt nur noch eine): Bis zum ersten neuen Gebiet steht das Bild still. **Bereich** hat einen festen Ausschnitt, lehnt sich ab der Mittellinie zu
Öffnungen hinüber (je näher, desto mehr, an der Schwelle halb im neuen Bereich, auch um die Ecke und hinter Erde),
zieht wie ein Gummiseil in die Laufrichtung und hält zu jeder Seite mit Karte mindestens 5 ganze Felder Abstand zum
Bildrand. Die Kamera zeigt je Richtung 2 Felder mehr als ein Bildschirm.

Genauer Bericht über alle Funktionen: [`docs/SPIELFUNKTIONEN.md`](docs/SPIELFUNKTIONEN.md).

Neue Hindernisse schließen nie Bereiche ab und bauen keine Sackgassen; Mauern entstehen nie
direkt vor dem Kopf. Gegen jedes Hindernis (auch Rand und Mauern) ist es vorbei, nach nur 10 ms Reaktionszeit:
wer in diesem Moment noch abbiegt, ist gerettet.

**Steuerung:** ein Fingermodus: wischen, auch mehrmals ohne abzusetzen (Finger liegen lassen und weiterziehen;
ab 18 px und höchstens 32° schräg). Unten links ein kleiner Pause-Knopf.

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Spiellogik (vitest)
npm run build      # Web-App nach dist/
npm run android    # build + Capacitor-Sync, danach android/ in Android Studio öffnen
npm run icons      # Icons und Startbild aus scripts/icons.mjs neu erzeugen
npm run server     # Snake-Server lokal (http://localhost:8787), dann VITE_SNAKE_SERVER=http://localhost:8787 npm run dev
npm run vapid      # Schlüsselpaar für Push-Einladungen erzeugen (siehe docs/MEHRSPIELER-EINRICHTEN.md)
npm run skin-videos # Shop-Vorschauen neu als Videos rendern (nur nach Änderungen am Aussehen; braucht ffmpeg und Playwright)
```

Zum Ausprobieren später Level: Kreativ-Modus im Spiel, oder in der Web-Fassung `?level=150`
(startet bei Level 150) und `?auto=1` (Autopilot steuert).

### Aufbau

- `src/game/` Spiellogik ohne Darstellung (`game.ts`, Regeln in `rules.ts`, Autopilot für Startmenü und Tests)
- `src/render/` Canvas: Kamera, Schachbrett, Schlange (`renderer.ts`), Zeichnungen (`sprites.ts`). Fester Boden (Erde, Schachbrett,
  Grasrand) kommt aus vorgerenderten Kacheln, Mauersteine und liegende Bäume aus Einzelbildern; nur Bewegtes wird jedes Bild gezeichnet
- `public/skins/` Shop-Vorschauen: Standbild (WebP) für jede Farbe, jeden Skin, jedes Accessoire und jede Spur, bewegte zusätzlich als kurzes Video (MP4 und WebM), erzeugt von `scripts/skin-videos.mjs`
- `src/audio.ts` alle Töne und die Musik per Web Audio, keine Dateien
- `src/main.ts` Menüs, Spielschleife, Speicher (Rekord und Statistik im Gerät)
- `src/online.ts` Bestenliste über Supabase (optional, nur mit Zugangsdaten beim Bauen), `src/update.ts` Update-Hinweis der Android-App
- `supabase/migrations/` Datenbank der Bestenliste (Tabellen, Regeln, Schummelschutz)
- `src/game/mehr.ts` Mehrspieler-Logik (mehrere Schlangen, Leben, Abstand, Gebiete), `src/game/zustand.ts` Spielstand verschicken und übernehmen
- `src/multi/` Mehrspieler in der App (Verbindung, Lobby, Anzeige) und das gemeinsame Protokoll
- `server/` Snake-Server auf Cloudflare Workers (`raum.ts` sind die Regeln, testbar ohne Cloudflare; `push.ts` Web Push ohne Bibliothek)
- `src/tages.ts` Tages-Herausforderung, `src/push.ts` und `public/push-sw.js` Push-Einladungen
- `android/` Capacitor-Projekt (Hochformat, Vollbild)

### Signierte Release-APK

Ohne weitere Einstellungen baut GitHub eine Debug-APK, signiert mit dem festen Schlüssel
`android/app/debug.keystore`: neue Fassungen lassen sich einfach über die alte installieren.
Für eine echte Release-APK (z. B. später für Google Play) einen eigenen Keystore
anlegen (`keytool -genkey -v -keystore snake.keystore -alias snake -keyalg RSA -keysize 2048 -validity 10000`)
und als Repository-Secrets eintragen: `ANDROID_KEYSTORE_BASE64` (Datei als Base64),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Schriften: Newsreader und Libre Franklin (SIL Open Font License, Lizenzen in `src/fonts/`).
