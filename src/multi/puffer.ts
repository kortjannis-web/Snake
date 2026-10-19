/**
 * Jitter-Puffer fuer den gespiegelten Stand (Mehrspieler). Der Rechner schickt alle 50 ms einen Stand mit
 * seiner Sendezeit. Im Netz kommen sie aber nicht gleichmaessig an (Funkloch, WLAN-Wechsel, TCP wartet auf
 * ein verlorenes Paket und liefert dann alles auf einmal): wuerde man jeden Stand sofort zeigen, ruckelt die
 * Schlange. Hier wird jeder Stand zu einem festen Zeitpunkt abgespielt: Sendezeit + schnellster Weg der
 * letzten Sekunden + eine kleine Wartezeit, die mit dem Jitter waechst und schrumpft.
 *
 * Die Uhren von Rechner und Zuschauer laufen unterschiedlich (`performance.now()` hat auf jedem Geraet einen
 * anderen Nullpunkt). Das macht nichts: gemessen wird nur `Empfang - Senden`, und der kleinste Wert
 * der letzten Sekunden gilt als "kein Stau".
 */

/** Wie lange (ms) ein Messwert fuer den schnellsten Weg gilt */
const FENSTER_MS = 6000
const EIMER_MS = 1000
/** Kleinste und groesste Wartezeit (ms) */
export const WARTE_MIN = 60
export const WARTE_MAX = 220

export class Jitterpuffer {
  /** Kleinster Wert von (Empfang - Senden) je Sekunde */
  private eimer: { bis: number; min: number }[] = []
  private mittel = 0
  private streuung = 0
  private n = 0
  private letzterPlan = -Infinity

  /** Aktuelle Wartezeit (ms) */
  get warte() {
    if (this.n < 4) return WARTE_MIN + 40
    return Math.min(WARTE_MAX, Math.max(WARTE_MIN, WARTE_MIN + 3 * this.streuung))
  }
  /** Mittlere Verspaetung (ms) ueber dem schnellsten Weg */
  get jitter() {
    return this.mittel
  }

  private minimum(r: number) {
    this.eimer = this.eimer.filter((e) => r - e.bis < FENSTER_MS)
    return Math.min(...this.eimer.map((e) => e.min))
  }

  /**
   * Ein Stand kam an. `senden` = Sendezeit beim Rechner, `empfang` = lokale Zeit jetzt (beide ms).
   * Gibt die lokale Zeit zurueck, zu der er angewendet werden soll (nie vor dem vorigen).
   */
  plane(senden: number, empfang: number): number {
    const o = empfang - senden
    const letzter = this.eimer[this.eimer.length - 1]
    if (letzter && empfang < letzter.bis) letzter.min = Math.min(letzter.min, o)
    else this.eimer.push({ bis: empfang + EIMER_MS, min: o })
    const schnell = this.minimum(empfang)
    const zuviel = Math.max(0, o - schnell)
    this.n++
    this.mittel += 0.1 * (zuviel - this.mittel)
    this.streuung += 0.1 * (Math.abs(zuviel - this.mittel) - this.streuung)
    // Zu spaet fuer die Wartezeit: sofort anwenden, der Puffer waechst ueber die Streuung nach
    const plan = Math.min(Math.max(this.letzterPlan, senden + schnell + this.warte), empfang + WARTE_MAX * 2)
    this.letzterPlan = plan
    return plan
  }

  /** Anderer Absender oder neuer Stand von Grund auf: Messung vergessen */
  zuruecksetzen() {
    this.eimer = []
    this.mittel = this.streuung = this.n = 0
    this.letzterPlan = -Infinity
  }
}
