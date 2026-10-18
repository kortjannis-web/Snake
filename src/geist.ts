/**
 * Eigener Geist: der Weg des besten Laufs (Kopf je Schritt, in Weltkoordinaten) wird aufgezeichnet
 * und im naechsten Lauf als durchscheinende Schlange nachgefahren. Getrennt fuer Endlos (bester Lauf
 * ueberhaupt) und Tages-Herausforderung (bester Lauf heute, dort ist die Startwelt fuer alle gleich).
 */
import type { Game } from './game/game'
import type { Dir, P } from './game/types'

export type GeistArt = 'endlos' | 'tages'
/** Lauf: erreichter Level, Tag (nur Tages-Herausforderung), Punkte flach [Zeit, x, y, Laenge, ...] */
export type Lauf = { level: number; datum?: string; p: number[] }

const KEY = 'snake.geist.v1'
/** Hoechstens so viele Schritte (gut eine Stunde) */
const MAX_PUNKTE = 4 * 25_000

function alle(): Partial<Record<GeistArt, Lauf>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

/** Gespeicherten Lauf holen (Tages-Herausforderung nur, wenn er von heute ist) */
export function geistLaden(art: GeistArt, datum?: string): Lauf | null {
  const l = alle()[art]
  if (!l || !Array.isArray(l.p) || l.p.length < 8) return null
  if (art === 'tages' && l.datum !== datum) return null
  return l
}

/** Lauf speichern, wenn er besser ist als der bisherige (bzw. der erste von heute) */
export function geistSpeichern(art: GeistArt, lauf: Lauf): boolean {
  const alt = geistLaden(art, lauf.datum)
  if (alt && alt.level >= lauf.level) return false
  if (lauf.p.length < 8) return false
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...alle(), [art]: lauf }))
    return true
  } catch {
    return false
  }
}

/** Nimmt waehrend eines Laufs den Kopf bei jedem Schritt auf */
export class Aufnahme {
  p: number[] = []
  private letzter = ''

  aufnehmen(g: Game) {
    const h = g.body[0]
    if (!h || this.p.length >= MAX_PUNKTE) return
    const x = h.x - g.ursprung.x
    const y = h.y - g.ursprung.y
    const k = `${x},${y}`
    if (k === this.letzter) return
    this.letzter = k
    this.p.push(Math.round(g.time), x, y, g.body.length)
  }
}

/** Geist zur Spielzeit `zeit` als Schlange in Kartenkoordinaten (null = noch nicht da oder vorbei) */
export function geistKoerper(l: Lauf, zeit: number, ursprung: P): { body: P[]; prev: P[]; dir: Dir; alpha: number; deck: number } | null {
  const n = l.p.length / 4
  const t = (i: number) => l.p[i * 4]
  if (n < 2 || zeit < t(0)) return null
  const ende = t(n - 1)
  // Kurz nach dem Ende verblasst er
  if (zeit > ende + 1500) return null
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t(mid) <= zeit) lo = mid
    else hi = mid - 1
  }
  const i = lo
  const pos = (j: number): P => ({ x: l.p[j * 4 + 1] + ursprung.x, y: l.p[j * 4 + 2] + ursprung.y })
  const len = Math.max(1, l.p[i * 4 + 3])
  const body: P[] = []
  for (let j = i; j >= 0 && body.length < len; j--) body.push(pos(j))
  const prev: P[] = []
  for (let j = Math.max(0, i - 1); j >= 0 && prev.length < len; j--) prev.push(pos(j))
  while (prev.length < body.length) prev.push({ ...body[body.length - 1] })
  const a = body[0]
  const b = body[1] ?? a
  const dir: Dir = a.x > b.x ? 'r' : a.x < b.x ? 'l' : a.y > b.y ? 'd' : 'u'
  const naechste = i + 1 < n ? t(i + 1) : t(i) + 150
  const alpha = Math.min(1, Math.max(0, (zeit - t(i)) / Math.max(1, naechste - t(i))))
  const deck = zeit > ende ? 0.38 * (1 - (zeit - ende) / 1500) : 0.38
  return { body, prev, dir, alpha, deck }
}

/** Tag in Deutschland (fuer die Tages-Herausforderung: alle haben denselben Tag) */
export function tagBerlin(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/** Startwert der Welt fuer einen Tag (gleich fuer alle) */
export function tagesSeed(tag: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
