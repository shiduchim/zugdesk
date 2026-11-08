// Contacts — Stage 2. One workspace, many presentations (spec/contacts.md):
//   phone views: a (Outlook summary top) · split (top/bottom) · rail (narrow sidebar)
//                tabs (horizontal names) · list (expanded inline) · inbox (drill-down)
//   wide screens: desktop three-area view (app nav · directory · record).
// Switching views changes presentation only; selection, search, sort and filters
// live in contacts-data.js `S` and survive every switch.
import * as store from '../js/store.js';
import { h, icon } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { S, D, load, visible, extraFilterCount, anyFilter, clearFilters, ensureSelection, SORTS, ROLE_TABS, ACTIVITY, STATUS_LABEL, roleLabel } from './contacts-data.js';
import { personBlock, quickFacts, nameLine, statusText, filtersSheet, viewSheet, shortDate, eventItem } from './contacts-panels.js';

const DESK = window.matchMedia('(min-width: 1024px)');
const ico = (n) => h('span', { html: icon(n) }).firstChild;

let deskPick = null, gen = 0;
let root = null, mode = 'list', routeId = null, unsub = null, timer = 0, onScroll = null;
const layout = () => (DESK.matches ? 'desk' : (store.getPrefs().contactsLayout || 'a'));

export async function render(container, params = {}, path = '') {
  root = container;
  routeId = params.id || null;
  mode = path.endsWith('/history') ? 'history' : routeId ? 'detail' : 'list';
  if (routeId) S.selectedId = routeId;
  root.classList.add('contacts-page');
  const token = ++gen;
  await load();
  if (token !== gen) return; // user already went elsewhere
  normalizeUrl();
  draw();
  unsub = store.subscribe((ch) => {
    if (ch.store === 'prefs' && !['contactsLayout', 'contactsSort'].includes(ch.key)) return;
    clearTimeout(timer); timer = setTimeout(refresh, 40);
  });
  DESK.addEventListener('change', refresh);
  onScroll = () => { if (mode === 'list') S.pageScroll = window.scrollY; };
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function destroy() {
  unsub && unsub(); unsub = null; clearTimeout(timer);
  DESK.removeEventListener('change', refresh);
  window.removeEventListener('scroll', onScroll);
  root = null; gen++;
}

// Reload data and redraw, keeping every scroll position and the search box focus.
async function refresh() {
  if (!root) return;
  saveScrolls();
  const y = window.scrollY;
  const focused = document.activeElement?.dataset?.id;
  const token = gen;
  await load();
  if (!root || token !== gen) return;
  draw();
  window.scrollTo(0, y);
  if (focused === 'contacts.search') { const s = root.querySelector('[data-id="contacts.search"]'); s?.focus(); s?.setSelectionRange(s.value.length, s.value.length); }
}

function saveScrolls() {
  root?.querySelectorAll('[data-keep]').forEach(el => { S.scroll[el.dataset.keep] = el.dataset.axis === 'x' ? el.scrollLeft : el.scrollTop; });
}
function restoreScrolls(scope = root) {
  scope.querySelectorAll('[data-keep]').forEach(el => {
    const v = S.scroll[el.dataset.keep] || 0;
    if (el.dataset.axis === 'x') el.scrollLeft = v; else el.scrollTop = v;
    el.addEventListener('scroll', () => { S.scroll[el.dataset.keep] = el.dataset.axis === 'x' ? el.scrollLeft : el.scrollTop; }, { passive: true });
  });
}

// Only the inbox drill-down has a separate person page. Elsewhere #/contacts/<id>
// just means "select this person", so tidy the address to keep Back predictable.
function normalizeUrl() {
  if (mode === 'detail' && layout() !== 'inbox') {
    history.replaceState(null, '', '#/contacts');
    mode = 'list'; routeId = null;
  }
}

function draw() {
  normalizeUrl();
  root.innerHTML = '';
  root.classList.remove('wide', 'is-desk');
  const lay = layout();
  if (lay === 'desk') { root.classList.add('wide', 'is-desk'); return drawDesk(); }
  if (mode === 'history') return drawHistory();
  if (mode === 'detail' && lay === 'inbox') return drawInboxDetail();
  drawPhone(lay);
}

// ---------- shared toolbar ----------
const addBtn = (cls) => h('button', { class: 'btn primary ' + cls, type: 'button', 'data-id': 'contacts.add-btn', onClick: () => navigate('/contacts/new') }, 'Add Shadchan');
// Add Shadchan sits top right, next to the heading, on phone and computer (owner request).
function head() {
  return h('div', { class: 'page-head ct-head' }, h('h1', {}, 'Contacts'), addBtn(''));
}

function tools() {
  const v = visible();
  const count = h('span', { class: 'ct-count', 'data-id': 'contacts.count' }, `${v.total} shown`);
  const search = h('div', { class: 'ct-search' }, ico('search'),
    h('input', { class: 'input', type: 'search', value: S.q, placeholder: 'Find a name, city or conversation…', 'aria-label': 'Search contacts', 'data-id': 'contacts.search', dir: 'auto',
      onInput: (e) => { S.q = e.target.value; redrawBody(); } }));
  const chipRow = (opts, cur, dataId, set) => h('div', { class: 'chip-row', role: 'group', 'data-id': dataId },
    opts.map(([v, l]) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': cur === v ? 'true' : 'false', onClick: () => { set(v); refresh(); } }, l)));
  const nExtra = extraFilterCount();
  const prefs = store.getPrefs();
  return h('div', { class: 'ct-tools', 'data-id': 'contacts.tools' },
    search,
    chipRow(ROLE_TABS, S.role, 'contacts.role-chips', v => { S.role = v; }),
    chipRow(ACTIVITY, S.activity, 'contacts.activity-chips', v => { S.activity = v; }),
    h('div', { class: 'ct-bar' },
      h('label', { class: 'ct-sort', 'data-id': 'contacts.sort' }, h('span', {}, 'Sort'),
        h('select', { class: 'input', 'aria-label': 'Sort contacts', onChange: (e) => store.setPref('contactsSort', e.target.value) },
          SORTS.map(([v, l]) => h('option', { value: v, selected: prefs.contactsSort === v || null }, l)))),
      h('button', { class: 'btn small', type: 'button', 'data-id': 'contacts.filter-btn', 'aria-pressed': nExtra ? 'true' : 'false', onClick: async () => { await filtersSheet(); refresh(); } },
        ico('filter'), nExtra ? `Filters · ${nExtra}` : 'Filters'),
      DESK.matches ? null : h('button', { class: 'btn small', type: 'button', 'data-id': 'contacts.view-btn', onClick: () => viewSheet() }, ico('layout'), 'View'),
      count),
    activeFilters());
}

function activeFilters() {
  if (!anyFilter()) return null;
  const tags = [];
  const tag = (label, clear) => tags.push(h('button', { type: 'button', class: 'ftag', title: 'Remove this filter', onClick: () => { clear(); refresh(); } }, label, h('span', { class: 'ftag-x' }, 'remove')));
  if (S.q.trim()) tag(`“${S.q.trim()}”`, () => { S.q = ''; });
  if (S.role !== 'all') tag(ROLE_TABS.find(r => r[0] === S.role)[1], () => { S.role = 'all'; });
  if (S.activity !== 'all') tag(ACTIVITY.find(r => r[0] === S.activity)[1], () => { S.activity = 'all'; });
  S.cities.forEach(c => tag(c, () => { S.cities = S.cities.filter(x => x !== c); }));
  S.languages.forEach(c => tag(c, () => { S.languages = S.languages.filter(x => x !== c); }));
  S.communities.forEach(c => tag(c, () => { S.communities = S.communities.filter(x => x !== c); }));
  if (S.folder) tag(S.folder === '_none' ? 'No folder' : `Folder: ${D.folderById.get(S.folder)?.name || ''}`, () => { S.folder = ''; });
  return h('div', { class: 'ftags', 'data-id': 'contacts.active-filters' }, tags,
    h('button', { type: 'button', class: 'linkish', 'data-id': 'contacts.clear-filters', onClick: () => { clearFilters(); refresh(); } }, 'Clear filters'));
}

// Typing in search redraws only the results so the keyboard stays open.
function redrawBody() {
  saveScrolls();
  let fresh;
  if (layout() === 'desk') {
    const old = root.querySelector('.ct-dir');
    fresh = directory(visible(), 'desk', deskPick); fresh.dataset.keep = 'd-dir';
    old.replaceWith(fresh);
  } else {
    fresh = phoneBody(layout());
    root.querySelector('.ct-body').replaceWith(fresh);
  }
  const v = visible();
  const cnt = root.querySelector('[data-id="contacts.count"]'); if (cnt) cnt.textContent = `${v.total} shown`;
  const old = root.querySelector('[data-id="contacts.active-filters"]'), nf = activeFilters();
  if (old && nf) old.replaceWith(nf); else if (old) old.remove(); else if (nf) root.querySelector('.ct-tools').append(nf);
  restoreScrolls(fresh);
}

// ---------- directory ----------
function emptyState() {
  if (!D.contacts.length) return h('p', { class: 'empty', 'data-id': 'contacts.empty' }, 'No contacts yet. Tap “Add Shadchan”, or load demo contacts in Settings.');
  return h('div', { class: 'empty', 'data-id': 'contacts.no-match' }, h('p', {}, 'No contacts match these filters.'),
    h('button', { class: 'btn small', type: 'button', onClick: () => { clearFilters(); refresh(); } }, 'Clear filters'));
}

// variant: 'dir' (two-line rows) · 'rail' (compact) · 'rows' (avatar rows; inbox/list) · 'desk' (rich rows)
function directory(v, variant, onPick, extra) {
  const wrap = h('div', { class: `ct-dir dir-${variant}`, role: 'list', 'data-id': 'contacts.directory' });
  if (!v.total) { wrap.append(emptyState()); return wrap; }
  const group = (label, items, id) => {
    if (!items.length) return;
    wrap.append(h('div', { class: 'dir-group', 'data-id': id }, h('span', {}, label), h('span', {}, items.length)));
    for (const c of items) { wrap.append(dirRow(c, variant, onPick)); if (extra) { const ex = extra(c); if (ex) wrap.append(ex); } }
  };
  group('Pinned', v.pinned, 'contacts.pinned');
  group(v.pinned.length ? 'All contacts' : 'Contacts', v.rest, 'contacts.list');
  return wrap;
}

function dirRow(c, variant, onPick) {
  const x = D.x.get(c.id);
  const sel = S.selectedId === c.id;
  const when = x.last ? shortDate(x.last) : '';
  const st = STATUS_LABEL[c.status];
  const attrs = { class: 'dir-row', role: 'listitem', 'data-cid': c.id, 'data-id': 'contacts.row', 'aria-current': sel ? 'true' : 'false', type: 'button' };
  let inner;
  if (variant === 'rail') {
    inner = [h('b', { dir: 'auto' }, c.firstName || c.name || store.displayName(c)), h('small', { dir: 'auto' }, c.lastName || ''), when ? h('small', { class: 'mono' }, when) : null];
  } else if (variant === 'rows') {
    inner = [h('div', { class: 'avatar' }, store.initials(c)),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', dir: 'auto' }, store.displayName(c)),
        h('div', { class: 'row-sub', dir: 'auto' }, [c.city, (c.roles || []).map(roleLabel).join(', ')].filter(Boolean).join(' · ') || 'Not recorded')),
      h('div', { class: 'row-end' }, when ? h('span', { class: 'when' }, when) : null, st ? h('span', { class: 'status-pill ' + c.status }, st) : null)];
  } else {
    const desk = variant === 'desk';
    inner = [h('span', { class: 'dr-top' }, h('b', { dir: 'auto' }, store.displayName(c)), desk && when ? h('span', { class: 'when' }, when) : null),
      h('small', { dir: 'auto' }, [c.city || 'City not recorded', desk ? (c.roles || []).map(roleLabel).join(', ') : when].filter(Boolean).join(' · ')),
      variant === 'desk' && x.latest ? h('small', { class: 'snippet', dir: 'auto' }, h('span', { class: 'via' }, store.eventTypeLabel(x.latest.type)), ' ', x.latest.text) : null,
      variant === 'desk' && (st || x.open.length) ? h('small', { class: 'next' }, statusText(c)) : null];
  }
  if (variant === 'rows' && onPick === 'link') return h('a', { ...attrs, type: null, href: `#/contacts/${encodeURIComponent(c.id)}` }, inner);
  return h('button', { ...attrs, onClick: () => onPick(c) }, inner);
}

function markSelected(scope) {
  scope.querySelectorAll('.dir-row').forEach(el => el.setAttribute('aria-current', el.dataset.cid === S.selectedId ? 'true' : 'false'));
}

// Selecting keeps the directory exactly where it is; only the person areas redraw.
function select(c, scope, panes) {
  S.selectedId = c.id;
  markSelected(scope);
  panes();
}

// ---------- phone views ----------
function drawPhone(lay) {
  root.classList.add('lay-' + lay);
  root.append(head(), tools(), phoneBody(lay));
  restoreScrolls();
  if (lay === 'list' || lay === 'inbox') requestAnimationFrame(() => window.scrollTo(0, S.pageScroll || 0));
  if (lay === 'tabs') requestAnimationFrame(() => root.querySelector('.dir-row[aria-current="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }));
}

function phoneBody(lay) {
  const v = visible();
  const body = h('div', { class: `ct-body body-${lay}`, 'data-id': 'contacts.body' });
  if (lay === 'a') {
    ensureSelection(v.all);
    const quick = h('div', { class: 'a-quick', 'data-keep': 'a-quick', 'data-id': 'contacts.quick-info' });
    const lower = h('div', { class: 'a-activity', 'data-id': 'contacts.activity' });
    const fill = () => {
      const p = D.byId.get(S.selectedId);
      quick.innerHTML = ''; lower.innerHTML = '';
      if (p) quick.append(h('h2', { dir: 'auto' }, store.displayName(p)), h('div', { class: 'sub', dir: 'auto' }, nameLine(p)), quickFacts(p, 'contacts.quick'));
      else quick.append(h('p', { class: 'note' }, 'Pick a name.'));
      lower.append(personBlock(p));
      quick.scrollTop = 0;
    };
    const dir = directory(v, 'dir', (p) => select(p, dir, fill));
    dir.dataset.keep = 'a-dir';
    body.append(h('div', { class: 'a-upper' }, dir, quick), lower);
    fill();
  } else if (lay === 'split') {
    ensureSelection(v.all);
    const lowerPane = h('div', { class: 's-lower', 'data-keep': 's-lower', 'data-id': 'contacts.split-lower' });
    const fill = () => { lowerPane.innerHTML = ''; lowerPane.append(personBlock(D.byId.get(S.selectedId), { facts: true })); lowerPane.scrollTop = 0; };
    const dir = directory(v, 'dir', (p) => select(p, dir, fill));
    dir.dataset.keep = 's-dir';
    const upper = h('div', { class: 's-upper', style: `height:${store.getPrefs().contactsSplit}px` }, dir);
    body.append(h('div', { class: 's-wrap' }, upper, splitter(upper), lowerPane));
    fill();
  } else if (lay === 'rail') {
    ensureSelection(v.all);
    const main = h('div', { class: 'r-main', 'data-keep': 'r-main', 'data-id': 'contacts.rail-main' });
    const fill = () => { main.innerHTML = ''; main.append(personBlock(D.byId.get(S.selectedId), { facts: true })); main.scrollTop = 0; };
    const dir = directory(v, 'rail', (p) => select(p, dir, fill));
    dir.dataset.keep = 'r-dir';
    body.append(h('div', { class: 'r-wrap' }, dir, main));
    fill();
  } else if (lay === 'tabs') {
    ensureSelection(v.all);
    const main = h('div', { class: 't-main', 'data-id': 'contacts.tabs-main' });
    const fill = () => { main.innerHTML = ''; main.append(personBlock(D.byId.get(S.selectedId), { facts: true })); };
    const strip = h('div', { class: 't-strip', 'data-keep': 't-strip', 'data-axis': 'x', role: 'tablist', 'data-id': 'contacts.name-tabs' });
    if (!v.total) strip.append(emptyState());
    for (const c of v.all) strip.append(h('button', { type: 'button', class: 'dir-row t-tab', 'data-cid': c.id, 'data-id': 'contacts.row', role: 'tab', 'aria-current': S.selectedId === c.id ? 'true' : 'false',
      onClick: (e) => { select(c, strip, fill); e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); } },
      c.pinned ? ico('pin') : null, h('span', { dir: 'auto' }, store.displayName(c))));
    body.append(strip, main);
    fill();
  } else if (lay === 'list') {
    const dir = directory(v, 'rows', (c) => {
      S.expandedId = S.expandedId === c.id ? null : c.id; S.selectedId = c.id;
      saveScrolls(); const y = window.scrollY;
      const nb = phoneBody('list'); body.replaceWith(nb); window.scrollTo(0, y);
      nb.querySelector('.dir-row[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    }, (c) => S.expandedId === c.id ? h('div', { class: 'l-open', 'data-id': 'contacts.inline-detail' }, personBlock(c, { facts: true })) : null);
    dir.querySelectorAll('.dir-row').forEach(el => el.setAttribute('aria-expanded', el.dataset.cid === S.expandedId ? 'true' : 'false'));
    body.append(dir);
  } else { // inbox
    body.append(directory(v, 'rows', 'link'));
  }
  return body;
}

// Drag (or arrow keys) to change the top/bottom split; remembered on this phone.
function splitter(upper) {
  const bar = h('div', { class: 's-bar', role: 'separator', tabindex: '0', 'aria-orientation': 'horizontal', 'aria-label': 'Drag to resize', 'data-id': 'contacts.split-bar' }, h('i'));
  const clamp = (n) => Math.max(120, Math.min(window.innerHeight * 0.7, n));
  let startY = 0, startH = 0;
  const save = () => store.setPref('contactsSplit', Math.round(upper.offsetHeight));
  bar.addEventListener('pointerdown', (e) => { startY = e.clientY; startH = upper.offsetHeight; bar.setPointerCapture(e.pointerId); bar.classList.add('drag'); });
  bar.addEventListener('pointermove', (e) => { if (bar.classList.contains('drag')) upper.style.height = clamp(startH + e.clientY - startY) + 'px'; });
  const end = () => { if (bar.classList.contains('drag')) { bar.classList.remove('drag'); save(); } };
  bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); upper.style.height = clamp(upper.offsetHeight + (e.key === 'ArrowUp' ? -24 : 24)) + 'px'; save(); }
  });
  return bar;
}

// ---------- inbox drill-down levels ----------
function backBar(href, label, dataId) {
  return h('div', { class: 'page-head' },
    h('a', { class: 'icon-btn', href, 'data-id': dataId, 'aria-label': label, html: icon('back') }),
    h('span', { class: 'back-label' }, label));
}

function drawInboxDetail() {
  const c = D.byId.get(routeId);
  root.classList.add('lay-inbox-detail');
  if (!c) { root.append(backBar('#/contacts', 'Contacts', 'contact.back'), h('p', { class: 'empty' }, 'This contact no longer exists.')); return; }
  root.append(backBar('#/contacts', 'Contacts', 'contact.back'), personBlock(c, { facts: true, historyLimit: 3, historyLink: true }));
}

function drawHistory() {
  const c = D.byId.get(routeId);
  const back = layout() === 'inbox' ? `#/contacts/${encodeURIComponent(routeId)}` : '#/contacts';
  root.append(backBar(back, c ? store.displayName(c) : 'Contacts', 'history.back'));
  if (!c) { root.append(h('p', { class: 'empty' }, 'This contact no longer exists.')); return; }
  const evs = D.evBy.get(c.id) || [];
  root.append(h('h1', { class: 'hist-title' }, 'Full conversation'),
    evs.length ? h('ol', { class: 'timeline', 'data-id': 'history.list' }, evs.map((e, i) => eventItem(e, c, i === 0)))
      : h('p', { class: 'empty' }, 'No conversation recorded in the app yet.'));
}

// ---------- desktop three-area view ----------
function drawDesk() {
  root.append(deskBody());
  restoreScrolls();
}
function deskBody() {
  const v = visible();
  ensureSelection(v.all);
  const record = h('div', { class: 'd-record', 'data-keep': 'd-record', 'data-id': 'contacts.record' });
  const fill = () => { record.innerHTML = ''; record.append(personBlock(D.byId.get(S.selectedId), { facts: true })); record.scrollTop = 0; };
  deskPick = (p) => select(p, root.querySelector('.d-explorer'), fill);
  const dir = directory(v, 'desk', deskPick);
  dir.dataset.keep = 'd-dir';
  const explorer = h('div', { class: 'd-explorer', 'data-id': 'contacts.explorer' }, head(), tools(), dir);
  fill();
  return h('div', { class: 'ct-body body-desk' }, explorer, record);
}

