/**
 * Spiellogik Endlos-Modus, ohne Darstellung (laeuft auch im Test).
 *
 * Grundlage ist das Snake aus dem Hero-Telefon der Website: weicher Takt,
 * gepufferte Eingaben, Sofort-Wende, Gnadenschritt, Mauern Feld fuer Feld,
 * Teiche, keine Sackgassen und alle freien Felder bleiben erreichbar.
 *
 * Zeit: `time` laeuft nur, solange `update()` aufgerufen wird (Pause = nicht
 * aufrufen). Alle Zeitpunkte im Spiel beziehen sich auf `time`.
 */
import { rng, type Rng } from './rng'
import * as R from './rules'
import type { Ameise, Cause, Dir, Falle, GameEvent, Gift, Mauer, P, Side, Status, Teich, Wolke } from './types'

const { STEP, OPP, DIRS } = R

export type GameOpts = { screenW: number; screenH: number; tempo?: R.Tempo; seed?: number; startLevel?: number }

/** Schluessel fuer Sets (funktioniert auch fuer -1 und Karten bis 4000 Felder Kante) */
export const key = (x: number, y: number) => (y + 1) * 4096 + (x + 1)
const same = (a: P, b: P) => a.x === b.x && a.y === b.y
const manhattan = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
const cheb = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export class Game {
  readonly screenW: number
  readonly screenH: number
  readonly tempo: R.Tempo
  readonly r: Rng
  w: number
  h: number

  body: P[] = []
  prev: P[] = []
  dir: Dir = 'r'
  prevDir: Dir = 'r'
  ate = false
  halt = false
  queue: Dir[] = []

  apple: { p: P; t: number } = { p: { x: 0, y: 0 }, t: 0 }
  gift: Gift[] = []
  mauern: Mauer[] = []
  /** Alte Mauern, die gerade verschwinden */
  weg: { cells: P[]; t: number }[] = []
  teiche: Teich[] = []
  fallen: Falle[] = []
  /** Fallen, die zuschnappen und verschwinden */
  fallenWeg: { p: P; t: number }[] = []
  wolken: Wolke[] = []
  wolkenWeg: Wolke[] = []
  ameisen: Ameise[] = []

  time = 0
  last = 0
  tick: number
  level = 1
  apples = 0
  maxLen = 3
  status: Status = 'play'
  cause: Cause | null = null
  deathAt = 0
  /** Letzte Erweiterung der Karte (fuer die Einblendung) */
  gebiet: { side: Side; t: number; x: number; y: number; w: number; h: number } | null = null
  expansions = 0
  events: GameEvent[] = []

  private next = { falle: R.FALLE_AB, wolke: R.WOLKE_AB, ameise: R.AMEISE_AB }
  private lastSpawn = -1e9

  constructor(o: GameOpts) {
    this.screenW = o.screenW
    this.screenH = o.screenH
    this.w = o.screenW
    this.h = o.screenH
    this.tempo = o.tempo ?? 'normal'
    this.r = rng(o.seed)
    this.tick = R.takt(this.tempo, 1)
    const y = Math.floor(this.h / 2)
    const x = Math.max(3, Math.floor(this.w / 2) - 3)
    this.body = [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
    ]
    this.apple = { p: { x: Math.min(this.w - 2, x + 5), y }, t: 0 }
    // Zum Testen (und fuer ?level=): direkt mit hoeherem Level starten
    const start = Math.max(1, Math.floor(o.startLevel ?? 1))
    for (let l = 2; l <= start; l++) {
      this.level = l
      if (R.neuesGebiet(l)) this.expand()
    }
    this.apples = start - 1
    this.tick = R.takt(this.tempo, this.level)
    for (const k of ['falle', 'wolke', 'ameise'] as const) this.next[k] = Math.max(this.next[k], this.level + 1)
    if (start > 1) {
      this.gebiet = null
      this.events = []
      this.layout()
    }
  }

  /* ================= Ablauf ================= */

  /** Spielzeit weiterdrehen (dt in ms). Logik nur im Spiel, Zeit laeuft fuer Animationen weiter */
  update(dt: number) {
    this.time += Math.min(dt, 100)
    this.weg = this.weg.filter((m) => this.time - m.t < 240)
    this.teiche = this.teiche.filter((t) => t.drying === undefined || this.time - t.drying < 1500)
    if (this.status !== 'play') return
    // Nach einem Haenger nicht mehrere Schritte nachholen
    if (this.time - this.last > this.tick * 3) this.last = this.time - this.tick
    while (this.status === 'play' && this.time - this.last >= this.tick) {
      this.last += this.tick
      this.step()
    }
    if (this.status !== 'play') return
    this.wachsen()
    this.wolkenTakt()
    this.ameisenTakt()
    this.fallenTakt()
    this.regie()
  }

  /** Fortschritt zwischen zwei Feldern (0 bis 1) fuer die weiche Darstellung */
  alpha() {
    if (this.status !== 'play') return 1
    return Math.min(1, Math.max(0, (this.time - this.last) / this.tick))
  }

  private emit(e: GameEvent) {
    this.events.push(e)
  }

  /** Richtung in die Warteschlange (max. 3), keine Kehrtwende, keine Doppelung,
   *  Sofort-Wende im ersten Drittel eines Schritts (wie im Telefon) */
  turn(d: Dir, sofort = true) {
    if (this.status !== 'play') return
    if (
      sofort &&
      !this.queue.length &&
      !this.ate &&
      !this.halt &&
      this.prev.length === this.body.length &&
      this.time - this.last < this.tick * 0.34 &&
      d !== this.prevDir &&
      d !== OPP[this.prevDir]
    ) {
      this.body = this.prev.map((p) => ({ ...p }))
      this.dir = this.prevDir
      this.queue.push(d)
      this.step()
      return
    }
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir
    if (d === last || d === OPP[last] || this.queue.length >= 3) return
    this.queue.push(d)
  }

  /** Blickrichtungen (aktuell und schon gedrueckt) */
  blick(): Dir[] {
    return [this.dir, ...this.queue]
  }

  private step() {
    this.prev = this.body.map((p) => ({ ...p }))
    this.prevDir = this.dir
    this.ate = false
    const nd = this.queue.shift()
    if (nd) this.dir = nd
    const h = this.body[0]
    const n = { x: h.x + STEP[this.dir].x, y: h.y + STEP[this.dir].y }
    const eats = same(n, this.apple.p)
    const grows = eats && R.waechst(this.level + 1)
    const rest = grows ? this.body : this.body.slice(0, -1)

    // Giftapfel essen: sofort vorbei (kein Gnadenschritt, man hat ihn ja gegessen)
    const gi = this.gift.findIndex((g) => same(g.p, n))
    if (gi >= 0) {
      this.body.unshift(n)
      this.body.pop()
      this.gift.splice(gi, 1)
      this.die('gift')
      return
    }

    const cause = this.gefahr(n, rest)
    if (cause) {
      if (!this.halt) {
        // Erster Anlauf: stehen bleiben, abbiegen rettet noch
        this.halt = true
        this.prev = this.body.map((p) => ({ ...p }))
        this.last += this.tick * (R.GNADE - 1)
        this.emit({ type: 'halt' })
        return
      }
      this.prev = this.body.map((p) => ({ ...p }))
      this.die(cause)
      return
    }
    this.halt = false
    this.body.unshift(n)
    if (!grows) this.body.pop()
    this.maxLen = Math.max(this.maxLen, this.body.length)
    this.wachsen()
    this.wolkenNachruecken()
    if (eats) this.eat(n)
  }

  /** Was liegt auf diesem Feld (fuer den Kopf)? */
  gefahr(n: P, rest: P[] = this.body): Cause | null {
    if (n.x < 0 || n.y < 0 || n.x >= this.w || n.y >= this.h) return 'rand'
    if (this.mauern.some((m) => m.cells.slice(0, m.grown).some((p) => same(p, n)))) return 'mauer'
    if (this.teiche.some((t) => t.drying === undefined && t.cells.some((p) => same(p, n)))) return 'teich'
    if (this.fallen.some((f) => same(f.p, n))) return 'falle'
    if (this.wolken.some((w) => w.cells.some((p) => same(p, n)))) return 'wolke'
    if (this.ameisen.some((a) => a.gone === undefined && same(a.p, n))) return 'ameise'
    if (rest.some((p) => same(p, n))) return 'selbst'
    return null
  }

  private die(cause: Cause) {
    this.status = 'over'
    this.cause = cause
    this.deathAt = this.time
    this.queue = []
    this.emit({ type: 'die', cause })
  }

  private eat(n: P) {
    this.ate = true
    this.apples++
    this.level++
    this.emit({ type: 'eat', level: this.level, p: { ...n } })
    if (this.level % 10 === 0) this.emit({ type: 'milestone', level: this.level })
    for (const u of R.UNLOCKS) if (u.level === this.level) this.emit({ type: 'unlock', what: u.what, level: this.level })
    if (R.neuesGebiet(this.level)) this.expand()
    this.layout()
    this.tick = R.takt(this.tempo, this.level)
  }

  /** Nach jedem Apfel: Mauern neu, ggf. Teich, Apfel, Giftaepfel, Ereignisse */
  private layout() {
    if (this.mauern.length) {
      this.weg.push(...this.mauern.map((m) => ({ cells: m.cells.slice(0, m.grown), t: this.time })))
      this.mauern = []
    }
    if (R.neuerTeich(this.level)) this.neuerTeich(R.teichGroesse(this.level))
    const plan = R.mauern(this.level, this.w * this.h)
    for (const len of plan) this.neueMauer(len)
    if (plan.length) this.emit({ type: 'wall' })
    this.neuerApfel()
    this.neueGifte()
    for (const k of ['falle', 'wolke', 'ameise'] as const) {
      const ab = k === 'falle' ? R.FALLE_AB : k === 'wolke' ? R.WOLKE_AB : R.AMEISE_AB
      if (this.level < ab || this.level < this.next[k]) continue
      const pause = k === 'falle' ? R.fallePause(this.level) : k === 'wolke' ? R.wolkePause(this.level) : R.ameisePause(this.level)
      this.next[k] = this.level + this.r.int(pause[0], pause[1])
      this.spawn(k)
    }
  }

  /* ================= Karte erweitern ================= */

  /** Ein halber Bildschirm mehr Platz in eine zufaellige Richtung. Die Flaeche
   *  ist immer gleich (halber Bildschirm), die Karte bleibt ein Rechteck: ist
   *  sie schon breit, wird ein Streifen nach oben entsprechend flacher. */
  expand(side: Side = this.r.pick(['top', 'bottom', 'left', 'right'] as const)) {
    const half = (this.screenW * this.screenH) / 2
    const old = { w: this.w, h: this.h }
    let dx = 0
    let dy = 0
    let add: number
    if (side === 'top' || side === 'bottom') {
      add = Math.max(1, Math.round(half / this.w))
      this.h += add
      if (side === 'top') dy = add
    } else {
      add = Math.max(1, Math.round(half / this.h))
      this.w += add
      if (side === 'left') dx = add
    }
    if (dx || dy) this.shift(dx, dy)
    this.expansions++
    this.gebiet = { side, t: this.time, x: dx, y: dy, w: old.w, h: old.h }
    this.emit({ type: 'expand', side, add, dx, dy })
  }

  private shift(dx: number, dy: number) {
    const mv = (p: P) => {
      p.x += dx
      p.y += dy
    }
    this.body.forEach(mv)
    this.prev.forEach(mv)
    mv(this.apple.p)
    this.gift.forEach((g) => mv(g.p))
    this.mauern.forEach((m) => m.cells.forEach(mv))
    this.weg.forEach((m) => m.cells.forEach(mv))
    this.teiche.forEach((t) => t.cells.forEach(mv))
    this.fallen.forEach((f) => mv(f.p))
    this.fallenWeg.forEach((f) => mv(f.p))
    for (const w of [...this.wolken, ...this.wolkenWeg]) {
      mv(w.c)
      w.cells.forEach(mv)
      w.pending.forEach(mv)
    }
    this.ameisen.forEach((a) => {
      mv(a.p)
      mv(a.from)
    })
  }

  /* ================= Platz finden ================= */

  inside(c: P) {
    return c.x >= 0 && c.y >= 0 && c.x < this.w && c.y < this.h
  }

  /** Alle Hindernisse (fuer Platzsuche und Erreichbarkeit). Mauern mit allen geplanten Feldern */
  hindernisse(): Set<number> {
    const s = new Set<number>()
    const add = (p: P) => s.add(key(p.x, p.y))
    this.mauern.forEach((m) => m.cells.forEach(add))
    this.teiche.forEach((t) => t.cells.forEach(add))
    this.fallen.forEach((f) => add(f.p))
    this.wolken.forEach((w) => {
      w.cells.forEach(add)
      w.pending.forEach(add)
    })
    this.ameisen.forEach((a) => a.gone === undefined && add(a.p))
    this.gift.forEach((g) => add(g.p))
    return s
  }

  private freieNachbarn(c: P, wand: Set<number>) {
    let n = 0
    for (const d of DIRS) {
      const x = c.x + STEP[d].x
      const y = c.y + STEP[d].y
      if (x >= 0 && y >= 0 && x < this.w && y < this.h && !wand.has(key(x, y))) n++
    }
    return n
  }

  /** Breitensuche vom Kopf (der Koerper zaehlt als frei, er zieht ja weiter).
   *  Mit Typed Arrays, weil sie bei grossen Karten oft laeuft */
  erreichbar(wand: Set<number>): { size: number; has: (k: number) => boolean } {
    const { w, h } = this
    const zu = new Uint8Array(w * h)
    for (const k of wand) {
      const x = (k % 4096) - 1
      const y = Math.floor(k / 4096) - 1
      if (x >= 0 && y >= 0 && x < w && y < h) zu[y * w + x] = 1
    }
    const seen = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    const start = this.body[0]
    let head = 0
    let tail = 0
    let size = 0
    if (this.inside(start)) {
      const s0 = start.y * w + start.x
      seen[s0] = 1
      queue[tail++] = s0
      size = 1
    }
    while (head < tail) {
      const i = queue[head++]
      const x = i % w
      const y = (i - x) / w
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
      for (const n of nb) {
        if (n < 0 || seen[n] || zu[n]) continue
        seen[n] = 1
        queue[tail++] = n
        size++
      }
    }
    return {
      size,
      has: (k: number) => {
        const x = (k % 4096) - 1
        const y = Math.floor(k / 4096) - 1
        return x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x] === 1
      },
    }
  }

  /** Neue Hindernis-Felder: schliessen nichts ab und bauen keine Sackgasse
   *  (freies Feld mit nur einem freien Nachbarn). Geprueft wird nur, was sich
   *  aendert, damit voruebergehende Gefahren (Wolken) nichts blockieren. */
  private keinAbschluss(cells: P[], wand: Set<number>) {
    const neu = new Set(wand)
    for (const c of cells) neu.add(key(c.x, c.y))
    for (const c of cells)
      for (const d of DIRS) {
        const nb = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
        if (!this.inside(nb) || neu.has(key(nb.x, nb.y))) continue
        if (this.freieNachbarn(nb, neu) <= 1) return false
      }
    const vorher = this.erreichbar(wand)
    const nachher = this.erreichbar(neu)
    const weg = cells.filter((c) => vorher.has(key(c.x, c.y))).length
    return nachher.size === vorher.size - weg
  }

  /** Liegt das Feld im Streifen (3 breit) vor dem Kopf in Blickrichtung? */
  imWeg(c: P, weit = Infinity) {
    const head = this.body[0]
    return this.blick().some((dir) => {
      const d = STEP[dir]
      const vor = (c.x - head.x) * d.x + (c.y - head.y) * d.y
      const quer = Math.abs((c.x - head.x) * d.y - (c.y - head.y) * d.x)
      return vor > 0 && vor <= weit && quer <= 1
    })
  }

  private aufSchlange(c: P) {
    return this.body.some((p) => same(p, c))
  }

  /** Gemeinsame Pruefung fuer Mauern und Teiche (aus dem Telefon uebernommen) */
  private platzOk(cells: P[], art: 'mauer' | 'teich') {
    const head = this.body[0]
    // Ein Feld Luft zu anderen Mauern und Teichen
    const luft = new Set<number>()
    for (const p of [...this.teiche.flatMap((t) => t.cells), ...this.mauern.flatMap((m) => m.cells)])
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) luft.add(key(p.x + dx, p.y + dy))
    const wand = this.hindernisse()
    const seen = new Set<number>()
    for (const c of cells) {
      const k = key(c.x, c.y)
      if (!this.inside(c) || luft.has(k) || wand.has(k) || seen.has(k)) return false
      seen.add(k)
      if (same(c, this.apple.p)) return false
      if (art === 'teich' ? cheb(c, head) < 3 : manhattan(c, head) < 5) return false
      if (this.body.some((p) => cheb(p, c) < 2)) return false
      if (this.imWeg(c)) return false
    }
    return this.keinAbschluss(cells, wand)
  }

  private neueMauer(len: number) {
    const r = this.r
    for (let versuch = 0; versuch < 400; versuch++) {
      const spaet = versuch > 250
      const l = spaet ? 2 : len
      const knickBei = !spaet && l > 2 && r.next() < R.knick(l) ? r.int(1, l - 1) : -1
      let d = STEP[r.pick(DIRS)]
      // Die ersten Versuche nur im Inneren (nicht am Rand)
      const innen = versuch < 220
      let cur = innen ? { x: r.int(1, this.w - 2), y: r.int(1, this.h - 2) } : { x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }
      const cells: P[] = [cur]
      for (let i = 1; i < l; i++) {
        if (i === knickBei) d = r.next() < 0.5 ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x }
        cur = { x: cur.x + d.x, y: cur.y + d.y }
        cells.push(cur)
      }
      if (innen && cells.some((c) => c.x < 1 || c.y < 1 || c.x > this.w - 2 || c.y > this.h - 2)) continue
      if (!this.platzOk(cells, 'mauer')) continue
      this.mauern.push({ cells, grown: 0, t: [], next: this.time + 25 })
      return true
    }
    return false
  }

  /** Mauern wachsen um ein Feld je 25 ms, aber nie unter die Schlange */
  private wachsen() {
    for (const m of this.mauern)
      while (m.grown < m.cells.length && this.time >= m.next) {
        const c = m.cells[m.grown]
        if (this.aufSchlange(c)) break
        m.t[m.grown] = this.time
        m.grown++
        m.next = this.time + 25
      }
  }

  private neuerTeich(n: number) {
    const r = this.r
    for (let versuch = 0; versuch < 500; versuch++) {
      // Gelingt es lange nicht, etwas kleiner
      const size = Math.max(2, n - Math.floor(versuch / 120))
      const cells: P[] = [{ x: r.int(0, this.w - 1), y: r.int(0, this.h - 1) }]
      let guard = 0
      while (cells.length < size && guard++ < 60) {
        const von = r.pick(cells)
        const d = STEP[r.pick(DIRS)]
        const c = { x: von.x + d.x, y: von.y + d.y }
        if (!cells.some((o) => same(o, c))) cells.push(c)
      }
      if (cells.length < size || !this.platzOk(cells, 'teich')) continue
      this.teiche.push({ cells, t: this.time })
      this.emit({ type: 'pond' })
      // Zu viele Teiche: der aelteste trocknet aus
      const lebend = this.teiche.filter((t) => t.drying === undefined)
      if (lebend.length > R.teichMax(this.w * this.h)) lebend[0].drying = this.time
      return true
    }
    return false
  }

  /** Freie Felder fuer Aepfel und Giftaepfel: erreichbar, keine Sackgasse */
  private freieFelder(extra: (c: P) => boolean) {
    const wand = this.hindernisse()
    // Kuenftige Wolkenstufe meiden (sonst wird der Apfel gleich verschluckt)
    for (const w of this.wolken)
      for (const o of R.wolkenForm(w.stage + 1)) wand.add(key(w.c.x + o.x, w.c.y + o.y))
    const reach = this.erreichbar(wand)
    const out: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = { x, y }
        const k = key(x, y)
        if (wand.has(k) || !reach.has(k) || this.aufSchlange(c) || same(c, this.apple.p)) continue
        if (this.freieNachbarn(c, wand) <= 1 || !extra(c)) continue
        out.push(c)
      }
    return out
  }

  /** Neuer Apfel: zufaellig, auf grossen Karten eher in Reichweite (ca. ein Bildschirm) */
  neuerApfel() {
    const head = this.body[0]
    const nah = this.screenW + this.screenH
    let cand = this.freieFelder((c) => manhattan(c, head) >= 3 && manhattan(c, head) <= nah)
    if (!cand.length) cand = this.freieFelder(() => true)
    if (!cand.length) cand = this.freieFelderNotfall()
    if (!cand.length) return
    this.apple = { p: this.r.pick(cand), t: this.time }
  }

  private freieFelderNotfall() {
    const wand = this.hindernisse()
    const out: P[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!wand.has(key(x, y)) && !this.aufSchlange({ x, y }) && !same({ x, y }, this.apple.p)) out.push({ x, y })
    return out
  }

  /** Giftaepfel neu verteilen, einer davon gern in der Naehe des echten Apfels */
  private neueGifte() {
    this.gift = []
    const n = R.giftAnzahl(this.level)
    const head = this.body[0]
    for (let i = 0; i < n; i++) {
      const nahApfel = i === 0 && this.r.next() < 0.6
      const ok = (c: P) =>
        manhattan(c, head) >= 4 &&
        !this.imWeg(c, 6) &&
        cheb(c, this.apple.p) >= 2 &&
        (!nahApfel || manhattan(c, this.apple.p) <= 5)
      let cand = this.freieFelder(ok)
      if (!cand.length && nahApfel) cand = this.freieFelder((c) => manhattan(c, head) >= 4 && !this.imWeg(c, 6) && cheb(c, this.apple.p) >= 2)
      // Ein Giftapfel ist ein Hindernis: darf nichts abschliessen
      let wahl: P | null = null
      const wand = this.hindernisse()
      for (let v = 0; v < 30 && cand.length && !wahl; v++) {
        const c = this.r.pick(cand)
        if (this.keinAbschluss([c], wand)) wahl = c
        else cand = cand.filter((o) => o !== c)
      }
      if (!wahl) break
      this.gift.push({ p: wahl, t: this.time, ecke: this.r.next() * Math.PI * 2 })
    }
  }

  /* ================= Ereignisse ================= */

  aktiveEreignisse() {
    return this.fallen.length + this.wolken.length + this.aktiveAmeisen.length
  }

  /** Haelt die Mindestzahl an Ereignissen (ab 150 eins, ab 200 zwei, ab 300 drei) */
  private regie() {
    const min = R.mindestEreignisse(this.level)
    if (this.aktiveEreignisse() >= min || this.time - this.lastSpawn < 2500) return
    const arten = (['falle', 'wolke', 'ameise'] as const).filter((k) =>
      k === 'falle' ? this.level >= R.FALLE_AB : k === 'wolke' ? this.level >= R.WOLKE_AB : this.level >= R.AMEISE_AB,
    )
    if (!arten.length) return
    // Die Art, von der gerade am wenigsten unterwegs ist
    const anzahl = { falle: this.fallen.length, wolke: this.wolken.length, ameise: this.aktiveAmeisen.length }
    const wenig = Math.min(...arten.map((k) => anzahl[k]))
    const wahl = this.r.pick(arten.filter((k) => anzahl[k] === wenig))
    if (!this.spawn(wahl)) this.lastSpawn = this.time // nicht in jedem Bild neu versuchen
  }

  spawn(k: 'falle' | 'wolke' | 'ameise') {
    const ok = k === 'falle' ? this.neueFalle() : k === 'wolke' ? this.neueWolke() : this.neueAmeise()
    if (ok) this.lastSpawn = this.time
    return ok
  }

  /** Baerenfalle genau in der Bahn: 5 bis 8 Felder vor dem Kopf */
  neueFalle() {
    const head = this.body[0]
    const dir = this.queue.length ? this.queue[this.queue.length - 1] : this.dir
    const d = STEP[dir]
    const ks = this.r.shuffle([5, 6, 7, 8])
    const wand = this.hindernisse()
    for (const k of ks) {
      const c = { x: head.x + d.x * k, y: head.y + d.y * k }
      if (!this.inside(c) || wand.has(key(c.x, c.y)) || this.aufSchlange(c) || same(c, this.apple.p)) continue
      if (!this.keinAbschluss([c], wand)) continue
      this.fallen.push({ p: c, t: this.time, until: this.time + R.FALLE_DAUER })
      this.emit({ type: 'trap' })
      return true
    }
    return false
  }

  private fallenTakt() {
    const zu = this.fallen.filter((f) => this.time >= f.until)
    if (!zu.length) return
    this.fallen = this.fallen.filter((f) => this.time < f.until)
    this.fallenWeg.push(...zu.map((f) => ({ p: f.p, t: this.time })))
    this.fallenWeg = this.fallenWeg.filter((f) => this.time - f.t < 1000)
  }

  neueWolke() {
    const head = this.body[0]
    const wand = this.hindernisse()
    const cand: P[] = []
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++) {
        const c = { x, y }
        if (wand.has(key(x, y)) || this.aufSchlange(c) || same(c, this.apple.p)) continue
        if (manhattan(c, head) < 7 || this.imWeg(c, 10)) continue
        cand.push(c)
      }
    if (!cand.length) return false
    const c = this.r.pick(cand)
    this.wolken.push({
      c,
      t: this.time,
      stage: 0,
      maxStage: R.wolkeMaxStufe(this.level),
      nextAt: this.time + R.WOLKE_TAKT,
      until: Infinity,
      cells: [{ ...c }],
      pending: [],
      bornAt: [this.time],
    })
    this.emit({ type: 'cloud' })
    return true
  }

  private wolkenTakt() {
    for (const w of this.wolken) {
      if (w.stage < w.maxStage && this.time >= w.nextAt) {
        w.stage++
        w.nextAt = this.time + R.WOLKE_TAKT
        if (w.stage === w.maxStage) w.until = this.time + R.WOLKE_VERWEILEN
        const has = new Set([...w.cells, ...w.pending].map((p) => key(p.x, p.y)))
        for (const o of R.wolkenForm(w.stage)) {
          const c = { x: w.c.x + o.x, y: w.c.y + o.y }
          if (!this.inside(c) || has.has(key(c.x, c.y))) continue
          if (this.aufSchlange(c)) w.pending.push(c)
          else {
            w.cells.push(c)
            w.bornAt.push(this.time)
          }
        }
        this.emit({ type: 'cloudGrow' })
        this.wolkeVerschluckt(w)
      }
    }
    const weg = this.wolken.filter((w) => this.time >= w.until)
    if (weg.length) {
      this.wolken = this.wolken.filter((w) => this.time < w.until)
      this.wolkenWeg.push(...weg)
    }
    this.wolkenWeg = this.wolkenWeg.filter((w) => this.time - w.until < R.WOLKE_AUFLOESEN)
  }

  /** Felder, die unter der Schlange lagen, kommen dazu, sobald sie frei sind */
  private wolkenNachruecken() {
    for (const w of this.wolken) {
      if (!w.pending.length) continue
      const frei = w.pending.filter((c) => !this.aufSchlange(c))
      if (!frei.length) continue
      w.pending = w.pending.filter((c) => this.aufSchlange(c))
      for (const c of frei) {
        w.cells.push(c)
        w.bornAt.push(this.time)
      }
      this.wolkeVerschluckt(w)
    }
  }

  /** Was die Wolke ueberdeckt: Apfel springt woandershin, Giftaepfel verschwinden */
  private wolkeVerschluckt(w: Wolke) {
    const in_ = (p: P) => w.cells.some((c) => same(c, p))
    if (in_(this.apple.p)) this.neuerApfel()
    this.gift = this.gift.filter((g) => !in_(g.p))
  }

  neueAmeise() {
    const head = this.body[0]
    const wand = this.hindernisse()
    const cand: { p: P; dir: Dir }[] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const p = { x, y }
        if (wand.has(key(x, y)) || this.aufSchlange(p) || same(p, this.apple.p)) continue
        if (manhattan(p, head) < 8 || this.imWeg(p, 8)) continue
        for (const dir of DIRS) {
          const d = STEP[dir]
          const room = d.x > 0 ? this.w - 1 - x : d.x < 0 ? x : d.y > 0 ? this.h - 1 - y : y
          if (room >= 4) cand.push({ p, dir })
        }
      }
    if (!cand.length) return false
    const c = this.r.pick(cand)
    this.ameisen.push({ p: c.p, from: { ...c.p }, dir: c.dir, t: this.time, movedAt: -1e9, nextAt: this.time + R.ameiseTakt(this.level) })
    this.emit({ type: 'ant' })
    return true
  }

  private ameisenTakt() {
    for (const a of this.ameisen) {
      if (a.gone !== undefined || this.time < a.nextAt) continue
      const takt = R.ameiseTakt(this.level)
      const vor = (dir: Dir) => ({ x: a.p.x + STEP[dir].x, y: a.p.y + STEP[dir].y })
      const n = vor(a.dir)
      if (!this.inside(n)) {
        // Am Rand: verschwindet
        a.gone = this.time
        continue
      }
      const blockiert = (c: P) =>
        this.mauern.some((m) => m.cells.some((p) => same(p, c))) ||
        this.teiche.some((t) => t.cells.some((p) => same(p, c))) ||
        this.fallen.some((f) => same(f.p, c)) ||
        this.gift.some((g) => same(g.p, c)) ||
        this.ameisen.some((o) => o !== a && o.gone === undefined && same(o.p, c))
      let dir = a.dir
      if (blockiert(n)) {
        // Hindernis: zur Seite abbiegen, notfalls umdrehen
        const seiten = this.r.shuffle(DIRS.filter((d) => d !== a.dir && d !== OPP[a.dir]))
        const frei = [...seiten, OPP[a.dir]].find((d) => this.inside(vor(d)) && !blockiert(vor(d)))
        if (!frei) {
          a.nextAt = this.time + 600
          continue
        }
        dir = frei
      }
      const ziel = vor(dir)
      if (this.aufSchlange(ziel)) {
        // Die Schlange ist im Weg: kurz warten
        a.dir = dir
        a.nextAt = this.time + 600
        continue
      }
      a.dir = dir
      a.from = { ...a.p }
      a.p = ziel
      a.movedAt = this.time
      a.nextAt = this.time + takt
      this.emit({ type: 'antStep' })
      if (same(ziel, this.apple.p)) {
        this.neuerApfel()
        this.emit({ type: 'stolen' })
      }
    }
    this.ameisen = this.ameisen.filter((a) => a.gone === undefined || this.time - a.gone < 700)
  }

  /** Ameisen, die noch zaehlen (nicht gerade verschwindend) */
  get aktiveAmeisen() {
    return this.ameisen.filter((a) => a.gone === undefined)
  }

  /** Events abholen */
  drain(): GameEvent[] {
    const e = this.events
    this.events = []
    return e
  }
}
