import type { Config } from '../game/rules'
import type { Cause, Side, Unlock } from '../game/types'
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
})

export const help = (c: Config): { mini: Mini; title: string; ab?: string; text: string }[] => [
  { mini: 'schlange', title: 'Steuerung', text: 'Wische in die Richtung, in die die Schlange laufen soll. Am PC mit den Pfeiltasten oder WASD, Pause mit Esc oder P. Wer gegen ein Hindernis läuft, bleibt kurz stehen und kann noch abbiegen.' },
  { mini: 'apfel', title: 'Äpfel', text: 'Jeder Apfel ist ein Level. Die Schlange wird länger und mit der Zeit etwas schneller. Liegt der Apfel außerhalb des Bildes, zeigt ein Pfeil am Rand die Richtung.' },
  { mini: 'gebiet', title: 'Neues Gebiet', ab: `alle ${c.gebietAlle} Level`, text: `Die Karte besteht aus Blöcken von je einem halben Bildschirm. Alle ${c.gebietAlle} Level setzt sich ein neuer Block an einer zufälligen Stelle an, wie bei Minecraft. Ab Level ${c.gebietBis} wächst sie nicht mehr.` },
  { mini: 'mauer', title: 'Mauern', ab: `ab Level ${c.mauerAb}`, text: `Erst 2 Felder lang, alle ${c.mauerSchritt} Level eins mehr. Bei ${c.mauerMax} Feldern kommt eine neue Mauer dazu, die wieder mit 2 anfängt. Nach jedem Apfel stehen sie woanders.` },
  { mini: 'teich', title: 'Teiche', ab: `ab Level ${c.teichAb}`, text: `Alle ${c.teichAlle} Level entsteht ein Teich und bleibt liegen. Die Teiche werden langsam größer. Wird es zu voll, trocknet der älteste aus.` },
  { mini: 'gift', title: 'Giftäpfel', ab: `ab Level ${c.giftAb}`, text: 'Sehen aus wie Äpfel, haben aber eine verschimmelte Ecke. Wer einen isst, hat verloren.' },
  { mini: 'falle', title: 'Bärenfallen', ab: `ab Level ${c.falleAb}`, text: `Etwa alle ${c.falleMin} bis ${c.falleMax} Level schnappt eine Falle ${c.falleAbstandMin} bis ${c.falleAbstandMax} Felder vor dir auf, genau in deiner Bahn. Nach ${c.falleDauer} Sekunden klappt sie zu.` },
  { mini: 'baum', title: 'Bäume', ab: `ab Level ${c.baumAb}`, text: `Ein umgefallener Tannenbaum: zwei Felder Stamm, dann die Krone (zwei Felder breit, dann die Spitze). Bleibt für immer liegen, alle ${c.baumAlle} Level kommt ein neuer dazu. Berühren beendet das Spiel.` },
  { mini: 'wolke', title: 'Giftwolken', ab: `ab Level ${c.wolkeAb}`, text: `Beginnen auf einem Feld und wachsen alle ${c.wolkeTakt} Sekunden: erst ein Kreuz, dann ein Quadrat, dann noch größer. Kurz vorher pulsiert der Rand. Wer hineingerät, fällt ${c.wolkeZurueck} Level zurück und ist danach kurz geschützt (die Schlange blinkt).` },
  { mini: 'frosch', title: 'Frösche', ab: `ab Level ${c.froschAb}`, text: `Hüpfen alle ${c.froschSprung} Sekunden ein Feld in Blickrichtung. Kurz vorher machen sie sich bereit. Nach der Landung drehen sie sich manchmal um (${c.froschWende} %). In die Schlange springen sie nie, über den Rand hüpfen sie weg. Hineinbeißen beendet das Spiel.` },
  { mini: 'haus', title: 'Häuser', ab: `ab Level ${c.hausAb}`, text: `Bleiben stehen, alle ${c.hausAlle} Level kommt eins dazu (2 × 3 Felder oder mit einer Ecke). Jedes Haus hat vier Fenster. Nach jedem Apfel leuchtet ein anderes, das Licht reicht ${c.lichtWeite} Felder weit und fällt nie auf die Schlange. Haus berühren beendet das Spiel, ins Licht laufen kostet ${c.lichtZurueck} Level.` },
  { mini: 'turm', title: 'Jägertürme', ab: `ab Level ${c.turmAb}`, text: `2 × 2 Felder, mit einem Lichtkegel (2 breit, ${c.kegelLaenge} lang). Jede Runde dreht er sich im Uhrzeigersinn weiter. Die Schlange wirft Schatten: hinter ihr ist kein Licht. Im Kegel: ${c.kegelZurueck} Level zurück. Turm berühren beendet das Spiel.` },
  { mini: 'gebiet', title: 'Immer mehr los', ab: `ab Level ${c.ereignis1Ab}`, text: `Ab Level ${c.ereignis1Ab} ist immer mindestens eine Gefahr (Falle, Wolke, Frosch) unterwegs, ab ${c.ereignis2Ab} mindestens zwei, ab ${c.ereignis3Ab} drei. Es geht endlos weiter: Wie weit kommst du?` },
]
