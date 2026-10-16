/** Lucide-Icons in Elemente mit data-icon einsetzen (nur die genutzten, damit das Paket klein bleibt) */
import {
  ArrowLeft, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Gamepad2, Gauge, House,
  Music, Pause, Play, RotateCcw, Settings, Trash2, Trophy, Vibrate, Volume2, VolumeX, createElement, type IconNode,
  Wand, Flag, Zap, Skull, Undo2, Ghost, TrendingUp, Ruler, SlidersHorizontal,
} from 'lucide'

const ICONS: Record<string, IconNode> = {
  ArrowLeft, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Gamepad2, Gauge, House,
  Music, Pause, Play, RotateCcw, Settings, Trash2, Trophy, Vibrate, Volume2, VolumeX,
  Wand, Flag, Zap, Skull, Undo2, Ghost, TrendingUp, Ruler, SlidersHorizontal,
}

export function setIcon(el: HTMLElement, name: string) {
  const node = ICONS[name]
  if (!node) return
  el.querySelector(':scope > svg')?.remove()
  const svg = createElement(node, { 'stroke-width': 2.2, 'aria-hidden': 'true' })
  el.prepend(svg)
  el.dataset.icon = name
}

export function mountIcons(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon!))
}
