/**
 * Effekte: Auren um die Schlange (Funken, Wolken, Blitze, Flammen ...). Nicht kaufbar, sondern freigeschaltet:
 * 20 mit Silber-Trophaeen (alle je verdienten Aepfel; seit 1.53 viel frueher: die ersten zehn alle 1.000, dann in
 * 2.000er-Schritten bis 20.000, danach in 5.000er-Schritten), 10 mit Gold-Trophaeen (aus Mehrspieler-Siegen).
 * Gezeichnet in zwei Schichten: hinter der Schlange (Leuchten, Boden) und davor (Teilchen, Wolken).
 */
import type { P } from '../game/types'

export type Effekt = { id: string; nr: number; name: string; art: 'silber' | 'gold'; ab: number; text: string }
const s = (nr: number, id: string, name: string, ab: number, text: string): Effekt => ({ id: `fx-${id}`, nr, name, art: 'silber', ab, text })
const g = (nr: number, id: string, name: string, ab: number, text: string): Effekt => ({ id: `fx-${id}`, nr, name, art: 'gold', ab, text })

export const EFFEKTE: Effekt[] = [
  s(1, 'glimmer', 'Glimmer', 1_000, 'Funkeln um die ganze Schlange'),
  s(2, 'staub', 'Staubwolke', 2_000, 'Staub wirbelt um den Körper'),
  s(3, 'gluehen', 'Glühen', 3_000, 'Weicher Schein um die ganze Schlange'),
  s(4, 'blaetter', 'Blätterwirbel', 4_000, 'Blätter wirbeln um die Schlange'),
  s(5, 'schnee', 'Schneegestöber', 5_000, 'Schneeflocken wirbeln herum'),
  s(6, 'funkenring', 'Funkenring', 6_000, 'Funken sprühen um den Körper'),
  s(7, 'herzschlag', 'Herzschlag', 7_000, 'Herzen schweben um den Körper'),
  s(8, 'noten', 'Notenwirbel', 8_000, 'Musiknoten tanzen'),
  s(9, 'blasen', 'Blubberblasen', 9_000, 'Blasen steigen auf'),
  s(10, 'rauch', 'Rauchschwaden', 10_000, 'Rauch steigt vom Körper'),
  s(11, 'sternenkranz', 'Sternenkranz', 12_000, 'Sterne funkeln entlang der Schlange'),
  s(12, 'gluehwuermchen', 'Glühwürmchen', 14_000, 'Ein kleiner Schwarm folgt dir'),
  s(13, 'regenwolke', 'Regenwolke', 16_000, 'Regen fällt auf die ganze Schlange'),
  s(14, 'wirbelwind', 'Wirbelwind', 18_000, 'Wind wirbelt um den ganzen Körper'),
  s(15, 'frost', 'Frostaura', 20_000, 'Eisiger Schein mit Kristallen'),
  s(16, 'flammen', 'Flammenaura', 25_000, 'Flammen lodern am Körper'),
  s(17, 'elektro', 'Elektroaura', 30_000, 'Funkende Stromschläge'),
  s(18, 'gewitter', 'Gewitterwolke', 35_000, 'Eine Gewitterwolke schlägt Blitze'),
  s(19, 'polarlicht', 'Polarlicht', 40_000, 'Leuchtende Bänder über dem Körper'),
  s(20, 'regenbogen', 'Regenbogenaura', 45_000, 'Pulsierende Regenbogenringe'),
  g(21, 'goldstaub', 'Goldstaub', 3, 'Glitzernder Goldstaub'),
  g(22, 'schatten', 'Schattenaura', 8, 'Dunkle Schwaden mit violettem Glimmen'),
  g(23, 'feuerkreis', 'Feuerkreis', 15, 'Feuer lodert um die Schlange'),
  g(24, 'kugelblitz', 'Kugelblitze', 25, 'Plasmakugeln umkreisen die Schlange'),
  g(25, 'geister', 'Geisterschwarm', 40, 'Kleine Geister schweben um dich'),
  g(26, 'runen', 'Runenkreis', 60, 'Magische Runen um den Körper und ein Kreis am Kopf'),
  g(27, 'fluegel', 'Phönixflügel', 90, 'Flammende Flügel'),
  g(28, 'korona', 'Sonnenkorona', 130, 'Sonnenstrahlen um die ganze Schlange'),
  g(29, 'strudel', 'Ereignishorizont', 180, 'Ein Strudel saugt Licht in den Körper'),
  g(30, 'goettlich', 'Göttliches Licht', 250, 'Lichtstrahlen, Heiligenschein, Federn'),
]
export const effektVon = (id: string | null | undefined) => EFFEKTE.find((e) => e.id === id)
/** Freigeschaltet? silber = alle je verdienten Aepfel, gold = Gold-Trophaeen */
export const effektFrei = (e: Effekt, silber: number, gold: number) => (e.art === 'silber' ? silber : gold) >= e.ab

const TAU = Math.PI * 2
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}
/** Welle mit ganzzahlig vielen Durchlaeufen in 6 s (Shop-Videos wiederholen nahtlos) */
const w6 = (now: number, n = 1) => (((now % 6000) / 6000) * TAU * n)
const zyk = (now: number, ms: number, off = 0) => (((now % 6000) / ms + off) % 1 + 1) % 1

function herz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.35)
  ctx.bezierCurveTo(x - r * 1.1, y - r * 0.4, x - r * 0.4, y - r * 1.05, x, y - r * 0.4)
  ctx.bezierCurveTo(x + r * 0.4, y - r * 1.05, x + r * 1.1, y - r * 0.4, x, y + r * 0.35)
  ctx.fill()
}
function stern(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dreh = 0) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const a = (i / 10) * TAU - Math.PI / 2 + dreh
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.fill()
}
function glanz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, farbe: string) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, farbe)
  gr.addColorStop(1, farbe.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = gr
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}
function wolke(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, farbe: string) {
  ctx.fillStyle = farbe
  ctx.beginPath()
  for (const [dx, dy, rr] of [[-0.6, 0.1, 0.5], [0, -0.2, 0.62], [0.6, 0.05, 0.5], [-0.25, 0.25, 0.45], [0.3, 0.28, 0.45]] as const) {
    ctx.moveTo(x + dx * r + rr * r, y + dy * r)
    ctx.arc(x + dx * r, y + dy * r, rr * r, 0, TAU)
  }
  ctx.fill()
}
function blitz(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, breite: number) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  const n = 6
  for (let i = 1; i < n; i++) {
    const t = i / n
    const q = (hash(seed + i) - 0.5) * Math.hypot(x1 - x0, y1 - y0) * 0.3
    const nx = -(y1 - y0)
    const ny = x1 - x0
    const l = Math.hypot(nx, ny) || 1
    ctx.lineTo(x0 + (x1 - x0) * t + (nx / l) * q, y0 + (y1 - y0) * t + (ny / l) * q)
  }
  ctx.lineTo(x1, y1)
  ctx.lineWidth = breite * 2.4
  ctx.strokeStyle = 'rgba(255, 245, 160, 0.35)'
  ctx.stroke()
  ctx.lineWidth = breite
  ctx.strokeStyle = '#FFFBE0'
  ctx.stroke()
}


/* ================= Aura am ganzen Koerper ================= */

type Teil = 'stern' | 'funke' | 'staub' | 'blatt' | 'flocke' | 'herz' | 'note' | 'blase' | 'rauch' | 'wuermchen' | 'tropfen' | 'wind' | 'kristall' | 'flamme' | 'blitz' | 'licht' | 'schatten' | 'geist' | 'rune' | 'feder' | 'kugel'
type Bew = 'schwebt' | 'steigt' | 'faellt' | 'kreist' | 'saugt'
/** Farbe (r,g,b) des Leuchtens um den Koerper, Teilchenart und Bewegung je Effekt; glow = Staerke des Leuchtens (0 = keins) */
const AURA: Record<string, { f: string; t: Teil; b: Bew; glow?: number }> = {
  glimmer: { f: '255,250,200', t: 'stern', b: 'schwebt' },
  staub: { f: '190,150,100', t: 'staub', b: 'steigt', glow: 0.5 },
  gluehen: { f: '255,250,220', t: 'licht', b: 'schwebt', glow: 0 },
  blaetter: { f: '120,190,70', t: 'blatt', b: 'kreist', glow: 0.5 },
  schnee: { f: '210,235,255', t: 'flocke', b: 'faellt', glow: 0.6 },
  funkenring: { f: '255,170,60', t: 'funke', b: 'kreist' },
  herzschlag: { f: '255,90,150', t: 'herz', b: 'steigt' },
  noten: { f: '120,130,200', t: 'note', b: 'steigt', glow: 0.5 },
  blasen: { f: '170,225,255', t: 'blase', b: 'steigt' },
  rauch: { f: '130,130,140', t: 'rauch', b: 'steigt', glow: 0.4 },
  sternenkranz: { f: '255,225,110', t: 'stern', b: 'kreist' },
  gluehwuermchen: { f: '210,255,120', t: 'wuermchen', b: 'schwebt' },
  regenwolke: { f: '140,190,255', t: 'tropfen', b: 'faellt' },
  wirbelwind: { f: '230,240,250', t: 'wind', b: 'kreist', glow: 0.5 },
  frost: { f: '150,220,255', t: 'kristall', b: 'schwebt', glow: 0 },
  flammen: { f: '255,130,30', t: 'flamme', b: 'steigt', glow: 1.2 },
  elektro: { f: '120,225,255', t: 'blitz', b: 'schwebt', glow: 1 },
  gewitter: { f: '210,215,150', t: 'blitz', b: 'faellt', glow: 0.9 },
  polarlicht: { f: '100,255,180', t: 'licht', b: 'steigt', glow: 0 },
  regenbogen: { f: '255,120,200', t: 'funke', b: 'kreist', glow: 0 },
  goldstaub: { f: '255,210,90', t: 'stern', b: 'schwebt', glow: 1 },
  schatten: { f: '150,70,230', t: 'schatten', b: 'steigt', glow: 1 },
  feuerkreis: { f: '255,110,30', t: 'flamme', b: 'kreist', glow: 1.2 },
  kugelblitz: { f: '190,140,255', t: 'kugel', b: 'kreist', glow: 0.9 },
  geister: { f: '220,230,255', t: 'geist', b: 'kreist', glow: 0.6 },
  runen: { f: '110,225,255', t: 'rune', b: 'kreist', glow: 0.9 },
  fluegel: { f: '255,150,50', t: 'feder', b: 'steigt', glow: 1.1 },
  korona: { f: '255,190,70', t: 'funke', b: 'schwebt', glow: 1.3 },
  strudel: { f: '170,100,255', t: 'funke', b: 'saugt', glow: 1.1 },
  goettlich: { f: '255,240,180', t: 'feder', b: 'faellt', glow: 1.2 },
}

/** Ein Teilchen der Aura. z = Alter 0..1 (blendet ein und aus), i = Nummer, c = Feldgroesse */
function teilchen(ctx: CanvasRenderingContext2D, art: Teil, x: number, y: number, c: number, z: number, i: number, now: number, f: string) {
  const a = Math.sin(z * Math.PI)
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4))
  switch (art) {
    case 'stern':
      ctx.fillStyle = `rgb(${f})`
      stern(ctx, 0, 0, c * (0.08 + 0.1 * a), z * 3)
      break
    case 'funke':
      glanz(ctx, 0, 0, c * 0.28, `rgba(${f}, 0.55)`)
      ctx.fillStyle = f === '255,120,200' ? `hsl(${(i * 53 + now * 0.2) % 360}, 95%, 70%)` : '#FFF8E0'
      ctx.beginPath()
      ctx.arc(0, 0, c * 0.055, 0, TAU)
      ctx.fill()
      break
    case 'staub':
      ctx.fillStyle = `rgba(${f}, 0.45)`
      ctx.beginPath()
      ctx.arc(0, 0, c * (0.12 + z * 0.22), 0, TAU)
      ctx.fill()
      break
    case 'blatt':
      ctx.rotate(z * 7 + i)
      ctx.fillStyle = ['#7FBF4A', '#E8A43C', '#D9622B', '#5DA040'][i % 4]
      ctx.beginPath()
      ctx.ellipse(0, 0, c * 0.17, c * 0.08, 0, 0, TAU)
      ctx.fill()
      break
    case 'flocke':
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 1.3
      ctx.rotate(z * 3 + i)
      for (let k = 0; k < 3; k++) {
        const b = (k / 3) * Math.PI
        ctx.beginPath()
        ctx.moveTo(-Math.cos(b) * c * 0.1, -Math.sin(b) * c * 0.1)
        ctx.lineTo(Math.cos(b) * c * 0.1, Math.sin(b) * c * 0.1)
        ctx.stroke()
      }
      break
    case 'herz':
      ctx.fillStyle = `rgba(${f}, 0.95)`
      herz(ctx, 0, 0, c * (0.12 + 0.05 * Math.sin(now / 160 + i)))
      break
    case 'note':
      ctx.fillStyle = '#2B2F3A'
      ctx.font = `700 ${Math.round(c * 0.36)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(i % 2 ? '♪' : '♫', 0, 0)
      break
    case 'blase':
      ctx.strokeStyle = `rgba(${f}, 0.95)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, c * (0.07 + 0.07 * hash(i)), 0, TAU)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(-c * 0.03, -c * 0.03, c * 0.02, 0, TAU)
      ctx.fill()
      break
    case 'rauch':
      ctx.fillStyle = `rgba(${f}, 0.4)`
      ctx.beginPath()
      ctx.arc(0, 0, c * (0.14 + z * 0.3), 0, TAU)
      ctx.fill()
      break
    case 'wuermchen': {
      const b = 0.5 + 0.5 * Math.sin(now / 250 + i * 3)
      glanz(ctx, 0, 0, c * 0.3, `rgba(${f}, ${0.8 * b})`)
      ctx.fillStyle = `rgba(250,255,200,${b})`
      ctx.beginPath()
      ctx.arc(0, 0, c * 0.04, 0, TAU)
      ctx.fill()
      break
    }
    case 'tropfen':
      ctx.strokeStyle = `rgba(${f}, 0.95)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -c * 0.1)
      ctx.lineTo(-c * 0.02, c * 0.1)
      ctx.stroke()
      break
    case 'wind':
      ctx.strokeStyle = `rgba(${f}, 0.9)`
      ctx.lineWidth = Math.max(1, c * 0.04)
      ctx.rotate(i + z * 2)
      ctx.beginPath()
      ctx.arc(0, 0, c * 0.2, 0, 2.2)
      ctx.stroke()
      break
    case 'kristall':
      ctx.strokeStyle = 'rgba(225,247,255,0.95)'
      ctx.lineWidth = 1.4
      ctx.rotate(i)
      for (let k = 0; k < 3; k++) {
        const b = (k / 3) * Math.PI
        ctx.beginPath()
        ctx.moveTo(-Math.cos(b) * c * 0.14, -Math.sin(b) * c * 0.14)
        ctx.lineTo(Math.cos(b) * c * 0.14, Math.sin(b) * c * 0.14)
        ctx.stroke()
      }
      break
    case 'flamme': {
      const r = c * 0.17 * (1 - z * 0.5)
      ctx.fillStyle = `rgba(255, ${200 - z * 150}, 40, 0.9)`
      ctx.beginPath()
      ctx.moveTo(0, -r * 1.9)
      ctx.quadraticCurveTo(r, 0, 0, r)
      ctx.quadraticCurveTo(-r, 0, 0, -r * 1.9)
      ctx.fill()
      break
    }
    case 'blitz':
      ctx.shadowColor = `rgb(${f})`
      ctx.shadowBlur = c * 0.25
      blitz(ctx, -c * 0.2, -c * 0.2, c * 0.2, c * 0.2, Math.floor(now / 100) + i, Math.max(1, c * 0.035))
      break
    case 'licht':
      glanz(ctx, 0, 0, c * 0.4, `rgba(${f}, 0.6)`)
      break
    case 'schatten':
      ctx.fillStyle = 'rgba(30,10,45,0.5)'
      ctx.beginPath()
      ctx.arc(0, 0, c * (0.2 + z * 0.25), 0, TAU)
      ctx.fill()
      glanz(ctx, 0, 0, c * 0.35, `rgba(${f}, 0.3)`)
      break
    case 'geist':
      ctx.fillStyle = 'rgba(240,245,255,0.9)'
      ctx.beginPath()
      ctx.arc(0, -c * 0.03, c * 0.11, Math.PI, 0)
      ctx.lineTo(c * 0.11, c * 0.1)
      for (let k = 0; k < 3; k++) ctx.lineTo(c * (0.11 - (k + 0.5) * 0.073), c * (k % 2 ? 0.1 : 0.05))
      ctx.lineTo(-c * 0.11, c * 0.1)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#2A2F45'
      ctx.fillRect(-c * 0.05, -c * 0.05, c * 0.03, c * 0.04)
      ctx.fillRect(c * 0.02, -c * 0.05, c * 0.03, c * 0.04)
      break
    case 'rune':
      ctx.fillStyle = `rgba(${f}, 1)`
      ctx.font = `700 ${Math.round(c * 0.3)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[i % 12], 0, 0)
      break
    case 'feder':
      ctx.rotate(Math.sin(z * 6 + i) * 0.7)
      ctx.fillStyle = `rgba(${f}, 0.95)`
      ctx.beginPath()
      ctx.ellipse(0, 0, c * 0.06, c * 0.17, 0, 0, TAU)
      ctx.fill()
      break
    case 'kugel':
      glanz(ctx, 0, 0, c * 0.3, `rgba(${f}, 0.8)`)
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(0, 0, c * 0.05, 0, TAU)
      ctx.fill()
      break
  }
  ctx.restore()
}

/**
 * Aura um die ganze Schlange: hinten ein Leuchten entlang des Koerpers, vorn Teilchen an jedem Abschnitt
 * (bei langen Schlangen ueber den ganzen Koerper verteilt). pts = Glieder in Feldkoordinaten.
 */
function koerperAura(ctx: CanvasRenderingContext2D, id: string, pts: P[], c: number, now: number, hinten: boolean) {
  const st = AURA[id]
  if (!st) return
  const alle = pts.map((p) => ({ x: (p.x + 0.5) * c, y: (p.y + 0.5) * c }))
  const schritt = Math.max(1, Math.ceil(alle.length / 64))
  if (hinten) {
    const glow = st.glow ?? 0.8
    if (!glow) return
    const puls = 1 + 0.18 * Math.sin(w6(now, 3))
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [breite, alpha] of [[2.3, 0.1], [1.7, 0.16], [1.25, 0.22]] as const) {
      ctx.strokeStyle = `rgba(${st.f}, ${Math.min(0.5, alpha * glow * puls)})`
      ctx.lineWidth = c * breite
      ctx.beginPath()
      alle.forEach((p, i) => {
        if (i % schritt && i !== alle.length - 1) return
        if (i) ctx.lineTo(p.x, p.y)
        else ctx.moveTo(p.x, p.y)
      })
      ctx.stroke()
    }
    return
  }
  // Teilchen: an jedem 'abstand'-ten Glied zwei Stueck, hoechstens etwa 24 Glieder
  const abstand = Math.max(1, Math.ceil(alle.length / 24))
  const dauer = st.b === 'faellt' ? 1400 : st.b === 'steigt' ? 1800 : 2400
  alle.forEach((p, i) => {
    if (i % abstand) return
    for (let k = 0; k < 2; k++) {
      const n = i * 2 + k
      const z = zyk(now, dauer, hash(n))
      const a0 = hash(n + 7) * TAU
      let x = p.x
      let y = p.y
      switch (st.b) {
        case 'schwebt': {
          const r = c * (0.5 + 0.2 * z)
          x += Math.cos(a0 + z * 1.2) * r
          y += Math.sin(a0 + z * 1.2) * r
          break
        }
        case 'steigt':
          x += (hash(n + 3) - 0.5) * c * 1.0 + Math.sin(w6(now, 2) + n) * c * 0.06
          y += (hash(n + 5) - 0.5) * c * 0.3 - z * c * 1.1
          break
        case 'faellt':
          x += (hash(n + 3) - 0.5) * c * 1.0
          y += -c * 0.8 + z * c * 1.5
          break
        case 'kreist': {
          const r = c * 0.62
          const a = a0 + w6(now, 2) * (k ? -1 : 1)
          x += Math.cos(a) * r
          y += Math.sin(a) * r
          break
        }
        case 'saugt': {
          const r = c * 1.1 * (1 - z)
          x += Math.cos(a0 + z * 3) * r
          y += Math.sin(a0 + z * 3) * r
          break
        }
      }
      teilchen(ctx, st.t, x, y, c, z, n, now, st.f)
    }
  })
}

/** Effekt zeichnen. pts = Glieder in Feldkoordinaten (Kopf zuerst), ang = Blickrichtung des Kopfs */
export function drawEffekt(ctx: CanvasRenderingContext2D, e: Effekt, pts: P[], cell: number, ang: number, now: number, schicht: 'hinten' | 'vorn') {
  if (!pts.length) return
  const c = cell
  const hx = (pts[0].x + 0.5) * c
  const hy = (pts[0].y + 0.5) * c
  // Koerperpunkte (Pixel), hoechstens die ersten 16 Glieder (fuer die besonderen Effekte am Kopf)
  const koerper = pts.slice(0, 16).map((p) => ({ x: (p.x + 0.5) * c, y: (p.y + 0.5) * c }))
  const umKopf = (n: number, r: number, umlauf: number, f: (x: number, y: number, i: number, a: number) => void) => {
    for (let i = 0; i < n; i++) {
      const a = w6(now, umlauf) + (i / n) * TAU
      f(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.85, i, a)
    }
  }
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const id = e.id.slice(3)
  const H = schicht === 'hinten'
  // Aura um den ganzen Koerper (zusaetzlich zu dem, was der Effekt am Kopf zeigt)
  koerperAura(ctx, id, pts, c, now, H)
  switch (id) {
    case 'glimmer':
      if (H) break
      for (let i = 0; i < 7; i++) {
        const t = Math.max(0, Math.sin(w6(now, 4) + i * 2.1))
        const a = hash(i) * TAU
        const r = c * (0.55 + hash(i + 3) * 0.35)
        ctx.fillStyle = `rgba(255, 255, 230, ${t})`
        stern(ctx, hx + Math.cos(a) * r, hy + Math.sin(a) * r, c * 0.1 * t)
      }
      break
    case 'staub':
      if (!H) break
      koerper.forEach((p, i) => {
        if (i % 2) return
        const z = zyk(now, 1500, hash(i))
        ctx.fillStyle = `rgba(170, 140, 100, ${0.35 * (1 - z)})`
        ctx.beginPath()
        ctx.arc(p.x + (hash(i + 4) - 0.5) * c * 0.8 * (1 + z), p.y + (hash(i + 8) - 0.5) * c * 0.6 - z * c * 0.3, c * (0.15 + z * 0.25), 0, TAU)
        ctx.fill()
      })
      break
    case 'gluehen':
      if (!H) break
      ctx.strokeStyle = `rgba(255, 250, 220, ${0.22 + 0.08 * Math.sin(w6(now, 3))})`
      ctx.lineWidth = c * 1.3
      ctx.beginPath()
      koerper.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.stroke()
      ctx.lineWidth = c * 1.0
      ctx.stroke()
      glanz(ctx, hx, hy, c * 1.1, 'rgba(255, 250, 220, 0.35)')
      break
    case 'blaetter':
      if (H) break
      umKopf(6, c * 0.85, 2, (x, y, i, a) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(a * 2 + i)
        ctx.fillStyle = ['#7FBF4A', '#E8A43C', '#D9622B', '#5DA040'][i % 4]
        ctx.beginPath()
        ctx.ellipse(0, 0, c * 0.14, c * 0.07, 0, 0, TAU)
        ctx.fill()
        ctx.restore()
      })
      break
    case 'schnee':
      if (H) break
      for (let i = 0; i < 12; i++) {
        const a = w6(now, i % 2 ? 2 : -1) + hash(i) * TAU
        const r = c * (0.6 + hash(i + 2) * 0.6)
        const x = hx + Math.cos(a) * r
        const y = hy + Math.sin(a) * r * 0.8 + Math.sin(w6(now, 3) + i) * c * 0.1
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 1.2
        for (let k = 0; k < 3; k++) {
          const b = (k / 3) * Math.PI + a
          ctx.beginPath()
          ctx.moveTo(x - Math.cos(b) * c * 0.07, y - Math.sin(b) * c * 0.07)
          ctx.lineTo(x + Math.cos(b) * c * 0.07, y + Math.sin(b) * c * 0.07)
          ctx.stroke()
        }
      }
      break
    case 'funkenring':
      if (H) {
        glanz(ctx, hx, hy, c * 1.2, 'rgba(255, 160, 60, 0.25)')
        break
      }
      umKopf(12, c * 0.78, 3, (x, y, i) => {
        const t = 0.5 + 0.5 * Math.sin(w6(now, 6) + i)
        ctx.fillStyle = `rgba(255, ${180 + 60 * t}, 80, ${0.6 + 0.4 * t})`
        ctx.beginPath()
        ctx.arc(x, y, c * (0.04 + 0.03 * t), 0, TAU)
        ctx.fill()
      })
      break
    case 'herzschlag': {
      if (H) break
      const puls = Math.pow(Math.max(0, Math.sin(w6(now, 6))), 6)
      umKopf(6, c * (0.8 + puls * 0.12), 1, (x, y) => {
        ctx.fillStyle = `rgba(255, 80, 140, ${0.7 + 0.3 * puls})`
        herz(ctx, x, y, c * (0.12 + puls * 0.05))
      })
      break
    }
    case 'noten':
      if (H) break
      ctx.fillStyle = '#2B2F3A'
      ctx.font = `700 ${Math.round(c * 0.38)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      umKopf(4, c * 0.9, 1, (x, y, i) => {
        ctx.globalAlpha = 0.85
        ctx.fillText(i % 2 ? '♪' : '♫', x, y + Math.sin(w6(now, 4) + i) * c * 0.15)
      })
      ctx.globalAlpha = 1
      break
    case 'blasen':
      if (H) break
      koerper.forEach((p, i) => {
        const z = zyk(now, 2000, hash(i))
        const r = c * (0.06 + hash(i + 1) * 0.06) * (0.6 + z)
        const x = p.x + (hash(i + 5) - 0.5) * c * 0.6 + Math.sin(w6(now, 3) + i) * c * 0.06
        const y = p.y - z * c * 1.1
        ctx.strokeStyle = `rgba(200, 235, 255, ${0.9 * (1 - z)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(x, y, r, 0, TAU)
        ctx.stroke()
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - z)})`
        ctx.beginPath()
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU)
        ctx.fill()
      })
      break
    case 'rauch':
      if (!H) break
      koerper.forEach((p, i) => {
        if (i % 2) return
        const z = zyk(now, 2000, hash(i))
        ctx.fillStyle = `rgba(120, 120, 130, ${0.35 * (1 - z)})`
        ctx.beginPath()
        ctx.arc(p.x + Math.sin(w6(now, 2) + i) * c * 0.15, p.y - z * c * 1.2, c * (0.18 + z * 0.35), 0, TAU)
        ctx.fill()
      })
      break
    case 'sternenkranz':
      if (H) {
        glanz(ctx, hx, hy, c * 1.1, 'rgba(255, 230, 120, 0.22)')
        break
      }
      umKopf(5, c * 0.85, 1, (x, y, i, a) => {
        const t = 0.6 + 0.4 * Math.sin(w6(now, 5) + i * 1.3)
        ctx.fillStyle = `rgba(255, 228, 110, ${t})`
        stern(ctx, x, y, c * 0.15 * t, a)
      })
      break
    case 'gluehwuermchen':
      if (H) break
      for (let i = 0; i < 9; i++) {
        const x = hx + Math.sin(w6(now, 1 + (i % 3)) + i * 2.1) * c * (0.9 + hash(i) * 0.7)
        const y = hy + Math.cos(w6(now, 2 - (i % 2)) + i * 1.3) * c * (0.7 + hash(i + 4) * 0.6)
        const b = 0.5 + 0.5 * Math.sin(w6(now, 8) + i * 3)
        glanz(ctx, x, y, c * 0.3, `rgba(220, 255, 120, ${0.8 * b})`)
        ctx.fillStyle = `rgba(250, 255, 200, ${b})`
        ctx.beginPath()
        ctx.arc(x, y, c * 0.04, 0, TAU)
        ctx.fill()
      }
      break
    case 'regenwolke': {
      if (H) break
      const wx = hx + Math.sin(w6(now, 1)) * c * 0.1
      const wy = hy - c * 1.15
      ctx.strokeStyle = 'rgba(140, 190, 255, 0.8)'
      ctx.lineWidth = 1.2
      for (let i = 0; i < 8; i++) {
        const z = zyk(now, 500, hash(i))
        const x = wx + (hash(i) - 0.5) * c * 0.9
        const y = wy + c * 0.25 + z * c * 0.9
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - c * 0.03, y + c * 0.15)
        ctx.stroke()
      }
      wolke(ctx, wx, wy, c * 0.5, 'rgba(210, 220, 235, 0.95)')
      wolke(ctx, wx + c * 0.05, wy + c * 0.08, c * 0.38, 'rgba(170, 180, 200, 0.5)')
      break
    }
    case 'wirbelwind':
      if (H) break
      for (let i = 0; i < 4; i++) {
        const a0 = w6(now, 3) + (i / 4) * TAU
        const r = c * (0.65 + i * 0.12)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 - i * 0.1})`
        ctx.lineWidth = Math.max(1, c * 0.04)
        ctx.beginPath()
        ctx.ellipse(hx, hy, r, r * 0.75, 0, a0, a0 + 1.6)
        ctx.stroke()
      }
      break
    case 'frost':
      if (H) {
        ctx.strokeStyle = 'rgba(150, 220, 255, 0.28)'
        ctx.lineWidth = c * 1.2
        ctx.beginPath()
        koerper.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.stroke()
        break
      }
      koerper.forEach((p, i) => {
        const t = Math.max(0, Math.sin(w6(now, 4) + i * 1.9))
        if (t < 0.2) return
        const x = p.x + (hash(i) - 0.5) * c * 0.9
        const y = p.y + (hash(i + 3) - 0.5) * c * 0.9
        ctx.strokeStyle = `rgba(220, 245, 255, ${t})`
        ctx.lineWidth = 1.3
        for (let k = 0; k < 3; k++) {
          const b = (k / 3) * Math.PI
          ctx.beginPath()
          ctx.moveTo(x - Math.cos(b) * c * 0.1 * t, y - Math.sin(b) * c * 0.1 * t)
          ctx.lineTo(x + Math.cos(b) * c * 0.1 * t, y + Math.sin(b) * c * 0.1 * t)
          ctx.stroke()
        }
      })
      break
    case 'flammen':
      if (H) {
        glanz(ctx, hx, hy, c * 1.3, 'rgba(255, 120, 30, 0.3)')
        break
      }
      koerper.forEach((p, i) => {
        for (let k = 0; k < 2; k++) {
          const z = zyk(now, 600, hash(i * 3 + k))
          const r = c * 0.2 * (1 - z) * (1 - i / 22)
          const x = p.x + (hash(i + k * 9) - 0.5) * c * 0.8
          const y = p.y - z * c * 0.8
          ctx.fillStyle = `rgba(255, ${190 - z * 150}, 40, ${0.8 * (1 - z)})`
          ctx.beginPath()
          ctx.moveTo(x, y - r * 1.8)
          ctx.quadraticCurveTo(x + r, y, x, y + r)
          ctx.quadraticCurveTo(x - r, y, x, y - r * 1.8)
          ctx.fill()
        }
      })
      break
    case 'elektro': {
      if (H) {
        glanz(ctx, hx, hy, c * 1.2, 'rgba(120, 220, 255, 0.22)')
        break
      }
      const takt = Math.floor(now / 90)
      for (let k = 0; k < 3; k++) {
        if (hash(takt * 7 + k) < 0.35 || koerper.length < 2) continue
        const a = koerper[Math.floor(hash(takt + k) * koerper.length)]
        const ang2 = hash(takt * 3 + k) * TAU
        ctx.shadowColor = '#7FE8FF'
        ctx.shadowBlur = c * 0.3
        blitz(ctx, a.x, a.y, a.x + Math.cos(ang2) * c * 0.9, a.y + Math.sin(ang2) * c * 0.9, takt * 13 + k, Math.max(1, c * 0.035))
        ctx.shadowBlur = 0
      }
      break
    }
    case 'gewitter': {
      if (H) break
      const wx = hx
      const wy = hy - c * 1.25
      const z = (now % 1500) / 1500
      const an = z < 0.12 || (z > 0.5 && z < 0.58)
      if (an && Math.floor(now / 45) % 2 === 0) {
        glanz(ctx, hx, hy, c * 1.6, 'rgba(255, 250, 200, 0.35)')
        blitz(ctx, wx, wy + c * 0.2, hx + (hash(Math.floor(now / 1500)) - 0.5) * c * 0.4, hy, Math.floor(now / 750), Math.max(1.2, c * 0.05))
      }
      wolke(ctx, wx, wy, c * 0.6, an ? 'rgba(120, 125, 150, 0.95)' : 'rgba(70, 74, 92, 0.95)')
      wolke(ctx, wx + c * 0.1, wy + c * 0.1, c * 0.45, 'rgba(40, 42, 56, 0.6)')
      break
    }
    case 'polarlicht':
      if (H) break
      for (let b = 0; b < 3; b++) {
        ctx.strokeStyle = b === 1 ? 'rgba(180, 110, 255, 0.35)' : 'rgba(90, 255, 180, 0.35)'
        ctx.lineWidth = c * (0.35 - b * 0.08)
        ctx.beginPath()
        koerper.forEach((p, i) => {
          const y = p.y - c * (0.9 + b * 0.25) + Math.sin(w6(now, 2) + i * 0.7 + b) * c * 0.2
          if (i) ctx.lineTo(p.x, y)
          else ctx.moveTo(p.x, y)
        })
        ctx.stroke()
      }
      break
    case 'regenbogen':
      if (H) {
        ctx.strokeStyle = `hsla(${(now * 0.06) % 360}, 90%, 65%, 0.25)`
        ctx.lineWidth = c * 1.2
        ctx.beginPath()
        koerper.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.stroke()
        break
      }
      for (let k = 0; k < 3; k++) {
        const z = zyk(now, 2000, k / 3)
        ctx.strokeStyle = `hsla(${(z * 360 + k * 120) % 360}, 90%, 65%, ${0.8 * (1 - z)})`
        ctx.lineWidth = Math.max(1.5, c * 0.07)
        ctx.beginPath()
        ctx.arc(hx, hy, c * (0.5 + z * 0.9), 0, TAU)
        ctx.stroke()
      }
      break
    case 'goldstaub':
      if (H) {
        glanz(ctx, hx, hy, c * 1.3, 'rgba(255, 210, 90, 0.3)')
        break
      }
      koerper.forEach((p, i) => {
        for (let k = 0; k < 2; k++) {
          const t = Math.max(0, Math.sin(w6(now, 5) + i * 1.7 + k * 3))
          ctx.fillStyle = `rgba(255, ${210 + 40 * t}, 100, ${t})`
          stern(ctx, p.x + (hash(i * 2 + k) - 0.5) * c * 1.1, p.y + (hash(i * 5 + k) - 0.5) * c * 1.1 - t * c * 0.1, c * 0.08 * t)
        }
      })
      break
    case 'schatten':
      if (!H) break
      koerper.forEach((p, i) => {
        const z = zyk(now, 1800, hash(i))
        ctx.fillStyle = `rgba(30, 10, 45, ${0.45 * (1 - z)})`
        ctx.beginPath()
        ctx.arc(p.x + Math.sin(w6(now, 2) + i) * c * 0.25, p.y - z * c * 0.6, c * (0.4 + z * 0.3), 0, TAU)
        ctx.fill()
        if (i % 3 === 0) glanz(ctx, p.x, p.y, c * 0.6, `rgba(170, 80, 255, ${0.25 * (1 - z)})`)
      })
      break
    case 'feuerkreis':
      if (H) {
        glanz(ctx, hx, hy, c * 1.6, 'rgba(255, 110, 30, 0.35)')
        break
      }
      umKopf(14, c * 0.95, 2, (x, y, i) => {
        const z = zyk(now, 500, hash(i))
        const r = c * 0.16 * (1 - z * 0.5)
        ctx.fillStyle = `rgba(255, ${200 - z * 140}, 40, ${0.9 - z * 0.5})`
        ctx.beginPath()
        ctx.moveTo(x, y - r * 2 - z * c * 0.15)
        ctx.quadraticCurveTo(x + r, y, x, y + r)
        ctx.quadraticCurveTo(x - r, y, x, y - r * 2 - z * c * 0.15)
        ctx.fill()
      })
      break
    case 'kugelblitz':
      if (H) break
      umKopf(3, c * 1.0, 3, (x, y, i, a) => {
        for (let k = 1; k <= 5; k++) {
          const b = a - k * 0.12
          glanz(ctx, hx + Math.cos(b) * c, hy + Math.sin(b) * c * 0.85, c * 0.2 * (1 - k / 6), `rgba(190, 140, 255, ${0.5 * (1 - k / 6)})`)
        }
        glanz(ctx, x, y, c * 0.4, 'rgba(210, 170, 255, 0.8)')
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(x, y, c * 0.08, 0, TAU)
        ctx.fill()
        if (hash(Math.floor(now / 120) + i) > 0.6) {
          ctx.shadowColor = '#E2B6FF'
          ctx.shadowBlur = c * 0.2
          blitz(ctx, x, y, hx, hy, Math.floor(now / 120) + i, Math.max(1, c * 0.03))
          ctx.shadowBlur = 0
        }
      })
      break
    case 'geister':
      if (H) break
      umKopf(4, c * 1.05, 1, (x, y, i) => {
        const yy = y + Math.sin(w6(now, 4) + i) * c * 0.1
        ctx.fillStyle = 'rgba(240, 245, 255, 0.85)'
        ctx.beginPath()
        ctx.arc(x, yy - c * 0.05, c * 0.16, Math.PI, 0)
        ctx.lineTo(x + c * 0.16, yy + c * 0.15)
        for (let k = 0; k < 3; k++) ctx.lineTo(x + c * (0.16 - (k + 0.5) * 0.107), yy + c * (k % 2 ? 0.15 : 0.08))
        ctx.lineTo(x - c * 0.16, yy + c * 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#2A2F45'
        ctx.beginPath()
        ctx.arc(x - c * 0.05, yy - c * 0.05, c * 0.03, 0, TAU)
        ctx.arc(x + c * 0.05, yy - c * 0.05, c * 0.03, 0, TAU)
        ctx.fill()
      })
      break
    case 'runen': {
      if (!H) break
      ctx.save()
      ctx.translate(hx, hy)
      ctx.scale(1, 0.8)
      glanz(ctx, 0, 0, c * 1.5, 'rgba(90, 220, 255, 0.28)')
      ctx.strokeStyle = 'rgba(120, 230, 255, 0.85)'
      ctx.lineWidth = Math.max(1, c * 0.035)
      ctx.rotate(w6(now, 1))
      ctx.beginPath()
      ctx.arc(0, 0, c * 1.2, 0, TAU)
      ctx.moveTo(c * 0.95, 0)
      ctx.arc(0, 0, c * 0.95, 0, TAU)
      ctx.stroke()
      ctx.font = `700 ${Math.round(c * 0.2)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(160, 240, 255, 0.95)'
      const runen = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU
        ctx.fillText(runen[i], Math.cos(a) * c * 1.075, Math.sin(a) * c * 1.075)
      }
      ctx.rotate(-w6(now, 3))
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        ctx.lineTo(Math.cos(a) * c * 0.9, Math.sin(a) * c * 0.9)
      }
      ctx.closePath()
      ctx.moveTo(c * 0.9, 0)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU
        ctx.lineTo(Math.cos(a) * c * 0.9, Math.sin(a) * c * 0.9)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
      break
    }
    case 'fluegel': {
      if (!H || koerper.length < 2) break
      // Fluegel am Hals, quer zur Laufrichtung, schlagen langsam
      const hals = koerper[1]
      const schlag = Math.sin(w6(now, 3)) * 0.25
      for (const sd of [-1, 1]) {
        ctx.save()
        ctx.translate(hals.x, hals.y)
        ctx.rotate(ang + sd * (Math.PI / 2 + 0.35 + schlag))
        for (let f = 0; f < 5; f++) {
          const l = c * (1.5 - f * 0.18)
          const a = (f - 2) * 0.22
          const gr = ctx.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l)
          gr.addColorStop(0, 'rgba(255, 230, 120, 0.9)')
          gr.addColorStop(0.6, 'rgba(255, 120, 30, 0.75)')
          gr.addColorStop(1, 'rgba(220, 40, 20, 0)')
          ctx.fillStyle = gr
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.quadraticCurveTo(Math.cos(a - 0.2) * l * 0.6, Math.sin(a - 0.2) * l * 0.6, Math.cos(a) * l, Math.sin(a) * l)
          ctx.quadraticCurveTo(Math.cos(a + 0.2) * l * 0.6, Math.sin(a + 0.2) * l * 0.6, 0, 0)
          ctx.fill()
        }
        ctx.restore()
      }
      break
    }
    case 'korona':
      if (!H) break
      glanz(ctx, hx, hy, c * 1.7, 'rgba(255, 200, 80, 0.4)')
      ctx.save()
      ctx.translate(hx, hy)
      ctx.rotate(w6(now, 1))
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU
        const l = c * (i % 2 ? 1.0 : 1.45) * (0.9 + 0.1 * Math.sin(w6(now, 6) + i))
        ctx.fillStyle = i % 2 ? 'rgba(255, 220, 120, 0.55)' : 'rgba(255, 170, 60, 0.6)'
        ctx.beginPath()
        ctx.moveTo(Math.cos(a - 0.12) * c * 0.5, Math.sin(a - 0.12) * c * 0.5)
        ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l)
        ctx.lineTo(Math.cos(a + 0.12) * c * 0.5, Math.sin(a + 0.12) * c * 0.5)
        ctx.fill()
      }
      ctx.restore()
      break
    case 'strudel':
      if (H) {
        ctx.save()
        ctx.translate(hx, hy)
        ctx.scale(1, 0.8)
        const gr = ctx.createRadialGradient(0, 0, c * 0.3, 0, 0, c * 1.6)
        gr.addColorStop(0, 'rgba(0, 0, 0, 0.85)')
        gr.addColorStop(0.5, 'rgba(60, 10, 90, 0.5)')
        gr.addColorStop(1, 'rgba(60, 10, 90, 0)')
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(0, 0, c * 1.6, 0, TAU)
        ctx.fill()
        ctx.rotate(-w6(now, 2))
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = `rgba(190, 120, 255, ${0.5 - k * 0.12})`
          ctx.lineWidth = Math.max(1, c * 0.04)
          ctx.beginPath()
          for (let t = 0; t < 1; t += 0.03) {
            const a = t * TAU * 1.2 + (k / 3) * TAU
            const r = c * (1.5 - t * 1.2)
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          }
          ctx.stroke()
        }
        ctx.restore()
        break
      }
      for (let i = 0; i < 14; i++) {
        const z = zyk(now, 1500, hash(i))
        const a = hash(i * 3) * TAU + z * 3
        const r = c * 1.6 * (1 - z)
        ctx.fillStyle = `rgba(230, 200, 255, ${z})`
        ctx.beginPath()
        ctx.arc(hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.8, c * 0.035, 0, TAU)
        ctx.fill()
      }
      break
    case 'goettlich':
      if (H) {
        // Lichtstrahlen von oben auf den Kopf
        for (let i = 0; i < 5; i++) {
          const x = hx + (i - 2) * c * 0.35 + Math.sin(w6(now, 1) + i) * c * 0.1
          const gr = ctx.createLinearGradient(x, hy - c * 3, x, hy)
          gr.addColorStop(0, 'rgba(255, 245, 200, 0)')
          gr.addColorStop(1, `rgba(255, 245, 200, ${0.25 + 0.1 * Math.sin(w6(now, 3) + i)})`)
          ctx.fillStyle = gr
          ctx.beginPath()
          ctx.moveTo(x - c * 0.08, hy - c * 3)
          ctx.lineTo(x + c * 0.08, hy - c * 3)
          ctx.lineTo(x + c * 0.25, hy)
          ctx.lineTo(x - c * 0.25, hy)
          ctx.fill()
        }
        glanz(ctx, hx, hy, c * 1.5, 'rgba(255, 240, 180, 0.4)')
        break
      }
      ctx.strokeStyle = '#FFE16E'
      ctx.lineWidth = Math.max(1.5, c * 0.06)
      ctx.beginPath()
      ctx.ellipse(hx, hy - c * 0.62, c * 0.34, c * 0.11, 0, 0, TAU)
      ctx.stroke()
      for (let i = 0; i < 5; i++) {
        const z = zyk(now, 3000, hash(i))
        const x = hx + (hash(i + 2) - 0.5) * c * 2 + Math.sin(w6(now, 2) + i) * c * 0.2
        const y = hy - c * 1.2 + z * c * 1.6
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.sin(w6(now, 3) + i) * 0.6)
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.sin(z * Math.PI)})`
        ctx.beginPath()
        ctx.ellipse(0, 0, c * 0.05, c * 0.15, 0, 0, TAU)
        ctx.fill()
        ctx.restore()
      }
      break
  }
  ctx.restore()
}
