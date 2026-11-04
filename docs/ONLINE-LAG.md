# Online-Lag: so ist es gebaut

Stand: Version 1.56.0. Gilt für Gegeneinander, Koop, Apfeljagd und Zone (ein Feld). Das Wettrennen rechnet jeder bei sich
und schickt nur Positionen, daran hat sich nichts geändert.

## Seit 1.56: Der Server rechnet, jedes Handy rechnet voraus

Bis 1.55 rechnete das Handy des Gastgebers das Spiel, der Server reichte nur durch. Jede Eingabe eines Mitspielers ging
zweimal durchs Netz (zum Server, zum Gastgeber, zurück), der Stand wurde vor der Anzeige 60 bis 220 ms gepuffert, und
ruckelte das Gastgeber-Handy, ruckelte das Spiel für alle. Das ist jetzt weg:

```
Handy ──dir (Schritt n)──▶ Server (Cloudflare, Durable Object)  rechnet das Spiel, 280 ms hinter der Echtzeit
Handy ◀──dir (an alle)────  Server                                jeder Wischer sofort an alle
Handy ◀──z (alle 100 ms)──  Server                                Stand (nur Änderungen) mit Schrittnummer
```

- **Feste Schritte:** Server und Handys rechnen in Schritten von 20 ms (`SIM_MS`), ein Wischer gilt jeweils vor einem
  Schritt. Gleicher Start (Seed), gleiche Wischer, gleiche Schritte: alle rechnen genau dasselbe aus
  (`src/multi/sim.ts`, getestet in `test/online-vorhersage.test.ts` und gegen einen echten `wrangler dev`).
- **Eigene Schlange wie offline:** Ein Wischer wirkt auf dem eigenen Handy sofort (im selben Frame) und geht mit seiner
  Schrittnummer an den Server. Der Server rechnet `VERZUG_MS` = 280 ms hinter der Echtzeit, also kommt der Wischer
  rechtzeitig an und gilt dort im selben Schritt. Nichts wird zurückgesetzt.
- **Die Gegenwart wird vorausgerechnet:** Jedes Handy hält den letzten Server-Stand und rechnet ihn mit allen bekannten
  Wischern bis zur Echtzeit weiter (~15 Schritte, ~1 ms). Bewegung und Zeit laufen dadurch so gleichmäßig wie offline,
  egal wie ungleichmäßig die Stände ankommen. Gezeichnet wird mit der Zeit zwischen zwei Schritten (weich wie offline).
- **Fremde Schlangen:** Biegt ein Mitspieler ab, erfährt man es nach seiner Laufzeit plus der eigenen (typisch 30 bis
  100 ms). Bis dahin fährt seine Schlange in der Vorhersage geradeaus, dann wird ab dem Server-Stand neu gerechnet.
  Bei ~130 ms je Feld ist das meist unsichtbar, höchstens ein Feld.
- **Kein Gastgeber-Handy mehr als Engpass:** Kein Handy kann das Spiel für die anderen aufhalten. Geht eine App in den
  Hintergrund, holt sie beim Zurückkommen in wenigen Frames auf (höchstens 60 Schritte je Frame).
- **Ereignisse** (Töne, Effekte) kommen aus der Vorhersage, und zwar nur beim ersten Mal (beim Neurechnen nicht noch
  einmal). Wer **raus** ist und wann das Spiel **endet**, entscheidet nur der Server.
- **Zu spät:** Ist ein Wischer länger als 280 ms unterwegs (Funkloch), gilt er im nächsten Schritt, den der Server noch
  nicht gerechnet hat; das Handy bekommt das bestätigt und rechnet neu (die eigene Schlange springt dann einmal).

## Kosten (Gratis-Tarif)

Gemessen (4 Spieler, 3 Minuten Apfeljagd, `RaumLogik` in Node): **2 bis 3 ms Rechenzeit je Spielsekunde** für den ganzen
Raum (50 Schritte und 10 Stände je Sekunde). Der Durable Object lief schon bisher die ganze Zeit, solange jemand
verbunden war (die Dauer zählt also gleich). Jede eingehende WebSocket-Nachricht gibt dem Objekt neue Rechenzeit; damit
das auch im Gratis-Tarif (dort sind die Grenzen je Aufruf knapper) sicher reicht, pingt jedes Handy alle 0,5 s.
Eingehende Nachrichten zählen 20:1 als Anfrage: 4 Spieler mit Ping und Wischern sind ~0,5 Anfragen je Sekunde, also
~1.800 je Spielstunde (100.000 am Tag frei). Daten: 10 bis 20 KB/s an jedes Handy (ausgehend kostet nichts).

**Nach dem Ausrollen prüfen:** Cloudflare → Workers & Pages → snake-server → Logs/Metrics. Steht dort „Exceeded CPU“
oder bricht ein Spiel mit „Verbindung weg“ ab, ist das Rechenzeit-Limit erreicht.

## Wie man Lag eingrenzt

App mit `?lag=1` öffnen (bleibt gemerkt, `?lag=0` schaltet aus). Unten links:

- **Ping** (und Maximum): Laufzeit zum Server und zurück.
- **Vorlauf**: so weit (ms) rechnet das Handy über den letzten Server-Stand hinaus (normal ~300 bis 400 ms).
- **Zu spät**: eigene Wischer, die länger als 280 ms zum Server brauchten (Funkloch, sehr schlechtes Netz).
- **Korrektur**: wie oft das Neurechnen eine Schlange versetzt hat (meist Mitspieler, die abgebogen sind).
- **Neu**: Neuverbindungen (Netzwechsel).

Steigt **Zu spät** oft, ist das Netz dieses Handys schlecht (WLAN statt Mobilfunk). Ruckelt es ohne dass etwas davon
steigt, ist das Handy selbst überlastet.

## Stellschrauben (`src/multi/protokoll.ts`)

| Wert | Bedeutung |
|---|---|
| `SIM_MS = 20` | Länge eines Schritts. Kleiner = feiner, aber mehr Rechnen auf Server und Handy. |
| `VERZUG_MS = 280` | So lange darf ein Wischer unterwegs sein. Größer = robuster bei schlechtem Netz, aber mehr Vorausrechnen. |
| `STAND_SCHRITTE = 5` | Alle wie viele Schritte der Server seinen Stand schickt (100 ms). Mehr = weniger Daten, aber längeres Neurechnen. |

Jede Änderung an diesen Werten, an den Nachrichten oder an der Spiellogik, die Server und App verschieden rechnen ließe,
braucht ein höheres `PROTOKOLL` (alte Apps werden dann mit „Bitte aktualisiere die App“ abgewiesen).
