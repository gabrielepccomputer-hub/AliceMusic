// Service worker minimo: basta che esista e risponda a fetch/install
// perché Chrome consideri l'app "installabile" come PWA.
// Non mettiamo in cache la ricerca/streaming (deve sempre restare live),
// solo un piccolo passthrough.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // passthrough diretto: lasciamo che tutto vada in rete normalmente,
  // così la ricerca e lo streaming YouTube restano sempre aggiornati
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
