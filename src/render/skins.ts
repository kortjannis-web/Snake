/**
 * Aussehen der Schlange: Farben (auch zwei- und dreifarbig), Skins (Muster und Materialien),
 * Accessoires (Augen, Kopf, Gesicht, Schwanz) und Spuren. Spiel, Shop-Vorschau und die Videos
 * fuer den Shop (scripts/skin-videos.mjs) nutzen dieselben Zeichenfunktionen.
 *
 * Ein Aussehen steckt in einem kurzen Text (hoechstens 32 Zeichen, so wird es auch online und im
 * Mehrspieler weitergegeben): eine einzelne Id ("klassik", "tiger") wie frueher, oder "~" mit
 * Kennbuchstaben und Nummern (siehe kodiere/skinVon). Die Nummern (nr) aendern sich nie.
 */
import { MISSION_SKINS } from '../game/missionen'
import { STEP } from '../game/rules'
import type { Dir, P } from '../game/types'
import { drawEffekt, EFFEKTE, type Effekt } from './effekte'

export type RGB = readonly [number, number, number]
export type Farbe = { id: string; nr: number; name: string; preis: number; kopf: RGB; schwanz: RGB; versteckt?: boolean }
/** glimmer: epischer Skin, funkelt zusaetzlich in dieser Farbe */
export type Muster = { id: string; nr: number; name: string; preis: number; art: string; kopf: RGB; schwanz: RGB; extra?: RGB[]; bewegt: boolean; versteckt?: boolean; glimmer?: RGB }
export type Platz = 'augen' | 'kopf' | 'gesicht' | 'schwanz'
export type Acc = { id: string; nr: number; name: string; preis: number; platz: Platz; bewegt?: boolean }
export type SpurArt = { id: string; nr: number; name: string; preis: number }
/** Abschnitte (Kopf/Mitte/Schwanz), Ringe, Verlauf weich oder Verlauf Glied fuer Glied (Stufen) */
export type Teilung = 'abschnitt' | 'ringe' | 'verlauf' | 'stufen'
/** Komplettes Aussehen einer Schlange */
export type Skin = { code: string; farben: Farbe[]; teilung: Teilung; muster?: Muster; acc: Acc[]; spur?: SpurArt; effekt?: Effekt }

const fb = (nr: number, id: string, name: string, preis: number, kopf: RGB, schwanz: RGB, versteckt = false): Farbe => ({ id, nr, name, preis, kopf, schwanz, versteckt })

/** Eine lange Liste: vier Startfarben, dann immer exotischer und teurer */
export const FARBEN: Farbe[] = [
  fb(1, 'klassik', 'Grün', 0, [47, 143, 116], [18, 66, 55]),
  fb(2, 'ozean', 'Blau', 0, [64, 140, 220], [24, 56, 120]),
  fb(3, 'sonne', 'Gelb', 0, [246, 206, 72], [190, 128, 20]),
  fb(4, 'kohle', 'Schwarz', 0, [78, 78, 84], [24, 24, 28]),
  fb(5, 'weiss', 'Weiß', 150, [245, 245, 240], [190, 192, 196]),
  fb(6, 'rot', 'Rot', 150, [226, 62, 52], [130, 22, 26]),
  fb(7, 'braun', 'Braun', 150, [150, 100, 60], [80, 50, 28]),
  fb(8, 'minze', 'Minze', 250, [150, 230, 190], [50, 150, 120]),
  fb(9, 'himmel', 'Himmel', 250, [150, 210, 250], [60, 130, 200]),
  fb(10, 'pfirsich', 'Pfirsich', 250, [255, 190, 150], [210, 110, 80]),
  fb(11, 'flieder', 'Flieder', 250, [210, 180, 240], [130, 100, 180]),
  fb(12, 'oliv', 'Oliv', 350, [150, 160, 70], [80, 90, 30]),
  fb(13, 'marine', 'Marine', 350, [40, 60, 120], [12, 20, 50]),
  fb(14, 'bordeaux', 'Bordeaux', 350, [140, 20, 40], [56, 6, 18]),
  fb(15, 'senf', 'Senf', 350, [220, 170, 40], [140, 96, 14]),
  fb(16, 'koralle', 'Koralle', 600, [244, 128, 96], [160, 52, 66]),
  fb(17, 'smaragd', 'Smaragd', 600, [40, 200, 120], [6, 90, 60]),
  fb(18, 'pink', 'Pink', 600, [255, 110, 180], [170, 30, 110]),
  fb(19, 'tuerkis', 'Türkis', 600, [60, 220, 210], [10, 110, 120]),
  fb(20, 'orange', 'Orange', 600, [255, 150, 50], [190, 80, 10]),
  fb(21, 'kirsche', 'Kirsche', 800, [210, 20, 70], [110, 0, 40]),
  fb(22, 'lavendel', 'Lavendel', 800, [180, 160, 255], [90, 70, 190]),
  fb(23, 'limette', 'Limette', 800, [190, 240, 60], [90, 150, 10]),
  fb(24, 'petrol', 'Petrol', 800, [20, 130, 140], [6, 60, 72]),
  fb(25, 'neongruen', 'Neongrün', 1200, [80, 255, 120], [0, 170, 70]),
  fb(26, 'neonpink', 'Neonpink', 1200, [255, 60, 200], [190, 0, 130]),
  fb(27, 'neonblau', 'Neonblau', 1200, [40, 200, 255], [0, 90, 220]),
  fb(28, 'neongelb', 'Neongelb', 1200, [240, 255, 40], [170, 190, 0]),
  fb(29, 'mitternacht', 'Mitternacht', 1600, [60, 50, 120], [8, 6, 30]),
  fb(30, 'vulkan', 'Vulkan', 1600, [255, 90, 30], [40, 10, 10]),
  fb(31, 'gletscher', 'Gletscher', 1600, [230, 250, 255], [60, 150, 210]),
  fb(32, 'moos', 'Moos', 1600, [130, 170, 70], [50, 40, 20]),
  fb(33, 'abendrot', 'Abendrot', 2200, [255, 200, 80], [200, 30, 90]),
  fb(34, 'lagune', 'Lagune', 2200, [80, 240, 200], [70, 60, 200]),
  fb(35, 'zuckerwatte', 'Zuckerwatte', 2200, [255, 190, 230], [150, 200, 255]),
  fb(36, 'saeure', 'Säure', 2200, [210, 255, 40], [20, 110, 90]),
  // Nicht mehr im Shop, wer sie hat, behaelt sie
  fb(90, 'sand', 'Sand', 250, [232, 210, 160], [160, 130, 80], true),
]

const mu = (nr: number, id: string, name: string, preis: number, art: string, kopf: RGB, schwanz: RGB, bewegt: boolean, extra?: RGB[], versteckt = false): Muster => ({ id, nr, name, preis, art, kopf, schwanz, bewegt, extra, versteckt })

/** Skins: erst statisch (im Shop ein Bild), dann bewegt (ein Video) und immer aufwendiger */
export const MUSTER: Muster[] = [
  mu(1, 'tiger', 'Tiger', 800, 'streifen', [246, 160, 70], [200, 104, 36], false),
  mu(2, 'zebra', 'Zebra', 800, 'streifen', [245, 245, 240], [200, 200, 195], false, [[20, 20, 24]]),
  mu(3, 'leopard', 'Leopard', 800, 'punkte', [240, 200, 120], [190, 140, 60], false),
  mu(4, 'marienkaefer', 'Käfer', 800, 'punkte', [230, 60, 50], [150, 20, 20], false, [[15, 10, 10]]),
  mu(5, 'tupfen', 'Tupfen', 1000, 'polka', [80, 150, 240], [40, 80, 170], false),
  mu(6, 'biene', 'Biene', 1000, 'ringe', [250, 200, 40], [220, 160, 20], false, [[30, 24, 20]]),
  mu(7, 'zuckerstange', 'Zuckerstange', 1200, 'diagonal', [250, 250, 248], [235, 230, 230], false, [[220, 40, 50]]),
  mu(8, 'kuh', 'Kuh', 1200, 'flecken', [250, 248, 244], [225, 222, 216], false, [[30, 28, 30]]),
  mu(9, 'python', 'Python', 1500, 'python', [200, 170, 110], [140, 110, 60], false, [[80, 55, 25], [235, 215, 160]]),
  mu(10, 'korallenotter', 'Korallenotter', 1500, 'otter', [220, 40, 40], [180, 30, 30], false, [[20, 20, 20], [250, 210, 50]]),
  mu(11, 'tarnung', 'Tarnung', 1500, 'camo', [120, 140, 80], [90, 105, 60], false, [[60, 75, 40], [160, 150, 100], [40, 45, 30]]),
  mu(12, 'melone', 'Melone', 1800, 'melone', [90, 170, 70], [40, 110, 40], false, [[25, 70, 25]]),
  mu(13, 'giraffe', 'Giraffe', 1800, 'giraffe', [245, 225, 180], [235, 210, 160], false, [[190, 120, 50]]),
  mu(14, 'schach', 'Schachbrett', 2000, 'schach', [245, 245, 240], [230, 230, 225], false, [[30, 30, 34]]),
  mu(15, 'holz', 'Holz', 2000, 'holz', [196, 146, 92], [150, 102, 60], false, [[110, 68, 34], [230, 196, 140]]),
  mu(16, 'schuppen', 'Schuppen', 2400, 'schuppen', [70, 170, 120], [20, 80, 60], false, [[10, 50, 40]]),
  // ab hier bewegt
  mu(17, 'nacht', 'Nacht', 2500, 'sterne', [70, 96, 170], [22, 24, 60], true),
  mu(18, 'glut', 'Glut', 3000, 'glut', [255, 140, 40], [120, 20, 10], true),
  mu(19, 'eis', 'Eis', 3000, 'funkeln', [220, 245, 255], [110, 180, 220], true),
  mu(20, 'tiefsee', 'Tiefsee', 3000, 'funkeln', [30, 110, 160], [6, 20, 50], true, [[127, 232, 255]]),
  mu(21, 'gift', 'Gift', 3000, 'blubber', [170, 255, 60], [40, 120, 20], true),
  mu(22, 'neon', 'Neon', 3500, 'neon', [20, 20, 30], [10, 10, 16], true),
  mu(23, 'perlmutt', 'Perlmutt', 3500, 'perle', [250, 245, 240], [215, 200, 230], true),
  mu(24, 'chrom', 'Chrom', 3500, 'chrom', [235, 240, 248], [90, 100, 115], true),
  mu(25, 'obsidian', 'Obsidian', 3500, 'chrom', [60, 50, 80], [5, 5, 10], true),
  mu(26, 'gold', 'Gold', 4000, 'glanz', [255, 214, 102], [170, 118, 28], true),
  mu(27, 'silber', 'Silber', 4000, 'glanz', [225, 228, 235], [120, 125, 140], true),
  mu(28, 'rosegold', 'Roségold', 4000, 'glanz', [245, 190, 170], [170, 100, 90], true),
  mu(29, 'lavastein', 'Lavastein', 4500, 'lava', [60, 45, 40], [25, 18, 16], true),
  mu(30, 'matrix', 'Matrix', 4500, 'matrix', [8, 20, 10], [2, 8, 4], true),
  mu(31, 'pixel', '8-Bit', 5000, 'pixel', [80, 200, 90], [30, 100, 50], true),
  mu(32, 'opal', 'Opal', 5000, 'opal', [240, 230, 255], [160, 220, 240], true),
  mu(33, 'hologramm', 'Hologramm', 5500, 'holo', [120, 240, 255], [60, 140, 255], true),
  mu(34, 'gewitter', 'Gewitter', 6000, 'blitz', [92, 102, 132], [34, 38, 56], true),
  mu(35, 'galaxie', 'Galaxie', 6000, 'sterne', [120, 60, 200], [20, 10, 60], true),
  mu(36, 'aurora', 'Aurora', 6500, 'aurora', [255, 255, 255], [255, 255, 255], true),
  mu(37, 'plasma', 'Plasma', 7000, 'plasma', [170, 80, 230], [70, 20, 110], true),
  mu(38, 'feuer', 'Feuer', 7000, 'feuer', [255, 180, 40], [200, 40, 10], true),
  mu(39, 'geist', 'Geist', 7500, 'geist', [235, 240, 255], [200, 210, 240], true),
  mu(40, 'glitch', 'Glitch', 8000, 'glitch', [40, 40, 50], [20, 20, 26], true),
  mu(41, 'regenbogen', 'Regenbogen', 9000, 'regenbogen', [255, 255, 255], [255, 255, 255], true),
  mu(42, 'diamant', 'Diamant', 9000, 'funkeln', [200, 250, 255], [90, 180, 220], true, [[255, 255, 255]]),
  mu(43, 'drache', 'Drache', 11000, 'drache', [60, 150, 70], [20, 60, 30], true),
  mu(44, 'phoenix', 'Phönix', 13000, 'phoenix', [255, 210, 80], [210, 40, 20], true),
  mu(45, 'void', 'Schwarzes Loch', 15000, 'void', [14, 8, 24], [0, 0, 4], true),
  // Belohnungen der Welten (nicht kaufbar): Level 100 ein passender Skin, Level 200 ein epischer mit Glimmer
  mu(46, 'wiesenblume', 'Wiesenblume', 0, 'blumen', [120, 200, 90], [50, 130, 60], false, [[255, 255, 255], [255, 170, 210], [200, 160, 255]]),
  mu(47, 'sandviper', 'Sandviper', 0, 'python', [226, 196, 140], [176, 138, 86], false, [[140, 92, 44], [245, 226, 180]]),
  mu(48, 'norweger', 'Norweger', 0, 'strick', [200, 40, 50], [130, 20, 32], false, [[250, 250, 250]]),
  mu(49, 'erzader', 'Erzader', 0, 'erz', [96, 90, 88], [48, 45, 44], false),
  mu(50, 'leuchtpilz', 'Leuchtpilz', 0, 'leuchten', [64, 52, 128], [24, 18, 58], true, [[120, 255, 220], [255, 140, 230]]),
  mu(51, 'kuerbis', 'Kürbis', 0, 'rillen', [246, 146, 40], [196, 96, 20], false, [[150, 66, 10]]),
  { ...mu(52, 'fruehling', 'Frühlingszauber', 0, 'blumen', [150, 230, 120], [60, 160, 110], true, [[255, 255, 255], [255, 160, 200], [255, 220, 120]]), glimmer: [255, 240, 180] },
  { ...mu(53, 'pharao', 'Pharao', 0, 'pharao', [252, 208, 80], [200, 146, 36], true, [[32, 66, 170], [255, 244, 190]]), glimmer: [255, 220, 120] },
  { ...mu(54, 'eiskoenig', 'Eiskönig', 0, 'funkeln', [236, 250, 255], [110, 180, 235], true, [[255, 255, 255]]), glimmer: [200, 240, 255] },
  { ...mu(55, 'amethyst', 'Amethyst', 0, 'facetten', [184, 120, 240], [84, 40, 150], true), glimmer: [230, 190, 255] },
  { ...mu(56, 'feenzauber', 'Feenzauber', 0, 'leuchten', [120, 230, 220], [160, 90, 230], true, [[255, 255, 255], [255, 170, 240], [170, 255, 240]]), glimmer: [255, 200, 250] },
  { ...mu(57, 'nachtmahr', 'Nachtmahr', 0, 'schemen', [70, 36, 96], [14, 8, 24], true, [[150, 255, 170]]), glimmer: [190, 150, 255] },
  // Belohnungen der Kampagne (nicht kaufbar): Boss der Wiese (Mission 10), Schatzhoehle (Mission 15) und der Ent (Mission 20)
  // und bis dahin im Shop versteckt (wer ihn schon hat, behaelt ihn)
  mu(58, 'schatzhueter', 'Schatzhüter', 0, 'schatz', [246, 196, 70], [176, 116, 26], true, [[230, 40, 80], [40, 200, 120], [60, 140, 255]], true),
  { ...mu(59, 'steingolem', 'Steingolem', 0, 'golem', [150, 142, 132], [78, 72, 66], true, [[255, 150, 50], [92, 136, 66]]), glimmer: [255, 190, 110] },
  { ...mu(60, 'waldgeist', 'Waldgeist', 0, 'waldgeist', [122, 92, 58], [72, 52, 32], true, [[96, 156, 70], [168, 222, 120], [214, 120, 40]]), glimmer: [190, 255, 150] },
]

const ac = (nr: number, platz: Platz, id: string, name: string, preis: number, bewegt = false): Acc => ({ id, nr, name, preis, platz, bewegt })
/** Accessoires: je Platz eins gleichzeitig, rein optisch */
export const ACCS: Acc[] = [
  ac(1, 'augen', 'sonnenbrille', 'Sonnenbrille', 800),
  ac(2, 'augen', 'nerdbrille', 'Nerdbrille', 800),
  ac(3, 'augen', 'herzbrille', 'Herzbrille', 1200),
  ac(4, 'augen', 'monokel', 'Monokel', 1500),
  ac(5, 'augen', 'augenklappe', 'Augenklappe', 1500),
  ac(6, 'augen', 'skibrille', 'Skibrille', 2000),
  ac(7, 'augen', 'thuglife', 'Thug Life', 3000),
  ac(8, 'augen', 'laseraugen', 'Laseraugen', 8000, true),
  ac(9, 'kopf', 'partyhut', 'Partyhut', 800),
  ac(10, 'kopf', 'zylinder', 'Zylinder', 1500),
  ac(11, 'kopf', 'cowboyhut', 'Cowboyhut', 1500),
  ac(12, 'kopf', 'weihnachtsmuetze', 'Weihnachtsmütze', 1500, true),
  ac(13, 'kopf', 'kochmuetze', 'Kochmütze', 2000),
  ac(14, 'kopf', 'stierhoerner', 'Hörner', 2500),
  ac(15, 'kopf', 'wikinger', 'Wikingerhelm', 3000),
  ac(16, 'kopf', 'propeller', 'Propellermütze', 3500, true),
  ac(17, 'kopf', 'krone', 'Krone', 6000, true),
  ac(18, 'kopf', 'einhorn', 'Einhorn', 7000, true),
  ac(19, 'kopf', 'heiligenschein', 'Heiligenschein', 9000, true),
  ac(20, 'gesicht', 'schnurrbart', 'Schnurrbart', 600),
  ac(21, 'gesicht', 'fliege', 'Fliege', 800),
  ac(22, 'gesicht', 'blume', 'Blume', 1000),
  ac(23, 'gesicht', 'clownsnase', 'Clownsnase', 1200),
  ac(24, 'gesicht', 'schnuller', 'Schnuller', 1500),
  ac(25, 'gesicht', 'pfeife', 'Seifenpfeife', 2000, true),
  ac(26, 'schwanz', 'schleife', 'Schleife', 800),
  ac(27, 'schwanz', 'gloeckchen', 'Glöckchen', 1200, true),
  ac(28, 'schwanz', 'bommel', 'Bommel', 1200),
  ac(29, 'schwanz', 'klapper', 'Klapper', 2500, true),
  ac(30, 'schwanz', 'skorpion', 'Skorpion', 3500),
  ac(31, 'schwanz', 'rakete', 'Raketenantrieb', 6000, true),
  ac(32, 'schwanz', 'komet', 'Kometenschweif', 9000, true),
  // Belohnungen der Welten (Level 150)
  ac(33, 'kopf', 'blumenkranz', 'Blumenkranz', 0),
  ac(34, 'kopf', 'nemes', 'Pharaonenhaube', 0),
  ac(35, 'kopf', 'pudelmuetze', 'Pudelmütze', 0),
  ac(36, 'kopf', 'grubenhelm', 'Grubenhelm', 0, true),
  ac(37, 'kopf', 'zauberhut', 'Zauberhut', 0, true),
  ac(38, 'kopf', 'hexenhut', 'Hexenhut', 0),
]

const sp = (nr: number, id: string, name: string, preis: number): SpurArt => ({ id: `spur-${id}`, nr, name, preis })
/** Spuren: was hinter dem Schwanz entsteht und verblasst (alle bewegt) */
export const SPUREN: SpurArt[] = [
  sp(1, 'staub', 'Staub', 500),
  sp(2, 'blasen', 'Seifenblasen', 1200),
  sp(3, 'blaetter', 'Blätter', 1500),
  sp(4, 'herzen', 'Herzen', 2000),
  sp(5, 'noten', 'Noten', 2500),
  sp(6, 'schnee', 'Schnee', 2500),
  sp(7, 'konfetti', 'Konfetti', 3500),
  sp(8, 'funken', 'Funken', 4000),
  sp(9, 'sterne', 'Sternschnuppe', 6000),
  sp(10, 'pixel', 'Pixel', 6000),
  sp(11, 'regenbogen', 'Regenbogen', 9000),
  sp(12, 'flammen', 'Flammenspur', 12000),
  // Belohnungen der Welten (Level 200, zum epischen Skin)
  sp(13, 'blueten', 'Blütenblätter', 0),
  sp(14, 'goldsand', 'Goldsand', 0),
  sp(15, 'eiskristalle', 'Eiskristalle', 0),
  sp(16, 'edelsteine', 'Edelsteine', 0),
  sp(17, 'feenstaub', 'Feenstaub', 0),
  sp(18, 'irrlichter', 'Irrlichter', 0),
]

/**
 * Belohnungen je Welt: Level 100 ein passender Skin, 150 ein Accessoire, 200 ein epischer Skin mit Spur.
 * Kann man nicht kaufen, nur in der Welt erspielen.
 */
export const WELT_LOHN: { welt: string; level: number; id: string }[] = [
  ...(
    [
      ['wiese', 'wiesenblume', 'blumenkranz', 'fruehling', 'spur-blueten'],
      ['wueste', 'sandviper', 'nemes', 'pharao', 'spur-goldsand'],
      ['winter', 'norweger', 'pudelmuetze', 'eiskoenig', 'spur-eiskristalle'],
      ['bergwerk', 'erzader', 'grubenhelm', 'amethyst', 'spur-edelsteine'],
      ['zauberwald', 'leuchtpilz', 'zauberhut', 'feenzauber', 'spur-feenstaub'],
      ['gruselwald', 'kuerbis', 'hexenhut', 'nachtmahr', 'spur-irrlichter'],
    ] as const
  ).flatMap(([welt, skin, acc, episch, spur]) => [
    { welt, level: 100, id: skin },
    { welt, level: 150, id: acc },
    { welt, level: 200, id: episch },
    { welt, level: 200, id: spur },
  ]),
]
const LOHN = new Map(WELT_LOHN.map((l) => [l.id, l]))
/** Ist das eine Belohnung einer Welt? (dann nicht kaufbar) */
export const lohnVon = (id: string) => LOHN.get(id)
/** Belohnungen der Kampagne: Skin fuer eine Mission (nicht kaufbar), siehe game/missionen.ts MISSION_SKINS */
export const MISSION_LOHN: { welt: string; mission: number; id: string }[] = Object.entries(MISSION_SKINS).map(([nr, id]) => ({ welt: Number(nr) <= 20 ? 'wiese' : 'wueste', mission: Number(nr), id }))
const MLOHN = new Map(MISSION_LOHN.map((l) => [l.id, l]))
export const missionLohnVon = (id: string) => MLOHN.get(id)
/** Name einer Sache (Skin, Accessoire, Spur) nach Id */
export const nameVon = (id: string) => [...MUSTER, ...ACCS, ...SPUREN].find((x) => x.id === id)?.name ?? id

/** Kaufbare Modi fuer die Farben */
export const MODI = [
  { id: 'zweifarbig', name: 'Zweifarbig', preis: 3000, n: 2 },
  { id: 'dreifarbig', name: 'Dreifarbig', preis: 7500, n: 3 },
] as const

export const TEILUNGEN: { id: Teilung; name: string }[] = [
  { id: 'abschnitt', name: 'Abschnitte' },
  { id: 'ringe', name: 'Ringe' },
  { id: 'verlauf', name: 'Verlauf' },
]

/** Preis jeder kaufbaren Sache nach Id (Farben, Skins, Accessoires, Spuren, Modi) */
const PREISE = new Map<string, number>([...FARBEN, ...MUSTER, ...ACCS, ...SPUREN, ...MODI].map((x) => [x.id, x.preis]))
export const preisVon = (id: string) => PREISE.get(id) ?? 0
/** Besitzt man es? (alles mit Preis 0 hat jeder) */
export const hatSkin = (besitz: string[], id: string) => (preisVon(id) === 0 && !LOHN.has(id) && !MLOHN.has(id)) || besitz.includes(id)
/** Wie viele kaufbare Sachen man besitzt (fuer den Erfolg "Modebewusst") */
export const anzahlBesitz = (besitz: string[]) => [...PREISE.keys()].filter((id) => hatSkin(besitz, id)).length

/* ================= Kodierung ================= */

const b36 = (n: number) => n.toString(36).padStart(2, '0')
const TEIL_K: Record<Teilung, string> = { abschnitt: 'a', ringe: 'r', verlauf: 'v', stufen: 's' }

/** Aussehen aus seinen Teilen bauen. farben: Ids, acc: Ids (je Platz eins), muster/spur: Id */
export function baueSkin(o: { farben?: string[]; teilung?: Teilung; muster?: string; acc?: string[]; spur?: string; effekt?: string }): Skin {
  const farben = (o.farben ?? ['klassik']).map((id) => FARBEN.find((f) => f.id === id) ?? FARBEN[0]).slice(0, 3)
  const muster = o.muster ? MUSTER.find((m) => m.id === o.muster) : undefined
  const acc: Acc[] = []
  for (const id of o.acc ?? []) {
    const a = ACCS.find((x) => x.id === id)
    if (a && !acc.some((x) => x.platz === a.platz)) acc.push(a)
  }
  const spur = o.spur ? SPUREN.find((s) => s.id === o.spur) : undefined
  const effekt = o.effekt ? EFFEKTE.find((e) => e.id === o.effekt) : undefined
  const skin: Skin = { code: '', farben: farben.length ? farben : [FARBEN[0]], teilung: o.teilung ?? 'abschnitt', muster, acc, spur, effekt }
  skin.code = kodiere(skin)
  return skin
}

/** Kurzer Text fuer ein Aussehen (hoechstens 32 Zeichen) */
export function kodiere(s: Skin): string {
  if (!s.acc.length && !s.spur && !s.effekt) {
    if (s.muster) return s.muster.id
    if (s.farben.length === 1) return s.farben[0].id
  }
  let t = '~'
  if (s.muster) t += `m${b36(s.muster.nr)}`
  else t += `f${TEIL_K[s.teilung]}${s.farben.length}${s.farben.map((f) => b36(f.nr)).join('')}`
  if (s.acc.length) t += `x${s.acc.length}${s.acc.map((a) => b36(a.nr)).join('')}`
  if (s.spur) t += `s${b36(s.spur.nr)}`
  if (s.effekt) t += `e${b36(s.effekt.nr)}`
  return t
}

const cache = new Map<string, Skin>()
/** Aussehen aus dem Text (alte einzelne Ids gehen weiter; Unbekanntes wird zu Gruen) */
export function skinVon(code: string): Skin {
  const c = cache.get(code)
  if (c) return c
  let s: Skin
  if (!code.startsWith('~')) {
    const m = MUSTER.find((x) => x.id === code)
    s = m ? baueSkin({ muster: m.id }) : baueSkin({ farben: [FARBEN.find((f) => f.id === code)?.id ?? 'klassik'] })
  } else {
    const o: Parameters<typeof baueSkin>[0] = {}
    let i = 1
    const nr = () => parseInt(code.slice(i, (i += 2)), 36)
    try {
      while (i < code.length) {
        const k = code[i++]
        if (k === 'm') {
          const n = nr()
          o.muster = MUSTER.find((x) => x.nr === n)?.id
        } else if (k === 'f') {
          const t = code[i++]
          // 'l' (frueher laengs) wird zum Verlauf
          o.teilung = t === 'r' ? 'ringe' : t === 'v' || t === 'l' ? 'verlauf' : t === 's' ? 'stufen' : 'abschnitt'
          const anz = Number(code[i++])
          o.farben = []
          for (let j = 0; j < anz; j++) {
            const n = nr()
            o.farben.push(FARBEN.find((x) => x.nr === n)?.id ?? 'klassik')
          }
        } else if (k === 'x') {
          const anz = Number(code[i++])
          o.acc = []
          for (let j = 0; j < anz; j++) {
            const n = nr()
            const a = ACCS.find((x) => x.nr === n)
            if (a) o.acc.push(a.id)
          }
        } else if (k === 's') {
          const n = nr()
          o.spur = SPUREN.find((x) => x.nr === n)?.id
        } else if (k === 'e') {
          const n = nr()
          o.effekt = EFFEKTE.find((x) => x.nr === n)?.id
        } else break
      }
    } catch {
      /* kaputter Text: was bis hier gelesen ist, gilt */
    }
    s = baueSkin(o)
  }
  if (cache.size > 200) cache.clear()
  cache.set(code, s)
  return s
}
export const SKINS = FARBEN
export const STANDARD = skinVon('klassik')

/** Gegner-Schlangen: rot, leicht boese (nicht im Shop) */
export const GEGNER_SKIN: Skin = baueSkin({ farben: ['rot'] })
/** Lila Gegner: laenger, schneller, boeser. Plasma-Blitze im Koerper und kleine Hoerner */
export const LILA_SKIN: Skin = baueSkin({ muster: 'plasma', acc: ['stierhoerner'] })

/** Hauptfarbe an Stelle k (0 Kopf bis 1 Schwanz), fuer abgeschnittene Stuecke und Funken */
export function farbeBei(s: Skin, k: number): RGB {
  if (s.muster) return mix(s.muster.kopf, s.muster.schwanz, k)
  const i = Math.min(s.farben.length - 1, Math.floor(k * s.farben.length))
  if (s.farben.length > 1 && (s.teilung === 'verlauf' || s.teilung === 'stufen')) return verlaufFarbe(s.farben, k)
  const f = s.teilung === 'abschnitt' ? s.farben[i] : s.farben[0]
  return mix(f.kopf, f.schwanz, k)
}

/** Eigener Farbverlauf ueber die gewaehlten Farben (Kopf zur ersten, Schwanz zur letzten), zum Schwanz etwas dunkler */
function verlaufFarbe(fs: Farbe[], k: number): RGB {
  const ton = (f: Farbe) => mix(f.kopf, f.schwanz, 0.25)
  const pos = Math.min(1, Math.max(0, k)) * (fs.length - 1)
  const j = Math.min(fs.length - 2, Math.floor(pos))
  return mix(mix(ton(fs[j]), ton(fs[j + 1]), pos - j), [0, 0, 0], k * 0.18)
}

/* ================= Zeitablauf ================= */

/** Dauer der Muster-Animationen in ms (ganze Teiler von 6000, damit die Shop-Videos nahtlos wiederholen) */
export const TAKT = { blinzeln: 3000 }
const SCHLEIFE = 6000
/** Bewegt sich etwas (ausser dem Blinzeln)? Wenn nicht, reicht im Shop ein Bild */
export function skinBewegt(s: Skin) {
  return !!s.muster?.bewegt || s.acc.some((a) => a.bewegt) || !!s.spur || !!s.effekt
}
/** Wie lang ein Shop-Video sein muss, damit alles darin nahtlos wiederholt */
export const schleifeMs = (_s: Skin) => SCHLEIFE
/** Welle mit ganzzahlig vielen Durchlaeufen je Schleife (nahtlos) */
const welle = (now: number, ms: number) => ((now % ms) / ms) * Math.PI * 2

/* ================= Zeichnen ================= */

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`)
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const TAU = Math.PI * 2
const GIFT_KOPF: RGB = [126, 116, 60]
const GIFT_SCHWANZ: RGB = [70, 52, 70]
const WINKEL: Record<Dir, number> = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 }

export type SchlangeOpts = {
  tot?: boolean
  /** 0..1: faerbt sich nach einem Giftapfel kraenklich */
  vergiftet?: number
  zunge?: boolean
  blinzeln?: boolean
  /** Leicht boese Augenbrauen (Gegner). 2 = lila: dazu leicht gluehende Augen */
  brauen?: boolean | 2
  /** 0..1: Pupillen weit, Brauen hochgezogen (Gegner auf der Flucht) */
  angst?: number
}

/** Abtastpunkt entlang des Koerpers (Pixel), t = Richtung zum Kopf, n = quer, s = Abstand vom Kopf in Feldern */
type Probe = { x: number; y: number; tx: number; ty: number; nx: number; ny: number; s: number; k: number; w: number }

function abtasten(pts: P[], cell: number, w0: number, schritt: number): Probe[] {
  const px = (v: number) => (v + 0.5) * cell
  let gesamt = 0
  for (let i = 0; i < pts.length - 1; i++) gesamt += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  gesamt = Math.max(gesamt, 1e-6)
  const out: Probe[] = []
  let s = 0
  let naechste = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < 1e-6) continue
    const tx = (a.x - b.x) / l
    const ty = (a.y - b.y) / l
    while (naechste <= s + l) {
      const t = (naechste - s) / l
      const k = naechste / gesamt
      out.push({ x: px(a.x + (b.x - a.x) * t), y: px(a.y + (b.y - a.y) * t), tx, ty, nx: -ty, ny: tx, s: naechste, k, w: w0 * (1 - k * 0.18) })
      naechste += schritt
    }
    s += l
  }
  return out
}

/** Zwischenebene fuer Muster (nur so gross wie die Schlange im Bild) */
let ebene: HTMLCanvasElement | null = null

/** Schlange zeichnen. pts = Glieder in Feldkoordinaten, Kopf zuerst (bereits weich interpoliert) */
export function drawSchlange(ctx: CanvasRenderingContext2D, pts: P[], cell: number, dir: Dir, skin: Skin, now: number, o: SchlangeOpts = {}) {
  if (!pts.length) return
  const px = (v: number) => (v + 0.5) * cell
  const w = cell * 0.74
  const n = pts.length
  const vg = o.vergiftet ?? 0
  const m = skin.muster
  const art = vg ? '' : (m?.art ?? '')
  const fs = skin.farben
  const geist = art === 'geist' || art === 'holo'
  // Grundfarbe an Stelle k (0 Kopf, 1 Schwanz), i = Glied
  const farbe = (k: number, i: number): string => {
    if (art === 'regenbogen') return `hsl(${((now * 360) / 4000 + i * 14) % 360}, 72%, ${58 - k * 14}%)`
    if (art === 'aurora') return `hsl(${190 + 70 * Math.sin(welle(now, 6000) + i * 0.35)}, 70%, ${60 - k * 18}%)`
    let c: RGB
    if (m) c = mix(m.kopf, m.schwanz, k)
    else if (fs.length > 1 && skin.teilung === 'abschnitt') {
      const pos = k * fs.length
      const j = Math.min(fs.length - 1, Math.floor(pos))
      c = mix(fs[j].kopf, fs[j].schwanz, 0.15 + k * 0.4)
      const t = pos - j
      if (t > 0.85 && j < fs.length - 1) c = mix(c, mix(fs[j + 1].kopf, fs[j + 1].schwanz, 0.15 + k * 0.4), (t - 0.85) / 0.15)
    } else if (fs.length > 1 && (skin.teilung === 'verlauf' || skin.teilung === 'stufen')) c = verlaufFarbe(fs, k)
    else if (fs.length > 1 && skin.teilung === 'ringe') {
      const f = fs[i % fs.length]
      c = mix(f.kopf, f.schwanz, k * 0.6)
    } else c = mix(fs[0].kopf, fs[0].schwanz, k)
    if (vg) c = mix(c, mix(GIFT_KOPF, GIFT_SCHWANZ, k), vg)
    return rgb(c)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Effekt (Aura) hinter der Schlange
  if (skin.effekt && !o.tot) drawEffekt(ctx, skin.effekt, pts, cell, WINKEL[dir], now, 'hinten')

  // Schatten
  if (!geist) {
    ctx.strokeStyle = 'rgba(12, 40, 32, 0.22)'
    ctx.lineWidth = w
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), px(p.y) + cell * 0.12) : ctx.moveTo(px(p.x), px(p.y) + cell * 0.12)))
    ctx.stroke()
  }

  const accs = skin.acc
  const hat = (id: string) => accs.some((a) => a.id === id)
  const proben = art || accs.some((a) => a.platz === 'schwanz') ? abtasten(pts, cell, w, 0.09) : null
  if (proben && hat('komet')) komet(ctx, proben, cell, now)
  if (proben && hat('rakete')) rakete(ctx, proben, cell, now)

  // Koerper vom Schwanz zum Kopf, mit Muster in einer Zwischenebene (Muster bleiben auf der Schlange)
  const mitEbene = !!proben && !!art
  let L = ctx
  let rx = 0
  let ry = 0
  let rw = 0
  let rh = 0
  /** Nur Abtastpunkte im Bild (lange Schlangen ragen weit hinaus) */
  let pv = proben ?? []
  if (mitEbene) {
    const mt = ctx.getTransform()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of pts) {
      x0 = Math.min(x0, px(p.x))
      y0 = Math.min(y0, px(p.y))
      x1 = Math.max(x1, px(p.x))
      y1 = Math.max(y1, px(p.y))
    }
    const rand = cell * 1.2
    rx = Math.max(0, Math.floor(mt.a * (x0 - rand) + mt.e))
    ry = Math.max(0, Math.floor(mt.d * (y0 - rand) + mt.f))
    rw = Math.min(ctx.canvas.width, Math.ceil(mt.a * (x1 + rand) + mt.e)) - rx
    rh = Math.min(ctx.canvas.height, Math.ceil(mt.d * (y1 + rand) + mt.f)) - ry
    if (rw <= 0 || rh <= 0) return
    ebene ??= document.createElement('canvas')
    if (ebene.width < rw || ebene.height < rh) {
      ebene.width = Math.max(ebene.width, rw)
      ebene.height = Math.max(ebene.height, rh)
    }
    L = ebene.getContext('2d')!
    L.setTransform(1, 0, 0, 1, 0, 0)
    L.clearRect(0, 0, rw, rh)
    L.setTransform(mt.a, 0, 0, mt.d, mt.e - rx, mt.f - ry)
    L.lineCap = 'round'
    L.lineJoin = 'round'
    const ux0 = (rx - mt.e) / mt.a - cell
    const ux1 = (rx + rw - mt.e) / mt.a + cell
    const uy0 = (ry - mt.f) / mt.d - cell
    const uy1 = (ry + rh - mt.f) / mt.d + cell
    pv = pv.filter((p) => p.x >= ux0 && p.x <= ux1 && p.y >= uy0 && p.y <= uy1)
  }
  if (art === 'pixel' && proben) pixelKoerper(L, pv, cell, now, m!)
  else {
    // Weicher Verlauf: jedes Glied in vier Teilen (fliessender Uebergang); sonst eine Farbe je Glied
    const teile = !m && fs.length > 1 && skin.teilung === 'verlauf' ? 4 : 1
    for (let i = n - 2; i >= 0; i--) {
      for (let t = teile - 1; t >= 0; t--) {
        const k = n > 2 ? (i + t / teile) / (n - 2) : 0
        const a = pts[i]
        const b = pts[i + 1]
        L.strokeStyle = farbe(Math.min(1, k), i)
        L.lineWidth = w * (1 - Math.min(1, k) * 0.18)
        L.beginPath()
        L.moveTo(px(a.x + (b.x - a.x) * (t / teile)), px(a.y + (b.y - a.y) * (t / teile)))
        L.lineTo(px(a.x + (b.x - a.x) * ((t + 1) / teile)), px(a.y + (b.y - a.y) * ((t + 1) / teile)))
        L.stroke()
      }
    }
    L.fillStyle = farbe(0, 0)
    L.beginPath()
    L.arc(px(pts[0].x), px(pts[0].y), w * 0.56, 0, TAU)
    L.fill()
  }
  if (mitEbene && proben) {
    L.globalCompositeOperation = 'source-atop'
    muster(L, pv, cell, m!, now, Math.abs(ctx.getTransform().a), holzEnde(pts, cell))
    L.globalCompositeOperation = 'source-over'
  }
  // Lichtkante auf dem Ruecken
  if (art !== 'pixel') {
    if (mitEbene) L.globalCompositeOperation = 'source-atop'
    L.strokeStyle = 'rgba(255, 255, 255, 0.13)'
    L.lineWidth = w * 0.22
    L.beginPath()
    pts.slice(0, Math.min(n, 60)).forEach((p, i) => (i ? L.lineTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1) : L.moveTo(px(p.x) - cell * 0.08, px(p.y) - cell * 0.1)))
    L.stroke()
    L.globalCompositeOperation = 'source-over'
  }
  if (mitEbene && ebene) {
    const dprA = Math.abs(ctx.getTransform().a)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (art === 'geist') ctx.globalAlpha *= 0.62 + 0.08 * Math.sin(welle(now, 2000))
    if (art === 'holo') ctx.globalAlpha *= holoFlacker(now)
    if (art === 'neon' || art === 'void' || art === 'plasma') {
      ctx.shadowColor = art === 'neon' ? `hsl(${(now * 0.06) % 360}, 100%, 60%)` : art === 'plasma' ? 'rgba(200, 120, 255, 0.85)' : 'rgba(170, 80, 255, 0.9)'
      ctx.shadowBlur = cell * (art === 'plasma' ? 0.35 : 0.5) * dprA
    }
    if (art === 'glitch') glitchVersatz(ctx, ebene, rx, ry, rw, rh, cell * dprA, now)
    ctx.drawImage(ebene, 0, 0, rw, rh, rx, ry, rw, rh)
    ctx.restore()
  }
  if (proben && art === 'neon') neonRand(ctx, proben, cell, now)
  if (proben && m?.glimmer && !vg) glimmer(ctx, pv, cell, now, m.glimmer)
  if (proben && (art === 'feuer' || art === 'phoenix')) feuer(ctx, proben, cell, now, art === 'phoenix')

  const hx = px(pts[0].x)
  const hy = px(pts[0].y)
  const d = STEP[dir]

  // Zunge
  if (o.zunge) {
    const l = cell * (0.45 + 0.1 * Math.sin(now / 30))
    const bx = hx + d.x * w * 0.5
    const by = hy + d.y * w * 0.5
    const ex = bx + d.x * l
    const ey = by + d.y * l
    ctx.strokeStyle = '#D9443A'
    ctx.lineWidth = Math.max(1.2, cell * 0.05)
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + d.x * cell * 0.1 + d.y * cell * 0.08, ey + d.y * cell * 0.1 + d.x * cell * 0.08)
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + d.x * cell * 0.1 - d.y * cell * 0.08, ey + d.y * cell * 0.1 - d.x * cell * 0.08)
    ctx.stroke()
  }
  if (m?.art === 'glanz' && !vg) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.arc(hx - w * 0.15, hy - w * 0.18, w * 0.16, 0, TAU)
    ctx.fill()
  }

  // Kopf-Rahmen: vorne = +x, rechts = +y
  const R = w * 0.56
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(WINKEL[dir])
  // Huete und Hoerner sitzen auf dem Hinterkopf, unter den Augen
  for (const a of accs) {
    if (a.platz !== 'kopf' || a.id === 'heiligenschein') continue
    ctx.save()
    if (a.id !== 'einhorn' && a.id !== 'stierhoerner') {
      ctx.translate(-cell * 0.14, 0)
      ctx.scale(0.8, 0.8)
    }
    accKopf(ctx, a.id, cell, R, now)
    ctx.restore()
  }
  augen(ctx, cell, art, o)
  for (const a of accs) if (a.platz === 'augen' || a.platz === 'gesicht' || a.id === 'heiligenschein') accKopf(ctx, a.id, cell, R, now)
  ctx.restore()
  if (art === 'drache') rauch(ctx, hx, hy, WINKEL[dir], cell, now)
  if (proben) for (const a of accs) if (a.platz === 'schwanz') accSchwanz(ctx, a.id, proben, cell, now)
  if (skin.effekt && !o.tot) drawEffekt(ctx, skin.effekt, pts, cell, WINKEL[dir], now, 'vorn')
}

/** Augen im Kopf-Rahmen (vorne = +x) */
function augen(ctx: CanvasRenderingContext2D, cell: number, art: string, o: SchlangeOpts) {
  for (const s of [-1, 1]) {
    const ex = cell * 0.1
    const ey = cell * 0.2 * s
    if (o.tot) {
      ctx.strokeStyle = '#16211d'
      ctx.lineWidth = Math.max(1.5, cell * 0.06)
      const r = cell * 0.1
      ctx.beginPath()
      ctx.moveTo(ex - r, ey - r)
      ctx.lineTo(ex + r, ey + r)
      ctx.moveTo(ex + r, ey - r)
      ctx.lineTo(ex - r, ey + r)
      ctx.stroke()
      continue
    }
    if (art === 'geist') {
      ctx.fillStyle = '#2A2F45'
      ctx.beginPath()
      ctx.ellipse(ex, ey, cell * 0.09, cell * 0.13, 0, 0, TAU)
      ctx.fill()
      continue
    }
    const lila = o.brauen === 2
    if (lila && !o.blinzeln) {
      // leichtes Gluehen
      ctx.fillStyle = 'rgba(210, 150, 255, 0.35)'
      ctx.beginPath()
      ctx.arc(ex, ey, cell * 0.22, 0, TAU)
      ctx.fill()
    }
    if ((art === 'golem' || art === 'waldgeist') && !o.blinzeln) {
      // Steingolem und Waldgeist: Augen gluehen wie beim Boss
      ctx.fillStyle = art === 'waldgeist' ? 'rgba(240, 220, 100, 0.4)' : 'rgba(255, 170, 70, 0.4)'
      ctx.beginPath()
      ctx.arc(ex, ey, cell * 0.24, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = lila ? '#F4E6FF' : art === 'void' ? '#C8A2FF' : art === 'matrix' ? '#7CFF8A' : art === 'golem' ? '#FFC36B' : art === 'waldgeist' ? '#F6DE6E' : '#fff'
    ctx.beginPath()
    if (o.blinzeln) ctx.ellipse(ex, ey, cell * 0.03, cell * 0.15, 0, 0, TAU)
    else ctx.arc(ex, ey, cell * 0.15, 0, TAU)
    ctx.fill()
    if (o.blinzeln) continue
    ctx.fillStyle = lila ? '#4A0F73' : art === 'void' ? '#1A0030' : art === 'golem' ? '#5A1E00' : art === 'waldgeist' ? '#3A2A10' : '#16211d'
    ctx.beginPath()
    ctx.arc(ex + cell * 0.06, ey, cell * (0.075 - 0.025 * (o.angst ?? 0)), 0, TAU)
    ctx.fill()
    if (o.brauen) {
      // Leicht boese: Braue vor dem Auge, innen etwas tiefer. Auf der Flucht innen hochgezogen
      const a = o.angst ?? 0
      const innen = cell * (0.185 + 0.1 * a)
      const aussen = cell * 0.23
      ctx.strokeStyle = lila ? '#2A0840' : '#4A0E12'
      ctx.lineWidth = Math.max(1.3, cell * 0.055)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ex + innen, ey - s * cell * 0.1)
      ctx.lineTo(ex + aussen, ey + s * cell * 0.1)
      ctx.stroke()
    }
  }
}


/** Epische Skins: viele kleine Sterne funkeln ueber dem Koerper, mit weichem Schein */
function glimmer(ctx: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number, f: RGB) {
  for (const p of pr) {
    if (p.s > 40) break
    const r = raster(p, 0.17)
    if (r < 0) continue
    const tw = Math.max(0, Math.sin(welle(now, 1500) + r * 2.7))
    if (tw < 0.2) continue
    const q = (hash(r * 1.7) - 0.5) * 1.15
    const x = p.x + p.nx * p.w * q
    const y = p.y + p.ny * p.w * q
    const rr = cell * 0.17 * tw
    ctx.fillStyle = rgb(f, 0.35 * tw)
    ctx.beginPath()
    ctx.arc(x, y, rr * 0.9, 0, TAU)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + 0.4 * tw})`
    ctx.beginPath()
    ctx.moveTo(x, y - rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.quadraticCurveTo(x, y, x, y + rr)
    ctx.quadraticCurveTo(x, y, x - rr, y)
    ctx.quadraticCurveTo(x, y, x, y - rr)
    ctx.fill()
  }
}

/** Ende des Schwanzes (fuer den Holz-Skin: Schnittflaeche mit Jahresringen) */
function holzEnde(pts: P[], cell: number) {
  const n = pts.length
  if (n < 2) return null
  const a = pts[n - 1]
  const b = pts[n - 2]
  const l = Math.hypot(a.x - b.x, a.y - b.y) || 1
  return { x: (a.x + 0.5) * cell, y: (a.y + 0.5) * cell, tx: (a.x - b.x) / l, ty: (a.y - b.y) / l }
}

/** Hologramm: flackert leicht, ab und zu laeuft ein Stoerstreifen durch */
const holoFlacker = (now: number) => 0.7 + 0.08 * Math.sin(now / 37) + (hash(Math.floor(now / 70)) > 0.93 ? -0.3 : 0)

function glitchVersatz(ctx: CanvasRenderingContext2D, ebene: HTMLCanvasElement, rx: number, ry: number, rw: number, rh: number, cellD: number, now: number) {
  const takt = Math.floor(now / 120)
  if (hash(takt) < 0.45) return
  // Farbversatz rot/tuerkis und ein paar verschobene Scheiben
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha *= 0.55
  for (const [f, dx] of [['hue-rotate(150deg)', (hash(takt + 3) - 0.5) * cellD * 0.4], ['hue-rotate(-60deg)', -(hash(takt + 5) - 0.5) * cellD * 0.4]] as const) {
    ctx.filter = f
    ctx.drawImage(ebene, 0, 0, rw, rh, rx + dx, ry, rw, rh)
  }
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha /= 0.55
  for (let i = 0; i < 3; i++) {
    const h = Math.max(2, Math.round(cellD * (0.08 + hash(takt * 7 + i) * 0.15)))
    const y = Math.round(hash(takt * 3 + i) * Math.max(1, rh - h))
    const dx = (hash(takt * 11 + i) - 0.5) * cellD * 0.5
    ctx.drawImage(ebene, 0, y, rw, h, rx + dx, ry + y, rw, h)
  }
}

/** Quer ueber den Koerper an Probe p (halbe Breite b * w) */
function quer(L: CanvasRenderingContext2D, p: Probe, b: number, dicke: number, schief = 0) {
  L.lineWidth = dicke
  L.beginPath()
  L.moveTo(p.x - p.nx * p.w * b + p.tx * p.w * schief, p.y - p.ny * p.w * b + p.ty * p.w * schief)
  L.lineTo(p.x + p.nx * p.w * b - p.tx * p.w * schief, p.y + p.ny * p.w * b - p.ty * p.w * schief)
  L.stroke()
}
const punkt = (L: CanvasRenderingContext2D, p: Probe, q: number, laengs: number, r: number) => {
  L.beginPath()
  L.arc(p.x + p.nx * p.w * q + p.tx * laengs, p.y + p.ny * p.w * q + p.ty * laengs, r, 0, TAU)
  L.fill()
}
/** Liegt die Probe am Raster (alle `abstand` Felder)? Gibt die Nummer zurueck, sonst -1 */
const raster = (p: Probe, abstand: number, halb = 0.045) => {
  const r = Math.round(p.s / abstand)
  return Math.abs(p.s - r * abstand) < halb ? r : -1
}

function muster(L: CanvasRenderingContext2D, pr: Probe[], cell: number, m: Muster, now: number, dpr: number, ende: ReturnType<typeof holzEnde>) {
  const ex = m.extra ?? []
  const c0 = ex[0] ? rgb(ex[0]) : 'rgba(40,22,10,0.8)'
  L.lineCap = 'butt'
  switch (m.art) {
    case 'blumen':
      // Kleine Blueten mit fuenf Blaettern und gelber Mitte
      for (const p of pr) {
        const r = raster(p, 0.42)
        if (r <= 0) continue
        const q = (hash(r) - 0.5) * 0.8
        const cx = p.x + p.nx * p.w * q
        const cy = p.y + p.ny * p.w * q
        const rr = p.w * 0.11
        L.fillStyle = rgb(ex.length ? ex[r % ex.length] : [255, 255, 255])
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + r
          L.beginPath()
          L.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rr * 0.75, 0, TAU)
          L.fill()
        }
        L.fillStyle = '#FFD84A'
        L.beginPath()
        L.arc(cx, cy, rr * 0.6, 0, TAU)
        L.fill()
      }
      break
    case 'strick':
      // Norweger: schmale Baender, dazwischen Rauten im Zickzack und einzelne Punkte
      L.fillStyle = rgb(ex[0] ?? [255, 255, 255])
      L.strokeStyle = rgb(ex[0] ?? [255, 255, 255])
      for (const p of pr) {
        if (p.s < 0.3) continue
        const t = p.s % 1.1
        if (t < 0.06 || (t > 0.5 && t < 0.56)) {
          quer(L, p, 0.6, cell * 0.06)
          continue
        }
        const r = raster(p, 0.11)
        if (r < 0) continue
        if (t > 0.12 && t < 0.44) {
          const q = r % 2 ? 0.26 : -0.26
          punkt(L, p, q, 0, p.w * 0.075)
          punkt(L, p, -q, 0, p.w * 0.04)
        } else if (t > 0.62 && t < 1.04 && r % 3 === 0) punkt(L, p, 0, 0, p.w * 0.06)
      }
      break
    case 'erz': {
      // Fels mit feinen Rissen, darin Gold, Diamant und Rubin mit Glanzpunkt
      L.strokeStyle = 'rgba(28, 24, 22, 0.55)'
      L.lineWidth = Math.max(1, cell * 0.03)
      L.lineCap = 'round'
      for (const p of pr) {
        const r = raster(p, 0.6)
        if (r <= 0) continue
        const q = (hash(r) - 0.5) * 0.6
        L.beginPath()
        L.moveTo(p.x + p.nx * p.w * q, p.y + p.ny * p.w * q)
        L.lineTo(p.x + p.nx * p.w * (q + 0.32) + p.tx * cell * 0.16, p.y + p.ny * p.w * (q + 0.32) + p.ty * cell * 0.16)
        L.stroke()
      }
      for (const p of pr) {
        const r = raster(p, 0.27)
        if (r <= 0) continue
        const a = hash(r + 5)
        const farbe: RGB = a < 0.55 ? [255, 200, 60] : a < 0.82 ? [150, 235, 255] : [230, 40, 80]
        const q = (hash(r * 3) - 0.5) * 0.8
        const x = p.x + p.nx * p.w * q
        const y = p.y + p.ny * p.w * q
        const rr = p.w * (0.07 + hash(r + 9) * 0.05)
        L.fillStyle = rgb(farbe)
        L.beginPath()
        L.moveTo(x, y - rr)
        L.lineTo(x + rr, y)
        L.lineTo(x, y + rr)
        L.lineTo(x - rr, y)
        L.fill()
        L.fillStyle = 'rgba(255,255,255,0.8)'
        L.fillRect(x - rr * 0.35, y - rr * 0.45, rr * 0.3, rr * 0.3)
      }
      break
    }
    case 'leuchten':
      // Leuchtende Punkte (Pilzsporen, Feenlicht), pulsieren nacheinander
      for (const p of pr) {
        const r = raster(p, 0.3)
        if (r <= 0) continue
        const puls = 0.5 + 0.5 * Math.sin(welle(now, 2000) + r * 1.3)
        const farbe = ex.length ? ex[r % ex.length] : ([120, 255, 220] as RGB)
        const q = (hash(r) - 0.5) * 0.75
        const x = p.x + p.nx * p.w * q
        const y = p.y + p.ny * p.w * q
        const g = L.createRadialGradient(x, y, 0, x, y, p.w * 0.32)
        g.addColorStop(0, rgb(farbe, 0.15 + 0.75 * puls))
        g.addColorStop(1, rgb(farbe, 0))
        L.fillStyle = g
        L.fillRect(x - p.w * 0.32, y - p.w * 0.32, p.w * 0.64, p.w * 0.64)
        L.fillStyle = rgb(farbe, 0.6 + 0.4 * puls)
        L.beginPath()
        L.arc(x, y, p.w * 0.07, 0, TAU)
        L.fill()
      }
      break
    case 'rillen':
      // Kuerbis: Rillen laengs, dazwischen heller Glanz
      L.lineCap = 'round'
      for (const [q, f, d] of [[-0.32, 0, 0.045], [0, 0, 0.045], [0.32, 0, 0.045], [-0.16, 1, 0.05], [0.16, 1, 0.05]] as const) {
        L.strokeStyle = f ? 'rgba(255, 222, 150, 0.28)' : rgb(ex[0] ?? [150, 66, 10], 0.55)
        L.lineWidth = Math.max(1, cell * d)
        L.beginPath()
        pr.forEach((p, i) => {
          const x = p.x + p.nx * p.w * q
          const y = p.y + p.ny * p.w * q
          if (i) L.lineTo(x, y)
          else L.moveTo(x, y)
        })
        L.stroke()
      }
      break
    case 'schatz': {
      // Schatzhueter: Goldschuppen mit eingesetzten Edelsteinen, dazwischen Muenzen; ein Glanz laeuft durch
      L.lineCap = 'round'
      for (const p of pr) {
        const r = raster(p, 0.24)
        if (r <= 0) continue
        L.strokeStyle = r % 2 ? 'rgba(120, 70, 10, 0.35)' : 'rgba(255, 240, 170, 0.4)'
        quer(L, p, 0.55, cell * 0.035, r % 2 ? 0.35 : -0.35)
      }
      for (const p of pr) {
        const r = raster(p, 0.5)
        if (r <= 0) continue
        const q = r % 2 ? 0.28 : -0.28
        const x = p.x + p.nx * p.w * q
        const y = p.y + p.ny * p.w * q
        if (r % 3 === 0) {
          // Muenze mit Rand
          L.fillStyle = '#FFE08A'
          L.beginPath()
          L.arc(x, y, p.w * 0.12, 0, TAU)
          L.fill()
          L.strokeStyle = 'rgba(150, 90, 10, 0.7)'
          L.lineWidth = Math.max(1, cell * 0.025)
          L.stroke()
          continue
        }
        // Edelstein (Rubin, Smaragd, Saphir) in Goldfassung, funkelt nacheinander
        const f = ex[(r + Math.floor(r / 3)) % ex.length] ?? [230, 40, 80]
        const rr = p.w * 0.15
        L.fillStyle = 'rgba(150, 90, 10, 0.8)'
        L.beginPath()
        L.arc(x, y, rr * 1.25, 0, TAU)
        L.fill()
        L.fillStyle = rgb(f)
        L.beginPath()
        L.moveTo(x, y - rr)
        L.lineTo(x + rr, y)
        L.lineTo(x, y + rr)
        L.lineTo(x - rr, y)
        L.fill()
        const fu = Math.max(0, Math.sin(welle(now, 1800) + r * 1.9))
        L.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.6 * fu})`
        L.fillRect(x - rr * 0.35, y - rr * 0.5, rr * 0.32, rr * 0.32)
      }
      const lang = pr.length ? pr[pr.length - 1].s : 6
      const pos = ((now % 2400) / 2400) * (Math.min(lang, 8) + 1.6) - 0.8
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const d = Math.abs(p.s - pos)
        if (d > 0.6) continue
        L.strokeStyle = `rgba(255, 250, 220, ${0.5 * (1 - d / 0.6)})`
        quer(L, p, 0.6, cell * 0.18)
      }
      break
    }
    case 'golem': {
      // Steingolem: Steinplatten mit Fugen, Moos, und gluehende Runenrisse, die langsam pulsieren
      L.lineCap = 'round'
      for (const p of pr) {
        const r = raster(p, 0.36)
        if (r <= 0) continue
        L.strokeStyle = 'rgba(30, 26, 22, 0.55)'
        quer(L, p, 0.6, cell * 0.05, (hash(r) - 0.5) * 0.6)
      }
      const glut = ex[0] ?? [255, 150, 50]
      const moos = ex[1] ?? [92, 136, 66]
      for (const p of pr) {
        const r = raster(p, 0.36)
        if (r <= 0) continue
        // Moos auf jeder dritten Platte
        if (r % 3 === 1) {
          L.fillStyle = rgb(moos, 0.85)
          punkt(L, p, (hash(r * 5) - 0.5) * 0.7, cell * 0.1, p.w * 0.12)
          punkt(L, p, (hash(r * 5) - 0.5) * 0.7 + 0.15, cell * 0.16, p.w * 0.07)
        }
        // Runenriss: Zickzack quer ueber die Platte, gluehend
        if (r % 2 === 0) {
          const puls = 0.45 + 0.55 * Math.max(0, Math.sin(welle(now, 2200) - p.s * 1.4))
          const q0 = (hash(r) - 0.5) * 0.5
          const a = { x: p.x + p.nx * p.w * (q0 - 0.3) + p.tx * cell * 0.12, y: p.y + p.ny * p.w * (q0 - 0.3) + p.ty * cell * 0.12 }
          const m = { x: p.x + p.nx * p.w * q0 - p.tx * cell * 0.05, y: p.y + p.ny * p.w * q0 - p.ty * cell * 0.05 }
          const b = { x: p.x + p.nx * p.w * (q0 + 0.3) + p.tx * cell * 0.1, y: p.y + p.ny * p.w * (q0 + 0.3) + p.ty * cell * 0.1 }
          L.strokeStyle = rgb(glut, 0.25 * puls)
          L.lineWidth = cell * 0.14
          L.beginPath()
          L.moveTo(a.x, a.y)
          L.lineTo(m.x, m.y)
          L.lineTo(b.x, b.y)
          L.stroke()
          L.strokeStyle = rgb(mix(glut, [255, 255, 255], 0.35), 0.5 + 0.5 * puls)
          L.lineWidth = Math.max(1, cell * 0.04)
          L.stroke()
        }
      }
      break
    }
    case 'waldgeist': {
      // Waldgeist: Rinde mit Maserung laengs, Moosflecken, an den Seiten spriessen Blaetter, die im Wind wippen
      const moos = ex[0] ?? [96, 156, 70]
      const hell = ex[1] ?? [168, 222, 120]
      const herbst = ex[2] ?? [214, 120, 40]
      L.lineCap = 'round'
      // Maserung: kurze, versetzte Striche laengs
      for (const p of pr) {
        const r = raster(p, 0.2, 0.03)
        if (r <= 0) continue
        for (const q of [-0.45, 0, 0.45]) {
          const v = q + (hash(r * 3 + q * 10) - 0.5) * 0.2
          L.strokeStyle = 'rgba(40, 24, 12, 0.45)'
          L.lineWidth = cell * 0.035
          L.beginPath()
          L.moveTo(p.x + p.nx * p.w * v - p.tx * cell * 0.09, p.y + p.ny * p.w * v - p.ty * cell * 0.09)
          L.lineTo(p.x + p.nx * p.w * v + p.tx * cell * 0.09, p.y + p.ny * p.w * v + p.ty * cell * 0.09)
          L.stroke()
        }
      }
      for (const p of pr) {
        const r = raster(p, 0.5)
        if (r <= 0) continue
        // Moos auf jeder zweiten Stelle
        if (r % 2 === 0) {
          L.fillStyle = rgb(moos, 0.9)
          punkt(L, p, (hash(r * 5) - 0.5) * 0.6, 0, p.w * 0.16)
          punkt(L, p, (hash(r * 5) - 0.5) * 0.6 + 0.18, cell * 0.08, p.w * 0.1)
        }
        // Blatt an der Seite, abwechselnd links und rechts, wippt
        const seite = r % 2 ? 1 : -1
        const wipp = Math.sin(welle(now, 1800) + r * 0.9) * 0.35
        const bx = p.x + p.nx * p.w * 0.3 * seite
        const by = p.y + p.ny * p.w * 0.3 * seite
        // Schraeg nach hinten aussen (wie Blaetter an einem Zweig)
        const w = Math.atan2(p.ny * seite * 0.7 - p.ty * 0.7, p.nx * seite * 0.7 - p.tx * 0.7) + wipp * 0.6
        const lr = p.w * 0.62
        L.save()
        L.translate(bx, by)
        L.rotate(w)
        L.fillStyle = rgb(r % 5 === 0 ? herbst : hell)
        L.beginPath()
        L.moveTo(0, 0)
        L.quadraticCurveTo(lr * 0.5, -lr * 0.4, lr, 0)
        L.quadraticCurveTo(lr * 0.5, lr * 0.4, 0, 0)
        L.fill()
        L.strokeStyle = rgb(moos, 0.8)
        L.lineWidth = Math.max(0.5, cell * 0.02)
        L.beginPath()
        L.moveTo(0, 0)
        L.lineTo(lr * 0.85, 0)
        L.stroke()
        L.restore()
      }
      break
    }
    case 'pharao':
      // Gold mit Lapislazuli-Baendern, schmal gesaeumt
      for (const p of pr) {
        if (p.s < 0.25) continue
        const t = p.s % 0.55
        if (t < 0.2) {
          L.strokeStyle = rgb(ex[0] ?? [32, 66, 170])
          quer(L, p, 0.6, cell * 0.1)
        } else if (t < 0.25 || t > 0.5) {
          L.strokeStyle = rgb(ex[1] ?? [255, 244, 190])
          quer(L, p, 0.6, cell * 0.05)
        }
      }
      break
    case 'facetten': {
      // Kristall: schraege Facetten hell und dunkel, ein Lichtband laeuft durch
      L.lineCap = 'round'
      for (const p of pr) {
        const r = raster(p, 0.3)
        if (r <= 0) continue
        L.strokeStyle = r % 2 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(40, 0, 70, 0.35)'
        quer(L, p, 0.6, cell * 0.05, r % 2 ? 0.6 : -0.6)
      }
      const lang = pr.length ? pr[pr.length - 1].s : 6
      const pos = ((now % 2000) / 2000) * (Math.min(lang, 8) + 1.6) - 0.8
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const d = Math.abs(p.s - pos)
        if (d > 0.6) continue
        L.strokeStyle = `rgba(255, 240, 255, ${0.55 * (1 - d / 0.6)})`
        quer(L, p, 0.6, cell * 0.18)
      }
      break
    }
    case 'schemen':
      // Nachtmahr: Schwaden ziehen ueber den Koerper, dazu fahle gruene Lichter
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const v = 0.5 + 0.5 * Math.sin(p.s * 3 - welle(now, 3000))
        L.strokeStyle = `rgba(190, 150, 255, ${0.06 + 0.3 * v * v})`
        quer(L, p, 0.45, cell * 0.18)
      }
      for (const p of pr) {
        const r = raster(p, 0.7)
        if (r <= 0) continue
        const puls = 0.5 + 0.5 * Math.sin(welle(now, 1500) + r * 2)
        L.fillStyle = rgb(ex[0] ?? [150, 255, 170], 0.4 + 0.5 * puls)
        punkt(L, p, (hash(r) - 0.5) * 0.6, 0, p.w * 0.06)
      }
      break
    case 'streifen':
      L.strokeStyle = ex[0] ? rgb(ex[0], 0.85) : 'rgba(40, 22, 10, 0.75)'
      L.lineCap = 'round'
      for (const p of pr) if (raster(p, 0.62) > 0) quer(L, p, 0.42, cell * 0.11, 0.15)
      break
    case 'punkte':
      L.fillStyle = ex[0] ? rgb(ex[0], 0.9) : 'rgba(70, 40, 15, 0.8)'
      for (const p of pr) {
        const r = raster(p, 0.5)
        if (r > 0) punkt(L, p, (hash(r) - 0.5) * 0.7, 0, p.w * (0.12 + hash(r + 9) * 0.07))
      }
      break
    case 'polka':
      L.fillStyle = 'rgba(255,255,255,0.92)'
      for (const p of pr) {
        const r = raster(p, 0.33)
        if (r > 0) punkt(L, p, r % 2 ? -0.28 : 0.28, 0, p.w * 0.12)
      }
      break
    case 'ringe':
      L.strokeStyle = c0
      for (const p of pr) if (p.s > 0.35 && p.s % 0.5 < 0.22) quer(L, p, 0.6, cell * 0.12)
      break
    case 'diagonal':
      L.strokeStyle = c0
      L.lineCap = 'round'
      for (const p of pr) if (raster(p, 0.4) > 0) quer(L, p, 0.6, cell * 0.11, 0.5)
      break
    case 'flecken':
      L.fillStyle = c0
      for (const p of pr) {
        const r = raster(p, 0.7)
        if (r <= 0) continue
        punkt(L, p, (hash(r) - 0.5) * 0.9, 0, p.w * (0.22 + hash(r + 5) * 0.12))
        punkt(L, p, (hash(r) - 0.5) * 0.9 + 0.15, cell * 0.12, p.w * 0.16)
      }
      break
    case 'python':
      for (const p of pr) {
        const r = raster(p, 0.55)
        if (r < 0) continue
        const q = r % 2 ? 0.3 : -0.3
        L.fillStyle = rgb(ex[0])
        punkt(L, p, q, 0, p.w * 0.26)
        L.fillStyle = rgb(ex[1])
        punkt(L, p, q, 0, p.w * 0.15)
        L.fillStyle = rgb(ex[0], 0.7)
        punkt(L, p, -q * 1.4, cell * 0.1, p.w * 0.1)
      }
      break
    case 'otter':
      for (const p of pr) {
        const t = p.s % 1.2
        if (p.s < 0.3) continue
        if (t < 0.18 || (t > 0.42 && t < 0.6)) L.strokeStyle = rgb(ex[0])
        else if (t >= 0.18 && t < 0.42) L.strokeStyle = rgb(ex[1])
        else continue
        quer(L, p, 0.6, cell * 0.11)
      }
      break
    case 'camo':
      for (const p of pr) {
        const r = raster(p, 0.22)
        if (r < 0) continue
        L.fillStyle = rgb(ex[r % 3])
        punkt(L, p, (hash(r * 3.3) - 0.5) * 1.1, 0, p.w * (0.18 + hash(r) * 0.14))
      }
      break
    case 'melone':
      L.strokeStyle = c0
      L.lineWidth = cell * 0.07
      for (const q of [-0.32, 0, 0.32]) {
        L.beginPath()
        pr.forEach((p, i) => {
          const z = q + Math.sin(p.s * 9) * 0.07
          if (i) L.lineTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
          else L.moveTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
        })
        L.stroke()
      }
      break
    case 'giraffe':
      L.fillStyle = c0
      for (const p of pr) {
        const r = raster(p, 0.36)
        if (r < 0) continue
        for (const q of [-0.3, 0.3]) {
          L.beginPath()
          const cx = p.x + p.nx * p.w * (q + (hash(r + q) - 0.5) * 0.15)
          const cy = p.y + p.ny * p.w * (q + (hash(r + q) - 0.5) * 0.15)
          for (let i = 0; i < 6; i++) {
            const an = (i / 6) * TAU + hash(r) * 2
            const rr = p.w * (0.15 + hash(r * 7 + i) * 0.05)
            L.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr)
          }
          L.fill()
        }
      }
      break
    case 'schach':
      L.strokeStyle = c0
      for (const p of pr) {
        const r = Math.floor(p.s / 0.3)
        for (const q of [-1, 1]) {
          if ((r + (q > 0 ? 1 : 0)) % 2 === 0) continue
          L.lineWidth = p.w * 0.5
          L.beginPath()
          L.moveTo(p.x + p.nx * p.w * 0.25 * q, p.y + p.ny * p.w * 0.25 * q)
          L.lineTo(p.x + p.nx * p.w * 0.25 * q - p.tx * cell * 0.1, p.y + p.ny * p.w * 0.25 * q - p.ty * cell * 0.1)
          L.stroke()
        }
      }
      break
    case 'holz': {
      // Maserung laengs, ein paar Aeste (Knoten), am Schwanzende eine Schnittflaeche mit Jahresringen
      L.strokeStyle = rgb(ex[0], 0.5)
      L.lineCap = 'round'
      for (const [q, dicke] of [[-0.38, 0.022], [-0.22, 0.03], [-0.05, 0.02], [0.12, 0.028], [0.28, 0.022], [0.42, 0.018]] as const) {
        L.lineWidth = cell * dicke
        L.beginPath()
        pr.forEach((p, i) => {
          const r = Math.round(p.s / 1.7)
          const knoten = Math.abs(p.s - r * 1.7 - 0.6) < 0.3 ? (0.3 - Math.abs(p.s - r * 1.7 - 0.6)) * 0.55 * Math.sign(q - (hash(r) - 0.5) * 0.6) : 0
          const z = q + Math.sin(p.s * 2.3 + q * 7) * 0.04 + knoten
          if (i) L.lineTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
          else L.moveTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
        })
        L.stroke()
      }
      L.fillStyle = rgb(ex[0], 0.75)
      for (const p of pr) {
        const r = raster(p, 1.7)
        if (r <= 0) continue
        const q = (hash(r) - 0.5) * 0.6
        L.beginPath()
        L.ellipse(p.x + p.tx * cell * -0.6 + p.nx * p.w * q, p.y + p.ty * cell * -0.6 + p.ny * p.w * q, cell * 0.08, cell * 0.05, Math.atan2(p.ty, p.tx), 0, TAU)
        L.fill()
      }
      if (ende) {
        // Schnittflaeche wie ein Baumstumpf: helles Holz mit Ringen und Rinde
        const w0 = pr.length ? pr[pr.length - 1].w : cell * 0.6
        L.save()
        L.translate(ende.x, ende.y)
        L.rotate(Math.atan2(ende.ty, ende.tx))
        L.fillStyle = rgb(ex[1])
        L.beginPath()
        L.ellipse(0, 0, w0 * 0.3, w0 * 0.48, 0, 0, TAU)
        L.fill()
        L.strokeStyle = rgb(ex[0], 0.6)
        L.lineWidth = Math.max(0.8, cell * 0.02)
        for (const k of [0.33, 0.62, 0.88]) {
          L.beginPath()
          L.ellipse(-w0 * 0.02, 0, w0 * 0.3 * k, w0 * 0.48 * k, 0, 0, TAU)
          L.stroke()
        }
        L.strokeStyle = rgb(ex[0])
        L.lineWidth = Math.max(1, cell * 0.04)
        L.beginPath()
        L.ellipse(0, 0, w0 * 0.3, w0 * 0.48, 0, 0, TAU)
        L.stroke()
        L.restore()
      }
      break
    }
    case 'schuppen':
      L.strokeStyle = rgb(ex[0], 0.55)
      L.lineWidth = cell * 0.03
      for (const p of pr) {
        const r = raster(p, 0.2)
        if (r < 0) continue
        const an = Math.atan2(p.ty, p.tx)
        for (let q = -2; q <= 2; q++) {
          const z = (q + (r % 2) * 0.5) * 0.2
          if (Math.abs(z) > 0.45) continue
          L.beginPath()
          L.arc(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z, cell * 0.085, an + Math.PI / 2, an + Math.PI * 1.5)
          L.stroke()
        }
      }
      break
    case 'sterne':
      for (const p of pr) {
        const r = raster(p, 0.22)
        if (r < 0) continue
        const tw = 0.5 + 0.5 * Math.sin(welle(now, 2000) + r * 1.7)
        L.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * tw})`
        punkt(L, p, (hash(r) - 0.5) * 0.8, 0, cell * (0.03 + 0.03 * tw))
      }
      break
    case 'glut':
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const v = 0.5 + 0.5 * Math.sin(welle(now, 1000) - p.s * 4)
        L.strokeStyle = `rgba(255, 230, 120, ${0.12 + 0.45 * v * (1 - p.k)})`
        quer(L, p, 0.25, cell * 0.2)
      }
      break
    case 'funkeln':
      L.strokeStyle = ex[0] ? rgb(ex[0]) : '#fff'
      L.lineWidth = Math.max(1, cell * 0.035)
      L.lineCap = 'round'
      for (const p of pr) {
        const r = raster(p, 0.35)
        if (r < 0) continue
        const tw = Math.max(0, Math.sin(welle(now, 1500) + r * 2.1))
        if (tw < 0.3) continue
        const rr = cell * 0.12 * tw
        const x = p.x + p.nx * p.w * (hash(r) - 0.5) * 0.7
        const y = p.y + p.ny * p.w * (hash(r) - 0.5) * 0.7
        L.beginPath()
        L.moveTo(x - rr, y)
        L.lineTo(x + rr, y)
        L.moveTo(x, y - rr)
        L.lineTo(x, y + rr)
        L.stroke()
      }
      break
    case 'blubber':
      for (const p of pr) {
        const r = raster(p, 0.4)
        if (r < 0) continue
        const z = (now / 1500 + hash(r)) % 1
        L.strokeStyle = `rgba(235,255,170,${0.9 * (1 - z)})`
        L.lineWidth = cell * 0.03
        L.beginPath()
        L.arc(p.x + p.nx * p.w * (hash(r) - 0.5) * 0.6, p.y + p.ny * p.w * (hash(r) - 0.5) * 0.6, cell * 0.11 * z + 1, 0, TAU)
        L.stroke()
        L.fillStyle = 'rgba(30,90,10,0.5)'
        punkt(L, p, (hash(r + 3) - 0.5) * 0.7, 0, p.w * 0.08)
      }
      break
    case 'glanz': {
      // Glanz laeuft alle 2 s vom Kopf zum Schwanz, im Shop genau einmal ueber die Vorschau
      const lang = pr.length ? pr[pr.length - 1].s : 6
      const pos = ((now % 2000) / 2000) * (Math.min(lang, 8) + 1.6) - 0.8
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const d = Math.abs(p.s - pos)
        if (d > 0.7) continue
        L.strokeStyle = `rgba(255, 252, 230, ${0.6 * (1 - d / 0.7)})`
        quer(L, p, 0.6, cell * 0.2)
      }
      break
    }
    case 'perle':
    case 'chrom':
    case 'opal':
      for (let i = 0; i < pr.length - 2; i += 2) {
        const p = pr[i]
        const v = Math.sin(p.s * 2.2 - welle(now, 3000))
        if (m.art === 'opal') L.strokeStyle = `hsla(${(p.s * 70 + (now % 6000) * 0.06) % 360}, 90%, 75%, 0.5)`
        else if (m.art === 'perle') L.strokeStyle = `hsla(${280 + v * 60}, 70%, 85%, ${0.25 + 0.2 * v})`
        else L.strokeStyle = `rgba(255,255,255,${Math.max(0, v) * 0.55})`
        L.lineWidth = p.w * 0.42
        L.beginPath()
        L.moveTo(p.x - p.nx * p.w * 0.12, p.y - p.ny * p.w * 0.12)
        L.lineTo(pr[i + 2].x - p.nx * p.w * 0.12, pr[i + 2].y - p.ny * p.w * 0.12)
        L.stroke()
      }
      break
    case 'neon':
      L.strokeStyle = 'rgba(255,255,255,0.05)'
      for (const p of pr) if (raster(p, 0.3) >= 0) quer(L, p, 0.5, 1)
      break
    case 'lava':
      L.lineCap = 'round'
      for (let j = 0; j < 3; j++) {
        L.beginPath()
        pr.forEach((p, i) => {
          const z = (j - 1) * 0.28 + Math.sin(p.s * 5 + j * 2) * 0.12 + (hash(Math.floor(p.s * 3) + j * 50) - 0.5) * 0.1
          if (i) L.lineTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
          else L.moveTo(p.x + p.nx * p.w * z, p.y + p.ny * p.w * z)
        })
        const v = 0.5 + 0.5 * Math.sin(welle(now, 2000) + j * 2)
        L.strokeStyle = `rgba(255, ${120 + 80 * v}, 30, ${0.6 + 0.4 * v})`
        L.shadowColor = '#FF6A00'
        L.shadowBlur = cell * 0.25 * dpr
        L.lineWidth = cell * 0.045
        L.stroke()
      }
      L.shadowBlur = 0
      break
    case 'matrix':
      L.font = `700 ${Math.round(cell * 0.2)}px monospace`
      L.textAlign = 'center'
      L.textBaseline = 'middle'
      for (const p of pr) {
        const r = raster(p, 0.2)
        if (r < 0) continue
        for (const q of [-0.28, 0, 0.28]) {
          const h = (((now % 6000) / 90 - r * 1.5 + q * 30) % 14 + 14) % 14
          const b = Math.max(0, 1 - h / 8)
          L.fillStyle = `rgba(${b > 0.9 ? 220 : 60}, 255, ${b > 0.9 ? 220 : 90}, ${0.2 + 0.8 * b})`
          L.fillText(String.fromCharCode(0x30a0 + Math.floor(hash(r * 3 + q * 7 + Math.floor(now / 400)) * 60)), p.x + p.nx * p.w * q, p.y + p.ny * p.w * q)
        }
      }
      break
    case 'holo': {
      // Bildzeilen, dazu laeuft alle 3 s ein heller Stoerstreifen quer durch (wie bei einer Hologramm-Projektion)
      const mt = L.getTransform()
      L.save()
      L.setTransform(1, 0, 0, 1, 0, 0)
      L.fillStyle = 'rgba(255,255,255,0.22)'
      const st = Math.max(2, Math.round(2.5 * dpr))
      const off = Math.floor((now % 6000) / 40) % (st * 2)
      for (let y = -st * 2 + off; y < L.canvas.height; y += st * 2) L.fillRect(0, y, L.canvas.width, st)
      L.restore()
      L.setTransform(mt)
      const z = (now % 3000) / 3000
      if (z < 0.4 && pr.length) {
        // Streifen von links nach rechts (im Bild), quer ueber die ganze Schlange
        let xa = Infinity
        let xb = -Infinity
        for (const p of pr) {
          xa = Math.min(xa, p.x)
          xb = Math.max(xb, p.x)
        }
        const x = xa - cell + (z / 0.4) * (xb - xa + cell * 2)
        const g = L.createLinearGradient(x - cell * 0.6, 0, x + cell * 0.6, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.5, 'rgba(220,255,255,0.85)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        L.fillStyle = g
        L.fillRect(x - cell * 0.6, -1e5, cell * 1.2, 2e5)
      }
      L.strokeStyle = 'rgba(255, 120, 255, 0.3)'
      for (const p of pr) if (Math.abs((((p.s - (now % 6000) / 500) % 1.5) + 1.5) % 1.5 - 0.2) < 0.05) quer(L, p, 0.6, cell * 0.16)
      break
    }
    case 'blitz': {
      // Wolken: weiche, mehrlagige Bauschen, die langsam ziehen
      for (const p of pr) {
        const r = raster(p, 0.38)
        if (r < 0) continue
        const zieh = Math.sin(welle(now, 6000) + r) * cell * 0.06
        const q = (hash(r) - 0.5) * 0.5
        for (const [dq, dl, rr, a] of [[0, 0, 0.32, 0.22], [0.18, 0.12, 0.22, 0.28], [-0.15, -0.1, 0.24, 0.25], [0.05, 0.05, 0.15, 0.35]] as const) {
          L.fillStyle = `rgba(${200 + a * 100}, ${206 + a * 90}, 235, ${a})`
          punkt(L, p, q + dq, dl * cell + zieh, p.w * rr)
        }
      }
      // Grosser Blitz zweimal je 1,5 s durch den ganzen Koerper (die Wolken leuchten mit auf),
      // dazwischen zucken immer wieder kleine Blitze quer ueber einzelne Glieder
      const z = (now % 1500) / 1500
      const takt = Math.floor(now / 750)
      if ((z < 0.16 || (z > 0.5 && z < 0.6)) && Math.floor(now / 50) % 2 === 0) {
        L.fillStyle = 'rgba(255, 250, 210, 0.28)'
        L.fillRect(-1e5, -1e5, 2e5, 2e5)
        L.strokeStyle = '#FFF8C0'
        L.shadowColor = '#FFF59A'
        L.shadowBlur = cell * 0.3 * dpr
        L.lineWidth = cell * 0.055
        for (const ver of [0, 0.35]) {
          L.beginPath()
          pr.forEach((p, i) => {
            if (i % 3) return
            const zz = (hash(i + takt * 13 + ver * 7) - 0.5) * 0.75
            L.lineTo(p.x + p.nx * p.w * zz, p.y + p.ny * p.w * zz)
          })
          L.stroke()
          L.lineWidth = cell * 0.03
        }
        L.shadowBlur = 0
      }
      const klein = Math.floor(now / 110)
      L.strokeStyle = 'rgba(255, 250, 200, 0.9)'
      L.lineWidth = Math.max(1, cell * 0.03)
      for (let k = 0; k < 3; k++) {
        if (hash(klein * 5 + k) < 0.45 || !pr.length) continue
        const p = pr[Math.floor(hash(klein * 3 + k * 11) * pr.length)]
        L.beginPath()
        L.moveTo(p.x - p.nx * p.w * 0.45, p.y - p.ny * p.w * 0.45)
        L.lineTo(p.x + p.tx * cell * 0.08 - p.nx * p.w * 0.1, p.y + p.ty * cell * 0.08 - p.ny * p.w * 0.1)
        L.lineTo(p.x - p.tx * cell * 0.06 + p.nx * p.w * 0.12, p.y - p.ty * cell * 0.06 + p.ny * p.w * 0.12)
        L.lineTo(p.x + p.nx * p.w * 0.45, p.y + p.ny * p.w * 0.45)
        L.stroke()
      }
      break
    }
    case 'plasma': {
      // Lila Plasma: wandernde helle Schlieren, dazu verzweigte Blitze im Koerper
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const v = 0.5 + 0.5 * Math.sin(p.s * 3.1 - welle(now, 1500) * 2)
        L.strokeStyle = `rgba(230, 170, 255, ${0.1 + 0.3 * v})`
        quer(L, p, 0.35, cell * 0.2)
      }
      L.lineCap = 'round'
      L.shadowColor = '#E2B6FF'
      L.shadowBlur = cell * 0.2 * dpr
      for (let b = 0; b < 2; b++) {
        const takt = Math.floor(now / 200) + b * 17
        if (hash(takt) < 0.35) continue
        const lang = pr.length ? pr[pr.length - 1].s : 1
        const start = hash(takt * 3) * Math.max(0.1, lang - 1.5)
        L.strokeStyle = 'rgba(250, 235, 255, 0.95)'
        L.lineWidth = cell * 0.04
        L.beginPath()
        let erst = true
        for (const p of pr) {
          if (p.s < start || p.s > start + 1.4) continue
          const z = (hash(Math.round(p.s * 6) + takt * 31) - 0.5) * 0.75
          const x = p.x + p.nx * p.w * z
          const y = p.y + p.ny * p.w * z
          if (erst) L.moveTo(x, y)
          else L.lineTo(x, y)
          erst = false
        }
        L.stroke()
      }
      L.shadowBlur = 0
      break
    }
    case 'feuer':
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const v = 0.5 + 0.5 * Math.sin(welle(now, 750) - p.s * 6)
        L.strokeStyle = `rgba(255, 240, 150, ${0.15 + 0.35 * v})`
        quer(L, p, 0.2, cell * 0.16)
      }
      break
    case 'phoenix':
      L.strokeStyle = 'rgba(255, 240, 180, 0.6)'
      L.lineWidth = cell * 0.04
      L.lineCap = 'round'
      for (const p of pr) {
        if (raster(p, 0.28) < 0) continue
        for (const q of [-1, 1]) {
          L.beginPath()
          L.moveTo(p.x + p.nx * p.w * 0.05 * q, p.y + p.ny * p.w * 0.05 * q)
          L.lineTo(p.x + p.nx * p.w * 0.45 * q - p.tx * cell * 0.18, p.y + p.ny * p.w * 0.45 * q - p.ty * cell * 0.18)
          L.stroke()
        }
      }
      break
    case 'geist':
      for (let i = 0; i < pr.length; i += 2) {
        const p = pr[i]
        const v = Math.sin(p.s * 4 - welle(now, 1500))
        L.strokeStyle = `rgba(160, 180, 255, ${0.15 + 0.15 * v})`
        quer(L, p, 0.6, cell * 0.16)
      }
      break
    case 'glitch':
      for (const p of pr) {
        const r = Math.floor(p.s / 0.25)
        const z = hash(r + Math.floor(now / 200) * 31)
        if (z < 0.55) continue
        L.strokeStyle = z > 0.85 ? 'rgba(0,255,240,0.85)' : z > 0.72 ? 'rgba(255,0,90,0.85)' : 'rgba(255,255,255,0.6)'
        quer(L, p, 0.6, cell * 0.07)
      }
      break
    case 'drache':
      L.strokeStyle = 'rgba(10, 40, 15, 0.6)'
      L.lineWidth = cell * 0.03
      for (const p of pr) {
        const r = raster(p, 0.18)
        if (r < 0) continue
        const an = Math.atan2(p.ty, p.tx)
        for (const q of [-0.3, 0, 0.3]) {
          L.beginPath()
          L.arc(p.x + p.nx * p.w * (q + (r % 2) * 0.15), p.y + p.ny * p.w * (q + (r % 2) * 0.15), cell * 0.08, an + Math.PI / 2, an + Math.PI * 1.5)
          L.stroke()
        }
      }
      L.fillStyle = '#E6C24A'
      for (const p of pr) {
        if (raster(p, 0.3) < 0 || p.s < 0.4) continue
        const g = cell * 0.12 * (1 - p.k * 0.5)
        L.beginPath()
        L.moveTo(p.x + p.tx * g, p.y + p.ty * g)
        L.lineTo(p.x + p.nx * g * 0.6 - p.tx * g, p.y + p.ny * g * 0.6 - p.ty * g)
        L.lineTo(p.x - p.nx * g * 0.6 - p.tx * g, p.y - p.ny * g * 0.6 - p.ty * g)
        L.fill()
      }
      break
    case 'void':
      for (const p of pr) {
        const r = raster(p, 0.15)
        if (r < 0) continue
        const z = ((now % 6000) / 1200 + hash(r)) % 1
        L.fillStyle = `rgba(${200 + 55 * z}, ${180 - 100 * z}, 255, ${0.9 - z * 0.6})`
        punkt(L, p, (hash(r * 3) - 0.5) * 0.9 * (1 - z), cell * 0.2 * (1 - z), cell * 0.025)
      }
      L.strokeStyle = 'rgba(170, 90, 255, 0.5)'
      L.lineWidth = cell * 0.05
      L.beginPath()
      pr.forEach((p, i) => (i ? L.lineTo(p.x + p.nx * p.w * 0.45, p.y + p.ny * p.w * 0.45) : L.moveTo(p.x + p.nx * p.w * 0.45, p.y + p.ny * p.w * 0.45)))
      L.stroke()
      break
  }
}

function pixelKoerper(L: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number, m: Muster) {
  const g = cell / 5
  const fertig = new Set<number>()
  const pal = ['#5BD16A', '#3BA853', '#2E7F44', '#8BF28F']
  for (const p of pr) {
    const r = p.w / 2
    for (let y = Math.floor((p.y - r) / g); y <= Math.floor((p.y + r) / g); y++)
      for (let x = Math.floor((p.x - r) / g); x <= Math.floor((p.x + r) / g); x++) {
        const k = x * 100_003 + y
        if (fertig.has(k)) continue
        if (Math.hypot((x + 0.5) * g - p.x, (y + 0.5) * g - p.y) > r) continue
        fertig.add(k)
        L.fillStyle = p.k < 0.05 ? rgb(m.kopf) : pal[Math.floor(hash(x * 13 + y * 7 + Math.floor(now / 250 + p.s)) * pal.length)]
        L.fillRect(x * g, y * g, g + 0.3, g + 0.3)
      }
  }
}

function neonRand(ctx: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number) {
  const lang = pr.length ? pr[pr.length - 1].s : 4
  const pos = ((now % 2000) / 2000) * (Math.min(lang, 8) + 1) - 0.5
  ctx.lineWidth = cell * 0.05
  for (let i = 0; i < pr.length - 1; i++) {
    const p = pr[i]
    const d = Math.abs(p.s - pos)
    if (d > 0.6) continue
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - d / 0.6)})`
    for (const q of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(p.x + p.nx * p.w * 0.47 * q, p.y + p.ny * p.w * 0.47 * q)
      ctx.lineTo(pr[i + 1].x + p.nx * p.w * 0.47 * q, pr[i + 1].y + p.ny * p.w * 0.47 * q)
      ctx.stroke()
    }
  }
}

function feuer(ctx: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number, phoenix: boolean) {
  for (let j = 0; j < pr.length; j += 3) {
    const p = pr[j]
    for (let q = 0; q < 2; q++) {
      const z = ((now % 6000) / 750 + hash(j * 3 + q)) % 1
      const x = p.x + p.nx * p.w * (hash(j + q * 9) - 0.5) * 0.8
      const y = p.y - z * cell * 0.7 * (1 - p.k * 0.5)
      const r = cell * 0.15 * (1 - z) * (1 - p.k * 0.6)
      if (r <= 0.3) continue
      ctx.fillStyle = phoenix ? `rgba(255, ${200 - z * 120}, ${80 - z * 60}, ${0.75 * (1 - z)})` : `rgba(255, ${180 - z * 140}, 30, ${0.8 * (1 - z)})`
      ctx.beginPath()
      ctx.moveTo(x, y - r * 1.8)
      ctx.quadraticCurveTo(x + r, y, x, y + r)
      ctx.quadraticCurveTo(x - r, y, x, y - r * 1.8)
      ctx.fill()
    }
  }
}

function rauch(ctx: CanvasRenderingContext2D, hx: number, hy: number, ang: number, cell: number, now: number) {
  for (let i = 0; i < 4; i++) {
    const z = ((now % 6000) / 1200 + i / 4) % 1
    const x = hx + Math.cos(ang) * cell * (0.45 + z * 0.8) + Math.sin(i * 2 + now / 300) * cell * 0.05
    const y = hy + Math.sin(ang) * cell * (0.45 + z * 0.8) - z * cell * 0.3
    ctx.fillStyle = `rgba(200, 200, 200, ${0.5 * (1 - z)})`
    ctx.beginPath()
    ctx.arc(x, y, cell * (0.06 + z * 0.14), 0, TAU)
    ctx.fill()
  }
}

export function herz(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, s * 0.35)
  ctx.bezierCurveTo(-s * 1.1, -s * 0.4, -s * 0.4, -s * 1.05, 0, -s * 0.4)
  ctx.bezierCurveTo(s * 0.4, -s * 1.05, s * 1.1, -s * 0.4, 0, s * 0.35)
  ctx.fill()
}
export function stern(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? s * 0.45 : s
    const an = (i / 10) * TAU - Math.PI / 2
    ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r)
  }
  ctx.fill()
}

/* ---------- Accessoires am Kopf (vorne = +x, rechts = +y) ---------- */

function brille(ctx: CanvasRenderingContext2D, cell: number, r: number, fuell: string, rand: string, eckig: boolean) {
  ctx.lineWidth = Math.max(1.2, cell * 0.04)
  for (const s of [-1, 1]) {
    ctx.fillStyle = fuell
    ctx.strokeStyle = rand
    ctx.beginPath()
    if (eckig) ctx.rect(cell * 0.12 - r, cell * 0.2 * s - r * 0.85, r * 2, r * 1.7)
    else ctx.arc(cell * 0.12, cell * 0.2 * s, r, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
  ctx.strokeStyle = rand
  ctx.beginPath()
  ctx.moveTo(cell * 0.12, -cell * 0.2 + r * 0.85)
  ctx.lineTo(cell * 0.12, cell * 0.2 - r * 0.85)
  ctx.stroke()
}

/** Fuenfzackiger Stern (fuer Hut-Deko) */
function sternForm(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const a = (i / 10) * TAU - Math.PI / 2
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.fill()
}

function accKopf(ctx: CanvasRenderingContext2D, id: string, cell: number, R: number, now: number) {
  ctx.lineWidth = Math.max(1.2, cell * 0.035)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (id) {
    case 'sonnenbrille':
      brille(ctx, cell, cell * 0.16, '#141820', '#141820', true)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(cell * 0.02, -cell * 0.3, cell * 0.06, cell * 0.04)
      ctx.fillRect(cell * 0.02, cell * 0.1, cell * 0.06, cell * 0.04)
      break
    case 'nerdbrille':
      brille(ctx, cell, cell * 0.17, 'rgba(200,230,255,0.25)', '#1C1C1C', true)
      break
    case 'herzbrille':
      // Herzglaeser, die Spitze zeigt nach vorne (in Blickrichtung)
      for (const s of [-1, 1]) {
        ctx.save()
        ctx.translate(cell * 0.11, cell * 0.2 * s)
        ctx.rotate(-Math.PI / 2)
        ctx.fillStyle = '#C2185B'
        herz(ctx, cell * 0.23)
        ctx.fillStyle = '#FF3D7F'
        herz(ctx, cell * 0.18)
        ctx.restore()
      }
      ctx.strokeStyle = '#C2185B'
      ctx.beginPath()
      ctx.moveTo(cell * 0.1, -cell * 0.08)
      ctx.lineTo(cell * 0.1, cell * 0.08)
      ctx.stroke()
      break
    case 'monokel':
      ctx.strokeStyle = '#D9B24A'
      ctx.fillStyle = 'rgba(220,240,255,0.25)'
      ctx.beginPath()
      ctx.arc(cell * 0.1, cell * 0.2, cell * 0.18, 0, TAU)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cell * 0.0, cell * 0.36)
      ctx.quadraticCurveTo(-cell * 0.3, cell * 0.5, -cell * 0.5, cell * 0.3)
      ctx.stroke()
      break
    case 'augenklappe':
      ctx.strokeStyle = '#111'
      ctx.beginPath()
      ctx.moveTo(-cell * 0.25, -cell * 0.38)
      ctx.lineTo(cell * 0.25, cell * 0.38)
      ctx.stroke()
      ctx.fillStyle = '#111'
      ctx.beginPath()
      ctx.ellipse(cell * 0.12, cell * 0.2, cell * 0.17, cell * 0.15, 0, 0, TAU)
      ctx.fill()
      break
    case 'skibrille': {
      const g = ctx.createLinearGradient(0, -cell * 0.35, 0, cell * 0.35)
      g.addColorStop(0, '#FF9A3C')
      g.addColorStop(0.5, '#E040FB')
      g.addColorStop(1, '#3D8BFF')
      ctx.strokeStyle = '#E63946'
      ctx.lineWidth = cell * 0.06
      ctx.beginPath()
      ctx.moveTo(cell * 0.1, -cell * 0.38)
      ctx.lineTo(-cell * 0.2, -R * 0.95)
      ctx.moveTo(cell * 0.1, cell * 0.38)
      ctx.lineTo(-cell * 0.2, R * 0.95)
      ctx.stroke()
      ctx.fillStyle = g
      ctx.strokeStyle = '#222'
      ctx.lineWidth = Math.max(1.2, cell * 0.035)
      ctx.beginPath()
      ctx.roundRect(-cell * 0.02, -cell * 0.38, cell * 0.28, cell * 0.76, cell * 0.12)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'thuglife': {
      // Pixel-Sonnenbrille wie "Thug Life": breiter Steg, Glaeser unten gestuft, weisse Glanzpixel.
      // Zeilen laufen nach vorne (+x), Spalten quer ueber den Kopf (y)
      const bild = ['XXXXXXXXXXXXXX', 'XXXXX.XX.XXXXX', '.XXX......XXX.', '..X........X..']
      const weiss = new Set(['1,1', '1,9', '2,2', '2,10'])
      const g = cell * 0.058
      const y0 = -(bild[0].length * g) / 2
      for (let r = 0; r < bild.length; r++)
        for (let c = 0; c < bild[r].length; c++) {
          if (bild[r][c] !== 'X') continue
          ctx.fillStyle = weiss.has(`${r},${c}`) ? '#FFFFFF' : '#0B0B0B'
          ctx.fillRect(-cell * 0.02 + r * g, y0 + c * g, g + 0.4, g + 0.4)
        }
      break
    }
    case 'laseraugen': {
      const v = 0.6 + 0.4 * Math.sin(welle(now, 500))
      for (const s of [-1, 1]) {
        ctx.strokeStyle = `rgba(255, 40, 40, ${0.5 * v})`
        ctx.lineWidth = cell * 0.12
        ctx.beginPath()
        ctx.moveTo(cell * 0.15, cell * 0.2 * s)
        ctx.lineTo(cell * 2.5, cell * 0.2 * s + s * cell * 0.15)
        ctx.stroke()
        ctx.strokeStyle = '#FFE0E0'
        ctx.lineWidth = cell * 0.035
        ctx.stroke()
        ctx.fillStyle = '#FF2B2B'
        ctx.beginPath()
        ctx.arc(cell * 0.12, cell * 0.2 * s, cell * 0.1, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'blumenkranz': {
      // Kranz aus kleinen Blueten mit Blaettern rund um den Kopf
      const fs = ['#FF8FB8', '#FFFFFF', '#FFD84A', '#B79CFF']
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU
        const x = -cell * 0.05 + Math.cos(a) * R * 0.62
        const y = Math.sin(a) * R * 0.62
        ctx.fillStyle = '#4E9A3C'
        ctx.beginPath()
        ctx.ellipse(x + Math.cos(a + 1.2) * cell * 0.07, y + Math.sin(a + 1.2) * cell * 0.07, cell * 0.06, cell * 0.03, a + 1.2, 0, TAU)
        ctx.fill()
        ctx.fillStyle = fs[i % fs.length]
        for (let k = 0; k < 5; k++) {
          const b = (k / 5) * TAU + i
          ctx.beginPath()
          ctx.arc(x + Math.cos(b) * cell * 0.045, y + Math.sin(b) * cell * 0.045, cell * 0.04, 0, TAU)
          ctx.fill()
        }
        ctx.fillStyle = '#F2A81D'
        ctx.beginPath()
        ctx.arc(x, y, cell * 0.025, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'nemes': {
      // Pharaonenhaube von oben: Tuch mit blau-goldenen Streifen, Laschen zu beiden Seiten, vorne die Kobra
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(R * 0.25, -R * 0.8)
      ctx.quadraticCurveTo(-R * 0.6, -R * 1.25, -R * 1.25, -R * 0.6)
      ctx.lineTo(-R * 1.25, R * 0.6)
      ctx.quadraticCurveTo(-R * 0.6, R * 1.25, R * 0.25, R * 0.8)
      ctx.quadraticCurveTo(R * 0.55, 0, R * 0.25, -R * 0.8)
      ctx.closePath()
      ctx.fillStyle = '#E9B83A'
      ctx.fill()
      ctx.clip()
      ctx.strokeStyle = '#2446A6'
      ctx.lineWidth = cell * 0.07
      for (let i = 1; i < 7; i++) {
        ctx.beginPath()
        ctx.arc(R * 0.45, 0, R * 0.32 * i, 0, TAU)
        ctx.stroke()
      }
      ctx.restore()
      ctx.strokeStyle = '#9A6E10'
      ctx.lineWidth = Math.max(1, cell * 0.03)
      ctx.beginPath()
      ctx.moveTo(R * 0.25, -R * 0.8)
      ctx.quadraticCurveTo(R * 0.55, 0, R * 0.25, R * 0.8)
      ctx.stroke()
      // Kobra vorne
      ctx.fillStyle = '#F4C64A'
      ctx.beginPath()
      ctx.ellipse(R * 0.42, 0, cell * 0.07, cell * 0.05, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#1F3F96'
      ctx.beginPath()
      ctx.arc(R * 0.45, 0, cell * 0.022, 0, TAU)
      ctx.fill()
      break
    }
    case 'pudelmuetze': {
      // Strickmuetze mit Ringen und dickem Bommel
      ctx.fillStyle = '#3768D6'
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 0.74, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#F4F6FA'
      ctx.lineWidth = cell * 0.07
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 0.64, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([cell * 0.05, cell * 0.05])
      ctx.lineWidth = cell * 0.04
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 0.42, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#FFFFFF'
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU
        ctx.beginPath()
        ctx.arc(-cell * 0.08 + Math.cos(a) * cell * 0.07, Math.sin(a) * cell * 0.07, cell * 0.06, 0, TAU)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(-cell * 0.08, 0, cell * 0.08, 0, TAU)
      ctx.fill()
      break
    }
    case 'grubenhelm': {
      // Gelber Helm, vorne eine Lampe; ihr Lichtkegel flackert leicht nach vorn
      const flacker = 0.75 + 0.25 * Math.sin(welle(now, 1000) * 3) * Math.sin(welle(now, 2000))
      const kegel = ctx.createLinearGradient(R * 0.6, 0, R * 0.6 + cell * 1.3, 0)
      kegel.addColorStop(0, `rgba(255, 240, 170, ${0.55 * flacker})`)
      kegel.addColorStop(1, 'rgba(255, 240, 170, 0)')
      ctx.fillStyle = kegel
      ctx.beginPath()
      ctx.moveTo(R * 0.6, -cell * 0.06)
      ctx.lineTo(R * 0.6 + cell * 1.3, -cell * 0.4)
      ctx.lineTo(R * 0.6 + cell * 1.3, cell * 0.4)
      ctx.lineTo(R * 0.6, cell * 0.06)
      ctx.fill()
      ctx.fillStyle = '#E3A812'
      ctx.beginPath()
      ctx.ellipse(-cell * 0.04, 0, R * 0.82, R * 0.88, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#F7C531'
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 0.66, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#C48A08'
      ctx.lineWidth = cell * 0.05
      ctx.beginPath()
      ctx.moveTo(-R * 0.7, 0)
      ctx.lineTo(R * 0.5, 0)
      ctx.stroke()
      ctx.fillStyle = '#8A8F98'
      ctx.beginPath()
      ctx.arc(R * 0.62, 0, cell * 0.09, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(255, 248, 200, ${0.7 + 0.3 * flacker})`
      ctx.beginPath()
      ctx.arc(R * 0.64, 0, cell * 0.06, 0, TAU)
      ctx.fill()
      break
    }
    case 'zauberhut': {
      // Breite Krempe, spitzer Hut nach hinten gebogen, Sterne funkeln
      ctx.fillStyle = '#262C78'
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 0.98, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#353EA6'
      ctx.beginPath()
      ctx.arc(-cell * 0.12, 0, R * 0.62, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#4651C6'
      ctx.beginPath()
      ctx.arc(-cell * 0.22, -cell * 0.04, R * 0.36, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#5A66DE'
      ctx.beginPath()
      ctx.arc(-cell * 0.3, -cell * 0.07, R * 0.15, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4
        const tw = Math.max(0, Math.sin(welle(now, 1500) + i * 1.9))
        ctx.fillStyle = `rgba(255, 228, 120, ${0.4 + 0.6 * tw})`
        sternForm(ctx, -cell * 0.06 + Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, cell * (0.04 + 0.03 * tw))
      }
      ctx.fillStyle = '#FFE680'
      ctx.beginPath()
      ctx.arc(-cell * 0.14, cell * 0.12, cell * 0.06, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#353EA6'
      ctx.beginPath()
      ctx.arc(-cell * 0.12, cell * 0.1, cell * 0.05, 0, TAU)
      ctx.fill()
      break
    }
    case 'hexenhut': {
      // Schwarze Krempe, lila Band mit goldener Schnalle, die Spitze knickt nach hinten
      ctx.fillStyle = '#1C1222'
      ctx.beginPath()
      ctx.arc(-cell * 0.06, 0, R * 1.02, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#7A3FA0'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.62, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#2A1A33'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.5, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#3A2546'
      ctx.beginPath()
      ctx.arc(-cell * 0.2, cell * 0.02, R * 0.3, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#3A2546'
      ctx.lineWidth = cell * 0.08
      ctx.beginPath()
      ctx.moveTo(-cell * 0.2, cell * 0.02)
      ctx.quadraticCurveTo(-cell * 0.42, cell * 0.06, -cell * 0.46, cell * 0.24)
      ctx.stroke()
      ctx.strokeStyle = '#E8C14A'
      ctx.lineWidth = Math.max(1, cell * 0.03)
      ctx.strokeRect(R * 0.4, -cell * 0.06, cell * 0.1, cell * 0.12)
      break
    }
    case 'partyhut': {
      // Kegel von oben: Kreis mit Rand, Streifen laufen zur Spitze, Bommel oben drauf
      ctx.fillStyle = '#4FC3F7'
      ctx.beginPath()
      ctx.arc(-cell * 0.04, 0, R * 0.66, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#FF5C8A'
      ctx.lineWidth = cell * 0.05
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        ctx.beginPath()
        ctx.moveTo(-cell * 0.04 + Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62)
        ctx.quadraticCurveTo(-cell * 0.04 + Math.cos(a + 0.6) * R * 0.35, Math.sin(a + 0.6) * R * 0.35, -cell * 0.04, 0)
        ctx.stroke()
      }
      ctx.strokeStyle = '#1F5F80'
      ctx.lineWidth = Math.max(1.4, cell * 0.045)
      ctx.beginPath()
      ctx.arc(-cell * 0.04, 0, R * 0.66, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = '#FFE14D'
      ctx.strokeStyle = '#C79A00'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(-cell * 0.04, 0, cell * 0.09, 0, TAU)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'zylinder':
      ctx.fillStyle = '#1B1B1F'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.85, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#B3263A'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.58, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#2A2A30'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.48, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath()
      ctx.arc(-cell * 0.16, -cell * 0.06, R * 0.2, 0, TAU)
      ctx.fill()
      break
    case 'cowboyhut':
      ctx.fillStyle = '#8B5A2B'
      ctx.beginPath()
      ctx.ellipse(-cell * 0.1, 0, R * 0.95, R * 1.25, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#6B421D'
      ctx.beginPath()
      ctx.ellipse(-cell * 0.1, 0, R * 0.5, R * 0.62, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#4A2C12'
      ctx.beginPath()
      ctx.moveTo(-cell * 0.1, -R * 0.35)
      ctx.lineTo(-cell * 0.1, R * 0.35)
      ctx.stroke()
      break
    case 'weihnachtsmuetze': {
      // Erst der weisse Rand, darauf die rote Muetze mit Zipfel nach oben/hinten
      const wipp = Math.sin(welle(now, 2000)) * cell * 0.03
      ctx.strokeStyle = '#F4F4F4'
      ctx.lineWidth = cell * 0.11
      ctx.beginPath()
      ctx.arc(-cell * 0.08, 0, R * 0.7, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = '#D62839'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, R * 0.6, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-cell * 0.12, -R * 0.45)
      ctx.quadraticCurveTo(-cell * 0.5, -R * 0.15, -cell * 0.66 + wipp, R * 0.25)
      ctx.lineTo(-cell * 0.08, R * 0.45)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.arc(-cell * 0.2, R * 0.1, R * 0.3, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(-cell * 0.66 + wipp, R * 0.25, cell * 0.1, 0, TAU)
      ctx.fill()
      break
    }
    case 'kochmuetze':
      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = 'rgba(70, 80, 90, 0.55)'
      ctx.lineWidth = Math.max(1.2, cell * 0.035)
      ctx.beginPath()
      for (const [x, y] of [[-0.1, 0], [-0.22, -0.16], [-0.22, 0.16], [0.02, -0.16], [0.02, 0.16]] as const) {
        ctx.moveTo(x * cell + cell * 0.2, y * cell)
        ctx.arc(x * cell, y * cell, cell * 0.2, 0, TAU)
      }
      ctx.stroke()
      for (const [x, y] of [[-0.1, 0], [-0.22, -0.16], [-0.22, 0.16], [0.02, -0.16], [0.02, 0.16]] as const) {
        ctx.beginPath()
        ctx.arc(x * cell, y * cell, cell * 0.2, 0, TAU)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.arc(-cell * 0.1, 0, cell * 0.12, 0, TAU)
      ctx.stroke()
      break
    case 'stierhoerner':
      // Kleine Hoerner seitlich am Hinterkopf, nach hinten (zum Schwanz) gebogen
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#F1E4C6'
        ctx.strokeStyle = 'rgba(90, 70, 40, 0.55)'
        ctx.lineWidth = Math.max(1, cell * 0.025)
        ctx.beginPath()
        ctx.moveTo(-cell * 0.02, s * R * 0.72)
        ctx.quadraticCurveTo(-cell * 0.08, s * R * 1.22, -cell * 0.46, s * R * 1.12)
        ctx.quadraticCurveTo(-cell * 0.2, s * R * 0.98, -cell * 0.2, s * R * 0.62)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      break
    case 'wikinger':
      ctx.fillStyle = '#9EA4AC'
      ctx.beginPath()
      ctx.arc(-cell * 0.08, 0, R * 0.72, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#6F757D'
      ctx.lineWidth = cell * 0.05
      ctx.beginPath()
      ctx.moveTo(-cell * 0.08 - R * 0.7, 0)
      ctx.lineTo(-cell * 0.08 + R * 0.7, 0)
      ctx.stroke()
      ctx.fillStyle = '#F2E6C9'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(-cell * 0.15, R * 0.6 * s)
        ctx.quadraticCurveTo(-cell * 0.05, R * 1.6 * s, cell * 0.35, R * 1.7 * s)
        ctx.quadraticCurveTo(cell * 0.05, R * 1.25 * s, cell * 0.05, R * 0.6 * s)
        ctx.fill()
      }
      break
    case 'propeller': {
      const cols = ['#E63946', '#FFD23F', '#3A86FF', '#2EC4B6']
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i]
        ctx.beginPath()
        ctx.moveTo(-cell * 0.08, 0)
        ctx.arc(-cell * 0.08, 0, R * 0.7, (i * Math.PI) / 2, ((i + 1) * Math.PI) / 2)
        ctx.fill()
      }
      ctx.save()
      ctx.translate(-cell * 0.08, 0)
      ctx.rotate(welle(now, 250))
      ctx.fillStyle = 'rgba(40,40,40,0.75)'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(s * R * 0.6, 0, R * 0.55, R * 0.13, 0, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
      ctx.fillStyle = '#FFD23F'
      ctx.beginPath()
      ctx.arc(-cell * 0.08, 0, cell * 0.06, 0, TAU)
      ctx.fill()
      break
    }
    case 'krone': {
      ctx.save()
      ctx.translate(-cell * 0.08, 0)
      ctx.fillStyle = '#F5C542'
      ctx.strokeStyle = '#B8860B'
      ctx.lineWidth = Math.max(1, cell * 0.03)
      ctx.beginPath()
      for (let i = 0; i < 16; i++) {
        const r = i % 2 ? R * 0.55 : R * 0.84
        const an = (i / 16) * TAU
        ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#C8382B'
      ctx.beginPath()
      ctx.arc(0, 0, R * 0.36, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU
        ctx.fillStyle = ['#E63946', '#3A86FF', '#2EC4B6'][i % 3]
        ctx.beginPath()
        ctx.arc(Math.cos(an) * R * 0.5, Math.sin(an) * R * 0.5, cell * 0.035, 0, TAU)
        ctx.fill()
      }
      const tw = Math.max(0, Math.sin(welle(now, 1500)))
      ctx.strokeStyle = `rgba(255,255,255,${tw})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(R * 0.6, -R * 0.55)
      ctx.lineTo(R * 0.6, -R * 0.15)
      ctx.moveTo(R * 0.4, -R * 0.35)
      ctx.lineTo(R * 0.8, -R * 0.35)
      ctx.stroke()
      ctx.restore()
      break
    }
    case 'einhorn': {
      const g = ctx.createLinearGradient(cell * 0.1, 0, cell * 0.9, 0)
      g.addColorStop(0, '#FFB3E6')
      g.addColorStop(0.5, '#B3E5FF')
      g.addColorStop(1, '#FFF3B3')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(cell * 0.12, -cell * 0.1)
      ctx.lineTo(cell * 0.85, 0)
      ctx.lineTo(cell * 0.12, cell * 0.1)
      ctx.fill()
      ctx.strokeStyle = 'rgba(180, 100, 200, 0.6)'
      ctx.lineWidth = 1
      for (let i = 1; i < 5; i++) {
        const x = cell * (0.12 + i * 0.14)
        const h = cell * 0.1 * (1 - i / 5.5)
        ctx.beginPath()
        ctx.moveTo(x, -h)
        ctx.lineTo(x + cell * 0.05, h)
        ctx.stroke()
      }
      const tw = 0.5 + 0.5 * Math.sin(welle(now, 1200))
      ctx.fillStyle = `rgba(255,255,255,${tw})`
      ctx.save()
      ctx.translate(cell * 0.9, -cell * 0.12)
      stern(ctx, cell * 0.08 * tw)
      ctx.restore()
      break
    }
    case 'heiligenschein': {
      // Schwebt ueber dem Kopf, ueber den Augen
      const v = 0.5 + 0.5 * Math.sin(welle(now, 2000))
      ctx.strokeStyle = `rgba(255, 225, 110, ${0.25 + 0.2 * v})`
      ctx.lineWidth = cell * 0.16
      ctx.beginPath()
      ctx.ellipse(-cell * 0.04, 0, R * 1.02, R * 1.02, 0, 0, TAU)
      ctx.stroke()
      ctx.strokeStyle = '#FFE16E'
      ctx.lineWidth = cell * 0.06
      ctx.stroke()
      break
    }
    case 'schnurrbart':
      // Zwei Bartseiten mit eingerollten Enden
      ctx.fillStyle = '#3B2A1E'
      ctx.strokeStyle = '#3B2A1E'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(R * 0.86, 0)
        ctx.quadraticCurveTo(R * 1.12, s * R * 0.3, R * 0.86, s * R * 0.72)
        ctx.quadraticCurveTo(R * 0.92, s * R * 0.42, R * 0.72, s * R * 0.1)
        ctx.closePath()
        ctx.fill()
        // Locke am Ende
        ctx.lineWidth = Math.max(1.2, cell * 0.045)
        ctx.beginPath()
        const cx = R * 0.74
        const cy = s * R * 0.8
        ctx.arc(cx, cy, cell * 0.06, s > 0 ? -Math.PI * 0.3 : Math.PI * 0.3, s > 0 ? Math.PI * 1.3 : -Math.PI * 1.3, s < 0)
        ctx.stroke()
      }
      break
    case 'fliege':
      ctx.save()
      ctx.translate(-R * 0.95, 0)
      ctx.fillStyle = '#C62839'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-cell * 0.13, s * cell * 0.22)
        ctx.lineTo(cell * 0.13, s * cell * 0.22)
        ctx.fill()
      }
      ctx.fillStyle = '#8E1B28'
      ctx.beginPath()
      ctx.arc(0, 0, cell * 0.06, 0, TAU)
      ctx.fill()
      ctx.restore()
      break
    case 'blume':
      ctx.save()
      ctx.translate(-cell * 0.05, -R * 0.75)
      ctx.fillStyle = '#FFFFFF'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.ellipse(Math.cos((i / 6) * TAU) * cell * 0.09, Math.sin((i / 6) * TAU) * cell * 0.09, cell * 0.07, cell * 0.045, (i / 6) * TAU, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#FFC93C'
      ctx.beginPath()
      ctx.arc(0, 0, cell * 0.06, 0, TAU)
      ctx.fill()
      ctx.restore()
      break
    case 'clownsnase':
      ctx.fillStyle = '#FF2D2D'
      ctx.beginPath()
      ctx.arc(R * 0.9, 0, cell * 0.13, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(R * 0.86, -cell * 0.04, cell * 0.04, 0, TAU)
      ctx.fill()
      break
    case 'schnuller':
      ctx.fillStyle = '#7FD3FF'
      ctx.beginPath()
      ctx.ellipse(R * 1.0, 0, cell * 0.07, cell * 0.2, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = '#FF8FC7'
      ctx.lineWidth = cell * 0.04
      ctx.beginPath()
      ctx.arc(R * 1.18, 0, cell * 0.1, 0, TAU)
      ctx.stroke()
      break
    case 'pfeife': {
      // Seifenblasen-Pfeife
      ctx.strokeStyle = '#6D4C2F'
      ctx.lineWidth = cell * 0.06
      ctx.beginPath()
      ctx.moveTo(R * 0.8, R * 0.2)
      ctx.lineTo(R * 1.35, R * 0.55)
      ctx.stroke()
      ctx.fillStyle = '#5A3C22'
      ctx.beginPath()
      ctx.arc(R * 1.4, R * 0.6, cell * 0.09, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 3; i++) {
        const z = ((now % 6000) / 1500 + i / 3) % 1
        ctx.strokeStyle = `hsla(${200 + i * 50}, 80%, 80%, ${1 - z})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(R * 1.4 + z * cell * 0.5, R * 0.6 - z * cell * 0.7, cell * (0.04 + z * 0.08), 0, TAU)
        ctx.stroke()
      }
      break
    }
  }
}

function accSchwanz(ctx: CanvasRenderingContext2D, id: string, pr: Probe[], cell: number, now: number) {
  const e = pr[pr.length - 1]
  if (!e) return
  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(Math.atan2(-e.ty, -e.tx))
  ctx.lineCap = 'round'
  switch (id) {
    case 'schleife':
      ctx.fillStyle = '#FF5C8A'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(-cell * 0.05, 0)
        ctx.lineTo(-cell * 0.15, s * cell * 0.25)
        ctx.lineTo(cell * 0.08, s * cell * 0.25)
        ctx.fill()
      }
      ctx.fillStyle = '#D63A6A'
      ctx.beginPath()
      ctx.arc(-cell * 0.03, 0, cell * 0.07, 0, TAU)
      ctx.fill()
      break
    case 'gloeckchen':
      ctx.rotate(Math.sin(welle(now, 1000)) * 0.4)
      ctx.fillStyle = '#F5C542'
      ctx.beginPath()
      ctx.arc(cell * 0.18, 0, cell * 0.13, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#A97B12'
      ctx.beginPath()
      ctx.arc(cell * 0.24, 0, cell * 0.04, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(cell * 0.14, -cell * 0.05, cell * 0.035, 0, TAU)
      ctx.fill()
      break
    case 'bommel':
      ctx.fillStyle = '#FFFFFF'
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.arc(cell * 0.12 + Math.cos(i) * cell * 0.07, Math.sin(i * 1.3) * cell * 0.07, cell * 0.08, 0, TAU)
        ctx.fill()
      }
      break
    case 'klapper': {
      const sw = Math.sin(welle(now, 200)) * cell * 0.04
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#D8C49A' : '#BFA676'
        ctx.beginPath()
        ctx.ellipse(cell * (0.06 + i * 0.1), sw * (i % 2 ? 1 : -1), cell * 0.07, cell * (0.13 - i * 0.02), 0, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'skorpion': {
      // Kraeftiger Stachel: drei Glieder, ein Giftblasen-Glied und eine scharfe Spitze
      ctx.strokeStyle = '#1E1E1E'
      ctx.fillStyle = '#2E2E2E'
      ctx.lineWidth = Math.max(1, cell * 0.03)
      for (const [x, r] of [[0.1, 0.12], [0.26, 0.11], [0.4, 0.1]] as const) {
        ctx.beginPath()
        ctx.ellipse(x * cell, -x * cell * 0.4, r * cell, r * cell * 0.85, 0, 0, TAU)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#B5121B'
      ctx.beginPath()
      ctx.ellipse(cell * 0.56, -cell * 0.26, cell * 0.12, cell * 0.1, -0.4, 0, TAU)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#111'
      ctx.beginPath()
      ctx.moveTo(cell * 0.6, -cell * 0.34)
      ctx.quadraticCurveTo(cell * 0.72, -cell * 0.6, cell * 0.5, -cell * 0.66)
      ctx.quadraticCurveTo(cell * 0.62, -cell * 0.5, cell * 0.5, -cell * 0.32)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(cell * 0.53, -cell * 0.3, cell * 0.035, 0, TAU)
      ctx.fill()
      break
    }
  }
  ctx.restore()
}

function rakete(ctx: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number) {
  const e = pr[pr.length - 1]
  if (!e) return
  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(Math.atan2(-e.ty, -e.tx))
  const f = 0.85 + 0.15 * Math.sin(welle(now, 120))
  // Grosse Flamme mit hellem Kern, dazu Funken
  const g = ctx.createLinearGradient(cell * 0.2, 0, cell * 1.5, 0)
  g.addColorStop(0, 'rgba(255,255,230,1)')
  g.addColorStop(0.3, 'rgba(255,190,50,0.95)')
  g.addColorStop(0.7, 'rgba(255,80,20,0.7)')
  g.addColorStop(1, 'rgba(255,40,10,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cell * 0.2, -cell * 0.2)
  ctx.quadraticCurveTo(cell * 1.5 * f, 0, cell * 0.2, cell * 0.2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.moveTo(cell * 0.2, -cell * 0.08)
  ctx.quadraticCurveTo(cell * 0.7 * f, 0, cell * 0.2, cell * 0.08)
  ctx.fill()
  for (let i = 0; i < 5; i++) {
    const z = ((now % 6000) / 400 + i / 5) % 1
    ctx.fillStyle = `rgba(255, ${220 - z * 120}, 60, ${1 - z})`
    ctx.beginPath()
    ctx.arc(cell * (0.4 + z * 1.2), Math.sin(i * 2.7) * cell * 0.25 * z, cell * 0.04 * (1 - z * 0.5), 0, TAU)
    ctx.fill()
  }
  // Duese
  ctx.fillStyle = '#9AA3AD'
  ctx.strokeStyle = '#5B636B'
  ctx.lineWidth = Math.max(1, cell * 0.03)
  ctx.beginPath()
  ctx.moveTo(-cell * 0.04, -cell * 0.16)
  ctx.lineTo(cell * 0.22, -cell * 0.22)
  ctx.lineTo(cell * 0.22, cell * 0.22)
  ctx.lineTo(-cell * 0.04, cell * 0.16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#E63946'
  ctx.fillRect(cell * 0.06, -cell * 0.2, cell * 0.06, cell * 0.4)
  ctx.restore()
}

function komet(ctx: CanvasRenderingContext2D, pr: Probe[], cell: number, now: number) {
  const e = pr[pr.length - 1]
  if (!e) return
  for (let i = 0; i < 18; i++) {
    const z = ((now % 6000) / 1000 + i / 18) % 1
    const x = e.x - e.tx * cell * z * 1.6 + e.nx * Math.sin(i * 2.3) * cell * 0.15 * z
    const y = e.y - e.ty * cell * z * 1.6 + e.ny * Math.sin(i * 2.3) * cell * 0.15 * z
    ctx.fillStyle = `hsla(${200 + i * 8}, 100%, ${85 - z * 30}%, ${1 - z})`
    ctx.beginPath()
    ctx.arc(x, y, cell * 0.12 * (1 - z), 0, TAU)
    ctx.fill()
  }
}

/* ================= Spuren ================= */

/** Ein Teilchen einer Spur an (x, y) zeichnen. z = Alter 0..1, i = Nummer, s = Groesse */
export function spurTeil(ctx: CanvasRenderingContext2D, art: string, x: number, y: number, s: number, z: number, i: number, now: number) {
  ctx.save()
  ctx.translate(x, y)
  // Bleibt lange kraeftig und blendet erst am Ende aus
  ctx.globalAlpha *= Math.max(0, 1 - z * z)
  switch (art) {
    case 'spur-blueten':
      ctx.rotate(z * 5 + i)
      ctx.fillStyle = ['#FF9EC4', '#FFFFFF', '#FFC7DD', '#FFE08A'][i % 4]
      ctx.beginPath()
      ctx.ellipse(0, -z * s, s * 0.9, s * 0.45, 0, 0, TAU)
      ctx.fill()
      if (i % 5 === 0) {
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.arc(s * 0.5, 0, s * 0.18, 0, TAU)
        ctx.fill()
      }
      break
    case 'spur-goldsand': {
      ctx.fillStyle = `rgb(${245}, ${180 + (i % 4) * 14}, ${40 + (i % 5) * 10})`
      for (let k = 0; k < 3; k++) {
        ctx.beginPath()
        ctx.arc(Math.cos(i + k * 2.1) * s * 0.7, Math.sin(i * 1.3 + k) * s * 0.7 + z * s, s * 0.32, 0, TAU)
        ctx.fill()
      }
      const tw = Math.max(0, Math.sin(now / 120 + i * 1.7))
      ctx.fillStyle = `rgba(255, 255, 255, ${tw})`
      ctx.beginPath()
      ctx.moveTo(0, -s * tw)
      ctx.lineTo(s * 0.15, 0)
      ctx.lineTo(0, s * tw)
      ctx.lineTo(-s * 0.15, 0)
      ctx.fill()
      break
    }
    case 'spur-eiskristalle':
      ctx.rotate(z * 1.5 + i)
      ctx.strokeStyle = i % 2 ? '#FFFFFF' : '#BDEBFF'
      ctx.lineWidth = Math.max(1, s * 0.16)
      for (let k = 0; k < 3; k++) {
        ctx.rotate(Math.PI / 3)
        ctx.beginPath()
        ctx.moveTo(-s, 0)
        ctx.lineTo(s, 0)
        ctx.moveTo(s * 0.55, 0)
        ctx.lineTo(s * 0.8, -s * 0.25)
        ctx.moveTo(s * 0.55, 0)
        ctx.lineTo(s * 0.8, s * 0.25)
        ctx.moveTo(-s * 0.55, 0)
        ctx.lineTo(-s * 0.8, -s * 0.25)
        ctx.moveTo(-s * 0.55, 0)
        ctx.lineTo(-s * 0.8, s * 0.25)
        ctx.stroke()
      }
      break
    case 'spur-edelsteine': {
      const f = ['#E8324F', '#2F6FE0', '#2EBD6B', '#A35BE8', '#F5C33B'][i % 5]
      ctx.rotate(i * 0.7)
      ctx.fillStyle = f
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.75, -s * 0.2)
      ctx.lineTo(0, s)
      ctx.lineTo(-s * 0.75, -s * 0.2)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.3, -s * 0.2)
      ctx.lineTo(-s * 0.3, -s * 0.2)
      ctx.fill()
      break
    }
    case 'spur-feenstaub': {
      const tw = 0.5 + 0.5 * Math.sin(now / 90 + i * 2.3)
      ctx.translate(0, -z * s * 2)
      ctx.fillStyle = i % 2 ? `rgba(255, 120, 230, ${0.25 + 0.35 * tw})` : `rgba(90, 240, 220, ${0.25 + 0.35 * tw})`
      ctx.beginPath()
      ctx.arc(0, 0, s * 1.1, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + 0.3 * tw})`
      const r = s * (0.8 + 0.6 * tw)
      ctx.beginPath()
      ctx.moveTo(0, -r)
      ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.quadraticCurveTo(0, 0, 0, r)
      ctx.quadraticCurveTo(0, 0, -r, 0)
      ctx.quadraticCurveTo(0, 0, 0, -r)
      ctx.fill()
      break
    }
    case 'spur-irrlichter': {
      const fl = 0.6 + 0.4 * Math.sin(now / 70 + i * 3.1)
      ctx.translate(Math.sin(z * 6 + i) * s * 0.6, -z * s * 2.5)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.7)
      g.addColorStop(0, `rgba(230, 255, 235, ${fl})`)
      g.addColorStop(0.35, `rgba(70, 230, 170, ${0.7 * fl})`)
      g.addColorStop(1, 'rgba(40, 200, 160, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, s * 1.7, 0, TAU)
      ctx.fill()
      break
    }
    case 'spur-staub':
      ctx.fillStyle = 'rgba(150, 120, 80, 0.6)'
      ctx.beginPath()
      ctx.arc(0, 0, s * (0.6 + z), 0, TAU)
      ctx.fill()
      break
    case 'spur-blasen':
      ctx.strokeStyle = `hsla(${(i * 40 + now * 0.05) % 360}, 80%, 80%, 0.9)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, -z * s * 3, s, 0, TAU)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.arc(-s * 0.35, -z * s * 3 - s * 0.35, s * 0.2, 0, TAU)
      ctx.fill()
      break
    case 'spur-blaetter':
      ctx.rotate(z * 6 + i)
      ctx.fillStyle = ['#7FBF4A', '#E8A43C', '#D9622B'][i % 3]
      ctx.beginPath()
      ctx.ellipse(0, 0, s, s * 0.5, 0, 0, TAU)
      ctx.fill()
      break
    case 'spur-herzen':
      ctx.translate(0, -z * s * 3)
      ctx.fillStyle = '#FF5C8A'
      herz(ctx, s * 1.1)
      break
    case 'spur-noten':
      ctx.translate(0, -z * s * 3)
      ctx.fillStyle = '#2B2F3A'
      ctx.font = `700 ${Math.round(s * 2.4)}px serif`
      ctx.textAlign = 'center'
      ctx.fillText(i % 2 ? '♪' : '♫', 0, 0)
      break
    case 'spur-schnee':
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 1.3
      ctx.rotate(z * 2)
      for (let k = 0; k < 3; k++) {
        ctx.rotate(Math.PI / 3)
        ctx.beginPath()
        ctx.moveTo(-s, 0)
        ctx.lineTo(s, 0)
        ctx.stroke()
      }
      break
    case 'spur-konfetti':
      ctx.rotate(z * 9 + i)
      ctx.fillStyle = `hsl(${i * 47}, 85%, 60%)`
      ctx.fillRect(-s * 0.6, -s * 0.25, s * 1.2, s * 0.5)
      break
    case 'spur-funken':
      ctx.fillStyle = `rgba(255, ${220 - z * 150}, 60, 1)`
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.45 * (1 - z * 0.5), 0, TAU)
      ctx.fill()
      break
    case 'spur-sterne':
      ctx.fillStyle = '#FFE680'
      stern(ctx, s * (1.2 - z * 0.6))
      break
    case 'spur-pixel':
      ctx.fillStyle = `hsl(${(i * 30 + now * 0.1) % 360}, 80%, 60%)`
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s)
      break
    case 'spur-regenbogen': {
      const f = ['#FF4D4D', '#FFA640', '#FFE14D', '#5DD45D', '#4DA6FF', '#9B6BFF']
      for (let k = 0; k < f.length; k++) {
        ctx.fillStyle = f[k]
        ctx.fillRect(-s * 0.5, -s * 0.9 + k * s * 0.3, s, s * 0.3)
      }
      break
    }
    case 'spur-flammen': {
      const r = s * (1.2 - z * 0.5)
      ctx.translate(0, -z * s * 2)
      ctx.fillStyle = `rgba(255, ${190 - z * 140}, 40, 0.9)`
      ctx.beginPath()
      ctx.moveTo(0, -r * 1.8)
      ctx.quadraticCurveTo(r, 0, 0, r)
      ctx.quadraticCurveTo(-r, 0, 0, -r * 1.8)
      ctx.fill()
      break
    }
  }
  ctx.restore()
}

/** Spuren im Spiel: Teilchen entstehen am Schwanz (Feldkoordinaten) und bleiben liegen, waehrend sie verblassen */
/** Groesse der Spur-Teilchen im Verhaeltnis zum Feld (vorher 0,15) */
const SPUR_GROESSE = 0.24

export class Spuren {
  private teile: { x: number; y: number; t: number; art: string; i: number; dauer: number }[] = []
  private letzt = new Map<string, { t: number; x: number; y: number }>()
  private n = 0
  /** Teilchen fuer eine Schlange erzeugen (wer = Schluessel, x/y = Schwanzspitze in Feldern) */
  takt(wer: string, skin: Skin, x: number, y: number, now: number) {
    if (!skin.spur) return
    const l = this.letzt.get(wer)
    const art = skin.spur.id
    const band = art === 'spur-regenbogen' || art === 'spur-flammen'
    const abstand = band ? 0.2 : 0.3
    if (l && Math.hypot(x - l.x, y - l.y) < abstand && now - l.t < 700) return
    if (l && now - l.t < (band ? 30 : 70)) return
    this.letzt.set(wer, { t: now, x, y })
    const st = band ? 0 : 0.5
    // Bei Teilchen zwei Stueck je Schritt, damit die Spur voll wirkt
    for (let k = 0; k < (band ? 1 : 2); k++)
      this.teile.push({ x: x + (Math.random() - 0.5) * st, y: y + (Math.random() - 0.5) * st, t: now, art, i: this.n++, dauer: band ? 1100 : 2000 })
    if (this.teile.length > 800) this.teile.splice(0, this.teile.length - 800)
  }
  /** Karte verschoben (neuer Block oben/links) */
  verschieben(dx: number, dy: number) {
    for (const t of this.teile) {
      t.x += dx
      t.y += dy
    }
    for (const l of this.letzt.values()) {
      l.x += dx
      l.y += dy
    }
  }
  leeren() {
    this.teile = []
    this.letzt.clear()
  }
  draw(ctx: CanvasRenderingContext2D, cell: number, now: number) {
    this.teile = this.teile.filter((t) => now - t.t < t.dauer && now >= t.t)
    for (const t of this.teile) spurTeil(ctx, t.art, (t.x + 0.5) * cell, (t.y + 0.5) * cell, cell * SPUR_GROESSE, (now - t.t) / t.dauer, t.i, now)
  }
}

/** Spur in der Vorschau (die Schlange steht): Teilchen ziehen hinter dem Schwanz weg */
function spurVorschau(ctx: CanvasRenderingContext2D, pts: P[], cell: number, art: string, now: number) {
  const n = pts.length
  const a = pts[n - 1]
  const b = pts[n - 2] ?? a
  const l = Math.hypot(a.x - b.x, a.y - b.y) || 1
  const tx = (a.x - b.x) / l
  const ty = (a.y - b.y) / l
  const band = art === 'spur-regenbogen' || art === 'spur-flammen'
  const N = band ? 36 : 26
  for (let i = 0; i < N; i++) {
    const z = ((now % 6000) / (band ? 1200 : 2000) + i / N) % 1
    const q = band ? 0 : Math.sin(i * 5.1) * 0.4
    const x = (a.x + 0.5 + tx * (0.2 + z * 3.2) - ty * q) * cell
    const y = (a.y + 0.5 + ty * (0.2 + z * 3.2) + tx * q) * cell
    spurTeil(ctx, art, x, y, cell * SPUR_GROESSE, z * 0.9, i, now)
  }
}

/* ================= Vorschau ================= */

export type Fokus = 'ganz' | 'kopf' | 'schwanz' | 'aura'

/** Wie eine kaufbare Sache im Shop gezeigt wird (dasselbe nutzt das Skript fuer Bilder und Videos) */
export function vorschauFuer(id: string): { skin: Skin; fokus: Fokus; bewegt: boolean } {
  const a = ACCS.find((x) => x.id === id)
  if (a) return { skin: baueSkin({ acc: [id] }), fokus: a.platz === 'schwanz' ? 'schwanz' : 'kopf', bewegt: !!a.bewegt }
  if (SPUREN.some((x) => x.id === id)) return { skin: baueSkin({ spur: id }), fokus: 'ganz', bewegt: true }
  const m = MUSTER.find((x) => x.id === id)
  if (m) return { skin: baueSkin({ muster: id }), fokus: 'ganz', bewegt: m.bewegt }
  if (id === 'zweifarbig') return { skin: baueSkin({ farben: ['pink', 'tuerkis'] }), fokus: 'ganz', bewegt: false }
  if (id === 'dreifarbig') return { skin: baueSkin({ farben: ['rot', 'weiss', 'ozean'] }), fokus: 'ganz', bewegt: false }
  return { skin: baueSkin({ farben: [id] }), fokus: 'ganz', bewegt: false }
}
/** Alle Ids, fuer die es im Shop ein Bild oder Video gibt */
export const ALLE_VORSCHAUEN: string[] = [...FARBEN, ...MUSTER, ...ACCS, ...SPUREN, ...MODI].map((x) => x.id)

/** Vorschau fuer Shop und Listen: S-Kurve auf Schachbrett, nah dran (2,4 Felder hoch).
 *  fokus kopf/schwanz: noch naeher an Kopf oder Schwanz (fuer Accessoires) */
export function drawSkinVorschau(cv: HTMLCanvasElement, skin: Skin, now: number, fokus: Fokus = 'ganz') {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const w = cv.clientWidth || 120
  const h = cv.clientHeight || 80
  if (cv.width !== Math.round(w * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  zeichneVorschau(ctx, w, h, skin, now, fokus)
}

/**
 * Schlange eines anderen Spielers fuer Listen und Spielerkarten: gerade, ohne Ecken, ohne Rahmen und Schachbrett
 * (sie liegt direkt auf der Karte) und so gross, wie der Platz erlaubt. Skins mit Spur bekommen links Platz dafuer.
 */
export function drawSchlangeGerade(cv: HTMLCanvasElement, skin: Skin, now = 0) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const w = cv.clientWidth || Number(cv.getAttribute('width')) || 120
  const h = cv.clientHeight || Number(cv.getAttribute('height')) || 40
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  // Breite Flaechen (Karten): lange Schlange; schmale (Hall-Zeilen): kuerzer, dafuer dicker
  const n = w / h >= 3.5 ? 7 : 5
  const pts: P[] = Array.from({ length: n }, (_, i) => ({ x: n - 1 - i, y: 0 }))
  const cell = Math.min(h / 1.7, w / ((skin.spur ? n + 3 : n) + 0.4))
  const tx = skin.spur ? w - (n + 0.2) * cell : (w - n * cell) / 2
  ctx.save()
  ctx.translate(tx, (h - cell) / 2)
  if (skin.spur) spurVorschau(ctx, pts, cell, skin.spur.id, now)
  drawSchlange(ctx, pts, cell, 'r', skin, now, { blinzeln: now % TAKT.blinzeln < 120 })
  ctx.restore()
}

/** Die Vorschau in einen beliebigen Rahmen (w x h CSS-Pixel) zeichnen */
export function zeichneVorschau(ctx: CanvasRenderingContext2D, w: number, h: number, skin: Skin, now: number, fokus: Fokus = 'ganz') {
  // Die Schlange liegt in den Feldern x 0..5, y 0..1
  const pts: P[] = [
    { x: 5, y: 0 },
    { x: 4, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  let cell: number
  let tx: number
  let ty: number
  if (fokus === 'aura') {
    // Effekte: Platz rund um den Kopf
    cell = Math.min(h / 3.4, w / 5)
    tx = w * 0.62 - 5.5 * cell
    ty = h * 0.58 - 0.5 * cell
  } else if (fokus === 'kopf') {
    cell = h / 1.5
    tx = w * 0.6 - 5.5 * cell
    ty = h * 0.5 - 0.5 * cell
  } else if (fokus === 'schwanz') {
    cell = h / 1.5
    tx = w * 0.45 - 0.5 * cell
    ty = h * 0.5 - 1.5 * cell
  } else {
    if (skin.spur) {
      // Spur: die Schlange rechts, links bleibt Platz fuer die Teilchen hinter dem Schwanz
      cell = Math.min(h / 2.4, w / 9.6)
      tx = w - 6.2 * cell
    } else {
      cell = Math.min(h / 2.4, w / 7.4)
      tx = w / 2 - 3 * cell
    }
    ty = h / 2 - cell
  }
  ctx.save()
  ctx.translate(tx, ty)
  for (let y = Math.floor(-ty / cell) - 1; y <= Math.ceil((h - ty) / cell); y++)
    for (let x = Math.floor(-tx / cell) - 1; x <= Math.ceil((w - tx) / cell); x++) {
      ctx.fillStyle = (((x + y) % 2) + 2) % 2 ? '#A5D7B3' : '#B4E3C1'
      ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
    }
  if (skin.spur) spurVorschau(ctx, pts, cell, skin.spur.id, now)
  drawSchlange(ctx, pts, cell, 'r', skin, now, { blinzeln: now % TAKT.blinzeln < 120 })
  ctx.restore()
}
