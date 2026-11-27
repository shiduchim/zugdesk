// Service worker: makes ZugDesk installable, usable offline and quick to open.
// Published app: opens straight from the saved copy (no waiting for the internet). Each publish writes its
// commit into BUILD (.github/workflows/deploy.yml), so the phone sees a new sw.js, saves the new files in the
// background and app.js switches to them (at once if the app was just opened, otherwise on the next open).
// Local testing (BUILD not filled in): asks the network first, so edits show at once.
const BUILD = '__BUILD__';
const DEV = BUILD === '__' + 'BUILD__';
const CACHE = 'zugdesk-v36-' + BUILD;
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/fonts.css', './css/tokens.css', './css/theme-dark.css', './css/base.css', './css/voice.css', './js/voice.js',
  './fonts/inter-latin-wght-normal.woff2', './fonts/jetbrains-mono-latin-wght-normal.woff2',
  './js/app.js', './js/mode.js', './js/store.js', './js/db.js', './js/seed.js', './js/seed-shadchan.js', './js/router.js', './js/ui.js', './js/labels.js', './js/calendar.js', './js/backup.js',
  './pages/home.js', './pages/home.css', './pages/contacts.js', './pages/contacts.css', './pages/contacts-data.js', './pages/contacts-panels.js',
  './pages/contact-form.js', './pages/contact-form.css',
  './pages/people.js', './pages/people.css', './pages/people-data.js', './pages/person-form.js', './pages/person-form.css', './pages/person-card.js', './pages/shidduchim.js', './pages/shidduchim.css', './pages/shidduch-data.js', './pages/idea-flow.js', './pages/shidduch-detail.js', './pages/profile.js', './pages/profile.css', './pages/profile-data.js', './pages/profile-share.js', './pages/files-inline.js', './pages/home-data.js', './pages/notes-data.js', './pages/settings.js', './pages/settings.css',
  './pages/singles.js', './pages/singles.css', './pages/singles-data.js', './pages/single-panel.js', './pages/sh-shidduchim.js', './pages/sh-shidduch-detail.js', './pages/sh-shidduch-data.js', './pages/sh-shidduch-parts.js', './pages/sh-home.js', './pages/sh-send.js', './pages/sh-match.js', './pages/deleted.js', './pages/backup-sheet.js', './pages/claude-import.js', './pages/claude-import.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './fonts/inter-latin-ext-wght-normal.woff2', './fonts/inter-cyrillic-wght-normal.woff2', './fonts/jetbrains-mono-latin-ext-wght-normal.woff2', './fonts/jetbrains-mono-cyrillic-wght-normal.woff2',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' so the new copy never comes from the browser's own short-term cache
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
const offline = (req) => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // the app uses no outside services (fonts are in ./fonts)
  if (DEV) { e.respondWith(fetch(new Request(req, { cache: 'no-cache' })).then(res => save(req, res)).catch(() => offline(req))); return; }
  // saved copy first; anything not saved yet comes from the network once and is kept
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => save(req, res)).catch(() => offline(req))));
});
