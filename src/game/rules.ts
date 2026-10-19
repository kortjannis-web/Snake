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

export const DEFAULTS = {
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
  turmAb: 160,
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
  // Gegner-Schlangen
  gegnerAb: 100,
  gegnerMin: 30,
  gegnerMax: 45,
  gegnerAnzahl: 2,
  gegnerWachsen: 20,
  gegnerMaxLaenge: 8,
  lilaAb: 150,
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
}
export type Config = typeof DEFAULTS
export type ConfigKey = keyof Config

/** Beschreibung jeder Zahl fuer die Master-Einstellungen */
export const SCHEMA: { gruppe: string; felder: { key: ConfigKey; label: string; min: number; max: number; step?: number; einheit?: string }[] }[] = [
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
