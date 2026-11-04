/**
 * Mehrspieler in der App: Verbindung zum Snake-Server, das laufende Spiel und was davon zu sehen ist.
 * Ohne DOM (die Oberflaeche steht in ui.ts).
 *
 * Auf einem Feld (Gegeneinander, Koop, Apfeljagd, Zone) rechnet der Server das Spiel, etwas hinter der
 * Echtzeit (VERZUG_MS). Dieses Handy haelt zwei Spiele:
 * - `basis`: der letzte Stand vom Server (nach `basisSchritt` Schritten),
 * - `game`: die Gegenwart, die hier vorausgerechnet und gezeichnet wird. Dazu wird der Server-Stand
 *   genommen und mit allen bekannten Wischern (eigene sofort, fremde, sobald der Server sie weiterreicht)
 *   bis zur Echtzeit weitergerechnet, in denselben festen Schritten wie beim Server.
 * Die eigene Schlange biegt so ohne jede Verzoegerung ab (wie offline), und kein Handy kann das Spiel
 * fuer die anderen aufhalten. Wettrennen: hier laeuft die eigene Welt, die anderen kommen als Geister.
 */
import type { Ergebnis, MehrGame, Modus, SpielerInfo } from '../game/mehr'
import * as R from '../game/rules'
import type { Dir, GameEvent, P } from '../game/types'
import { anwenden, zustand, type Zustand } from '../game/zustand'
import { PROTOKOLL, SIM_MS, type AnServer, type Einstellungen, type Geist, type Phase, type StartInfo, type Teilnehmer, type VomServer } from './protokoll'
import { reihenfolge, spielBauen, type Eingabe } from './sim'

export type RaumInfo = { code: string; gastgeber: string; phase: Phase; modus: Modus; spieler: Teilnehmer[]; ich: number } & Einstellungen

export type ClientEreignis =
  | { art: 'raum'; raum: RaumInfo }
  | { art: 'start'; info: StartInfo }
  | { art: 'spiel'; e: GameEvent & { wer?: number } }
  | { art: 'raus'; wer: number; grund: 'leben' | 'abstand' }
  | { art: 'ende'; ergebnis: Ergebnis }
  | { art: 'fehler'; text: string }
  | { art: 'verbindung'; ok: boolean }
  | { art: 'emoji'; wer: number; e: number }
  | { art: 'verlassen' }

/** Eine andere Schlange, wie sie gezeichnet wird */
export type Fremd = { wer: number; body: P[]; prev: P[]; dir: Dir; alpha: number; tot: boolean; deck: number; name: string; skin: string }

type GeistStand = Geist & { prev: P[]; seit: number }

/** Herzschlag zum Server (ms, haelt auch die Uhr genau und gibt dem Server jedes Mal neue Rechenzeit); kommt so lange (ms) gar nichts zurueck, ist die Verbindung tot */
const PING_MS = 500
const TOT_MS = 3500
/** Nach einem Netzwechsel oder der Rueckkehr in die App: so lange (ms) darf die Antwort auf einen Ping ausbleiben */
const PRUEFEN_MS = 1500
/** So viele Schritte rechnet ein Frame hoechstens voraus (nach dem Hintergrund holt es in mehreren Frames auf) */
const MAX_SCHRITTE_FRAME = 60
/** So viele eigene Wischer duerfen unbestaetigt sein (der Server nimmt auch nicht mehr an) */
const MAX_OFFEN = 12
/** Rennen: so oft (ms) hoechstens die eigene Position */
const POS_MS = 80

export class MehrClient {
  ws: WebSocket | null = null
  code = ''
  raum: RaumInfo | null = null
  start: StartInfo | null = null
  /** Das gezeichnete Spiel (auf einem Feld: die vorausgerechnete Gegenwart) */
  game: MehrGame | null = null
  ergebnis: Ergebnis | null = null
  /** Rennen: Geister der anderen (Index wie in start.spieler) */
  geister = new Map<number, GeistStand>()
  waehler = -1
  verbunden = false
  private gewollt = false
  private versuche = 0
  /** Letzter Stand vom Server und nach wie vielen Schritten */
  private basis: MehrGame | null = null
  private basisSchritt = -1
  /** So viele Schritte ist `game` gerechnet; Ereignisse aus Schritten vor `gezeigt` wurden schon gemeldet */
  private schritt = 0
  private gezeigt = 0
  /** Spielzeit von `game` nach dem letzten Schritt (gezeichnet wird mit der Zeit dazwischen) */
  private simZeit = 0
  /** Neu vom Server-Stand aus rechnen (neuer Stand, fremder Wischer in der Vergangenheit) */
  private neuRechnen = false
  /** Bekannte Wischer, die im Server-Stand noch nicht stecken */
  private eingaben: Eingabe[] = []
  private eingabeNr = 0
  private letztePos = 0
  private posKopf = ''
  /** Serverzeit - lokale Zeit (ms) */
  private versatz = 0
  private ping: ReturnType<typeof setInterval> | null = null
  /** Wann zuletzt etwas vom Server kam */
  private zuletzt = 0
  private rttMin = Infinity
  private nachNetz: ReturnType<typeof setTimeout> | null = null
  /** Zaehler fuer die Lag-Anzeige: Ping, Neuverbindungen, eigene Wischer, die zu spaet beim Server waren, Korrekturen der Vorhersage */
  stat = { rtt: 0, rttMax: 0, neuVerbunden: 0, zuSpaet: 0, korrektur: 0 }

  constructor(
    private readonly server: string,
    private readonly ichInfo: () => SpielerInfo,
    private readonly melden: (e: ClientEreignis) => void,
  ) {}

  /** Kurzer Text fuer die Lag-Anzeige: Ping, Vorlauf vor dem Server-Stand, zu spaete Wischer, Korrekturen, Neuverbindungen */
  get diagnose() {
    const st = this.stat
    if (this.start?.modus === 'rennen') return `Rennen · Ping ${Math.round(st.rtt)} ms (max ${Math.round(st.rttMax)}) · Neu ${st.neuVerbunden}`
    const vor = this.basisSchritt >= 0 ? Math.round((this.schritt - this.basisSchritt) * SIM_MS) : 0
    return `Server · Ping ${Math.round(st.rtt)} ms (max ${Math.round(st.rttMax)}) · Vorlauf ${vor} ms · Zu spät ${st.zuSpaet} · Korrektur ${st.korrektur} · Neu ${st.neuVerbunden}`
  }

  /** Index dieses Geraets in der Spielerliste */
  get ich() {
    return this.raum?.ich ?? -1
  }
  get gastgeber() {
    return !!this.raum && this.raum.spieler[this.raum.ich]?.id === this.raum.gastgeber
  }
  /** Serverzeit jetzt */
  jetzt() {
    return performance.now() + this.versatz
  }
  /** Laeuft das Spiel (Countdown vorbei)? */
  get laeuft() {
    return !!this.start && !!this.game && this.raum?.phase === 'spiel' && this.jetzt() >= this.start.los
  }
  /** Sekunden bis zum Start (0 = laeuft) */
  get countdown() {
    if (!this.start || this.raum?.phase !== 'spiel') return 0
    return Math.max(0, Math.ceil((this.start.los - this.jetzt()) / 1000))
  }

  /* ================= Verbindung ================= */

  verbinden(code: string) {
    this.code = code.toUpperCase()
    this.gewollt = true
    this.versuche = 0
    this.netzHoeren(true)
    this.oeffnen()
  }

  /** Netz wieder da, App wieder vorn: sofort pruefen statt auf den naechsten Herzschlag zu warten */
  private readonly netzDa = () => this.pruefen()
  private readonly sichtbar = () => {
    if (typeof document !== 'undefined' && !document.hidden) this.pruefen()
  }
  private netzHoeren(an: boolean) {
    const g = globalThis as unknown as Window
    if (typeof g.addEventListener !== 'function') return
    const f = an ? g.addEventListener.bind(g) : g.removeEventListener.bind(g)
    f('online', this.netzDa)
    if (typeof document !== 'undefined') (an ? document.addEventListener : document.removeEventListener).call(document, 'visibilitychange', this.sichtbar)
  }

  /** Lebt die Verbindung noch? Ping schicken; kommt binnen PRUEFEN_MS nichts, neu aufbauen (Netzwechsel WLAN <-> Mobilfunk) */
  private pruefen() {
    if (!this.gewollt) return
    if (!this.ws) {
      this.versuche = 0
      return this.oeffnen()
    }
    if (this.ws.readyState !== WebSocket.OPEN) return
    const seit = performance.now()
    this.senden({ t: 'ping', z: seit })
    if (this.nachNetz) clearTimeout(this.nachNetz)
    this.nachNetz = setTimeout(() => {
      this.nachNetz = null
      if (this.gewollt && this.ws && this.zuletzt < seit) this.neuAufbauen()
    }, PRUEFEN_MS)
  }

  /** Alte Verbindung verwerfen (ohne Warten auf den Browser) und sofort eine neue aufbauen */
  private neuAufbauen() {
    const alt = this.ws
    if (alt) {
      this.ws = null
      alt.onclose = alt.onmessage = alt.onopen = null
      try {
        alt.close(3001)
      } catch {
        /* egal */
      }
    }
    this.verbunden = false
    this.stat.neuVerbunden++
    this.melden({ art: 'verbindung', ok: false })
    this.versuche = 0
    this.oeffnen()
  }

  private oeffnen() {
    const i = this.ichInfo()
    const basis = this.server.replace(/^http/, 'ws').replace(/\/$/, '')
    const url = `${basis}/raum/${this.code}?id=${encodeURIComponent(i.id)}&name=${encodeURIComponent(i.name)}&skin=${encodeURIComponent(i.skin)}&v=${PROTOKOLL}`
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      return this.spaeterNeu()
    }
    this.ws = ws
    ws.onopen = () => {
      this.rttMin = Infinity
      this.verbunden = true
      this.versuche = 0
      this.zuletzt = performance.now()
      this.melden({ art: 'verbindung', ok: true })
      this.ping ??= setInterval(() => this.herzschlag(), PING_MS)
      // Gleich die Uhr stellen (nicht erst nach dem ersten Herzschlag)
      this.senden({ t: 'ping', z: performance.now() })
    }
    ws.onmessage = (e) => {
      if (this.ws !== ws) return
      this.zuletzt = performance.now()
      if (typeof e.data !== 'string') return
      let m: VomServer
      try {
        m = JSON.parse(e.data)
      } catch {
        return
      }
      this.empfangen(m)
    }
    ws.onclose = (e) => {
      if (this.ws !== ws) return
      this.verbunden = false
      this.ws = null
      // 4000 = abgelehnt (Version, voll, laeuft schon): nicht neu versuchen
      if (!this.gewollt || e.code === 4000 || e.code === 4001) {
        if (e.code === 4000) this.gewollt = false
        if (!this.gewollt) this.aufraeumen()
        return
      }
      this.melden({ art: 'verbindung', ok: false })
      this.spaeterNeu()
    }
  }

  /** Alle PING_MS: Ping (fuer die Uhr) und pruefen, ob die Verbindung noch lebt. Ein Funkloch meldet der
   *  Browser oft erst nach Minuten: kommt TOT_MS lang nichts, wird die Verbindung verworfen und neu aufgebaut */
  private herzschlag() {
    if (!this.ws) return
    if (this.ws.readyState === WebSocket.OPEN && performance.now() - this.zuletzt > TOT_MS) return this.neuAufbauen()
    this.senden({ t: 'ping', z: performance.now() })
  }

  /** Funkloch: gleich, dann nach 0,5, 1, 2, 4 ... Sekunden noch einmal (hoechstens 10 Versuche) */
  private spaeterNeu() {
    if (!this.gewollt || this.versuche >= 10) {
      if (this.gewollt) this.melden({ art: 'fehler', text: 'Keine Verbindung zum Server.' })
      this.gewollt = false
      this.aufraeumen()
      return
    }
    const ms = this.versuche === 0 ? 150 : Math.min(8000, 500 * 2 ** (this.versuche - 1))
    this.versuche++
    setTimeout(() => this.gewollt && !this.ws && this.oeffnen(), ms)
  }

  verlassen() {
    this.gewollt = false
    this.netzHoeren(false)
    const ws = this.ws
    this.ws = null
    ws?.close(1000)
    this.aufraeumen()
  }

  private aufraeumen() {
    if (this.ping) clearInterval(this.ping)
    this.ping = null
    if (this.nachNetz) clearTimeout(this.nachNetz)
    this.nachNetz = null
    this.netzHoeren(false)
    this.verbunden = false
    this.raum = null
    this.start = null
    this.game = null
    this.basis = null
    this.eingaben = []
    this.geister.clear()
    this.melden({ art: 'verlassen' })
  }

  senden(m: AnServer) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m))
  }

  modus(modus: Modus) {
    this.senden({ t: 'modus', modus })
  }
  starten() {
    this.senden({ t: 'start' })
  }
  einstellen(e: Partial<Einstellungen>) {
    this.senden({ t: 'einstellung', ...e })
  }
  bereit(b: boolean) {
    this.senden({ t: 'bereit', bereit: b })
  }
  nochmal() {
    this.senden({ t: 'nochmal' })
  }
  revanche(will: boolean) {
    this.senden({ t: 'revanche', revanche: will })
  }

  /* ================= Nachrichten ================= */

  private empfangen(m: VomServer) {
    switch (m.t) {
      case 'raum': {
        const vorher = this.raum?.phase
        this.raum = { code: m.code, gastgeber: m.gastgeber, phase: m.phase, modus: m.modus, spieler: m.spieler, ich: m.ich, tempo: m.tempo, klassisch: m.klassisch, leben: m.leben ?? 1 }
        if (m.phase === 'lobby' && vorher && vorher !== 'lobby') {
          this.start = null
          this.game = null
          this.basis = null
          this.ergebnis = null
          this.eingaben = []
          this.geister.clear()
        }
        this.melden({ art: 'raum', raum: this.raum })
        return
      }
      case 'start':
        if (!this.uhrGestellt) this.versatz = m.jetzt - performance.now()
        // Nach dem Neuverbinden kommt derselbe Start noch einmal: weiterrechnen, der ganze Stand folgt
        if (this.start && this.game && this.start.seed === m.info.seed && this.start.los === m.info.los) return
        return this.spielBauen(m.info)
      case 'pong':
        return this.uhrAbgleichen(m.jetzt, m.z)
      case 'voll':
        if (!this.basis && this.start && this.start.modus !== 'rennen') this.spielBauen(this.start)
        if (!this.basis) return
        anwenden(this.basis, m.z)
        this.basisSchritt = m.n
        this.eingaben = this.eingaben.filter((e) => e.n >= m.n)
        // Zurueck im Spiel: Ereignisse aus der verpassten Zeit nicht nachholen
        this.gezeigt = Math.max(this.gezeigt, m.n)
        this.neuRechnen = true
        return
      case 'z':
        if (!this.basis) return
        anwenden(this.basis, m.d)
        this.basisSchritt = m.n
        this.eingaben = this.eingaben.filter((e) => e.n >= m.n)
        this.neuRechnen = true
        // Wer raus ist, entscheidet der Server
        for (const e of m.e ?? []) this.melden({ art: 'spiel', e })
        return
      case 'dir': {
        if (!this.basis) return
        // Eigener Wischer kommt bestaetigt zurueck: kam er zu spaet, gilt er einen spaeteren Schritt
        const alt = m.wer === this.ich ? this.eingaben.find((x) => x.wer === m.wer && x.i === m.i && x.q === Infinity) : undefined
        if (alt) {
          if (alt.n !== m.n) {
            this.stat.zuSpaet++
            this.neuRechnen = true
          }
          alt.n = m.n
          alt.q = m.q
        } else if (m.n >= this.basisSchritt) {
          this.eingaben.push({ wer: m.wer, d: m.d, n: m.n, i: m.i, q: m.q })
          // Liegt er in der schon vorausgerechneten Zeit, ab dem Server-Stand neu rechnen
          if (m.n < this.schritt) this.neuRechnen = true
        }
        return
      }
      case 'emoji':
        this.melden({ art: 'emoji', wer: m.wer, e: m.e })
        return
      case 'geist': {
        // Die eigene Schlange nie als Geist zeigen (nur die der anderen)
        if (m.wer === this.ich) return
        const alt = this.geister.get(m.wer)
        const kopf = (b: P[]) => (b[0] ? `${b[0].x},${b[0].y}` : '')
        const neu = !alt || kopf(alt.b) !== kopf(m.b)
        this.geister.set(m.wer, { ...m, prev: neu ? (alt?.b ?? m.b) : alt!.prev, seit: neu ? performance.now() : alt!.seit })
        return
      }
      case 'waehler':
        this.waehler = m.wer
        if (this.game && this.start?.modus === 'rennen') {
          this.game.rennenWaehler = m.wer === this.ich && m.k === this.game.expansions + 1
          this.game.pruefeRennenGebiet()
        }
        return
      case 'gebiet':
        if (this.game && this.start?.modus === 'rennen') {
          this.game.gebietVonAussen(m.k, m.b, m.d)
          for (const e of this.game.drain()) this.melden({ art: 'spiel', e })
        }
        return
      case 'raus':
        if (this.start?.modus === 'rennen' && m.wer === this.ich && this.game?.status === 'play') this.game.beenden(null)
        this.melden({ art: 'raus', wer: m.wer, grund: m.grund })
        return
      case 'ende':
        // Der letzte Stand des Servers gilt
        if (this.basis) this.neuRechnen = true
        this.ergebnis = m.ergebnis
        this.melden({ art: 'ende', ergebnis: m.ergebnis })
        return
      case 'fehler':
        this.melden({ art: 'fehler', text: m.text })
        return
    }
  }

  /** Uhr mit dem Server abgleichen: nur schnelle Antworten zaehlen (eine lange kann auf dem Hinweg oder Rueckweg stecken) und sanft nachziehen */
  private uhrAbgleichen(serverJetzt: number, gesendet?: number) {
    if (typeof gesendet !== 'number') return
    const jetzt = performance.now()
    const rtt = jetzt - gesendet
    if (!(rtt >= 0 && rtt < 30_000)) return
    this.stat.rtt = this.stat.rtt ? this.stat.rtt * 0.8 + rtt * 0.2 : rtt
    this.stat.rttMax = Math.max(this.stat.rttMax * 0.98, rtt)
    // Der Mindestwert steigt langsam wieder (anderes Netz nach einem Wechsel)
    this.rttMin = Math.min(this.rttMin * 1.02, rtt)
    const probe = serverJetzt + rtt / 2 - jetzt
    if (!this.uhrGestellt) {
      this.versatz = probe
      this.uhrGestellt = true
    } else if (rtt <= this.rttMin * 1.5 + 20) this.versatz += 0.25 * (probe - this.versatz)
  }
  private uhrGestellt = false

  private spielBauen(info: StartInfo) {
    this.start = info
    this.ergebnis = null
    this.geister.clear()
    this.eingaben = []
    this.schritt = this.gezeigt = 0
    this.simZeit = 0
    this.neuRechnen = false
    const rennen = info.modus === 'rennen'
    const ich = Math.max(0, this.ich)
    this.game = spielBauen(info, rennen ? ich : undefined)
    this.basis = rennen ? null : spielBauen(info)
    this.basisSchritt = rennen ? -1 : 0
    this.game.wechsel(rennen ? 0 : ich)
    this.waehler = -1
    this.melden({ art: 'start', info })
  }

  /* ================= Spielen ================= */

  /** Eigener Wischer: gilt hier sofort (vor dem naechsten Schritt) und geht mit diesem Schritt an den Server */
  lenke(d: Dir) {
    const g = this.game
    if (!g || !this.laeuft) return
    if (this.start?.modus === 'rennen') return g.lenke(0, d)
    const ich = this.ich
    if (ich < 0 || !this.basis) return
    if (this.eingaben.filter((e) => e.wer === ich && e.q === Infinity).length >= MAX_OFFEN) return
    const e: Eingabe = { wer: ich, d, n: this.schritt, i: ++this.eingabeNr, q: Infinity }
    this.eingaben.push(e)
    this.senden({ t: 'dir', d, n: e.n, i: e.i })
    // Gleich anwenden wie offline (der Schritt `schritt` ist noch nicht gerechnet, der Wischer gilt davor)
    g.time = this.simZeit
    g.lenke(ich, d)
    e.schon = true
    g.wechsel(ich)
  }

  reaktion(e: number) {
    this.senden({ t: 'emoji', e })
  }

  /** Jeden Frame: die Gegenwart vorausrechnen (Rennen: die eigene Welt) */
  frame(dt: number) {
    const g = this.game
    if (!g || !this.start) return
    if (this.start.modus === 'rennen') return this.rennenFrame(g, dt)
    const b = this.basis
    if (!b) return
    // Echtzeit in Schritten seit dem Start (Serveruhr); im Countdown steht alles
    const seit = this.jetzt() - this.start.los
    const ziel = Math.max(0, Math.floor(seit / SIM_MS))
    g.time = this.simZeit
    if (this.neuRechnen) this.vomServer(g, b)
    // Bis zur Gegenwart (nach dem Hintergrund in mehreren Frames)
    this.vorrechnen(Math.min(ziel, this.schritt + MAX_SCHRITTE_FRAME))
    // Gezeichnet wird mit der Zeit zwischen zwei Schritten: die Bewegung ist so weich wie offline
    if (g.status === 'play' && this.schritt === ziel && seit > 0) g.time = this.simZeit + Math.min(SIM_MS, Math.max(0, seit - ziel * SIM_MS))
    g.wechsel(Math.max(0, this.ich))
  }

  /** Vom letzten Server-Stand aus neu bis zum bisherigen Schritt rechnen, mit allen inzwischen bekannten Wischern */
  private vomServer(g: MehrGame, b: MehrGame) {
    this.neuRechnen = false
    const bis = this.schritt
    const vorher = this.kopfSpur(g)
    anwenden(g, JSON.parse(JSON.stringify(zustand(b, true))) as Zustand)
    g.drain()
    this.schritt = this.basisSchritt
    this.simZeit = g.time
    for (const e of this.eingaben) e.schon = false
    this.vorrechnen(bis)
    if (this.schritt === bis && this.kopfSpur(g) !== vorher) this.stat.korrektur++
  }

  /** Wo alle Koepfe gerade sind (um Korrekturen der Vorhersage zu zaehlen) */
  private kopfSpur(g: MehrGame) {
    g.sichern()
    return g.schlangen.map((s) => (s.body[0] ? `${s.body[0].x},${s.body[0].y},${s.tot ? 1 : 0}` : '')).join(';')
  }

  /** `game` bis Schritt `bis` weiterrechnen: vor jedem Schritt die Wischer dieses Schritts, wie beim Server */
  private vorrechnen(bis: number) {
    const g = this.game
    if (!g || this.schritt >= bis) return
    g.time = this.simZeit
    const offen = this.eingaben.filter((e) => e.n >= this.schritt && e.n < bis).sort(reihenfolge)
    let k = 0
    while (this.schritt < bis) {
      while (k < offen.length && offen[k].n <= this.schritt) {
        const e = offen[k++]
        // Ein eigener Wischer, der schon sofort angewendet wurde, gilt nicht noch einmal
        if (!e.schon) g.lenke(e.wer, e.d)
        e.schon = false
      }
      g.update(SIM_MS)
      const ev = g.drain()
      // Ereignisse nur beim ersten Mal (nicht beim Neurechnen); wer raus ist und wann es endet, sagt der Server
      if (this.schritt >= this.gezeigt) for (const e of ev) if (e.type !== 'raus' && e.type !== 'ende') this.melden({ art: 'spiel', e })
      this.schritt++
    }
    this.gezeigt = Math.max(this.gezeigt, this.schritt)
    this.simZeit = g.time
  }

  private rennenFrame(g: MehrGame, dt: number) {
    if (this.laeuft && g.status === 'play') g.update(dt)
    for (const e of g.drain()) {
      // Eigenes Gebiet gewaehlt: an die anderen
      if (e.type === 'expand' && e.block && e.d && this.waehler === this.ich) {
        this.senden({ t: 'gebiet', k: g.expansions, b: g.blockWelt(e.block), d: e.d })
        g.rennenWaehler = false
      }
      this.melden({ art: 'spiel', e })
    }
    // Eigene Position an die anderen (bei jedem Schritt, hoechstens alle POS_MS)
    g.sichern()
    const s = g.schlangen[0]
    const kopf = `${s.body[0]?.x},${s.body[0]?.y},${s.tot},${s.raus},${s.leben}`
    const jetzt = performance.now()
    if (this.start && this.raum?.phase === 'spiel' && kopf !== this.posKopf && jetzt - this.letztePos >= POS_MS) {
      this.posKopf = kopf
      this.letztePos = jetzt
      const o = g.ursprung
      this.senden({ t: 'pos', b: s.body.map((p) => ({ x: p.x - o.x, y: p.y - o.y })), d: s.dir, a: s.aepfel, l: s.leben, tot: s.tot, raus: s.raus })
    }
  }

  /* ================= Anzeige ================= */

  /** Die anderen Schlangen fuer den Zeichner (alle ausser `ausser`, standardmaessig die eigene) */
  fremde(ausser = this.ich): Fremd[] {
    const g = this.game
    if (!g || !this.start) return []
    const out: Fremd[] = []
    if (this.start.modus === 'rennen') {
      const o = g.ursprung
      for (const [wer, s] of this.geister) {
        if (s.raus || wer === this.ich) continue
        const info = this.start.spieler[wer]
        const mv = (b: P[]) => b.map((p) => ({ x: p.x + o.x, y: p.y + o.y }))
        out.push({ wer, body: mv(s.b), prev: mv(s.prev.length === s.b.length ? s.prev : s.b), dir: s.d, alpha: Math.min(1, (performance.now() - s.seit) / g.tick), tot: s.tot, deck: 0.42, name: info?.name ?? '', skin: info?.skin ?? 'klassik' })
      }
      return out
    }
    g.sichern()
    g.schlangen.forEach((s, wer) => {
      if (wer === ausser || s.raus) return
      // Tote liegen noch kurz da, dann verschwinden sie bis zur Rueckkehr
      if (s.tot && g.time - s.deathAt > 1200) return
      const takt = g.time < s.effekt.zeitlupeBis ? g.tick * R.zeitlupe(g.cfg) : g.tick
      const geist = g.time < s.effekt.geistBis
      out.push({
        wer,
        body: s.body,
        prev: s.prev,
        dir: s.dir,
        alpha: s.tot ? 1 : Math.min(1, Math.max(0, (g.time - s.last) / takt)),
        tot: s.tot,
        deck: geist ? 0.5 : this.start!.modus === 'koop' ? 0.9 : 1,
        name: s.name,
        skin: s.skin,
      })
    })
    return out
  }

  /** Eigene Schlange (im Rennen die einzige in der eigenen Welt) */
  meine() {
    const g = this.game
    if (!g) return null
    g.sichern()
    return g.schlangen[this.start?.modus === 'rennen' ? 0 : Math.max(0, this.ich)] ?? null
  }

  /** Aepfel, Leben und Status aller Spieler (fuer die Lebensleiste) */
  staende(): { wer: number; name: string; skin: string; aepfel: number; leben: number; raus: boolean; tot: boolean }[] {
    const g = this.game
    if (!g || !this.start) return []
    if (this.start.modus === 'rennen') {
      return this.start.spieler.map((p, wer) => {
        if (wer === this.ich) {
          const s = this.meine()!
          return { wer, name: p.name, skin: p.skin, aepfel: s.aepfel, leben: s.leben, raus: s.raus, tot: s.tot }
        }
        const gs = this.geister.get(wer)
        return { wer, name: p.name, skin: p.skin, aepfel: gs?.a ?? 0, leben: gs?.l ?? this.start?.leben ?? 1, raus: !!gs?.raus, tot: !!gs?.tot }
      })
    }
    g.sichern()
    return g.schlangen.map((s, wer) => ({ wer, name: s.name, skin: s.skin, aepfel: s.aepfel, leben: s.leben, raus: s.raus, tot: s.tot }))
  }
}
