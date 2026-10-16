/** Kleine Bilder fuer Anleitung, Hinweise und Spielende (gleiche Zeichnungen wie im Spiel) */
import type { Cause, Side } from '../game/types'
import { C, drawAmeise, drawApfel, drawFalle, drawStein, drawTeich, drawWolkenFeld, rund } from '../render/sprites'

export type Mini = 'apfel' | 'gift' | 'mauer' | 'teich' | 'gebiet' | 'falle' | 'wolke' | 'ameise' | 'schlange' | 'rand'

export function drawMini(cv: HTMLCanvasElement, kind: Mini, t = 0, side: Side = 'top') {
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
      drawApfel(ctx, mid, mid, big, 1)
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
    case 'ameise':
      drawAmeise(ctx, mid, mid, big, 'r', t / 60, 1)
      break
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
  wolke: 'wolke',
  ameise: 'ameise',
}
