/** Einstellungen und Statistik, nur auf dem Geraet (localStorage) */
import { DEFAULTS, type Config, type Tempo } from './game/rules'
import type { Kreativ, Sandbox } from './game/types'
import type { KameraArt } from './render/renderer'

export type Settings = { sound: boolean; music: boolean; vibration: boolean; tempo: Tempo; dpad: boolean; kamera: KameraArt; kameraStand?: number }
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
}

const SKEY = 'snake.settings.v1'
const TKEY = 'snake.stats.v1'

export const defaultSettings = (): Settings => ({ sound: true, music: true, vibration: true, tempo: 'normal', dpad: false, kamera: 'bereich' })
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
// Frueher gab es zwei Fingermodi (Wischen / Zeichnen), jetzt nur noch einen
delete (settings as Partial<Record<'steuerung', unknown>>).steuerung
// 1.13: "Fest" und "Rauszoomen" entfallen, Standard ist jetzt die Bereich-Kamera (einmal fuer alle)
delete (settings as Partial<Record<'zoom', unknown>>).zoom
if (!settings.kameraStand) {
  settings.kamera = 'bereich'
  settings.kameraStand = 2
}
if (settings.kamera !== 'bereich' && settings.kamera !== 'dynamisch') settings.kamera = 'bereich'
export const stats: Stats = read(TKEY, defaultStats())
export const saveSettings = () => write(SKEY, settings)
export const saveStats = () => write(TKEY, stats)
export function resetStats() {
  Object.assign(stats, defaultStats())
  saveStats()
}

/* ---------------- Master-Freischaltung ----------------
 * Die Master-Einstellungen gibt es nur auf Geraeten, auf denen einmal der Master-Code
 * eingegeben wurde. Im Code steht nur sein Hash, nicht der Code selbst. */
const MKEY = 'snake.master.v1'
const MASTER_HASH = '3448bc06a33411340a6c28fa55458cdc582c17fade658b25d69d7c3e5f8e05f3'

export const master = { frei: read(MKEY, { frei: false }).frei === true }

/** Prueft den Code (Gross-/Kleinschreibung, Leer- und Bindestriche egal) und schaltet frei */
export async function masterFreischalten(code: string) {
  const norm = `snake-master:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm)))
  if ([...h].map((b) => b.toString(16).padStart(2, '0')).join('') !== MASTER_HASH) return false
  master.frei = true
  write(MKEY, { frei: true })
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
export type SandboxEinst = Sandbox & { an: boolean }
export type KreativEinst = Kreativ & { start: number; sandbox: SandboxEinst }
const defaultSandbox = (): SandboxEinst => ({ an: false, breite: 2, hoehe: 2, laenge: 6, weiter: false, objekte: { mauer: 2, gegner: 1, ameise: 1 } })
export const kreativ: KreativEinst = read(KKEY, { start: 100, tod: 'anhalten', rueckschlag: true, durchSelbst: false, wachsen: true, laenge: 3, sandbox: defaultSandbox() } as KreativEinst)
kreativ.sandbox = { ...defaultSandbox(), ...kreativ.sandbox, objekte: { ...(kreativ.sandbox?.objekte ?? defaultSandbox().objekte) } }
export const saveKreativ = () => write(KKEY, kreativ)

/* ---------------- Aepfel (Waehrung) und Skins ---------------- */
const WKEY = 'snake.wallet.v1'
/** Aepfel (Waehrung), Skins und Trophaeen (1 je besiegtem Gegner in einem Mehrspieler-Sieg, werden nur gesammelt) */
export type Wallet = { aepfel: number; skins: string[]; skin: string; trophaeen: number }
export const wallet: Wallet = read(WKEY, { aepfel: 0, skins: ['klassik'], skin: 'klassik', trophaeen: 0 } as Wallet)
export const saveWallet = () => write(WKEY, wallet)
// Muenzen aus aelteren Fassungen werden zu Aepfeln
{
  const alt = wallet as Wallet & { muenzen?: number }
  if (typeof alt.muenzen === 'number') {
    wallet.aepfel += alt.muenzen
    delete alt.muenzen
    saveWallet()
  }
}
