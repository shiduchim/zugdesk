// App bootstrap: shell, top bar, bottom navigation, router, labels, service worker.
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
    { path: '/people', label: 'People', icon: 'people', id: 'nav.people' },
    { path: '/shidduchim', label: 'Shidduchim', icon: 'shidduchim', id: 'nav.shidduchim' },
    { path: '/profile', label: 'Profile', icon: 'profile', id: 'nav.profile' },
  ],
};

route('/home', () => import('../pages/home.js'));
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
route('/settings', () => import('../pages/settings.js'));

const $ = (s) => document.querySelector(s);

function renderNav() {
  const prefs = store.getPrefs();
  const items = NAV[prefs.navArrangement] || NAV.three;
  const inner = $('#nav .inner');
  inner.innerHTML = '';
  let path = currentPath();
  // Three-destination layout: People & Ideas lives inside Shidduchim.
  if (prefs.navArrangement !== 'four' && (path === '/people' || path.startsWith('/people/'))) path = '/shidduchim';
  for (const it of items) {
    const active = path === it.path || path.startsWith(it.path + '/');
    inner.append(h('a', { href: '#' + it.path, 'data-id': it.id, 'aria-current': active ? 'page' : null },
      h('span', { class: 'ico', html: icon(it.icon) }).firstChild, h('span', {}, it.label)));
  }
}

function setTitle(path) {
  const names = { '/home': 'Home', '/contacts': 'Contacts', '/people': 'People & Ideas', '/shidduchim': 'Shidduchim', '/profile': 'My Profile', '/settings': 'Settings' };
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
  });

  await start($('#content'), (path) => { renderNav(); setTitle(path); });

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
