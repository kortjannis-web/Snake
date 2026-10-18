# Snake Endlos: alle Spielfunktionen

Stand: Version 1.15.0 (18.10.2026). Alle Zahlen sind Standardwerte. Sie stehen in `src/game/rules.ts` (`DEFAULTS`) und lassen sich im Spiel unter **Optionen → Master-Einstellungen** ändern.

## 1. Grundprinzip

- **Ein Modus: Endlos.** Kein Ziel, es geht so lange, bis die Schlange stirbt.
- **Level = gegessene Äpfel + 1.** Jeder Apfel ist ein Level.
- **Start:** Die Karte ist etwas größer als ein Bildschirm (zwei Blöcke, je Richtung ein Feld mehr, siehe 4.), die Schlange ist 3 Glieder lang und läuft nach rechts. Das Spiel wartet, bis man wischt (Handy) oder eine Pfeiltaste drückt (PC).
- **Feldgröße:** Ein Bildschirm hat immer ca. 300 Felder, egal welches Gerät (Handy hochkant z. B. 12 × 23). So spielt es sich überall gleich.
- **Wachsen:** bis Level 50 **alle 2 Äpfel** ein Glied mehr, bis Level 300 alle 4, danach alle 6 (halb so schnell wie früher; einstellbar: Master-Einstellungen → Schlange). Sonst wäre die Schlange auf Dauer länger als die Karte.
- **Regelmäßig Neues:** Bis Level 300 kommt **alle 10 Level** etwas Neues oder etwas wird schwerer (Übersicht in der README und in der Zeitleiste der Master-Einstellungen).
- **Tempo:** Grundtakt je nach Einstellung 185 / 154 / 128 ms pro Feld (Langsam / Normal / Schnell). Mit jedem Level etwas schneller, ab ca. Level 270 bleibt es bei 68 % des Grundtakts.

## 2. Steuerung

- **Handy: ein einziger Fingermodus.** Wischen auf dem ganzen Bildschirm, kurz oder mit liegendem Finger zum Durchdrücken: Finger nicht absetzen und weiterziehen, jede neue Linie ist die nächste Richtung. Gezählt wird ab **18 px** Weg (spricht schnell an), und die Linie darf höchstens **32°** von waagrecht oder senkrecht abweichen; schräge Striche lösen keine Wende aus. (Früher gab es Wischen und Zeichnen getrennt, das ist jetzt eins.)
- **Unten links:** ein kleiner **Pause-Knopf**. Die Minikarte sitzt darüber.
- **PC:** Pfeiltasten oder WASD. Esc oder P = Pause, Enter oder Leertaste startet nach dem Spielende neu.
- **Steuerkreuz (Option):** vier Tasten unter dem Spielfeld statt Wischen.
- **Eingabepuffer:** Bis zu drei schnelle Richtungswechsel werden gemerkt und nacheinander ausgeführt.
- **Sofort-Wende:** Kommt ein Richtungswechsel im ersten Drittel eines Schritts, gilt er sofort und nicht erst ab dem nächsten Feld. Das fühlt sich direkter an.
- **10 ms Reaktionszeit:** Wer gegen ein Hindernis fährt (Kartenrand, Mauer, eigener Körper, Teich, Giftapfel, Falle, Frosch, Gegner-Schlange, Baum, Haus, Jägerturm, Lava), bleibt noch **10 ms** davor stehen (einstellbar: Master-Einstellungen → Schlange → Reaktionszeit). Wer in dieser Zeit abbiegt, ist gerettet; sonst ist es vorbei. Kein ganzer Gnadenschritt. Schild und Geist schützen weiterhin. Nur im Kreativ-Modus mit „anhalten“ bleibt die Schlange stehen.

## 3. Äpfel

- Apfel mit Stiel, Blatt und Glanz, ploppt beim Erscheinen auf und wippt leicht. Seine **Farbe zeigt, wie viel er wert ist** (siehe 14a): erst Rot, ab Level 50 Orange usw.
- Liegt nie unter der Schlange, in einem Hindernis, in einer Sackgasse, im Fensterlicht oder dort, wo eine Giftwolke gleich hinwächst. Er ist immer erreichbar.
- Auf großen Karten liegt er meist in Reichweite (höchstens ca. ein Bildschirm entfernt).
- **Pfeil am Rand:** Liegt der Apfel außerhalb des Bildes, zeigt ein runder Pfeil mit Apfel (in Apfelfarbe) am Bildrand die Richtung.
- Beim Essen: Funken in Apfelfarbe, Knackgeräusch (innerhalb eines Zehnerblocks steigt der Ton leicht an), leichte Vibration. Alle 10 Level ein kleiner Akkord.

## 4. Karte und neue Gebiete (Blöcke wie bei Minecraft)

- Die Karte besteht aus **Blöcken von je einem halben Bildschirm plus einem Feld in jede Richtung**. Am Handy (hochkant) ist ein Block fast quadratisch (z. B. 13 × 12 statt 12 × 11 Felder). Am Anfang liegen zwei Blöcke übereinander (z. B. 13 × 24). Jeder neue Block ist genauso groß, die Karte wächst also mit jedem Gebiet etwas mehr.
- **Bis Level 300 alle 20 Level, dann alle 30 (300, 330 … 480), ab Level 500 alle 50** (alles einstellbar) darfst du **selbst wählen**, wo der neue Block hinkommt. Die Karte hört also nie auf zu wachsen, nur langsamer. Die Wände, an die ein Block passt, **glühen** (goldener, pulsierender Rand), dazu Glocken und der Hinweis „Öffne eine Wand“ (der einzige Hinweis im Spiel).
- **Du hast 30 Sekunden:** oben links läuft ein Countdown mit Fahne, **die letzten 5 Sekunden blinken** Wände und Countdown. **Fährst du gegen eine glühende Wand**, kommt genau dort der Block hin und du fährst direkt hinein. Verpasst du die Zeit, kommt der Block an eine zufällige Stelle („Zu spät“). Beim Aufbau (Startlevel, Kreativ-Springen) zufällig wie bisher. Die Karte wird so unregelmäßig (L-Formen, Treppen, Buchten), aber nach deinem Plan.
- Jeder Block hat genau die gleiche Fläche.
- **Ab Level 300** (einstellbar) kommt kein Block mehr dazu. Bei alle 20 Level sind das 14 neue Blöcke, insgesamt 16 Blöcke = gut 8 Bildschirme.
- Der neue Block klappt von der Seite auf, an der er angesetzt wird, Feld für Feld als Welle. Dazu „Whoosh“ mit Akkord.
- **Außerhalb der Karte ist Erde:** dunkelbraun, direkt am Spielfeld eine hellere Erdkante (zwei Ringe), am Spielfeld selbst ein dunkler Grasrand. In der Erde liegen fest verteilt (immer gleich für dasselbe Feld): **Steine**, **Kohle**, **Schlangenskelette**, **Golderz** (ca. 0,9 %) und selten **Diamanten** (ca. 0,12 %), die funkeln. Hineinfahren ist der Rand (Tod), außer mit dem Maulwurf. Dazu einzelne glühende **Lavafelder im Stein** (siehe 12c).
- **Erze** (je 1000 Erdfelder): **Golderz** 9 (= **3 ×** der aktuelle Apfelwert), **Diamant** 1,2 (**6 ×**), **Rubin** 0,5 (rot, **10 ×**), **Opal** 0,15 (leuchtet und schimmert zwischen Pink und Lila, **20 ×**).
- **Erze freilegen:** Wird Erde zu Spielfeld (neuer Block, Maulwurf), liegen die Erze darin als Brocken auf der Karte. Drüberfahren gräbt sie aus. Jedes Erz gibt es nur einmal.
- **Standbild am Anfang:** Solange die Karte nur aus den zwei Startblöcken besteht (bis das erste neue Gebiet freigeschaltet ist, also frühestens Level 20), steht das Bild still, die ganze Karte in der Mitte. Das gilt für jede Kamera-Einstellung. Danach fährt die Kamera weich los.
- **Sichtfeld:** Die Kamera zeigt je Richtung **2 Felder mehr** als ein Bildschirm der Spiellogik (am Handy hochkant z. B. ca. 15 × 26 bei einer Startkarte von 13 × 24). Die Schlange wirkt dadurch etwas kleiner, Karte und Blöcke bleiben gleich.
- **Kamera (zwei Einstellungen, Optionen → Kamera):**
  - **Bereich (Standard):** arbeitet in drei Schichten, darauf folgt die Kamera an einer zweistufigen, kritisch gedämpften Feder (**Gummiseil an einem Gummiseil**: weich anfahren, weich abbremsen, kein Überschwingen).
    1. **Kasten:** Der Ausschnitt ist so groß wie das Bild, an den Kartenblöcken ausgerichtet, und steht. Überschreitet der Kopf seinen Rand (die Schwelle), kommt der nächste Ausschnitt (einen Block weiter). Passt die Karte in einer Richtung ganz ins Bild, steht die Kamera dort mittig still.
    2. **Vorwegnehmen:** Eine **Öffnung** ist eine Stelle, an der die Karte hinter dem Rand des Ausschnitts weitergeht, auch hinter Erde oder um die Ecke (bis 6 Felder neben dem Ausschnitt). Sobald der Kopf **über die Mittellinie** hinaus auf eine Öffnung zukommt, lehnt sich die Kamera hinüber, **je näher, desto mehr**: An der Schwelle steht sie **halb im neuen Bereich** und ist dort noch in Fahrt, damit der Wechsel ohne Halt durchgeht. Den Rest gleitet sie nach dem Wechsel in **1,1 s mit Ease-in/out** hinüber (genauso beim Graben in die Erde, beim Zurückkommen und wenn die Karte wächst, dann passend zur Welle, mit der der neue Block aufklappt).
       **Gummiseil zur Laufrichtung:** Fährt die Schlange auf eine Öffnung zu, zieht sie voll, quer etwas weniger, fährt sie weg, nur halb. Die Kamera passt sich so in Echtzeit an jede Entscheidung an (Richtung inklusive der schon gewischten nächsten Richtung, weich nachgezogen).
    3. **Mindestabstand zum Bildrand**, überall dort, wo in der Nähe Karte ist (auch hinter Erde oder um die Ecke): in Laufrichtung **ca. 6½ ganze Felder**, quer ca. 6, nach hinten ca. 5½. Die Feder hängt im Lauf etwas hinterher. Damit das nie Sicht kostet, läuft eine **Geister-Feder** mit, dieselbe Feder, die nur dem Kopf folgt: Um so viel, wie sie hinterherhängt, rücken die Grenzen mit (auch beim Abbiegen und Umkehren genau richtig, ohne Rückkopplung, also ohne Aufschaukeln). Als **letzte Sicherung** bleiben zu jeder Seite immer **mindestens 5 ganze Felder** am Kopf vorbei sichtbar; sie greift nur selten (z. B. direkt nach schnellem Abbiegen), setzt weich ein und ist sonst genau null.
    In Simulationen (Autopilot, alle Tempos, Level 1 bis 420) bleibt der Kopf zu jeder Seite mit Karte praktisch immer mindestens 5 ganze Felder vom Bildrand weg, im schnellsten Fall nie weniger als 4½.
  - **Dynamisch:** fliegt wie eine **Drohne**, losgelöst von der Schlange. Sie hängt an einer kritisch gedämpften Feder mit weich nachgezogenem Ziel, das in Laufrichtung vor dem Kopf liegt. So weit, dass sie im Lauf knapp (ca. 1,5 Felder) vor dem Kopf schwebt, egal wie schnell die Schlange ist. Biegt die Schlange ab, springt nur dieses Ziel: Die Kamera selbst behält ihren Schwung und fliegt in einem **lockeren Bogen** hinüber, nie um eine Ecke. Steht die Schlange (Spielende, am Rand angehalten), gleitet sie zum Kopf. In der Pause steht sie still.
  - Mit „Bewegung reduzieren“ (Systemeinstellung) haftet die Kamera immer genau am Kopf.
  - Die frühere Einstellung „Fest“ und das Rauszoomen alle 30 Level gibt es nicht mehr. Wer „Fest“ oder „Dynamisch“ gespeichert hatte, startet einmalig mit „Bereich“.
- Der dünne Balken unter der Leiste zeigt, wie weit es noch bis zum nächsten Block ist.

## 5. Mauern (ab Level 5)

- Ab Level 5 steht eine **Mauer mit 2 Feldern**. Alle 8 Level wird sie ein Feld länger: 2, 3, 4, 5, 6.
- Ist sie 6 lang, kommt eine **zweite Mauer** dazu, die wieder mit 2 anfängt (Level 45: 6 + 2). Dann wächst die neue bis 6, dann kommt die dritte (Level 85: 6 + 6 + 2) und so weiter.
- **Nach jedem Apfel** verschwinden die Mauern und tauchen woanders neu auf (Feld für Feld, fast sofort).
- Ab 3 Feldern können sie einen Knick haben (Chance steigt mit der Länge: 20 %, 40 %, 60 %, 75 %).
- Wie viele Mauern gleichzeitig Platz haben, hängt an der Kartengröße (ungefähr eine je 130 Felder). Bei Level 300 sind es ca. 8 bis 11.
- Mauern entstehen nie direkt vor dem Kopf (Streifen in Laufrichtung), mindestens 5 Felder vom Kopf und 2 vom Körper entfernt, mit einem Feld Luft zu anderen Hindernissen.

## 6. Teiche (ab Level 15)

- Alle 15 Level entsteht ein Teich und **bleibt liegen**.
- Größe steigt langsam: 2, 2, 3, 3, 4, 4, 5 … bis 12 Felder, als zusammenhängende Wasserfläche mit Ufer und Wellen.
- Sind mehr Teiche da, als die Karte verträgt (ca. einer je 220 Felder, mindestens 2), trocknet der älteste aus.

## 7. Giftäpfel (ab Level 40)

- Sehen aus wie normale Äpfel (auch in derselben Farbe), sind aber **an einer Ecke verschimmelt** (brauner Faulfleck mit graugrünem Schimmel und hellem Flaum). Daran erkennt man sie.
- **Essen = sofort Spielende**. Die Schlange färbt sich dabei kränklich.
- Anzahl: 1 ab Level 40, dann alle 70 Level einer mehr (110, 180, 250), höchstens 4.
- Liegen nach jedem Apfel woanders, einer davon gern in der Nähe des echten Apfels. Nie direkt vor dem Kopf (6 Felder in Laufrichtung frei).

## 8. Bärenfallen (ab Level 70)

- Etwa **alle 4 bis 5 Level** (ab Level 190 alle 3 bis 4) erscheint eine Falle **genau in der Bahn**, in die die Schlange gerade läuft, **5 bis 8 Felder vor dem Kopf**.
- Metallischer Klack beim Erscheinen, orangener Warnring, sie pulsiert kurz.
- Bleibt 25 Sekunden, blinkt in den letzten 3 Sekunden und schnappt dann zu.
- Hineinlaufen = sofort Tod.

## 8a. Gegner-Schlangen (ab Level 100, lila ab 150)

- **Rote Schlangen mit bösen Augenbrauen**, beim Erscheinen **3 oder 4 Glieder** lang. Sie tauchen weit weg vom Kopf auf (mindestens ca. 6 bis 12 Felder, nie in der Laufrichtung), immer dort, wo die Schlange hinkommt, mit genug Platz drumherum. Leises Zischen.
- **Selten:** ab Level 100 etwa alle **30 bis 45 Level** eine neue (ab Level 190 je 1 Level früher). Gleichzeitig höchstens **1** (ab Level 100), **2** (ab 200). Die Frösche kommen vorher (Level 30) und viel öfter.
- **Lila Gegner (ab Level 150):** Jeder neue Gegner ist mit **25 %** lila (also seltener als rot). Lila startet mit **5 Gliedern**, ist **20 % schneller** als rot (ein Schritt je 1,67 statt 2 Takte), wird bis **10** lang und schaut **noch böser**: dicke, steile Brauen, gelbliche Augen mit roten Pupillen. Die KI rechnet mit ihrem Tempo, sie entkommt also öfter. Einkesseln bringt so viele Äpfel, wie sie lang ist.
- **Halb so schnell** wie die Schlange (ein Schritt je zwei Takte der Schlange). Zeitlupe bremst nur die eigene Schlange.
- **Weichen immer aus, so gut es geht.** Die KI bewertet bei jedem Schritt jede freie Richtung:
  - **Sicheres Gebiet:** wie viele Felder sie erreicht, bevor die Schlange dort sein kann (Breitensuche von beiden Köpfen, sie ist ja halb so schnell). Das ist der wichtigste Wert: so flieht sie in offene Bereiche und schlüpft durch Lücken, bevor sie sich schließen.
  - **Platz:** keine Sackgassen und keine Taschen, in denen sie sich selbst einsperrt.
  - **Abstand zur Schlange** (echter Weg, nicht Luftlinie), nie direkt vor oder neben den Kopf.
  - **Bewegungsfreiheit** (freie Nachbarfelder), gern geradeaus, ein wenig Zufall.
  - Ist die Schlange weit weg (mehr als ca. 14 Schritte), schlängelt sie gemütlich herum. Wird sie gejagt, ziehen die Augenbrauen hoch und die Pupillen werden klein.
- Sie laufen nie in Hindernisse (Mauern, Teiche, Fallen, Bäume, Häuser, Türme, Frösche, Giftäpfel, Giftwolken), in andere Gegner oder über den Rand. Läuft eine über den Apfel, rollt er woandershin.
- **Bei Hindernissen schlau, bei der Schlange langsam.** Wer sie einkesselt, wird belohnt (beide Zahlen einstellbar: Master-Einstellungen → Gegner-Schlangen):
  - **2 Felder Reaktionszeit vor der Schlange:** Läuft ein Gegner auf den Körper der Schlange zu, braucht er 2 Felder, um zu verstehen, dass er ausweichen muss. Taucht die Schlange neu in seiner Bahn auf (er ist gerade abgebogen) und ist **höchstens 2 Felder** entfernt, fährt er stur geradeaus weiter und **rast hinein**. Was er schon von weiter weg gesehen hat, umfährt er wie gewohnt.
  - **4 Felder, wenn die Schlange ihm gerade den Weg verbaut:** Schiebt sich der Kopf **bis zu 4 Felder direkt vor** einen Gegner (genau in seine Laufrichtung, frei dazwischen), schafft er es nicht mehr: Er fährt stur geradeaus weiter (die Augen werden panisch) und **zerplatzt an der Schlange**.
  - Beides bringt so viele Äpfel, wie er lang ist (mal Apfelwert). Ist die Schlange bis dahin schon vorbei, lenkt er danach wieder normal.
- **Eingekesselt = tot:** Hat sie keinen freien Zug mehr, oder ist ihr ganzer Bereich kaum größer als sie selbst (zwei Schritte hintereinander), zerplatzt sie in rote Funken. Solange es einen Ausweg gibt, versucht sie sich zu befreien.
- **Belohnung:** Hat die Schlange sie eingekesselt (der eigene Körper ist höchstens 2 Felder entfernt), bringt sie **so viele Äpfel, wie sie lang ist, mal Apfelwert** (siehe 14a). Plopp und Fanfare, „+N“ steigt auf. Zählt in der Statistik („Gegner eingekesselt“).
- **Werden länger:** Wer überlebt, wird **alle 20 Sekunden ein Glied länger**, höchstens **8**. Ein kurzer Schimmer um den Kopf zeigt es. Längere Gegner bringen mehr, versperren aber auch mehr Platz.
- **Mit dem Kopf hineinfahren = Tod** (sofort; Schild fängt es ab, Geist fährt hindurch). Giftwolken wachsen nicht über sie, sondern warten wie bei der Schlange.
- Im Kreativ-Modus lässt sich eine Gegner-Schlange sofort auslösen (bis zur eingestellten Höchstzahl).

## 9. Bäume (ab Level 60)

- **Erst steht er:** Ein neuer Baum ist eine stehende Tanne, von oben gesehen ein **Plus** aus 5 Feldern (Stamm in der Mitte, die Krone als Stern mit vier Spitzen in die Nachbarfelder).
- **Dann kippt er:** Nach zufällig **10 bis 60 Sekunden** (einstellbar) fällt er in eine zufällige Richtung, **langsam und immer schneller** (ca. 1,6 s). Sein Schatten zeigt sofort, wo er landet, beim Aufschlag dumpfer Schlag und kurzes Beben.
- **Nie auf die Schlange:** Er fällt nur dorthin, wo nichts liegt: nicht auf die Schlange (auch nicht direkt vor oder neben den Kopf), nicht auf Hindernisse, Tiere, Gegner, Apfel, Power-ups oder Eis, und er schließt nichts ab. **Liegt die Schlange rundherum, hält sie ihn auf:** Er wartet und versucht es alle 0,5 s wieder.
- **Danach liegt er** als umgefallener Tannenbaum, 6 Felder, **symmetrisch**: **1-1-3-1** entlang seiner Richtung, also zwei Felder Stamm, dann die Krone drei Felder breit (ein Feld zu jeder Seite), dann die Spitze. Die Krone ist das Dreieck, der Stamm hat eine Schnittfläche mit Jahresringen. Beim Aufbau einer Welt (Startlevel, Kreativ-Springen, Sandbox) liegen die Bäume schon.
- Ab Level 60 **alle 40 Level ein neuer** (60, 100, 140, 180 …). Er **bleibt für immer** liegen.
- Steht an zufälliger Stelle, mit Abstand zur Schlange, nie vor dem Kopf, schließt nie einen Bereich ab.
- Höchstens einer je ca. 150 Felder. Ist die Karte voll, kommt keiner mehr dazu.
- Berühren = Tod, stehend wie liegend (auch während er fällt).

## 10. Giftwolken (ab Level 110)

- Etwa **alle 5 bis 7 Level** (ab Level 190 alle 4 bis 6) entsteht eine Wolke auf einem Feld.
- **Alle 5 Sekunden wird sie größer:** 1 Feld → Kreuz (Feld oben, unten, links, rechts dazu) → 3 × 3 (die Ecken dazu) → 3 × 3 mit Spitzen → 5 × 5 → 5 × 5 mit Spitzen.
- Wie groß sie maximal wird, steigt mit dem Level: bis 3 × 3 (Level 110), mit Spitzen (160), 5 × 5 (210), 5 × 5 mit Spitzen (260).
- **1 Sekunde vor dem Wachsen** pulsieren gestrichelte Kreise dort, wo sie gleich hinwächst. Zischgeräusch.
- Nach der größten Stufe bleibt sie 5 Sekunden und löst sich dann auf.
- Wächst sie auf die Schlange, kommen diese Felder erst dazu, wenn die Schlange weg ist. Den Apfel schiebt sie woanders hin, Giftäpfel verschwinden darin.
- **Hineingeraten = 10 Level zurück** (siehe Rückschläge).

## 11. Frösche (ab Level 30)

- Etwa **alle 1 bis 3 Level** springt ein Frosch auf die Karte (ab Level 190 öfter), **höchstens 6 gleichzeitig**. So sind oft 4 oder mehr unterwegs. Sie kommen lange vor den Gegner-Schlangen.
- Er schaut in eine Richtung und **hüpft alle 3 Sekunden ein Feld** weit.
- **1 Sekunde vor dem Sprung** macht er sich bereit: Hinterbeine spreizen sich, der Körper duckt sich nach hinten (Anlauf).
- **Sprung:** Er hebt im Bogen ab, die Hinterbeine strecken sich, der Schatten bleibt am Boden. Leises Ploppen.
- **Richtungswechsel:** Nach jedem Sprung mit **20 % Chance** schaut er 0,25 s nach der Landung in eine andere Richtung und springt beim nächsten Mal dorthin.
- **Nie in die Schlange:** Liegt die Schlange auf dem Zielfeld (oder ein Hindernis), dreht er sich in eine freie Richtung und nimmt neu Anlauf. Durch Giftwolken hüpft er hindurch.
- Landet er auf dem Apfel, schnappt er ihn sich (Apfel liegt danach woanders).
- Über den Kartenrand hüpft er weg und verschwindet.
- Die Schlange kann gegen ihn laufen = sofort Tod.

## 12. Hütten und Häuser (ab Level 80)

- **Klein angefangen:** Ab Level 80 kommen **Hütten** (2 × 2 Felder). Ab Level 130 kommen **große Häuser**: **2 × 3 Felder** oder **mit einer Ecke** (Reihen 2, 2, 3, 3 Felder, also 10 Felder), zufällig gedreht und gespiegelt.
- **Alle 30 Level eins** (80, 110 Hütten, 140, 170, 200 … Häuser). Es **bleibt stehen**. Höchstens eins je ca. 250 Felder.
- Von oben gesehen: Ziegeldach, Kamin mit Rauch.
- **Vier Fenster**, eins an jeder Seite (oben, unten, links, rechts).
- **Nach jedem Apfel wechselt das Licht:** In jedem Haus leuchtet dann ein anderes Fenster gelb. Das Licht strahlt **immer 2 Felder tief** nach außen, bei Hütten genauso. Ein Fenster, vor dem dafür kein Platz ist (Kartenrand, Haus, Baum oder Turm), leuchtet nicht.
- **Nie auf die Schlange:** Es wird nur ein Fenster gewählt, dessen Licht kein Feld der Schlange berührt (möglichst auch nicht direkt vor dem Kopf). So gibt es keinen Sofort-Treffer.
- **Zugebaut = dunkel:** Kann kein Fenster leuchten (vor keinem 2 Felder Platz oder die Schlange liegt überall davor), bleibt das Haus diese Runde dunkel. So kann man sich bewusst Platz schaffen.
- **Haus berühren = Tod** (sofort).
- **Ins Licht laufen = 5 Level zurück.**

## 12a. Jägertürme (ab Level 160)

- Runder Steinturm mit Zinnen, **2 × 2 Felder**, oben ein Scheinwerfer.
- Ab Level 160 **alle 40 Level ein neuer** (160, 200, 240 …), bleibt stehen. Höchstens einer je ca. 300 Felder.
- **Lichtkegel:** 2 Felder breit, **6 Felder lang**, in die Richtung, in die der Scheinwerfer zeigt.
- **Jede Runde (nach jedem Apfel) dreht er sich eine Vierteldrehung im Uhrzeigersinn** (oben → rechts → unten → links). Der Scheinwerfer schwenkt sichtbar mit.
- Der Kegel endet am Kartenrand, an Häusern, Bäumen und anderen Türmen. **Die Schlange wirft Schatten:** Liegt sie in der neuen Richtung, endet der Kegel vor ihr. So gibt es nie einen Sofort-Treffer, trotzdem dreht der Turm immer weiter.
- Im Kegel = **10 Level zurück**, Turm berühren = sofort Tod.

## 12a2. Eis (ab Level 120)

- Ab Level 120 **alle 30 Level ein Eisfeld** (120, 150, 180 …), **4 bis 10 Felder** groß, zusammenhängend, bleibt liegen. Höchstens eins je ca. 300 Felder.
- Hellblau mit wanderndem Glanz und feinen Rissen.
- **Auf Eis kann man nicht lenken:** Solange der Kopf auf Eis ist, rutscht die Schlange geradeaus, gedrückte Richtungen verfallen. Erst wieder auf normalem Boden lenkt man.
- Fair: Eis liegt nie am Kartenrand und hat ein Feld Abstand zu festen Hindernissen. Läuft man trotzdem auf etwas zu, ist es sofort vorbei: rechtzeitig vor dem Eis abbiegen.

## 12b. Ameisen (ab Level 140)

- Kleine braune Ameise (Kopf, Brust, Hinterleib, sechs Beine, Fühler). Alle **8 bis 12 Level** setzt sich eine irgendwohin, mit Abstand zur Schlange, höchstens **4** gleichzeitig. Sie bleiben, bis man sie zertritt.
- **Chillt** an ihrem Platz. Kommt irgendein Glied der Schlange in ihren **Umkreis von 2 Feldern** (auch schräg), bemerkt sie dich: rotes **Ausrufezeichen**, leises Kribbeln. Einen Takt später krabbelt sie **langsam** (ein Feld alle 0,8 s) auf das nächste Glied zu, **bis du wieder raus bist**. Dann geht sie zurück nach Hause.
- Ist sie direkt neben einem Glied, **beißt** sie: **3 Level zurück** (Schild fängt ab, nach einem Rückschlag geschützt, als Geist nicht). Danach ist sie 5 s satt und geht heim.
- Sie läuft nie in die Schlange oder in Hindernisse. **Der Kopf zertritt sie** (sie verschwindet, kein Tod): so kann man sich wehren.
- Gerade lange Schlangen, die neben einer Ameise entlangziehen, werden erwischt.

## 12c. Lava (von Anfang an, im Stein)

- **Lava im Stein:** In etwa **30 %** der Blöcke rund um die Karte steckt **ein einzelnes Lavafeld** (mindestens ein Feld vom Blockrand weg). Es liegt fest je Block und Spiel, glüht in der Erde und ist zu sehen, sobald die Kamera dorthin schaut. Die zwei Startblöcke haben keins.
- **Ausbruch:** Kommt der Block zur Karte (neues Gebiet oder Maulwurf), bricht das Feld als **Lavasee** aus, beginnend mit **einem Feld**. Wer ein Gebiet wählt, wählt also auch, ob Lava mitkommt. Liegt dort gerade etwas (Schlange, Apfel, Hindernis) oder ist der Kopf zu nah davor, glimmt das Feld nur und bricht nach einem der nächsten Äpfel aus.
- **Graben:** Mit dem Maulwurf in ein Lavafeld im Stein graben = Tod.
- **Jeden 2. Apfel** breitet sich jeder unfertige See um **ein Feld in eine zufällige Richtung** aus. Nie in die Schlange, nie direkt vor oder neben den Kopf, nie über den Apfel, und es wird nichts abgeschlossen (keine Sackgassen).
- Jeder See hat eine zufällige Endgröße zwischen **6 und 15 Feldern**, dann hört er auf. Er bleibt liegen.
- Glühend orange mit dunkler Kruste, Hitzeschein und Blasen, dumpfes Blubbern beim Ausbrechen.
- **Hineinfahren = Tod** (sofort). Gegner, Ameisen und Frösche meiden Lava.

## 13. Rückschläge (Giftwolke −10, Fensterlicht −5, Jägerturm −10, Ameise −3)

- Nur der **Kopf** zählt. Ein Rückschlag beendet das Spiel nicht.
- Level sinkt um 10 bzw. 5 (nie unter 1). Die Schlange wird um so viele Glieder kürzer, wie sie in diesen Leveln gewachsen war (mindestens 3 lang). Das Tempo passt sich dem neuen Level an.
- Danach ist die Schlange **gut 2 Sekunden geschützt** und blinkt, damit sie aus der Wolke oder dem Licht herauskommt.
- Absteigende Töne, kräftige Vibration, Bildschirm wackelt kurz, die Levelzahl springt rot nach unten.
- Was schon da ist, bleibt: Karte, Teiche, Bäume, Häuser, Türme. Beim zweiten Erreichen eines Levels kommt nichts doppelt (kein zweiter Block, kein zweiter Teich, Baum, Haus oder Turm).
- Als **Rekord** zählt der höchste erreichte Level der Runde.

## 14. Ereignisse werden häufiger

- Fallen, Wolken, Frösche, Gegner-Schlangen und Ameisen haben eigene Abstände (siehe oben), die ab Level 190 kürzer werden.
- Zusätzlich gilt: **ab Level 170 ist immer mindestens eine** dieser Gefahren unterwegs, **ab 230 mindestens zwei, ab 290 drei**. Fehlt eine, kommt nach ca. 2,5 s eine neue, bevorzugt die Art, die gerade am seltensten ist.

## 14a. Äpfel als Währung, Power-ups, Skins, Minikarte

**Äpfel sind die Währung (keine Münzen, keine echten Käufe)**
- Jeder gegessene Apfel kommt in den **Apfel-Vorrat**. Eingekesselte Gegner-Schlangen bringen extra Äpfel (siehe 8a).
- **Mehr wert mit dem Level:** Bis Level 49 zählt ein Apfel einfach, ab Level 50 doppelt, ab 100 dreifach, ab 150 vierfach und so weiter (nach dem Level, auf dem der Apfel liegt). In der Leiste steht der Faktor neben dem Vorrat.
- **Jede Stufe hat ihre Farbe:** ×1 **Rot**, ×2 **Orange**, ×3 **Gelb**, ×4 **Grün**, ×5 **Türkis**, ×6 **Blau**, ×7 **Lila**, ×8 **Rosa**, ×9 **Übergang Blau → Rosa**, ×10 **Übergang Lila → Rosa** (danach bleibt es bei Lila-Rosa, der Wert steigt weiter). Giftäpfel tarnen sich in derselben Farbe, Funken, Pfeil am Rand, das Apfel-Symbol in der Leiste und die Minikarte übernehmen sie.
- Vorrat oben in der Leiste, im Startmenü (antippen öffnet den Shop) und im Shop. Auf dem Spielende-Bildschirm „+N Äpfel“. Münzen aus früheren Fassungen wurden 1:1 zu Äpfeln.
- Im Kreativ-Modus wird nichts gesammelt.

**Power-ups (ab Level 10)**
- Nach jedem Apfel mit **18 % Chance** liegt ein Power-up auf der Karte (höchstens eins), 15 s lang, blinkt in den letzten 3 s. Leuchtende Kugel mit Symbol.
- **Schild** (blau): **ein Leben mehr.** Fängt einen Aufprall, einen Giftapfel oder einen Rückschlag ab, die Schlange gleitet dann 1,5 s durch. Am **Kartenrand** bleibt sie stehen (kurzes Wackeln), bis du abbiegst. Bis zu 3 sammeln sich, sie **laufen nicht ab**. Angezeigt nur **oben rechts im Spielfeld** als kleines blaues Schild-Symbol (ab zwei mit „×2“, „×3“), nicht mehr als Blase um die Schlange.
- **Garantie:** Spätestens nach **8 Äpfeln** ohne Power-up kommt eins (einstellbar).
- Welches Power-up kommt, ist gewichtet: Schild 3, Zeitlupe 3, Magnet 3, Geist 2, Schere 2, Füttern 2, Spitzhacke 2, Maulwurf 2, goldene Schere 1 (von 20).
- **Spitzhacke** (grau): legt sofort **ein zufälliges Erz** irgendwo in deiner Nähe auf die Karte (Gold 72 %, Diamant 19 %, Rubin 7 %, Opal 2 %). Drüberfahren gräbt es aus.
- **Zeitlupe** (lila): **30 s** lang **30 % langsamer**.
- **Füttern** (rot, Maul): **20 s** lang frisst du **Frösche, Ameisen und Gegner-Schlangen** (rot und lila), statt dich an ihnen zu stoßen, und fährst **durch dich selbst** hindurch (Mauern und andere Hindernisse bleiben tödlich). Frosch = 2, Ameise = 1, Gegner = so viele Äpfel, wie er lang ist (alles mal Apfelwert). Roter Schein um den Kopf. Kommt nur, wenn gerade Tiere oder Gegner da sind.
- **Magnet** (rot, Hufeisen): **15 s** lang wird alles Gute im **Umkreis von 2 Feldern** (auch schräg) **sofort eingesammelt**, ohne Umweg, als wärst du drübergefahren: Apfel (zählt als gegessen), Power-ups, Erze. Gestrichelter Kreis zeigt die Reichweite.
- **Maulwurf** (braun, Schaufel, **ab Level 90**): **20 s** lang kannst du dich **durch die Erde graben**, **ohne Grenze**, so weit hinaus, wie du willst. **Warndreieck:** Das Spiel rechnet bei jedem Schritt den kürzesten Weg zurück auf ein freies Kartenfeld (durch die Erde, der eigene Körper ist im Weg). Reicht die restliche Zeit nur noch für diesen Weg plus **2 Sekunden**, erscheint über dem Kopf ein kleines gelbes Warndreieck mit Ausrufezeichen (einstellbar). Erze im Weg sammelst du sofort ein. Erdkrümel fliegen, die Kamera folgt dir unter die Erde. **Kommst du zurück auf die Karte, wird dein Gang und alles, was er zusammen mit der Karte einschließt, zu Spielfeld** (Klang „Freigelegt“). Ist die Zeit um und der Kopf steckt noch in der Erde: **Spielende** („In der Erde stecken geblieben“).
- **Goldener Apfel** (unbesiegbar): **gibt es nicht**. Das Fressen von Tieren und das Fahren durch sich selbst steckt im Füttern.
- **Goldene Schere** (gold, funkelt, selten, **ab Level 50**): wie die Schere, nur kräftiger: schneidet **dauerhaft** ab, was in den **letzten 8 Leveln** gewachsen ist. Goldene Funken beim Schnitt.
- **Geist** (grau): 6 s lang durch alle Hindernisse und die eigene Schlange, keine Rückschläge; die Schlange ist durchscheinend und flackert kurz vor dem Ende.
- **Schere** (orange): schneidet **dauerhaft** so viel Schwanz ab, wie in den **letzten 3 Leveln** gewachsen ist (bis Level 50 also 1 bis 2 Glieder, danach weniger, weil die Schlange seltener wächst). Mindestens 3 Glieder bleiben. Weiße Schnittlinie mit Funken, das abgeschnittene Stück **bleibt 1 Sekunde liegen** (etwas blasser) und verblasst dann. Es ist kein Hindernis.
- Aktive Power-ups stehen oben links im Spielfeld als kleine Pillen mit Restzeit-Balken (Schilde oben rechts, siehe oben).
- Im Kreativ-Modus lässt sich jedes Power-up in den Kreativ-Optionen sofort aktivieren.

**Skins (Startmenü → Skins)**
- **Vier Grundfarben hat jeder:** Grün, Blau, Gelb, Schwarz.
- Alles andere kauft man mit Äpfeln, nach Stufen geordnet:
  - **Einfarbig (250):** Minze, Himmel, Pfirsich, Flieder, Sand
  - **Kräftig (600):** Koralle, Smaragd, Pink, Türkis, Orange
  - **Muster (1200):** Nacht (Sterne), Tiger (Streifen), Zebra, Leopard (Flecken), Käfer
  - **Elemente (2500):** Glut (Hitzewellen), Eis (Funkeln), Gift (Neonflecken), Tiefsee
  - **Edelmetall (4000):** Gold, Silber, Roségold (laufender Glanz)
  - **Kosmisch (6000):** Galaxie (Sterne), Aurora (Grün-Türkis-Violett wandert)
  - **Legendär (9000):** Regenbogen, Diamant
- Wer früher Koralle, Nacht, Tiger, Gold oder Regenbogen gekauft hat, behält sie.
- Antippen kauft (wenn genug Äpfel) und wählt aus, gekaufte Skins lassen sich jederzeit wechseln. Zu wenig Äpfel: Karte wackelt.

**Minikarte**
- Klein unten links, erscheint erst, wenn die Karte größer als ein Bildschirm ist. Sie zeigt **nur die Kartenblöcke**: **grün** der Block (Quadrant), in dem die Schlange ist, **in Apfelfarbe mit hellem Rand** der Block mit dem Apfel. Keine genauen Positionen. Liegen beide im selben Block, steckt ein Kästchen in Apfelfarbe im grünen Block.

## 15. Fairness-Regeln (für alle Hindernisse)

- Kein neues Hindernis schließt einen Bereich ab: alle freien Felder bleiben vom Kopf aus erreichbar.
- Keine Sackgassen (freies Feld mit nur einem freien Nachbarn), auch der Apfel liegt nie in einer.
- Mauern, Bäume und Häuser entstehen nie im Streifen vor dem Kopf und nie direkt neben der Schlange.
- Mauern wachsen nie unter die Schlange, Wolken warten, bis sie weg ist.

## 16. Menüs und Bildschirme

- **Startmenü:** großer Titel „Snake“ mit Apfel, Kennzeichen „Endlos“, orangener Knopf „Spielen“, bester Level, darunter Anleitung, Statistik, Optionen. Oben rechts Ton an/aus. Im Hintergrund spielt ein Autopilot (gedimmt).
- **Bereit:** Nach „Spielen“ steht die Schlange, eine animierte Hand zeigt „Wischen zum Starten“ (PC: „Pfeiltaste drücken“).
- **Leiste im Spiel:** Pause links, Level groß in der Mitte (ploppt beim Apfel, springt rot bei Rückschlag), Apfel-Vorrat mit Faktor und Rekord mit Pokal rechts, darunter der Balken bis zum nächsten Block. Im Kreativ-Modus steht „Level · Kreativ“.
- **Keine Hinweise:** Neue Gefahren, Erze, Rückschläge, Erfolge usw. werden im Spiel nicht angesagt, der Spieler findet alles selbst heraus (die Anleitung erklärt alles). Einzige Ausnahme: „Öffne eine Wand“, wenn ein neues Gebiet gewählt werden darf. Im Kreativ-Modus meldet „Kein Platz“, wenn ein Objekt nicht passt.
- **Pause:** Weiter, Neu starten, Anleitung, Optionen, Menü. Pausiert automatisch, wenn die App in den Hintergrund geht oder das Fenster den Fokus verliert.
- **Spielende:** wackelndes Bild der Todesursache, Text (z. B. „Gegen einen Baum gelaufen“), erreichter Level, ggf. „Höchster Level“, Abzeichen „Neuer Rekord“ mit Fanfare, Äpfel, Länge, Zeit. Knöpfe „Nochmal“ und „Hauptmenü“.
- **Anleitung:** alle Elemente mit Bild, „ab Level …“ und Erklärung.
- **Statistik:** bester Level, Spiele, Äpfel gesamt, längste Schlange, größte Karte, eingekesselte Gegner, Spielzeit.
- **Optionen:** Töne, Musik, Vibration, Steuerkreuz, Tempo (Langsam/Normal/Schnell), Kamera (Bereich/Dynamisch), Statistik zurücksetzen, Versionsnummer.
- **Android-Zurücktaste:** Spiel → Pause, Pause → weiter, Unterseite → zurück, Startmenü → App schließen.

## 16-1. Tagesrekord und Erfolge

- **Tagesrekord:** In der Leiste neben dem Rekord steht „heute N“ (der laufende Versuch zählt schon mit), im Startmenü „Heute: N · Rekord: M“, in der Statistik eine eigene Kachel. Auf dem Spielende-Bildschirm gibt es das Abzeichen „Neuer Tagesrekord“, wenn es kein neuer Rekord aller Zeiten ist. Der Tag wechselt um Mitternacht (Gerätezeit).
- **Erfolge** (Statistik-Seite, 23 Stück): z. B. Erster Biss, 500/5000 Äpfel, Level 50/100/200/300/500, 10/100 Spiele, erste und 25 Gegner, lila Gegner, 25 gefressen, 20 Ameisen, 10 Golderze, erster Diamant, Rubin, Opal, 10 Gebiete selbst gewählt, 100 Felder freigelegt, 50 Power-ups, 10 Skins. Jeder mit Fortschrittsbalken (z. B. 830/5000), erreichte mit goldener Medaille, ohne Meldung im Spiel. Kreativ-Runden zählen nicht.
- **Belohnungen** sind vorbereitet, werden aber noch nicht vergeben.

## 16a. Kreativ-Modus

- Im Startmenü „Kreativ-Modus“, in der Pause einer Kreativ-Runde „Kreativ-Optionen“.
- **Startlevel** (1 bis 5000): Die Karte wird so aufgebaut, wie sie bis dahin ungefähr entstanden wäre: alle Blöcke, Teiche (ältere ausgetrocknet), Bäume, Häuser und Türme, dazu Mauern und Giftäpfel für diesen Level. Die Schlange wächst in den ersten Schritten auf ihre Länge.
- **Hindernisse:** Tödlich (normal) / Anhalten (vor jedem Hindernis stehen bleiben, nie sterben) / Geist (durch alles hindurch, nur der Kartenrand hält an).
- **Rückschläge** an/aus (Wolke, Licht, Kegel).
- **Durch die eigene Schlange** an/aus.
- **Schlange wächst** an/aus, sonst **feste Länge** (1 bis 500). Beim Ausschalten im Spiel wird die aktuelle Länge übernommen.
- **Während des Spiels** (Pause → Kreativ-Optionen): alles oben live umschalten, Level **−10 / −1 / +1 / +10** oder direkt springen (höher baut die Welt mit auf, niedriger kürzt die Schlange), **Falle, Wolke, Frosch oder Gegner-Schlange sofort auslösen**.
- **Sandbox** (Schalter im Kreativ-Menü): eigene Welt zum Testen von Mechaniken.
  - **Kartengröße** in Blöcken: Breite und Höhe je 1 bis 8 (ein Block = halber Bildschirm plus ein Feld je Richtung), immer rechteckig.
  - **Länge** der Schlange (1 bis 300), sie wächst in den ersten Schritten darauf.
  - **Objekte:** Anzahl je Art: Mauer, Teich, Giftapfel, Baum, Haus, Turm, Falle, Wolke, Frosch, Gegner rot, Gegner lila, Ameise, Lava, Eis (je 0 bis 50, so viele wie Platz haben).
  - **Danach:** „Bleibt so“ = nichts Neues kommt dazu, Mauern bleiben stehen, nur der Apfel wandert (Mechaniken laufen weiter: Licht wechselt, Türme drehen, Lava wächst, Gegner wachsen, Wolken und Fallen laufen ab). „Normal weiter“ = ab dem Startlevel geht es weiter wie im echten Spiel.
  - Der Startlevel bestimmt dabei Tempo, Apfelwert und was als Nächstes kommt.
- **Im Spiel** (Pause → Kreativ-Optionen): **jedes Objekt sofort dazu** (alle 14 Arten, ohne Level- und Anzahlgrenzen), jedes Power-up sofort (auch Füttern, Magnet, Maulwurf, goldene Schere) und **„Alles von der Karte“**.
- Kreativ-Runden zählen nicht für Rekord und Statistik. In der Leiste steht „Level · Kreativ“.

## 16b. Master-Einstellungen

- Optionen → Master-Einstellungen: **jede Zahl des Spiels** ist einstellbar, nach Gruppen: Karte (Block alle N Level, bis Level), Schlange (Tempo, Wachsen, Schutzzeit), Mauern, Teiche, Giftäpfel, Bärenfallen, Bäume, Giftwolken, Frösche (Häufigkeit, Sprungtakt, Wende-Chance, Höchstzahl), Gegner-Schlangen (ab Level, Häufigkeit, Höchstzahl, Wachsen, Höchstlänge), Power-ups und Äpfel (Chance, Dauer, Schere, Apfelwert), Häuser (Häufigkeit, Lichtweite, Strafe), Jägertürme (Häufigkeit, Kegellänge, Strafe), Ereignisse (Mindestanzahl ab Level, früher häufiger).
- **Zeitleiste** ganz oben (aufklappbar): was bei welchem Level kommt, aus den aktuellen Zahlen berechnet, bis Level 500. Jede kleinste Änderung hat einen Eintrag (neuer Block, Mauerlänge, Teichgröße, Anzahl Giftäpfel, Apfelwert und Farbe, Wachsen, Höchsttempo, Ereignisse, Höchstzahl Gegner, Wolkenstufe, jeder Baum, jede Hütte, jedes Haus, jeder Turm, jeder Lavasee …), farbig nach Art. Darüber die dauerhaften Regeln (Tempo je Level, zufällige Abstände, Power-up-Chance). Ändert man eine Zahl, ändert sich die Zeitleiste sofort.
- Neue Gruppen: Gegner-Schlangen (mit lila), Ameisen, Lava, Eis, Erze unter der Erde, Häuser mit „Große Häuser ab Level“; bei den Power-ups Dauer von Füttern, Magnet (und Reichweite), Maulwurf, Schere und goldene Schere (wie viele Level Schwanz), Warndreieck beim Graben, Bäume (wie lange sie stehen) und Zeitlupe (und um wie viel %); Reaktionszeit vor dem Aufprall (Schlange) und Reaktionsweite der Gegner.
- Gilt ab dem nächsten Spiel, auch im Kreativ-Modus. „Alles auf Standard“ setzt zurück. Gespeichert wird nur, was vom Standard abweicht: neue Standardwerte gelten so für alle. Die Anleitung rechnet mit den eingestellten Werten.

## 17. Töne, Musik, Vibration

- Alle Töne werden im Gerät erzeugt (Web Audio), keine Audiodateien: Klick, Biss, Zehner-Akkord, neues Gebiet, Hinweis, Tod (je nach Ursache: Falle schnappt, Teich platscht, Giftapfel wabert), Falle, Wolke zischt, Frosch quakt und ploppt beim Sprung, Gegner zischt beim Erscheinen und ploppt beim Einkesseln, Jägerturm, Apfel geschnappt, Teich blubbert, Baum fällt, Haus wird gebaut, Licht klickt, Rückschlag, Rekord-Fanfare.
- **Musik:** ruhige Schleife in a-Moll (Am, F, C, G) mit Bass und leisen Hi-Hats, im Menü und in der Pause leiser.
- **Vibration:** leicht beim Apfel, mittel bei der Falle, kräftig bei Tod und Rückschlag, „Erfolg“ beim neuen Gebiet. In der App über Capacitor Haptics, im Browser über die Vibrations-Schnittstelle.

## 18. App und Technik

- **Android-App:** Jeder Push baut auf GitHub die APK, beim Hauptzweig hängt sie am Release „latest“ (`snake-endlos.apk`). Hochformat, Vollbild (Status- und Navigationsleiste ausgeblendet), eigenes Icon und Startbild, fester Signaturschlüssel (Updates ohne Deinstallieren).
- **Web-App (PWA):** offline spielbar, installierbar („Zum Home-Bildschirm“), Vollbild. Veröffentlichung über GitHub Pages (einmalig in den Einstellungen aktivieren).
- **Speicher:** Rekord, Statistik und Einstellungen nur auf dem Gerät.
- **Leistung:** Gezeichnet wird nur der sichtbare Teil der Karte. Der Aufbau nach jedem Apfel (Mauern, Giftäpfel, Apfel, Power-ups) wurde stark beschleunigt: Schlange als Nachschlage-Tabelle statt Durchsuchen, Platz-Prüfungen nur einmal je Runde, Verbindungsprüfung, die früh abbricht, freie Felder nur einmal je Apfel gesucht. Ab Level 200 im Mittel 2,7 statt 11,4 ms je Apfel-Takt (am PC gemessen), Spitzen 15 statt 38 ms.
- **Tests:** 96 automatische Tests (neu: Scheren schneiden dauerhaft 3 bzw. 8 Level Schwanz, Stück liegt 1 s, Warndreieck beim Graben; Bäume stehen und kippen, nie auf die Schlange, Schlange hält sie auf; goldene Schere; Maulwurf ohne Grenze; davor Schild als Leben ohne Ablauf und Halt am Kartenrand, 10 ms Reaktionszeit, Gegner zerplatzen bei bis zu 3 Feldern, Baum 1-1-3-1, Haus nach dem Baum, Füttern durch sich selbst, kein goldener Apfel; davor Schere wirft Glieder ab; Spitzhacke, Rubin und Opal, Power-up-Garantie, Gebiets-Wahl mit Zeitlimit, Gebiete nach 300; Füttern, goldener Apfel, Magnet, Maulwurf mit Freilegen und Ersticken, Erze, Gebiet wählen, Eis; außerdem Regeln, Kartenblöcke, Giftapfel, Fallen, Wolken, Frösche, Gegner-Schlangen rot und lila mit Ausweichen, Tempo, Einkesseln, Befreien und Wachsen, Ameisen, Lava, Sandbox, Zeitleiste, Bäume, Hütten, Häuser, Licht, Türme, Rückschläge, Kreativ-Modus, Äpfel als Währung, Power-ups und Schere, lange Spiele bis über Level 300 mit Autopilot).
- **Zum Ausprobieren:** Kreativ-Modus (siehe 16a). In der Web-Fassung zusätzlich `?level=210` und `?auto=1` (Autopilot).
