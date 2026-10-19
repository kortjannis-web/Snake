/**
 * Nachrichten zwischen App und Snake-Server (Cloudflare). Eine Datei fuer beide Seiten.
 *
 * Ablauf: Wer einen Raum erstellt, ist Gastgeber (waehlt Modus, startet). Im Spiel auf einem Feld
 * (Gegeneinander, Koop) rechnet ein Geraet ("Rechner", anfangs der Gastgeber) und schickt den Stand,
 * die anderen schicken nur ihre Wischer. Der Server merkt sich den Stand: faellt der Rechner aus,
 * rechnet ein anderes Geraet damit weiter. Im Wettrennen rechnet jeder seine eigene Welt, der Server
 * verteilt die Geister, waehlt abwechselnd, wer das naechste Gebiet bestimmt, und entscheidet, wer raus ist.
 */
import type { Ergebnis, Modus, SpielerInfo } from '../game/mehr'
import type { Tempo } from '../game/rules'
import type { Dir, GameEvent, P } from '../game/types'
import type { Zustand } from '../game/zustand'

/** Erhoehen, wenn sich Nachrichten oder die Spiellogik so aendern, dass alte Apps nicht mehr mitspielen koennen */
export const PROTOKOLL = 2
export const MAX_SPIELER = 4
/** Feste Kartengroesse im Mehrspieler (Felder eines Bildschirms), damit alle dieselbe Welt haben */
export const MEHR_BILD = { w: 12, h: 23 }
/** So lange (ms) zaehlt der Server rueckwaerts, bevor es losgeht */
export const COUNTDOWN = 3000
/** Kommt so lange (ms) kein Stand vom Rechner, uebernimmt ein anderes Geraet */
export const RECHNER_STILL = 2500

export type Phase = 'lobby' | 'spiel' | 'ende'
/** `revanche`: will nach dem Spiel noch eine Runde (Abstimmung im Ergebnis) */
export type Teilnehmer = SpielerInfo & { online: boolean; bereit: boolean; revanche?: boolean }
export type Einstellungen = { tempo: Tempo; klassisch: boolean }

export type StartInfo = {
  modus: Modus
  seed: number
  spieler: SpielerInfo[]
  /** Index des rechnenden Geraets (nur Gegeneinander und Koop) */
  rechner: number
  /** Serverzeit (ms seit Raumstart), ab der gespielt wird */
  los: number
} & Einstellungen

export type Geist = { wer: number; b: P[]; d: Dir; a: number; l: number; tot: boolean; raus: boolean }

/** App -> Server */
export type AnServer =
  | { t: 'modus'; modus: Modus }
  | ({ t: 'einstellung' } & Partial<Einstellungen>)
  | { t: 'bereit'; bereit: boolean }
  | { t: 'start' }
  | { t: 'nochmal' }
  /** Ergebnis: Revanche wollen (true, Standard) oder zuruecknehmen. Wollen alle, geht es zurueck in die Lobby */
  | { t: 'revanche'; revanche?: boolean }
  /** Wischer; `bei` = Kopffeld auf diesem Geraet, `k` = Anzahl Erweiterungen (gleiche Karte?) */
  | { t: 'dir'; d: Dir; bei?: P; k?: number }
  /** Reaktion (Index in REAKTIONEN) */
  | { t: 'emoji'; e: number }
  /** Rechner: geaenderte Felder des Stands, Ereignisse; `voll` = ganzer Stand */
  | { t: 'z'; d: Zustand; e?: GameEvent[]; voll?: boolean }
  | { t: 'ende'; ergebnis: Ergebnis }
  /** Rechner geht in den Hintergrund: bitte jemand anderes */
  | { t: 'abgabe' }
  /** Rennen: eigene Schlange (Weltkoordinaten), Aepfel, Leben */
  | { t: 'pos'; b: P[]; d: Dir; a: number; l: number; tot: boolean; raus: boolean }
  /** Rennen: gewaehltes Gebiet k (Block in Weltkoordinaten) */
  | { t: 'gebiet'; k: number; b: P; d: Dir }
  | { t: 'ping' }

/** Server -> App */
export type VomServer =
  | ({ t: 'raum'; code: string; gastgeber: string; phase: Phase; modus: Modus; spieler: Teilnehmer[]; ich: number } & Einstellungen)
  | { t: 'start'; info: StartInfo; jetzt: number }
  | { t: 'z'; d: Zustand; e?: GameEvent[]; voll?: boolean }
  /** Ganzer Stand fuer ein Geraet, das neu rechnet oder zurueckkommt */
  | { t: 'voll'; z: Zustand }
  | { t: 'rechner'; wer: number }
  | { t: 'dir'; wer: number; d: Dir; bei?: P; k?: number }
  | { t: 'emoji'; wer: number; e: number }
  | ({ t: 'geist' } & Geist)
  | { t: 'waehler'; k: number; wer: number }
  | { t: 'gebiet'; k: number; b: P; d: Dir; wer: number }
  | { t: 'raus'; wer: number; grund: 'leben' | 'abstand' }
  | { t: 'ende'; ergebnis: Ergebnis }
  | { t: 'fehler'; text: string }
  | { t: 'pong'; jetzt: number }

/** Reaktionen im Spiel (fest, kein freier Text) */
export const REAKTIONEN = ['👍', '😂', '😱', '😡', '🔥', '👋'] as const

const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Raum-Code: 5 Zeichen ohne Verwechsler (0/O, 1/I) */
export function neuerCode(zufall = Math.random) {
  let s = ''
  for (let i = 0; i < 5; i++) s += ZEICHEN[Math.floor(zufall() * ZEICHEN.length)]
  return s
}
export const codeGueltig = (c: string) => /^[A-Z2-9]{4,8}$/.test(c)
