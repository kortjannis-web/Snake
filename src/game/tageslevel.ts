/**
 * Tageslevel: jeden Tag ein eigenes, festes Level fuer alle (aus dem Datum erzeugt).
 *
 * Karte: 3 bis 10 Bloecke, zufaellig aneinandergesetzt, an manchen Aussenecken abgeschnitten oder mit
 * Ausbuchtungen nach aussen. Darauf ein Motto (z. B. Lava-Labyrinth, Schlangennest, Seenplatte) mit
 * passenden Hindernissen und Tieren; alles bleibt liegen, nichts Neues kommt dazu. Die Schlange startet
 * mit zufaelliger Laenge und muss 3 bis 20 Aepfel holen, der letzte leuchtet pink und bringt 10 Aepfel.
 *
 * Schwierigkeit: ein Rechner gewichtet jede Gefahr (Gegner und Lava schwer, Mauern leicht) je Block,
 * dazu Schlangenlaenge und Apfelzahl. Der Generator stellt so lange nach, bis der Wert im Band des
 * Wochentags liegt: Montag leicht bis mittel, zum Sonntag hin knackig, nie trivial, nie unschaffbar.
 */
import type { P, SandboxObjekt } from './types'

export type Ecke = { b: P; ecke: 0 | 1 | 2 | 3; groesse: number; art: 'ab' | 'dazu'; lage: number }
export type TagesLevel = {
  /** Bloecke in Blockkoordinaten (ab 1, damit Ausbuchtungen links und oben Platz haben) */
  bloecke: P[]
  ecken: Ecke[]
  laenge: number
  ziel: number
  objekte: Partial<Record<SandboxObjekt, number>>
  motto: string
  /** Wert des Schwierigkeitsrechners (etwa 20 bis 75) */
  schwierigkeit: number
}

/** Kleiner eigener Zufall (unabhaengig vom Spiel-Zufall) */
function zufall(seed: number) {
  let s = seed >>> 0 || 1
  const next = () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
  return { next, int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)), pick: <T,>(l: readonly T[]) => l[Math.floor(next() * l.length)] }
}

/** Wie gefaehrlich ein Objekt ist (je Stueck) */
export const GEWICHT: Record<SandboxObjekt, number> = { mauer: 1, teich: 1, gift: 1.2, baum: 1.5, haus: 2, turm: 3, falle: 2, wolke: 3, frosch: 1.2, gegner: 4, lila: 6, ameise: 2.5, lava: 4, eis: 1.5 }

type Motto = { name: string; objekte: Partial<Record<SandboxObjekt, readonly [number, number]>> }
/** Mottos: was je Block ungefaehr vorkommt (von bis) */
const MOTTOS: Motto[] = [
  { name: 'Lava-Labyrinth', objekte: { lava: [0.5, 1], mauer: [1, 2] } },
  { name: 'Schlangennest', objekte: { gegner: [0.4, 0.8], lila: [0, 0.3], mauer: [0, 1] } },
  { name: 'Dichter Wald', objekte: { baum: [1, 2], frosch: [0.3, 0.7], teich: [0, 0.5] } },
  { name: 'Seenplatte', objekte: { teich: [1, 2], eis: [0.2, 0.5], frosch: [0.2, 0.6] } },
  { name: 'Giftsumpf', objekte: { gift: [1, 2], wolke: [0.2, 0.5], teich: [0.3, 0.8] } },
  { name: 'Wachtürme', objekte: { turm: [0.3, 0.6], haus: [0.3, 0.8], mauer: [0.5, 1] } },
  { name: 'Fallenparcours', objekte: { falle: [1, 2], mauer: [0.5, 1.5] } },
  { name: 'Ameisenhügel', objekte: { ameise: [0.5, 1], baum: [0.5, 1] } },
  { name: 'Eiszeit', objekte: { eis: [0.5, 1], teich: [0.5, 1], gegner: [0, 0.4] } },
  { name: 'Bauernhof', objekte: { haus: [0.5, 1], baum: [0.5, 1], frosch: [0.3, 0.6] } },
  { name: 'Chaos', objekte: { mauer: [0.3, 1], lava: [0, 0.5], gegner: [0, 0.5], falle: [0, 1], baum: [0, 1], wolke: [0, 0.3] } },
]

/** Schwierigkeit: Gefahren je Block, laengere Schlange und mehr Aepfel machen es schwerer */
export function schwierigkeit(t: Pick<TagesLevel, 'objekte' | 'laenge' | 'ziel' | 'bloecke'>) {
  let gefahr = 0
  for (const [k, n] of Object.entries(t.objekte) as [SandboxObjekt, number][]) gefahr += GEWICHT[k] * n
  return (gefahr / t.bloecke.length) * 8 + (t.laenge - 3) * 0.6 + (t.ziel - 3) * 1.1
}

/** Band je Wochentag (0 = Montag bis 6 = Sonntag) */
export const band = (wochentag: number) => {
  const lo = 22 + wochentag * 6
  return [lo, lo + 16] as const
}

/** Wochentag (0 = Montag) eines Tages im Format JJJJ-MM-TT */
export function wochentag(tag: string) {
  const [y, m, d] = tag.split('-').map(Number)
  const w = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
  return (w + 6) % 7
}

export function tagesLevel(seed: number, wt: number): TagesLevel {
  const r = zufall(seed)
  // Bloecke: zufaellig zusammenhaengend wachsen lassen
  const anzahl = r.int(3, 10)
  const set = new Set(['0,0'])
  const bloecke: P[] = [{ x: 0, y: 0 }]
  for (let v = 0; bloecke.length < anzahl && v < 500; v++) {
    const b = r.pick(bloecke)
    const [dx, dy] = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
    const k = `${b.x + dx},${b.y + dy}`
    if (set.has(k)) continue
    // Nicht zu lang gestreckt: hoechstens 4 Bloecke breit oder hoch
    const xs = [...bloecke.map((q) => q.x), b.x + dx]
    const ys = [...bloecke.map((q) => q.y), b.y + dy]
    if (Math.max(...xs) - Math.min(...xs) > 3 || Math.max(...ys) - Math.min(...ys) > 3) continue
    set.add(k)
    bloecke.push({ x: b.x + dx, y: b.y + dy })
  }
  const mx = Math.min(...bloecke.map((b) => b.x))
  const my = Math.min(...bloecke.map((b) => b.y))
  // Um 1 verschoben: links und oben ein Block Luft fuer Ausbuchtungen
  const norm = bloecke.map((b) => ({ x: b.x - mx + 1, y: b.y - my + 1 }))
  const hat = (x: number, y: number) => norm.some((b) => b.x === x && b.y === y)

  // Ecken: an Aussenecken abschneiden oder eine Ausbuchtung nach aussen
  const ecken: Ecke[] = []
  norm.forEach((b, i) => {
    // 0 = oben links, 1 = oben rechts, 2 = unten rechts, 3 = unten links
    const aussen = [!hat(b.x - 1, b.y) && !hat(b.x, b.y - 1), !hat(b.x + 1, b.y) && !hat(b.x, b.y - 1), !hat(b.x + 1, b.y) && !hat(b.x, b.y + 1), !hat(b.x - 1, b.y) && !hat(b.x, b.y + 1)]
    for (let e = 0; e < 4; e++) {
      if (!aussen[e] || i === 0) continue
      const z = r.next()
      if (z < 0.3) ecken.push({ b, ecke: e as Ecke['ecke'], groesse: r.int(2, 4), art: 'ab', lage: 0 })
      else if (z < 0.5) ecken.push({ b, ecke: e as Ecke['ecke'], groesse: r.int(2, 3), art: 'dazu', lage: r.next() })
    }
  })

  // Motto und Objekte
  const motto = r.pick(MOTTOS)
  const objekte: Partial<Record<SandboxObjekt, number>> = {}
  for (const [k, [a, z]] of Object.entries(motto.objekte) as [SandboxObjekt, readonly [number, number]][]) objekte[k] = Math.round((a + r.next() * (z - a)) * norm.length)
  // Dazu ein, zwei Ueberraschungen
  const alle: SandboxObjekt[] = ['mauer', 'teich', 'gift', 'baum', 'haus', 'falle', 'frosch', 'ameise', 'eis']
  for (let i = r.int(1, 2); i > 0; i--) {
    const k = r.pick(alle)
    objekte[k] = (objekte[k] ?? 0) + 1
  }
  const t: TagesLevel = { bloecke: norm, ecken, laenge: r.int(3, 14), ziel: r.int(3, 20), objekte, motto: motto.name, schwierigkeit: 0 }

  // Schwierigkeit ins Band des Wochentags bringen
  const [lo, hi] = band(wt)
  const mottoArten = Object.keys(motto.objekte) as SandboxObjekt[]
  for (let v = 0; v < 120; v++) {
    const s = schwierigkeit(t)
    if (s >= lo && s <= hi) break
    if (s < lo) {
      // schwerer: mehr Gefahr aus dem Motto, sonst mehr Aepfel oder laenger
      const w = r.next()
      if (w < 0.6) {
        const k = r.pick(mottoArten)
        t.objekte[k] = (t.objekte[k] ?? 0) + 1
      } else if (w < 0.8 && t.ziel < 20) t.ziel++
      else if (t.laenge < 14) t.laenge++
      else t.objekte[r.pick(mottoArten)] = (t.objekte[r.pick(mottoArten)] ?? 0) + 1
    } else {
      // leichter: das Schwerste zuerst weniger, sonst weniger Aepfel oder kuerzer
      const vorhanden = (Object.entries(t.objekte) as [SandboxObjekt, number][]).filter(([, n]) => n > 0).sort((a, b) => GEWICHT[b[0]] - GEWICHT[a[0]])
      const w = r.next()
      if (vorhanden.length && w < 0.65) t.objekte[vorhanden[0][0]] = vorhanden[0][1] - 1
      else if (w < 0.85 && t.ziel > 3) t.ziel--
      else if (t.laenge > 3) t.laenge--
      else if (vorhanden.length) t.objekte[vorhanden[0][0]] = vorhanden[0][1] - 1
    }
  }
  t.schwierigkeit = Math.round(schwierigkeit(t))
  return t
}

/** Felder einer Ecke (Kartenkoordinaten): abgeschnitten = Dreieck in der Ecke, dazu = runde Ausbuchtung
 *  an der Aussenkante neben der Ecke */
export function eckenFelder(e: Ecke, bw: number, bh: number): P[] {
  const out: P[] = []
  const x0 = e.b.x * bw
  const y0 = e.b.y * bh
  const rechts = e.ecke === 1 || e.ecke === 2
  const unten = e.ecke === 2 || e.ecke === 3
  if (e.art === 'ab') {
    for (let j = 0; j < e.groesse; j++)
      for (let i = 0; i < e.groesse - j; i++) out.push({ x: rechts ? x0 + bw - 1 - i : x0 + i, y: unten ? y0 + bh - 1 - j : y0 + j })
    return out
  }
  // Ausbuchtung: Halbkreis nach aussen (oben oder unten), mittig zwischen Ecke und Blockmitte
  const r = e.groesse
  const cx = rechts ? x0 + bw - 1 - Math.round((bw / 2 - r) * e.lage) - r : x0 + Math.round((bw / 2 - r) * e.lage) + r
  for (let j = 1; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + 1) continue
      out.push({ x: cx + i, y: unten ? y0 + bh - 1 + j : y0 - j })
    }
  return out
}
