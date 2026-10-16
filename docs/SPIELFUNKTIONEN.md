# Snake Endlos: alle Spielfunktionen

Stand: Version 1.1.0 (16.10.2026). Alle Zahlen stehen an einer Stelle in `src/game/rules.ts`.

## 1. Grundprinzip

- **Ein Modus: Endlos.** Kein Ziel, es geht so lange, bis die Schlange stirbt.
- **Level = gegessene Äpfel + 1.** Jeder Apfel ist ein Level.
- **Start:** Die Karte ist genau ein Bildschirm groß, die Schlange ist 3 Glieder lang und läuft nach rechts. Das Spiel wartet, bis man wischt (Handy) oder eine Pfeiltaste drückt (PC).
- **Feldgröße:** Ein Bildschirm hat immer ca. 300 Felder, egal welches Gerät (Handy hochkant z. B. 12 × 23). So spielt es sich überall gleich.
- **Wachsen:** bis Level 50 bei jedem Apfel ein Glied mehr, bis Level 300 bei jedem zweiten, danach bei jedem dritten. Sonst wäre die Schlange auf Dauer länger als die Karte.
- **Tempo:** Grundtakt je nach Einstellung 185 / 154 / 128 ms pro Feld (Langsam / Normal / Schnell). Mit jedem Level etwas schneller, ab ca. Level 270 bleibt es bei 68 % des Grundtakts.

## 2. Steuerung

- **Handy:** Wischen auf dem ganzen Bildschirm. Mehrere Richtungen in einem Wisch gehen (Finger nicht absetzen).
- **PC:** Pfeiltasten oder WASD. Esc oder P = Pause, Enter oder Leertaste startet nach dem Spielende neu.
- **Steuerkreuz (Option):** vier Tasten unter dem Spielfeld statt Wischen.
- **Eingabepuffer:** Bis zu drei schnelle Richtungswechsel werden gemerkt und nacheinander ausgeführt.
- **Sofort-Wende:** Kommt ein Richtungswechsel im ersten Drittel eines Schritts, gilt er sofort und nicht erst ab dem nächsten Feld. Das fühlt sich direkter an.
- **Gnadenschritt** (wie bei Google Snake): Läuft die Schlange gegen ein Hindernis, bleibt sie gut einen Takt (1,3) stehen. Wer dann abbiegt, lebt weiter. Erst der zweite Anlauf ist das Ende. Gilt für Rand, eigenen Körper, Mauer, Teich, Falle, Ameise, Baum und Haus, **nicht** für Giftäpfel (die isst man ja).

## 3. Äpfel

- Roter Apfel mit Stiel, Blatt und Glanz, ploppt beim Erscheinen auf und wippt leicht.
- Liegt nie unter der Schlange, in einem Hindernis, in einer Sackgasse, im Fensterlicht oder dort, wo eine Giftwolke gleich hinwächst. Er ist immer erreichbar.
- Auf großen Karten liegt er meist in Reichweite (höchstens ca. ein Bildschirm entfernt).
- **Pfeil am Rand:** Liegt der Apfel außerhalb des Bildes, zeigt ein runder Pfeil mit Apfel am Bildrand die Richtung.
- Beim Essen: Funken, Knackgeräusch (innerhalb eines Zehnerblocks steigt der Ton leicht an), leichte Vibration. Alle 10 Level ein kleiner Akkord.

## 4. Karte und neue Gebiete

- **Alle 30 Level** (30, 60, … 270) wächst die Karte in eine **zufällige Richtung** (oben, unten, links oder rechts).
- Es kommt immer **genau ein halber Bildschirm Fläche** dazu. Die Karte bleibt ein Rechteck: Ist sie schon zwei Bildschirme breit, wird ein Streifen nach oben nur einen Viertelbildschirm hoch, aber dafür doppelt so breit. Die Fläche ist also immer gleich.
- **Ab Level 300** wächst die Karte nicht mehr (9 Erweiterungen, insgesamt 5,5 Bildschirme).
- Das neue Gebiet klappt als Welle Feld für Feld auf, der Rahmen wächst mit, dazu ein „Whoosh“ mit Akkord und der Hinweis „Neues Gebiet: Die Karte ist nach links gewachsen“ mit Pfeil.
- **Kamera:** Ist die Karte größer als der Bildschirm, folgt die Kamera weich der Schlange und schaut etwas voraus. Am Kartenrand bleibt sie stehen.
- Der dünne Balken unter der Leiste zeigt, wie weit es noch bis zum nächsten Gebiet ist.

## 5. Mauern (ab Level 8)

- Ab Level 8 steht eine **Mauer mit 2 Feldern**. Alle 8 Level wird sie ein Feld länger: 2, 3, 4, 5, 6.
- Ist sie 6 lang, kommt eine **zweite Mauer** dazu, die wieder mit 2 anfängt (Level 48: 6 + 2). Dann wächst die neue bis 6, dann kommt die dritte (Level 88: 6 + 6 + 2) und so weiter.
- **Nach jedem Apfel** verschwinden die Mauern und tauchen woanders neu auf (Feld für Feld, fast sofort).
- Ab 3 Feldern können sie einen Knick haben (Chance steigt mit der Länge: 20 %, 40 %, 60 %, 75 %).
- Wie viele Mauern gleichzeitig Platz haben, hängt an der Kartengröße (ungefähr eine je 130 Felder). Bei Level 300 sind es ca. 8 bis 11.
- Mauern entstehen nie direkt vor dem Kopf (Streifen in Laufrichtung), mindestens 5 Felder vom Kopf und 2 vom Körper entfernt, mit einem Feld Luft zu anderen Hindernissen.

## 6. Teiche (ab Level 15)

- Alle 15 Level entsteht ein Teich und **bleibt liegen**.
- Größe steigt langsam: 2, 2, 3, 3, 4, 4, 5 … bis 12 Felder, als zusammenhängende Wasserfläche mit Ufer und Wellen.
- Sind mehr Teiche da, als die Karte verträgt (ca. einer je 220 Felder, mindestens 2), trocknet der älteste aus.

## 7. Giftäpfel (ab Level 50)

- Sehen aus wie normale Äpfel, sind aber **an einer Ecke verschimmelt** (brauner Faulfleck mit graugrünem Schimmel und hellem Flaum). Daran erkennt man sie.
- **Essen = sofort Spielende** (kein Gnadenschritt). Die Schlange färbt sich dabei kränklich.
- Anzahl: 1 ab Level 50, dann alle 60 Level einer mehr, höchstens 4.
- Liegen nach jedem Apfel woanders, einer davon gern in der Nähe des echten Apfels. Nie direkt vor dem Kopf (6 Felder in Laufrichtung frei).

## 8. Bärenfallen (ab Level 100)

- Etwa **alle 4 bis 5 Level** (ab Level 200 alle 3 bis 4) erscheint eine Falle **genau in der Bahn**, in die die Schlange gerade läuft, **5 bis 8 Felder vor dem Kopf**.
- Metallischer Klack beim Erscheinen, orangener Warnring, sie pulsiert kurz.
- Bleibt 25 Sekunden, blinkt in den letzten 3 Sekunden und schnappt dann zu.
- Hineinlaufen = Tod (mit Gnadenschritt).

## 9. Bäume (ab Level 100)

- Ein **umgefallener Tannenbaum**, 5 Felder: **1-1-2-1** entlang seiner Richtung, also zwei Felder Stamm, dann die Krone zwei Felder breit, dann die Spitze. Die Krone ist das Dreieck, der Stamm hat eine Schnittfläche mit Jahresringen.
- Ab Level 100 **alle 40 Level ein neuer** (100, 140, 180, 220 …). Er **bleibt für immer** liegen.
- Liegt in zufälliger Richtung und Ausrichtung, mit Abstand zur Schlange, nie vor dem Kopf, schließt nie einen Bereich ab.
- Höchstens einer je ca. 150 Felder. Ist die Karte voll, kommt keiner mehr dazu.
- Berühren = Tod (mit Gnadenschritt). Dumpfer Schlag mit Rascheln, wenn er fällt.

## 10. Giftwolken (ab Level 150)

- Etwa **alle 5 bis 7 Level** (ab Level 250 alle 4 bis 6) entsteht eine Wolke auf einem Feld.
- **Alle 5 Sekunden wird sie größer:** 1 Feld → Kreuz (Feld oben, unten, links, rechts dazu) → 3 × 3 (die Ecken dazu) → 3 × 3 mit Spitzen → 5 × 5 → 5 × 5 mit Spitzen.
- Wie groß sie maximal wird, steigt mit dem Level: bis 3 × 3 (Level 150), mit Spitzen (200), 5 × 5 (250), 5 × 5 mit Spitzen (300).
- **1 Sekunde vor dem Wachsen** pulsieren gestrichelte Kreise dort, wo sie gleich hinwächst. Zischgeräusch.
- Nach der größten Stufe bleibt sie 5 Sekunden und löst sich dann auf.
- Wächst sie auf die Schlange, kommen diese Felder erst dazu, wenn die Schlange weg ist. Den Apfel schiebt sie woanders hin, Giftäpfel verschwinden darin.
- **Hineingeraten = 10 Level zurück** (siehe Rückschläge).

## 11. Ameisen (ab Level 200)

- Etwa **alle 6 bis 9 Level** (ab Level 250 alle 5 bis 7) krabbelt eine Ameise aus der Erde.
- Sie schaut in eine Richtung und läuft **alle 3 Sekunden ein Feld geradeaus** (ab Level 300 alle 2,4 s), mit Beinbewegung und Fühlern.
- Vor Mauern, Teichen, Fallen, Bäumen, Häusern und Giftäpfeln biegt sie ab. Steht die Schlange im Weg, wartet sie.
- Läuft sie über den Apfel, **klaut sie ihn** (er liegt dann woanders, Hinweis „Apfel geklaut!“).
- **Am Rand verschwindet sie.**
- Hineinbeißen = Tod (mit Gnadenschritt).

## 12. Häuser (ab Level 210)

- Zwei Formen: **2 × 3 Felder** oder **mit einer Ecke** (Reihen 2, 2, 3, 3 Felder, also 10 Felder). Zufällig gedreht und gespiegelt.
- Ab Level 210 **alle 30 Level ein neues** (210, 240, 270 …). Es **bleibt stehen**. Höchstens eins je ca. 250 Felder.
- Von oben gesehen: Ziegeldach, Kamin mit Rauch.
- **Vier Fenster**, eins an jeder Seite (oben, unten, links, rechts).
- **Nach jedem Apfel wechselt das Licht:** In jedem Haus leuchtet dann ein anderes Fenster gelb. Das Licht strahlt **2 Felder weit** nach außen (endet früher am Kartenrand, an einem Haus oder Baum). Das Spiel nimmt möglichst ein Fenster, dessen Licht nicht direkt vor dem Kopf liegt.
- **Haus berühren = Tod** (mit Gnadenschritt).
- **Ins Licht laufen = 5 Level zurück.**

## 13. Rückschläge (Giftwolke −10, Fensterlicht −5)

- Nur der **Kopf** zählt. Ein Rückschlag beendet das Spiel nicht.
- Level sinkt um 10 bzw. 5 (nie unter 1). Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war (mindestens 3 lang). Das Tempo passt sich dem neuen Level an.
- Danach ist die Schlange **gut 2 Sekunden geschützt** und blinkt, damit sie aus der Wolke oder dem Licht herauskommt.
- Absteigende Töne, kräftige Vibration, Bildschirm wackelt kurz, die Levelzahl springt rot nach unten, Hinweis „−10 Level“.
- Was schon da ist, bleibt: Karte, Teiche, Bäume, Häuser. Beim zweiten Erreichen eines Levels kommt nichts doppelt (kein zweites neues Gebiet, kein zweiter Teich, Baum oder Haus, keine Hinweise noch einmal).
- Als **Rekord** zählt der höchste erreichte Level der Runde.

## 14. Ereignisse werden häufiger

- Fallen, Wolken und Ameisen haben eigene Abstände (siehe oben), die ab Level 200 bzw. 250 kürzer werden.
- Zusätzlich gilt: **ab Level 150 ist immer mindestens eine** dieser Gefahren unterwegs, **ab 200 mindestens zwei, ab 300 drei**. Fehlt eine, kommt nach ca. 2,5 s eine neue, bevorzugt die Art, die gerade am seltensten ist.

## 15. Fairness-Regeln (für alle Hindernisse)

- Kein neues Hindernis schließt einen Bereich ab: alle freien Felder bleiben vom Kopf aus erreichbar.
- Keine Sackgassen (freies Feld mit nur einem freien Nachbarn), auch der Apfel liegt nie in einer.
- Mauern, Bäume und Häuser entstehen nie im Streifen vor dem Kopf und nie direkt neben der Schlange.
- Mauern wachsen nie unter die Schlange, Wolken warten, bis sie weg ist.

## 16. Menüs und Bildschirme

- **Startmenü:** großer Titel „Snake“ mit Apfel, Kennzeichen „Endlos“, orangener Knopf „Spielen“, bester Level, darunter Anleitung, Statistik, Optionen. Oben rechts Ton an/aus. Im Hintergrund spielt ein Autopilot (gedimmt).
- **Bereit:** Nach „Spielen“ steht die Schlange, eine animierte Hand zeigt „Wischen zum Starten“ (PC: „Pfeiltaste drücken“).
- **Leiste im Spiel:** Pause links, Level groß in der Mitte (ploppt beim Apfel, springt rot bei Rückschlag), Rekord mit Pokal rechts, darunter der Balken bis zum nächsten Gebiet.
- **Hinweise:** Beim ersten Erreichen von Mauern, Teichen, Giftäpfeln, Fallen, Bäumen, Wolken, Ameisen und Häusern erscheint oben eine Karte mit Bild und kurzer Erklärung. Dazu „Neues Gebiet“, „Apfel geklaut!“ und Rückschläge.
- **Pause:** Weiter, Neu starten, Anleitung, Optionen, Menü. Pausiert automatisch, wenn die App in den Hintergrund geht oder das Fenster den Fokus verliert.
- **Spielende:** wackelndes Bild der Todesursache, Text (z. B. „Gegen einen Baum gelaufen“), erreichter Level, ggf. „Höchster Level“, Abzeichen „Neuer Rekord“ mit Fanfare, Äpfel, Länge, Zeit. Knöpfe „Nochmal“ und „Hauptmenü“.
- **Anleitung:** alle Elemente mit Bild, „ab Level …“ und Erklärung.
- **Statistik:** bester Level, Spiele, Äpfel gesamt, längste Schlange, größte Karte, Spielzeit.
- **Optionen:** Töne, Musik, Vibration, Steuerkreuz, Tempo (Langsam/Normal/Schnell), Statistik zurücksetzen, Versionsnummer.
- **Android-Zurücktaste:** Spiel → Pause, Pause → weiter, Unterseite → zurück, Startmenü → App schließen.

## 17. Töne, Musik, Vibration

- Alle Töne werden im Gerät erzeugt (Web Audio), keine Audiodateien: Klick, Biss, Zehner-Akkord, neues Gebiet, Hinweis, Gnadenschritt (dumpfer Stoß), Tod (je nach Ursache: Falle schnappt, Teich platscht, Giftapfel wabert), Falle, Wolke zischt, Ameise trippelt, Apfel geklaut, Teich blubbert, Baum fällt, Haus wird gebaut, Licht klickt, Rückschlag, Rekord-Fanfare.
- **Musik:** ruhige Schleife in a-Moll (Am, F, C, G) mit Bass und leisen Hi-Hats, im Menü und in der Pause leiser.
- **Vibration:** leicht beim Apfel, mittel bei Gnadenschritt und Falle, kräftig bei Tod und Rückschlag, „Erfolg“ beim neuen Gebiet. In der App über Capacitor Haptics, im Browser über die Vibrations-Schnittstelle.

## 18. App und Technik

- **Android-App:** Jeder Push baut auf GitHub die APK, beim Hauptzweig hängt sie am Release „latest“ (`snake-endlos.apk`). Hochformat, Vollbild (Status- und Navigationsleiste ausgeblendet), eigenes Icon und Startbild, fester Signaturschlüssel (Updates ohne Deinstallieren).
- **Web-App (PWA):** offline spielbar, installierbar („Zum Home-Bildschirm“), Vollbild. Veröffentlichung über GitHub Pages (einmalig in den Einstellungen aktivieren).
- **Speicher:** Rekord, Statistik und Einstellungen nur auf dem Gerät.
- **Leistung:** Gezeichnet wird nur der sichtbare Teil der Karte. Neue Hindernisse zu platzieren dauert auch auf der größten Karte nur wenige Millisekunden.
- **Tests:** 19 automatische Tests der Spiellogik (Regeln, Kartenwachstum, Gnadenschritt, Giftapfel, Fallen, Wolken, Ameisen, Bäume, Häuser, Licht, Rückschläge, lange Spiele bis über Level 300 mit Autopilot).
- **Zum Ausprobieren:** `?level=210` startet direkt bei Level 210, `?auto=1` lässt den Autopiloten spielen (nur in der Web-Fassung sinnvoll).
