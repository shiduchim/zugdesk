// Find a match (Shadchan Mode, spec/shadchan/design.md 6.2, stage S5). Route: #/match/<single id>.
// Top: the single in three lines with what they are looking for. Below: singles of the other kind,
// already narrowed by what is recorded (age range, Available); the narrowing shows as removable tags.
// Each row says what already happened between the two. Already tried and Not a fit sink to the
// bottom; "Age not recorded" is its own group. Tapping a row shows both profiles, then Save as idea
// or Not a fit. Uses the one in-memory singles index (singles-data.js) and never reads the store per row.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { KIND_WORDS, STATUSES, statusOf, statusLabel, summaryLine, singlesIndex, emptyFilters, filterCount, applyFilters, filterOptions, notFitOf, setNotFit, ageNotes } from './singles-data.js';
import * as sd from './sh-shidduch-data.js';

const T = {
  title: 'Find a match',
  back: 'Back to the card',
  gone: 'This single was removed.',
  noKind: 'Mark this single as Guy or Girl first (Edit), then Find a match can look.',
  lookingFor: 'Looking for',
  ages: (a, b) => (a && b ? `ages ${a}–${b}` : a ? `age ${a} and up` : b ? `up to age ${b}` : ''),
  noWish: 'nothing recorded yet',
  search: (w) => `Search ${w}: any word…`,
  filters: 'Filters',
  clear: 'Clear filters',
  age: (a, b) => (a && b ? `Age ${a}–${b}` : a ? `Age ${a} and up` : `Age up to ${b}`),
  count: (n) => `${n} to look at`,
  noneLeft: (w) => `No ${w} left to look at with these filters.`,
  noneSaved: (w) => `No ${w} saved yet.`,
  noAgeHead: (n) => `Age not recorded · ${n}`,
  triedHead: (n) => `Already tried · ${n}`,
  notFitHead: (n) => `Not a fit · ${n}`,
  showNotFit: 'Show them', hideNotFit: 'Hide them',
  more: 'Show more',
  notFitLine: (r, at) => `Not a fit${r ? ': ' + r : ''}${at ? ' · ' + at : ''}`,
  // compare sheet
  compare: 'Both profiles',
  wantsAges: 'Looking for ages',
  facts: { level: 'Religious level', background: 'Background', languages: 'Languages', about: 'About', looking: 'Looking for' },
  notRecorded: 'not recorded',
  saveIdea: 'Save as idea',
  notFit: 'Not a fit',
  openIt: 'Open the shidduch',
  unNotFit: 'Take off Not a fit',
  ideaSaved: 'Idea saved',
  open: 'Open',
  notFitTitle: 'Not a fit',
  notFitLead: (a, b) => `${a} and ${b} will sink to the bottom, so you do not look at them twice. You can take it off later.`,
  reason: 'Reason (optional)',
  reasonPh: 'Only for you',
  notFitSave: 'Mark not a fit',
  notFitDone: 'Marked not a fit',
  notFitOff: 'Taken off Not a fit',
  undo: 'Undo', undone: 'Last change undone',
};
const PAGE = 40;
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const firstSentence = (s) => String(s || '').split(/(?<=[.!?])\s/)[0].trim();

let root = null, gen = 0, unsub = null, timer = 0, single = null, IDX = null;
// Filters per single, kept while the app is open (coming back from a profile keeps them).
const F = new Map();
let shown = PAGE, showNotFit = false;

export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params) {
  root = container;
  root.classList.add('singles-page', 'shm-page');
  const id = params.id;
  if (single !== id) { single = id; shown = PAGE; showNotFit = false; }
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (['people', 'offers', 'tries', 'sources', '*'].includes(ch.store)) { clearTimeout(timer); timer = setTimeout(() => draw(true), 80); } });
  await draw();
}

const startFilters = (p) => ({ ...emptyFilters(), ageFrom: p.minAge || '', ageTo: p.maxAge || '', statuses: ['available'] });

async function draw(keep = false) {
  const token = ++gen;
  const all = await sd.loadAll();
  if (token !== gen || !root) return;
  IDX = all.idx;
  const p = IDX.people.get(single);
  const y = window.scrollY;
  root.innerHTML = '';
  const backHref = `#/people/${encodeURIComponent(single)}`;
  root.append(h('div', { class: 'page-head shm-head' },
    h('a', { class: 'sh-back', href: backHref, 'data-id': 'match.back' }, ico('back'), T.back),
    h('h1', { 'data-id': 'match.title' }, T.title)));
  if (!p) { root.append(h('p', { class: 'empty' }, T.gone)); return; }
  if (p.kind !== 'guy' && p.kind !== 'girl') { root.append(h('p', { class: 'empty', 'data-id': 'match.no-kind' }, T.noKind)); return; }
  if (!F.has(single)) F.set(single, startFilters(p));
  const pairs = new Map(all.list.map(m => [m.o.guyId + '|' + m.o.girlId, m]));
  const ctx = { p, k: sd.other(p.kind), pairs };
  ctx.pairOf = (c) => pairs.get(p.kind === 'guy' ? p.id + '|' + c.id : c.id + '|' + p.id) || null;

  const wish = [T.ages(p.minAge, p.maxAge), firstSentence(p.looking)].filter(Boolean).join(' · ');
  root.append(
    h('section', { class: 'shm-top', 'data-id': 'match.single' },
      h('div', { class: 'avatar' }, store.initials(p)),
      h('div', { class: 'row-main' },
        h('a', { class: 'row-title shm-name', href: backHref, dir: 'auto', 'data-id': 'match.single-name' }, store.personName(p)),
        h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(p)),
        h('div', { class: 'row-sub', dir: 'auto', 'data-id': 'match.looking' }, h('strong', {}, T.lookingFor + ': '), wish || h('span', { class: 'muted' }, T.noWish)))),
    tools(ctx),
    h('section', { class: 'section sg-results', 'data-id': 'match.list' }));
  drawResults(ctx);
  if (keep) window.scrollTo(0, y);
}

// ---------- search and filters (the starting narrowing shows as tags that can be removed) ----------
function tools(ctx) {
  const f = F.get(single), n = filterCount(f), w = KIND_WORDS[ctx.k];
  return h('div', { class: 'ct-tools sg-tools', 'data-id': 'match.tools' },
    h('div', { class: 'ct-bar' },
      h('div', { class: 'ct-search grow' }, ico('search'),
        h('input', { class: 'input', type: 'search', value: f.q, placeholder: T.search(w.many), 'aria-label': 'Search', 'data-id': 'match.search', dir: 'auto',
          onInput: (e) => { f.q = e.target.value; shown = PAGE; drawResults(ctx); } })),
      h('button', { class: 'btn small icon-only', type: 'button', 'data-id': 'match.filter-btn', 'aria-label': n ? `Filters, ${n} on` : T.filters, title: T.filters, 'aria-pressed': n ? 'true' : 'false',
        onClick: async () => { await filtersSheet(ctx); shown = PAGE; redrawTools(ctx); drawResults(ctx); } }, ico('filter'), n ? String(n) : null)),
    tags(ctx));
}
function redrawTools(ctx) {
  const old = root?.querySelector('[data-id="match.tools"]');
  if (!old) return;
  const q = old.querySelector('input'), focused = document.activeElement === q;
  const fresh = tools(ctx); old.replaceWith(fresh);
  if (focused) fresh.querySelector('input').focus();
}
function tags(ctx) {
  const f = F.get(single), out = [];
  const tag = (label, clear) => out.push(h('button', { type: 'button', class: 'ftag', title: 'Remove this filter', dir: 'auto', onClick: () => { clear(); shown = PAGE; redrawTools(ctx); drawResults(ctx); } }, label, h('span', { class: 'ftag-x' }, 'remove')));
  if (f.ageFrom || f.ageTo) tag(T.age(f.ageFrom, f.ageTo), () => { f.ageFrom = ''; f.ageTo = ''; });
  f.statuses.forEach(s => tag(statusLabel(s), () => { f.statuses = f.statuses.filter(x => x !== s); }));
  f.cities.forEach(c => tag(c, () => { f.cities = f.cities.filter(x => x !== c); }));
  f.backgrounds.forEach(c => tag(c, () => { f.backgrounds = f.backgrounds.filter(x => x !== c); }));
  f.languages.forEach(c => tag(c, () => { f.languages = f.languages.filter(x => x !== c); }));
  if (!out.length) return null;
  return h('div', { class: 'ftags', 'data-id': 'match.active-filters' }, out,
    h('button', { type: 'button', class: 'linkish', 'data-id': 'match.clear-filters', onClick: () => { F.set(single, { ...emptyFilters(), q: f.q }); shown = PAGE; redrawTools(ctx); drawResults(ctx); } }, T.clear));
}
async function filtersSheet(ctx) {
  const f = F.get(single), o = filterOptions(IDX.rows, ctx.k);
  const grp = (label, node) => h('div', { class: 'field filter-group' }, h('label', {}, label), node);
  const num = (key, label, dataId) => h('input', { class: 'input tiny', type: 'number', min: 0, max: 120, inputmode: 'numeric', value: f[key], placeholder: label, 'aria-label': 'Age ' + label, 'data-id': dataId, onInput: (e) => { f[key] = e.target.value.trim(); } });
  const body = () => [
    grp('Age', h('div', { class: 'sg-age-row' }, num('ageFrom', 'from', 'match.filter-age-from'), h('span', {}, 'to'), num('ageTo', 'to', 'match.filter-age-to'))),
    h('p', { class: 'note' }, 'Singles with no age recorded are listed apart, never hidden.'),
    grp('Status', bubbles({ options: STATUSES, selected: f.statuses, dataId: 'match.filter-status', onChange: v => { f.statuses = v; } })),
    o.cities.length ? grp('City', bubbles({ options: o.cities.map(v => [v, v]), selected: f.cities, dataId: 'match.filter-city', onChange: v => { f.cities = v; } })) : null,
    o.backgrounds.length ? grp('Background', bubbles({ options: o.backgrounds.map(v => [v, v]), selected: f.backgrounds, dataId: 'match.filter-background', onChange: v => { f.backgrounds = v; } })) : null,
    o.languages.length ? grp('Languages', bubbles({ options: o.languages.map(v => [v, v]), selected: f.languages, dataId: 'match.filter-language', onChange: v => { f.languages = v; } })) : null,
  ].filter(Boolean);
  const wrap = h('div', { class: 'filters-body' }, body());
  await sheet({ title: T.filters, dataId: 'match.filters', className: 'tall', body: wrap,
    actions: [
      { id: 'start', label: 'Back to the start', run: () => { const q = f.q; Object.assign(f, startFilters(ctx.p), { q }); wrap.innerHTML = ''; wrap.append(...body()); return false; } },
      { id: 'done', label: 'Show ' + KIND_WORDS[ctx.k].many, primary: true }] });
}

// ---------- the list: fresh first, then no age, then already tried, then Not a fit ----------
function drawResults(ctx) {
  const box = root?.querySelector('[data-id="match.list"]');
  if (!box) return;
  const f = F.get(single), w = KIND_WORDS[ctx.k];
  const res = applyFilters(IDX.rows, ctx.k, f);
  const fresh = [], noAge = [], tried = [], nf = [];
  for (const [list, into] of [[res.shown, fresh], [res.noAge, noAge]]) for (const r of list) {
    if (notFitOf(ctx.p, r.p.id)) nf.push(r);
    else if (ctx.pairOf(r.p)) tried.push(r);
    else into.push(r);
  }
  box.innerHTML = '';
  const total = fresh.length + noAge.length;
  box.append(h('div', { class: 'section-head' }, h('div', { class: 'eyebrow', 'data-id': 'match.count' }, T.count(total))));
  if (!res.all) { box.append(h('div', { class: 'empty' }, h('p', {}, T.noneSaved(w.many)))); return; }
  if (!total) box.append(h('div', { class: 'empty', 'data-id': 'match.none' }, h('p', {}, T.noneLeft(w.many)),
    filterCount(f) || f.q ? h('button', { type: 'button', class: 'btn small', 'data-id': 'match.none-clear', onClick: () => { F.set(single, emptyFilters()); shown = PAGE; redrawTools(ctx); drawResults(ctx); } }, T.clear) : null));
  // Drawn in pages: fresh and no-age rows count towards "Show more"; the two bottom groups are short.
  const seq = [...fresh.map(r => ['row', r]), ...(noAge.length ? [['head', T.noAgeHead(noAge.length), 'match.no-age'], ...noAge.map(r => ['row', r])] : [])];
  const list = h('div', { 'data-id': 'match.rows' });
  let n = 0;
  const more = h('button', { type: 'button', class: 'btn sg-more', 'data-id': 'match.more', onClick: () => add() }, T.more);
  const add = () => {
    const end = Math.min(seq.length, n + PAGE);
    for (; n < end; n++) { const [t, a, id] = seq[n]; list.append(t === 'head' ? groupHead(a, id) : row(ctx, a)); }
    shown = Math.max(shown, n);
    if (n >= seq.length) more.remove();
  };
  box.append(list, more);
  while (n < Math.min(shown, seq.length)) add();
  if (n >= seq.length) more.remove();
  if (tried.length) box.append(groupHead(T.triedHead(tried.length), 'match.tried'), h('div', {}, tried.map(r => row(ctx, r))));
  if (nf.length) box.append(h('div', { class: 'section-head shm-nf-head', 'data-id': 'match.not-fit' },
    h('div', { class: 'eyebrow' }, T.notFitHead(nf.length)),
    h('button', { type: 'button', class: 'linkish', 'data-id': 'match.not-fit-toggle', 'aria-expanded': showNotFit ? 'true' : 'false', onClick: () => { showNotFit = !showNotFit; drawResults(ctx); } }, showNotFit ? T.hideNotFit : T.showNotFit)),
    showNotFit ? h('div', {}, nf.map(r => row(ctx, r))) : '');
}
const groupHead = (text, id) => h('div', { class: 'section-head sg-noage', 'data-id': id }, h('div', { class: 'eyebrow' }, text));

function row(ctx, r) {
  const c = r.p, st = r.status, m = ctx.pairOf(c), nf = notFitOf(ctx.p, c.id);
  const notes = ageNotes(ctx.p, c);
  return h('button', { type: 'button', class: 'row-link sg-row shs-cand' + (m || nf ? ' shs-tried' : '') + (st === 'available' ? '' : ' sg-quiet'), 'data-id': 'match.row', onClick: () => compare(ctx, c) },
    h('div', { class: 'avatar' }, store.initials(c)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, h('span', { class: 'sg-name' }, store.personName(c)),
        c.starred ? h('span', { class: 'sg-star', title: 'Working on', html: icon('star') }) : null,
        r.open ? h('span', { class: 'sg-open', title: 'Open shidduch' }) : null),
      h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(c)),
      notes.length ? h('div', { class: 'row-sub shm-warn', dir: 'auto', 'data-id': 'match.row-note' }, notes.join(' · ')) : null,
      m ? h('div', { class: 'row-sub shs-hist', dir: 'auto', 'data-id': 'match.row-history' }, sd.pairDetail(m)) : null,
      nf ? h('div', { class: 'row-sub shs-hist', dir: 'auto', 'data-id': 'match.row-not-fit' }, T.notFitLine(nf.reason, nf.at)) : null),
    st === 'available' ? null : h('span', { class: 'chip sg-status' }, statusLabel(st)));
}

// ---------- both profiles, then Save as idea / Not a fit ----------
function profileCol(p, dataId) {
  const A = p.answers || {}, txt = (v) => [].concat(v || []).filter(Boolean).join(', ');
  const fact = (label, v) => h('div', { class: 'shm-fact' }, h('span', { class: 'shm-fact-l' }, label), h('span', { dir: 'auto' }, v || h('span', { class: 'muted' }, T.notRecorded)));
  return h('div', { class: 'shm-col', 'data-id': dataId },
    h('div', { class: 'row-title', dir: 'auto' }, store.personName(p), statusOf(p) === 'available' ? null : h('span', { class: 'chip' }, statusLabel(statusOf(p)))),
    h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(p)),
    fact(T.wantsAges, T.ages(p.minAge, p.maxAge)),
    fact(T.facts.level, txt(A.pLevel)),
    fact(T.facts.background, txt(A.pBackground)),
    fact(T.facts.languages, txt(p.languages)),
    fact(T.facts.about, firstSentence(p.about)),
    fact(T.facts.looking, firstSentence(p.looking)));
}
async function compare(ctx, c) {
  const p = ctx.p, m = ctx.pairOf(c), nf = notFitOf(p, c.id);
  const [guy, girl] = p.kind === 'guy' ? [p, c] : [c, p];
  const notes = ageNotes(p, c);
  const actions = m ? [{ id: 'open', label: T.openIt, primary: true, run: () => navigate(`/shidduchim/${encodeURIComponent(m.o.id)}`) }]
    : nf ? [{ id: 'unfit', label: T.unNotFit, run: async () => { const r = await setNotFit(p.id, c.id, null); if (r) undoToast(T.notFitOff, r); } }]
      : [{ id: 'notfit', label: T.notFit, run: () => notFitSheet(p, c) },
        { id: 'idea', label: T.saveIdea, primary: true, run: async () => {
          const res = await sd.createIdea(guy.id, girl.id);
          if (!res) return false;
          toast(res.existing ? sd.T.stage.idea : T.ideaSaved, 4000, { label: T.open, run: () => navigate(`/shidduchim/${encodeURIComponent(res.o.id)}`) });
        } }];
  await sheet({ title: T.compare, dataId: 'match.compare', className: 'tall', actions,
    body: h('div', { class: 'shm-compare' },
      notes.length ? h('div', { class: 'shs-warn', 'data-id': 'match.compare-note' }, notes.map(x => h('div', { dir: 'auto' }, x))) : null,
      m ? h('div', { class: 'shs-already', 'data-id': 'match.compare-history' }, h('strong', {}, 'Already put together'), h('div', { dir: 'auto' }, sd.pairDetail(m))) : null,
      nf ? h('div', { class: 'shs-already', 'data-id': 'match.compare-not-fit' }, h('div', { dir: 'auto' }, T.notFitLine(nf.reason, nf.at))) : null,
      h('div', { class: 'shm-cols' }, profileCol(guy, 'match.compare-guy'), profileCol(girl, 'match.compare-girl')),
      h('p', { class: 'note' }, h('a', { href: `#/people/${encodeURIComponent(c.id)}`, 'data-id': 'match.compare-card', onClick: () => document.querySelector('dialog[data-id="match.compare"]')?.finish(null) }, `Open ${store.personName(c)}’s card`))) });
}
async function notFitSheet(p, c) {
  const reason = h('textarea', { class: 'input', rows: 2, dir: 'auto', placeholder: T.reasonPh, 'data-id': 'match.not-fit-reason' });
  const res = await sheet({ title: T.notFitTitle, dataId: 'match.not-fit-sheet',
    body: [h('p', { dir: 'auto' }, T.notFitLead(store.personName(p), store.personName(c))), h('div', { class: 'field' }, h('label', {}, T.reason), reason)],
    actions: [{ id: 'save', label: T.notFitSave, primary: true, run: async () => { const r = await setNotFit(p.id, c.id, reason.value); if (!r) return false; undoToast(T.notFitDone, r); } }] });
  return res === 'save' ? 'notfit' : false; // closing this sheet keeps the compare sheet open
}
function undoToast(text, r) { toast(text, 3000, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } }); }
