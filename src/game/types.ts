export type P = { x: number; y: number }
export type Dir = 'u' | 'd' | 'l' | 'r'
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** Woran die Schlange gestorben ist */
export type Cause = 'rand' | 'selbst' | 'mauer' | 'teich' | 'gift' | 'falle' | 'wolke' | 'ameise' | 'baum' | 'haus'

export type Status = 'play' | 'over'

/** Mauer: geplante Felder, davon die ersten `grown` sichtbar (t = Zeitpunkt je Feld) */
export type Mauer = { cells: P[]; grown: number; t: number[]; next: number }
/** Teich: zusammenhaengende Felder Wasser. `drying` = Zeitpunkt, ab dem er austrocknet */
export type Teich = { cells: P[]; t: number; drying?: number }
/** Giftapfel: `ecke` = Winkel der verschimmelten Stelle */
export type Gift = { p: P; t: number; ecke: number }
/** Baerenfalle: liegt offen, schnappt am Ende zu und verschwindet */
export type Falle = { p: P; t: number; until: number }
/** Giftwolke: waechst alle 5 s um eine Stufe, verweilt und loest sich auf */
export type Wolke = {
  c: P
  t: number
  stage: number
  maxStage: number
  nextAt: number
  /** Ab hier loest sie sich auf (nicht mehr toedlich) */
  until: number
  cells: P[]
  /** Felder, die noch unter der Schlange liegen und erst danach dazukommen */
  pending: P[]
  /** Wann jedes Feld aus `cells` dazugekommen ist (fuer das Aufquellen) */
  bornAt: number[]
}
/** Ameise: laeuft alle paar Sekunden ein Feld geradeaus, verschwindet am Rand */
export type Ameise = { p: P; from: P; dir: Dir; t: number; movedAt: number; nextAt: number; gone?: number }

/** Liegender Tannenbaum: 1-1-2-1 Felder entlang `dir` (Stamm, Stamm, Krone breit, Spitze).
 *  `seite` = auf welcher Seite die breite Kronenreihe ein Feld mehr hat */
export type Baum = { cells: P[]; root: P; dir: Dir; seite: 1 | -1; t: number }
/** Fenster: Wandfeld des Hauses und Richtung nach aussen */
export type Fenster = { p: P; d: Dir }
/** Haus: bleibt stehen. Vier Fenster (eins je Seite), eins davon leuchtet 2 Felder weit */
export type Haus = { cells: P[]; t: number; fenster: Fenster[]; licht: number; lichtT: number; strahl: P[]; kamin: number }

export type Funke = { x: number; y: number; vx: number; vy: number; born: number; c: string }

/** Ereignisse fuer Toene, Vibration und Anzeige */
export type GameEvent =
  | { type: 'eat'; level: number; p: P }
  | { type: 'milestone'; level: number }
  | { type: 'expand'; side: Side; add: number; dx: number; dy: number }
  | { type: 'unlock'; what: Unlock; level: number }
  | { type: 'halt' }
  | { type: 'die'; cause: Cause }
  | { type: 'trap' }
  | { type: 'cloud' }
  | { type: 'cloudGrow' }
  | { type: 'ant' }
  | { type: 'antStep' }
  | { type: 'stolen' }
  | { type: 'wall' }
  | { type: 'pond' }
  | { type: 'setback'; von: number; auf: number; grund: 'wolke' | 'licht' }
  | { type: 'tree' }
  | { type: 'house' }
  | { type: 'light' }

export type Unlock = 'mauer' | 'teich' | 'gebiet' | 'gift' | 'falle' | 'wolke' | 'ameise' | 'baum' | 'haus'
