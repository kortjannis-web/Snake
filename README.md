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

## Spielregeln

Level = gegessene Äpfel + 1. Alle Werte stehen in `src/game/rules.ts`.

Standardwerte (alle in den **Master-Einstellungen** im Spiel änderbar):

| Ab Level | Was passiert |
|---|---|
| 1 | Ein Bildschirm = zwei Kartenblöcke. Äpfel essen, die Schlange wächst (ab 50 jedes zweite, ab 300 jedes dritte Level). |
| 8 | **Mauern:** 2 Felder, alle 8 Level eins mehr bis 6, dann eine neue mit 2. Nach jedem Apfel woanders. |
| 15 | **Teiche:** alle 15 Level einer, bleibt liegen, wird langsam größer (2, 2, 3, 3 … bis 12). |
| 20 | **Neues Gebiet** alle 20 Level, ab 300 alle 30, ab 500 alle 50: die Wände glühen 30 s (die letzten 5 blinken), wo ein Block passt; dagegenfahren baut ihn genau dort an, sonst kommt er zufällig. |
| 45 | **Giftäpfel** mit verschimmelter Ecke: essen = Spielende. |
| 55 | **Gegner-Schlangen** (rot, 3–4 lang, halb so schnell) ab und zu, weichen aus, eingekesselt zerplatzen sie und bringen Äpfel, werden mit der Zeit länger (höchstens 1 / 2 / 3 ab Level 55 / 155 / 255). Schiebt man sich bis 3 Felder vor sie, lenken sie nicht mehr rechtzeitig und zerplatzen an der Schlange. |
| 90 | **Bärenfallen** 5 bis 8 Felder vor dem Kopf (alle 4 bis 5 Level). **Bäume** (liegende Tanne 1-1-3-1, symmetrisch) alle 40 Level, bleiben. **Maulwurf** als Power-up. |
| 100 | **Hütten** (2 × 2, Licht 1 Feld) alle 30 Level, ab 190 große Häuser. Das nächste Neue nach dem Baum. |
| 110 | **Lila Gegner** (25 % der neuen): 5 lang, 20 % schneller, noch böser. |
| 135 | **Giftwolken**, wachsen alle 5 s. Hinein = **10 Level zurück**. |
| 165 | **Eis** (4–10 Felder) alle 30 Level, bleibt; darauf kann man nicht lenken. |
| 180 | **Frösche** (höchstens 6): hüpfen alle 3 s, 1 s Anlauf, 20 % Richtungswechsel nach der Landung, nie in die Schlange. |
| 190 | **Große Häuser** (2 × 3 oder mit Ecke) statt Hütten, vier Fenster, Licht 2 Felder (nie auf die Schlange, zugebaut = dunkel). Haus = Tod, Licht = **5 Level zurück**. |
| 215 | **Ameisen** chillen, kommen im 2-Felder-Umkreis langsam auf dich zu, Biss −3 Level, der Kopf zertritt sie. |
| 245 | **Lava**: alle 30 Level ein See, beginnt mit 1 Feld, wächst jeden 2. Apfel um eins, hört bei 6–15 auf. Tödlich. |
| 285 | **Jägertürme** (2 × 2) alle 40 Level, Lichtkegel 2 × 6, dreht jede Runde im Uhrzeigersinn, Schlange wirft Schatten. Turm = Tod, Kegel = **10 Level zurück**. |
| 150 / 200 / 300 | Mindestens 1 / 2 / 3 Ereignisse (Falle, Wolke, Frosch) gleichzeitig. |

**Level zurück:** Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war,
danach ist sie gut 2 s geschützt (blinkt). Was schon da ist, bleibt, beim zweiten Erreichen eines
Levels kommt nichts doppelt. Rekord ist der höchste erreichte Level.

**Äpfel als Währung und Skins:** Jeder Apfel kommt in den Vorrat, ab Level 50 doppelt so viel wert, ab 100 dreifach usw.
Die Farbe zeigt den Wert: Rot, Orange (×2), Gelb, Grün, Türkis, Blau, Lila, Rosa, Blau→Rosa, Lila→Rosa.
Vier Grundfarben gratis, 27 weitere Skins in 7 Preisstufen (250 bis 9000 Äpfel). Außerhalb der Karte ist Erde mit Steinen, Kohle,
Skeletten, Lava, **Golderz (3 ×)**, **Diamant (6 ×)**, **Rubin (10 ×)** und leuchtendem **Opal (20 ×)**. Spätestens nach 8 Äpfeln kommt ein Power-up;
die **Spitzhacke** legt ein zufälliges Erz auf die Karte. **Tagesrekord** und **Erfolge** (Statistik). **Power-ups** ab Level 9: Schild (ein Leben mehr,
läuft nicht ab, bis zu 3, oben rechts angezeigt), Zeitlupe (30 s, −30 %), Geist,
Schere (5 Glieder weg, nur bis zum nächsten Apfel), Füttern (20 s Tiere und Gegner fressen und durch sich selbst), Magnet (15 s, holt alles im
2-Felder-Umkreis sofort), ab Level 90 Maulwurf (20 s durch die Erde graben,
zurück auf der Karte wird der Gang samt Eingeschlossenem Spielfeld). **Minikarte** unten links, sobald die Karte größer als ein Bildschirm ist:
grün der Block mit der Schlange, in Apfelfarbe der Block mit dem Apfel.

**Kreativ-Modus:** Startlevel (Welt wird passend aufgebaut), Hindernisse tödlich / anhalten / Geist,
Rückschläge an/aus, durch die eigene Schlange, Wachsen oder feste Länge, im Spiel Level springen und
jedes Objekt dazutun. **Sandbox:** Kartengröße, Länge und Objekte selbst wählen, Welt bleibt so oder geht
normal weiter. Zählt nicht für den Rekord.

**Kamera** (Optionen): **Fest** klebt immer am Kopf der Schlange. **Dynamisch** (Standard) fliegt wie eine Drohne
hinterher: an einer weichen Feder knapp vor dem Kopf, beim Abbiegen in lockeren Bögen statt Ecken. **Master-Einstellungen:** oben eine Zeitleiste, was bei welchem Level kommt (aus den aktuellen Zahlen).

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
- `android/` Capacitor-Projekt (Hochformat, Vollbild)

### Signierte Release-APK

Ohne weitere Einstellungen baut GitHub eine Debug-APK, signiert mit dem festen Schlüssel
`android/app/debug.keystore`: neue Fassungen lassen sich einfach über die alte installieren.
Für eine echte Release-APK (z. B. später für Google Play) einen eigenen Keystore
anlegen (`keytool -genkey -v -keystore snake.keystore -alias snake -keyalg RSA -keysize 2048 -validity 10000`)
und als Repository-Secrets eintragen: `ANDROID_KEYSTORE_BASE64` (Datei als Base64),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Schriften: Newsreader und Libre Franklin (SIL Open Font License, Lizenzen in `src/fonts/`).
