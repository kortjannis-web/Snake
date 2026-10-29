/**
 * Benachrichtigungen (Einladungen zum Kampf, private Nachrichten, Weltchat): erlauben, Abo im Profil speichern,
 * und dem Snake-Server sagen, dass er jemanden benachrichtigen soll, der die App gerade nicht offen hat.
 * Web-App (Android-Chrome, iPhone vom Home-Bildschirm ab iOS 16.4): Web Push mit VAPID-Schluessel.
 * Android-App (APK): Firebase Cloud Messaging, nur wenn sie mit google-services.json gebaut wurde (VITE_FCM=1).
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { pushSpeichern, zugangsToken } from './online'

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''
/** Android-App mit Firebase gebaut? Ohne google-services.json wuerde das Anmelden bei Firebase die App abstuerzen lassen */
const FCM = import.meta.env.VITE_FCM === '1'
const nativ = Capacitor.isNativePlatform()
const nativPush = nativ && Capacitor.getPlatform() === 'android' && FCM

/** Kann dieses Geraet ueberhaupt Push? (iPhone: nur als App vom Home-Bildschirm, ab iOS 16.4) */
export function pushMoeglich() {
  if (nativ) return nativPush
  return !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Warum Push hier nicht geht: Schluessel beim Bauen fehlt, Android-App ohne Firebase oder Browser kann es nicht. null: geht */
export function pushGrund(): 'schluessel' | 'app' | 'browser' | null {
  if (nativ) return nativPush ? null : 'app'
  if (!VAPID) return 'schluessel'
  return pushMoeglich() ? null : 'browser'
}

/** Letzter Fehler von pushEinschalten, fuer die Meldung (damit man sieht, woran es liegt) */
export let pushFehler = ''

const AUS = 'snake.push.aus.v1'
/** v2 (1.55): alle werden noch einmal gefragt, jetzt auch fuer Nachrichten und Weltchat */
const FRAGE = 'snake.pushfrage.v2'
/** Android-App: Erlaubnis erteilt (das System fragt man nur asynchron, die Anzeige braucht es sofort) */
const NATIV = 'snake.push.nativ.v1'
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
  if (!pushMoeglich() || lies(AUS)) return false
  return nativ ? lies(NATIV) : Notification.permission === 'granted'
}

/** Im System blockiert (dann hilft nur die Einstellung des Handys) */
export const pushBlockiert = () => pushMoeglich() && !nativ && Notification.permission === 'denied'

/** Einmal fragen, ob Benachrichtigungen an sollen (nicht, wenn sie schon an sind oder blockiert) */
export const pushFrageOffen = () => pushMoeglich() && !pushErlaubt() && !pushBlockiert() && !lies(FRAGE)
export const pushFrageMerken = () => schreib(FRAGE, true)

/** Android-App: Geraete-Token von Firebase holen (kommt als Ereignis zurueck) */
function nativToken(): Promise<string> {
  return new Promise((ok, nein) => {
    let fertig = false
    const zeit = setTimeout(() => !fertig && nein(new Error('Firebase antwortet nicht')), 15_000)
    void PushNotifications.addListener('registration', (t) => {
      fertig = true
      clearTimeout(zeit)
      ok(t.value)
    })
    void PushNotifications.addListener('registrationError', (f) => {
      fertig = true
      clearTimeout(zeit)
      nein(new Error(f.error))
    })
    void PushNotifications.register().catch(nein)
  }).finally(() => void PushNotifications.removeAllListeners().then(() => tippHoeren())) as Promise<string>
}

/** Android-App: Tipp auf eine Benachrichtigung (App war zu oder im Hintergrund) */
let beiTipp: ((d: PushTipp) => void) | null = null
export type PushTipp = { art: string; code: string; von: string; vonName: string }
function tippHoeren() {
  if (!nativPush || !beiTipp) return
  void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
    const d = (a.notification.data ?? {}) as Partial<PushTipp>
    beiTipp?.({ art: d.art ?? '', code: d.code ?? '', von: d.von ?? '', vonName: d.vonName ?? '' })
  })
}
/** Was passieren soll, wenn jemand auf eine Benachrichtigung tippt (Web-App: ueber den Service Worker, siehe main.ts) */
export function beiPushTipp(f: (d: PushTipp) => void) {
  beiTipp = f
  tippHoeren()
}

function schluessel(s: string) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(t)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Benachrichtigungen einschalten (nach einem Tipp, sonst fragt der Browser nicht) */
export async function pushEinschalten(): Promise<'an' | 'verweigert' | 'fehler'> {
  pushFehler = ''
  if (!pushMoeglich()) {
    pushFehler = pushGrund() ?? 'nicht möglich'
    return 'fehler'
  }
  schreib(FRAGE, true)
  if (nativ) {
    try {
      const r = await PushNotifications.requestPermissions()
      if (r.receive !== 'granted') return 'verweigert'
      await PushNotifications.createChannel({ id: 'snake', name: 'Snake', description: 'Einladungen, Nachrichten und Weltchat', importance: 4, visibility: 1 }).catch(() => undefined)
      const token = await nativToken()
      schreib(NATIV, true)
      schreib(AUS, false)
      pushFehler = (await pushSpeichern({ fcm: token } as PushSubscriptionJSON)) ?? ''
      return pushFehler ? 'fehler' : 'an'
    } catch (e) {
      pushFehler = e instanceof Error ? e.message : String(e)
      return 'fehler'
    }
  }
  try {
    const erlaubt = await Notification.requestPermission()
    if (erlaubt !== 'granted') return 'verweigert'
    schreib(AUS, false)
    const reg = await navigator.serviceWorker.ready
    const alt = await reg.pushManager.getSubscription()
    const abo = alt ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluessel(VAPID).slice().buffer as ArrayBuffer }))
    pushFehler = (await pushSpeichern(abo.toJSON())) ?? ''
    return pushFehler ? 'fehler' : 'an'
  } catch (e) {
    pushFehler = e instanceof Error ? e.message : String(e)
    return 'fehler'
  }
}

/** Benachrichtigungen ausschalten: Abo kuendigen und aus dem Profil loeschen (die Erlaubnis im System bleibt) */
export async function pushAusschalten() {
  schreib(AUS, true)
  if (nativ) {
    await PushNotifications.unregister().catch(() => undefined)
    await pushSpeichern(null)
    return
  }
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
  if (nativ) {
    try {
      await pushSpeichern({ fcm: await nativToken() } as PushSubscriptionJSON)
    } catch {
      /* egal */
    }
    return
  }
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

/**
 * Dem Snake-Server sagen: zu dieser eben geschickten Nachricht bitte benachrichtigen (privat: den Freund, Weltchat: alle,
 * die es an haben). ohne: wer gerade online ist, sieht es ohnehin. Klappt es nicht, bleibt es still (die Nachricht ist ja da)
 */
export async function nachrichtMelden(server: string, art: 'nachricht' | 'welt', id: number, ohne: string[] = []) {
  if (!server) return
  const token = await zugangsToken()
  if (!token) return
  // Weltchat: je Aufruf bis zu 40 Empfaenger, so oft, bis alle dran waren (hoechstens 25 Runden = 1000)
  for (let runde = 0; runde < (art === 'welt' ? 25 : 1); runde++) {
    try {
      const r = await fetch(`${server.replace(/\/$/, '')}/melden`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ art, id, ohne }),
      })
      const d = (await r.json().catch(() => ({}))) as { weiter?: boolean }
      if (!d.weiter) return
    } catch {
      return
    }
  }
}

