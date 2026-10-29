import { describe, expect, it } from 'vitest'
import { key } from '../src/game/game'
import { BAUM_NAH, KAEFIG, LAVA_TAKT, LICHT_TAKT, MissionGame, querKarte, TURM_TAKT } from '../src/game/mission'
import { MISSION_BLOCK, MISSION_LOHN, missionSkinVorgemerkt, spielbar, WIESE_MISSIONEN } from '../src/game/missionen'
import { DIRS, STEP } from '../src/game/rules'
import type { Dir, Kaefig, P } from '../src/game/types'

const m1 = WIESE_MISSIONEN[0]
/** Alle gebauten Missionen (Mission 30 ist vorgemerkt) */
const GEBAUT = WIESE_MISSIONEN.filter(spielbar)

/** Naechster Schritt auf kuerzestem Weg zum naechsten Apfel (Hindernisse, Gift, Eis, Licht, Lichtkegel, Wolken und der
 *  eigene Koerper gesperrt) */
function weg(g: MissionGame): Dir | null {
  return zumApfel(g) ?? ausweichen(g)
}

/** Gefaehrliche Felder fuer den Kopf (fuer den Test-Bot) */
function sperren(g: MissionGame) {
  const zu = g.hindernisse()
  for (const a of [...g.aepfel, ...g.siegel]) zu.delete(key(a.p.x, a.p.y))
  for (const gf of g.gift) zu.add(key(gf.p.x, gf.p.y))
  for (const e of g.eis) for (const c of e.cells) zu.add(key(c.x, c.y))
  for (const h of g.haeuser) for (const c of h.strahl) zu.add(key(c.x, c.y))
  for (const t of g.tuerme) for (const c of t.kegel) zu.add(key(c.x, c.y))
  for (const v of g.turmVorschau) for (const c of v ?? []) zu.add(key(c.x, c.y))
  for (const w of g.wolken) for (const c of [...w.cells, ...w.pending]) zu.add(key(c.x, c.y))
  for (const b of g.body.slice(0, -1)) zu.add(key(b.x, b.y))
  return zu
}

/** Kein Weg frei (Licht oder Kegel im Weg): in die Richtung mit dem meisten Platz, bis es wieder geht */
function ausweichen(g: MissionGame): Dir | null {
  const zu = sperren(g)
  const h = g.body[0]
  let best: Dir | null = null
  let bestN = -1
  for (const d of DIRS) {
    const n = { x: h.x + STEP[d].x, y: h.y + STEP[d].y }
    if (!g.inside(n) || zu.has(key(n.x, n.y))) continue
    const seen = new Set([key(n.x, n.y)])
    const q = [n]
    for (let i = 0; i < q.length && seen.size < 60; i++)
      for (const e of DIRS) {
        const m = { x: q[i].x + STEP[e].x, y: q[i].y + STEP[e].y }
        const k = key(m.x, m.y)
        if (seen.has(k) || !g.inside(m) || zu.has(k)) continue
        seen.add(k)
        q.push(m)
      }
    const wert = seen.size + (d === g.dir ? 0.5 : 0)
    if (wert > bestN) {
      bestN = wert
      best = d
    }
  }
  return best
}

function zumApfel(g: MissionGame): Dir | null {
  const zu = sperren(g)
  const offen = g.tuerAuf >= 0 ? g.tuer : []
  const ziel = new Set([...g.aepfel, ...g.siegel].map((a) => a.p).concat(offen).map((p) => key(p.x, p.y)))
  const h = g.body[0]
  const von = new Map<number, { p: P; erst: Dir | null }>([[key(h.x, h.y), { p: h, erst: null }]])
  const schlange: P[] = [h]
  while (schlange.length) {
    const c = schlange.shift()!
    const info = von.get(key(c.x, c.y))!
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
      const k = key(n.x, n.y)
      if (von.has(k) || !g.inside(n) || zu.has(k)) continue
      const erst = info.erst ?? d
      if (ziel.has(k)) return erst
      von.set(k, { p: n, erst })
      schlange.push(n)
    }
  }
  return null
}

/** Was sich bewegt oder spaeter kommt (Tiere, Golems, Gegner, Wolken), raus: so laeuft der Test sicher durch */
function ruhig(g: MissionGame) {
  g.froesche = []
  g.gegner = []
  g.ameisen = []
  g.minigolems = []
  // Mini-Ents bleiben stehen (sie sind Hindernisse), werfen und packen aber nicht
  for (const e of g.minients) {
    e.wurfNext = Infinity
    e.griffPause = Infinity
  }
  g.stoecke = []
  g.wesen = []
  g.quellen = []
  g.kaefige = []
}

/** Schlange (3 lang, senkrecht) auf freie Felder der Karte in der Naehe von p legen */
function legeSchlange(g: MissionGame, p: P, min = 0, max = 5) {
  const zu = g.hindernisse()
  for (let r = min; r <= max; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const body = [0, 1, 2].map((i) => ({ x: p.x + dx, y: p.y + dy + i }))
        if (!body.every((b) => g.inside(b) && !zu.has(key(b.x, b.y)))) continue
        g.body = body
        g.prev = body.map((b) => ({ ...b }))
        g.dir = 'u'
        return body[0]
      }
  throw new Error('kein Platz')
}

describe('Kampagne', () => {
  it('Wiese: 30 Missionen, 5, 15 und 25 Schatz, 10, 20 und 30 Boss, alle spielbar, Belohnung steigt, Skins bei 10, 15 und 20', () => {
    expect(WIESE_MISSIONEN).toHaveLength(30)
    expect(WIESE_MISSIONEN.filter((m) => m.art === 'schatz').map((m) => m.nr)).toEqual([5, 15, 25])
    expect(WIESE_MISSIONEN.filter((m) => m.art === 'boss').map((m) => m.nr)).toEqual([10, 20, 30])
    // Der Boss der Dungeons: der Kaefigmeister
    expect(WIESE_MISSIONEN[29].dungeonBoss).toBe(true)
    expect(WIESE_MISSIONEN[29].name).toBe('Der Käfigmeister')
    expect(WIESE_MISSIONEN[9].boss).toBe('golem')
    expect(WIESE_MISSIONEN[19].boss).toBe('ent')
    expect(WIESE_MISSIONEN[19].name).toBe('Der Ent')
    expect(WIESE_MISSIONEN[18].name).toBe('Dunkler Forst')
    // Der Ent ist neu (frueher war Mission 20 das Golem-Heer): eigene Id, damit er fuer alle wieder offen ist
    expect(WIESE_MISSIONEN[19].id).toBe('wiese-20-ent')
    expect(new Set(WIESE_MISSIONEN.map((m) => m.id)).size).toBe(30)
    expect(GEBAUT.map((m) => m.nr)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
    for (let i = 1; i < MISSION_LOHN.length; i++) if (WIESE_MISSIONEN[i].art === 'normal') expect(MISSION_LOHN[i]).toBeGreaterThan(MISSION_LOHN[i - 1] - 25)
    expect(WIESE_MISSIONEN.map((m) => m.lohn)).toEqual(MISSION_LOHN)
    expect(WIESE_MISSIONEN[0].lohn).toBe(6)
    // Der Golem bringt den Steingolem, die Schatzhoehle (15) den Schatzhueter, der Ent (20) den Waldgeist
    expect(WIESE_MISSIONEN.filter((m) => m.skin).map((m) => m.nr)).toEqual([10, 15, 20])
    expect(WIESE_MISSIONEN[14].skin).toBe('schatzhueter')
    expect(WIESE_MISSIONEN[19].skin).toBe('waldgeist')
    expect(missionSkinVorgemerkt('schatzhueter')).toBe(false)
    expect(missionSkinVorgemerkt('steingolem')).toBe(false)
    expect(missionSkinVorgemerkt('waldgeist')).toBe(false)
  })

  it('jede Mission bringt eine neue Sache (nacheinander), keine Gegner-Schlangen, nur ein Leuchtturm (Mission 18)', () => {
    const g = GEBAUT.map((m) => new MissionGame(m))
    expect(g.slice(0, 9).map((x) => x.gift.length)).toEqual([2, 2, 2, 3, 2, 8, 2, 3, 5])
    // Ab welcher Mission gibt es was zum ersten Mal?
    const erst = (hat: (x: MissionGame) => boolean) => g.findIndex(hat) + 1
    expect(erst((x) => x.baeume.some((b) => !b.gross))).toBe(5)
    expect(erst((x) => x.minigolems.length > 0)).toBe(6)
    expect(erst((x) => x.eis.length > 0)).toBe(7)
    expect(erst((x) => x.haeuser.length > 0)).toBe(8)
    expect(erst((x) => x.ameisen.length > 0)).toBe(9)
    expect(erst((x) => x.wesen.some((w) => w.art === 'igel'))).toBe(11)
    expect(erst((x) => x.quellen.length > 0)).toBe(12)
    expect(erst((x) => x.lava.length > 0)).toBe(13)
    expect(erst((x) => x.baeume.some((b) => b.gross))).toBe(13)
    expect(erst((x) => x.minients.length > 0)).toBe(16)
    expect(erst((x) => x.stoecke.length > 0)).toBe(17)
    // Ab 21 Dungeons, ab 22 Kaefigkoepfe, Siegel und die grosse Tuer nur in 27
    expect(erst((x) => x.dungeonSet.size > 0)).toBe(21)
    expect(erst((x) => x.kaefige.length > 0)).toBe(26)
    // Kaefigkoepfe kuendigen den Kaefigmeister an wie die Golems und Mini-Ents: 26 bis 29 je 1, 1, 2, 3
    expect(g.slice(25, 29).map((x) => x.kaefige.length)).toEqual([1, 1, 2, 3])
    expect(g.map((x) => x.siegel.length)).toEqual(g.map((_, i) => (i === 26 ? 3 : 0)))
    expect(g.map((x) => x.tuer.length > 0)).toEqual(g.map((_, i) => i === 26 || i === 29))
    // Keine Gegner-Schlangen, ein einziger Leuchtturm in Mission 18
    for (const x of g) expect(x.gegner, x.mission.id).toHaveLength(0)
    expect(g.map((x) => x.tuerme.length)).toEqual(g.map((_, i) => (i === 17 ? 1 : 0)))
    for (const x of g.slice(0, 4)) expect(x.ameisen.length + x.baeume.length + x.haeuser.length, x.mission.id).toBe(0)
    // Kleine Golems langsam ab Mission 6 (1, 1, 2, 3), im Boss-Level ein paar, danach keine mehr
    expect(g.slice(5, 9).map((x) => x.minigolems.length)).toEqual([1, 1, 2, 3])
    expect(g[9].minigolems.length).toBe(3)
    for (const x of [...g.slice(0, 5), ...g.slice(10)]) expect(x.minigolems, x.mission.id).toHaveLength(0)
    // Mini-Ents kuendigen den Ent an: ab Mission 16 (1, 2, 2, 3), im Boss-Level zwei
    expect(g.slice(15, 19).map((x) => x.minients.length)).toEqual([1, 2, 2, 3])
    expect(g[19].minients.length).toBe(2)
    for (const x of g.slice(0, 15)) expect(x.minients, x.mission.id).toHaveLength(0)
    for (const x of g.slice(10)) expect(x.aktiveFroesche.length, x.mission.id).toBeLessThanOrEqual(2)
    // Lava, Giftwolken und grosse Tannen erst ab 11
    for (const x of g.slice(0, 10)) expect(x.lava.length + x.quellen.length + x.baeume.filter((b) => b.gross).length, x.mission.id).toBe(0)
    expect(g.slice(10).some((x) => x.lava.length)).toBe(true)
    expect(g.slice(10).some((x) => x.quellen.length)).toBe(true)
    expect(g.slice(10).some((x) => x.baeume.some((b) => b.gross))).toBe(true)
  })

  it('jede Karte: gleich breite Zeilen, ganze Bloecke, Berg rundherum', () => {
    for (const m of GEBAUT) {
      const k = m.karte!
      const g = new MissionGame(m)
      for (const z of k) expect(z.length, m.id).toBe(k[0].length)
      expect(k[0].length % g.bw, m.id).toBe(0)
      expect(k.length % g.bh, m.id).toBe(0)
      expect(g.w).toBe(k[0].length)
      expect(g.h).toBe(k.length)
      for (let x = 0; x < g.w; x++) expect(g.inside({ x, y: 0 }) || g.inside({ x, y: g.h - 1 }), m.id).toBe(false)
      for (let y = 0; y < g.h; y++) expect(g.inside({ x: 0, y }) || g.inside({ x: g.w - 1, y }), m.id).toBe(false)
      for (const b of g.body) expect(g.inside(b), m.id).toBe(true)
    }
  })

  it('Karten fair: kein Apfel im Fensterlicht, Ameisen und Giftquellen mit Abstand zu Aepfeln, ab 11 keine Sackgassen', () => {
    const cheb = (p: P, q: P) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))
    for (const m of GEBAUT) {
      const g = new MissionGame(m)
      const aepfel = [...g.aepfel, ...g.siegel].map((a) => a.p)
      for (const a of aepfel) {
        for (const h of g.haeuser) for (const c of h.cells) expect(cheb(a, c), m.id).toBeGreaterThan(2)
        for (const am of g.ameisen) expect(cheb(a, am.p), m.id).toBeGreaterThan(2)
        // Kein Apfel direkt neben einem Mini-Ent (sonst packt er beim Essen fast sicher zu)
        for (const e of g.minients) expect(cheb(a, e.p), m.id).toBeGreaterThan(2)
      }
      // Mini-Ents stehen frei (rundherum Wiese), nie in einer Gasse
      for (const e of g.minients) for (const d of DIRS) expect(g.inside({ x: e.p.x + STEP[d].x, y: e.p.y + STEP[d].y }), `${m.id} Mini-Ent`).toBe(true)
      for (const q of g.quellen) for (const p of [...aepfel, ...g.gift.map((x) => x.p), ...g.funde.map((f) => f.p)]) expect(cheb(q.p, p), m.id).toBeGreaterThan(2)
      if (m.nr < 11) continue
      // Sackgasse: ein freies Feld mit hoechstens einem freien Nachbarn (darin kommt man nicht mehr heraus)
      const zu = g.hindernisse()
      for (const a of [...g.aepfel, ...g.siegel]) zu.delete(key(a.p.x, a.p.y))
      for (const x of [...g.ameisen, ...g.minigolems, ...g.froesche, ...g.wesen, ...g.kaefige]) zu.delete(key(x.p.x, x.p.y))
      for (const e of g.gegner) for (const b of e.body) zu.delete(key(b.x, b.y))
      const frei = (x: number, y: number) => g.inside({ x, y }) && !zu.has(key(x, y))
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++)
          if (frei(x, y)) expect(DIRS.filter((d) => frei(x + STEP[d].x, y + STEP[d].y)).length, `${m.id} ${x},${y}`).toBeGreaterThan(1)
    }
  })

  it('Missionen 1 bis 7: keine Gasse schmaler als 3 Felder (erst ab 8 wird es eng; Golems laufen, zaehlen nicht)', () => {
    for (const m of WIESE_MISSIONEN.slice(0, 7)) {
      const g = new MissionGame(m)
      const zu = g.hindernisse()
      // Aepfel, Froesche, Ameisen und Gegner bleiben nicht, wo sie sind: zaehlen nicht als Wand
      for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
      for (const f of g.froesche) zu.delete(key(f.p.x, f.p.y))
      for (const a of g.ameisen) zu.delete(key(a.p.x, a.p.y))
      for (const mg of g.minigolems) zu.delete(key(mg.p.x, mg.p.y))
      for (const e of g.gegner) for (const b of e.body) zu.delete(key(b.x, b.y))
      const frei = (x: number, y: number) => g.inside({ x, y }) && !zu.has(key(x, y))
      // Ein Pass ist eng, wenn man waagrecht und senkrecht nur 1 oder 2 Felder Platz hat und beidseits weiterkommt
      let eng = 0
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          if (!frei(x, y)) continue
          const quer = (frei(x - 1, y) ? 1 : 0) + (frei(x + 1, y) ? 1 : 0)
          const laengs = (frei(x, y - 1) ? 1 : 0) + (frei(x, y + 1) ? 1 : 0)
          if (quer === 0 && laengs === 2) eng++
          if (laengs === 0 && quer === 2) eng++
        }
      expect(eng, m.id).toBe(0)
    }
  })

  it('Mission 1: Karte aus ganzen Bloecken, Start auf der Wiese, alles an seinem Platz', () => {
    const g = new MissionGame(m1)
    expect(g.bw).toBe(MISSION_BLOCK.w)
    expect(g.bh).toBe(MISSION_BLOCK.h)
    expect(g.w).toBe(26)
    expect(g.h).toBe(48)
    expect(g.body).toHaveLength(3)
    for (const b of g.body) expect(g.inside(b)).toBe(true)
    expect(g.dir).toBe('u')
    expect(g.ziel).toBe(10)
    expect(g.aepfel).toHaveLength(10)
    expect(g.gift).toHaveLength(2)
    expect(g.froesche).toHaveLength(5)
    expect(g.teiche).toHaveLength(3)
    expect(g.mauern).toHaveLength(3)
    expect(g.powers).toHaveLength(0)
    // Berge gehoeren nicht zur Karte
    expect(g.inside({ x: 0, y: 0 })).toBe(false)
    expect(g.aepfel.some((a) => a === g.apple)).toBe(true)
  })

  it('Mission 1 ist immer gleich', () => {
    const bild = (g: MissionGame) => JSON.stringify({ a: g.aepfel.map((a) => a.p), b: g.body, f: g.froesche.map((f) => [f.p, f.dir]), m: g.mauern.map((m) => m.cells), t: g.teiche.map((t) => t.cells) })
    expect(bild(new MissionGame(m1))).toBe(bild(new MissionGame(m1)))
  })

  it('jedes Wiesenfeld und jeder Apfel ist vom Start aus erreichbar', () => {
    const g = new MissionGame(m1)
    const zu = g.hindernisse()
    for (const a of g.aepfel) zu.delete(key(a.p.x, a.p.y))
    for (const f of g.froesche) zu.delete(key(f.p.x, f.p.y))
    const seen = new Set([key(g.body[0].x, g.body[0].y)])
    const q: P[] = [g.body[0]]
    while (q.length) {
      const c = q.shift()!
      for (const d of DIRS) {
        const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
        const k = key(n.x, n.y)
        if (seen.has(k) || !g.inside(n) || zu.has(k)) continue
        seen.add(k)
        q.push(n)
      }
    }
    for (const a of g.aepfel) expect(seen.has(key(a.p.x, a.p.y))).toBe(true)
    let frei = 0
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.inside({ x, y }) && !zu.has(key(x, y))) frei++
    expect(seen.size).toBe(frei)
  })

  it('alle 10 Aepfel geholt = geschafft, dabei kommt nichts dazu', () => {
    const g = new MissionGame(m1)
    // Ohne Froesche (die huepfen nach Zufall), damit der Test sicher durchlaeuft
    g.froesche = []
    let schritte = 0
    while (g.status === 'play' && schritte++ < 4000) {
      const d = weg(g)
      if (d && !g.queue.length) g.turn(d, false)
      g.update(g.tick)
      expect(g.mauern).toHaveLength(3)
      expect(g.powers).toHaveLength(0)
    }
    expect(g.cause).toBe('ziel')
    expect(g.gegessen).toBe(10)
    expect(g.aepfel).toHaveLength(0)
  })

  it('Missionen 2 bis 9, 11 bis 19 und 21 bis 29 lassen sich schaffen (ohne Tiere, Golems, Kaefigkoepfe, Gegner und Wolken, Mini-Ents ruhig)', () => {
    for (const m of [...WIESE_MISSIONEN.slice(1, 9), ...WIESE_MISSIONEN.slice(10, 19), ...WIESE_MISSIONEN.slice(20, 29)]) {
      const g = new MissionGame(m)
      ruhig(g)
      let schritte = 0
      while (g.status === 'play' && schritte++ < 20000) {
        const d = weg(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
      }
      expect(g.cause, m.id).toBe('ziel')
      expect(g.gegessen, m.id).toBe(g.ziel)
    }
  })

  it('Dungeon: jedes freie Feld und jedes Ziel ab Mission 21 ist vom Start aus erreichbar', () => {
    for (const m of WIESE_MISSIONEN.slice(20, 29)) {
      const g = new MissionGame(m)
      const zu = g.hindernisse()
      for (const a of [...g.aepfel, ...g.siegel]) zu.delete(key(a.p.x, a.p.y))
      for (const x of [...g.ameisen, ...g.froesche, ...g.wesen, ...g.kaefige]) zu.delete(key(x.p.x, x.p.y))
      for (const t of g.tuer) zu.delete(key(t.x, t.y))
      const seen = new Set([key(g.body[0].x, g.body[0].y)])
      const q: P[] = [g.body[0]]
      while (q.length) {
        const c = q.shift()!
        for (const d of DIRS) {
          const n = { x: c.x + STEP[d].x, y: c.y + STEP[d].y }
          const k = key(n.x, n.y)
          if (seen.has(k) || !g.inside(n) || zu.has(k)) continue
          seen.add(k)
          q.push(n)
        }
      }
      for (const a of [...g.aepfel, ...g.siegel]) expect(seen.has(key(a.p.x, a.p.y)), m.id).toBe(true)
      for (const t of g.tuer) expect(seen.has(key(t.x, t.y)), m.id).toBe(true)
      // Wenig Aepfel ab 21, im Dungeon (28, 29) hoechstens drei
      expect(g.aepfel.length, m.id).toBeLessThanOrEqual(8)
      if (m.nr >= 28) expect(g.aepfel.length, m.id).toBeLessThanOrEqual(3)
    }
  })

  it('ab Mission 21: Gaenge mindestens 3 breit (nur der Schleichweg in Mission 24 ist 2 breit)', () => {
    for (const m of GEBAUT.slice(20)) {
      const z = m.karte!
      const baum = new Set<number>()
      z.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          if (r[x] === 'Y') for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) baum.add(key(x + dx, y + dy))
          if (r[x] === 'Z') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) baum.add(key(x + dx, y + dy))
        }
      })
      const wand = (x: number, y: number) => !z[y]?.[x] || '#W~HLDJbX'.includes(z[y][x]) || baum.has(key(x, y))
      let eng = 0
      for (let y = 0; y < z.length; y++)
        for (let x = 0; x < z[0].length; x++) {
          if (wand(x, y)) continue
          const lauf = (dx: number, dy: number) => {
            let n = 0
            while (!wand(x + dx * (n + 1), y + dy * (n + 1))) n++
            return n
          }
          if (Math.min(lauf(-1, 0) + lauf(1, 0), lauf(0, -1) + lauf(0, 1)) + 1 <= 2) eng++
        }
      // Der Schleichweg in Mission 24: 2 breit, 17 Felder lang
      expect(eng, m.id).toBeLessThanOrEqual(m.nr === 24 ? 40 : 0)
    }
  })

  it('Mission 28 bis 30 sind ganz Dungeon, die Wiese davor hat Wald und Dungeon gemischt', () => {
    for (const m of WIESE_MISSIONEN.slice(20, 30)) {
      const g = new MissionGame(m)
      let frei = 0
      let kerker = 0
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          if (!g.inside({ x, y })) continue
          frei++
          if (g.dungeonSet.has(key(x, y))) kerker++
        }
      if (m.nr >= 28) expect(kerker, m.id).toBe(frei)
      else expect(kerker, m.id).toBeLessThan(frei)
      expect(kerker, m.id).toBeGreaterThan(0)
    }
  })

  it('Mission 27: drei Siegel statt Aepfeln, dann geht die grosse Tuer auf (orange), hindurch = geschafft', () => {
    const m = WIESE_MISSIONEN[26]
    const g = new MissionGame(m)
    expect(g.aepfel).toHaveLength(0)
    expect(g.siegel).toHaveLength(3)
    expect(g.ziel).toBe(3)
    // Die Tuer ist zu: wie Wand
    const t = g.tuer[0]
    expect(g.tuerZu(t)).toBe(true)
    expect(g.gefahr(t)).toBe('dungeontuer')
    ruhig(g)
    let schritte = 0
    const typen: string[] = []
    while (g.status === 'play' && schritte++ < 20000) {
      const d = weg(g)
      if (d && !g.queue.length) g.turn(d, false)
      g.update(g.tick)
      typen.push(...g.drain().map((e) => e.type))
    }
    expect(g.cause).toBe('ziel')
    expect(g.siegel).toHaveLength(0)
    expect(typen.filter((x) => x === 'siegel')).toHaveLength(3)
    expect(typen).toContain('tuerAuf')
    expect(g.tuerAuf).toBeGreaterThanOrEqual(0)
    expect(g.tuerZu(t)).toBe(false)
  })

  it('Kaefigkopf: schlendert geradeaus, biegt an der Wand ab und geht nach 2 bis 4 Feldern wieder von ihr weg', () => {
    const g = new MissionGame(WIESE_MISSIONEN[27])
    ruhig(g)
    const z: Kaefig = { p: { x: 6, y: 50 }, from: { x: 6, y: 50 }, dir: 'l', altDir: 'l', drehT: 0, t: 0, schrittT: 0, next: 0, jagt: -1, wandRest: 0, wandWeg: null, angriff: null, strahl: [], strahlT: -1e9, ruheBis: 0 }
    g.kaefige = [z]
    // Die Eingangshalle der Mission 28 reicht links bis x = 3: dort ist Wand
    const wege: Dir[] = []
    let vorher = { ...z.p }
    for (let i = 0; i < 400 && wege.length < 12; i++) {
      g.time += 100
      ;(g as unknown as { kaefigTakt(): void }).kaefigTakt()
      if (z.p.x !== vorher.x || z.p.y !== vorher.y) {
        wege.push(z.dir)
        vorher = { ...z.p }
      }
    }
    // Erst geradeaus nach links bis zur Wand, dann an ihr entlang (oben oder unten), dann wieder weg von ihr (rechts)
    expect(wege.slice(0, 3)).toEqual(['l', 'l', 'l'])
    const quer = wege.findIndex((d) => d === 'u' || d === 'd')
    expect(quer).toBe(3)
    const zurueck = wege.findIndex((d, i) => i > quer && d === 'r')
    expect(zurueck - quer).toBeGreaterThanOrEqual(2)
    expect(zurueck - quer).toBeLessThanOrEqual(4)
  })

  it('Kaefigkopf: sieht den Kopf nach vorn, bleibt stehen, holt aus und schiesst in einer der acht Richtungen (Kopf getroffen = vorbei)', () => {
    const neu = (kopf: P) => {
      const g = new MissionGame(WIESE_MISSIONEN[27])
      ruhig(g)
      const z: Kaefig = { p: { x: 6, y: 50 }, from: { x: 6, y: 50 }, dir: 'r', altDir: 'r', drehT: 0, t: 0, schrittT: 0, next: 1e12, jagt: -1, wandRest: 0, wandWeg: null, angriff: null, strahl: [], strahlT: -1e9, ruheBis: 0 }
      g.kaefige = [z]
      g.body = [kopf, { x: kopf.x, y: kopf.y + 1 }, { x: kopf.x, y: kopf.y + 2 }]
      g.prev = g.body.map((p) => ({ ...p }))
      const takt = () => {
        g.time += 50
        ;(g as unknown as { kaefigTakt(): void }).kaefigTakt()
      }
      return { g, z, takt }
    }
    // Hinter ihm sieht er nichts
    const hinten = neu({ x: 3, y: 50 })
    hinten.takt()
    expect(hinten.z.jagt).toBe(-1)
    // Geradeaus vor ihm: entdeckt, holt aus (rot angekuendigt), der Strahl trifft den Kopf
    const { g, z, takt } = neu({ x: 10, y: 50 })
    takt()
    expect(z.jagt).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 12 && !z.angriff; i++) takt()
    expect(z.angriff).not.toBeNull()
    expect(z.angriff!.d).toEqual({ x: 1, y: 0 })
    expect(z.angriff!.cells.some((c) => c.x === 10 && c.y === 50)).toBe(true)
    expect(z.angriff!.los - z.angriff!.ab).toBe(KAEFIG.laden)
    // Er bleibt dabei stehen
    expect(z.p).toEqual({ x: 6, y: 50 })
    for (let i = 0; i < 20 && g.status === 'play'; i++) takt()
    expect(g.status).toBe('over')
    expect(g.cause).toBe('kaefigstrahl')
    // Liegt der Kopf nicht genau auf einer Linie der Dame, zielt er in die naechste (hier schraeg) und kann vorbeischiessen
    const s = neu({ x: 10, y: 48 })
    s.takt()
    for (let i = 0; i < 12 && !s.z.angriff; i++) s.takt()
    expect(s.z.angriff!.d).toEqual({ x: 1, y: -1 })
    for (let i = 0; i < 20; i++) s.takt()
    expect(s.g.status).toBe('play')
    // Hineinfahren ist auch vorbei
    expect(g.gefahr({ x: 6, y: 50 })).toBe('kaefig')
  })

  it('Schatz-Level: Edelsteine liegen da und zaehlen fuer die Belohnung', () => {
    expect(new MissionGame(WIESE_MISSIONEN[14]).funde).toHaveLength(8)
    const g = new MissionGame(WIESE_MISSIONEN[4])
    expect(g.funde).toHaveLength(7)
    const f = g.funde[0]
    g.body = [{ x: f.p.x, y: f.p.y + 1 }, { x: f.p.x, y: f.p.y + 2 }, { x: f.p.x, y: f.p.y + 3 }]
    g.prev = g.body.map((p) => ({ ...p }))
    g.dir = 'u'
    for (let i = 0; i < 3; i++) g.update(60)
    expect(g.funde).toHaveLength(6)
    expect(g.schatz).toBeGreaterThan(0)
  })

  it('Missionen 7 und 9 haben Eis, spaete Missionen werden je Apfel schneller', () => {
    expect(new MissionGame(WIESE_MISSIONEN[6]).eis.length).toBeGreaterThan(0)
    expect(new MissionGame(WIESE_MISSIONEN[8]).eis.length).toBeGreaterThan(0)
    expect(new MissionGame(WIESE_MISSIONEN[8]).cfg.tempoProLevel).toBeGreaterThan(new MissionGame(WIESE_MISSIONEN[0]).cfg.tempoProLevel)
  })

  it('der letzte Apfel ist der einzige, der noch liegt', () => {
    const g = new MissionGame(m1)
    g.aepfel = g.aepfel.slice(0, 1)
    g.neuerApfel()
    expect(g.uebrig).toBe(1)
    expect(g.apple).toBe(g.aepfel[0])
  })

  it('Froesche huepfen nicht in die Berge', () => {
    const g = new MissionGame(m1)
    g.body = [{ x: 12, y: 43 }, { x: 12, y: 44 }, { x: 12, y: 45 }]
    for (let i = 0; i < 4000; i++) {
      g.time += 50
      ;(g as unknown as { froschTakt(): void }).froschTakt()
    }
    expect(g.froesche.filter((f) => f.gone === undefined)).toHaveLength(5)
    for (const f of g.froesche) expect(g.inside(f.p)).toBe(true)
  })

  it('Querformat (PC): die Karte ist um 90 Grad gedreht, unten wird links, man startet nach rechts', () => {
    expect(querKarte(['ab', 'cd', 'ef'])).toEqual(['eca', 'fdb'])
    for (const m of GEBAUT) {
      const h = new MissionGame(m)
      const q = new MissionGame(m, true)
      // Feld (x, y) hochkant liegt quer bei (h - 1 - y, x)
      const dreh = (p: P) => ({ x: h.h - 1 - p.y, y: p.x })
      // Gelesen wird zeilenweise: die Reihenfolge aendert sich, die Felder nicht
      const menge = (ps: P[]) => ps.map((p) => key(p.x, p.y)).sort((a, b) => a - b)
      expect(q.quer, m.id).toBe(true)
      expect([q.w, q.h], m.id).toEqual([h.h, h.w])
      // Breites Bild: ein Block ist so gross wie hochkant, nur gedreht, die Karte bleibt aus ganzen Bloecken
      expect(q.screenW, m.id).toBeGreaterThan(q.screenH)
      expect([q.bw, q.bh], m.id).toEqual([h.bh, h.bw])
      expect(q.w % q.bw, m.id).toBe(0)
      expect(q.h % q.bh, m.id).toBe(0)
      expect(q.blocks.length, m.id).toBe(h.blocks.length)
      for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) expect(q.inside(dreh({ x, y })), m.id).toBe(h.inside({ x, y }))
      expect(q.body, m.id).toEqual(h.body.map(dreh))
      expect(q.dir, m.id).toBe('r')
      expect(menge(q.aepfel.map((a) => a.p)), m.id).toEqual(menge(h.aepfel.map((a) => dreh(a.p))))
      expect(q.ziel, m.id).toBe(h.ziel)
      expect(menge(q.gift.map((g) => g.p)), m.id).toEqual(menge(h.gift.map((g) => dreh(g.p))))
      expect(menge(q.funde.map((f) => f.p)), m.id).toEqual(menge(h.funde.map((f) => dreh(f.p))))
      expect(q.gegner.length, m.id).toBe(h.gegner.length)
    }
  })

  it('Querformat: Missionen 1 bis 9, 11 bis 19 und 21 bis 29 lassen sich genauso schaffen (ohne Tiere, Golems, Kaefigkoepfe, Gegner und Wolken, Mini-Ents ruhig)', () => {
    for (const m of [...WIESE_MISSIONEN.slice(0, 9), ...WIESE_MISSIONEN.slice(10, 19), ...WIESE_MISSIONEN.slice(20, 29)]) {
      const g = new MissionGame(m, true)
      ruhig(g)
      let schritte = 0
      while (g.status === 'play' && schritte++ < 20000) {
        const d = weg(g)
        if (d && !g.queue.length) g.turn(d, false)
        g.update(g.tick)
      }
      expect(g.cause, m.id).toBe('ziel')
      expect(g.gegessen, m.id).toBe(g.ziel)
    }
  })

  it('ab Mission 5: Baeume warten, bis der Kopf nah ist, und kippen dann nach 1 bis 8 Sekunden (nie auf die Schlange)', () => {
    const g = new MissionGame(WIESE_MISSIONEN[4])
    ruhig(g)
    g.tick = 1e12
    const b = g.baeume[0]
    expect(b.wartet).toBe(true)
    for (let i = 0; i < 100; i++) g.update(50)
    expect(b.kippBei).toBe(Infinity)
    // Kopf auf BAUM_NAH Felder heran (Koerper liegt unterhalb)
    legeSchlange(g, b.root, 3, BAUM_NAH)
    g.update(20)
    expect(b.wartet).toBe(false)
    expect(b.kippBei! - g.time).toBeGreaterThanOrEqual(900)
    expect(b.kippBei! - g.time).toBeLessThanOrEqual(8000)
    for (let i = 0; i < 220 && b.kippBei !== null; i++) g.update(50)
    expect(b.kippBei).toBeNull()
    for (const c of b.cells) expect(g.body.some((p) => p.x === c.x && p.y === c.y)).toBe(false)
  })

  it('Haeuser: das Licht wechselt alle paar Sekunden, nie auf die Schlange; hineinlaufen = verloren', () => {
    const g = new MissionGame(WIESE_MISSIONEN[8])
    ruhig(g)
    g.tick = 1e12
    const h = g.haeuser[0]
    const wechsel = new Set<number>()
    for (let i = 0; i < 300; i++) {
      g.update(50)
      wechsel.add(h.lichtT)
      for (const c of h.strahl) expect(g.body.some((p) => p.x === c.x && p.y === c.y)).toBe(false)
    }
    // 15 Sekunden: mindestens dreimal ein neues Fenster (oder kurz dunkel)
    expect(wechsel.size).toBeGreaterThanOrEqual(3)
    expect(LICHT_TAKT).toBeLessThanOrEqual(5000)
    // Kopf direkt vor das Licht: ein Schritt hinein ist vorbei
    while (h.licht < 0) g.update(50)
    const s0 = h.strahl[0]
    const f = h.fenster[h.licht]
    const d = { x: s0.x - f.p.x, y: s0.y - f.p.y }
    const kopf = { x: s0.x + d.x * 2, y: s0.y + d.y * 2 }
    g.body = [kopf, { x: kopf.x + d.x, y: kopf.y + d.y }, { x: kopf.x + d.x * 2, y: kopf.y + d.y * 2 }]
    g.prev = g.body.map((p) => ({ ...p }))
    g.dir = d.x > 0 ? 'l' : d.x < 0 ? 'r' : d.y > 0 ? 'u' : 'd'
    g.tick = 100
    g.lichtNext = g.lichtNext.map(() => 1e12)
    for (let i = 0; i < 40 && g.status === 'play'; i++) g.update(20)
    expect(g.cause).toBe('licht')
  })

  it('Ameisenbiss ist in der Mission vorbei', () => {
    const g = new MissionGame(WIESE_MISSIONEN[8])
    ruhig(g)
    g.tick = 1e12
    const a = new MissionGame(WIESE_MISSIONEN[8]).ameisen[0]
    a.next = 0
    g.ameisen = [a]
    legeSchlange(g, a.p, 2, 2)
    for (let i = 0; i < 100 && g.status === 'play'; i++) g.update(50)
    expect(g.cause).toBe('ameise')
  })

  it('Giftwolken steigen immer wieder aus ihren Quellen, Lava breitet sich mit der Zeit aus, Leuchttuerme drehen sich', () => {
    const w = new MissionGame(WIESE_MISSIONEN[11])
    ruhig(w)
    w.quellen = new MissionGame(WIESE_MISSIONEN[11]).quellen
    w.tick = 1e12
    let wolken = 0
    let vorher = 0
    for (let i = 0; i < 1200; i++) {
      w.update(50)
      if (w.wolken.length > vorher) wolken += w.wolken.length - vorher
      vorher = w.wolken.length
    }
    // 60 Sekunden, drei Quellen: jede mindestens zweimal
    expect(wolken).toBeGreaterThanOrEqual(6)
    const l = new MissionGame(WIESE_MISSIONEN[12])
    ruhig(l)
    l.tick = 1e12
    const n0 = l.lava.reduce((n, s) => n + s.cells.length, 0)
    for (let t = 0; t < LAVA_TAKT * 3 + 100; t += 50) l.update(50)
    expect(l.lava.reduce((n, s) => n + s.cells.length, 0)).toBeGreaterThan(n0)
    const t = new MissionGame(WIESE_MISSIONEN[17])
    ruhig(t)
    t.tick = 1e12
    const d0 = t.tuerme[0].dir
    for (let i = 0; i * 50 < TURM_TAKT + 100; i++) t.update(50)
    expect(t.tuerme[0].dir).not.toBe(d0)
  })

  it('Mission 18: der Leuchtturm leuchtet durch die Luecken im Fels weit ueber die Wiese und dreht sich schneller', () => {
    const g = new MissionGame(WIESE_MISSIONEN[17])
    ruhig(g)
    expect(g.turmTakt).toBeLessThan(TURM_TAKT)
    expect(g.cfg.kegelLaenge).toBeGreaterThan(12)
    const t = g.tuerme[0]
    // In jede Richtung reicht er weit (frueher war am Felsring nach 3 Feldern Schluss)
    for (const d of DIRS) {
      t.dir = d
      g['kegel'](t)
      expect(t.kegel.length, d).toBeGreaterThanOrEqual(2 * 12)
    }
  })

  it('Mission 18: das Licht faellt ueber die Schlange, nur der Kopf nimmt Schaden; vor jeder Drehung zeigt er, wohin', () => {
    const neu = () => {
      const g = new MissionGame(WIESE_MISSIONEN[17])
      ruhig(g)
      g.tick = 1e12
      return g
    }
    // Koerper quer im Licht, der Kopf daneben: nichts passiert, der Kegel geht ueber den Koerper hinweg
    const g = neu()
    const t = g.tuerme[0]
    t.dir = 'u'
    g['kegel'](t)
    const spalte = t.kegel.filter((c) => c.x === t.c.x).sort((a, b) => b.y - a.y)
    const k = spalte.find((c, i) => i >= 4 && [-1, 0, 1, 2].every((dx) => g.inside({ x: c.x + dx, y: c.y })))!
    g.body = [{ x: k.x - 1, y: k.y }, { x: k.x, y: k.y }, { x: k.x + 1, y: k.y }, { x: k.x + 2, y: k.y }]
    g.prev = g.body.map((p) => ({ ...p }))
    g['kegel'](t)
    expect(t.kegel.some((c) => c.x === k.x && c.y === k.y)).toBe(true)
    expect(t.kegel.some((c) => c.x === k.x && c.y === k.y - 3)).toBe(true)
    for (let i = 0; i < 10; i++) g.update(50)
    expect(g.cause ?? g.status).toBe('play')
    // Kopf genau dort, wohin er sich als Naechstes dreht: erst die Ankuendigung, dann ist es vorbei
    const h = neu()
    const tu = h.tuerme[0]
    tu.dir = 'u'
    h['kegel'](tu)
    const ziel = h['kegelFelder'](tu, 'r') as P[]
    const z = ziel[6]
    h.body = [{ ...z }, { x: z.x, y: z.y + 1 }, { x: z.x, y: z.y + 2 }]
    h.prev = h.body.map((p) => ({ ...p }))
    h['turmNext'][0] = h.time + 1000
    h.turmVorschau[0] = null
    for (let i = 0; i < 8; i++) h.update(50)
    expect((h.turmVorschau[0] as P[] | null)?.some((c) => c.x === z.x && c.y === z.y)).toBe(true)
    expect(h.cause ?? h.status).toBe('play')
    for (let i = 0; i < 20 && h.status === 'play'; i++) h.update(50)
    expect(h.status).toBe('over')
    expect(h.cause).toBe('kegel')
  })

  it('kleine Steingolems: trifft der Schlag den Kopf, ist die Mission verloren', () => {
    const g = new MissionGame(WIESE_MISSIONEN[5])
    ruhig(g)
    g.tick = 1e12
    const m = new MissionGame(WIESE_MISSIONEN[5]).minigolems[0]
    m.next = 1e12
    m.jagt = 0
    g.minigolems = [m]
    g.body = [{ x: m.p.x + 1, y: m.p.y + 1 }, { x: m.p.x + 1, y: m.p.y + 2 }, { x: m.p.x + 1, y: m.p.y + 3 }].filter((p) => g.inside(p))
    g.prev = g.body.map((p) => ({ ...p }))
    for (let i = 0; i < 60 && g.status === 'play'; i++) g.update(20)
    expect(g.cause).toBe('minigolem')
  })
})
