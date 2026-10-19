/**
 * Kompakter Mehrspieler-Stand: Die Schlangen machen fast alle Bytes aus (bei 4 Spielern ~95 %), weil sich bei
 * jedem Schritt ihr Koerper aendert. Statt alle Schlangen jedes Mal ganz zu schicken, gehen nur die Felder der
 * Schlangen, die sich geaendert haben (`sd`), und ein Koerper nur als "neue Koepfe vorn, Laenge n" (ein Schritt
 * = ein Feld). `prev` ist nach einem Schritt der alte Koerper: dann reicht ein 'b'.
 *
 * Ohne Spiel-Code (laeuft auch auf dem Server, der sich den Stand fuer einen Rechnerwechsel merkt).
 */
import type { P } from '../game/types'

export type Zustand = Record<string, unknown>
type SchlangeRoh = Record<string, unknown>
/** Koerper-Aenderung: neue Felder vorn (k), dann der bisherige Koerper, gekuerzt auf n Felder */
export type Schub = { $k: P[]; $n: number }
/** Aenderungen je Schlange: [Index, geaenderte Felder] */
export type SchlangenDiff = [number, SchlangeRoh][]

export const SD = 'sd'
/** Felder, die als Schub gehen koennen */
const LISTEN = new Set(['body', 'prev'])
/** Hoechstens so viele neue Koepfe in einem Schub (mehr Schritte zwischen zwei Staenden kommen kaum vor) */
const MAX_KOEPFE = 4

/** Das Spiel veraendert seine Listen selbst (Kopf vorn dran, Schwanz weg): gemerkt wird deshalb eine Kopie */
const kopie = (l: P[]) => (Array.isArray(l) ? l.map((p) => ({ x: p.x, y: p.y })) : l)

const istSchub = (v: unknown): v is Schub => !!v && typeof v === 'object' && Array.isArray((v as Schub).$k) && typeof (v as Schub).$n === 'number'

/** Laesst sich `neu` als Schub von `alt` schreiben? */
export function schub(alt: P[] | undefined, neu: P[]): Schub | null {
  if (!Array.isArray(alt) || !Array.isArray(neu)) return null
  for (let k = 0; k <= Math.min(MAX_KOEPFE, neu.length); k++) {
    const rest = neu.length - k
    if (rest > alt.length) continue
    let gleich = true
    for (let i = 0; i < rest; i++)
      if (neu[k + i].x !== alt[i].x || neu[k + i].y !== alt[i].y) {
        gleich = false
        break
      }
    if (gleich) return { $k: neu.slice(0, k), $n: neu.length }
  }
  return null
}

/**
 * Merkt sich je Schlange und Feld, was zuletzt verschickt wurde, und liefert nur die Aenderungen.
 * Gibt `{ schlangen }` (ganz, beim ersten Mal oder wenn sich die Zahl aendert) oder `{ sd }` oder null.
 */
export class SchlangenAbgleich {
  private zuletzt: Map<string, string>[] = []
  private koerper: Record<string, P[]>[] = []

  aenderungen(schlangen: SchlangeRoh[]): Zustand | null {
    if (schlangen.length !== this.zuletzt.length) {
      this.zuletzt = schlangen.map(() => new Map())
      this.koerper = schlangen.map(() => ({}))
      for (let i = 0; i < schlangen.length; i++) this.merken(i, schlangen[i])
      return { schlangen }
    }
    const sd: SchlangenDiff = []
    schlangen.forEach((s, i) => {
      const alt = this.zuletzt[i]
      const altKoerper = { ...this.koerper[i] }
      const altBody = alt.get('body')
      const felder: SchlangeRoh = {}
      let n = 0
      for (const [f, v] of Object.entries(s)) {
        const j = JSON.stringify(v)
        if (alt.get(f) === j) continue
        alt.set(f, j)
        n++
        if (LISTEN.has(f)) {
          const liste = v as P[]
          this.koerper[i][f] = kopie(liste)
          // Nach einem Schritt ist prev genau der vorige Koerper
          if (f === 'prev' && altBody === j) {
            felder[f] = 'b'
            continue
          }
          const sch = schub(altKoerper[f], liste)
          if (sch && JSON.stringify(sch).length < j.length) {
            felder[f] = sch
            continue
          }
        }
        felder[f] = v
      }
      if (n) sd.push([i, felder])
    })
    return sd.length ? { [SD]: sd } : null
  }

  private merken(i: number, s: SchlangeRoh) {
    for (const [f, v] of Object.entries(s)) {
      this.zuletzt[i].set(f, JSON.stringify(v))
      if (LISTEN.has(f)) this.koerper[i][f] = kopie(v as P[])
    }
  }

  vergessen() {
    this.zuletzt = []
    this.koerper = []
  }
}

/** Beim Verschicken: Kommazahlen auf 2 Stellen (Spielzeiten wie 18453.500000000382 kosten sonst 10 Zeichen mehr) */
export const runden = (_k: string, v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v)

/**
 * Aenderungen (auch kompakte) in einen gemerkten Stand uebernehmen. Gibt die Aenderungen zurueck, mit ganzen
 * Schlangen statt `sd` (so kann sie jeder wie bisher anwenden). Schlangen werden neu angelegt, nie veraendert:
 * ein schon zurueckgegebener Stand bleibt also gueltig.
 */
export function zusammenfuehren(basis: Zustand, d: Zustand): Zustand {
  const out: Zustand = {}
  for (const [k, v] of Object.entries(d)) {
    if (k === SD || k === '__proto__') continue
    basis[k] = v
    // Schlangen als eigene Objekte herausgeben: wer sie anwendet und veraendert, aendert nicht den gemerkten Stand
    out[k] = k === 'schlangen' && Array.isArray(v) ? v.map((s) => ({ ...s })) : v
  }
  const sd = d[SD] as SchlangenDiff | undefined
  const alt = basis.schlangen as SchlangeRoh[] | undefined
  if (Array.isArray(sd) && Array.isArray(alt)) {
    const neu = alt.slice()
    // Kommt auf dem Server ungeprueft an: nichts davon darf werfen
    for (const e of sd) {
      if (!Array.isArray(e)) continue
      const [i, felder] = e
      if (!Number.isInteger(i) || i < 0 || i >= neu.length || !felder || typeof felder !== 'object') continue
      const s0 = neu[i]
      const s: SchlangeRoh = { ...s0 }
      for (const [f, w] of Object.entries(felder)) {
        if (f === '__proto__') continue
        if (w === 'b' && f === 'prev') s.prev = s0.body
        else if (istSchub(w)) s[f] = [...w.$k, ...((s0[f] as P[] | undefined) ?? [])].slice(0, w.$n)
        else s[f] = w
      }
      neu[i] = s
    }
    basis.schlangen = neu
    out.schlangen = neu.map((s) => ({ ...s }))
  }
  return out
}
