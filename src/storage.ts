/** Einstellungen und Statistik, nur auf dem Geraet (localStorage) */
import { DEFAULTS, type Config, type Tempo } from './game/rules'
import type { Kreativ } from './game/types'

export type Settings = { sound: boolean; music: boolean; vibration: boolean; tempo: Tempo; dpad: boolean }
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
  /** Gefahren, die schon einmal vorgestellt wurden */
  seen: string[]
}

const SKEY = 'snake.settings.v1'
const TKEY = 'snake.stats.v1'

export const defaultSettings = (): Settings => ({ sound: true, music: true, vibration: true, tempo: 'normal', dpad: false })
export const defaultStats = (): Stats => ({ best: 0, games: 0, apples: 0, time: 0, longest: 0, maxGebiete: 0, gegner: 0, seen: [] })

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
export const stats: Stats = read(TKEY, defaultStats())
export const saveSettings = () => write(SKEY, settings)
export const saveStats = () => write(TKEY, stats)
export function resetStats() {
  Object.assign(stats, defaultStats())
  saveStats()
}

/* ---------------- Master-Einstellungen (alle Zahlen der Spielregeln) ----------------
 * Gespeichert wird nur, was vom Standard abweicht: so gelten neue Standardwerte
 * auch fuer alle, die schon einmal etwas umgestellt haben. */
const CKEY = 'snake.config.v2'
const CKEY_ALT = 'snake.config.v1'

function ladeConfig(): Config {
  const c: Config = { ...DEFAULTS }
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
    if (alt.gnade === 1.3) delete roh.gnade
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
export type KreativEinst = Kreativ & { start: number }
export const kreativ: KreativEinst = read(KKEY, { start: 100, tod: 'anhalten', rueckschlag: true, durchSelbst: false, wachsen: true, laenge: 3 } as KreativEinst)
export const saveKreativ = () => write(KKEY, kreativ)

/* ---------------- Aepfel (Waehrung) und Skins ---------------- */
const WKEY = 'snake.wallet.v1'
export type Wallet = { aepfel: number; skins: string[]; skin: string }
export const wallet: Wallet = read(WKEY, { aepfel: 0, skins: ['klassik'], skin: 'klassik' } as Wallet)
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
