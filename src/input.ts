/**
 * Steuerung: Wischen auf dem ganzen Bildschirm (mehrere Wischer ohne
 * Absetzen moeglich, wie im Telefon), Pfeiltasten/WASD, optional ein
 * Steuerkreuz am unteren Rand.
 */
import type { Dir } from './game/types'

const KEYS: Record<string, Dir> = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
}

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
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
      if (e.cancelable) e.preventDefault()
      t = { x: e.clientX, y: e.clientY, id: t.id, moved: true }
      h.dir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u')
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
