import type { Cause, Side, Unlock } from '../game/types'
import type { Mini } from './minis'

export const CAUSE: Record<Cause, string> = {
  rand: 'Gegen den Rand gestoßen',
  selbst: 'In den eigenen Schwanz gebissen',
  mauer: 'Gegen eine Mauer gelaufen',
  teich: 'In den Teich gefallen',
  gift: 'Giftapfel gegessen',
  falle: 'In die Bärenfalle getappt',
  wolke: 'In die Giftwolke geraten',
  ameise: 'Mit der Ameise zusammengestoßen',
}

export const SIDE: Record<Side, string> = { top: 'oben', bottom: 'unten', left: 'links', right: 'rechts' }

export const UNLOCK: Record<Unlock, { title: string; text: string; mini: Mini }> = {
  mauer: { title: 'Mauern', text: 'Nach jedem Apfel stehen sie woanders und werden mit der Zeit länger.', mini: 'mauer' },
  teich: { title: 'Teiche', text: 'Wasser bleibt liegen. Nicht hineinschwimmen!', mini: 'teich' },
  gebiet: { title: 'Neues Gebiet', text: 'Alle 30 Level wächst die Karte um einen halben Bildschirm.', mini: 'gebiet' },
  gift: { title: 'Giftäpfel', text: 'Achte auf die verschimmelte Ecke. Ein Biss und es ist vorbei.', mini: 'gift' },
  falle: { title: 'Bärenfallen', text: 'Sie schnappen genau in deiner Bahn auf. Rechtzeitig abbiegen!', mini: 'falle' },
  wolke: { title: 'Giftwolken', text: 'Sie wachsen alle 5 Sekunden. Abstand halten.', mini: 'wolke' },
  ameise: { title: 'Ameisen', text: 'Krabbeln geradeaus bis zum Rand und klauen Äpfel.', mini: 'ameise' },
}

export const HELP: { mini: Mini; title: string; ab?: string; text: string }[] = [
  { mini: 'schlange', title: 'Steuerung', text: 'Wische in die Richtung, in die die Schlange laufen soll. Am PC mit den Pfeiltasten oder WASD, Pause mit Esc oder P. Wer gegen ein Hindernis läuft, bleibt kurz stehen und kann noch abbiegen.' },
  { mini: 'apfel', title: 'Äpfel', text: 'Jeder Apfel ist ein Level. Die Schlange wird länger und mit der Zeit etwas schneller. Liegt der Apfel außerhalb des Bildes, zeigt ein Pfeil am Rand die Richtung.' },
  { mini: 'mauer', title: 'Mauern', ab: 'ab Level 8', text: 'Erst 2 Felder lang, alle 8 Level eins mehr. Bei 6 Feldern kommt eine neue Mauer dazu, die wieder mit 2 anfängt. Nach jedem Apfel stehen sie woanders.' },
  { mini: 'teich', title: 'Teiche', ab: 'ab Level 15', text: 'Alle 15 Level entsteht ein Teich und bleibt liegen. Die Teiche werden langsam größer. Wird es zu voll, trocknet der älteste aus.' },
  { mini: 'gebiet', title: 'Neues Gebiet', ab: 'alle 30 Level', text: 'Die Karte wächst in eine zufällige Richtung um genau einen halben Bildschirm. Ab Level 300 bleibt sie so groß.' },
  { mini: 'gift', title: 'Giftäpfel', ab: 'ab Level 50', text: 'Sehen aus wie Äpfel, haben aber eine verschimmelte Ecke. Wer einen isst, hat verloren.' },
  { mini: 'falle', title: 'Bärenfallen', ab: 'ab Level 100', text: 'Etwa alle 4 bis 5 Level schnappt eine Falle 5 bis 8 Felder vor dir auf, genau in deiner Bahn. Nach 25 Sekunden klappt sie zu.' },
  { mini: 'wolke', title: 'Giftwolken', ab: 'ab Level 150', text: 'Beginnen auf einem Feld und wachsen alle 5 Sekunden: erst ein Kreuz, dann ein Quadrat, dann noch größer. Kurz vorher pulsiert der Rand. Danach lösen sie sich auf.' },
  { mini: 'ameise', title: 'Ameisen', ab: 'ab Level 200', text: 'Laufen alle 3 Sekunden ein Feld geradeaus und verschwinden am Rand. Nicht hineinbeißen, sie klauen auch mal einen Apfel.' },
  { mini: 'gebiet', title: 'Immer mehr los', ab: 'ab Level 150', text: 'Ab Level 150 ist immer mindestens eine Gefahr unterwegs, ab 200 mindestens zwei, ab 300 drei. Es geht endlos weiter: Wie weit kommst du?' },
]
