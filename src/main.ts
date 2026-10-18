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
import { apfelFaktor, DEFAULTS, gebietFortschritt, SCHEMA, type ConfigKey } from './game/rules'
import { ERFOLGE, erfolgePruefen, stand, zaehle } from './erfolge'
import { SANDBOX_OBJEKTE, type Dir, type GameEvent, type SandboxObjekt, type Side } from './game/types'
import { dauerhaft, zeitleiste } from './game/zeitleiste'
import { haptic } from './haptics'
import { bindDpad, bindInput } from './input'
import { Renderer } from './render/renderer'
import { apfelFarben, drawApfel } from './render/sprites'
import { abonniere, ladeListe, melde, nameGueltig, onlineAktiv, profil, setzeName, type Art } from './online'
import { APK_URL, neueVersion } from './update'
import { config, heuteBest, heuteDatum, kreativ, resetConfig, resetStats, saveConfig, saveKreativ, saveSettings, saveStats, saveWallet, settings, stats, wallet } from './storage'
import { drawSkinVorschau, hatSkin, SKINS, skinVon, STUFEN } from './render/skins'
import { mountIcons, setIcon } from './ui/icons'
import { drawMini, MINI_FOR_CAUSE } from './ui/minis'
import { CAUSE, help, OBJEKT_NAME } from './ui/texts'

type Mode = 'home' | 'ready' | 'play' | 'paused' | 'over'
type Page = 'help' | 'stats' | 'settings' | 'kreativ' | 'master' | 'shop' | 'liste'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const nativ = Capacitor.isNativePlatform()
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

const app = $('app')
const stage = $('stage')
const canvas = $<HTMLCanvasElement>('board')
const renderer = new Renderer(canvas)
renderer.reduce = reduce
renderer.skin = skinVon(wallet.skin)

let mode: Mode = 'home'
/** Offene Unterseiten (Optionen -> Master liegt ueber Optionen) */
const pages: Page[] = []
const page = () => pages[pages.length - 1] ?? null
/** Laeuft gerade eine Kreativ-Runde? */
let istKreativ = false
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
  $('steuer').hidden = !(m === 'ready' || m === 'play')
  audio.music(true, m !== 'play')
  if (m === 'home') updateHome()
}

function openPage(p: Page) {
  audio.click()
  if (pages.includes(p)) return
  pages.push(p)
  if (p === 'help') renderHelp()
  if (p === 'stats') renderStats()
  if (p === 'settings') renderSettings()
  if (p === 'kreativ') renderKreativ()
  if (p === 'master') renderMaster()
  if (p === 'shop') renderShop()
  if (p === 'liste') oeffneListe()
  show(p, true)
}
function closePage() {
  const p = pages.pop()
  if (!p) return
  audio.click()
  show(p, false)
  if (p === 'liste') schliesseListe()
}
function closeAllPages() {
  while (pages.length) {
    const p = pages.pop()!
    show(p, false)
    if (p === 'liste') schliesseListe()
  }
}

/* ================= Spiel ================= */

function newGame(alsKreativ = istKreativ) {
  clearTimeout(overTimer)
  istKreativ = alsKreativ
  app.toggleAttribute('data-kreativ', istKreativ)
  const sc = screenCells()
  const { start, sandbox, ...k } = kreativ
  const { an, ...sb } = sandbox
  game = new Game({
    screenW: sc.w,
    screenH: sc.h,
    tempo: settings.tempo,
    cfg: { ...config },
    startLevel: istKreativ ? start : startLevel,
    kreativ: istKreativ ? { ...k } : null,
    sandbox: istKreativ && an ? { ...sb, objekte: { ...sb.objekte } } : null,
  })
  renderer.reset()
  readyText()
  setMode('ready')
  // Steuerkreuz veraendert die Hoehe: danach neu messen
  requestAnimationFrame(resize)
  updateHud(false)
  updateGeld()
  toastsClear()
}

function readyText() {
  $('ready-text').textContent = fine
    ? 'Pfeiltaste drücken zum Starten'
    : settings.dpad
      ? 'Tippe eine Richtung zum Starten'
      : 'Wischen zum Starten'
}

function begin(d?: Dir) {
  if (!game || mode !== 'ready') return
  startedAt = performance.now()
  if (!istKreativ) {
    stats.games++
    erfolgeMelden()
    saveStats()
  }
  audio.start()
  haptic.light()
  setMode('play')
  if (d) game.turn(d)
}

function pause() {
  if (mode !== 'play' || !game) return
  setMode('paused')
  $('pause-info').textContent = `${istKreativ ? 'Kreativ · ' : ''}Level ${game.level} · Länge ${game.body.length}`
  $('btn-kreativ-live').hidden = !istKreativ
}
function resume() {
  if (mode !== 'paused') return
  audio.click()
  setMode('play')
}

function onDir(d: Dir) {
  audio.unlock()
  if (page()) return
  if (mode === 'ready') return begin(d)
  if (mode === 'play') game?.turn(d)
}

/** Zaehlt die Runde fuer die Online-Bestenliste? Nur echte Runden mit Standardregeln, ohne Level-Sprung und Autopilot */
function zaehltOnline() {
  if (istKreativ || auto || startLevel !== 1) return false
  return (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).every((k) => config[k] === DEFAULTS[k])
}

/* ================= Online-Bestenliste ================= */

let listeArt: Art = 'heute'
let listeAbmelden: (() => void) | null = null
let listeNr = 0

function oeffneListe() {
  $<HTMLInputElement>('liste-name').value = profil.name
  $('liste-name-info').textContent = profil.name ? 'So sehen dich die anderen. Du kannst ihn jederzeit ändern.' : 'Ohne Namen zählen deine Ergebnisse nicht. Er wird einmal pro Handy gespeichert.'
  $('liste-speichern').textContent = profil.name ? 'Ändern' : 'Speichern'
  listeAbmelden?.()
  listeAbmelden = abonniere(() => void ladeListeAnzeige())
  $('liste-live').hidden = false
  void ladeListeAnzeige()
}
function schliesseListe() {
  listeAbmelden?.()
  listeAbmelden = null
}

async function ladeListeAnzeige() {
  const nr = ++listeNr
  for (const b of $('liste-tabs').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === listeArt))
  const box = $('liste-zeilen')
  const info = $('liste-info')
  try {
    const { zeilen, ich } = await ladeListe(listeArt)
    if (nr !== listeNr) return
    box.replaceChildren()
    if (!zeilen.length) {
      const leer = document.createElement('p')
      leer.className = 'liste__leer'
      leer.textContent = listeArt === 'heute' ? 'Heute hat noch niemand gespielt. Sei der Erste!' : 'Noch keine Ergebnisse.'
      box.append(leer)
    }
    zeilen.forEach((z, i) => {
      const el = document.createElement('div')
      el.className = z.user_id === ich ? 'liste__zeile liste__zeile--ich' : 'liste__zeile'
      const platz = document.createElement('span')
      platz.className = 'liste__platz'
      platz.textContent = String(i + 1)
      const name = document.createElement('span')
      name.className = 'liste__name'
      name.textContent = z.name
      if (z.tempo !== 'normal') {
        const t = document.createElement('small')
        t.textContent = z.tempo
        name.append(t)
      }
      const level = document.createElement('b')
      level.className = 'liste__level'
      level.textContent = String(z.level)
      el.append(platz, name, level)
      box.append(el)
    })
    info.textContent = 'Zählt: Standardregeln, normale Runden. Level = höchster erreichter Level.'
  } catch {
    if (nr !== listeNr) return
    box.replaceChildren()
    info.textContent = 'Keine Verbindung. Die Bestenliste braucht Internet.'
  }
}

$('liste-tabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
  b.addEventListener('click', () => {
    listeArt = b.dataset.v as Art
    audio.click()
    void ladeListeAnzeige()
  }),
)
$<HTMLFormElement>('liste-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('liste-name')
  const info = $('liste-name-info')
  if (!nameGueltig(input.value)) {
    info.textContent = 'Der Name braucht 2 bis 16 Zeichen.'
    return
  }
  const knopf = $<HTMLButtonElement>('liste-speichern')
  knopf.disabled = true
  try {
    await setzeName(input.value)
    audio.click()
    info.textContent = `Gespeichert: Du spielst als ${profil.name}.`
    knopf.textContent = 'Ändern'
    input.blur()
    void ladeListeAnzeige()
  } catch {
    info.textContent = 'Das hat nicht geklappt. Bist du online?'
  } finally {
    knopf.disabled = false
  }
})

function gameOver() {
  if (!game) return
  const g = game
  // Kreativ-Runden zaehlen nicht
  const neu = !istKreativ && g.maxLevel > stats.best && g.gegessen > 0
  // Tagesrekord (nur, wenn es nicht gleich der Rekord aller Zeiten ist)
  const neuHeute = !istKreativ && !neu && g.maxLevel > heuteBest() && g.gegessen > 0
  if (!istKreativ && g.gegessen > 0 && g.maxLevel > heuteBest()) stats.heute = { datum: heuteDatum(), best: g.maxLevel }
  if (!istKreativ) {
    stats.apples += g.gegessen
    stats.time += performance.now() - startedAt
    stats.longest = Math.max(stats.longest, g.maxLen)
    stats.maxGebiete = Math.max(stats.maxGebiete, g.expansions)
    stats.gegner += g.besiegt
    if (neu) stats.best = g.maxLevel
    erfolgeMelden()
    saveStats()
    if (zaehltOnline() && g.gegessen > 0 && g.maxLevel >= 2)
      melde({ level: g.maxLevel, dauer: Math.max(1, Math.round(performance.now() - startedAt)), tempo: settings.tempo })
  }
  overTimer = window.setTimeout(() => {
    if (mode !== 'over') return
    $('over-cause').textContent = g.cause ? CAUSE[g.cause] : ''
    $('over-level').textContent = String(g.level)
    $('over-record').hidden = !neu
    $('over-heute').hidden = !neuHeute
    $('over-apples').textContent = String(g.gegessen)
    $('over-max').hidden = g.maxLevel <= g.level
    $('over-max').textContent = `Höchster Level: ${g.maxLevel}`
    $('over-len').textContent = String(g.body.length)
    const sec = Math.round((performance.now() - startedAt) / 1000)
    $('over-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    const geld = $('over-geld')
    geld.hidden = istKreativ || g.verdient <= 0
    geld.querySelector('b')!.textContent = `+${g.verdient} ${g.verdient === 1 ? 'Apfel' : 'Äpfel'}`
    const on = $('over-online')
    on.hidden = !(onlineAktiv && zaehltOnline() && g.gegessen > 0)
    on.textContent = profil.name ? `In der Bestenliste als ${profil.name}` : 'Noch ohne Namen: Trag dich unter „Bestenliste“ ein, dann zählt dieses Ergebnis.'
    show('over', true)
    drawMini($<HTMLCanvasElement>('over-icon'), MINI_FOR_CAUSE[g.cause ?? 'rand'])
    if (neu) audio.record()
    updateHud(false)
  }, 1100)
}

/* ================= Ereignisse -> Ton, Vibration, Anzeige ================= */

/** Zaehler fuer Erfolge (nur echte Runden) */
function zaehlen(e: GameEvent) {
  if (istKreativ) return
  switch (e.type) {
    case 'gegnerWeg':
      if (e.wert <= 0) return
      zaehle('gegner')
      if (e.art === 'lila') zaehle('lila')
      break
    case 'gefressen':
      zaehle('gefressen')
      if (e.was === 'ameise') zaehle('ameisen')
      if (e.was === 'gegner') {
        zaehle('gegner')
        if (e.art === 'lila') zaehle('lila')
      }
      break
    case 'ameiseWeg':
      zaehle('ameisen')
      break
    case 'fund':
      zaehle(e.art)
      break
    case 'wahl':
      if (e.offen > 0) return
      zaehle('gebiete')
      break
    case 'freigelegt':
      zaehle('freigelegt', e.anzahl)
      break
    case 'power':
      zaehle('powerups')
      break
    default:
      return
  }
  erfolgeMelden()
  saveStats()
}

/** Neu erreichte Erfolge merken (ohne Meldung im Spiel, sie stehen in der Statistik) */
function erfolgeMelden() {
  erfolgePruefen()
}

function handle(e: GameEvent) {
  renderer.event(e, game!)
  zaehlen(e)
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
      break
    case 'unlock': {
      // Keine Vorstellung neuer Gefahren: der Spieler findet alles selbst heraus
      if (e.what === 'gebiet') break
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
    case 'frog':
      audio.frog()
      break
    case 'hop': {
      // Nur Froesche in der Naehe sind zu hoeren
      const h = game!.body[0]
      if (Math.abs(e.p.x - h.x) <= game!.screenW / 2 + 2 && Math.abs(e.p.y - h.y) <= game!.screenH / 2 + 2) audio.hop()
      break
    }
    case 'tower':
      audio.tower()
      haptic.medium()
      break
    case 'stolen':
      audio.stolen()
      break
    case 'pond':
      audio.pond()
      break
    case 'geld':
      // Aepfel sind die Waehrung; im Kreativ-Modus wird nichts gesammelt
      if (!istKreativ) {
        wallet.aepfel += e.wert
        saveWallet()
      }
      updateGeld(true)
      break
    case 'gegner':
      if (nah(e.p, 1)) audio.gegner()
      break
    case 'ameiseAlarm':
      if (nah(e.p, 0.5)) audio.ameise()
      break
    case 'ameiseWeg':
      audio.zertreten()
      haptic.light()
      break
    case 'lava':
      audio.lava(true)
      haptic.medium()
      break
    case 'lavaWachsen':
      if (nah(e.p, 0.5)) audio.lava()
      break
    case 'fund': {
      audio.fund(e.art !== 'gold')
      haptic.success()
      break
    }
    case 'wahlVorbei':
      audio.powerEnde()
      break
    case 'gefressen':
      audio.happs()
      haptic.light()
      break
    case 'wahl':
      if (e.offen > 0) {
        audio.wahl()
        toast('gebiet', 'Öffne eine Wand', '')
      }
      break
    case 'freigelegt':
      if (e.anzahl > 0) {
        audio.freigelegt()
        haptic.success()
      }
      break
    case 'eis':
      audio.click()
      break
    case 'gegnerWeg':
      if (e.wert <= 0) break
      audio.besiegt()
      haptic.success()
      break
    case 'power':
      audio.power()
      haptic.success()
      break
    case 'powerEnde':
      audio.powerEnde()
      break
    case 'faktor':
      if (!istKreativ) {
        audio.milestone()
      }
      updateGeld()
      break
    case 'schild':
      audio.schild()
      haptic.medium()
      break
    case 'setback': {
      updateGeld()
      audio.setback()
      haptic.heavy()
      updateHud(false)
      const el = $('hud-level')
      if (!reduce) {
        el.classList.remove('pop', 'down')
        void el.offsetWidth
        el.classList.add('down')
      }
      break
    }
    case 'tree':
      // Baum schlaegt auf: nur in der Naehe hoer- und spuerbar
      if (nah(e.p, 1)) {
        audio.tree()
        haptic.medium()
      }
      break
    case 'house':
      audio.house()
      break
    case 'light':
      audio.light()
      break
  }
}

/** Ist etwas in der Naehe des Kopfes (so viele Bildschirme weit)? Fuer Toene, die man nur nah hoert */
function nah(p: { x: number; y: number }, bildschirme: number) {
  const h = game!.body[0]
  return Math.abs(p.x - h.x) <= game!.screenW * bildschirme + 2 && Math.abs(p.y - h.y) <= game!.screenH * bildschirme + 2
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
  // Tagesrekord: auch der laufende Versuch zaehlt schon mit
  const heute = Math.max(heuteBest(), game && !istKreativ ? game.maxLevel : 0)
  $('hud-heute').textContent = heute > 1 ? `heute ${heute}` : ''
  const c = game?.cfg ?? config
  const bar = $('hud-bar')
  const f = gebietFortschritt(c, lv)
  bar.hidden = c.gebietAlle <= 0
  $('hud-bar-fill').style.transform = `scaleX(${1 - f.rest / f.abschnitt})`
  bar.title = `Neues Gebiet in ${f.rest} Level`
}

/** Apfel-Vorrat in der Leiste (und im Startmenue). Das Apfel-Symbol hat die Farbe der aktuellen Stufe */
function updateGeld(pop = false) {
  const el = $('hud-geld')
  el.textContent = istKreativ ? '–' : String(wallet.aepfel)
  const f = game ? apfelFaktor(game.cfg, game.level) : 1
  const fx = $('hud-faktor')
  fx.hidden = f <= 1 || istKreativ
  fx.textContent = `×${f}`
  const farben = apfelFarben(f)
  app.style.setProperty('--apfel', farben.length > 1 ? `linear-gradient(135deg, ${farben[0][1]}, ${farben[1][1]})` : farben[0][1])
  if (pop && !reduce) {
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
  }
  $('home-geld').textContent = String(wallet.aepfel)
  $('shop-geld').textContent = String(wallet.aepfel)
}

/* ================= Aktive Power-ups (Pillen oben links) ================= */

const EFFEKT_ICON: Record<string, string> = {
  zeitlupe: 'Hourglass',
  geist: 'Ghost',
  fuettern: 'Utensils',
  magnet: 'Magnet',
  maulwurf: 'Shovel',
  wahl: 'Flag',
}
const effektEls = new Map<string, HTMLElement>()
function updateEffekte() {
  const g = game
  const box = $('effekte')
  const aktiv: { art: string; rest: number; text: string }[] = []
  if (g && mode !== 'home') {
    const e = g.effekt
    // Neues Gebiet waehlen: Countdown
    if (g.wahl > 0) aktiv.push({ art: 'wahl', rest: Math.max(0, (g.wahlBis - g.time) / (g.cfg.wahlZeit * 1000)), text: `${Math.max(0, Math.ceil((g.wahlBis - g.time) / 1000))}` })
    const c = g.cfg
    for (const [art, bis, dauer] of [
      ['zeitlupe', e.zeitlupeBis, c.effektDauer],
      ['geist', e.geistBis, c.geistDauer],
      ['fuettern', e.fuetternBis, c.fuetternDauer],
      ['magnet', e.magnetBis, c.magnetDauer],
      ['maulwurf', e.maulwurfBis, c.maulwurfDauer],
    ] as const)
      if (g.time < bis) aktiv.push({ art, rest: Math.min(1, (bis - g.time) / (dauer * 1000)), text: `${Math.ceil((bis - g.time) / 1000)}` })
  }
  for (const [art, el] of effektEls)
    if (!aktiv.some((a) => a.art === art)) {
      el.remove()
      effektEls.delete(art)
    }
  for (const a of aktiv) {
    let el = effektEls.get(a.art)
    if (!el) {
      el = document.createElement('div')
      el.className = `effekt effekt--${a.art}`
      el.innerHTML = '<span></span><b></b><i></i>'
      setIcon(el.querySelector('span')!, EFFEKT_ICON[a.art])
      box.append(el)
      effektEls.set(a.art, el)
    }
    const b = el.querySelector('b')!
    if (b.textContent !== a.text) b.textContent = a.text
    el.classList.toggle('effekt--blink', a.art === 'wahl' && Number(a.text) <= 5)
    el.querySelector('i')!.style.transform = `scaleX(${a.rest})`
  }
  updateSchild()
}

/** Schilde (je ein Leben mehr) oben rechts: ein Schild-Symbol, ab zwei mit Anzahl */
let schildVorher = -1
function updateSchild() {
  const n = game && mode !== 'home' ? game.effekt.schild : 0
  if (n === schildVorher) return
  const el = $('hud-schild')
  const neu = n > schildVorher && schildVorher >= 0
  schildVorher = n
  el.hidden = n <= 0
  el.querySelector('b')!.textContent = n > 1 ? `×${n}` : ''
  el.setAttribute('aria-label', n === 1 ? '1 Schild' : `${n} Schilde`)
  if (neu && !reduce) {
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
  }
}

/* ================= Shop ================= */

const skinCanvas: { cv: HTMLCanvasElement; id: string }[] = []
function renderShop() {
  updateGeld()
  const box = $('skins')
  box.innerHTML = ''
  skinCanvas.length = 0
  for (const sk of SKINS) {
    // Ueberschrift je Preisstufe
    const stufe = STUFEN.find((st) => st.preis === sk.preis)
    if (stufe && SKINS.find((o) => o.preis === sk.preis) === sk) {
      const h = document.createElement('h3')
      h.className = 'skin-stufe'
      h.textContent = stufe.name
      if (stufe.preis > 0) {
        const pr = document.createElement('span')
        pr.innerHTML = `<i class="apfel-ico"></i>${stufe.preis}`
        h.append(pr)
      }
      box.append(h)
    }
    const hat = hatSkin(wallet.skins, sk.id)
    const an = wallet.skin === sk.id
    const card = document.createElement('button')
    card.className = 'skin'
    card.dataset.id = sk.id
    if (an) card.dataset.an = ''
    if (!hat) card.dataset.zu = ''
    card.innerHTML = `<canvas></canvas><span class="skin__name"></span><span class="skin__preis"></span>`
    card.querySelector('.skin__name')!.textContent = sk.name
    const preis = card.querySelector('.skin__preis') as HTMLElement
    if (an) {
      preis.innerHTML = '<span></span>Aktiv'
      setIcon(preis.querySelector('span')!, 'Check')
    } else if (hat) preis.textContent = 'Wählen'
    else {
      preis.innerHTML = `<i class="apfel-ico"></i>${sk.preis}`
      if (wallet.aepfel < sk.preis) preis.classList.add('zu-teuer')
    }
    card.addEventListener('click', () => kaufen(sk.id))
    box.append(card)
    skinCanvas.push({ cv: card.querySelector('canvas')!, id: sk.id })
  }
}

function kaufen(id: string) {
  audio.unlock()
  const sk = skinVon(id)
  if (!hatSkin(wallet.skins, id)) {
    if (wallet.aepfel < sk.preis) {
      audio.nein()
      haptic.medium()
      const card = $('skins').querySelector<HTMLElement>(`[data-id="${id}"]`)
      card?.classList.remove('wackeln')
      void card?.offsetWidth
      card?.classList.add('wackeln')
      return
    }
    wallet.aepfel -= sk.preis
    wallet.skins.push(id)
    audio.kauf()
    haptic.success()
    erfolgeMelden()
    saveStats()
  } else audio.click()
  wallet.skin = id
  saveWallet()
  renderer.skin = sk
  renderShop()
}

/* ================= Hinweise ================= */

const toastQueue: (() => void)[] = []
let toastBusy = false
function toast(mini: Parameters<typeof drawMini>[1], title: string, text: string, o: { pfeil?: Side; minus?: boolean; stufe?: number } = {}) {
  const { pfeil, minus = false, stufe = 1 } = o
  const show = () => {
    const el = document.createElement('div')
    el.className = minus ? 'toast toast--minus' : 'toast'
    if (pfeil) el.dataset.side = pfeil
    el.innerHTML = `<canvas width="44" height="44"></canvas><div><b></b><span></span></div>`
    el.querySelector('b')!.textContent = title
    if (text) el.querySelector('span')!.textContent = text
    else el.querySelector('span')!.remove()
    $('toasts').append(el)
    drawMini(el.querySelector('canvas')!, mini, 0, pfeil, stufe)
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
  $('home-best').textContent = stats.best ? `Heute: ${heuteBest() || '–'} · Rekord: ${stats.best}` : 'Iss Äpfel, die Karte wächst mit.'
  updateGeld()
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
  demo = new Game({ screenW: sc.w, screenH: sc.h, tempo: 'langsam', startLevel: 1, cfg: { ...config } })
  renderer.reset()
}

/* ================= Unterseiten ================= */

function renderHelp() {
  const list = $('help-list')
  list.innerHTML = ''
  for (const h of help(game?.cfg ?? config)) {
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
    ['Heute', heuteBest() ? String(heuteBest()) : '–'],
    ['Spiele', String(stats.games)],
    ['Äpfel gesamt', String(stats.apples)],
    ['Längste Schlange', stats.longest ? String(stats.longest) : '–'],
    ['Größte Karte', stats.maxGebiete ? `+${stats.maxGebiete} Gebiete` : '–'],
    ['Gegner eingekesselt', String(stats.gegner)],
    ['Spielzeit', min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`],
  ]
  $('stat-grid').innerHTML = rows.map(([k, v]) => `<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('')
  // Erfolge mit Fortschritt
  const box = $('erfolge')
  box.innerHTML = ''
  $('erfolge-titel').textContent = `Erfolge ${stats.erfolge.length} / ${ERFOLGE.length}`
  for (const e of ERFOLGE) {
    const fertig = stats.erfolge.includes(e.id)
    const n = Math.min(e.ziel, stand(e.zaehler))
    const el = document.createElement('div')
    el.className = fertig ? 'erfolg erfolg--fertig' : 'erfolg'
    el.innerHTML = `<span class="erfolg__icon"></span><div><b></b><small></small><i><em></em></i></div><span class="erfolg__zahl"></span>`
    setIcon(el.querySelector('.erfolg__icon')!, fertig ? 'Medal' : 'Lock')
    el.querySelector('b')!.textContent = e.titel
    el.querySelector('small')!.textContent = e.text
    ;(el.querySelector('em') as HTMLElement).style.transform = `scaleX(${n / e.ziel})`
    el.querySelector('.erfolg__zahl')!.textContent = fertig ? '' : `${n}/${e.ziel}`
    box.append(el)
  }
}

function renderSettings() {
  $<HTMLInputElement>('opt-sound').checked = settings.sound
  $<HTMLInputElement>('opt-music').checked = settings.music
  $<HTMLInputElement>('opt-vibration').checked = settings.vibration
  $<HTMLInputElement>('opt-dpad').checked = settings.dpad
  for (const [id, v] of [['opt-tempo', settings.tempo], ['opt-kamera', settings.kamera]])
    $(id)
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)))
}

function applySettings() {
  audio.sfxOn = settings.sound
  audio.setMusic(settings.music)
  renderer.kameraArt = settings.kamera
  saveSettings()
}

/* ================= Kreativ ================= */

const kInput = (id: string) => $<HTMLInputElement>(id)
const live = () => !!game && istKreativ && (mode === 'paused' || mode === 'ready')

function renderKreativ() {
  const lv = live()
  const sb = kreativ.sandbox
  $('k-start-box').hidden = lv
  $('k-sandbox-box').hidden = lv
  $('k-sb').hidden = lv || !sb.an
  kInput('k-sandbox').checked = sb.an
  $('k-start-info').textContent = sb.an
    ? 'Bestimmt Tempo, Apfelwert und was kommt, wenn es normal weitergeht.'
    : 'Die Karte wird so aufgebaut, wie sie bis dahin ungefähr entstanden wäre.'
  kInput('k-sb-breite').value = String(sb.breite)
  kInput('k-sb-hoehe').value = String(sb.hoehe)
  kInput('k-sb-laenge').value = String(sb.laenge)
  for (const art of SANDBOX_OBJEKTE) {
    const el = document.getElementById(`k-sb-${art}`) as HTMLInputElement | null
    if (el) el.value = String(sb.objekte[art] ?? 0)
  }
  $('k-sb-weiter')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) => b.setAttribute('aria-checked', String((b.dataset.v === 'weiter') === sb.weiter)))
  $('k-live').hidden = !lv
  $('btn-kreativ-start').hidden = lv
  kInput('k-start').value = kInput('k-start-range').value = String(kreativ.start)
  kInput('k-laenge').value = kInput('k-laenge-range').value = String(kreativ.laenge)
  kInput('k-rueckschlag').checked = kreativ.rueckschlag
  kInput('k-durch').checked = kreativ.durchSelbst
  kInput('k-wachsen').checked = kreativ.wachsen
  $('k-laenge-box').hidden = kreativ.wachsen
  $('k-tod')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === kreativ.tod)))
  if (lv && game) {
    $('k-level').textContent = String(game.level)
    kInput('k-ziel').value = String(game.level)
  }
}

/** Einstellungen sofort ins laufende Spiel uebernehmen */
function kreativAnwenden() {
  saveKreativ()
  if (game && istKreativ) {
    const { start, sandbox, ...k } = kreativ
    void start
    void sandbox
    game.kreativ = { ...k }
  }
  renderKreativ()
}

function kreativZahl(range: string, zahl: string, setzen: (v: number) => void) {
  const sync = (v: number, quelle: HTMLInputElement) => {
    if (!Number.isFinite(v)) return
    setzen(v)
    if (quelle !== kInput(range)) kInput(range).value = String(v)
    if (quelle !== kInput(zahl)) kInput(zahl).value = String(v)
    saveKreativ()
    kreativAnwenden()
  }
  kInput(range).addEventListener('input', (e) => sync(Number((e.target as HTMLInputElement).value), e.target as HTMLInputElement))
  kInput(zahl).addEventListener('change', (e) => sync(Number((e.target as HTMLInputElement).value), e.target as HTMLInputElement))
}
kreativZahl('k-start-range', 'k-start', (v) => (kreativ.start = Math.max(1, Math.min(5000, Math.round(v)))))
kreativZahl('k-laenge-range', 'k-laenge', (v) => (kreativ.laenge = Math.max(1, Math.min(500, Math.round(v)))))
kInput('k-rueckschlag').addEventListener('change', (e) => {
  kreativ.rueckschlag = (e.target as HTMLInputElement).checked
  audio.click()
  kreativAnwenden()
})
kInput('k-durch').addEventListener('change', (e) => {
  kreativ.durchSelbst = (e.target as HTMLInputElement).checked
  audio.click()
  kreativAnwenden()
})
kInput('k-wachsen').addEventListener('change', (e) => {
  kreativ.wachsen = (e.target as HTMLInputElement).checked
  // Beim Ausschalten die aktuelle Laenge als feste Laenge nehmen
  if (!kreativ.wachsen && game && istKreativ) kreativ.laenge = game.body.length
  audio.click()
  kreativAnwenden()
})
$('k-tod')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) =>
    b.addEventListener('click', () => {
      kreativ.tod = b.dataset.v as typeof kreativ.tod
      audio.click()
      kreativAnwenden()
    }),
  )

function springe(ziel: number) {
  if (!game || !istKreativ) return
  audio.click()
  game.springeZu(ziel)
  for (const e of game.drain()) handle(e)
  updateHud(true)
  renderKreativ()
  $('pause-info').textContent = `Kreativ · Level ${game.level} · Länge ${game.body.length}`
}
$('k-minus10').addEventListener('click', () => game && springe(game.level - 10))
$('k-minus1').addEventListener('click', () => game && springe(game.level - 1))
$('k-plus1').addEventListener('click', () => game && springe(game.level + 1))
$('k-plus10').addEventListener('click', () => game && springe(game.level + 10))
$('k-springen').addEventListener('click', () => springe(Number(kInput('k-ziel').value) || 1))
/* ---- Sandbox: Kartengroesse, Laenge, Objekte, bleibt so / normal weiter ---- */
kInput('k-sandbox').addEventListener('change', (e) => {
  kreativ.sandbox.an = (e.target as HTMLInputElement).checked
  audio.click()
  saveKreativ()
  renderKreativ()
})
const sbZahl = (id: string, min: number, max: number, setzen: (v: number) => void) =>
  kInput(id).addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement
    let v = Math.round(Number(el.value))
    if (!Number.isFinite(v)) v = min
    v = Math.max(min, Math.min(max, v))
    el.value = String(v)
    setzen(v)
    saveKreativ()
  })
sbZahl('k-sb-breite', 1, 8, (v) => (kreativ.sandbox.breite = v))
sbZahl('k-sb-hoehe', 1, 8, (v) => (kreativ.sandbox.hoehe = v))
sbZahl('k-sb-laenge', 1, 300, (v) => (kreativ.sandbox.laenge = v))
for (const art of SANDBOX_OBJEKTE) {
  const lab = document.createElement('label')
  lab.className = 'sb-zahl'
  lab.innerHTML = `<span></span><input type="number" min="0" max="50" step="1" inputmode="numeric" />`
  lab.querySelector('span')!.textContent = OBJEKT_NAME[art]
  const inp = lab.querySelector('input')!
  inp.id = `k-sb-${art}`
  $('k-sb-objekte').append(lab)
  sbZahl(inp.id, 0, 50, (v) => (kreativ.sandbox.objekte[art] = v))
}
$('k-sb-weiter')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) =>
    b.addEventListener('click', () => {
      kreativ.sandbox.weiter = b.dataset.v === 'weiter'
      audio.click()
      saveKreativ()
      renderKreativ()
    }),
  )

/* ---- Im Spiel: jedes Objekt sofort dazu, alles wegraeumen ---- */
for (const art of SANDBOX_OBJEKTE) {
  const b = document.createElement('button')
  b.textContent = OBJEKT_NAME[art]
  b.addEventListener('click', () => {
    if (!game) return
    audio.click()
    const ok = game.objektDazu(art as SandboxObjekt)
    for (const e of game.drain()) handle(e)
    if (!ok) toast(art, 'Kein Platz', 'Gerade passt das nicht auf die Karte.')
  })
  $('k-objekte').append(b)
}
$('k-leeren').addEventListener('click', () => {
  if (!game) return
  audio.click()
  game.allesWeg()
})
document.querySelectorAll<HTMLButtonElement>('[data-power]').forEach((b) =>
  b.addEventListener('click', () => {
    if (!game) return
    game.powerAn(b.dataset.power as Parameters<Game['powerAn']>[0])
    for (const e of game.drain()) handle(e)
  }),
)
$('btn-kreativ-start').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  closeAllPages()
  newGame(true)
})

/* ================= Master-Einstellungen ================= */

/** Zeitleiste: was kommt wann (aus den aktuellen Zahlen) */
function renderZeitleiste() {
  $('zeitleiste-dauer').innerHTML = ''
  for (const t of dauerhaft(config)) {
    const li = document.createElement('li')
    li.textContent = t
    $('zeitleiste-dauer').append(li)
  }
  const box = $('zeitleiste-list')
  box.innerHTML = ''
  for (const e of zeitleiste(config, 500)) {
    const row = document.createElement('div')
    row.className = 'zl'
    const b = document.createElement('b')
    b.textContent = `Level ${e.level}`
    const ul = document.createElement('ul')
    for (const t of e.teile) {
      const li = document.createElement('li')
      li.className = `zl--${t.art}`
      li.textContent = t.text
      ul.append(li)
    }
    row.append(b, ul)
    box.append(row)
  }
}

function renderMaster() {
  renderZeitleiste()
  const list = $('master-list')
  list.innerHTML = ''
  for (const g of SCHEMA) {
    const box = document.createElement('div')
    box.className = 'master'
    const h = document.createElement('h3')
    h.textContent = g.gruppe
    box.append(h)
    for (const f of g.felder) {
      const row = document.createElement('label')
      row.className = 'master__row'
      const t = document.createElement('span')
      t.textContent = f.label
      const inp = document.createElement('input')
      inp.type = 'number'
      inp.min = String(f.min)
      inp.max = String(f.max)
      inp.step = String(f.step ?? 1)
      inp.inputMode = f.step && f.step < 1 ? 'decimal' : 'numeric'
      inp.value = String(config[f.key])
      inp.dataset.key = f.key
      const u = document.createElement('small')
      u.textContent = f.einheit ?? ''
      inp.addEventListener('change', () => {
        let v = Number(inp.value.replace(',', '.'))
        if (!Number.isFinite(v)) v = config[f.key as ConfigKey]
        v = Math.min(f.max, Math.max(f.min, v))
        if (!f.step || f.step >= 1) v = Math.round(v)
        config[f.key as ConfigKey] = v
        inp.value = String(v)
        saveConfig()
        renderZeitleiste()
      })
      row.append(t, inp, u)
      box.append(row)
    }
    list.append(box)
  }
}
$('btn-master-reset').addEventListener('click', () => {
  if (!confirm('Alle Master-Einstellungen auf Standard zurücksetzen?')) return
  resetConfig()
  renderMaster()
  audio.click()
})

/* ================= Verdrahtung ================= */

$('btn-play').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  newGame(false)
})
$('btn-pause').addEventListener('click', () => {
  audio.click()
  pause()
})
$('btn-pause-klein').addEventListener('click', () => {
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
  istKreativ = false
  app.removeAttribute('data-kreativ')
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
  istKreativ = false
  app.removeAttribute('data-kreativ')
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
$('opt-kamera')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) =>
    b.addEventListener('click', () => {
      settings.kamera = b.dataset.v as typeof settings.kamera
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
    if (page()) return closePage()
    if (mode === 'play') pause()
    else if (mode === 'paused') resume()
  },
  tap: () => {
    audio.unlock()
    if (mode === 'ready' && fine) begin()
  },
  enabled: () => !page() && (mode === 'ready' || mode === 'play'),
})
bindDpad($('dpad'), onDir)
// Spielende: Enter oder Leertaste startet neu
window.addEventListener('keydown', (e) => {
  if (mode === 'over' && $('over').hasAttribute('data-open') && !page() && (e.key === 'Enter' || e.key === ' ')) {
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
    if (page()) return closePage()
    if (mode === 'play') return pause()
    if (mode === 'paused') return resume()
    if (mode === 'ready' || mode === 'over') {
      game = null
      istKreativ = false
      app.removeAttribute('data-kreativ')
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
  updateEffekte()
  if (page() === 'shop') for (const s of skinCanvas) drawSkinVorschau(s.cv, skinVon(s.id), now)
  requestAnimationFrame(frame)
}

$('btn-liste').hidden = !onlineAktiv
if (nativ) {
  void neueVersion().then((v) => {
    if (v === null) return
    const b = $('update-hinweis')
    b.textContent = v ? `Neue Version ${v}: jetzt laden` : 'Neue Version: jetzt laden'
    b.hidden = false
    b.addEventListener('click', () => window.open(APK_URL, '_system'))
  })
}

applySettings()
newDemo()
setMode('home')
requestAnimationFrame(frame)

// Service Worker nur im Browser (die Android-App hat alles dabei)
if (!nativ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
