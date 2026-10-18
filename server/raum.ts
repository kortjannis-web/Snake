/**
 * Ein Spielraum (ohne Cloudflare-Teile, damit er sich testen laesst). Der Durable Object in index.ts
 * reicht nur Verbindungen und Nachrichten hierher durch.
 */
import { abstandGrenze, type Ergebnis, type Modus, type SpielerInfo } from '../src/game/mehr'
import { COUNTDOWN, MAX_SPIELER, PROTOKOLL, RECHNER_STILL, type AnServer, type Phase, type StartInfo, type VomServer } from '../src/multi/protokoll'

export interface Kanal {
  send(s: string): void
  close(code?: number, reason?: string): void
}

type Platz = { info: SpielerInfo; kanal: Kanal | null }
type Stand = { a: number; l: number; tot: boolean; raus: boolean; rausBei: number }

const MAX_NACHRICHT = 256 * 1024
const MODI: Modus[] = ['vs', 'koop', 'rennen']

export class RaumLogik {
  plaetze: Platz[] = []
  gastgeber = ''
  phase: Phase = 'lobby'
  modus: Modus = 'vs'
  start: StartInfo | null = null
  /** Letzter Stand des Rechners (Felder zusammengefuehrt) */
  zustand: Record<string, unknown> = {}
  rechner = -1
  letzterStand = 0
  ergebnis: Ergebnis | null = null
  /* Rennen */
  stand: Stand[] = []
  gebiet = 0
  waehler = -1

  constructor(
    readonly code: string,
    private readonly uhr: () => number = () => Date.now(),
    private readonly zufall: () => number = Math.random,
  ) {}

  get leer() {
    return this.plaetze.every((p) => !p.kanal)
  }

  private an(k: Kanal | null, m: VomServer) {
    if (!k) return
    try {
      k.send(JSON.stringify(m))
    } catch {
      /* Verbindung schon weg */
    }
  }
  private anAlle(m: VomServer, ausser?: Kanal) {
    const s = JSON.stringify(m)
    for (const p of this.plaetze) if (p.kanal && p.kanal !== ausser) this.roh(p.kanal, s)
  }
  private roh(k: Kanal, s: string) {
    try {
      k.send(s)
    } catch {
      /* Verbindung schon weg */
    }
  }
  private raumAnAlle() {
    this.plaetze.forEach((p, i) =>
      this.an(p.kanal, {
        t: 'raum',
        code: this.code,
        gastgeber: this.gastgeber,
        phase: this.phase,
        modus: this.modus,
        spieler: this.plaetze.map((q) => ({ ...q.info, online: !!q.kanal })),
        ich: i,
      }),
    )
  }
  private index(k: Kanal) {
    return this.plaetze.findIndex((p) => p.kanal === k)
  }

  /** Neue Verbindung. Gibt false, wenn sie abgelehnt (und geschlossen) wurde */
  beitreten(k: Kanal, p: { id: string; name: string; skin: string; v: number }): boolean {
    const ablehnen = (text: string) => {
      this.an(k, { t: 'fehler', text })
      k.close(4000, text.slice(0, 100))
      return false
    }
    if (p.v !== PROTOKOLL) return ablehnen('Bitte aktualisiere die App, deine Version passt nicht zu den anderen.')
    const name = (p.name || '').trim().slice(0, 16)
    if (!p.id || name.length < 2) return ablehnen('Ohne Namen geht es nicht.')
    const info: SpielerInfo = { id: p.id.slice(0, 64), name, skin: (p.skin || 'klassik').slice(0, 32) }
    const alt = this.plaetze.find((q) => q.info.id === info.id)
    if (alt) {
      // Wiederverbinden (z. B. nach einem Funkloch): alte Verbindung ersetzen
      if (alt.kanal && alt.kanal !== k) alt.kanal.close(4001, 'Neu verbunden')
      alt.kanal = k
      if (this.phase === 'lobby') alt.info = info
    } else {
      if (this.phase !== 'lobby') return ablehnen('Das Spiel in diesem Raum läuft schon.')
      if (this.plaetze.length >= MAX_SPIELER) return ablehnen('Der Raum ist voll (höchstens 4).')
      this.plaetze.push({ info, kanal: k })
    }
    if (!this.gastgeber || !this.plaetze.some((q) => q.info.id === this.gastgeber && q.kanal)) this.gastgeber = info.id
    this.raumAnAlle()
    // Zurueck in ein laufendes Spiel: alles nachreichen
    if (this.phase !== 'lobby' && this.start) {
      this.an(k, { t: 'start', info: this.start, jetzt: this.uhr() })
      if (this.start.modus === 'rennen') {
        if (this.waehler >= 0) this.an(k, { t: 'waehler', k: this.gebiet + 1, wer: this.waehler })
      } else {
        this.an(k, { t: 'rechner', wer: this.rechner })
        if (Object.keys(this.zustand).length) this.an(k, { t: 'voll', z: this.zustand })
      }
      if (this.phase === 'ende' && this.ergebnis) this.an(k, { t: 'ende', ergebnis: this.ergebnis })
    }
    return true
  }

  verlassen(k: Kanal) {
    const i = this.index(k)
    if (i < 0) return
    if (this.phase === 'lobby') this.plaetze.splice(i, 1)
    else this.plaetze[i].kanal = null
    if (this.leer) {
      this.zuruecksetzen()
      this.plaetze = []
      this.gastgeber = ''
      return
    }
    if (!this.plaetze.some((q) => q.info.id === this.gastgeber && q.kanal)) this.gastgeber = this.plaetze.find((q) => q.kanal)?.info.id ?? ''
    if (this.phase === 'spiel' && i === this.rechner) this.rechnerWechseln()
    this.raumAnAlle()
  }

  private zuruecksetzen() {
    this.phase = 'lobby'
    this.start = null
    this.zustand = {}
    this.rechner = -1
    this.ergebnis = null
    this.stand = []
    this.gebiet = 0
    this.waehler = -1
  }

  nachricht(k: Kanal, text: string) {
    const i = this.index(k)
    if (i < 0 || text.length > MAX_NACHRICHT) return
    let m: AnServer
    try {
      m = JSON.parse(text)
    } catch {
      return
    }
    if (!m || typeof m !== 'object' || typeof (m as { t?: unknown }).t !== 'string') return
    const gast = this.plaetze[i].info.id === this.gastgeber
    switch (m.t) {
      case 'ping':
        return this.an(k, { t: 'pong', jetzt: this.uhr() })
      case 'modus':
        if (gast && this.phase === 'lobby' && MODI.includes(m.modus)) {
          this.modus = m.modus
          this.raumAnAlle()
        }
        return
      case 'start':
        if (gast && this.phase === 'lobby') this.starten(i)
        return
      case 'nochmal':
        if (gast && this.phase !== 'lobby') {
          this.zuruecksetzen()
          this.plaetze = this.plaetze.filter((p) => p.kanal)
          this.raumAnAlle()
        }
        return
      case 'z':
        if (this.phase !== 'spiel' || i !== this.rechner || !m.d || typeof m.d !== 'object') return
        if (m.voll) this.zustand = { ...m.d }
        else Object.assign(this.zustand, m.d)
        this.letzterStand = this.uhr()
        for (const p of this.plaetze) if (p.kanal && p.kanal !== k) this.roh(p.kanal, text)
        return
      case 'dir':
        if (this.phase !== 'spiel' || i === this.rechner || !['u', 'd', 'l', 'r'].includes(m.d)) return
        return this.an(this.plaetze[this.rechner]?.kanal ?? null, { t: 'dir', wer: i, d: m.d })
      case 'ende':
        if (this.phase !== 'spiel' || i !== this.rechner) return
        return this.beenden(m.ergebnis)
      case 'abgabe':
        if (this.phase === 'spiel' && i === this.rechner) this.rechnerWechseln()
        return
      case 'pos':
        return this.rennenPos(i, m)
      case 'gebiet':
        return this.rennenGebiet(i, m)
    }
  }

  private starten(von: number) {
    // Wer nicht mehr verbunden ist, spielt nicht mit
    const gastId = this.plaetze[von].info.id
    this.plaetze = this.plaetze.filter((p) => p.kanal)
    if (this.plaetze.length < 2) {
      this.an(this.plaetze.find((p) => p.info.id === gastId)?.kanal ?? null, { t: 'fehler', text: 'Es braucht mindestens 2 Spieler.' })
      this.raumAnAlle()
      return
    }
    const rechner = Math.max(0, this.plaetze.findIndex((p) => p.info.id === gastId))
    const jetzt = this.uhr()
    this.start = {
      modus: this.modus,
      seed: Math.floor(this.zufall() * 2 ** 31),
      spieler: this.plaetze.map((p) => ({ ...p.info })),
      rechner,
      los: jetzt + COUNTDOWN,
    }
    this.phase = 'spiel'
    this.zustand = {}
    this.ergebnis = null
    this.rechner = this.modus === 'rennen' ? -1 : rechner
    this.letzterStand = jetzt + COUNTDOWN
    this.stand = this.plaetze.map(() => ({ a: 0, l: 3, tot: false, raus: false, rausBei: 0 }))
    this.gebiet = 0
    this.waehler = this.modus === 'rennen' ? 0 : -1
    this.raumAnAlle()
    this.anAlle({ t: 'start', info: this.start, jetzt })
    if (this.modus === 'rennen') this.anAlle({ t: 'waehler', k: 1, wer: 0 })
  }

  /** Rechner faellt aus: das naechste verbundene Geraet rechnet mit dem letzten Stand weiter */
  private rechnerWechseln() {
    const n = this.plaetze.length
    for (let s = 1; s <= n; s++) {
      const j = (this.rechner + s) % n
      if (j === this.rechner || !this.plaetze[j].kanal) continue
      this.rechner = j
      this.letzterStand = this.uhr()
      this.anAlle({ t: 'rechner', wer: j })
      this.an(this.plaetze[j].kanal, { t: 'voll', z: this.zustand })
      return
    }
  }

  /** Jede Sekunde: rechnet der Rechner noch? */
  takt() {
    if (this.phase !== 'spiel' || !this.start || this.start.modus === 'rennen') return
    if (this.uhr() - this.letzterStand > RECHNER_STILL) this.rechnerWechseln()
  }

  private beenden(ergebnis: Ergebnis) {
    this.phase = 'ende'
    this.ergebnis = ergebnis
    this.anAlle({ t: 'ende', ergebnis })
    this.raumAnAlle()
  }

  /* ================= Rennen ================= */

  private rennenPos(i: number, m: Extract<AnServer, { t: 'pos' }>) {
    if (this.phase !== 'spiel' || this.start?.modus !== 'rennen' || !Array.isArray(m.b)) return
    const s = this.stand[i]
    if (!s) return
    s.a = Math.max(0, Math.floor(Number(m.a) || 0))
    s.l = Math.floor(Number(m.l) || 0)
    s.tot = !!m.tot
    const geist: VomServer = { t: 'geist', wer: i, b: m.b.slice(0, 600), d: m.d, a: s.a, l: s.l, tot: s.tot, raus: s.raus || !!m.raus }
    this.anAlle(geist, this.plaetze[i].kanal ?? undefined)
    if (m.raus && !s.raus) this.raus(i, 'leben')
    this.rennenPruefen()
  }

  private raus(i: number, grund: 'leben' | 'abstand') {
    const s = this.stand[i]
    s.raus = true
    s.rausBei = this.uhr()
    this.anAlle({ t: 'raus', wer: i, grund })
    if (this.waehler === i) {
      this.waehler = this.naechsterWaehler(i)
      if (this.waehler >= 0) this.anAlle({ t: 'waehler', k: this.gebiet + 1, wer: this.waehler })
    }
  }

  private naechsterWaehler(nach: number) {
    const n = this.stand.length
    for (let s = 1; s <= n; s++) {
      const j = (nach + s) % n
      if (!this.stand[j].raus) return j
    }
    return -1
  }

  private rennenGebiet(i: number, m: Extract<AnServer, { t: 'gebiet' }>) {
    if (this.phase !== 'spiel' || this.start?.modus !== 'rennen' || i !== this.waehler || m.k !== this.gebiet + 1 || !m.b) return
    this.gebiet = m.k
    this.anAlle({ t: 'gebiet', k: m.k, b: { x: Math.round(m.b.x), y: Math.round(m.b.y) }, d: m.d, wer: i }, this.plaetze[i].kanal ?? undefined)
    this.waehler = this.naechsterWaehler(i)
    if (this.waehler >= 0) this.anAlle({ t: 'waehler', k: this.gebiet + 1, wer: this.waehler })
  }

  private rennenPruefen() {
    if (this.phase !== 'spiel') return
    const im = this.stand.map((s, i) => ({ s, i })).filter(({ s }) => !s.raus)
    if (im.length >= 2) {
      const best = Math.max(...im.map(({ s }) => s.a))
      const grenze = abstandGrenze(best)
      for (const { s, i } of im) if (best - s.a >= grenze) this.raus(i, 'abstand')
    }
    const rest = this.stand.map((s, i) => ({ s, i })).filter(({ s }) => !s.raus)
    if (rest.length <= 1) {
      const reihenfolge = this.stand
        .map((s, i) => ({ s, i }))
        .sort((a, b) => (b.s.raus ? b.s.rausBei : Infinity) - (a.s.raus ? a.s.rausBei : Infinity) || b.s.a - a.s.a)
        .map(({ i }) => i)
      this.beenden({ sieger: rest[0]?.i ?? reihenfolge[0] ?? null, reihenfolge })
    }
  }
}
