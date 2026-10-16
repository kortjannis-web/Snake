/**
 * Einfacher Autopilot: kuerzester Weg zum Apfel (Breitensuche), sonst der Zug
 * mit dem meisten freien Platz. Fuer das Startmenue (Schlange im Hintergrund)
 * und fuer die Tests.
 */
import { key, type Game } from './game'
import { DIRS, OPP, STEP } from './rules'
import type { Dir, P } from './types'

export function autopilot(g: Game): Dir | null {
  const head = g.body[0]
  const blocked = new Set<number>()
  // Koerper ohne Schwanzende (das zieht weiter) und Giftaepfel sind zu
  g.body.slice(0, -1).forEach((p) => blocked.add(key(p.x, p.y)))
  g.gift.forEach((p) => blocked.add(key(p.p.x, p.p.y)))
  const frei = (c: P) => g.inside(c) && !blocked.has(key(c.x, c.y)) && g.gefahr(c, []) === null
  const moves = DIRS.filter((d) => d !== OPP[g.dir]).filter((d) => frei({ x: head.x + STEP[d].x, y: head.y + STEP[d].y }))
  if (!moves.length) return null

  // Breitensuche zum Apfel
  const first = new Map<number, Dir>()
  const queue: P[] = []
  for (const d of moves) {
    const c = { x: head.x + STEP[d].x, y: head.y + STEP[d].y }
    first.set(key(c.x, c.y), d)
    queue.push(c)
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]
    const d0 = first.get(key(c.x, c.y))!
    if (c.x === g.apple.p.x && c.y === g.apple.p.y) {
      // Nur nehmen, wenn danach genug Platz bleibt
      if (platz(g, d0, blocked) > g.body.length) return d0
      break
    }
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
      const k = key(n.x, n.y)
      if (first.has(k) || !frei(n)) continue
      first.set(k, d0)
      queue.push(n)
    }
  }
  // Kein guter Weg: dorthin, wo am meisten Platz ist
  let best = moves[0]
  let bestN = -1
  for (const d of moves) {
    const n = platz(g, d, blocked)
    if (n > bestN) {
      bestN = n
      best = d
    }
  }
  return best
}

function platz(g: Game, d: Dir, blocked: Set<number>) {
  const h = g.body[0]
  const s = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
  const seen = new Set<number>([key(s.x, s.y), key(h.x, h.y)])
  const q = [s]
  for (let i = 0; i < q.length && seen.size < 400; i++) {
    for (const dd of DIRS) {
      const n = { x: q[i].x + STEP[dd].x, y: q[i].y + STEP[dd].y }
      const k = key(n.x, n.y)
      if (seen.has(k) || !g.inside(n) || blocked.has(k) || g.gefahr(n, []) !== null) continue
      seen.add(k)
      q.push(n)
    }
  }
  return seen.size
}
