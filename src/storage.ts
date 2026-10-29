/** Einstellungen und Statistik, nur auf dem Geraet (localStorage) */
import { ABGELEITET, DEFAULTS, type Config, type Tempo } from './game/rules'
import { gutschrift, SPIEL_MODI, type SpielModus } from './modus'
import type { KameraArt } from './render/renderer'

export type Settings = { sound: boolean; music: boolean; vibration: boolean; tempo: Tempo; dpad: boolean; kamera: KameraArt; kameraStand?: number; modus: SpielModus; /** Gefahren in zufaelliger Reihenfolge (je Runde neu) */ zufall: boolean }
export type Stats = {
  best: number
  games: number
  apples: number
  /** Spielzeit gesamt in ms */
  time: number
  longest: number
  maxGebiete: number
  /** Besiegte Gegner-Schlangen */
  gegner: number
  /** Bester Level heute (datum = JJJJ-MM-TT) */
  heute: { datum: string; best: number }
  /** Zaehler fuer Erfolge (gefressen, Erze, Gebiete ...) */
  zaehler: Record<string, number>
  /** Erreichte Erfolge (Ids) */
  erfolge: string[]
  /** Gefahren, die schon einmal vorgestellt wurden */
  seen: string[]
  /** Bester Level je Welt (fuer Freischaltung und Belohnungen der Welten) */
  weltBest?: Record<string, number>
  /** Tag (JJJJ-MM-TT), an dem der pinke 10er-Apfel im Tageslevel schon geholt wurde */
  tagesBonus?: string
}

const SKEY = 'snake.settings.v1'
const TKEY = 'snake.stats.v1'

export const defaultSettings = (): Settings => ({ sound: true, music: true, vibration: true, tempo: 'normal', dpad: false, kamera: 'bereich', modus: 'normal', zufall: true })
export const defaultStats = (): Stats => ({ best: 0, games: 0, apples: 0, time: 0, longest: 0, maxGebiete: 0, gegner: 0, heute: { datum: '', best: 0 }, zaehler: {}, erfolge: [], seen: [] })

/** Heutiges Datum (Geraetezeit) */
export const heuteDatum = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Bester Level heute (0, wenn heute noch nicht gespielt) */
export const heuteBest = () => (stats.heute?.datum === heuteDatum() ? stats.heute.best : 0)

function read<T extends object>(k: string, def: T): T {
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return def
    return { ...def, ...JSON.parse(raw) }
  } catch {
    return def
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* Speicher blockiert: egal */
  }
}

export const settings: Settings = read(SKEY, defaultSettings())
// 1.21: Langsam und Schnell gibt es nicht mehr (schnell ist jetzt der Speedrun-Modus)
settings.tempo = 'normal'
if (!SPIEL_MODI.includes(settings.modus)) settings.modus = 'normal'
// Frueher gab es zwei Fingermodi (Wischen / Zeichnen), jetzt nur noch einen
delete (settings as Partial<Record<'steuerung', unknown>>).steuerung
// 1.13: "Fest" und "Rauszoomen" entfallen, Standard ist jetzt die Bereich-Kamera (einmal fuer alle)
delete (settings as Partial<Record<'zoom', unknown>>).zoom
if (!settings.kameraStand) {
  settings.kamera = 'bereich'
  settings.kameraStand = 2
}
// 1.27: Es gibt nur noch die Bereich-Kamera (die dynamische ist aus, auch wenn sie gespeichert war)
settings.kamera = 'bereich'
export const stats: Stats = read(TKEY, defaultStats())
export const saveSettings = () => write(SKEY, settings)
/** Wird nach jedem Speichern von Statistik oder Aepfeln/Skins aufgerufen (Spielstand in der Cloud, src/cloud.ts) */
export const beiSpielstand = new Set<() => void>()
const spielstandGeaendert = () => beiSpielstand.forEach((f) => f())
export const saveStats = () => {
  write(TKEY, stats)
  spielstandGeaendert()
}
export function resetStats() {
  Object.assign(stats, defaultStats())
  saveStats()
}

/* ---------------- Admin (Master-Freischaltung) ----------------
 * Admin-Bereich (Master-Einstellungen, Spieler loeschen) nur nach Eingabe des Admin-Passworts unter Optionen.
 * Im Code steht nur sein Hash (dieselbe Pruefung macht die Datenbank beim Loeschen). Das Passwort bleibt auf
 * dem Geraet gespeichert, damit es beim Loeschen mitgeschickt werden kann. */
const MKEY = 'snake.master.v1'
const MASTER_HASH = '6dd580d2375e5b91013e1e283bf7265ed7decfea23c7b1bd678550f1f4cb7f5d'

const gespeichert = read(MKEY, { frei: false, code: '' } as { frei: boolean; code?: string })
/** Frei nur mit gespeichertem Passwort (ein von Hand gesetztes `frei: true` ohne Passwort schaltet nichts frei) */
export const master = { frei: gespeichert.frei === true && !!gespeichert.code, code: gespeichert.code ?? '' }

async function codePasst(code: string) {
  const norm = `snake-master:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm)))
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('') === MASTER_HASH
}

/** Beim Start: passt das gespeicherte Passwort nicht (mehr), ist der Admin-Zugang (und damit der Kreativ-Modus) zu */
export async function masterPruefen() {
  if (!master.frei) return false
  try {
    if (await codePasst(master.code)) return true
  } catch {
    return true
  }
  master.frei = false
  master.code = ''
  write(MKEY, { frei: false, code: '' })
  Object.assign(config, ladeConfig())
  return false
}

/** Prueft den Code (Gross-/Kleinschreibung, Leer- und Bindestriche egal) und schaltet frei */
export async function masterFreischalten(code: string) {
  if (!(await codePasst(code))) return false
  master.frei = true
  master.code = code
  write(MKEY, { frei: true, code })
  Object.assign(config, ladeConfig())
  return true
}

/* ---------------- Master-Einstellungen (alle Zahlen der Spielregeln) ----------------
 * Gespeichert wird nur, was vom Standard abweicht: so gelten neue Standardwerte
 * auch fuer alle, die schon einmal etwas umgestellt haben. Ohne Freischaltung gelten
 * immer die Standardwerte (frueher Umgestelltes bleibt gespeichert, wirkt aber nicht). */
const CKEY = 'snake.config.v2'
const CKEY_ALT = 'snake.config.v1'

function ladeConfig(): Config {
  const c: Config = { ...DEFAULTS }
  if (!master.frei) return c
  let neu = false
  try {
    neu = localStorage.getItem(CKEY) !== null
  } catch {
    /* Speicher blockiert */
  }
  let roh: Record<string, unknown> = read(CKEY, {})
  if (!neu) {
    // Aeltere Fassung speicherte alle Zahlen: umbenannte uebernehmen, alte Standards vergessen
    const alt: Record<string, unknown> = read(CKEY_ALT, {})
    roh = { ...alt, apfelWert: alt.apfelMuenzen, apfelWertAlle: alt.muenzFaktorAlle }
  }
  for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
    // Was jetzt aus den Stufen kommt, gilt nicht mehr einzeln (alte Einstellungen wirken nicht mehr)
    if (ABGELEITET.has(k)) continue
    const v = roh[k]
    if (typeof v === 'number' && Number.isFinite(v)) c[k] = v
  }
  return c
}
export const config: Config = ladeConfig()
export function saveConfig() {
  const diff: Partial<Config> = {}
  for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) if (config[k] !== DEFAULTS[k]) diff[k] = config[k]
  write(CKEY, diff)
}
export function resetConfig() {
  Object.assign(config, DEFAULTS)
  saveConfig()
}

/* ---------------- Kreativ-Modus ---------------- */
const KKEY = 'snake.kreativ.v1'
/** Kreativ: Startlevel und je Welt, was abgeschaltet ist (kommt nie) */
export type KreativEinst = { start: number; aus: Partial<Record<string, string[]>> }
export const kreativ: KreativEinst = read(KKEY, { start: 100, aus: {} } as KreativEinst)
kreativ.start = Number.isFinite(kreativ.start) ? kreativ.start : 100
kreativ.aus = { ...(kreativ.aus ?? {}) }
export const saveKreativ = () => write(KKEY, kreativ)

/* ---------------- Aepfel (Waehrung) und Skins ---------------- */
const WKEY = 'snake.wallet.v1'
/** Was im Aussehen gewaehlt ist (Ids). Farbe oder Skin (muster) ist aktiv, Accessoires und Spur kommen dazu */
export type LookWahl = {
  farben: string[]
  teilung: 'abschnitt' | 'ringe' | 'verlauf' | 'stufen'
  /** Zahl der Farben (1 bis 3, je nach gekauftem Modus) */
  anzahl: number
  muster: string | null
  acc: Partial<Record<'augen' | 'kopf' | 'gesicht' | 'schwanz', string>>
  spur: string | null
  /** Effekt (Aura), freigeschaltet mit Silber- oder Gold-Trophaeen */
  effekt?: string | null
}
/** Aepfel (Waehrung), gekaufte Sachen (skins: Ids aller Kategorien), das Aussehen als Text (skin, so geht es auch
 *  online weiter), die Wahl im Einzelnen (look), die Welt und Trophaeen (1 je besiegtem Gegner in einem Mehrspieler-Sieg) */
export type Wallet = { aepfel: number; /** Freigeschaltete Welten (Ids) */ welten?: string[]; /** Zwischenspeicher: noch nicht volle Aepfel in Hundertsteln (0 bis 99) */ rest?: number; skins: string[]; skin: string; look?: LookWahl; welt?: string; trophaeen: number; verdient?: number }
export const wallet: Wallet = read(WKEY, { aepfel: 0, skins: ['klassik'], skin: 'klassik', trophaeen: 0 } as Wallet)
export const saveWallet = () => {
  write(WKEY, wallet)
  spielstandGeaendert()
}
/** Aepfel verdient: in den Vorrat und in die Summe aller je verdienten Aepfel (Silber-Trophaeen) */
export function verdienen(n: number) {
  wallet.aepfel += n
  wallet.verdient = (wallet.verdient ?? wallet.aepfel - n) + n
}
/** Aepfel mit Prozentsatz des Modus gutschreiben: nur volle Aepfel zaehlen, der Rest wird zwischengespeichert.
 *  Gibt die gutgeschriebenen vollen Aepfel zurueck. */
export function verdienenModus(wert: number, prozent: number): number {
  const g = gutschrift(wert, prozent, wallet.rest ?? 0)
  wallet.rest = g.rest
  if (g.ganz > 0) verdienen(g.ganz)
  return g.ganz
}
// Muenzen aus aelteren Fassungen werden zu Aepfeln
{
  const alt = wallet as Wallet & { muenzen?: number }
  if (typeof alt.muenzen === 'number') {
    wallet.aepfel += alt.muenzen
    delete alt.muenzen
    saveWallet()
  }
}

/** Patchnotes: welche zuletzt gezeigt wurden (je Geraet, einmal nach einem Update) */
const PKEY = 'snake.patchnotes'
export const PATCHNOTES = '1.52'
export function patchnotesNeu() {
  return read<{ v?: string }>(PKEY, {}).v !== PATCHNOTES
}
export function patchnotesGesehen() {
  write(PKEY, { v: PATCHNOTES })
}

/** Spielfuehrer hinter dem Fragezeichen: roter Punkt, bis man ihn einmal geoeffnet hat. Neue Kennung = der Punkt kommt wieder */
const FKEY = 'snake.fuehrer'
export const FUEHRER = '1'
export function fuehrerNeu() {
  return read<{ v?: string }>(FKEY, {}).v !== FUEHRER
}
export function fuehrerGesehen() {
  write(FKEY, { v: FUEHRER })
}
