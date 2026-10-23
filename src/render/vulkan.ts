/**
 * Vulkan: Die Karte ist eine Plattform ueber dem Lava-Abgrund. Rund um die Karte und in den Kratern geht es steil
 * hinunter (Basaltkante, Felswand, die von unten rot angestrahlt wird, Rauch), ganz unten fliesst Lava. Ab und zu
 * sprudelt sie hoch (Fontaenen), Blasen platzen, Funken steigen auf und Asche rieselt.
 *
 * Leistung wie beim Meer der Wueste: Der Abgrund wird in Stuecken (Kacheln) einmal Pixel fuer Pixel berechnet, die
 * fliessende Lava wird nur alle 70 ms neu zusammengesetzt; dazwischen wird je Stueck nur ein fertiges Bild kopiert.
 */
import type { P } from '../game/types'
import { auffrischenFaellig, fbm, fuellung, rauschen, tex, type Bild } from './flaechen'

const TAU = Math.PI * 2
const cl = (t: number) => Math.min(1, Math.max(0, t))
type Farbe = [number, number, number]
const mix = (a: Farbe, b: Farbe, t: number): Farbe => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const h2 = (x: number, y: number, s = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
  return v - Math.floor(v)
}
const sdBox = (px: number, py: number, h: number) => {
  const dx = Math.abs(px) - h
  const dy = Math.abs(py) - h
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0)
}
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/**
 * Ein Stueck Abgrund: Felswand und Lava (basis, fest), Maske fuer die fliessende Lava, lebend = nur die fliessende Lava
 * (alle 70 ms neu). flecken = Rechtecke (in Feldern), in denen ueberhaupt fliessende Lava liegt: Ist die basis schon in
 * die Boden-Kachel gebacken, wird je Bild nur dort etwas gezeichnet (bei vielen kleinen Kratern spart das fast alles)
 */
export type AbgrundKachel = { basis: Bild; maske: Bild; lebend: HTMLCanvasElement | null; zeit: number; flecken: { x: number; y: number; w: number; h: number }[] }

/** Profil vom Kartenrand nach aussen (Felder): Lippe (Boden ragt weich ueber den Rand), Kante, Felswand, Rauch, ab
 *  LAVA_AB die Lava tief unten. Knapp, damit man auch in kleinen Kratern unten die Lava sieht */
const LIPPE = 0.1
const KANTE = 0.16
const WAND = 0.42
const LAVA_AB = 0.6

/**
 * Abgrund fuer das Rechteck x0..x0+n, y0..y0+n (Kartenfelder): ueberall, wo keine Karte ist. Der Rand ist weich wie die
 * Kueste der Insel (runde Ecken, leichte Unebenheiten). null: in diesem Stueck ist nur Karte.
 */
export function abgrundKachel(land: (x: number, y: number) => boolean, x0: number, y0: number, n: number, px: number, o: P, boden: Farbe = [86, 74, 67]): AbgrundKachel | null {
  const R = 3
  const rund = 0.38
  const nah: P[] = []
  for (let y = y0 - R; y < y0 + n + R; y++) for (let x = x0 - R; x < x0 + n + R; x++) if (land(x, y)) nah.push({ x, y })
  const set = new Set(nah.map((c) => c.x * 4096 + c.y))
  let nurLand = true
  for (let y = y0; y < y0 + n && nurLand; y++) for (let x = x0; x < x0 + n; x++) if (!set.has(x * 4096 + y)) nurLand = false
  if (nurLand) return null
  const umkreis = new Map<number, P[]>()
  const nachbarn = (cx: number, cy: number) => {
    const k = cx * 4096 + cy
    let l = umkreis.get(k)
    if (!l) {
      l = []
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (set.has((cx + i) * 4096 + cy + j)) l.push({ x: cx + i + 0.5, y: cy + j + 0.5 })
      umkreis.set(k, l)
    }
    return l
  }
  const abst = (x: number, y: number) => {
    let d = R + 1
    for (const c of nachbarn(Math.floor(x), Math.floor(y))) d = smin(d, sdBox(x - c.x, y - c.y, 0.5 - rund) - rund, 0.8)
    // Felsiger, unregelmaessiger Rand (grob und fein)
    return d + (rauschen((x - o.x) * 1.7, (y - o.y) * 1.7) - 0.5) * 0.22 + (rauschen((x - o.x) * 6, (y - o.y) * 6) - 0.5) * 0.08
  }
  const w = Math.ceil(n * px)
  const mk = () => {
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = w
    return cv
  }
  const bilder = [mk(), mk()]
  const [db, dm] = bilder.map((cv) => cv.getContext('2d')!.createImageData(w, w))
  // Felder (im Stueck), in denen fliessende Lava liegt
  const mitLava = new Uint8Array(n * n)
  const kante: Farbe = [96, 84, 78]
  const fels: Farbe = [54, 44, 41]
  const tiefFels: Farbe = [30, 18, 15]
  const glut: Farbe = [118, 30, 12]
  const rauch: Farbe = [70, 18, 10]
  const kruste: Farbe = [46, 14, 9]
  const lavaTief: Farbe = [176, 42, 14]
  const lava: Farbe = [244, 110, 28]
  const lavaHeiss: Farbe = [255, 196, 90]
  for (let py = 0; py < w; py++)
    for (let pxx = 0; pxx < w; pxx++) {
      const x = x0 + (pxx + 0.5) / px
      const y = y0 + (py + 0.5) / px
      if (set.has(Math.floor(x) * 4096 + Math.floor(y))) continue
      const d = abst(x, y)
      const wx = x - o.x
      const wy = y - o.y
      let f: Farbe
      if (d < LIPPE) {
        // Der Boden ragt weich ueber den Rand (runde Ecken, felsig)
        f = mix(boden, kante, cl(d / LIPPE) * 0.6)
      } else if (d < KANTE) {
        // Basaltkante, hier und da eine feine Glutfuge
        f = mix(kante, fels, (d - LIPPE) / (KANTE - LIPPE))
        if (rauschen(wx * 4, wy * 4) > 0.72) f = mix(f, [255, 120, 40], 0.55)
      } else if (d < WAND) {
        // Felswand: Saeulen (Streifen quer zur Kante), nach unten dunkler und von der Lava rot angestrahlt
        const t = (d - KANTE) / (WAND - KANTE)
        const streifen = fbm(wx * 3.2 + d * 0.5, wy * 3.2 - d * 0.5, 2)
        f = mix(fels, tiefFels, t)
        f = mix(f, [f[0] * 1.35, f[1] * 1.3, f[2] * 1.3], (streifen - 0.5) * 0.9)
        f = mix(f, glut, t * t * 0.75)
      } else if (d < LAVA_AB) {
        // Rauch und Hitze ueber der Lava
        const t = (d - WAND) / (LAVA_AB - WAND)
        f = mix(mix(glut, rauch, 0.5), lavaTief, t * t)
        f = mix(f, [40, 20, 18], (fbm(wx * 1.4, wy * 1.4, 2) - 0.5) * 0.6 * (1 - t))
      } else {
        // Lava ganz unten: Kruste, dazwischen heisse Adern; weiter draussen heller
        // Abstand nur bis 2,4 Felder genau (Land wird im Umkreis von R gesucht): darueber gleich hell, sonst Kanten
        const t = cl((Math.min(d, 2.4) - LAVA_AB) / 2.6 + (fbm(wx * 0.6, wy * 0.6, 3) - 0.5) * 0.5)
        f = t < 0.55 ? mix(lavaTief, lava, t / 0.55) : mix(lava, lavaHeiss, (t - 0.55) / 0.45)
        const k = fbm(wx * 1.3 + 9, wy * 1.3, 3)
        if (k < 0.43) f = mix(f, kruste, cl((0.43 - k) / 0.08) * 0.7)
        f = mix(f, lavaTief, cl((LAVA_AB + 0.25 - d) / 0.25) * 0.5)
      }
      const i = (py * w + pxx) * 4
      db.data[i] = f[0]
      db.data[i + 1] = f[1]
      db.data[i + 2] = f[2]
      db.data[i + 3] = 255
      if (d > LAVA_AB - 0.1) {
        dm.data[i] = dm.data[i + 1] = dm.data[i + 2] = 255
        dm.data[i + 3] = Math.round(cl((d - LAVA_AB + 0.1) / 0.35) * 255)
        mitLava[Math.min(n - 1, Math.floor(py / px)) * n + Math.min(n - 1, Math.floor(pxx / px))] = 1
      }
    }
  bilder[0].getContext('2d')!.putImageData(db, 0, 0)
  bilder[1].getContext('2d')!.putImageData(dm, 0, 0)
  const bild = (cv: HTMLCanvasElement): Bild => ({ cv, x0, y0, w: n, h: n })
  return { basis: bild(bilder[0]), maske: bild(bilder[1]), lebend: null, zeit: 0, flecken: flecken(mitLava, n, x0, y0) }
}

/** Zusammenhaengende Lava-Felder als Rechtecke (Felder, mit einem halben Feld Rand fuer den weichen Uebergang) */
function flecken(lava: Uint8Array, n: number, x0: number, y0: number) {
  const out: { x: number; y: number; w: number; h: number }[] = []
  const gesehen = new Uint8Array(n * n)
  for (let i = 0; i < n * n; i++) {
    if (!lava[i] || gesehen[i]) continue
    let ax = n
    let ay = n
    let bx = -1
    let by = -1
    const q = [i]
    gesehen[i] = 1
    while (q.length) {
      const j = q.pop()!
      const x = j % n
      const y = (j - x) / n
      ax = Math.min(ax, x)
      ay = Math.min(ay, y)
      bx = Math.max(bx, x)
      by = Math.max(by, y)
      for (const k of [x > 0 ? j - 1 : -1, x < n - 1 ? j + 1 : -1, y > 0 ? j - n : -1, y < n - 1 ? j + n : -1])
        if (k >= 0 && lava[k] && !gesehen[k]) (gesehen[k] = 1), q.push(k)
    }
    const r = { x: x0 + Math.max(0, ax - 0.5), y: y0 + Math.max(0, ay - 0.5), w: 0, h: 0 }
    r.w = Math.min(x0 + n, x0 + bx + 1.5) - r.x
    r.h = Math.min(y0 + n, y0 + by + 1.5) - r.y
    out.push(r)
  }
  return out
}

/** Fliessende Lava (zwei Lagen Schlieren, langsam) in `lebend` zusammensetzen */
function abgrundAuffrischen(m: AbgrundKachel, now: number) {
  const { basis, maske } = m
  const cv = (m.lebend ??= document.createElement('canvas'))
  if (cv.width !== basis.cv.width || cv.height !== basis.cv.height) {
    cv.width = basis.cv.width
    cv.height = basis.cv.height
  }
  const c = cv.getContext('2d')!
  const ppc = maske.cv.width / maske.w
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(0, 0, cv.width, cv.height)
  const ox = maske.x0 * ppc
  const oy = maske.y0 * ppc
  c.setTransform(1, 0, 0, 1, -ox, -oy)
  // Versatz = Lage des Stuecks in der Welt (sonst sieht man die Kachelgrenzen), dazu langsames Fliessen. Kein Pulsieren:
  // die Stuecke werden zu leicht verschiedenen Zeiten aufgefrischt, das saehe man an den Kanten
  fuellung(c, maske, tex('lava'), ppc, ox + now / 90, oy + now / 160, 0.5)
  fuellung(c, maske, tex('lava'), ppc, ox - now / 130, oy + now / 210, 0.25, 1.5)
  c.setTransform(1, 0, 0, 1, 0, 0)
  m.zeit = now
}

/** Abgrund zeichnen. gebacken: die feste basis steckt schon in der Boden-Kachel, dann nur die fliessende Lava in den Flecken */
export function drawAbgrund(ctx: CanvasRenderingContext2D, m: AbgrundKachel, cell: number, now: number, reduce = false, gebacken = false) {
  const { basis } = m
  if (!gebacken) ctx.drawImage(basis.cv, basis.x0 * cell, basis.y0 * cell, basis.w * cell, basis.h * cell)
  if (reduce || !m.flecken.length) return
  if (auffrischenFaellig(now, m.zeit, !m.lebend)) abgrundAuffrischen(m, now)
  const l = m.lebend!
  if (!gebacken) return ctx.drawImage(l, basis.x0 * cell, basis.y0 * cell, basis.w * cell, basis.h * cell)
  const ppc = l.width / basis.w
  for (const f of m.flecken) ctx.drawImage(l, (f.x - basis.x0) * ppc, (f.y - basis.y0) * ppc, f.w * ppc, f.h * ppc, f.x * cell, f.y * cell, f.w * cell, f.h * cell)
}

/* ================= Sprudelnde Lava ================= */

let schein: HTMLCanvasElement | null = null
/** Heller Glutschein (einmal gezeichnet, dann nur kopiert) */
function glutSchein() {
  if (!schein) {
    schein = document.createElement('canvas')
    schein.width = schein.height = 64
    const c = schein.getContext('2d')!
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255, 230, 150, 0.95)')
    g.addColorStop(0.35, 'rgba(255, 140, 40, 0.55)')
    g.addColorStop(1, 'rgba(255, 80, 20, 0)')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
  }
  return schein
}

/**
 * Blasen und Fontaenen im Abgrund (sichtbarer Bereich ex0..ex1, ey0..ey1 in Feldern). Nur Felder, die nicht direkt an der
 * Karte liegen (dort ist die Felswand). Fest je Weltfeld (o = Ursprung), jede Fontaene springt in ihrem eigenen Takt.
 */
export function drawSprudeln(ctx: CanvasRenderingContext2D, drin: (x: number, y: number) => boolean, o: P, cell: number, now: number, ex0: number, ey0: number, ex1: number, ey1: number) {
  const sch = glutSchein()
  const nahAnKarte = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (drin(x + i, y + j)) return true
    return false
  }
  for (let y = ey0; y <= ey1; y++)
    for (let x = ex0; x <= ex1; x++) {
      const wx = x - o.x
      const wy = y - o.y
      const h = h2(wx, wy, 3)
      if (h > 0.16 || drin(x, y) || nahAnKarte(x, y)) continue
      const cx = (x + 0.2 + h2(wx, wy, 5) * 0.6) * cell
      const cy = (y + 0.2 + h2(wx, wy, 6) * 0.6) * cell
      if (h < 0.07) {
        // Fontaene: alle 4 bis 9 s schiesst die Lava hoch und faellt zurueck
        const periode = 4000 + h2(wx, wy, 7) * 5000
        const p = (now / periode + h2(wx, wy, 8) * 9) % 1
        if (p > 0.22) continue
        const e = p / 0.22
        const hoehe = cell * (1.4 + h2(wx, wy, 9) * 1.6)
        const a = Math.sin(Math.PI * e)
        ctx.globalAlpha = a
        ctx.drawImage(sch, cx - cell * 1.3, cy - cell * 1.3, cell * 2.6, cell * 2.6)
        // Saeule in der Mitte (dunkler Rand, heller Kern), dann Tropfen in Boegen nach aussen
        ctx.globalAlpha = 1
        const sy = cy - hoehe * a * 0.45
        const sh = hoehe * a * 0.5
        const sw = cell * 0.17 * (0.6 + a)
        ctx.fillStyle = `rgba(150, 30, 10, ${0.9 * a})`
        ctx.beginPath()
        ctx.ellipse(cx, sy, sw * 1.35, sh + cell * 0.05, 0, 0, TAU)
        ctx.fill()
        ctx.fillStyle = `rgba(255, 150, 40, ${a})`
        ctx.beginPath()
        ctx.ellipse(cx, sy, sw, sh, 0, 0, TAU)
        ctx.fill()
        ctx.fillStyle = `rgba(255, 240, 180, ${a})`
        ctx.beginPath()
        ctx.ellipse(cx, sy + sh * 0.1, sw * 0.45, sh * 0.75, 0, 0, TAU)
        ctx.fill()
        ctx.lineWidth = Math.max(1, cell * 0.03)
        for (let i = 0; i < 9; i++) {
          const w = (i / 9) * TAU + h2(wx + i, wy, 10)
          const weit = cell * (0.4 + h2(wx, wy + i, 11) * 0.6) * e
          const hoch = hoehe * (0.6 + h2(wx + i, wy + i, 12) * 0.5) * (4 * e * (1 - e))
          const r = cell * (0.07 + h2(i, wx, 13) * 0.06) * (1.2 - e * 0.5)
          const kalt = e > 0.75 ? (e - 0.75) * 4 : 0
          ctx.fillStyle = kalt > 0 ? `rgb(${255 - kalt * 140}, ${190 - kalt * 150}, ${90 - kalt * 70})` : i % 3 ? '#FFC060' : '#FFF0B0'
          ctx.strokeStyle = 'rgba(120, 24, 8, 0.85)'
          ctx.beginPath()
          ctx.arc(cx + Math.cos(w) * weit, cy + Math.sin(w) * weit * 0.6 - hoch, r, 0, TAU)
          ctx.fill()
          ctx.stroke()
        }
        continue
      }
      // Blase: waechst, platzt, Spritzer
      const z = (now / (1600 + h * 2600) + h2(wx, wy, 14)) % 1
      if (z < 0.7) {
        const r = cell * 0.2 * (z / 0.7)
        ctx.fillStyle = `rgba(255, 200, 110, ${0.35 + 0.4 * z})`
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, TAU)
        ctx.fill()
      } else if (z < 0.85) {
        const k = (z - 0.7) / 0.15
        ctx.fillStyle = `rgba(255, 220, 140, ${1 - k})`
        for (let j = 0; j < 5; j++) {
          const w = j * 1.26 + h
          ctx.beginPath()
          ctx.arc(cx + Math.cos(w) * cell * 0.25 * k, cy + Math.sin(w) * cell * 0.2 * k - cell * 0.15 * Math.sin(Math.PI * k), cell * 0.03, 0, TAU)
          ctx.fill()
        }
      }
    }
  ctx.globalAlpha = 1
}

/* ================= Boden, Stimmung ================= */

/** Vulkanboden (fest in den Boden-Kacheln): Asche, kleine Lavasteine, hier und da eine glimmende Spalte */
export function drawVulkanBoden(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, z: number) {
  if (z > 0.93) {
    // Glimmende Spalte: dunkler Riss, darin Glut
    const a = (z * 97) % 1
    const x1 = x + cell * (0.15 + a * 0.2)
    const y1 = y + cell * (0.2 + ((z * 31) % 1) * 0.3)
    const pts: P[] = [{ x: x1, y: y1 }]
    for (let i = 1; i <= 3; i++) pts.push({ x: x1 + cell * 0.2 * i, y: y1 + cell * (((z * (13 + i * 7)) % 1) - 0.5) * 0.3 + cell * 0.1 * i })
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(25, 14, 12, 0.7)'
    ctx.lineWidth = Math.max(1.5, cell * 0.07)
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 120, 40, 0.75)'
    ctx.lineWidth = Math.max(1, cell * 0.035)
    ctx.stroke()
  } else if (z < 0.22) {
    // Asche und Lavasteinchen
    for (let i = 0; i < 3; i++) {
      const a = (z * 977 + i * 331) % 1
      const b = (z * 613 + i * 197) % 1
      ctx.fillStyle = i === 0 ? 'rgba(20, 14, 12, 0.45)' : 'rgba(150, 140, 135, 0.25)'
      ctx.beginPath()
      ctx.arc(x + (0.15 + a * 0.7) * cell, y + (0.15 + b * 0.7) * cell, cell * (i === 0 ? 0.07 : 0.04), 0, TAU)
      ctx.fill()
    }
  }
}

/** Funken steigen auf, Asche rieselt (Bildschirm-Koordinaten, haengen leicht an der Welt) */
export function drawVulkanStimmung(ctx: CanvasRenderingContext2D, vw: number, vh: number, now: number, ox: number, oy: number) {
  const m = (v: number, p: number, n: number) => ((((v + p * 0.6) % n) + n) % n)
  for (let i = 0; i < 34; i++) {
    const x = m(h2(i, 1) * vw + Math.sin(now / 700 + i) * 10, ox, vw)
    const y = vh - m(now / (14 + h2(i, 2) * 16) + h2(i, 3) * vh, -oy, vh + 10) + 5
    const f = 0.5 + 0.5 * Math.sin(now / 90 + i * 2.7)
    ctx.fillStyle = `rgba(255, ${150 + Math.round(f * 80)}, 60, ${0.45 + 0.45 * f})`
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.fillStyle = 'rgba(70, 64, 62, 0.5)'
  for (let i = 0; i < 26; i++) {
    const x = m(h2(i, 4) * vw + Math.sin(now / 1300 + i) * 18, ox, vw)
    const y = m(now / (40 + h2(i, 5) * 40) + h2(i, 6) * vh, oy, vh)
    ctx.fillRect(x, y, 2.5, 1.5)
  }
}
