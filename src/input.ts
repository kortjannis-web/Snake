/**
 * Steuerung: Wischen auf dem ganzen Bildschirm (mehrere Wischer ohne
 * Absetzen moeglich, wie im Telefon) oder Zeichnen (Finger bleibt unten,
 * die Schlange folgt der gezeichneten Linie), Pfeiltasten/WASD, optional
 * ein Steuerkreuz am unteren Rand.
 */
import type { Dir } from './game/types'

const KEYS: Record<string, Dir> = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
}

export type Steuerung = 'wischen' | 'zeichnen'

/** Zeichnen: so weit (px) muss die Linie gehen und hoechstens so schraeg (Grad
 *  neben der Achse) sein, damit sie als Richtung zaehlt. Schraeger = keine Wende */
export const ZEICHNEN_WEG = 26
export const ZEICHNEN_WINKEL = 28
const ZEICHNEN_TAN = Math.tan((ZEICHNEN_WINKEL * Math.PI) / 180)

export type InputHandlers = {
  dir: (d: Dir) => void
  steuerung: () => Steuerung
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
      if (h.steuerung() === 'zeichnen') {
        // Zeichnen: erst ab einer Mindestlaenge, und nur wenn die Linie klar waagrecht oder senkrecht ist
        const weg = Math.hypot(dx, dy)
        if (weg < ZEICHNEN_WEG) return
        if (e.cancelable) e.preventDefault()
        if (Math.min(ax, ay) <= Math.max(ax, ay) * ZEICHNEN_TAN) {
          t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
          h.dir(ax > ay ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u')
        } else if (weg > ZEICHNEN_WEG * 2.5) {
          // Lange schraege Linie: verwerfen und von hier neu messen
          t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
        }
        return
      }
      if (Math.max(ax, ay) < 18) return
      if (e.cancelable) e.preventDefault()
      t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
      h.dir(ax > ay ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u')
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
