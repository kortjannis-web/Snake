export type P = { x: number; y: number }
export type Dir = 'u' | 'd' | 'l' | 'r'
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** Woran die Schlange gestorben ist */
export type Cause = 'rand' | 'selbst' | 'mauer' | 'teich' | 'gift' | 'falle' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner' | 'lava' | 'erde'

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

/** Liegender Tannenbaum: 1-1-3-1 Felder entlang `dir` (Stamm, Stamm, Krone breit, Spitze), symmetrisch */
export type Baum = { cells: P[]; root: P; dir: Dir; t: number }
/** Fenster: Wandfeld des Hauses und Richtung nach aussen */
export type Fenster = { p: P; d: Dir }
/** Haus: bleibt stehen. Vier Fenster (eins je Seite), eins davon leuchtet 2 Felder weit */
export type Haus = { cells: P[]; t: number; fenster: Fenster[]; licht: number; lichtT: number; strahl: P[]; kamin: number; klein?: boolean }
/** Jaegerturm 2x2: Lichtkegel 2 breit in eine Richtung, dreht sich jede Runde im Uhrzeigersinn.
 *  Der Kegel endet vor Hindernissen und wirft Schatten hinter der Schlange */
export type Turm = { c: P; cells: P[]; dir: Dir; t: number; kegel: P[]; kegelT: number; altDir: Dir }

/** Was in der Sandbox (Kreativ) auf die Karte kann */
export type SandboxObjekt = 'mauer' | 'teich' | 'gift' | 'baum' | 'haus' | 'turm' | 'falle' | 'wolke' | 'frosch' | 'gegner' | 'lila' | 'ameise' | 'lava' | 'eis'
export const SANDBOX_OBJEKTE: SandboxObjekt[] = ['mauer', 'teich', 'gift', 'baum', 'haus', 'turm', 'falle', 'wolke', 'frosch', 'gegner', 'lila', 'ameise', 'lava', 'eis']
/** Sandbox: eigene Kartengroesse (in Bloecken), Schlangenlaenge und Objekte.
 *  weiter = danach normal Level fuer Level, sonst bleibt die Welt so (nur der Apfel wandert) */
export type Sandbox = { breite: number; hoehe: number; laenge: number; objekte: Partial<Record<SandboxObjekt, number>>; weiter: boolean }

/** Kreativ-Modus: alles waehrend des Spiels umschaltbar */
export type Kreativ = {
  /** an = normal, anhalten = vor Hindernissen stehen bleiben, geist = durch alles hindurch */
  tod: 'an' | 'anhalten' | 'geist'
  rueckschlag: boolean
  durchSelbst: boolean
  wachsen: boolean
  laenge: number
}

/** Power-ups: Schild (ein Leben mehr: faengt einen Tod oder Rueckschlag ab), Zeitlupe, Geist (kurz durch Hindernisse),
 *  Schere (bis zum naechsten Apfel ein paar Glieder kuerzer), Fuettern (Tiere fressen, durch sich selbst) */
export type PowerArt = 'schild' | 'zeitlupe' | 'geist' | 'schere' | 'fuettern' | 'magnet' | 'maulwurf' | 'spitzhacke'
export type Power = { p: P; t: number; until: number; art: PowerArt }

/** Gegner-Schlange: rot, halb so schnell wie die Schlange, weicht ihr aus.
 *  Eingekesselt stirbt sie, wer lange ueberlebt, wird laenger */
export type Gegner = {
  /** Rot (halb so schnell) oder lila (laenger, schneller, boeser) */
  art: 'rot' | 'lila'
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
  /** Ueberrascht: so viele Schritte noch stur geradeaus (keine Zeit zum Lenken) */
  stur: number
}

export type Funke = { x: number; y: number; vx: number; vy: number; born: number; c: string }

/** Eisfeld: bleibt liegen, darauf laesst sich nicht lenken */
export type Eis = { cells: P[]; t: number }
/** Freigelegtes Erz auf der Karte (Gold oder Diamant), einsammeln wie einen Apfel */
export type Fund = { p: P; art: 'gold' | 'dia' | 'rubin' | 'opal'; t: number }

/** Lavasee: waechst alle paar Aepfel um ein Feld, bis er seine Groesse `ziel` erreicht hat.
 *  `t` je Feld = wann es dazukam */
export type Lava = { cells: P[]; t: number[]; ziel: number }

/** Ameise: sitzt an ihrem Platz (`heim`). Kommt die Schlange in den Umkreis, krabbelt sie langsam
 *  auf sie zu und beisst, wenn sie daneben ist. Danach (oder wenn die Schlange weg ist) zurueck nach Hause */
export type Ameise = {
  p: P
  from: P
  heim: P
  dir: Dir
  t: number
  /** Letzter Schritt (Animation) */
  schrittT: number
  next: number
  /** Seit wann sie die Schlange bemerkt hat (-1 = ruhig) */
  alarm: number
  /** Nach einem Biss bis hierhin satt (laeuft heim) */
  sattBis: number
}

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
  | { type: 'setback'; von: number; auf: number; grund: 'wolke' | 'licht' | 'kegel' | 'ameise' }
  | { type: 'tree' }
  | { type: 'house' }
  | { type: 'light' }
  | { type: 'tower' }
  | { type: 'geld'; wert: number; p: P; quelle: 'apfel' | 'gegner' | 'erz' | 'futter' }
  | { type: 'fund'; art: 'gold' | 'dia' | 'rubin' | 'opal'; p: P; wert: number }
  | { type: 'erzGesetzt'; art: 'gold' | 'dia' | 'rubin' | 'opal'; p: P }
  | { type: 'wahlVorbei' }
  | { type: 'gefressen'; was: 'frosch' | 'ameise' | 'gegner'; p: P; wert: number; art?: 'rot' | 'lila' }
  | { type: 'wahl'; offen: number }
  | { type: 'freigelegt'; dx: number; dy: number; anzahl: number }
  | { type: 'eis' }
  | { type: 'gegner'; p: P; art: 'rot' | 'lila' }
  | { type: 'ameise'; p: P }
  | { type: 'ameiseAlarm'; p: P }
  | { type: 'ameiseWeg'; p: P }
  | { type: 'lava'; p: P }
  | { type: 'lavaWachsen'; p: P }
  | { type: 'gegnerWeg'; p: P; laenge: number; wert: number; art: 'rot' | 'lila' }
  | { type: 'power'; art: PowerArt; p: P }
  | { type: 'powerEnde'; art: PowerArt }
  | { type: 'schild' }
  | { type: 'faktor'; faktor: number }

export type Unlock = 'mauer' | 'teich' | 'gebiet' | 'gift' | 'falle' | 'wolke' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner' | 'lila' | 'ameise' | 'lava' | 'eis' | 'maulwurf'
