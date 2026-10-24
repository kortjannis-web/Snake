import { describe, expect, it } from 'vitest'
import { Game } from '../src/game/game'

const SW = 15
const SH = 30

/** Breite des Wegs: jedes Lichtungsfeld (ausserhalb der Bloecke) hat einen Nachbarn quer zur Richtung, der auch begehbar ist */
function zuSchmal(g: Game) {
  const imBlock = (x: number, y: number) => g.blocks.some((b) => b.x === Math.floor(x / g.bw) && b.y === Math.floor(y / g.bh))
  const aussen = g.extra.filter((c) => !imBlock(c.x, c.y))
  // In einer 2x2-Gruppe begehbarer Felder? Dann ist dort mindestens 2 breit
  const drin = (x: number, y: number) => g.inside({ x, y })
  return aussen.filter((c) => ![[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => drin(c.x + dx, c.y + dy) && drin(c.x + dx + 1, c.y + dy) && drin(c.x + dx, c.y + dy + 1) && drin(c.x + dx + 1, c.y + dy + 1)))
}

describe('Lichtungen im Wald', () => {
  it('Zauber- und Gruselwald: oft Lichtungen, immer mindestens 2 breit, Karte bleibt zusammenhaengend', () => {
    let erreichbar = 0
    let deko = 0
    for (const welt of ['zauberwald', 'gruselwald'])
      for (let seed = 1; seed <= 40; seed++) {
        const g = new Game({ screenW: SW, screenH: SH, seed, welt, zufallsWelt: true, startLevel: 60 })
        if (g.lichtungen.length) erreichbar++
        if (g.lichtungDeko.length) deko++
        expect(zuSchmal(g)).toEqual([])
        expect((g as unknown as { zusammenhaengend: () => boolean }).zusammenhaengend()).toBe(true)
        // Deko-Lichtungen liegen nicht an der Karte
        for (const l of g.lichtungDeko) for (const c of l) expect(g.inside(c)).toBe(false)
      }
    expect(erreichbar).toBeGreaterThan(40)
    expect(deko).toBeGreaterThan(15)
  })

  it('andere Welten und Sandbox haben keine', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(new Game({ screenW: SW, screenH: SH, seed, welt: 'wiese', zufallsWelt: true }).lichtungen).toEqual([])
      expect(new Game({ screenW: SW, screenH: SH, seed, welt: 'zauberwald' }).lichtungen).toEqual([])
    }
  })

  it('laeuft eine lange Runde im Gruselwald ohne Fehler', () => {
    const g = new Game({ screenW: SW, screenH: SH, seed: 7, welt: 'gruselwald', zufallsWelt: true, startLevel: 150 })
    expect(g.blocks.length).toBeGreaterThan(2)
    expect(g.lichtungen.every((c) => g.inside(c))).toBe(true)
  })
})

describe('Wüste: runde Ecken', () => {
  it('nimmt etwa 1 % mehr weg als die anderen Welten, die Karte bleibt zusammenhaengend', () => {
    const weg = (welt: string) => {
      let n = 0
      for (let seed = 1; seed <= 40; seed++) {
        const g = new Game({ screenW: SW, screenH: SH, seed, welt, zufallsWelt: true })
        expect((g as unknown as { zusammenhaengend: () => boolean }).zusammenhaengend()).toBe(true)
        n += g.aus.length / (g.blocks.length * g.bw * g.bh)
      }
      return n / 40
    }
    const wueste = weg('wueste')
    const wiese = weg('wiese')
    expect(wueste - wiese).toBeGreaterThan(0.005)
    expect(wueste).toBeLessThan(0.07)
  })
})
