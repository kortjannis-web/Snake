# Snake Endlos: alle Spielfunktionen

Stand: Version 1.3.1 (16.10.2026). Alle Zahlen sind Standardwerte. Sie stehen in `src/game/rules.ts` (`DEFAULTS`) und lassen sich im Spiel unter **Optionen → Master-Einstellungen** ändern.

## 1. Grundprinzip

- **Ein Modus: Endlos.** Kein Ziel, es geht so lange, bis die Schlange stirbt.
- **Level = gegessene Äpfel + 1.** Jeder Apfel ist ein Level.
- **Start:** Die Karte ist genau ein Bildschirm groß (zwei Blöcke, siehe 4.), die Schlange ist 3 Glieder lang und läuft nach rechts. Das Spiel wartet, bis man wischt (Handy) oder eine Pfeiltaste drückt (PC).
- **Feldgröße:** Ein Bildschirm hat immer ca. 300 Felder, egal welches Gerät (Handy hochkant z. B. 12 × 23). So spielt es sich überall gleich.
- **Wachsen:** bis Level 50 bei jedem Apfel ein Glied mehr, bis Level 300 bei jedem zweiten, danach bei jedem dritten. Sonst wäre die Schlange auf Dauer länger als die Karte.
- **Tempo:** Grundtakt je nach Einstellung 185 / 154 / 128 ms pro Feld (Langsam / Normal / Schnell). Mit jedem Level etwas schneller, ab ca. Level 270 bleibt es bei 68 % des Grundtakts.

## 2. Steuerung

- **Handy:** Wischen auf dem ganzen Bildschirm. Mehrere Richtungen in einem Wisch gehen (Finger nicht absetzen).
- **PC:** Pfeiltasten oder WASD. Esc oder P = Pause, Enter oder Leertaste startet nach dem Spielende neu.
- **Steuerkreuz (Option):** vier Tasten unter dem Spielfeld statt Wischen.
- **Eingabepuffer:** Bis zu drei schnelle Richtungswechsel werden gemerkt und nacheinander ausgeführt.
- **Sofort-Wende:** Kommt ein Richtungswechsel im ersten Drittel eines Schritts, gilt er sofort und nicht erst ab dem nächsten Feld. Das fühlt sich direkter an.
- **Gnadenschritt** (wie bei Google Snake): Läuft die Schlange gegen ein Hindernis, bleibt sie gut einen Takt (1,3) stehen. Wer dann abbiegt, lebt weiter. Erst der zweite Anlauf ist das Ende. Gilt für Rand, eigenen Körper, Mauer, Teich, Falle, Frosch, Baum, Haus und Jägerturm, **nicht** für Giftäpfel (die isst man ja).

## 3. Äpfel

- Roter Apfel mit Stiel, Blatt und Glanz, ploppt beim Erscheinen auf und wippt leicht.
- Liegt nie unter der Schlange, in einem Hindernis, in einer Sackgasse, im Fensterlicht oder dort, wo eine Giftwolke gleich hinwächst. Er ist immer erreichbar.
- Auf großen Karten liegt er meist in Reichweite (höchstens ca. ein Bildschirm entfernt).
- **Pfeil am Rand:** Liegt der Apfel außerhalb des Bildes, zeigt ein runder Pfeil mit Apfel am Bildrand die Richtung.
- Beim Essen: Funken, Knackgeräusch (innerhalb eines Zehnerblocks steigt der Ton leicht an), leichte Vibration. Alle 10 Level ein kleiner Akkord.

## 4. Karte und neue Gebiete (Blöcke wie bei Minecraft)

- Die Karte besteht aus **Blöcken von je einem halben Bildschirm**. Am Handy (hochkant) ist ein Block fast quadratisch, leicht hochkant (z. B. 12 × 11 Felder). Am Anfang liegen zwei Blöcke übereinander = ein Bildschirm.
- **Alle 20 Level** (Standard, einstellbar) setzt sich ein **neuer Block an einer zufälligen freien Stelle** an die Karte, immer bündig im Blockraster: rechts oben, rechts unten, über einem Block, links daneben usw. Die Karte wird dadurch unregelmäßig (L-Formen, Treppen, Buchten).
- Jeder Block hat genau die gleiche Fläche.
- **Ab Level 300** (einstellbar) kommt kein Block mehr dazu. Bei alle 20 Level sind das 14 neue Blöcke, insgesamt 16 Blöcke = 8 Bildschirme.
- Der neue Block klappt von der Seite auf, an der er angesetzt wird, Feld für Feld als Welle. Dazu „Whoosh“ mit Akkord und der Hinweis „Ein neuer Block ist rechts dazugekommen“.
- Außerhalb der Blöcke ist dunkler Boden mit Punktraster: dort ist Rand.
- **Kamera:** Ist die Karte größer als der Bildschirm, folgt die Kamera weich der Schlange und schaut etwas voraus.
- Der dünne Balken unter der Leiste zeigt, wie weit es noch bis zum nächsten Block ist.

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

## 11. Frösche (ab Level 200)

- Etwa **alle 2 bis 3 Level** springt ein Frosch auf die Karte (ab Level 250 öfter), **höchstens 6 gleichzeitig**. So sind oft 4 oder mehr unterwegs.
- Er schaut in eine Richtung und **hüpft alle 3 Sekunden ein Feld** weit.
- **1 Sekunde vor dem Sprung** macht er sich bereit: Hinterbeine spreizen sich, der Körper duckt sich nach hinten (Anlauf).
- **Sprung:** Er hebt im Bogen ab, die Hinterbeine strecken sich, der Schatten bleibt am Boden. Leises Ploppen.
- **Richtungswechsel:** Nach jedem Sprung mit **20 % Chance** schaut er 0,25 s nach der Landung in eine andere Richtung und springt beim nächsten Mal dorthin.
- **Nie in die Schlange:** Liegt die Schlange auf dem Zielfeld (oder ein Hindernis), dreht er sich in eine freie Richtung und nimmt neu Anlauf. Durch Giftwolken hüpft er hindurch.
- Landet er auf dem Apfel, schnappt er ihn sich (Apfel liegt danach woanders, Hinweis „Apfel geschnappt!“).
- Über den Kartenrand hüpft er weg und verschwindet.
- Die Schlange kann gegen ihn laufen = Tod (mit Gnadenschritt).

## 12. Häuser (ab Level 210)

- Zwei Formen: **2 × 3 Felder** oder **mit einer Ecke** (Reihen 2, 2, 3, 3 Felder, also 10 Felder). Zufällig gedreht und gespiegelt.
- Ab Level 210 **alle 30 Level ein neues** (210, 240, 270 …). Es **bleibt stehen**. Höchstens eins je ca. 250 Felder.
- Von oben gesehen: Ziegeldach, Kamin mit Rauch.
- **Vier Fenster**, eins an jeder Seite (oben, unten, links, rechts).
- **Nach jedem Apfel wechselt das Licht:** In jedem Haus leuchtet dann ein anderes Fenster gelb. Das Licht strahlt **2 Felder weit** nach außen (endet früher am Kartenrand, an einem Haus, Baum oder Turm).
- **Nie auf die Schlange:** Es wird nur ein Fenster gewählt, dessen Licht kein Feld der Schlange berührt (möglichst auch nicht direkt vor dem Kopf). So gibt es keinen Sofort-Treffer.
- **Zugebaut = dunkel:** Kann kein Fenster leuchten (alle vier Seiten zugebaut oder die Schlange liegt überall davor), bleibt das Haus diese Runde dunkel. So kann man sich bewusst Platz schaffen.
- **Haus berühren = Tod** (mit Gnadenschritt).
- **Ins Licht laufen = 5 Level zurück.**

## 12a. Jägertürme (ab Level 315)

- Runder Steinturm mit Zinnen, **2 × 2 Felder**, oben ein Scheinwerfer.
- Ab Level 315 **alle 40 Level ein neuer** (315, 355, 395 …), bleibt stehen. Höchstens einer je ca. 300 Felder.
- **Lichtkegel:** 2 Felder breit, **6 Felder lang**, in die Richtung, in die der Scheinwerfer zeigt.
- **Jede Runde (nach jedem Apfel) dreht er sich eine Vierteldrehung im Uhrzeigersinn** (oben → rechts → unten → links). Der Scheinwerfer schwenkt sichtbar mit.
- Der Kegel endet am Kartenrand, an Häusern, Bäumen und anderen Türmen. **Die Schlange wirft Schatten:** Liegt sie in der neuen Richtung, endet der Kegel vor ihr. So gibt es nie einen Sofort-Treffer, trotzdem dreht der Turm immer weiter.
- Im Kegel = **10 Level zurück**, Turm berühren = Tod (mit Gnadenschritt).

## 13. Rückschläge (Giftwolke −10, Fensterlicht −5, Jägerturm −10)

- Nur der **Kopf** zählt. Ein Rückschlag beendet das Spiel nicht.
- Level sinkt um 10 bzw. 5 (nie unter 1). Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war (mindestens 3 lang). Das Tempo passt sich dem neuen Level an.
- Danach ist die Schlange **gut 2 Sekunden geschützt** und blinkt, damit sie aus der Wolke oder dem Licht herauskommt.
- Absteigende Töne, kräftige Vibration, Bildschirm wackelt kurz, die Levelzahl springt rot nach unten, Hinweis „−10 Level“.
- Was schon da ist, bleibt: Karte, Teiche, Bäume, Häuser, Türme. Beim zweiten Erreichen eines Levels kommt nichts doppelt (kein zweiter Block, kein zweiter Teich, Baum, Haus oder Turm, keine Hinweise noch einmal).
- Als **Rekord** zählt der höchste erreichte Level der Runde.

## 14. Ereignisse werden häufiger

- Fallen, Wolken und Frösche haben eigene Abstände (siehe oben), die ab Level 200 bzw. 250 kürzer werden.
- Zusätzlich gilt: **ab Level 150 ist immer mindestens eine** dieser Gefahren unterwegs, **ab 200 mindestens zwei, ab 300 drei**. Fehlt eine, kommt nach ca. 2,5 s eine neue, bevorzugt die Art, die gerade am seltensten ist.

## 14a. Münzen, Power-ups, Skins, Minikarte

**Münzen (Spielgeld, keine echten Käufe)**
- Jeder Apfel bringt **1 Münze**. Nach jedem Apfel liegt mit **25 % Chance** eine **Goldmünze (3 Münzen)** auf der Karte, höchstens 3 gleichzeitig, sie liegt 12 s (blinkt am Ende) und dreht sich.
- **Mehrfach ab Level 50:** Bis Level 49 zählt jede Münze einfach, ab Level 50 doppelt, ab 100 dreifach, ab 150 vierfach und so weiter (gilt für Apfel- und Goldmünzen, nach dem aktuellen Level). Beim Erreichen kommt der Hinweis „Münzen ×2“, in der Leiste steht der Faktor neben dem Kontostand.
- Einsammeln: mit dem Kopf drüberfahren, „+3“ steigt auf, Klingeln. Der Magnet zieht sie an.
- Kontostand oben in der Leiste, im Startmenü (antippen öffnet den Shop) und im Shop. Auf dem Spielende-Bildschirm „+N Münzen“.
- Im Kreativ-Modus gibt es keine Münzen.

**Power-ups (ab Level 10)**
- Nach jedem Apfel mit **18 % Chance** liegt ein Power-up auf der Karte (höchstens eins), 15 s lang, blinkt in den letzten 3 s. Leuchtende Kugel mit Symbol.
- **Schild** (blau): fängt einen Aufprall, einen Giftapfel oder einen Rückschlag ab, die Schlange gleitet dann 1,5 s durch. Bis zu 3 sammeln sich. Blaue Blase um den Kopf. Nicht am Kartenrand.
- **Zeitlupe** (lila): 8 s lang ein gutes Drittel langsamer.
- **Magnet** (rot): 8 s lang rückt der Apfel alle 0,26 s ein Feld näher, Goldmünzen in der Nähe auch.
- **Geist** (grau): 6 s lang durch alle Hindernisse und die eigene Schlange, keine Rückschläge; die Schlange ist durchscheinend und flackert kurz vor dem Ende.
- **Schere** (orange): sofort 30 % kürzer (mindestens 3 Glieder bleiben).
- Aktive Power-ups stehen oben links im Spielfeld als kleine Pillen mit Restzeit-Balken.
- Im Kreativ-Modus lässt sich jedes Power-up in den Kreativ-Optionen sofort aktivieren.

**Skins (Startmenü → Skins)**
- Klassik (gratis), **Koralle** 300, **Nacht** 800 (funkelnde Sterne), **Tiger** 1600 (Streifen), **Gold** 3500 (laufender Glanz), **Regenbogen** 7500 (Farben wandern über den Körper).
- Antippen kauft (wenn genug Münzen) und wählt aus, gekaufte Skins lassen sich jederzeit wechseln. Zu wenig Münzen: Karte wackelt.

**Minikarte**
- Winzig unten links (ca. 50 px), nur die Kartenblöcke ganz blass und die Schlange als Punkt. Erscheint erst, wenn die Karte größer als ein Bildschirm ist.

## 15. Fairness-Regeln (für alle Hindernisse)

- Kein neues Hindernis schließt einen Bereich ab: alle freien Felder bleiben vom Kopf aus erreichbar.
- Keine Sackgassen (freies Feld mit nur einem freien Nachbarn), auch der Apfel liegt nie in einer.
- Mauern, Bäume und Häuser entstehen nie im Streifen vor dem Kopf und nie direkt neben der Schlange.
- Mauern wachsen nie unter die Schlange, Wolken warten, bis sie weg ist.

## 16. Menüs und Bildschirme

- **Startmenü:** großer Titel „Snake“ mit Apfel, Kennzeichen „Endlos“, orangener Knopf „Spielen“, bester Level, darunter Anleitung, Statistik, Optionen. Oben rechts Ton an/aus. Im Hintergrund spielt ein Autopilot (gedimmt).
- **Bereit:** Nach „Spielen“ steht die Schlange, eine animierte Hand zeigt „Wischen zum Starten“ (PC: „Pfeiltaste drücken“).
- **Leiste im Spiel:** Pause links, Level groß in der Mitte (ploppt beim Apfel, springt rot bei Rückschlag), Rekord mit Pokal rechts, darunter der Balken bis zum nächsten Block. Im Kreativ-Modus steht „Level · Kreativ“.
- **Hinweise:** Beim ersten Erreichen von Mauern, Teichen, Giftäpfeln, Fallen, Bäumen, Wolken, Fröschen, Häusern und Jägertürmen erscheint oben eine Karte mit Bild und kurzer Erklärung. Dazu „Neues Gebiet“, „Apfel geschnappt!“ und Rückschläge.
- **Pause:** Weiter, Neu starten, Anleitung, Optionen, Menü. Pausiert automatisch, wenn die App in den Hintergrund geht oder das Fenster den Fokus verliert.
- **Spielende:** wackelndes Bild der Todesursache, Text (z. B. „Gegen einen Baum gelaufen“), erreichter Level, ggf. „Höchster Level“, Abzeichen „Neuer Rekord“ mit Fanfare, Äpfel, Länge, Zeit. Knöpfe „Nochmal“ und „Hauptmenü“.
- **Anleitung:** alle Elemente mit Bild, „ab Level …“ und Erklärung.
- **Statistik:** bester Level, Spiele, Äpfel gesamt, längste Schlange, größte Karte, Spielzeit.
- **Optionen:** Töne, Musik, Vibration, Steuerkreuz, Tempo (Langsam/Normal/Schnell), Statistik zurücksetzen, Versionsnummer.
- **Android-Zurücktaste:** Spiel → Pause, Pause → weiter, Unterseite → zurück, Startmenü → App schließen.

## 16a. Kreativ-Modus

- Im Startmenü „Kreativ-Modus“, in der Pause einer Kreativ-Runde „Kreativ-Optionen“.
- **Startlevel** (1 bis 5000): Die Karte wird so aufgebaut, wie sie bis dahin ungefähr entstanden wäre: alle Blöcke, Teiche (ältere ausgetrocknet), Bäume, Häuser und Türme, dazu Mauern und Giftäpfel für diesen Level. Die Schlange wächst in den ersten Schritten auf ihre Länge.
- **Hindernisse:** Tödlich (normal) / Anhalten (vor jedem Hindernis stehen bleiben, nie sterben) / Geist (durch alles hindurch, nur der Kartenrand hält an).
- **Rückschläge** an/aus (Wolke, Licht, Kegel).
- **Durch die eigene Schlange** an/aus.
- **Schlange wächst** an/aus, sonst **feste Länge** (1 bis 500). Beim Ausschalten im Spiel wird die aktuelle Länge übernommen.
- **Während des Spiels** (Pause → Kreativ-Optionen): alles oben live umschalten, Level **−10 / −1 / +1 / +10** oder direkt springen (höher baut die Welt mit auf, niedriger kürzt die Schlange), **Falle, Wolke oder Frosch sofort auslösen**.
- Kreativ-Runden zählen nicht für Rekord und Statistik. In der Leiste steht „Level · Kreativ“.

## 16b. Master-Einstellungen

- Optionen → Master-Einstellungen: **jede Zahl des Spiels** ist einstellbar, nach Gruppen: Karte (Block alle N Level, bis Level), Schlange (Tempo, Wachsen, Gnadenschritt, Schutzzeit), Mauern, Teiche, Giftäpfel, Bärenfallen, Bäume, Giftwolken, Frösche (Häufigkeit, Sprungtakt, Wende-Chance, Höchstzahl), Häuser (Häufigkeit, Lichtweite, Strafe), Jägertürme (Häufigkeit, Kegellänge, Strafe), Ereignisse (Mindestanzahl ab Level, früher häufiger).
- Gilt ab dem nächsten Spiel, auch im Kreativ-Modus. „Alles auf Standard“ setzt zurück. Die Anleitung rechnet mit den eingestellten Werten.

## 17. Töne, Musik, Vibration

- Alle Töne werden im Gerät erzeugt (Web Audio), keine Audiodateien: Klick, Biss, Zehner-Akkord, neues Gebiet, Hinweis, Gnadenschritt (dumpfer Stoß), Tod (je nach Ursache: Falle schnappt, Teich platscht, Giftapfel wabert), Falle, Wolke zischt, Frosch quakt und ploppt beim Sprung, Jägerturm, Apfel geschnappt, Teich blubbert, Baum fällt, Haus wird gebaut, Licht klickt, Rückschlag, Rekord-Fanfare.
- **Musik:** ruhige Schleife in a-Moll (Am, F, C, G) mit Bass und leisen Hi-Hats, im Menü und in der Pause leiser.
- **Vibration:** leicht beim Apfel, mittel bei Gnadenschritt und Falle, kräftig bei Tod und Rückschlag, „Erfolg“ beim neuen Gebiet. In der App über Capacitor Haptics, im Browser über die Vibrations-Schnittstelle.

## 18. App und Technik

- **Android-App:** Jeder Push baut auf GitHub die APK, beim Hauptzweig hängt sie am Release „latest“ (`snake-endlos.apk`). Hochformat, Vollbild (Status- und Navigationsleiste ausgeblendet), eigenes Icon und Startbild, fester Signaturschlüssel (Updates ohne Deinstallieren).
- **Web-App (PWA):** offline spielbar, installierbar („Zum Home-Bildschirm“), Vollbild. Veröffentlichung über GitHub Pages (einmalig in den Einstellungen aktivieren).
- **Speicher:** Rekord, Statistik und Einstellungen nur auf dem Gerät.
- **Leistung:** Gezeichnet wird nur der sichtbare Teil der Karte. Neue Hindernisse zu platzieren dauert auch auf der größten Karte nur wenige Millisekunden.
- **Tests:** 31 automatische Tests der Spiellogik (Regeln, Kartenblöcke, Gnadenschritt, Giftapfel, Fallen, Wolken, Frösche, Bäume, Häuser, Licht, Türme, Rückschläge, Kreativ-Modus, Münzen und Power-ups, lange Spiele bis über Level 300 mit Autopilot).
- **Zum Ausprobieren:** Kreativ-Modus (siehe 16a). In der Web-Fassung zusätzlich `?level=210` und `?auto=1` (Autopilot).
