export type P = { x: number; y: number }
export type Dir = 'u' | 'd' | 'l' | 'r'
export type Side = 'top' | 'bottom' | 'left' | 'right'

/** Woran die Schlange gestorben ist */
export type Cause = 'rand' | 'selbst' | 'mauer' | 'teich' | 'gift' | 'falle' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner' | 'lava' | 'erde' | 'spieler' | 'zone' | 'zeit' | 'ziel' | 'flut' | 'sandwurm' | 'abgrund' | 'eiszapfen' | 'eisbruch' | 'yeti' | 'eisbaer' | 'robbe' | 'schneemann' | 'stein' | 'lore' | 'tnt' | 'spalt' | 'zwerg' | 'golem' | 'lorenlager' | 'irrlicht' | 'einhorn' | 'ent' | 'ranke' | 'wanderbaum' | 'zombiehand' | 'skelett' | 'werwolf' | 'riesenspinne'

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
  /** Wuestenfrosch (nur in der Wueste): springt doppelt so oft */
  schnell?: boolean
  drehT: number
  gone?: number
}

/** Tannenbaum. Erst steht er (von oben ein Plus um `root`), bis `kippBei` (null = liegt schon).
 *  Dann faellt er ab `fallT` langsam in Richtung `dir` und liegt danach 1-1-3-1 Felder entlang
 *  `dir` (Stamm, Stamm, Krone breit, Spitze), symmetrisch. `gelandet` = Aufschlag schon gemeldet.
 *  `ankDir` = kurz vor dem Kippen angekuendigte Richtung (er wackelt und verliert ein paar Blaetter dorthin) */
export type Baum = { cells: P[]; root: P; dir: Dir; t: number; kippBei: number | null; fallT: number; gelandet: boolean; ankDir?: Dir }
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
/** Tageslevel nutzen die Sandbox mit eigener Form: bloecke (Blockkoordinaten), aus = abgeschnittene Felder,
 *  dazu = Felder ausserhalb der Bloecke (Ausbuchtungen) */
export type Sandbox = { breite: number; hoehe: number; laenge: number; objekte: Partial<Record<SandboxObjekt, number>>; weiter: boolean; bloecke?: P[]; aus?: P[]; dazu?: P[] }

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
 *  Schere (bis zum naechsten Apfel ein paar Glieder kuerzer, die goldene viel mehr), Fuettern (Tiere fressen, durch sich selbst) */
export type PowerArt = 'schild' | 'zeitlupe' | 'geist' | 'schere' | 'goldschere' | 'fuettern' | 'magnet' | 'maulwurf' | 'spitzhacke'
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
  /** Das Glied der Schlange in seiner Bahn, das er schon bemerkt hat (Feld-Schluessel) */
  gesehen?: number
}

export type Funke = { x: number; y: number; vx: number; vy: number; born: number; c: string }

/** Eisfeld: bleibt liegen, darauf laesst sich nicht lenken */
/** Eisfeld. Winterwald: tritte = so oft ist der Kopf hineingefahren (1: Risse, 2: mehr Risse, beim dritten Mal bricht es ein) */
export type Eis = { cells: P[]; t: number; tritte?: number }

/** Welt-Gefahr mit Warnung, die auf Felder einschlaegt: bis `bis` waechst der Schatten, dann schlaegt sie ein.
 *  bleibt = danach liegt sie als Hindernis bis zum naechsten Apfel */
export type EinschlagArt = 'eiszapfen' | 'stein' | 'explosion' | 'zombiehand'
export type Einschlag = { art: EinschlagArt; cells: P[]; t: number; bis: number; gefallen: boolean; bleibt: boolean; weg?: number }
/** Sichtsperre (Schneesturm): kuendigt sich bis `ab` an, dann ist die Sicht bis `bis` fast weg */
export type Sichtsperre = { art: 'schneesturm'; t: number; ab: number; bis: number }
/** Tiere und Gestalten je Welt */
export type WesenArt = 'eisbaer' | 'robbe' | 'schneemann' | 'yeti' | 'zwerg' | 'golem' | 'irrlicht' | 'einhorn' | 'fee' | 'ent' | 'skelett' | 'werwolf' | 'gespenst' | 'riesenspinne' | 'kraehe'
export type Wesen = {
  art: WesenArt
  p: P
  from: P
  dir: Dir
  /** Erscheinen, letzter Schritt (Animation), naechster Schritt */
  t: number
  schrittT: number
  next: number
  heim: P
  /** Bis dahin satt (geht heim, greift nicht an) */
  sattBis: number
  /** Naechster Wurf (Schneeball) */
  wurfNext: number
}
/** Durchzug quer ueber die Karte (Lore auf Schienen, Fledermausschwarm): Reihe(n) `linie` (achse x = waagrecht),
 *  warnt bis `los`, dann zieht er mit `takt` ms je Feld von `von` bis `bis` durch (Kopf zuerst, `laenge` lang) */
export type Durchzug = { art: 'lore' | 'fledermaus' | 'kraehen'; achse: 'x' | 'y'; linie: number; breite: number; laenge: number; von: number; bis: number; dir: 1 | -1; t: number; los: number; takt: number; raus: boolean; verschont: boolean }
/** Schiene (Bergwerk): eine ganze Reihe oder Spalte der Karte; wo sie durch Stein zwischen zwei Kartenteilen fuehrt, ist ein Stollen */
export type Schiene = { achse: 'x' | 'y'; linie: number }
/** TNT mit Zuendschnur: der Funke laeuft die Schnur entlang (weg, Fass am Ende), dann explodiert es 3 x 3 */
export type Zuendschnur = { weg: P[]; fass: P; t: number; takt: number }
/** Erdbeben-Spalt: kuendigt sich bis `ab` an, dann offen (toedlich) bis zum naechsten Apfel */
export type Spalt = { cells: P[]; t: number; ab: number }
/** Ranke (Zauberwald): waechst vom Kartenrand Feld fuer Feld ins Feld (cells = geplant, grown = schon da), verwelkt nach ein paar Aepfeln */
export type Ranke = { cells: P[]; grown: number; t: number; next: number; aepfel: number }
/** Sporenwolke (Zauberwald): wer hineinfaehrt, ist kurz schneller */
export type Sporen = { cells: P[]; t: number; bis: number }
/** Pilzringe (Zauberwald): wer in den einen faehrt, kommt aus dem anderen */
export type Pilzringe = { a: P; b: P; t: number; bis: number }
/** Geschoss (Schneeball): fliegt geradeaus, ein Feld je Takt */
export type Geschoss = { art: 'schneeball'; p: P; from: P; dir: Dir; schrittT: number; next: number }
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
  | { type: 'eat'; level: number; p: P; stufe: number; wer?: number }
  | { type: 'milestone'; level: number }
  | { type: 'expand'; side: Side; add: number; dx: number; dy: number; block?: P; d?: Dir }
  | { type: 'unlock'; what: Unlock; level: number }
  | { type: 'halt' }
  | { type: 'die'; cause: Cause; wer?: number }
  | { type: 'trap' }
  | { type: 'cloud' }
  | { type: 'cloudGrow' }
  | { type: 'frog' }
  | { type: 'hop'; p: P }
  | { type: 'stolen' }
  | { type: 'wall' }
  | { type: 'pond' }
  | { type: 'setback'; von: number; auf: number; grund: 'wolke' | 'licht' | 'kegel' | 'ameise' | 'schneeball' | 'eisbaer' | 'fledermaus' | 'golem' | 'skelett' | 'werwolf' | 'gespenst'; wer?: number }
  | { type: 'tree'; p: P }
  | { type: 'house' }
  | { type: 'light' }
  | { type: 'tower' }
  | { type: 'geld'; wert: number; p: P; quelle: 'apfel' | 'gegner' | 'erz' | 'futter' }
  | { type: 'fund'; art: 'gold' | 'dia' | 'rubin' | 'opal'; p: P; wert: number }
  | { type: 'erzGesetzt'; art: 'gold' | 'dia' | 'rubin' | 'opal'; p: P }
  | { type: 'wahlVorbei' }
  | { type: 'gefressen'; was: 'frosch' | 'ameise' | 'gegner' | 'wesen'; p: P; wert: number; art?: 'rot' | 'lila' }
  | { type: 'wahl'; offen: number; wer?: number }
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
  /* Mehrspieler (wer = Index des Spielers) */
  | { type: 'zurueck'; wer: number }
  | { type: 'raus'; wer: number; grund: 'leben' | 'abstand' }
  | { type: 'ende' }
  /** Schrumpfende Karte: die Zone ist einen Ring weiter */
  | { type: 'zone'; stufe: number }
  /* Wueste (Insel) */
  | { type: 'sandsturm'; bis: number }
  | { type: 'flutWarnung' }
  | { type: 'flut' }
  | { type: 'flutEnde' }
  | { type: 'sandwurmWarnung' }
  | { type: 'sandwurm' }
  | { type: 'sandwurmBiss'; weg: number }
  | { type: 'sandwurmWeg' }
  | { type: 'einschlagWarnung'; art: EinschlagArt }
  | { type: 'einschlag'; art: EinschlagArt; p: P }
  | { type: 'abgetrennt'; weg: number }
  | { type: 'schneesturm' }
  | { type: 'polarnacht' }
  | { type: 'eisRiss'; stufe: number }
  | { type: 'wesen'; art: WesenArt }
  | { type: 'wurf'; p: P }
  | { type: 'platsch'; p: P }
  | { type: 'loreWarnung' }
  | { type: 'lore' }
  | { type: 'fledermaeuse' }
  | { type: 'zuendschnur' }
  | { type: 'explosion'; p: P }
  | { type: 'erdbeben' }
  | { type: 'netz'; p: P }
  | { type: 'erzAbgelegt'; p: P }
  | { type: 'spiegel' }
  | { type: 'ranke' }
  | { type: 'sporen' }
  | { type: 'eile' }
  | { type: 'teleport'; von: P; nach: P }
  | { type: 'regenbogen'; p: P; wert: number }
  | { type: 'geklaut'; was: 'apfel' | 'power'; p: P }
  | { type: 'zombiehaende' }
  | { type: 'kraehen' }
  | { type: 'vollmond' }
  /** Duell-Power-up: von trifft an */
  | { type: 'duell'; art: 'schere' | 'zeitlupe'; von: number; an: number; weg: number }

export type Unlock = 'mauer' | 'teich' | 'gebiet' | 'gift' | 'falle' | 'wolke' | 'frosch' | 'baum' | 'haus' | 'turm' | 'gegner' | 'lila' | 'ameise' | 'lava' | 'eis' | 'maulwurf'
