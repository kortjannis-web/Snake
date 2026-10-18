/**
 * Oberflaeche fuer den Mehrspieler: Raum erstellen/beitreten, Lobby, Anzeige im Spiel
 * (Leben, Lebensleiste, Countdown, Meldungen) und Ergebnis. main.ts reicht nur Frame und Wischer durch.
 */
import { abstandGrenze, JAGD_MS, type Modus, type SpielerInfo } from '../game/mehr'
import type { Cause, Dir, GameEvent } from '../game/types'
import type { Renderer } from '../render/renderer'
import { drawSkinVorschau, skinVon } from '../render/skins'
import { setIcon } from '../ui/icons'
import { MehrClient, type ClientEreignis, type RaumInfo } from './client'
import { codeGueltig, neuerCode } from './protokoll'

export const SERVER = (import.meta.env.VITE_SNAKE_SERVER as string | undefined) ?? ''

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T

/** Ersatzfarben, wenn zwei denselben Skin tragen */
const ERSATZ = ['klassik', 'ozean', 'sonne', 'pink', 'orange', 'tuerkis', 'flieder', 'koralle']

/** Skin je Spieler, ohne doppelte (auf allen Geraeten gleich: wer weiter vorn steht, behaelt seinen) */
export function anzeigeSkins(spieler: { skin: string }[]): string[] {
  const vergeben = new Set<string>()
  return spieler.map((s) => {
    let id = skinVon(s.skin).id
    if (vergeben.has(id)) id = ERSATZ.find((e) => !vergeben.has(e)) ?? id
    vergeben.add(id)
    return id
  })
}

const MODUS_TEXT: Record<Modus, string> = {
  vs: 'Alle auf einem Feld, jeder hat 3 Leben. Wer 5 Äpfel hinter dem Führenden liegt, ist raus.',
  rennen: 'Jeder in seiner eigenen Welt, die anderen als Geist. 3 Leben, 5 Äpfel Abstand.',
  koop: 'Zusammen auf einem Feld, 3 gemeinsame Leben, Äpfel zählen für alle.',
  jagd: '3 Minuten, wer die meisten Äpfel hat, gewinnt. Unendlich Leben, aber jeder Tod kostet 3 Äpfel.',
  royale: 'Größere Karte, 3 Leben. Nach 20 s rückt alle 12 s die Zone vom Rand zu. Der Letzte gewinnt.',
}

export type MehrApi = {
  renderer: Renderer
  audio: {
    click(): void
    eat(level: number): void
    die(cause: Cause): void
    expand(): void
    wahl(): void
    power(): void
    powerEnde(): void
    schild(): void
    record(): void
    music(on: boolean, ruhig: boolean): void
    unlock(): void
  }
  haptic: { light(): void; medium(): void; heavy(): void; success(): void }
  /** In den Mehrspieler-Spielmodus wechseln oder zurueck ins Startmenue */
  modus: (m: 'mehr' | 'home') => void
  seiteOeffnen: (p: 'mehr') => void
  seitenZu: () => void
  toast: (titel: string, text: string) => void
  ichInfo: () => SpielerInfo
  /** Raum oder Spielerliste hat sich geaendert (z. B. Online-Liste neu zeichnen) */
  raumGeaendert?: () => void
}

/** Feste Geraete-Kennung fuer Raeume (bleibt, solange der Speicher bleibt) */
export function geraetId(): string {
  const k = 'snake.geraet.v1'
  try {
    const alt = localStorage.getItem(k)
    if (alt) return alt
    const neu = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(k, neu)
    return neu
  } catch {
    return `g${Math.random().toString(36).slice(2, 12)}`
  }
}

export function mehrspieler(api: MehrApi) {
  const client = new MehrClient(SERVER, api.ichInfo, ereignis)
  let imSpiel = false
  let letzteAnzeige = 0
  let letzterCountdown = -1
  let meldungBis = 0
  /** Skins im laufenden Spiel (ohne doppelte) und der eigene, der danach wieder gilt */
  let skins: string[] = []
  let eigenerSkin = api.renderer.skin

  /* ================= Ereignisse vom Client ================= */

  function ereignis(e: ClientEreignis) {
    switch (e.art) {
      case 'raum':
        lobbyZeichnen(e.raum)
        api.raumGeaendert?.()
        if (e.raum.phase === 'lobby' && imSpiel) zurueckInDieLobby()
        return
      case 'start':
        imSpiel = true
        skins = anzeigeSkins(e.info.spieler)
        eigenerSkin = api.renderer.skin
        api.renderer.skin = skinVon(skins[client.ich] ?? e.info.spieler[client.ich]?.skin ?? 'klassik')
        letzterCountdown = -1
        api.seitenZu()
        $('mehr-ende').removeAttribute('data-open')
        api.renderer.reset()
        api.modus('mehr')
        $('mehr-hud').hidden = false
        anzeige(true)
        return
      case 'spiel':
        return spielEreignis(e.e)
      case 'raus': {
        const s = client.start?.spieler[e.wer]
        if (!s) return
        if (e.wer === client.ich) meldung(e.grund === 'abstand' ? 'Zu weit hinten: du bist raus und schaust zu.' : 'Keine Leben mehr: du bist raus und schaust zu.', 5000)
        else api.toast(`${s.name} ist raus`, e.grund === 'abstand' ? 'Zu weit hinten' : 'Keine Leben mehr')
        return
      }
      case 'ende':
        return endeZeigen()
      case 'fehler':
        api.toast('Mehrspieler', e.text)
        $('mehr-hinweis').textContent = e.text
        return
      case 'verbindung':
        $('mehr-live').hidden = !e.ok
        if (!e.ok && imSpiel) meldung('Verbindung weg, verbinde neu …', 4000)
        return
      case 'verlassen':
        imSpiel = false
        api.renderer.mehr = null
        api.renderer.skin = eigenerSkin
        $('mehr-hud').hidden = true
        $('mehr-countdown').hidden = true
        $('mehr-meldung').hidden = true
        $('mehr-ende').removeAttribute('data-open')
        $('mehr-start').hidden = false
        $('mehr-raum').hidden = true
        $('mehr-live').hidden = true
        api.modus('home')
        api.raumGeaendert?.()
        return
    }
  }

  /** Index der eigenen Schlange in den Spiel-Ereignissen */
  const meinIndex = () => (client.start?.modus === 'rennen' ? 0 : client.ich)

  function spielEreignis(e: GameEvent & { wer?: number }) {
    const g = client.game
    if (!g) return
    api.renderer.event(e, g)
    const mein = e.wer === undefined || e.wer === meinIndex()
    switch (e.type) {
      case 'eat':
        if (mein) {
          api.audio.eat(e.level)
          api.haptic.light()
        }
        break
      case 'die':
        if (mein) {
          api.audio.die(e.cause)
          api.haptic.heavy()
        }
        break
      case 'expand':
        api.audio.expand()
        break
      case 'wahl':
        if (e.offen > 0 && mein) {
          api.audio.wahl()
          api.toast('Du darfst erweitern', 'Fahr gegen eine leuchtende Wand')
        }
        break
      case 'power':
        if (mein) api.audio.power()
        break
      case 'powerEnde':
        if (mein) api.audio.powerEnde()
        break
      case 'schild':
        if (mein) api.audio.schild()
        break
      case 'zurueck':
        if (mein) api.haptic.success()
        break
      case 'zone':
        api.audio.powerEnde()
        api.haptic.medium()
        break
      case 'duell': {
        const name = (i: number) => client.start?.spieler[i]?.name ?? '?'
        const ich = meinIndex()
        if (e.an === ich) api.toast(e.art === 'schere' ? `${name(e.von)} hat dich gekürzt` : `${name(e.von)} bremst euch aus`, e.art === 'schere' ? `−${e.weg} Glieder` : 'Zeitlupe für alle anderen')
        else if (e.von === ich) api.toast(e.art === 'schere' ? `${name(e.an)} gekürzt` : 'Alle anderen sind langsamer', e.art === 'schere' ? `−${e.weg} Glieder` : '')
        break
      }
      case 'raus':
        // Gegeneinander/Koop: kommt vom Rechner mit den Spiel-Ereignissen
        if (client.start?.modus !== 'rennen') ereignis({ art: 'raus', wer: e.wer, grund: e.grund })
        break
    }
  }

  /* ================= Lobby ================= */

  function lobbyZeichnen(r: RaumInfo) {
    $('mehr-start').hidden = true
    $('mehr-raum').hidden = false
    $('mehr-live').hidden = !client.verbunden
    $('mehr-code-anzeige').textContent = r.code
    const box = $('mehr-spieler')
    box.replaceChildren()
    r.spieler.forEach((s, i) => {
      const el = document.createElement('div')
      el.className = i === r.ich ? 'mehr-zeile mehr-zeile--ich' : 'mehr-zeile'
      const cv = document.createElement('canvas')
      cv.width = 112
      cv.height = 80
      const name = document.createElement('span')
      name.className = 'mehr-zeile__name'
      name.textContent = s.name + (i === r.ich ? ' (du)' : '')
      const tag = document.createElement('span')
      if (s.id === r.gastgeber) {
        tag.className = 'mehr-tag'
        tag.textContent = 'Gastgeber'
      } else if (!s.online) {
        tag.className = 'mehr-tag mehr-tag--aus'
        tag.textContent = 'weg'
      } else {
        tag.className = s.bereit ? 'mehr-tag mehr-tag--bereit' : 'mehr-tag mehr-tag--aus'
        tag.textContent = s.bereit ? 'bereit' : 'wartet'
      }
      el.append(cv, name, tag)
      box.append(el)
      drawSkinVorschau(cv, skinVon(s.skin), 0)
    })
    for (const b of $('mehr-modus').querySelectorAll<HTMLButtonElement>('button')) {
      b.setAttribute('aria-checked', String(b.dataset.v === r.modus))
      b.disabled = !client.gastgeber
    }
    $('mehr-modus-text').textContent = MODUS_TEXT[r.modus]
    for (const b of $('mehr-tempo').querySelectorAll<HTMLButtonElement>('button')) {
      b.setAttribute('aria-checked', String(b.dataset.v === r.tempo))
      b.disabled = !client.gastgeber
    }
    const kl = $<HTMLInputElement>('mehr-klassisch')
    kl.checked = r.klassisch
    kl.disabled = !client.gastgeber
    const online = r.spieler.filter((s) => s.online)
    const wartet = online.filter((s) => !s.bereit)
    const los = $<HTMLButtonElement>('mehr-los')
    los.hidden = !client.gastgeber
    los.disabled = online.length < 2 || wartet.length > 0 || r.phase !== 'lobby'
    const ich = r.spieler[r.ich]
    const bereit = $<HTMLButtonElement>('mehr-bereit')
    bereit.hidden = client.gastgeber
    bereit.textContent = ich?.bereit ? 'Doch nicht bereit' : 'Bereit'
    bereit.classList.toggle('btn--ghost', !!ich?.bereit)
    bereit.classList.toggle('btn--play', !ich?.bereit)
    $('mehr-hinweis').textContent = client.gastgeber
      ? online.length < 2
        ? 'Teile den Code oder lade jemanden ein. Ab 2 Spielern kannst du starten.'
        : wartet.length
          ? `Warte auf: ${wartet.map((s) => s.name).join(', ')}`
          : `Alle ${online.length} bereit. Los geht's!`
      : ich?.bereit
        ? 'Du bist bereit. Der Gastgeber startet.'
        : 'Tippe auf „Bereit“, wenn du mitspielen willst.'
  }

  function zurueckInDieLobby() {
    imSpiel = false
    api.renderer.mehr = null
    api.renderer.skin = eigenerSkin
    $('mehr-hud').hidden = true
    $('mehr-countdown').hidden = true
    $('mehr-meldung').hidden = true
    $('mehr-ende').removeAttribute('data-open')
    api.modus('home')
    api.seiteOeffnen('mehr')
  }

  function beitreten(code: string) {
    if (!SERVER) return
    $('mehr-hinweis').textContent = ''
    client.verbinden(code)
  }

  $('mehr-erstellen').addEventListener('click', () => {
    api.audio.click()
    beitreten(neuerCode())
  })
  $<HTMLFormElement>('mehr-beitreten').addEventListener('submit', (e) => {
    e.preventDefault()
    const code = $<HTMLInputElement>('mehr-code').value.trim().toUpperCase()
    if (!codeGueltig(code)) {
      api.toast('Code prüfen', 'Der Code hat 5 Zeichen, zum Beispiel K7M2Q.')
      return
    }
    api.audio.click()
    $<HTMLInputElement>('mehr-code').blur()
    beitreten(code)
  })
  $('mehr-modus')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        api.audio.click()
        client.modus(b.dataset.v as Modus)
      }),
    )
  $('mehr-tempo')
    .querySelectorAll<HTMLButtonElement>('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        api.audio.click()
        client.einstellen({ tempo: b.dataset.v as 'langsam' | 'normal' | 'schnell' })
      }),
    )
  $<HTMLInputElement>('mehr-klassisch').addEventListener('change', (e) => {
    api.audio.click()
    client.einstellen({ klassisch: (e.target as HTMLInputElement).checked })
  })
  $('mehr-bereit').addEventListener('click', () => {
    api.audio.click()
    api.audio.unlock()
    const ich = client.raum?.spieler[client.raum.ich]
    client.bereit(!ich?.bereit)
  })
  $('mehr-los').addEventListener('click', () => {
    api.audio.click()
    api.audio.unlock()
    client.starten()
  })
  $('mehr-verlassen').addEventListener('click', () => {
    api.audio.click()
    client.verlassen()
  })
  $('mehr-teilen').addEventListener('click', async () => {
    const code = client.raum?.code
    if (!code) return
    const url = `${location.origin}${location.pathname}?raum=${code}`
    const text = `Spiel mit mir Snake! Raum-Code: ${code}`
    try {
      if (navigator.share) await navigator.share({ title: 'Snake', text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        api.toast('Kopiert', 'Code und Link sind in der Zwischenablage.')
      }
    } catch {
      /* abgebrochen */
    }
  })
  $('mehr-hud-weg').addEventListener('click', () => {
    if (confirm('Spiel verlassen?')) client.verlassen()
  })
  $('mehr-nochmal').addEventListener('click', () => {
    api.audio.click()
    client.nochmal()
  })
  $('mehr-ende-weg').addEventListener('click', () => {
    api.audio.click()
    client.verlassen()
  })

  /* ================= Im Spiel ================= */

  function meldung(text: string, ms = 2500) {
    const el = $('mehr-meldung')
    el.textContent = text
    el.hidden = false
    meldungBis = performance.now() + ms
  }

  /** Herzen, Lebensleiste, Countdown, Wartezeit nach dem Tod */
  function anzeige(sofort = false) {
    const jetzt = performance.now()
    const cd = client.countdown
    const cdEl = $('mehr-countdown')
    if (cd > 0) {
      cdEl.hidden = false
      if (cd !== letzterCountdown) {
        cdEl.textContent = String(cd)
        api.audio.click()
      }
    } else if (letzterCountdown > 0) {
      cdEl.textContent = 'Los!'
      setTimeout(() => (cdEl.hidden = true), 600)
    }
    letzterCountdown = cd
    if (!sofort && jetzt - letzteAnzeige < 120) return
    letzteAnzeige = jetzt
    const start = client.start
    const g = client.game
    if (!start || !g) return
    const staende = client.staende()
    const ich = client.ich
    const meine = client.meine()
    // Leben (Koop: gemeinsam), bei der Apfeljagd die Restzeit
    const leben = start.modus === 'koop' ? g.pool : (meine?.leben ?? 0)
    const lb = $('mehr-leben')
    lb.replaceChildren()
    const titel = document.createElement('b')
    titel.textContent = start.modus === 'koop' ? `Level ${g.level}` : `${meine?.aepfel ?? 0} Äpfel`
    lb.append(titel)
    if (start.modus === 'jagd') {
      const rest = Math.max(0, Math.ceil((JAGD_MS - g.time) / 1000))
      const uhr = document.createElement('b')
      uhr.className = rest <= 15 ? 'mehr-uhr mehr-uhr--knapp' : 'mehr-uhr'
      uhr.textContent = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`
      lb.append(uhr)
    } else
      for (let i = 0; i < 3; i++) {
        const h = document.createElement('span')
        if (i >= leben) h.className = 'leer'
        setIcon(h, 'Heart')
        lb.append(h)
      }
    // Lebensleiste (nicht im Koop)
    const box = $('mehr-leiste')
    box.replaceChildren()
    if (start.modus === 'jagd' || start.modus === 'royale') {
      // Rangliste nach Aepfeln (kein Ausscheiden durch Abstand)
      const best = Math.max(1, ...staende.map((s) => s.aepfel))
      for (const s of [...staende].sort((a, b) => b.aepfel - a.aepfel)) {
        const row = document.createElement('div')
        row.className = `reihe${s.raus ? ' reihe--raus' : ''}`
        row.innerHTML = '<span></span><i><em></em></i><b></b>'
        row.querySelector('span')!.textContent = s.wer === ich ? 'Du' : s.name
        ;(row.querySelector('em') as HTMLElement).style.transform = `scaleX(${s.aepfel / best})`
        row.querySelector('b')!.textContent = String(s.aepfel)
        box.append(row)
      }
    } else if (start.modus !== 'koop') {
      const im = staende.filter((s) => !s.raus)
      const best = Math.max(0, ...im.map((s) => s.aepfel))
      const grenze = abstandGrenze(best, staende.length)
      if (staende.length === 2) {
        const mich = staende[ich] ?? staende[0]
        const er = staende[1 - Math.max(0, ich)] ?? staende[1]
        const diff = Math.max(-grenze, Math.min(grenze, mich.aepfel - er.aepfel))
        const zug = document.createElement('div')
        zug.className = 'zug'
        const l = document.createElement('span')
        l.textContent = `${er.name} ${er.aepfel}`
        const bahn = document.createElement('div')
        bahn.className = 'zug__bahn'
        bahn.innerHTML = '<i class="zug__mitte"></i><i class="zug__punkt"></i>'
        ;(bahn.querySelector('.zug__punkt') as HTMLElement).style.left = `${50 + (diff / grenze) * 50}%`
        const r = document.createElement('span')
        r.textContent = `${mich.aepfel} Du`
        zug.append(l, bahn, r)
        box.append(zug)
      } else
        for (const s of staende) {
          const row = document.createElement('div')
          const luft = s.raus ? 0 : 1 - (best - s.aepfel) / grenze
          row.className = `reihe${s.raus ? ' reihe--raus' : luft <= 0.4 ? ' reihe--knapp' : ''}`
          row.innerHTML = '<span></span><i><em></em></i><b></b>'
          row.querySelector('span')!.textContent = s.wer === ich ? 'Du' : s.name
          ;(row.querySelector('em') as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, luft))})`
          row.querySelector('b')!.textContent = String(s.aepfel)
          box.append(row)
        }
    }
    // Tot: wann es weitergeht
    if (meine?.tot && !meine.raus && g.status === 'play' && jetzt > meldungBis - 2000) {
      const s = Math.max(0, Math.ceil((meine.zurueckBei - g.time) / 1000))
      meldung(s > 0 ? `Zurück in ${s} …` : 'Gleich geht es weiter …', 400)
    }
    if (jetzt > meldungBis) $('mehr-meldung').hidden = true
  }

  function endeZeigen() {
    const start = client.start
    const erg = client.ergebnis
    if (!start || !erg) return
    const staende = client.staende()
    const ich = client.ich
    const titel = $('mehr-ende-titel')
    const sub = $('mehr-ende-sub')
    if (start.modus === 'koop') {
      titel.textContent = 'Geschafft!'
      sub.textContent = `Zusammen bis Level ${client.game?.level ?? 1}.`
    } else if (erg.sieger === ich) {
      titel.textContent = 'Gewonnen!'
      sub.textContent = start.modus === 'jagd' ? `Mit ${staende[ich]?.aepfel ?? 0} Äpfeln vorn.` : 'Du warst die letzte Schlange.'
      api.audio.record()
    } else {
      const s = erg.sieger !== null ? start.spieler[erg.sieger] : null
      titel.textContent = s ? `${s.name} gewinnt` : start.modus === 'jagd' ? 'Unentschieden' : 'Vorbei'
      sub.textContent = s ? 'Nächstes Mal!' : 'Gleich viele Äpfel.'
    }
    const ol = $('mehr-rang')
    ol.replaceChildren()
    erg.reihenfolge.forEach((wer, platz) => {
      const p = start.spieler[wer]
      if (!p) return
      const li = document.createElement('li')
      li.innerHTML = '<b></b><span></span><small></small>'
      li.querySelector('b')!.textContent = String(platz + 1)
      li.querySelector('span')!.textContent = p.name + (wer === ich ? ' (du)' : '')
      li.querySelector('small')!.textContent = `${staende[wer]?.aepfel ?? 0} Äpfel`
      ol.append(li)
    })
    $('mehr-nochmal').hidden = !client.gastgeber
    $('mehr-warte').hidden = client.gastgeber
    setTimeout(() => $('mehr-ende').setAttribute('data-open', ''), 900)
  }

  /* ================= Fuer main.ts ================= */

  return {
    get aktiv() {
      return imSpiel
    },
    get verfuegbar() {
      return !!SERVER
    },
    /** Jeden Frame im Mehrspieler-Modus: rechnen und zeichnen */
    frame(dt: number) {
      client.frame(dt)
      const g = client.game
      if (!g) return
      const mi = meinIndex()
      const meine = client.meine()
      if (client.start?.modus !== 'rennen') g.wechsel(Math.max(0, mi))
      api.renderer.mehr = {
        andere: client.fremde().map((f) => ({ ...f, skin: skinVon(skins[f.wer] ?? f.skin) })),
        ichTot: !!meine && (meine.tot || meine.raus),
        wahlSichtbar: g.wahlSpieler === mi,
        zone: client.start?.modus === 'royale' ? g.zone() : undefined,
      }
      if (meine) g.deathAt = meine.deathAt
      api.renderer.draw(g)
      anzeige()
    },
    lenke(d: Dir) {
      client.lenke(d)
    },
    /** App im Hintergrund: wer rechnet, gibt an ein anderes Geraet ab */
    hintergrund() {
      client.abgeben()
    },
    beitreten(code: string) {
      if (codeGueltig(code)) {
        api.seiteOeffnen('mehr')
        beitreten(code)
      }
    },
    /** Raum (falls noch keiner) und Code fuer Einladungen */
    async raumFuerEinladung(): Promise<string | null> {
      if (!SERVER) return null
      if (!client.raum) beitreten(neuerCode())
      for (let i = 0; i < 40 && !client.raum; i++) await new Promise((r) => setTimeout(r, 100))
      return client.raum?.code ?? null
    },
    get raum() {
      return client.raum
    },
    client,
  }
}
