// Shidduchim in Shadchan Mode — Ideas · Offers · In Progress · Ended (spec/shadchan/design.md 6.4).
// One card per couple: both names, an answer bubble for his side and her side (tap = floating
// choices), the progress bar, and either "Your move" or the days waiting. The arrow on a card
// opens its quick actions. The lane is never chosen by hand: it follows from the answers and dates.
// Look: Single Mode's Shidduchim (shidduchim.css) plus the shs-… rules in singles.css.
import * as store from '../js/store.js';
import { h, icon, toast, swipeTabs } from '../js/ui.js';
import { norm } from './singles-data.js';
import * as sd from './sh-shidduch-data.js';
import { bar, barDim, endDialog, newIdeaSheet } from './sh-shidduch-parts.js';

const T = {
  title: 'Shidduchim',
  lead: 'Every shidduch: a guy and a girl, each side’s answer, and what is next.',
  newIdea: 'New idea',
  search: 'Search a single or a contact…',
  lanesLabel: 'Shidduchim lanes',
  emptyTitle: 'Nothing here yet',
  emptyAll: 'Save your first idea: a guy and a girl you think could fit.',
  emptyLane: 'Shidduchim move here by themselves as answers and dates are marked.',
  emptySearch: (q) => `Nothing matches “${q}” here.`,
  elsewhere: (list) => `Also found in: ${list.join(', ')}`,
  demoHint: 'Want to look around first? Load the fictional demo in Guys or Girls.',
  yourMove: 'Your move',
  afterDate: (n) => `After Date ${n}`,
  changeAnswer: (side, name) => `${side} · ${name}`,
  endedPanel: 'This try has ended',
  endedPanelNote: 'Earlier answers are kept in History. Open it to start another try.',
  openDetails: 'Open details',
  openFor: (names) => `Open ${names}`,
  showActions: 'Show quick actions', hideActions: 'Hide quick actions',
  refsChecked: 'References checked',
  addUpdate: 'Add update',
  end: 'End shidduch',
  markAsked: (sides) => (sides.length === 2 ? 'Mark both sides asked' : `Mark ${sd.T.sideLow[sides[0]]} asked`),
  told: (name) => `${name} was told`,
  arrange: (n) => `Arrange Date ${n}`,
  updateLabel: 'What happened?',
  updateNote: 'Saved with today’s date and time',
  updatePh: 'Spoke to the mother, checked a reference, got an answer…',
  updateEmpty: 'Write a few words first',
  updateSaved: 'Dated update saved in History',
  cancel: 'Cancel', saveUpdate: 'Save update',
  undo: 'Undo', undone: 'Last change undone',
  answerToast: (side, label) => `${side} → ${label}`,
  moved: (lane) => ` · moved to ${lane}`,
  refsToast: 'References checked',
  toldToast: 'Marked as told',
  bothSides: 'Both sides',
};
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const S = { lane: 'offers', menu: null, updateId: null, updateText: '', open: null, q: '', picked: false }; // survives leaving the page
let root = null, gen = 0, unsub = null, timer = 0, A = null, docClick = null, docKey = null;

export function destroy() {
  if (root) swipeTabs(root, null);
  root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer);
  document.removeEventListener('click', docClick, true); document.removeEventListener('keydown', docKey);
  S.menu = null;
}

export async function render(container) {
  root = container;
  root.classList.add('sh-page', 'shs-page');
  swipeTabs(root, { keys: () => sd.LANES, current: () => S.lane, go: (k) => setLane(k) });
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => load(), 80); } });
  docClick = (e) => { if (S.menu && !e.target.closest('.sh-answer-cell')) { S.menu = null; drawList(); } };
  docKey = (e) => { if (e.key === 'Escape' && S.menu) { const { id, side } = S.menu; S.menu = null; drawList(); root?.querySelector(`[data-trigger="${side}"][data-match="${CSS.escape(id)}"]`)?.focus(); } };
  document.addEventListener('click', docClick, true);
  document.addEventListener('keydown', docKey);
  root.append(
    h('div', { class: 'page-head sh-head', 'data-id': 'shidduchim.head' },
      h('div', { class: 'sh-head-text' }, h('h1', {}, T.title), h('p', { class: 'note' }, T.lead)),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduchim.new-idea', onClick: () => newIdeaSheet({ onSaved: () => { S.lane = 'ideas'; S.picked = true; } }) }, T.newIdea)),
    h('div', { class: 'ct-search shs-search' }, ico('search'),
      h('input', { class: 'input', type: 'search', value: S.q, placeholder: T.search, 'aria-label': 'Search', dir: 'auto', 'data-id': 'shidduchim.search',
        onInput: (e) => { S.q = e.target.value; S.menu = null; drawList(); } })),
    h('div', { class: 'shs-body' }));
  await load();
}

function setLane(k) { S.lane = k; S.picked = true; S.menu = null; S.updateId = null; drawList(); window.scrollTo(0, 0); }

async function load() {
  const token = ++gen;
  const all = await sd.loadAll();
  if (token !== gen || !root) return;
  A = all;
  // First visit: open on the first lane that has something to do, not on an empty one.
  if (!S.picked && !all.list.some(m => m.lane === S.lane)) S.lane = ['offers', 'progress', 'ideas', 'ended'].find(l => all.list.some(m => m.lane === l)) || 'ideas';
  drawList();
}

// What a search looks at: both singles (name, city) and everyone on their contact cards.
function searchText(m) {
  if (m.text == null) {
    const words = [];
    for (const s of sd.SIDES) { const p = m[s]; words.push(sd.fullName(m, s)); if (p) words.push(p.city, p.sender, ...(p.contactCards || []).map(c => c.name)); }
    m.text = norm(words.filter(Boolean).join(' \n '));
  }
  return m.text;
}

// Redrawn alone while typing or tapping, so the search box keeps the keyboard open.
function drawList() {
  const box = root?.querySelector('.shs-body');
  if (!box || !A) return;
  const y = window.scrollY;
  const words = norm(S.q).split(/\s+/).filter(Boolean);
  const hits = words.length ? A.list.filter(m => words.every(w => searchText(m).includes(w))) : A.list;
  const counts = { ideas: 0, offers: 0, progress: 0, ended: 0 };
  for (const m of hits) counts[m.lane]++;
  const when = (m) => (S.lane === 'ended' ? m.cur.t.endedAt || m.cur.t.engagedAt : null) || m.o.updatedAt || '';
  const list = hits.filter(m => m.lane === S.lane).sort((a, b) => when(b).localeCompare(when(a)));
  const others = words.length ? sd.LANES.filter(l => l !== S.lane && counts[l]).map(l => `${sd.laneLabel(l)} (${counts[l]})`) : [];

  box.innerHTML = '';
  box.append(
    h('div', { class: 'sh-tabbar shs-tabbar', role: 'tablist', 'aria-label': T.lanesLabel, 'data-id': 'shidduchim.lanes' },
      sd.LANES.map(k => h('button', { type: 'button', role: 'tab', class: 'sh-tab', 'aria-selected': S.lane === k ? 'true' : 'false', 'data-id': 'shidduchim.lane-' + k, onClick: () => setLane(k) },
        sd.laneLabel(k), h('span', { class: 'sh-num' }, counts[k])))),
    h('p', { class: 'note shs-intro', 'data-id': 'shidduchim.intro' }, sd.T.laneIntro[S.lane]),
    h('div', { class: 'sh-matches', 'data-id': 'shidduchim.list' },
      list.length ? list.map(card)
        : h('div', { class: 'sh-blank', 'data-id': 'shidduchim.empty' }, h('h3', {}, T.emptyTitle),
          h('p', { dir: 'auto' }, words.length ? T.emptySearch(S.q.trim()) : A.list.length ? T.emptyLane : T.emptyAll),
          !A.list.length && !A.idx.total ? h('p', { class: 'note' }, T.demoHint) : null)),
    others.length ? h('p', { class: 'note', 'data-id': 'shidduchim.elsewhere' }, T.elsewhere(others)) : '');
  window.scrollTo(0, y);
}

// ---------- one card ----------
const openHref = (m, tab = '') => `#/shidduchim/${encodeURIComponent(m.o.id)}${tab}`;

function stepTag(m) {
  const st = m.step;
  if (st.kind === 'move') return h('span', { class: 'shs-move', 'data-id': 'shidduchim.your-move' }, T.yourMove);
  if (st.kind === 'wait') return h('span', { class: 'shs-days', 'data-id': 'shidduchim.days' }, sd.T.days(st.days));
  return null;
}

function answerBubble(m, side) {
  const rec = m.round.rec, v = sd.ans(rec, side), id = m.o.id;
  const open = S.menu && S.menu.id === id && S.menu.side === side;
  const ended = m.lane === 'ended';
  const trigger = h('button', { type: 'button', class: 'sh-tag sh-trigger ' + sd.answerClass(v), 'data-trigger': side, 'data-match': id, 'data-id': 'shidduchim.answer-' + side,
    'aria-haspopup': 'true', 'aria-expanded': open ? 'true' : 'false', 'aria-label': `${sd.T.side[side]}, ${sd.fullName(m, side)}: ${sd.answerLabel(v)}`,
    onClick: (e) => { e.stopPropagation(); S.menu = open ? null : { id, side }; drawList(); if (S.menu) (root?.querySelector('.sh-popover .chosen') || root?.querySelector('.sh-popover button, .sh-popover a'))?.focus({ preventScroll: true }); } },
    h('small', {}, sd.T.side[side] + ':'), h('strong', {}, sd.answerLabel(v)));
  let panel = null;
  if (open) {
    panel = h('div', { class: 'sh-popover' + (side === 'girl' ? ' right' : ''), role: 'group', 'data-id': 'shidduchim.answer-panel', onClick: (e) => e.stopPropagation() },
      h('div', { class: 'sh-popover-title', dir: 'auto' }, ended ? T.endedPanel : T.changeAnswer(sd.T.side[side], sd.fullName(m, side))),
      ended ? [h('div', { class: 'note' }, T.endedPanelNote), h('a', { class: 'btn small', href: openHref(m), 'data-id': 'shidduchim.panel-open' }, T.openDetails)]
        : h('div', { class: 'sh-choice-grid' }, sd.ANSWERS.map(val => h('button', { type: 'button', class: 'sh-option ' + sd.answerClass(val) + (v === val ? ' chosen' : ''), 'aria-pressed': v === val ? 'true' : 'false', 'data-id': 'shidduchim.option-' + (val || 'none'),
          onClick: () => { S.menu = null; quickAnswer(m, side, val); } }, v === val ? h('span', { class: 'sh-tick', 'aria-hidden': 'true', html: icon('check') }).firstChild : null, sd.answerLabel(val)))));
  }
  return h('span', { class: 'sh-answer-cell ' + side }, trigger, panel);
}

// The line under the names: the two bubbles, or (a date is still ahead / engaged) what is set.
function statusRow(m) {
  const t = m.cur.t, r = m.round;
  if (t.phase === 'engaged') return h('div', { class: 'sh-card-sub' }, h('span', { class: 'shs-engaged', 'data-id': 'shidduchim.engaged' }, m.step.text));
  if (r.kind === 'date' && r.upcoming) return h('div', { class: 'sh-card-sub' }, h('span', { class: 'sh-stage dating' }, sd.T.stage.date(r.n)), h('span', {}, '·'), h('span', { dir: 'auto' }, sd.whenNice(r.rec.when)),
    t.phase === 'ended' ? h('span', { class: 'sh-ended-word' }, sd.T.stage.ended) : null);
  return h('div', { class: 'sh-answers', 'aria-label': 'Answers' },
    r.kind === 'date' ? h('span', { class: 'shs-round', 'data-id': 'shidduchim.round' }, T.afterDate(r.n)) : null,
    answerBubble(m, 'guy'), answerBubble(m, 'girl'),
    t.phase === 'ended' ? h('span', { class: 'sh-ended-word' }, sd.T.stage.ended) : null);
}

function card(m) {
  const id = m.o.id, t = m.cur.t, open = S.open === id, names = sd.coupleName(m);
  const hint = m.step.kind === 'move' ? m.step.text : t.phase === 'ended' ? [sd.endedLine(t), t.endedReason].filter(Boolean).join(' · ') : m.step.kind === 'wait' ? m.step.text : '';
  return h('article', { class: 'sh-match shs-card' + (open ? ' shs-open' : ' compact') + (S.menu && S.menu.id === id ? ' menu-open' : ''), 'aria-label': names, 'data-id': 'shidduchim.card' },
    h('a', { class: 'sh-card-open', href: openHref(m), 'aria-label': T.openFor(names), 'data-id': 'shidduchim.card-open' }),
    h('button', { type: 'button', class: 'icon-btn sh-expand-btn' + (open ? ' open' : ''), 'aria-expanded': open ? 'true' : 'false', 'aria-label': open ? T.hideActions : T.showActions, 'data-id': 'shidduchim.card-expand', html: icon('chevron'),
      onClick: (e) => { e.preventDefault(); e.stopPropagation(); S.open = open ? null : id; S.menu = null; S.updateId = null; drawList(); } }),
    h('div', { class: 'sh-card-main' },
      h('div', { class: 'sh-card-names' },
        h('div', { class: 'sh-names', dir: 'auto' }, sd.fullName(m, 'guy'), ' ', h('span', { class: 'sh-dash' }, '–'), ' ', sd.fullName(m, 'girl')),
        h('span', { class: 'shs-side' }, m.tries.length > 1 ? h('span', { class: 'sh-try' }, sd.tryName(m.tries.length)) : null, stepTag(m))),
      statusRow(m),
      bar(m.cur, { dim: barDim(m.cur) }),
      hint ? h('div', { class: 'sh-barhint' + (m.step.kind === 'move' ? ' shs-hint-move' : ''), dir: 'auto', 'data-id': 'shidduchim.hint' }, hint) : null),
    open ? actions(m) : null,
    open && S.updateId === id ? updateForm(m) : null);
}

// Quick actions of the one open card. Each offers Undo.
function actions(m) {
  const t = m.cur.t, st = m.step, live = sd.isOpen(t);
  const btn = (label, dataId, run, cls = '') => h('button', { type: 'button', class: 'btn small ' + cls, 'data-id': dataId, onClick: run }, label);
  return h('div', { class: 'shs-actions', 'data-id': 'shidduchim.actions' },
    st.ask ? btn(T.markAsked(st.ask), 'shidduchim.mark-asked', () => markAsked(m, st.ask), 'primary') : null,
    st.date ? h('a', { class: 'btn small primary', href: openHref(m, '/dates?new'), 'data-id': 'shidduchim.arrange' }, T.arrange(st.date)) : null,
    (st.tell || []).map(s => btn(T.told(sd.talkName(m, s)), 'shidduchim.told-' + s, async () => { const r = await sd.markTold(m, s); if (r) undoToast(T.toldToast, r); }, 'primary')),
    live && !t.refsChecked && m.lane !== 'ideas' ? btn(T.refsChecked, 'shidduchim.refs-checked', async () => { const r = await sd.markRefs(m); if (r) undoToast(T.refsToast, r); }) : null,
    btn(T.addUpdate, 'shidduchim.add-update', () => { S.updateId = S.updateId === m.o.id ? null : m.o.id; drawList(); root?.querySelector('[data-id="shidduchim.update-text"]')?.focus(); }),
    live ? btn(T.end, 'shidduchim.end', () => endDialog(m)) : null,
    h('a', { class: 'linkish', href: openHref(m), 'data-id': 'shidduchim.open-details' }, T.openDetails));
}

function updateForm(m) {
  const text = h('textarea', { class: 'input', rows: 3, dir: 'auto', required: true, id: 'shs-update', placeholder: T.updatePh, 'data-id': 'shidduchim.update-text', onInput: (e) => { S.updateText = e.target.value; } }, S.updateText);
  return h('form', { class: 'sh-quick-update shs-over', 'data-id': 'shidduchim.update-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!text.value.trim()) { toast(T.updateEmpty); text.focus(); return; }
    const r = await sd.addNote(m, text.value);
    S.updateId = null; S.updateText = '';
    undoToast(T.updateSaved, r);
  } },
    h('label', { for: 'shs-update' }, T.updateLabel + ' ', h('span', { class: 'note' }, T.updateNote)), text,
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduchim.update-cancel', onClick: () => { S.updateId = null; drawList(); } }, T.cancel),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduchim.update-save' }, T.saveUpdate)));
}

function undoToast(text, r) { toast(text, 2600, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } }); }

async function quickAnswer(m, side, value) {
  if (!sd.isOpen(m.cur.t)) return;
  if (sd.ans(m.round.rec, side) === value) { drawList(); return; }
  if (value === 'no') { const ended = await endDialog(m, { side }); if (!ended) drawList(); return; }
  const r = await sd.setAnswer(m, side, value);
  if (!r) { drawList(); return; }
  undoToast(T.answerToast(sd.T.side[side], sd.answerLabel(value)) + (r.lane !== m.lane ? T.moved(sd.laneLabel(r.lane)) : ''), r);
}

// "Mark her side asked": the one-tap way to record that a side was asked today.
async function markAsked(m, sides) {
  let cur = m, first = null;
  for (const s of sides) {
    const r = await sd.setAnswer(cur, s, 'asked');
    if (!r) continue;
    first = first || r;
    cur = (await sd.loadOne(m.o.id)) || cur;
  }
  if (first) undoToast(T.answerToast(sides.length === 2 ? T.bothSides : sd.T.side[sides[0]], sd.answerLabel('asked')), first);
}
