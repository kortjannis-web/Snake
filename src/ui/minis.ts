/** Kleine Bilder fuer Anleitung, Hinweise und Spielende (gleiche Zeichnungen wie im Spiel) */
import type { Cause, Side } from '../game/types'
import { drawSchlange, GEGNER_SKIN, LILA_SKIN } from '../render/skins'
import { drawBaumLiegend } from '../render/baeume'
import { C, drawAmeise, drawApfel, drawEis, drawErz, drawFalle, drawLava, drawFrosch, drawHaus, drawKegel, drawLicht, drawPower, drawStein, drawTeich, drawTurm, drawWolkenFeld, rund } from '../render/sprites'

export type Mini =
  | 'apfel'
  | 'aepfel'
  | 'gift'
  | 'mauer'
  | 'teich'
  | 'gebiet'
  | 'falle'
  | 'wolke'
  | 'frosch'
  | 'schlange'
  | 'rand'
  | 'baum'
  | 'haus'
  | 'turm'
  | 'gegner'
  | 'lila'
  | 'ameise'
  | 'lava'
  | 'eis'
  | 'erz'
  | 'erde'
  | 'fuettern'
  | 'magnet'
  | 'maulwurf'
  | 'spitzhacke'
  | 'erfolg'
  | 'schild'
  | 'zeitlupe'
  | 'geist'
  | 'schere'
  | 'goldschere'

/** stufe = Apfelfarbe (fuer 'apfel') */
export function drawMini(cv: HTMLCanvasElement, kind: Mini, t = 0, side: Side = 'top', stufe = 1) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const css = cv.clientWidth || Number(cv.getAttribute('width')) || 64
  cv.width = Math.round(css * dpr)
  cv.height = Math.round(css * dpr)
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, css, css)
  // Hintergrund: Schachbrett-Kachel mit runden Ecken
  const n = 3
  const cell = css / n
  ctx.save()
  rund(ctx, 0, 0, css, css, css * 0.22)
  ctx.clip()
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = (x + y) % 2 ? C.dunkel : C.hell
    ctx.fillRect(x * cell, y * cell, cell, cell)
  }
  const mid = css / 2
  const big = cell * 1.6
  switch (kind) {
    case 'apfel':
      drawApfel(ctx, mid, mid, big, 1, 0, undefined, stufe)
      break
    case 'aepfel':
      // Drei Stufen nebeneinander: Rot, Orange, Gelb
      drawApfel(ctx, mid - cell * 0.8, mid + cell * 0.25, cell * 1.05, 1, 0, undefined, 1)
      drawApfel(ctx, mid + cell * 0.8, mid + cell * 0.25, cell * 1.05, 1, 0, undefined, 3)
      drawApfel(ctx, mid, mid - cell * 0.35, cell * 1.15, 1, 0, undefined, 2)
      break
    case 'gegner': {
      ctx.save()
      ctx.translate(0, cell * 0.1)
      drawSchlange(ctx, [{ x: 2.1, y: 1 }, { x: 1.1, y: 1 }, { x: 0.1, y: 1 }, { x: -0.9, y: 1 }], cell, 'r', GEGNER_SKIN, t, { brauen: true })
      ctx.restore()
      break
    }
    case 'lila': {
      ctx.save()
      ctx.translate(0, cell * 0.1)
      drawSchlange(ctx, [{ x: 2.1, y: 1 }, { x: 1.1, y: 1 }, { x: 1.1, y: 2 }, { x: 0.1, y: 2 }, { x: -0.9, y: 2 }], cell, 'r', LILA_SKIN, t, { brauen: 2 })
      ctx.restore()
      break
    }
    case 'ameise':
      drawAmeise(ctx, mid, mid + cell * 0.1, big * 0.9, -0.5, -1, 1, 1)
      break
    case 'erfolg': {
      // Medaille mit Stern
      ctx.fillStyle = '#C0392B'
      ctx.fillRect(mid - cell * 0.35, 0, cell * 0.25, mid)
      ctx.fillStyle = '#2E86C1'
      ctx.fillRect(mid + cell * 0.1, 0, cell * 0.25, mid)
      const g = ctx.createRadialGradient(mid - cell * 0.2, mid + cell * 0.1, 0, mid, mid + cell * 0.3, cell * 0.9)
      g.addColorStop(0, '#FFF1A8')
      g.addColorStop(1, '#D89B1C')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mid, mid + cell * 0.35, cell * 0.75, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 ? cell * 0.16 : cell * 0.38
        ctx.lineTo(mid + Math.cos(a) * rr, mid + cell * 0.35 + Math.sin(a) * rr)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'eis':
      drawEis(ctx, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }], cell, 1, t + 1300)
      break
    case 'erz':
      ctx.fillStyle = '#3B281A'
      ctx.fillRect(0, 0, css, css)
      drawErz(ctx, mid - cell * 0.5, mid + cell * 0.3, cell * 1.2, 'gold', 1, 0.8)
      drawErz(ctx, mid + cell * 0.6, mid - cell * 0.4, cell * 1.1, 'dia', 1, 0.6)
      break
    case 'erde':
      ctx.fillStyle = '#3B281A'
      ctx.fillRect(0, 0, css, css)
      ctx.fillStyle = '#7A5434'
      ctx.fillRect(0, cell, css, cell)
      break
    case 'lava':
      drawLava(ctx, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }], [0, 0, 0, 0], cell, t + 10000, true)
      break
    case 'gift':
      drawApfel(ctx, mid, mid, big, 1, 0, -0.7)
      break
    case 'mauer':
      drawStein(ctx, 0, cell, cell, 1)
      drawStein(ctx, cell, cell, cell, 1)
      drawStein(ctx, cell * 2, cell, cell, 1)
      break
    case 'teich':
      drawTeich(ctx, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }], cell, 1, t)
      break
    case 'gebiet': {
      // Pfeil und neuer Streifen zeigen in die Richtung, in die die Karte gewachsen ist
      const rot = { top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 }[side]
      ctx.translate(mid, mid)
      ctx.rotate(rot)
      ctx.translate(-mid, -mid)
      ctx.fillStyle = C.neuHell
      ctx.fillRect(0, 0, css, cell)
      ctx.strokeStyle = '#1C5446'
      ctx.lineWidth = Math.max(2, css * 0.05)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(mid, css * 0.78)
      ctx.lineTo(mid, css * 0.24)
      ctx.moveTo(mid - css * 0.16, css * 0.4)
      ctx.lineTo(mid, css * 0.24)
      ctx.lineTo(mid + css * 0.16, css * 0.4)
      ctx.stroke()
      break
    }
    case 'falle':
      drawFalle(ctx, mid, mid, big, 1)
      break
    case 'wolke':
      for (const [x, y] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) drawWolkenFeld(ctx, mid + x * cell, mid + y * cell, cell, 1, 1, t, x + y * 3)
      break
    case 'frosch':
      drawFrosch(ctx, mid, mid + cell * 0.1, big, 0, 0, -1, 1)
      break
    case 'turm': {
      const k = css / 2.6
      ctx.translate(-k * 0.25, (css - 2 * k) / 2)
      drawKegel(ctx, [{ x: 2, y: 0 }, { x: 2, y: 1 }], { x: k, y: k }, 0, k, 1, t)
      drawTurm(ctx, k, k, k, 0, 1, t)
      break
    }
    case 'schlange': {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = `rgb(${C.schwanz.join(',')})`
      ctx.lineWidth = cell * 0.74
      ctx.beginPath()
      ctx.moveTo(cell * 0.5, cell * 2.5)
      ctx.lineTo(cell * 0.5, cell * 1.5)
      ctx.lineTo(cell * 1.5, cell * 1.5)
      ctx.strokeStyle = `rgb(${C.kopf.join(',')})`
      ctx.lineTo(cell * 2.5, cell * 1.5)
      ctx.stroke()
      ctx.fillStyle = `rgb(${C.kopf.join(',')})`
      ctx.beginPath()
      ctx.arc(cell * 2.5, cell * 1.5, cell * 0.42, 0, Math.PI * 2)
      ctx.fill()
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(cell * 2.6, cell * 1.5 + s * cell * 0.2, cell * 0.15, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#16211d'
        ctx.beginPath()
        ctx.arc(cell * 2.66, cell * 1.5 + s * cell * 0.2, cell * 0.075, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'baum': {
      // vier Felder lang: kleiner zeichnen, damit er ganz in die Kachel passt
      const k = css / 4.4
      ctx.save()
      ctx.translate((css - 4 * k) / 2, (css - 3 * k) / 2 + k - k * 0.1)
      drawBaumLiegend(ctx, 'laub', { x: 0, y: 0 }, 'r', k, 1, t)
      ctx.restore()
      break
    }
    case 'haus': {
      const k = css / 4.2
      ctx.save()
      ctx.translate(k * 0.3, k * 0.9)
      const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]
      const f = [{ p: { x: 1, y: 0 }, d: 'u' as const }, { p: { x: 2, y: 1 }, d: 'r' as const }, { p: { x: 1, y: 1 }, d: 'd' as const }, { p: { x: 0, y: 0 }, d: 'l' as const }]
      drawLicht(ctx, f[2].p, 'd', 1, k, 1, t)
      drawHaus(ctx, cells, f, 2, 4, k, 1, t)
      ctx.restore()
      break
    }
    case 'schild':
    case 'zeitlupe':
    case 'fuettern':
    case 'magnet':
    case 'maulwurf':
    case 'spitzhacke':
    case 'geist':
    case 'schere':
    case 'goldschere':
      drawPower(ctx, mid, mid + cell * 0.1, big, kind, 1, 0)
      break
    case 'rand':
      ctx.fillStyle = '#1C5446'
      ctx.fillRect(cell * 2.2, 0, cell * 0.8, css)
      break
  }
  ctx.restore()
}

export const MINI_FOR_CAUSE: Record<Cause, Mini> = {
  rand: 'rand',
  selbst: 'schlange',
  mauer: 'mauer',
  teich: 'teich',
  gift: 'gift',
  falle: 'falle',
  frosch: 'frosch',
  turm: 'turm',
  baum: 'baum',
  haus: 'haus',
  gegner: 'gegner',
  lava: 'lava',
  erde: 'erde',
  spieler: 'schlange',
  zone: 'lava',
  zeit: 'apfel',
  ziel: 'aepfel',
  flut: 'teich',
  sandwurm: 'gegner',
  abgrund: 'lava',
  eiszapfen: 'eis',
  eisbruch: 'eis',
  yeti: 'gegner',
  eisbaer: 'gegner',
  robbe: 'frosch',
  schneemann: 'mauer',
  stein: 'mauer',
  lore: 'gegner',
  tnt: 'falle',
  spalt: 'erde',
  zwerg: 'frosch',
  golem: 'gegner',
  lorenlager: 'mauer',
  irrlicht: 'gift',
  einhorn: 'gegner',
  ent: 'baum',
  ranke: 'mauer',
  wanderbaum: 'baum',
  zombiehand: 'falle',
  skelett: 'gegner',
  werwolf: 'gegner',
  riesenspinne: 'ameise',
  abbruch: 'lava',
  lavabombe: 'lava',
  meteor: 'lava',
  lavastrom: 'lava',
  magmawurm: 'gegner',
  lavafisch: 'frosch',
  glutgolem: 'gegner',
  glut: 'lava',
  obsidian: 'mauer',
  bienenstock: 'mauer',
  igel: 'frosch',
  huegel: 'erde',
  karawane: 'gegner',
  geier: 'gegner',
  klapperschlange: 'gegner',
}
