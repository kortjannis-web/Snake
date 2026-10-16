export type P = { x: number; y: number }
export type Dir = 'u' | 'd' | 'l' | 'r'
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** Woran die Schlange gestorben ist */
export type Cause = 'rand' | 'selbst' | 'mauer' | 'teich' | 'gift' | 'falle' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner'

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
/** Frosch: huepft alle paar Sekunden ein Feld in Blickrichtung, verschwindet ueber den Rand.
 *  `hopAt` naechster Sprung, `flugAb` Beginn des letzten Sprungs, `drehAt`/`neuDir` Wende nach der Landung */
export type Frosch = {
  p: P
  from: P
  dir: Dir
  t: number
  hopAt: number
  flugAb: number
  drehAt?: number
  neuDir?: Dir
  /** Blickrichtung vor der letzten Wende (fuer die Drehanimation) */
  altDir: Dir
  drehT: number
  gone?: number
}

/** Liegender Tannenbaum: 1-1-2-1 Felder entlang `dir` (Stamm, Stamm, Krone breit, Spitze).
 *  `seite` = auf welcher Seite die breite Kronenreihe ein Feld mehr hat */
export type Baum = { cells: P[]; root: P; dir: Dir; seite: 1 | -1; t: number }
/** Fenster: Wandfeld des Hauses und Richtung nach aussen */
export type Fenster = { p: P; d: Dir }
/** Haus: bleibt stehen. Vier Fenster (eins je Seite), eins davon leuchtet 2 Felder weit */
export type Haus = { cells: P[]; t: number; fenster: Fenster[]; licht: number; lichtT: number; strahl: P[]; kamin: number }
/** Jaegerturm 2x2: Lichtkegel 2 breit in eine Richtung, dreht sich jede Runde im Uhrzeigersinn.
 *  Der Kegel endet vor Hindernissen und wirft Schatten hinter der Schlange */
export type Turm = { c: P; cells: P[]; dir: Dir; t: number; kegel: P[]; kegelT: number; altDir: Dir }

/** Kreativ-Modus: alles waehrend des Spiels umschaltbar */
export type Kreativ = {
  /** an = normal, anhalten = vor Hindernissen stehen bleiben, geist = durch alles hindurch */
  tod: 'an' | 'anhalten' | 'geist'
  rueckschlag: boolean
  durchSelbst: boolean
  wachsen: boolean
  laenge: number
}

/** Power-ups: Schild (faengt einen Tod oder Rueckschlag ab), Zeitlupe, Geist (kurz durch Hindernisse),
 *  Schere (bis zum naechsten Apfel ein paar Glieder kuerzer) */
export type PowerArt = 'schild' | 'zeitlupe' | 'geist' | 'schere'
export type Power = { p: P; t: number; until: number; art: PowerArt }

/** Gegner-Schlange: rot, halb so schnell wie die Schlange, weicht ihr aus.
 *  Eingekesselt stirbt sie, wer lange ueberlebt, wird laenger */
export type Gegner = {
  body: P[]
  prev: P[]
  dir: Dir
  /** Erschienen */
  t: number
  /** Letzter Schritt (fuer die weiche Darstellung) */
  last: number
  /** Naechstes Glied mehr */
  wachsAt: number
  wachsRest: number
  /** Zuletzt gewachsen (fuer ein kurzes Aufleuchten) */
  wuchsT: number
  /** Schritte in Folge eingekesselt */
  eng: number
  /** 0 ruhig bis 1 auf der Flucht (fuer die Augen) */
  angst: number
}

export type Funke = { x: number; y: number; vx: number; vy: number; born: number; c: string }

/** Ereignisse fuer Toene, Vibration und Anzeige */
export type GameEvent =
  | { type: 'eat'; level: number; p: P; stufe: number }
  | { type: 'milestone'; level: number }
  | { type: 'expand'; side: Side; add: number; dx: number; dy: number }
  | { type: 'unlock'; what: Unlock; level: number }
  | { type: 'halt' }
  | { type: 'die'; cause: Cause }
  | { type: 'trap' }
  | { type: 'cloud' }
  | { type: 'cloudGrow' }
  | { type: 'frog' }
  | { type: 'hop'; p: P }
  | { type: 'stolen' }
  | { type: 'wall' }
  | { type: 'pond' }
  | { type: 'setback'; von: number; auf: number; grund: 'wolke' | 'licht' | 'kegel' }
  | { type: 'tree' }
  | { type: 'house' }
  | { type: 'light' }
  | { type: 'tower' }
  | { type: 'geld'; wert: number; p: P; quelle: 'apfel' | 'gegner' }
  | { type: 'gegner'; p: P }
  | { type: 'gegnerWeg'; p: P; laenge: number; wert: number }
  | { type: 'power'; art: PowerArt; p: P }
  | { type: 'powerEnde'; art: PowerArt }
  | { type: 'schild' }
  | { type: 'faktor'; faktor: number }

export type Unlock = 'mauer' | 'teich' | 'gebiet' | 'gift' | 'falle' | 'wolke' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner'
