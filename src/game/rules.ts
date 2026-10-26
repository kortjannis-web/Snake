/**
 * Alle Stellschrauben des Endlos-Modus. Die Zahlen stehen in `Config` und
 * lassen sich in den Master-Einstellungen aendern (SCHEMA beschreibt jede
 * Zahl fuer die Oberflaeche). Level = gegessene Aepfel + 1.
 */
import type { Dir, P } from './types'

export const STEP: Record<Dir, P> = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } }
export const OPP: Record<Dir, Dir> = { u: 'd', d: 'u', l: 'r', r: 'l' }
export const DIRS: Dir[] = ['u', 'd', 'l', 'r']
/** Im Uhrzeigersinn weiter */
export const CW: Record<Dir, Dir> = { u: 'r', r: 'd', d: 'l', l: 'u' }

/** Takt je Feld (ms): "normal" 154, "schnell" ist der Speedrun (25 % schneller: 154 / 1,25 = 123,2) und
 *  "langsam" der Abenteuer-Modus (genau 25 % langsamer, also 75 % der Geschwindigkeit: 154 / 0,75 = 205,33) */
export const TEMPO = { langsam: 154 / 0.75, normal: 154, schnell: 123 } as const
export type Tempo = keyof typeof TEMPO

const BASIS = {
  // Stufen fuer alles ausser den Gefahren (siehe WELT_STUFEN): nach den Mauern (mauerAb) das erste Neue ab stufenAb,
  // danach eins alle neuAlle Level; wie oft es dann kommt, haengt an seiner Stufe
  stufenAb: 15,
  neuAlle: 15,
  haeufigAlle: 3,
  mittelAlle: 8,
  seltenAlle: 20,
  // Karte
  gebietAlle: 20,
  gebietBis: 300,
  gebietAlle2: 30,
  gebietAb3: 500,
  gebietAlle3: 50,
  wahlZeit: 30,
  // Tempo und Wachsen
  tempoProLevel: 0.12,
  tempoMin: 68,
  wachsenAlle: 2,
  wachsenJedes: 50,
  wachsenJedesZweite: 300,
  schutz: 2.2,
  gnade: 10,
  // Mauern
  mauerAb: 5,
  mauerSchritt: 8,
  mauerMax: 6,
  mauerFelder: 130,
  // Teiche
  teichAb: 15,
  teichAlle: 15,
  teichMaxGroesse: 12,
  teichFelder: 220,
  // Giftaepfel
  giftAb: 40,
  giftAlle: 70,
  giftMax: 4,
  // Fallen
  falleAb: 70,
  falleMin: 4,
  falleMax: 5,
  falleDauer: 25,
  falleAbstandMin: 5,
  falleAbstandMax: 8,
  // Baeume
  baumAb: 60,
  baumAlle: 40,
  baumFelder: 150,
  baumKippMin: 10,
  baumKippMax: 60,
  // Giftwolken
  wolkeAb: 110,
  wolkeMin: 5,
  wolkeMax: 7,
  wolkeTakt: 5,
  wolkeStufeStart: 2,
  wolkeStufeMax: 5,
  wolkeZurueck: 10,
  // Froesche
  froschAb: 30,
  froschMin: 4,
  froschMax: 7,
  froschSprung: 3,
  froschWende: 20,
  froschAnzahl: 3,
  // Haeuser: erst kleine Huetten, ab hausGrossAb richtige Haeuser
  hausAb: 80,
  hausGrossAb: 130,
  hausAlle: 30,
  hausFelder: 250,
  lichtWeite: 2,
  lichtZurueck: 5,
  // Jaegertuerme
  turmAb: 50,
  turmAlle: 40,
  turmFelder: 300,
  kegelLaenge: 6,
  kegelZurueck: 10,
  // Eis
  eisAb: 120,
  eisAlle: 30,
  eisMin: 12,
  eisMax: 24,
  eisFelder: 300,
  // Lava: steckt von Anfang an als einzelnes Feld im Stein mancher Bloecke
  lavaChance: 30,
  lavaWachsen: 2,
  lavaMin: 6,
  lavaMax: 15,
  // Ameisen
  ameiseAb: 140,
  ameiseMin: 8,
  ameiseMax: 12,
  ameiseAnzahl: 4,
  ameiseRadius: 2,
  ameiseTakt: 0.8,
  ameiseZurueck: 3,
  // Kleine Steingolems (Wiese: 10, 7, 4 und 2 Level vor dem Boss je einer, dazu in den Missionen 6 bis 10): laufen
  // zufaellig, sehen nach vorn, schlagen zu
  minigolemTakt: 0.75,
  minigolemJagdTakt: 0.5,
  minigolemSicht: 7,
  minigolemLaden: 0.5,
  minigolemRuhe: 1.2,
  // Grosse Tannen (Wiese ab Level 60): stehen auf 3 x 3 Feldern und fallen 6 Felder weit
  tanneAb: 60,
  tanneAlle: 30,
  // Boss im freien Spiel (Wiese): auf diesem Level kommt der Steingolem mit 4 Sockeln, Belohnung mal Apfelwert
  bossAb: 60,
  bossLohn: 25,
  // Ent (Wiese): auf diesem Level einmal der Ent auf einer Lichtung (3 Holzstapel, ein Treffer), Belohnung mal Apfelwert
  entBossAb: 100,
  entBossLohn: 40,
  // Mini-Ents (Missionen 16 bis 20): werfen Blaetterbomben, packen zu, wenn man direkt vorbeifaehrt
  minientWeite: 4,
  minientWurf: 2.6,
  minientFlug: 1.1,
  minientGriff: 0.5,
  minientGriffPause: 2,
  // Gegner-Schlangen
  gegnerAb: 100,
  gegnerMin: 30,
  gegnerMax: 45,
  gegnerAnzahl: 2,
  gegnerWachsen: 20,
  gegnerMaxLaenge: 8,
  lilaAb: 75,
  lilaChance: 25,
  lilaLaenge: 5,
  lilaTempo: 20,
  lilaMaxLaenge: 10,
  gegnerReaktion: 4,
  gegnerReaktionWand: 2,
  // Power-ups und Aepfel als Waehrung
  powerAb: 10,
  powerChance: 18,
  powerDauer: 15,
  effektDauer: 30,
  zeitlupeProzent: 30,
  geistDauer: 6,
  powerGarantie: 8,
  schereLevel: 3,
  goldSchereAb: 50,
  goldSchereLevel: 8,
  fuetternDauer: 20,
  magnetDauer: 15,
  magnetRadius: 2,
  maulwurfAb: 90,
  maulwurfDauer: 20,
  grabWarnung: 2,
  // Erze unter der Erde (je 1000 Erdfelder) und ihr Wert in Aepfeln (mal Apfelwert)
  erzGold: 9,
  erzDia: 1.2,
  erzRubin: 0.5,
  erzOpal: 0.15,
  goldWert: 3,
  diaWert: 6,
  rubinWert: 10,
  opalWert: 20,
  apfelWert: 1,
  apfelWertAlle: 50,
  // Ereignisse
  ereignis1Ab: 170,
  ereignis2Ab: 230,
  ereignis3Ab: 290,
  haeufigerAb: 190,
  // Welt-Ereignisse (je Apfel, Prozent; ...An = 1 an, 0 aus). Fallen zwei zusammen, kommt das seltenere
  // Wueste
  flutAn: 1,
  flutChance: 6,
  sturmAn: 1,
  sturmChance: 8,
  wurmAn: 1,
  wurmChance: 4,
  // Winterwald: Ereignisse (Prozent je Apfel), Warnzeit und Dauer in Sekunden
  eiszapfenAn: 1,
  eiszapfenChance: 14,
  eiszapfenWarnung: 2.2,
  schneesturmAn: 1,
  schneesturmChance: 6,
  schneesturmWarnung: 2,
  schneesturmDauer: 3,
  yetiAn: 1,
  yetiChance: 3,
  polarnachtAn: 1,
  polarnachtChance: 0.5,
  polarnachtDauer: 14,
  // Winterwald: Eis bricht beim dritten Hineinfahren ein; Eis kommt so oft wie sonst Giftaepfel (und umgekehrt)
  eisRisseAn: 1,
  // Winterwald: Tiere (ab Level, Chance je Apfel, hoechstens gleichzeitig), Rueckschlaege in Leveln
  robbeAn: 1,
  robbeAb: 10,
  robbeChance: 6,
  robbeMax: 2,
  schneemannAn: 1,
  schneemannAb: 25,
  schneemannChance: 4,
  schneemannMax: 2,
  eisbaerAn: 1,
  eisbaerAb: 50,
  eisbaerChance: 3,
  eisbaerMax: 1,
  eisbaerZurueck: 5,
  schneeballZurueck: 3,
  igluAn: 1,
  // Bergwerk: Ereignisse (Prozent je Apfel), Warnzeiten in Sekunden
  steinschlagAn: 1,
  steinschlagChance: 33,
  steinschlagWarnung: 2.5,
  steinschlagMin: 2,
  steinschlagMax: 4,
  loreAn: 1,
  loreChance: 9,
  loreWarnung: 3,
  tntAn: 1,
  tntChance: 5,
  tntSchnur: 0.5,
  erdbebenAn: 1,
  erdbebenChance: 3,
  erdbebenWarnung: 2,
  fledermausAn: 1,
  fledermausChance: 6,
  fledermausWarnung: 1.5,
  fledermausZurueck: 3,
  // Bergwerk: Schienennetz (neue Schiene je neuem Block in Prozent), mehr Erz in den Stollen, abgestellte Loren
  schienenAn: 1,
  schienenNeu: 45,
  stollenErz: 25,
  lorenlagerAn: 1,
  // Bergwerk: Tiere und Netze
  zwergAn: 1,
  zwergAb: 20,
  zwergChance: 5,
  zwergMax: 1,
  golemAn: 1,
  golemAb: 60,
  golemChance: 3,
  golemMax: 1,
  golemZurueck: 6,
  netzAn: 1,
  netzAb: 10,
  netzChance: 12,
  netzMax: 3,
  netzBremse: 2,
  // Zauberwald: Ereignisse (Prozent je Apfel), Zeiten in Sekunden
  spiegelAn: 1,
  spiegelChance: 4,
  spiegelWarnung: 2,
  spiegelDauer: 6,
  rankenAn: 1,
  rankenChance: 10,
  rankenLaenge: 5,
  rankenTakt: 1.5,
  rankenAepfel: 2,
  wanderbaumAn: 1,
  wanderbaumChance: 6,
  wanderbaumMax: 3,
  sporenAn: 1,
  sporenChance: 7,
  sporenDauer: 5,
  irrlichtAn: 1,
  irrlichtChance: 5,
  // Zauberwald: Tiere und Pilzringe
  einhornAn: 1,
  einhornAb: 15,
  einhornChance: 4,
  einhornMax: 1,
  feeAn: 1,
  feeAb: 10,
  feeChance: 5,
  feeMax: 1,
  entAn: 1,
  entAb: 40,
  entChance: 3,
  entMax: 2,
  pilzringAn: 1,
  pilzringAb: 20,
  pilzringChance: 5,
  // Gruselwald: Ereignisse
  zombiehandAn: 1,
  zombiehandChance: 12,
  zombiehandWarnung: 1.5,
  zombiehandMin: 3,
  zombiehandMax: 5,
  grabAn: 1,
  grabChance: 6,
  skelettZurueck: 4,
  kraehenschwarmAn: 1,
  kraehenschwarmChance: 4,
  werwolfAn: 1,
  werwolfAlle: 25,
  werwolfDauer: 15,
  werwolfZurueck: 8,
  // Gruselwald: Tiere
  gespenstAn: 1,
  gespenstAb: 15,
  gespenstChance: 5,
  gespenstMax: 2,
  gespenstZurueck: 4,
  spinneAn: 1,
  spinneAb: 30,
  spinneChance: 4,
  spinneMax: 1,
  kraeheAn: 1,
  kraeheAb: 10,
  kraeheChance: 8,
  kraeheMax: 1,
  // Vulkan: Bloecke je Richtung so viele Felder groesser, Krater (Prozent jedes Blocks, Mindestgroesse in Feldern)
  vulkanBlockPlus: 3,
  kraterProzent: 10,
  kraterMin: 6,
  // Vulkan: Ereignisse (Prozent je Apfel), Zeiten in Sekunden
  abbruchAn: 1,
  abbruchChance: 8,
  abbruchWarnung: 3,
  ausbruchAn: 1,
  ausbruchChance: 7,
  ausbruchWarnung: 2,
  ausbruchMin: 3,
  ausbruchMax: 5,
  lavastromAn: 1,
  lavastromChance: 5,
  lavastromLaenge: 7,
  lavastromTakt: 0.6,
  lavastromAepfel: 2,
  magmawurmAn: 1,
  magmawurmChance: 4,
  feuerregenAn: 1,
  feuerregenChance: 6,
  feuerregenWarnung: 2.5,
  feuerregenMin: 4,
  feuerregenMax: 7,
  // Vulkan: Tiere und Dinge
  lavafischAn: 1,
  lavafischAb: 10,
  lavafischChance: 6,
  lavafischMax: 2,
  glutgolemAn: 1,
  glutgolemAb: 40,
  glutgolemChance: 4,
  glutgolemMax: 1,
  glutDauer: 3,
  brueckeAn: 1,
  brueckeAb: 20,
  brueckeChance: 8,
  brueckeMax: 2,
  brueckeUeber: 2,
  obsidianAn: 1,
  obsidianAb: 30,
  obsidianChance: 5,
  obsidianWert: 3,
  // Wiese: Tiere
  bienenstockAn: 1,
  bienenstockAb: 20,
  bienenstockChance: 5,
  bienenZurueck: 3,
  igelAn: 1,
  igelAb: 10,
  igelChance: 6,
  igelMax: 2,
  huegelAn: 1,
  huegelAb: 15,
  huegelChance: 10,
  huegelDauer: 4,
  // Wueste: Tiere
  karawaneAn: 1,
  karawaneAb: 5,
  karawaneChance: 5,
  geierAn: 1,
  geierAb: 5,
  geierChance: 7,
  geierWarnung: 2.5,
  klapperAn: 1,
  klapperAb: 35,
  klapperChance: 5,
  klapperMax: 2,
  klapperZurueck: 5,
  // Wueste: Riesenskorpion, Sandkrabbe, Erdmaennchen, Mumie, Fata Morgana
  skorpionAn: 1,
  skorpionAb: 5,
  skorpionChance: 12,
  skorpionMax: 1,
  skorpionZurueck: 4,
  krabbeAn: 1,
  krabbeAb: 5,
  krabbeChance: 12,
  krabbeMax: 2,
  erdmaennchenAn: 1,
  erdmaennchenAb: 5,
  erdmaennchenChance: 12,
  mumieAn: 1,
  mumieAb: 5,
  mumieChance: 12,
  mumieZurueck: 5,
  fataAn: 1,
  fataAb: 5,
  fataChance: 12,
}

/* ---------------- Stufen ----------------
 * Alles ausser den Gefahren kommt in Stufen: haeufig (3), mittel (2), selten (1) oder aus (0). Mauern sind immer haeufig
 * (sie kommen nach jedem Apfel neu, als Erstes ab mauerAb), der Apfel ist immer da. Neues kommt selten und nacheinander:
 * das erste ab stufenAb, dann eins alle neuAlle Level (erst das Haeufige, dann das Mittlere, zuletzt das Seltene), damit
 * der Spieler nicht ueberhaeuft wird. Feste Zeiten: Mauern ab mauerAb (5), Jaegertuerme ab turmAb (50), der lila Gegner
 * ab lilaAb (75, immer nur einer); was zu nah daran laege, rueckt dahinter.
 * Je Welt ist eingestellt, was haeufig ist (Wiese: Wasser und Froesche; Wueste: Palmen, Springmaeuse, Feuerameisen). */
export const GRUND_ARTEN = ['teich', 'frosch', 'gift', 'baum', 'falle', 'haus', 'eis', 'wolke', 'ameise', 'gegner', 'turm'] as const
export type GrundArt = (typeof GRUND_ARTEN)[number]
const grund = (haeufig: GrundArt[] = []) => Object.fromEntries(GRUND_ARTEN.map((a) => [a, haeufig.includes(a) ? 3 : 2])) as Record<GrundArt, number>
/** Je Welt: Stufe je Ding (Grund-Dinge und die Tiere/Dinge der Welt; deren Name = Anfang ihrer Config-Schluessel) */
export const WELT_STUFEN = {
  wiese: { ...grund(['teich', 'frosch']), igel: 2, huegel: 2, bienenstock: 2 },
  // Kein Eis in der Wueste
  wueste: { ...grund(['baum', 'frosch', 'ameise']), eis: 0, klapper: 2, skorpion: 2, krabbe: 2, erdmaennchen: 2, mumie: 2, fata: 2 },
  winter: { ...grund(), robbe: 2, schneemann: 2, eisbaer: 2 },
  bergwerk: { ...grund(), zwerg: 2, golem: 2, netz: 2 },
  zauberwald: { ...grund(), einhorn: 2, fee: 2, ent: 2, pilzring: 2 },
  gruselwald: { ...grund(), gespenst: 2, spinne: 2, kraehe: 2 },
  vulkan: { ...grund(), lavafisch: 2, glutgolem: 2, bruecke: 2, obsidian: 2 },
}
export type WeltId = keyof typeof WELT_STUFEN
export const WELT_IDS = Object.keys(WELT_STUFEN) as WeltId[]
type StufeKey = { [W in WeltId]: `stufe_${W}_${keyof (typeof WELT_STUFEN)[W] & string}` }[WeltId]
export const stufeKey = (welt: WeltId, art: string) => `stufe_${welt}_${art}` as StufeKey
const STUFEN_DEFAULTS = Object.fromEntries(WELT_IDS.flatMap((w) => Object.entries(WELT_STUFEN[w]).map(([a, v]) => [stufeKey(w, a), v]))) as Record<StufeKey, number>
export const DEFAULTS = { ...BASIS, ...STUFEN_DEFAULTS }
export type Config = typeof DEFAULTS
export type ConfigKey = keyof Config
export const STUFE_NAME = ['aus', 'selten', 'mittel', 'häufig'] as const
/** Nie (Stufe aus) */
export const NIE = 1_000_000_000

/** Gefahren je Welt, von haeufig nach selten (Schluessel-Anfang: xAn, xChance). Fallen zwei zusammen, kommt die seltenere */
export const WELT_GEFAHREN: Record<WeltId, string[]> = {
  wiese: [],
  wueste: ['sturm', 'geier', 'flut', 'karawane', 'wurm'],
  winter: ['eiszapfen', 'schneesturm', 'yeti', 'polarnacht'],
  bergwerk: ['steinschlag', 'lore', 'fledermaus', 'tnt', 'erdbeben'],
  zauberwald: ['ranken', 'sporen', 'wanderbaum', 'irrlicht', 'spiegel'],
  gruselwald: ['zombiehand', 'grab', 'kraehenschwarm'],
  vulkan: ['abbruch', 'ausbruch', 'feuerregen', 'lavastrom', 'magmawurm'],
}
/** Name einer Gefahren-Stufe nach ihrer Chance je Apfel */
export const gefahrStufe = (chance: number) => (chance <= 0 ? 'aus' : chance >= 10 ? 'häufig' : chance >= 6 ? 'mittel' : chance >= 3 ? 'selten' : 'sehr selten')

/** Neu alle so viele Level fuer eine Stufe */
export const stufeAlle = (c: Config, stufe: number) => Math.max(1, Math.round(stufe >= 3 ? c.haeufigAlle : stufe === 2 ? c.mittelAlle : c.seltenAlle))

/** Schluessel, die aus den Stufen berechnet werden (in den Master-Einstellungen nicht einzeln) */
export const ABGELEITET = new Set<string>([
  'teichAb', 'teichAlle', 'baumAb', 'baumAlle', 'hausAb', 'hausAlle', 'hausGrossAb', 'turmAlle', 'eisAb', 'eisAlle', 'giftAb', 'giftAlle',
  ...(['falle', 'wolke', 'frosch', 'ameise', 'gegner'] as const).flatMap((a) => [`${a}Ab`, `${a}Min`, `${a}Max`]),
  ...WELT_IDS.flatMap((w) => Object.keys(WELT_STUFEN[w]).filter((a) => !(GRUND_ARTEN as readonly string[]).includes(a)).flatMap((a) => [`${a}Ab`, `${a}Chance`])),
])

/**
 * Reihenfolge, in der die Dinge einer Welt neu dazukommen (ohne Jaegertuerme, die haben eine feste Zeit, und ohne
 * Abgeschaltetes): erst alles Haeufige, dann das Mittlere, dann das Seltene. Innerhalb einer Stufe wechseln sich die
 * Grund-Dinge (von leicht nach schwer) und die Tiere der Welt gleichmaessig ab.
 */
export function neuReihenfolge(c: Config, welt: WeltId): string[] {
  const arten = Object.keys(WELT_STUFEN[welt]).filter((a) => a !== 'turm')
  const stufe = (a: string) => c[stufeKey(welt, a)] ?? 2
  const out: string[] = []
  for (const s of [3, 2, 1]) {
    const grundArten = arten.filter((a) => stufe(a) === s && (GRUND_ARTEN as readonly string[]).includes(a))
    const tiere = arten.filter((a) => stufe(a) === s && !(GRUND_ARTEN as readonly string[]).includes(a))
    // Gleichmaessig verteilt: jedes bekommt seinen Platz nach seinem Anteil an der Liste
    const platz = (i: number, n: number) => (i + 0.5) / n
    const gemischt = [...grundArten.map((a, i) => ({ a, p: platz(i, grundArten.length) })), ...tiere.map((a, i) => ({ a, p: platz(i, tiere.length) + 1e-9 }))]
    out.push(...gemischt.sort((x, y) => x.p - y.p).map((x) => x.a))
  }
  return out
}

/**
 * Level, an denen die ersten `n` Dinge der Reihe kommen: ab stufenAb alle neuAlle Level. Liegt ein Platz naeher als einen
 * halben Abstand an einer festen Zeit (Mauern, Jaegertuerme, lila Gegner), rueckt er einen ganzen Abstand dahinter,
 * damit nie zwei neue Sachen kurz hintereinander kommen.
 */
export function neuLevels(c: Config, n: number, fest: number[] = [c.mauerAb, c.turmAb, c.lilaAb]): number[] {
  const abstand = Math.max(1, Math.round(c.neuAlle))
  const feste = fest.filter((f) => f < NIE).sort((a, b) => a - b)
  const out: number[] = []
  let l = Math.max(1, Math.round(c.stufenAb))
  while (out.length < n) {
    const nah = feste.find((f) => Math.abs(f - l) < abstand / 2)
    if (nah !== undefined) {
      l = nah + abstand
      continue
    }
    out.push(l)
    l += abstand
  }
  return out
}

/**
 * Stufen anwenden: berechnet Start-Level und Abstaende aller Dinge dieser Welt aus ihren Stufen. Neues kommt
 * nacheinander (siehe neuReihenfolge und neuLevels): das erste ab stufenAb, dann eins alle neuAlle Level. Was ausdruecklich
 * eingestellt ist (anders als der Standard), bleibt. Unbekannte Welt (Sandbox, Tageslevel) = Wiese.
 */
export function mitStufen(c: Config, welt: string): Config {
  const w: WeltId = welt in WELT_STUFEN ? (welt as WeltId) : 'wiese'
  const out: Config = { ...c }
  const setze = (k: string, v: number) => {
    const key = k as ConfigKey
    if (c[key] === DEFAULTS[key]) (out as Record<string, number>)[k] = v
  }
  const reihe = neuReihenfolge(c, w)
  // Jaegertuerme zaehlen nur als feste Zeit, wenn sie kommen
  const turm = (c[stufeKey(w, 'turm')] ?? 2) > 0 ? c.turmAb : NIE
  const level = neuLevels(c, reihe.length, [c.mauerAb, turm, c.lilaAb])
  for (const art of Object.keys(WELT_STUFEN[w])) {
    // Eis in der Wueste gibt es nie (auch nicht, wenn eine alte Einstellung es noch einschaltet)
    const stufe = w === 'wueste' && art === 'eis' ? 0 : (c[stufeKey(w, art)] ?? 2)
    const n = stufeAlle(c, stufe)
    const platz = reihe.indexOf(art)
    const ab = stufe <= 0 || platz < 0 ? NIE : level[platz]
    const pause = [Math.max(1, Math.round(n * 0.75)), Math.max(1, Math.round(n * 1.25))]
    switch (art) {
      case 'teich':
      case 'baum':
      case 'haus':
      case 'eis':
        setze(`${art}Ab`, ab)
        setze(`${art}Alle`, n)
        if (art === 'haus') setze('hausGrossAb', ab + 50)
        break
      case 'turm':
        setze('turmAlle', n)
        if (stufe <= 0) (out as Record<string, number>).turmAb = NIE
        break
      case 'gift':
        setze('giftAb', ab)
        setze('giftAlle', n * 8)
        break
      case 'falle':
      case 'wolke':
      case 'frosch':
      case 'ameise':
      case 'gegner':
        setze(`${art}Ab`, ab)
        setze(`${art}Min`, pause[0])
        setze(`${art}Max`, pause[1])
        break
      default:
        // Tiere und Dinge der Welt: Chance je Apfel
        setze(`${art}Ab`, ab)
        setze(`${art}Chance`, Math.round((1000 / n)) / 10)
        if (stufe <= 0) (out as Record<string, number>)[`${art}An`] = 0
    }
  }
  return out
}

/** Ab welchem Level ein Ding dieser Welt kommt (nach den Stufen; NIE = gar nicht) */
export const dingAb = (c: Config, welt: WeltId, art: string) => {
  const m = mitStufen(c, welt) as Record<string, number>
  return m[`${art}Ab`] ?? NIE
}

/** Beschreibung jeder Zahl fuer die Master-Einstellungen */
/** schalter: an/aus (1/0) statt Zahl */
/** Feld der Master-Einstellungen. schalter: an/aus (1/0), stufe: haeufig/mittel/selten/aus (3..0) */
export type SchemaFeld = { key: ConfigKey; label: string; min: number; max: number; step?: number; einheit?: string; schalter?: boolean; stufe?: boolean }
export type SchemaGruppe = { gruppe: string; felder: SchemaFeld[] }

/** Namen der Dinge je Welt (Grund-Dinge heissen je Welt anders, dazu die Tiere und Dinge der Welt) */
const GRUND_NAME: Record<GrundArt, string> = {
  teich: 'Wasser (Teiche)', frosch: 'Frösche', gift: 'Giftäpfel', baum: 'Bäume', falle: 'Bärenfallen', haus: 'Hütten und Häuser',
  eis: 'Eis', wolke: 'Giftwolken', ameise: 'Ameisen', gegner: 'Gegner-Schlangen', turm: 'Jägertürme (ab Level 50)',
}
const WELT_NAME_DING: Partial<Record<WeltId, Partial<Record<string, string>>>> = {
  wueste: { teich: 'Oasen', frosch: 'Springmäuse', baum: 'Palmen und Kakteen', falle: 'Skorpione im Sand', ameise: 'Feuerameisen', klapper: 'Klapperschlange', skorpion: 'Riesenskorpion', krabbe: 'Sandkrabbe', erdmaennchen: 'Erdmännchen', mumie: 'Mumie mit Sarkophag', fata: 'Fata Morgana' },
  winter: { teich: 'Seen mit Eisschollen', frosch: 'Pinguine', baum: 'Tannen', falle: 'Schneelöcher', haus: 'Hütten (Iglus)', ameise: 'Eiskäfer', robbe: 'Robbe', schneemann: 'Schneemann', eisbaer: 'Eisbär' },
  bergwerk: { teich: 'Höhlenseen', frosch: 'Fledermäuse', baum: 'Kristallsäulen', falle: 'TNT-Fallen', ameise: 'Höhlenspinnen', zwerg: 'Grubenzwerg', golem: 'Steingolem', netz: 'Spinnennetze' },
  zauberwald: { teich: 'Leuchtende Seen', frosch: 'Leuchtfrösche', falle: 'Fleischfressende Pflanzen', ameise: 'Glühkäfer', einhorn: 'Einhorn', fee: 'Fee', ent: 'Ent', pilzring: 'Pilzringe' },
  gruselwald: { teich: 'Sumpf', frosch: 'Kröten', baum: 'Tote Bäume', falle: 'Knochenhände', ameise: 'Spinnen', gespenst: 'Gespenst', spinne: 'Riesenspinne', kraehe: 'Krähe' },
  vulkan: { teich: 'Schwefelquellen', frosch: 'Feuersalamander', baum: 'Verkohlte Bäume', falle: 'Dampfspalten', ameise: 'Feuerameisen', lavafisch: 'Lavafisch', glutgolem: 'Glutgolem', bruecke: 'Lavabrücke', obsidian: 'Obsidian-Kristall' },
  wiese: { igel: 'Igel', huegel: 'Maulwurfshügel', bienenstock: 'Bienenstock' },
}
export const dingName = (welt: WeltId, art: string) => WELT_NAME_DING[welt]?.[art] ?? GRUND_NAME[art as GrundArt] ?? art
export const WELT_TITEL: Record<WeltId, string> = { wiese: 'Wiese', wueste: 'Wüstenoase', winter: 'Winterwald', bergwerk: 'Bergwerk', zauberwald: 'Zauberwald', gruselwald: 'Gruselwald', vulkan: 'Vulkan' }

/** Kreativ: was in einer Welt kommen kann (zum An- und Abschalten), in der Reihenfolge der Liste */
export function kreativDinge(welt: WeltId): { key: string; name: string }[] {
  const gefahrName = (k: string) => SCHEMA_ROH.flatMap((g) => g.felder).find((f) => f.key === `${k}An`)?.label ?? k
  return [
    { key: 'mauer', name: 'Mauern' },
    { key: 'power', name: 'Power-ups' },
    ...Object.keys(WELT_STUFEN[welt]).map((a) => ({ key: a, name: dingName(welt, a) })),
    { key: 'lila', name: 'Lila Gegner (ab Level 75)' },
    ...WELT_GEFAHREN[welt].map((k) => ({ key: k, name: gefahrName(k) })),
    ...(welt === 'gruselwald' ? [{ key: 'werwolf', name: gefahrName('werwolf') }] : []),
  ]
}

/** Kreativ: Einstellungen, mit denen die abgeschalteten Dinge dieser Welt nie kommen */
export function kreativAus(welt: WeltId, aus: readonly string[]): Partial<Config> {
  const o: Record<string, number> = {}
  const stufen = WELT_STUFEN[welt] as Record<string, number>
  for (const k of aus) {
    if (k === 'mauer') o.mauerAb = NIE
    else if (k === 'power') o.powerAb = NIE
    else if (k === 'lila') {
      o.lilaAb = NIE
      o.lilaChance = 0
    } else if (k in stufen) o[stufeKey(welt, k)] = 0
    else if (WELT_GEFAHREN[welt].includes(k) || k === 'werwolf') o[`${k}An`] = 0
  }
  return o as Partial<Config>
}

/** Stufen-Gruppen: wie oft die Stufen sind, dann je Welt, was in welcher Stufe ist */
export const STUFEN_SCHEMA: SchemaGruppe[] = [
  {
    gruppe: 'Stufen: wie oft (gilt für alle Welten)',
    felder: [
      { key: 'stufenAb', label: 'Nach den Mauern das erste Neue ab Level', min: 1, max: 1000 },
      { key: 'mauerAb', label: 'Mauern ab Level (das allererste)', min: 1, max: 10000 },
      { key: 'neuAlle', label: 'Danach etwas Neues alle', min: 1, max: 100, einheit: 'Level' },
      { key: 'haeufigAlle', label: 'Häufig: neu etwa alle', min: 1, max: 100, einheit: 'Level' },
      { key: 'mittelAlle', label: 'Mittel: neu etwa alle', min: 1, max: 200, einheit: 'Level' },
      { key: 'seltenAlle', label: 'Selten: neu etwa alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'turmAb', label: 'Jägertürme ab Level (feste Zeit)', min: 1, max: 10000 },
      { key: 'lilaAb', label: 'Lila Gegner ab Level (immer nur einer)', min: 1, max: 10000 },
    ],
  },
  ...WELT_IDS.map((w) => ({
    gruppe: `Stufen: ${WELT_TITEL[w]} (Mauern sind immer häufig)`,
    felder: Object.keys(WELT_STUFEN[w]).map((art) => ({ key: stufeKey(w, art) as ConfigKey, label: dingName(w, art), min: 0, max: 3, stufe: true })),
  })),
]

const SCHEMA_ROH: SchemaGruppe[] = [
  {
    gruppe: 'Karte',
    felder: [
      { key: 'gebietAlle', label: 'Neues Gebiet alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'gebietBis', label: 'Ab Level seltener', min: 1, max: 10000 },
      { key: 'gebietAlle2', label: 'Dann alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'gebietAb3', label: 'Ab Level noch seltener', min: 1, max: 10000 },
      { key: 'gebietAlle3', label: 'Dann alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'wahlZeit', label: 'Zeit zum Wählen (Wand einreißen)', min: 5, max: 300, einheit: 's' },
    ],
  },
  {
    gruppe: 'Schlange',
    felder: [
      { key: 'tempoProLevel', label: 'Schneller je Level', min: 0, max: 2, step: 0.01, einheit: '%' },
      { key: 'tempoMin', label: 'Höchstens so schnell (Takt)', min: 20, max: 100, einheit: '%' },
      { key: 'wachsenAlle', label: 'Wächst ein Glied alle', min: 1, max: 20, einheit: 'Äpfel' },
      { key: 'wachsenJedes', label: 'Ab Level nur noch halb so oft', min: 0, max: 10000 },
      { key: 'wachsenJedesZweite', label: 'Ab Level nur noch ein Drittel so oft', min: 0, max: 10000 },
      { key: 'schutz', label: 'Schutz nach Rückschlag', min: 0, max: 10, step: 0.1, einheit: 's' },
      { key: 'gnade', label: 'Reaktionszeit vor dem Aufprall', min: 0, max: 500, einheit: 'ms' },
    ],
  },
  {
    gruppe: 'Mauern',
    felder: [
      { key: 'mauerAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'mauerSchritt', label: 'Ein Feld länger alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'mauerMax', label: 'Längste Mauer', min: 2, max: 20, einheit: 'Felder' },
      { key: 'mauerFelder', label: 'Höchstens eine Mauer je', min: 20, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Teiche',
    felder: [
      { key: 'teichAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'teichAlle', label: 'Neuer Teich alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'teichMaxGroesse', label: 'Größter Teich', min: 2, max: 40, einheit: 'Felder' },
      { key: 'teichFelder', label: 'Höchstens ein Teich je', min: 20, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Giftäpfel',
    felder: [
      { key: 'giftAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'giftAlle', label: 'Einer mehr alle', min: 1, max: 1000, einheit: 'Level' },
      { key: 'giftMax', label: 'Höchstens', min: 0, max: 20, einheit: 'Stück' },
    ],
  },
  {
    gruppe: 'Bärenfallen',
    felder: [
      { key: 'falleAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'falleMin', label: 'Abstand mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'falleMax', label: 'Abstand höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'falleDauer', label: 'Liegt', min: 3, max: 300, einheit: 's' },
      { key: 'falleAbstandMin', label: 'Vor dem Kopf mindestens', min: 2, max: 30, einheit: 'Felder' },
      { key: 'falleAbstandMax', label: 'Vor dem Kopf höchstens', min: 2, max: 30, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Bäume',
    felder: [
      { key: 'baumAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'baumAlle', label: 'Neuer Baum alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'baumFelder', label: 'Höchstens ein Baum je', min: 20, max: 5000, einheit: 'Felder' },
      { key: 'baumKippMin', label: 'Steht, bevor er kippt, mindestens', min: 1, max: 600, einheit: 's' },
      { key: 'baumKippMax', label: 'Steht, bevor er kippt, höchstens', min: 1, max: 600, einheit: 's' },
    ],
  },
  {
    gruppe: 'Giftwolken',
    felder: [
      { key: 'wolkeAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'wolkeMin', label: 'Abstand mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'wolkeMax', label: 'Abstand höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'wolkeTakt', label: 'Wächst alle', min: 1, max: 60, step: 0.5, einheit: 's' },
      { key: 'wolkeStufeStart', label: 'Größte Stufe am Anfang (1 Kreuz, 2 Quadrat …)', min: 1, max: 8 },
      { key: 'wolkeStufeMax', label: 'Größte Stufe insgesamt (+1 je 50 Level)', min: 1, max: 8 },
      { key: 'wolkeZurueck', label: 'Treffer kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Frösche',
    felder: [
      { key: 'froschAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'froschMin', label: 'Neuer Frosch alle mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'froschMax', label: 'Neuer Frosch alle höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'froschSprung', label: 'Hüpft alle', min: 1, max: 20, step: 0.1, einheit: 's' },
      { key: 'froschWende', label: 'Chance auf Richtungswechsel', min: 0, max: 100, einheit: '%' },
      { key: 'froschAnzahl', label: 'Höchstens gleichzeitig', min: 0, max: 40, einheit: 'Frösche' },
    ],
  },
  {
    gruppe: 'Häuser',
    felder: [
      { key: 'hausAb', label: 'Kleine Hütten (2 × 2) ab Level', min: 1, max: 10000 },
      { key: 'hausGrossAb', label: 'Große Häuser ab Level', min: 1, max: 10000 },
      { key: 'hausAlle', label: 'Neues Haus alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'hausFelder', label: 'Höchstens ein Haus je', min: 30, max: 5000, einheit: 'Felder' },
      { key: 'lichtWeite', label: 'Licht reicht immer', min: 1, max: 10, einheit: 'Felder' },
      { key: 'lichtZurueck', label: 'Licht kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Jägertürme',
    felder: [
      { key: 'turmAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'turmAlle', label: 'Neuer Turm alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'turmFelder', label: 'Höchstens ein Turm je', min: 30, max: 5000, einheit: 'Felder' },
      { key: 'kegelLaenge', label: 'Lichtkegel lang', min: 1, max: 20, einheit: 'Felder' },
      { key: 'kegelZurueck', label: 'Kegel kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Gegner-Schlangen',
    felder: [
      { key: 'gegnerAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'gegnerMin', label: 'Neue alle mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'gegnerMax', label: 'Neue alle höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'gegnerAnzahl', label: 'Höchstens gleichzeitig (+1 je 100 Level)', min: 0, max: 20 },
      { key: 'gegnerWachsen', label: 'Wird ein Glied länger alle', min: 1, max: 600, einheit: 's' },
      { key: 'gegnerMaxLaenge', label: 'Höchstens so lang', min: 3, max: 40, einheit: 'Glieder' },
      { key: 'lilaAb', label: 'Lila Gegner ab Level', min: 1, max: 10000 },
      { key: 'lilaChance', label: 'Chance, dass ein neuer Gegner lila ist', min: 0, max: 100, einheit: '%' },
      { key: 'lilaLaenge', label: 'Lila startet mit', min: 3, max: 30, einheit: 'Glieder' },
      { key: 'lilaTempo', label: 'Lila schneller als Rot', min: 0, max: 200, einheit: '%' },
      { key: 'lilaMaxLaenge', label: 'Lila höchstens so lang', min: 3, max: 40, einheit: 'Glieder' },
      { key: 'gegnerReaktion', label: 'Baut sich die Schlange gerade so nah vor einem Gegner auf, lenkt er nicht mehr rechtzeitig', min: 0, max: 10, einheit: 'Felder' },
      { key: 'gegnerReaktionWand', label: 'Läuft ein Gegner auf die Schlange zu: so viele Felder braucht er, um zu reagieren', min: 0, max: 10, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Ameisen',
    felder: [
      { key: 'ameiseAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'ameiseMin', label: 'Neue alle mindestens', min: 1, max: 100, einheit: 'Level' },
      { key: 'ameiseMax', label: 'Neue alle höchstens', min: 1, max: 100, einheit: 'Level' },
      { key: 'ameiseAnzahl', label: 'Höchstens gleichzeitig', min: 0, max: 30 },
      { key: 'ameiseRadius', label: 'Wird aufmerksam im Umkreis von', min: 1, max: 10, einheit: 'Feldern' },
      { key: 'ameiseTakt', label: 'Krabbelt ein Feld alle', min: 0.1, max: 5, step: 0.05, einheit: 's' },
      { key: 'ameiseZurueck', label: 'Biss kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Wiese: Steingolems, große Tannen, Bosse, Mini-Ents',
    felder: [
      { key: 'minigolemTakt', label: 'Golem läuft ein Feld alle', min: 0.1, max: 5, step: 0.05, einheit: 's' },
      { key: 'minigolemJagdTakt', label: 'Golem auf der Jagd: ein Feld alle', min: 0.1, max: 5, step: 0.05, einheit: 's' },
      { key: 'minigolemSicht', label: 'Golem sieht nach vorn', min: 1, max: 12, einheit: 'Felder' },
      { key: 'minigolemLaden', label: 'Golem holt aus', min: 0.1, max: 5, step: 0.05, einheit: 's' },
      { key: 'minigolemRuhe', label: 'Golem nach dem Schlag', min: 0, max: 10, step: 0.1, einheit: 's' },
      { key: 'tanneAb', label: 'Große Tannen ab Level', min: 1, max: 10000 },
      { key: 'tanneAlle', label: 'Neue große Tanne alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'bossAb', label: 'Boss (Steingolem) auf Level (10, 7, 4 und 2 Level vorher je ein kleiner Golem)', min: 1, max: 10000 },
      { key: 'bossLohn', label: 'Boss besiegt bringt', min: 0, max: 1000, einheit: '× Apfelwert' },
      { key: 'entBossAb', label: 'Ent auf Level (10, 7, 4 und 2 Level vorher je ein Mini-Ent)', min: 1, max: 10000 },
      { key: 'entBossLohn', label: 'Ent besiegt bringt', min: 0, max: 1000, einheit: '× Apfelwert' },
      { key: 'minientWeite', label: 'Mini-Ent bemerkt dich bis', min: 1, max: 20, einheit: 'Felder' },
      { key: 'minientWurf', label: 'Mini-Ent wirft alle', min: 0.3, max: 20, step: 0.1, einheit: 's' },
      { key: 'minientFlug', label: 'Blätterbombe fliegt', min: 0.2, max: 5, step: 0.05, einheit: 's' },
      { key: 'minientGriff', label: 'Mini-Ent packt: Zeit zum Wegziehen', min: 0.1, max: 5, step: 0.05, einheit: 's' },
      { key: 'minientGriffPause', label: 'Mini-Ent packt erst wieder nach', min: 0, max: 30, step: 0.1, einheit: 's' },
    ],
  },
  {
    gruppe: 'Lava',
    felder: [
      { key: 'lavaChance', label: 'Chance, dass ein Block ein Lavafeld im Stein hat', min: 0, max: 100, einheit: '%' },
      { key: 'lavaWachsen', label: 'Breitet sich aus jeden', min: 1, max: 50, einheit: '. Apfel' },
      { key: 'lavaMin', label: 'Hört frühestens auf bei', min: 1, max: 60, einheit: 'Feldern' },
      { key: 'lavaMax', label: 'Hört spätestens auf bei', min: 1, max: 60, einheit: 'Feldern' },
    ],
  },
  {
    gruppe: 'Power-ups und Äpfel',
    felder: [
      { key: 'powerAb', label: 'Power-ups ab Level', min: 1, max: 10000 },
      { key: 'powerChance', label: 'Chance je Apfel auf ein Power-up', min: 0, max: 100, einheit: '%' },
      { key: 'powerDauer', label: 'Power-up liegt', min: 3, max: 120, einheit: 's' },
      { key: 'powerGarantie', label: 'Spätestens ein Power-up nach', min: 1, max: 100, einheit: 'Äpfeln' },
      { key: 'effektDauer', label: 'Zeitlupe hält', min: 1, max: 120, einheit: 's' },
      { key: 'zeitlupeProzent', label: 'Zeitlupe langsamer um', min: 5, max: 80, einheit: '%' },
      { key: 'geistDauer', label: 'Geist hält', min: 1, max: 60, einheit: 's' },
      { key: 'schereLevel', label: 'Schere schneidet dauerhaft ab, was gewachsen ist in den letzten', min: 1, max: 100, einheit: 'Level' },
      { key: 'goldSchereAb', label: 'Goldene Schere ab Level', min: 1, max: 10000 },
      { key: 'goldSchereLevel', label: 'Goldene Schere schneidet ab, was gewachsen ist in den letzten', min: 1, max: 200, einheit: 'Level' },
      { key: 'fuetternDauer', label: 'Füttern (Tiere und Schlangen fressen, durch sich selbst) hält', min: 1, max: 120, einheit: 's' },
      { key: 'magnetDauer', label: 'Magnet hält', min: 1, max: 120, einheit: 's' },
      { key: 'magnetRadius', label: 'Magnet holt alles im Umkreis von', min: 1, max: 10, einheit: 'Feldern' },
      { key: 'maulwurfAb', label: 'Maulwurf ab Level', min: 1, max: 10000 },
      { key: 'maulwurfDauer', label: 'Maulwurf (graben) hält', min: 1, max: 120, einheit: 's' },
      { key: 'grabWarnung', label: 'Warndreieck, wenn du spätestens in so vielen Sekunden umkehren musst', min: 0, max: 20, step: 0.5, einheit: 's' },
      { key: 'apfelWert', label: 'Ein Apfel ist wert', min: 0, max: 100, einheit: 'Äpfel' },
      { key: 'apfelWertAlle', label: 'Äpfel zählen einmal mehr alle', min: 1, max: 10000, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Erze unter der Erde',
    felder: [
      { key: 'erzGold', label: 'Golderz je 1000 Erdfelder', min: 0, max: 200, step: 0.1 },
      { key: 'erzDia', label: 'Diamant je 1000 Erdfelder', min: 0, max: 200, step: 0.1 },
      { key: 'erzRubin', label: 'Rubin je 1000 Erdfelder', min: 0, max: 200, step: 0.1 },
      { key: 'erzOpal', label: 'Opal je 1000 Erdfelder', min: 0, max: 200, step: 0.1 },
      { key: 'goldWert', label: 'Golderz ist wert', min: 0, max: 100, einheit: '× Apfel' },
      { key: 'diaWert', label: 'Diamant ist wert', min: 0, max: 500, einheit: '× Apfel' },
      { key: 'rubinWert', label: 'Rubin ist wert', min: 0, max: 500, einheit: '× Apfel' },
      { key: 'opalWert', label: 'Opal ist wert', min: 0, max: 1000, einheit: '× Apfel' },
    ],
  },
  {
    gruppe: 'Eis',
    felder: [
      { key: 'eisAb', label: 'Ab Level', min: 1, max: 10000 },
      { key: 'eisAlle', label: 'Neues Eisfeld alle', min: 1, max: 500, einheit: 'Level' },
      { key: 'eisMin', label: 'Mindestens so groß', min: 1, max: 40, einheit: 'Felder' },
      { key: 'eisMax', label: 'Höchstens so groß', min: 1, max: 40, einheit: 'Felder' },
      { key: 'eisFelder', label: 'Höchstens ein Eisfeld je', min: 30, max: 5000, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Ereignisse (Fallen, Wolken, Frösche)',
    felder: [
      { key: 'ereignis1Ab', label: 'Mindestens 1 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'ereignis2Ab', label: 'Mindestens 2 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'ereignis3Ab', label: 'Mindestens 3 unterwegs ab Level', min: 1, max: 10000 },
      { key: 'haeufigerAb', label: 'Alle Abstände 1 Level kürzer ab Level', min: 1, max: 10000 },
    ],
  },
  {
    gruppe: 'Welt: Wüstenoase (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'wurmAn', label: 'Sandwurm', min: 0, max: 1, schalter: true },
      { key: 'wurmChance', label: 'Sandwurm', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'flutAn', label: 'Flut', min: 0, max: 1, schalter: true },
      { key: 'flutChance', label: 'Flut', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'sturmAn', label: 'Sandsturm', min: 0, max: 1, schalter: true },
      { key: 'sturmChance', label: 'Sandsturm', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'geierAn', label: 'Geier (stößt herab)', min: 0, max: 1, schalter: true },
      { key: 'geierAb', label: 'Geier ab Level', min: 1, max: 10000 },
      { key: 'geierChance', label: 'Geier', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'geierWarnung', label: 'Geier: kreist vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'karawaneAn', label: 'Kamelkarawane', min: 0, max: 1, schalter: true },
      { key: 'karawaneAb', label: 'Kamelkarawane ab Level', min: 1, max: 10000 },
      { key: 'karawaneChance', label: 'Kamelkarawane', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'klapperAn', label: 'Klapperschlange', min: 0, max: 1, schalter: true },
      { key: 'klapperAb', label: 'Klapperschlange ab Level', min: 1, max: 10000 },
      { key: 'klapperChance', label: 'Klapperschlange', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'klapperMax', label: 'Klapperschlangen höchstens', min: 0, max: 10 },
      { key: 'klapperZurueck', label: 'Klapperschlange kostet', min: 0, max: 100, einheit: 'Level' },
    ],
  },
  {
    gruppe: 'Welt: Winterwald (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'eiszapfenAn', label: 'Eiszapfen (2 × 2, in deiner Nähe)', min: 0, max: 1, schalter: true },
      { key: 'eiszapfenChance', label: 'Eiszapfen', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'eiszapfenWarnung', label: 'Eiszapfen: Schatten vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'schneesturmAn', label: 'Schneesturm', min: 0, max: 1, schalter: true },
      { key: 'schneesturmChance', label: 'Schneesturm', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'schneesturmWarnung', label: 'Schneesturm: Ankündigung', min: 0, max: 10, step: 0.1, einheit: 's' },
      { key: 'schneesturmDauer', label: 'Schneesturm: Sicht weg', min: 0.5, max: 20, step: 0.1, einheit: 's' },
      { key: 'yetiAn', label: 'Yeti', min: 0, max: 1, schalter: true },
      { key: 'yetiChance', label: 'Yeti', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'polarnachtAn', label: 'Polarnacht mit Nordlicht', min: 0, max: 1, schalter: true },
      { key: 'polarnachtChance', label: 'Polarnacht', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'polarnachtDauer', label: 'Polarnacht: Dauer', min: 2, max: 60, einheit: 's' },
      { key: 'eisRisseAn', label: 'Eis bricht beim dritten Mal', min: 0, max: 1, schalter: true },
      { key: 'robbeAn', label: 'Robbe', min: 0, max: 1, schalter: true },
      { key: 'robbeAb', label: 'Robbe ab Level', min: 1, max: 10000 },
      { key: 'robbeChance', label: 'Robbe', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'robbeMax', label: 'Robben höchstens', min: 0, max: 10 },
      { key: 'schneemannAn', label: 'Schneemann', min: 0, max: 1, schalter: true },
      { key: 'schneemannAb', label: 'Schneemann ab Level', min: 1, max: 10000 },
      { key: 'schneemannChance', label: 'Schneemann', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'schneemannMax', label: 'Schneemänner höchstens', min: 0, max: 10 },
      { key: 'eisbaerAn', label: 'Eisbär', min: 0, max: 1, schalter: true },
      { key: 'eisbaerAb', label: 'Eisbär ab Level', min: 1, max: 10000 },
      { key: 'eisbaerChance', label: 'Eisbär', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'eisbaerMax', label: 'Eisbären höchstens', min: 0, max: 10 },
      { key: 'eisbaerZurueck', label: 'Eisbär-Tatze kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'schneeballZurueck', label: 'Schneeball kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'igluAn', label: 'Hütten als Iglu', min: 0, max: 1, schalter: true },
    ],
  },
  {
    gruppe: 'Welt: Bergwerk (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'steinschlagAn', label: 'Steinschlag', min: 0, max: 1, schalter: true },
      { key: 'steinschlagChance', label: 'Steinschlag', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'steinschlagWarnung', label: 'Steinschlag: Staub vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'steinschlagMin', label: 'Steinschlag: mindestens', min: 1, max: 12, einheit: 'Felder' },
      { key: 'steinschlagMax', label: 'Steinschlag: höchstens', min: 1, max: 12, einheit: 'Felder' },
      { key: 'schienenAn', label: 'Schienennetz', min: 0, max: 1, schalter: true },
      { key: 'schienenNeu', label: 'Neue Schiene je neuem Block', min: 0, max: 100, einheit: '%' },
      { key: 'stollenErz', label: 'Erz in den Stollen', min: 0, max: 100, einheit: '%' },
      { key: 'loreAn', label: 'Lore', min: 0, max: 1, schalter: true },
      { key: 'loreChance', label: 'Lore', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'loreWarnung', label: 'Lore: Glocke vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'lorenlagerAn', label: 'Abgestellte Loren', min: 0, max: 1, schalter: true },
      { key: 'tntAn', label: 'TNT mit Zündschnur', min: 0, max: 1, schalter: true },
      { key: 'tntChance', label: 'TNT', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'tntSchnur', label: 'Zündschnur je Feld', min: 0.1, max: 3, step: 0.05, einheit: 's' },
      { key: 'erdbebenAn', label: 'Erdbeben-Spalt', min: 0, max: 1, schalter: true },
      { key: 'erdbebenChance', label: 'Erdbeben', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'erdbebenWarnung', label: 'Erdbeben: Beben vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'fledermausAn', label: 'Fledermausschwarm', min: 0, max: 1, schalter: true },
      { key: 'fledermausChance', label: 'Fledermäuse', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'fledermausWarnung', label: 'Fledermäuse: Warnung', min: 0.3, max: 10, step: 0.1, einheit: 's' },
      { key: 'fledermausZurueck', label: 'Fledermäuse kosten', min: 0, max: 100, einheit: 'Level' },
      { key: 'zwergAn', label: 'Grubenzwerg', min: 0, max: 1, schalter: true },
      { key: 'zwergAb', label: 'Zwerg ab Level', min: 1, max: 10000 },
      { key: 'zwergChance', label: 'Zwerg', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'zwergMax', label: 'Zwerge höchstens', min: 0, max: 10 },
      { key: 'golemAn', label: 'Steingolem', min: 0, max: 1, schalter: true },
      { key: 'golemAb', label: 'Golem ab Level', min: 1, max: 10000 },
      { key: 'golemChance', label: 'Golem', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'golemMax', label: 'Golems höchstens', min: 0, max: 10 },
      { key: 'golemZurueck', label: 'Golem-Schlag kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'netzAn', label: 'Spinnennetz', min: 0, max: 1, schalter: true },
      { key: 'netzAb', label: 'Netz ab Level', min: 1, max: 10000 },
      { key: 'netzChance', label: 'Netz', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'netzMax', label: 'Netze höchstens', min: 0, max: 20 },
      { key: 'netzBremse', label: 'Netz bremst', min: 0, max: 10, step: 0.1, einheit: 's' },
    ],
  },
  {
    gruppe: 'Welt: Zauberwald (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'spiegelAn', label: 'Spiegelfluch', min: 0, max: 1, schalter: true },
      { key: 'spiegelChance', label: 'Spiegelfluch', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'spiegelWarnung', label: 'Spiegelfluch: Schimmer vorher', min: 0, max: 10, step: 0.1, einheit: 's' },
      { key: 'spiegelDauer', label: 'Spiegelfluch: Dauer', min: 1, max: 30, step: 0.5, einheit: 's' },
      { key: 'rankenAn', label: 'Ranken', min: 0, max: 1, schalter: true },
      { key: 'rankenChance', label: 'Ranken', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'rankenLaenge', label: 'Ranken: höchstens', min: 2, max: 12, einheit: 'Felder' },
      { key: 'rankenTakt', label: 'Ranken: ein Feld alle', min: 0.3, max: 10, step: 0.1, einheit: 's' },
      { key: 'rankenAepfel', label: 'Ranken verwelken nach', min: 1, max: 20, einheit: 'Äpfeln' },
      { key: 'wanderbaumAn', label: 'Wandernder Baum', min: 0, max: 1, schalter: true },
      { key: 'wanderbaumChance', label: 'Wandernder Baum', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'wanderbaumMax', label: 'Wandernde Bäume höchstens', min: 0, max: 10 },
      { key: 'sporenAn', label: 'Sporenwolke', min: 0, max: 1, schalter: true },
      { key: 'sporenChance', label: 'Sporenwolke', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'sporenDauer', label: 'Sporen: schneller für', min: 1, max: 20, step: 0.5, einheit: 's' },
      { key: 'irrlichtAn', label: 'Irrlicht-Apfel', min: 0, max: 1, schalter: true },
      { key: 'irrlichtChance', label: 'Irrlicht-Apfel', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'einhornAn', label: 'Einhorn', min: 0, max: 1, schalter: true },
      { key: 'einhornAb', label: 'Einhorn ab Level', min: 1, max: 10000 },
      { key: 'einhornChance', label: 'Einhorn', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'feeAn', label: 'Fee (klaut den Apfel)', min: 0, max: 1, schalter: true },
      { key: 'feeAb', label: 'Fee ab Level', min: 1, max: 10000 },
      { key: 'feeChance', label: 'Fee', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'entAn', label: 'Ent', min: 0, max: 1, schalter: true },
      { key: 'entAb', label: 'Ent ab Level', min: 1, max: 10000 },
      { key: 'entChance', label: 'Ent', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'entMax', label: 'Ents höchstens', min: 0, max: 10 },
      { key: 'pilzringAn', label: 'Pilzringe (Teleporter)', min: 0, max: 1, schalter: true },
      { key: 'pilzringAb', label: 'Pilzringe ab Level', min: 1, max: 10000 },
      { key: 'pilzringChance', label: 'Pilzringe', min: 0, max: 100, step: 0.1, einheit: '%' },
    ],
  },
  {
    gruppe: 'Welt: Gruselwald (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'zombiehandAn', label: 'Zombiehände', min: 0, max: 1, schalter: true },
      { key: 'zombiehandChance', label: 'Zombiehände', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'zombiehandWarnung', label: 'Zombiehände: Wackeln vorher', min: 0.3, max: 10, step: 0.1, einheit: 's' },
      { key: 'zombiehandMin', label: 'Zombiehände: mindestens', min: 1, max: 12 },
      { key: 'zombiehandMax', label: 'Zombiehände: höchstens', min: 1, max: 12 },
      { key: 'grabAn', label: 'Offenes Grab (Skelett)', min: 0, max: 1, schalter: true },
      { key: 'grabChance', label: 'Offenes Grab', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'skelettZurueck', label: 'Skelett kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'kraehenschwarmAn', label: 'Krähenschwarm', min: 0, max: 1, schalter: true },
      { key: 'kraehenschwarmChance', label: 'Krähenschwarm', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'werwolfAn', label: 'Vollmond-Werwolf', min: 0, max: 1, schalter: true },
      { key: 'werwolfAlle', label: 'Vollmond alle', min: 1, max: 1000, einheit: 'Level' },
      { key: 'werwolfDauer', label: 'Werwolf jagt', min: 2, max: 60, einheit: 's' },
      { key: 'werwolfZurueck', label: 'Werwolf kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'gespenstAn', label: 'Gespenst', min: 0, max: 1, schalter: true },
      { key: 'gespenstAb', label: 'Gespenst ab Level', min: 1, max: 10000 },
      { key: 'gespenstChance', label: 'Gespenst', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'gespenstMax', label: 'Gespenster höchstens', min: 0, max: 10 },
      { key: 'gespenstZurueck', label: 'Gespenst kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'spinneAn', label: 'Riesenspinne', min: 0, max: 1, schalter: true },
      { key: 'spinneAb', label: 'Riesenspinne ab Level', min: 1, max: 10000 },
      { key: 'spinneChance', label: 'Riesenspinne', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'kraeheAn', label: 'Krähe (klaut Power-ups)', min: 0, max: 1, schalter: true },
      { key: 'kraeheAb', label: 'Krähe ab Level', min: 1, max: 10000 },
      { key: 'kraeheChance', label: 'Krähe', min: 0, max: 100, step: 0.1, einheit: '%' },
    ],
  },
  {
    gruppe: 'Welt: Vulkan',
    felder: [
      { key: 'vulkanBlockPlus', label: 'Blöcke größer um', min: 0, max: 12, einheit: 'Felder' },
      { key: 'kraterProzent', label: 'Krater je Block', min: 0, max: 30, einheit: '%' },
      { key: 'kraterMin', label: 'Krater mindestens', min: 1, max: 30, einheit: 'Felder' },
    ],
  },
  {
    gruppe: 'Welt: Vulkan, Ereignisse (je Apfel; fallen zwei zusammen, kommt das seltenere)',
    felder: [
      { key: 'abbruchAn', label: 'Abbruchkante', min: 0, max: 1, schalter: true },
      { key: 'abbruchChance', label: 'Abbruchkante', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'abbruchWarnung', label: 'Abbruchkante: Risse vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'ausbruchAn', label: 'Ausbruch (Lavabomben)', min: 0, max: 1, schalter: true },
      { key: 'ausbruchChance', label: 'Ausbruch', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'ausbruchWarnung', label: 'Ausbruch: Glühen vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'ausbruchMin', label: 'Lavabomben mindestens', min: 1, max: 12 },
      { key: 'ausbruchMax', label: 'Lavabomben höchstens', min: 1, max: 12 },
      { key: 'lavastromAn', label: 'Lavastrom', min: 0, max: 1, schalter: true },
      { key: 'lavastromChance', label: 'Lavastrom', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'lavastromLaenge', label: 'Lavastrom: höchstens', min: 3, max: 15, einheit: 'Felder' },
      { key: 'lavastromTakt', label: 'Lavastrom: ein Feld alle', min: 0.2, max: 5, step: 0.1, einheit: 's' },
      { key: 'lavastromAepfel', label: 'Lavastrom erkaltet nach', min: 1, max: 20, einheit: 'Äpfeln' },
      { key: 'magmawurmAn', label: 'Magmawurm', min: 0, max: 1, schalter: true },
      { key: 'magmawurmChance', label: 'Magmawurm', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'feuerregenAn', label: 'Feuerregen (Meteore)', min: 0, max: 1, schalter: true },
      { key: 'feuerregenChance', label: 'Feuerregen', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'feuerregenWarnung', label: 'Feuerregen: Schatten vorher', min: 0.5, max: 10, step: 0.1, einheit: 's' },
      { key: 'feuerregenMin', label: 'Meteore mindestens', min: 1, max: 15 },
      { key: 'feuerregenMax', label: 'Meteore höchstens', min: 1, max: 15 },
    ],
  },
  {
    gruppe: 'Welt: Vulkan, Tiere und Dinge (je Apfel)',
    felder: [
      { key: 'lavafischAn', label: 'Lavafisch', min: 0, max: 1, schalter: true },
      { key: 'lavafischAb', label: 'Lavafisch ab Level', min: 1, max: 10000 },
      { key: 'lavafischChance', label: 'Lavafisch', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'lavafischMax', label: 'Lavafische höchstens', min: 0, max: 10 },
      { key: 'glutgolemAn', label: 'Glutgolem', min: 0, max: 1, schalter: true },
      { key: 'glutgolemAb', label: 'Glutgolem ab Level', min: 1, max: 10000 },
      { key: 'glutgolemChance', label: 'Glutgolem', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'glutgolemMax', label: 'Glutgolems höchstens', min: 0, max: 10 },
      { key: 'glutDauer', label: 'Glutspur glüht', min: 0.5, max: 20, step: 0.5, einheit: 's' },
      { key: 'brueckeAn', label: 'Lavabrücke', min: 0, max: 1, schalter: true },
      { key: 'brueckeAb', label: 'Lavabrücke ab Level', min: 1, max: 10000 },
      { key: 'brueckeChance', label: 'Lavabrücke', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'brueckeMax', label: 'Lavabrücken höchstens', min: 0, max: 10 },
      { key: 'brueckeUeber', label: 'Brücke bricht nach', min: 1, max: 20, einheit: 'Überquerungen' },
      { key: 'obsidianAn', label: 'Obsidian-Kristall', min: 0, max: 1, schalter: true },
      { key: 'obsidianAb', label: 'Obsidian ab Level', min: 1, max: 10000 },
      { key: 'obsidianChance', label: 'Obsidian', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'obsidianWert', label: 'Obsidian bringt', min: 1, max: 50, einheit: '× Apfel' },
    ],
  },
  {
    gruppe: 'Welt: Wiese (Tiere, je Apfel)',
    felder: [
      { key: 'bienenstockAn', label: 'Bienenstock', min: 0, max: 1, schalter: true },
      { key: 'bienenstockAb', label: 'Bienenstock ab Level', min: 1, max: 10000 },
      { key: 'bienenstockChance', label: 'Bienenstock', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'bienenZurueck', label: 'Bienenschwarm kostet', min: 0, max: 100, einheit: 'Level' },
      { key: 'igelAn', label: 'Igel', min: 0, max: 1, schalter: true },
      { key: 'igelAb', label: 'Igel ab Level', min: 1, max: 10000 },
      { key: 'igelChance', label: 'Igel', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'igelMax', label: 'Igel höchstens', min: 0, max: 10 },
      { key: 'huegelAn', label: 'Maulwurfshügel', min: 0, max: 1, schalter: true },
      { key: 'huegelAb', label: 'Maulwurfshügel ab Level', min: 1, max: 10000 },
      { key: 'huegelChance', label: 'Maulwurfshügel', min: 0, max: 100, step: 0.1, einheit: '%' },
      { key: 'huegelDauer', label: 'Hügel bleibt', min: 0.5, max: 30, step: 0.5, einheit: 's' },
    ],
  },
]
/** Welt-Tiere und -Dinge (Stufe aus = aus; ihr eigener An-Schalter entfaellt) */
const TIER_ARTEN = new Set(WELT_IDS.flatMap((w) => Object.keys(WELT_STUFEN[w]).filter((a) => !(GRUND_ARTEN as readonly string[]).includes(a))))
/** Master-Einstellungen: erst die Stufen, dann alles, was nicht aus den Stufen kommt */
export const SCHEMA: SchemaGruppe[] = [
  ...STUFEN_SCHEMA,
  ...SCHEMA_ROH.map((g) => ({ ...g, felder: g.felder.filter((f) => !ABGELEITET.has(f.key) && f.key !== 'turmAb' && f.key !== 'lilaAb' && !(f.key.endsWith('An') && TIER_ARTEN.has(f.key.slice(0, -2)))) })).filter((g) => g.felder.length > 0),
]

/* ---------------- Ableitungen ---------------- */

export const takt = (c: Config, tempo: Tempo, level: number) =>
  TEMPO[tempo] * Math.max(c.tempoMin / 100, 1 - ((level - 1) * c.tempoProLevel) / 100)

/** Neues Gebiet: bis gebietBis alle gebietAlle Level, danach alle gebietAlle2, ab gebietAb3 alle gebietAlle3.
 *  (Standard: alle 20 bis 300, dann alle 30 bis 500, dann alle 50) */
export const neuesGebiet = (c: Config, level: number) => {
  if (level <= 0) return false
  if (level < c.gebietBis) return c.gebietAlle > 0 && level % c.gebietAlle === 0
  if (level < c.gebietAb3) return (level - c.gebietBis) % Math.max(1, c.gebietAlle2) === 0
  return (level - c.gebietAb3) % Math.max(1, c.gebietAlle3) === 0
}
/** Wie viele Level bis zum naechsten Gebiet, und wie lang der Abschnitt ist (fuer den Balken) */
export const gebietFortschritt = (c: Config, level: number) => {
  let n = level + 1
  while (!neuesGebiet(c, n) && n < level + 1000) n++
  let v = level
  while (v > 0 && !neuesGebiet(c, v)) v--
  return { rest: n - level, abschnitt: n - v }
}

/** Waechst die Schlange bei diesem Level? Alle `wachsenAlle` Aepfel, ab wachsenJedes halb, ab wachsenJedesZweite ein Drittel so oft */
export const waechst = (c: Config, level: number) => {
  const alle = Math.max(1, Math.round(c.wachsenAlle)) * (level <= c.wachsenJedes ? 1 : level <= c.wachsenJedesZweite ? 2 : 3)
  return level % alle === 0
}
/** So viele Glieder ist die Schlange von Level `auf` bis Level `von` gewachsen */
export const gewachsen = (c: Config, auf: number, von: number) => {
  let n = 0
  for (let l = Math.max(1, auf) + 1; l <= von; l++) if (waechst(c, l)) n++
  return n
}

/** Mauerlaengen: eine Mauer waechst von 2 bis zur Hoechstlaenge, dann kommt eine neue mit 2 dazu */
export const mauern = (c: Config, level: number, felder: number): number[] => {
  if (level < c.mauerAb) return []
  const idx = Math.floor((level - c.mauerAb) / c.mauerSchritt)
  const stufen = Math.max(1, c.mauerMax - 1)
  const volle = Math.floor(idx / stufen)
  const out = Array.from({ length: Math.min(volle, 200) }, () => c.mauerMax)
  out.push(Math.min(c.mauerMax, 2 + (idx % stufen)))
  return out.slice(0, Math.max(1, Math.floor(felder / c.mauerFelder)))
}
/** Chance auf einen Knick je Mauerlaenge */
export const knick = (len: number) => [0, 0, 0, 0.2, 0.4, 0.6, 0.75][len] ?? 0.75

export const neuerTeich = (c: Config, level: number) => level >= c.teichAb && (level - c.teichAb) % c.teichAlle === 0
/** 2, 2, 3, 3, 4 ... */
export const teichGroesse = (c: Config, level: number) =>
  Math.min(c.teichMaxGroesse, 2 + Math.floor(Math.floor((level - c.teichAb) / c.teichAlle) / 2))
export const teichMax = (c: Config, felder: number) => Math.max(2, Math.floor(felder / c.teichFelder))

export const giftAnzahl = (c: Config, level: number) =>
  level < c.giftAb ? 0 : Math.min(c.giftMax, 1 + Math.floor((level - c.giftAb) / c.giftAlle))

export const neuerBaum = (c: Config, level: number) => level >= c.baumAb && (level - c.baumAb) % c.baumAlle === 0
export const baumMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.baumFelder))
/** Stehende Tanne von oben: ein Plus um den Stamm */
export const BAUM_STEHEND: P[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
/** So lange (ms) faellt ein Baum um */
export const BAUM_FALL = 1600
/** So lange vor dem Kippen wackelt ein Baum und verliert Blaetter in die Fallrichtung (ms) */
export const BAUM_WARNUNG = 1500
/** Grosse Tanne von oben: 3 x 3 Felder um den Stamm */
export const TANNE_STEHEND: P[] = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y })))
/** Liegende grosse Tanne 1-1-1-3-3-1-1: drei Felder Stamm, die Krone zwei Reihen breit, die Spitze 6 Felder vom Stamm */
export const TANNE_FORM: { a: number; q: number }[] = [
  { a: 0, q: 0 },
  { a: 1, q: 0 },
  { a: 2, q: 0 },
  { a: 3, q: -1 },
  { a: 3, q: 0 },
  { a: 3, q: 1 },
  { a: 4, q: -1 },
  { a: 4, q: 0 },
  { a: 4, q: 1 },
  { a: 5, q: 0 },
  { a: 6, q: 0 },
]
/** Liegende Tanne 1-1-3-1 (symmetrisch): Felder entlang der Achse (a) und quer dazu (q) */
export const BAUM_FORM: { a: number; q: number }[] = [
  { a: 0, q: 0 },
  { a: 1, q: 0 },
  { a: 2, q: -1 },
  { a: 2, q: 0 },
  { a: 2, q: 1 },
  { a: 3, q: 0 },
]

export const neuesHaus = (c: Config, level: number) => level >= c.hausAb && (level - c.hausAb) % c.hausAlle === 0
export const hausMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.hausFelder))
/** Kleine Huette 2 x 2 (vor hausGrossAb) */
export const HUETTE_FORM: P[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]
export const HAUS_FORMEN: P[][] = [
  // 2 breit, 3 hoch
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  // mit Ecke: Reihen 2, 2, 3, 3
  [
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 },
  ],
]

export const neuerTurm = (c: Config, level: number) => level >= c.turmAb && (level - c.turmAb) % c.turmAlle === 0
export const turmMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.turmFelder))

/** Abstand bis zum naechsten Ereignis dieser Art (ab `haeufigerAb` je 1 Level kuerzer) */
export type EreignisArt = 'falle' | 'wolke' | 'frosch' | 'gegner' | 'ameise'
export const pause = (c: Config, art: EreignisArt, level: number): [number, number] => {
  const [a, b] =
    art === 'falle'
      ? [c.falleMin, c.falleMax]
      : art === 'wolke'
        ? [c.wolkeMin, c.wolkeMax]
        : art === 'frosch'
          ? [c.froschMin, c.froschMax]
          : art === 'gegner'
            ? [c.gegnerMin, c.gegnerMax]
            : [c.ameiseMin, c.ameiseMax]
  const k = level >= c.haeufigerAb ? 1 : 0
  const lo = Math.max(1, Math.min(a, b) - k)
  return [lo, Math.max(lo, Math.max(a, b) - k)]
}
export const ab = (c: Config, art: EreignisArt) =>
  art === 'falle' ? c.falleAb : art === 'wolke' ? c.wolkeAb : art === 'frosch' ? c.froschAb : art === 'gegner' ? c.gegnerAb : c.ameiseAb
export const mindestEreignisse = (c: Config, level: number) =>
  level >= c.ereignis3Ab ? 3 : level >= c.ereignis2Ab ? 2 : level >= c.ereignis1Ab ? 1 : 0

/** Groesste Wolkenstufe: Startwert, alle 50 Level eine mehr */
export const wolkeMaxStufe = (c: Config, level: number) =>
  Math.min(c.wolkeStufeMax, c.wolkeStufeStart + Math.max(0, Math.floor((level - c.wolkeAb) / 50)))
export const WOLKE_WARNUNG = 1000
export const WOLKE_VERWEILEN = 5000
export const WOLKE_AUFLOESEN = 1200
/** Felder einer Wolke je Stufe: 0 Punkt, 1 Plus, 2 Quadrat 3x3, 3 Quadrat + Spitzen, 4 Quadrat 5x5 ... */
export const wolkenForm = (stage: number): P[] => {
  const m = Math.floor(stage / 2)
  const out: P[] = []
  const r = m + 1
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dy))
      if (cheb <= m) out.push({ x: dx, y: dy })
      else if (stage % 2 === 1 && cheb === m + 1 && (dx === 0 || dy === 0)) out.push({ x: dx, y: dy })
    }
  return out
}

/** Aepfel sind die Waehrung und zaehlen mehrfach: bis Level 49 einfach, ab 50 doppelt, ab 100 dreifach ...
 *  Mit jeder Stufe bekommt der Apfel eine andere Farbe (siehe APFEL_STUFEN in sprites.ts) */
export const apfelFaktor = (c: Config, level: number) => 1 + Math.floor(level / Math.max(1, c.apfelWertAlle))

export const POWER_ARTEN = ['schild', 'zeitlupe', 'geist', 'schere', 'goldschere', 'fuettern', 'magnet', 'maulwurf', 'spitzhacke'] as const
/** Wie oft welches Power-up kommt (Gewicht) */
export const POWER_GEWICHT: Record<(typeof POWER_ARTEN)[number], number> = {
  schild: 3,
  zeitlupe: 3,
  geist: 2,
  schere: 2,
  goldschere: 1,
  fuettern: 2,
  magnet: 3,
  maulwurf: 2,
  spitzhacke: 2,
}
/** Erze: welches die Spitzhacke setzt (Gewicht, je seltener desto wertvoller) */
export type ErzArt = 'gold' | 'dia' | 'rubin' | 'opal'
export const ERZ_ARTEN: ErzArt[] = ['gold', 'dia', 'rubin', 'opal']
export const SPITZHACKE_GEWICHT: Record<ErzArt, number> = { gold: 72, dia: 19, rubin: 7, opal: 2 }
export const erzWert = (c: Config, art: ErzArt) => (art === 'gold' ? c.goldWert : art === 'dia' ? c.diaWert : art === 'rubin' ? c.rubinWert : c.opalWert)
/**
 * Wueste (Insel im Meer): Froesche sind mit wuestenfroschChance % Wuestenfroesche (springen doppelt so oft).
 * Nach jedem Apfel kann etwas passieren (Chancen in der Config: sturmChance, flutChance, wurmChance).
 * Sandsturm: die Sicht ist sturmDauer ms lang schlecht.
 * Flut: erst schlagen die Wellen hoeher (Warnung), mit dem naechsten Apfel steht der Rand
 * flutRand Felder unter Wasser (toedlich), mit dem Apfel danach geht das Wasser zurueck.
 * Sandwurm: zwei Reihen in der Naehe brodeln wurmWarnung ms lang, dann schiesst ein Sandwurm
 * (wurmBreite Felder breit, wurmLaenge lang, taucht immer wieder auf und ab) mit wurmTakt ms je Feld hindurch. Trifft er den Kopf, ist es vorbei, den Koerper beisst er ab.
 */
export const WUESTE = { wuestenfroschChance: 50, sturmDauer: 7000, flutRand: 2, wurmWarnung: 8000, wurmTakt: 45, wurmLaenge: 18, wurmBreite: 2 }

/** Zeitlupe: Takt so viel laenger (30 % langsamer = Takt / 0,7) */
export const zeitlupe = (c: Config) => 1 / Math.max(0.2, 1 - c.zeitlupeProzent / 100)

export const neuesEis = (c: Config, level: number) => level >= c.eisAb && (level - c.eisAb) % c.eisAlle === 0
export const eisMax = (c: Config, felder: number) => Math.max(1, Math.floor(felder / c.eisFelder))

/** Fester Zufall je Feld (Weltkoordinaten): 0 bis 1, immer gleich fuer dasselbe Feld */
export function feldZufall(x: number, y: number, salz = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul(salz + 1, 0x9e3779b9)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
export type Erde = ErzArt | 'kohle' | 'stein' | 'skelett'
/** Was steckt in diesem Erdfeld (Weltkoordinaten)? Gold und Diamant sind echte Funde, der Rest Deko */
export function erdeBei(c: Config, x: number, y: number): Erde | null {
  let z = feldZufall(x, y, 7) * 1000
  for (const [art, anteil] of [['opal', c.erzOpal], ['rubin', c.erzRubin], ['dia', c.erzDia], ['gold', c.erzGold], ['skelett', 6], ['kohle', 30], ['stein', 60]] as const) {
    if (z < anteil) return art
    z -= anteil
  }
  return null
}

/** Gegner: so viele gleichzeitig (ab gegnerAb 1, alle 100 Level einer mehr, hoechstens gegnerAnzahl) */
export const gegnerMax = (c: Config, level: number) =>
  level < c.gegnerAb ? 0 : Math.min(c.gegnerAnzahl, 1 + Math.floor((level - c.gegnerAb) / 100))
/** Rote Gegner bewegen sich halb so schnell wie die Schlange (ein Schritt je 2 Takte) */
export const GEGNER_TEMPO = 2
/** Takte je Schritt fuer einen Gegner (lila ist lilaTempo % schneller) */
export const gegnerTakte = (c: Config, art: 'rot' | 'lila') => (art === 'lila' ? GEGNER_TEMPO / (1 + c.lilaTempo / 100) : GEGNER_TEMPO)

/** Lava im Stein: steckt in diesem Block (Weltkoordinaten in Bloecken) ein Lavafeld, und wo (Feld im Block)?
 *  Fest je Block und Spiel (`salz`), mit einem Feld Abstand zum Blockrand. Die Startbloecke haben keins */
export function lavaKeim(c: Config, bx: number, by: number, bw: number, bh: number, salz: number): P | null {
  if (feldZufall(bx, by, salz) * 100 >= c.lavaChance || bw < 3 || bh < 3) return null
  return { x: 1 + Math.floor(feldZufall(bx, by, salz + 1) * (bw - 2)), y: 1 + Math.floor(feldZufall(bx, by, salz + 2) * (bh - 2)) }
}

/** Frosch: Sprung dauert so lange, 1 s vorher macht er sich bereit, 0,25 s nach der Landung dreht er ggf. */
export const FROSCH_FLUG = 380
export const FROSCH_ANLAUF = 1000
export const FROSCH_DREHEN = 250

/** Wann wird was zum ersten Mal vorgestellt */
export const unlocks = (c: Config) =>
  [
    { what: 'mauer', level: c.mauerAb },
    { what: 'teich', level: c.teichAb },
    { what: 'gift', level: c.giftAb },
    { what: 'falle', level: c.falleAb },
    { what: 'gegner', level: c.gegnerAb },
    { what: 'lila', level: c.lilaAb },
    { what: 'ameise', level: c.ameiseAb },
    { what: 'eis', level: c.eisAb },
    { what: 'maulwurf', level: c.maulwurfAb },
    { what: 'baum', level: c.baumAb },
    { what: 'wolke', level: c.wolkeAb },
    { what: 'frosch', level: c.froschAb },
    { what: 'haus', level: c.hausAb },
    { what: 'turm', level: c.turmAb },
  ] as const
