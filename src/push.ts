/**
 * Push-Einladungen in der App: Benachrichtigungen erlauben, Abo im Profil speichern, und Freunde
 * einladen (jeden Spieler), die die App gerade nicht offen haben (der Snake-Server schickt die Nachricht).
 * In der Android-APK gibt es kein Web-Push: dort nur Einladungen bei offener App.
 */
import { Capacitor } from '@capacitor/core'
import { pushSpeichern, zugangsToken } from './online'

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

/** Kann dieses Geraet ueberhaupt Push? (iPhone: nur als App vom Home-Bildschirm, ab iOS 16.4) */
export function pushMoeglich() {
  return !!VAPID && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

const AUS = 'snake.push.aus.v1'
const FRAGE = 'snake.pushfrage.v1'
const lies = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const schreib = (k: string, an: boolean) => {
  try {
    if (an) localStorage.setItem(k, '1')
    else localStorage.removeItem(k)
  } catch {
    /* Speicher blockiert: egal */
  }
}

/** Erlaubt und nicht von Hand ausgeschaltet */
export function pushErlaubt() {
  return pushMoeglich() && Notification.permission === 'granted' && !lies(AUS)
}

/** Soll beim ersten Besuch von Hall of Snakes oder Mehrspieler nach Benachrichtigungen gefragt werden? */
export const pushFrageOffen = () => pushMoeglich() && Notification.permission === 'default' && !lies(FRAGE)
export const pushFrageMerken = () => schreib(FRAGE, true)

function schluessel(s: string) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(t)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Benachrichtigungen einschalten (nach einem Tipp, sonst fragt der Browser nicht) */
export async function pushEinschalten(): Promise<'an' | 'verweigert' | 'fehler'> {
  if (!pushMoeglich()) return 'fehler'
  schreib(FRAGE, true)
  try {
    const erlaubt = await Notification.requestPermission()
    if (erlaubt !== 'granted') return 'verweigert'
    schreib(AUS, false)
    const reg = await navigator.serviceWorker.ready
    const alt = await reg.pushManager.getSubscription()
    const abo = alt ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluessel(VAPID).slice().buffer as ArrayBuffer }))
    return (await pushSpeichern(abo.toJSON())) ? 'an' : 'fehler'
  } catch {
    return 'fehler'
  }
}

/** Benachrichtigungen ausschalten: Abo kuendigen und aus dem Profil loeschen (die Erlaubnis im System bleibt) */
export async function pushAusschalten() {
  schreib(AUS, true)
  try {
    const reg = await navigator.serviceWorker.ready
    await (await reg.pushManager.getSubscription())?.unsubscribe()
  } catch {
    /* egal */
  }
  await pushSpeichern(null)
}

/** Beim Start: ist ein Abo da, im Profil auffrischen (es kann sich geaendert haben) */
export async function pushAuffrischen() {
  if (!pushErlaubt()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const abo = await reg.pushManager.getSubscription()
    if (abo) await pushSpeichern(abo.toJSON())
  } catch {
    /* egal */
  }
}

/** Spieler per Push einladen (Freund oder nicht). Gibt eine kurze Meldung zurueck */
export async function perPushEinladen(server: string, an: string, code: string, modus: string, vonName: string): Promise<{ ok: boolean; text: string }> {
  const token = await zugangsToken()
  if (!token || !server) return { ok: false, text: 'Keine Verbindung.' }
  try {
    const r = await fetch(`${server.replace(/\/$/, '')}/einladen`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ an, code, modus, vonName }),
    })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; grund?: string }
    if (d.ok) return { ok: true, text: 'Als Nachricht aufs Handy geschickt.' }
    const grund: Record<string, string> = {
      'kein Abo': 'Hat keine Benachrichtigungen an. Schick den Raum-Code.',
      'Abo abgelaufen': 'Benachrichtigungen sind abgelaufen. Schick den Raum-Code.',
      'zu oft': 'Gerade erst eingeladen, kurz warten.',
      'kein Zugriff': 'Einladen geht nicht (gesperrt oder nicht angemeldet).',
      'nicht eingerichtet': 'Push ist auf dem Server noch nicht eingerichtet.',
    }
    return { ok: false, text: grund[d.grund ?? ''] ?? 'Das hat nicht geklappt.' }
  } catch {
    return { ok: false, text: 'Keine Verbindung.' }
  }
}
