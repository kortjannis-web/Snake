/**
 * Snake-Server auf Cloudflare Workers. Jeder Raum (Code) ist ein eigenes Durable Object, alle Spieler
 * eines Raums landen also im selben Objekt. Die Spielregeln stehen in raum.ts.
 *
 * Verbindung: wss://<server>/raum/<CODE>?id=..&name=..&skin=..&v=<PROTOKOLL>
 */
import { DurableObject } from 'cloudflare:workers'
import { codeGueltig, PROTOKOLL } from '../src/multi/protokoll'
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
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (d: object, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'content-type': 'application/json' } })
const MODUS_NAME: Record<string, string> = { vs: 'Gegeneinander', rennen: 'Wettrennen', koop: 'Koop', jagd: 'Apfeljagd', royale: 'Schrumpfende Karte' }
/** Hoechstens eine Einladung je Absender und Empfaenger alle 10 s (je Server-Instanz) */
const zuletzt = new Map<string, number>()

/**
 * Push-Einladung an einen Freund, der die App gerade nicht offen hat. Der Absender schickt sein
 * Supabase-Token mit; Supabase gibt das Push-Abo nur heraus, wenn beide befreundet sind.
 */
async function einladen(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, grund: 'nur POST' }, 405)
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return json({ ok: false, grund: 'nicht eingerichtet' }, 501)
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
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/push_fuer`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ziel: an }),
  })
  if (!r.ok) return json({ ok: false, grund: 'kein Zugriff' }, 403)
  const abo = (await r.json()) as PushAbo | null
  if (!abo?.endpoint || !abo.keys?.p256dh || !abo.keys?.auth) return json({ ok: false, grund: 'kein Abo' }, 404)
  const name = String(d.vonName ?? 'Jemand').slice(0, 16)
  const status = await pushSenden(
    abo,
    { titel: `${name} lädt dich ein`, text: `${MODUS_NAME[String(d.modus)] ?? 'Mehrspieler'} · Raum ${code}`, code },
    { oeffentlich: env.VAPID_PUBLIC_KEY, privat: env.VAPID_PRIVATE_KEY, kontakt: env.VAPID_KONTAKT ?? 'https://github.com/kortjannis-web/Snake' },
  )
  return json({ ok: status < 300, status, grund: status === 404 || status === 410 ? 'Abo abgelaufen' : undefined }, status < 300 ? 200 : 502)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response(`Snake-Server, Protokoll ${PROTOKOLL}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    if (url.pathname === '/einladen') return einladen(req, env)
    const m = url.pathname.match(/^\/raum\/([A-Za-z0-9]{4,8})$/)
    if (!m || !codeGueltig(m[1].toUpperCase())) return new Response('Nicht gefunden', { status: 404 })
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Nur WebSocket', { status: 426 })
    const stub = env.RAUM.get(env.RAUM.idFromName(m[1].toUpperCase()))
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
