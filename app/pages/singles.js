// Guys and Girls (Shadchan Mode) — one page, shown once per bottom-bar tab (design.md 6.2).
// Stage S2: search over everything (incl. pasted originals), Working on / All, filters as
// removable tags, rows loaded while scrolling, To file. The data comes from one in-memory index
// in singles-data.js, so typing stays quick with 3,000 singles.
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog, sheet, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { peopleListPath, rememberList } from '../js/mode.js';
import { openDrafts, dropDraft } from './person-form.js';
import { dateOnly } from './people-data.js';
import { KIND_WORDS, STATUSES, statusLabel, summaryLine, toFile, singlesIndex, emptyFilters, filterCount, applyFilters, filterOptions, snippet, norm } from './singles-data.js';

// Words on this page, in one place (other languages later).
const T = {
  empty: (w) => `No ${w.many} saved yet.`,
  emptyHint: 'Add the first one, or load 60 fictional singles to look around. They can be removed any time in Settings.',
  demoBtn: 'Try the demo',
  demoDone: (n) => (n ? `Demo loaded: ${n} singles` : 'The demo is already loaded'),
  draftsHead: (n) => `Not saved yet · ${n}`,
  draftSub: 'Unsaved form — tap to continue',
  discard: 'Discard',
  toFileHead: (n) => `To file · ${n}`,
  toFileNote: 'Profiles kept exactly as they arrived. Open one to file it.',
  toFileAll: (n) => `Show all ${n}`,
  toFileLess: 'Show fewer',
  noSender: 'sender not recorded',
  attached: 'Attached file',
  del: 'Delete',
  unmarkedHead: (n) => `Not marked Guy or Girl · ${n}`,
  more: 'Show more',
  working: 'Working on',
  all: 'All',
  search: 'Search any word, also inside originals…',
  filters: 'Filters',
  clear: 'Clear filters',
  noMatch: (w) => `No ${w.many} match.`,
  noWorking: (w) => `No ${w.many} marked Working on yet. Open one and tap the star.`,
  shown: (n, all) => (n === all ? `${all}` : `${n} of ${all}`),
  noAgeHead: (n) => `Age not recorded · ${n}`,
  noAgeNote: 'Shown apart, never hidden: the age filter cannot tell.',
  inOriginal: 'in original:',
  openShidduch: 'Open shidduch',
  age: (a, b) => (a && b ? `Age ${a}–${b}` : a ? `Age ${a} and up` : `Age up to ${b}`),
};
const PAGE = 40; // rows drawn at a time; more come while scrolling
const TOFILE_FEW = 3;
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const firstLine = (t) => (t || '').trim().split('\n').find(l => l.trim())?.trim().slice(0, 80) || '';

let root = null, gen = 0, unsub = null, timer = 0, kind = 'guy', IDX = null, observer = null;
// Survive leaving the page: filters, how many rows are drawn, To file open or not.
const F = { guy: emptyFilters(), girl: emptyFilters() };
const shown = { guy: PAGE, girl: PAGE };
const tfOpen = { guy: false, girl: false };

export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); observer && observer.disconnect(); observer = null; }

export async function render(container, params, path) {
  // Shared pages go back to "/people": that is Guys or Girls here, whichever was used last in Add Person.
  if (!path.startsWith('/guys') && !path.startsWith('/girls')) { navigate(peopleListPath(store.getPrefs().personKind), { replace: true }); return; }
  root = container;
  kind = path.startsWith('/girls') ? 'girl' : 'guy';
  rememberList(kind);
  root.classList.add('singles-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(draw, 80); } });
  await draw();
}

async function draw() {
  const token = ++gen;
  const [idx, later] = await Promise.all([singlesIndex(), toFile(kind)]);
  if (token !== gen || !root) return;
  IDX = idx;
  const w = KIND_WORDS[kind];
  const drafts = openDrafts();
  const unmarked = idx.rows.filter(r => r.kind !== 'guy' && r.kind !== 'girl');
  const mine = idx.rows.some(r => r.kind === kind);
  const y = window.scrollY;

  root.innerHTML = '';
  root.append(...[
    h('div', { class: 'page-head' },
      h('h1', { 'data-id': 'singles.title' }, w.title, h('span', { class: 'sg-count', 'data-id': 'singles.count' }, '')),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'singles.add-btn', onClick: () => { store.setPref('personKind', kind); navigate('/people/new'); } }, w.add)),

    mine ? tools() : null,

    drafts.length ? h('section', { class: 'section', 'data-id': 'singles.drafts' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.draftsHead(drafts.length))),
      drafts.map(x => h('div', { class: 'row-link' },
        h('a', { class: 'row-main', href: x.href, 'data-id': 'singles.draft-open' },
          h('div', { class: 'row-title', dir: 'auto' }, x.editing ? `Editing ${x.name}` : x.name),
          h('div', { class: 'row-sub' }, T.draftSub)),
        h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'singles.draft-discard', onClick: async () => {
          if (await confirmDialog({ title: 'Discard this unsaved form?', text: 'Only the unsaved typing is lost. Saved people stay.', ok: T.discard, danger: true, dataId: 'singles.draft-dialog' })) { dropDraft(x.key); draw(); }
        } }, T.discard)))) : null,

    later.length ? toFileSection(later) : null,

    mine ? h('section', { class: 'section sg-results', 'data-id': 'singles.list' })
      : h('section', { class: 'section', 'data-id': 'singles.list' },
        h('div', { class: 'empty', 'data-id': 'singles.empty' }, h('p', {}, T.empty(w)),
          idx.total ? null : [h('p', { class: 'note' }, T.emptyHint),
            h('button', { type: 'button', class: 'btn', 'data-id': 'singles.try-demo', onClick: async (e) => { e.currentTarget.disabled = true; toast(T.demoDone(await store.loadFullDemo())); } }, T.demoBtn)])),

    unmarked.length ? h('section', { class: 'section', 'data-id': 'singles.unmarked' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.unmarkedHead(unmarked.length))),
      unmarked.map(r => personRow(r, ''))) : null,
  ].filter(Boolean));
  if (mine) drawResults(); else root.querySelector('[data-id="singles.count"]').textContent = '0';
  window.scrollTo(0, y);
}

// ---------- search, Working on / All, filters ----------
function tools() {
  const f = F[kind], n = filterCount(f);
  return h('div', { class: 'ct-tools sg-tools', 'data-id': 'singles.tools' },
    h('div', { class: 'ct-search' }, ico('search'),
      h('input', { class: 'input', type: 'search', value: f.q, placeholder: T.search, 'aria-label': 'Search', 'data-id': 'singles.search', dir: 'auto',
        onInput: (e) => { f.q = e.target.value; shown[kind] = PAGE; drawResults(); } })),
    h('div', { class: 'ct-bar' },
      h('div', { class: 'sg-scope', role: 'radiogroup', 'aria-label': 'Show', 'data-id': 'singles.scope' },
        [['working', T.working], ['all', T.all]].map(([v, l]) => h('button', { type: 'button', class: 'bubble', role: 'radio', 'aria-checked': f.scope === v ? 'true' : 'false', 'aria-pressed': f.scope === v ? 'true' : 'false', 'data-id': 'singles.scope-' + v,
          onClick: () => { f.scope = v; shown[kind] = PAGE; refreshTools(); drawResults(); } }, v === 'working' ? h('span', { class: 'sg-star', html: icon('star') }) : null, l, h('span', { class: 'sg-scope-n', 'data-n': v }, '')))),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn small icon-only', type: 'button', 'data-id': 'singles.filter-btn', 'aria-label': n ? `Filters, ${n} on` : T.filters, title: T.filters, 'aria-pressed': n ? 'true' : 'false',
        onClick: async () => { await filtersSheet(); shown[kind] = PAGE; refreshTools(); drawResults(); } }, ico('filter'), n ? String(n) : null)),
    activeTags());
}

function refreshTools() {
  const old = root?.querySelector('[data-id="singles.tools"]');
  if (!old) return;
  const q = old.querySelector('input'), focused = document.activeElement === q;
  const fresh = tools(); old.replaceWith(fresh);
  if (focused) fresh.querySelector('input').focus();
}

function activeTags() {
  const f = F[kind];
  const tags = [];
  const tag = (label, clear) => tags.push(h('button', { type: 'button', class: 'ftag', title: 'Remove this filter', dir: 'auto', onClick: () => { clear(); shown[kind] = PAGE; refreshTools(); drawResults(); } }, label, h('span', { class: 'ftag-x' }, 'remove')));
  if (f.q.trim()) tag(`“${f.q.trim()}”`, () => { f.q = ''; });
  if (f.ageFrom || f.ageTo) tag(T.age(f.ageFrom, f.ageTo), () => { f.ageFrom = ''; f.ageTo = ''; });
  f.statuses.forEach(s => tag(statusLabel(s), () => { f.statuses = f.statuses.filter(x => x !== s); }));
  f.cities.forEach(c => tag(c, () => { f.cities = f.cities.filter(x => x !== c); }));
  f.backgrounds.forEach(c => tag(c, () => { f.backgrounds = f.backgrounds.filter(x => x !== c); }));
  f.languages.forEach(c => tag(c, () => { f.languages = f.languages.filter(x => x !== c); }));
  if (!tags.length) return null;
  return h('div', { class: 'ftags', 'data-id': 'singles.active-filters' }, tags,
    h('button', { type: 'button', class: 'linkish', 'data-id': 'singles.clear-filters', onClick: () => { clearAll(); refreshTools(); drawResults(); } }, T.clear));
}
const clearAll = () => { const s = F[kind].scope; F[kind] = { ...emptyFilters(), scope: s }; shown[kind] = PAGE; };

async function filtersSheet() {
  const f = F[kind];
  const o = filterOptions(IDX.rows, kind);
  const grp = (label, node) => h('div', { class: 'field filter-group' }, h('label', {}, label), node);
  const num = (key, label, dataId) => h('input', { class: 'input tiny', type: 'number', min: 0, max: 120, inputmode: 'numeric', value: f[key], placeholder: label, 'aria-label': 'Age ' + label, 'data-id': dataId, onInput: (e) => { f[key] = e.target.value.trim(); } });
  const body = () => [
    grp('Age', h('div', { class: 'sg-age-row' }, num('ageFrom', 'from', 'singles.filter-age-from'), h('span', {}, 'to'), num('ageTo', 'to', 'singles.filter-age-to'))),
    h('p', { class: 'note' }, 'Singles with no age recorded are listed apart, never hidden.'),
    grp('Status', bubbles({ options: STATUSES, selected: f.statuses, dataId: 'singles.filter-status', onChange: v => { f.statuses = v; } })),
    o.cities.length ? grp('City', bubbles({ options: o.cities.map(v => [v, v]), selected: f.cities, dataId: 'singles.filter-city', onChange: v => { f.cities = v; } })) : null,
    o.backgrounds.length ? grp('Background', bubbles({ options: o.backgrounds.map(v => [v, v]), selected: f.backgrounds, dataId: 'singles.filter-background', onChange: v => { f.backgrounds = v; } })) : null,
    o.languages.length ? grp('Languages', bubbles({ options: o.languages.map(v => [v, v]), selected: f.languages, dataId: 'singles.filter-language', onChange: v => { f.languages = v; } })) : null,
    h('p', { class: 'note' }, 'Several choices in one group show singles matching any of them. Groups combine.'),
  ].filter(Boolean);
  const wrap = h('div', { class: 'filters-body' }, body());
  await sheet({ title: T.filters, dataId: 'singles.filters', className: 'tall', body: wrap,
    actions: [
      { id: 'clear', label: T.clear, run: () => { const q = f.q, s = f.scope; Object.assign(f, emptyFilters(), { q, scope: s }); wrap.innerHTML = ''; wrap.append(...body()); return false; } },
      { id: 'done', label: 'Show ' + KIND_WORDS[kind].many, primary: true }] });
}

// ---------- results (redrawn alone while typing, so the keyboard stays open) ----------
function drawResults() {
  const box = root?.querySelector('.sg-results');
  if (!box || !IDX) return;
  const f = F[kind], w = KIND_WORDS[kind];
  const { shown: list, noAge, working, all } = applyFilters(IDX.rows, kind, f);
  root.querySelector('[data-id="singles.count"]').textContent = T.shown(list.length + noAge.length, all);
  root.querySelectorAll('.sg-scope-n').forEach(el => { el.textContent = String(el.dataset.n === 'working' ? working : all); });

  observer && observer.disconnect(); observer = null;
  box.innerHTML = '';
  if (!list.length && !noAge.length) {
    box.append(h('div', { class: 'empty', 'data-id': 'singles.no-match' },
      h('p', {}, f.scope === 'working' && !working ? T.noWorking(w) : T.noMatch(w)),
      filterCount(f) || f.q ? h('button', { class: 'btn small', type: 'button', 'data-id': 'singles.no-match-clear', onClick: () => { clearAll(); refreshTools(); drawResults(); } }, T.clear) : null));
    return;
  }
  // One long list: the matching rows, then (age filter on) the ones with no age. Drawn in pages.
  const seq = [...list.map(r => ['row', r]), ...(noAge.length ? [['head', null], ...noAge.map(r => ['row', r])] : [])];
  let n = 0;
  const more = h('button', { type: 'button', class: 'btn sg-more', 'data-id': 'singles.more', onClick: () => add() }, T.more);
  const add = () => {
    const end = Math.min(seq.length, n + PAGE);
    const frag = document.createDocumentFragment();
    for (; n < end; n++) {
      const [t, r] = seq[n];
      frag.append(t === 'head'
        ? h('div', { class: 'section-head sg-noage', 'data-id': 'singles.no-age' }, h('div', { class: 'eyebrow' }, T.noAgeHead(noAge.length)), h('p', { class: 'note' }, T.noAgeNote))
        : personRow(r, f.q));
    }
    more.before(frag);
    shown[kind] = Math.max(shown[kind], n);
    if (n >= seq.length) { more.remove(); observer && observer.disconnect(); observer = null; }
  };
  box.append(more);
  n = 0; const want = shown[kind];
  while (n < Math.min(want, seq.length)) add();
  if (n < seq.length && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) add(); }, { rootMargin: '600px 0px' });
    observer.observe(more);
  }
}

function personRow(r, q) {
  const p = r.p, st = r.status;
  const name = store.personName(p);
  const hit = !!(q && q.trim()) && foundOnlyInOriginal(r, q);
  return h('a', { class: 'row-link sg-row' + (st === 'available' ? '' : ' sg-quiet'), href: `#/people/${encodeURIComponent(p.id)}`, 'data-id': 'singles.row' },
    h('div', { class: 'avatar' }, store.initials(p)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, h('span', { class: 'sg-name' }, name),
        p.starred ? h('span', { class: 'sg-star', title: T.working, 'aria-label': T.working, 'data-id': 'singles.row-star', html: icon('star') }) : null,
        r.open ? h('span', { class: 'sg-open', title: T.openShidduch, 'aria-label': T.openShidduch, 'data-id': 'singles.row-open' }) : null),
      h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(p)),
      hit ? h('div', { class: 'row-sub sg-snip', dir: 'auto', 'data-id': 'singles.row-snippet' }, h('span', { class: 'muted' }, T.inOriginal + ' '), snippet(r, q)) : null),
    st === 'available' ? null : h('span', { class: 'chip sg-status', 'data-id': 'singles.row-status' }, statusLabel(st)));
}
// True when the search words are not in the record's own fields, only in the pasted original.
function foundOnlyInOriginal(r, q) {
  if (!r.orig) return false;
  const p = r.p;
  const own = norm([p.name, p.age, p.city, p.occupation, p.about, p.looking, ...(p.languages || [])].join(' '));
  return !norm(q).split(/\s+/).filter(Boolean).every(w => own.includes(w)) && !!snippet(r, q);
}

// ---------- To file ----------
function toFileSection(later) {
  const open = tfOpen[kind];
  const list = open ? later : later.slice(0, TOFILE_FEW);
  return h('section', { class: 'section', 'data-id': 'singles.to-file' },
    h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.toFileHead(later.length))),
    h('p', { class: 'note' }, T.toFileNote),
    list.map(s => h('div', { class: 'row-link' },
      h('div', { class: 'avatar', html: icon('file') }),
      h('a', { class: 'row-main', href: `#/people/new/from/${encodeURIComponent(s.id)}`, 'data-id': 'singles.to-file-open', onClick: () => store.setPref('personKind', kind) },
        h('div', { class: 'row-title', dir: 'auto' }, firstLine(s.text) || T.attached),
        h('div', { class: 'row-sub', dir: 'auto' }, [s.sender ? 'from ' + s.sender : T.noSender, dateOnly(s.receivedAt || s.createdAt)].join(' · '))),
      h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'singles.to-file-delete', onClick: async () => {
        if (!(await confirmDialog({ title: 'Delete this saved profile?', text: 'The text and any files kept with it go to Recently deleted for 30 days.', ok: T.del, danger: true, dataId: 'singles.to-file-dialog' }))) return;
        await store.asOne(async () => {
          // Rare action: files of an unfiled original have no person yet, so no index leads to them.
          for (const a of await store.attachments.list()) if (a.sourceId === s.id) await store.attachments.remove(a.id);
          await store.sources.remove(s.id);
        });
        toast('Deleted');
      } }, T.del))),
    later.length > TOFILE_FEW ? h('button', { type: 'button', class: 'linkish', 'data-id': 'singles.to-file-all', onClick: () => { tfOpen[kind] = !open; draw(); } }, open ? T.toFileLess : T.toFileAll(later.length)) : null);
}
