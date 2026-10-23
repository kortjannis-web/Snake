/**
 * Zeichnet ein Spiel auf das Canvas: Kamera folgt der Schlange (die Karte
 * kann groesser als der Bildschirm werden), neue Gebiete klappen Feld fuer
 * Feld auf, Apfel ausserhalb des Bildes zeigt ein Pfeil am Rand.
 */
import { ABGESCHNITTEN_LIEGT, ABGESCHNITTEN_WEG, AMEISE_WEG, FLIEGT, GEGNER_WEG, GESCHOSS_TAKT, key, STICH_WARNUNG, STROM_KALT, WESEN_TAKT, WESEN_WEG, type Game } from '../game/game'
import { drawAbbruchLoch, drawAbbruchWarnung, drawBruecke, drawFischWarnung, drawGlut, drawGlutFleck, drawGlutgolem, drawGlutZiel, drawLavabombeFlug, drawLavafisch, drawLavastrom, drawMeteorFall, drawObsidian } from './glut'
import { drawBienen, drawBienenstock, drawErdmannLoch, drawFataMorgana, drawGeier, drawGeierKreis, drawHuegel, drawHuegelWarnung, drawIgel, drawKamel, drawKarawaneWarnung, drawKlapperschlange, drawMumie, drawRiesenskorpion, drawSandkrabbe, drawSarkophag } from './tiere'
import { drawEinhorn, drawEnt, drawFee, drawGespenst, drawIrrlichtSchein, drawKraehe, drawKraehenschwarm, drawPilzring, drawRanke, drawRegenbogen, drawRiesenspinne, drawSkelett, drawSpiegelfluch, drawSporen, drawVollmond, drawWanderbaum, drawWerwolf, drawZombiehand } from './waelder'
import { drawFledermaeuse, drawFledermausWarnung, drawGolem, drawLore, drawLoreAbgestellt, drawLoreWarnung, drawNetz, drawSchieneFeld, drawSpalt, drawSteinWarnung, drawStollenBoden, drawStolleneingang, drawTnt, drawZwerg } from './bergwerk'
import { drawEisbaer, drawEisblock, drawEisRisse, drawEiszapfenFall, drawEiszapfenSchatten, drawIglu, drawNordlicht, drawRobbe, drawSchneeball, drawSchneemann, drawSchneesturm, drawYeti } from './winter'
import { WUESTE } from '../game/rules'
import { MissionGame } from '../game/mission'
import type { BergKacheln } from './berge'
import { drawSandsturm, drawSandwurm, drawSandwurmWarnung } from './wueste'
import { abgrundKachel, drawAbgrund, drawSprudeln, drawVulkanBoden, type AbgrundKachel } from './vulkan'
import { BAUM_FALL, BAUM_WARNUNG, erdeBei, feldZufall, FROSCH_ANLAUF, FROSCH_FLUG, OPP, STEP, WOLKE_AUFLOESEN, WOLKE_WARNUNG, wolkenForm } from '../game/rules'
import type { Dir, Funke, GameEvent, Gegner, P, Wesen } from '../game/types'
import { blattFarbe, drawBaumLiegend, drawBaumStehend, drawBaumStehendSchnee, drawFallBlaetter, wackeln, type BaumArt } from './baeume'
import { drawGrosseErde } from './erde'
import { drawFlaeche, drawMeer, flaechenAufraeumen, meerKachel, type MeerKachel, type WasserArt } from './flaechen'
import { drawAmeiseWelt, drawWaldRand, drawDunkel, drawErdFeldWelt, drawFackel, drawFalleWelt, drawFroschWelt, drawFutter, drawMauerWelt, drawStimmung, drawWaldBoden, hausUeberzug, ohneErde, vulkanWelt, waldWelt, WELTEN, type Licht, type Welt } from './welten'
import { drawSchlange, farbeBei, GEGNER_SKIN, LILA_SKIN, Spuren, STANDARD, type Skin } from './skins'
import {
  apfelFarbe,
  apfelFarben,
  apfelPartikel,
  backOut,
  clamp01,
  DIR_WINKEL,
  drawErdDeko,
  drawErz,
  drawLava,
  drawLavaSchein,
  drawPower,
  drawKegel,
  drawTurm,
  drawApfel,
  drawHaus,
  drawLicht,
  drawWolkenFeld,
  drawWolkenKern,
  easeOut,
  rund,
} from './sprites'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** S-Kurve mit flachem Anfang und Ende (auch die Beschleunigung setzt weich ein) */
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
/** Weiches Maximum: wie Math.max, nur ohne Knick an der Uebergabestelle */
const weichMax = (a: number, b: number, k: number) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2
/** Kamera: Bereich-Kamera mit festem Ausschnitt, die neue Bereiche frueh und weich vorwegnimmt,
 *  oder Drohne, die weich und in lockeren Boegen hinterherfliegt */
export type KameraArt = 'bereich' | 'dynamisch'
/** Die Kamera zeigt je Richtung so viele Felder mehr als ein Bildschirm der Spiellogik */
const MEHR_SICHT = 2
/** Drohnen-Kamera: Federhaerte (1/ms) und wie weit sie vor dem Kopf schwebt (Felder) */
const DROHNE = 0.0038
const DROHNE_VORAUS = 1.5
/** Bereich-Kamera: Federhaerte (1/ms) und Dauer des weichen Wechsels in den neuen Ausschnitt (ms) */
const BEREICH = 0.013
const BEREICH_WECHSEL = 1100
/** So viele Felder weit leuchtet Lava im Stein durch die Erde */
const LAVA_SCHEIN = 2.5
/** Mindestabstand Kopf (Mitte) zum Bildrand in Feldern, wo Karte ist: auf der Seite, von der die
 *  Schlange wegfaehrt, und auf der, auf die sie zufaehrt (quer dazwischen) */
const RAND_HINTEN = 6
const RAND_VORN = 7.2
/** Letzte Sicherung in Laufrichtung (Felder ab Kopfmitte): 5 ganze Felder vor dem Kopf */
const RAND_SICHER = 5.5
/** Seite des Ausschnitts je Achse und Richtung */
/** Kantenlaenge einer Boden-Kachel in Feldern, und wie viele Kacheln hoechstens im Speicher bleiben */
/** Automatische Aufloesung: Pixeldichten von fein nach grob, ab dieser Bildzeit (Median und Schnitt, ms) eine Stufe groeber */
const AUFL_STUFEN = [2.5, 2, 1.7, 1.4, 1.15]
const AUFL_GRENZE = 24
const AUFL_BILDER = 90
const AUFL_KEY = 'snake.aufloesung.v1'
function lesStufe() {
  try {
    const v = Number(localStorage.getItem(AUFL_KEY))
    return Number.isFinite(v) ? Math.max(0, Math.min(AUFL_STUFEN.length - 1, Math.floor(v))) : 0
  } catch {
    return 0
  }
}
function schreibStufe(v: number) {
  try {
    localStorage.setItem(AUFL_KEY, String(v))
  } catch {
    /* Speicher blockiert: dann eben nur fuer diese Sitzung */
  }
}

const GRUND = 8
const GRUND_MAX = 48
/** Jedes Spiel bekommt eine Nummer (der Boden haengt an Welt und Einstellungen) */
const spielNr = new WeakMap<Game, number>()
let naechsteSpielNr = 1
const nummer = (g: Game) => spielNr.get(g) ?? (spielNr.set(g, naechsteSpielNr), naechsteSpielNr++)

/** Erdfeld nah an der Karte ist heller: 1 direkt daneben, 2 einen Schritt weiter, sonst 0 */
const erdRing = (drin: (x: number, y: number) => boolean, x: number, y: number) =>
  drin(x + 1, y) || drin(x - 1, y) || drin(x, y + 1) || drin(x, y - 1)
    ? 1
    : drin(x + 1, y + 1) || drin(x - 1, y - 1) || drin(x + 1, y - 1) || drin(x - 1, y + 1) || drin(x + 2, y) || drin(x - 2, y) || drin(x, y + 2) || drin(x, y - 2)
      ? 2
      : 0

const SEITE: Record<'x' | 'y', Record<1 | -1, Dir>> = { x: { 1: 'r', [-1]: 'l' }, y: { 1: 'd', [-1]: 'u' } }

/** Eine Schlange eines anderen Spielers (Mehrspieler): echt oder als Geist (Wettrennen) */
export type FremdeSchlange = {
  body: P[]
  prev: P[]
  dir: Dir
  skin: Skin
  /** Fortschritt zwischen den Feldern (0 bis 1) */
  alpha: number
  tot: boolean
  /** Deckkraft (Geist im Wettrennen durchscheinend) */
  deck: number
  name: string
}
export type MehrAnzeige = {
  andere: FremdeSchlange[]
  /** Die eigene Schlange ist gerade tot (wartet auf die Rueckkehr oder ist raus) */
  ichTot: boolean
  /** Leuchtende Waende nur fuer den, der waehlen darf */
  wahlSichtbar: boolean
  /** Schrumpfende Karte: Felder der Zone und der Ring, der gleich dazukommt */
  zone?: { zellen: P[]; bald: P[] }
  /** Reaktionen ueber den Koepfen (k = Alter 0 bis 1) */
  blasen?: { p: P; text: string; k: number }[]
}

/** Speedrun: kleine Blitze zucken um den doppelt wertvollen Apfel */
function apfelBlitze(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, now: number) {
  const takt = Math.floor(now / 90)
  const h = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.9)
  g.addColorStop(0, `rgba(255, 240, 150, ${0.25 + 0.15 * Math.sin(now / 120)})`)
  g.addColorStop(1, 'rgba(255, 240, 150, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x - cell, y - cell, cell * 2, cell * 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let k = 0; k < 2; k++) {
    if (h(takt * 3 + k) < 0.4) continue
    const a = h(takt + k * 7) * Math.PI * 2
    ctx.beginPath()
    for (let i = 0; i <= 4; i++) {
      const r = cell * (0.35 + i * 0.12)
      const q = (h(takt * 5 + i + k) - 0.5) * 0.6
      ctx.lineTo(x + Math.cos(a + q) * r, y + Math.sin(a + q) * r)
    }
    ctx.strokeStyle = 'rgba(255, 245, 170, 0.45)'
    ctx.lineWidth = Math.max(2, cell * 0.08)
    ctx.stroke()
    ctx.strokeStyle = '#FFFDE8'
    ctx.lineWidth = Math.max(1, cell * 0.03)
    ctx.stroke()
  }
}

export class Renderer {
  /** Mehrspieler: andere Schlangen und was nur dieses Geraet sieht (null = Einzelspiel) */
  mehr: MehrAnzeige | null = null
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  reduce = false
  skin: Skin = STANDARD
  /** Gewaehlte Welt (Boden, Baeume, Tiere, Stimmung) */
  welt: Welt = WELTEN[0]
  /** Speedrun: Aepfel ab Orange (doppelt wert) blitzen */
  blitzApfel = false
  /** Tageslevel: der letzte Apfel leuchtet pink (bringt 10 Aepfel) */
  sonderApfel = false
  /** Kampagne: Berge rund um die Taeler der Mission (statt Erde), null = normales Spiel */
  berge: BergKacheln | null = null
  /** Meer um die Insel (Wueste) in Kacheln: 'n|kx,ky' normal, 'f|kx,ky' bei Flut (Land ohne die Flutfelder) */
  private meer = new Map<string, { m: MeerKachel | null; benutzt: number }>()
  /** Stuecke vom vorigen Kartenstand: stehen noch da, bis die neuen fertig sind (die Neuberechnung ist auf mehrere Bilder verteilt) */
  private meerAlt = new Map<string, MeerKachel | null>()
  private meerStand = ''
  private meerFlut: Set<number> | null = null
  /** Vulkan: Abgrund in Kacheln wie das Meer (alte Stuecke bleiben stehen, bis die neuen fertig sind) */
  private abgrund = new Map<string, { m: AbgrundKachel | null; benutzt: number }>()
  private abgrundAlt = new Map<string, AbgrundKachel | null>()
  private abgrundStand = ''
  /** Hat die zuletzt gezeichnete Boden-Kachel den festen Teil des Abgrunds schon drin? */
  private gebackenerAbgrund = false
  /** Spuren hinter den Schlangen (Teilchen in Feldkoordinaten) */
  private spuren = new Spuren()
  private dpr = 1
  vw = 0
  vh = 0
  cell = 20
  kameraArt: KameraArt = 'bereich'
  private cam = { x: 0, y: 0 }
  /** Geschwindigkeit der Kamera (px/ms): sie faehrt wie an einer gedaempften Feder,
   *  beschleunigt also sanft und bremst sanft ab, nie ruckartig */
  private camV = { x: 0, y: 0 }
  /** Weich nachgezogenes Ziel der Feder: so setzt auch die Beschleunigung sanft ein */
  private camZiel = { x: 0, y: 0 }
  private camInit = false
  /** Spielzeit beim letzten Bild (steht sie, laeuft das Spiel gerade nicht) */
  private camZeit = -1
  /** Bereich-Kamera: aktueller Ausschnitt (linke obere Ecke in Feldern) */
  private frame = { x: 0, y: 0 }
  private frameOk = false
  /** Ziel beim letzten Bild (Felder) und wodurch es bestimmt war: aendert sich das
   *  (neuer Ausschnitt, Karte gewachsen, Erde), gleitet die Kamera mit Ease hinueber */
  private bLetzt: P | null = null
  /** Ziel samt Mindestsicht beim letzten Bild (Felder) */
  private bAus: P | null = null
  private bSig = ''
  private bSigKarte = ''
  private uebergaenge: { x: number; y: number; t: number; nach: boolean }[] = []
  private uhr = 0
  /** Weich nachgezogene Laufrichtung je Seite (0 weg, 1 darauf zu) in zwei Stufen, und Tempo (Felder/ms) */
  private bRicht: Record<Dir, [number, number]> = { u: [0, 0], d: [0, 0], l: [0, 0], r: [0, 0] }
  /** Geister-Feder (Felder): dieselbe Feder wie die Kamera, nur dass sie dem Kopf folgt. Wie weit
   *  sie hinter dem Kopf haengt, so weit haengt auch die Kamera hinterher, wenn sie dem Kopf folgen
   *  muss, auch beim Abbiegen und Umkehren (haengt nicht von der Kamera ab, schaukelt also nichts auf) */
  private geist = { x: 0, y: 0, zx: 0, zy: 0, vx: 0, vy: 0 }
  /** Weich nachgezogene Verschiebung durch die Sicherung (px, zwei Stufen je Achse) */
  private sichtGlatt = { x: [0, 0], y: [0, 0] }
  /** Was die Sicherung zu jeder Seite mindestens sehen will (Felder ab Kopfmitte) */
  private sichtNoetig = { x: { plus: 0, minus: 0 }, y: { plus: 0, minus: 0 } }
  private funken: Funke[] = []
  /** Aufsteigende Zahlen (+12) und Namen beim Einsammeln */
  private texte: { x: number; y: number; t: number; text: string; farbe: string }[] = []
  /** Minikarte unten links anzeigen */
  minikarte = true
  private shake = { until: 0, amp: 0 }
  private lastReal = 0
  /** Vorgerenderter Boden (Erde, Schachbrett, Grasrand) in Kacheln von GRUND x GRUND Feldern, in Geraetepixeln */
  /** Boden-Kacheln; abgrund = der feste Teil des Abgrunds (Vulkan) ist schon hineingezeichnet */
  private grund = new Map<string, { cv: HTMLCanvasElement; benutzt: number; abgrund?: boolean }>()
  private grundStand = ''
  private grundBild = 0
  /** Feste Einzelbilder (Stein einer Mauer, liegender Baum), einmal je Feldgroesse vorgerendert */
  private bilder = new Map<string, HTMLCanvasElement>()
  private bilderStand = ''

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
  }

  /**
   * Automatische Aufloesung: Ruckelt das Spiel auf diesem Geraet (Bilder dauern laenger als AUFL_GRENZE ms), wird das
   * Spielfeld eine Stufe groeber gerechnet (weniger Pixel, das Handy schafft wieder volle Bildrate). Die Stufe merkt sich
   * das Geraet; beim naechsten Start wird eine feinere Stufe probiert, damit eine einzelne schlechte Runde nicht fuer immer bleibt.
   */
  private stufe = Math.max(0, lesStufe() - 1)
  private messung: number[] = []
  private stufeSeit = 0

  private dprFuer() {
    return Math.min(AUFL_STUFEN[this.stufe], window.devicePixelRatio || 1)
  }

  /** Bildzeit eines laufenden Spiels mitzaehlen und bei Dauer-Ruckeln die Aufloesung senken */
  private bildzeit(dt: number, laeuft: boolean, realNow: number) {
    if (!laeuft || dt >= 100) return
    this.messung.push(dt)
    if (this.messung.length < AUFL_BILDER) return
    const m = this.messung.sort((a, b) => a - b)
    const median = m[m.length >> 1]
    const schnitt = m.reduce((a, b) => a + b, 0) / m.length
    this.messung = []
    if (median <= AUFL_GRENZE || schnitt <= AUFL_GRENZE || realNow - this.stufeSeit < 3000) return
    const fein = this.dprFuer()
    while (this.stufe < AUFL_STUFEN.length - 1 && this.dprFuer() >= fein) this.stufe++
    if (this.dprFuer() >= fein) return
    this.stufeSeit = realNow
    schreibStufe(this.stufe)
    this.resize(this.vw, this.vh)
  }

  resize(vw: number, vh: number) {
    this.dpr = this.dprFuer()
    this.vw = vw
    this.vh = vh
    this.canvas.width = Math.round(vw * this.dpr)
    this.canvas.height = Math.round(vh * this.dpr)
    this.canvas.style.width = `${vw}px`
    this.canvas.style.height = `${vh}px`
  }

  /** Neues Spiel: Kamera springt sofort an die richtige Stelle */
  reset() {
    this.camInit = false
    this.camV = { x: 0, y: 0 }
    this.frameOk = false
    this.sichtGlatt = { x: [0, 0], y: [0, 0] }
    this.funken = []
    this.texte = []
    this.shake = { until: 0, amp: 0 }
    this.spuren.leeren()
  }

  /** Feldgroesse so, dass ein Bildschirm (screenW x screenH) und je Richtung 2 Felder mehr hineinpassen */
  cellFor(g: Game) {
    return Math.max(4, Math.floor(Math.min(this.vw / (g.screenW + MEHR_SICHT), this.vh / (g.screenH + MEHR_SICHT))))
  }

  /** Neue Feldgroesse (Fenster geaendert): alles, was in Pixeln gespeichert ist, mitskalieren */
  private neueFeldgroesse(g: Game) {
    const neu = this.cellFor(g)
    if (neu !== this.cell && this.camInit) {
      const r = neu / this.cell
      for (const v of [this.cam, this.camZiel, this.camV]) {
        v.x *= r
        v.y *= r
      }
      for (const a of [this.sichtGlatt.x, this.sichtGlatt.y]) {
        a[0] *= r
        a[1] *= r
      }
      for (const f of this.funken) {
        f.x *= r
        f.y *= r
        f.vx *= r
        f.vy *= r
      }
      for (const t of this.texte) {
        t.x *= r
        t.y *= r
      }
    }
    this.cell = neu
  }

  event(e: GameEvent, g: Game) {
    const cell = this.cell
    if (e.type === 'eat' && !this.reduce) {
      const farben = apfelPartikel(e.stufe)
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.4
        const sp = cell * (1.1 + Math.random() * 1.0)
        this.funken.push({
          x: (e.p.x + 0.5) * cell,
          y: (e.p.y + 0.5) * cell,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - cell * 0.6,
          born: g.time,
          c: farben[i % farben.length],
        })
      }
    } else if (e.type === 'gegnerWeg' && !this.reduce) {
      // Gegner zerplatzt: rote Funken
      const farben = ['#E84A3C', '#FF8A73', '#801A22', '#F5EFE6']
      for (let i = 0; i < 18; i++) {
        const ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.3
        const sp = cell * (1.3 + Math.random() * 1.3)
        this.funken.push({
          x: (e.p.x + 0.5) * cell,
          y: (e.p.y + 0.5) * cell,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - cell * 0.5,
          born: g.time,
          c: farben[i % farben.length],
        })
      }
    } else if (e.type === 'expand') {
      // Alles ist um dx/dy gerutscht: Kamera mitnehmen, damit nichts springt
      this.kameraRutschen(e.dx, e.dy)
    } else if (e.type === 'freigelegt') {
      this.kameraRutschen(e.dx, e.dy)
      for (const f of [...this.funken, ...this.texte]) {
        f.x += e.dx * cell
        f.y += e.dy * cell
      }
    } else if (e.type === 'die') {
      if (!this.reduce) this.shake = { until: g.time + 450, amp: cell * 0.2 }
    } else if (e.type === 'fund') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: { gold: '#FFD86B', dia: '#9DF6FF', rubin: '#FF7D8F', opal: '#E99CFF' }[e.art] })
    } else if (e.type === 'geld' && e.quelle === 'futter') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: '#FFB38A' })
    } else if (e.type === 'geld' && e.quelle === 'gegner') {
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: `+${e.wert}`, farbe: apfelFarben(g.apfelStufe())[0][0] })
    } else if (e.type === 'power') {
      const name = {
        schild: 'Schild',
        zeitlupe: 'Zeitlupe',
        geist: 'Geist',
        schere: 'Schere',
        goldschere: 'Goldschere',
        fuettern: 'Füttern!',
        magnet: 'Magnet',
        maulwurf: 'Maulwurf',
        spitzhacke: 'Erz!',
      }[e.art]
      // Schere: an der Schnittstelle spritzen helle Funken (goldene: goldene), das Bild zuckt kurz
      const gold = e.art === 'goldschere'
      const schnitt = e.art === 'schere' || gold ? g.abgeschnitten[g.abgeschnitten.length - 1] : undefined
      const ab = schnitt && schnitt.t === g.time ? ` −${schnitt.cells.length}` : ''
      this.texte.push({ x: (e.p.x + 0.5) * cell, y: e.p.y * cell, t: g.time, text: name + (e.art === 'schere' || gold ? ab : ''), farbe: '#FFFFFF' })
      if (schnitt && schnitt.t === g.time && !this.reduce) {
        const c = schnitt.cells[0]
        for (let i = 0; i < (gold ? 20 : 12); i++) {
          const ang = (Math.PI * 2 * i) / (gold ? 20 : 12) + Math.random() * 0.4
          const sp = cell * (0.9 + Math.random() * 0.9)
          const farbe = gold ? (i % 2 ? '#FFE08A' : '#F2B824') : i % 2 ? '#FFFFFF' : '#C9D3DC'
          this.funken.push({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cell * 0.4, born: g.time, c: farbe })
        }
        this.shake = { until: g.time + 220, amp: cell * (gold ? 0.14 : 0.1) }
      }
    } else if (e.type === 'explosion' && !this.reduce) {
      for (let i = 0; i < 30; i++) {
        const ang = (Math.PI * 2 * i) / 30 + Math.random() * 0.3
        const sp = cell * (1.5 + Math.random() * 1.8)
        this.funken.push({ x: (e.p.x + 0.5) * cell, y: (e.p.y + 0.5) * cell, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cell * 0.4, born: g.time, c: ['#FFE08A', '#FF8A2A', '#C0392B', '#3A3A3A'][i % 4] })
      }
      this.shake = { until: g.time + 420, amp: cell * 0.25 }
    } else if (e.type === 'erdbeben' && !this.reduce) {
      // Das Beben wird zum Aufreissen hin schwaecher (die Staerke faellt mit der Restzeit)
      this.shake = { until: g.time + g.cfg.erdbebenWarnung * 1000, amp: cell * 0.03 }
    } else if ((e.type === 'einschlag' || e.type === 'platsch') && !this.reduce) {
      // Eis splittert bzw. Schnee spritzt
      const gross = e.type === 'einschlag'
      const art = e.type === 'einschlag' ? e.art : null
      const klein = art === 'zombiehand' || art === 'huegel' || art === 'geier'
      const n = gross ? (klein ? 12 : 22) : 10
      // Farben je Art: Eiszapfen splittern weiss-blau (2 x 2), alles andere trifft ein Feld
      const farben =
        art === 'zombiehand' || art === 'huegel'
          ? ['#4A3A2A', '#7A6A50', '#4A3A2A']
          : art === 'stein'
            ? ['#8A827C', '#C8BFB5', '#8A827C']
            : art === 'lavabombe' || art === 'meteor'
              ? ['#FF8A2A', '#FFE08A', '#3A2A24']
              : art === 'abbruch'
                ? ['#564A43', '#FF7A1A', '#3A302C']
                : art === 'geier'
                  ? ['#3A2A20', '#F0E6D8', '#3A2A20']
                  : ['#FFFFFF', '#FFFFFF', '#BFE3F5']
      const mitte = gross && art === 'eiszapfen' ? 1 : 0.5
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4
        const sp = cell * (gross ? 1.2 + Math.random() * 1.2 : 0.5 + Math.random() * 0.6)
        this.funken.push({ x: (e.p.x + mitte) * cell, y: (e.p.y + mitte) * cell, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - cell * 0.4, born: g.time, c: farben[i % 3] })
      }
      if (gross && !klein) this.shake = { until: g.time + 260, amp: cell * 0.12 }
    } else if (e.type === 'brueckeBricht' && !this.reduce) {
      // Die Bruecke zerfaellt in Brocken, die in den Krater fallen
      for (const c of e.cells)
        for (let i = 0; i < 6; i++) this.funken.push({ x: (c.x + Math.random()) * cell, y: (c.y + Math.random()) * cell, vx: (Math.random() - 0.5) * cell, vy: cell * (0.4 + Math.random()), born: g.time, c: i % 3 ? '#867670' : '#FF7A1A' })
    } else if (e.type === 'setback') {
      if (!this.reduce) this.shake = { until: g.time + 320, amp: cell * 0.14 }
    } else if (e.type === 'halt') {
      if (!this.reduce) this.shake = { until: g.time + 140, amp: cell * 0.07 }
    } else if (e.type === 'tree') {
      // Baum schlaegt auf: kurzes Beben, wenn man es sieht
      const nah = Math.abs((e.p.x + 0.5) * cell - this.cam.x) < this.vw / 2 + 3 * cell && Math.abs((e.p.y + 0.5) * cell - this.cam.y) < this.vh / 2 + 3 * cell
      if (nah && !this.reduce) this.shake = { until: g.time + 260, amp: cell * 0.09 }
    }
  }

  /** Wasser je Teich: mal tief mit Seerosen, mal klar mit bemoostem Ufer (fest je Teich, nach Weltfeld) */
  private wasserArt(c: P, o: P): WasserArt {
    const w = this.welt.wasser
    return w[Math.floor(feldZufall(c.x - o.x + 7, c.y - o.y + 3) * w.length) % w.length]
  }

  /** Baumart je Baum (fest nach Weltfeld des Stamms) */
  private baumArt(root: P, o: P): BaumArt {
    const b = this.welt.baeume
    return b[Math.floor(feldZufall(root.x - o.x + 5, root.y - o.y + 9) * b.length) % b.length]
  }

  /** Die Karte ist um dx/dy Felder gerutscht: alles, was die Kamera sich merkt, mitnehmen */
  private kameraRutschen(dx: number, dy: number) {
    const { cell } = this
    this.spuren.verschieben(dx, dy)
    for (const v of [this.cam, this.camZiel]) {
      v.x += dx * cell
      v.y += dy * cell
    }
    for (const v of [this.frame, this.bLetzt, this.bAus]) {
      if (!v) continue
      v.x += dx
      v.y += dy
    }
    this.geist.x += dx
    this.geist.zx += dx
    this.geist.y += dy
    this.geist.zy += dy
  }

  draw(g: Game) {
    const { ctx, vw, vh } = this
    // Noch keine Groesse (Layout im Aufbau): nichts zeichnen, sonst werden Kamerawerte ungueltig
    if (vw <= 0 || vh <= 0) return
    const realNow = performance.now()
    const dt = this.lastReal ? Math.min(100, realNow - this.lastReal) : 16
    this.lastReal = realNow
    this.bildzeit(dt, g.status === 'play' && g.time !== this.camZeit, realNow)
    const now = g.time
    this.neueFeldgroesse(g)
    const cell = this.cell
    const px = (v: number) => (v + 0.5) * cell

    // Schlange (weich zwischen den Feldern)
    const a = this.reduce ? 1 : g.alpha()
    const n = g.body.length
    const h0 = g.prev[0] ?? g.body[0]
    const head = { x: lerp(h0.x, g.body[0].x, a), y: lerp(h0.y, g.body[0].y, a) }

    const cam = this.kamera(g, cell, dt, head)
    let ox = Math.round(vw / 2 - cam.x)
    let oy = Math.round(vh / 2 - cam.y)
    if (now < this.shake.until) {
      const f = (this.shake.until - now) / 450
      ox += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
      oy += Math.round((Math.random() - 0.5) * 2 * this.shake.amp * f)
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Erde rund um die Karte: dunkelbraun, am Spielfeld eine hellere Erdkante.
    // Darin Steine, Kohle, Schlangenskelette, Lavataschen und Erze (fest je Weltfeld)
    const welt = this.welt
    ctx.fillStyle = welt.erde.grund
    ctx.fillRect(0, 0, vw, vh)
    ctx.translate(ox, oy)
    const lichter: Licht[] = []
    // Polarnacht (Winterwald): blendet Dunkelheit ein und aus, darueber das Nordlicht
    const pn = g.polarnacht
    const polar = !pn ? 0 : this.reduce ? (now < pn.bis ? 1 : 0) : Math.min(clamp01((now - pn.t) / 1500), 1 - clamp01((now - pn.bis) / 1500))
    const dunkel: Welt = polar > 0 && welt.finster <= 0 ? { ...welt, finster: 0.62 * polar, nacht: [4, 10, 26] } : welt
    const licht = (x: number, y: number, r: number) => dunkel.finster > 0 && lichter.push({ x: x + ox, y: y + oy, r })

    // Sichtbarer Bereich in Feldern (ex/ey auch ausserhalb der Karte)
    const ex0 = Math.floor(-ox / cell) - 1
    const ey0 = Math.floor(-oy / cell) - 1
    const ex1 = Math.ceil((vw - ox) / cell) + 1
    const ey1 = Math.ceil((vh - oy) / cell) + 1
    const x0 = Math.max(0, ex0)
    const y0 = Math.max(0, ey0)
    const x1 = Math.min(g.w - 1, ex1)
    const y1 = Math.min(g.h - 1, ey1)
    const sicht = (p: P, m = 2) => p.x >= x0 - m && p.x <= x1 + m && p.y >= y0 - m && p.y <= y1 + m
    const drin = (x: number, y: number) => g.inside({ x, y })
    const tunnel = new Set(g.tunnel.map((t) => t.x * 100_003 + t.y))
    const lavaStein: P[] = []
    // Waehrend ein neuer Block aufklappt, wird der Boden direkt gezeichnet, sonst kommt er aus den Kacheln
    const gb = g.gebiet && now - g.gebiet.t < 2600 && !this.reduce ? g.gebiet : null
    const kacheln = !gb
    if (kacheln) this.grundKacheln(g, cell, ox, oy, ex0, ey0, ex1, ey1)
    // Wueste: Meer rund um die Insel, mit weicher Kueste und Wellen, die an den Strand schwappen; dazu die Flut
    if (welt.id === 'wueste') this.meerZeichnen(g, cell, now, ex0, ey0, ex1, ey1)
    // Vulkan: Abgrund rund um die Plattform und in den Kratern, tief unten Lava, die hochsprudelt (keine Erde)
    const vulkan = vulkanWelt(welt)
    if (vulkan) {
      this.abgrundZeichnen(g, cell, now, ex0, ey0, ex1, ey1)
      if (!this.reduce) drawSprudeln(ctx, drin, g.ursprung, cell, now, ex0, ey0, ex1, ey1)
    }
    // Kampagne: rundherum Berge (vorgezeichnete Kacheln), keine Erde
    const berge = this.berge
    if (berge) berge.zeichnen(ctx, cell, this.dpr, ex0, ey0, ex1, ey1)
    if (!vulkan && !berge)
    for (let y = ey0; y <= ey1; y++)
      for (let x = ex0; x <= ex1; x++) {
        if (drin(x, y)) continue
        const wx = x - g.ursprung.x
        const wy = y - g.ursprung.y
        const z = feldZufall(wx, wy)
        if (tunnel.has(x * 100_003 + y)) {
          // Gegrabener Gang (Maulwurf)
          ctx.fillStyle = welt.id === 'wueste' ? '#C9AA6C' : '#7A5434'
          ctx.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
          ctx.fillStyle = 'rgba(40, 24, 14, 0.4)'
          ctx.fillRect(x * cell + cell * z * 0.6, y * cell + cell * 0.3, cell * 0.12, cell * 0.08)
          continue
        }
        const ring = erdRing(drin, x, y)
        if (!kacheln) drawErdFeldWelt(ctx, welt, x * cell, y * cell, cell, ring, z)
        // Bergwerk: Fackeln an der Wand
        if (welt.id === 'bergwerk' && ring === 1 && feldZufall(wx * 3 + 11, wy * 5 + 7) < 0.09) {
          drawFackel(ctx, px(x), px(y), cell, now)
          licht(px(x), px(y), cell * 3.2)
        }
        if (g.lavaImStein(wx, wy)) {
          lavaStein.push({ x, y })
          continue
        }
        const deko = erdeBei(g.cfg, wx, wy)
        if (!deko) continue
        // Erze glaenzen (bewegt), Stein, Kohle und Skelett liegen schon in der Kachel
        if (deko === 'gold' || deko === 'dia' || deko === 'rubin' || deko === 'opal') {
          if (g.erzDa(wx, wy)) drawErz(ctx, px(x), px(y), cell * 0.8, deko, 1, this.reduce ? 0 : Math.max(0, Math.sin(now / 400 + z * 20)) * 0.9, now, false)
        } else if (!kacheln && !ohneErde(welt)) drawErdDeko(ctx, x * cell, y * cell, cell, deko, z, now)
      }
    // Lava im Stein: das einzige, was in der Erde pulsierend glueht. Der Schein reicht ein paar Felder
    // weit durch die Erde, auch von knapp ausserhalb des Bildes, damit man sieht, wo Lava steckt
    const ls = Math.ceil(LAVA_SCHEIN)
    if (!vulkan && !berge)
    for (let y = ey0 - ls; y <= ey1 + ls; y++)
      for (let x = ex0 - ls; x <= ex1 + ls; x++) {
        if (drin(x, y) || !g.lavaImStein(x - g.ursprung.x, y - g.ursprung.y)) continue
        const puls = this.reduce ? 0.6 : 0.5 + 0.5 * Math.sin(now / 520 + x * 1.7 + y)
        drawLavaSchein(ctx, px(x), px(y), cell * (LAVA_SCHEIN + 0.6 + 0.4 * puls), 0.35 + 0.3 * puls)
      }
    for (const p of lavaStein) {
      drawLava(ctx, [p], [-1e9], cell, now, this.reduce)
      licht(px(p.x), px(p.y), cell * 1.6)
    }

    // Schachbrett nur auf der Karte; der neue Block klappt als Welle auf. Erst die
    // dunkle Flaeche je Block, dann die hellen Felder etwas groesser (sonst feine Fugen)
    if (!kacheln) {
    ctx.fillStyle = welt.dunkel
    for (const b of g.blocks) {
      if (gb && b.x * g.bw === gb.x && b.y * g.bh === gb.y) continue
      ctx.fillRect(b.x * g.bw * cell, b.y * g.bh * cell, g.bw * cell, g.bh * cell)
    }
    for (const c of g.extra) if (sicht(c)) ctx.fillRect(c.x * cell - 0.3, c.y * cell - 0.3, cell + 0.6, cell + 0.6)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!g.mask[y * g.w + x]) continue
        const neu = gb && x >= gb.x && x < gb.x + gb.w && y >= gb.y && y < gb.y + gb.h
        if (neu) {
          const dist = gb.side === 'top' ? gb.y + gb.h - 1 - y : gb.side === 'bottom' ? y - gb.y : gb.side === 'left' ? gb.x + gb.w - 1 - x : x - gb.x
          const p = clamp01((now - gb.t - 150 - dist * 45) / 380)
          if (p <= 0) continue
          const sz = cell * Math.min(1.08, backOut(p))
          ctx.fillStyle = p < 1 ? welt.neu : (x + y) % 2 ? welt.dunkel : welt.hell
          ctx.fillRect(x * cell + (cell - sz) / 2, y * cell + (cell - sz) / 2, sz, sz)
          continue
        }
        if ((x + y) % 2) continue
        ctx.fillStyle = welt.hell
        ctx.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
      }
    // Grasrand am Uebergang zur Erde
    ctx.fillStyle = welt.kante
    const kante = Math.max(2, cell * 0.1)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!g.mask[y * g.w + x]) continue
        if (!drin(x, y - 1)) ctx.fillRect(x * cell, y * cell, cell, kante)
        if (!drin(x, y + 1)) ctx.fillRect(x * cell, (y + 1) * cell - kante, cell, kante)
        if (!drin(x - 1, y)) ctx.fillRect(x * cell, y * cell, kante, cell)
        if (!drin(x + 1, y)) ctx.fillRect((x + 1) * cell - kante, y * cell, kante, cell)
      }
    }

    // Schrumpfende Karte: die Zone ist dunkelrot gestreift, der naechste Ring blinkt
    if (this.mehr?.zone) {
      const { zellen, bald } = this.mehr.zone
      ctx.fillStyle = 'rgba(110, 18, 26, 0.62)'
      for (const c of zellen) if (sicht(c, 1)) ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      ctx.strokeStyle = 'rgba(229, 70, 59, 0.35)'
      ctx.lineWidth = Math.max(1, cell * 0.08)
      ctx.beginPath()
      for (const c of zellen) {
        if (!sicht(c, 1)) continue
        ctx.moveTo(c.x * cell, (c.y + 1) * cell)
        ctx.lineTo((c.x + 1) * cell, c.y * cell)
      }
      ctx.stroke()
      if (bald.length && (this.reduce || Math.sin(now / 90) > 0)) {
        ctx.fillStyle = 'rgba(229, 70, 59, 0.28)'
        for (const c of bald) if (sicht(c, 1)) ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      }
    }

    // Neues Gebiet waehlen: die Waende, an die ein Block passt, gluehen (die letzten 5 s blinken sie)
    const blinkt = g.wahlBis - now < 5000 && !this.reduce && Math.sin(now / 70) < 0
    if (g.wahl > 0 && g.status === 'play' && !blinkt && (this.mehr?.wahlSichtbar ?? true)) {
      const belegt = new Set(g.blocks.map((b) => b.x * 1000 + b.y))
      const puls = this.reduce ? 1 : 0.5 + 0.5 * Math.sin(now / 170)
      for (const b of g.blocks)
        for (const d of ['u', 'd', 'l', 'r'] as const) {
          const st = STEP[d]
          if (belegt.has((b.x + st.x) * 1000 + b.y + st.y)) continue
          const bx = b.x * g.bw * cell
          const by = b.y * g.bh * cell
          const bw = g.bw * cell
          const bh = g.bh * cell
          const [ax, ay, zx, zy] =
            d === 'u' ? [bx, by, bx + bw, by] : d === 'd' ? [bx, by + bh, bx + bw, by + bh] : d === 'l' ? [bx, by, bx, by + bh] : [bx + bw, by, bx + bw, by + bh]
          ctx.lineCap = 'round'
          ctx.strokeStyle = `rgba(255, 180, 60, ${0.18 + 0.25 * puls})`
          ctx.lineWidth = cell * 0.7
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(zx, zy)
          ctx.stroke()
          ctx.strokeStyle = `rgba(255, 226, 120, ${0.7 + 0.3 * puls})`
          ctx.lineWidth = Math.max(2, cell * 0.14)
          ctx.stroke()
        }
    }

    // Lava und Eis. Freigelegte Lava, die noch nicht ausbrechen konnte, glimmt schon
    for (const p of g.lavaOffen) if (sicht(p)) drawErdDeko(ctx, p.x * cell, p.y * cell, cell, 'lava', feldZufall(p.x, p.y), now)
    // Lava, Eis und Teiche als zusammenhaengende Flaechen. Lava: frisch dazugekommene Felder wachsen
    // erst einzeln auf und gehoeren danach zur Flaeche
    flaechenAufraeumen()
    const o = g.ursprung
    for (const l of g.lava) {
      if (!l.cells.some((c) => sicht(c))) continue
      const fertig = l.cells.filter((_, i) => this.reduce || now - l.t[i] >= 420)
      drawFlaeche(ctx, fertig, 'lava', cell, now, o, this.reduce)
      if (fertig.length) {
        const xs = fertig.map((c) => c.x)
        const ys = fertig.map((c) => c.y)
        licht(((Math.min(...xs) + Math.max(...xs) + 1) / 2) * cell, ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * cell, cell * (1.5 + Math.sqrt(fertig.length) * 0.8))
      }
      l.cells.forEach((c, i) => {
        if (!this.reduce && now - l.t[i] < 420) drawLava(ctx, [c], [l.t[i]], cell, now)
      })
    }
    for (const e of g.eis) {
      if (!e.cells.some((c) => sicht(c))) continue
      // Im Winterwald eher unauffaellig (Schnee ringsum)
      ctx.globalAlpha = (this.reduce ? 1 : clamp01((now - e.t) / 700)) * (welt.id === 'winter' ? 0.6 : 1)
      drawFlaeche(ctx, e.cells, welt.finster > 0 ? 'eisNacht' : 'eis', cell, now, o, this.reduce)
      ctx.globalAlpha = 1
      // Winterwald: Risse nach dem ersten und zweiten Hineinfahren
      if (e.tritte && welt.id === 'winter') drawEisRisse(ctx, e.cells, cell, Math.min(2, e.tritte), e.t % 997, o)
    }

    // Teiche (wachsen auf, trocknen ggf. aus)
    for (const t of g.teiche) {
      if (!t.cells.some((c) => sicht(c))) continue
      let s = this.reduce ? 1 : backOut(clamp01((now - t.t) / 360))
      if (t.drying !== undefined) s *= 1 - clamp01((now - t.drying) / 1500)
      if (s <= 0) continue
      const art = this.wasserArt(t.cells[0], o)
      if (s < 1) {
        const xs = t.cells.map((c) => c.x)
        const ys = t.cells.map((c) => c.y)
        const mx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * cell
        const my = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * cell
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(s, s)
        ctx.translate(-mx, -my)
        drawFlaeche(ctx, t.cells, art, cell, now, o, this.reduce)
        ctx.restore()
      } else drawFlaeche(ctx, t.cells, art, cell, now, o, this.reduce)
      if (art === 'zauber' || art === 'hoehle') for (const c of t.cells) if ((c.x + c.y) % 2 === 0) licht(px(c.x), px(c.y), cell * 1.4)
    }

    // Wueste: Flut am Rand (Warnung: Gischt schlaegt hoeher, dann Wasser) und der Sandwurm kuendigt sich an
    const sw = g.sandwurm
    if (sw && now < sw.los) {
      const felder: P[] = []
      for (let v = sw.von; v <= sw.bis; v++)
        for (let b = 0; b < WUESTE.wurmBreite; b++) {
          const c = sw.achse === 'x' ? { x: v, y: sw.linie + b } : { x: sw.linie + b, y: v }
          if (g.inside(c) && sicht(c, 1)) felder.push(c)
        }
      drawSandwurmWarnung(ctx, felder, cell, now, clamp01((now - sw.t) / WUESTE.wurmWarnung), welt.id === 'vulkan')
    }

    // Alte Mauern schrumpfen weg, neue wachsen Feld fuer Feld
    if (!this.reduce) for (const m of g.weg) for (const c of m.cells) if (sicht(c)) drawMauerWelt(ctx, welt, c.x * cell, c.y * cell, cell, 1 - (now - m.t) / 240)
    for (const m of g.mauern)
      for (let i = 0; i < m.grown; i++) {
        if (!sicht(m.cells[i])) continue
        const s = this.reduce ? 1 : backOut(clamp01((now - m.t[i]) / 320))
        // Fertig gewachsene Steine kommen als Bild (viele Mauern = viele Steine)
        if (s >= 1 && now - m.t[i] > 320) this.bild(`stein-${welt.id}-${welt.mauer === 'stein' ? 0 : (m.cells[i].x * 13 + m.cells[i].y * 7) % 5}`, m.cells[i], cell, 0.2, (c, o) => drawMauerWelt(c, welt, o, o, cell, 1))
        else drawMauerWelt(ctx, welt, m.cells[i].x * cell, m.cells[i].y * cell, cell, s)
      }

    // Baeume und Haeuser (bleiben), dazu das Licht aus den Fenstern.
    // Baeume stehen erst (von oben ein Plus) und fallen dann langsam um
    for (const b of g.baeume) {
      if (!b.cells.some((c) => sicht(c, 3))) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - b.t) / 520))
      const art = this.baumArt(b.root, g.ursprung)
      const stehend = (off?: P, a = 1) => {
        ctx.globalAlpha = a
        if (welt.schnee) drawBaumStehendSchnee(ctx, art === 'weihnacht', b.root, cell, off ? 1 : s, now, off)
        else drawBaumStehend(ctx, art, b.root, cell, off ? 1 : s, now, off)
        ctx.globalAlpha = 1
      }
      if (art === 'kristall' || art === 'pilz') licht(px(b.root.x), px(b.root.y), cell * 2.4)
      if (b.kippBei !== null) {
        // Kurz vor dem Kippen: wackelt und verliert Blaetter in die angekuendigte Richtung
        const rest = b.kippBei - now
        if (b.ankDir && rest < BAUM_WARNUNG && !this.reduce) {
          const k = clamp01(1 - rest / BAUM_WARNUNG)
          stehend(wackeln(b.ankDir, k, now))
          drawFallBlaetter(ctx, blattFarbe(art, welt.schnee), b.root, b.ankDir, cell, BAUM_WARNUNG - rest)
        } else stehend()
        continue
      }
      const p = this.reduce ? 1 : clamp01((now - b.fallT) / BAUM_FALL)
      if (p >= 1) {
        // Liegender Baum (mit Schatten, teuer zu rastern): als Bild
        const bewegt = art === 'kristall' || art === 'pilz' || art === 'palme'
        if (s >= 1 && !bewegt) this.bild(`baum-${welt.id}-${art}-${b.dir}-${(b.root.x * 3 + b.root.y) % 4}`, b.root, cell, 4, (_c, _o, mitte) => drawBaumLiegend(_c, art, mitte, b.dir, cell, 1, 0, 1, welt.schnee))
        else drawBaumLiegend(ctx, art, b.root, b.dir, cell, s, now, 1, welt.schnee)
        continue
      }
      // Faellt: immer schneller (wie mit Schwerkraft). Von oben gesehen wird der liegende Baum
      // laenger (sin des Kippwinkels), die Krone von oben wandert mit und verschwindet.
      // Sein Schatten zeigt sofort, wo er landet
      const k = Math.sin((Math.PI / 2) * p * p)
      ctx.fillStyle = `rgba(12, 40, 32, ${0.2 * clamp01(p * 6) * (1 - k * 0.6)})`
      for (const c of b.cells) ctx.fillRect(c.x * cell, c.y * cell, cell, cell)
      drawBaumLiegend(ctx, art, b.root, b.dir, cell, 1, now, k, welt.schnee)
      const d = STEP[b.dir]
      stehend({ x: d.x * k * 2, y: d.y * k * 2 }, 1 - k)
    }
    for (const h of g.haeuser) {
      if (!h.cells.some((c) => sicht(c, 3))) continue
      const f = h.fenster[h.licht]
      const an = this.reduce ? 1 : clamp01((now - h.lichtT) / 450)
      if (f) drawLicht(ctx, f.p, f.d, h.strahl.length, cell, an * clamp01((now - h.t) / 600), now)
      drawHaus(ctx, h.cells, h.fenster, h.licht, h.kamin, cell, this.reduce ? 1 : backOut(clamp01((now - h.t) / 520)), now)
      // Winterwald: Huetten (2 x 2) als Iglu
      if (welt.id === 'winter' && g.cfg.igluAn > 0 && h.cells.length === 4) drawIglu(ctx, h.cells, cell)
      else hausUeberzug(ctx, welt, h.cells, cell)
      if (f) licht(px(f.p.x), px(f.p.y), cell * 2)
    }

    // Jaegertuerme: Kegel dreht sich mit, blendet nach jedem Wechsel ein
    for (const t of g.tuerme) {
      if (!t.cells.some((c) => sicht(c, 8))) continue
      const k = this.reduce ? 1 : easeOut(clamp01((now - t.kegelT) / 500))
      const a0 = DIR_WINKEL[t.altDir]
      let a1 = DIR_WINKEL[t.dir]
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
      const ang = lerp(a0, a1, k)
      const mitte = { x: (t.c.x + 1) * cell, y: (t.c.y + 1) * cell }
      drawKegel(ctx, t.kegel, mitte, DIR_WINKEL[t.dir], cell, k * clamp01((now - t.t) / 600), now)
      drawTurm(ctx, mitte.x, mitte.y, cell, ang, this.reduce ? 1 : backOut(clamp01((now - t.t) / 520)), now)
    }

    // Fallen: ploppen auf, blinken kurz vor dem Ende, schnappen zu
    for (const f of g.fallen) {
      if (!sicht(f.p)) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - f.t) / 380))
      const rest = f.until - now
      const warn = (now - f.t < 1600 ? 1 - (now - f.t) / 1600 : 0) + (rest < 3000 ? 0.5 + 0.5 * Math.sin(now / 90) : 0)
      drawFalleWelt(ctx, welt, px(f.p.x), px(f.p.y), cell, s, 0, Math.min(1, warn), now)
    }
    for (const f of g.fallenWeg) {
      if (!sicht(f.p)) continue
      const k = clamp01((now - f.t) / 1000)
      drawFalleWelt(ctx, welt, px(f.p.x), px(f.p.y), cell, 1 - easeOut(clamp01((k - 0.5) * 2)), easeOut(clamp01(k * 4)), 0, now)
    }

    // Apfel (Farbe nach Wert) und Giftaepfel (tarnen sich in derselben Farbe)
    const stufe = g.apfelStufe()
    const wipp = this.reduce ? 0 : Math.max(0, Math.sin(now / 260)) * cell * 0.05
    if (this.sonderApfel) {
      // Pinker Schlussapfel: pulsierender Schein und kleine Funkel
      const x = px(g.apple.p.x)
      const y = px(g.apple.p.y)
      const p = 0.5 + 0.5 * Math.sin(now / 220)
      const gl = ctx.createRadialGradient(x, y, 0, x, y, cell * (1.3 + 0.3 * p))
      gl.addColorStop(0, `rgba(255, 110, 200, ${0.55 + 0.25 * p})`)
      gl.addColorStop(1, 'rgba(255, 110, 200, 0)')
      ctx.fillStyle = gl
      ctx.fillRect(x - cell * 1.7, y - cell * 1.7, cell * 3.4, cell * 3.4)
      for (let i = 0; i < 5; i++) {
        const a = now / 700 + (i / 5) * Math.PI * 2
        ctx.fillStyle = `rgba(255, 220, 245, ${0.5 + 0.5 * Math.sin(now / 150 + i)})`
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * cell * 0.75, y + Math.sin(a) * cell * 0.75, cell * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    drawFutter(ctx, welt, px(g.apple.p.x), px(g.apple.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - g.apple.t) / 340)), wipp, undefined, this.sonderApfel ? 8 : stufe, now)
    licht(px(g.apple.p.x), px(g.apple.p.y), cell * 1.6)
    // Kampagne: die anderen Aepfel, die noch liegen
    if (g instanceof MissionGame)
      for (const ap of g.aepfel) {
        if (ap === g.apple || !sicht(ap.p)) continue
        drawFutter(ctx, welt, px(ap.p.x), px(ap.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - ap.t) / 340)), wipp, undefined, stufe, now)
        licht(px(ap.p.x), px(ap.p.y), cell * 1.6)
      }
    if (this.blitzApfel && stufe >= 2 && !this.reduce) apfelBlitze(ctx, px(g.apple.p.x), px(g.apple.p.y), cell, now)
    for (const pw of g.powers) {
      if (!sicht(pw.p)) continue
      drawPower(ctx, px(pw.p.x), px(pw.p.y), cell, pw.art, this.reduce ? 1 : backOut(clamp01((now - pw.t) / 380)), now, pw.until - now < 3000)
    }
    for (const f of g.funde) {
      if (!sicht(f.p)) continue
      const hop = this.reduce ? 0 : Math.sin(now / 300 + f.p.x) * cell * 0.04
      drawErz(ctx, px(f.p.x), px(f.p.y) - hop, cell, f.art, this.reduce ? 1 : backOut(clamp01((now - f.t) / 400)), this.reduce ? 0 : Math.max(0, Math.sin(now / 250 + f.p.y)), now)
    }
    for (const gf of g.gift) {
      if (!sicht(gf.p)) continue
      drawFutter(ctx, welt, px(gf.p.x), px(gf.p.y), cell, this.reduce ? 1 : backOut(clamp01((now - gf.t) / 340)), wipp * 0.6, gf.ecke, stufe, now)
    }

    // Froesche: Anlauf 1 s vor dem Sprung, Sprung im Bogen, Drehen nach der Landung
    for (const f of g.froesche) {
      const flug = (now - f.flugAb) / FROSCH_FLUG
      const k = clamp01(flug)
      const x = lerp(f.from.x, f.p.x, k)
      const y = lerp(f.from.y, f.p.y, k)
      if (!sicht({ x: Math.round(x), y: Math.round(y) })) continue
      const s = this.reduce ? 1 : backOut(clamp01((now - f.t) / 420))
      const fade = f.gone !== undefined ? 1 - clamp01((now - f.gone - FROSCH_FLUG * 0.5) / 400) : 1
      const anlauf = f.gone === undefined ? clamp01(1 - (f.hopAt - now) / FROSCH_ANLAUF) : 0
      const a0 = DIR_WINKEL[f.altDir]
      let a1 = DIR_WINKEL[f.dir]
      while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
      while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
      const ang = lerp(a0, a1, easeOut(clamp01((now - f.drehT) / 220)))
      drawFroschWelt(ctx, welt, px(x), px(y), cell, ang, this.reduce ? 0 : anlauf, this.reduce || flug > 1 ? -1 : k, s, fade, now, !!f.schnell)
      if (welt.frosch === 'leuchtfrosch') licht(px(x), px(y), cell * 1.5)
    }

    // Ameisen: krabbeln Feld fuer Feld, Ausrufezeichen wenn sie die Schlange bemerkt haben
    for (const am of g.ameisen) {
      if (!sicht(am.p)) continue
      const k = this.reduce ? 1 : easeOut(clamp01((now - am.schrittT) / 260))
      const x = lerp(am.from.x, am.p.x, k)
      const y = lerp(am.from.y, am.p.y, k)
      const lauf = k < 1 ? (now / 160) % 1 : -1
      const alarm = am.alarm >= 0 ? 0.6 + 0.4 * Math.sin(now / 90) : 0
      drawAmeiseWelt(ctx, welt, px(x), px(y), cell, DIR_WINKEL[am.dir], lauf, this.reduce ? 1 : backOut(clamp01((now - am.t) / 380)), alarm, 1, now)
      if (welt.ameise === 'gluehkaefer') licht(px(x), px(y), cell * 1.2)
    }
    for (const am of g.ameisenWeg) {
      if (!sicht(am.p)) continue
      const k = clamp01((now - am.t) / AMEISE_WEG)
      drawAmeiseWelt(ctx, welt, px(am.p.x), px(am.p.y), cell * (1 + k * 0.4), DIR_WINKEL[am.dir], -1, 1, 0, 1 - k, now)
    }

    // Einschlaege: Schatten als Warnung, danach der liegende Block (bis zum naechsten Apfel)
    for (const e of g.einschlaege) {
      if (e.art === 'explosion' || !e.cells.some((c) => sicht(c))) continue
      const k = clamp01((now - e.t) / Math.max(1, e.bis - e.t))
      const alter = now - e.bis
      if (e.art === 'zombiehand') drawZombiehand(ctx, e.cells[0], cell, k, e.gefallen, now)
      else if (e.art === 'abbruch') {
        if (!e.gefallen) drawAbbruchWarnung(ctx, e.cells, cell, k, now)
        else drawAbbruchLoch(ctx, e.cells, cell, this.reduce ? 1000 : alter, now)
      } else if (e.art === 'lavabombe' || e.art === 'meteor') {
        if (!e.gefallen) drawGlutZiel(ctx, e.cells[0], cell, k, now, e.art === 'lavabombe' ? 'lava' : 'meteor')
        else drawGlutFleck(ctx, e.cells[0], cell, alter, now)
      } else if (e.art === 'huegel') {
        if (!e.gefallen) drawHuegelWarnung(ctx, e.cells[0], cell, k, now)
        else drawHuegel(ctx, e.cells[0], cell, this.reduce ? 1 : backOut(clamp01(alter / 260)), clamp01(((e.weg ?? now) - now) / 400))
      } else if (e.art === 'geier') {
        // Der Geier sitzt kurz auf dem Feld, dann fliegt er davon (der Kreis davor kommt ueber die Schlange)
        if (e.gefallen) drawGeier(ctx, (e.cells[0].x + 0.5) * cell, (e.cells[0].y + 0.5) * cell, cell, -Math.PI / 2, now, 1 + clamp01(alter / 700) * 0.3, clamp01(((e.weg ?? now) - now) / 300))
      } else if (e.art === 'stein') {
        if (!e.gefallen) drawSteinWarnung(ctx, e.cells[0], cell, k, now)
        else if (e.bleibt) drawMauerWelt(ctx, welt, e.cells[0].x * cell, e.cells[0].y * cell, cell, this.reduce ? 1 : backOut(clamp01((now - e.bis) / 300)))
      } else if (!e.gefallen) drawEiszapfenSchatten(ctx, e.cells, cell, k, now)
      else if (e.bleibt) drawEisblock(ctx, e.cells, cell, this.reduce ? 1000 : now - e.bis)
    }
    // Bergwerk: Netze, abgestellte Loren, Erdbeben-Spalten, TNT, Glocke vor der Lore
    for (const nz of g.netze) if (sicht(nz.p)) drawNetz(ctx, nz.p, cell, this.reduce ? 1 : clamp01((now - nz.t) / 400))
    for (const p of g.loren) if (sicht(p)) drawLoreAbgestellt(ctx, p, cell)
    for (const sp of g.spalten) if (sp.cells.some((c) => sicht(c))) drawSpalt(ctx, sp.cells, cell, clamp01((now - sp.t) / Math.max(1, sp.ab - sp.t)), now >= sp.ab, now)
    for (const z of g.zuendschnuere) {
      if (!sicht(z.fass, 6)) continue
      const f = (now - z.t) / z.takt
      drawTnt(ctx, z.weg, z.fass, cell, Math.floor(f), f - Math.floor(f), now)
    }
    for (const d of g.durchzuege) {
      if (d.art !== 'lore' || now >= d.los) continue
      const f = g.schieneFelder({ achse: d.achse, linie: d.linie })
      if (f) drawLoreWarnung(ctx, f.cells, cell, clamp01((now - d.t) / Math.max(1, d.los - d.t)), now)
    }
    // Zauberwald: Sporen, Regenbogen, Pilzringe, Ranken, wandernde Baeume
    for (const sp of g.sporen) if (sp.cells.some((c) => sicht(c))) drawSporen(ctx, sp.cells, cell, now, Math.min(clamp01((now - sp.t) / 500), clamp01((sp.bis - now) / 800)))
    for (const r of g.regenbogen) if (sicht(r.p)) drawRegenbogen(ctx, r.p, cell, now - r.t, now)
    if (g.pilzringe) for (const p of [g.pilzringe.a, g.pilzringe.b]) if (sicht(p)) drawPilzring(ctx, p, cell, now, clamp01((now - g.pilzringe.t) / 500) * clamp01((g.pilzringe.bis - now) / 1000))
    for (const r of g.ranken) {
      if (!r.cells.some((c) => sicht(c))) continue
      for (let i = 0; i < r.grown; i++) {
        const von = i > 0 ? r.cells[i - 1] : { x: 2 * r.cells[0].x - (r.cells[1]?.x ?? r.cells[0].x), y: 2 * r.cells[0].y - (r.cells[1]?.y ?? r.cells[0].y) }
        const s = i === r.grown - 1 && i > 0 ? (this.reduce ? 1 : easeOut(clamp01((now - (r.next - g.cfg.rankenTakt * 1000)) / 500))) : 1
        drawRanke(ctx, r.cells[i], von, cell, s, now)
      }
    }
    for (const b of g.wanderbaeume) {
      if (!sicht(b.p)) continue
      const k = this.reduce ? 1 : clamp01((now - b.t) / 450)
      drawWanderbaum(ctx, px(lerp(b.from.x, b.p.x, easeOut(k))), px(lerp(b.from.y, b.p.y, easeOut(k))), cell, now, k)
    }
    // Vulkan: Lavastroeme, Glutspur, Bruecken, Obsidian; Wiese: Bienenstoecke
    for (const l of g.lavastroeme) {
      if (!l.cells.some((c) => sicht(c))) continue
      const vorn = this.reduce ? 1 : easeOut(clamp01((now - (l.next - g.cfg.lavastromTakt * 1000)) / 500))
      drawLavastrom(ctx, l.cells, l.grown, cell, l.grown > 1 ? vorn : 1, l.kalt ? clamp01((now - l.kalt) / STROM_KALT) : 0, now)
    }
    for (const gl of g.glut) if (sicht(gl.p)) drawGlut(ctx, gl.p, cell, clamp01((gl.bis - now) / Math.max(1, gl.bis - gl.t)), now)
    for (const b of g.bruecken) if (b.cells.some((c) => sicht(c))) drawBruecke(ctx, b.cells, cell, clamp01(b.ueber / Math.max(1, g.cfg.brueckeUeber)), this.reduce ? 1 : clamp01((now - b.t) / 400))
    for (const o of g.obsidiane) if (sicht(o.p)) drawObsidian(ctx, o.p, o.offen, cell, now, Math.min(clamp01((now - o.t) / 400), clamp01((o.bis - now) / 600)))
    for (const b of g.stoecke) if (sicht(b.p)) drawBienenstock(ctx, b.p, cell, now, Math.min(clamp01((now - b.t) / 400), clamp01((b.bis - now) / 600)))
    // Wueste: Fata Morgana, Erdmaennchen, Sarkophage (die falsche Kaktusfeige flackert leicht)
    for (const f of g.fatas) {
      if (!sicht(f.p, 2)) continue
      const a = Math.min(clamp01((now - f.t) / 600), clamp01((f.bis - now) / 600))
      drawFataMorgana(ctx, f.cells, cell, now, a)
      ctx.globalAlpha = a * (0.75 + 0.2 * Math.sin(now / 110))
      drawFutter(ctx, welt, px(f.p.x), px(f.p.y) + Math.sin(now / 160) * cell * 0.04, cell, 1, 0, undefined, g.apfelStufe(), now)
      ctx.globalAlpha = 1
    }
    for (const k of g.kolonien) {
      if (!k.loecher.some((c) => sicht(c))) continue
      const a = Math.min(clamp01((now - k.t) / 400), clamp01((k.bis - now) / 600))
      k.loecher.forEach((c, i) => drawErdmannLoch(ctx, c, cell, g.aufSchlange(c) ? 'unten' : g.erdmannZustand(k, i), a))
    }
    for (const sk of g.sarkophage) if (sicht(sk.p)) drawSarkophag(ctx, sk.p, cell, sk.auf < 0 ? 1 : 0, Math.min(clamp01((now - sk.t) / 400), clamp01((sk.bis - now) / 600)), now)
    // Welt-Wesen (Tiere und Gestalten) und Schneebaelle; Fliegende kommen ueber die Schlange
    for (const w of g.wesen) if (sicht(w.p) && !FLIEGT.has(w.art)) this.drawWesen(g, w, now, 1, 1)
    for (const { w, t } of g.wesenWeg) {
      if (!sicht(w.p)) continue
      const k = clamp01((now - t) / WESEN_WEG)
      this.drawWesen(g, w, now, 1 + k * 0.4, 1 - k)
    }
    for (const s of g.geschosse) {
      if (!sicht(s.p)) continue
      const k = this.reduce ? 1 : clamp01((now - s.schrittT) / GESCHOSS_TAKT)
      drawSchneeball(ctx, px(lerp(s.from.x, s.p.x, k)), px(lerp(s.from.y, s.p.y, k)), cell, k)
    }

    // Spuren (Teilchen hinter den Schlangen)
    if (!this.reduce) this.spuren.draw(ctx, cell, now)

    // Gegner-Schlangen (und besiegte, die zerfallen)
    for (const e of g.gegner) if (e.body.some((p) => sicht(p))) this.drawGegner(g, e, now)
    for (const w of g.gegnerWeg) if (w.g.body.some((p) => sicht(p))) this.drawGegner(g, w.g, now, w.t)

    // Von der Schere abgeschnittener Schwanz: bleibt kurz liegen, dann verblasst er
    for (const st of g.abgeschnitten) if (st.cells.some((p) => sicht(p))) this.drawAbgeschnitten(st, now)

    // Andere Spieler (Mehrspieler), darueber ihre Namen
    if (this.mehr) for (const f of this.mehr.andere) if (f.body.some((p) => sicht(p))) this.drawFremde(f, now)

    // Schlange
    if (n) this.drawSchlange(g, head, a)
    if (this.mehr) for (const f of this.mehr.andere) if (!f.tot && f.name && f.body.some((p) => sicht(p))) this.drawName(f)
    if (this.mehr?.blasen) for (const b of this.mehr.blasen) if (sicht(b.p, 2)) this.drawBlase(b)
    this.drawGrabWarnung(g, head, now)
    // Fliegende Wesen (Fee, Gespenst, Kraehe)
    for (const w of g.wesen) if (sicht(w.p) && FLIEGT.has(w.art)) this.drawWesen(g, w, now, 1, 1)
    // Lore, Fledermaeuse und Kraehen (ueber der Schlange)
    for (const d of g.durchzuege) {
      const k = g.durchzugKopf(d)
      if (d.art === 'kraehen') {
        if (k !== null) drawKraehenschwarm(ctx, g.durchzugFelder(d), cell, d.dir, d.achse, now)
        continue
      }
      if (d.art === 'karawane') {
        if (k === null) {
          const v = d.dir === 1 ? d.von : d.bis
          drawKarawaneWarnung(ctx, d.achse === 'x' ? { x: v, y: d.linie } : { x: d.linie, y: v }, cell, clamp01((now - d.t) / Math.max(1, d.los - d.t)), now)
          continue
        }
        const ang = d.achse === 'x' ? (d.dir === 1 ? 0 : Math.PI) : d.dir === 1 ? Math.PI / 2 : -Math.PI / 2
        for (let i = 0; i < d.laenge; i++) {
          const v = k - d.dir * i
          const c = d.achse === 'x' ? { x: Math.round(v), y: d.linie } : { x: d.linie, y: Math.round(v) }
          if (v < d.von - 1 || v > d.bis + 1 || !sicht(c, 1)) continue
          const x = d.achse === 'x' ? (v + 0.5) * cell : (d.linie + 0.5) * cell
          const y = d.achse === 'x' ? (d.linie + 0.5) * cell : (v + 0.5) * cell
          drawKamel(ctx, x, y, cell, ang, (now / 520 + i * 0.37) % 1, i === 0)
        }
        continue
      }
      if (k === null) {
        if (d.art === 'fledermaus') {
          const [x0, y0, w, h] = d.achse === 'x' ? [d.von * cell, d.linie * cell, (d.bis - d.von + 1) * cell, d.breite * cell] : [d.linie * cell, d.von * cell, d.breite * cell, (d.bis - d.von + 1) * cell]
          drawFledermausWarnung(ctx, x0, y0, w, h, clamp01((now - d.t) / Math.max(1, d.los - d.t)), now)
        }
        continue
      }
      if (d.art === 'fledermaus') {
        drawFledermaeuse(ctx, g.durchzugFelder(d), cell, now)
        continue
      }
      // Lore: weich laengs, drei Wagen
      for (let i = 0; i < d.laenge; i++) {
        const v = k - d.dir * i
        if (v < d.von - 1 || v > d.bis + 1) continue
        const x = d.achse === 'x' ? (v + 0.5) * cell : (d.linie + 0.5) * cell
        const y = d.achse === 'x' ? (d.linie + 0.5) * cell : (v + 0.5) * cell
        drawLore(ctx, x, y, cell, d.achse, i === 0)
      }
    }
    // Eiszapfen im Fall (ueber der Schlange)
    for (const e of g.einschlaege) {
      if (e.gefallen || !e.cells.some((c) => sicht(c, 6))) continue
      const k = clamp01((now - e.t) / Math.max(1, e.bis - e.t))
      if (e.art === 'geier') drawGeierKreis(ctx, e.cells[0], cell, k, now)
      if (this.reduce) continue
      if (e.art === 'eiszapfen' && k > 0.72) drawEiszapfenFall(ctx, e.cells, cell, (k - 0.72) / 0.28)
      else if (e.art === 'meteor' && k > 0.72) drawMeteorFall(ctx, e.cells[0], cell, (k - 0.72) / 0.28)
      else if (e.art === 'lavabombe' && e.von && k > 0.6) drawLavabombeFlug(ctx, e.von, e.cells[0], cell, (k - 0.6) / 0.4, now)
    }
    for (const f of g.lavafische) {
      if (!sicht(f.von, 9)) continue
      const n = f.cells.length
      if (now < f.los) drawFischWarnung(ctx, f.von, f.cells, cell, clamp01((now - f.t) / Math.max(1, f.los - f.t)), now)
      else if (now < f.los + (n + 1) * f.takt) drawLavafisch(ctx, f.von, f.nach, n, (now - f.los) / f.takt - 1, cell, now)
    }
    const swKopf = g.sandwurmKopf()
    if (sw && swKopf !== null) drawSandwurm(ctx, sw.achse, sw.linie + WUESTE.wurmBreite / 2, swKopf, sw.dir, WUESTE.wurmLaenge, sw.von, sw.bis, cell, now, welt.id === 'vulkan')

    // Giftwolken ueber allem (mit Warnung vor dem Wachsen)
    for (const w of [...g.wolken, ...g.wolkenWeg]) {
      if (!sicht(w.c, 4)) continue
      const auf = w.until !== Infinity && now >= w.until ? 1 - clamp01((now - w.until) / WOLKE_AUFLOESEN) : 1
      w.cells.forEach((c, i) => {
        const s = this.reduce ? 1 : easeOut(clamp01((now - w.bornAt[i]) / 520))
        drawWolkenFeld(ctx, px(c.x), px(c.y), cell, s * (0.6 + 0.4 * auf), auf, now, c.x * 3.1 + c.y * 1.7)
      })
      for (const c of w.pending) drawWolkenFeld(ctx, px(c.x), px(c.y), cell, 0.7, 0.35 * auf, now, c.x + c.y)
      if (w.stage < w.maxStage && w.nextAt - now < WOLKE_WARNUNG && auf === 1) {
        const p = 0.5 + 0.5 * Math.sin(now / 80)
        const has = new Set(w.cells.map((c) => c.x * 10000 + c.y))
        ctx.strokeStyle = `rgba(150, 180, 40, ${0.35 + 0.45 * p})`
        ctx.lineWidth = Math.max(1.5, cell * 0.06)
        ctx.setLineDash([cell * 0.12, cell * 0.1])
        for (const o of wolkenForm(w.stage + 1)) {
          const c = { x: w.c.x + o.x, y: w.c.y + o.y }
          if (has.has(c.x * 10000 + c.y) || !g.inside(c)) continue
          ctx.beginPath()
          ctx.arc(px(c.x), px(c.y), cell * 0.36, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
      drawWolkenKern(ctx, px(w.c.x), px(w.c.y), cell, auf, now)
    }

    // Dunkelheit (Bergwerk, Zauberwald, Gruselwald) mit Lichtern, dann Wetter und Teilchen
    if (dunkel.finster > 0) {
      licht((head.x + 0.5) * cell, (head.y + 0.5) * cell, cell * 4.2)
      for (const pw of g.powers) licht(px(pw.p.x), px(pw.p.y), cell * 1.2)
      for (const f of g.funde) licht(px(f.p.x), px(f.p.y), cell * 1.3)
      if (this.mehr) for (const f of this.mehr.andere) if (f.body.length) licht(px(f.body[0].x), px(f.body[0].y), cell * 3)
      drawDunkel(ctx, dunkel, vw, vh, this.dpr, lichter)
    }
    if (polar > 0 && !this.reduce) {
      ctx.save()
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      drawNordlicht(ctx, vw, vh, now, polar, ox)
      ctx.restore()
    }
    if (!this.reduce) drawStimmung(ctx, welt, vw, vh, this.dpr, now, ox, oy)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Sandsturm: blendet ein und aus, rund um den Kopf bleibt etwas Sicht
    const st = g.sandsturm
    if (st && now < st.bis + 800) {
      const staerke = Math.min(clamp01((now - st.t) / 600), 1 - clamp01((now - st.bis) / 800))
      drawSandsturm(ctx, vw, vh, (head.x + 0.5) * cell + ox, (head.y + 0.5) * cell + oy, cell, staerke, now)
    }
    // Vollmond (Werwolf jagt) und Spiegelfluch
    const vm = g.vollmond
    if (vm && now < vm.bis + 1500) drawVollmond(ctx, vw, vh, Math.min(clamp01((now - vm.t) / 1200), 1 - clamp01((now - vm.bis) / 1500)))
    const spg = g.spiegel
    if (spg && now < spg.bis) drawSpiegelfluch(ctx, vw, vh, now, clamp01((now - spg.t) / Math.max(1, spg.ab - spg.t)), now >= spg.ab)
    // Schneesturm: erst wird der Schnee dichter (Ankuendigung), dann ist die Sicht fast ganz weg
    const ss = g.sichtsperre
    if (ss && now < ss.bis + 600) {
      const weg = clamp01((now - ss.bis) / 600)
      const k = clamp01((now - ss.t) / Math.max(1, ss.ab - ss.t)) * (1 - weg)
      const voll = now < ss.ab ? 0 : Math.min(clamp01((now - ss.ab) / 250), 1 - weg)
      drawSchneesturm(ctx, vw, vh, now, k, voll)
    }
    ctx.translate(ox, oy)

    // Funken beim Fressen
    this.funken = this.funken.filter((f) => now - f.born < 560)
    for (const f of this.funken) {
      const t = (now - f.born) / 560
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = f.c
      ctx.beginPath()
      ctx.arc(f.x + f.vx * t, f.y + f.vy * t + cell * 0.9 * t * t, cell * 0.12 * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Aufsteigende Zahlen und Namen
    this.texte = this.texte.filter((t) => now - t.t < 900)
    ctx.textAlign = 'center'
    ctx.font = `700 ${Math.round(cell * 0.45)}px "Libre Franklin", system-ui, sans-serif`
    for (const t of this.texte) {
      const k = (now - t.t) / 900
      ctx.globalAlpha = 1 - k * k
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(23, 21, 19, 0.7)'
      ctx.strokeText(t.text, t.x, t.y - k * cell)
      ctx.fillStyle = t.farbe
      ctx.fillText(t.text, t.x, t.y - k * cell)
    }
    ctx.globalAlpha = 1

    // Apfel ausserhalb des Bildes: Pfeil am Rand
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (g.status === 'play') this.drawZeiger(g, ox, oy, now)
    if (this.minikarte) this.drawMinikarte(g, head)
  }

  /**
   * Boden aus Kacheln: Erde mit Kruemeln, Steinen, Kohle und Skeletten, das Schachbrett und der Grasrand sind fest.
   * Statt jedes Bild hunderte Formen zu rastern, wird jede Kachel einmal gezeichnet und danach nur kopiert.
   * Aendert sich die Karte (neuer Block, neue Feldgroesse, neues Spiel), wird neu gezeichnet.
   */
  /** Abgrund um die Plattform (Vulkan): Kacheln wie das Meer, einmal berechnet, dann nur noch die fliessende Lava */
  private abgrundZeichnen(g: Game, cell: number, now: number, ex0: number, ey0: number, ex1: number, ey1: number) {
    if (this.abgrundStand !== this.grundStand) {
      this.abgrundAlt.clear()
      for (const [k, e] of this.abgrund) this.abgrundAlt.set(k, e.m)
      this.abgrund.clear()
      this.abgrundStand = this.grundStand
    }
    const bild = this.grundBild
    // Neue Stuecke: je Bild nur so viele, wie in gut 6 ms passen (mindestens eins), der Rest in den naechsten Bildern
    const t0 = performance.now()
    let neu = 0
    for (let ky = Math.floor(ey0 / GRUND); ky <= Math.floor(ey1 / GRUND); ky++)
      for (let kx = Math.floor(ex0 / GRUND); kx <= Math.floor(ex1 / GRUND); kx++) {
        const k = `${kx},${ky}`
        let e = this.abgrund.get(k)
        let m: AbgrundKachel | null
        if (e) {
          e.benutzt = bild
          m = e.m
        } else if (neu > 0 && performance.now() - t0 > 6) m = this.abgrundAlt.get(k) ?? null
        else {
          neu++
          e = { m: abgrundKachel((x, y) => g.inside({ x, y }), kx * GRUND, ky * GRUND, GRUND, 12, g.ursprung), benutzt: bild }
          this.abgrund.set(k, e)
          this.abgrundAlt.delete(k)
          m = e.m
        }
        if (!m) continue
        // Der feste Teil steckt in der Boden-Kachel, sobald die beim neuen Stueck einmal neu gezeichnet wurde
        const gk = this.grund.get(k)
        const gebacken = !!gk?.abgrund && e?.m === m
        if (gk && !gk.abgrund && e?.m === m) this.grund.delete(k)
        drawAbgrund(this.ctx, m, cell, now, this.reduce, gebacken)
      }
    if (this.abgrund.size > 90) {
      const alt = [...this.abgrund.entries()].sort((a, b) => a[1].benutzt - b[1].benutzt)
      for (const [k] of alt.slice(0, this.abgrund.size - 90)) this.abgrund.delete(k)
    }
  }

  /** Meer um die Insel (Wueste): Kacheln wie der Boden, einmal berechnet, dann nur noch bewegte Oberflaeche und Wellen */
  private meerZeichnen(g: Game, cell: number, now: number, ex0: number, ey0: number, ex1: number, ey1: number) {
    // Karte geaendert (neuer Block, neue Feldgroesse ...): die alten Stuecke bleiben stehen, bis die neuen fertig sind
    if (this.meerStand !== this.grundStand) {
      this.meerAlt.clear()
      for (const [k, e] of this.meer) this.meerAlt.set(k, e.m)
      this.meer.clear()
      this.meerStand = this.grundStand
    }
    const flut = g.flut
    if (flut && flut.zellen !== this.meerFlut) {
      for (const [k, e] of [...this.meer]) {
        if (!k.startsWith('f|')) continue
        this.meerAlt.set(k, e.m)
        this.meer.delete(k)
      }
      this.meerFlut = flut.zellen
    }
    const px = 12
    const bild = this.grundBild
    // Neue Stuecke berechnen kostet: je Bild nur so viel, wie in gut 6 ms passt (mindestens eins), der Rest folgt
    // in den naechsten Bildern; bis dahin steht das alte Stueck da (oder das tiefe Wasser des Hintergrunds)
    const t0 = performance.now()
    let neu = 0
    const holen = (art: 'n' | 'f', kx: number, ky: number) => {
      const k = `${art}|${kx},${ky}`
      let e = this.meer.get(k)
      if (!e) {
        if (neu > 0 && performance.now() - t0 > 6) return this.meerAlt.get(k) ?? null
        neu++
        const z = flut?.zellen
        const land = art === 'f' && z ? (x: number, y: number) => g.inside({ x, y }) && !z.has(key(x, y)) : (x: number, y: number) => g.inside({ x, y })
        e = { m: meerKachel(land, kx * GRUND, ky * GRUND, GRUND, px, g.ursprung), benutzt: bild }
        this.meer.set(k, e)
        this.meerAlt.delete(k)
      }
      e.benutzt = bild
      return e.m
    }
    // Flut kommt: hoehere, schnellere Wellen, das Wasser schwappt immer wieder ueber den Rand
    const warnung = flut?.phase === 'warnung'
    const ueber = !flut ? 0 : flut.phase === 'aktiv' ? clamp01((now - flut.t) / 700) : 0.45 * Math.pow(Math.max(0, Math.sin(now / 480)), 2) * Math.min(1, 0.5 + (now - flut.t) / 8000)
    for (let ky = Math.floor(ey0 / GRUND); ky <= Math.floor(ey1 / GRUND); ky++)
      for (let kx = Math.floor(ex0 / GRUND); kx <= Math.floor(ex1 / GRUND); kx++) {
        // Stuecke ganz aus Land (null) haben kein Meer: nichts zu zeichnen
        const m = holen('n', kx, ky)
        if (m) drawMeer(this.ctx, m, cell, now, 1, warnung ? 1.8 : 1, this.reduce)
        const mf = ueber > 0.01 ? holen('f', kx, ky) : null
        if (mf) drawMeer(this.ctx, mf, cell, now, ueber, warnung ? 1.8 : 1, this.reduce)
      }
    if (this.meer.size > 90) {
      const alt = [...this.meer.entries()].sort((a, b) => a[1].benutzt - b[1].benutzt)
      for (const [k] of alt.slice(0, this.meer.size - 90)) this.meer.delete(k)
    }
  }

  private grundKacheln(g: Game, cell: number, ox: number, oy: number, ex0: number, ey0: number, ex1: number, ey1: number) {
    const stand = `${this.welt.id}|${nummer(g)}|${cell}|${this.dpr}|${g.w}x${g.h}|${g.ursprung.x},${g.ursprung.y}|${g.blocks.map((b) => `${b.x},${b.y}`).join(';')}|${g.extra.length}|${g.aus.length}|${g.krater.length}|${g.schienen.length}|${g.stollen.length}`
    if (stand !== this.grundStand) {
      this.grund.clear()
      this.grundStand = stand
    }
    const bild = ++this.grundBild
    const { ctx, dpr } = this
    const kx0 = Math.floor(ex0 / GRUND)
    const ky0 = Math.floor(ey0 / GRUND)
    const kx1 = Math.floor(ex1 / GRUND)
    const ky1 = Math.floor(ey1 / GRUND)
    // In Geraetepixeln zeichnen, an ganzen Pixeln ausgerichtet: die Kacheln stossen ohne Fuge aneinander
    const bx = Math.round(ox * dpr)
    const by = Math.round(oy * dpr)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    for (let ky = ky0; ky <= ky1; ky++)
      for (let kx = kx0; kx <= kx1; kx++) {
        const k = `${kx},${ky}`
        let e = this.grund.get(k)
        if (!e) {
          const cv = this.grundKachel(g, cell, kx, ky)
          e = { cv, benutzt: bild, abgrund: this.gebackenerAbgrund }
          this.grund.set(k, e)
        }
        e.benutzt = bild
        ctx.drawImage(e.cv, bx + Math.round(kx * GRUND * cell * dpr), by + Math.round(ky * GRUND * cell * dpr))
      }
    ctx.restore()
    // Speicher begrenzen: am laengsten nicht gebrauchte Kacheln weg
    if (this.grund.size > GRUND_MAX) {
      const alt = [...this.grund.entries()].sort((a, b) => a[1].benutzt - b[1].benutzt)
      for (const [k] of alt.slice(0, this.grund.size - GRUND_MAX)) this.grund.delete(k)
    }
  }

  /**
   * Feste Zeichnung als Bild: einmal in Geraetepixeln gerendert (Feld plus `rand` Felder ringsum), danach nur kopiert.
   * `zeichne` bekommt den Versatz des Feldes im Bild (in Pixeln und in Feldern).
   */
  private bild(name: string, p: P, cell: number, rand: number, zeichne: (c: CanvasRenderingContext2D, o: number, mitte: P) => void) {
    const stand = `${cell}|${this.dpr}`
    if (stand !== this.bilderStand) {
      this.bilder.clear()
      this.bilderStand = stand
    }
    const seite = (1 + 2 * rand) * cell
    let cv = this.bilder.get(name)
    if (!cv) {
      cv = document.createElement('canvas')
      cv.width = Math.ceil(seite * this.dpr)
      cv.height = cv.width
      const c = cv.getContext('2d')!
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      zeichne(c, rand * cell, { x: rand, y: rand })
      this.bilder.set(name, cv)
    }
    this.ctx.drawImage(cv, (p.x - rand) * cell, (p.y - rand) * cell, cv.width / this.dpr, cv.height / this.dpr)
  }

  /** Eine Boden-Kachel zeichnen (Felder kx*GRUND .. kx*GRUND+GRUND-1, dazu ein Feld Rand, damit nichts abgeschnitten wird) */
  private grundKachel(g: Game, cell: number, kx: number, ky: number): HTMLCanvasElement {
    const dpr = this.dpr
    const x0d = Math.round(kx * GRUND * cell * dpr)
    const y0d = Math.round(ky * GRUND * cell * dpr)
    const cv = document.createElement('canvas')
    cv.width = Math.round((kx + 1) * GRUND * cell * dpr) - x0d
    cv.height = Math.round((ky + 1) * GRUND * cell * dpr) - y0d
    const c = cv.getContext('2d', { alpha: false })!
    c.setTransform(dpr, 0, 0, dpr, -x0d, -y0d)
    const welt = this.welt
    c.fillStyle = welt.erde.grund
    c.fillRect(kx * GRUND * cell, ky * GRUND * cell, GRUND * cell + 1, GRUND * cell + 1)
    const drin = (x: number, y: number) => g.inside({ x, y })
    const xa = kx * GRUND - 1
    const ya = ky * GRUND - 1
    const xb = (kx + 1) * GRUND
    const yb = (ky + 1) * GRUND
    // Erde (wie im Bild: zuerst alles ausserhalb der Karte)
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        if (drin(x, y)) continue
        const wx = x - g.ursprung.x
        const wy = y - g.ursprung.y
        const z = feldZufall(wx, wy)
        drawErdFeldWelt(c, welt, x * cell, y * cell, cell, erdRing(drin, x, y), z)
        if (g.lavaImStein(wx, wy) || ohneErde(welt)) continue
        const deko = erdeBei(g.cfg, wx, wy)
        if (deko === 'stein' || deko === 'kohle' || deko === 'skelett') drawErdDeko(c, x * cell, y * cell, cell, deko, z, 0)
      }
    // Grosse Details ueber mehrere Felder (Schichten, Wurzeln, Felsen, Skelette ...), nicht ueber Erz oder Lava
    const erz = new Set(['gold', 'dia', 'rubin', 'opal'])
    drawGrosseErde(c, welt, { drin, belegt: (wx, wy) => g.lavaImStein(wx, wy) || erz.has(erdeBei(g.cfg, wx, wy) ?? ''), ursprung: g.ursprung }, cell, xa, ya, xb, yb)
    // Schachbrett: dunkel genau je Feld, hell etwas groesser (sonst feine Fugen), dann der Grasrand
    c.fillStyle = welt.dunkel
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (drin(x, y)) c.fillRect(x * cell, y * cell, cell, cell)
    c.fillStyle = welt.hell
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (drin(x, y) && !((x + y) % 2)) c.fillRect(x * cell - 0.3, y * cell - 0.3, cell + 0.6, cell + 0.6)
    // Zauberwald: Waldboden (Moos, Farn, Leuchtpilze) auf dem Spielfeld
    if (welt.id === 'zauberwald')
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (drin(x, y)) drawWaldBoden(c, x * cell, y * cell, cell, feldZufall(x - g.ursprung.x + 5, y - g.ursprung.y + 9))
    // Vulkan: Asche, Lavasteinchen und glimmende Spalten auf dem Boden
    if (vulkanWelt(welt))
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (drin(x, y)) drawVulkanBoden(c, x * cell, y * cell, cell, feldZufall(x - g.ursprung.x + 5, y - g.ursprung.y + 9))
    c.fillStyle = welt.kante
    const kante = Math.max(2, cell * 0.1)
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        if (!drin(x, y)) continue
        if (!drin(x, y - 1)) c.fillRect(x * cell, y * cell, cell, kante)
        if (!drin(x, y + 1)) c.fillRect(x * cell, (y + 1) * cell - kante, cell, kante)
        if (!drin(x - 1, y)) c.fillRect(x * cell, y * cell, kante, cell)
        if (!drin(x + 1, y)) c.fillRect((x + 1) * cell - kante, y * cell, kante, cell)
      }
    // Bergwerk: Stollenboden, Schienen und Stolleneingaenge (alles fest)
    if (welt.id === 'bergwerk' && g.schienen.length) {
      const imBild = (c: P) => c.x >= xa && c.x <= xb && c.y >= ya && c.y <= yb
      const stollen = new Set(g.stollen.map((c) => key(c.x, c.y)))
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (stollen.has(key(x, y))) drawStollenBoden(c, x * cell, y * cell, cell, feldZufall(x - g.ursprung.x + 3, y - g.ursprung.y + 1))
      for (const s of g.schienen) {
        const f = g.schieneFelder(s)
        if (!f) continue
        for (const p of f.cells) if (imBild(p) && drin(p.x, p.y)) drawSchieneFeld(c, p.x * cell, p.y * cell, cell, s.achse)
        const vor = s.achse === 'x' ? { x: f.von - 1, y: s.linie } : { x: s.linie, y: f.von - 1 }
        const nach = s.achse === 'x' ? { x: f.bis + 1, y: s.linie } : { x: s.linie, y: f.bis + 1 }
        if (imBild(vor) && !drin(vor.x, vor.y)) drawStolleneingang(c, vor.x * cell, vor.y * cell, cell, s.achse === 'x' ? 0 : Math.PI / 2)
        if (imBild(nach) && !drin(nach.x, nach.y)) drawStolleneingang(c, nach.x * cell, nach.y * cell, cell, s.achse === 'x' ? Math.PI : -Math.PI / 2)
      }
    }
    // Zauber- und Gruselwald: Kronen vom Waldrand ragen ein Stueck ins Feld
    if (waldWelt(welt))
      for (let y = ya; y <= yb; y++)
        for (let x = xa; x <= xb; x++) if (!drin(x, y)) drawWaldRand(c, welt, x, y, cell, feldZufall(x - g.ursprung.x, y - g.ursprung.y), drin)
    // Vulkan: den festen Teil des Abgrunds (Felswand, Lava) gleich mit hineinzeichnen, wenn das Stueck schon berechnet ist
    this.gebackenerAbgrund = false
    if (vulkanWelt(welt) && this.abgrundStand === this.grundStand) {
      const a = this.abgrund.get(`${kx},${ky}`)
      if (a) {
        if (a.m) c.drawImage(a.m.basis.cv, kx * GRUND * cell, ky * GRUND * cell, GRUND * cell, GRUND * cell)
        this.gebackenerAbgrund = true
      }
    }
    return cv
  }

  /** Ein Welt-Wesen, weich zwischen zwei Feldern (s = Groesse, a = Deckkraft) */
  private drawWesen(g: Game, w: Wesen, now: number, s: number, a: number) {
    const { ctx, cell } = this
    const k = this.reduce ? 1 : easeOut(clamp01((now - w.schrittT) / (WESEN_TAKT[w.art] * 0.85)))
    const x = (lerp(w.from.x, w.p.x, k) + 0.5) * cell
    const y = (lerp(w.from.y, w.p.y, k) + 0.5) * cell
    const lauf = k < 1 ? (now / 200) % 1 : -1
    const auf = (this.reduce ? 1 : backOut(clamp01((now - w.t) / 380))) * s
    const ang = DIR_WINKEL[w.dir]
    if (w.art === 'irrlicht') {
      // Falscher Apfel: schwebt, flackert, leicht durchsichtig
      const yy = y - cell * 0.1 + Math.sin(now / 300) * cell * 0.06
      drawIrrlichtSchein(ctx, x, yy, cell, now)
      ctx.globalAlpha = a * (0.65 + 0.25 * Math.sin(now / 90))
      drawFutter(ctx, this.welt, x, yy, cell, auf, 0, undefined, g.apfelStufe(), now)
      ctx.globalAlpha = 1
    } else if (w.art === 'einhorn') drawEinhorn(ctx, x, y, cell, ang, lauf, auf, a, now)
    else if (w.art === 'fee') drawFee(ctx, x, y, cell, auf, a, now)
    else if (w.art === 'ent') drawEnt(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'skelett') drawSkelett(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'werwolf') drawWerwolf(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'gespenst') drawGespenst(ctx, x, y, cell, auf, a, now)
    else if (w.art === 'riesenspinne') drawRiesenspinne(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'kraehe') drawKraehe(ctx, x, y - cell * 0.3, cell, ang, now, auf, a)
    else if (w.art === 'zwerg') drawZwerg(ctx, x, y, cell, ang, lauf, auf, a, now)
    else if (w.art === 'glutgolem') drawGlutgolem(ctx, x, y, cell, ang, lauf, auf, a, now)
    else if (w.art === 'bienen') drawBienen(ctx, x, y, cell, now, a)
    else if (w.art === 'igel') drawIgel(ctx, x, y, cell, ang, lauf, auf, a, now < (w.kugelBis ?? 0) ? 1 : 0, now)
    else if (w.art === 'klapperschlange') drawKlapperschlange(ctx, x, y, cell, ang, lauf, auf, a, (w.rassel ?? -1) >= 0, now)
    else if (w.art === 'riesenskorpion') drawRiesenskorpion(ctx, x, y, cell, ang, lauf, auf, a, w.stichAb === undefined ? 0 : clamp01(1 - (w.stichAb - now) / STICH_WARNUNG), now)
    else if (w.art === 'sandkrabbe') drawSandkrabbe(ctx, x, y, cell, lauf, auf, a)
    else if (w.art === 'mumie') drawMumie(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'golem') drawGolem(ctx, x, y, cell, ang, lauf, auf, a, now)
    else if (w.art === 'eisbaer') drawEisbaer(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'robbe') drawRobbe(ctx, x, y, cell, ang, lauf, auf, a)
    else if (w.art === 'schneemann') drawSchneemann(ctx, x, y, cell, ang, auf, a)
    else drawYeti(ctx, x, y, cell, ang, lauf, auf, a, now)
  }

  private drawSchlange(g: Game, head: P, a: number) {
    const { ctx, cell } = this
    const now = g.time
    const n = g.body.length
    const tp = g.prev[n - 1]
    const tl = g.body[n - 1]
    const tail = tp ? { x: lerp(tp.x, tl.x, a), y: lerp(tp.y, tl.y, a) } : tl
    const pts: P[] = [head, ...g.body.slice(1), tail]
    const tot = g.status === 'over' || !!this.mehr?.ichTot
    if (!tot && g.status === 'play' && !this.reduce) this.spuren.takt('ich', this.skin, tail.x, tail.y, now)
    const sinceDeath = now - g.deathAt
    if (tot && !this.reduce && sinceDeath < 900) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.cos(sinceDeath / 90))
    // Nach einem Rueckschlag geschuetzt: blinkt
    else if (!tot && now < g.schutzBis) ctx.globalAlpha = Math.sin(now / 55) > 0 ? 0.9 : 0.35
    // Geist (Power-up): durchscheinend, kurz vor dem Ende flackernd
    else if (!tot && now < g.effekt.geistBis) ctx.globalAlpha = g.effekt.geistBis - now < 1500 && Math.sin(now / 70) > 0 ? 0.75 : 0.45
    drawSchlange(ctx, pts, cell, g.dir, this.skin, now, {
      tot,
      vergiftet: g.cause === 'gift' ? clamp01(sinceDeath / 600) : 0,
      zunge: !tot && !this.reduce && now % 2800 < 220,
      blinzeln: !tot && now % 4300 < 120,
    })
    ctx.globalAlpha = 1
    const hx0 = (head.x + 0.5) * cell
    const hy0 = (head.y + 0.5) * cell
    // Fuettern: hungriger roter Schein um den Kopf
    if (!tot && now < g.effekt.fuetternBis) {
      const p = 0.5 + 0.5 * Math.sin(now / 90)
      ctx.strokeStyle = `rgba(240, 90, 60, ${0.45 + 0.35 * p})`
      ctx.lineWidth = Math.max(2, cell * 0.1)
      ctx.beginPath()
      ctx.arc(hx0, hy0, cell * (0.55 + 0.08 * p), 0, Math.PI * 2)
      ctx.stroke()
    }
    // Magnet: Reichweite als gestrichelter Kreis
    if (!tot && now < g.effekt.magnetBis) {
      ctx.strokeStyle = 'rgba(216, 67, 74, 0.55)'
      ctx.lineWidth = Math.max(1.5, cell * 0.05)
      ctx.setLineDash([cell * 0.2, cell * 0.15])
      ctx.lineDashOffset = -now / 40
      ctx.beginPath()
      ctx.arc(hx0, hy0, cell * (g.cfg.magnetRadius + 0.5), 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
    // Maulwurf: Erdkruemel fliegen vom Kopf
    if (!tot && g.graebt() && !this.reduce) {
      ctx.fillStyle = 'rgba(122, 84, 52, 0.9)'
      for (let i = 0; i < 5; i++) {
        const t = ((now / 500 + i / 5) % 1)
        const a = i * 2.4 + Math.floor(now / 500) * 0.7
        ctx.beginPath()
        ctx.arc(hx0 + Math.cos(a) * cell * 0.6 * t, hy0 + Math.sin(a) * cell * 0.6 * t - cell * 0.2 * t, cell * 0.06 * (1 - t), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Schlange eines anderen Spielers (weich zwischen den Feldern) */
  private drawFremde(f: FremdeSchlange, now: number) {
    const { ctx, cell } = this
    const n = f.body.length
    if (!n) return
    const a = this.reduce ? 1 : f.alpha
    const h0 = f.prev[0] ?? f.body[0]
    const head = { x: lerp(h0.x, f.body[0].x, a), y: lerp(h0.y, f.body[0].y, a) }
    const tp = f.prev[n - 1]
    const tl = f.body[n - 1]
    const tail = tp ? { x: lerp(tp.x, tl.x, a), y: lerp(tp.y, tl.y, a) } : tl
    if (!f.tot && !this.reduce) this.spuren.takt(`f-${f.name}`, f.skin, tail.x, tail.y, now)
    ctx.globalAlpha = f.deck * (f.tot ? 0.5 : 1)
    drawSchlange(ctx, [head, ...f.body.slice(1), tail], cell, f.dir, f.skin, now, { tot: f.tot, blinzeln: !f.tot && now % 4300 < 120 })
    ctx.globalAlpha = 1
  }

  /** Name ueber dem Kopf eines anderen Spielers */
  private drawName(f: FremdeSchlange) {
    const { ctx, cell } = this
    const a = this.reduce ? 1 : f.alpha
    const h0 = f.prev[0] ?? f.body[0]
    const x = (lerp(h0.x, f.body[0].x, a) + 0.5) * cell
    const y = lerp(h0.y, f.body[0].y, a) * cell - cell * 0.25
    ctx.font = `700 ${Math.max(10, Math.round(cell * 0.42))}px "Libre Franklin", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.globalAlpha = Math.max(0.55, f.deck)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(23, 21, 19, 0.75)'
    ctx.strokeText(f.name, x, y)
    ctx.fillStyle = '#F5EFE6'
    ctx.fillText(f.name, x, y)
    ctx.globalAlpha = 1
  }

  /** Reaktion als Blase ueber dem Kopf: springt auf, steigt und verblasst */
  private drawBlase(b: { p: P; text: string; k: number }) {
    const { ctx, cell } = this
    const auf = this.reduce ? 1 : backOut(clamp01(b.k * 6))
    const x = (b.p.x + 0.5) * cell
    const y = (b.p.y - 0.9) * cell - b.k * cell * 0.6
    const r = cell * 0.62 * auf
    ctx.globalAlpha = b.k > 0.75 ? (1 - b.k) / 0.25 : 1
    ctx.fillStyle = 'rgba(245, 239, 230, 0.95)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `${Math.round(cell * 0.7 * auf)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.text, x, y + cell * 0.04)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
  }

  /** Abgeschnittene Glieder: kurz weisser Schnitt, dann bleiben sie eine Sekunde liegen
   *  (etwas blasser als die Schlange) und verblassen dann, dabei werden sie kleiner */
  private drawAbgeschnitten(st: Game['abgeschnitten'][number], now: number) {
    const { ctx, cell } = this
    const t = Math.max(0, now - st.t)
    const weg = this.reduce ? 0 : clamp01((t - ABGESCHNITTEN_LIEGT) / ABGESCHNITTEN_WEG)
    const sk = this.skin
    st.cells.forEach((c, i) => {
      const f = st.laenge > 1 ? (st.von + i) / (st.laenge - 1) : 1
      const rgb = farbeBei(sk, f).map((v) => Math.round(lerp(v, 120, 0.25)))
      const x = (c.x + 0.5) * cell
      const y = (c.y + 0.5) * cell
      const r = cell * 0.37 * (1 - weg * 0.5)
      ctx.globalAlpha = 1 - weg
      ctx.fillStyle = 'rgba(12, 40, 32, 0.22)'
      ctx.beginPath()
      ctx.arc(x, y + cell * 0.1, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      // Am Anfang weiss aufblitzen, damit man sieht, was ab ist
      if (t < 350) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - t / 350)})`
        ctx.lineWidth = Math.max(1.5, cell * 0.08)
        ctx.stroke()
      }
    })
    // Schnittlinie zwischen Schlange und abgeschnittenem Stueck
    if (t < 400 && st.cells.length) {
      const c = st.cells[0]
      const x = (c.x + 0.5) * cell
      const y = (c.y + 0.5) * cell
      ctx.globalAlpha = 1 - t / 400
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = Math.max(2, cell * 0.1)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - cell * 0.5, y - cell * 0.5)
      ctx.lineTo(x + cell * 0.5, y + cell * 0.5)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  /** Maulwurf: kleines Warndreieck mit Ausrufezeichen ueber dem Kopf, wenn es Zeit wird umzukehren */
  private drawGrabWarnung(g: Game, head: P, now: number) {
    if (!g.grabWarnung()) return
    const { ctx, cell } = this
    const x = (head.x + 0.5) * cell
    const y = (head.y - 0.55) * cell
    const s = cell * 0.62
    ctx.save()
    ctx.globalAlpha = this.reduce ? 0.95 : 0.8 + 0.15 * Math.sin(now / 220)
    ctx.translate(x, y)
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#F2C14E'
    ctx.strokeStyle = 'rgba(40, 28, 10, 0.75)'
    ctx.lineWidth = Math.max(1.5, cell * 0.06)
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.5)
    ctx.lineTo(s * 0.55, s * 0.45)
    ctx.lineTo(-s * 0.55, s * 0.45)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#3A2A10'
    ctx.fillRect(-s * 0.05, -s * 0.22, s * 0.1, s * 0.38)
    ctx.beginPath()
    ctx.arc(0, s * 0.3, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Kamera. Bereich: fester Ausschnitt, der neue Bereiche frueh und weich vorwegnimmt (siehe
   *  bereichZiel). Dynamisch: eine Drohne, die frei hinterherfliegt. Sie haengt an einer gedaempften
   *  Feder vor dem Kopf (in Laufrichtung), so dass sie im Lauf knapp vor ihm schwebt. Biegt die
   *  Schlange ab, springt nur das Ziel: die Kamera selbst fliegt in einem lockeren Bogen hinueber,
   *  nie um eine Ecke. Steht die Schlange, gleitet sie zum Kopf. Mit "Bewegung reduzieren" haftet
   *  die Kamera immer genau am Kopf.
   *  Bei jeder Art gilt: Solange die Karte nur aus den Startbloecken besteht (bis das erste neue
   *  Gebiet freigeschaltet ist), steht das Bild still, die ganze Karte in der Mitte. Danach faehrt
   *  die Kamera weich von dort los */
  private kamera(g: Game, cell: number, dt: number, kopf: P): P {
    let tx = (kopf.x + 0.5) * cell
    let ty = (kopf.y + 0.5) * cell
    const lief = g.time !== this.camZeit
    this.camZeit = g.time
    if (this.standbild(g)) {
      this.cam = { x: (g.w / 2) * cell, y: (g.h / 2) * cell }
      this.camZiel = { ...this.cam }
      this.camV = { x: 0, y: 0 }
      this.camInit = true
      this.frameOk = false
      this.sichtGlatt = { x: [0, 0], y: [0, 0] }
      return this.cam
    }
    const laeuft = lief && g.status === 'play' && !g.halt && !g.gnade
    const art = this.reduce ? 'kopf' : this.kameraArt
    if (art !== 'bereich') {
      this.frameOk = false
      this.sichtGlatt = { x: [0, 0], y: [0, 0] }
    }
    if (art === 'bereich') {
      const b = this.bereichZiel(g, dt, kopf)
      tx = b.x * cell
      ty = b.y * cell
    } else if (art === 'dynamisch' && this.camInit) {
      // Feder samt weichem Ziel haengt bei Tempo v um 3 v / omega hinterher: so weit plus ein Stueck voraus
      const v = laeuft ? cell / g.takt : 0
      const voraus = laeuft ? (3 * v) / DROHNE + DROHNE_VORAUS * cell : 0
      const d = STEP[g.dir]
      tx += d.x * voraus
      ty += d.y * voraus
    }
    if (art === 'kopf' || !this.camInit) {
      this.cam = { x: tx, y: ty }
      this.camZiel = { x: tx, y: ty }
      this.camV = { x: 0, y: 0 }
      this.camInit = true
    } else this.feder(tx, ty, art === 'bereich' ? BEREICH : DROHNE, dt)
    if (art !== 'bereich') return this.cam
    // Letzte Sicherung, weich nachgezogen (zwei Stufen): so loest sie sich auch beim Abbiegen ohne Ruck
    const soll = this.sichtVoraus(g, kopf)
    const k = 1 - Math.exp(-dt / 90)
    for (const ax of ['x', 'y'] as const) {
      const s = this.sichtGlatt[ax]
      s[0] += (soll[ax] - this.cam[ax] - s[0]) * k
      s[1] += (s[0] - s[1]) * k
    }
    return { x: this.cam.x + this.sichtGlatt.x[1], y: this.cam.y + this.sichtGlatt.y[1] }
  }

  /** Standbild: die Karte ist noch die vom Start (kein neues Gebiet, nichts freigegraben) und passt ganz ins Bild */
  private standbild(g: Game) {
    return g.blocks.length <= 2 && !g.extra.length && g.inside(g.body[0]) && g.w <= this.vw / this.cell && g.h <= this.vh / this.cell
  }

  /** Bereich-Kamera, letzte Sicherung: zu jeder Seite sieht man immer mindestens 5 ganze Felder
   *  am Kopf vorbei, soweit dort Karte ist. Greift nur in seltenen Momenten (etwa wenn die Kamera
   *  nach dem Abbiegen noch Fahrt aufnimmt), setzt weich ein und ist sonst genau 0 */
  private sichtVoraus(g: Game, kopf: P): P {
    const aus = { ...this.cam }
    // Solange ein neuer Block aufklappt, gleitet die Kamera ohnehin hinein
    if (!g.inside(g.body[0]) || (g.gebiet && g.time - g.gebiet.t < BEREICH_WECHSEL)) return aus
    const w = 0.5
    const schub = (fehlt: number) => (fehlt <= -w ? 0 : fehlt >= w ? fehlt : ((fehlt + w) * (fehlt + w)) / (4 * w))
    for (const ax of ['x', 'y'] as const) {
      const halb = (ax === 'x' ? this.vw : this.vh) / (2 * this.cell)
      const ab = aus[ax] / this.cell - (kopf[ax] + 0.5)
      const n = this.sichtNoetig[ax]
      aus[ax] += (schub(n.plus - (halb + ab)) - schub(n.minus - (halb - ab))) * this.cell
    }
    return aus
  }

  /** Bereich-Kamera (Ziel in Feldern), in drei Schichten:
   *  1. Kasten: Der Ausschnitt ist so gross wie das Bild, an den Kartenbloecken ausgerichtet, und
   *     steht. Ueberschreitet der Kopf seinen Rand, kommt der naechste (einen Block weiter).
   *  2. Vorwegnehmen: Ab der Mittellinie lehnt sich die Kamera zu jeder Oeffnung hinueber (dort, wo
   *     die Karte hinter dem Rand weitergeht, auch hinter Erde oder um die Ecke), je naeher, desto
   *     mehr: an der Schwelle steht sie halb im neuen Bereich. Faehrt die Schlange darauf zu, zieht
   *     es voll, quer etwas weniger, faehrt sie weg, nur halb (wie an einem Gummiseil, das immer
   *     dorthin zieht, wohin die Schlange gerade will). Spruenge im Ziel (Wechsel, Erde, wachsende
   *     Karte) gleiten mit Ease-in/out.
   *  3. Mindestabstand: zum Bildrand bleiben immer RAND_HINTEN bis RAND_VORN Felder, ueberall
   *     dort, wo in der Naehe Karte ist, gerechnet fuer die Stelle, an der die Kamera wirklich ist
   *     (siehe Geister-Feder). Dazu die letzte Sicherung in sichtVoraus.
   *  Darauf folgt die Kamera an einer zweistufigen Feder (Gummiseil an einem Gummiseil) */
  private bereichZiel(g: Game, dt: number, kopf: P): P {
    this.uhr += dt
    const vx = this.vw / this.cell
    const vy = this.vh / this.cell
    const view = { x: vx, y: vy }
    const kx = kopf.x + 0.5
    const ky = kopf.y + 0.5
    const kp = { x: kx, y: ky }
    // Laufrichtung weich nachziehen (0 weg, 0,7 quer, 1 darauf zu)
    const dir = g.queue[0] ?? g.dir
    const kr = 1 - Math.exp(-dt / 100)
    for (const s of ['u', 'd', 'l', 'r'] as const) {
      const r = this.bRicht[s]
      r[0] += ((s === dir ? 1 : s === OPP[dir] ? 0 : 0.7) - r[0]) * kr
      r[1] += (r[0] - r[1]) * kr
    }
    const zu = (ax: 'x' | 'y', sg: 1 | -1) => this.bRicht[SEITE[ax][sg]][1]

    // 1. Kasten: halten, solange der Kopf drin ist; ueber der Schwelle einen Block weiter
    const achse = (pos: number, blk: number, view: number, total: number, alt: number | null) => {
      if (total <= view) return (total - view) / 2
      const lim = (f: number) => Math.min(total - view, Math.max(0, f))
      if (alt !== null) {
        let f = lim(alt)
        for (let i = 0; i < 50 && (pos < f || pos > f + view); i++) f = lim(f + (pos > f + view ? blk : -blk))
        if (pos >= f && pos <= f + view) return f
      }
      // Neu: so, dass der Kopf moeglichst mittig ist
      return lim(Math.round((pos - view / 2) / blk) * blk)
    }
    const erde = !g.inside(g.body[0])
    if (!this.frameOk) {
      this.frame = { x: achse(kx, g.bw, vx, g.w, null), y: achse(ky, g.bh, vy, g.h, null) }
      this.frameOk = true
      this.geist = { x: kx, y: ky, zx: kx, zy: ky, vx: 0, vy: 0 }
      this.bLetzt = null
      this.bAus = null
      this.uebergaenge = []
    } else if (!erde) {
      this.frame = { x: achse(kx, g.bw, vx, g.w, this.frame.x), y: achse(ky, g.bh, vy, g.h, this.frame.y) }
    }
    const feld = (ax: 'x' | 'y', a: number, q: number) => g.inside(ax === 'x' ? { x: a, y: q } : { x: q, y: a })

    // 2. Vorwegnehmen: wie weit sich die Kamera zu einer Seite des Ausschnitts hinueberlehnt (Felder)
    const lehnen = (ax: 'x' | 'y', sg: 1 | -1) => {
      const quer = ax === 'x' ? 'y' : 'x'
      const f = this.frame[ax]
      const total = ax === 'x' ? g.w : g.h
      if (total <= view[ax]) return 0
      // So weit rueckt der naechste Ausschnitt weiter (am Kartenende weniger)
      const blk = ax === 'x' ? g.bw : g.bh
      const neu = Math.abs(Math.min(total - view[ax], Math.max(0, f + sg * blk)) - f)
      if (neu < 0.01) return 0
      // Naechste Karte im Streifen, den der naechste Ausschnitt dazunimmt (Erde dazwischen egal),
      // quer auch ein Stueck ueber die Ecken hinaus
      const rand = sg > 0 ? f + view[ax] : f
      const a0 = sg > 0 ? Math.floor(rand + 1e-6) : Math.floor(rand - neu + 1e-6)
      const a1 = sg > 0 ? Math.ceil(rand + neu - 1e-6) - 1 : Math.ceil(rand - 1e-6) - 1
      const fq = this.frame[quer]
      const q0 = Math.max(0, Math.floor(fq) - 6)
      const q1 = Math.min((quer === 'x' ? g.w : g.h) - 1, Math.ceil(fq + view[quer]) - 1 + 6)
      const k = kp[ax]
      const kq = kp[quer]
      let d2 = Infinity
      for (let q = q0; q <= q1; q++) {
        const dq = Math.max(0, Math.abs(kq - (q + 0.5)) - 0.5)
        // Vom Rand aus nach aussen: das erste Feld Karte ist das naechste
        for (let i = 0; i <= a1 - a0; i++) {
          const a = sg > 0 ? a0 + i : a1 - i
          if (!feld(ax, a, q)) continue
          const da = Math.max(0, sg > 0 ? Math.max(a, rand) - k : k - Math.min(a + 1, rand))
          d2 = Math.min(d2, da * da + dq * dq)
          break
        }
      }
      if (d2 === Infinity) return 0
      // Ab der Mittellinie (halbe Ausschnittbreite Abstand) sanft einsetzend, an der Schwelle halb
      // im neuen Bereich und dort noch in Fahrt, damit der Wechsel ohne Halt durchgeht
      const u = clamp01(1 - Math.sqrt(d2) / (view[ax] / 2))
      return (neu / 2) * u * u * (2 - u) * (0.5 + 0.5 * zu(ax, sg))
    }

    // 3. Mindestabstand: wie weit man vom Kopf aus zu einer Seite sehen muss (Felder ab Kopfmitte):
    // die Karte in der Naehe (auch hinter Erde oder um die Ecke) bis hoechstens `soll` Felder weit.
    // Weit entfernte Felder, Felder seitlich und Reihen am Rand des Bands blenden weich aus
    const sichtBis = (ax: 'x' | 'y', sg: 1 | -1, soll: number) => {
      const quer = ax === 'x' ? 'y' : 'x'
      const k = kp[ax]
      const kq = kp[quer]
      const start = Math.floor(k)
      let brauche = 0
      for (let q = Math.floor(kq - 5); q <= Math.floor(kq + 5); q++) {
        const dq = Math.max(0, Math.abs(kq - (q + 0.5)) - 0.5)
        const wq = 1 - smoother(clamp01((dq - 1) / 3.5))
        if (wq <= 0) continue
        for (let i = 0; i <= Math.ceil(soll) + 2; i++) {
          const a = start + sg * i
          if (!feld(ax, a, q)) continue
          const e = sg > 0 ? a + 1 - k : k - a
          brauche = Math.max(brauche, wq * clamp01((soll + 2 - e) / 1.5) * Math.min(soll, e))
        }
      }
      return brauche
    }
    const rand = (ax: 'x' | 'y', sg: 1 | -1) => sichtBis(ax, sg, RAND_HINTEN + (RAND_VORN - RAND_HINTEN) * zu(ax, sg))
    // Folgt die Kamera dem Kopf, haengt sie so weit hinterher wie die Geister-Feder (im Lauf 3 v / omega).
    // Der Mindestabstand gilt fuer die Stelle, an der die Kamera wirklich ist: beide Grenzen ruecken
    // um dieses Nachhinken mit
    const gs = this.geist
    for (let rest = dt; rest > 0; rest -= 8) {
      const h = Math.min(8, rest)
      const kz = 1 - Math.exp(-h * BEREICH)
      gs.zx += (kx - gs.zx) * kz
      gs.zy += (ky - gs.zy) * kz
      gs.vx += (BEREICH * BEREICH * (gs.zx - gs.x) - 2 * BEREICH * gs.vx) * h
      gs.vy += (BEREICH * BEREICH * (gs.zy - gs.y) - 2 * BEREICH * gs.vy) * h
      gs.x += gs.vx * h
      gs.y += gs.vy * h
    }
    const lag = { x: kx - gs.x, y: ky - gs.y }
    for (const ax of ['x', 'y'] as const)
      this.sichtNoetig[ax] = erde ? { plus: 0, minus: 0 } : { plus: sichtBis(ax, 1, RAND_SICHER), minus: sichtBis(ax, -1, RAND_SICHER) }

    const mitte = { x: this.frame.x + vx / 2, y: this.frame.y + vy / 2 }
    const roh = erde ? { ...kp } : { x: mitte.x + lehnen('x', 1) - lehnen('x', -1), y: mitte.y + lehnen('y', 1) - lehnen('y', -1) }
    const grenze = erde
      ? null
      : {
          x: { plus: rand('x', 1), minus: rand('x', -1) },
          y: { plus: rand('y', 1), minus: rand('y', -1) },
        }
    // Mindestabstand anwenden; reicht das Bild nicht fuer beide Seiten, gewinnt die, auf die die
    // Schlange eher zufaehrt
    const halten = (p: P) => {
      const q = { ...p }
      if (!grenze) return q
      for (const ax of ['x', 'y'] as const) {
        const lo = kp[ax] + grenze[ax].plus - view[ax] / 2 + lag[ax]
        const hi = kp[ax] - grenze[ax].minus + view[ax] / 2 + lag[ax]
        const plusZuletzt = zu(ax, 1) >= zu(ax, -1)
        for (const plus of plusZuletzt ? [false, true] : [true, false]) q[ax] = plus ? weichMax(q[ax], lo, 1.2) : -weichMax(-q[ax], -hi, 1.2)
      }
      return q
    }

    // Spruenge im Ziel gleiten weich hinueber. Neuer Ausschnitt, Erde, Fenstergroesse: das Hinueber-
    // lehnen mit Ease, der Mindestabstand gilt sofort. Karte gewachsen: alles, passend zur Welle,
    // mit der der neue Block aufklappt
    const sigRahmen = [this.frame.x, this.frame.y, erde, this.cell].join()
    const sigKarte = [g.w, g.h, g.blocks.length, g.extra.length].join()
    const karte = this.bLetzt !== null && sigKarte !== this.bSigKarte
    if (this.bLetzt && !karte && sigRahmen !== this.bSig) this.uebergang(this.bLetzt.x - roh.x, this.bLetzt.y - roh.y, false)
    this.bSig = sigRahmen
    this.bSigKarte = sigKarte
    this.bLetzt = roh
    const rest = (nach: boolean) => {
      const r = { x: 0, y: 0 }
      for (const u of this.uebergaenge) {
        if (u.nach !== nach) continue
        const t = 1 - smoother(clamp01((this.uhr - u.t) / BEREICH_WECHSEL))
        r.x += u.x * t
        r.y += u.y * t
      }
      return r
    }
    const vor = rest(false)
    const ziel = halten({ x: roh.x + vor.x, y: roh.y + vor.y })
    if (karte && this.bAus) this.uebergang(this.bAus.x - ziel.x, this.bAus.y - ziel.y, true)
    this.bAus = { ...ziel }
    const nach = rest(true)
    this.uebergaenge = this.uebergaenge.filter((u) => this.uhr - u.t < BEREICH_WECHSEL)
    return { x: ziel.x + nach.x, y: ziel.y + nach.y }
  }

  private uebergang(x: number, y: number, nach: boolean) {
    if (Math.abs(x) + Math.abs(y) > 0.01) this.uebergaenge.push({ x, y, t: this.uhr, nach })
  }

  /** Kritisch gedaempfte Feder zu einem weich nachgezogenen Ziel: Geschwindigkeit und
   *  Beschleunigung setzen sanft ein und klingen sanft aus, kein Ueberschwingen */
  private feder(tx: number, ty: number, w: number, dt: number) {
    // In kleinen Schritten rechnen, damit es auch bei langen Frames stabil bleibt
    for (let rest = dt; rest > 0; rest -= 8) {
      const h = Math.min(8, rest)
      const kz = 1 - Math.exp(-h * w)
      for (const a of ['x', 'y'] as const) {
        this.camZiel[a] += ((a === 'x' ? tx : ty) - this.camZiel[a]) * kz
        const acc = w * w * (this.camZiel[a] - this.cam[a]) - 2 * w * this.camV[a]
        this.camV[a] += acc * h
        this.cam[a] += this.camV[a] * h
      }
    }
  }

  /** Gegner-Schlange: rot, weich zwischen den Feldern, erscheint sanft. `weg` = besiegt seit */
  private drawGegner(g: Game, e: Gegner, now: number, weg?: number) {
    const { ctx, cell } = this
    const n = e.body.length
    const a = weg !== undefined || this.reduce ? 1 : clamp01((now - e.last) / g.schrittzeitVon(e))
    const ip = (i: number) => {
      const p = e.prev[i]
      const b = e.body[i]
      return p ? { x: lerp(p.x, b.x, a), y: lerp(p.y, b.y, a) } : b
    }
    const pts: P[] = [ip(0), ...e.body.slice(1), ip(n - 1)]
    const k = weg !== undefined ? clamp01((now - weg) / GEGNER_WEG) : 0
    ctx.globalAlpha = (this.reduce ? 1 : clamp01((now - e.t) / 450)) * (1 - k)
    const lila = e.art === 'lila'
    drawSchlange(ctx, pts, cell * (1 - k * 0.3), e.dir, lila ? LILA_SKIN : GEGNER_SKIN, now, {
      tot: weg !== undefined,
      brauen: lila ? 2 : true,
      angst: e.angst,
      blinzeln: weg === undefined && (now + e.t) % 3700 < 110,
    })
    ctx.globalAlpha = 1
    // Gerade ein Glied laenger geworden: kurzer Schimmer um den Kopf
    if (weg === undefined && now - e.wuchsT < 700) {
      const t = (now - e.wuchsT) / 700
      ctx.strokeStyle = `rgba(255, 138, 115, ${0.8 * (1 - t)})`
      ctx.lineWidth = Math.max(1.5, cell * 0.06)
      ctx.beginPath()
      ctx.arc((pts[0].x + 0.5) * cell, (pts[0].y + 0.5) * cell, cell * (0.45 + 0.35 * t), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  /** Minikarte unten links: nur die Kartenblöcke. Grün der Block mit der Schlange,
   *  in Apfelfarbe der Block mit dem Apfel (keine genauen Positionen).
   *  Erst sichtbar, wenn die Karte groesser als der Bildschirm ist */
  private drawMinikarte(g: Game, head: P) {
    if (g.blocks.length <= 2) return
    const { ctx, vh } = this
    const max = 50
    const s = Math.min(max / g.w, max / g.h)
    const mw = g.w * s
    const mh = g.h * s
    const pad = 4
    const x0 = 10 + pad
    // Ueber dem Schalter und dem Pause-Knopf unten links
    const y0 = vh - 10 - pad - mh - 42
    ctx.fillStyle = 'rgba(23, 21, 19, 0.55)'
    rund(ctx, x0 - pad, y0 - pad, mw + pad * 2, mh + pad * 2, 6)
    ctx.fill()
    const block = (p: P) => ({ x: Math.floor(p.x / g.bw), y: Math.floor(p.y / g.bh) })
    const sb = block({ x: Math.round(head.x), y: Math.round(head.y) })
    const ab = block(g.apple.p)
    const farbe = apfelFarbe(g.apfelStufe())
    for (const b of g.blocks) {
      const x = x0 + b.x * g.bw * s
      const y = y0 + b.y * g.bh * s
      const bw = g.bw * s - 1
      const bh = g.bh * s - 1
      const schlange = b.x === sb.x && b.y === sb.y
      const apfel = b.x === ab.x && b.y === ab.y
      ctx.fillStyle = schlange ? '#4CC38A' : apfel ? farbe : 'rgba(245, 239, 230, 0.2)'
      ctx.fillRect(x, y, bw, bh)
      if (!apfel) continue
      // Apfel-Block mit hellem Rand (auch ein gruener Apfel bleibt so erkennbar);
      // liegt der Apfel im Block der Schlange, steckt ein Kaestchen in Apfelfarbe darin
      if (schlange) {
        ctx.fillStyle = farbe
        ctx.fillRect(x + bw * 0.28, y + bh * 0.28, bw * 0.44, bh * 0.44)
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 1
      if (schlange) ctx.strokeRect(x + bw * 0.28, y + bh * 0.28, bw * 0.44, bh * 0.44)
      else ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1)
    }
    // Freigegrabene Felder ausserhalb der Bloecke
    ctx.fillStyle = 'rgba(245, 239, 230, 0.2)'
    for (const c of g.extra) ctx.fillRect(x0 + c.x * s, y0 + c.y * s, Math.max(1, s), Math.max(1, s))
  }

  /** Pfeil am Bildrand, wenn der Apfel ausserhalb liegt */
  private drawZeiger(g: Game, ox: number, oy: number, now: number) {
    const { ctx, cell, vw, vh } = this
    const ax = (g.apple.p.x + 0.5) * cell + ox
    const ay = (g.apple.p.y + 0.5) * cell + oy
    const m = cell * 0.5
    if (ax > m && ax < vw - m && ay > m && ay < vh - m) return
    const r = Math.max(15, cell * 0.55)
    const edge = r + 8
    const cx = Math.min(vw - edge, Math.max(edge, ax))
    const cy = Math.min(vh - edge, Math.max(edge, ay))
    const ang = Math.atan2(ay - cy, ax - cx)
    const puls = this.reduce ? 0 : Math.sin(now / 200) * 2
    ctx.save()
    ctx.translate(cx + Math.cos(ang) * puls, cy + Math.sin(ang) * puls)
    ctx.fillStyle = 'rgba(23, 21, 19, 0.82)'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    const farbe = apfelFarbe(g.apfelStufe())
    ctx.strokeStyle = farbe
    ctx.lineWidth = 2
    ctx.stroke()
    // Spitze in Richtung Apfel
    ctx.rotate(ang)
    ctx.fillStyle = farbe
    ctx.beginPath()
    ctx.moveTo(r + 7, 0)
    ctx.lineTo(r - 1, -6)
    ctx.lineTo(r - 1, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    drawApfel(ctx, cx, cy - r * 0.04, r * 1.45, 1, 0, undefined, g.apfelStufe())
  }
}
