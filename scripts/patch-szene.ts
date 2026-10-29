// Szenen fuer die Videos der Patchnotes und des Spielfuehrers (scripts/patch-videos.mjs): das echte Spiel mit dem echten
// Renderer, gesteuert vom Autopiloten, Bild fuer Bild mit fester Zeit. Wird mit esbuild fuer den Browser gebuendelt, nicht
// Teil der App.
import { autopilot } from '../src/game/autopilot'
import { missionSpiel } from '../src/game/boss'
import { Game, key } from '../src/game/game'
import { DUELL, GEGNER_MODI, MehrGame, type Modus } from '../src/game/mehr'
import { WIESE_MISSIONEN } from '../src/game/missionen'
import type { P } from '../src/game/types'
import { MEHR_BILD } from '../src/multi/protokoll'
import { BergKacheln } from '../src/render/berge'
import { Renderer } from '../src/render/renderer'
import { skinVon } from '../src/render/skins'
import { WELTEN } from '../src/render/welten'

/** Zeit fuer Renderer und Animationen: steht, bis die Aufnahme sie weiterdreht */
let uhr = 1000
performance.now = () => uhr

type Szene = {
  /** Mission (Nummer) oder freies Spiel */
  mission?: number
  welt?: string
  level?: number
  /** freies Spiel: einen Apfel essen, damit das Ereignis des Levels kommt (Boss, Kerker) */
  aufsteigen?: boolean
  seed?: number
  /** Schlange in die Naehe: 'boss' (Golem, Ent, Kaefigmeister), 'kaefig' (Kaefigkopf), 'kerker' */
  hin?: 'boss' | 'kaefig' | 'kerker'
  laenge?: number
  /** Feldgroesse in CSS-Pixeln */
  feld?: number
  /** so lange laufen lassen, bevor die Schlange hingesetzt wird (ms) */
  vorher?: number
  /** Abstand zum Ziel beim Hinsetzen (Felder) */
  nah?: number
  weit?: number
  /** vorlaufen lassen (ms), bevor die Aufnahme beginnt */
  vorlauf?: number
  titel?: string
  unter?: string
  /** Mehrspieler: Modus und Skins der Spieler (die erste Schlange ist die eigene, die Kamera folgt ihr) */
  mehr?: { modus: Modus; skins: string[] }
}

const NAMEN = ['Du', 'Mia', 'Ben', 'Lea']

let cv: HTMLCanvasElement
let r: Renderer
let g: Game
let s: Szene
let szeneZeit = 0

type Innen = { eat(n: P): void; expand(): void; die(c: unknown): void }

/** Freie Felder rund um p (Ring zwischen a und b Feldern), naechstes zuerst */
function freiNahe(p: P, a: number, b: number): P | null {
  const zu = g.hindernisse()
  let best: P | null = null
  let bd = 1e9
  for (let y = p.y - b; y <= p.y + b; y++)
    for (let x = p.x - b; x <= p.x + b; x++) {
      const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y))
      if (d < a || d > b || !g.inside({ x, y }) || zu.has(key(x, y))) continue
      const frei = [[0, 1], [0, 2], [0, 3]].every(([dx, dy]) => g.inside({ x: x + dx, y: y + dy }) && !zu.has(key(x + dx, y + dy)))
      const w = d + (frei ? 0 : 50)
      if (w < bd) {
        bd = w
        best = { x, y }
      }
    }
  return best
}

/** Schlange an einen Ort setzen: Kopf auf k, der Koerper windet sich ueber freie Felder davon weg */
function setzeSchlange(k: P, n: number) {
  const zu = g.hindernisse()
  const body: P[] = [{ ...k }]
  const drin = new Set([key(k.x, k.y)])
  const schritte: P[] = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
  while (body.length < n) {
    const t = body[body.length - 1]
    const nb = schritte.map((d) => ({ x: t.x + d.x, y: t.y + d.y })).find((c) => g.inside(c) && !zu.has(key(c.x, c.y)) && !drin.has(key(c.x, c.y)))
    if (!nb) break
    body.push(nb)
    drin.add(key(nb.x, nb.y))
  }
  g.body = body
  g.prev = body.map((b) => ({ ...b }))
  const h = body[0]
  const n1 = body[1] ?? { x: h.x, y: h.y + 1 }
  g.dir = n1.y > h.y ? 'u' : n1.y < h.y ? 'd' : n1.x > h.x ? 'l' : 'r'
  g.queue = []
}

function zielVon(live = false): P | null {
  const a = g as unknown as Record<string, any>
  if (s.hin === 'boss') {
    const k = a.kampf ?? a.freiBoss ?? a.freiEnt ?? a.freiMeister
    if (!k) return null
    if (k.meister) return live && k.meister.zustand !== 'weg' ? k.meister.p : (k.raeume[k.meister.raum]?.mitte ?? k.meister.p)
    const b = k.golem ?? k.ent
    if (b) return { x: Math.round(b.x), y: Math.round(b.y) }
    return null
  }
  if (s.hin === 'kaefig') {
    const k = a.kaefige?.[0]
    if (!k) return null
    if (live) return k.p
    const d = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[k.dir as string] ?? [0, 1]
    return { x: k.p.x + d[0] * 4, y: k.p.y + d[1] * 4 }
  }
  if (s.hin === 'kerker') return a.kerker?.[0]?.raum?.mitte ?? null
  return null
}

function szene(neu: Szene, w: number, h: number) {
  s = neu
  uhr += 5000
  cv = document.getElementById('c') as HTMLCanvasElement
  r = new Renderer(cv)
  r.resize(w, h)
  r.minikarte = false
  const quer = false
  r.mehr = null
  r.skin = skinVon('klassik')
  if (s.mehr) {
    const { modus, skins } = s.mehr
    const spieler = skins.map((skin, i) => ({ id: `s${i}`, name: NAMEN[i], skin }))
    g = new MehrGame({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, seed: s.seed ?? 7, modus, spieler, tempo: 'normal', leben: 3, cfg: GEGNER_MODI.includes(modus) ? DUELL : {} })
    r.welt = WELTEN[0]
    r.skin = skinVon(skins[0])
  } else if (s.mission) {
    const m = WIESE_MISSIONEN[s.mission - 1]
    const mg = missionSpiel(m, quer)
    g = mg
    r.welt = WELTEN.find((x) => x.id === m.welt) ?? WELTEN[0]
    r.berge = new BergKacheln(mg)
  } else {
    const welt = s.welt ?? 'wiese'
    r.welt = WELTEN.find((x) => x.id === welt)!
    g = new Game({ screenW: 12, screenH: 23, tempo: 'normal', seed: s.seed ?? 7, welt, wueste: welt === 'wueste', vulkan: welt === 'vulkan', startLevel: s.level ?? 1, zufallsWelt: true })
    if (s.aufsteigen) {
      const i = g as unknown as Innen
      i.eat({ ...g.apple.p })
      if (g.wahl > 0) {
        i.expand()
        g.wahl = 0
      }
    }
  }
  // Im Trailer stirbt niemand: Treffer kosten nichts, die Schlange faehrt einfach weiter
  ;(g as unknown as Innen).die = () => {}
  const feld = s.feld ?? 22
  r.cellFor = () => feld
  // Kaefigmeister: erst einmal erscheinen lassen (er kommt nur, solange man seinen Raum nicht sieht)
  for (let t = 0; t < (s.vorher ?? 0); t += 50) {
    if (g instanceof MehrGame) mehrLenken(g)
    g.update(50)
  }
  const ziel = zielVon()
  if (ziel) {
    const k = s.hin === 'kaefig' ? freiNahe(ziel, 0, 3) : freiNahe(ziel, s.nah ?? 3, s.weit ?? 7)
    if (k) setzeSchlange(k, s.laenge ?? 8)
  } else if (s.laenge) setzeSchlange(g.body[0], s.laenge)
  // Eigene Kamera fuer den Trailer: zwischen Kopf und dem, was gezeigt werden soll (Boss, Kaefigkopf, Kerker), weich
  const fokus = s.hin ? () => zielVon(true) : () => null
  let cam: P | null = null
  ;(r as unknown as { kamera: (g: Game, cell: number, dt: number, kopf: P) => P }).kamera = (_g, cell, _dt, kopf) => {
    const f = fokus()
    const zx = ((f ? (kopf.x + f.x) / 2 : kopf.x) + 0.5) * cell
    const zy = ((f ? (kopf.y + f.y) / 2 : kopf.y) + 0.5) * cell
    cam = cam ? { x: cam.x + (zx - cam.x) * 0.06, y: cam.y + (zy - cam.y) * 0.06 } : { x: zx, y: zy }
    return cam
  }
  r.reset()
  szeneZeit = 0
  for (let t = 0; t < (s.vorlauf ?? 0); t += 1000 / 30) schritt(1000 / 30, false)
  szeneZeit = 0
}

/** Mehrspieler: jede Schlange faehrt mit dem Autopiloten, danach steht wieder die eigene in den Feldern von Game */
function mehrLenken(m: MehrGame) {
  m.schlangen.forEach((sl, i) => {
    if (sl.tot || sl.raus) return
    m.wechsel(i)
    if (m.queue.length) return
    const d = autopilot(m)
    if (d) m.lenke(i, d)
  })
  m.wechsel(0)
}

/** Mehrspieler: die anderen Schlangen fuer den Renderer */
function mehrAnzeige(m: MehrGame) {
  m.sichern()
  r.mehr = {
    andere: m.schlangen.slice(1).map((sl) => ({
      body: sl.body,
      prev: sl.prev,
      dir: sl.dir,
      alpha: Math.min(1, Math.max(0, (m.time - sl.last) / m.tick)),
      tot: false,
      deck: m.modus === 'koop' ? 0.9 : 1,
      name: sl.name,
      skin: skinVon(sl.skin),
    })),
    ichTot: false,
    wahlSichtbar: false,
    zone: m.modus === 'royale' ? m.zone() : undefined,
    blasen: [],
  }
}

/** Ein Bild weiter: Spiel und Uhr um dt, zeichnen, Titel darueber; ein = Ein- und Ausblenden (0..1) */
function schritt(dt: number, zeichnen = true, ein = 1) {
  uhr += dt
  szeneZeit += dt
  if (g.status === 'over') g.status = 'play'
  if (g instanceof MehrGame) mehrLenken(g)
  else if (g.status === 'play' && !g.queue.length) {
    const d = autopilot(g)
    if (d) g.turn(d, false)
  }
  g.update(dt)
  g.drain()
  if (!zeichnen) return
  if (g instanceof MehrGame) mehrAnzeige(g)
  r.draw(g)
  const ctx = cv.getContext('2d')!
  const dpr = cv.width / r.vw
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const vw = r.vw
  const vh = r.vh
  // Kino-Verlauf oben, damit der Titel lesbar ist (unten steht bei Bossen ihre Leiste)
  const gr = ctx.createLinearGradient(0, 0, 0, 96)
  gr.addColorStop(0, 'rgba(23, 21, 19, 0.85)')
  gr.addColorStop(1, 'rgba(23, 21, 19, 0)')
  ctx.fillStyle = gr
  ctx.fillRect(0, 0, vw, 96)
  const k = Math.min(1, szeneZeit / 450)
  const y = 58 - (1 - k) * 8
  ctx.globalAlpha = k
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if (s.unter) {
    ctx.font = '700 11px "Libre Franklin", system-ui, sans-serif'
    ctx.fillStyle = '#f29a4c'
    ctx.fillText(s.unter.toUpperCase().split('').join('\u200A'), 18, y - 30)
  }
  if (s.titel) {
    ctx.font = '500 30px Newsreader, Georgia, serif'
    ctx.fillStyle = '#f5efe6'
    ctx.fillText(s.titel, 18, y)
  }
  ctx.globalAlpha = 1
  // Schnitt: kurz aus Schwarz ein- und ins Schwarz ausblenden
  if (ein < 1) {
    ctx.fillStyle = `rgba(23, 21, 19, ${(1 - ein).toFixed(3)})`
    ctx.fillRect(0, 0, vw, vh)
  }
}

function bild(typ = 'image/png') {
  return cv.toDataURL(typ, 0.95).split(',')[1]
}

Object.assign(window, { szene, schritt, bild, WELTEN_IDS: WELTEN.map((w) => ({ id: w.id, name: w.name })) })
