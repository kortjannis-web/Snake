/**
 * Welten (Themes): tauschen Boden, Erde, Baeume, Wasser, Futter, Fallen, Tiere, Mauern und die Stimmung.
 * Die Spielregeln bleiben gleich. Freigeschaltet wird eine Welt, wenn man ihren Level einmal erreicht hat.
 */
import type { P } from '../game/types'
import { drawBaumStehend, drawBaumStehendSchnee, type BaumArt } from './baeume'
import type { WasserArt } from './flaechen'
import { drawSchlange, type Skin } from './skins'
import { apfelFarben, drawAmeise, drawApfel, drawFalle, drawFrosch, drawStein, rund } from './sprites'

export type WeltId = 'wiese' | 'winter' | 'wueste' | 'bergwerk' | 'zauberwald' | 'gruselwald'
type RGB = readonly [number, number, number]

export type Welt = {
  id: WeltId
  name: string
  /** ab diesem Level (einmal erreicht) freigeschaltet */
  ab: number
  text: string
  /** Schachbrett hell/dunkel, beim Aufklappen, Rand zur Erde */
  hell: string
  dunkel: string
  neu: string
  kante: string
  /** Erde: direkt am Rand, einen weiter, tief; Kruemel nah/tief; Grundfarbe */
  erde: { nah: RGB; mitte: RGB; tief: RGB; kruemelNah: string; kruemel: string; grund: string }
  baeume: BaumArt[]
  /** Winter: verschneite Tannen */
  schnee?: boolean
  wasser: WasserArt[]
  futter: 'apfel' | 'geschenk' | 'kaktusfeige' | 'kristall' | 'beere' | 'kuerbis'
  falle: 'baer' | 'schneeloch' | 'skorpion' | 'tnt' | 'fliegenfalle' | 'knochenhand'
  frosch: 'frosch' | 'pinguin' | 'springmaus' | 'fledermaus' | 'leuchtfrosch' | 'kroete'
  ameise: 'ameise' | 'eiskaefer' | 'feuerameise' | 'hoehlenspinne' | 'gluehkaefer' | 'spinne'
  mauer: 'stein' | 'schneestein' | 'sandstein' | 'fels' | 'moosstein' | 'grabstein'
  /** Dunkelheit 0..1 (mit Lichtern um Schlange, Fackeln, Lava, Leuchtendes) und ihre Farbe */
  finster: number
  nacht: RGB
}

export const WELTEN: Welt[] = [
  {
    id: 'wiese',
    name: 'Wiese',
    ab: 0,
    text: 'Grünes Gras, Laub-, Kirsch- und Herbstbäume, Teiche mit Seerosen.',
    hell: '#B4E3C1',
    dunkel: '#A5D7B3',
    neu: '#C3EBCD',
    kante: 'rgba(46, 96, 58, 0.7)',
    erde: { nah: [92, 63, 38], mitte: [70, 48, 30], tief: [44, 30, 20], kruemelNah: 'rgba(130, 92, 58, 0.6)', kruemel: 'rgba(20, 12, 8, 0.35)', grund: '#2C1E14' },
    baeume: ['laub', 'laub', 'kirsche', 'herbst'],
    wasser: ['tief', 'gras'],
    futter: 'apfel',
    falle: 'baer',
    frosch: 'frosch',
    ameise: 'ameise',
    mauer: 'stein',
    finster: 0,
    nacht: [0, 0, 0],
  },
  {
    id: 'winter',
    name: 'Winterwald',
    ab: 50,
    text: 'Schnee, Weihnachtsbäume, zugefrorene Seen. Statt Äpfeln Geschenke, Pinguine statt Frösche, Fallen sind Schneelöcher.',
    hell: '#EEF5F9',
    dunkel: '#DDE8EF',
    neu: '#F6FAFC',
    kante: 'rgba(255, 255, 255, 0.9)',
    erde: { nah: [86, 76, 78], mitte: [64, 56, 60], tief: [40, 34, 38], kruemelNah: 'rgba(240, 246, 250, 0.8)', kruemel: 'rgba(200, 215, 230, 0.25)', grund: '#28222A' },
    baeume: ['weihnacht', 'tanne', 'tanne'],
    schnee: true,
    wasser: ['winter'],
    futter: 'geschenk',
    falle: 'schneeloch',
    frosch: 'pinguin',
    ameise: 'eiskaefer',
    mauer: 'schneestein',
    finster: 0,
    nacht: [0, 0, 0],
  },
  {
    id: 'wueste',
    name: 'Wüstenoase',
    ab: 80,
    text: 'Sand, Palmen und Kakteen, Oasen und tiefe Seen. Kaktusfeigen statt Äpfeln, Wüstenspringmäuse, im Sand lauern Skorpione.',
    hell: '#F0DCA8',
    dunkel: '#E6CE95',
    neu: '#F7E7BF',
    kante: 'rgba(170, 120, 60, 0.6)',
    erde: { nah: [176, 104, 62], mitte: [146, 82, 48], tief: [108, 58, 36], kruemelNah: 'rgba(230, 170, 110, 0.6)', kruemel: 'rgba(60, 25, 12, 0.3)', grund: '#5A3020' },
    baeume: ['palme', 'palme', 'kaktus'],
    wasser: ['klar', 'klar', 'tief'],
    futter: 'kaktusfeige',
    falle: 'skorpion',
    frosch: 'springmaus',
    ameise: 'feuerameise',
    mauer: 'sandstein',
    finster: 0,
    nacht: [0, 0, 0],
  },
  {
    id: 'bergwerk',
    name: 'Bergwerk',
    ab: 120,
    text: 'Tief im Berg: Felsboden, Kristallsäulen, unterirdische Seen und Fackeln im Halbdunkel. Edelsteine statt Äpfeln, Fledermäuse, Sprengfallen.',
    hell: '#8E8378',
    dunkel: '#81776D',
    neu: '#9C9186',
    kante: 'rgba(30, 24, 20, 0.75)',
    erde: { nah: [86, 80, 76], mitte: [66, 61, 58], tief: [42, 39, 38], kruemelNah: 'rgba(150, 140, 130, 0.6)', kruemel: 'rgba(10, 8, 8, 0.4)', grund: '#24201E' },
    baeume: ['kristall'],
    wasser: ['hoehle'],
    futter: 'kristall',
    falle: 'tnt',
    frosch: 'fledermaus',
    ameise: 'hoehlenspinne',
    mauer: 'fels',
    finster: 0.5,
    nacht: [10, 6, 4],
  },
  {
    id: 'zauberwald',
    name: 'Zauberwald',
    ab: 160,
    text: 'Nacht im Zauberwald: Leuchtpilze, Glühwürmchen und leuchtende Seen. Zauberbeeren, Leuchtfrösche, fleischfressende Pflanzen.',
    hell: '#2F5446',
    dunkel: '#28493D',
    neu: '#386052',
    kante: 'rgba(10, 30, 22, 0.8)',
    erde: { nah: [58, 48, 70], mitte: [44, 36, 56], tief: [28, 22, 38], kruemelNah: 'rgba(160, 120, 220, 0.45)', kruemel: 'rgba(120, 255, 220, 0.18)', grund: '#1A1424' },
    baeume: ['pilz', 'pilz', 'laub'],
    wasser: ['zauber'],
    futter: 'beere',
    falle: 'fliegenfalle',
    frosch: 'leuchtfrosch',
    ameise: 'gluehkaefer',
    mauer: 'moosstein',
    finster: 0.35,
    nacht: [8, 6, 30],
  },
  {
    id: 'gruselwald',
    name: 'Gruselwald',
    ab: 200,
    text: 'Dichter, dunkler Wald, Nebel und tote Bäume. Kürbisse statt Äpfeln, Kröten, Spinnen, Grabsteine und Hände aus dem Boden.',
    hell: '#58574F',
    dunkel: '#4E4D46',
    neu: '#65645B',
    kante: 'rgba(10, 12, 10, 0.8)',
    erde: { nah: [26, 40, 30], mitte: [20, 32, 24], tief: [14, 22, 18], kruemelNah: 'rgba(40, 70, 50, 0.6)', kruemel: 'rgba(0, 0, 0, 0.3)', grund: '#0E1612' },
    baeume: ['totbaum', 'totbaum', 'tanne'],
    wasser: ['sumpf'],
    futter: 'kuerbis',
    falle: 'knochenhand',
    frosch: 'kroete',
    ameise: 'spinne',
    mauer: 'grabstein',
    finster: 0.3,
    nacht: [20, 6, 30],
  },
]
export const weltVon = (id: string | undefined) => WELTEN.find((w) => w.id === id) ?? WELTEN[0]
/** Freigeschaltet bei diesem besten Level? */
export const weltFrei = (w: Welt, best: number) => best >= w.ab

const TAU = Math.PI * 2
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* ================= Erde ================= */

/** Ein Erdfeld ausserhalb der Karte. ring = 1 direkt am Rand, 2 einen weiter, 0 tiefer, z = Zufall des Felds */
export function drawErdFeldWelt(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, ring: number, z: number) {
  const e = w.erde
  const basis = ring === 1 ? e.nah : ring === 2 ? e.mitte : e.tief
  const v = (z - 0.5) * 10
  ctx.fillStyle = `rgb(${basis[0] + v},${basis[1] + v * 0.7},${basis[2] + v * 0.5})`
  ctx.fillRect(x - 0.3, y - 0.3, cell + 0.6, cell + 0.6)
  if (w.id === 'gruselwald') {
    // Dichter Wald: dunkle Baumkronen, die ueber die Feldgrenzen ragen, mit Licht von oben links
    for (let i = 0; i < 4; i++) {
      const a = (z * 977 + i * 331) % 1
      const b = (z * 613 + i * 197) % 1
      waldKrone(ctx, x + a * cell, y + b * cell, cell * (0.36 + ((a + b) % 0.28)), (z * 50 + i * 13) % 22)
    }
    return
  }
  ctx.fillStyle = ring === 1 ? e.kruemelNah : e.kruemel
  for (let i = 0; i < 3; i++) {
    const a = (z * 977 + i * 331) % 1
    const b = (z * 613 + i * 197) % 1
    if (w.id === 'winter' && ring === 1) {
      ctx.beginPath()
      ctx.arc(x + a * cell, y + b * cell, cell * 0.07, 0, TAU)
      ctx.fill()
    } else ctx.fillRect(x + a * cell * 0.85, y + b * cell * 0.85, cell * 0.08, cell * 0.06)
  }
  if (w.id === 'wueste') {
    // Gesteinsschichten im Sandstein
    ctx.strokeStyle = 'rgba(80, 40, 20, 0.18)'
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.beginPath()
    ctx.moveTo(x, y + cell * (0.3 + z * 0.1))
    ctx.lineTo(x + cell, y + cell * (0.32 + z * 0.1))
    ctx.moveTo(x, y + cell * (0.72 - z * 0.08))
    ctx.lineTo(x + cell, y + cell * (0.7 - z * 0.08))
    ctx.stroke()
  }
}

/** Eine dunkle Baumkrone von oben (Gruselwald): Grundkreis, drei Blattbueschel, Glanzlicht oben links */
function waldKrone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: number) {
  const g = Math.round(26 + v)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.arc(x + r * 0.12, y + r * 0.18, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = `rgb(${g - 14}, ${g + 6}, ${g - 6})`
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = `rgb(${g - 6}, ${g + 18}, ${g + 2})`
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + v
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r * 0.38 - r * 0.12, y + Math.sin(a) * r * 0.38 - r * 0.12, r * 0.42, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(140, 170, 140, 0.16)'
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU)
  ctx.fill()
}

/** Gruselwald: Baumkronen vom Waldrand ragen hier und da ein Stueck ins Spielfeld (nur Optik).
 *  x, y = Erdfeld am Rand, drin = Kartenfelder */
export function drawWaldRand(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, z: number, drin: (x: number, y: number) => boolean) {
  for (const [dx, dy, k] of [[0, 1, 0], [0, -1, 1], [1, 0, 2], [-1, 0, 3]] as const) {
    if (!drin(x + dx, y + dy)) continue
    const h = (z * 7.13 + k * 0.37) % 1
    if (h > 0.55) continue
    // Mitte auf der Kante, leicht ins Feld geschoben
    const t = 0.2 + ((z * 3.7 + k) % 1) * 0.6
    const ein = 0.08 + h * 0.3
    const cx = (x + 0.5 + dx * (0.5 + ein) + (dy ? t - 0.5 : 0)) * cell
    const cy = (y + 0.5 + dy * (0.5 + ein) + (dx ? t - 0.5 : 0)) * cell
    waldKrone(ctx, cx, cy, cell * (0.34 + h * 0.25), (z * 40 + k * 5) % 22)
  }
}

/* ================= Futter ================= */

/** Futter je Welt (Farbe nach Wert wie beim Apfel). schimmel = Giftfutter mit verdorbener Stelle */
export function drawFutter(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, s: number, wipp = 0, schimmel?: number, stufe = 1, now = 0) {
  if (w.futter === 'apfel') return drawApfel(ctx, x, y, cell, s, wipp, schimmel, stufe)
  if (s <= 0) return
  const r = cell * 0.36 * s
  const f = apfelFarben(stufe)
  const hell = f[0][0]
  const mitte = f[0][1]
  const tief = f[f.length - 1][2]
  y += cell * 0.04
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.25, 0, 0, TAU)
  ctx.fill()
  y -= wipp
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  switch (w.futter) {
    case 'geschenk': {
      // Paket in Wertfarbe mit goldenem Band und Schleife
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
      g.addColorStop(0, hell)
      g.addColorStop(0.5, mitte)
      g.addColorStop(1, tief)
      ctx.fillStyle = g
      rund(ctx, x - r * 0.85, y - r * 0.7, r * 1.7, r * 1.55, r * 0.18)
      ctx.fill()
      ctx.fillStyle = f.length > 1 ? f[1][1] : 'rgba(255,255,255,0.18)'
      rund(ctx, x - r * 0.85, y - r * 0.7, r * 1.7, r * 0.35, r * 0.15)
      ctx.fill()
      ctx.fillStyle = '#FFE08A'
      ctx.fillRect(x - r * 0.13, y - r * 0.7, r * 0.26, r * 1.55)
      ctx.fillRect(x - r * 0.85, y - r * 0.08, r * 1.7, r * 0.24)
      ctx.strokeStyle = '#E8B13A'
      ctx.lineWidth = Math.max(1.2, r * 0.16)
      ctx.beginPath()
      ctx.ellipse(x - r * 0.28, y - r * 0.88, r * 0.28, r * 0.17, -0.4, 0, TAU)
      ctx.ellipse(x + r * 0.28, y - r * 0.88, r * 0.28, r * 0.17, 0.4, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = '#FFE08A'
      ctx.beginPath()
      ctx.arc(x, y - r * 0.78, r * 0.13, 0, TAU)
      ctx.fill()
      break
    }
    case 'kaktusfeige': {
      // Ovale Frucht in Wertfarbe, feine Stacheln, kleiner Kelch oben
      ctx.translate(x, y)
      ctx.rotate(-0.25)
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1)
      g.addColorStop(0, hell)
      g.addColorStop(0.5, mitte)
      g.addColorStop(1, tief)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(0, r * 0.05, r * 0.72, r * 0.92, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 250, 220, 0.85)'
      for (let i = 0; i < 9; i++) {
        const a = hash(i) * TAU
        const d = 0.25 + hash(i + 5) * 0.4
        ctx.fillRect(Math.cos(a) * r * d * 0.72, Math.sin(a) * r * d * 0.92, Math.max(1, r * 0.08), Math.max(1, r * 0.08))
      }
      ctx.fillStyle = '#5C8A3C'
      ctx.beginPath()
      ctx.ellipse(0, -r * 0.86, r * 0.3, r * 0.12, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.ellipse(-r * 0.3, -r * 0.25, r * 0.12, r * 0.22, -0.4, 0, TAU)
      ctx.fill()
      break
    }
    case 'kristall': {
      // Edelstein in Wertfarbe mit Facetten und Funkeln, leuchtet etwas
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.6)
      glow.addColorStop(0, mitte + '88')
      glow.addColorStop(1, mitte + '00')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r * 1.6, 0, TAU)
      ctx.fill()
      const pts: [number, number][] = [[0, -1], [0.78, -0.42], [0.62, 0.55], [0, 1.0], [-0.62, 0.55], [-0.78, -0.42]]
      const farben = [hell, mitte, tief, tief, mitte, hell]
      for (let i = 0; i < 6; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % 6]
        ctx.fillStyle = farben[i]
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + ax * r, y + ay * r)
        ctx.lineTo(x + bx * r, y + by * r)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.moveTo(x, y - r)
      ctx.lineTo(x - r * 0.78, y - r * 0.42)
      ctx.lineTo(x - r * 0.2, y - r * 0.2)
      ctx.fill()
      const tw = Math.max(0, Math.sin(now / 300))
      ctx.strokeStyle = `rgba(255,255,255,${tw})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x + r * 0.4, y - r * 0.85)
      ctx.lineTo(x + r * 0.4, y - r * 0.35)
      ctx.moveTo(x + r * 0.15, y - r * 0.6)
      ctx.lineTo(x + r * 0.65, y - r * 0.6)
      ctx.stroke()
      break
    }
    case 'beere': {
      // Drei leuchtende Zauberbeeren in Wertfarbe
      const p = 0.6 + 0.4 * Math.sin(now / 500)
      const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8)
      glow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * p})`)
      glow.addColorStop(0.4, mitte + '66')
      glow.addColorStop(1, mitte + '00')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r * 1.8, 0, TAU)
      ctx.fill()
      for (const [dx, dy] of [[-0.38, 0.22], [0.38, 0.22], [0, -0.3]] as const) {
        const g = ctx.createRadialGradient(x + dx * r - r * 0.12, y + dy * r - r * 0.12, r * 0.05, x + dx * r, y + dy * r, r * 0.5)
        g.addColorStop(0, '#FFFFFF')
        g.addColorStop(0.35, hell)
        g.addColorStop(1, tief)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x + dx * r, y + dy * r, r * 0.46, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#3FAF7A'
      ctx.beginPath()
      ctx.ellipse(x + r * 0.3, y - r * 0.8, r * 0.32, r * 0.14, -0.5, 0, TAU)
      ctx.fill()
      break
    }
    case 'kuerbis': {
      // Kuerbis in Wertfarbe mit Rippen und geschnitztem, leuchtendem Gesicht
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.15)
      g.addColorStop(0, hell)
      g.addColorStop(0.5, mitte)
      g.addColorStop(1, tief)
      ctx.fillStyle = g
      for (const [dx, rx] of [[-0.45, 0.55], [0.45, 0.55], [0, 0.6]] as const) {
        ctx.beginPath()
        ctx.ellipse(x + dx * r, y, rx * r, r * 0.82, 0, 0, TAU)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.lineWidth = Math.max(1, r * 0.06)
      ctx.beginPath()
      ctx.ellipse(x, y, r * 0.35, r * 0.8, 0, 0, TAU)
      ctx.stroke()
      const p = 0.7 + 0.3 * Math.sin(now / 160 + x)
      ctx.fillStyle = `rgba(255, 220, 90, ${p})`
      ctx.beginPath()
      ctx.moveTo(x - r * 0.45, y - r * 0.15)
      ctx.lineTo(x - r * 0.2, y - r * 0.15)
      ctx.lineTo(x - r * 0.32, y - r * 0.42)
      ctx.moveTo(x + r * 0.45, y - r * 0.15)
      ctx.lineTo(x + r * 0.2, y - r * 0.15)
      ctx.lineTo(x + r * 0.32, y - r * 0.42)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x - r * 0.5, y + r * 0.2)
      for (let i = 0; i <= 6; i++) ctx.lineTo(x - r * 0.5 + (i / 6) * r, y + r * (0.2 + (i % 2 ? 0.14 : 0.3)))
      ctx.lineTo(x + r * 0.5, y + r * 0.2)
      ctx.quadraticCurveTo(x, y + r * 0.62, x - r * 0.5, y + r * 0.2)
      ctx.fill()
      ctx.fillStyle = '#4E6B2A'
      ctx.fillRect(x - r * 0.08, y - r * 1.05, r * 0.16, r * 0.3)
      break
    }
  }
  ctx.restore()
  if (schimmel !== undefined) {
    // Verdorben: brauner Fleck mit grauem Flaum an einer Seite
    const mx = x + Math.cos(schimmel) * r * 0.5
    const my = y + Math.sin(schimmel) * r * 0.5
    const fr = ctx.createRadialGradient(mx, my, 0, mx, my, r * 0.55)
    fr.addColorStop(0, 'rgba(92, 70, 38, 0.95)')
    fr.addColorStop(0.6, 'rgba(110, 120, 70, 0.8)')
    fr.addColorStop(1, 'rgba(120, 60, 40, 0)')
    ctx.fillStyle = fr
    ctx.beginPath()
    ctx.arc(mx, my, r * 0.55, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(236, 240, 220, 0.9)'
    for (let i = 0; i < 6; i++) {
      const a = schimmel * 1.7 + i * 2.4
      ctx.beginPath()
      ctx.arc(mx + Math.cos(a) * r * 0.22, my + Math.sin(a) * r * 0.22, r * 0.06, 0, TAU)
      ctx.fill()
    }
  }
}

/* ================= Fallen ================= */

/** Falle je Welt. zu = 0 offen bis 1 zugeschnappt, warn = Warnschein, s = Ploppen */
export function drawFalleWelt(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, s: number, zu = 0, warn = 0, now = 0) {
  if (w.falle === 'baer') return drawFalle(ctx, x, y, cell, s, zu, warn)
  if (s <= 0) return
  const R = cell * 0.42 * s
  ctx.save()
  ctx.translate(x, y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (warn > 0) {
    ctx.fillStyle = `rgba(242, 119, 76, ${0.3 * warn})`
    ctx.beginPath()
    ctx.arc(0, 0, R * 1.3, 0, TAU)
    ctx.fill()
  }
  switch (w.falle) {
    case 'schneeloch': {
      // Dunkles Loch mit Schneerand und Eiszapfen; beim Zuschnappen bricht der Rand ein
      ctx.fillStyle = '#0E1A2A'
      ctx.beginPath()
      ctx.ellipse(0, 0, R * 0.8 * (1 - zu * 0.3), R * 0.65 * (1 - zu * 0.3), 0, 0, TAU)
      ctx.fill()
      const g = ctx.createRadialGradient(0, -R * 0.2, 0, 0, 0, R * 0.8)
      g.addColorStop(0, 'rgba(60, 100, 150, 0.6)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fill()
      ctx.fillStyle = '#BFE3F5'
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 1.05 + (i / 6) * Math.PI * 0.9
        const bx = Math.cos(a) * R * 0.72
        const by = Math.sin(a) * R * 0.58
        ctx.beginPath()
        ctx.moveTo(bx - R * 0.07, by)
        ctx.lineTo(bx + R * 0.07, by)
        ctx.lineTo(bx * 0.75, by * 0.75 + R * (0.2 + hash(i) * 0.15))
        ctx.fill()
      }
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = R * 0.24
      ctx.beginPath()
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * TAU
        const rr = 1 + (hash(i * 3) - 0.5) * 0.15
        ctx.lineTo(Math.cos(a) * R * 0.86 * rr, Math.sin(a) * R * 0.72 * rr)
      }
      ctx.stroke()
      if (zu > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${zu})`
        for (let i = 0; i < 8; i++) {
          const a = hash(i) * TAU
          const d = (1 - zu) * R * 0.7
          ctx.beginPath()
          ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8, R * 0.18, 0, TAU)
          ctx.fill()
        }
      }
      break
    }
    case 'skorpion': {
      // Sandhuegel, daraus schauen Scheren und der Stachel; beim Zuschnappen sticht er zu
      ctx.fillStyle = 'rgba(150, 100, 50, 0.35)'
      ctx.beginPath()
      ctx.ellipse(0, R * 0.1, R * 1.05, R * 0.85, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(160, 110, 60, 0.6)'
      ctx.lineWidth = Math.max(1, R * 0.05)
      for (const rr of [0.55, 0.8]) {
        ctx.beginPath()
        ctx.ellipse(0, R * 0.1, R * rr * 1.1, R * rr * 0.85, 0, Math.PI * 1.1, Math.PI * 1.9)
        ctx.stroke()
      }
      const k = '#3A2418'
      ctx.fillStyle = k
      ctx.strokeStyle = k
      // Koerper und Beine
      ctx.beginPath()
      ctx.ellipse(0, R * 0.15, R * 0.3, R * 0.4, 0, 0, TAU)
      ctx.fill()
      ctx.lineWidth = Math.max(1, R * 0.07)
      for (const sx of [-1, 1])
        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.moveTo(sx * R * 0.2, R * (0.05 + i * 0.15))
          ctx.lineTo(sx * R * 0.55, R * (0.0 + i * 0.2))
          ctx.lineTo(sx * R * 0.65, R * (0.15 + i * 0.22))
          ctx.stroke()
        }
      // Scheren vorne (oben)
      for (const sx of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(sx * R * 0.12, -R * 0.18)
        ctx.lineTo(sx * R * 0.38, -R * 0.55)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(sx * R * 0.42, -R * 0.68, R * 0.16, R * 0.12, sx * 0.4, 0, TAU)
        ctx.fill()
      }
      // Stachel: gebogen ueber den Ruecken, beim Zustechen nach vorn
      const st = zu > 0 ? Math.min(1, zu * 2) : 0.15 * Math.max(0, Math.sin(now / 200))
      const sx0 = 0
      const sy0 = R * 0.5
      ctx.lineWidth = R * 0.16
      ctx.beginPath()
      ctx.moveTo(sx0, sy0)
      ctx.quadraticCurveTo(R * 0.55, R * (0.4 - st * 0.8), R * 0.15 * (1 - st), -R * (0.15 + st * 0.6))
      ctx.stroke()
      ctx.fillStyle = '#B5121B'
      ctx.beginPath()
      ctx.arc(R * 0.15 * (1 - st), -R * (0.15 + st * 0.6), R * 0.1, 0, TAU)
      ctx.fill()
      break
    }
    case 'tnt': {
      // Drei Dynamitstangen mit Band und brennender Lunte; beim Zuschnappen knallt es
      if (zu > 0) {
        const k = Math.min(1, zu * 1.4)
        ctx.fillStyle = `rgba(255, 200, 60, ${1 - zu})`
        ctx.beginPath()
        for (let i = 0; i < 16; i++) {
          const rr = (i % 2 ? 0.5 : 1.3) * R * (0.4 + k)
          const a = (i / 16) * TAU
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        }
        ctx.fill()
        ctx.fillStyle = `rgba(120, 110, 100, ${0.7 * (1 - zu)})`
        for (let i = 0; i < 5; i++) {
          ctx.beginPath()
          ctx.arc(Math.cos(i * 1.3) * R * zu, Math.sin(i * 1.3) * R * zu - R * 0.2, R * 0.35 * zu, 0, TAU)
          ctx.fill()
        }
        if (zu > 0.35) break
      }
      ctx.fillStyle = 'rgba(12, 40, 32, 0.3)'
      ctx.beginPath()
      ctx.ellipse(0, R * 0.2, R * 0.8, R * 0.55, 0, 0, TAU)
      ctx.fill()
      for (const dx of [-0.34, 0, 0.34]) {
        const g = ctx.createLinearGradient(dx * R - R * 0.18, 0, dx * R + R * 0.18, 0)
        g.addColorStop(0, '#E2483B')
        g.addColorStop(1, '#8E1C17')
        ctx.fillStyle = g
        rund(ctx, dx * R - R * 0.18, -R * 0.6, R * 0.36, R * 1.2, R * 0.12)
        ctx.fill()
      }
      ctx.fillStyle = '#3A2A1A'
      ctx.fillRect(-R * 0.55, -R * 0.12, R * 1.1, R * 0.22)
      ctx.fillStyle = '#F5EFE6'
      ctx.font = `800 ${Math.round(R * 0.32)}px "Libre Franklin", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TNT', 0, R * 0.32)
      // Lunte mit Funken
      ctx.strokeStyle = '#2A2016'
      ctx.lineWidth = Math.max(1, R * 0.06)
      ctx.beginPath()
      ctx.moveTo(0, -R * 0.6)
      ctx.quadraticCurveTo(R * 0.3, -R * 0.95, R * 0.5, -R * 0.85)
      ctx.stroke()
      const f = 0.6 + 0.4 * Math.sin(now / 50)
      ctx.fillStyle = `rgba(255, 220, 90, ${f})`
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + now / 90
        ctx.beginPath()
        ctx.arc(R * 0.5 + Math.cos(a) * R * 0.12 * f, -R * 0.85 + Math.sin(a) * R * 0.12 * f, R * 0.05, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'fliegenfalle': {
      // Venusfliegenfalle: zwei Fangblaetter mit roter Innenseite und Wimpern; schnappen zu
      ctx.fillStyle = '#2E6B3A'
      for (const [a, l] of [[0.6, 0.9], [2.5, 0.85], [4.2, 0.9]] as const) {
        ctx.beginPath()
        ctx.ellipse(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * l * 0.45, R * 0.18, a, 0, TAU)
        ctx.fill()
      }
      const offen = 1 - zu
      for (const sy of [-1, 1]) {
        ctx.save()
        ctx.scale(1, 0.25 + 0.75 * offen)
        ctx.fillStyle = '#5DBB4A'
        ctx.beginPath()
        ctx.ellipse(0, sy * R * 0.38, R * 0.62, R * 0.4, 0, 0, TAU)
        ctx.fill()
        ctx.fillStyle = '#C8323C'
        ctx.beginPath()
        ctx.ellipse(0, sy * R * 0.3, R * 0.48, R * 0.26, 0, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = '#D9F2B0'
        ctx.lineWidth = Math.max(1, R * 0.05)
        for (let i = 0; i < 7; i++) {
          const t = (i / 6 - 0.5) * 1.8
          const bx = t * R * 0.55
          const by = sy * R * (0.38 - 0.38 * Math.sqrt(Math.max(0, 1 - (t / 1.25) ** 2)) * 0.9)
          ctx.beginPath()
          ctx.moveTo(bx, by)
          ctx.lineTo(bx, by - sy * R * 0.2)
          ctx.stroke()
        }
        ctx.restore()
      }
      break
    }
    case 'knochenhand': {
      // Erdhuegel mit Riss, daraus eine Knochenhand; beim Zuschnappen greift sie zu
      ctx.fillStyle = '#3A2E26'
      ctx.beginPath()
      ctx.ellipse(0, R * 0.2, R * 0.95, R * 0.7, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#1C1612'
      ctx.lineWidth = Math.max(1, R * 0.06)
      ctx.beginPath()
      ctx.moveTo(-R * 0.6, R * 0.3)
      ctx.lineTo(-R * 0.2, R * 0.1)
      ctx.lineTo(R * 0.1, R * 0.35)
      ctx.lineTo(R * 0.55, R * 0.15)
      ctx.stroke()
      const glow = 0.25 + 0.2 * Math.sin(now / 300)
      ctx.fillStyle = `rgba(170, 90, 255, ${glow})`
      ctx.beginPath()
      ctx.ellipse(0, R * 0.2, R * 0.6, R * 0.3, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#E8E0CC'
      ctx.fillStyle = '#E8E0CC'
      ctx.lineWidth = R * 0.13
      ctx.beginPath()
      ctx.ellipse(0, R * 0.05, R * 0.28, R * 0.22, 0, 0, TAU)
      ctx.fill()
      const greif = zu
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.85 + (i / 4) * Math.PI * 0.7
        const l = R * (i === 0 ? 0.45 : 0.62) * (1 - greif * 0.45)
        const bx = Math.cos(a) * R * 0.2
        const by = R * 0.05 + Math.sin(a) * R * 0.18
        const mx = bx + Math.cos(a) * l * 0.55
        const my = by + Math.sin(a) * l * 0.55
        const ex = mx + Math.cos(a + greif * 1.4) * l * 0.5
        const ey = my + Math.sin(a + greif * 1.4) * l * 0.5
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(mx, my)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      break
    }
  }
  ctx.restore()
}

/* ================= Tiere ================= */

/** Frosch-Platz je Welt (huepft wie ein Frosch). flug: 0..1 im Sprung, sonst -1 */
export function drawFroschWelt(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, ang: number, anlauf: number, flug: number, s: number, a = 1, now = 0) {
  if (w.frosch === 'frosch') return drawFrosch(ctx, x, y, cell, ang, anlauf, flug, s, a)
  if (s <= 0 || a <= 0) return
  const imFlug = flug >= 0 && flug <= 1
  const hoch = imFlug ? Math.sin(flug * Math.PI) : 0
  const u = cell * 0.5 * s * (1 + hoch * 0.2)
  ctx.save()
  ctx.globalAlpha *= a
  // Schatten bleibt am Boden
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.12, u * 0.8 * (1 - hoch * 0.3), u * 0.42 * (1 - hoch * 0.3), 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y - hoch * cell * 0.35)
  if (w.frosch === 'leuchtfrosch') {
    const p = 0.5 + 0.5 * Math.sin(now / 400)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.9)
    g.addColorStop(0, `rgba(90, 255, 220, ${0.45 + 0.2 * p})`)
    g.addColorStop(1, 'rgba(90, 255, 220, 0)')
    ctx.fillStyle = g
    ctx.fillRect(-cell, -cell, cell * 2, cell * 2)
    ctx.restore()
    drawFrosch(ctx, x, y, cell, ang, anlauf, flug, s, a)
    // leuchtende Punkte auf dem Ruecken
    ctx.save()
    ctx.translate(x, y - hoch * cell * 0.35)
    ctx.rotate(ang)
    ctx.fillStyle = `rgba(200, 255, 245, ${0.7 + 0.3 * p})`
    for (const [px, py] of [[-0.1, -0.12], [-0.25, 0.1], [0.05, 0.14]]) {
      ctx.beginPath()
      ctx.arc(px * cell, py * cell, cell * 0.05, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  ctx.rotate(ang)
  const duck = 1 - anlauf * 0.12
  switch (w.frosch) {
    case 'pinguin': {
      // Von oben: schwarzer Ruecken, weisses Gesicht, oranger Schnabel, Fluegel (schlagen im Sprung)
      const fl = imFlug ? Math.sin(flug * Math.PI * 6) * 0.6 : anlauf * 0.3
      ctx.fillStyle = '#F28C28'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(-u * 0.75, sy * u * 0.22, u * 0.18, u * 0.1, 0, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#1E2228'
      for (const sy of [-1, 1]) {
        ctx.save()
        ctx.translate(-u * 0.05, sy * u * 0.48)
        ctx.rotate(sy * (0.3 + fl))
        ctx.beginPath()
        ctx.ellipse(-u * 0.15, sy * u * 0.12, u * 0.38, u * 0.12, 0, 0, TAU)
        ctx.fill()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.ellipse(0, 0, u * 0.72 * duck, u * 0.55, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.ellipse(u * 0.38, 0, u * 0.28, u * 0.36, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#F28C28'
      ctx.beginPath()
      ctx.moveTo(u * 0.6, -u * 0.1)
      ctx.lineTo(u * 0.92, 0)
      ctx.lineTo(u * 0.6, u * 0.1)
      ctx.fill()
      ctx.fillStyle = '#111'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(u * 0.45, sy * u * 0.17, u * 0.06, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'springmaus': {
      // Wuestenspringmaus: langer Schwanz mit Quaste, grosse Ohren, lange Hinterbeine
      ctx.strokeStyle = '#C79A62'
      ctx.lineWidth = Math.max(1, u * 0.08)
      ctx.beginPath()
      ctx.moveTo(-u * 0.5, 0)
      ctx.quadraticCurveTo(-u * 1.1, imFlug ? 0 : u * 0.3, -u * 1.5, imFlug ? -u * 0.1 : u * 0.1)
      ctx.stroke()
      ctx.fillStyle = '#2B2016'
      ctx.beginPath()
      ctx.ellipse(-u * 1.55, imFlug ? -u * 0.1 : u * 0.1, u * 0.16, u * 0.1, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#FFF6E6'
      ctx.beginPath()
      ctx.ellipse(-u * 1.62, imFlug ? -u * 0.1 : u * 0.1, u * 0.07, u * 0.07, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#B98A55'
      const bein = imFlug ? u * 0.45 : u * 0.22 * (1 + anlauf)
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(-u * 0.35 - bein * 0.5, sy * u * 0.3, bein * 0.6 + u * 0.1, u * 0.1, 0, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#DDB57D'
      ctx.beginPath()
      ctx.ellipse(-u * 0.05, 0, u * 0.5 * duck, u * 0.36, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(u * 0.42, 0, u * 0.26, u * 0.24, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#F2C9B0'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(u * 0.28, sy * u * 0.3, u * 0.22, u * 0.13, sy * 0.6, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#111'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(u * 0.52, sy * u * 0.12, u * 0.055, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'fledermaus': {
      // Sitzend: Fluegel angelegt. Im Flug: weit gespannt mit gewelltem Rand
      const spann = imFlug ? 1 : 0.35 + anlauf * 0.25
      const schlag = imFlug ? Math.sin(flug * Math.PI * 8) * 0.25 : 0
      ctx.fillStyle = '#2E2533'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, sy * u * 0.15)
        ctx.lineTo(u * 0.2, sy * u * (0.4 + 0.9 * spann))
        for (let i = 1; i <= 3; i++) {
          const t = i / 3
          ctx.quadraticCurveTo(u * (0.15 - t * 0.6), sy * u * (0.3 + 0.9 * spann) * (1 - t * 0.35 + schlag), u * (0.1 - t * 0.7), sy * u * (0.4 + 0.9 * spann) * (1 - t * 0.5))
        }
        ctx.lineTo(-u * 0.4, sy * u * 0.1)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = '#44384C'
      ctx.beginPath()
      ctx.ellipse(0, 0, u * 0.4, u * 0.25, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(u * 0.38, 0, u * 0.2, u * 0.18, 0, 0, TAU)
      ctx.fill()
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(u * 0.35, sy * u * 0.08)
        ctx.lineTo(u * 0.48, sy * u * 0.3)
        ctx.lineTo(u * 0.5, sy * u * 0.06)
        ctx.fill()
      }
      ctx.fillStyle = '#FF5A5A'
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(u * 0.48, sy * u * 0.08, u * 0.045, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'kroete': {
      // Dunkle Kroete mit Warzen und orange gluehenden Augen
      ctx.fillStyle = '#3C3F24'
      const sprung = imFlug ? 0.6 : anlauf * 0.3
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(-u * (0.45 + sprung * 0.4), sy * u * 0.45, u * (0.32 + sprung * 0.3), u * 0.13, sy * 0.4, 0, TAU)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(u * 0.35, sy * u * 0.42, u * 0.2, u * 0.1, -sy * 0.5, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#4E5230'
      ctx.beginPath()
      ctx.ellipse(0, 0, u * 0.65 * duck, u * 0.52, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#6E6A3C'
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.arc((hash(i) - 0.5) * u * 0.9, (hash(i + 4) - 0.5) * u * 0.7, u * (0.05 + hash(i + 9) * 0.05), 0, TAU)
        ctx.fill()
      }
      const p = 0.7 + 0.3 * Math.sin(now / 250)
      for (const sy of [-1, 1]) {
        ctx.fillStyle = `rgba(255, 150, 40, ${p})`
        ctx.beginPath()
        ctx.arc(u * 0.4, sy * u * 0.22, u * 0.12, 0, TAU)
        ctx.fill()
        ctx.fillStyle = '#1A0F05'
        ctx.fillRect(u * 0.38, sy * u * 0.22 - u * 0.08, u * 0.04, u * 0.16)
      }
      break
    }
  }
  ctx.restore()
}

/** Ameisen-Platz je Welt (krabbelt wie eine Ameise). alarm: Ausrufezeichen */
export function drawAmeiseWelt(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, ang: number, lauf: number, s: number, alarm = 0, a = 1, now = 0) {
  if (w.ameise === 'ameise') return drawAmeise(ctx, x, y, cell, ang, lauf, s, alarm, a)
  if (w.ameise === 'feuerameise') return drawAmeise(ctx, x, y, cell, ang, lauf, s, alarm, a, ['#B3261E', '#D2452E', '#5A120E'])
  if (s <= 0 || a <= 0) return
  const u = cell * 0.5 * s
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
  ctx.beginPath()
  ctx.ellipse(x, y + u * 0.25, u * 0.75, u * 0.38, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x, y)
  ctx.rotate(ang)
  const wackel = lauf >= 0 ? Math.sin(lauf * TAU) * 0.3 : 0
  ctx.lineCap = 'round'
  if (w.ameise === 'hoehlenspinne' || w.ameise === 'spinne') {
    // Spinne: acht Beine, runder Hinterleib
    const schwarz = w.ameise === 'spinne'
    ctx.strokeStyle = schwarz ? '#121014' : '#5A4E44'
    ctx.lineWidth = Math.max(1, u * 0.07)
    for (let i = 0; i < 4; i++)
      for (const sy of [-1, 1]) {
        const w0 = (i - 1.5) * 0.45 + (sy > 0 ? wackel : -wackel) * (i % 2 ? 1 : -1)
        const l = u * (schwarz ? 0.85 : 0.7)
        ctx.beginPath()
        ctx.moveTo(u * 0.05, 0)
        ctx.lineTo(u * 0.05 + Math.sin(w0) * l * 0.4, sy * l * 0.55)
        ctx.lineTo(u * 0.05 + Math.sin(w0) * l * 0.9, sy * l * 0.85)
        ctx.stroke()
      }
    ctx.fillStyle = schwarz ? '#17141A' : '#6B5D50'
    ctx.beginPath()
    ctx.ellipse(-u * 0.32, 0, u * 0.38, u * 0.32, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(u * 0.18, 0, u * 0.2, u * 0.18, 0, 0, TAU)
    ctx.fill()
    if (schwarz) {
      // rote Sanduhr
      ctx.fillStyle = '#D21F2A'
      ctx.beginPath()
      ctx.moveTo(-u * 0.45, -u * 0.12)
      ctx.lineTo(-u * 0.2, -u * 0.12)
      ctx.lineTo(-u * 0.45, u * 0.12)
      ctx.lineTo(-u * 0.2, u * 0.12)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.ellipse(-u * 0.4, -u * 0.1, u * 0.14, u * 0.08, 0, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = schwarz ? '#FF4040' : '#E8F0A0'
    for (const sy of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(u * 0.32, sy * u * 0.06, u * 0.04, 0, TAU)
      ctx.fill()
    }
  } else {
    // Kaefer: Eiskaefer (blau glaenzend) oder Gluehkaefer (leuchtender Hinterleib)
    const eis = w.ameise === 'eiskaefer'
    ctx.strokeStyle = eis ? '#1E3550' : '#1C1A10'
    ctx.lineWidth = Math.max(1, u * 0.08)
    for (const [bx, w0] of [[u * 0.12, -0.5], [-u * 0.05, 0], [-u * 0.22, 0.5]] as const)
      for (const sy of [-1, 1]) {
        const ww = w0 + (sy > 0 ? wackel : -wackel)
        ctx.beginPath()
        ctx.moveTo(bx, 0)
        ctx.lineTo(bx + Math.sin(ww) * u * 0.3, sy * u * 0.45)
        ctx.stroke()
      }
    if (!eis) {
      const p = 0.6 + 0.4 * Math.sin(now / 350)
      const g = ctx.createRadialGradient(-u * 0.35, 0, 0, -u * 0.35, 0, u * 1.2)
      g.addColorStop(0, `rgba(220, 255, 120, ${0.55 * p})`)
      g.addColorStop(1, 'rgba(220, 255, 120, 0)')
      ctx.fillStyle = g
      ctx.fillRect(-u * 1.6, -u * 1.2, u * 2.4, u * 2.4)
      ctx.fillStyle = `rgba(230, 255, 140, ${0.8 + 0.2 * p})`
      ctx.beginPath()
      ctx.ellipse(-u * 0.38, 0, u * 0.24, u * 0.22, 0, 0, TAU)
      ctx.fill()
    }
    const g = ctx.createLinearGradient(0, -u * 0.35, 0, u * 0.35)
    g.addColorStop(0, eis ? '#9ED6FF' : '#3A3A28')
    g.addColorStop(1, eis ? '#2A6FB0' : '#1E1E12')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(-u * 0.05, 0, u * 0.38, u * 0.3, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = Math.max(1, u * 0.04)
    ctx.beginPath()
    ctx.moveTo(u * 0.3, 0)
    ctx.lineTo(-u * 0.42, 0)
    ctx.stroke()
    ctx.fillStyle = eis ? '#1E3550' : '#1C1A10'
    ctx.beginPath()
    ctx.ellipse(u * 0.38, 0, u * 0.14, u * 0.13, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.ellipse(-u * 0.1, -u * 0.14, u * 0.14, u * 0.06, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  if (alarm > 0) {
    ctx.save()
    ctx.globalAlpha *= a * alarm
    ctx.fillStyle = '#E5463B'
    ctx.font = `800 ${Math.round(cell * 0.5)}px "Libre Franklin", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.strokeText('!', x, y - cell * 0.42)
    ctx.fillText('!', x, y - cell * 0.42)
    ctx.restore()
  }
}

/* ================= Mauern und Haeuser ================= */

/** Mauerstein je Welt (x, y = linke obere Ecke des Felds), s = Ploppen */
export function drawMauerWelt(ctx: CanvasRenderingContext2D, w: Welt, x: number, y: number, cell: number, s: number) {
  if (w.mauer === 'stein') return drawStein(ctx, x, y, cell, s)
  if (s <= 0) return
  const sz = cell * 0.92 * s
  const ox = x + (cell - sz) / 2
  const oy = y + (cell - sz) / 2
  const r = cell * 0.16 * s
  const z = hash(Math.round(x / cell) * 13 + Math.round(y / cell) * 7)
  ctx.fillStyle = 'rgba(12, 20, 16, 0.28)'
  rund(ctx, ox, oy + cell * 0.1, sz, sz, r)
  ctx.fill()
  switch (w.mauer) {
    case 'schneestein':
      ctx.fillStyle = '#6E7C8A'
      rund(ctx, ox, oy, sz, sz, r)
      ctx.fill()
      ctx.fillStyle = '#8A98A6'
      rund(ctx, ox, oy + sz * 0.3, sz, sz * 0.25, r * 0.5)
      ctx.fill()
      // Schneehaube
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.moveTo(ox, oy + sz * 0.4)
      ctx.quadraticCurveTo(ox, oy - sz * 0.05, ox + sz * 0.5, oy - sz * 0.04)
      ctx.quadraticCurveTo(ox + sz, oy - sz * 0.05, ox + sz, oy + sz * 0.36)
      for (let i = 0; i <= 4; i++) ctx.lineTo(ox + sz * (1 - i / 4), oy + sz * (0.36 + (i % 2 ? 0.1 : 0)))
      ctx.fill()
      break
    case 'sandstein':
      ctx.fillStyle = '#C99A5E'
      rund(ctx, ox, oy, sz, sz, r)
      ctx.fill()
      ctx.fillStyle = '#E0B77A'
      rund(ctx, ox, oy, sz, sz * 0.3, r)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 72, 30, 0.35)'
      ctx.lineWidth = Math.max(1, cell * 0.04)
      ctx.beginPath()
      for (const t of [0.45, 0.65, 0.82]) {
        ctx.moveTo(ox + sz * 0.06, oy + sz * t)
        ctx.quadraticCurveTo(ox + sz * 0.5, oy + sz * (t + 0.04), ox + sz * 0.94, oy + sz * t)
      }
      ctx.stroke()
      break
    case 'fels': {
      ctx.fillStyle = '#4F4945'
      ctx.beginPath()
      const pts = [[0.05, 0.3], [0.3, 0.04], [0.75, 0.06], [0.97, 0.35], [0.92, 0.85], [0.55, 0.97], [0.12, 0.88]]
      pts.forEach(([a, b], i) => (i ? ctx.lineTo(ox + a * sz, oy + b * sz) : ctx.moveTo(ox + a * sz, oy + b * sz)))
      ctx.fill()
      ctx.fillStyle = '#6B645E'
      ctx.beginPath()
      ctx.moveTo(ox + 0.05 * sz, oy + 0.3 * sz)
      ctx.lineTo(ox + 0.3 * sz, oy + 0.04 * sz)
      ctx.lineTo(ox + 0.75 * sz, oy + 0.06 * sz)
      ctx.lineTo(ox + 0.6 * sz, oy + 0.5 * sz)
      ctx.fill()
      if (z > 0.6) {
        ctx.fillStyle = z > 0.8 ? '#B57CFF' : '#7FE3FF'
        ctx.beginPath()
        ctx.moveTo(ox + 0.62 * sz, oy + 0.62 * sz)
        ctx.lineTo(ox + 0.72 * sz, oy + 0.48 * sz)
        ctx.lineTo(ox + 0.78 * sz, oy + 0.7 * sz)
        ctx.fill()
      }
      break
    }
    case 'moosstein':
      ctx.fillStyle = '#3C4652'
      rund(ctx, ox, oy, sz, sz, r)
      ctx.fill()
      ctx.fillStyle = 'rgba(90, 255, 200, 0.35)'
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.arc(ox + sz * (0.2 + hash(z * 9 + i) * 0.6), oy + sz * (0.15 + hash(z * 5 + i) * 0.35), sz * 0.14, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(200, 255, 240, 0.8)'
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(ox + sz * (0.25 + hash(z * 3 + i) * 0.5), oy + sz * (0.2 + hash(z * 7 + i) * 0.3), sz * 0.03, 0, TAU)
        ctx.fill()
      }
      break
    case 'grabstein': {
      // Grabstein mit rundem Kopf, Kreuz und Moos
      ctx.fillStyle = '#7C7F84'
      ctx.beginPath()
      ctx.moveTo(ox + sz * 0.1, oy + sz)
      ctx.lineTo(ox + sz * 0.1, oy + sz * 0.4)
      ctx.arc(ox + sz * 0.5, oy + sz * 0.4, sz * 0.4, Math.PI, 0)
      ctx.lineTo(ox + sz * 0.9, oy + sz)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#95989E'
      ctx.beginPath()
      ctx.arc(ox + sz * 0.5, oy + sz * 0.4, sz * 0.4, Math.PI, Math.PI * 1.5)
      ctx.lineTo(ox + sz * 0.5, oy + sz * 0.4)
      ctx.fill()
      ctx.fillStyle = '#4C4F54'
      ctx.fillRect(ox + sz * 0.45, oy + sz * 0.22, sz * 0.1, sz * 0.42)
      ctx.fillRect(ox + sz * 0.33, oy + sz * 0.33, sz * 0.34, sz * 0.09)
      ctx.fillStyle = 'rgba(70, 100, 50, 0.7)'
      ctx.beginPath()
      ctx.ellipse(ox + sz * 0.25, oy + sz * 0.92, sz * 0.2, sz * 0.08, 0, 0, TAU)
      ctx.fill()
      break
    }
  }
}

/** Haeuser passend zur Welt ueberziehen (Schnee auf dem Dach, Toenung) */
export function hausUeberzug(ctx: CanvasRenderingContext2D, w: Welt, cells: P[], cell: number) {
  if (w.id === 'wiese') return
  for (const c of cells) {
    const x = c.x * cell
    const y = c.y * cell
    if (w.id === 'winter') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.beginPath()
      ctx.ellipse(x + cell * 0.5, y + cell * 0.45, cell * 0.42, cell * 0.32, hash(c.x + c.y) - 0.5, 0, TAU)
      ctx.fill()
    } else {
      ctx.fillStyle =
        w.id === 'wueste' ? 'rgba(230, 180, 110, 0.3)' : w.id === 'bergwerk' ? 'rgba(60, 50, 45, 0.35)' : w.id === 'zauberwald' ? 'rgba(90, 40, 150, 0.3)' : 'rgba(25, 20, 35, 0.45)'
      ctx.fillRect(x, y, cell, cell)
    }
  }
}

/* ================= Stimmung ================= */

export type Licht = { x: number; y: number; r: number }
let dunkelCv: HTMLCanvasElement | null = null

/** Dunkelheit mit Lichtern (Bildschirm-Koordinaten in CSS-Pixeln). dpr = Pixeldichte */
export function drawDunkel(ctx: CanvasRenderingContext2D, w: Welt, vw: number, vh: number, dpr: number, lichter: Licht[]) {
  if (w.finster <= 0) return
  dunkelCv ??= document.createElement('canvas')
  const sk = Math.min(1, dpr) * 0.5
  const W = Math.max(1, Math.round(vw * sk))
  const H = Math.max(1, Math.round(vh * sk))
  if (dunkelCv.width !== W || dunkelCv.height !== H) {
    dunkelCv.width = W
    dunkelCv.height = H
  }
  const d = dunkelCv.getContext('2d')!
  d.setTransform(1, 0, 0, 1, 0, 0)
  d.globalCompositeOperation = 'copy'
  d.fillStyle = `rgba(${w.nacht[0]}, ${w.nacht[1]}, ${w.nacht[2]}, ${w.finster})`
  d.fillRect(0, 0, W, H)
  d.globalCompositeOperation = 'destination-out'
  d.setTransform(sk, 0, 0, sk, 0, 0)
  for (const l of lichter) {
    if (l.x < -l.r || l.y < -l.r || l.x > vw + l.r || l.y > vh + l.r) continue
    const g = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.5, 'rgba(0,0,0,0.7)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    d.fillStyle = g
    d.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
  }
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(dunkelCv, 0, 0, vw, vh)
  ctx.restore()
}

/** Wetter und Teilchen im Bildschirm (Schnee, Glühwuermchen, Nebel, Staub, Steppenlaeufer) */
export function drawStimmung(ctx: CanvasRenderingContext2D, w: Welt, vw: number, vh: number, dpr: number, now: number, ox: number, oy: number) {
  if (w.id === 'wiese') return
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // Teilchen haengen leicht an der Welt (bewegen sich mit der Kamera etwas mit)
  const px = (v: number, p: number, m: number) => ((((v + p * 0.6) % m) + m) % m)
  if (w.id === 'winter') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    for (let i = 0; i < 70; i++) {
      const sp = 14 + hash(i) * 12
      const y = px(now / sp + hash(i + 3) * vh, oy, vh + 10) - 5
      const x = px(hash(i) * vw + Math.sin(now / 900 + i) * 14, ox, vw)
      ctx.beginPath()
      ctx.arc(x, y, 1 + hash(i + 7) * 2.2, 0, TAU)
      ctx.fill()
    }
  } else if (w.id === 'wueste') {
    ctx.fillStyle = 'rgba(230, 200, 140, 0.55)'
    for (let i = 0; i < 40; i++) {
      const x = px(now / (8 + hash(i) * 6) + hash(i) * vw, ox, vw)
      const y = px(hash(i + 5) * vh + Math.sin(now / 700 + i) * 6, oy, vh)
      ctx.fillRect(x, y, 2, 1)
    }
    // Ab und zu rollt ein Steppenlaeufer durchs Bild
    const z = (now % 16000) / 16000
    if (z < 0.4) {
      const x = -60 + (z / 0.4) * (vw + 120)
      const y = vh * 0.68 + Math.abs(Math.sin(z * 40)) * -18
      ctx.translate(x, y)
      ctx.rotate(z * 30)
      ctx.strokeStyle = 'rgba(140, 100, 50, 0.85)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 9; i++) {
        ctx.beginPath()
        ctx.ellipse(0, 0, 18, 8 + (i % 3) * 3, (i / 9) * Math.PI, 0, TAU)
        ctx.stroke()
      }
    }
  } else if (w.id === 'bergwerk') {
    ctx.fillStyle = 'rgba(255, 230, 190, 0.35)'
    for (let i = 0; i < 30; i++) {
      const x = px(hash(i) * vw + Math.sin(now / 2000 + i) * 20, ox, vw)
      const y = px(hash(i + 9) * vh + now / (60 + hash(i) * 50), oy, vh)
      ctx.fillRect(x, y, 1.5, 1.5)
    }
  } else if (w.id === 'zauberwald') {
    for (let i = 0; i < 26; i++) {
      const x = px(hash(i) * vw + Math.sin(now / 1300 + i * 2) * 30, ox, vw)
      const y = px(hash(i + 9) * vh + Math.cos(now / 1700 + i) * 22, oy, vh)
      const b = 0.5 + 0.5 * Math.sin(now / 300 + i * 3)
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9)
      g.addColorStop(0, `rgba(230, 255, 120, ${0.9 * b})`)
      g.addColorStop(1, 'rgba(230, 255, 120, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 9, y - 9, 18, 18)
    }
  } else if (w.id === 'gruselwald') {
    // Nebelschwaden ziehen langsam, selten ein fernes Wetterleuchten
    for (let i = 0; i < 6; i++) {
      const x = px(now / (40 + i * 9) + hash(i) * vw * 1.5, ox * 0.5, vw + 300) - 150
      const y = (hash(i + 3) * 0.9 + 0.05) * vh
      const g = ctx.createRadialGradient(x, y, 0, x, y, 160)
      g.addColorStop(0, 'rgba(190, 195, 210, 0.16)')
      g.addColorStop(1, 'rgba(190, 195, 210, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, 160, 60, 0, 0, TAU)
      ctx.fill()
    }
    const z = now % 13000
    if (z < 160 && Math.floor(z / 50) % 2 === 0) {
      ctx.fillStyle = 'rgba(220, 210, 255, 0.12)'
      ctx.fillRect(0, 0, vw, vh)
    }
  }
  ctx.restore()
}

/** Fackel an der Wand (Bergwerk): Holz mit flackernder Flamme. x, y = Mitte */
export function drawFackel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number) {
  ctx.fillStyle = '#5A3A20'
  ctx.fillRect(x - cell * 0.05, y - cell * 0.05, cell * 0.1, cell * 0.38)
  ctx.fillStyle = '#3A3A3A'
  ctx.fillRect(x - cell * 0.08, y - cell * 0.08, cell * 0.16, cell * 0.08)
  const f = 0.85 + 0.15 * Math.sin(now / 60 + x) + 0.1 * Math.sin(now / 37 + y)
  const g = ctx.createRadialGradient(x, y - cell * 0.15, 0, x, y - cell * 0.15, cell * 0.9)
  g.addColorStop(0, `rgba(255, 190, 90, ${0.45 * f})`)
  g.addColorStop(1, 'rgba(255, 140, 40, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x - cell, y - cell * 1.1, cell * 2, cell * 2)
  ctx.fillStyle = '#FF8A2A'
  ctx.beginPath()
  ctx.moveTo(x, y - cell * 0.38 * f)
  ctx.quadraticCurveTo(x + cell * 0.12, y - cell * 0.1, x, y - cell * 0.04)
  ctx.quadraticCurveTo(x - cell * 0.12, y - cell * 0.1, x, y - cell * 0.38 * f)
  ctx.fill()
  ctx.fillStyle = '#FFE08A'
  ctx.beginPath()
  ctx.ellipse(x, y - cell * 0.12, cell * 0.04, cell * 0.08 * f, 0, 0, TAU)
  ctx.fill()
}

/** Kleines Vorschaubild einer Welt (fuer die Auswahl im Aussehen): Brett, Erde, ein Baum, Futter, Schlange */
export function drawWeltVorschau(ctx: CanvasRenderingContext2D, w: Welt, breite: number, hoehe: number, now: number, skin: Skin) {
  const cell = hoehe / 4
  const cols = Math.ceil(breite / cell) + 1
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < cols; x++) {
      if (y === 0 || x === 0) {
        drawErdFeldWelt(ctx, w, x * cell, y * cell, cell, 1, hash(x * 7 + y * 3))
        continue
      }
      ctx.fillStyle = (x + y) % 2 ? w.dunkel : w.hell
      ctx.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
    }
  ctx.fillStyle = w.kante
  ctx.fillRect(cell, cell, cols * cell, Math.max(2, cell * 0.1))
  ctx.fillRect(cell, cell, Math.max(2, cell * 0.1), hoehe)
  const art = w.baeume[0]
  if (w.schnee) drawBaumStehendSchnee(ctx, true, { x: cols - 3, y: 2 }, cell, 0.8, now)
  else drawBaumStehend(ctx, art, { x: cols - 3, y: 2 }, cell, 0.8, now)
  drawFutter(ctx, w, (cols - 5.5) * cell, 1.6 * cell, cell, 1, 0, undefined, 1, now)
  drawSchlange(ctx, [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }], cell, 'r', skin, now)
  if (w.finster > 0) {
    ctx.fillStyle = `rgba(${w.nacht[0]}, ${w.nacht[1]}, ${w.nacht[2]}, ${w.finster * 0.5})`
    ctx.fillRect(0, 0, breite, hoehe)
  }
}
