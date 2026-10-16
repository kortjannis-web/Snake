import type { Config } from '../game/rules'
import type { Cause, SandboxObjekt, Side, Unlock } from '../game/types'
import type { Mini } from './minis'

export const CAUSE: Record<Cause, string> = {
  rand: 'Gegen den Rand gestoßen',
  selbst: 'In den eigenen Schwanz gebissen',
  mauer: 'Gegen eine Mauer gelaufen',
  teich: 'In den Teich gefallen',
  gift: 'Giftapfel gegessen',
  falle: 'In die Bärenfalle getappt',
  frosch: 'Mit dem Frosch zusammengestoßen',
  baum: 'Gegen einen Baum gelaufen',
  haus: 'Gegen ein Haus gelaufen',
  turm: 'Gegen einen Jägerturm gelaufen',
  gegner: 'Mit einer Gegner-Schlange zusammengestoßen',
  lava: 'In die Lava gefahren',
}

export const OBJEKT_NAME: Record<SandboxObjekt, string> = {
  mauer: 'Mauer',
  teich: 'Teich',
  gift: 'Giftapfel',
  baum: 'Baum',
  haus: 'Haus',
  turm: 'Turm',
  falle: 'Falle',
  wolke: 'Wolke',
  frosch: 'Frosch',
  gegner: 'Gegner rot',
  lila: 'Gegner lila',
  ameise: 'Ameise',
  lava: 'Lava',
}

export const SIDE: Record<Side, string> = { top: 'oben', bottom: 'unten', left: 'links', right: 'rechts' }

export const unlockText = (c: Config): Record<Unlock, { title: string; text: string; mini: Mini }> => ({
  mauer: { title: 'Mauern', text: 'Nach jedem Apfel stehen sie woanders und werden mit der Zeit länger.', mini: 'mauer' },
  teich: { title: 'Teiche', text: 'Wasser bleibt liegen. Nicht hineinschwimmen!', mini: 'teich' },
  gebiet: { title: 'Neues Gebiet', text: `Alle ${c.gebietAlle} Level kommt ein Block Karte dazu.`, mini: 'gebiet' },
  gift: { title: 'Giftäpfel', text: 'Achte auf die verschimmelte Ecke. Ein Biss und es ist vorbei.', mini: 'gift' },
  falle: { title: 'Bärenfallen', text: 'Sie schnappen genau in deiner Bahn auf. Rechtzeitig abbiegen!', mini: 'falle' },
  wolke: { title: 'Giftwolken', text: `Sie wachsen alle ${c.wolkeTakt} Sekunden. Wer hineingerät, fällt ${c.wolkeZurueck} Level zurück.`, mini: 'wolke' },
  frosch: { title: 'Frösche', text: 'Hüpfen in Blickrichtung, drehen sich ab und zu und schnappen sich auch mal den Apfel.', mini: 'frosch' },
  baum: { title: 'Bäume', text: `Ein Baum ist umgefallen und bleibt liegen. Alle ${c.baumAlle} Level kommt einer dazu.`, mini: 'baum' },
  haus: { title: 'Häuser', text: `Nicht anfahren! Aus einem Fenster scheint Licht: wer hineinläuft, fällt ${c.lichtZurueck} Level zurück.`, mini: 'haus' },
  turm: { title: 'Jägertürme', text: `Ihr Lichtkegel dreht sich jede Runde weiter. Im Licht: ${c.kegelZurueck} Level zurück.`, mini: 'turm' },
  gegner: { title: 'Gegner-Schlangen', text: 'Sie fliehen vor dir. Kessel sie mit deinem Körper ein, dann bringen sie Äpfel. Nicht anrempeln!', mini: 'gegner' },
  lila: { title: 'Lila Gegner', text: `Seltener, länger (${c.lilaLaenge}) und ${c.lilaTempo} % schneller. Schwerer einzukesseln, bringen dafür mehr Äpfel.`, mini: 'lila' },
  ameise: { title: 'Ameisen', text: `Sie sitzen still. Kommst du ihnen auf ${c.ameiseRadius} Felder nahe, krabbeln sie auf dich zu. Ein Biss kostet ${c.ameiseZurueck} Level, dein Kopf zertritt sie.`, mini: 'ameise' },
  lava: { title: 'Lava', text: `Beginnt mit einem Feld und breitet sich jeden ${c.lavaWachsen}. Apfel aus. Hineinfahren ist tödlich.`, mini: 'lava' },
})

/** Namen der Apfel-Stufen (Farbe nach Wert) */
export const STUFEN_NAME = ['Rot', 'Orange', 'Gelb', 'Grün', 'Türkis', 'Blau', 'Lila', 'Rosa', 'Blau-Rosa', 'Lila-Rosa']
export const stufenName = (stufe: number) => STUFEN_NAME[Math.min(STUFEN_NAME.length, Math.max(1, stufe)) - 1]

export const help = (c: Config): { mini: Mini; title: string; ab?: string; text: string }[] => [
  { mini: 'schlange', title: 'Steuerung', text: 'Wische in die Richtung, in die die Schlange laufen soll. Am PC mit den Pfeiltasten oder WASD, Pause mit Esc oder P. Wer gegen ein Hindernis läuft, bleibt kurz stehen und kann noch abbiegen.' },
  { mini: 'apfel', title: 'Äpfel', text: 'Jeder Apfel ist ein Level. Die Schlange wird länger und mit der Zeit etwas schneller. Liegt der Apfel außerhalb des Bildes, zeigt ein Pfeil am Rand die Richtung.' },
  { mini: 'aepfel', title: 'Äpfel sind die Währung', text: `Jeder gegessene Apfel landet in deinem Vorrat, damit kaufst du Skins (Startmenü → Skins). Ab Level ${c.apfelWertAlle} ist jeder Apfel doppelt so viel wert, ab ${c.apfelWertAlle * 2} dreifach und so weiter. Mit jedem Wert bekommt er eine andere Farbe: Rot, Orange (×2), Gelb, Grün, Türkis, Blau, Lila, Rosa, dann Blau-Rosa und Lila-Rosa. Im Kreativ-Modus wird nichts gesammelt.` },
  { mini: 'gebiet', title: 'Minikarte', text: 'Sobald die Karte größer als ein Bildschirm ist, zeigt unten links eine kleine Karte die Blöcke: grün der Block, in dem du bist, in Apfelfarbe der Block mit dem Apfel.' },
  { mini: 'schild', title: 'Power-up: Schild', ab: `ab Level ${c.powerAb}`, text: 'Fängt einen Aufprall, einen Giftapfel oder einen Rückschlag ab. Die Schlange gleitet dann kurz durch das Hindernis. Bis zu 3 Schilde sammeln sich.' },
  { mini: 'zeitlupe', title: 'Power-up: Zeitlupe', ab: `ab Level ${c.powerAb}`, text: `Die Schlange ist ${c.effektDauer} Sekunden lang langsamer.` },
  { mini: 'geist', title: 'Power-up: Geist', ab: `ab Level ${c.powerAb}`, text: `${c.geistDauer} Sekunden lang durch alle Hindernisse und die eigene Schlange, ohne Rückschläge. Nur der Kartenrand hält dich auf.` },
  { mini: 'schere', title: 'Power-up: Schere', ab: `ab Level ${c.powerAb}`, text: `Schneidet ${c.schereLaenge} Glieder ab, aber nur für einen Apfel: mit dem nächsten Apfel wachsen sie wieder nach (mindestens 3 Glieder bleiben). Power-ups liegen ${c.powerDauer} Sekunden und blinken kurz vor dem Verschwinden.` },
  { mini: 'gebiet', title: 'Neues Gebiet', ab: `alle ${c.gebietAlle} Level`, text: `Die Karte besteht aus Blöcken von je einem halben Bildschirm. Alle ${c.gebietAlle} Level setzt sich ein neuer Block an einer zufälligen Stelle an, wie bei Minecraft. Ab Level ${c.gebietBis} wächst sie nicht mehr.` },
  { mini: 'mauer', title: 'Mauern', ab: `ab Level ${c.mauerAb}`, text: `Erst 2 Felder lang, alle ${c.mauerSchritt} Level eins mehr. Bei ${c.mauerMax} Feldern kommt eine neue Mauer dazu, die wieder mit 2 anfängt. Nach jedem Apfel stehen sie woanders.` },
  { mini: 'teich', title: 'Teiche', ab: `ab Level ${c.teichAb}`, text: `Alle ${c.teichAlle} Level entsteht ein Teich und bleibt liegen. Die Teiche werden langsam größer. Wird es zu voll, trocknet der älteste aus.` },
  { mini: 'gift', title: 'Giftäpfel', ab: `ab Level ${c.giftAb}`, text: 'Sehen aus wie Äpfel, haben aber eine verschimmelte Ecke. Wer einen isst, hat verloren.' },
  { mini: 'falle', title: 'Bärenfallen', ab: `ab Level ${c.falleAb}`, text: `Etwa alle ${c.falleMin} bis ${c.falleMax} Level schnappt eine Falle ${c.falleAbstandMin} bis ${c.falleAbstandMax} Felder vor dir auf, genau in deiner Bahn. Nach ${c.falleDauer} Sekunden klappt sie zu.` },
  { mini: 'gegner', title: 'Gegner-Schlangen', ab: `ab Level ${c.gegnerAb}`, text: `Ab und zu taucht eine rote Schlange auf (3 bis 4 lang, ab Level ${c.gegnerAb + 100} auch zwei, dann drei). Sie ist halb so schnell wie du und weicht dir aus, so gut sie kann. Kessel sie mit deinem Körper ein: Hat sie keinen Ausweg mehr, zerplatzt sie und bringt so viele Äpfel, wie sie lang ist (mal Apfelwert). Sie versucht sich zu befreien, solange es geht. Alle ${c.gegnerWachsen} Sekunden wird sie ein Glied länger (bis ${c.gegnerMaxLaenge}). Mit dem Kopf in sie hineinfahren beendet das Spiel.` },
  { mini: 'lila', title: 'Lila Gegner', ab: `ab Level ${c.lilaAb}`, text: `${c.lilaChance} % der neuen Gegner sind lila: Sie starten mit ${c.lilaLaenge} Gliedern, sind ${c.lilaTempo} % schneller als die roten, schauen noch böser und werden bis ${c.lilaMaxLaenge} lang. Einkesseln bringt so viele Äpfel, wie sie lang sind.` },
  { mini: 'baum', title: 'Bäume', ab: `ab Level ${c.baumAb}`, text: `Ein umgefallener Tannenbaum: zwei Felder Stamm, dann die Krone (zwei Felder breit, dann die Spitze). Bleibt für immer liegen, alle ${c.baumAlle} Level kommt ein neuer dazu. Berühren beendet das Spiel.` },
  { mini: 'wolke', title: 'Giftwolken', ab: `ab Level ${c.wolkeAb}`, text: `Beginnen auf einem Feld und wachsen alle ${c.wolkeTakt} Sekunden: erst ein Kreuz, dann ein Quadrat, dann noch größer. Kurz vorher pulsiert der Rand. Wer hineingerät, fällt ${c.wolkeZurueck} Level zurück und ist danach kurz geschützt (die Schlange blinkt).` },
  { mini: 'frosch', title: 'Frösche', ab: `ab Level ${c.froschAb}`, text: `Hüpfen alle ${c.froschSprung} Sekunden ein Feld in Blickrichtung. Kurz vorher machen sie sich bereit. Nach der Landung drehen sie sich manchmal um (${c.froschWende} %). In die Schlange springen sie nie, über den Rand hüpfen sie weg. Hineinbeißen beendet das Spiel.` },
  { mini: 'haus', title: 'Hütten und Häuser', ab: `ab Level ${c.hausAb}`, text: `Bleiben stehen, alle ${c.hausAlle} Level kommt eins dazu: erst kleine Hütten (2 × 2, Licht ein Feld kürzer), ab Level ${c.hausGrossAb} große Häuser (2 × 3 Felder oder mit einer Ecke). Jedes Haus hat vier Fenster. Nach jedem Apfel leuchtet ein anderes, das Licht reicht ${c.lichtWeite} Felder weit und fällt nie auf die Schlange. Haus berühren beendet das Spiel, ins Licht laufen kostet ${c.lichtZurueck} Level.` },
  { mini: 'turm', title: 'Jägertürme', ab: `ab Level ${c.turmAb}`, text: `2 × 2 Felder, mit einem Lichtkegel (2 breit, ${c.kegelLaenge} lang). Jede Runde dreht er sich im Uhrzeigersinn weiter. Die Schlange wirft Schatten: hinter ihr ist kein Licht. Im Kegel: ${c.kegelZurueck} Level zurück. Turm berühren beendet das Spiel.` },
  { mini: 'ameise', title: 'Ameisen', ab: `ab Level ${c.ameiseAb}`, text: `Alle ${c.ameiseMin} bis ${c.ameiseMax} Level setzt sich eine Ameise irgendwo hin (höchstens ${c.ameiseAnzahl}) und chillt. Kommt die Schlange in ihren Umkreis (${c.ameiseRadius} Felder, auch schräg), bemerkt sie dich (rotes Ausrufezeichen) und krabbelt langsam auf das nächste Glied zu, bis du wieder weg bist. Ist sie direkt daneben, beißt sie: ${c.ameiseZurueck} Level zurück. Danach geht sie satt nach Hause. Mit dem Kopf zertrittst du sie.` },
  { mini: 'lava', title: 'Lava', ab: `ab Level ${c.lavaAb}`, text: `Alle ${c.lavaAlle} Level bricht ein Lavasee aus, erst ein einziges Feld. Jeden ${c.lavaWachsen}. Apfel breitet er sich um ein Feld in eine zufällige Richtung aus, nie in die Schlange und nie direkt vor den Kopf, und hört bei ${Math.min(c.lavaMin, c.lavaMax)} bis ${Math.max(c.lavaMin, c.lavaMax)} Feldern auf. Hineinfahren beendet das Spiel.` },
  { mini: 'gebiet', title: 'Immer mehr los', ab: `ab Level ${c.ereignis1Ab}`, text: `Ab Level ${c.ereignis1Ab} ist immer mindestens eine Gefahr (Falle, Wolke, Frosch) unterwegs, ab ${c.ereignis2Ab} mindestens zwei, ab ${c.ereignis3Ab} drei. Es geht endlos weiter: Wie weit kommst du?` },
]
