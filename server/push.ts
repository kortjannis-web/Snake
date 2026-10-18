/**
 * Web Push ohne Bibliothek (nur WebCrypto, laeuft in Cloudflare Workers und in Node):
 * Verschluesselung nach RFC 8291 (aes128gcm) und Absender-Nachweis nach RFC 8292 (VAPID).
 */

export type PushAbo = { endpoint: string; keys: { p256dh: string; auth: string } }
export type Vapid = { oeffentlich: string; privat: string; kontakt: string }

const enc = new TextEncoder()

export function b64u(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function vonB64u(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(t)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const verbinden = (...teile: Uint8Array[]) => {
  const out = new Uint8Array(teile.reduce((n, t) => n + t.length, 0))
  let o = 0
  for (const t of teile) {
    out.set(t, o)
    o += t.length
  }
  return out
}
/** WebCrypto erwartet ArrayBuffer-Ansichten; so passt es in allen Umgebungen */
const roh = (u: Uint8Array) => u.slice().buffer as ArrayBuffer

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, laenge: number) {
  const key = await crypto.subtle.importKey('raw', roh(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: roh(salt), info: roh(info) }, key, laenge * 8))
}

/** Oeffentlicher Schluessel (65 Bytes, unkomprimiert) als JWK-Teile */
function punkt(oeffentlich: Uint8Array) {
  return { x: b64u(oeffentlich.slice(1, 33)), y: b64u(oeffentlich.slice(33, 65)) }
}

/**
 * Inhalt fuer ein Abo verschluesseln (RFC 8291). `test` setzt Salt und den Absender-Schluessel fest
 * (nur fuer den Test mit den Werten aus dem RFC).
 */
export async function verschluesseln(abo: PushAbo, inhalt: string, test?: { salt: Uint8Array; privat: string; oeffentlich: string }): Promise<Uint8Array> {
  const uaPublic = vonB64u(abo.keys.p256dh)
  const authSecret = vonB64u(abo.keys.auth)
  let asPrivate: CryptoKey
  let asPublic: Uint8Array
  if (test) {
    asPublic = vonB64u(test.oeffentlich)
    asPrivate = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: test.privat, ...punkt(asPublic), ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  } else {
    const paar = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    asPrivate = paar.privateKey
    asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', paar.publicKey)) as ArrayBuffer)
  }
  const uaKey = await crypto.subtle.importKey('raw', roh(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as Parameters<SubtleCrypto['deriveBits']>[0], asPrivate, 256))
  const ikm = await hkdf(authSecret, ecdh, verbinden(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = test?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', roh(cek), 'AES-GCM', false, ['encrypt'])
  // Ein einziger Datensatz: Inhalt, dann 0x02 als Ende-Markierung
  const klar = verbinden(enc.encode(inhalt), new Uint8Array([2]))
  const geheim = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: roh(nonce) }, key, roh(klar)))
  const kopf = new Uint8Array(16 + 4 + 1 + asPublic.length)
  kopf.set(salt, 0)
  new DataView(kopf.buffer).setUint32(16, 4096)
  kopf[20] = asPublic.length
  kopf.set(asPublic, 21)
  return verbinden(kopf, geheim)
}

/** VAPID-Kopfzeile fuer den Push-Dienst des Abos (RFC 8292) */
export async function vapidKopf(endpoint: string, v: Vapid, jetzt = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin
  const kopf = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const nutz = b64u(enc.encode(JSON.stringify({ aud, exp: jetzt + 12 * 3600, sub: v.kontakt })))
  const oeff = vonB64u(v.oeffentlich)
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: v.privat, ...punkt(oeff), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, roh(enc.encode(`${kopf}.${nutz}`)))
  return `vapid t=${kopf}.${nutz}.${b64u(sig)}, k=${v.oeffentlich}`
}

/** Push schicken. Gibt den HTTP-Status des Push-Dienstes zurueck (201 = angenommen, 404/410 = Abo ungueltig) */
export async function pushSenden(abo: PushAbo, inhalt: object, v: Vapid): Promise<number> {
  const body = await verschluesseln(abo, JSON.stringify(inhalt))
  const r = await fetch(abo.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidKopf(abo.endpoint, v),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '120',
      Urgency: 'high',
    },
    body: roh(body),
  })
  return r.status
}
