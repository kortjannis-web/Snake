/**
 * Boss der Wiese: der Steingolem und seine drei Raeume (Bannkreise, Sockel, Steintore, Kristalle, rote Warnungen,
 * Druckwellen, Anzeige).
 *
 * Der Golem ist von oben gezeichnet wie alle Wesen, aber aus vielen Teilen: Beine, Rumpf aus Felsbrocken mit Moos,
 * Schultern, Arme mit Faeusten, Kopf mit Brauen und gluehenden Augen, ein Runenkern in der Brust. Jeder Zustand bewegt
 * die Teile anders (Schritte, Faeuste heben und niederschmettern, geduckter Ansturm, Sprung mit Schatten, Sprung in den
 * naechsten Raum, gebannt in Lichtketten, getroffen mit Splittern, Gebruell, Zerfall zu Geroell). Mit jedem Treffer kommen
 * Risse dazu, beim letzten fehlt ein Stueck der Schulter.
 */
import { GOLEM, KRISTALL_FARBEN, type Golemkampf, type Pf, type Raum } from '../game/golemkampf'

const TAU = Math.PI * 2
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
const easeIn = (t: number) => t * t
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}
type RGB = readonly [number, number, number]
const rgb = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Mitte eines Feldes in Pixeln */
const px = (v: number, cell: number) => (v + 0.5) * cell

/* ================= Boden der Arena ================= */

/** Boden aller Raeume (Platten, Bannkreise, Sockel), dazu die Steintore und die Kristalladern in Raum 3 */
export function drawBossBoden(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  for (const r of g.raeume) drawRaumBoden(ctx, g, r, cell, now, reduce)
  for (const r of g.raeume) for (const p of r.plaetze) drawAder(ctx, px(p.x, cell), px(p.y, cell), cell, p.x * 7 + p.y)
  for (const r of g.raeume) if (r.tor) drawTor(ctx, r.tor, cell, now, reduce)
}

/** Kristallader am Boden: hier tauchen in Raum 3 die Kristalle auf */
function drawAder(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number) {
  ctx.save()
  ctx.fillStyle = 'rgba(60, 54, 48, 0.28)'
  ctx.beginPath()
  ctx.ellipse(x, y + cell * 0.1, cell * 0.75, cell * 0.55, 0, 0, TAU)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + hash(seed)
    const fx = x + Math.cos(a) * cell * 0.45
    const fy = y + Math.sin(a) * cell * 0.32
    ctx.fillStyle = `rgba(200, 220, 255, ${0.35 + 0.2 * hash(seed + i)})`
    ctx.beginPath()
    ctx.moveTo(fx, fy - cell * 0.16)
    ctx.lineTo(fx + cell * 0.07, fy)
    ctx.lineTo(fx, fy + cell * 0.05)
    ctx.lineTo(fx - cell * 0.07, fy)
    ctx.fill()
  }
  ctx.restore()
}

/** Steintor: geschlossen eine Platte mit Runen (glimmt), beim Oeffnen sinkt sie in den Boden, beim Schliessen steigt sie auf */
function drawTor(ctx: CanvasRenderingContext2D, tor: { cells: { x: number; y: number }[]; offen: boolean; t: number }, cell: number, now: number, reduce: boolean) {
  const xs = tor.cells.map((c) => c.x)
  const ys = tor.cells.map((c) => c.y)
  const x0 = Math.min(...xs) * cell
  const y0 = Math.min(...ys) * cell
  const w = (Math.max(...xs) + 1) * cell - x0
  const h = (Math.max(...ys) + 1) * cell - y0
  const k = reduce ? 1 : clamp01((now - tor.t) / GOLEM.tor)
  // Hoehe der Platte: 1 = ganz oben (zu), 0 = im Boden (offen)
  const hoch = tor.offen ? 1 - easeOut(k) : easeOut(k)
  // Quer gespielt steht das Tor senkrecht (Rille und Fugen drehen sich mit)
  const senkrecht = h > w
  ctx.save()
  // Rille im Boden bleibt sichtbar
  ctx.fillStyle = 'rgba(40, 34, 30, 0.35)'
  if (senkrecht) ctx.fillRect(x0 + w * 0.4, y0, w * 0.2, h)
  else ctx.fillRect(x0, y0 + h * 0.4, w, h * 0.2)
  if (hoch > 0.02) {
    const off = (1 - hoch) * h * 0.35
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * hoch})`
    ctx.fillRect(x0 + cell * 0.15, y0 + cell * 0.25 + off, w, h - off)
    const gr = ctx.createLinearGradient(x0, y0, x0, y0 + h)
    gr.addColorStop(0, rgb(mix(STEIN_HELL, [0, 0, 0], 0.1 * (1 - hoch))))
    gr.addColorStop(1, rgb(STEIN_DUNKEL))
    ctx.globalAlpha = 0.35 + 0.65 * hoch
    ctx.fillStyle = gr
    ctx.fillRect(x0 - cell * 0.1, y0 + off, w + cell * 0.2, h - off)
    ctx.strokeStyle = rgb(STEIN_DUNKEL)
    ctx.lineWidth = Math.max(1, cell * 0.08)
    ctx.strokeRect(x0 - cell * 0.1, y0 + off, w + cell * 0.2, h - off)
    // Fugen und eine Rune in der Mitte, die gluehend pulsiert
    ctx.beginPath()
    if (senkrecht)
      for (const t of [1 / 3, 2 / 3]) {
        const fy = y0 + off + (h - off) * t
        ctx.moveTo(x0 - cell * 0.1, fy)
        ctx.lineTo(x0 + w + cell * 0.1, fy)
      }
    else
      for (const t of [1 / 3, 2 / 3]) {
        ctx.moveTo(x0 + w * t, y0 + off)
        ctx.lineTo(x0 + w * t, y0 + h)
      }
    ctx.stroke()
    const puls = reduce ? 0.7 : 0.55 + 0.45 * Math.sin(now / 300)
    ctx.strokeStyle = `rgba(255, 170, 70, ${0.55 * puls * hoch})`
    ctx.lineWidth = Math.max(1.5, cell * 0.09)
    const mx = x0 + w / 2
    const my = y0 + off + (h - off) / 2
    ctx.beginPath()
    ctx.moveTo(mx, my - cell * 0.45)
    ctx.lineTo(mx + cell * 0.32, my)
    ctx.lineTo(mx, my + cell * 0.45)
    ctx.lineTo(mx - cell * 0.32, my)
    ctx.closePath()
    ctx.stroke()
  }
  // Beim Oeffnen und Schliessen: Staub
  if (!reduce && k < 1) staub(ctx, x0 + w / 2, y0 + h / 2, cell * (1 + k * 1.5), 0.35 * (1 - k))
  ctx.restore()
}

/** Ein Raum: alte Steinplatten, Runen, Bannkreis, Sockel */
function drawRaumBoden(ctx: CanvasRenderingContext2D, g: Golemkampf, raum: Raum, cell: number, now: number, reduce: boolean) {
  const k = raum.kreis
  const cx = px(k.p.x, cell)
  const cy = px(k.p.y, cell)
  const r = k.r * cell
  const an = raum.sockel.filter((s) => s.an).length
  const aktiv = g.raumAktiv(raum)
  const gebannt = g.golem.zustand === 'gebannt' && raum === g.aktuell
  const puls = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 260)

  // Gepflasterter Platz rund um den Kreis (Ring aus Platten)
  ctx.save()
  ctx.fillStyle = 'rgba(70, 64, 58, 0.22)'
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.75, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40, 34, 30, 0.25)'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.13
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05)
    ctx.lineTo(cx + Math.cos(a) * r * 1.75, cy + Math.sin(a) * r * 1.75)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, r * 1.75, 0, TAU)
  ctx.stroke()

  // Linien von den Sockeln zum Kreis: dunkle Rillen, bei leuchtenden Sockeln fliesst Licht darin
  for (const s of raum.sockel) {
    const sx = px(s.p.x, cell)
    const sy = px(s.p.y, cell)
    const a = Math.atan2(cy - sy, cx - sx)
    const ex = cx - Math.cos(a) * r
    const ey = cy - Math.sin(a) * r
    ctx.strokeStyle = 'rgba(30, 26, 22, 0.35)'
    ctx.lineWidth = cell * 0.18
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    if (!s.an) continue
    const f = hex(KRISTALL_FARBEN[s.farbe])
    const neu = reduce ? 1 : clamp01((now - s.t) / 600)
    ctx.strokeStyle = rgb(f, 0.45 + 0.35 * puls)
    ctx.lineWidth = cell * 0.1
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(lerp(sx, ex, neu), lerp(sy, ey, neu))
    ctx.stroke()
    if (!reduce)
      for (let i = 0; i < 3; i++) {
        const t = ((now / 900 + i / 3 + s.farbe * 0.17) % 1) * neu
        ctx.fillStyle = rgb(mix(f, [255, 255, 255], 0.5), 0.9 * (1 - Math.abs(t - 0.5) * 1.4))
        ctx.beginPath()
        ctx.arc(lerp(sx, ex, t), lerp(sy, ey, t), cell * 0.09, 0, TAU)
        ctx.fill()
      }
  }

  // Bannkreis: Steinring mit Runen. Sechs Abschnitte leuchten in den Farben der Sockel, aktiv strahlt er hell
  if (aktiv) {
    const gl = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * (1.5 + 0.2 * puls))
    gl.addColorStop(0, `rgba(255, 246, 200, ${gebannt ? 0.55 : 0.32 + 0.14 * puls})`)
    gl.addColorStop(1, 'rgba(255, 246, 200, 0)')
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.7, 0, TAU)
    ctx.fill()
  }
  ctx.lineWidth = cell * 0.34
  ctx.strokeStyle = '#6E665D'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.stroke()
  ctx.lineWidth = cell * 0.08
  ctx.strokeStyle = 'rgba(30, 26, 22, 0.5)'
  ctx.beginPath()
  ctx.arc(cx, cy, r + cell * 0.17, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r - cell * 0.17, 0, TAU)
  ctx.stroke()
  raum.sockel.forEach((s, i) => {
    // Abschnitt zeigt in Richtung seines Sockels
    const a = Math.atan2(s.p.y - k.p.y, s.p.x - k.p.x)
    ctx.lineWidth = cell * 0.2
    ctx.strokeStyle = s.an ? rgb(hex(KRISTALL_FARBEN[s.farbe]), aktiv ? 0.75 + 0.25 * puls : 0.85) : 'rgba(40, 36, 32, 0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, r, a - 0.42, a + 0.42)
    ctx.stroke()
    if (!s.an) return
    ctx.fillStyle = rgb(hex(KRISTALL_FARBEN[i]), 0.3)
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cell * 0.32, 0, TAU)
    ctx.fill()
  })
  // Runen im Ring (drehen sich, wenn er aktiv ist)
  const dreh = aktiv && !reduce ? now / 2400 : 0
  ctx.strokeStyle = aktiv ? `rgba(255, 250, 220, ${0.65 + 0.3 * puls})` : an ? 'rgba(220, 210, 190, 0.45)' : 'rgba(30, 26, 22, 0.45)'
  ctx.lineWidth = Math.max(1, cell * 0.06)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + dreh
    const rx = cx + Math.cos(a) * (r - cell * 0.55)
    const ry = cy + Math.sin(a) * (r - cell * 0.55)
    const q = cell * 0.13
    ctx.save()
    ctx.translate(rx, ry)
    ctx.rotate(a)
    ctx.beginPath()
    const art = i % 3
    if (art === 0) {
      ctx.moveTo(-q, -q)
      ctx.lineTo(q, 0)
      ctx.lineTo(-q, q)
    } else if (art === 1) {
      ctx.moveTo(0, -q)
      ctx.lineTo(0, q)
      ctx.moveTo(-q, 0)
      ctx.lineTo(q * 0.6, -q * 0.6)
    } else {
      ctx.arc(0, 0, q * 0.7, 0, TAU)
    }
    ctx.stroke()
    ctx.restore()
  }
  // Innen ein Siegel (Sechseck), aktiv mit Lichtsaeule
  ctx.strokeStyle = aktiv ? `rgba(255, 244, 200, ${0.7 + 0.3 * puls})` : 'rgba(30, 26, 22, 0.35)'
  ctx.lineWidth = Math.max(1, cell * 0.07)
  ctx.beginPath()
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2 - dreh * 0.5
    const x = cx + Math.cos(a) * r * 0.55
    const y = cy + Math.sin(a) * r * 0.55
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // Sockel: Steinsaeulen, der leere Platz zeigt die Farbe, eingesetzt leuchtet der Kristall
  for (const s of raum.sockel) drawSockel(ctx, px(s.p.x, cell), px(s.p.y, cell), cell, s.farbe, s.an, reduce ? 1e9 : now - s.t, now, g.traegt.includes(s.farbe) && !s.an)
}

/** Ein Sockel: achteckiger Stein mit Mulde; `wartet` = die Schlange traegt den passenden Kristall (Mulde blinkt) */
function drawSockel(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, farbe: number, an: boolean, seit: number, now: number, wartet: boolean) {
  const f = hex(KRISTALL_FARBEN[farbe])
  const r = cell * 0.62
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.ellipse(x + cell * 0.06, y + cell * 0.12, r * 1.05, r * 0.95, 0, 0, TAU)
  ctx.fill()
  const st = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
  st.addColorStop(0, '#A49B90')
  st.addColorStop(1, '#5E564E')
  ctx.fillStyle = st
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8
    const x1 = x + Math.cos(a) * r
    const y1 = y + Math.sin(a) * r
    if (i) ctx.lineTo(x1, y1)
    else ctx.moveTo(x1, y1)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(40, 34, 30, 0.6)'
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.stroke()
  // Mulde
  ctx.fillStyle = '#3D3731'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.52, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = rgb(f, wartet ? 0.55 + 0.45 * Math.sin(now / 90) : 0.7)
  ctx.lineWidth = Math.max(1.5, cell * (wartet ? 0.1 : 0.06))
  ctx.beginPath()
  ctx.arc(x, y, r * 0.52, 0, TAU)
  ctx.stroke()
  if (an) {
    const k = clamp01(seit / 400)
    const gl = ctx.createRadialGradient(x, y, 0, x, y, cell * 1.6)
    gl.addColorStop(0, rgb(f, 0.55))
    gl.addColorStop(1, rgb(f, 0))
    ctx.fillStyle = gl
    ctx.fillRect(x - cell * 1.6, y - cell * 1.6, cell * 3.2, cell * 3.2)
    // Kurz nach dem Einsetzen: Lichtring
    if (seit < 700) {
      ctx.strokeStyle = rgb(f, 1 - seit / 700)
      ctx.lineWidth = cell * 0.12
      ctx.beginPath()
      ctx.arc(x, y, cell * (0.6 + seit / 350), 0, TAU)
      ctx.stroke()
    }
    drawKristallForm(ctx, x, y - cell * 0.05 * k, cell * 0.85 * easeOut(k), farbe, now, 1)
  } else {
    // Ein schwacher Schimmer in der Farbe
    ctx.fillStyle = rgb(f, 0.22)
    ctx.beginPath()
    ctx.moveTo(x, y - r * 0.3)
    ctx.lineTo(x + r * 0.22, y)
    ctx.lineTo(x, y + r * 0.3)
    ctx.lineTo(x - r * 0.22, y)
    ctx.fill()
  }
  ctx.restore()
}

/** Kristall: sechseckige Saeule von schraeg oben, mit Glanzkante */
function drawKristallForm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, farbe: number, now: number, a: number) {
  if (s <= 0) return
  const f = hex(KRISTALL_FARBEN[farbe])
  const hell = mix(f, [255, 255, 255], 0.55)
  const dunkel = mix(f, [0, 0, 0], 0.35)
  const w = s * 0.28
  const h = s * 0.46
  ctx.save()
  ctx.globalAlpha *= a
  ctx.translate(x, y)
  // linke Flaeche
  ctx.fillStyle = rgb(dunkel)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-w, -h * 0.35)
  ctx.lineTo(-w, h * 0.45)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  // rechte Flaeche
  ctx.fillStyle = rgb(f)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(w, -h * 0.35)
  ctx.lineTo(w, h * 0.45)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  // Mittelkante und Spitze
  ctx.fillStyle = rgb(hell, 0.9)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(w * 0.35, -h * 0.4)
  ctx.lineTo(w * 0.15, h * 0.7)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(20, 16, 30, 0.45)'
  ctx.lineWidth = Math.max(1, s * 0.04)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-w, -h * 0.35)
  ctx.lineTo(-w, h * 0.45)
  ctx.lineTo(0, h)
  ctx.lineTo(w, h * 0.45)
  ctx.lineTo(w, -h * 0.35)
  ctx.closePath()
  ctx.stroke()
  // Funkeln
  const fu = 0.5 + 0.5 * Math.sin(now / 200 + farbe * 1.7)
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * fu})`
  const q = s * 0.08 * (0.6 + fu * 0.6)
  ctx.beginPath()
  ctx.moveTo(w * 0.3, -h * 0.55 - q)
  ctx.lineTo(w * 0.3 + q * 0.35, -h * 0.55)
  ctx.lineTo(w * 0.3, -h * 0.55 + q)
  ctx.lineTo(w * 0.3 - q * 0.35, -h * 0.55)
  ctx.fill()
  ctx.restore()
}

/** Kristalle auf dem Feld: schweben, leuchten, tauchen aus dem Boden auf */
export function drawKristalle(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  for (const k of g.kristalle) {
    const x = px(k.p.x, cell)
    const y = px(k.p.y, cell)
    const f = hex(KRISTALL_FARBEN[k.farbe])
    const auf = reduce ? 1 : easeOut(clamp01((now - k.t) / 500))
    const schweb = reduce ? 0 : Math.sin(now / 320 + k.farbe) * cell * 0.08
    const gl = ctx.createRadialGradient(x, y, 0, x, y, cell * 1.3)
    gl.addColorStop(0, rgb(f, 0.5 * auf))
    gl.addColorStop(1, rgb(f, 0))
    ctx.fillStyle = gl
    ctx.fillRect(x - cell * 1.3, y - cell * 1.3, cell * 2.6, cell * 2.6)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.beginPath()
    ctx.ellipse(x, y + cell * 0.3, cell * 0.26 * auf, cell * 0.1 * auf, 0, 0, TAU)
    ctx.fill()
    drawKristallForm(ctx, x, y - cell * 0.12 + schweb - (1 - auf) * cell * 0.4, cell * 0.95 * auf, k.farbe, now, auf)
  }
}

/** Getragene Kristalle schweben ueber dem Schwanz der Schlange */
export function drawGetragen(ctx: CanvasRenderingContext2D, g: Golemkampf, glieder: Pf[], cell: number, now: number) {
  g.traegt.forEach((farbe, i) => {
    const b = glieder[Math.min(glieder.length - 1, 1 + i)]
    if (!b) return
    const x = px(b.x, cell)
    const y = px(b.y, cell) - cell * 0.55 + Math.sin(now / 250 + i * 2) * cell * 0.06
    drawKristallForm(ctx, x, y, cell * 0.62, farbe, now, 0.95)
  })
}

/* ================= Warnungen und Druckwellen ================= */

/** Rote Warnflaeche mit wandernden Streifen; k = wie weit die Zeit schon um ist (der Rand fuellt sich) */
function warnPfad(ctx: CanvasRenderingContext2D, pfad: () => void, k: number, now: number, cell: number, reduce: boolean) {
  ctx.save()
  pfad()
  ctx.fillStyle = `rgba(220, 30, 30, ${0.16 + 0.22 * k})`
  ctx.fill()
  // Schraege Streifen wandern durch die Flaeche
  ctx.clip()
  ctx.strokeStyle = `rgba(255, 60, 50, ${0.22 + 0.3 * k})`
  ctx.lineWidth = cell * 0.2
  ctx.beginPath()
  const o = reduce ? 0 : (now / 25) % (cell * 1.1)
  const m = ctx.getTransform()
  // Streifen im sichtbaren Bereich (in Kartenkoordinaten)
  const x0 = -m.e / m.a - cell * 40
  const y0 = -m.f / m.d - cell * 4
  for (let i = 0; i < 90; i++) {
    const s = x0 + i * cell * 1.1 + o
    ctx.moveTo(s, y0)
    ctx.lineTo(s + cell * 44, y0 + cell * 44)
  }
  ctx.stroke()
  ctx.restore()
  ctx.save()
  pfad()
  ctx.strokeStyle = `rgba(255, 70, 60, ${0.6 + 0.4 * (reduce ? 1 : Math.abs(Math.sin(now / (k > 0.75 ? 50 : 110))))})`
  ctx.lineWidth = Math.max(2, cell * 0.12)
  ctx.stroke()
  ctx.restore()
}

/** Alle Warnungen der aktuellen Attacke (unter der Schlange) */
export function drawWarnungen(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  const go = g.golem
  const a = go.angriff
  const gx = px(go.x, cell)
  const gy = px(go.y, cell)
  if (a?.art === 'stampfen' && !a.fertig) {
    const k = clamp01((now - a.ab) / Math.max(1, a.schlag - a.ab))
    const r = (a.r + 0.5) * cell
    warnPfad(ctx, () => {
      ctx.beginPath()
      ctx.arc(gx, gy, r, 0, TAU)
    }, k, now, cell, reduce)
    // Innerer Ring waechst bis zum Rand: dann schlaegt er zu
    ctx.strokeStyle = 'rgba(255, 200, 190, 0.7)'
    ctx.lineWidth = Math.max(1.5, cell * 0.08)
    ctx.beginPath()
    ctx.arc(gx, gy, r * k, 0, TAU)
    ctx.stroke()
  } else if (a?.art === 'ansturm' && now < a.los) {
    const k = clamp01((now - a.ab) / Math.max(1, a.los - a.ab))
    const ax = px(a.von.x, cell)
    const ay = px(a.von.y, cell)
    const bx = px(a.nach.x, cell)
    const by = px(a.nach.y, cell)
    const w = 1.6 * cell
    const nx = -a.dir.y * w
    const ny = a.dir.x * w
    warnPfad(ctx, () => {
      ctx.beginPath()
      ctx.moveTo(ax + nx, ay + ny)
      ctx.lineTo(bx + nx + a.dir.x * cell, by + ny + a.dir.y * cell)
      ctx.lineTo(bx - nx + a.dir.x * cell, by - ny + a.dir.y * cell)
      ctx.lineTo(ax - nx, ay - ny)
      ctx.closePath()
    }, k, now, cell, reduce)
    // Pfeile laufen den Streifen entlang
    const len = Math.hypot(bx - ax, by - ay)
    ctx.strokeStyle = 'rgba(255, 220, 210, 0.75)'
    ctx.lineWidth = Math.max(2, cell * 0.12)
    ctx.lineCap = 'round'
    for (let d = ((now / 6) % (cell * 2.2)) + cell; d < len; d += cell * 2.2) {
      const x = ax + a.dir.x * d
      const y = ay + a.dir.y * d
      ctx.beginPath()
      ctx.moveTo(x - a.dir.x * cell * 0.4 + nx * 0.35, y - a.dir.y * cell * 0.4 + ny * 0.35)
      ctx.lineTo(x, y)
      ctx.lineTo(x - a.dir.x * cell * 0.4 - nx * 0.35, y - a.dir.y * cell * 0.4 - ny * 0.35)
      ctx.stroke()
    }
  } else if (a?.art === 'sprung' && !a.fertig && now >= a.ab && a.wechsel) {
    // Sprung in den naechsten Raum: nur sein Schatten, wo er landet
    const k = now >= a.fall ? clamp01((now - a.fall) / Math.max(1, a.landung - a.fall)) : 0
    if (k > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.3 * k})`
      ctx.beginPath()
      ctx.ellipse(px(a.ziel.x, cell), px(a.ziel.y, cell), cell * (1.2 + 1.2 * k), cell * (1 + k), 0, 0, TAU)
      ctx.fill()
    }
  } else if (a?.art === 'sprung' && !a.fertig && now >= a.ab) {
    const fest = now >= a.halt
    const k = fest ? clamp01((now - a.halt) / Math.max(1, a.landung - a.halt)) : 0.25
    const zx = px(a.ziel.x, cell)
    const zy = px(a.ziel.y, cell)
    const r = (a.r + 0.5) * cell
    // Schatten des Golems waechst, je naeher die Landung
    const sch = fest ? 0.3 + 0.6 * k : 0.25
    ctx.fillStyle = `rgba(0, 0, 0, ${sch * 0.5})`
    ctx.beginPath()
    ctx.ellipse(zx, zy, r * (0.5 + 0.4 * k), r * (0.42 + 0.35 * k), 0, 0, TAU)
    ctx.fill()
    warnPfad(ctx, () => {
      ctx.beginPath()
      ctx.arc(zx, zy, r, 0, TAU)
    }, k, now, cell, reduce)
    // Fadenkreuz; solange es folgt, dreht es sich
    ctx.save()
    ctx.translate(zx, zy)
    ctx.rotate(fest || reduce ? 0 : now / 300)
    ctx.strokeStyle = fest ? 'rgba(255, 230, 220, 0.95)' : 'rgba(255, 140, 120, 0.85)'
    ctx.lineWidth = Math.max(2, cell * 0.1)
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(r * 0.35, 0)
      ctx.lineTo(r * 0.75, 0)
      ctx.stroke()
    }
    ctx.restore()
  }
  // Brocken: wachsender Schatten
  for (const b of g.brocken) {
    if (b.fertig) continue
    const k = clamp01((now - b.t) / Math.max(1, b.bis - b.t))
    const x = px(b.p.x, cell)
    const y = px(b.p.y, cell)
    warnPfad(ctx, () => {
      ctx.beginPath()
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.rect(x + (dx - 0.5) * cell, y + (dy - 0.5) * cell, cell, cell)
    }, k, now, cell, reduce)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.4 * k})`
    ctx.beginPath()
    ctx.ellipse(x, y, cell * (0.3 + 0.6 * k), cell * (0.25 + 0.5 * k), 0, 0, TAU)
    ctx.fill()
  }
}

/** Fallende Brocken (ueber allem) und die zerbrochenen am Boden */
export function drawBrocken(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  for (const b of g.brocken) {
    const x = px(b.p.x, cell)
    const y = px(b.p.y, cell)
    if (!b.fertig) {
      const k = clamp01((now - b.t) / Math.max(1, b.bis - b.t))
      if (k < 0.55 || reduce) continue
      // Faellt von oben ins Bild (wird kleiner, je tiefer)
      const f = (k - 0.55) / 0.45
      felsBrocken(ctx, x, y - (1 - easeIn(f)) * cell * 7, cell * (1.4 - 0.5 * f), 17 + b.p.x * 3 + b.p.y, 1)
      continue
    }
    const t = now - b.bis
    // Zerspringt: Splitter fliegen, Staub
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + hash(b.p.x * 7 + i)
      const d = easeOut(clamp01(t / 500)) * cell * (1 + hash(i + b.p.y) * 0.8)
      ctx.globalAlpha = 1 - clamp01(t / 900)
      felsBrocken(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, cell * 0.32, i * 13 + b.p.x, 1)
    }
    ctx.globalAlpha = 1
    staub(ctx, x, y, cell * (0.8 + t / 400), 0.4 * (1 - clamp01(t / 900)))
  }
}

function staub(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  if (a <= 0) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(196, 182, 160, ${a})`)
  g.addColorStop(1, 'rgba(196, 182, 160, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

/** Druckwellen: Stampfen, Landung, Aufprall, Treffer, Gebruell */
export function drawWellen(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  if (reduce) return
  for (const w of g.wellen) {
    const t = clamp01((now - w.t) / 700)
    const x = px(w.x, cell)
    const y = px(w.y, cell)
    const r = (w.art === 'zorn' ? w.r * 1.2 : w.r + 0.5) * cell * (0.25 + 0.75 * easeOut(t))
    ctx.strokeStyle = w.art === 'treffer' ? `rgba(150, 230, 255, ${0.9 * (1 - t)})` : w.art === 'zorn' ? `rgba(255, 90, 60, ${0.5 * (1 - t)})` : `rgba(255, 240, 220, ${0.75 * (1 - t)})`
    ctx.lineWidth = cell * (w.art === 'zorn' ? 0.25 : 0.4) * (1 - t)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.stroke()
    if (w.art !== 'zorn' && w.art !== 'treffer') {
      staub(ctx, x, y, r * 1.05, 0.45 * (1 - t))
      // Steinchen spritzen
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + hash(w.t + i)
        const d = r * (0.6 + hash(i * 3 + w.t) * 0.5)
        ctx.globalAlpha = 1 - t
        felsBrocken(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d - Math.sin(t * Math.PI) * cell * 0.8, cell * 0.2, i + w.t, 1)
      }
      ctx.globalAlpha = 1
    }
  }
}

/* ================= Der Golem ================= */

const STEIN: RGB = [122, 113, 104]
const STEIN_HELL: RGB = [178, 168, 154]
const STEIN_DUNKEL: RGB = [62, 56, 51]
/** So viel groesser als ein Feld ist eine Einheit des Golems (er ist riesig) */
const GROESSE = 1.22
const BANN: RGB = [150, 196, 236]
const MOOS: RGB = [92, 136, 66]

/** Unregelmaessiger Felsbrocken (fest je seed), Licht von oben links */
function felsBrocken(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, a: number, farbe: RGB = STEIN, rand = true) {
  if (r <= 0 || a <= 0) return
  const n = 7
  ctx.save()
  ctx.globalAlpha *= a
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const w = (i / n) * TAU + hash(seed) * 0.6
    const rr = r * (0.82 + hash(seed * 3 + i) * 0.3)
    const x1 = x + Math.cos(w) * rr
    const y1 = y + Math.sin(w) * rr
    if (i) ctx.lineTo(x1, y1)
    else ctx.moveTo(x1, y1)
  }
  ctx.closePath()
  const gr = ctx.createLinearGradient(x - r, y - r, x + r * 0.8, y + r)
  gr.addColorStop(0, rgb(mix(farbe, [255, 255, 255], 0.28)))
  gr.addColorStop(0.55, rgb(farbe))
  gr.addColorStop(1, rgb(mix(farbe, [0, 0, 0], 0.42)))
  ctx.fillStyle = gr
  ctx.fill()
  if (rand) {
    ctx.strokeStyle = rgb(mix(farbe, [0, 0, 0], 0.62), 0.9)
    ctx.lineWidth = Math.max(1, r * 0.11)
    ctx.stroke()
  }
  ctx.restore()
}

/** Wie die Teile gerade stehen (lokal: +x nach vorn, +y nach rechts; Einheit = Feld) */
type Haltung = {
  /** Faeuste (links, rechts): Lage und Groesse (groesser = hoeher, naeher an der Kamera) */
  fl: Pf
  fr: Pf
  fsl: number
  fsr: number
  /** Beine vor/zurueck */
  bein: number
  /** Kopf: Lage nach vorn und Groesse */
  kopf: number
  ks: number
  /** Ganzer Koerper: Groesse, Zittern (Pixel), Drehen (rad) */
  s: number
  zitter: number
  dreh: number
  /** Augen: 0 orange, 1 rot (Angriff), 2 eisblau (gebannt) */
  augen: number
  glut: number
}

function haltung(g: Golemkampf, now: number, reduce: boolean): Haltung {
  const go = g.golem
  const a = go.angriff
  const t = now - go.seit
  const schritt = Math.sin(go.weg * Math.PI * 0.9)
  const h: Haltung = { fl: { x: 1.15, y: -1.55 }, fr: { x: 1.15, y: 1.55 }, fsl: 1, fsr: 1, bein: 0, kopf: 0.95, ks: 1, s: 1, zitter: 0, dreh: 0, augen: 0, glut: 0.6 }
  const atem = reduce ? 0 : Math.sin(now / 520) * 0.015
  h.s += atem
  switch (go.zustand) {
    case 'schlaf':
    case 'erwachen':
      break
    case 'laufen':
      h.bein = schritt
      h.fl.x += -schritt * 0.28
      h.fr.x += schritt * 0.28
      h.dreh = schritt * 0.04
      break
    case 'stampfen': {
      if (a?.art !== 'stampfen') break
      const k = clamp01((now - a.ab) / Math.max(1, a.schlag - a.ab))
      if (!a.fertig) {
        // Beide Faeuste hoch ueber den Kopf, zittern vor Kraft
        const e = easeOut(k)
        h.fl = { x: lerp(0.85, 0.25, e), y: lerp(-1.35, -1.05, e) }
        h.fr = { x: lerp(0.85, 0.25, e), y: lerp(1.35, 1.05, e) }
        h.fsl = h.fsr = 1 + 0.75 * e
        h.s = 1 + 0.08 * e
        h.zitter = k > 0.6 ? (k - 0.6) * 4 : 0
        h.augen = 1
        h.glut = 0.6 + 0.4 * k
      } else {
        const n = clamp01((now - a.schlag) / 350)
        h.fl = { x: lerp(1.05, 0.85, n), y: lerp(-1.75, -1.35, n) }
        h.fr = { x: lerp(1.05, 0.85, n), y: lerp(1.75, 1.35, n) }
        h.fsl = h.fsr = lerp(0.82, 1, n)
        h.s = lerp(0.94, 1, n)
      }
      break
    }
    case 'ansturm': {
      if (a?.art !== 'ansturm') break
      if (now < a.los) {
        // Duckt sich, scharrt mit dem Fuss
        const k = clamp01((now - a.ab) / Math.max(1, a.los - a.ab))
        h.s = 1 - 0.06 * k
        h.kopf = 1.15
        h.fl = { x: 0.55, y: -1.0 }
        h.fr = { x: 0.55, y: 1.0 }
        h.bein = reduce ? 0 : Math.sin(now / 70) * 0.5 * k
        h.zitter = k * 0.8
        h.augen = 1
        h.glut = 0.6 + 0.4 * k
      } else {
        h.bein = Math.sin(go.weg * Math.PI * 1.6)
        h.kopf = 1.25
        h.fl = { x: 0.4, y: -1.1 }
        h.fr = { x: 0.4, y: 1.1 }
        h.augen = 1
        h.glut = 1
      }
      break
    }
    case 'benommen':
      h.dreh = reduce ? 0 : Math.sin(now / 160) * 0.16
      h.fl = { x: 0.6, y: -1.5 }
      h.fr = { x: 0.6, y: 1.5 }
      h.fsl = h.fsr = 0.9
      h.glut = 0.3
      break
    case 'wartet':
      // Steht im neuen Raum und wartet, die Glut ist schwach
      h.glut = 0.35 + (reduce ? 0 : 0.15 * Math.sin(now / 400))
      h.fl = { x: 0.9, y: -1.5 }
      h.fr = { x: 0.9, y: 1.5 }
      break
    case 'wechsel':
    case 'sprung': {
      if (a?.art !== 'sprung') break
      if (now < a.ab) {
        const k = clamp01((now - a.duck) / Math.max(1, a.ab - a.duck))
        h.s = 1 - 0.1 * easeOut(k)
        h.fl = { x: 0.6, y: -1.55 }
        h.fr = { x: 0.6, y: 1.55 }
        h.fsl = h.fsr = 0.88
        h.augen = 1
      } else {
        h.fl = { x: 0.2, y: -1.6 }
        h.fr = { x: 0.2, y: 1.6 }
        h.fsl = h.fsr = 1.1
        h.augen = 1
        h.glut = 1
        if (a.fertig) {
          const n = clamp01((now - a.landung) / 400)
          h.s = lerp(0.88, 1, n)
          h.fl = { x: 0.9, y: lerp(-1.9, -1.35, n) }
          h.fr = { x: 0.9, y: lerp(1.9, 1.35, n) }
          h.fsl = h.fsr = lerp(0.8, 1, n)
        }
      }
      break
    }
    case 'gebannt':
      // Sackt zusammen, Faeuste am Boden, zittert gegen die Ketten an
      h.fl = { x: 0.7, y: -1.5 }
      h.fr = { x: 0.7, y: 1.5 }
      h.fsl = h.fsr = 0.86
      h.s = 0.95
      h.kopf = 0.85
      h.ks = 0.92
      h.zitter = reduce ? 0 : 0.5 + 0.5 * Math.sin(now / 40)
      h.augen = 2
      h.glut = 0.9
      break
    case 'getroffen': {
      const k = clamp01(t / GOLEM.getroffen)
      h.s = 1 - 0.08 * Math.sin(k * Math.PI)
      h.zitter = (1 - k) * 2.5
      h.dreh = (reduce ? 0 : Math.sin(now / 50)) * 0.12 * (1 - k)
      h.fl = { x: 0.5, y: -1.7 }
      h.fr = { x: 0.5, y: 1.7 }
      h.augen = 2
      h.glut = 1
      break
    }
    case 'zorn': {
      // Arme weit auseinander, Kopf hoch, bruellt
      const k = Math.sin(clamp01(t / GOLEM.zorn) * Math.PI)
      h.fl = { x: lerp(0.85, 0.1, k), y: lerp(-1.35, -2.0, k) }
      h.fr = { x: lerp(0.85, 0.1, k), y: lerp(1.35, 2.0, k) }
      h.fsl = h.fsr = 1 + 0.35 * k
      h.ks = 1 + 0.18 * k
      h.s = 1 + 0.05 * k
      h.zitter = k * 1.6
      h.augen = 1
      h.glut = 1
      break
    }
    case 'tot':
      h.augen = 2
      h.glut = 0
      break
  }
  return h
}

/** Der Golem: Schatten, Beine, Arme, Rumpf, Schultern, Kopf, Runen; dazu Ketten, Sterne, Splitter */
export function drawGolemBoss(ctx: CanvasRenderingContext2D, g: Golemkampf, cell: number, now: number, reduce: boolean) {
  const go = g.golem
  const a = go.angriff
  const u = cell * GROESSE
  const h = haltung(g, now, reduce)
  // Lage: im Sprung erst am Start, dann am Ziel; hoch oben ist er nicht zu sehen
  let gx = go.x
  let gy = go.y
  let hoch = 0
  if ((go.zustand === 'sprung' || go.zustand === 'wechsel') && a?.art === 'sprung' && now >= a.ab && !a.fertig) {
    hoch = g.hoehe()
    if (now >= a.fall) {
      gx = a.ziel.x
      gy = a.ziel.y
    } else {
      gx = a.von.x
      gy = a.von.y
    }
  }
  const x = px(gx, cell)
  const y = px(gy, cell)
  const sicht = 1 - clamp01((hoch - 0.55) / 0.4)
  const s = h.s * (1 + hoch * 1.1)
  const tot = go.zustand === 'tot' ? clamp01((now - go.seit) / GOLEM.tot) : 0
  const erwacht = go.zustand === 'schlaf' ? 0 : go.zustand === 'erwachen' ? clamp01((now - go.seit) / GOLEM.erwachen) : 1
  const schaden = g.golemLeben - go.hp
  const zit = reduce ? 0 : h.zitter * cell * 0.04
  const zx = zit ? (Math.random() - 0.5) * 2 * zit : 0
  const zy = zit ? (Math.random() - 0.5) * 2 * zit : 0

  // Farbe: gebannt blaeulich, getroffen weiss aufblitzend
  const bann = go.zustand === 'gebannt' ? 0.55 + 0.25 * (reduce ? 1 : Math.sin(now / 140)) : 0
  const blitz = clamp01(1 - (now - go.trefferT) / 260)
  const farbe = mix(mix(STEIN, BANN, bann), [255, 255, 255], blitz * 0.8)

  // Schatten am Boden (beim Sprung bleibt er am Start, bis er faellt)
  ctx.save()
  ctx.fillStyle = `rgba(0, 0, 0, ${0.32 * (1 - hoch * 0.7) * (1 - tot * 0.6)})`
  ctx.beginPath()
  ctx.ellipse(x + u * 0.15, y + u * 0.3, u * 2.0 * h.s * (1 - hoch * 0.4), u * 1.7 * h.s * (1 - hoch * 0.4), 0, 0, TAU)
  ctx.fill()
  ctx.restore()

  // Gebannt: Lichtsaeule und Ketten aus dem Kreis
  if (go.zustand === 'gebannt') drawKetten(ctx, g, x, y, cell, now, reduce)

  if (sicht <= 0) return
  // Erwachen: Teile liegen verstreut und ziehen sich zusammen; Zerfall: sie fallen auseinander
  const verstreut = (1 - easeOut(erwacht)) + easeIn(tot)
  const teil = (i: number) => ({ x: (hash(i * 5.3) - 0.5) * 2.4 * verstreut, y: (hash(i * 9.1) - 0.5) * 2.4 * verstreut })
  const teilS = 1 - 0.25 * verstreut

  ctx.save()
  ctx.globalAlpha *= sicht * (1 - clamp01((tot - 0.75) / 0.25))
  ctx.translate(x + zx, y + zy - hoch * u * 2.2)
  ctx.rotate(go.winkel + h.dreh)
  ctx.scale(s, s)
  const L = (v: Pf, i: number) => ({ x: (v.x + teil(i).x) * u, y: (v.y + teil(i).y) * u })

  // Beine (hinten, schauen unter dem Rumpf hervor)
  for (const sy of [-1, 1]) {
    const p = L({ x: -0.55 + h.bein * sy * 0.32, y: sy * 0.75 }, 1 + sy)
    felsBrocken(ctx, p.x, p.y, u * 0.55 * teilS, 21 + sy * 4, 1, mix(farbe, STEIN_DUNKEL, 0.35))
  }
  // Rumpf: grosser Fels, darauf Moos und Risse
  const rp = L({ x: 0, y: 0 }, 9)
  ctx.save()
  ctx.translate(rp.x, rp.y)
  ctx.scale(0.92, 1.1)
  felsBrocken(ctx, 0, 0, u * 1.3 * teilS, 5, 1, mix(farbe, STEIN_DUNKEL, 0.15))
  ctx.restore()
  // Ruecken: eine Platte und eine Reihe Zacken laengs der Wirbelsaeule
  felsBrocken(ctx, rp.x - u * 0.3, rp.y - u * 0.05, u * 0.78 * teilS, 6, 1, mix(farbe, STEIN_HELL, 0.12))
  for (let i = 0; i < 3; i++) felsBrocken(ctx, rp.x - u * (0.95 - i * 0.42), rp.y + u * 0.02, u * 0.2 * teilS, 81 + i, 1, mix(farbe, STEIN_HELL, 0.25))
  // Moos auf dem Ruecken
  if (bann < 0.3) {
    ctx.fillStyle = rgb(MOOS, 0.85 * (1 - blitz))
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(rp.x - u * (0.5 + hash(i) * 0.45), rp.y + (hash(i + 3) - 0.5) * u * 1.3, u * (0.1 + hash(i * 7) * 0.08), 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(160, 200, 110, 0.55)'
    ctx.beginPath()
    ctx.arc(rp.x - u * 0.7, rp.y - u * 0.25, u * 0.08, 0, TAU)
    ctx.fill()
  }
  // Runenkern und Risse: gluehen orange, im Angriff heller, gebannt eisblau
  const kern: RGB = h.augen === 2 ? [140, 230, 255] : [255, 150, 50]
  const glut = h.glut * (1 - tot)
  const risse: [number, number, number, number][] = [
    [0.15, 0, 0.75, -0.55],
    [0.15, 0, 0.6, 0.6],
    [0.15, 0, -0.5, 0.35],
    ...(schaden >= 1 ? ([[0.15, 0, -0.35, -0.75], [0.6, 0.6, 0.95, 0.35]] as [number, number, number, number][]) : []),
    ...(schaden >= 2 ? ([[0.15, 0, -0.9, 0], [0.75, -0.55, 0.45, -1.05], [-0.5, 0.35, -0.75, 0.9]] as [number, number, number, number][]) : []),
  ]
  ctx.lineCap = 'round'
  for (const [x1, y1, x2, y2] of risse) {
    ctx.strokeStyle = rgb(mix(farbe, [0, 0, 0], 0.6))
    ctx.lineWidth = u * 0.12
    ctx.beginPath()
    ctx.moveTo(rp.x + x1 * u, rp.y + y1 * u)
    ctx.lineTo(rp.x + ((x1 + x2) / 2 + 0.08) * u, rp.y + ((y1 + y2) / 2 - 0.05) * u)
    ctx.lineTo(rp.x + x2 * u, rp.y + y2 * u)
    ctx.stroke()
    ctx.strokeStyle = rgb(kern, 0.35 + 0.6 * glut)
    ctx.lineWidth = u * 0.05
    ctx.stroke()
  }
  const kg = ctx.createRadialGradient(rp.x + u * 0.15, rp.y, 0, rp.x + u * 0.15, rp.y, u * 0.6)
  kg.addColorStop(0, rgb(mix(kern, [255, 255, 255], 0.5), 0.9 * glut))
  kg.addColorStop(1, rgb(kern, 0))
  ctx.fillStyle = kg
  ctx.beginPath()
  ctx.arc(rp.x + u * 0.15, rp.y, u * 0.6, 0, TAU)
  ctx.fill()

  // Schultern (beim letzten Treffer bricht links ein Stueck heraus)
  for (const sy of [-1, 1]) {
    const p = L({ x: -0.05, y: sy * 1.2 }, 11 + sy)
    const kaputt = schaden >= 2 && sy < 0
    felsBrocken(ctx, p.x, p.y, u * (kaputt ? 0.4 : 0.56) * teilS, 51 + sy * 3, 1, mix(farbe, STEIN_HELL, 0.16))
    // Moos auf der Schulter
    if (bann < 0.3 && !kaputt) {
      ctx.fillStyle = rgb(MOOS, 0.9 * (1 - blitz))
      ctx.beginPath()
      ctx.arc(p.x - u * 0.12, p.y - sy * u * 0.08, u * 0.17, 0, TAU)
      ctx.arc(p.x + u * 0.05, p.y + sy * u * 0.15, u * 0.11, 0, TAU)
      ctx.fill()
    }
    if (kaputt) {
      ctx.strokeStyle = rgb(kern, 0.5 + 0.5 * glut)
      ctx.lineWidth = u * 0.06
      ctx.beginPath()
      ctx.arc(p.x, p.y, u * 0.3, 0.3, 2.4)
      ctx.stroke()
    }
  }

  // Arme: Oberarm von der Schulter zur Faust
  const arm = (f: Pf, fs: number, sy: number) => {
    const sch = L({ x: -0.05, y: sy * 1.2 }, 11 + sy)
    const fp = L(f, 7 + sy)
    // Oberarm: dicker Strang aus dunklem Stein (beim Erwachen und Zerfallen noch nicht verbunden)
    const verbunden = clamp01(1 - verstreut * 3)
    if (verbunden > 0) {
      ctx.globalAlpha *= verbunden
      ctx.strokeStyle = rgb(mix(farbe, [0, 0, 0], 0.62))
      ctx.lineWidth = u * 0.66
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sch.x, sch.y)
      ctx.lineTo(fp.x, fp.y)
      ctx.stroke()
      ctx.strokeStyle = rgb(mix(farbe, STEIN_DUNKEL, 0.4))
      ctx.lineWidth = u * 0.5
      ctx.stroke()
      ctx.globalAlpha /= verbunden
    }
    // Ellbogen-Stein auf dem Arm
    felsBrocken(ctx, sch.x * 0.45 + fp.x * 0.55, sch.y * 0.45 + fp.y * 0.55, u * 0.34 * teilS, 31 + sy, 1, mix(farbe, STEIN_HELL, 0.05))
    // Faust: grosser Brocken mit Knoecheln; hoch = groesser und mit eigenem Schatten
    if (fs > 1.05) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * (fs - 1)})`
      ctx.beginPath()
      ctx.ellipse(fp.x + u * 0.3 * (fs - 1), fp.y + u * 0.4 * (fs - 1), u * 0.5, u * 0.42, 0, 0, TAU)
      ctx.fill()
    }
    const fr = u * 0.6 * fs * teilS
    felsBrocken(ctx, fp.x, fp.y, fr, 41 + sy * 2, 1, mix(farbe, STEIN_HELL, 0.1))
    ctx.fillStyle = rgb(mix(farbe, STEIN_DUNKEL, 0.5), 0.8)
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath()
      ctx.arc(fp.x + fr * 0.55, fp.y + k * fr * 0.38, fr * 0.16, 0, TAU)
      ctx.fill()
    }
  }
  arm(h.fl, h.fsl, -1)
  arm(h.fr, h.fsr, 1)

  // Kopf mit Brauen und Augen (schauen zur Schlange)
  const kp = L({ x: h.kopf, y: 0 }, 13)
  const ks = h.ks * teilS
  felsBrocken(ctx, kp.x, kp.y, u * 0.62 * ks, 61, 1, mix(farbe, STEIN_HELL, 0.35))
  ctx.fillStyle = rgb(mix(farbe, STEIN_DUNKEL, 0.6))
  ctx.beginPath()
  ctx.moveTo(kp.x + u * 0.2 * ks, kp.y - u * 0.5 * ks)
  ctx.lineTo(kp.x + u * 0.3 * ks, kp.y - u * 0.05 * ks)
  ctx.lineTo(kp.x + u * 0.3 * ks, kp.y + u * 0.05 * ks)
  ctx.lineTo(kp.x + u * 0.2 * ks, kp.y + u * 0.5 * ks)
  ctx.lineTo(kp.x + u * 0.05 * ks, kp.y)
  ctx.closePath()
  ctx.fill()
  const augenFarbe: RGB = h.augen === 2 ? [150, 235, 255] : h.augen === 1 ? [255, 70, 50] : [255, 180, 70]
  const ag = 0.5 + 0.5 * glut
  for (const sy of [-1, 1]) {
    const ax = kp.x + u * 0.36 * ks
    const ay = kp.y + sy * u * 0.24 * ks
    const gl = ctx.createRadialGradient(ax, ay, 0, ax, ay, u * 0.42 * ks)
    gl.addColorStop(0, rgb(augenFarbe, 0.95 * ag))
    gl.addColorStop(0.35, rgb(augenFarbe, 0.45 * ag))
    gl.addColorStop(1, rgb(augenFarbe, 0))
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(ax, ay, u * 0.42 * ks, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(20, 14, 10, 0.85)'
    ctx.beginPath()
    ctx.ellipse(ax, ay, u * 0.12 * ks, u * 0.15 * ks, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(mix(augenFarbe, [255, 255, 255], 0.5), ag)
    ctx.beginPath()
    ctx.ellipse(ax + u * 0.02, ay, u * 0.08 * ks, u * 0.11 * ks, 0, 0, TAU)
    ctx.fill()
  }
  // Gebruell: Maul glueht
  if (go.zustand === 'zorn') {
    const k = Math.sin(clamp01((now - go.seit) / GOLEM.zorn) * Math.PI)
    ctx.fillStyle = `rgba(255, 110, 40, ${0.7 * k})`
    ctx.beginPath()
    ctx.ellipse(kp.x + u * 0.5 * ks, kp.y, u * 0.12 * ks, u * 0.22 * ks * k, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // Ueber dem Golem: Sterne (benommen), Splitter (getroffen), Funken (Ansturm), Geroell (tot)
  if (go.zustand === 'benommen' && !reduce)
    for (let i = 0; i < 4; i++) {
      const w = now / 260 + (i / 4) * TAU
      stern(ctx, x + Math.cos(w) * u * 1.1, y - u * 0.9 + Math.sin(w) * u * 0.45, u * 0.22, `rgba(255, 230, 120, 0.95)`)
    }
  if (now - go.trefferT < 900 && !reduce) {
    const t = (now - go.trefferT) / 900
    for (let i = 0; i < 12; i++) {
      const w = (i / 12) * TAU + hash(i + go.hp)
      const d = easeOut(t) * u * (2 + hash(i * 2) * 2)
      ctx.globalAlpha = 1 - t
      felsBrocken(ctx, x + Math.cos(w) * d, y + Math.sin(w) * d - Math.sin(t * Math.PI) * u * 1.2, u * (0.18 + hash(i) * 0.2), i * 3 + go.hp, 1, mix(STEIN, BANN, 0.4))
    }
    ctx.globalAlpha = 1
  }
  if (go.zustand === 'ansturm' && a?.art === 'ansturm' && now >= a.los && !reduce)
    for (let i = 0; i < 6; i++) {
      const d = u * (1.6 + i * 0.5)
      staub(ctx, x - a.dir.x * d + (hash(i + Math.floor(now / 60)) - 0.5) * u, y - a.dir.y * d + (hash(i * 3 + Math.floor(now / 60)) - 0.5) * u, u * (0.6 + i * 0.12), 0.32 - i * 0.04)
    }
  if (go.zustand === 'tot') {
    // Geroellhaufen bleibt liegen
    const k = easeOut(clamp01((tot - 0.4) / 0.6))
    for (let i = 0; i < 9; i++) {
      const w = (i / 9) * TAU + 0.4
      const d = u * (0.4 + hash(i * 4) * 1.1)
      felsBrocken(ctx, x + Math.cos(w) * d, y + Math.sin(w) * d, u * (0.32 + hash(i) * 0.28) * k, 70 + i, k, STEIN)
    }
    staub(ctx, x, y, u * (1.5 + tot * 3), 0.5 * Math.sin(tot * Math.PI))
  }
  if (go.zustand === 'erwachen' && !reduce) staub(ctx, x, y, u * (1.6 + erwacht * 1.5), 0.35 * Math.sin(erwacht * Math.PI))
}

function stern(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  ctx.fillStyle = c
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const w = (i / 10) * TAU - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    if (i) ctx.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr)
    else ctx.moveTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

/** Gebannt: eine Lichtsaeule und sechs Ketten aus Licht vom Kreis zum Golem */
function drawKetten(ctx: CanvasRenderingContext2D, g: Golemkampf, x: number, y: number, cell: number, now: number, reduce: boolean) {
  const k = g.kreis
  const cx = px(k.p.x, cell)
  const cy = px(k.p.y, cell)
  const r = k.r * cell
  const rest = clamp01((g.golem.bis - now) / 1200)
  ctx.save()
  const gl = ctx.createRadialGradient(x, y, 0, x, y, cell * 2.6)
  gl.addColorStop(0, 'rgba(200, 240, 255, 0.5)')
  gl.addColorStop(1, 'rgba(200, 240, 255, 0)')
  ctx.fillStyle = gl
  ctx.fillRect(x - cell * 2.6, y - cell * 2.6, cell * 5.2, cell * 5.2)
  g.sockel.forEach((s, i) => {
    const w = Math.atan2(s.p.y - k.p.y, s.p.x - k.p.x)
    const ax = cx + Math.cos(w) * r
    const ay = cy + Math.sin(w) * r
    const f = hex(KRISTALL_FARBEN[i])
    // Die Kette flackert, wenn der Bann bald bricht
    const an = rest < 1 && !reduce ? (Math.sin(now / 45 + i) > 0 ? 1 : 0.35) : 1
    ctx.strokeStyle = rgb(mix(f, [255, 255, 255], 0.4), 0.85 * an)
    ctx.lineWidth = cell * 0.12
    ctx.setLineDash([cell * 0.28, cell * 0.14])
    ctx.lineDashOffset = reduce ? 0 : -now / 40
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(x + Math.cos(w) * cell * 0.9, y + Math.sin(w) * cell * 0.9)
    ctx.stroke()
  })
  ctx.setLineDash([])
  ctx.restore()
}

/* ================= Anzeige (Bildschirm) ================= */

/** Unten (oben erscheinen die Hinweise): Name und Lebensleiste des Golems (3 Teile), rechts die Herzen der Schlange */
export function drawBossHud(ctx: CanvasRenderingContext2D, g: Golemkampf, vw: number, vh: number, now: number) {
  const go = g.golem
  const w = Math.min(220, vw * 0.48)
  const x0 = (vw - w) / 2
  const y0 = vh - 40
  ctx.save()
  // Name
  ctx.font = '800 12px "Libre Franklin", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(23, 21, 19, 0.75)'
  const name = g.raeume.length > 1 ? `STEINGOLEM · RAUM ${g.raumNr + 1}/${g.raeume.length}` : 'STEINGOLEM'
  ctx.fillText(name, vw / 2 + 1, y0 + 11)
  ctx.fillStyle = go.zustand === 'gebannt' ? '#BDEBFF' : '#F5EFE6'
  ctx.fillText(name, vw / 2, y0 + 10)
  // Leiste
  const by = y0 + 16
  const bh = 10
  ctx.fillStyle = 'rgba(23, 21, 19, 0.8)'
  rundRect(ctx, x0 - 3, by - 3, w + 6, bh + 6, 7)
  ctx.fill()
  const teil = (w - 8) / g.golemLeben
  for (let i = 0; i < g.golemLeben; i++) {
    const voll = i < go.hp
    const verloren = i === go.hp && now - go.trefferT < 700
    const x = x0 + i * (teil + 4)
    ctx.fillStyle = voll ? (go.zustand === 'gebannt' ? '#7FD8FF' : '#E5463B') : verloren ? `rgba(255, 255, 255, ${1 - (now - go.trefferT) / 700})` : 'rgba(245, 239, 230, 0.12)'
    rundRect(ctx, x, by, teil, bh, 4)
    ctx.fill()
    if (voll) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      rundRect(ctx, x + 2, by + 1, teil - 4, 3, 2)
      ctx.fill()
    }
  }
  // Herzen rechts (ein verlorenes blinkt kurz)
  ctx.fillStyle = 'rgba(23, 21, 19, 0.6)'
  rundRect(ctx, vw - 16 - GOLEM.herzen * 22, by - 6, GOLEM.herzen * 22 + 6, bh + 12, 10)
  ctx.fill()
  const weg = now < g.schutzBis
  for (let i = 0; i < GOLEM.herzen; i++) {
    const voll = i < g.leben
    const blinkt = !voll && i === g.leben && weg && Math.sin(now / 70) > 0
    herz(ctx, vw - 24 - (GOLEM.herzen - 1 - i) * 22, by + bh / 2 + 1, 8, voll || blinkt ? '#FF5A6E' : 'rgba(245, 239, 230, 0.18)', voll)
  }
  ctx.restore()
}

function herz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, rand: boolean) {
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.4)
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9)
  ctx.fill()
  if (rand) {
    ctx.strokeStyle = 'rgba(23, 21, 19, 0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function rundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* ================= Kleine Steingolems ================= */

/** Rote Flaeche, in die ein kleiner Golem gleich schlaegt (k = wie weit er schon ausgeholt hat) */
export function drawMinigolemWarnung(ctx: CanvasRenderingContext2D, cells: Pf[], k: number, now: number, cell: number, reduce: boolean) {
  if (!cells.length) return
  warnPfad(ctx, () => {
    ctx.beginPath()
    for (const c of cells) ctx.rect(c.x * cell, c.y * cell, cell, cell)
  }, k, now, cell, reduce)
}

/** Druckwelle nach dem Schlag: rund ein Ring, geradeaus ein Streifen mit Steinchen (t = 0..1) */
export function drawMinigolemSchlag(ctx: CanvasRenderingContext2D, x: number, y: number, winkel: number, art: 'rund' | 'linie', t: number, cell: number) {
  if (t <= 0 || t >= 1) return
  ctx.save()
  if (art === 'rund') {
    const r = cell * (0.6 + 2.0 * easeOut(t))
    ctx.strokeStyle = `rgba(255, 236, 214, ${0.8 * (1 - t)})`
    ctx.lineWidth = cell * 0.3 * (1 - t)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.stroke()
    staub(ctx, x, y, r, 0.4 * (1 - t))
  } else {
    ctx.translate(x, y)
    ctx.rotate(winkel)
    const l = cell * (0.8 + 3.6 * easeOut(t))
    const gr = ctx.createLinearGradient(0, 0, l, 0)
    gr.addColorStop(0, `rgba(255, 236, 214, ${0.15 * (1 - t)})`)
    gr.addColorStop(1, `rgba(255, 236, 214, ${0.75 * (1 - t)})`)
    ctx.fillStyle = gr
    ctx.beginPath()
    ctx.moveTo(cell * 0.4, -cell * 0.3)
    ctx.lineTo(l, -cell * 0.45)
    ctx.lineTo(l + cell * 0.3, 0)
    ctx.lineTo(l, cell * 0.45)
    ctx.lineTo(cell * 0.4, cell * 0.3)
    ctx.closePath()
    ctx.fill()
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 1 - t
      felsBrocken(ctx, l * (0.35 + i * 0.15), (hash(i * 7) - 0.5) * cell * 0.7, cell * 0.12, i * 5, 1)
    }
  }
  ctx.restore()
}

/** Kleiner Steingolem von oben (ein Feld, etwas groesser gezeichnet): Beine, Rumpf mit Moos, Schultern, Faeuste, Kopf mit
 *  gluehenden Augen. lauf: Schrittphase (-1 = steht), auf: Erscheinen (0..1), laden: holt aus (0..1), schlag: hat gerade
 *  geschlagen (0..1), jagt: hat die Schlange gesehen (Augen rot) */
export function drawMinigolem(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, winkel: number, lauf: number, auf: number, laden: number, art: 'rund' | 'linie', schlag: number, jagt: boolean, now: number, reduce: boolean) {
  if (auf <= 0) return
  const u = cell * 0.6 * auf
  const schritt = lauf >= 0 ? Math.sin(lauf * TAU) : 0
  const zit = !reduce && laden > 0.55 ? (Math.random() - 0.5) * cell * 0.05 * laden : 0
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(x + u * 0.12, y + u * 0.3, u * 1.3, u * 1.1, 0, 0, TAU)
  ctx.fill()
  ctx.translate(x + zit, y + zit * 0.6)
  ctx.rotate(winkel)
  const s = 1 + (art === 'rund' ? 0.08 : 0.04) * laden - 0.06 * Math.sin(clamp01(schlag) * Math.PI)
  ctx.scale(s, s)
  // Beine
  for (const sy of [-1, 1]) felsBrocken(ctx, -u * 0.45 + schritt * sy * u * 0.25, sy * u * 0.5, u * 0.38, 21 + sy * 4, 1, mix(STEIN, STEIN_DUNKEL, 0.35))
  // Rumpf, Ruecken, Moos
  felsBrocken(ctx, 0, 0, u * 0.86, 5, 1, mix(STEIN, STEIN_DUNKEL, 0.12))
  felsBrocken(ctx, -u * 0.22, 0, u * 0.5, 6, 1, mix(STEIN, STEIN_HELL, 0.12))
  ctx.fillStyle = rgb(MOOS, 0.85)
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(-u * (0.35 + hash(i) * 0.3), (hash(i + 3) - 0.5) * u * 0.9, u * (0.09 + hash(i * 7) * 0.06), 0, TAU)
    ctx.fill()
  }
  // Glut im Kern: beim Ausholen heller
  const kern: RGB = [255, 150, 50]
  const kg = ctx.createRadialGradient(u * 0.1, 0, 0, u * 0.1, 0, u * 0.5)
  kg.addColorStop(0, rgb(mix(kern, [255, 255, 255], 0.4), 0.35 + 0.6 * laden))
  kg.addColorStop(1, rgb(kern, 0))
  ctx.fillStyle = kg
  ctx.beginPath()
  ctx.arc(u * 0.1, 0, u * 0.5, 0, TAU)
  ctx.fill()
  // Faeuste: laufen schwingen sie mit; rund holen beide aus, geradeaus zieht er die rechte zurueck und stoesst sie vor
  const n = clamp01(schlag)
  for (const sy of [-1, 1]) {
    let fx = 0.75 - schritt * sy * 0.2
    let fy = sy * 0.95
    let fs = 1
    if (art === 'rund') {
      fx = lerp(fx, 0.25, laden)
      fy = lerp(fy, sy * 0.7, laden)
      fs = 1 + 0.6 * laden
      if (n > 0) {
        fx = lerp(1.0, fx, n)
        fy = lerp(sy * 1.25, fy, n)
        fs = lerp(0.85, 1, n)
      }
    } else if (sy > 0) {
      fx = lerp(fx, -0.2, laden)
      fs = 1 + 0.3 * laden
      if (n > 0) {
        fx = lerp(1.6, 0.75, n)
        fy = lerp(0.35, fy, n)
      }
    }
    // Arm von der Schulter zur Faust
    ctx.strokeStyle = rgb(mix(STEIN, STEIN_DUNKEL, 0.45))
    ctx.lineWidth = u * 0.36
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-u * 0.05, sy * u * 0.75)
    ctx.lineTo(fx * u, fy * u)
    ctx.stroke()
    felsBrocken(ctx, -u * 0.05, sy * u * 0.78, u * 0.36, 51 + sy * 3, 1, mix(STEIN, STEIN_HELL, 0.16))
    if (fs > 1.05) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.2 * (fs - 1)})`
      ctx.beginPath()
      ctx.ellipse(fx * u + u * 0.2 * (fs - 1), fy * u + u * 0.25 * (fs - 1), u * 0.36, u * 0.3, 0, 0, TAU)
      ctx.fill()
    }
    felsBrocken(ctx, fx * u, fy * u, u * 0.4 * fs, 41 + sy * 2, 1, mix(STEIN, STEIN_HELL, 0.1))
  }
  // Kopf mit Augen (rot, wenn er die Schlange gesehen hat)
  felsBrocken(ctx, u * 0.62, 0, u * 0.42, 61, 1, mix(STEIN, STEIN_HELL, 0.35))
  const augen: RGB = jagt || laden > 0 ? [255, 70, 50] : [255, 180, 70]
  const ag = 0.6 + 0.4 * (reduce ? 1 : Math.sin(now / 260) * 0.5 + 0.5) * (jagt ? 1 : 0.6)
  for (const sy of [-1, 1]) {
    const ax = u * 0.8
    const ay = sy * u * 0.16
    const gl = ctx.createRadialGradient(ax, ay, 0, ax, ay, u * 0.3)
    gl.addColorStop(0, rgb(augen, 0.95 * ag))
    gl.addColorStop(1, rgb(augen, 0))
    ctx.fillStyle = gl
    ctx.beginPath()
    ctx.arc(ax, ay, u * 0.3, 0, TAU)
    ctx.fill()
    ctx.fillStyle = rgb(mix(augen, [255, 255, 255], 0.5), ag)
    ctx.beginPath()
    ctx.arc(ax, ay, u * 0.07, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** Ausrufezeichen ueber dem Golem, kurz nachdem er die Schlange entdeckt hat (k = 0..1 der Zeit) */
export function drawMinigolemEntdeckt(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, k: number) {
  if (k <= 0 || k >= 1) return
  const a = Math.min(1, (1 - k) * 3)
  const hoch = cell * (0.75 + 0.15 * easeOut(Math.min(1, k * 4)))
  ctx.save()
  ctx.globalAlpha *= a
  ctx.fillStyle = '#E5463B'
  ctx.strokeStyle = 'rgba(23, 21, 19, 0.75)'
  ctx.lineWidth = Math.max(1.5, cell * 0.06)
  ctx.beginPath()
  ctx.arc(x, y - hoch, cell * 0.24, 0, TAU)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(x - cell * 0.035, y - hoch - cell * 0.15, cell * 0.07, cell * 0.17)
  ctx.beginPath()
  ctx.arc(x, y - hoch + cell * 0.1, cell * 0.04, 0, TAU)
  ctx.fill()
  ctx.restore()
}
