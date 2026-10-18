/**
 * Installationspflicht: Auf iPhone und Android im Browser gibt es statt des Spiels nur eine
 * bebilderte Anleitung, wie man Snake auf den Home-Bildschirm holt. Erst die installierte App
 * (und die APK) startet das Spiel. Am Computer gibt es keine Pflicht.
 */
import { Capacitor } from '@capacitor/core'
import { APK_URL } from './update'

export type Plattform = 'ios' | 'android'

/** Gerät aus Browserkennung erkennen (iPadOS meldet sich als Mac mit Touch) */
export function erkenne(ua: string, platform = '', touchPunkte = 0): Plattform | null {
  if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPunkte > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

/** Unter iOS: Läuft die Seite nicht in Safari (Chrome, Firefox, Instagram, WhatsApp ...)? */
export const keinSafari = (ua: string) => /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|Snapchat|MicroMessenger|GSA\/|Twitter/.test(ua)

const plattform = () => erkenne(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)

/** Läuft Snake schon als App (Home-Bildschirm, installierte Web-App, APK)? */
export function istInstalliert(): boolean {
  if (Capacitor.isNativePlatform()) return true
  const mq = (q: string) => window.matchMedia(q).matches
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    mq('(display-mode: standalone)') ||
    mq('(display-mode: fullscreen)') ||
    mq('(display-mode: minimal-ui)') ||
    document.referrer.startsWith('android-app://')
  )
}

/** Muss statt des Spiels die Anleitung erscheinen? (Nur im fertigen Build; `?browser=1` überspringt sie zum Testen.) */
export function installPflicht(): boolean {
  if (!import.meta.env.PROD || new URLSearchParams(location.search).has('browser')) return false
  return plattform() !== null && !istInstalliert()
}

/* ---------------- Bilder (Handy-Ausschnitte als SVG) ---------------- */

const C = { bg: '#171513', karte: '#33302d', hoch: '#3d3935', creme: '#f5efe6', leise: '#cbbfb1', orange: '#f29a4c', rot: '#e5463b' }
const svg = (inhalt: string) =>
  `<svg viewBox="30 0 240 150" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif" font-size="11" fill="none" stroke-linecap="round" stroke-linejoin="round">${inhalt}</svg>`
const text = (x: number, y: number, t: string, f = C.creme, anker = 'start', gross = 11) =>
  `<text x="${x}" y="${y}" fill="${f}" stroke="none" text-anchor="${anker}" font-size="${gross}">${t}</text>`
/** Orangener, pulsierender Ring um das, was man antippen soll */
const ring = (x: number, y: number, w: number, h: number, r = 10) =>
  `<rect class="puls" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" stroke="${C.orange}" stroke-width="2.5"/>`
const phone = (inhalt: string) => `<rect x="30" y="-20" width="240" height="190" rx="26" fill="${C.karte}" stroke="${C.hoch}" stroke-width="3"/>${inhalt}`
const seite = (y: number) =>
  `<circle cx="150" cy="${y}" r="15" fill="${C.rot}" stroke="none"/><path d="M150 ${y - 14} q4 -9 11 -9" stroke="#8fd6bd" stroke-width="3"/>${text(150, y + 33, 'Snake', C.creme, 'middle', 13)}`
/** Adresse für das Bild der Chrome-Adresszeile (im Testlauf gibt es keinen Browser) */
const ADRESSE = typeof location === 'undefined' ? 'snake' : location.host || 'snake'
const symbol = (x: number, y: number, s: number) => `<image href="./icons/icon-192.png" x="${x}" y="${y}" width="${s}" height="${s}"/>`

/** Home-Bildschirm mit dem Snake-Symbol (zweite Reihe, zweites Feld) */
const homeBild = svg(
  phone(
    [24, 84]
      .map((y, r) =>
        [69, 123, 177, 231]
          .map((x, c) => (r === 1 && c === 1 ? '' : `<rect x="${x - 17}" y="${y - 17}" width="34" height="34" rx="9" fill="${C.hoch}" stroke="none"/>`))
          .join(''),
      )
      .join('') +
      symbol(106, 67, 34) +
      text(123, 118, 'Snake', C.creme, 'middle') +
      ring(101, 62, 44, 62, 12),
  ),
)

const IOS = [
  {
    titel: 'Teilen-Symbol antippen',
    text: 'Unten in der Leiste von Safari auf das Quadrat mit dem Pfeil nach oben tippen.',
    bild: svg(
      phone(
        seite(46) +
          `<rect x="30" y="100" width="240" height="60" fill="${C.hoch}" stroke="none"/>` +
          `<g stroke="${C.leise}" stroke-width="2.2"><path d="M60 114 l-8 8 8 8"/><path d="M100 114 l8 8 -8 8"/><path d="M144 119 h-5 v20 h22 v-20 h-5"/><path d="M150 130 v-17 M144 119 l6 -6 6 6"/><path d="M192 115 h16 v16 h-16 z M200 115 v16"/><path d="M240 117 h14 v14 h-14 z"/></g>` +
          ring(130, 104, 40, 40, 20),
      ),
    ),
  },
  {
    titel: '„Zum Home-Bildschirm“ wählen',
    text: 'Das Menü ein Stück nach oben wischen, bis „Zum Home-Bildschirm“ erscheint, und antippen.',
    bild: svg(
      phone(
        `<rect x="38" y="6" width="224" height="150" rx="16" fill="${C.hoch}" stroke="none"/>` +
          symbol(50, 14, 22) + text(80, 29, 'Snake', C.creme, 'start', 12) +
          `<rect x="50" y="42" width="200" height="28" rx="8" fill="${C.karte}" stroke="none"/>${text(62, 60, 'Kopieren', C.leise)}` +
          `<rect x="50" y="76" width="200" height="30" rx="8" fill="${C.karte}" stroke="none"/>${text(62, 95, 'Zum Home-Bildschirm')}<rect x="226" y="83" width="16" height="16" rx="4" stroke="${C.creme}" stroke-width="2"/><path d="M234 87 v8 M230 91 h8" stroke="${C.creme}" stroke-width="2"/>` +
          `<rect x="50" y="112" width="200" height="28" rx="8" fill="${C.karte}" stroke="none"/>${text(62, 130, 'Zur Leseliste', C.leise)}` +
          ring(46, 73, 208, 36, 11),
      ),
    ),
  },
  {
    titel: 'Hinzufügen',
    text: 'Oben rechts auf „Hinzufügen“ tippen. Der Name „Snake“ passt schon.',
    bild: svg(
      phone(
        `<rect x="38" y="6" width="224" height="146" rx="16" fill="${C.hoch}" stroke="none"/>` +
          text(52, 30, 'Abbrechen', C.leise) + text(250, 30, 'Hinzufügen', C.orange, 'end', 12) +
          symbol(52, 56, 48) +
          `<rect x="112" y="58" width="140" height="32" rx="8" fill="${C.karte}" stroke="none"/>${text(124, 79, 'Snake')}` +
          `<rect x="52" y="112" width="200" height="22" rx="6" fill="${C.karte}" stroke="none"/>${text(62, 127, 'Öffnet wie eine App im Vollbild', C.leise, 'start', 10)}` +
          ring(190, 14, 66, 26, 13),
      ),
    ),
  },
  { titel: 'Snake vom Home-Bildschirm öffnen', text: 'Ab jetzt startest du Snake über das neue Symbol. Nicht mehr über Safari.', bild: homeBild },
]

const ANDROID = [
  {
    titel: 'Menü öffnen',
    text: 'In Chrome oben rechts auf die drei Punkte tippen.',
    bild: svg(
      phone(
        `<rect x="30" y="-20" width="240" height="58" fill="${C.hoch}" stroke="none"/>` +
          `<rect x="46" y="8" width="176" height="22" rx="11" fill="${C.karte}" stroke="none"/>${text(62, 23, ADRESSE, C.leise, 'start', 10)}` +
          `<g fill="${C.creme}" stroke="none"><circle cx="246" cy="12" r="2.3"/><circle cx="246" cy="19" r="2.3"/><circle cx="246" cy="26" r="2.3"/></g>` +
          seite(88) +
          ring(230, 4, 32, 32, 16),
      ),
    ),
  },
  {
    titel: '„App installieren“ wählen',
    text: 'Antippen. Heißt es bei dir „Zum Startbildschirm hinzufügen“, nimm diesen Punkt.',
    bild: svg(
      phone(
        `<rect x="110" y="6" width="150" height="144" rx="12" fill="${C.hoch}" stroke="none"/>` +
          text(124, 28, 'Neuer Tab', C.leise) + text(124, 52, 'Neuer Inkognito-Tab', C.leise) +
          `<rect x="116" y="64" width="138" height="30" rx="8" fill="${C.karte}" stroke="none"/>${text(124, 83, 'App installieren')}` +
          text(124, 116, 'Lesezeichen', C.leise) + text(124, 138, 'Einstellungen', C.leise) +
          ring(112, 61, 146, 36, 11),
      ),
    ),
  },
  {
    titel: 'Installieren bestätigen',
    text: 'Im Fenster auf „Installieren“ tippen.',
    bild: svg(
      phone(
        `<rect x="52" y="14" width="196" height="122" rx="16" fill="${C.hoch}" stroke="none"/>` +
          text(150, 40, 'App installieren?', C.creme, 'middle', 13) +
          symbol(76, 56, 36) + text(124, 79, 'Snake') +
          text(120, 124, 'Abbrechen', C.leise, 'end') +
          `<rect x="132" y="104" width="104" height="28" rx="14" fill="${C.orange}" stroke="none"/>${text(184, 123, 'Installieren', C.bg, 'middle', 12)}` +
          ring(128, 100, 112, 36, 18),
      ),
    ),
  },
  { titel: 'Snake vom Startbildschirm öffnen', text: 'Ab jetzt startest du Snake über das neue Symbol. Nicht mehr über den Browser.', bild: homeBild },
]

/* ---------------- Seite ---------------- */

type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function zeigeInstallation(root: HTMLElement) {
  const start = plattform() ?? 'android'
  let aktiv: Plattform = start
  let angebot: BeforeInstall | null = null
  let fertig = false
  const ua = navigator.userAgent

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('?')[0])
      return true
    } catch {
      return false
    }
  }

  function zeichne() {
    const schritte = aktiv === 'ios' ? IOS : ANDROID
    const warnung =
      aktiv === 'ios' && start === 'ios' && keinSafari(ua)
        ? `<div class="install__warn"><b>Öffne diesen Link in Safari.</b> Nur dort gibt es „Zum Home-Bildschirm“ für Snake. Kopiere den Link, öffne Safari und füge ihn dort ein.<button class="btn btn--ghost btn--klein" data-kopieren>Link kopieren</button></div>`
        : aktiv === 'android' && /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|GSA\//.test(ua)
          ? `<div class="install__warn"><b>Öffne diesen Link in Chrome.</b> Aus dieser App heraus lässt sich Snake nicht installieren.<button class="btn btn--ghost btn--klein" data-kopieren>Link kopieren</button></div>`
          : ''
    const knopf =
      aktiv === 'android' && angebot && !fertig
        ? `<button class="btn btn--play" data-jetzt>Jetzt installieren</button>`
        : ''
    root.innerHTML = `
      <div class="install__inner">
        <img class="install__logo" src="./icons/icon-192.png" alt="" width="72" height="72" />
        <h1>Snake auf dein Handy holen</h1>
        <p class="install__sub">Snake läuft als App: im Vollbild, auch ohne Internet, und neue Versionen kommen von selbst. Dafür einmal auf den ${aktiv === 'ios' ? 'Home-Bildschirm' : 'Startbildschirm'} legen. Das dauert 20 Sekunden.</p>
        ${fertig ? `<div class="install__ok"><b>Fertig!</b> Öffne jetzt „Snake“ von deinem Startbildschirm. Dieses Browserfenster kannst du schließen.</div>` : ''}
        <div class="seg seg--2" role="radiogroup" aria-label="Gerät">
          <button data-p="ios" role="radio" aria-checked="${aktiv === 'ios'}">iPhone</button>
          <button data-p="android" role="radio" aria-checked="${aktiv === 'android'}">Android</button>
        </div>
        ${warnung}
        ${knopf}
        <ol class="install__schritte">
          ${schritte
            .map((s, i) => `<li><div class="install__bild">${s.bild}</div><div class="install__txt"><b>${i + 1}. ${s.titel}</b><span>${s.text}</span></div></li>`)
            .join('')}
        </ol>
        ${aktiv === 'android' ? `<p class="fine">Lieber eine Datei? <a href="${APK_URL}">Android-App (APK) laden</a>. Beim ersten Mal musst du „Installation aus unbekannten Quellen“ erlauben.</p>` : ''}
        <p class="fine">Tipp: Nach der Installation fragt Snake nach deinem Namen für die Bestenliste.</p>
      </div>`
    root.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        aktiv = b.dataset.p as Plattform
        zeichne()
      }),
    )
    root.querySelector<HTMLButtonElement>('[data-kopieren]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement
      b.textContent = (await kopieren()) ? 'Kopiert' : location.href.split('?')[0]
    })
    root.querySelector<HTMLButtonElement>('[data-jetzt]')?.addEventListener('click', async () => {
      if (!angebot) return
      await angebot.prompt()
      const { outcome } = await angebot.userChoice
      angebot = null
      if (outcome === 'accepted') fertig = true
      zeichne()
    })
  }

  // Chrome auf Android bietet die Installation per Knopf an
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    angebot = e as BeforeInstall
    zeichne()
  })
  window.addEventListener('appinstalled', () => {
    fertig = true
    zeichne()
  })

  root.hidden = false
  document.documentElement.setAttribute('data-install', '')
  zeichne()
}
