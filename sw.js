const CACHE_NAME = 'macroflow-beta-audit-v33';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './food-model.tflite',
  './smart-scanner.js',
  './training.js',
  './nutrition-engine-v30.js',
  './onboarding-v15.css',
  './scanner-v16.css',
  './training-session-v16.css',
  './quick-add-v20.css',
  './quick-add-v20.js',
  './gamification-v21.css',
  './gamification-v21.js',
  './muscle-recovery-v22.css',
  './muscle-recovery-v22.js',
  './muscle-map-body-v22.png',
  './daily-coach-v23.css',
  './daily-coach-v23.js',
  './exercise-technique-v24.css',
  './exercise-technique-v24.js',
  './delight.css',
  './delight.js',
  './phase4-v31.css',
  './phase4-v31.js',
  './coach.css',
  './progress-v14.css',
  './progress-v14.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Transformers.js stores the large ONNX files in its own Cache Storage.
  // Avoid duplicating ~236 MB in the application cache.
  if (requestUrl.pathname.includes('/models/')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match(new URL('index.html', self.location.href).href, { ignoreSearch: true });
        return new Response('MacroFlow est hors ligne et ce fichier ne se trouve pas encore dans le cache.', { status: 503 });
      });
    }),
  );
});
