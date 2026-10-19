import { describe, expect, it } from 'vitest'
import { belohnung, trophaeen } from '../src/multi/ui'
import { nameErlaubt, nameGueltig } from '../src/online'

describe('Namen', () => {
  it('normale Namen sind erlaubt', () => {
    for (const n of ['Anna', 'Bob', 'Jannis', 'Max 2', 'Lea-Marie', 'Ömer']) expect(nameErlaubt(n)).toBe(true)
  })
  it('Schimpfwoerter fallen auf, auch mit Ziffern, Zeichen oder Grossbuchstaben', () => {
    for (const n of ['Arschloch', 'F1ck3r', 'H.U.R.E', 'n4zi', 'SHIT']) expect(nameErlaubt(n)).toBe(false)
  })
  it('Laenge 2 bis 16', () => {
    expect(nameGueltig('A')).toBe(false)
    expect(nameGueltig('Ab')).toBe(true)
    expect(nameGueltig('x'.repeat(17))).toBe(false)
  })
})

describe('Belohnung im Mehrspieler', () => {
  it('Sieg 30 Aepfel je Gegner, Mitspielen 5, Koop halber Level', () => {
    expect(belohnung('vs', true, 2, 1)).toBe(30)
    expect(belohnung('jagd', true, 4, 1)).toBe(90)
    expect(belohnung('royale', false, 4, 1)).toBe(5)
    expect(belohnung('koop', false, 2, 41)).toBe(20)
    // Trophaeen: eine je besiegtem Gegner, nur fuer den Sieger
    expect([2, 3, 4].map((n) => trophaeen(true, n))).toEqual([1, 2, 3])
    expect(trophaeen(false, 4)).toBe(0)
    // Mit 3 Leben doppelt so viele
    expect([2, 3, 4].map((n) => trophaeen(true, n, 3))).toEqual([2, 4, 6])
    expect(trophaeen(false, 4, 3)).toBe(0)
    expect(belohnung('koop', false, 2, 3)).toBe(5)
  })
})
