/**
 * Zeitleiste: was kommt bei welchem Level? Wird aus den aktuellen Zahlen (Config)
 * berechnet, zeigt also auch jede Aenderung in den Master-Einstellungen sofort.
 * Jede kleinste Aenderung bekommt einen Eintrag: neue Bloecke, Mauerlaengen,
 * Teichgroessen, Anzahl Giftaepfel, Apfelwert, Hoechstzahlen, Abstaende ...
 */
import * as R from './rules'

export type Art = 'karte' | 'schlange' | 'hindernis' | 'gefahr' | 'gegner' | 'bau' | 'apfel'
export type Eintrag = { level: number; teile: { art: Art; text: string }[] }

const FARBE = ['Rot', 'Orange', 'Gelb', 'Grün', 'Türkis', 'Blau', 'Lila', 'Rosa', 'Blau-Rosa', 'Lila-Rosa']
const bereich = (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`)

/** Laufende Regeln (gelten dauerhaft, keine einzelnen Level) */
export const dauerhaft = (c: R.Config): string[] => [
  `Jedes Level ${String(c.tempoProLevel).replace('.', ',')} % schneller, bis höchstens ${c.tempoMin} % des Grundtakts.`,
  `Mauern stehen nach jedem Apfel woanders. Häuser wechseln nach jedem Apfel das Fenster, Türme drehen sich eine Vierteldrehung.`,
  `Power-ups: nach jedem Apfel ${c.powerChance} % Chance (höchstens eins liegt), ${c.powerDauer} s lang. Gewichte: Schild 3, Zeitlupe 3, Magnet 3, Geist 2, Schere 2, Füttern 2 (nur wenn Tiere da sind), Maulwurf 2 (ab Level ${c.maulwurfAb}), goldener Apfel 1.`,
  `Neue Gebiete wählst du selbst: Alle ${c.gebietAlle} Level leuchten die Wände, wo ein Block passt. Berührst du eine, kommt dort der Block hin. Wer nicht wählt, bekommt ihn beim nächsten Mal zufällig.`,
  `Unter der Erde: Golderz (${c.erzGold} je 1000 Felder, ×${c.goldWert} Apfel) und Diamant (${c.erzDia} je 1000, ×${c.diaWert} Apfel). Freilegen per Maulwurf oder neuem Gebiet.`,
  `Zufällige Abstände: Fallen alle ${bereich(c.falleMin, c.falleMax)}, Wolken ${bereich(c.wolkeMin, c.wolkeMax)}, Frösche ${bereich(c.froschMin, c.froschMax)}, Gegner ${bereich(c.gegnerMin, c.gegnerMax)}, Ameisen ${bereich(c.ameiseMin, c.ameiseMax)} Level.`,
  `Lava breitet sich jeden ${c.lavaWachsen}. Apfel um ein Feld aus und hört bei ${bereich(Math.min(c.lavaMin, c.lavaMax), Math.max(c.lavaMin, c.lavaMax))} Feldern auf.`,
]

/** Alle Eintraege bis `bis`. `feldProBlock` = Felder je Kartenblock (Handy hochkant ca. 12 x 11) */
export function zeitleiste(c: R.Config, bis = 500, feldProBlock = 132): Eintrag[] {
  const out: Eintrag[] = []
  let bloecke = 2
  let mauernVorher = ''
  let giftVorher = 0
  let faktorVorher = 1
  let wolkeStufeVorher = 0
  let gegnerVorher = 0
  let ereignisVorher = 0
  let teichMaxVorher = R.teichMax(c, 2 * feldProBlock)
  let tempoMinErreicht = false
  let teiche = 0
  let baeume = 0
  let haeuser = 0
  let tuerme = 0
  let lava = 0
  let eis = 0

  for (let l = 1; l <= bis; l++) {
    const t: Eintrag['teile'] = []
    const add = (art: Art, text: string) => t.push({ art, text })
    if (l === 1) add('karte', 'Start: 2 Blöcke (ein Bildschirm), Schlange 3 lang, Äpfel rot (×1).')

    // Karte
    if (R.neuesGebiet(c, l)) {
      bloecke++
      add('karte', `Neues Gebiet wählen: Wände leuchten (jetzt ${bloecke} Blöcke).`)
    }
    if (l === c.gebietBis && c.gebietAlle > 0) add('karte', 'Die Karte wächst nicht mehr.')
    const felder = bloecke * feldProBlock

    // Schlange
    if (l === c.wachsenJedes + 1) add('schlange', 'Schlange wächst nur noch mit jedem 2. Apfel.')
    if (l === c.wachsenJedesZweite + 1) add('schlange', 'Schlange wächst nur noch mit jedem 3. Apfel.')
    if (!tempoMinErreicht && 1 - ((l - 1) * c.tempoProLevel) / 100 <= c.tempoMin / 100) {
      tempoMinErreicht = true
      add('schlange', `Höchsttempo erreicht (${c.tempoMin} % des Grundtakts).`)
    }
    if (l === c.powerAb) add('apfel', `Power-ups: Schild, Zeitlupe, Geist, Schere, Füttern, Magnet, goldener Apfel (${c.powerChance} % je Apfel).`)
    if (l === c.maulwurfAb) add('apfel', `Power-up Maulwurf: ${c.maulwurfDauer} s durch die Erde graben.`)

    // Apfelwert
    const f = R.apfelFaktor(c, l)
    if (f !== faktorVorher) {
      add('apfel', `Äpfel ×${f} wert, Farbe ${FARBE[Math.min(FARBE.length, f) - 1]}.`)
      faktorVorher = f
    }

    // Mauern
    const m = R.mauern(c, l, felder)
    const mk = m.join('+')
    if (mk !== mauernVorher) {
      if (m.length) add('hindernis', mauernVorher ? `Mauern jetzt ${m.join(' + ')} Felder.` : `Mauern beginnen (${m.join(' + ')} Felder, nach jedem Apfel woanders).`)
      mauernVorher = mk
    }

    // Teiche
    if (R.neuerTeich(c, l)) {
      teiche++
      add('hindernis', `${teiche === 1 ? 'Erster Teich' : 'Neuer Teich'} (${R.teichGroesse(c, l)} Felder).`)
    }
    const tm = R.teichMax(c, felder)
    if (tm !== teichMaxVorher && l > c.teichAb) add('hindernis', `Bis zu ${tm} Teiche gleichzeitig, sonst trocknet der älteste aus.`)
    teichMaxVorher = tm

    // Giftaepfel
    const g = R.giftAnzahl(c, l)
    if (g !== giftVorher) {
      add('gefahr', g === 1 && giftVorher === 0 ? 'Erster Giftapfel.' : `${g} Giftäpfel.`)
      giftVorher = g
    }

    // Ereignisse
    if (l === c.falleAb) add('gefahr', `Bärenfallen: alle ${bereich(c.falleMin, c.falleMax)} Level eine, ${c.falleAbstandMin}–${c.falleAbstandMax} Felder vor dem Kopf.`)
    if (l === c.wolkeAb) add('gefahr', `Giftwolken: alle ${bereich(c.wolkeMin, c.wolkeMax)} Level, wachsen alle ${c.wolkeTakt} s, −${c.wolkeZurueck} Level.`)
    const ws = l >= c.wolkeAb ? R.wolkeMaxStufe(c, l) : 0
    if (ws !== wolkeStufeVorher) {
      if (l > c.wolkeAb) add('gefahr', `Giftwolken werden größer (Stufe ${ws + 1}).`)
      wolkeStufeVorher = ws
    }
    if (l === c.froschAb) add('gefahr', `Frösche: alle ${bereich(c.froschMin, c.froschMax)} Level, höchstens ${c.froschAnzahl}.`)
    if (l === c.ameiseAb) add('gefahr', `Ameisen: alle ${bereich(c.ameiseMin, c.ameiseMax)} Level eine (höchstens ${c.ameiseAnzahl}), Biss −${c.ameiseZurueck} Level.`)
    const me = R.mindestEreignisse(c, l)
    if (me !== ereignisVorher) {
      add('gefahr', `Immer mindestens ${me} ${me === 1 ? 'Gefahr' : 'Gefahren'} unterwegs (Falle, Wolke, Frosch).`)
      ereignisVorher = me
    }
    if (l === c.haeufigerAb) add('gefahr', 'Alle zufälligen Abstände 1 Level kürzer.')

    // Gegner
    const gm = R.gegnerMax(c, l)
    if (gm !== gegnerVorher) {
      add('gegner', gegnerVorher === 0 ? `Rote Gegner-Schlangen: alle ${bereich(c.gegnerMin, c.gegnerMax)} Level eine, höchstens 1.` : `Bis zu ${gm} Gegner gleichzeitig.`)
      gegnerVorher = gm
    }
    if (l === c.lilaAb) add('gegner', `Lila Gegner möglich (${c.lilaChance} % der neuen), ${c.lilaLaenge} lang, ${c.lilaTempo} % schneller.`)

    // Bauten (bleiben stehen, wenn Platz ist)
    if (R.neuerBaum(c, l) && baeume < R.baumMax(c, felder)) {
      baeume++
      add('bau', `Baum ${baeume}.`)
    }
    if (l === c.hausGrossAb) add('bau', 'Ab jetzt große Häuser statt Hütten.')
    if (R.neuesHaus(c, l) && haeuser < R.hausMax(c, felder)) {
      haeuser++
      add('bau', `${l < c.hausGrossAb ? 'Hütte' : 'Haus'} ${haeuser} (Licht −${c.lichtZurueck} Level).`)
    }
    if (R.neuerTurm(c, l) && tuerme < R.turmMax(c, felder)) {
      tuerme++
      add('bau', `Jägerturm ${tuerme} (Kegel −${c.kegelZurueck} Level).`)
    }
    if (R.neuesEis(c, l) && eis < R.eisMax(c, felder)) {
      eis++
      add('hindernis', `${eis === 1 ? 'Erstes Eisfeld' : `Eisfeld ${eis}`} (${Math.min(c.eisMin, c.eisMax)}–${Math.max(c.eisMin, c.eisMax)} Felder, nicht lenkbar).`)
    }
    if (R.neueLava(c, l) && lava < R.lavaMax(c, felder)) {
      lava++
      add('bau', `${lava === 1 ? 'Erster Lavasee' : `Lavasee ${lava}`} (wächst von 1 Feld).`)
    }

    if (t.length) out.push({ level: l, teile: t })
  }
  return out
}
