// Network-only by design: private stories, capabilities and API responses
// must never enter an offline service-worker cache.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
