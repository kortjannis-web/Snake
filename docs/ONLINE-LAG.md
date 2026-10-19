# Online-Lag: Ursachen und Gegenmittel

Stand: Version 1.29.0. Gilt für Gegeneinander, Koop, Apfeljagd und Zone (ein Feld, ein „Rechner“). Das Wettrennen rechnet
jeder bei sich und schickt nur Positionen, es ist vom Lag viel weniger betroffen.

## So ist es gebaut

```
Zuschauer ──dir──▶ Server (Cloudflare) ──dir──▶ Rechner (Handy des Gastgebers)
Zuschauer ◀──z────  Server               ◀──z──  Rechner  (alle 50 ms, nur Änderungen)
```

Ein Handy rechnet das ganze Spiel, der Server reicht nur durch. Das ist günstig (Gratis-Tarif), hat aber Folgen.

## Gemessen

Erste Messung (1.29.0) lag zu niedrig, weil die Schlangen dort nicht gelenkt wurden und kaum aßen. Mit Autopilot für
alle Schlangen (wie echtes Spielen) schickte der Rechner **5 KB/s bei 2 und 28 KB/s bei 4 Spielern**, 21 Nachrichten je
Sekunde, 95 % davon die kompletten Schlangen. Seit 1.31.0 siehe unten: **0,9 KB/s bzw. 2,9 KB/s, 8 bzw. 12 Nachrichten
je Sekunde.** Einen Stand zu bauen kostet ~0,1 ms.

## Ursachen (nach Wirkung sortiert)

1. **Kein Jitter-Puffer.** Jeder Stand wurde sofort gezeigt. Mobilfunk und WLAN liefern aber ungleichmäßig, und TCP
   (WebSocket) hält nach einem verlorenen Paket alles dahinter zurück und liefert dann alles auf einmal. Folge: Die
   Schlange steht, springt dann mehrere Felder, und die gespiegelte Spielzeit lief nach jedem Stand ein Stück zurück
   (Sägezahn). Das sieht man als „Ruckeln“, auch wenn der Ping gut ist. *Behoben mit dem Puffer (siehe unten).*
2. **Zwei Wege für jede Eingabe.** Zuschauer → Server → Rechner, dann Rechner → Server → Zuschauer: Ping des Zuschauers
   plus Ping des Rechners. Der Rechner selbst hat gar keine Verzögerung, die anderen immer. Das bleibt, solange ein
   Handy rechnet (siehe Stufe 3).
3. **Der Rechner ist der Engpass.** Hängt sein Handy (Ruckler beim Zeichnen, Hitze, Akku-Sparmodus, Benachrichtigungsleiste,
   Anruf), hängt das Spiel für alle, weil die Berechnung am Zeichnen hängt. Fällt er aus, merkt der Server das erst nach
   2,5 s, und das neue Handy macht mit dem letzten Stand weiter (kurzer Rücksprung).
4. **Funkloch / Netzwechsel erkennt der Browser spät.** WLAN ↔ Mobilfunk, Aufzug, Tunnel: die Verbindung wirkt offen,
   es kommt aber nichts. Bisher: bis zu 8 s, bis die App neu verbunden hat, danach 1 s Pause.
5. **Sendestau beim Rechner.** Ist der Upload schlecht, sammelt der Browser Nachrichten (`bufferedAmount`). Alle 50 ms
   noch eine dazuzulegen macht den Stau größer, und alle Zuschauer bekommen später alte Stände im Schwung.
6. **Serverstandort.** Ein Raum liegt bei Cloudflare dort, wo ihn der erste Spieler anfordert. Bei VPN, Roaming oder
   einem Umweg über ein fernes Rechenzentrum liegt er dann weit weg von allen.
7. **Uhrabgleich mit einer Messung.** Die Server-Uhr wurde bei jedem Pong hart neu gesetzt (auch bei einer langsamen
   Antwort). Betrifft vor allem Countdown und Start, nicht die Bewegung.

## Was jetzt drin ist (1.29.0)

| Maßnahme | Wirkung | Wo |
|---|---|---|
| **Jitter-Puffer**: jeder Stand trägt die Sendezeit des Rechners (`s`); der Zuschauer spielt ihn zu *Sendezeit + schnellster Weg + Wartezeit* ab. Die Wartezeit (60 bis 220 ms) wächst mit dem Jitter und schrumpft wieder. | Gleichmäßige Bewegung statt Ruckeln. Kostet ~100 ms Anzeigeverzögerung bei ruhigem Netz; die eigene Schlange biegt dank Vorhersage trotzdem sofort ab. | `src/multi/puffer.ts`, `client.ts` |
| **Spielzeit springt nie zurück** (steht bei Verspätung kurz still). | Kein Zucken mehr nach jedem Stand. | `client.ts` (`frame`) |
| **Schnellere Verbindungsprüfung**: Ping jede Sekunde, tot nach 3,5 s (vorher 2 s/6 s), erster neuer Versuch nach 150 ms (vorher 1 s). | Funkloch wird in ~4 s statt ~8 s überbrückt. | `client.ts` |
| **Sofort prüfen** bei `online`-Ereignis (Netz wieder da) und bei Rückkehr in die App: Ping, kommt in 1,5 s nichts, neu verbinden. | Netzwechsel kostet ~1,5 s statt bis zu 8 s. | `client.ts` (`pruefen`) |
| **Sendestau-Schutz**: Staut sich mehr als 8 KB, lässt der Rechner Stände aus (Änderungen bleiben liegen und kommen im nächsten mit; Ereignisse gehen immer). | Kein Aufstauen, kein „alles auf einmal“. | `client.ts` (`versenden`) |
| **Raum in Westeuropa** (`locationHint: 'weur'`). | Server nahe bei allen Spielern, auch bei VPN oder Roaming. | `server/index.ts` |
| **Uhrabgleich** nur mit schnellen Antworten, sanft nachgezogen. | Stabiler Countdown. | `client.ts` (`uhrAbgleichen`) |
| **Lag-Anzeige**: App mit `?lag=1` öffnen (bleibt gemerkt, `?lag=0` schaltet aus). Unten links: Rolle, Ping (Max), Jitter, Pufferzeit, Rechner-Wechsel, Neuverbindungen, übersprungene Stände. | Zeigt beim nächsten Lag sofort, ob es Netz (Ping/Jitter), Rechner-Handy (viele Wechsel) oder Upload (Stau) ist. | `ui.ts` |

Rechner und Zuschauer müssen **nicht** dieselbe Version haben, damit der Puffer wirkt: Ein alter Rechner schickt keine
Sendezeit, dann zeigt der neue Zuschauer die Stände wie bisher sofort. Das Protokoll (`PROTOKOLL`) bleibt deshalb bei 2.

## Weniger Daten und weniger Ruckeln (1.31.0)

**Online (Protokoll 3, alte Apps bekommen „Bitte aktualisieren“):**

| Maßnahme | Wirkung | Wo |
|---|---|---|
| Schlangen kompakt: nur Schlangen, die sich geändert haben, und davon nur die geänderten Felder (`sd`). Ein Körper nach einem Schritt ist „neuer Kopf vorn, Länge n“, `prev` ist dann nur `'b'` (= alter Körper). | 4 Spieler: 28 → 3,4 KB/s | `src/multi/kompakt.ts` |
| Kommazahlen gerundet (`18453.500000000382` → `18453.5`) | weitere ~10 % | `runden` |
| Ändert sich nur die Spielzeit, geht ein Stand nur alle 150 ms raus (Zuschauer lassen die Zeit selbst laufen) | 21 → 12 Nachrichten/s bei 4, 8/s bei 2 Spielern (auch gut fürs Gratis-Kontingent von Cloudflare) | `client.ts` |
| Der Server merkt sich weiter den ganzen Stand (für den Rechnerwechsel) | neuer Rechner bekommt vollständige Schlangen | `server/raum.ts` |

Geprüft: Nach jedem Stand hat der Empfänger genau die Schlangen des Rechners (`test/kompakt.test.ts`), auch über
die ganze Kette Rechner → Server → Zuschauer mit Jitter-Puffer (`test/kette.test.ts`).

**Zeichnen (gemessen im echten Spiel, Handygröße, CPU gedrosselt, Hauptthread-Zeit je Bild):**

| Maßnahme | Wirkung | Wo |
|---|---|---|
| Wüste: Meer-Kacheln über Land werden übersprungen; alle Ebenen (Grund, bewegte Oberfläche, 3 Gischtbänder) werden in einem kleinen Zwischenbild zusammengelegt und einmal hochskaliert; das Wasser wird 30-mal je Sekunde neu gemischt | Wüste: Rechenzeit je Bild etwa halbiert, sieht gleich aus (Bildvergleich: im Mittel 1 von 255 Abweichung, nur durch den Zeitpunkt der Wellen) | `renderer.ts` (`meerZeichnen`) |
| Neue Meer-Kachel ~40 % schneller (Rauschen ohne Umweg, keine neuen Listen je Pixel), Pixel für Pixel gleich | weniger Hänger beim Erkunden; Lava, Teiche und Eis profitieren mit | `flaechen.ts` |
| Karte wächst: Bodenkacheln entstehen schon während der 2,6 s Aufklapp-Animation (eine je Bild); Meer-Kacheln bleiben und werden nach und nach erneuert | Kein Hänger mehr bei jedem neuen Gebiet (vorher entstanden alle sichtbaren Kacheln im selben Bild) | `grundVorbereiten`, `meerZeichnen` |
| Schwaches Gerät: unter ~40 Bildern/s über 4 s wird mit 2 statt 2,5 Pixeln je Punkt gezeichnet (ein Drittel weniger Pixel) | Nur einmal, nur auf Geräten mit mehr als 2; gute Handys merken nichts | `main.ts` (`tempoPruefen`) |

**Dateien:**

| Maßnahme | Wirkung |
|---|---|
| Shop-Videos nicht mehr im Vorab-Download der Web-App (es gab jedes doppelt: MP4 und WebM). Sie kommen beim ersten Ansehen und bleiben gespeichert. | Installation/Update: ~4,7 MB → ~1 MB |
| APK ohne WebM (Android spielt MP4) | APK ~1,8 MB kleiner |

## Wie man den Lag eingrenzt

Mit `?lag=1` spielen und beim Ruckeln auf die Zeile achten:

- **Ping hoch oder Jitter hoch** bei allen: Netz (WLAN statt Mobilfunk, Router, Funkloch).
- **Ping gut, aber Wechsel steigt**: Das Rechner-Handy hängt oder geht in den Hintergrund. Ein stärkeres Handy sollte
  Gastgeber sein, bei dem Gastgeber nichts anderes laufen lassen und Energiesparmodus aus.
- **Stau steigt** beim Rechner: schlechter Upload dort.
- **Neu steigt** bei einem Spieler: dessen Verbindung reißt (Netzwechsel).

## Noch offen (größere Schritte, nur auf Wunsch)

**Stufe 2 (klein):** Rechner-Ausfall schneller erkennen (`RECHNER_STILL` von 2,5 s auf ~1,5 s) und beim Handover den
letzten Stand nicht zurückspulen, sondern aus dem Zuschauer-Spiel weiterrechnen. Erst sinnvoll, wenn `Wechsel` in der
Lag-Anzeige wirklich oft steigt (zu kurz erzeugt Fehlwechsel mit Rücksprung).

**Stufe 3 (groß, die eigentliche Lösung):** Das Spiel auf dem **Server** rechnen (im Durable Object, 20 bis 30 Schritte/s).
Dann gibt es keinen Rechner mehr, der hängen kann, keinen Handover, und jede Eingabe braucht nur *einen* Weg (Ping statt
Ping + Ping). Die Spiellogik (`src/game/mehr.ts`) kennt weder Canvas noch DOM und wird vom Server schon teilweise
importiert, es ist also machbar. Der Aufwand liegt in: Spielschleife im Raum, Eingaben mit Zeitstempel,
Zustand je Spieler zuschneiden, Tests gegen den echten Server. Der Gratis-Tarif reicht (ausgehende Nachrichten kosten
nichts, eingehende WebSocket-Nachrichten zählen nach Cloudflare-Angabe 20:1, bitte vor dem Umbau nachprüfen), die Laufzeit-Kontingente sollten vorher in Cloudflare unter *Workers → Durable Objects → Metrics*
geprüft werden: Wird das Tageslimit erreicht, bricht der Server mitten im Spiel ab, was wie Lag aussieht.
