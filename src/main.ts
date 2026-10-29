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
import { BossGame, GOLEM, missionSpiel } from './game/boss'
import { KaefigBossGame, MEISTER } from './game/kaefigboss'
import { ENT, EntBossGame } from './game/entboss'
import { karteVon, MissionGame } from './game/mission'
import { spielbar, WIESE_MISSIONEN, type MissionDef } from './game/missionen'
import { erreicht, geschafft, missionGeschafft, offen, setzeErreicht } from './kampagne'
import { apfelFaktor, DEFAULTS, gebietFortschritt, gefahrStufe, kreativAus, kreativDinge, mitStufen, NIE, SCHEMA, STUFE_NAME, STUFEN_SCHEMA, stufeKey, WELT_GEFAHREN, WELT_STUFEN, type SchemaFeld, type Tempo, type WeltId } from './game/rules'
import { modusProzent, SPIELMODUS_NAME, type SpielModus } from './modus'
import { ERFOLGE, erfolgePruefen, stand, zaehle } from './erfolge'
import type { Dir, GameEvent, Side } from './game/types'
import { haptic } from './haptics'
import { installPflicht, zeigeInstallation } from './install'
import { tagBerlin, tagesSeed } from './tages'
import { eckenFelder, tagesLevel, wochentag } from './game/tageslevel'
import { MEHR_BILD } from './multi/protokoll'
import { perPushEinladen, pushAuffrischen, pushAusschalten, pushEinschalten, pushErlaubt, pushFehler, pushFrageMerken, pushFrageOffen, pushGrund, pushMoeglich } from './push'
import { geraetId, mehrspieler, SERVER } from './multi/ui'
import { bindDpad, bindInput } from './input'
import { Renderer } from './render/renderer'
import { BergKacheln } from './render/berge'
import { KampagnenKarte, type FeldZustand } from './render/kampagne'
import { apfelFarben, drawApfel } from './render/sprites'
import { abmelden, abonniere, abonniereHall, abonniereSozial, adminLoeschen, angemeldet, anmelden, beiZustand, eigeneUid, kontoLoeschen, kontoReparieren, kontoSichern, onlineZustand, type OnlineZustand, anfrageAnnehmen, anfrageLoeschen, anfrageSenden, chatGelesen, entsperren, freundEntfernen, freundHinzufuegen, ladeHall, ladeListe, ladeNachrichten, lobby, meineAnfragen, meineChats, meineFreunde, meineSperren, meinCode, melde, NamenFehler, NameVergeben, nameGueltig, PasswortFalsch, onlineAktiv, profil, sendeNachricht, setzeName, setzeSilber, setzeSkin, sperren, type Anfrage, type Art, type Einladung, type Freund, type Gesperrt, type HallZeile, type NameErgebnis, type Nachricht, type OnlineSpieler } from './online'
import { beiCloud } from './cloud'
import { APK_URL, neueVersion } from './update'
import { config, heuteBest, heuteDatum, kreativ, master, masterFreischalten, masterPruefen, resetConfig, resetStats, saveConfig, saveKreativ, saveSettings, saveStats, saveWallet, settings, stats, verdienen, verdienenModus, wallet, type LookWahl } from './storage'
import { ACCS, baueSkin, drawSchlangeGerade, drawSkinVorschau, FARBEN, hatSkin, lohnVon, missionLohnVon, MUSTER, nameVon, preisVon, skinVon, SPUREN, TEILUNGEN, vorschauFuer, WELT_LOHN, type Fokus, type Platz, type Skin } from './render/skins'
import { EFFEKTE, effektFrei } from './render/effekte'
import { drawWeltVorschau, naechsteWelt, vorherigeWelt, WELTEN, weltFrei, weltFreiAlt, weltStufe, weltVon, type Welt } from './render/welten'
import { mountIcons, setIcon } from './ui/icons'
import { drawMini, MINI_FOR_CAUSE } from './ui/minis'
import { CAUSE, help } from './ui/texts'

type Mode = 'home' | 'ready' | 'play' | 'paused' | 'over' | 'mehr'
type Page = 'help' | 'stats' | 'settings' | 'kreativ' | 'master' | 'shop' | 'shopteil' | 'liste' | 'mehr' | 'hall' | 'chat' | 'kampagne'

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
// Silber-Trophaeen = alle je verdienten Aepfel. Aeltere Spielstaende: Vorrat plus alles, was schon gekauft wurde
if (wallet.verdient === undefined) {
  wallet.verdient = wallet.aepfel + wallet.skins.reduce((s, id) => s + preisVon(id), 0)
  saveWallet()
}
// 1.28: Welten gehen jetzt mit Level 100 in der Welt davor auf. Was nach der alten Regel (Rekord) frei war, bleibt frei
if (!wallet.welten) {
  wallet.welten = WELTEN.filter((w) => weltFreiAlt(w, stats.best)).map((w) => w.id)
  saveWallet()
}
// 1.39: jede Welt hat ihre eigene Schwelle (Wiese 60, Wueste 80, ...). Wer sie schon geschafft hat, bekommt die naechste Welt
for (const w of WELTEN) {
  const nw = naechsteWelt(w)
  const frei: string[] = wallet.welten ?? []
  if (nw && (stats.weltBest?.[w.id] ?? 0) >= weltStufe(w) && !frei.includes(nw.id)) {
    wallet.welten = [...frei, nw.id]
    saveWallet()
  }
}
/** Grosse Zahlen kurz: 9.480, 12,5k, 125k, 1,3 Mio. */
const kurzZahl = (n: number) => {
  const k = (v: number) => v.toFixed(v < 100 ? 1 : 0).replace(/\.0$/, '').replace('.', ',')
  return n < 10_000 ? n.toLocaleString('de-DE') : n < 1_000_000 ? `${k(n / 1000)}k` : `${k(n / 1_000_000)} Mio.`
}
/** Darf diese Welt gespielt werden? Freigeschaltet, oder im Admin-Zugang jede */
const weltOffen = (w: Welt) => master.frei || weltFrei(w, wallet.welten ?? [])
/** Gewaehlte Welt, wenn sie (noch) freigeschaltet ist, sonst die Wiese */
const aktiveWelt = (): Welt => {
  const w = weltVon(wallet.welt)
  return weltOffen(w) ? w : WELTEN[0]
}
renderer.welt = aktiveWelt()

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
/** Laufende Mission der Kampagne (null = keine) */
let laufMission: MissionDef | null = null
/** Berge je Mission: bleiben vorgezeichnet, so startet "Nochmal" ohne Wartezeit */
const bergeJe = new Map<string, BergKacheln>()
/** Welcher Modus laeuft gerade (Abenteuer, Normal, Speedrun)? Tages- und Kreativ-Runden sind immer Normal */
let laufModus: SpielModus = 'normal'
/** Laeuft gerade ein Speedrun (25 % schneller, jeder Apfel mit Zeitlimit)? */
let istSpeedrun = false
/** Aepfel, die in dieser Runde gutgeschrieben wurden (Anzeige am Ende) */
let laufGeld = 0
/** Tageslevel: so viele Aepfel muessen geholt werden */
let tagesZiel = 0
/** Das heutige Tageslevel (fuer alle gleich) */
const heutigesLevel = () => {
  const tag = tagBerlin()
  return tagesLevel(tagesSeed(tag), wochentag(tag))
}
/** Speedrun: seit wann der aktuelle Apfel liegt und wie viel Zeit es fuer ihn gibt (Spielzeit, ms) */
let frist: { t: number; dauer: number } | null = null
let tagesTag = ''
let game: Game | null = null
let demo: Game | null = null
let startedAt = 0
let overTimer = 0
/** ?level=150 startet direkt bei Level 150 (zum Ausprobieren). Wie der Kreativ-Modus nur fuer den Admin (oder beim Entwickeln) */
const params = new URLSearchParams(location.search)
const testFrei = import.meta.env.DEV || master.frei
const startLevel = testFrei ? Math.max(1, Number(params.get('level')) || 1) : 1
/** ?auto=1 laesst den Autopilot auch im Spiel steuern (zum Testen der spaeten Level), ebenfalls nur fuer den Admin */
const auto = testFrei && params.has('auto')
/** Nur beim Entwickeln: ?mission=10 startet diese Mission der Wiese gleich */
const devMission = import.meta.env.DEV ? Number(params.get('mission')) || 0 : 0

mountIcons(document)
$('version').textContent = __APP_VERSION__
// Kreativ-Modus nur fuer den Admin: passt das gespeicherte Passwort nicht, verschwindet der Zugang
void masterPruefen().then((ok) => {
  if (!ok) $('btn-kreativ-home').hidden = true
})

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
  $('speedrun-zeit').hidden = !(istSpeedrun && (m === 'ready' || m === 'play' || m === 'paused'))
  if (m === 'mehr') $('dpad').hidden = !settings.dpad
  audio.music(true, m !== 'play' && m !== 'mehr')
  if (m === 'home') updateHome()
  onlineMelden()
}

function openPage(p: Page) {
  audio.click()
  // Admin-Seite und Kreativ-Modus nur im Admin-Zugang
  if (pages.includes(p) || ((p === 'master' || p === 'kreativ') && !master.frei)) return
  pages.push(p)
  if (p === 'help') renderHelp()
  if (p === 'stats') renderStats()
  if (p === 'settings') renderSettings()
  if (p === 'kreativ') renderKreativ()
  if (p === 'master') renderMaster()
  if (p === 'shop') renderShop()
  if (p === 'shopteil') renderTeil()
  if (p === 'liste') oeffneListe()
  if (p === 'mehr') void freundeLaden()
  if (p === 'hall') {
    void ladeHallAnzeige()
    hallLiveAn()
  }
  if (p === 'kampagne') kampagneOeffnen()
  if (p === 'mehr' || p === 'hall') pushFragen()
  show(p, true)
}
function closePage() {
  const p = pages.pop()
  if (!p) return
  audio.click()
  show(p, false)
  if (p === 'liste') schliesseListe()
  if (p === 'hall') hallLiveAus()
  if (p === 'chat') chatPartner = null
  if (p === 'shopteil' && page() === 'shop') renderShop()
}
function closeAllPages() {
  while (pages.length) {
    const p = pages.pop()!
    show(p, false)
    if (p === 'liste') schliesseListe()
    if (p === 'hall') hallLiveAus()
    if (p === 'chat') chatPartner = null
  }
}

/* ================= Spiel ================= */

function newGame(alsKreativ = istKreativ, tages = istTages, modus: SpielModus = laufModus, mission: MissionDef | null = laufMission) {
  clearTimeout(overTimer)
  istKreativ = alsKreativ
  istTages = !alsKreativ && tages
  laufMission = !alsKreativ && !istTages ? mission : null
  laufModus = !alsKreativ && !istTages && !laufMission ? modus : 'normal'
  // Missionen spielen in ihrer eigenen Welt (bisher die Wiese), sonst die gewaehlte
  renderer.welt = laufMission ? weltVon(laufMission.welt) : aktiveWelt()
  app.toggleAttribute('data-mission', !!laufMission)
  istSpeedrun = laufModus === 'speedrun'
  laufGeld = 0
  renderer.blitzApfel = istSpeedrun
  frist = null
  app.toggleAttribute('data-kreativ', istKreativ)
  const sc = screenCells()
  if (laufMission) {
    // Kampagne: feste Karte, immer gleich (Berge rundherum, alle Aepfel liegen schon da).
    // Im Querformat (PC) ist sie um 90 Grad gedreht: man spielt von links nach rechts und die Felder sind groesser
    const mg = missionSpiel(laufMission, stage.clientWidth > stage.clientHeight)
    game = mg
    const id = mg.quer ? `${laufMission.id}:quer` : laufMission.id
    let b = bergeJe.get(id)
    if (!b) {
      b = new BergKacheln(mg)
      bergeJe.set(id, b)
    }
    renderer.berge = b
  } else if (istTages) {
    // Tages-Herausforderung: feste Kartengroesse, Standardregeln, Startwert vom Tag (gleich fuer alle)
    // Tageslevel: eigene Karte (Bloecke, Ecken), Motto, Laenge und Apfelziel aus dem Datum; alles bleibt liegen
    tagesTag = tagBerlin()
    const seed = tagesSeed(tagesTag)
    const tl = tagesLevel(seed, wochentag(tagesTag))
    tagesZiel = tl.ziel
    // Blockgroesse wie im Spiel (haengt nur an der festen Bildgroesse)
    const probe = new Game({ screenW: MEHR_BILD.w, screenH: MEHR_BILD.h })
    const felder = (art: 'ab' | 'dazu') => tl.ecken.filter((e) => e.art === art).flatMap((e) => eckenFelder(e, probe.bw, probe.bh))
    game = new Game({
      screenW: MEHR_BILD.w,
      screenH: MEHR_BILD.h,
      tempo: 'normal',
      cfg: { ...DEFAULTS, falleDauer: 1_000_000 },
      seed,
      startLevel: 1,
      sandbox: { breite: 0, hoehe: 0, laenge: tl.laenge, objekte: tl.objekte, weiter: false, bloecke: tl.bloecke, aus: felder('ab'), dazu: felder('dazu') },
      // Im Vulkan ist auch hier rundherum der Lava-Abgrund (die Karte selbst bleibt fuer alle gleich)
      vulkan: renderer.welt.id === 'vulkan',
    })
  } else
    game = new Game({
      screenW: sc.w,
      screenH: sc.h,
      tempo: tempoVon(laufModus),
      // Kreativ: was abgeschaltet ist, kommt nie
      cfg: istKreativ ? { ...config, ...kreativAus(kreativWelt(), kreativ.aus[kreativWelt()] ?? []) } : { ...config },
      wueste: renderer.welt.id === 'wueste',
      vulkan: renderer.welt.id === 'vulkan',
      welt: renderer.welt.id,
      startLevel: istKreativ ? kreativ.start : startLevel,
      // Jede Runde eine andere Welt mit unregelmaessigen Raendern (Sandbox hat ihre eigene Karte)
      zufallsWelt: true,
    })
  if (!laufMission) renderer.berge = null
  renderer.minikarte = !laufMission
  renderer.reset()
  renderer.sonderApfel = false
  $('tages-ziel').hidden = !istTages && !laufMission
  $('tages-ziel').classList.toggle('tages-ziel--mission', !!laufMission)
  readyText()
  setMode('ready')
  // Steuerkreuz veraendert die Hoehe: danach neu messen
  requestAnimationFrame(resize)
  updateHud(false)
  updateGeld()
  toastsClear()
}

/** Tempo-Stufe fuer den Server und die Ranglisten: Abenteuer 'langsam', Speedrun 'schnell' */
const tempoVon = (m: SpielModus): Tempo => (m === 'abenteuer' ? 'langsam' : m === 'speedrun' ? 'schnell' : 'normal')

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
  if (istKreativ || auto || laufMission) return false
  if (istTages) return true
  if (startLevel !== 1) return false
  return (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]).every((k) => config[k] === DEFAULTS[k])
}

/* ================= Online-Bestenliste ================= */

/** Hinweis unter dem Namensfeld: der Name ist zugleich der Account */
const nameInfo = () =>
  angemeldet()
    ? 'So sehen dich die anderen. Mit Name und Passwort kommst du auf jedem Gerät in deinen Account.'
    : 'Ohne Anmeldung zählen deine Ergebnisse nicht.'
/** Meldung nach dem Aendern des Namens */
const nameMeldung = (r: NameErgebnis, name: string) =>
  r === 'umbenannt' ? `Gespeichert: Du heißt jetzt ${name}. Dein Passwort bleibt gleich.` : 'Name gespeichert. Er wird online eingetragen, sobald du Verbindung hast.'

let listeArt: Art = 'heute'
let listeAbmelden: (() => void) | null = null
let listeNr = 0

function oeffneListe() {
  $<HTMLInputElement>('liste-name').value = profil.name
  $('liste-name-info').textContent = nameInfo()
  $('liste-speichern').textContent = angemeldet() ? 'Ändern' : 'Anmelden'
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
        t.textContent = z.tempo === 'schnell' ? 'Speedrun' : z.tempo === 'langsam' ? 'Abenteuer' : z.tempo
        name.append(t)
      }
      const level = document.createElement('b')
      level.className = 'liste__level'
      if (listeArt === 'tages') {
        // Geschafft: Zeit, sonst geholte Aepfel
        const ziel = heutigesLevel().ziel
        const s = Math.round((z.dauer_ms ?? 0) / 1000)
        level.textContent = z.level >= ziel && z.dauer_ms ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${z.level}/${ziel}`
      } else level.textContent = z.level > 0 ? String(z.level) : '–'
      // Aussehen der Schlange, online und Einladen (nur Freunde)
      const cv = document.createElement('canvas')
      cv.className = 'liste__skin'
      cv.width = 96
      cv.height = 64
      const da = onlineVon(z.user_id)
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
      drawSchlangeGerade(cv, skinVon(z.skin ?? 'klassik'), 0)
    })
    info.textContent =
      listeArt === 'alle'
        ? `${zeilen.length} Spieler insgesamt, sortiert nach bestem Level. „–“ heißt: noch nicht gespielt.`
        : listeArt === 'siege'
          ? 'Trophäen: Jeder Mehrspieler-Sieg bringt eine je besiegtem Gegner (Gegeneinander, Wettrennen, Apfeljagd, Zone).'
          : listeArt === 'koop'
            ? 'Die besten Koop-Teams nach erreichtem Level.'
            : listeArt === 'tages'
              ? `Heutiges Tageslevel: ${heutigesLevel().motto}, ${heutigesLevel().ziel} Äpfel. Wer alle holt, steht nach Zeit vorn, dahinter nach geholten Äpfeln.`
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
  // Nicht angemeldet: dafuer gibt es die Anmeldung (Name und Passwort)
  if (!angemeldet()) return zeigeWillkommen()
  const input = $<HTMLInputElement>('liste-name')
  const info = $('liste-name-info')
  if (!nameGueltig(input.value)) {
    info.textContent = 'Der Name braucht 2 bis 16 Zeichen.'
    return
  }
  const knopf = $<HTMLButtonElement>('liste-speichern')
  knopf.disabled = true
  try {
    const r = await setzeName(input.value)
    audio.click()
    info.textContent = nameMeldung(r, profil.name)
    knopf.textContent = 'Ändern'
    input.blur()
    void ladeHallAnzeige()
  } catch (err) {
    info.textContent =
      err instanceof NameVergeben
        ? 'Diesen Namen gibt es schon. Willst du in diesen Account? Dann unten „Abmelden“ und mit seinem Namen und Passwort anmelden.'
        : err instanceof NamenFehler
          ? err.message
          : 'Das hat nicht geklappt. Bist du online?'
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
/** Live: solange die Hall offen ist, neu laden, sobald sich dort etwas aendert (Rekord, Skin, Name, neuer Spieler) */
let hallLive: (() => void) | null = null
function hallLiveAn() {
  if (!onlineAktiv || hallLive) return
  hallLive = abonniereHall(() => {
    if (page() === 'hall') void ladeHallAnzeige()
  })
}
function hallLiveAus() {
  hallLive?.()
  hallLive = null
}
/** Offene Freundschaftsanfragen (eingehend und ausgehend) */
let anfragen: Anfrage[] = []

async function anfragenLaden() {
  anfragen = await meineAnfragen()
}

/** Hall of Snakes (zugleich die Bestenliste): Alle, Freunde oder das heutige Tageslevel; sortiert nach Rekord, Gold oder Silber */
let hallTab: 'alle' | 'freunde' | 'tages' = 'alle'
let hallSort: 'rekord' | 'gold' | 'silber' = 'rekord'
let tagesZeilen: Awaited<ReturnType<typeof ladeListe>>['zeilen'] = []

async function ladeHallAnzeige() {
  const nr = ++hallNr
  // Name-Feld (aus der frueheren Bestenliste) aktuell halten
  $<HTMLInputElement>('liste-name').value = profil.name
  $('liste-name-info').textContent = nameInfo()
  $('liste-speichern').textContent = angemeldet() ? 'Ändern' : 'Anmelden'
  $('konto-abmelden').hidden = !angemeldet()
  if (!hallZeilen.length) $('hall-info').textContent = 'Lade …'
  try {
    const [{ zeilen, ich }, , , tages] = await Promise.all([ladeHall(), anfragenLaden(), freundeLaden(), hallTab === 'tages' ? ladeListe('tages') : Promise.resolve(null)])
    if (nr !== hallNr) return
    hallZeilen = zeilen
    hallIch = ich
    if (tages) tagesZeilen = tages.zeilen
    hallZeichnen()
    eintragPruefen()
  } catch {
    if (nr !== hallNr) return
    $('hall-zeilen').replaceChildren()
    $('hall-info').textContent = 'Keine Verbindung. Die Hall of Snakes braucht Internet.'
  }
}

function hallZeichnen() {
  for (const b of $('hall-tabs').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === hallTab))
  for (const b of $('hall-sort').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === hallSort))
  $('hall-sort').hidden = hallTab === 'tages'
  $('hall-wert').textContent = hallTab === 'tages' ? 'Zeit' : hallSort === 'rekord' ? 'Rekord' : hallSort === 'gold' ? 'Gold' : 'Silber'
  if (hallTab === 'tages') return tagesZeichnen()
  const box = $('hall-zeilen')
  const such = $<HTMLInputElement>('hall-suche').value.trim().toLowerCase()
  const wert = (z: HallZeile) => (hallSort === 'rekord' ? z.rekord : hallSort === 'gold' ? z.trophaeen : (z.silber ?? 0))
  const treffer = hallZeilen
    .filter((z) => (!such || z.name.toLowerCase().includes(such)) && (hallTab === 'alle' || freundeUids.has(z.user_id) || z.user_id === hallIch))
    .sort((a, b) => wert(b) - wert(a) || b.rekord - a.rekord || a.name.localeCompare(b.name))
  box.replaceChildren()
  if (!treffer.length) {
    const leer = document.createElement('p')
    leer.className = 'liste__leer'
    leer.textContent = such ? 'Niemand mit diesem Namen.' : hallTab === 'freunde' ? 'Noch keine Freunde. Schick jemandem unter „Alle“ eine Anfrage.' : 'Noch keine Spieler.'
    box.append(leer)
  }
  treffer.slice(0, hallZahl).forEach((z, i) => {
    const el = document.createElement('div')
    el.className = z.user_id === hallIch ? 'liste__zeile hall-zeile liste__zeile--ich' : 'liste__zeile hall-zeile'
    const platz = document.createElement('span')
    platz.className = 'liste__platz'
    platz.textContent = String(i + 1)
    const cv = document.createElement('canvas')
    cv.className = 'liste__skin'
    cv.width = 96
    cv.height = 64
    const name = document.createElement('span')
    name.className = 'liste__name'
    name.textContent = z.name
    const w = wert(z)
    const zahl = document.createElement('b')
    zahl.className = `liste__level hall-wert hall-wert--${hallSort}`
    zahl.textContent = w > 0 ? kurzZahl(w) : '–'
    zahl.setAttribute('aria-label', hallSort === 'rekord' ? (w > 0 ? `Rekord Level ${w}` : 'Noch kein Rekord') : `${w} ${hallSort === 'gold' ? 'Gold' : 'Silber'}-Trophäen`)
    const da = onlineVon(z.user_id)
    if (da) {
      const punkt = document.createElement('i')
      punkt.className = 'online-punkt'
      punkt.title = da.imSpiel ? 'spielt gerade' : 'online'
      name.prepend(punkt)
    }
    el.append(platz, cv, name, zahl, hallAktion(z))
    spielerAntippbar(el, z)
    box.append(el)
    drawSchlangeGerade(cv, skinVon(z.skin ?? 'klassik'), 0)
  })
  $('hall-mehr').hidden = treffer.length <= hallZahl
  $('hall-info').textContent =
    `${treffer.length} Snakes. Tippe einen Spieler an, um ihn zum Gefecht einzuladen. Gold: Trophäen aus Mehrspieler-Siegen. Silber: alle je verdienten Äpfel. „–“ heißt: noch nichts.` +
    (angemeldet() ? '' : ' Für Freundschaftsanfragen musst du angemeldet sein.')
}

/* ================= Eigener Eintrag: fehlt er, wird repariert ================= */

/** Hinweis unter dem Namen, wenn dieses Geraet online nicht eingetragen ist (mit "Neu verbinden") */
function kontoStatusZeigen(z: OnlineZustand | null) {
  const box = $('konto-status')
  box.hidden = !z || z.ok || !z.text
  if (!z || box.hidden) return
  $('konto-status-text').textContent = z.text
  $('konto-status-technisch').textContent = z.technisch ?? ''
}
beiZustand((z) => {
  // Abgemeldet (Sitzung weg, Account geloescht): gleich die Anmeldung zeigen
  if (z.anmelden) return zeigeWillkommen()
  if (page() === 'hall' && (!z.ok || $('konto-status').hidden === false)) kontoStatusZeigen(z.ok ? null : z)
  if (z.ok) $('freund-code-fehlt').hidden = true
})

let reparaturVersucht = false
/**
 * Nach dem Laden der Hall: Steht der Spieler selbst darin? Nein (kein Profil in der Datenbank, falsche Sitzung):
 * einmal von selbst neu verbinden. Ja, aber der Rekord dort ist kleiner als auf dem Geraet (Ergebnisse gingen frueher
 * verloren): den Rekord einmal nachtragen
 */
function eintragPruefen() {
  if (!angemeldet()) return kontoStatusZeigen(null)
  const ich = hallIch ? hallZeilen.find((z) => z.user_id === hallIch) : undefined
  if (ich) {
    kontoStatusZeigen(null)
    rekordNachtragen(ich)
    return
  }
  const z = onlineZustand()
  kontoStatusZeigen(z.ok || !z.text ? { ok: false, text: `Du („${profil.name}“) fehlst noch in der Hall of Snakes.`, technisch: z.technisch } : z)
  if (reparaturVersucht) return
  reparaturVersucht = true
  void kontoReparieren().then((r) => {
    if (r.ok) void ladeHallAnzeige()
    else kontoStatusZeigen(r)
  })
}

const RKEY = 'snake.rekord.nachgetragen.v1'
function rekordNachtragen(ich: HallZeile) {
  if (!zaehltOnline() || stats.best < 2 || ich.rekord >= stats.best) return
  try {
    if (Number(localStorage.getItem(RKEY)) >= stats.best) return
    localStorage.setItem(RKEY, String(stats.best))
  } catch {
    return
  }
  // Dauer grosszuegig (die Datenbank prueft: hoechstens ein Level je 0,2 s)
  melde({ level: stats.best, dauer: Math.max(10_000, stats.best * 400), tempo: 'normal' })
}

$('konto-reparieren').addEventListener('click', async () => {
  const k = $<HTMLButtonElement>('konto-reparieren')
  k.disabled = true
  audio.click()
  const r = await kontoReparieren()
  k.disabled = false
  kontoStatusZeigen(r)
  if (r.ok) {
    void ladeHallAnzeige()
    void freundeLaden()
    void online?.start()
    sozialStarten()
    toast('baum', 'Verbunden', r.text)
  }
})
$('freund-reparieren').addEventListener('click', async () => {
  audio.click()
  const r = await kontoReparieren()
  if (r.ok) void freundeLaden()
  else toast('baum', 'Noch nicht verbunden', r.text)
})

/* ================= Spieler antippen: zum Gefecht einladen ================= */

let karteSpieler: HallZeile | null = null

/** Zeile antippbar machen (die kleinen Knoepfe in der Zeile behalten ihre eigene Aufgabe) */
function spielerAntippbar(el: HTMLElement, z: HallZeile) {
  if (z.user_id === hallIch || !mehr.verfuegbar || !profil.name) return
  el.classList.add('liste__zeile--antippbar')
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button')) return
    karteOeffnen(z)
  })
}

function freundText(z: HallZeile) {
  const a = anfragen.find((x) => x.user_id === z.user_id)
  return freundeUids.has(z.user_id) ? 'Chat' : a?.richtung === 'aus' ? 'Anfrage zurückziehen' : a?.richtung === 'ein' ? 'Anfrage annehmen' : 'Freundschaftsanfrage'
}

function karteOeffnen(z: HallZeile) {
  audio.click()
  karteSpieler = z
  const da = onlineVon(z.user_id)
  $('karte-name').textContent = z.name
  const rekord = z.rekord > 0 ? `Rekord Level ${z.rekord}` : 'Noch kein Rekord'
  $('karte-info').textContent = `${da ? (da.imSpiel ? 'Spielt gerade' : 'Online') : 'Gerade nicht online'} · ${rekord}`
  $('karte-freund-text').textContent = freundText(z)
  setIcon($('karte-freund'), freundeUids.has(z.user_id) ? 'MessageCircle' : 'UserPlus')
  // Offline: Einladung als Nachricht aufs Handy (wenn der andere sie eingeschaltet hat)
  $('karte-einladen').lastChild!.textContent = da ? 'Zum Gefecht einladen' : 'Einladung aufs Handy schicken'
  drawSchlangeGerade($<HTMLCanvasElement>('karte-skin'), skinVon(z.skin ?? 'klassik'), 0)
  // Admin (Passwort schon eingegeben): andere Spieler direkt hier loeschen
  $('karte-loeschen').hidden = !(master.frei && master.code && z.user_id !== hallIch)
  show('spieler-karte', true)
}
$('karte-loeschen').addEventListener('click', async () => {
  const z = karteSpieler
  if (!z || !(await spielerLoeschen(z))) return
  show('spieler-karte', false)
  if (page() === 'hall') void ladeHallAnzeige()
})
$('karte-zu').addEventListener('click', () => {
  audio.click()
  show('spieler-karte', false)
})
$('karte-einladen').addEventListener('click', () => {
  const z = karteSpieler
  show('spieler-karte', false)
  if (!z) return
  const da = onlineVon(z.user_id)
  if (da) return void einladen(da)
  void einladenPerPush({ user_id: z.user_id, name: z.name, skin: z.skin ?? 'klassik', level: z.rekord })
})
$('karte-freund').addEventListener('click', () => {
  const z = karteSpieler
  show('spieler-karte', false)
  if (!z) return
  audio.click()
  // Dieselbe Aufgabe wie der kleine Knopf am Zeilenende (Anfrage, zurueckziehen, annehmen, Chat)
  hallAktion(z).click()
})

/** Tab „Täglich“: wer alle Aepfel holt, steht nach Zeit vorn, dahinter nach geholten Aepfeln */
function tagesZeichnen() {
  const box = $('hall-zeilen')
  box.replaceChildren()
  const tl = heutigesLevel()
  if (!tagesZeilen.length) {
    const leer = document.createElement('p')
    leer.className = 'liste__leer'
    leer.textContent = 'Heute hat noch niemand das Tageslevel gespielt.'
    box.append(leer)
  }
  tagesZeilen.forEach((z, i) => {
    const el = document.createElement('div')
    el.className = z.user_id === hallIch ? 'liste__zeile hall-zeile liste__zeile--ich' : 'liste__zeile hall-zeile'
    const platz = document.createElement('span')
    platz.className = 'liste__platz'
    platz.textContent = String(i + 1)
    const cv = document.createElement('canvas')
    cv.className = 'liste__skin'
    cv.width = 96
    cv.height = 64
    const name = document.createElement('span')
    name.className = 'liste__name'
    name.textContent = z.name
    const zahl = document.createElement('b')
    zahl.className = 'liste__level'
    const s = Math.round((z.dauer_ms ?? 0) / 1000)
    zahl.textContent = z.level >= tl.ziel && z.dauer_ms ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${z.level}/${tl.ziel}`
    el.append(platz, cv, name, zahl, document.createElement('span'))
    spielerAntippbar(el, { user_id: z.user_id, name: z.name, skin: z.skin ?? 'klassik', rekord: z.level, trophaeen: 0 })
    box.append(el)
    drawSchlangeGerade(cv, skinVon(z.skin ?? 'klassik'), 0)
  })
  $('hall-mehr').hidden = true
  $('hall-info').textContent = `Heute: ${tl.motto}, ${tl.ziel} Äpfel (Startmenü → Täglich).`
}

$('hall-tabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
  b.addEventListener('click', () => {
    audio.click()
    hallTab = b.dataset.v as typeof hallTab
    hallZahl = HALL_SEITE
    if (hallTab === 'tages') void ladeHallAnzeige()
    else hallZeichnen()
  }),
)
$('hall-sort').querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
  b.addEventListener('click', () => {
    audio.click()
    hallSort = b.dataset.v as typeof hallSort
    hallZeichnen()
  }),
)

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

/*
 * Anmeldung mit Name und Passwort (seit 1.42, keine Gaeste mehr): beim Start, solange dieses Geraet nicht angemeldet ist,
 * und sobald es abgemeldet wird. Wer schon einen Namen hatte, legt hier sein Passwort fest; alles andere bleibt.
 */
let willkommenSpaeter = false
function zeigeWillkommen() {
  if (!onlineAktiv || angemeldet() || willkommenSpaeter || gesperrt) return
  if (mode === 'play') pause()
  const alt = !!profil.name && profil.pw === undefined
  $('willkommen-titel').textContent = alt ? 'Neu: dein Passwort' : profil.name ? 'Wieder anmelden' : 'Anmelden'
  $('willkommen-text').textContent = alt
    ? `Sichere deinen Account „${profil.name}“ mit einem Passwort. Dann kommst nur du hinein, mit Name und Passwort auf jedem Gerät. Rekorde, Freunde und Chat bleiben.`
    : profil.name
      ? 'Du bist abgemeldet. Melde dich mit Name und Passwort an, dann zählst du wieder in der Hall of Snakes.'
      : 'Mit Name und Passwort. Neu hier? Dann denk dir beides aus, dein Account legt sich von selbst an. So sehen dich die anderen in der Hall of Snakes, und mit Name und Passwort kommst du auf jedem Gerät in deinen Account (Freunde, Chat, Rekorde).'
  $('willkommen-los').lastChild!.textContent = alt ? 'Passwort speichern' : 'Anmelden'
  $<HTMLInputElement>('willkommen-name').value = profil.name
  $<HTMLInputElement>('willkommen-passwort').autocomplete = alt || !profil.name ? 'new-password' : 'current-password'
  $('willkommen-offline').hidden = navigator.onLine
  show('willkommen', true)
  window.setTimeout(() => $<HTMLInputElement>(profil.name ? 'willkommen-passwort' : 'willkommen-name').focus(), 450)
}
$<HTMLFormElement>('willkommen-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const fehler = $('willkommen-fehler')
  const name = $<HTMLInputElement>('willkommen-name').value
  const pwFeld = $<HTMLInputElement>('willkommen-passwort')
  const zeige = (text: string) => {
    fehler.textContent = text
    fehler.hidden = false
  }
  if (!nameGueltig(name)) return zeige(name.trim().length >= 2 && name.trim().length <= 16 ? 'Dieser Name ist nicht erlaubt.' : 'Der Name braucht 2 bis 16 Zeichen.')
  if (pwFeld.value.length < 4) return zeige('Das Passwort braucht mindestens 4 Zeichen.')
  fehler.hidden = true
  const knopf = $<HTMLButtonElement>('willkommen-los')
  knopf.disabled = true
  const vorher = await eigeneUid()
  try {
    const r = await anmelden(name, pwFeld.value)
    audio.click()
    pwFeld.value = ''
    show('willkommen', false)
    toast('baum', r === 'neu' ? `Willkommen, ${profil.name}!` : r === 'gesichert' ? 'Passwort gespeichert' : `Willkommen zurück, ${profil.name}!`, r === 'neu' ? 'Dein Account ist angelegt. Du stehst jetzt in der Hall of Snakes.' : r === 'gesichert' ? 'Dein Account ist jetzt geschützt. Merk dir Name und Passwort.' : 'Du bist in deinem Account.')
    // In einen anderen Account gewechselt: Freunde, Chat und Lobby gehoeren dazu, also frisch starten
    if (vorher && vorher !== (await eigeneUid())) return void window.setTimeout(() => location.reload(), 1500)
    linkRaum()
    void online?.start()
    void freundeLaden()
    sozialStarten()
    void pushAuffrischen()
    if (page() === 'hall') void ladeHallAnzeige()
  } catch (err) {
    if (err instanceof PasswortFalsch) pwFeld.select()
    else if (!(err instanceof NamenFehler)) $('willkommen-offline').hidden = false
    zeige(err instanceof NamenFehler ? err.message : 'Keine Verbindung zum Server. Bist du online? Spielen geht auch ohne, dann zählt es nur nicht online.')
  } finally {
    knopf.disabled = false
  }
})
$('willkommen-offline').addEventListener('click', () => {
  audio.click()
  willkommenSpaeter = true
  show('willkommen', false)
})
$('konto-abmelden').addEventListener('click', async () => {
  if (!confirm(`Als „${profil.name}“ abmelden? Danach meldest du dich mit Name und Passwort wieder an (auch mit einem anderen Account).`)) return
  audio.click()
  await abmelden()
  location.reload()
})

function gameOver() {
  if (!game) return
  const g = game
  // Kreativ-Runden zaehlen nicht
  // Kreativ-Runden und Tageslevel (eigene Wertung) zaehlen nicht fuer den Rekord
  // Missionen der Kampagne ebenso nicht
  const endlos = !istKreativ && !istTages && !laufMission
  const neu = endlos && g.maxLevel > stats.best && g.gegessen > 0
  // Tagesrekord (nur, wenn es nicht gleich der Rekord aller Zeiten ist)
  const neuHeute = endlos && !neu && g.maxLevel > heuteBest() && g.gegessen > 0
  if (endlos && g.gegessen > 0 && g.maxLevel > heuteBest()) stats.heute = { datum: heuteDatum(), best: g.maxLevel }
  // Mission geschafft: Belohnung nur beim ersten Mal
  const mission = laufMission
  const missionOk = !!mission && g.cause === 'ziel'
  if (mission && missionOk) {
    // Beim ersten Mal: Belohnung, im Schatz-Level dazu die Edelsteine
    const erstes = missionGeschafft(mission) > 0
    const lohn = erstes ? mission.lohn + (g instanceof MissionGame ? g.schatz : 0) : 0
    if (lohn > 0) {
      verdienen(lohn)
      laufGeld += lohn
      saveWallet()
      updateGeld(true)
    }
    // Skin der Mission (5 und 10): auch nachtraeglich, falls er fehlt
    if (mission.skin && !wallet.skins.includes(mission.skin)) {
      wallet.skins.push(mission.skin)
      saveWallet()
      toast('aepfel', `Neu: ${nameVon(mission.skin)}`, `Skin für Mission ${mission.nr}. Im Aussehen unter Skins anlegen.`)
    }
  }
  if (!istKreativ) {
    stats.apples += g.gegessen
    stats.time += performance.now() - startedAt
    stats.longest = Math.max(stats.longest, g.maxLen)
    stats.maxGebiete = Math.max(stats.maxGebiete, g.expansions)
    stats.gegner += g.besiegt
    if (neu) stats.best = g.maxLevel
    erfolgeMelden()
    saveStats()
    setzeSilber(wallet.verdient ?? 0)
    // Tageslevel: gemeldet werden die geholten Aepfel (alle = geschafft) und die Zeit
    if (zaehltOnline() && g.gegessen > 0 && (istTages || g.maxLevel >= 2))
      melde({ level: istTages ? Math.min(g.gegessen, tagesZiel) : g.maxLevel, dauer: Math.max(1, Math.round(performance.now() - startedAt)), tempo: tempoVon(laufModus), tages: istTages })
  }
  overTimer = window.setTimeout(() => {
    if (mode !== 'over') return
    $('over-cause').textContent = mission ? (missionOk ? 'Mission geschafft!' : g.cause === 'rand' ? 'Gegen den Berg gefahren' : g.cause ? CAUSE[g.cause] : '') : g.cause ? CAUSE[g.cause] : ''
    $('over-label').textContent = g instanceof BossGame ? 'Treffer am Golem' : g instanceof EntBossGame ? 'Treffer am Ent' : mission ? `Mission ${mission.nr}` : 'Level'
    $('over-level').textContent = g instanceof BossGame ? `${GOLEM.leben - g.golem.hp}/${GOLEM.leben}` : g instanceof EntBossGame ? `${ENT.leben - g.kampf.ent.hp}/${ENT.leben}` : mission && g instanceof MissionGame ? `${g.ziel - g.uebrig}/${g.ziel}` : istTages ? `${Math.min(g.gegessen, tagesZiel)}/${tagesZiel}` : String(g.level)
    const mb = $('over-mission')
    mb.hidden = !mission
    mb.querySelector('b')!.textContent = mission ? `${mission.name}${missionOk && laufGeld <= 0 ? ' · schon geschafft' : ''}${missionOk && mission.skin ? ` · Skin ${nameVon(mission.skin)}` : ''}` : ''
    $('btn-menu').lastChild!.textContent = mission ? 'Zur Karte' : 'Hauptmenü'
    $('over-record').hidden = !neu
    $('over-heute').hidden = !neuHeute
    $('over-tages').hidden = !istTages
    $('over-apples').textContent = String(g.gegessen)
    $('over-max').hidden = !!mission || g.maxLevel <= g.level
    $('over-max').textContent = `Höchster Level: ${g.maxLevel}`
    $('over-len').textContent = String(g.body.length)
    const sec = Math.round((performance.now() - startedAt) / 1000)
    $('over-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
    const geld = $('over-geld')
    geld.hidden = istKreativ || laufGeld <= 0
    geld.querySelector('b')!.textContent = `+${laufGeld} ${laufGeld === 1 ? 'Apfel' : 'Äpfel'}`
    const on = $('over-online')
    on.hidden = !(onlineAktiv && zaehltOnline() && g.gegessen > 0)
    on.textContent = angemeldet() ? `In der Hall of Snakes als ${profil.name}` : 'Nicht angemeldet: Melde dich mit Name und Passwort an, dann zählt dieses Ergebnis.'
    show('over', true)
    drawMini($<HTMLCanvasElement>('over-icon'), MINI_FOR_CAUSE[g.cause ?? 'rand'])
    if (neu) audio.record()
    updateHud(false)
  }, 1100)
}

/* ================= Ereignisse -> Ton, Vibration, Anzeige ================= */

/** Zaehler fuer Erfolge (nur echte Runden) */
function zaehlen(e: GameEvent) {
  // Kreativ und Missionen (immer gleiche Karte, liesse sich beliebig wiederholen) zaehlen nicht fuer die Erfolge
  if (istKreativ || laufMission) return
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
    case 'eat': {
      audio.eat(e.level)
      haptic.light()
      updateHud(true)
      // Tageslevel: alle Aepfel geholt = geschafft
      if (istTages && game && game.gegessen >= tagesZiel) {
        game.geschafft()
        break
      }
      // Fortschritt in dieser Welt: naechste Welt bei Level 100, Belohnungen bei 100, 150 und 200
      if (!istKreativ && !istTages && !laufMission && game) weltFortschritt(game.maxLevel)
      break
    }
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
      if (e.cause === 'ziel') {
        audio.record()
        haptic.success()
      } else {
        audio.die(e.cause)
        haptic.heavy()
      }
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
    case 'sandsturm':
      audio.cloud()
      toast('wolke', 'Sandsturm!', 'Die Sicht ist kurz schlecht.')
      break
    case 'flutWarnung':
      audio.wahl()
      haptic.medium()
      toast('teich', 'Die Flut kommt!', 'Beim nächsten Apfel steigt das Wasser: Bleib vom Rand weg.')
      break
    case 'flut':
      audio.pond()
      haptic.heavy()
      toast('teich', 'Flut!', 'Der Rand steht 8 Sekunden lang 2 Felder unter Wasser.', { minus: true })
      break
    case 'flutEnde':
      audio.powerEnde()
      toast('teich', 'Das Wasser geht zurück', '')
      break
    case 'sandwurmWarnung':
      audio.gegner()
      haptic.medium()
      // Im Vulkan kommt statt des Sandwurms der Magmawurm aus dem Abgrund
      if (game?.weltId === 'vulkan') toast('gegner', 'Magmawurm!', 'Die Lava brodelt: In 8 Sekunden bricht er durch. Weg da!')
      else toast('gegner', 'Sandwurm!', 'Eine Reihe brodelt: In 8 Sekunden bricht er durch. Weg da!')
      break
    case 'sandwurm':
      audio.lava(true)
      haptic.heavy()
      break
    case 'sandwurmBiss':
      audio.zertreten()
      haptic.heavy()
      toast('gegner', 'Erwischt!', `Der ${game?.weltId === 'vulkan' ? 'Magmawurm' : 'Sandwurm'} hat ${e.weg} Glieder abgebissen.`, { minus: true })
      break
    /* Welt-Ereignisse: Warnung mit kurzem Hinweis (nur Gefahren, die man sehen muss), sonst nur ein Ton */
    case 'einschlagWarnung': {
      const w: Partial<Record<typeof e.art, [Parameters<typeof drawMini>[1], string, string]>> = {
        eiszapfen: ['eis', 'Eiszapfen!', 'Weg aus dem Schatten, gleich fällt er.'],
        stein: ['mauer', 'Steinschlag!', 'Wo Staub rieselt, fallen gleich Felsen.'],
        abbruch: ['lava', 'Die Kante bricht!', 'Runter von den Rissen am Abgrund.'],
        lavabombe: ['lava', 'Ausbruch!', 'Wo es glüht, schlagen Lavabomben ein.'],
        meteor: ['lava', 'Feuerregen!', 'Wo die Schatten wachsen, schlagen Meteore ein.'],
        geier: ['gegner', 'Ein Geier kreist!', 'Gleich stößt er herab, wo sein Schatten ist.'],
      }
      const t = w[e.art]
      if (t) {
        audio.wahl()
        haptic.light()
        toast(t[0], t[1], t[2])
      } else audio.hop()
      break
    }
    case 'einschlag':
      if (!nah(e.p, 1)) break
      if (e.art === 'lavabombe' || e.art === 'meteor' || e.art === 'abbruch') audio.lava(true)
      else if (e.art === 'zombiehand' || e.art === 'huegel') audio.zertreten()
      else if (e.art === 'geier') audio.gegner()
      else audio.tree()
      if (e.art !== 'huegel') haptic.medium()
      break
    case 'explosion':
      audio.lava(true)
      haptic.heavy()
      break
    case 'abgetrennt':
      audio.zertreten()
      haptic.heavy()
      toast('schlange', 'Abgetrennt!', `${e.weg} Glieder sind weg.`, { minus: true })
      break
    case 'schneesturm':
      audio.cloud()
      toast('wolke', 'Schneesturm!', 'Gleich siehst du fast nichts mehr.')
      break
    case 'polarnacht':
      audio.wahl()
      toast('eis', 'Polarnacht', 'Es wird dunkel, Nordlichter ziehen auf.')
      break
    case 'eisRiss':
      audio.zertreten()
      haptic.light()
      if (e.stufe >= 2) toast('eis', 'Das Eis knackt!', 'Noch einmal drauf, und es bricht.')
      break
    case 'wesen':
      audio.gegner()
      break
    case 'loreWarnung':
      audio.wahl()
      toast('gegner', 'Die Lore kommt!', 'Die Glocke läutet: runter von den Schienen.')
      break
    case 'lore':
      audio.lava(true)
      haptic.medium()
      break
    case 'fledermaeuse':
    case 'kraehen':
    case 'sporen':
      audio.cloud()
      break
    case 'zuendschnur':
      audio.trap()
      toast('falle', 'TNT!', 'Fahr über den Funken, dann geht die Schnur aus.')
      break
    case 'erdbeben':
      audio.lava()
      haptic.heavy()
      toast('erde', 'Erdbeben!', 'Gleich reißt ein Spalt auf.')
      break
    case 'netz':
    case 'geklaut':
      audio.stolen()
      break
    case 'spiegel':
      audio.wahl()
      toast('gift', 'Spiegelfluch!', 'Gleich ist die Steuerung vertauscht.')
      break
    case 'ranke':
      audio.tree()
      break
    case 'eile':
    case 'fata':
      audio.power()
      break
    case 'regenbogen':
    case 'obsidian':
      audio.fund(true)
      haptic.success()
      break
    case 'teleport':
      audio.expand()
      break
    case 'vollmond':
      audio.wahl()
      haptic.medium()
      toast('gegner', 'Vollmond!', 'Der Werwolf jagt dich.')
      break
    case 'lavastrom':
      audio.lava()
      toast('lava', 'Lavastrom!', 'Lava quillt aus dem Abgrund und fließt übers Feld.')
      break
    case 'lavafisch':
      if (nah(e.p, 0.6)) audio.hop()
      break
    case 'brueckeBricht':
      audio.zertreten()
      haptic.medium()
      break
    case 'bienen':
      audio.ameise()
      toast('gegner', 'Bienen!', 'Der Schwarm verfolgt dich.')
      break
    case 'rassel':
    case 'stich':
      audio.ameise()
      haptic.light()
      break
    case 'karawane':
      audio.wahl()
      toast('gegner', 'Karawane!', 'Gleich zieht eine Kamelkarawane quer durch.')
      break
    case 'sarkophag':
      audio.tower()
      toast('gegner', 'Ein Sarkophag!', 'Gleich steigt die Mumie heraus.')
      break
    case 'erdmaennchen':
      audio.hop()
      break
    case 'geld':
      // Aepfel sind die Waehrung; im Kreativ-Modus wird nichts gesammelt, in Missionen gibt es nur die Belohnung am Ende
      if (!istKreativ && !laufMission) {
        // Tageslevel: der letzte (pinke) Apfel bringt 10 Aepfel, aber nur einmal am Tag
        const tagesBonus = istTages && e.quelle === 'apfel' && !!game && game.gegessen >= tagesZiel && stats.tagesBonus !== tagesTag
        if (tagesBonus) {
          stats.tagesBonus = tagesTag
          saveStats()
        }
        // Abenteuer 75 %, Normal 100 %, Speedrun 125 % (ab Orange 150 %): nur volle Aepfel zaehlen, der Rest wird zwischengespeichert
        const prozent = tagesBonus ? 100 : modusProzent(laufModus, game ? apfelFaktor(game.cfg, game.level) : 1)
        laufGeld += verdienenModus(tagesBonus ? 10 : e.wert, prozent)
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
    case 'golem':
      audio.golem(e.was)
      if (e.was === 'schlag' || e.was === 'landung' || e.was === 'aufprall' || e.was === 'treffer' || e.was === 'tot') haptic.heavy()
      else if (e.was === 'stein' || e.was === 'zorn' || e.was === 'torAuf') haptic.medium()
      if (e.was === 'bann') toast('gebiet', 'Gebannt!', 'Jetzt durch den Golem hindurchfahren.')
      if (e.was === 'torAuf' && game instanceof BossGame) toast('gebiet', `Raum ${game.raumNr + 1} von ${game.raeume.length}`, `Das Tor ist offen: dem Golem nach. Hier brauchst du ${game.sockel.length} Kristalle.`)
      break
    case 'minigolem':
      if (e.was === 'neu' || nah(e.p, 0.6)) audio.minigolem(e.was)
      if (e.was === 'schlag' && nah(e.p, 0.4)) haptic.medium()
      break
    case 'ent': {
      audio.ent(e.was)
      if (e.was === 'treffer' || e.was === 'tot' || e.was === 'auftauchen') haptic.heavy()
      else if (e.was === 'einschlag' || e.was === 'zorn' || e.was === 'brennt' || e.was === 'abtauchen') haptic.medium()
      else if (e.was === 'flamme' || e.was === 'feuer') haptic.light()
      const kampf = game instanceof EntBossGame ? game.kampf : game?.freiEnt
      if (e.was === 'flamme') toast('gebiet', 'Du trägst eine Flamme', 'Fahr durch einen Holzstapel, um ihn anzuzünden.')
      if (e.was === 'brennt') toast('gebiet', 'Die Rinde brennt!', 'Sein Herzknoten liegt frei: fahr jetzt durch den Ent hindurch.')
      if (e.was === 'zorn' && kampf && kampf.ent.phase === 1 && kampf.entLeben > 1 && kampf.ent.hp === kampf.entLeben - 1)
        toast('gegner', 'Phase 2', 'Er wandert zwischen den Stümpfen. Zünde Feuer an und stell dich so, dass ein Feuer zwischen dir und ihm liegt: Seine Wurzeln fangen dort Feuer.')
      if (e.was === 'zorn' && kampf && kampf.ent.phase === 2 && kampf.ent.hp === 1 && kampf.entLeben > 1) toast('gegner', 'Phase 3', 'Die Lichtung wächst von außen zu. Ein letzter Treffer!')
      break
    }
    case 'kaefig':
      if (nah(e.p, 0.6)) audio.kaefig(e.was)
      if (e.was === 'strahl' && nah(e.p, 0.4)) haptic.light()
      break
    case 'siegel':
      audio.siegel(e.rest)
      haptic.medium()
      toast('gebiet', e.rest ? `Siegel geholt, noch ${e.rest}` : 'Alle Siegel geholt!', e.rest ? 'Sammle alle Siegel, dann öffnet sich die große Tür.' : 'Die große Tür leuchtet orange: fahr hindurch.')
      break
    case 'meister':
      audio.meister(e.was)
      if (e.was === 'getroffen' || e.was === 'tot') haptic.heavy()
      else if (e.was === 'trifft' || e.was === 'erscheint') haptic.medium()
      else if (e.was === 'flamme') haptic.light()
      if (e.was === 'erscheint') toast('gegner', 'Der Käfigmeister ist erschienen', 'Irgendwo in einem der sechs Räume. Such ihn!')
      if (e.was === 'erwacht') toast('gebiet', 'Er hat dich bemerkt', 'Hol die Flammen in seinem Raum: Jede fliegt auf ihn. Fünf, dann verschwindet er.')
      if (e.was === 'getroffen') toast('gegner', `Er ist verschwunden, noch ${e.leben === 1 ? 'ein Leben' : `${e.leben} Leben`}`, 'Gleich taucht er in einem Raum wieder auf, den du nicht siehst. Vielleicht sogar in diesem.')
      if (e.was === 'tot') toast('aepfel', 'Der Käfigmeister ist besiegt!', 'Oben ist die Tür offen: raus aus dem Labyrinth.')
      break
    case 'tuerAuf':
      audio.tuerAuf()
      haptic.heavy()
      break
    case 'minient':
      if (nah(e.p, 0.6)) audio.minient(e.was)
      if (e.was === 'griff') {
        haptic.heavy()
        toast('gegner', 'Gepackt!', 'Wisch schnell vom Mini-Ent weg.')
      } else if (e.was === 'platzt' && nah(e.p, 0.4)) haptic.medium()
      break
    case 'bossStart':
      haptic.heavy()
      if (e.boss === 'ent') toast('gegner', 'Boss: der Ent!', 'Hol eine Flamme aus der Glutschale in der Mitte und zünde die 3 Holzstapel an. Brennen alle, liegt sein Herzknoten frei: dann fahr durch ihn hindurch. Ein Treffer an deinem Kopf ist vorbei.')
      else toast('gegner', 'Boss: der Steingolem!', 'Bring die 4 Kristalle zum Sockel ihrer Farbe. Leuchten alle, bannt der Kreis den Golem: dann fahr durch ihn hindurch. Ein Treffer an deinem Kopf ist vorbei.')
      break
    case 'bossSieg':
      haptic.success()
      toast('aepfel', e.boss === 'ent' ? 'Ent besiegt!' : 'Steingolem besiegt!', `+${e.wert} Äpfel. Weiter geht es mit dem Apfel.`)
      break
    case 'kristall':
      audio.kristall(e.was, e.farbe)
      if (e.was !== 'neu') haptic.light()
      if (e.was === 'alle') toast('gebiet', 'Der Bannkreis leuchtet', 'Lock den Golem in den Kreis in der Mitte.')
      break
    case 'bossSchaden':
      audio.setback()
      haptic.heavy()
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
      // Kurz sagen, was man jetzt kann
      if (e.art === 'fuettern') toast('fuettern', 'Füttern!', 'Iss alle Gegner!')
      else if (e.art === 'maulwurf') toast('maulwurf', 'Maulwurf!', 'Buddel dich in die Erde!')
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
  // Kampagne: statt des Levels die Nummer der Mission
  el.textContent = String(laufMission ? laufMission.nr : lv)
  $('hud-level').previousElementSibling!.textContent = laufMission ? 'Mission' : 'Level'
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
  bar.hidden = c.gebietAlle <= 0 || !!laufMission
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
  $('home-silber').textContent = kurzZahl(wallet.verdient ?? 0)
  $('shop-geld').textContent = String(wallet.aepfel)
  $('shopteil-geld').textContent = String(wallet.aepfel)
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

/* ================= Aussehen (Shop) ================= */

/** Vorschauen ohne Video oder Bild (fehlt oder laedt nicht): werden jedes Bild gezeichnet */
const skinCanvas: { cv: HTMLCanvasElement; skin: Skin; fokus: Fokus }[] = []
/** Shop-Vorschauen als fertige Videos (scripts/skin-videos.mjs): nur die sichtbaren laufen */
const skinVideos: HTMLVideoElement[] = []
const istShop = () => page() === 'shop' || page() === 'shopteil'
const ruhig = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const sichtbar = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        const v = e.target as HTMLVideoElement
        if (e.isIntersecting && istShop() && !ruhig) videoStart(v)
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
      if (istShop()) void v.play().catch(() => {})
    })
    .catch(() => v.dispatchEvent(new Event('error')))
}

/** Gezeichnete Vorschau (Ersatz, wenn es kein Bild/Video gibt, und fuer zusammengesetzte Looks) */
function vorschauCanvas(skin: Skin, fokus: Fokus = 'ganz') {
  const cv = document.createElement('canvas')
  skinCanvas.push({ cv, skin, fokus })
  return cv
}

/** Vorschau einer kaufbaren Sache: Bild (steht still) oder Video (bewegt), sonst gezeichnet */
function skinVorschau(id: string): HTMLElement {
  const v0 = vorschauFuer(id)
  if (!v0.bewegt) {
    const img = document.createElement('img')
    img.src = `skins/${id}.webp`
    img.alt = ''
    img.decoding = 'async'
    img.addEventListener('error', () => img.replaceWith(vorschauCanvas(v0.skin, v0.fokus)))
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
  // Kein Video (z. B. offline und noch nie geladen): selbst zeichnen
  v.addEventListener('error', () => {
    sichtbar?.unobserve(v)
    v.replaceWith(vorschauCanvas(v0.skin, v0.fokus))
  })
  skinVideos.push(v)
  if (sichtbar) sichtbar.observe(v)
  else if (!ruhig) videoStart(v)
  return v
}

/** Gewaehltes Aussehen (alte Speicherstaende: aus dem bisherigen Skin) */
const look: LookWahl = (() => {
  // Fruehere Teilung "laengs" gibt es nicht mehr: wird zum Verlauf
  if (wallet.look) return { ...wallet.look, teilung: (wallet.look.teilung as string) === 'laengs' ? 'verlauf' : wallet.look.teilung, acc: { ...wallet.look.acc } }
  const alt = skinVon(wallet.skin)
  return { farben: alt.muster ? ['klassik'] : alt.farben.map((f) => f.id), teilung: 'abschnitt', anzahl: 1, muster: alt.muster?.id ?? null, acc: {}, spur: null }
})()
/** Aktuelles Aussehen bauen, speichern, online melden und im Spiel zeigen */
function lookAnwenden() {
  const s = baueSkin({ farben: look.farben.slice(0, look.anzahl), teilung: look.teilung, muster: look.muster ?? undefined, acc: Object.values(look.acc), spur: look.spur ?? undefined, effekt: look.effekt ?? undefined })
  wallet.look = { ...look, acc: { ...look.acc } }
  wallet.skin = s.code
  setzeSkin(s.code)
  saveWallet()
  renderer.skin = s
}

type Teil = 'farben' | 'skins' | 'acc' | 'spuren' | 'effekte' | 'welten'
let shopTeil: Teil = 'farben'
/** Welcher Teil der Schlange gerade eine Farbe bekommt (zwei- und dreifarbig) */
let farbTeil = 0
const TEIL_TITEL: Record<Teil, string> = { farben: 'Farben', skins: 'Skins', acc: 'Accessoires', spuren: 'Spuren', effekte: 'Effekte', welten: 'Welten' }
/** Welt-Vorschauen (gezeichnet, im Shop bewegt) */
const weltCanvas: { cv: HTMLCanvasElement; welt: Welt }[] = []
function weltVorschauCanvas(welt: Welt) {
  const cv = document.createElement('canvas')
  weltCanvas.push({ cv, welt })
  return cv
}
function weltVorschauenZeichnen(now: number) {
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  for (const { cv, welt } of weltCanvas) {
    const w = cv.clientWidth
    const h = cv.clientHeight
    if (!w || !h) continue
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawWeltVorschau(ctx, welt, w, h, now, renderer.skin)
  }
}
const PLATZ_NAME: Record<Platz, string> = { augen: 'Augen', kopf: 'Kopf', gesicht: 'Gesicht', schwanz: 'Schwanz' }

function vorschauenLeeren() {
  for (const v of skinVideos) {
    sichtbar?.unobserve(v)
    if (v.src.startsWith('blob:')) URL.revokeObjectURL(v.src)
  }
  skinVideos.length = 0
  skinCanvas.length = 0
  weltCanvas.length = 0
}

/** Startseite des Aussehens: grosse Knoepfe */
function renderShop() {
  updateGeld()
  vorschauenLeeren()
  const box = $('aussehen')
  box.innerHTML = ''
  const zahl = (ids: string[]) => `${ids.filter((id) => hatSkin(wallet.skins, id)).length} von ${ids.length}`
  const farbIds = FARBEN.filter((f) => !f.versteckt).map((f) => f.id)
  const skinIds = MUSTER.filter((m) => !m.versteckt).map((m) => m.id)
  const basis = { farben: look.farben.slice(0, look.anzahl), teilung: look.teilung }
  const kacheln: [Teil, string, Skin][] = [
    ['farben', `${zahl(farbIds)}${look.anzahl > 1 ? ` · ${look.anzahl === 2 ? 'Zweifarbig' : 'Dreifarbig'}` : ''}`, baueSkin(basis)],
    ['skins', `${zahl(skinIds)}${look.muster ? ` · ${MUSTER.find((m) => m.id === look.muster)?.name ?? ''}` : ''}`, baueSkin({ muster: look.muster ?? 'tiger' })],
    ['acc', zahl(ACCS.map((a) => a.id)), baueSkin({ ...basis, acc: Object.values(look.acc).length ? Object.values(look.acc) : ['krone', 'sonnenbrille'] })],
    ['spuren', zahl(SPUREN.map((s) => s.id)), baueSkin({ ...basis, spur: look.spur ?? 'spur-herzen' })],
    ['effekte', `${EFFEKTE.filter((e) => effektFrei(e, wallet.verdient ?? 0, wallet.trophaeen ?? 0)).length} von ${EFFEKTE.length} frei`, baueSkin({ ...basis, effekt: look.effekt ?? 'fx-sternenkranz' })],
  ]
  for (const [teil, sub, skin] of kacheln) {
    const b = document.createElement('button')
    b.className = teil === 'effekte' ? 'aussehen__kachel aussehen__kachel--breit' : 'aussehen__kachel'
    b.append(vorschauCanvas(skin))
    const t = document.createElement('b')
    t.textContent = TEIL_TITEL[teil]
    const s = document.createElement('span')
    s.textContent = sub
    b.append(t, s)
    b.addEventListener('click', () => {
      shopTeil = teil
      farbTeil = 0
      openPage('shopteil')
    })
    box.append(b)
  }
  // Welten: breiter Knopf mit der aktuellen Welt
  const b = document.createElement('button')
  b.className = 'aussehen__kachel aussehen__kachel--breit'
  const frei = WELTEN.filter(weltOffen).length
  b.append(weltVorschauCanvas(renderer.welt))
  const t = document.createElement('b')
  t.textContent = 'Welten'
  const s = document.createElement('span')
  s.textContent = `${frei} von ${WELTEN.length} frei · ${renderer.welt.name}`
  b.append(t, s)
  b.addEventListener('click', () => {
    shopTeil = 'welten'
    openPage('shopteil')
  })
  box.append(b)
}

/** Karte fuer eine kaufbare Sache. an = gerade getragen */
function shopKarte(id: string, name: string, an: boolean, waehlen: () => void, zeile = false) {
  const hat = hatSkin(wallet.skins, id)
  const preisWert = preisVon(id)
  const card = document.createElement('button')
  card.className = zeile ? 'skin skin--zeile' : 'skin'
  card.dataset.id = id
  if (an) card.dataset.an = ''
  if (!hat) card.dataset.zu = ''
  card.innerHTML = `<span class="skin__name"></span><span class="skin__preis"></span>`
  card.prepend(skinVorschau(id))
  card.querySelector('.skin__name')!.textContent = name
  const preis = card.querySelector('.skin__preis') as HTMLElement
  if (an) {
    preis.innerHTML = '<span></span>Aktiv'
    setIcon(preis.querySelector('span')!, 'Check')
  } else if (hat) preis.textContent = preisWert || lohnVon(id) || missionLohnVon(id) ? 'Wählen' : 'Gratis'
  else if (missionLohnVon(id)) {
    // Belohnung der Kampagne: nicht kaufbar
    const l = missionLohnVon(id)!
    preis.innerHTML = '<span></span>'
    setIcon(preis.querySelector('span')!, 'Lock')
    preis.append(`Mission ${l.mission} · ${weltVon(l.welt).name}`)
    preis.classList.add('zu-teuer')
  } else if (lohnVon(id)) {
    // Belohnung einer Welt: nicht kaufbar
    const l = lohnVon(id)!
    preis.innerHTML = '<span></span>'
    setIcon(preis.querySelector('span')!, 'Lock')
    preis.append(`Level ${l.level} · ${weltVon(l.welt).name}`)
    preis.classList.add('zu-teuer')
  } else {
    preis.innerHTML = `<i class="apfel-ico"></i>${preisWert}`
    if (wallet.aepfel < preisWert) preis.classList.add('zu-teuer')
  }
  card.addEventListener('click', () => kaufen(id, waehlen))
  return card
}

/** Teile der Schlange je Teilung (Namen der Chips) */
function teilNamen(): string[] {
  const n = look.anzahl
  if (look.teilung === 'ringe') return ['Ring 1', 'Ring 2', 'Ring 3'].slice(0, n)
  return n === 2 ? ['Kopfhälfte', 'Schwanzhälfte'] : ['Kopf', 'Mitte', 'Schwanz']
}

/** Kopf der Farben-Seite: Modus (ein-, zwei-, dreifarbig), Teilung und Schlangen-Symbol mit antippbaren Teilen */
function farbenKopf(box: HTMLElement) {
  const seg = document.createElement('div')
  seg.className = 'segment'
  const modi: [number, string, string | null][] = [[1, 'Einfarbig', null], [2, 'Zweifarbig', 'zweifarbig'], [3, 'Dreifarbig', 'dreifarbig']]
  for (const [n, name, id] of modi) {
    const b = document.createElement('button')
    b.setAttribute('aria-pressed', String(look.anzahl === n && !look.muster))
    b.textContent = name
    if (id && !hatSkin(wallet.skins, id)) {
      const i = document.createElement('i')
      i.innerHTML = `<i class="apfel-ico"></i>${preisVon(id)}`
      b.append(i)
    }
    b.addEventListener('click', () => {
      const setze = () => {
        look.anzahl = n
        look.muster = null
        while (look.farben.length < n) look.farben.push(['tuerkis', 'sonne', 'pink'][look.farben.length] ?? 'klassik')
        farbTeil = Math.min(farbTeil, n - 1)
      }
      if (id) kaufen(id, setze, b)
      else {
        audio.click()
        setze()
        lookAnwenden()
        renderTeil()
      }
    })
    seg.append(b)
  }
  box.append(seg)
  if (look.anzahl < 2) return
  const tSeg = document.createElement('div')
  tSeg.className = 'segment segment--klein'
  for (const t of TEILUNGEN) {
    const b = document.createElement('button')
    b.textContent = t.name
    const istVerlauf = look.teilung === 'verlauf' || look.teilung === 'stufen'
    b.setAttribute('aria-pressed', String(look.teilung === t.id || (t.id === 'verlauf' && istVerlauf)))
    b.addEventListener('click', () => {
      audio.click()
      if (t.id !== 'verlauf' || !istVerlauf) look.teilung = t.id
      lookAnwenden()
      renderTeil()
    })
    tSeg.append(b)
  }
  box.append(tSeg)
  // Verlauf: weich oder Glied fuer Glied (jedes Glied eine Zwischenstufe)
  if (look.teilung === 'verlauf' || look.teilung === 'stufen') {
    const vSeg = document.createElement('div')
    vSeg.className = 'segment segment--klein'
    for (const [id, name] of [['verlauf', 'Weich'], ['stufen', 'Glied für Glied']] as const) {
      const b = document.createElement('button')
      b.textContent = name
      b.setAttribute('aria-pressed', String(look.teilung === id))
      b.addEventListener('click', () => {
        audio.click()
        look.teilung = id
        lookAnwenden()
        renderTeil()
      })
      vSeg.append(b)
    }
    box.append(vSeg)
  }
  // Symbol: die eigene Schlange gross, Tippen waehlt den Teil
  const sym = vorschauCanvas(baueSkin({ farben: look.farben.slice(0, look.anzahl), teilung: look.teilung }))
  sym.className = 'farb-symbol'
  sym.addEventListener('click', (e) => {
    const r = sym.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    // Kopf liegt rechts: links antippen = Schwanz
    if (look.teilung !== 'ringe') farbTeil = Math.min(look.anzahl - 1, Math.floor((1 - fx) * look.anzahl))
    else farbTeil = (farbTeil + 1) % look.anzahl
    audio.click()
    renderTeil()
  })
  box.append(sym)
  const chips = document.createElement('div')
  chips.className = 'farb-chips'
  teilNamen().forEach((name, i) => {
    const f = FARBEN.find((x) => x.id === look.farben[i]) ?? FARBEN[0]
    const c = document.createElement('button')
    c.className = 'farb-chip'
    c.setAttribute('aria-pressed', String(i === farbTeil))
    c.innerHTML = `<i style="background:rgb(${f.kopf.join(',')})"></i>`
    c.append(name)
    c.addEventListener('click', () => {
      audio.click()
      farbTeil = i
      renderTeil()
    })
    chips.append(c)
  })
  box.append(chips)
}

/** Unterseite des Aussehens */
function renderTeil() {
  updateGeld()
  vorschauenLeeren()
  $('shopteil-titel').textContent = TEIL_TITEL[shopTeil]
  const kopf = $('shopteil-kopf')
  kopf.innerHTML = ''
  const box = $('skins')
  box.innerHTML = ''
  box.className = shopTeil === 'farben' ? 'skins skins--liste' : 'skins'
  if (shopTeil === 'farben') {
    farbenKopf(kopf)
    for (const f of FARBEN) {
      if (f.versteckt && !hatSkin(wallet.skins, f.id)) continue
      const an = !look.muster && look.farben[look.anzahl > 1 ? farbTeil : 0] === f.id
      box.append(
        shopKarte(f.id, f.name, an, () => {
          look.muster = null
          look.farben[look.anzahl > 1 ? farbTeil : 0] = f.id
        }, true),
      )
    }
  } else if (shopTeil === 'skins') {
    const p = document.createElement('p')
    p.className = 'hinweis'
    p.textContent = 'Ein Skin ersetzt die Farbe. Nochmal antippen: zurück zur Farbe. Accessoires und Spur bleiben.'
    kopf.append(p)
    for (const m of MUSTER) {
      if (m.versteckt && !hatSkin(wallet.skins, m.id)) continue
      box.append(shopKarte(m.id, m.name, look.muster === m.id, () => (look.muster = look.muster === m.id ? null : m.id)))
    }
  } else if (shopTeil === 'acc') {
    for (const platz of ['augen', 'kopf', 'gesicht', 'schwanz'] as Platz[]) {
      const h = document.createElement('h3')
      h.className = 'skin-stufe'
      h.textContent = PLATZ_NAME[platz]
      box.append(h)
      for (const a of ACCS.filter((x) => x.platz === platz))
        box.append(
          shopKarte(a.id, a.name, look.acc[platz] === a.id, () => {
            if (look.acc[platz] === a.id) delete look.acc[platz]
            else look.acc[platz] = a.id
          }),
        )
    }
  } else if (shopTeil === 'effekte') {
    effekteListe(kopf, box)
  } else if (shopTeil === 'spuren') {
    for (const s of SPUREN) box.append(shopKarte(s.id, s.name, look.spur === s.id, () => (look.spur = look.spur === s.id ? null : s.id)))
  } else {
    box.className = 'skins skins--welten'
    const p = document.createElement('p')
    p.className = 'hinweis'
    p.textContent = `Erreichst du in einer Welt ihr Ziel-Level, geht die nächste auf: Wiese 60, Wüstenoase 80, Winterwald 100, Bergwerk 110, Zauberwald 120, Gruselwald 130. Jede Welt hat eigene Belohnungen: bei Level 100 ein Skin, bei 150 ein Accessoire, bei 200 ein epischer Skin mit Spur.`
    kopf.append(p)
    for (const w of WELTEN) {
      const frei = weltOffen(w)
      const an = renderer.welt.id === w.id
      const card = document.createElement('button')
      card.className = 'skin welt'
      if (an) card.dataset.an = ''
      if (!frei) card.dataset.zu = ''
      card.append(weltVorschauCanvas(w))
      const name = document.createElement('span')
      name.className = 'skin__name'
      name.textContent = w.name
      const text = document.createElement('span')
      text.className = 'welt__text'
      text.textContent = w.text
      // Rekord hier und die Belohnungen der Welt (mit Haken, was schon erspielt ist)
      const lohn = document.createElement('span')
      lohn.className = 'welt__lohn'
      const best = stats.weltBest?.[w.id] ?? 0
      lohn.textContent = [
        `Rekord hier: ${best || '–'}`,
        ...(naechsteWelt(w) ? [`Nächste Welt ab Level ${weltStufe(w)}${best >= weltStufe(w) ? ' ✓' : ''}`] : []),
        ...WELT_LOHN.filter((l) => l.welt === w.id).map((l) => `${l.level}: ${nameVon(l.id)}${hatSkin(wallet.skins, l.id) ? ' ✓' : ''}`),
      ].join(' · ')
      text.append(lohn)
      const st = document.createElement('span')
      st.className = 'skin__preis'
      if (an) {
        st.innerHTML = '<span></span>Aktiv'
        setIcon(st.querySelector('span')!, 'Check')
      } else if (frei) st.textContent = 'Wählen'
      else {
        st.innerHTML = '<span></span>'
        setIcon(st.querySelector('span')!, 'Lock')
        const vw = vorherigeWelt(w)
        st.append(vw ? `Level ${weltStufe(vw)} in ${vw.name}` : 'Level in der Welt davor')
        st.classList.add('zu-teuer')
      }
      card.append(name, text, st)
      card.addEventListener('click', () => {
        audio.unlock()
        if (!frei) {
          audio.nein()
          card.classList.remove('wackeln')
          void card.offsetWidth
          card.classList.add('wackeln')
          return
        }
        audio.click()
        wallet.welt = w.id
        saveWallet()
        renderer.welt = w
        renderTeil()
      })
      box.append(card)
    }
  }
}

/** Effekte: nicht kaufbar, sondern freigeschaltet. Silber = alle je verdienten Aepfel, Gold = Gold-Trophaeen */
function effekteListe(kopf: HTMLElement, box: HTMLElement) {
  const silber = wallet.verdient ?? 0
  const gold = wallet.trophaeen ?? 0
  const p = document.createElement('p')
  p.className = 'hinweis'
  p.innerHTML = `Effekte kauft man nicht, man schaltet sie frei: <b>Silber-Trophäen</b> sind alle Äpfel, die du je verdient hast (${silber.toLocaleString('de-DE')}), <b>Gold-Trophäen</b> gibt es für Siege im Mehrspieler (${gold.toLocaleString('de-DE')}). Ein Effekt gleichzeitig, nochmal antippen nimmt ihn ab.`
  kopf.append(p)
  for (const art of ['silber', 'gold'] as const) {
    const h = document.createElement('h3')
    h.className = `skin-stufe effekt-stufe effekt-stufe--${art}`
    h.innerHTML = `<span data-icon="Trophy"></span>${art === 'silber' ? 'Silber' : 'Gold'}`
    mountIcons(h)
    box.append(h)
    for (const e of EFFEKTE.filter((x) => x.art === art)) {
      const frei = effektFrei(e, silber, gold)
      const an = look.effekt === e.id
      const card = document.createElement('button')
      card.className = 'skin fx-karte'
      card.dataset.id = e.id
      if (an) card.dataset.an = ''
      if (!frei) card.dataset.zu = ''
      card.append(vorschauCanvas(baueSkin({ farben: look.farben.slice(0, look.anzahl), teilung: look.teilung, effekt: e.id }), 'aura'))
      const name = document.createElement('span')
      name.className = 'skin__name'
      name.textContent = e.name
      const st = document.createElement('span')
      st.className = 'skin__preis'
      if (an) {
        st.innerHTML = '<span></span>Aktiv'
        setIcon(st.querySelector('span')!, 'Check')
      } else if (frei) st.textContent = 'Wählen'
      else {
        const hat = art === 'silber' ? silber : gold
        st.innerHTML = '<span></span>'
        setIcon(st.querySelector('span')!, 'Lock')
        st.append(`${kurzZahl(e.ab)} (noch ${kurzZahl(e.ab - hat)})`)
        st.classList.add('zu-teuer')
      }
      card.append(name, st)
      card.addEventListener('click', () => {
        audio.unlock()
        if (!frei) {
          audio.nein()
          card.classList.remove('wackeln')
          void card.offsetWidth
          card.classList.add('wackeln')
          return
        }
        audio.click()
        look.effekt = look.effekt === e.id ? null : e.id
        lookAnwenden()
        renderTeil()
      })
      box.append(card)
    }
  }
}

/** Kaufen (wenn noch nicht gekauft und genug Aepfel), dann waehlen */
function kaufen(id: string, waehlen: () => void, knopf?: HTMLElement) {
  audio.unlock()
  if (!hatSkin(wallet.skins, id)) {
    const l = lohnVon(id)
    const ml = missionLohnVon(id)
    if (l || ml) {
      audio.nein()
      haptic.medium()
      toast('gebiet', nameVon(id), ml ? `Schaff Mission ${ml.mission} der Kampagne (${weltVon(ml.welt).name}).` : `Erreiche Level ${l!.level} in der Welt ${weltVon(l!.welt).name}.`)
      const card = knopf ?? $('skins').querySelector<HTMLElement>(`[data-id="${id}"]`)
      card?.classList.remove('wackeln')
      void card?.offsetWidth
      card?.classList.add('wackeln')
      return
    }
    if (wallet.aepfel < preisVon(id)) {
      audio.nein()
      haptic.medium()
      const card = knopf ?? $('skins').querySelector<HTMLElement>(`[data-id="${id}"]`)
      card?.classList.remove('wackeln')
      void card?.offsetWidth
      card?.classList.add('wackeln')
      return
    }
    wallet.aepfel -= preisVon(id)
    wallet.skins.push(id)
    audio.kauf()
    haptic.success()
    erfolgeMelden()
    saveStats()
  } else audio.click()
  waehlen()
  lookAnwenden()
  renderTeil()
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
  modusZeichnen()
  $('btn-kreativ-home').hidden = !master.frei
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
  demo = new Game({ screenW: sc.w, screenH: sc.h, tempo: 'langsam', startLevel: 1, cfg: { ...config }, zufallsWelt: true })
  renderer.reset()
}

/* ================= Unterseiten ================= */

function renderHelp() {
  const list = $('help-list')
  list.innerHTML = ''
  for (const h of help(game?.cfg ?? mitStufen(config, renderer.welt.id))) {
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
    ['Silber-Trophäen', (wallet.verdient ?? 0).toLocaleString('de-DE')],
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
  pushOptionenZeichnen()
  $('btn-konto-loeschen').hidden = !onlineAktiv || !angemeldet()
  $<HTMLInputElement>('opt-sound').checked = settings.sound
  $<HTMLInputElement>('opt-music').checked = settings.music
  $<HTMLInputElement>('opt-vibration').checked = settings.vibration
  $<HTMLInputElement>('opt-dpad').checked = settings.dpad
  for (const [id, v] of [['opt-tempo', settings.tempo]])
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
/** Welt der Kreativ-Runde (unbekannte = Wiese) */
const kreativWelt = (): WeltId => (renderer.welt.id in WELT_STUFEN ? renderer.welt.id : 'wiese') as WeltId

/** Kreativ: Welt, Level und was kommen kann, dann spielen */
function renderKreativ() {
  kInput('k-start').value = kInput('k-start-range').value = String(kreativ.start)
  // Welt: jede (Admin), gilt auch im normalen Spiel
  const wb = $('k-welt')
  wb.replaceChildren()
  for (const w of WELTEN) {
    const b = document.createElement('button')
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(renderer.welt.id === w.id))
    b.textContent = w.name
    b.addEventListener('click', () => {
      if (renderer.welt.id === w.id) return
      audio.click()
      wallet.welt = w.id
      saveWallet()
      renderer.welt = w
      renderKreativ()
    })
    wb.append(b)
  }
  // Was kommen kann: je Ding an/aus (gilt je Welt)
  const welt = kreativWelt()
  const aus = new Set(kreativ.aus[welt] ?? [])
  const box = $('k-dinge')
  box.replaceChildren()
  for (const d of kreativDinge(welt)) {
    const lab = document.createElement('label')
    lab.className = 'k-ding'
    const name = document.createElement('span')
    name.textContent = d.name
    const sw = document.createElement('input')
    sw.type = 'checkbox'
    sw.className = 'switch'
    sw.checked = !aus.has(d.key)
    sw.addEventListener('change', () => {
      audio.click()
      if (sw.checked) aus.delete(d.key)
      else aus.add(d.key)
      kreativ.aus[welt] = [...aus]
      saveKreativ()
    })
    lab.append(name, sw)
    box.append(lab)
  }
}

function kreativAlle(an: boolean) {
  audio.click()
  const welt = kreativWelt()
  kreativ.aus[welt] = an ? [] : kreativDinge(welt).map((d) => d.key)
  saveKreativ()
  renderKreativ()
}
$('k-alle-an').addEventListener('click', () => kreativAlle(true))
$('k-alle-aus').addEventListener('click', () => kreativAlle(false))

function kreativStart(v: number, quelle: HTMLInputElement) {
  if (!Number.isFinite(v)) return
  kreativ.start = Math.max(1, Math.min(5000, Math.round(v)))
  if (quelle !== kInput('k-start-range')) kInput('k-start-range').value = String(kreativ.start)
  if (quelle !== kInput('k-start')) kInput('k-start').value = String(kreativ.start)
  saveKreativ()
}
kInput('k-start-range').addEventListener('input', (e) => kreativStart(Number((e.target as HTMLInputElement).value), e.target as HTMLInputElement))
kInput('k-start').addEventListener('change', (e) => kreativStart(Number((e.target as HTMLInputElement).value), e.target as HTMLInputElement))
$('btn-kreativ-start').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  closeAllPages()
  newGame(true)
})

/* ================= Master-Einstellungen ================= */

/** Eine Zeile der Master-Einstellungen: Schalter, Stufe (häufig … aus) oder Zahl. `geaendert` nach jeder Änderung */
function configZeile(f: SchemaFeld, geaendert: () => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'master__row'
  const t = document.createElement('span')
  t.textContent = f.label
  if (f.schalter) {
    // An/aus (1/0)
    const sw = document.createElement('input')
    sw.type = 'checkbox'
    sw.className = 'switch'
    sw.checked = config[f.key] > 0
    sw.addEventListener('change', () => {
      config[f.key] = sw.checked ? 1 : 0
      saveConfig()
      geaendert()
    })
    row.append(t, sw)
    return row
  }
  if (f.stufe) {
    // Stufe: häufig (3), mittel (2), selten (1), aus (0)
    const sel = document.createElement('select')
    sel.className = 'stufe'
    for (let v = 3; v >= 0; v--) {
      const o = document.createElement('option')
      o.value = String(v)
      o.textContent = STUFE_NAME[v]
      sel.append(o)
    }
    sel.value = String(config[f.key])
    sel.dataset.stufe = sel.value
    sel.addEventListener('change', () => {
      config[f.key] = Number(sel.value)
      sel.dataset.stufe = sel.value
      saveConfig()
      geaendert()
    })
    row.append(t, sel)
    return row
  }
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
    if (!Number.isFinite(v)) v = config[f.key]
    v = Math.min(f.max, Math.max(f.min, v))
    if (!f.step || f.step >= 1) v = Math.round(v)
    config[f.key] = v
    inp.value = String(v)
    saveConfig()
    geaendert()
  })
  row.append(t, inp, u)
  return row
}

/** Feld der Master-Einstellungen zu einem Schluessel */
const schemaFeld = (key: string) => SCHEMA.flatMap((g) => g.felder).find((f) => f.key === key)

/** Welt, deren Wahrscheinlichkeiten im Admin gerade zu sehen sind */
let masterWelt: WeltId = 'wiese'

/**
 * Admin je Welt: Gefahren von häufig bis selten mit Schalter und Chance je Apfel, dann alle anderen Dinge mit ihrer
 * Stufe und ab welchem Level sie kommen.
 */
function renderMasterWelt() {
  const wb = $('master-welt')
  wb.replaceChildren()
  for (const w of WELTEN) {
    if (!(w.id in WELT_STUFEN)) continue
    const b = document.createElement('button')
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(masterWelt === w.id))
    b.textContent = w.name
    b.addEventListener('click', () => {
      audio.click()
      masterWelt = w.id as WeltId
      renderMasterWelt()
    })
    wb.append(b)
  }
  const box = $('master-welt-list')
  box.replaceChildren()
  const w = masterWelt
  const kopf = (text: string) => {
    const h = document.createElement('h4')
    h.textContent = text
    box.append(h)
  }
  const hinweis = (text: string) => {
    const p = document.createElement('p')
    p.className = 'hinweis'
    p.textContent = text
    box.append(p)
  }
  kopf('Gefahren (je Apfel)')
  const gefahren = WELT_GEFAHREN[w]
  if (!gefahren.length) hinweis('Hier gibt es keine Welt-Gefahren, nur die Dinge unten.')
  for (const k of gefahren) {
    const an = schemaFeld(`${k}An`)
    const chance = schemaFeld(`${k}Chance`)
    if (!an || !chance) continue
    const zeile = document.createElement('div')
    zeile.className = 'gefahr'
    const name = document.createElement('b')
    name.textContent = an.label
    const badge = document.createElement('span')
    badge.className = 'stufe-badge'
    const stufe = () => {
      const s = config[an.key] > 0 ? gefahrStufe(config[chance.key]) : 'aus'
      badge.textContent = s
      badge.dataset.s = s
    }
    stufe()
    // Erste Zeile: Name und Stufe, zweite: an/aus und Chance je Apfel
    zeile.append(name, badge, configZeile({ ...an, label: '' }, stufe), configZeile({ ...chance, label: 'Chance' }, stufe))
    box.append(zeile)
  }
  if (w === 'gruselwald') {
    const f = schemaFeld('werwolfAlle')
    if (f) box.append(configZeile(f, () => {}))
  }
  kopf('Alles andere (Mauern sind immer häufig)')
  const gruppe = STUFEN_SCHEMA.find((g) => g.felder.some((f) => f.key === stufeKey(w, 'teich')))
  // In der Reihenfolge, in der sie kommen
  const c = mitStufen(config, w) as Record<string, number>
  const dinge = (gruppe?.felder ?? []).map((f) => ({ f, ab: c[`${f.key.slice(`stufe_${w}_`.length)}Ab`] ?? NIE }))
  for (const { f, ab } of dinge.sort((a, b) => a.ab - b.ab)) {
    const row = configZeile(f, renderMasterWelt)
    const klein = document.createElement('small')
    klein.textContent = ab >= NIE ? 'kommt nicht' : `ab Level ${ab}`
    row.querySelector('span')?.append(klein)
    box.append(row)
  }
}

/** Admin: nur die Wahrscheinlichkeiten (wann Neues kommt, wie oft die Stufen sind, je Welt Gefahren und Dinge) */
function renderMaster() {
  masterWelt = kreativWelt()
  const list = $('master-list')
  list.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'master'
  const h = document.createElement('h3')
  h.textContent = 'Wann Neues kommt (alle Welten)'
  box.append(h)
  const felder = [...STUFEN_SCHEMA[0].felder, schemaFeld('powerChance')].filter((f): f is SchemaFeld => !!f)
  for (const f of felder) box.append(configZeile(f, renderMasterWelt))
  list.append(box)
  renderMasterWelt()
}
/** Admin (Optionen): einmal das Admin-Passwort eingeben, dann Master-Einstellungen und Spieler verwalten */
$('btn-admin').addEventListener('click', async () => {
  audio.click()
  if (!master.frei || !master.code) {
    const code = prompt('Admin-Passwort')
    if (!code) return
    if (!(await masterFreischalten(code))) {
      alert('Falsches Passwort.')
      return
    }
    // Ab jetzt: Kreativ-Modus und alle Welten
    $('btn-kreativ-home').hidden = false
    renderer.welt = aktiveWelt()
  }
  openPage('master')
  void adminListe()
})

/** Admin: alle Spieler (aus der Hall of Snakes) mit Loeschen-Knopf, nach Namen filterbar */
let adminZeilen: HallZeile[] = []

/** Admin: Spieler mit Rueckfrage loeschen (Profil, Ergebnisse, Freunde, Nachrichten). true = geloescht */
async function spielerLoeschen(z: HallZeile) {
  if (!confirm(`${z.name} wirklich löschen? Profil, Ergebnisse, Freunde und Nachrichten sind dann weg.`)) return false
  try {
    await adminLoeschen(master.code, z.user_id)
    adminZeilen = adminZeilen.filter((x) => x.user_id !== z.user_id)
    toast('schlange', 'Gelöscht', z.name)
    return true
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    return false
  }
}
async function adminListe(neu = true) {
  const box = $('admin-liste')
  const info = $('admin-info')
  if (!onlineAktiv) {
    info.textContent = 'Online ist nicht eingerichtet.'
    return
  }
  if (neu) {
    info.textContent = 'Lädt …'
    try {
      adminZeilen = (await ladeHall()).zeilen
    } catch {
      info.textContent = 'Keine Verbindung.'
      return
    }
  }
  const such = $<HTMLInputElement>('admin-suche').value.trim().toLowerCase()
  const treffer = adminZeilen.filter((z) => !such || z.name.toLowerCase().includes(such))
  box.replaceChildren()
  for (const z of treffer.slice(0, 200)) {
    const el = document.createElement('div')
    el.className = 'liste__zeile admin-zeile'
    const name = document.createElement('span')
    name.className = 'liste__name'
    name.textContent = z.name
    const rekord = document.createElement('b')
    rekord.className = 'liste__level'
    rekord.textContent = z.rekord > 0 ? String(z.rekord) : '–'
    const weg = document.createElement('button')
    weg.className = 'icon-btn admin-weg'
    weg.setAttribute('aria-label', `${z.name} löschen`)
    setIcon(weg, 'Trash2')
    weg.addEventListener('click', async () => {
      if (await spielerLoeschen(z)) void adminListe(false)
    })
    el.append(name, rekord, weg)
    box.append(el)
  }
  info.textContent = `${treffer.length} von ${adminZeilen.length} Spielern`
}
$('admin-suche').addEventListener('input', () => void adminListe(false))
$('btn-master-reset').addEventListener('click', () => {
  if (!confirm('Alle Master-Einstellungen auf Standard zurücksetzen?')) return
  resetConfig()
  renderMaster()
  audio.click()
})

/* ================= Fortschritt je Welt ================= */

/**
 * Neuer bester Level in der aktuellen Welt: Beim Ziel-Level der Welt (weltStufe) geht die naechste Welt auf, bei 100, 150 und 200 gibt
 * es die Belohnungen der Welt (Skin, Accessoire, epischer Skin mit Spur). Zaehlt nicht im Kreativ- und Tagesmodus.
 */
function weltFortschritt(level: number) {
  const w = renderer.welt
  const vorher = stats.weltBest?.[w.id] ?? 0
  if (level <= vorher) return
  stats.weltBest = { ...(stats.weltBest ?? {}), [w.id]: level }
  saveStats()
  // Belohnungen, deren Level gerade ueberschritten wurde
  let neu = false
  for (const l of WELT_LOHN) {
    if (l.welt !== w.id || vorher >= l.level || level < l.level || wallet.skins.includes(l.id)) continue
    wallet.skins.push(l.id)
    neu = true
    const art = MUSTER.some((m) => m.id === l.id) ? 'Skin' : ACCS.some((a) => a.id === l.id) ? 'Accessoire' : 'Spur'
    audio.record()
    haptic.success()
    toast('aepfel', `Neu: ${nameVon(l.id)}`, `${art} für Level ${l.level} in der Welt ${w.name}. Im Aussehen anlegen.`)
  }
  // Ziel-Level der Welt (Wiese 60, Wueste 80, ...): die naechste Welt geht auf
  const nw = naechsteWelt(w)
  if (vorher < weltStufe(w) && level >= weltStufe(w) && nw && !(wallet.welten ?? []).includes(nw.id)) {
    wallet.welten = [...(wallet.welten ?? []), nw.id]
    neu = true
    toast('baum', `${nw.name} freigeschaltet`, 'Im Aussehen unter Welten wählbar.')
  }
  if (neu) saveWallet()
}

/* ================= Speedrun ================= */

/**
 * Zeit fuer jeden Apfel: Die Schlange braucht mindestens so viele Schritte, wie der Apfel entfernt ist (Manhattan-
 * Abstand d). Hindernisse und Kurven kosten erfahrungsgemaess rund 40 % Umweg, dazu kommen 12 Schritte zum
 * Erkennen und Reagieren (bei 123 ms etwa 1,5 s). Also (1,4 d + 12) Schritte im aktuellen Takt: wird die Schlange
 * schneller, schrumpft die Zeit mit, die Zahl der Schritte bleibt gleich fair.
 */
function speedrunTakt(g: Game) {
  if (!frist || frist.t !== g.apple.t) {
    const h = g.body[0]
    const d = Math.abs(h.x - g.apple.p.x) + Math.abs(h.y - g.apple.p.y)
    frist = { t: g.apple.t, dauer: (1.4 * d + 12) * g.tick }
  }
  const rest = frist.t + frist.dauer - g.time
  const anteil = Math.max(0, Math.min(1, rest / frist.dauer))
  const bar = $('speedrun-zeit')
  bar.querySelector('i')!.style.transform = `scaleX(${anteil})`
  bar.classList.toggle('knapp', anteil < 0.3)
  if (mode === 'play' && g.status === 'play' && rest <= 0) {
    g.zeitAbgelaufen()
    for (const e of g.drain()) handle(e)
  }
}

/* ================= Kampagne ================= */

const karte = new KampagnenKarte(WIESE_MISSIONEN)
const kScroll = $('kampagne-scroll')
const kBild = $<HTMLCanvasElement>('kampagne-bild')
let kHinweisZeit = 0

function feldZustand(i: number): FeldZustand {
  const m = WIESE_MISSIONEN[i]
  if (geschafft(m)) return 'geschafft'
  return spielbar(m) && missionOffen(m) ? 'offen' : 'zu'
}
/** Offen: die erste, die davor geschafft, oder im Admin-Zugang jede (zum Testen) */
const missionOffen = (m: MissionDef) => master.frei || offen(m, WIESE_MISSIONEN)
/** Die Mission, die als naechste dran ist (pulsiert auf der Karte) */
function naechsteMission() {
  return WIESE_MISSIONEN.find((m) => !geschafft(m) && spielbar(m) && offen(m, WIESE_MISSIONEN)) ?? null
}

/** Karte oeffnen: Groesse messen, Schlange auf den Stand setzen, zur aktuellen Mission scrollen */
function kampagneOeffnen() {
  const fertig = WIESE_MISSIONEN.filter(geschafft).length
  $('kampagne-info').textContent = `Wiese · ${fertig} von ${WIESE_MISSIONEN.length} geschafft`
  $('kampagne-geld').textContent = String(wallet.aepfel)
  $('kampagne-hinweis').hidden = true
  requestAnimationFrame(() => {
    karte.messen(kScroll.clientWidth)
    $('kampagne-hoehe').style.height = `${karte.h}px`
    karte.setzen(erreicht('wiese'))
    const ziel = naechsteMission()?.nr ?? Math.max(1, erreicht('wiese'))
    kScroll.scrollTop = karte.scrollFuer(ziel, kScroll.clientHeight)
  })
}

/** Ein Bild der Karte (laeuft in der Spielschleife, solange die Seite offen ist) */
function kampagneBild(now: number) {
  const vw = kScroll.clientWidth
  const vh = kScroll.clientHeight
  if (!vw || !vh) return
  karte.messen(vw)
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  if (kBild.width !== Math.round(vw * dpr) || kBild.height !== Math.round(vh * dpr)) {
    kBild.width = Math.round(vw * dpr)
    kBild.height = Math.round(vh * dpr)
  }
  const ctx = kBild.getContext('2d')!
  karte.zeichnen(ctx, dpr, vw, vh, kScroll.scrollTop, now, renderer.skin, feldZustand, (naechsteMission()?.nr ?? 0) - 1, reduce)
  if (kHinweisZeit && now - kHinweisZeit > 2600) {
    kHinweisZeit = 0
    $('kampagne-hinweis').hidden = true
  }
}

function kampagneHinweis(text: string) {
  const el = $('kampagne-hinweis')
  el.textContent = text
  el.hidden = false
  kHinweisZeit = performance.now()
}

/** Mission starten: die Schlange waechst auf der Karte bis zum Feld, dann geht es los */
function missionStarten(m: MissionDef) {
  audio.unlock()
  audio.click()
  haptic.light()
  karte.wachsen(m.nr, () => {
    setzeErreicht(m.welt, m.nr)
    closeAllPages()
    newGame(false, false, 'normal', m)
    if (m.dungeonBoss)
      toast('gegner', `Mission ${m.nr}: ${m.name}`, 'Er haust in einem der sechs Räume des Labyrinths: such ihn. In seinem Raum liegen Flammen, jede fliegt auf ihn. Fünf Flammen, und er verschwindet, bis er woanders wieder auftaucht. Drei Leben hat er, dann geht oben die Tür hinaus auf. Nur dein Kopf zählt.')
    else if (m.art === 'boss' && m.boss === 'ent')
      toast('gegner', `Mission ${m.nr}: ${m.name}`, 'Drei Phasen. Hol eine Flamme aus der Glutschale und zünde die Holzstapel an. Brennen alle, liegt sein Herzknoten frei: dann durch ihn hindurch. Später fangen seine Wurzeln an brennenden Feuern Feuer. Der Ent hat drei Leben, du keins extra: Trifft er deinen Kopf, ist es vorbei.')
    else if (m.art === 'boss')
      toast('gegner', `Mission ${m.nr}: ${m.name}`, 'Drei Räume. Bring die Kristalle zum Sockel ihrer Farbe, leuchten alle, bannt der Kreis den Golem: dann fahr durch ihn hindurch. Je Raum ein Treffer, drei braucht er. Trifft er deinen Kopf, ist es vorbei.')
    else if (!karteVon(m).aepfel.length) toast('gebiet', `Mission ${m.nr}: ${m.name}`, m.hinweis ?? '')
    else toast('apfel', `Mission ${m.nr}: ${m.name}`, `Hol alle ${karteVon(m).aepfel.length} Äpfel, der letzte leuchtet. ${m.hinweis ?? 'Berge, Mauern, Teiche, Giftäpfel und Frösche sind tödlich.'}`)
  })
}

kScroll.addEventListener('click', (e) => {
  if (karte.waechst) return
  const r = kScroll.getBoundingClientRect()
  const x = e.clientX - r.left - (r.width - karte.w) / 2
  const y = e.clientY - r.top + kScroll.scrollTop
  const i = karte.treffer(x, y)
  if (i < 0) return
  const m = WIESE_MISSIONEN[i]
  if (!spielbar(m)) {
    audio.click()
    kampagneHinweis(`Mission ${m.nr} kommt bald.`)
    return
  }
  if (!missionOffen(m)) {
    audio.click()
    kampagneHinweis(`Schaff erst Mission ${m.nr - 1}.`)
    return
  }
  missionStarten(m)
})

$('btn-kampagne').addEventListener('click', () => {
  audio.unlock()
  openPage('kampagne')
})

/* ================= Verdrahtung ================= */

$('btn-play').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  newGame(false, false, settings.modus, null)
  if (settings.modus !== 'normal') toast(settings.modus === 'speedrun' ? 'apfel' : 'zeitlupe', SPIELMODUS_NAME[settings.modus], modusInfo(settings.modus))
})
$('btn-tages').addEventListener('click', () => {
  audio.unlock()
  audio.click()
  newGame(false, true, 'normal', null)
  const tl = heutigesLevel()
  const bonus = stats.tagesBonus === tagBerlin() ? 'Den 10er-Bonus hast du heute schon.' : 'Der letzte leuchtet pink und bringt 10 Äpfel.'
  toast('gebiet', `Tageslevel: ${tl.motto}`, `Hol ${tl.ziel} Äpfel. ${bonus} Schwierigkeit ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][wochentag(tagBerlin())]}: ${tl.schwierigkeit}.`)
})

/** Auswahl Abenteuer / Normal / Speedrun im Startmenue */
function modusInfo(m: SpielModus) {
  const wert = game?.cfg.apfelWertAlle ?? 50
  return m === 'abenteuer'
    ? 'Genau 25 % langsamer, dafür 25 % weniger Äpfel.'
    : m === 'speedrun'
      ? `25 % schneller, jeder Apfel hat ein Zeitlimit. 25 % mehr Äpfel, ab Level ${wert} (orange) sogar 50 % mehr.`
      : 'Das normale Spiel.'
}
function modusZeichnen() {
  for (const b of $('home-modus').querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-checked', String(b.dataset.v === settings.modus))
  const rest = wallet.rest ?? 0
  $('home-modus-text').textContent = modusInfo(settings.modus) + (settings.modus !== 'normal' && rest > 0 ? ` Zwischengespeichert: ${(rest / 100).toLocaleString('de-DE')} Apfel.` : '')
}
$('home-modus').querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
  b.addEventListener('click', () => {
    audio.click()
    settings.modus = b.dataset.v as SpielModus
    saveSettings()
    modusZeichnen()
  }),
)
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
  zumMenue()
})
$('btn-again').addEventListener('click', () => {
  audio.click()
  newGame()
})
$('btn-menu').addEventListener('click', () => {
  audio.click()
  zumMenue()
})
/** Spiel verlassen: ins Startmenue, nach einer Mission zurueck auf die Karte der Kampagne */
function zumMenue() {
  const mission = laufMission
  game = null
  istKreativ = false
  laufMission = null
  app.removeAttribute('data-kreativ')
  app.removeAttribute('data-mission')
  renderer.berge = null
  renderer.minikarte = true
  renderer.welt = aktiveWelt()
  newDemo()
  setMode('home')
  if (mission) openPage('kampagne')
}
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
$('btn-konto-loeschen').addEventListener('click', async () => {
  if (!confirm(`Dein Online-Konto „${profil.name}“ wirklich löschen? Name, Online-Ergebnisse, Freunde und Nachrichten sind dann weg. Spielstand und Einstellungen auf diesem Gerät bleiben.`)) return
  try {
    await kontoLoeschen()
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    return
  }
  alert('Dein Online-Konto ist gelöscht.')
  location.reload()
})
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
  } else {
    audio.resume()
    if (angemeldet()) {
      online?.wieder()
      kontoSichern()
    }
  }
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
    } else {
      audio.resume()
      if (angemeldet()) {
        online?.wieder()
        kontoSichern()
      }
    }
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
  if (page() === 'kampagne') kampagneBild(now)
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
    if (istSpeedrun) speedrunTakt(game)
    if (istTages) {
      $('tages-ziel').textContent = `${Math.min(game.gegessen, tagesZiel)} / ${tagesZiel}`
      renderer.sonderApfel = game.gegessen === tagesZiel - 1
    }
    // Kampagne: geholte Aepfel oben rechts, der letzte liegende leuchtet
    if (game instanceof EntBossGame) {
      // Ent: wie viele Holzstapel brennen
      const akt = game.kampf.aktiveFeuer
      const t = `${akt.filter((f) => f.an).length} / ${akt.length}`
      const zt = $('tages-ziel')
      if (zt.textContent !== t) zt.textContent = t
      renderer.sonderApfel = false
    } else if (game instanceof BossGame) {
      const t = `${game.sockel.filter((s) => s.an).length} / ${game.sockel.length}`
      const zt = $('tages-ziel')
      if (zt.textContent !== t) zt.textContent = t
      renderer.sonderApfel = false
    } else if (game instanceof KaefigBossGame) {
      // Kaefigmeister: Flammen dieses Lebens
      const t = game.meister.zustand === 'tot' ? '✓' : `${game.meister.treffer} / ${MEISTER.flammen}`
      const zt = $('tages-ziel')
      if (zt.textContent !== t) zt.textContent = t
      renderer.sonderApfel = false
    } else if (laufMission && game instanceof MissionGame) {
      const t = `${game.ziel - game.uebrig} / ${game.ziel}`
      const zt = $('tages-ziel')
      if (zt.textContent !== t) zt.textContent = t
      renderer.sonderApfel = game.uebrig === 1
    }
    renderer.mehr = null
    if (!verdeckt) renderer.draw(game)
  }
  updateEffekte()
  if (istShop()) {
    for (const s of skinCanvas) drawSkinVorschau(s.cv, s.skin, now, s.fokus)
    weltVorschauenZeichnen(now)
  } else if (skinVideos.length && !skinVideos.every((v) => v.paused)) for (const v of skinVideos) v.pause()
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
      // Eine laufende Mission ist damit vorbei: keine Berge, wieder die gewaehlte Welt
      if (laufMission) {
        laufMission = null
        app.removeAttribute('data-mission')
        renderer.berge = null
        renderer.minikarte = true
        renderer.welt = aktiveWelt()
      }
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
let gesperrteUids = new Set<string>()
/** Wann zuletzt eine Einladung von wem kam (gegen Dauer-Einladungen) */
const einladungVon = new Map<string, number>()
/** Ist dieser Spieler gerade online (irgendein Geraet)? */
const onlineVon = (uid: string) => onlineListe.find((o) => o.uid === uid)
const lobbyRueckruf: Parameters<typeof lobby>[1] = {
      liste: (o) => {
        onlineListe = o
        onlineZeichnen()
        freundeZeichnen()
        if (page() === 'liste' && listeArt === 'alle') void ladeListeAnzeige()
      },
      einladung: (e) => {
        // Jeder darf einladen, ausser gesperrte Spieler; hoechstens eine Einladung je Absender alle 10 s
        if (!e.vonUid || gesperrteUids.has(e.vonUid)) return
        if (Date.now() - (einladungVon.get(e.vonUid) ?? 0) < 10_000) return
        einladungVon.set(e.vonUid, Date.now())
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
  // Alle, die online sind (Freunde zuerst); derselbe Account auf zwei Geraeten nur einmal
  const gesehen = new Set<string>()
  const frei = onlineListe
    .filter((o) => !imRaum.has(o.geraet) && !!o.uid && !gesperrteUids.has(o.uid) && !gesehen.has(o.uid) && gesehen.add(o.uid))
    .sort((a, b) => Number(freundeUids.has(b.uid!)) - Number(freundeUids.has(a.uid!)) || a.name.localeCompare(b.name))
  box.replaceChildren()
  if (!frei.length) {
    const p = document.createElement('p')
    p.className = 'liste__leer'
    p.textContent = 'Gerade ist niemand online. In der Hall of Snakes kannst du jeden antippen und einladen, auch als Nachricht aufs Handy.'
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
    klein.textContent = `${freundeUids.has(o.uid!) ? 'Freund · ' : ''}${o.imSpiel ? 'spielt gerade' : 'online'}`
    name.append(klein)
    const k = document.createElement('button')
    k.className = 'btn btn--ghost btn--klein'
    k.textContent = 'Einladen'
    k.addEventListener('click', () => void einladen(o))
    el.append(cv, name, k)
    box.append(el)
    drawSchlangeGerade(cv, skinVon(o.skin), 0)
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
  $('push-info').textContent = an ? 'Ist an: Du bekommst eine Nachricht, wenn dich jemand einlädt, auch wenn Snake gerade zu ist.' : Notification.permission === 'denied' ? 'Blockiert. In den Einstellungen des Handys für Snake erlauben.' : 'Eine Nachricht, wenn dich jemand zum Spielen einlädt, auch wenn Snake gerade zu ist.'
  pushOptionenZeichnen()
}

/** Meldung, wenn Benachrichtigungen nicht eingeschaltet werden konnten (mit Grund) */
function pushFehlerText() {
  const g = pushGrund()
  if (g === 'schluessel') return 'Noch nicht eingerichtet: Push-Schlüssel fehlt in dieser Fassung.'
  return pushFehler ? `Das hat nicht geklappt (${pushFehler}).` : 'Das hat nicht geklappt.'
}

/** Optionen: Schalter fuer Benachrichtigungen (nur bei Einladungen) */
function pushOptionenZeichnen() {
  const zeile = $('opt-push-zeile')
  zeile.hidden = !mehr.verfuegbar || !onlineAktiv
  if (zeile.hidden) return
  const sw = $<HTMLInputElement>('opt-push')
  const info = $('opt-push-info')
  if (!pushMoeglich()) {
    sw.disabled = true
    sw.checked = false
    const g = pushGrund()
    info.textContent =
      g === 'schluessel'
        ? 'Noch nicht eingerichtet: Der Push-Schlüssel (VITE_VAPID_PUBLIC_KEY) fehlt in dieser Fassung. Siehe docs/MEHRSPIELER-EINRICHTEN.md, Schritt 7.'
        : g === 'app'
          ? 'In der Android-App kommen Einladungen nur, solange Snake offen ist. Als Web-App vom Home-Bildschirm auch bei geschlossener App.'
          : 'Dieser Browser kann keine Benachrichtigungen. Auf dem iPhone: Snake zum Home-Bildschirm hinzufügen und von dort öffnen.'
    return
  }
  sw.disabled = false
  sw.checked = pushErlaubt()
  info.textContent = Notification.permission === 'denied' ? 'Blockiert. In den Einstellungen des Handys für Snake erlauben.' : 'Nur wenn dich jemand zum Spielen einlädt, sonst nie.'
}
$('opt-push').addEventListener('change', async (e) => {
  const sw = e.target as HTMLInputElement
  audio.click()
  if (sw.checked) {
    const r = await pushEinschalten()
    toast('gebiet', 'Benachrichtigungen', r === 'an' ? 'Eingeschaltet: Du wirst bei Einladungen benachrichtigt.' : r === 'verweigert' ? 'Nicht erlaubt. Du kannst es in den Einstellungen des Handys ändern.' : pushFehlerText())
  } else {
    await pushAusschalten()
    toast('gebiet', 'Benachrichtigungen', 'Ausgeschaltet.')
  }
  pushZeichnen()
})

/** Beim ersten Besuch von Hall of Snakes oder Mehrspieler einmal fragen (die Erlaubnis kann nur nach einem Tipp angefragt werden) */
function pushFragen() {
  if (!onlineAktiv || !mehr.verfuegbar || !profil.name || !pushFrageOffen()) return
  pushFrageMerken()
  window.setTimeout(() => show('push-frage', true), 350)
}
$('push-frage-ja').addEventListener('click', async () => {
  audio.click()
  show('push-frage', false)
  const r = await pushEinschalten()
  toast('gebiet', 'Benachrichtigungen', r === 'an' ? 'Eingeschaltet: Du wirst bei Einladungen benachrichtigt.' : r === 'verweigert' ? 'Nicht erlaubt. Du kannst es in den Optionen ändern.' : pushFehlerText())
  pushZeichnen()
})
$('push-frage-nein').addEventListener('click', () => {
  audio.click()
  show('push-frage', false)
})
$('push-knopf').addEventListener('click', async () => {
  audio.click()
  const r = await pushEinschalten()
  toast('gebiet', 'Einladungen aufs Handy', r === 'an' ? 'Eingeschaltet.' : r === 'verweigert' ? 'Nicht erlaubt. Du kannst es später in den Einstellungen ändern.' : pushFehlerText())
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
  gesperrteUids = new Set(sp.map((x) => x.user_id))
  sperrenZeichnen(sp)
  badgeZeichnen()
  const code = await meinCode()
  $('freund-code').textContent = code ?? '------'
  // Ohne Code steht der Spieler nicht in der Datenbank: sagen und "Neu verbinden" anbieten
  $('freund-code-fehlt').hidden = !!code || !profil.name
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
    drawSchlangeGerade(cv, skinVon(a.skin ?? 'klassik'), 0)
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
  if (sozialAbmelden || !onlineAktiv || !angemeldet()) return
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
  drawSchlangeGerade($<HTMLCanvasElement>('chat-skin'), skinVon(p.skin ?? 'klassik'), 0)
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
    drawSchlangeGerade(cv, skinVon(f.skin), 0)
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
  if (!raumAusLink || !angemeldet() || gesperrt) return
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

// Spielstand aus der Cloud uebernommen (anderes Geraet, Anmeldung): Startbildschirm und Online-Profil nachziehen
beiCloud(() => {
  if (mode === 'home') updateHome()
  setzeSkin(wallet.skin)
  setzeSilber(wallet.verdient ?? 0)
})
applySettings()
newDemo()
setMode('home')
if (!gesperrt) {
  zeigeWillkommen()
  linkRaum()
  if (angemeldet()) {
    void online?.start()
    void freundeLaden()
    sozialStarten()
    void pushAuffrischen()
  }
  // Den Skin dieses Geraets immer melden (frueher nur, wenn online noch keiner stand: dann blieb ein alter Skin fuer immer)
  setzeSkin(wallet.skin)
  setzeSilber(wallet.verdient ?? 0)
  requestAnimationFrame(frame)
  const dm = WIESE_MISSIONEN[devMission - 1]
  if (dm) newGame(false, false, 'normal', dm)
}
/** Nur beim Entwickeln: das laufende Spiel fuer die Konsole und Browser-Tests (window.spiel()) */
if (import.meta.env.DEV) Object.assign(window, { spiel: () => game })

// Service Worker nur im Browser (die Android-App hat alles dabei)
if (!nativ && import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      // Eine App, die lange im Hintergrund lag, holt sich sonst nie eine neue Version: beim Zurueckkehren und alle 30 Minuten
      // nachsehen, aber nur im Startmenue und nicht mitten im Spiel (die neue Version laedt die Seite neu)
      onRegisteredSW(_url, reg) {
        if (!reg) return
        const pruefen = () => {
          if (mode === 'home' || mode === 'over') void reg.update().catch(() => undefined)
        }
        window.setInterval(pruefen, 30 * 60_000)
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && pruefen())
      },
    }),
  )
}
