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
import { installPflicht, zeigeInstallation } from './install'
import { tagBerlin, tagesSeed } from './tages'
import { MEHR_BILD } from './multi/protokoll'
import { perPushEinladen, pushAuffrischen, pushEinschalten, pushErlaubt, pushMoeglich } from './push'
import { geraetId, mehrspieler, SERVER } from './multi/ui'
import { bindDpad, bindInput } from './input'
import { Renderer } from './render/renderer'
import { apfelFarben, drawApfel } from './render/sprites'
import { abonniere, abonniereSozial, anfrageAnnehmen, anfrageLoeschen, anfrageSenden, chatGelesen, entsperren, freundEntfernen, freundHinzufuegen, ladeHall, ladeListe, ladeNachrichten, lobby, meineAnfragen, meineChats, meineFreunde, meineSperren, meinCode, melde, NamenFehler, nameGueltig, onlineAktiv, profil, sendeNachricht, setzeName, setzeSkin, sperren, type Anfrage, type Art, type Einladung, type Freund, type Gesperrt, type HallZeile, type Nachricht, type OnlineSpieler } from './online'
import { APK_URL, neueVersion } from './update'
import { config, heuteBest, heuteDatum, kreativ, master, masterFreischalten, resetConfig, resetStats, saveConfig, saveKreativ, saveSettings, saveStats, saveWallet, settings, stats, wallet } from './storage'
import { drawSkinVorschau, hatSkin, SKINS, skinBewegt, skinVon, STUFEN } from './render/skins'
import { mountIcons, setIcon } from './ui/icons'
import { drawMini, MINI_FOR_CAUSE } from './ui/minis'
import { CAUSE, help, OBJEKT_NAME } from './ui/texts'

type Mode = 'home' | 'ready' | 'play' | 'paused' | 'over' | 'mehr'
type Page = 'help' | 'stats' | 'settings' | 'kreativ' | 'master' | 'shop' | 'liste' | 'mehr' | 'hall' | 'chat'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const nativ = Capacitor.isNativePlatform()
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

const app = $('app')
/** Auf dem Handy im Browser: nur die Installationsanleitung, das Spiel startet erst als App */
const gesperrt = installPflicht()
if (gesperrt) zeigeInstallation($('install'))
const stage = $('stage')
const canvas = $<HTMLCanvasElement>('board')
const renderer = new Renderer(canvas)
renderer.reduce = reduce
renderer.skin = skinVon(wallet.skin)

let mode: Mode = 'home'
/** Online-Status ("spielt gerade") neu melden; wird gesetzt, sobald der Online-Teil steht */
let onlineMelden = () => {}
/** Offene Unterseiten (Optionen -> Master liegt ueber Optionen) */
const pages: Page[] = []
const page = () => pages[pages.length - 1] ?? null
/** Laeuft gerade eine Kreativ-Runde? */
let istKreativ = false
/** Laeuft gerade die Tages-Herausforderung (gleiche Welt fuer alle)? */
let istTages = false
let tagesTag = ''
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
  if (m === 'mehr') $('dpad').hidden = !settings.dpad
  audio.music(true, m !== 'play' && m !== 'mehr')
  if (m === 'home') updateHome()
  onlineMelden()
}

function openPage(p: Page) {
  audio.click()
  if (pages.includes(p) || (p === 'master' && !master.frei)) return
  pages.push(p)
  if (p === 'help') renderHelp()
  if (p === 'stats') renderStats()
  if (p === 'settings') renderSettings()
  if (p === 'kreativ') renderKreativ()
  if (p === 'master') renderMaster()
  if (p === 'shop') renderShop()
  if (p === 'liste') oeffneListe()
  if (p === 'mehr') void freundeLaden()
  if (p === 'hall') void ladeHallAnzeige()
  show(p, true)
}
function closePage() {
  const p = pages.pop()
  if (!p) return
  audio.click()
  show(p, false)
  if (p === 'liste') schliesseListe()
  if (p === 'chat') chatPartner = null
}
function closeAllPages() {
  while (pages.length) {
    const p = pages.pop()!
    show(p, false)
    if (p === 'liste') schliesseListe()
    if (p === 'chat') chatPartner = null
  }
}

/* ================= Spiel ================= */

function newGame(alsKreativ = istKreativ, tages = istTages) {
  clearTimeout(overTimer)
  istKreativ = alsKreativ
  istTages = !alsKreativ && tages
  app.toggleAttribute('data-kreativ', istKreativ)
  const sc = screenCells()
  const { start, sandbox, ...k } = kreativ
  const { an, ...sb } = sandbox
  if (istTages) {
    // Tages-Herausforderung: feste Kartengroesse, Standardregeln, Startwert vom Tag (gleich fuer alle)
    tagesTag = tagBerlin()
    game = new Game({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h, tempo: 'normal', cfg: { ...DEFAULTS }, seed: tagesSeed(tagesTag), startLevel: 1 })
  } else
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
  if (mode === 'mehr') return mehr.lenke(d)
  if (mode === 'ready') return begin(d)
  if (mode === 'play') game?.turn(d)
}

/** Zaehlt die Runde fuer die Online-Bestenliste? Nur echte Runden mit Standardregeln, ohne Level-Sprung und Autopilot */
function zaehltOnline() {
  if (istKreativ || auto) return false
  if (istTages) return true
  if (startLevel !== 1) return false
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
      leer.textContent =
        listeArt === 'heute'
          ? 'Heute hat noch niemand gespielt. Sei der Erste!'
          : listeArt === 'alle'
            ? 'Noch keine Spieler.'
            : listeArt === 'siege'
              ? 'Noch hat niemand eine Trophäe gewonnen.'
              : listeArt === 'koop'
                ? 'Noch kein Koop-Team in der Liste.'
                : listeArt === 'tages'
                  ? 'Heute hat noch niemand die Tages-Herausforderung gespielt.'
                  : 'Noch keine Ergebnisse.'
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
      level.textContent = z.level > 0 ? String(z.level) : '–'
      // Aussehen der Schlange, online und Einladen (nur Freunde)
      const cv = document.createElement('canvas')
      cv.className = 'liste__skin'
      cv.width = 96
      cv.height = 64
      const da = freundeUids.has(z.user_id) ? onlineListe.find((o) => o.uid === z.user_id) : undefined
      if (da) {
        const punkt = document.createElement('i')
        punkt.className = 'online-punkt'
        punkt.title = da.imSpiel ? 'spielt gerade' : 'online'
        name.prepend(punkt)
      }
      if (listeArt !== 'koop') el.classList.add('liste__zeile--skin')
      if (listeArt === 'koop') el.append(platz, name, level)
      else el.append(platz, cv, name, level)
      if (da && z.user_id !== ich && mehr.verfuegbar) {
        const k = document.createElement('button')
        k.className = 'icon-btn liste__einladen'
        k.setAttribute('aria-label', `${z.name} einladen`)
        setIcon(k, 'UserPlus')
        k.addEventListener('click', () => void einladen(da))
        el.append(k)
      }
      box.append(el)
      drawSkinVorschau(cv, skinVon(z.skin ?? 'klassik'), 0)
    })
    info.textContent =
      listeArt === 'alle'
        ? `${zeilen.length} Spieler insgesamt, sortiert nach bestem Level. „–“ heißt: noch nicht gespielt.`
        : listeArt === 'siege'
          ? 'Trophäen: Jeder Mehrspieler-Sieg bringt eine je besiegtem Gegner (Gegeneinander, Wettrennen, Apfeljagd, Zone).'
          : listeArt === 'koop'
            ? 'Die besten Koop-Teams nach erreichtem Level.'
            : listeArt === 'tages'
              ? 'Heute spielen alle dieselbe Welt (Startmenü → Tages-Herausforderung).'
              : 'Zählt: Standardregeln, normale Runden. Level = höchster erreichter Level.'
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
    const online = await setzeName(input.value)
    audio.click()
    info.textContent = online ? `Gespeichert: Du spielst als ${profil.name}.` : `Name gespeichert. Er wird online eingetragen, sobald du Verbindung hast.`
    knopf.textContent = 'Ändern'
    input.blur()
    void ladeListeAnzeige()
  } catch (err) {
    info.textContent = err instanceof NamenFehler ? err.message : 'Der Name braucht 2 bis 16 Zeichen.'
  } finally {
    knopf.disabled = false
  }
})

/* ================= Hall of Snakes ================= */

const HALL_SEITE = 100
let hallZeilen: HallZeile[] = []
let hallIch: string | null = null
let hallZahl = HALL_SEITE
let hallNr = 0
/** Offene Freundschaftsanfragen (eingehend und ausgehend) */
let anfragen: Anfrage[] = []

async function anfragenLaden() {
  anfragen = await meineAnfragen()
}

async function ladeHallAnzeige() {
  const nr = ++hallNr
  if (!hallZeilen.length) $('hall-info').textContent = 'Lade …'
  try {
    const [{ zeilen, ich }] = await Promise.all([ladeHall(), anfragenLaden(), freundeLaden()])
    if (nr !== hallNr) return
    hallZeilen = zeilen
    hallIch = ich
    hallZeichnen()
  } catch {
    if (nr !== hallNr) return
    $('hall-zeilen').replaceChildren()
    $('hall-info').textContent = 'Keine Verbindung. Die Hall of Snakes braucht Internet.'
  }
}

function hallZeichnen() {
  const box = $('hall-zeilen')
  const such = $<HTMLInputElement>('hall-suche').value.trim().toLowerCase()
  const treffer = such ? hallZeilen.filter((z) => z.name.toLowerCase().includes(such)) : hallZeilen
  box.replaceChildren()
  if (!treffer.length) {
    const leer = document.createElement('p')
    leer.className = 'liste__leer'
    leer.textContent = such ? 'Niemand mit diesem Namen.' : 'Noch keine Spieler.'
    box.append(leer)
  }
  for (const z of treffer.slice(0, hallZahl)) {
    const el = document.createElement('div')
    el.className = z.user_id === hallIch ? 'liste__zeile hall-zeile liste__zeile--ich' : 'liste__zeile hall-zeile'
    const cv = document.createElement('canvas')
    cv.className = 'liste__skin'
    cv.width = 96
    cv.height = 64
    const name = document.createElement('span')
    name.className = 'liste__name'
    name.textContent = z.name
    const troph = document.createElement('span')
    troph.className = 'hall-troph'
    troph.textContent = String(z.trophaeen)
    troph.setAttribute('aria-label', `${z.trophaeen} Trophäen`)
    setIcon(troph, 'Trophy')
    const rekord = document.createElement('b')
    rekord.className = 'liste__level'
    rekord.textContent = z.rekord > 0 ? String(z.rekord) : '–'
    rekord.setAttribute('aria-label', z.rekord > 0 ? `Rekord Level ${z.rekord}` : 'Noch kein Rekord')
    el.append(cv, name, troph, rekord, hallAktion(z))
    box.append(el)
    drawSkinVorschau(cv, skinVon(z.skin ?? 'klassik'), 0)
  }
  $('hall-mehr').hidden = treffer.length <= hallZahl
  $('hall-info').textContent =
    `${hallZeilen.length} Snakes, sortiert nach Rekord, dann Trophäen. „–“ heißt: noch nicht gespielt.` +
    (profil.name ? '' : ' Für Freundschaftsanfragen brauchst du einen Namen (unter Bestenliste).')
}

/** Knopf am Ende der Zeile: Anfrage schicken, zurueckziehen, annehmen oder (Freund) chatten */
function hallAktion(z: HallZeile): HTMLElement {
  if (z.user_id === hallIch || !profil.name) return document.createElement('span')
  const k = document.createElement('button')
  k.className = 'icon-btn hall-aktion'
  const los = (f: () => Promise<void>) => async () => {
    audio.click()
    k.disabled = true
    try {
      await f()
    } catch (err) {
      toast('gebiet', z.name, err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    }
    await ladeHallAnzeige()
  }
  const a = anfragen.find((x) => x.user_id === z.user_id)
  if (freundeUids.has(z.user_id)) {
    setIcon(k, 'MessageCircle')
    k.setAttribute('aria-label', `Mit ${z.name} chatten`)
    k.title = 'Freund: chatten'
    k.addEventListener('click', () => oeffneChat(z))
  } else if (a?.richtung === 'aus') {
    k.classList.add('hall-aktion--warten')
    setIcon(k, 'Clock')
    k.setAttribute('aria-label', `Anfrage an ${z.name} zurückziehen`)
    k.title = 'Anfrage gesendet'
    k.addEventListener('click', () => {
      if (confirm(`Anfrage an ${z.name} zurückziehen?`)) void los(() => anfrageLoeschen(z.user_id))()
    })
  } else if (a?.richtung === 'ein') {
    k.classList.add('hall-aktion--ein')
    setIcon(k, 'Check')
    k.setAttribute('aria-label', `Anfrage von ${z.name} annehmen`)
    k.addEventListener(
      'click',
      los(async () => {
        await anfrageAnnehmen(z.user_id)
        toast('gebiet', `${z.name} ist jetzt dein Freund`, 'Ihr seht euch online und könnt chatten.')
      }),
    )
  } else {
    setIcon(k, 'UserPlus')
    k.setAttribute('aria-label', `${z.name} eine Freundschaftsanfrage schicken`)
    k.addEventListener(
      'click',
      los(async () => {
        const r = await anfrageSenden(z.user_id)
        toast('gebiet', r === 'freunde' ? `${z.name} ist jetzt dein Freund` : `Anfrage an ${z.name}`, r === 'freunde' ? 'Ihr hattet euch beide gefragt.' : 'Gesendet. Sobald angenommen, seid ihr Freunde.')
      }),
    )
  }
  return k
}

$('hall-suche').addEventListener('input', () => {
  hallZahl = HALL_SEITE
  hallZeichnen()
})
$('hall-mehr').addEventListener('click', () => {
  audio.click()
  hallZahl += HALL_SEITE
  hallZeichnen()
})

/* Erster Start: Name gleich am Anfang, ohne Konto. Ohne Netz gilt er trotzdem sofort. */
function zeigeWillkommen() {
  if (!onlineAktiv || profil.name) return
  show('willkommen', true)
  window.setTimeout(() => $<HTMLInputElement>('willkommen-name').focus(), 450)
}
$<HTMLFormElement>('willkommen-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const fehler = $('willkommen-fehler')
  const name = $<HTMLInputElement>('willkommen-name').value
  if (!nameGueltig(name)) {
    fehler.textContent = name.trim().length >= 2 && name.trim().length <= 16 ? 'Dieser Name ist nicht erlaubt.' : 'Der Name braucht 2 bis 16 Zeichen.'
    fehler.hidden = false
    return
  }
  fehler.hidden = true
  try {
    await setzeName(name)
  } catch (err) {
    fehler.textContent = err instanceof NamenFehler ? err.message : 'Das hat nicht geklappt.'
    fehler.hidden = false
    return
  }
  audio.click()
  $<HTMLInputElement>('willkommen-name').blur()
  show('willkommen', false)
  linkRaum()
  void online?.start()
  void freundeLaden()
  sozialStarten()
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
      melde({ level: g.maxLevel, dauer: Math.max(1, Math.round(performance.now() - startedAt)), tempo: istTages ? 'normal' : settings.tempo, tages: istTages })
  }
  overTimer = window.setTimeout(() => {
    if (mode !== 'over') return
    $('over-cause').textContent = g.cause ? CAUSE[g.cause] : ''
    $('over-level').textContent = String(g.level)
    $('over-record').hidden = !neu
    $('over-heute').hidden = !neuHeute
    $('over-tages').hidden = !istTages
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
  $('home-trophaeen').textContent = String(wallet.trophaeen ?? 0)
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

/** Skins ohne Video (Video fehlt oder laedt nicht): werden wie frueher jedes Bild gezeichnet */
const skinCanvas: { cv: HTMLCanvasElement; id: string }[] = []
/** Shop-Vorschauen als fertige Videos (scripts/skin-videos.mjs): nur die sichtbaren laufen */
const skinVideos: HTMLVideoElement[] = []
const ruhig = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const sichtbar = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        const v = e.target as HTMLVideoElement
        if (e.isIntersecting && page() === 'shop' && !ruhig) videoStart(v)
        else v.pause()
      }
    })
  : null

/** Format: H.264 (laeuft ueberall, auch auf dem iPhone), sonst VP9, sonst gar kein Video (dann wird gezeichnet) */
const videoEndung = (() => {
  const t = document.createElement('video')
  if (t.canPlayType('video/mp4; codecs="avc1.64001F"')) return 'mp4'
  if (t.canPlayType('video/webm; codecs="vp9"')) return 'webm'
  return ''
})()

/** Video erst laden, wenn es zu sehen ist: als Ganzes holen (kommt offline aus dem Speicher) und als Blob abspielen */
function videoStart(v: HTMLVideoElement) {
  if (v.src) return void v.play().catch(() => {})
  if (v.dataset.laedt) return
  v.dataset.laedt = '1'
  fetch(v.dataset.video!)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => {
      v.src = URL.createObjectURL(b)
      if (page() === 'shop') void v.play().catch(() => {})
    })
    .catch(() => v.dispatchEvent(new Event('error')))
}

function skinVorschau(id: string): HTMLElement {
  // Ohne bewegtes Muster: nur das Standbild (ein Bild statt eines Videos)
  if (!skinBewegt(skinVon(id))) {
    const img = document.createElement('img')
    img.src = `skins/${id}.webp`
    img.alt = ''
    img.decoding = 'async'
    img.addEventListener('error', () => {
      const cv = document.createElement('canvas')
      img.replaceWith(cv)
      requestAnimationFrame(() => drawSkinVorschau(cv, skinVon(id), 0))
    })
    return img
  }
  const v = document.createElement('video')
  v.muted = true
  v.defaultMuted = true
  v.loop = true
  v.playsInline = true
  v.setAttribute('muted', '')
  v.setAttribute('playsinline', '')
  v.setAttribute('aria-hidden', 'true')
  v.disablePictureInPicture = true
  v.preload = 'none'
  v.poster = `skins/${id}.webp`
  v.dataset.video = `skins/${id}.${videoEndung}`
  if (!videoEndung) queueMicrotask(() => v.dispatchEvent(new Event('error')))
  // Kein Video (z. B. offline und noch nie geladen): selbst zeichnen wie frueher
  v.addEventListener('error', () => {
    const cv = document.createElement('canvas')
    v.replaceWith(cv)
    sichtbar?.unobserve(v)
    skinCanvas.push({ cv, id })
  })
  skinVideos.push(v)
  if (sichtbar) sichtbar.observe(v)
  else if (!ruhig) videoStart(v)
  return v
}

function renderShop() {
  updateGeld()
  const box = $('skins')
  for (const v of skinVideos) {
    sichtbar?.unobserve(v)
    if (v.src.startsWith('blob:')) URL.revokeObjectURL(v.src)
  }
  skinVideos.length = 0
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
    card.innerHTML = `<span class="skin__name"></span><span class="skin__preis"></span>`
    card.prepend(skinVorschau(sk.id))
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
  setzeSkin(id)
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
/** Nur mit Master-Code: 7-mal schnell auf die Versionszeile (Optionen) tippen, dann den Code eingeben */
$('btn-master').hidden = !master.frei
let versionTipps = 0
let versionZeit = 0
$('versionszeile').addEventListener('click', async () => {
  if (master.frei) return
  const jetzt = Date.now()
  versionTipps = jetzt - versionZeit < 1500 ? versionTipps + 1 : 1
  versionZeit = jetzt
  if (versionTipps < 7) return
  versionTipps = 0
  const code = prompt('Master-Code')
  if (!code) return
  if (await masterFreischalten(code)) {
    $('btn-master').hidden = false
    alert('Master-Einstellungen freigeschaltet.')
  } else alert('Falscher Code.')
})
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
  newGame(false, false)
})
$('btn-tages').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  newGame(false, true)
  toast('gebiet', 'Tages-Herausforderung', 'Heute spielen alle dieselbe Welt.')
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
  enabled: () => !page() && (mode === 'ready' || mode === 'play' || mode === 'mehr'),
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
window.addEventListener('pointerdown', () => !gesperrt && audio.unlock(), { once: true })

// App im Hintergrund oder Fenster verlassen: Pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'mehr') mehr.hintergrund()
    pause()
    audio.suspend()
  } else audio.resume()
})
window.addEventListener('blur', pause)

// Android: Zuruecktaste
if (nativ) {
  void App.addListener('backButton', () => {
    if (page()) return closePage()
    if (mode === 'mehr') return
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
      if (mode === 'mehr') mehr.hintergrund()
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
/** Startmenue: der Autopilot spielt im Hintergrund */
function demoBild(dt: number) {
  if (!demo || (demo.status === 'over' && demo.time - demo.deathAt > 1500)) newDemo()
  const d = demo!
  if (d.status === 'play' && !d.queue.length) {
    const dir = autopilot(d)
    if (dir) d.turn(dir, false)
  }
  d.update(dt)
  d.drain()
  renderer.mehr = null
  renderer.draw(d)
}

function frame(now: number) {
  const dt = Math.min(100, now - last)
  last = now
  // Eine Unterseite (Skins, Anleitung, Online ...) deckt das Spielfeld ganz ab: dann nicht zeichnen
  const verdeckt = page() !== null
  if (mode === 'home') {
    // Die Demo im Startmenue ist nur fuers Auge: solange eine Seite sie verdeckt, ruht sie
    if (!verdeckt) demoBild(dt)
  } else if (mode === 'mehr') {
    mehr.frame(dt)
  } else if (game) {
    if (mode === 'play' || mode === 'over') {
      if (auto && mode === 'play' && !game.queue.length) {
        const dir = autopilot(game)
        if (dir) game.turn(dir, false)
      }
      game.update(dt)
      for (const e of game.drain()) handle(e)
    }
    renderer.mehr = null
    if (!verdeckt) renderer.draw(game)
  }
  updateEffekte()
  if (page() === 'shop') for (const s of skinCanvas) drawSkinVorschau(s.cv, skinVon(s.id), now)
  else if (skinVideos.length && !skinVideos.every((v) => v.paused)) for (const v of skinVideos) v.pause()
  requestAnimationFrame(frame)
}

$('home-online').hidden = !onlineAktiv

/* ================= Mehrspieler ================= */

const mehr = mehrspieler({
  renderer,
  audio,
  haptic,
  modus: (m) => {
    if (m === 'mehr') {
      game = null
      setMode('mehr')
    } else if (mode === 'mehr') {
      newDemo()
      setMode('home')
    }
  },
  seiteOeffnen: (p) => openPage(p),
  seitenZu: () => closeAllPages(),
  toast: (titel, text) => toast('gebiet', titel, text),
  geldGeaendert: () => updateGeld(),
  raumGeaendert: () => onlineZeichnen(),
  ichInfo: () => ({ id: geraetId(), name: profil.name || 'Spieler', skin: wallet.skin }),
})
$('btn-mehr').hidden = !(mehr.verfuegbar && onlineAktiv)
// Zum Testen: ?debug gibt den Mehrspieler in der Konsole frei

/* ================= Wer ist online, Einladungen ================= */

const MODUS_NAME: Record<string, string> = { vs: 'Gegeneinander', rennen: 'Wettrennen', koop: 'Koop', jagd: 'Apfeljagd', royale: 'Schrumpfende Karte' }
let onlineListe: OnlineSpieler[] = []
let freunde: Freund[] = []
let freundeUids = new Set<string>()
let offeneEinladung: Einladung | null = null
const lobbyRueckruf: Parameters<typeof lobby>[1] = {
      liste: (o) => {
        onlineListe = o
        onlineZeichnen()
        freundeZeichnen()
        if (page() === 'liste' && listeArt === 'alle') void ladeListeAnzeige()
      },
      einladung: (e) => {
        // Nur Freunde duerfen einladen
        if (!e.vonUid || !freundeUids.has(e.vonUid)) return
        // Waehrend eines Mehrspieler-Spiels nicht stoeren
        if (mode === 'mehr') return online?.antworten(e.von, false)
        offeneEinladung = e
        if (mode === 'play') pause()
        $('einladung-text').textContent = `${e.vonName} lädt dich ein: ${MODUS_NAME[e.modus] ?? 'Mehrspieler'}.`
        show('einladung', true)
        audio.wahl()
        haptic.success()
      },
      antwort: (a) => {
        if (!a.ja) toast('gebiet', `${a.vonName} kann gerade nicht`, 'Einladung abgelehnt')
      },
    }
const online = onlineAktiv ? lobby(() => ({ geraet: geraetId(), name: profil.name, skin: wallet.skin, imSpiel: mode === 'mehr' || mode === 'play' }), lobbyRueckruf) : null

if (online) onlineMelden = () => void online.melden()
// Zum Testen: ?debug gibt Mehrspieler, Zeichner und die Online-Rueckrufe in der Konsole frei
if (params.has('debug')) {
  Object.assign(window, { __mehr: mehr, __renderer: renderer, __lobby: lobbyRueckruf, __geraet: geraetId() })
  Object.defineProperty(window, '__spiel', { get: () => game })
}

/** Jemanden einladen: Raum (falls noch keiner) und Einladung schicken */
async function einladen(o: OnlineSpieler) {
  audio.click()
  const code = await mehr.raumFuerEinladung()
  if (!code || !online) return toast('gebiet', 'Mehrspieler', 'Keine Verbindung zum Server.')
  online.einladen(o.geraet, code, mehr.raum?.modus ?? 'vs')
  toast('gebiet', `Einladung an ${o.name}`, `Raum ${code}`)
  if (page() !== 'mehr') openPage('mehr')
}

/** Online-Liste in der Lobby: Freunde, die noch nicht im Raum sind, kann man einladen */
function onlineZeichnen() {
  const box = $('mehr-online')
  const imRaum = new Set((mehr.raum?.spieler ?? []).map((s) => s.id))
  const frei = onlineListe.filter((o) => !imRaum.has(o.geraet) && !!o.uid && freundeUids.has(o.uid))
  box.replaceChildren()
  if (!frei.length) {
    const p = document.createElement('p')
    p.className = 'liste__leer'
    p.textContent = freunde.length ? 'Gerade ist kein Freund online.' : 'Noch keine Freunde. Tauscht unter „Mehrspieler“ eure Freundes-Codes.'
    box.append(p)
    return
  }
  for (const o of frei) {
    const el = document.createElement('div')
    el.className = 'mehr-zeile'
    const cv = document.createElement('canvas')
    cv.width = 112
    cv.height = 80
    const name = document.createElement('span')
    name.className = 'mehr-zeile__name'
    name.textContent = o.name
    const klein = document.createElement('small')
    klein.textContent = o.imSpiel ? 'spielt gerade' : 'online'
    name.append(klein)
    const k = document.createElement('button')
    k.className = 'btn btn--ghost btn--klein'
    k.textContent = 'Einladen'
    k.addEventListener('click', () => void einladen(o))
    el.append(cv, name, k)
    box.append(el)
    drawSkinVorschau(cv, skinVon(o.skin), 0)
  }
}

/** Freund einladen, der die App gerade nicht offen hat: Nachricht aufs Handy */
async function einladenPerPush(f: Freund) {
  audio.click()
  const code = await mehr.raumFuerEinladung()
  if (!code) return toast('gebiet', 'Mehrspieler', 'Keine Verbindung zum Server.')
  const r = await perPushEinladen(SERVER, f.user_id, code, mehr.raum?.modus ?? 'vs', profil.name)
  toast('gebiet', r.ok ? `Einladung an ${f.name}` : `${f.name} einladen`, r.text)
  if (page() !== 'mehr') openPage('mehr')
}

/** Schalter "Einladungen aufs Handy" */
function pushZeichnen() {
  const zeile = $('push-zeile')
  zeile.hidden = !pushMoeglich() || !mehr.verfuegbar
  if (zeile.hidden) return
  const an = pushErlaubt()
  $('push-knopf').hidden = an
  $('push-info').textContent = an ? 'Ist an: Freunde können dich einladen, auch wenn Snake gerade zu ist.' : Notification.permission === 'denied' ? 'Blockiert. In den Einstellungen des Handys für Snake erlauben.' : 'Freunde können dich einladen, auch wenn Snake gerade zu ist.'
}
$('push-knopf').addEventListener('click', async () => {
  audio.click()
  const r = await pushEinschalten()
  toast('gebiet', 'Einladungen aufs Handy', r === 'an' ? 'Eingeschaltet.' : r === 'verweigert' ? 'Nicht erlaubt. Du kannst es später in den Einstellungen ändern.' : 'Das hat nicht geklappt.')
  pushZeichnen()
})
// Tipp auf eine Push-Einladung, waehrend die App offen ist: dem Raum beitreten
if ('serviceWorker' in navigator)
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data as { typ?: string; code?: string } | null
    if (d?.typ === 'einladung' && d.code && mode !== 'mehr') mehr.beitreten(d.code)
  })

/** Freunde neu laden (nach dem Start, beim Oeffnen der Mehrspieler-Seite, nach Aenderungen) */
async function freundeLaden() {
  pushZeichnen()
  const [f, , sp] = await Promise.all([meineFreunde(), anfragenLaden(), meineSperren(), ungelesenLaden()])
  freunde = f
  freundeUids = new Set(freunde.map((x) => x.user_id))
  freundeZeichnen()
  onlineZeichnen()
  anfragenZeichnen()
  sperrenZeichnen(sp)
  badgeZeichnen()
  const code = await meinCode()
  if (code) $('freund-code').textContent = code
}

/** Zaehler am Knopf "Online": offene Anfragen an mich und ungelesene Nachrichten */
function badgeZeichnen() {
  let n = anfragen.filter((a) => a.richtung === 'ein').length
  for (const z of ungelesen.values()) n += z
  const b = $('online-badge')
  b.hidden = n === 0
  b.textContent = n > 99 ? '99+' : String(n)
  $('btn-mehr').setAttribute('aria-label', n ? `Online, ${n} neu` : 'Online')
}

/** Offene Freundschaftsanfragen auf der Mehrspieler-Seite */
function anfragenZeichnen() {
  const box = $('anfragen-liste')
  box.replaceChildren()
  box.hidden = !anfragen.length
  if (!anfragen.length) return
  const h = document.createElement('h3')
  h.className = 'erfolge-titel'
  h.textContent = 'Freundschaftsanfragen'
  box.append(h)
  const knopf = (text: string, art: string, f: () => Promise<void>) => {
    const k = document.createElement('button')
    k.className = `btn ${art} btn--klein`
    k.textContent = text
    k.addEventListener('click', async () => {
      audio.click()
      k.disabled = true
      try {
        await f()
      } catch (err) {
        toast('gebiet', 'Freundschaftsanfrage', err instanceof Error ? err.message : 'Das hat nicht geklappt.')
      }
      void freundeLaden()
    })
    return k
  }
  for (const a of anfragen) {
    const ein = a.richtung === 'ein'
    const el = document.createElement('div')
    el.className = ein ? 'mehr-zeile mehr-zeile--anfrage mehr-zeile--anfrage-ein' : 'mehr-zeile mehr-zeile--anfrage'
    const cv = document.createElement('canvas')
    cv.width = 112
    cv.height = 80
    const name = document.createElement('span')
    name.className = 'mehr-zeile__name'
    name.textContent = a.name
    const klein = document.createElement('small')
    klein.textContent = ein ? 'möchte dein Freund sein' : 'wartet auf Antwort'
    name.append(klein)
    el.append(cv, name)
    if (ein) {
      el.append(
        knopf('Annehmen', 'btn--play', async () => {
          await anfrageAnnehmen(a.user_id)
          toast('gebiet', `${a.name} ist jetzt dein Freund`, 'Ihr seht euch online und könnt chatten.')
        }),
      )
      const nein = document.createElement('button')
      nein.className = 'icon-btn freund-weg'
      nein.setAttribute('aria-label', `Anfrage von ${a.name} ablehnen`)
      setIcon(nein, 'X')
      const weg = async (f: () => Promise<void>) => {
        audio.click()
        try {
          await f()
        } catch (err) {
          toast('gebiet', 'Freundschaftsanfrage', err instanceof Error ? err.message : 'Das hat nicht geklappt.')
        }
        void freundeLaden()
      }
      nein.addEventListener('click', () => void weg(() => anfrageLoeschen(a.user_id)))
      const bann = document.createElement('button')
      bann.className = 'icon-btn freund-weg'
      bann.setAttribute('aria-label', `${a.name} sperren`)
      bann.title = 'Sperren'
      setIcon(bann, 'Ban')
      bann.addEventListener('click', () => {
        if (confirm(`${a.name} sperren? Ihr könnt euch dann keine Anfragen und Nachrichten mehr schicken.`)) void weg(() => sperren(a.user_id))
      })
      el.append(nein, bann)
    } else el.append(knopf('Zurückziehen', 'btn--ghost', () => anfrageLoeschen(a.user_id)))
    box.append(el)
    drawSkinVorschau(cv, skinVon(a.skin ?? 'klassik'), 0)
  }
}

/** Gesperrte Spieler (aufklappbar), mit Entsperren */
function sperrenZeichnen(liste: Gesperrt[]) {
  $('gesperrt-box').hidden = !liste.length
  const box = $('gesperrt-liste')
  box.replaceChildren()
  for (const g of liste) {
    const el = document.createElement('div')
    el.className = 'mehr-zeile'
    const name = document.createElement('span')
    name.className = 'mehr-zeile__name'
    name.textContent = g.name
    const k = document.createElement('button')
    k.className = 'btn btn--ghost btn--klein'
    k.textContent = 'Entsperren'
    k.addEventListener('click', async () => {
      audio.click()
      try {
        await entsperren(g.user_id)
      } catch {
        /* kein Netz */
      }
      void freundeLaden()
    })
    el.append(name, k)
    box.append(el)
  }
}

/** Live: neue Anfragen und angenommene Anfragen (einmal pro App-Start) */
let sozialAbmelden: (() => void) | null = null
function sozialStarten() {
  if (sozialAbmelden || !onlineAktiv || !profil.name) return
  sozialAbmelden = abonniereSozial({
    nachricht: (n) => {
      if (chatPartner && n.von === chatPartner.user_id && page() === 'chat') {
        if (!chatVerlauf.some((x) => x.id === n.id)) {
          chatVerlauf.push(n)
          chatZeichnen()
        }
        void chatGelesen(n.von)
        return
      }
      ungelesen.set(n.von, (ungelesen.get(n.von) ?? 0) + 1)
      badgeZeichnen()
      freundeZeichnen()
      const f = freunde.find((x) => x.user_id === n.von)
      if (mode !== 'play' && mode !== 'mehr') toast('gebiet', f?.name ?? 'Neue Nachricht', n.text.length > 60 ? `${n.text.slice(0, 57)}…` : n.text)
    },
    anfrage: () => {
      void freundeLaden().then(() => {
        const neu = anfragen.find((a) => a.richtung === 'ein')
        if (neu && mode !== 'play' && mode !== 'mehr') toast('gebiet', 'Freundschaftsanfrage', `${neu.name} möchte dein Freund sein.`)
        if (page() === 'hall') void ladeHallAnzeige()
      })
    },
    freund: () => {
      void freundeLaden()
      if (page() === 'hall') void ladeHallAnzeige()
    },
  })
}

/* ================= Chat (nur unter Freunden, 30 Tage) ================= */

type ChatPartner = { user_id: string; name: string; skin?: string }
let chatPartner: ChatPartner | null = null
let chatVerlauf: Nachricht[] = []
let chatNr = 0
/** Ungelesene Nachrichten je Freund */
const ungelesen = new Map<string, number>()

async function ungelesenLaden() {
  const c = await meineChats()
  ungelesen.clear()
  for (const x of c) if (x.ungelesen > 0) ungelesen.set(x.user_id, x.ungelesen)
}

function chatHinweis(text: string) {
  const p = document.createElement('p')
  p.className = 'chat__hinweis'
  p.textContent = text
  return p
}

function oeffneChat(p: ChatPartner) {
  chatPartner = p
  chatVerlauf = []
  $('chat-name').textContent = p.name
  $('chat-sperren').setAttribute('aria-label', `${p.name} sperren`)
  drawSkinVorschau($<HTMLCanvasElement>('chat-skin'), skinVon(p.skin ?? 'klassik'), 0)
  $('chat-verlauf').replaceChildren(chatHinweis('Lade …'))
  if (pages.includes('chat')) audio.click()
  else openPage('chat')
  void chatLaden()
}

async function chatLaden() {
  const p = chatPartner
  if (!p) return
  const nr = ++chatNr
  try {
    const n = await ladeNachrichten(p.user_id)
    if (nr !== chatNr || chatPartner !== p) return
    chatVerlauf = n
    chatZeichnen()
    if (ungelesen.has(p.user_id) || n.some((x) => x.von === p.user_id && !x.gelesen)) {
      ungelesen.delete(p.user_id)
      badgeZeichnen()
      freundeZeichnen()
      void chatGelesen(p.user_id)
    }
  } catch {
    if (nr !== chatNr) return
    $('chat-verlauf').replaceChildren(chatHinweis('Keine Verbindung. Der Chat braucht Internet.'))
  }
}

function chatZeichnen() {
  const p = chatPartner
  if (!p) return
  const box = $('chat-verlauf')
  box.replaceChildren(chatHinweis('Nur ihr zwei seht diese Nachrichten. Sie werden nach 30 Tagen gelöscht.'))
  if (!chatVerlauf.length) box.append(chatHinweis(`Noch keine Nachrichten. Schreib ${p.name} die erste!`))
  const heute = new Date().toDateString()
  let tag = ''
  for (const n of chatVerlauf) {
    const d = new Date(n.created_at)
    if (d.toDateString() !== tag) {
      tag = d.toDateString()
      const t = document.createElement('span')
      t.className = 'chat__tag'
      t.textContent = tag === heute ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
      box.append(t)
    }
    const b = document.createElement('div')
    b.className = n.von === p.user_id ? 'chat__blase' : 'chat__blase chat__blase--ich'
    const text = document.createElement('span')
    text.textContent = n.text
    const zeit = document.createElement('small')
    zeit.textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    b.append(text, zeit)
    box.append(b)
  }
  box.scrollTop = box.scrollHeight
}

$<HTMLFormElement>('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const p = chatPartner
  const input = $<HTMLInputElement>('chat-text')
  const text = input.value.trim()
  if (!p || !text) return
  input.value = ''
  try {
    const n = await sendeNachricht(p.user_id, text)
    if (chatPartner === p && !chatVerlauf.some((x) => x.id === n.id)) {
      chatVerlauf.push(n)
      chatZeichnen()
    }
  } catch (err) {
    if (!input.value) input.value = text
    toast('gebiet', 'Nicht gesendet', err instanceof Error ? err.message : 'Das hat nicht geklappt.')
  }
})

$('chat-sperren').addEventListener('click', async () => {
  const p = chatPartner
  if (!p || !confirm(`${p.name} sperren? Die Freundschaft endet und ihr könnt euch keine Anfragen und Nachrichten mehr schicken.`)) return
  audio.click()
  try {
    await sperren(p.user_id)
    toast('gebiet', `${p.name} gesperrt`, 'Entsperren kannst du unter Online, Gesperrte Spieler.')
    closePage()
    void freundeLaden()
  } catch (err) {
    toast('gebiet', 'Sperren', err instanceof Error ? err.message : 'Das hat nicht geklappt.')
  }
})

/** Freundesliste auf der Mehrspieler-Seite */
function freundeZeichnen() {
  const box = $('freunde-liste')
  box.replaceChildren()
  if (!freunde.length) {
    const p = document.createElement('p')
    p.className = 'liste__leer'
    p.textContent = 'Noch keine Freunde. Schick deinen Code oder tipp den Code eines Freundes ein.'
    box.append(p)
    return
  }
  for (const f of freunde) {
    const da = onlineListe.find((o) => o.uid === f.user_id)
    const el = document.createElement('div')
    el.className = 'mehr-zeile mehr-zeile--freund'
    const cv = document.createElement('canvas')
    cv.width = 112
    cv.height = 80
    const name = document.createElement('span')
    name.className = 'mehr-zeile__name'
    if (da) {
      const punkt = document.createElement('i')
      punkt.className = 'online-punkt'
      name.append(punkt)
    }
    name.append(f.name)
    const klein = document.createElement('small')
    klein.textContent = `${da ? (da.imSpiel ? 'spielt gerade · ' : 'online · ') : ''}Rekord ${f.level || '–'}`
    name.append(klein)
    const chatK = document.createElement('button')
    chatK.className = 'icon-btn freund-chat'
    const neu = ungelesen.get(f.user_id) ?? 0
    chatK.setAttribute('aria-label', neu ? `Mit ${f.name} chatten, ${neu} neu` : `Mit ${f.name} chatten`)
    setIcon(chatK, 'MessageCircle')
    if (neu) {
      const z = document.createElement('i')
      z.className = 'chat-zahl'
      z.textContent = neu > 99 ? '99+' : String(neu)
      chatK.append(z)
    }
    chatK.addEventListener('click', () => oeffneChat(f))
    const einladenK = document.createElement('button')
    einladenK.className = 'icon-btn freund-einladen'
    einladenK.setAttribute('aria-label', `${f.name} zum Spiel einladen`)
    einladenK.title = 'Einladen'
    setIcon(einladenK, 'Gamepad2')
    // Online: Einladung in der App. Sonst als Nachricht aufs Handy (Push)
    einladenK.hidden = !mehr.verfuegbar
    einladenK.addEventListener('click', () => void (da ? einladen(da) : einladenPerPush(f)))
    const weg = document.createElement('button')
    weg.className = 'icon-btn freund-weg'
    weg.setAttribute('aria-label', `${f.name} entfernen`)
    setIcon(weg, 'X')
    weg.addEventListener('click', async () => {
      if (!confirm(`${f.name} aus deinen Freunden entfernen?`)) return
      await freundEntfernen(f.user_id)
      void freundeLaden()
    })
    el.append(cv, name, chatK, einladenK, weg)
    box.append(el)
    drawSkinVorschau(cv, skinVon(f.skin), 0)
  }
}

$<HTMLFormElement>('freund-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('freund-eingabe')
  const code = input.value.trim().toUpperCase()
  if (code.length !== 6) return toast('gebiet', 'Code prüfen', 'Ein Freundes-Code hat 6 Zeichen.')
  try {
    const name = await freundHinzufuegen(code)
    input.value = ''
    input.blur()
    audio.click()
    toast('gebiet', `${name} ist jetzt dein Freund`, 'Ihr seht euch online und könnt euch einladen.')
    void freundeLaden()
  } catch (err) {
    toast('gebiet', 'Freund hinzufügen', err instanceof Error ? err.message : 'Das hat nicht geklappt.')
  }
})
$('freund-teilen').addEventListener('click', async () => {
  const code = $('freund-code').textContent?.trim()
  if (!code || code.includes('-')) return
  const text = `Füg mich in Snake als Freund hinzu: ${code}`
  try {
    if (navigator.share) await navigator.share({ title: 'Snake', text })
    else {
      await navigator.clipboard.writeText(text)
      toast('gebiet', 'Kopiert', 'Dein Freundes-Code ist in der Zwischenablage.')
    }
  } catch {
    /* abgebrochen */
  }
})

$('einladung-ja').addEventListener('click', () => {
  const e = offeneEinladung
  offeneEinladung = null
  show('einladung', false)
  if (!e) return
  audio.click()
  if (mode === 'paused' || mode === 'ready' || mode === 'over') {
    game = null
    newDemo()
    setMode('home')
  }
  if (mehr.raum && mehr.raum.code !== e.code) mehr.client.verlassen()
  mehr.beitreten(e.code)
})
$('einladung-nein').addEventListener('click', () => {
  const e = offeneEinladung
  offeneEinladung = null
  show('einladung', false)
  audio.click()
  if (e) online?.antworten(e.von, false)
})

/** Einladungs-Link ?raum=CODE: beitreten, sobald ein Name da ist */
let raumAusLink = mehr.verfuegbar && onlineAktiv ? (params.get('raum') ?? '').toUpperCase() : ''
function linkRaum() {
  if (!raumAusLink || !profil.name || gesperrt) return
  const code = raumAusLink
  raumAusLink = ''
  mehr.beitreten(code)
}
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
if (!gesperrt) {
  zeigeWillkommen()
  linkRaum()
  if (profil.name) {
    void online?.start()
    void freundeLaden()
    sozialStarten()
    void pushAuffrischen()
  }
  setzeSkin(wallet.skin)
  requestAnimationFrame(frame)
}

// Service Worker nur im Browser (die Android-App hat alles dabei)
if (!nativ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
