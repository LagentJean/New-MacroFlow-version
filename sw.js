/* MacroFlow emergency service-worker removal.
   Purpose: delete old app caches, release controlled clients, then unregister.
   This file does not touch localStorage or IndexedDB user data. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    await self.registration.unregister();

    for (const client of clients) {
      try {
        await client.navigate(client.url);
      } catch (_) {
        // A client can disappear while the cleanup is running.
      }
    }
  })());
});
