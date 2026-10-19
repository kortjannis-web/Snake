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

Datenmenge ist **nicht** das Problem: 3 bis 7 KB/s vom Rechner bei 2 bis 4 Spielern, im Schnitt 27 Byte je Stand
(nur die Zeit ändert sich), Spitzen 1 bis 2 KB. Ein Stand zu bauen kostet ~0,1 ms. Der Lag kommt aus dem **Netz und der
Architektur**, nicht aus der Rechenzeit.

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
