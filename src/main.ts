/**
 * Snake Endlos: App-Rahmen mit Menues, Spielschleife, Toenen und Speicher.
 *
 * Zustaende: home (Startmenue, im Hintergrund spielt der Autopilot), ready
 * (Spiel aufgebaut, wartet auf den ersten Wischer), play, paused, over.
 * Unterseiten (Anleitung, Statistik, Optionen) liegen darueber und kehren
 * zum vorherigen Bildschirm zurueck.
 */
import './fonts.css'
import './styles.css'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { audio } from './audio'
import { autopilot } from './game/autopilot'
import { Game } from './game/game'
import { GEBIET_ALLE, GEBIET_BIS } from './game/rules'
import type { Dir, GameEvent, Side } from './game/types'
import { haptic } from './haptics'
import { bindDpad, bindInput } from './input'
import { Renderer } from './render/renderer'
import { drawApfel } from './render/sprites'
import { saveSettings, saveStats, resetStats, settings, stats } from './storage'
import { mountIcons, setIcon } from './ui/icons'
import { drawMini, MINI_FOR_CAUSE } from './ui/minis'
import { CAUSE, HELP, SIDE, UNLOCK } from './ui/texts'

type Mode = 'home' | 'ready' | 'play' | 'paused' | 'over'
type Page = 'help' | 'stats' | 'settings'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const nativ = Capacitor.isNativePlatform()
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

const app = $('app')
const stage = $('stage')
const canvas = $<HTMLCanvasElement>('board')
const renderer = new Renderer(canvas)
renderer.reduce = reduce

let mode: Mode = 'home'
let page: Page | null = null
let game: Game | null = null
let demo: Game | null = null
let startedAt = 0
let overTimer = 0
/** ?level=150 startet direkt bei Level 150 (zum Ausprobieren) */
const params = new URLSearchParams(location.search)
const startLevel = Math.max(1, Number(params.get('level')) || 1)
/** ?auto=1 laesst den Autopilot auch im Spiel steuern (zum Testen der spaeten Level) */
const auto = params.has('auto')

mountIcons(document)
$('version').textContent = __APP_VERSION__

/* ================= Groesse ================= */

/** Wie viele Felder passen auf einen Bildschirm? Ziel ca. 300 Felder */
function screenCells() {
  const vw = stage.clientWidth
  const vh = stage.clientHeight
  const cell = Math.min(64, Math.max(22, Math.sqrt((vw * vh) / 300)))
  return { w: Math.max(8, Math.floor((vw - 6) / cell)), h: Math.max(10, Math.floor((vh - 6) / cell)) }
}

function resize() {
  renderer.resize(stage.clientWidth, stage.clientHeight)
}
new ResizeObserver(resize).observe(stage)
resize()

/* ================= Bildschirme ================= */

function show(id: string, on: boolean) {
  const el = $(id)
  if (on) el.setAttribute('data-open', '')
  else el.removeAttribute('data-open')
}

function setMode(m: Mode) {
  mode = m
  app.dataset.mode = m
  show('home', m === 'home')
  show('pause', m === 'paused')
  show('over', false)
  $('ready').hidden = m !== 'ready'
  $('dpad').hidden = !(settings.dpad && (m === 'ready' || m === 'play' || m === 'paused'))
  audio.music(true, m !== 'play')
  if (m === 'home') updateHome()
}

function openPage(p: Page) {
  audio.click()
  page = p
  if (p === 'help') renderHelp()
  if (p === 'stats') renderStats()
  if (p === 'settings') renderSettings()
  show(p, true)
}
function closePage() {
  if (!page) return
  audio.click()
  show(page, false)
  page = null
}

/* ================= Spiel ================= */

function newGame() {
  clearTimeout(overTimer)
  const sc = screenCells()
  game = new Game({ screenW: sc.w, screenH: sc.h, tempo: settings.tempo, startLevel })
  renderer.reset()
  $('ready-text').textContent = fine ? 'Pfeiltaste drücken zum Starten' : settings.dpad ? 'Tippe eine Richtung zum Starten' : 'Wischen zum Starten'
  setMode('ready')
  // Steuerkreuz veraendert die Hoehe: danach neu messen
  requestAnimationFrame(resize)
  updateHud(false)
  toastsClear()
}

function begin(d?: Dir) {
  if (!game || mode !== 'ready') return
  startedAt = performance.now()
  stats.games++
  saveStats()
  audio.start()
  haptic.light()
  setMode('play')
  if (d) game.turn(d)
}

function pause() {
  if (mode !== 'play' || !game) return
  setMode('paused')
  $('pause-info').textContent = `Level ${game.level} · Länge ${game.body.length}`
}
function resume() {
  if (mode !== 'paused') return
  audio.click()
  setMode('play')
}

function onDir(d: Dir) {
  audio.unlock()
  if (page) return
  if (mode === 'ready') return begin(d)
  if (mode === 'play') game?.turn(d)
}

function gameOver() {
  if (!game) return
  const g = game
  const neu = g.maxLevel > stats.best && g.gegessen > 0
  stats.apples += g.gegessen
  stats.time += performance.now() - startedAt
  stats.longest = Math.max(stats.longest, g.maxLen)
  stats.maxGebiete = Math.max(stats.maxGebiete, g.expansions)
  if (neu) stats.best = g.maxLevel
  saveStats()
  overTimer = window.setTimeout(() => {
    if (mode !== 'over') return
    $('over-cause').textContent = g.cause ? CAUSE[g.cause] : ''
    $('over-level').textContent = String(g.level)
    $('over-record').hidden = !neu
    $('over-apples').textContent = String(g.gegessen)
    $('over-max').hidden = g.maxLevel <= g.level
    $('over-max').textContent = `Höchster Level: ${g.maxLevel}`
    $('over-len').textContent = String(g.body.length)
    const sec = Math.round((performance.now() - startedAt) / 1000)
    $('over-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    show('over', true)
    drawMini($<HTMLCanvasElement>('over-icon'), MINI_FOR_CAUSE[g.cause ?? 'rand'])
    if (neu) audio.record()
    updateHud(false)
  }, 1100)
}

/* ================= Ereignisse -> Ton, Vibration, Anzeige ================= */

function handle(e: GameEvent) {
  renderer.event(e, game!)
  switch (e.type) {
    case 'eat':
      audio.eat(e.level)
      haptic.light()
      updateHud(true)
      break
    case 'milestone':
      audio.milestone()
      break
    case 'expand':
      audio.expand()
      haptic.success()
      toast('gebiet', 'Neues Gebiet', `Die Karte ist nach ${SIDE[e.side]} gewachsen. Mehr Platz!`, e.side)
      break
    case 'unlock': {
      if (e.what === 'gebiet') break
      const u = UNLOCK[e.what]
      audio.unlock_()
      toast(u.mini, u.title, u.text)
      if (!stats.seen.includes(e.what)) {
        stats.seen.push(e.what)
        saveStats()
      }
      break
    }
    case 'halt':
      audio.halt()
      haptic.medium()
      break
    case 'die':
      audio.die(e.cause)
      haptic.heavy()
      mode = 'over'
      app.dataset.mode = 'over'
      audio.music(true, true)
      gameOver()
      break
    case 'trap':
      audio.trap()
      haptic.medium()
      break
    case 'cloud':
      audio.cloud()
      break
    case 'cloudGrow':
      audio.cloudGrow()
      break
    case 'ant':
      audio.ant()
      break
    case 'antStep':
      audio.antStep()
      break
    case 'stolen':
      audio.stolen()
      toast('ameise', 'Apfel geklaut!', 'Die Ameise hat ihn mitgenommen. Er liegt jetzt woanders.')
      break
    case 'pond':
      audio.pond()
      break
    case 'setback': {
      audio.setback()
      haptic.heavy()
      updateHud(false)
      const el = $('hud-level')
      if (!reduce) {
        el.classList.remove('pop', 'down')
        void el.offsetWidth
        el.classList.add('down')
      }
      const n = e.von - e.auf
      toast(e.grund === 'wolke' ? 'wolke' : 'haus', `−${n} Level`, e.grund === 'wolke' ? 'In die Giftwolke geraten. Zurück auf Level ' + e.auf + '.' : 'Im Fensterlicht erwischt. Zurück auf Level ' + e.auf + '.', undefined, true)
      break
    }
    case 'tree':
      audio.tree()
      haptic.medium()
      break
    case 'house':
      audio.house()
      break
    case 'light':
      audio.light()
      break
  }
}

/* ================= HUD ================= */

function updateHud(pop: boolean) {
  const lv = game?.level ?? 1
  const el = $('hud-level')
  el.textContent = String(lv)
  if (pop && !reduce) {
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
  }
  $('hud-best').textContent = stats.best ? String(stats.best) : '–'
  const bar = $('hud-bar')
  bar.hidden = lv >= GEBIET_BIS
  const k = (lv % GEBIET_ALLE) / GEBIET_ALLE
  $('hud-bar-fill').style.transform = `scaleX(${k})`
  bar.title = `Neues Gebiet in ${GEBIET_ALLE - (lv % GEBIET_ALLE)} Level`
}

/* ================= Hinweise ================= */

const toastQueue: (() => void)[] = []
let toastBusy = false
function toast(mini: Parameters<typeof drawMini>[1], title: string, text: string, pfeil?: Side, minus = false) {
  const show = () => {
    const el = document.createElement('div')
    el.className = minus ? 'toast toast--minus' : 'toast'
    if (pfeil) el.dataset.side = pfeil
    el.innerHTML = `<canvas width="44" height="44"></canvas><div><b></b><span></span></div>`
    el.querySelector('b')!.textContent = title
    el.querySelector('span')!.textContent = text
    $('toasts').append(el)
    drawMini(el.querySelector('canvas')!, mini, 0, pfeil as Side | undefined)
    setTimeout(() => el.classList.add('out'), 2900)
    setTimeout(() => {
      el.remove()
      toastBusy = false
      nextToast()
    }, 3300)
  }
  // Rueckschlaege sofort zeigen (vor wartenden Hinweisen)
  if (minus) toastQueue.unshift(show)
  else toastQueue.push(show)
  nextToast()
}
function nextToast() {
  if (toastBusy) return
  const f = toastQueue.shift()
  if (!f) return
  toastBusy = true
  f()
}
function toastsClear() {
  toastQueue.length = 0
  $('toasts').innerHTML = ''
  toastBusy = false
}

/* ================= Startmenue ================= */

function updateHome() {
  $('home-best').textContent = stats.best ? `Bester Level: ${stats.best}` : 'Iss Äpfel, die Karte wächst mit.'
  const cv = $<HTMLCanvasElement>('home-apple')
  const ctx = cv.getContext('2d')!
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const css = 96
  cv.width = css * dpr
  cv.height = css * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawApfel(ctx, css / 2, css / 2 + 8, css * 1.12, 1)
  setIcon($('btn-sound'), settings.sound ? 'Volume2' : 'VolumeX')
}

function newDemo() {
  const sc = screenCells()
  demo = new Game({ screenW: sc.w, screenH: sc.h, tempo: 'langsam', startLevel: 1 })
  renderer.reset()
}

/* ================= Unterseiten ================= */

function renderHelp() {
  const list = $('help-list')
  if (list.childElementCount) return
  for (const h of HELP) {
    const item = document.createElement('article')
    item.className = 'help'
    item.innerHTML = `<canvas width="56" height="56"></canvas><div><h3></h3><p></p></div>`
    item.querySelector('h3')!.textContent = h.title
    if (h.ab) {
      const tag = document.createElement('small')
      tag.textContent = h.ab
      item.querySelector('h3')!.append(tag)
    }
    item.querySelector('p')!.textContent = h.text
    list.append(item)
    requestAnimationFrame(() => drawMini(item.querySelector('canvas')!, h.mini))
  }
}

function renderStats() {
  const min = Math.round(stats.time / 60000)
  const rows: [string, string][] = [
    ['Bester Level', stats.best ? String(stats.best) : '–'],
    ['Spiele', String(stats.games)],
    ['Äpfel gesamt', String(stats.apples)],
    ['Längste Schlange', stats.longest ? String(stats.longest) : '–'],
    ['Größte Karte', stats.maxGebiete ? `+${stats.maxGebiete} Gebiete` : '–'],
    ['Spielzeit', min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`],
  ]
  $('stat-grid').innerHTML = rows.map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('')
}

function renderSettings() {
  $<HTMLInputElement>('opt-sound').checked = settings.sound
  $<HTMLInputElement>('opt-music').checked = settings.music
  $<HTMLInputElement>('opt-vibration').checked = settings.vibration
  $<HTMLInputElement>('opt-dpad').checked = settings.dpad
  $('opt-tempo')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === settings.tempo)))
}

function applySettings() {
  audio.sfxOn = settings.sound
  audio.setMusic(settings.music)
  saveSettings()
}

/* ================= Verdrahtung ================= */

$('btn-play').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  newGame()
})
$('btn-pause').addEventListener('click', () => {
  audio.click()
  pause()
})
$('btn-resume').addEventListener('click', resume)
$('btn-restart').addEventListener('click', () => {
  audio.click()
  newGame()
})
$('btn-quit').addEventListener('click', () => {
  audio.click()
  game = null
  newDemo()
  setMode('home')
})
$('btn-again').addEventListener('click', () => {
  audio.click()
  newGame()
})
$('btn-menu').addEventListener('click', () => {
  audio.click()
  game = null
  newDemo()
  setMode('home')
})
$('btn-sound').addEventListener('click', () => {
  audio.unlock()
  settings.sound = !settings.sound
  settings.music = settings.sound
  applySettings()
  audio.click()
  updateHome()
})
document.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
  audio.unlock()
  openPage(b.dataset.go as Page)
}))
document.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => b.addEventListener('click', closePage))

for (const k of ['sound', 'music', 'vibration', 'dpad'] as const)
  $<HTMLInputElement>(`opt-${k}`).addEventListener('change', (e) => {
    settings[k] = (e.target as HTMLInputElement).checked
    applySettings()
    audio.click()
    if (k === 'vibration' && settings.vibration) haptic.medium()
  })
$('opt-tempo')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) =>
    b.addEventListener('click', () => {
      settings.tempo = b.dataset.v as typeof settings.tempo
      applySettings()
      renderSettings()
      audio.click()
    }),
  )
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Statistik und Rekord wirklich löschen?')) return
  resetStats()
  renderStats()
  updateHome()
  updateHud(false)
  audio.click()
})

bindInput(app, {
  dir: onDir,
  pause: () => {
    audio.unlock()
    if (page) return closePage()
    if (mode === 'play') pause()
    else if (mode === 'paused') resume()
  },
  tap: () => {
    audio.unlock()
    if (mode === 'ready' && fine) begin()
  },
  enabled: () => !page && (mode === 'ready' || mode === 'play'),
})
bindDpad($('dpad'), onDir)
// Spielende: Enter oder Leertaste startet neu
window.addEventListener('keydown', (e) => {
  if (mode === 'over' && $('over').hasAttribute('data-open') && !page && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    audio.click()
    newGame()
  }
})

// Erste Beruehrung schaltet den Ton frei
window.addEventListener('pointerdown', () => audio.unlock(), { once: true })

// App im Hintergrund oder Fenster verlassen: Pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause()
    audio.suspend()
  } else audio.resume()
})
window.addEventListener('blur', pause)

// Android: Zuruecktaste
if (nativ) {
  void App.addListener('backButton', () => {
    if (page) return closePage()
    if (mode === 'play') return pause()
    if (mode === 'paused') return resume()
    if (mode === 'ready' || mode === 'over') {
      game = null
      newDemo()
      return setMode('home')
    }
    void App.exitApp()
  })
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      pause()
      audio.suspend()
    } else audio.resume()
  })
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
  void StatusBar.hide().catch(() => {})
}

/* ================= Schleife ================= */

let last = performance.now()
function frame(now: number) {
  const dt = Math.min(100, now - last)
  last = now
  if (mode === 'home') {
    if (!demo || (demo.status === 'over' && demo.time - demo.deathAt > 1500)) newDemo()
    const d = demo!
    if (d.status === 'play' && !d.queue.length) {
      const dir = autopilot(d)
      if (dir) d.turn(dir, false)
    }
    d.update(dt)
    d.drain()
    renderer.draw(d)
  } else if (game) {
    if (mode === 'play' || mode === 'over') {
      if (auto && mode === 'play' && !game.queue.length) {
        const dir = autopilot(game)
        if (dir) game.turn(dir, false)
      }
      game.update(dt)
      for (const e of game.drain()) handle(e)
    }
    renderer.draw(game)
  }
  requestAnimationFrame(frame)
}

applySettings()
newDemo()
setMode('home')
requestAnimationFrame(frame)

// Service Worker nur im Browser (die Android-App hat alles dabei)
if (!nativ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
