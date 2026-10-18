# Snake Endlos

Snake im Endlos-Modus, als Web-App (PWA, installierbar und offline) und als Android-App.
Grundlage ist das Snake aus dem Hero-Telefon von topsichtbar.de (weicher Takt,
gepufferte Eingaben, Sofort-Wende, Mauern Feld für Feld, Teiche).

## Herunterladen

- **Android:** unter *Releases → latest* `snake-endlos.apk` auf dem Handy öffnen und installieren
  (einmalig „Installation aus unbekannten Quellen“ erlauben). Jeder Push baut die APK neu
  (*Actions → Android-APK*, auch als Artefakt).
- **Web/iPhone:** über GitHub Pages (einmalig in *Settings → Pages* die Quelle „GitHub Actions“
  wählen). Im Browser „Zum Home-Bildschirm“ macht daraus eine App im Vollbild.

## Online-Bestenliste und Updates

Mit Supabase (kostenlos) gibt es eine Bestenliste „Heute / Für immer“ mit Namen und Live-Aktualisierung.
Einrichtung Schritt für Schritt: [`docs/ONLINE-EINRICHTEN.md`](docs/ONLINE-EINRICHTEN.md). Ohne Einrichtung läuft das
Spiel unverändert, nur ohne den Menüpunkt. Die Web-App aktualisiert sich bei jedem Merge von selbst, die Android-App
weist auf dem Startbildschirm auf eine neuere APK hin. Geplanter Ausbau (Mehrspieler): [`docs/MULTIPLAYER-PLAN.md`](docs/MULTIPLAYER-PLAN.md).

## Spielregeln

Level = gegessene Äpfel + 1. Alle Werte stehen in `src/game/rules.ts`.

Standardwerte (alle in den **Master-Einstellungen** im Spiel änderbar):

| Ab Level | Was passiert |
|---|---|
| 1 | Zwei Kartenblöcke (je ein halber Bildschirm plus ein Feld in jede Richtung, die Karte ist also etwas größer als der Bildschirm), das **Bild steht still**, bis das erste neue Gebiet dazukommt. Die Schlange wächst **alle 2 Äpfel** ein Glied (ab 50 alle 4, ab 300 alle 6). **Lava im Stein:** In 30 % der Blöcke rund um die Karte steckt ein einzelnes Lavafeld, man sieht es in der Erde. |
| 5 | **Mauern:** 2 Felder, alle 8 Level eins mehr bis 6, dann eine neue mit 2. Nach jedem Apfel woanders. |
| 10 | **Power-ups** (Schild, Zeitlupe, Geist, Schere, Füttern, Magnet, Spitzhacke). |
| 15 | **Teiche:** alle 15 Level einer, bleibt liegen, wird langsam größer (2, 2, 3, 3 … bis 12). |
| 20 | **Neues Gebiet** alle 20 Level, ab 300 alle 30, ab 500 alle 50: die Wände glühen 30 s (die letzten 5 blinken), wo ein Block passt; dagegenfahren baut ihn genau dort an, sonst kommt er zufällig. Steckt im Block Lava, bricht sie als Lavasee aus (wächst jeden 2. Apfel um eins bis 6–15 Felder, tödlich). |
| 30 | **Frösche** (alle 1–3 Level, höchstens 6): hüpfen alle 3 s, 1 s Anlauf, 20 % Richtungswechsel nach der Landung, nie in die Schlange. |
| 40 | **Giftäpfel** mit verschimmelter Ecke: essen = Spielende (2 ab 110, 3 ab 180, 4 ab 250). |
| 50 | **Goldene Schere** (selten), Äpfel ×2 wert. |
| 60 | **Bäume** alle 40 Level: stehen erst als Plus, kippen nach 10–60 s langsam um (nie auf die Schlange, sie kann sie aufhalten) und liegen dann 1-1-3-1. |
| 70 | **Bärenfallen** 5 bis 8 Felder vor dem Kopf (alle 4 bis 5 Level). |
| 80 | **Hütten** (2 × 2) alle 30 Level, ab 130 große Häuser. Licht immer 2 Felder tief, Licht = **5 Level zurück**. |
| 90 | **Maulwurf** als Power-up. |
| 100 | **Gegner-Schlangen** (rot, 3–4 lang, halb so schnell), **selten**: alle 30–45 Level eine, höchstens 1 (ab 200: 2). Bei Mauern, Bäumen, Häusern schlau, bei der Schlange langsam: Läuft eine auf die Schlange zu, braucht sie 2 Felder zum Reagieren, baut sich die Schlange gerade vor ihr auf, 4 Felder. Sonst rast sie hinein, zerplatzt und bringt Äpfel. |
| 110 | **Giftwolken**, wachsen alle 5 s. Hinein = **10 Level zurück**. |
| 120 | **Eis** (4–10 Felder) alle 30 Level, bleibt; darauf kann man nicht lenken. |
| 130 | **Große Häuser** (2 × 3 oder mit Ecke) statt Hütten, vier Fenster, Licht 2 Felder (nie auf die Schlange, kein Platz = dunkel). Haus = Tod. |
| 140 | **Ameisen** chillen, kommen im 2-Felder-Umkreis langsam auf dich zu, Biss −3 Level, der Kopf zertritt sie. |
| 150 | **Lila Gegner** (25 % der neuen): 5 lang, 20 % schneller, noch böser. |
| 160 | **Jägertürme** (2 × 2) alle 40 Level, Lichtkegel 2 × 6, dreht jede Runde im Uhrzeigersinn, Schlange wirft Schatten. Turm = Tod, Kegel = **10 Level zurück**. Giftwolken größer (wieder bei 210, 260). |
| 170 / 230 / 290 | Mindestens 1 / 2 / 3 Ereignisse (Falle, Wolke, Frosch) gleichzeitig. |
| 190 | Alle zufälligen Abstände 1 Level kürzer. |

**Level zurück:** Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war,
danach ist sie gut 2 s geschützt (blinkt). Was schon da ist, bleibt, beim zweiten Erreichen eines
Levels kommt nichts doppelt. Rekord ist der höchste erreichte Level.

**Äpfel als Währung und Skins:** Jeder Apfel kommt in den Vorrat, ab Level 50 doppelt so viel wert, ab 100 dreifach usw.
Die Farbe zeigt den Wert: Rot, Orange (×2), Gelb, Grün, Türkis, Blau, Lila, Rosa, Blau→Rosa, Lila→Rosa.
Vier Grundfarben gratis, 27 weitere Skins in 7 Preisstufen (250 bis 9000 Äpfel). Außerhalb der Karte ist Erde mit Steinen, Kohle,
Skeletten, Lavafeldern, **Golderz (3 ×)**, **Diamant (6 ×)**, **Rubin (10 ×)** und leuchtendem **Opal (20 ×)**. Spätestens nach 8 Äpfeln kommt ein Power-up;
die **Spitzhacke** legt ein zufälliges Erz auf die Karte. **Tagesrekord** und **Erfolge** (Statistik). **Power-ups** ab Level 10: Schild (ein Leben mehr,
läuft nicht ab, bis zu 3, oben rechts angezeigt), Zeitlupe (30 s, −30 %), Geist,
Schere (schneidet dauerhaft ab, was in 3 Leveln gewachsen ist, das Stück liegt noch 1 s), ab Level 50 selten die goldene Schere (8 Level), Füttern (20 s Tiere und Gegner fressen und durch sich selbst), Magnet (15 s, holt alles im
2-Felder-Umkreis sofort), ab Level 90 Maulwurf (20 s durch die Erde graben, ohne Grenze, Warndreieck, wenn du in 2 s umkehren musst,
zurück auf der Karte wird der Gang samt Eingeschlossenem Spielfeld). **Minikarte** unten links, sobald die Karte größer als ein Bildschirm ist:
grün der Block mit der Schlange, in Apfelfarbe der Block mit dem Apfel.

**Kreativ-Modus:** Startlevel (Welt wird passend aufgebaut), Hindernisse tödlich / anhalten / Geist,
Rückschläge an/aus, durch die eigene Schlange, Wachsen oder feste Länge, im Spiel Level springen und
jedes Objekt dazutun. **Sandbox:** Kartengröße, Länge und Objekte selbst wählen, Welt bleibt so oder geht
normal weiter. Zählt nicht für den Rekord.

**Kamera** (Optionen): Bis zum ersten neuen Gebiet steht das Bild still. **Bereich** (Standard) hat einen festen Ausschnitt, lehnt sich ab der Mittellinie zu
Öffnungen hinüber (je näher, desto mehr, an der Schwelle halb im neuen Bereich, auch um die Ecke und hinter Erde),
zieht wie ein Gummiseil in die Laufrichtung und hält zu jeder Seite mit Karte mindestens 5 ganze Felder Abstand zum
Bildrand. **Dynamisch** fliegt wie eine Drohne hinterher. Die Kamera zeigt je Richtung 2 Felder mehr als ein Bildschirm. **Master-Einstellungen:** oben eine Zeitleiste, was bei welchem Level kommt (aus den aktuellen Zahlen).

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
```

Zum Ausprobieren später Level: Kreativ-Modus im Spiel, oder in der Web-Fassung `?level=150`
(startet bei Level 150) und `?auto=1` (Autopilot steuert).

### Aufbau

- `src/game/` Spiellogik ohne Darstellung (`game.ts`, Regeln in `rules.ts`, Autopilot für Startmenü und Tests)
- `src/render/` Canvas: Kamera, Schachbrett, Schlange (`renderer.ts`), Zeichnungen (`sprites.ts`)
- `src/audio.ts` alle Töne und die Musik per Web Audio, keine Dateien
- `src/main.ts` Menüs, Spielschleife, Speicher (Rekord und Statistik im Gerät)
- `src/online.ts` Bestenliste über Supabase (optional, nur mit Zugangsdaten beim Bauen), `src/update.ts` Update-Hinweis der Android-App
- `supabase/migrations/` Datenbank der Bestenliste (Tabellen, Regeln, Schummelschutz)
- `android/` Capacitor-Projekt (Hochformat, Vollbild)

### Signierte Release-APK

Ohne weitere Einstellungen baut GitHub eine Debug-APK, signiert mit dem festen Schlüssel
`android/app/debug.keystore`: neue Fassungen lassen sich einfach über die alte installieren.
Für eine echte Release-APK (z. B. später für Google Play) einen eigenen Keystore
anlegen (`keytool -genkey -v -keystore snake.keystore -alias snake -keyalg RSA -keysize 2048 -validity 10000`)
und als Repository-Secrets eintragen: `ANDROID_KEYSTORE_BASE64` (Datei als Base64),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Schriften: Newsreader und Libre Franklin (SIL Open Font License, Lizenzen in `src/fonts/`).
