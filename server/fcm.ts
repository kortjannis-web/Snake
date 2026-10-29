/**
 * Benachrichtigungen an die Android-App (APK) ueber Firebase Cloud Messaging (HTTP v1), ohne Bibliothek:
 * Der Server meldet sich mit dem Dienstkonto aus Firebase an (JWT mit RS256, nur WebCrypto) und schickt dann
 * je Geraet eine Nachricht. Das Zugangs-Token gilt eine Stunde und wird so lange wiederverwendet.
 */
import { b64u } from './push'

/** Inhalt der JSON-Datei, die Firebase fuer das Dienstkonto herunterladen laesst (nur diese drei Felder zaehlen) */
export type Dienstkonto = { project_id: string; client_email: string; private_key: string }

const enc = new TextEncoder()
let zugang: { token: string; bis: number; fuer: string } | null = null

function pemZuBytes(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

/** Signierte Anmeldung (JWT) fuer Googles Token-Dienst */
export async function fcmJwt(konto: Dienstkonto, jetzt = Math.floor(Date.now() / 1000)): Promise<string> {
  const kopf = b64u(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const nutz = b64u(
    enc.encode(
      JSON.stringify({
        iss: konto.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: jetzt,
        exp: jetzt + 3600,
      }),
    ),
  )
  const key = await crypto.subtle.importKey('pkcs8', pemZuBytes(konto.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${kopf}.${nutz}`))
  return `${kopf}.${nutz}.${b64u(sig)}`
}

async function zugangsToken(konto: Dienstkonto): Promise<string> {
  const jetzt = Date.now()
  if (zugang && zugang.fuer === konto.client_email && zugang.bis > jetzt + 60_000) return zugang.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${await fcmJwt(konto)}`,
  })
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!d.access_token) throw new Error(`FCM-Anmeldung: ${r.status}`)
  zugang = { token: d.access_token, bis: jetzt + (d.expires_in ?? 3600) * 1000, fuer: konto.client_email }
  return zugang.token
}

/** Dienstkonto aus dem Secret lesen (JSON, so wie Firebase es herunterladen laesst). null: fehlt oder kaputt */
export function dienstkonto(roh: string | undefined): Dienstkonto | null {
  if (!roh) return null
  try {
    const k = JSON.parse(roh) as Partial<Dienstkonto>
    return k.project_id && k.client_email && k.private_key ? (k as Dienstkonto) : null
  } catch {
    return null
  }
}

/**
 * Eine Benachrichtigung an ein Geraet. Gibt einen HTTP-Status zurueck wie beim Web Push:
 * 200 angenommen, 404 das Geraet gibt es nicht mehr (App deinstalliert, Token abgelaufen)
 */
export async function fcmSenden(konto: Dienstkonto, token: string, inhalt: { titel: string; text: string; tag: string; daten: Record<string, string> }): Promise<number> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${konto.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await zugangsToken(konto)}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: inhalt.titel, body: inhalt.text },
        data: inhalt.daten,
        android: { priority: 'high', ttl: '600s', notification: { channel_id: 'snake', tag: inhalt.tag, icon: 'ic_stat_snake', color: '#8fd6bd' } },
      },
    }),
  })
  if (r.status === 404 || r.status === 400) {
    const fehler = await r.text().catch(() => '')
    if (/UNREGISTERED|registration token is not a valid/i.test(fehler)) return 404
  }
  return r.status
}
