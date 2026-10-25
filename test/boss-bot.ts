/** Ein einfacher Spieler fuer den Boss: weicht den roten Flaechen aus, bringt Kristalle, lockt den Golem in den Kreis */
import { BossGame } from '../src/game/boss'
import { key } from '../src/game/game'
import { DIRS, OPP, STEP } from '../src/game/rules'
import type { Dir, P } from '../src/game/types'

/** Felder, auf denen es gleich wehtut */
export function gefahrFelder(g: BossGame): Set<number> {
  const s = new Set<number>()
  const add = (cs: P[]) => cs.forEach((c) => s.add(key(c.x, c.y)))
  const go = g.golem
  const a = go.angriff
  if (a?.art === 'stampfen' && !a.fertig) add(g.kreisFelder(go, a.r + 1))
  if (a?.art === 'ansturm') add(g.streifenFelder(go, a.nach))
  if (a?.art === 'sprung' && !a.wechsel && !a.fertig && g.time >= a.ab) add(g.kreisFelder(a.ziel, a.r + 1.2))
  for (const b of g.brocken) if (!b.fertig) add(g.brockenFelder(b))
  if (go.zustand !== 'gebannt' && !g.fliegt)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s.add(key(Math.round(go.x) + dx, Math.round(go.y) + dy))
  return s
}

export function botZug(g: BossGame): Dir | null {
  const h = g.body[0]
  const gefahr = gefahrFelder(g)
  const koerper = new Set(g.body.slice(0, -1).map((b) => key(b.x, b.y)))
  const go = g.golem
  let ziel: P
  const nah = Math.hypot(go.x - h.x, go.y - h.y)
  const boese = go.zustand !== 'gebannt' && go.zustand !== 'getroffen' && go.zustand !== 'tot' && go.zustand !== 'wechsel' && go.zustand !== 'wartet' && !g.fliegt
  if (!g.imRaum(h)) {
    // Noch im alten Raum (oder im Tor): dem Golem nach, mitten in den neuen Raum
    ziel = { x: g.kreis.p.x, y: g.aktuell.y1 - 4 }
  } else if (boese && nah < 4.5) {
    // Zu nah am Golem: weg von ihm (zur Mitte der anderen Seite)
    const dx = h.x - go.x
    const dy = h.y - go.y
    const l = Math.hypot(dx, dy) || 1
    ziel = { x: Math.max(2, Math.min(14, Math.round(h.x + (dx / l) * 8))), y: Math.max(g.aktuell.y0 + 3, Math.min(g.aktuell.y1 - 3, Math.round(h.y + (dy / l) * 8))) }
  } else if (go.zustand === 'gebannt') ziel = { x: Math.round(go.x), y: Math.round(go.y) }
  else if (g.kreisAktiv) {
    // Auf die andere Seite des Kreises: der Golem stapft hindurch
    const dx = g.kreis.p.x - go.x
    const dy = g.kreis.p.y - go.y
    const l = Math.hypot(dx, dy) || 1
    ziel = { x: Math.round(g.kreis.p.x + (dx / l) * 5), y: Math.round(g.kreis.p.y + (dy / l) * 5) }
  } else if (g.traegt.length) ziel = g.sockel[g.traegt[0]].p
  else if (g.kristalle.length) ziel = [...g.kristalle].sort((a, b) => Math.abs(a.p.x - h.x) + Math.abs(a.p.y - h.y) - Math.abs(b.p.x - h.x) - Math.abs(b.p.y - h.y))[0].p
  else ziel = { x: 8, y: go.y < (g.aktuell.y0 + g.aktuell.y1) / 2 ? g.aktuell.y1 - 5 : g.aktuell.y0 + 5 }
  // Steht der Kopf in einer roten Flaeche: zum naechsten sicheren Feld
  const inGefahr = gefahr.has(key(h.x, h.y)) && go.zustand !== 'gebannt'
  const frei = (c: P, tief: number) => g.inside(c) && !g.torZu(c) && !koerper.has(key(c.x, c.y)) && (inGefahr || tief > 6 || !gefahr.has(key(c.x, c.y)) || (go.zustand === 'gebannt' && Math.abs(c.x - go.x) <= 1.5 && Math.abs(c.y - go.y) <= 1.5))
  // Breitensuche zum Ziel (nicht zurueck in den Hals)
  const start = DIRS.filter((d) => d !== OPP[g.dir])
  const von = new Map<number, Dir>()
  const q: { p: P; t: number }[] = []
  for (const d of start) {
    const n = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
    if (!frei(n, 1)) continue
    von.set(key(n.x, n.y), d)
    q.push({ p: n, t: 1 })
  }
  let best: Dir | null = null
  let bestD = Infinity
  for (let i = 0; i < q.length; i++) {
    const { p, t } = q[i]
    const d = inGefahr ? (gefahr.has(key(p.x, p.y)) ? 1000 + t : t - 1000) : Math.abs(p.x - ziel.x) + Math.abs(p.y - ziel.y)
    if (d < bestD) {
      bestD = d
      best = von.get(key(p.x, p.y))!
      if (d === 0 || (inGefahr && d < 0)) break
    }
    for (const dd of DIRS) {
      const n = { x: p.x + STEP[dd].x, y: p.y + STEP[dd].y }
      const k = key(n.x, n.y)
      if (von.has(k) || !frei(n, t + 1)) continue
      von.set(k, von.get(key(p.x, p.y))!)
      q.push({ p: n, t: t + 1 })
    }
  }
  if (best) return best
  // Kein sicherer Weg: dorthin, wo am meisten Platz ist (nicht in die Wand, nicht in sich selbst)
  const platz = (p: P) => {
    const seen = new Set([key(p.x, p.y)])
    const q = [p]
    for (let i = 0; i < q.length && seen.size < 60; i++)
      for (const d of DIRS) {
        const n = { x: q[i].x + STEP[d].x, y: q[i].y + STEP[d].y }
        const k = key(n.x, n.y)
        if (seen.has(k) || !g.inside(n) || g.torZu(n) || koerper.has(k)) continue
        seen.add(k)
        q.push(n)
      }
    return seen.size
  }
  let wahl: Dir | null = null
  let meist = 0
  for (const d of start) {
    const n = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
    if (!g.inside(n) || g.torZu(n) || koerper.has(key(n.x, n.y))) continue
    const m = platz(n)
    if (m > meist) {
      meist = m
      wahl = d
    }
  }
  return wahl
}
