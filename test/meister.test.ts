import { describe, expect, it } from 'vitest'
import { missionSpiel } from '../src/game/boss'
import { key } from '../src/game/game'
import { KaefigBossGame, MEISTER } from '../src/game/kaefigboss'
import { WIESE_MISSIONEN } from '../src/game/missionen'
import { DIRS, STEP } from '../src/game/rules'
import type { Dir, P } from '../src/game/types'

const m30 = WIESE_MISSIONEN[29]
type Innen = { einsammeln(n: P): void }

/** Kampf ohne Bewegung der Schlange: der Kopf wird von Hand gesetzt, die Kaefigkoepfe sind weg */
function spiel(quer = false) {
  const g = missionSpiel(m30, quer) as KaefigBossGame
  g.kaefige = []
  g.tick = 1e12
  return g
}
const kopfAuf = (g: KaefigBossGame, p: P) => {
  g.body = [{ ...p }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y + 2 }]
  g.prev = g.body.map((b) => ({ ...b }))
}
const lauf = (g: KaefigBossGame, ms: number) => {
  for (let t = 0; t < ms; t += 50) g.update(50)
}
/** Kopf in seinen Raum (weg von ihm und seinen Flammen), bis er erwacht */
function zuIhm(g: KaefigBossGame) {
  const r = g.raeume[g.meister.raum]
  kopfAuf(g, { x: r.x0, y: r.y0 + 1 })
  lauf(g, 200)
}

describe('Kaefigmeister (Mission 30)', () => {
  it('Labyrinth mit sechs Raeumen, die Tuer ist zu, drei Kaefigkoepfe; er erscheint in einem Raum, den man nicht sieht', () => {
    const g = missionSpiel(m30) as KaefigBossGame
    expect(g).toBeInstanceOf(KaefigBossGame)
    expect(g.raeume).toHaveLength(6)
    expect(g.kaefige).toHaveLength(3)
    expect(g.tuer.length).toBeGreaterThan(0)
    expect(g.tuerZu(g.tuer[0])).toBe(true)
    expect(g.aepfel).toHaveLength(0)
    expect(g.meister.leben).toBe(MEISTER.leben)
    // Kein Pfeil: man muss ihn suchen
    expect(g.apple.p.x).toBeLessThan(-100)
    for (const r of g.raeume) for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y1], [r.mitte.x, r.mitte.y]]) expect(g.inside({ x, y }), `Raum ${r.nr}`).toBe(true)
    g.kaefige = []
    g.tick = 1e12
    lauf(g, 1200)
    expect(g.meister.zustand).toBe('wartet')
    expect(g.meister.p).toEqual(g.raeume[g.meister.raum].mitte)
  })

  it('betritt man seinen Raum, erwacht er und es liegen zwei Flammen; jede geholte fliegt auf ihn, fuenf kosten ein Leben', () => {
    const g = spiel()
    lauf(g, 1200)
    zuIhm(g)
    expect(g.meister.zustand).toBe('kampf')
    expect(g.flammen).toHaveLength(MEISTER.aufFeld)
    for (const f of g.flammen) expect(g.imRaum(f.p)).toBe(true)
    const typen: string[] = []
    for (let i = 0; i < MEISTER.flammen; i++) {
      expect(g.flammen.length, `Flamme ${i + 1}`).toBeGreaterThan(0)
      g.meister.next = 1e12
      const f = g.flammen[0].p
      ;(g as unknown as Innen).einsammeln(f)
      lauf(g, MEISTER.flug + 100)
      typen.push(...g.drain().map((e) => (e.type === 'meister' ? e.was : e.type)))
    }
    expect(typen.filter((t) => t === 'flamme')).toHaveLength(5)
    expect(typen.filter((t) => t === 'trifft')).toHaveLength(5)
    expect(typen).toContain('getroffen')
    expect(g.meister.leben).toBe(MEISTER.leben - 1)
    expect(g.meister.zustand).toBe('getroffen')
    expect(g.flammen).toHaveLength(0)
  })

  it('danach erscheint er in einem zufaelligen Raum (auch im selben), aber erst, wenn man den Raum nicht mehr sieht', () => {
    const g = spiel()
    lauf(g, 1200)
    zuIhm(g)
    // Der Kopf bleibt im Raum, er soll dort wieder erscheinen
    const nr = g.meister.raum
    g.meister.treffer = MEISTER.flammen - 1
    g.fluege.push({ von: { ...g.body[0] }, t: g.time })
    lauf(g, MEISTER.flug + 100)
    expect(g.meister.zustand).toBe('getroffen')
    lauf(g, MEISTER.getroffen + 100)
    expect(g.meister.zustand).toBe('weg')
    g.meister.raum = nr
    lauf(g, 2000)
    expect(g.meister.zustand).toBe('weg')
    // Raus aus der Sicht (Start unten): jetzt erscheint er dort
    kopfAuf(g, { x: 25, y: 67 })
    lauf(g, 100)
    expect(g.meister.zustand).toBe('erscheint')
    expect(g.meister.raum).toBe(nr)
    // Die Raeume werden zufaellig gewaehlt: ueber viele Leben kommen verschiedene vor
    const raeume = new Set<number>()
    for (let seed = 0; seed < 30; seed++) {
      const h = spiel()
      h.meister.zustand = 'getroffen'
      h.meister.t = -1e9
      for (let i = 0; i < seed; i++) h.r.next()
      lauf(h, 100)
      raeume.add(h.meister.raum)
    }
    expect(raeume.size).toBeGreaterThan(3)
  })

  it('Angriffe: duenner Strahl (kurz geladen), dicker Dreierstrahl (1,5 s), Runenzauber, Teleport; nur der Kopf zaehlt', () => {
    const g = spiel()
    lauf(g, 1200)
    zuIhm(g)
    const M = g.meister
    M.next = 1e12
    // Freie Linie zu ihm (die Saeulen geben Deckung)
    kopfAuf(g, { x: g.raeume[M.raum].x0, y: M.p.y })
    const h = g.body[0]
    g.starte('duenn')
    expect(M.angriff!.los - M.angriff!.ab).toBe(MEISTER.duennLaden)
    expect(M.angriff!.cells.some((c) => c.x === h.x && c.y === h.y)).toBe(true)
    const duenn = M.angriff!.cells.length
    // Liegt eine Saeule dazwischen, haelt sie den Strahl auf
    const r0 = g.raeume[M.raum]
    const hinter = g.strahl(M.p, Math.atan2(-1, -2), 0)
    expect(hinter.some((c) => c.x === r0.mitte.x - 4 && c.y === r0.mitte.y - 2)).toBe(false)
    g.body = [{ x: r0.x0, y: M.p.y }, { x: r0.x0 + 1, y: M.p.y + 3 }, { x: r0.x0 + 1, y: M.p.y + 4 }]
    lauf(g, MEISTER.duennLaden + MEISTER.duennBrennt + 100)
    expect(g.status).toBe('over')
    g.status = 'play'
    kopfAuf(g, { x: r0.x0, y: M.p.y })
    g.starte('dick')
    expect(M.angriff!.los - M.angriff!.ab).toBe(MEISTER.dickLaden)
    expect(M.angriff!.cells.length).toBeGreaterThan(duenn * 2)
    // Noch geladen: nichts passiert; dann trifft er den Kopf
    lauf(g, MEISTER.dickLaden - 200)
    expect(g.status).toBe('play')
    lauf(g, 400)
    expect(g.status).toBe('over')
    expect(g.cause).toBe('kaefigmeister')

    const a = spiel()
    lauf(a, 1200)
    zuIhm(a)
    a.meister.next = 1e12
    a.starte('aoe')
    expect(a.meister.angriff!.kreise).toHaveLength(3)
    expect(a.meister.angriff!.cells.some((c) => c.x === a.body[0].x && c.y === a.body[0].y)).toBe(true)
    // Der Koerper darf darin liegen, nur der Kopf zaehlt: Kopf weg, Koerper bleibt
    kopfAuf(a, { x: a.raeume[a.meister.raum].x1, y: a.raeume[a.meister.raum].y1 - 2 })
    a.body.push(...a.meister.angriff!.cells.slice(0, 2))
    lauf(a, MEISTER.aoeLaden + MEISTER.aoeBrennt + 100)
    expect(a.status).toBe('play')
    // Teleport: verschwindet und taucht im selben Raum weiter weg vom Kopf wieder auf
    const vorher = { ...a.meister.p }
    a.starte('teleport')
    lauf(a, MEISTER.teleportWeg + 50)
    expect(a.meister.p).not.toEqual(vorher)
    expect(a.imRaum(a.meister.p)).toBe(true)
    const k = a.body[0]
    expect(Math.max(Math.abs(a.meister.p.x - k.x), Math.abs(a.meister.p.y - k.y))).toBeGreaterThanOrEqual(5)
    // Hineinfahren ist vorbei
    lauf(a, MEISTER.teleportDa + 50)
    expect(a.gefahr(a.meister.p)).toBe('kaefigmeister')
  })

  it('drei Leben: besiegt geht die Tuer auf (Pfeil dorthin), hindurch ist die Mission geschafft', () => {
    const g = spiel()
    for (let leben = MEISTER.leben; leben > 0; leben--) {
      kopfAuf(g, { x: 25, y: 67 })
      lauf(g, 1500)
      expect(g.meister.zustand, `Leben ${leben}`).toBe('wartet')
      zuIhm(g)
      expect(g.meister.zustand).toBe('kampf')
      g.meister.next = 1e12
      g.meister.treffer = MEISTER.flammen - 1
      g.fluege.push({ von: { ...g.body[0] }, t: g.time })
      lauf(g, MEISTER.flug + 100)
      if (leben > 1) lauf(g, MEISTER.getroffen + 100)
    }
    expect(g.meister.zustand).toBe('tot')
    expect(g.tuerAuf).toBeGreaterThanOrEqual(0)
    expect(g.tuerZu(g.tuer[0])).toBe(false)
    expect(g.tuer.some((t) => t === g.apple.p)).toBe(true)
    // Unter die Tuer, dann hindurch
    const t = g.tuer[0]
    g.body = [{ x: t.x, y: t.y + 1 }, { x: t.x, y: t.y + 2 }, { x: t.x, y: t.y + 3 }]
    g.prev = g.body.map((b) => ({ ...b }))
    g.dir = 'u'
    g.tick = 120
    for (let i = 0; i < 10 && g.status === 'play'; i++) g.update(130)
    expect(g.cause).toBe('ziel')
  })

  it('Querformat: die Raeume sind mitgedreht', () => {
    const h = spiel()
    const q = spiel(true)
    expect(q.raeume).toHaveLength(6)
    for (const r of q.raeume) {
      expect(r.x1 - r.x0).toBe(8)
      expect(r.y1 - r.y0).toBe(10)
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (!q.inside({ x, y })) expect(key(x, y) > 0).toBe(true)
    }
    expect(h.raeume[0].x1 - h.raeume[0].x0).toBe(10)
  })

  it('ein Bot, der den Angriffen ausweicht, findet ihn dreimal, holt die Flammen und faehrt durch die Tuer', () => {
    for (const [quer, mischen] of [[false, 0], [true, 0], [false, 7], [true, 13], [false, 29]] as const) {
      const g = missionSpiel(m30, quer) as KaefigBossGame
      g.kaefige = []
      // Anderer Zufall: andere Raeume, andere Attacken
      for (let i = 0; i < mischen; i++) g.r.next()
      let schritte = 0
      while (g.status === 'play' && schritte++ < 30000) {
        const d = botSchritt(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
      }
      expect(g.cause, `${quer ? 'quer' : 'hochkant'} ${mischen}`).toBe('ziel')
      expect(g.meister.leben).toBe(0)
    }
  })
})

/** Bot: weicht Strahlen und Runen aus, sucht seinen Raum, holt Flammen, nach dem Sieg zur Tuer */
function botSchritt(g: KaefigBossGame): Dir | null {
  const M = g.meister
  const zu = g.hindernisse()
  for (const f of g.flammen) zu.delete(key(f.p.x, f.p.y))
  // Angekuendigte Felder meiden, kurz bevor es losgeht (vorher noch hindurch)
  const a = M.angriff
  if (a && a.art !== 'teleport' && a.los - g.time < 450 && g.time < a.bis) for (const c of a.cells) zu.add(key(c.x, c.y))
  // Abstand zu ihm halten
  if (g.da) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) zu.add(key(M.p.x + dx, M.p.y + dy))
  for (const b of g.body.slice(0, -1)) zu.add(key(b.x, b.y))
  if (g.tuerAuf >= 0) for (const t of g.tuer) zu.delete(key(t.x, t.y))
  const ziel = new Set<number>()
  if (M.zustand === 'tot') for (const t of g.tuer) ziel.add(key(t.x, t.y))
  else if (M.zustand === 'kampf' && g.flammen.length) for (const f of g.flammen) ziel.add(key(f.p.x, f.p.y))
  else {
    // Er ist noch nicht da oder man ist nicht in seinem Raum: in seinen Raum (ist er weg: in einen anderen)
    const nr = M.zustand === 'weg' || M.zustand === 'getroffen' ? (M.raum + 3) % g.raeume.length : M.raum
    const r = g.raeume[nr]
    for (let y = r.y0 + 1; y < r.y1; y++) for (let x = r.x0 + 1; x < r.x1; x++) if (Math.max(Math.abs(x - M.p.x), Math.abs(y - M.p.y)) >= 3) ziel.add(key(x, y))
  }
  const h = g.body[0]
  const von = new Map<number, Dir | null>([[key(h.x, h.y), null]])
  const q: P[] = [h]
  while (q.length) {
    const c = q.shift()!
    const erst = von.get(key(c.x, c.y))!
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
      const k = key(n.x, n.y)
      if (von.has(k) || !g.inside(n) || zu.has(k)) continue
      if (ziel.has(k)) return erst ?? d
      von.set(k, erst ?? d)
      q.push(n)
    }
  }
  // Kein Weg: dorthin, wo am meisten Platz ist
  let best: Dir | null = null
  let n = -1
  for (const d of DIRS) {
    const c = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
    if (!g.inside(c) || zu.has(key(c.x, c.y))) continue
    const platz = DIRS.filter((e) => g.inside({ x: c.x + STEP[e].x, y: c.y + STEP[e].y }) && !zu.has(key(c.x + STEP[e].x, c.y + STEP[e].y))).length
    if (platz > n) {
      n = platz
      best = d
    }
  }
  return best
}
