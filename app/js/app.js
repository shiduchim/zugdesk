// App bootstrap: shell, slim bottom icon bar, router, labels, service worker.
import * as store from './store.js';
import { route, start, currentPath } from './router.js';
import { h, icon, toast } from './ui.js';
import { setLabels } from './labels.js';
import { watchDates } from './calendar.js';
import { isShadchan, listState } from './mode.js';

// One bottom bar for everything: the slim icon bar (owner choice). Settings is the gear on Home.
// Each mode has its own five places (spec/shadchan/design.md section 5); the bar looks the same.
const NAV = isShadchan ? [
  { path: '/home', label: 'Home', icon: 'home', id: 'nav.home' },
  { path: '/guys', label: 'Guys', icon: 'profile', id: 'nav.guys' },
  { path: '/girls', label: 'Girls', icon: 'profile', id: 'nav.girls' },
  { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'nav.shidduchim' },
  { path: '/contacts', label: 'Contacts', icon: 'contacts', id: 'nav.contacts' },
] : [
  { path: '/home', label: 'Home', icon: 'home', id: 'nav.home' },
  { path: '/contacts', label: 'Contacts', icon: 'contacts', id: 'nav.contacts' },
  { path: '/people', label: 'Ideas', icon: 'idea', id: 'nav.people' },
  { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'nav.shidduchim' },
  { path: '/profile', label: 'My Profile', icon: 'profile', id: 'nav.profile' },
];
const TITLES = isShadchan
  ? { '/home': 'Home', '/guys': 'Guys', '/girls': 'Girls', '/people': 'Singles', '/shidduchim': 'Shidduchim', '/contacts': 'Contacts', '/settings': 'Settings', '/deleted': 'Recently deleted', '/match': 'Find a match' }
  : { '/home': 'Home', '/contacts': 'Contacts', '/people': 'Ideas', '/shidduchim': 'Shidduchim', '/profile': 'My Profile', '/settings': 'Settings', '/deleted': 'Recently deleted' };

// Shared by both modes: Home, Contacts, Add Person, the person card, Settings.
route('/home', () => import('../pages/home.js'));
route('/home/note/:noteId', () => import('../pages/home.js'));
route('/contacts', () => import('../pages/contacts.js'));
route('/contacts/new', () => import('../pages/contact-form.js'));
route('/contacts/:id/edit', () => import('../pages/contact-form.js'));
route('/contacts/:id/history', () => import('../pages/contacts.js'));
route('/contacts/:id', () => import('../pages/contacts.js'));
route('/people/new', () => import('../pages/person-form.js'));
route('/people/new/from/:sourceId', () => import('../pages/person-form.js'));
route('/people/new/by/:contactId', () => import('../pages/person-form.js'));
route('/people/:id/edit', () => import('../pages/person-form.js'));
route('/people/:id/edit/:section', () => import('../pages/person-form.js'));
route('/people/:id', () => import('../pages/person-card.js'));
route('/people/:id/:tab', () => import('../pages/person-card.js'));
route('/settings', () => import('../pages/settings.js'));
route('/deleted', () => import('../pages/deleted.js')); // Recently deleted: both modes
if (isShadchan) {
  route('/guys', () => import('../pages/singles.js'));
  route('/girls', () => import('../pages/singles.js'));
  route('/people', () => import('../pages/singles.js'));       // shared pages go "back to the list": lands on Guys or Girls
  route('/shidduchim', () => import('../pages/sh-shidduchim.js'));
  route('/shidduchim/:id', () => import('../pages/sh-shidduch-detail.js'));
  route('/shidduchim/:id/:tab', () => import('../pages/sh-shidduch-detail.js'));
  route('/match/:id', () => import('../pages/sh-match.js'));
} else {
  route('/people', () => import('../pages/people.js'));
  route('/shidduchim', () => import('../pages/shidduchim.js'));
  route('/shidduchim/:id', () => import('../pages/shidduch-detail.js'));
  route('/shidduchim/:id/:tab', () => import('../pages/shidduch-detail.js'));
  route('/profile', () => import('../pages/profile.js'));
  route('/profile/edit', () => import('../pages/person-form.js'));
  route('/profile/edit/:section', () => import('../pages/person-form.js'));
  route('/profile/:tab', () => import('../pages/profile.js'));
}

const $ = (s) => document.querySelector(s);

function renderNav() {
  const inner = $('#nav .inner');
  inner.innerHTML = '';
  const path = currentPath();
  for (const it of NAV) {
    // A single's card and Add Person live under /people: they light up the list they came from.
    const active = path === it.path || path.startsWith(it.path + '/') || (isShadchan && path.startsWith('/people') && listState.last === it.path);
    // Every place shows its name under the icon (owner request: words under every icon, both modes).
    inner.append(h('a', { href: '#' + it.path, class: 'with-word', 'data-id': it.id, 'aria-current': active ? 'page' : null, 'aria-label': it.label, title: it.label },
      h('span', { class: 'ico', html: icon(it.icon) }).firstChild, h('span', {}, it.label)));
  }
}

// The slim bar slides away while scrolling down and comes back on any scroll up.
function wireShell() {
  document.body.classList.add('shell-slim');
  let lastY = window.scrollY, ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, dy = y - lastY;
      if (y < 40 || dy < -6) document.body.classList.remove('bar-hidden');
      else if (dy > 6) document.body.classList.add('bar-hidden');
      if (Math.abs(dy) > 6) lastY = y;
    });
  }, { passive: true });
}

function setTitle(path) {
  const names = TITLES;
  const key = '/' + path.split('/')[1];
  $('#topbar-title').textContent = names[key] || '';
  document.title = (names[key] ? names[key] + ' · ' : '') + 'ZugDesk';
  $('#settings-btn').setAttribute('aria-pressed', key === '/settings' ? 'true' : 'false');
}

async function boot() {
  try { await store.init(); }
  catch (e) { console.error(e); toast('Could not open local storage. Try another browser or exit private mode.', 6000); }

  document.documentElement.dataset.mode = isShadchan ? 'shadchan' : 'single';
  setLabels(store.getPrefs().showLabels);
  applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  let askedToKeep = false;
  store.subscribe((ch) => {
    if (ch.store === 'prefs' && ch.key === 'showLabels') setLabels(ch.value);
    if (ch.store === 'prefs' && ch.key === 'theme') applyTheme();
    // The first time something is saved by hand, ask the browser to keep this site's storage for good
    // (otherwise some phones clear it when space runs low). Most browsers decide without showing anything.
    if (ch.type === 'save' && !askedToKeep) {
      askedToKeep = true;
      store.storageState().then(st => { if (st === 'not-kept') store.askToKeepStorage(); });
    }
  });
  wireShell(); renderNav(); watchDates();

  await start($('#content'), (path) => { renderNav(); setTitle(path); document.body.classList.remove('bar-hidden'); document.body.classList.toggle('focus-mode', path.startsWith('/profile/edit')); });

  if ('serviceWorker' in navigator) {
    // A new version just took over: if the app was opened moments ago and nothing is being typed, switch at once
    // (so one close-and-reopen is still enough after a publish); otherwise the message below asks to reopen.
    const openedAt = Date.now(), hadOne = !!navigator.serviceWorker.controller;
    let switching = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadOne || switching) return;
      const busy = document.activeElement?.matches?.('input, textarea') || document.querySelector('dialog[open]');
      if (Date.now() - openedAt < 15000 && !busy) { switching = true; location.reload(); }
    });
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // coming back to the app (not only a fresh open) also checks for a new version
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
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

// Dark mode (Settings → Appearance): the colours live in css/theme-dark.css.
function applyTheme() {
  let t = store.getPrefs().theme || 'dark';
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || meta.content;
}

// Phones (mainly iPhone): while the keyboard is open the page can slide under "pinned" bars.
// Keep --vv-top = how far the visible area has moved, and --vv-kb = how much the keyboard covers at the
// bottom, so the editing bar (Cancel / Save at the bottom) stays just above the keyboard.
(function keepBarsOnScreen() {
  const vv = window.visualViewport; if (!vv) return;
  let raf = 0;
  const set = () => { raf = 0; const st = document.documentElement.style;
    st.setProperty('--vv-top', Math.max(0, Math.round(vv.offsetTop)) + 'px');
    st.setProperty('--vv-kb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px'); };
  const soon = () => { if (!raf) raf = requestAnimationFrame(set); };
  vv.addEventListener('scroll', soon); vv.addEventListener('resize', soon);
  window.addEventListener('scroll', soon, { passive: true }); document.addEventListener('focusin', () => setTimeout(set, 350)); document.addEventListener('focusout', () => setTimeout(set, 350));
  set();
})();
