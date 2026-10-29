/* Benachrichtigungen: Einladungen zum Kampf, private Nachrichten und Weltchat (wird vom Service Worker der Web-App geladen) */
self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { titel: 'Snake', text: e.data ? e.data.text() : '' }
  }
  const art = d.art || 'einladung'
  e.waitUntil(
    self.registration.showNotification(d.titel || 'Snake', {
      body: d.text || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      // Je Art (und je Absender bei privaten Nachrichten) nur eine Nachricht im Benachrichtigungsfeld, die neue ersetzt die alte
      tag: d.tag || art,
      renotify: true,
      data: { art, code: d.code || '', von: d.von || '', vonName: d.vonName || '', t: Date.now() },
    }),
  )
})

// Tippen auf die Nachricht: App oeffnen (oder nach vorn holen) und dorthin, wo sie herkommt
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const d = e.notification.data || {}
  const art = d.art || 'einladung'
  const code = d.code || ''
  const ziel = art === 'einladung' ? (code ? `./?raum=${code}` : './') : art === 'nachricht' && d.von ? `./?chat=${d.von}` : art === 'welt' ? './?welt=1' : './'
  const url = new URL(ziel, self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ('focus' in c) {
          c.postMessage({ typ: art, code, von: d.von || '', vonName: d.vonName || '' })
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
