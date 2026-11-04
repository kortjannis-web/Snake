/**
 * Nachrichten zwischen App und Snake-Server (Cloudflare). Eine Datei fuer beide Seiten.
 *
 * Ablauf: Wer einen Raum erstellt, ist Gastgeber (waehlt Modus, startet). Im Spiel auf einem Feld
 * (Gegeneinander, Koop, Apfeljagd, Zone) rechnet der Server das Spiel in festen Schritten (SIM_MS). Jedes
 * Handy schickt nur seine Wischer mit dem Schritt, in dem gewischt wurde, und rechnet das Spiel selbst
 * voraus (die eigene Schlange biegt sofort ab, wie offline). Der Server rechnet VERZUG_MS hinter der
 * Echtzeit, damit Wischer trotz Laufzeit noch puenktlich ankommen, und schickt seinen Stand; damit gleicht
 * jedes Handy seine Vorhersage ab. Im Wettrennen rechnet jeder seine eigene Welt, der Server verteilt die
 * Geister, waehlt abwechselnd, wer das naechste Gebiet bestimmt, und entscheidet, wer raus ist.
 */
import type { Ergebnis, Modus, SpielerInfo } from '../game/mehr'
import type { Tempo } from '../game/rules'
import type { Dir, GameEvent, P } from '../game/types'
import type { Zustand } from '../game/zustand'

/** Erhoehen, wenn sich Nachrichten oder die Spiellogik so aendern, dass alte Apps nicht mehr mitspielen koennen */
export const PROTOKOLL = 3
export const MAX_SPIELER = 4
/** Feste Kartengroesse im Mehrspieler (Felder eines Bildschirms), damit alle dieselbe Welt haben */
export const MEHR_BILD = { w: 12, h: 23 }
/** So lange (ms) zaehlt der Server rueckwaerts, bevor es losgeht */
export const COUNTDOWN = 3000
/** Ein Spielschritt (ms): Server und Handys rechnen in genau diesen Schritten, damit alle dasselbe ausrechnen */
export const SIM_MS = 20
/** So weit (ms) rechnet der Server hinter der Echtzeit: so lange darf ein Wischer unterwegs sein, ohne zu spaet zu kommen */
export const VERZUG_MS = 280
/** Der Server schickt seinen Stand hoechstens alle so vielen Schritte */
export const STAND_SCHRITTE = 5

export type Phase = 'lobby' | 'spiel' | 'ende'
/** `revanche`: will nach dem Spiel noch eine Runde (Abstimmung im Ergebnis) */
export type Teilnehmer = SpielerInfo & { online: boolean; bereit: boolean; revanche?: boolean }
/** leben: 1 (Standard) oder 3 Leben je Spieler (im Koop gemeinsam); fehlt es (alter Server), gilt 1 */
export type Einstellungen = { tempo: Tempo; klassisch: boolean; leben?: 1 | 3 }

export type StartInfo = {
  modus: Modus
  seed: number
  spieler: SpielerInfo[]
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
  /** Wischer im Schritt `n` (seit dem Start); `i` = laufende Nummer dieses Geraets (fuer die Bestaetigung) */
  | { t: 'dir'; d: Dir; n: number; i: number }
  /** Reaktion (Index in REAKTIONEN) */
  | { t: 'emoji'; e: number }
  /** Rennen: eigene Schlange (Weltkoordinaten), Aepfel, Leben */
  | { t: 'pos'; b: P[]; d: Dir; a: number; l: number; tot: boolean; raus: boolean }
  /** Rennen: gewaehltes Gebiet k (Block in Weltkoordinaten) */
  | { t: 'gebiet'; k: number; b: P; d: Dir }
  /** `z`: Sendezeit beim Handy (kommt im pong zurueck, damit die Laufzeit stimmt, auch wenn mehrere Pings unterwegs sind) */
  | { t: 'ping'; z?: number }

/** Server -> App */
export type VomServer =
  | ({ t: 'raum'; code: string; gastgeber: string; phase: Phase; modus: Modus; spieler: Teilnehmer[]; ich: number } & Einstellungen)
  | { t: 'start'; info: StartInfo; jetzt: number }
  /** Stand des Servers nach `n` Schritten (nur geaenderte Felder); `e`: Ereignisse, die nur der Server entscheidet (raus) */
  | { t: 'z'; d: Zustand; n: number; e?: GameEvent[] }
  /** Ganzer Stand nach `n` Schritten (beim Start und fuer ein Geraet, das zurueckkommt) */
  | { t: 'voll'; z: Zustand; n: number }
  /** Wischer von Spieler `wer`, gilt im Schritt `n` (kann spaeter sein als gewuenscht, wenn er zu spaet kam); `q` = Reihenfolge beim Server */
  | { t: 'dir'; wer: number; d: Dir; n: number; i: number; q: number }
  | { t: 'emoji'; wer: number; e: number }
  | ({ t: 'geist' } & Geist)
  | { t: 'waehler'; k: number; wer: number }
  | { t: 'gebiet'; k: number; b: P; d: Dir; wer: number }
  | { t: 'raus'; wer: number; grund: 'leben' | 'abstand' }
  | { t: 'ende'; ergebnis: Ergebnis }
  | { t: 'fehler'; text: string }
  | { t: 'pong'; jetzt: number; z?: number }

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
