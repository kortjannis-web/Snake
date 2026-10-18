/** Tages-Herausforderung: alle spielen am selben Tag (deutscher Zeit) dieselbe Startwelt */

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
