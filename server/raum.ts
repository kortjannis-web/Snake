/**
 * Ein Spielraum (ohne Cloudflare-Teile, damit er sich testen laesst). Der Durable Object in index.ts
 * reicht nur Verbindungen und Nachrichten hierher durch und ruft regelmaessig `takt()` auf.
 *
 * Auf einem Feld (Gegeneinander, Koop, Apfeljagd, Zone) rechnet der Raum das Spiel selbst, in festen
 * Schritten von SIM_MS und VERZUG_MS hinter der Echtzeit. Ein Wischer gilt in dem Schritt, in dem er auf dem
 * Handy kam (kommt er zu spaet, im naechsten noch offenen). Jeder Wischer geht sofort an alle, der Stand
 * alle paar Schritte: damit rechnet jedes Handy die Gegenwart selbst voraus.
 */
import { abstandGrenze, type Ergebnis, type MehrGame, type Modus, type SpielerInfo } from '../src/game/mehr'
import type { Tempo } from '../src/game/rules'
import type { GameEvent } from '../src/game/types'
import { Abgleich, zustand } from '../src/game/zustand'
import { COUNTDOWN, MAX_SPIELER, PROTOKOLL, REAKTIONEN, SIM_MS, STAND_SCHRITTE, VERZUG_MS, type AnServer, type Phase, type StartInfo, type VomServer } from '../src/multi/protokoll'
import { reihenfolge, spielBauen, type Eingabe } from '../src/multi/sim'

export interface Kanal {
  send(s: string): void
  close(code?: number, reason?: string): void
}

type Platz = { info: SpielerInfo; kanal: Kanal | null }
type Stand = { a: number; l: number; tot: boolean; raus: boolean; rausBei: number }

const MAX_NACHRICHT = 256 * 1024
const MODI: Modus[] = ['vs', 'koop', 'rennen', 'jagd', 'royale']
const TEMPI: Tempo[] = ['langsam', 'normal', 'schnell']
/** So viele Schritte holt ein Takt hoechstens nach (hing der Server, springt er lieber) */
const MAX_NACHHOLEN = 250
/** So weit (Schritte) darf ein Wischer in der Zukunft liegen (falsch gehende Uhr), und so viele offene je Spieler */
const MAX_VORAUS = Math.ceil((VERZUG_MS + 1500) / SIM_MS)
const MAX_OFFEN = 24

export class RaumLogik {
  plaetze: Platz[] = []
  gastgeber = ''
  phase: Phase = 'lobby'
  modus: Modus = 'vs'
  tempo: Tempo = 'normal'
  klassisch = false
  /** Leben je Spieler: 1 (Standard) oder 3 */
  leben: 1 | 3 = 1
  /** Wer in der Lobby "Bereit" getippt hat (Kennungen) */
  bereit = new Set<string>()
  /** Wer im Ergebnis "Revanche" getippt hat (Kennungen). Wollen alle, geht es zurueck in die Lobby, alle bereit */
  revanche = new Set<string>()
  start: StartInfo | null = null
  /** Das Spiel auf einem Feld (im Rennen null) und wie viele Schritte es schon gerechnet ist */
  spiel: MehrGame | null = null
  schritt = 0
  /** Wischer, die noch nicht gerechnet sind */
  eingaben: Eingabe[] = []
  private folge = 0
  private abgleich = new Abgleich()
  private gesendet = 0
  /** Ereignisse seit dem letzten Stand, die nur der Server entscheidet */
  private ereignisse: GameEvent[] = []
  ergebnis: Ergebnis | null = null
  /** Wann jeder zuletzt eine Reaktion geschickt hat (hoechstens eine je Sekunde) */
  private reaktion = new Map<string, number>()
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
        tempo: this.tempo,
        klassisch: this.klassisch,
        leben: this.leben,
        spieler: this.plaetze.map((q) => ({ ...q.info, online: !!q.kanal, bereit: q.info.id === this.gastgeber || this.bereit.has(q.info.id), revanche: this.revanche.has(q.info.id) })),
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
      } else if (this.spiel) {
        this.an(k, { t: 'voll', z: zustand(this.spiel, true), n: this.schritt })
        for (const e of this.eingaben) this.an(k, { t: 'dir', ...e })
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
    this.raumAnAlle()
    this.revanchePruefen()
  }

  private zuruecksetzen() {
    this.phase = 'lobby'
    this.start = null
    this.spiel = null
    this.eingaben = []
    this.ereignisse = []
    this.ergebnis = null
    this.stand = []
    this.gebiet = 0
    this.waehler = -1
    this.revanche.clear()
  }

  /** Wollen alle, die noch da sind (mindestens 2), eine Revanche? Dann zurueck in die Lobby, alle schon bereit */
  private revanchePruefen() {
    if (this.phase !== 'ende') return
    const da = this.plaetze.filter((p) => p.kanal)
    if (da.length < 2 || !da.every((p) => this.revanche.has(p.info.id))) return
    this.zuruecksetzen()
    this.plaetze = da
    this.bereit = new Set(da.map((p) => p.info.id))
    this.raumAnAlle()
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
        return this.an(k, { t: 'pong', jetzt: this.uhr(), z: Number.isFinite(m.z) ? m.z : undefined })
      case 'modus':
        if (gast && this.phase === 'lobby' && MODI.includes(m.modus) && m.modus !== this.modus) {
          this.modus = m.modus
          // Neue Regeln: alle muessen neu zusagen
          this.bereit.clear()
          this.raumAnAlle()
        }
        return
      case 'einstellung':
        if (!gast || this.phase !== 'lobby') return
        if (m.tempo && TEMPI.includes(m.tempo)) this.tempo = m.tempo
        if (typeof m.klassisch === 'boolean') this.klassisch = m.klassisch
        if (m.leben === 1 || m.leben === 3) this.leben = m.leben
        this.bereit.clear()
        this.raumAnAlle()
        return
      case 'bereit':
        if (this.phase !== 'lobby') return
        if (m.bereit) this.bereit.add(this.plaetze[i].info.id)
        else this.bereit.delete(this.plaetze[i].info.id)
        this.raumAnAlle()
        return
      case 'start':
        if (gast && this.phase === 'lobby') this.starten(i)
        return
      case 'revanche':
        if (this.phase !== 'ende') return
        if (m.revanche === false) this.revanche.delete(this.plaetze[i].info.id)
        else this.revanche.add(this.plaetze[i].info.id)
        this.raumAnAlle()
        this.revanchePruefen()
        return
      case 'nochmal':
        // Gastgeber: zurueck in die Lobby (zum Beispiel, um den Modus zu wechseln)
        if (gast && this.phase !== 'lobby') {
          this.zuruecksetzen()
          this.plaetze = this.plaetze.filter((p) => p.kanal)
          this.bereit.clear()
          this.raumAnAlle()
        }
        return
      case 'dir':
        return this.wischer(i, m)
      case 'emoji': {
        const e = Math.floor(Number(m.e))
        const id = this.plaetze[i].info.id
        if (this.phase === 'lobby' || !(e >= 0 && e < REAKTIONEN.length) || this.uhr() - (this.reaktion.get(id) ?? -1e9) < 1000) return
        this.reaktion.set(id, this.uhr())
        return this.anAlle({ t: 'emoji', wer: i, e })
      }
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
    const gastKanal = this.plaetze.find((p) => p.info.id === gastId)?.kanal ?? null
    if (this.plaetze.length < 2) {
      this.an(gastKanal, { t: 'fehler', text: 'Es braucht mindestens 2 Spieler.' })
      this.raumAnAlle()
      return
    }
    const fehlt = this.plaetze.filter((p) => p.info.id !== gastId && !this.bereit.has(p.info.id))
    if (fehlt.length) {
      this.an(gastKanal, { t: 'fehler', text: `Noch nicht bereit: ${fehlt.map((p) => p.info.name).join(', ')}` })
      this.raumAnAlle()
      return
    }
    const jetzt = this.uhr()
    this.start = {
      modus: this.modus,
      seed: Math.floor(this.zufall() * 2 ** 31),
      spieler: this.plaetze.map((p) => ({ ...p.info })),
      los: jetzt + COUNTDOWN,
      tempo: this.tempo,
      klassisch: this.klassisch,
      leben: this.leben,
    }
    this.phase = 'spiel'
    this.ergebnis = null
    this.eingaben = []
    this.ereignisse = []
    this.folge = 0
    this.schritt = 0
    this.gesendet = 0
    this.spiel = this.modus === 'rennen' ? null : spielBauen(this.start)
    this.abgleich.vergessen()
    this.stand = this.plaetze.map(() => ({ a: 0, l: 3, tot: false, raus: false, rausBei: 0 }))
    this.gebiet = 0
    this.waehler = this.modus === 'rennen' ? 0 : -1
    this.raumAnAlle()
    this.anAlle({ t: 'start', info: this.start, jetzt })
    if (this.spiel) {
      // Ganzer Stand zum Start: alle rechnen ab genau demselben Spiel
      const z = zustand(this.spiel, true)
      this.abgleich.aenderungen(zustand(this.spiel, false))
      this.anAlle({ t: 'voll', z, n: 0 })
    }
    if (this.modus === 'rennen') this.anAlle({ t: 'waehler', k: 1, wer: 0 })
  }

  /** Bis zu diesem Schritt ist das Spiel jetzt faellig (VERZUG_MS hinter der Echtzeit) */
  private faellig() {
    return this.start ? Math.floor((this.uhr() - this.start.los - VERZUG_MS) / SIM_MS) : 0
  }

  /** Ein Wischer: gilt im gewuenschten Schritt, ist der schon gerechnet, im naechsten offenen. Geht sofort an alle */
  private wischer(wer: number, m: Extract<AnServer, { t: 'dir' }>) {
    const g = this.spiel
    if (this.phase !== 'spiel' || !g || !['u', 'd', 'l', 'r'].includes(m.d)) return
    if (this.eingaben.filter((e) => e.wer === wer).length >= MAX_OFFEN) return
    const gewollt = Number.isFinite(m.n) ? Math.round(m.n) : this.schritt
    const n = Math.min(Math.max(gewollt, this.schritt), Math.max(this.schritt, this.faellig()) + MAX_VORAUS)
    const e: Eingabe = { wer, d: m.d, n, i: Number.isFinite(m.i) ? Math.round(m.i) : 0, q: ++this.folge }
    this.eingaben.push(e)
    this.anAlle({ t: 'dir', ...e })
  }

  /** Regelmaessig (index.ts: alle paar ms): das Spiel bis zur faelligen Zeit weiterrechnen und den Stand verteilen */
  takt() {
    const g = this.spiel
    if (this.phase !== 'spiel' || !g || !this.start) return
    let ziel = this.faellig()
    // Hing der Server (oder das Handy des Rechenzentrums), nicht alles auf einmal nachholen
    if (ziel - this.schritt > MAX_NACHHOLEN) ziel = this.schritt + MAX_NACHHOLEN
    if (ziel <= this.schritt) return
    while (this.schritt < ziel && g.status === 'play') this.schritten(g)
    if (g.status !== 'play') {
      this.standSenden(g)
      return this.beenden(g.ergebnis ?? { sieger: null, reihenfolge: g.rangliste() })
    }
    if (this.schritt - this.gesendet >= STAND_SCHRITTE || this.ereignisse.length) this.standSenden(g)
  }

  /** Einen Schritt rechnen: erst die Wischer dieses Schritts (in der Reihenfolge, in der sie kamen), dann die Zeit */
  private schritten(g: MehrGame) {
    const jetzt = this.eingaben.filter((e) => e.n <= this.schritt).sort(reihenfolge)
    if (jetzt.length) {
      this.eingaben = this.eingaben.filter((e) => e.n > this.schritt)
      for (const e of jetzt) g.lenke(e.wer, e.d)
    }
    g.update(SIM_MS)
    for (const e of g.drain()) if (e.type === 'raus') this.ereignisse.push(e)
    this.schritt++
  }

  private standSenden(g: MehrGame) {
    this.gesendet = this.schritt
    const d = this.abgleich.aenderungen(zustand(g, false)) ?? {}
    const e = this.ereignisse.length ? this.ereignisse : undefined
    this.ereignisse = []
    this.anAlle({ t: 'z', d, n: this.schritt, e })
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
      const grenze = abstandGrenze(best, this.stand.length)
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
