// App bootstrap: shell, top bar, bottom navigation (or the Claude-style menu drawer), router, labels, service worker.
import * as store from './store.js';
import { route, start, currentPath } from './router.js';
import { h, icon, toast } from './ui.js';
import { setLabels } from './labels.js';

const NAV = {
  three: [
    { path: '/home', label: 'Home', icon: 'home', id: 'nav.home' },
    { path: '/contacts', label: 'Contacts', icon: 'contacts', id: 'nav.contacts' },
    { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'nav.shidduchim' },
    { path: '/profile', label: 'My Profile', icon: 'profile', id: 'nav.profile' },
  ],
  four: [
    { path: '/home', label: 'Home', icon: 'home', id: 'nav.home' },
    { path: '/contacts', label: 'Contacts', icon: 'contacts', id: 'nav.contacts' },
    { path: '/people', label: 'Ideas', icon: 'idea', id: 'nav.people' },
    { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'nav.shidduchim' },
    { path: '/profile', label: 'My Profile', icon: 'profile', id: 'nav.profile' },
  ],
};

route('/home', () => import('../pages/home.js'));
route('/home/note/:noteId', () => import('../pages/home.js'));
route('/contacts', () => import('../pages/contacts.js'));
route('/contacts/new', () => import('../pages/contact-form.js'));
route('/contacts/:id/edit', () => import('../pages/contact-form.js'));
route('/contacts/:id/history', () => import('../pages/contacts.js'));
route('/contacts/:id', () => import('../pages/contacts.js'));
route('/people', () => import('../pages/people.js'));
route('/people/new', () => import('../pages/person-form.js'));
route('/people/new/from/:sourceId', () => import('../pages/person-form.js'));
route('/people/new/by/:contactId', () => import('../pages/person-form.js'));
route('/people/:id/edit', () => import('../pages/person-form.js'));
route('/people/:id/edit/:section', () => import('../pages/person-form.js'));
route('/people/:id', () => import('../pages/person-card.js'));
route('/people/:id/:tab', () => import('../pages/person-card.js'));
route('/shidduchim', () => import('../pages/shidduchim.js'));
route('/shidduchim/:id', () => import('../pages/shidduch-detail.js'));
route('/shidduchim/:id/:tab', () => import('../pages/shidduch-detail.js'));
route('/profile', () => import('../pages/profile.js'));
route('/profile/edit', () => import('../pages/person-form.js'));
route('/profile/edit/:section', () => import('../pages/person-form.js'));
route('/profile/:tab', () => import('../pages/profile.js'));
route('/settings', () => import('../pages/settings.js'));

const $ = (s) => document.querySelector(s);

function renderNav() {
  const prefs = store.getPrefs();
  const items = NAV[prefs.navArrangement] || NAV.three;
  const inner = $('#nav .inner');
  inner.innerHTML = '';
  let path = currentPath();
  // Three-destination layout: Ideas lives inside Shidduchim.
  if (prefs.navArrangement !== 'four' && (path === '/people' || path.startsWith('/people/'))) path = '/shidduchim';
  for (const it of items) {
    const active = path === it.path || path.startsWith(it.path + '/');
    inner.append(h('a', { href: '#' + it.path, 'data-id': it.id, 'aria-current': active ? 'page' : null },
      h('span', { class: 'ico', html: icon(it.icon) }).firstChild, h('span', {}, it.label)));
  }
}

// ---------- Claude-style shell (Settings → Screen layout; being tested) ----------
// Menu icon top-left opens a drawer; no bottom menu; the top bar slides away while scrolling down.
const DRAWER = [
  { path: '/home', label: 'Home', icon: 'home', id: 'drawer.home' },
  { path: '/contacts', label: 'Contacts', icon: 'contacts', id: 'drawer.contacts' },
  { path: '/people', label: 'Ideas', icon: 'idea', id: 'drawer.people' },
  { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'drawer.shidduchim' },
  { path: '/profile', label: 'My Profile', icon: 'profile', id: 'drawer.profile' },
  { path: '/settings', label: 'Settings', icon: 'settings', id: 'drawer.settings' },
];
const claude = () => store.getPrefs().shellStyle === 'claude';
function applyShell() {
  document.body.classList.toggle('shell-claude', claude());
  document.body.classList.remove('bar-hidden');
  if (!claude()) closeDrawer();
}
function renderDrawer() {
  const d = $('#drawer'), path = currentPath();
  d.innerHTML = '';
  d.append(h('div', { class: 'drawer-head' }, h('span', { class: 'drawer-brand' }, 'ZugDesk'),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close menu', 'data-id': 'drawer.close', html: icon('back'), onClick: closeDrawer })));
  for (const it of DRAWER) {
    const active = path === it.path || path.startsWith(it.path + '/');
    d.append(h('a', { href: '#' + it.path, class: 'drawer-item', 'data-id': it.id, 'aria-current': active ? 'page' : null, onClick: closeDrawer },
      h('span', { class: 'ico', html: icon(it.icon) }).firstChild, h('span', {}, it.label)));
  }
}
function openDrawer() {
  renderDrawer();
  $('#drawer').hidden = false; $('#drawer-backdrop').hidden = false;
  requestAnimationFrame(() => document.body.classList.add('drawer-open'));
  $('#menu-btn').setAttribute('aria-expanded', 'true');
  setTimeout(() => $('#drawer [aria-current="page"]')?.focus(), 50);
}
function closeDrawer() {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  $('#menu-btn').setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!document.body.classList.contains('drawer-open')) { $('#drawer').hidden = true; $('#drawer-backdrop').hidden = true; } }, 200);
}
function wireShell() {
  $('#menu-btn').addEventListener('click', openDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  // swipe in from the left edge opens the menu; swipe left closes it
  let sx = null, sy = 0;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (sx == null || !claude()) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (sx < 24 && dx > 60 && dy < 50) openDrawer();
    else if (document.body.classList.contains('drawer-open') && dx < -60 && dy < 50) closeDrawer();
    sx = null;
  }, { passive: true });
  // top bar hides while scrolling down, comes back on any scroll up
  let lastY = window.scrollY, ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, dy = y - lastY;
      if (!claude() || document.body.classList.contains('drawer-open')) { lastY = y; return; }
      if (y < 40 || dy < -6) document.body.classList.remove('bar-hidden');
      else if (dy > 6) document.body.classList.add('bar-hidden');
      if (Math.abs(dy) > 6) lastY = y;
    });
  }, { passive: true });
}

function setTitle(path) {
  const names = { '/home': 'Home', '/contacts': 'Contacts', '/people': 'Ideas', '/shidduchim': 'Shidduchim', '/profile': 'My Profile', '/settings': 'Settings' };
  const key = '/' + path.split('/')[1];
  $('#topbar-title').textContent = names[key] || '';
  document.title = (names[key] ? names[key] + ' · ' : '') + 'ZugDesk';
  $('#settings-btn').setAttribute('aria-pressed', key === '/settings' ? 'true' : 'false');
}

async function boot() {
  try { await store.init(); }
  catch (e) { console.error(e); toast('Could not open local storage. Try another browser or exit private mode.', 6000); }

  setLabels(store.getPrefs().showLabels);
  store.subscribe((ch) => {
    if (ch.store === 'prefs' && ch.key === 'showLabels') setLabels(ch.value);
    if (ch.store === 'prefs' && ch.key === 'navArrangement') renderNav();
    if (ch.store === 'prefs' && ch.key === 'shellStyle') applyShell();
  });
  applyShell(); wireShell();

  await start($('#content'), (path) => { renderNav(); setTitle(path); closeDrawer(); document.body.classList.remove('bar-hidden'); document.body.classList.toggle('focus-mode', path.startsWith('/profile/edit')); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) toast('ZugDesk updated — close and reopen to get the new version', 5000);
        });
      });
    }).catch(err => console.warn('SW registration failed', err));
  }
}

boot();
