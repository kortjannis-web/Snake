# Snake Endlos

Snake im Endlos-Modus, als Web-App (PWA, installierbar und offline) und als Android-App.
Grundlage ist das Snake aus dem Hero-Telefon von topsichtbar.de (weicher Takt,
gepufferte Eingaben, Sofort-Wende, Gnadenschritt, Mauern Feld für Feld, Teiche).

## Herunterladen

- **Android:** unter *Releases → latest* `snake-endlos.apk` auf dem Handy öffnen und installieren
  (einmalig „Installation aus unbekannten Quellen“ erlauben). Jeder Push baut die APK neu
  (*Actions → Android-APK*, auch als Artefakt).
- **Web/iPhone:** über GitHub Pages (einmalig in *Settings → Pages* die Quelle „GitHub Actions“
  wählen). Im Browser „Zum Home-Bildschirm“ macht daraus eine App im Vollbild.

## Spielregeln

Level = gegessene Äpfel + 1. Alle Werte stehen in `src/game/rules.ts`.

| Ab Level | Was passiert |
|---|---|
| 1 | Ganzer Bildschirm, Äpfel essen, die Schlange wächst (ab 50 nur jedes zweite, ab 300 jedes dritte Level). Tempo steigt leicht bis ca. Level 270. |
| 8 | **Mauern:** eine Mauer mit 2 Feldern, alle 8 Level ein Feld länger. Bei 6 Feldern kommt eine neue Mauer dazu, die wieder mit 2 anfängt (Level 48: 6 + 2, Level 88: 6 + 6 + 2 …). Nach jedem Apfel stehen sie woanders. Höchstens eine Mauer je ca. 130 Felder. |
| 15 | **Teiche:** alle 15 Level ein neuer Teich, der liegen bleibt. Größe 2, 2, 3, 3, 4, 4 … bis 12. Sind es zu viele für die Karte, trocknet der älteste aus. |
| 30 | **Neues Gebiet:** alle 30 Level wächst die Karte in eine zufällige Richtung um genau einen halben Bildschirm (immer gleiche Fläche, die Karte bleibt ein Rechteck). Ab Level 300 nicht mehr. Die Kamera folgt der Schlange, ein Pfeil am Rand zeigt den Apfel. |
| 50 | **Giftäpfel:** sehen aus wie Äpfel, eine Ecke ist verschimmelt. Essen = Spielende. 1 bis 4 Stück, liegen nach jedem Apfel woanders. |
| 100 | **Bärenfallen:** alle 4 bis 5 Level (ab 200 alle 3 bis 4) eine Falle 5 bis 8 Felder vor dem Kopf, genau in der Laufbahn. Bleibt 25 s. |
| 150 | **Giftwolken:** alle 5 bis 7 Level (ab 250 alle 4 bis 6). Erst ein Feld, alle 5 s größer: Kreuz, 3 × 3, 3 × 3 mit Spitzen, 5 × 5 … (größte Stufe steigt mit dem Level), 1 s vorher pulsiert die nächste Stufe. Danach 5 s stehen, dann löst sie sich auf. |
| 200 | **Ameisen:** alle 6 bis 9 Level (ab 250 alle 5 bis 7). Laufen alle 3 s ein Feld geradeaus (ab 300 alle 2,4 s), biegen vor Hindernissen ab, warten vor der Schlange, klauen Äpfel und verschwinden am Rand. |
| 150 / 200 / 300 | Mindestens 1 / 2 / 3 Gefahren (Falle, Wolke, Ameise) gleichzeitig unterwegs. |

Neue Hindernisse schließen nie Bereiche ab und bauen keine Sackgassen; Mauern entstehen nie
direkt vor dem Kopf. Läuft die Schlange gegen ein Hindernis, bleibt sie gut einen Takt stehen
und kann noch abbiegen (Gnadenschritt).

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Spiellogik (vitest)
npm run build      # Web-App nach dist/
npm run android    # build + Capacitor-Sync, danach android/ in Android Studio öffnen
npm run icons      # Icons und Startbild aus scripts/icons.mjs neu erzeugen
```

Zum Ausprobieren später Level: `?level=150` startet direkt bei Level 150,
`?auto=1` lässt den Autopiloten steuern.

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
