/**
 * Snake-Server auf Cloudflare Workers. Jeder Raum (Code) ist ein eigenes Durable Object, alle Spieler
 * eines Raums landen also im selben Objekt. Die Spielregeln stehen in raum.ts.
 *
 * Verbindung: wss://<server>/raum/<CODE>?id=..&name=..&skin=..&v=<PROTOKOLL>
 */
import { DurableObject } from 'cloudflare:workers'
import { codeGueltig, PROTOKOLL } from '../src/multi/protokoll'
import { RaumLogik, type Kanal } from './raum'

type Env = { RAUM: DurableObjectNamespace<Raum> }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/') return new Response(`Snake-Server, Protokoll ${PROTOKOLL}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
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
      server.addEventListener('close', weg)
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
