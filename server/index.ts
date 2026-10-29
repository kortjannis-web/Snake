/**
 * Snake-Server auf Cloudflare Workers. Jeder Raum (Code) ist ein eigenes Durable Object, alle Spieler
 * eines Raums landen also im selben Objekt. Die Spielregeln stehen in raum.ts.
 *
 * Verbindung: wss://<server>/raum/<CODE>?id=..&name=..&skin=..&v=<PROTOKOLL>
 */
import { DurableObject } from 'cloudflare:workers'
import { codeGueltig, PROTOKOLL } from '../src/multi/protokoll'
import { dienstkonto, fcmSenden } from './fcm'
import { pushSenden, type PushAbo } from './push'
import { RaumLogik, type Kanal } from './raum'

type Env = {
  RAUM: DurableObjectNamespace<Raum>
  /** Fuer Push-Einladungen (optional): Supabase-Projekt und VAPID-Schluessel */
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_KONTAKT?: string
  /** Fuer Benachrichtigungen an die Android-App (optional): Dienstkonto aus Firebase als JSON */
  FCM_DIENSTKONTO?: string
}

/** Gespeichertes Abo eines Spielers: Web Push (Web-App, iPhone) oder ein Geraete-Token der Android-App */
type Abo = (PushAbo & { fcm?: undefined }) | { fcm: string; endpoint?: undefined }
/** Inhalt einer Benachrichtigung. art: einladung (mit code), nachricht (von), welt */
type Inhalt = { titel: string; text: string; art: 'einladung' | 'nachricht' | 'welt'; tag: string; code?: string; von?: string; vonName?: string }

const aboGueltig = (a: Partial<Abo> | null | undefined): a is Abo => !!a && (typeof a.fcm === 'string' ? a.fcm.length > 10 : !!(a.endpoint && a.keys?.p256dh && a.keys?.auth))

/** Eine Benachrichtigung zustellen, je nach Abo ueber Web Push oder Firebase. Gibt den HTTP-Status zurueck (404/410: Abo weg) */
async function zustellen(abo: Abo, inhalt: Inhalt, env: Env): Promise<number> {
  if (abo.fcm !== undefined) {
    const konto = dienstkonto(env.FCM_DIENSTKONTO)
    if (!konto) return 501
    const daten: Record<string, string> = { art: inhalt.art, code: inhalt.code ?? '', von: inhalt.von ?? '', vonName: inhalt.vonName ?? '' }
    return fcmSenden(konto, abo.fcm, { titel: inhalt.titel, text: inhalt.text, tag: inhalt.tag, daten }).catch(() => 502)
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 501
  return pushSenden(abo, inhalt, { oeffentlich: env.VAPID_PUBLIC_KEY, privat: env.VAPID_PRIVATE_KEY, kontakt: env.VAPID_KONTAKT ?? 'https://github.com/kortjannis-web/Snake' }).catch(() => 502)
}

/** Ist ueberhaupt ein Weg fuer Benachrichtigungen eingerichtet? */
const pushEingerichtet = (env: Env) => !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && ((env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) || env.FCM_DIENSTKONTO))

/** Supabase-Funktion mit dem Token des Absenders aufrufen (Supabase prueft, ob er das darf) */
async function rpc(env: Env, token: string, fn: string, args: object): Promise<Response> {
  return fetch(`${env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY!, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (d: object, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const MODUS_NAME: Record<string, string> = { vs: 'Gegeneinander', rennen: 'Wettrennen', koop: 'Koop', jagd: 'Apfeljagd', royale: 'Schrumpfende Karte' }
/** Hoechstens eine Einladung je Absender und Empfaenger alle 10 s (je Server-Instanz) */
const zuletzt = new Map<string, number>()
/** Einladungen je Absender (Nutzer-Id aus dem Token) in der letzten Stunde */
const proStunde = new Map<string, number[]>()
const HOECHSTENS_PRO_STUNDE = 30
const jwtNutzer = (token: string) => {
  try {
    return String((JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string }).sub ?? '')
  } catch {
    return ''
  }
}

/**
 * Push-Einladung an einen Spieler, der die App gerade nicht offen hat. Der Absender schickt sein
 * Supabase-Token mit; Supabase gibt das Push-Abo nur heraus, wenn keiner den anderen gesperrt hat.
 */
async function einladen(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, grund: 'nur POST' }, 405)
  if (!pushEingerichtet(env)) return json({ ok: false, grund: 'nicht eingerichtet' }, 501)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  let d: { an?: string; code?: string; modus?: string; vonName?: string }
  try {
    d = await req.json()
  } catch {
    return json({ ok: false, grund: 'kaputt' }, 400)
  }
  const an = String(d.an ?? '')
  const code = String(d.code ?? '').toUpperCase()
  if (!token || !/^[0-9a-f-]{36}$/i.test(an) || !codeGueltig(code)) return json({ ok: false, grund: 'ungueltig' }, 400)
  const schluessel = `${token.slice(-24)}:${an}`
  if (Date.now() - (zuletzt.get(schluessel) ?? 0) < 10_000) return json({ ok: false, grund: 'zu oft' }, 429)
  zuletzt.set(schluessel, Date.now())
  if (zuletzt.size > 5000) zuletzt.clear()
  const r = await rpc(env, token, 'push_fuer', { ziel: an })
  if (!r.ok) return json({ ok: false, grund: 'kein Zugriff' }, 403)
  // Token ist gueltig (Supabase hat geantwortet): jetzt je Absender bremsen
  const sender = jwtNutzer(token)
  if (sender) {
    const jetzt = Date.now()
    const liste = (proStunde.get(sender) ?? []).filter((t) => jetzt - t < 3_600_000)
    if (liste.length >= HOECHSTENS_PRO_STUNDE) return json({ ok: false, grund: 'zu oft' }, 429)
    liste.push(jetzt)
    proStunde.set(sender, liste)
    if (proStunde.size > 5000) proStunde.clear()
  }
  const abo = (await r.json()) as Abo | null
  if (!aboGueltig(abo)) return json({ ok: false, grund: 'kein Abo' }, 404)
  const name = String(d.vonName ?? 'Jemand').slice(0, 16)
  const status = await zustellen(abo, { titel: `${name} lädt dich zum Kampf ein`, text: `${MODUS_NAME[String(d.modus)] ?? 'Mehrspieler'} · Raum ${code}`, art: 'einladung', tag: 'einladung', code, von: sender, vonName: name }, env)
  if (status === 501) return json({ ok: false, grund: 'nicht eingerichtet' }, 501)
  return json({ ok: status < 300, status, grund: status === 404 || status === 410 ? 'Abo abgelaufen' : undefined }, status < 300 ? 200 : 502)
}

/** Bremse fuer /melden: je Absender hoechstens 60 Aufrufe pro Minute (je Server-Instanz) */
const meldungen = new Map<string, number[]>()

/**
 * Benachrichtigung zu einer eben geschickten Nachricht: privat (an den Freund) oder im Weltchat (an alle, die es an haben,
 * hoechstens alle 10 Minuten je Spieler). Supabase gibt die Abos nur fuer eine frische eigene Nachricht und nur einmal heraus;
 * Text und Name kommen aus der Datenbank, nicht vom Absender. Weltchat: je Aufruf bis zu 40 Empfaenger, `weiter` sagt,
 * ob noch welche fehlen (dann ruft die App noch einmal auf).
 */
async function melden(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, grund: 'nur POST' }, 405)
  if (!pushEingerichtet(env)) return json({ ok: false, grund: 'nicht eingerichtet' }, 501)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  let d: { art?: string; id?: number; ohne?: unknown }
  try {
    d = await req.json()
  } catch {
    return json({ ok: false, grund: 'kaputt' }, 400)
  }
  const id = Number(d.id)
  if (!token || !Number.isSafeInteger(id) || id <= 0 || (d.art !== 'nachricht' && d.art !== 'welt')) return json({ ok: false, grund: 'ungueltig' }, 400)
  const sender = jwtNutzer(token)
  const jetzt = Date.now()
  const liste = (meldungen.get(sender) ?? []).filter((t) => jetzt - t < 60_000)
  if (liste.length >= 60) return json({ ok: false, grund: 'zu oft' }, 429)
  liste.push(jetzt)
  meldungen.set(sender, liste)
  if (meldungen.size > 5000) meldungen.clear()

  if (d.art === 'nachricht') {
    const r = await rpc(env, token, 'push_nachricht', { nid: id })
    if (!r.ok) return json({ ok: false, grund: 'kein Zugriff' }, 403)
    const z = (await r.json()) as { abo?: Abo; name?: string; text?: string } | null
    if (!z || !aboGueltig(z.abo)) return json({ ok: true, gesendet: 0 })
    const name = String(z.name ?? 'Jemand').slice(0, 16)
    const status = await zustellen(z.abo, { titel: name, text: String(z.text ?? ''), art: 'nachricht', tag: `chat-${sender}`, von: sender, vonName: name }, env)
    return json({ ok: true, gesendet: status < 300 ? 1 : 0 })
  }
  const ohne = Array.isArray(d.ohne) ? d.ohne.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500) : []
  const r = await rpc(env, token, 'push_welt', { nid: id, ohne })
  if (!r.ok) return json({ ok: false, grund: 'kein Zugriff' }, 403)
  const z = (await r.json()) as { abos?: Abo[]; fertig?: boolean; name?: string; text?: string } | null
  const abos = (z?.abos ?? []).filter(aboGueltig).slice(0, 40)
  const name = String(z?.name ?? 'Jemand').slice(0, 16)
  const inhalt: Inhalt = { titel: 'Weltchat', text: `${name}: ${String(z?.text ?? '')}`, art: 'welt', tag: 'weltchat', von: sender, vonName: name }
  const st = await Promise.all(abos.map((a) => zustellen(a, inhalt, env)))
  return json({ ok: true, gesendet: st.filter((s) => s < 300).length, weiter: z?.fertig === false })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response(`Snake-Server, Protokoll ${PROTOKOLL}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    if (url.pathname === '/einladen') return einladen(req, env)
    if (url.pathname === '/melden') return melden(req, env)
    const m = url.pathname.match(/^\/raum\/([A-Za-z0-9]{4,8})$/)
    if (!m || !codeGueltig(m[1].toUpperCase())) return new Response('Nicht gefunden', { status: 404 })
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Nur WebSocket', { status: 426 })
    // Der Raum liegt dort, wo ihn der erste Spieler anfordert. Mit dem Hinweis "weur" (Westeuropa) landet er
    // auch bei VPN, Roaming oder einem Umweg ueber ein fernes Rechenzentrum nahe bei uns. Gilt nur beim Anlegen.
    const stub = env.RAUM.get(env.RAUM.idFromName(m[1].toUpperCase()), { locationHint: 'weur' })
    return stub.fetch(req)
  },
}

export class Raum extends DurableObject<Env> {
  private logik: RaumLogik | null = null
  private uhr: ReturnType<typeof setInterval> | null = null

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const code = url.pathname.split('/').pop()!.toUpperCase()
    this.logik ??= new RaumLogik(code)
    const logik = this.logik
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()
    const kanal: Kanal = { send: (s) => server.send(s), close: (c, r) => server.close(c, r) }
    const q = url.searchParams
    const ok = logik.beitreten(kanal, { id: q.get('id') ?? '', name: q.get('name') ?? '', skin: q.get('skin') ?? '', v: Number(q.get('v')) })
    if (ok) {
      server.addEventListener('message', (e) => {
        if (typeof e.data === 'string') logik.nachricht(kanal, e.data)
      })
      const weg = () => {
        logik.verlassen(kanal)
        if (logik.leer) this.uhrAus()
      }
      server.addEventListener('close', () => {
        // Schliessen beantworten, sonst wartet der Browser lange auf die Bestaetigung
        try {
          server.close(1000, 'Tschuess')
        } catch {
          /* schon zu */
        }
        weg()
      })
      server.addEventListener('error', weg)
      // Jede Sekunde pruefen, ob das rechnende Geraet noch Stand schickt
      this.uhr ??= setInterval(() => logik.takt(), 1000)
    }
    return new Response(null, { status: 101, webSocket: client })
  }

  private uhrAus() {
    if (this.uhr) clearInterval(this.uhr)
    this.uhr = null
  }
}
