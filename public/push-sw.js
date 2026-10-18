/* Push-Einladungen (wird vom Service Worker der Web-App geladen) */
self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { titel: 'Snake', text: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(d.titel || 'Snake', {
      body: d.text || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'einladung',
      renotify: true,
      data: { code: d.code || '' },
    }),
  )
})

// Tippen auf die Nachricht: App oeffnen (oder nach vorn holen) und dem Raum beitreten
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const code = (e.notification.data && e.notification.data.code) || ''
  const url = new URL(code ? `./?raum=${code}` : './', self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ('focus' in c) {
          c.postMessage({ typ: 'einladung', code })
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
