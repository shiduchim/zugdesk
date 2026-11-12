// Service worker: makes ZugDesk installable and usable offline.
// Strategy: network first (so updates arrive as soon as they are published),
// cache fallback when offline. Bump CACHE when the shell changes shape.
const CACHE = 'zugdesk-v29';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css', './css/tokens.css', './css/theme-dark.css', './css/base.css',
  './fonts/inter-latin-wght-normal.woff2', './fonts/jetbrains-mono-latin-wght-normal.woff2',
  './js/app.js', './js/mode.js', './js/store.js', './js/db.js', './js/seed.js', './js/seed-shadchan.js', './js/router.js', './js/ui.js', './js/labels.js', './js/calendar.js',
  './pages/home.js', './pages/home.css', './pages/contacts.js', './pages/contacts.css', './pages/contacts-data.js', './pages/contacts-panels.js',
  './pages/contact-form.js', './pages/contact-form.css',
  './pages/people.js', './pages/people.css', './pages/people-data.js', './pages/person-form.js', './pages/person-form.css', './pages/person-card.js', './pages/shidduchim.js', './pages/shidduchim.css', './pages/shidduch-data.js', './pages/idea-flow.js', './pages/shidduch-detail.js', './pages/profile.js', './pages/profile.css', './pages/profile-data.js', './pages/profile-share.js', './pages/home-data.js', './pages/notes-data.js', './pages/settings.js', './pages/settings.css',
  './pages/singles.js', './pages/singles.css', './pages/singles-data.js', './pages/single-panel.js', './pages/sh-shidduchim.js', './pages/sh-shidduch-detail.js', './pages/sh-shidduch-data.js', './pages/sh-shidduch-parts.js', './pages/sh-home.js', './pages/sh-send.js', './pages/sh-match.js', './pages/deleted.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin) return; // the app uses no outside services (fonts are in ./fonts)
  e.respondWith(
    // no-cache: always ask the server if the file changed (GitHub Pages lets phones keep files 10 min)
    fetch(new Request(req, { cache: 'no-cache' })).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
