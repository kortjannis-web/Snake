/**
 * Gemeinsame Teile der Mehrspieler-Rechnung fuer Server und App: beide bauen das Spiel genau gleich
 * und rechnen es in denselben festen Schritten (SIM_MS), Wischer gelten jeweils vor einem Schritt.
 * So rechnet jedes Handy dasselbe aus wie der Server und kann vorausrechnen.
 */
import { DUELL, GEGNER_MODI, KLASSISCH, MehrGame } from '../game/mehr'
import type { Dir } from '../game/types'
import { MEHR_BILD, type StartInfo } from './protokoll'

/** Das Spiel zu einem Start (im Rennen nur mit dem eigenen Spieler `nur`) */
export function spielBauen(info: StartInfo, nur?: number): MehrGame {
  const spieler = nur !== undefined ? [info.spieler[nur]] : info.spieler
  return new MehrGame({
    screenW: MEHR_BILD.w,
    screenH: MEHR_BILD.h,
    seed: info.seed,
    modus: info.modus,
    spieler,
    tempo: info.tempo ?? 'normal',
    leben: info.leben ?? 1,
    cfg: { ...(GEGNER_MODI.includes(info.modus) ? DUELL : {}), ...(info.klassisch ? KLASSISCH : {}) },
  })
}

/** Ein Wischer im Spiel: Spieler `wer` lenkt vor Schritt `n`. `q` = Reihenfolge beim Server (unbestaetigt: Infinity).
 *  `schon`: in der App schon sofort angewendet (gilt im naechsten Schritt nicht noch einmal) */
export type Eingabe = { wer: number; d: Dir; n: number; i: number; q: number; schon?: boolean }

/** Reihenfolge, in der Wischer desselben Schritts gelten (wie beim Server) */
export const reihenfolge = (a: Eingabe, b: Eingabe) => a.n - b.n || a.q - b.q || a.wer - b.wer || a.i - b.i
