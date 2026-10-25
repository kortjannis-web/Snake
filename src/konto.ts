/**
 * Account aus dem Namen: Der Name legt die Zugangsdaten fest (E-Mail-Adresse und Passwort werden daraus
 * abgeleitet und nie angezeigt). Wer auf einem anderen Geraet denselben Namen eingibt, meldet sich damit
 * im selben Supabase-Konto an. Gedacht fuer den Freundes- und Familienkreis: wer den Namen kennt, kommt rein.
 * Ohne Bibliothek und ohne Netz, damit es auch ohne sicheren Kontext (http im Dev-Server) gleich rechnet.
 */

const primzahlen = (n: number) => {
  const p: number[] = []
  for (let k = 2; p.length < n; k++) if (p.every((q) => k % q)) p.push(k)
  return p
}
const bruch = (x: number) => Math.floor((x - Math.floor(x)) * 2 ** 32)
const P = primzahlen(64)
const K = P.map((p) => bruch(Math.cbrt(p)))
const H0 = P.slice(0, 8).map((p) => bruch(Math.sqrt(p)))

const ror = (x: number, n: number) => (x >>> n) | (x << (32 - n))

/** SHA-256 als Hex-Text */
export function sha256(text: string): string {
  const daten = new TextEncoder().encode(text)
  const len = daten.length
  const gesamt = (Math.ceil((len + 9) / 64) * 64) | 0
  const buf = new Uint8Array(gesamt)
  buf.set(daten)
  buf[len] = 0x80
  const dv = new DataView(buf.buffer)
  dv.setUint32(gesamt - 8, Math.floor((len * 8) / 2 ** 32))
  dv.setUint32(gesamt - 4, (len * 8) >>> 0)
  const h = Uint32Array.from(H0)
  const w = new Uint32Array(64)
  for (let o = 0; o < gesamt; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4)
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]
      const b = w[i - 2]
      w[i] = w[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[i - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10))
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    ;[a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] += v))
  }
  return [...h].map((v) => v.toString(16).padStart(8, '0')).join('')
}

/**
 * Domain der (nie verschickten) Konto-Adressen. Sie braucht echte Mail-Eintraege, weil Supabase die Adresse
 * prueft; es geht aber nie eine E-Mail raus (Bestaetigung ist ausgeschaltet, siehe docs/ONLINE-EINRICHTEN.md).
 */
const DOMAIN = (import.meta.env.VITE_KONTO_DOMAIN as string | undefined) || 'topsichtbar.de'

/** Wie die Datenbank Namen vergleicht (eindeutig ohne Gross-/Kleinschreibung) */
export const kontoSchluessel = (name: string) => name.trim().normalize('NFC').toLowerCase()

/** E-Mail-Adresse und (altes, nur aus dem Namen abgeleitetes) Passwort fuer den Account dieses Namens */
export function kontoZugang(name: string): { email: string; password: string } {
  const k = kontoSchluessel(name)
  return { email: `snake-${sha256(`snake-konto-id:${k}`).slice(0, 24)}@${DOMAIN}`, password: sha256(`snake-konto-pw:${k}`) }
}

/** Mindestlaenge des selbst gewaehlten Passworts */
export const PASSWORT_MIN = 4

/**
 * Zugang mit selbst gewaehltem Passwort (seit 1.42). Supabase bekommt nur einen Hash davon (immer 64 Zeichen, erfuellt
 * jede Passwort-Regel). Der Hash haengt nicht vom Namen ab, damit Umbenennen nur die Adresse aendert
 */
export function passwortZugang(name: string, passwort: string): { email: string; password: string } {
  return { email: kontoZugang(name).email, password: sha256(`snake-passwort:${passwort}`) }
}
