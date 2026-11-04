/** Lucide-Icons in Elemente mit data-icon einsetzen (nur die genutzten, damit das Paket klein bleibt) */
import {
  ArrowLeft, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Gamepad2, Gauge, House,
  Music, Pause, Play, RotateCcw, Settings, Trash2, Trophy, Vibrate, Volume2, VolumeX, createElement, type IconNode,
  Wand, Flag, Zap, Skull, Undo2, Ghost, TrendingUp, Ruler, SlidersHorizontal, Palette, Check, Lock, Shield, Hourglass, Scissors, Box, ListOrdered, Eraser, Utensils, Magnet, Shovel, Sun, Pickaxe, Medal, Video,
  Users, Plus, Share2, Heart, LogIn, LogOut, Crown, Swords, Handshake, UserPlus, WifiOff, X, Timer, Pencil, Globe,
  MessageCircle, Send, Ban, Clock, Bell, BellOff, Shuffle, RefreshCw, CircleAlert, Map as MapIcon,
  Sprout, TreePalm, Snowflake, Sparkles, Flame,
} from 'lucide'

const ICONS: Record<string, IconNode> = {
  ArrowLeft, ChartColumn, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Gamepad2, Gauge, House,
  Music, Pause, Play, RotateCcw, Settings, Trash2, Trophy, Vibrate, Volume2, VolumeX,
  Wand, Flag, Zap, Skull, Undo2, Ghost, TrendingUp, Ruler, SlidersHorizontal, Palette, Check, Lock, Shield, Hourglass, Scissors, Box, ListOrdered, Eraser, Utensils, Magnet, Shovel, Sun, Pickaxe, Medal, Video,
  Users, Plus, Share2, Heart, LogIn, LogOut, Crown, Swords, Handshake, UserPlus, WifiOff, X, Timer, Pencil, Globe,
  MessageCircle, Send, Ban, Clock, Bell, BellOff, Shuffle, RefreshCw, CircleAlert, Map: MapIcon,
  Sprout, TreePalm, Snowflake, Sparkles, Flame,
}

export function setIcon(el: HTMLElement, name: string) {
  const node = ICONS[name]
  if (!node) return
  el.querySelector(':scope > svg')?.remove()
  const svg = createElement(node, { 'stroke-width': 2.2, 'aria-hidden': 'true' })
  el.prepend(svg)
  el.dataset.icon = name
}

/** Symbol je Welt (Hall of Snakes: in welcher Welt der Rekord gespielt wurde, seit 1.55.3) */
export const WELT_ICON: Record<string, string> = {
  wiese: 'Sprout',
  wueste: 'TreePalm',
  winter: 'Snowflake',
  bergwerk: 'Pickaxe',
  zauberwald: 'Sparkles',
  gruselwald: 'Ghost',
  vulkan: 'Flame',
}

export function mountIcons(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => setIcon(el, el.dataset.icon!))
}
