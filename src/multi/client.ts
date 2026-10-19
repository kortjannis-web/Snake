/**
 * Mehrspieler in der App: Verbindung zum Snake-Server, das laufende Spiel und was davon zu sehen ist.
 * Ohne DOM (die Oberflaeche steht in ui.ts).
 *
 * Gegeneinander und Koop: Ist dieses Geraet der Rechner, laeuft hier das ganze Spiel und der Stand
 * geht (nur die Aenderungen) an den Server; sonst wird der Stand vom Server uebernommen und nur
 * gezeichnet, Wischer gehen an den Rechner. Wettrennen: hier laeuft die eigene Welt, die anderen
 * kommen als Geister.
 */
import { DUELL, GEGNER_MODI, KLASSISCH, MehrGame, type Ergebnis, type Modus, type SpielerInfo } from '../game/mehr'
import * as R from '../game/rules'
import type { Dir, GameEvent, P } from '../game/types'
import { Abgleich, anwenden, zustand, type Zustand } from '../game/zustand'
import { Jitterpuffer } from './puffer'
import { MEHR_BILD, PROTOKOLL, type AnServer, type Einstellungen, type Geist, type Phase, type StartInfo, type Teilnehmer, type VomServer } from './protokoll'

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

/** So oft (ms) schickt der Rechner hoechstens seinen Stand */
const VERSAND_MS = 50
/** Herzschlag zum Server (ms); kommt so lange (ms) gar nichts zurueck, ist die Verbindung tot */
const PING_MS = 1000
const TOT_MS = 3500
/** Nach einem Netzwechsel oder der Rueckkehr in die App: so lange (ms) darf die Antwort auf einen Ping ausbleiben */
const PRUEFEN_MS = 1500
/** Staut sich beim Senden mehr als so viel (Bytes) im Browser, werden Staende uebersprungen (der naechste bringt alles nach) */
const STAU_BYTES = 8 * 1024
/** Spaetestens so oft (ms) meldet sich der Rechner, auch wenn sich nichts geaendert hat (z. B. im Countdown) */
const HERZ_MS = 500
/** Rennen: so oft (ms) hoechstens die eigene Position */
const POS_MS = 80

export class MehrClient {
  ws: WebSocket | null = null
  code = ''
  raum: RaumInfo | null = null
  start: StartInfo | null = null
  game: MehrGame | null = null
  rechner = -1
  ergebnis: Ergebnis | null = null
  /** Rennen: Geister der anderen (Index wie in start.spieler) */
  geister = new Map<number, GeistStand>()
  waehler = -1
  verbunden = false
  private gewollt = false
  private versuche = 0
  private abgleich = new Abgleich()
  private letzterVersand = 0
  private letzterHerz = 0
  private letztePos = 0
  private posKopf = ''
  private endeGeschickt = false
  /** Serverzeit - lokale Zeit (ms) */
  private versatz = 0
  /** Gespiegelter Stand: Spielzeit beim letzten Empfang und wann das war (zum Weiterzeichnen) */
  private basis: { spiel: number; lokal: number } | null = null
  private ping: ReturnType<typeof setInterval> | null = null
  private pingAb = 0
  /** Wann zuletzt etwas vom Server kam */
  private zuletzt = 0
  /** Eigener Wischer, den der Rechner noch nicht umgesetzt hat (fuer die sofortige Anzeige) */
  private vorhersage: { d: Dir; bei: P; seit: number } | null = null
  /** Gespiegelte Staende, die erst zu ihrer Abspielzeit (lokal, ms) angewendet werden (siehe puffer.ts) */
  private warten: { an: number; d: Zustand; e?: GameEvent[] }[] = []
  private puffer = new Jitterpuffer()
  /** Hoechste gezeigte Spielzeit: die gespiegelte Zeit springt nie zurueck (nur Stillstand bei Verspaetung) */
  private zeitMax = 0
  private rttMin = Infinity
  private nachNetz: ReturnType<typeof setTimeout> | null = null
  /** Zaehler fuer die Lag-Anzeige */
  stat = { rtt: 0, rttMax: 0, wechsel: 0, neuVerbunden: 0, uebersprungen: 0 }

  constructor(
    private readonly server: string,
    private readonly ichInfo: () => SpielerInfo,
    private readonly melden: (e: ClientEreignis) => void,
  ) {}

  /** Kurzer Text fuer die Lag-Anzeige: Ping, Streuung, Puffer, Rechner-Wechsel, Neuverbindungen, uebersprungene Staende */
  get diagnose() {
    const st = this.stat
    const rolle = this.start?.modus === 'rennen' ? 'Rennen' : this.istRechner ? 'Rechner' : 'Zuschauer'
    return `${rolle} · Ping ${Math.round(st.rtt)} ms (max ${Math.round(st.rttMax)}) · Jitter ${Math.round(this.puffer.jitter)} ms · Puffer ${Math.round(this.puffer.warte)} ms · Wechsel ${st.wechsel} · Neu ${st.neuVerbunden} · Stau ${st.uebersprungen}`
  }

  /** Index dieses Geraets in der Spielerliste */
  get ich() {
    return this.raum?.ich ?? -1
  }
  get gastgeber() {
    return !!this.raum && this.raum.spieler[this.raum.ich]?.id === this.raum.gastgeber
  }
  get istRechner() {
    return this.start?.modus !== 'rennen' && this.rechner === this.ich && this.ich >= 0
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
    this.pingAb = seit
    this.senden({ t: 'ping' })
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

  /** Alle 2 s: Ping (fuer die Uhr) und pruefen, ob die Verbindung noch lebt. Ein Funkloch meldet der
   *  Browser oft erst nach Minuten: kommt 6 s lang nichts, wird die Verbindung verworfen und neu aufgebaut */
  private herzschlag() {
    if (!this.ws) return
    if (this.ws.readyState === WebSocket.OPEN && performance.now() - this.zuletzt > TOT_MS) return this.neuAufbauen()
    this.pingAb = performance.now()
    this.senden({ t: 'ping' })
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
    this.warten = []
    this.puffer.zuruecksetzen()
    this.verbunden = false
    this.raum = null
    this.start = null
    this.game = null
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
  /** App geht in den Hintergrund: wer rechnet, gibt ab */
  abgeben() {
    if (this.istRechner && this.raum?.phase === 'spiel') this.senden({ t: 'abgabe' })
  }

  /* ================= Nachrichten ================= */

  private empfangen(m: VomServer) {
    switch (m.t) {
      case 'raum': {
        const vorher = this.raum?.phase
        this.raum = { code: m.code, gastgeber: m.gastgeber, phase: m.phase, modus: m.modus, spieler: m.spieler, ich: m.ich, tempo: m.tempo, klassisch: m.klassisch }
        if (m.phase === 'lobby' && vorher && vorher !== 'lobby') {
          this.start = null
          this.game = null
          this.ergebnis = null
          this.geister.clear()
          this.warten = []
        }
        this.melden({ art: 'raum', raum: this.raum })
        return
      }
      case 'start':
        this.versatz = m.jetzt - performance.now()
        return this.spielBauen(m.info)
      case 'pong':
        return this.uhrAbgleichen(m.jetzt)
      case 'rechner':
        if (this.rechner !== m.wer && this.start?.modus !== 'rennen') this.stat.wechsel++
        this.rechner = m.wer
        // Anderer Absender: alte Staende sofort zeigen, die Messung beginnt neu
        this.alleAnwenden()
        this.puffer.zuruecksetzen()
        return
      case 'voll':
        if (!this.game && this.start) this.spielBauen(this.start)
        if (!this.game) return
        this.warten = []
        this.puffer.zuruecksetzen()
        this.zeitMax = 0
        anwenden(this.game, m.z)
        this.game.wechsel(Math.max(0, this.ich))
        this.basis = { spiel: this.game.time, lokal: performance.now() }
        if (this.istRechner) {
          this.abgleich.vergessen()
          this.versenden(true)
        }
        return
      case 'z': {
        if (!this.game || this.istRechner) return
        const jetzt = performance.now()
        // Ohne Sendezeit (alter Rechner) oder ganzer Stand: gleich zeigen
        if (typeof m.s !== 'number' || m.voll) {
          this.alleAnwenden()
          return this.stand(m.d, m.e)
        }
        this.warten.push({ an: this.puffer.plane(m.s, jetzt), d: m.d, e: m.e })
        this.faelligeAnwenden(jetzt)
        return
      }
      case 'dir':
        if (this.istRechner && this.game) this.game.lenkeBei(m.wer, m.d, m.bei, m.k)
        return
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
        this.alleAnwenden()
        this.ergebnis = m.ergebnis
        this.melden({ art: 'ende', ergebnis: m.ergebnis })
        return
      case 'fehler':
        this.melden({ art: 'fehler', text: m.text })
        return
    }
  }

  /** Uhr mit dem Server abgleichen: nur schnelle Antworten zaehlen (eine lange kann auf dem Hinweg oder Rueckweg stecken) und sanft nachziehen */
  private uhrAbgleichen(serverJetzt: number) {
    if (!this.pingAb) return
    const jetzt = performance.now()
    const rtt = jetzt - this.pingAb
    this.pingAb = 0
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

  /** Einen Stand des Rechners in das gespiegelte Spiel uebernehmen */
  private stand(d: Zustand, e?: GameEvent[]) {
    const g = this.game
    if (!g) return
    anwenden(g, d)
    g.wechsel(Math.max(0, this.ich))
    this.basis = { spiel: g.time, lokal: performance.now() }
    this.vorhersagen()
    for (const ev of e ?? []) this.melden({ art: 'spiel', e: ev })
  }

  /** Alle Staende anwenden, deren Abspielzeit da ist */
  private faelligeAnwenden(jetzt: number) {
    let n = 0
    while (n < this.warten.length && this.warten[n].an <= jetzt) n++
    if (!n) return
    for (const w of this.warten.splice(0, n)) this.stand(w.d, w.e)
  }
  /** Alles Wartende sofort anwenden (neuer Rechner, Ende, ganzer Stand) */
  private alleAnwenden() {
    for (const w of this.warten.splice(0)) this.stand(w.d, w.e)
  }

  private spielBauen(info: StartInfo) {
    this.start = info
    this.ergebnis = null
    this.endeGeschickt = false
    this.warten = []
    this.puffer.zuruecksetzen()
    this.zeitMax = 0
    this.geister.clear()
    this.abgleich.vergessen()
    this.rechner = info.modus === 'rennen' ? -1 : info.rechner
    const ich = Math.max(0, this.ich)
    const spieler: SpielerInfo[] = info.modus === 'rennen' ? [info.spieler[ich]] : info.spieler
    this.game = new MehrGame({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, seed: info.seed, modus: info.modus, spieler, tempo: info.tempo ?? 'normal', cfg: { ...(GEGNER_MODI.includes(info.modus) ? DUELL : {}), ...(info.klassisch ? KLASSISCH : {}) } })
    this.game.wechsel(info.modus === 'rennen' ? 0 : ich)
    this.basis = { spiel: 0, lokal: performance.now() }
    this.waehler = -1
    if (this.istRechner) this.versenden(true)
    this.melden({ art: 'start', info })
  }

  /* ================= Spielen ================= */

  /** Eigener Wischer */
  lenke(d: Dir) {
    const g = this.game
    if (!g || !this.laeuft) return
    if (this.start?.modus === 'rennen') return g.lenke(0, d)
    if (this.istRechner) return g.lenke(this.ich, d)
    // Mitschicken, an welchem Feld der Kopf hier gerade ist: der Rechner biegt genau dort ab
    g.wechsel(this.ich)
    const bei = { ...g.body[0] }
    this.senden({ t: 'dir', d, bei, k: g.expansions })
    this.vorhersage = { d, bei, seit: performance.now() }
    this.vorhersagen()
  }

  /** Sofort anzeigen, wohin die eigene Schlange gleich faehrt (bis der Rechner es bestaetigt) */
  private vorhersagen() {
    const v = this.vorhersage
    const g = this.game
    if (!v || !g) return
    g.wechsel(this.ich)
    const h = g.body[0]
    // Umgesetzt, abgelaufen oder schon woanders: vergessen
    if (g.dir === v.d || performance.now() - v.seit > 600 || !h || (h.x !== v.bei.x || h.y !== v.bei.y)) {
      this.vorhersage = null
      return
    }
    // Noch am Feld: Kopf zeigt schon in die neue Richtung (keine Kehrtwende)
    if (v.d !== R.OPP[g.dir]) g.dir = v.d
  }

  reaktion(e: number) {
    this.senden({ t: 'emoji', e })
  }

  /** Jeden Frame: rechnen oder Gespiegeltes weiterzeichnen */
  frame(dt: number) {
    const g = this.game
    if (!g || !this.start) return
    if (this.start.modus === 'rennen') return this.rennenFrame(g, dt)
    if (this.istRechner) {
      if (this.laeuft && g.status === 'play') g.update(dt)
      const ev = g.drain()
      for (const e of ev) this.melden({ art: 'spiel', e })
      const jetzt = performance.now()
      if (ev.length || jetzt - this.letzterVersand >= VERSAND_MS) this.versenden(false, ev)
      if (g.status === 'over' && g.ergebnis && !this.endeGeschickt) {
        this.endeGeschickt = true
        this.senden({ t: 'ende', ergebnis: g.ergebnis })
      }
      g.wechsel(this.ich)
    } else {
      const jetzt = performance.now()
      this.faelligeAnwenden(jetzt)
      if (this.basis && g.status === 'play') {
        // Zwischen zwei Staenden die Zeit weiterlaufen lassen (fuer weiche Bewegung), hoechstens 0,3 s voraus.
        // Kommt ein Stand knapp "vor" der schon gezeigten Zeit an, steht die Zeit kurz still statt zurueckzuspringen
        let t = this.basis.spiel + Math.min(300, jetzt - this.basis.lokal)
        if (t < this.zeitMax && this.zeitMax - t < 150) t = this.zeitMax
        this.zeitMax = t
        g.time = t
      }
    }
  }

  private versenden(voll: boolean, e: GameEvent[] = []) {
    const g = this.game
    if (!g) return
    const jetzt = performance.now()
    this.letzterVersand = jetzt
    const z: Zustand = zustand(g, voll)
    if (voll) {
      this.abgleich.vergessen()
      this.abgleich.aenderungen(z)
      this.senden({ t: 'z', d: z, e, voll: true, s: jetzt })
      return
    }
    // Schlechtes Netz: alles, was schon wartet, kommt erst spaet an. Noch mehr dazuzulegen macht den Stau
    // groesser und alle Zuschauer bekommen alte Staende in einem Schwung. Die Aenderungen bleiben im Abgleich
    // liegen und kommen mit dem naechsten Stand (Ereignisse aber immer)
    if (!e.length && (this.ws?.bufferedAmount ?? 0) > STAU_BYTES) {
      this.stat.uebersprungen++
      return
    }
    const d = this.abgleich.aenderungen(z)
    // Auch ohne Aenderung regelmaessig melden: sonst haelt der Server den Rechner fuer ausgefallen
    if (d || e.length || jetzt - this.letzterHerz >= HERZ_MS) {
      this.letzterHerz = jetzt
      this.senden({ t: 'z', d: d ?? {}, e: e.length ? e : undefined, s: jetzt })
    }
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
        return { wer, name: p.name, skin: p.skin, aepfel: gs?.a ?? 0, leben: gs?.l ?? 3, raus: !!gs?.raus, tot: !!gs?.tot }
      })
    }
    g.sichern()
    return g.schlangen.map((s, wer) => ({ wer, name: s.name, skin: s.skin, aepfel: s.aepfel, leben: s.leben, raus: s.raus, tot: s.tot }))
  }
}
