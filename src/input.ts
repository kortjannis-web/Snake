/**
 * Steuerung: ein Fingermodus auf dem ganzen Bildschirm. Kurz wischen oder
 * den Finger liegen lassen und weiterziehen (durchdruecken): jede klare
 * waagrechte oder senkrechte Linie ist eine Richtung, schraege Striche
 * zaehlen nicht. Dazu Pfeiltasten/WASD und optional ein Steuerkreuz.
 */
import type { Dir } from './game/types'

const KEYS: Record<string, Dir> = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
}

/** So weit (px) muss die Linie gehen und hoechstens so schraeg (Grad neben der
 *  Achse) sein, damit sie als Richtung zaehlt. Schraeger = keine Wende */
export const WISCH_WEG = 18
export const WISCH_WINKEL = 32
const WISCH_TAN = Math.tan((WISCH_WINKEL * Math.PI) / 180)

export type InputHandlers = {
  dir: (d: Dir) => void
  pause: () => void
  /** Tippen ohne Wischen (z. B. zum Starten) */
  tap: () => void
  enabled: () => boolean
}

export function bindInput(surface: HTMLElement, h: InputHandlers) {
  let t: { x: number; y: number; id: number; moved: boolean } | null = null

  surface.addEventListener('pointerdown', (e) => {
    if (!h.enabled()) return
    if ((e.target as Element).closest('button, a, input, .no-swipe')) return
    t = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
  })
  surface.addEventListener(
    'pointermove',
    (e) => {
      if (!t || e.pointerId !== t.id || !h.enabled()) return
      const dx = e.clientX - t.x
      const dy = e.clientY - t.y
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      // Erst ab einer Mindestlaenge, und nur wenn die Linie klar waagrecht oder senkrecht ist.
      // Danach wird von hier aus neu gemessen: so geht es ohne Absetzen weiter
      const weg = Math.hypot(dx, dy)
      if (weg < WISCH_WEG) return
      if (e.cancelable) e.preventDefault()
      if (Math.min(ax, ay) <= Math.max(ax, ay) * WISCH_TAN) {
        t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
        h.dir(ax > ay ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u')
      } else if (weg > WISCH_WEG * 2.5) {
        // Lange schraege Linie: verwerfen und von hier neu messen
        t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
      }
    },
    { passive: false },
  )
  const up = (e: PointerEvent) => {
    if (!t || e.pointerId !== t.id) return
    if (!t.moved && h.enabled()) h.tap()
    t = null
  }
  surface.addEventListener('pointerup', up)
  surface.addEventListener('pointercancel', () => (t = null))

  window.addEventListener('keydown', (e) => {
    if (e.repeat && !KEYS[e.key]) return
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      h.pause()
      return
    }
    if (!h.enabled()) return
    const d = KEYS[e.key]
    if (d) {
      e.preventDefault()
      h.dir(d)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      h.tap()
    }
  })
}

/** Steuerkreuz: Tasten reagieren schon beim Herunterdruecken */
export function bindDpad(pad: HTMLElement, onDir: (d: Dir) => void) {
  pad.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      onDir(b.dataset.dir as Dir)
    })
  })
}
