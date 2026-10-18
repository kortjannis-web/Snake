import { describe, expect, it } from 'vitest'
import { b64u, vapidKopf, verschluesseln, vonB64u } from '../server/push'

// Beispiel aus RFC 8291, Abschnitt 5
const RFC = {
  inhalt: 'When I grow up, I want to be a watermelon',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  ergebnis:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

describe('Web Push', () => {
  it('verschluesselt genau wie im Beispiel von RFC 8291', async () => {
    const body = await verschluesseln({ endpoint: 'https://push.example.net/x', keys: { p256dh: RFC.uaPublic, auth: RFC.auth } }, RFC.inhalt, {
      salt: vonB64u(RFC.salt),
      privat: RFC.asPrivate,
      oeffentlich: RFC.asPublic,
    })
    expect(b64u(body)).toBe(RFC.ergebnis)
  })

  it('VAPID: gueltige ES256-Signatur fuer den Push-Dienst', async () => {
    const paar = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey('jwk', paar.privateKey)
    const oeff = b64u(await crypto.subtle.exportKey('raw', paar.publicKey))
    const kopf = await vapidKopf('https://fcm.googleapis.com/fcm/send/abc', { oeffentlich: oeff, privat: jwk.d!, kontakt: 'https://github.com/kortjannis-web/Snake' }, 1_000_000)
    const m = kopf.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
    expect(m).toBeTruthy()
    const [, k, n, s, schluessel] = m!
    expect(schluessel).toBe(oeff)
    expect(JSON.parse(new TextDecoder().decode(vonB64u(n)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_000_000 + 43200, sub: 'https://github.com/kortjannis-web/Snake' })
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, paar.publicKey, vonB64u(s).slice().buffer as ArrayBuffer, new TextEncoder().encode(`${k}.${n}`))
    expect(ok).toBe(true)
  })
})
