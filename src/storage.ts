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
  /** Gefahren, die schon einmal vorgestellt wurden */
  seen: string[]
}

const SKEY = 'snake.settings.v1'
const TKEY = 'snake.stats.v1'

export const defaultSettings = (): Settings => ({ sound: true, music: true, vibration: true, tempo: 'normal', dpad: false })
export const defaultStats = (): Stats => ({ best: 0, games: 0, apples: 0, time: 0, longest: 0, maxGebiete: 0, seen: [] })

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

/* ---------------- Master-Einstellungen (alle Zahlen der Spielregeln) ---------------- */
const CKEY = 'snake.config.v1'
export const config: Config = read(CKEY, { ...DEFAULTS })
export const saveConfig = () => write(CKEY, config)
export function resetConfig() {
  Object.assign(config, DEFAULTS)
  saveConfig()
}

/* ---------------- Kreativ-Modus ---------------- */
const KKEY = 'snake.kreativ.v1'
export type KreativEinst = Kreativ & { start: number }
export const kreativ: KreativEinst = read(KKEY, { start: 100, tod: 'anhalten', rueckschlag: true, durchSelbst: false, wachsen: true, laenge: 3 } as KreativEinst)
export const saveKreativ = () => write(KKEY, kreativ)

/* ---------------- Muenzen und Skins ---------------- */
const WKEY = 'snake.wallet.v1'
export type Wallet = { muenzen: number; skins: string[]; skin: string }
export const wallet: Wallet = read(WKEY, { muenzen: 0, skins: ['klassik'], skin: 'klassik' } as Wallet)
export const saveWallet = () => write(WKEY, wallet)
