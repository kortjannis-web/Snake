// Erzeugt ein Schluesselpaar fuer Push-Einladungen (VAPID). Ausgabe einmal in GitHub eintragen,
// siehe docs/MEHRSPIELER-EINRICHTEN.md. Den privaten Schluessel niemandem zeigen.
const paar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const roh = new Uint8Array(await crypto.subtle.exportKey('raw', paar.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', paar.privateKey)
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
console.log('VITE_VAPID_PUBLIC_KEY / VAPID_PUBLIC_KEY (oeffentlich):')
console.log(b64u(roh))
console.log('\nVAPID_PRIVATE_KEY (geheim, nur als GitHub-Secret):')
console.log(jwk.d)
