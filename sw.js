// MacroFlow v34.1 Recovery kill-switch.
// This worker intentionally removes older broken caches and unregisters itself.
const RECOVERY_CACHE_PREFIX = 'macroflow-';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(RECOVERY_CACHE_PREFIX)).map((name) => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ source: 'macroflow-recovery', type: 'recovered' });
    }
  })());
});

self.addEventListener('fetch', () => {
  // No interception during recovery: every file comes directly from GitHub Pages.
});
