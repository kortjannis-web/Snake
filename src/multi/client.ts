/**
 * Mehrspieler in der App: Verbindung zum Snake-Server, das laufende Spiel und was davon zu sehen ist.
 * Ohne DOM (die Oberflaeche steht in ui.ts).
 *
 * Gegeneinander und Koop: Ist dieses Geraet der Rechner, laeuft hier das ganze Spiel und der Stand
 * geht (nur die Aenderungen) an den Server; sonst wird der Stand vom Server uebernommen und nur
 * gezeichnet, Wischer gehen an den Rechner. Wettrennen: hier laeuft die eigene Welt, die anderen
 * kommen als Geister.
 */
import { MehrGame, type Ergebnis, type Modus, type SpielerInfo } from '../game/mehr'
import * as R from '../game/rules'
import type { Dir, GameEvent, P } from '../game/types'
import { Abgleich, anwenden, zustand, type Zustand } from '../game/zustand'
import { MEHR_BILD, PROTOKOLL, type AnServer, type Geist, type Phase, type StartInfo, type Teilnehmer, type VomServer } from './protokoll'

export type RaumInfo = { code: string; gastgeber: string; phase: Phase; modus: Modus; spieler: Teilnehmer[]; ich: number }

export type ClientEreignis =
  | { art: 'raum'; raum: RaumInfo }
  | { art: 'start'; info: StartInfo }
  | { art: 'spiel'; e: GameEvent & { wer?: number } }
  | { art: 'raus'; wer: number; grund: 'leben' | 'abstand' }
  | { art: 'ende'; ergebnis: Ergebnis }
  | { art: 'fehler'; text: string }
  | { art: 'verbindung'; ok: boolean }
  | { art: 'verlassen' }

/** Eine andere Schlange, wie sie gezeichnet wird */
export type Fremd = { wer: number; body: P[]; prev: P[]; dir: Dir; alpha: number; tot: boolean; deck: number; name: string; skin: string }

type GeistStand = Geist & { prev: P[]; seit: number }

/** So oft (ms) schickt der Rechner hoechstens seinen Stand */
const VERSAND_MS = 50
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

  constructor(
    private readonly server: string,
    private readonly ichInfo: () => SpielerInfo,
    private readonly melden: (e: ClientEreignis) => void,
  ) {}

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
      this.verbunden = true
      this.versuche = 0
      this.melden({ art: 'verbindung', ok: true })
      this.ping ??= setInterval(() => {
        this.pingAb = performance.now()
        this.senden({ t: 'ping' })
      }, 5000)
    }
    ws.onmessage = (e) => {
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

  /** Funkloch: in 1, 2, 4 ... Sekunden noch einmal (hoechstens 10 Versuche) */
  private spaeterNeu() {
    if (!this.gewollt || this.versuche >= 10) {
      if (this.gewollt) this.melden({ art: 'fehler', text: 'Keine Verbindung zum Server.' })
      this.gewollt = false
      this.aufraeumen()
      return
    }
    const ms = Math.min(8000, 1000 * 2 ** this.versuche++)
    setTimeout(() => this.gewollt && !this.ws && this.oeffnen(), ms)
  }

  verlassen() {
    this.gewollt = false
    const ws = this.ws
    this.ws = null
    ws?.close(1000)
    this.aufraeumen()
  }

  private aufraeumen() {
    if (this.ping) clearInterval(this.ping)
    this.ping = null
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
  nochmal() {
    this.senden({ t: 'nochmal' })
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
        this.raum = { code: m.code, gastgeber: m.gastgeber, phase: m.phase, modus: m.modus, spieler: m.spieler, ich: m.ich }
        if (m.phase === 'lobby' && vorher && vorher !== 'lobby') {
          this.start = null
          this.game = null
          this.ergebnis = null
          this.geister.clear()
        }
        this.melden({ art: 'raum', raum: this.raum })
        return
      }
      case 'start':
        this.versatz = m.jetzt - performance.now()
        return this.spielBauen(m.info)
      case 'pong':
        if (this.pingAb) this.versatz = m.jetzt + (performance.now() - this.pingAb) / 2 - performance.now()
        return
      case 'rechner':
        this.rechner = m.wer
        return
      case 'voll':
        if (!this.game && this.start) this.spielBauen(this.start)
        if (!this.game) return
        anwenden(this.game, m.z)
        this.game.wechsel(Math.max(0, this.ich))
        this.basis = { spiel: this.game.time, lokal: performance.now() }
        if (this.istRechner) {
          this.abgleich.vergessen()
          this.versenden(true)
        }
        return
      case 'z':
        if (!this.game || this.istRechner) return
        anwenden(this.game, m.d)
        this.game.wechsel(Math.max(0, this.ich))
        this.basis = { spiel: this.game.time, lokal: performance.now() }
        for (const e of m.e ?? []) this.melden({ art: 'spiel', e })
        return
      case 'dir':
        if (this.istRechner && this.game) this.game.lenke(m.wer, m.d)
        return
      case 'geist': {
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
        this.ergebnis = m.ergebnis
        this.melden({ art: 'ende', ergebnis: m.ergebnis })
        return
      case 'fehler':
        this.melden({ art: 'fehler', text: m.text })
        return
    }
  }

  private spielBauen(info: StartInfo) {
    this.start = info
    this.ergebnis = null
    this.endeGeschickt = false
    this.geister.clear()
    this.abgleich.vergessen()
    this.rechner = info.modus === 'rennen' ? -1 : info.rechner
    const ich = Math.max(0, this.ich)
    const spieler: SpielerInfo[] = info.modus === 'rennen' ? [info.spieler[ich]] : info.spieler
    this.game = new MehrGame({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, seed: info.seed, modus: info.modus, spieler, tempo: 'normal' })
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
    if (this.start?.modus === 'rennen') g.lenke(0, d)
    else if (this.istRechner) g.lenke(this.ich, d)
    else this.senden({ t: 'dir', d })
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
    } else if (this.basis && g.status === 'play') {
      // Zwischen zwei Staenden die Zeit weiterlaufen lassen (fuer weiche Bewegung), hoechstens 0,3 s voraus
      g.time = this.basis.spiel + Math.min(300, performance.now() - this.basis.lokal)
    }
  }

  private versenden(voll: boolean, e: GameEvent[] = []) {
    const g = this.game
    if (!g) return
    this.letzterVersand = performance.now()
    const z: Zustand = zustand(g, voll)
    if (voll) {
      this.abgleich.vergessen()
      this.abgleich.aenderungen(z)
      this.senden({ t: 'z', d: z, e, voll: true })
      return
    }
    const d = this.abgleich.aenderungen(z)
    // Auch ohne Aenderung regelmaessig melden: sonst haelt der Server den Rechner fuer ausgefallen
    if (d || e.length || performance.now() - this.letzterHerz >= HERZ_MS) {
      this.letzterHerz = performance.now()
      this.senden({ t: 'z', d: d ?? {}, e: e.length ? e : undefined })
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

  /** Die anderen Schlangen fuer den Zeichner */
  fremde(): Fremd[] {
    const g = this.game
    if (!g || !this.start) return []
    const out: Fremd[] = []
    if (this.start.modus === 'rennen') {
      const o = g.ursprung
      for (const [wer, s] of this.geister) {
        if (s.raus) continue
        const info = this.start.spieler[wer]
        const mv = (b: P[]) => b.map((p) => ({ x: p.x + o.x, y: p.y + o.y }))
        out.push({ wer, body: mv(s.b), prev: mv(s.prev.length === s.b.length ? s.prev : s.b), dir: s.d, alpha: Math.min(1, (performance.now() - s.seit) / g.tick), tot: s.tot, deck: 0.42, name: info?.name ?? '', skin: info?.skin ?? 'klassik' })
      }
      return out
    }
    g.sichern()
    g.schlangen.forEach((s, wer) => {
      if (wer === this.ich || s.raus) return
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
