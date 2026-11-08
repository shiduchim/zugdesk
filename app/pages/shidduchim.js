// Shidduchim — Offers / In Progress / Ended (spec/shidduchim.md SH-01). Layout and behaviour
// follow source/ZivugMatch_Shidduchim_Floating_Answer_Choices_v7 EXPANDED.html, drawn in
// the Claude look. Compact cards show arrow-free answer bubbles that open a floating panel;
// Expanded cards add one-tap Stage / answer choices, Add update and Open details.
// Make Match is not designed yet (SH-05): the button says so and points to the approved way in.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import * as sh from './shidduch-data.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const S = { lane: 'offers', menu: null, updateId: null, updateText: '' }; // survives leaving the page
let root = null, gen = 0, unsub = null, timer = 0, A = null, docClick = null, docKey = null;

export function destroy() {
  root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer);
  document.removeEventListener('click', docClick, true); document.removeEventListener('keydown', docKey);
  S.menu = null;
}

export async function render(container) {
  root = container;
  root.classList.add('sh-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => draw(true), 80); } });
  docClick = (e) => { if (S.menu && !e.target.closest('.sh-answer-cell')) { S.menu = null; draw(true); } };
  docKey = (e) => { if (e.key === 'Escape' && S.menu) { const { id, side } = S.menu; S.menu = null; draw(true).then(() => root?.querySelector(`[data-trigger="${side}"][data-match="${id}"]`)?.focus()); } };
  document.addEventListener('click', docClick, true);
  document.addEventListener('keydown', docKey);
  await draw();
}

async function draw(keepScroll = false) {
  const token = ++gen;
  const all = await sh.loadAll();
  if (token !== gen || !root) return;
  A = all;
  const y = window.scrollY;
  const prefs = store.getPrefs();
  const mode = prefs.shidduchimView === 'expanded' ? 'expanded' : 'compact';
  const counts = { offers: 0, progress: 0, ended: 0 };
  for (const m of all.list) counts[m.lane]++;
  const list = all.list.filter(m => m.lane === S.lane).sort((a, b) => S.lane === 'ended'
    ? (b.cur.t.endedAt || b.o.updatedAt || '').localeCompare(a.cur.t.endedAt || a.o.updatedAt || '')
    : (b.o.updatedAt || '').localeCompare(a.o.updatedAt || ''));
  const intro = { offers: 'Waiting for answers or checking references.', progress: 'Both sides have said Yes.', ended: 'The history is kept, even when a match ends.' };

  root.innerHTML = '';
  root.append(
    h('div', { class: 'page-head sh-head', 'data-id': 'shidduchim.head' },
      h('div', { class: 'sh-head-text' }, h('h1', {}, 'Shidduchim'), h('p', { class: 'note' }, 'Every shidduch, from first offer to what happens next.')),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduchim.make-match', onClick: makeMatch }, 'Make Match')),
    prefs.navArrangement !== 'four' ? h('a', { class: 'row-link sh-people-link', href: '#/people', 'data-id': 'shidduchim.people-link' },
      h('div', { class: 'avatar', html: icon('people') }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `Ideas · ${all.people.length}`),
        h('div', { class: 'row-sub' }, 'Everyone suggested to you. Saving someone is not a formal offer.')),
      ico('chevron')) : null,
    h('div', { class: 'sh-tabbar', role: 'tablist', 'aria-label': 'Shidduchim lanes', 'data-id': 'shidduchim.lanes' },
      sh.LANES.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: 'sh-tab', 'aria-selected': S.lane === k ? 'true' : 'false', 'data-id': 'shidduchim.lane-' + k,
        onClick: () => { S.lane = k; S.menu = null; S.updateId = null; draw(); } }, l, h('span', { class: 'sh-num' }, counts[k])))),
    h('div', { class: 'sh-listhead' },
      h('div', { class: 'sh-listhead-text' }, h('h2', {}, sh.laneLabel(S.lane)), h('p', { class: 'note' }, intro[S.lane])),
      h('div', { class: 'sh-view-switch', role: 'group', 'aria-label': 'Card size', 'data-id': 'shidduchim.view-switch' },
        [['compact', 'Compact'], ['expanded', 'Expanded']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': mode === k ? 'true' : 'false', 'data-id': 'shidduchim.view-' + k,
          onClick: () => { S.menu = null; S.updateId = null; store.setPref('shidduchimView', k); draw(true); } }, l)))),
    h('div', { class: 'sh-matches', 'data-id': 'shidduchim.list' },
      list.length ? list.map(m => mode === 'compact' ? compactCard(m) : expandedCard(m))
        : h('div', { class: 'sh-blank', 'data-id': 'shidduchim.empty' }, h('h3', {}, 'Nothing here yet'),
          h('p', {}, all.list.length ? 'Shidduchim appear here as their status changes.' : 'A formal offer starts from a person: Ideas → open the person → Offers → Start a formal offer.'))));
  if (keepScroll) window.scrollTo(0, y);
}

// ---------- shared card pieces ----------
export function bar(t, dates, { dim = false, large = false, dataId = null } = {}) {
  const done = sh.segmentsDone(t, dates);
  return h('div', { class: 'sh-bars' + (large ? ' large' : ''), role: 'img', 'aria-label': 'Progress: offer, references, dates 1 through 8, marriage', 'data-id': dataId },
    sh.SEG_LABELS.map((label, i) => {
      let cls = '';
      if (dim) cls = done.has(i) ? 'past' : 'empty-past';
      else if (done.has(i)) cls = i < 2 ? 'a' : i < 6 ? 'b' : i < 10 ? 'c' : 'd';
      return h('span', { class: 'sh-seg ' + cls, title: `${label}: ${done.has(i) ? 'completed' : 'not completed'}` });
    }));
}

function answerBubble(m, side) {
  const t = m.cur.t, v = side === 'me' ? t.myAnswer : t.theirAnswer, first = sh.sideName(m, side);
  const open = S.menu && S.menu.id === m.o.id && S.menu.side === side;
  const ended = m.lane === 'ended';
  const trigger = h('button', { type: 'button', class: 'sh-tag sh-trigger ' + sh.answerClass(v), 'data-trigger': side, 'data-match': m.o.id, 'data-id': 'shidduchim.answer-' + side,
    'aria-haspopup': 'true', 'aria-expanded': open ? 'true' : 'false', 'aria-label': `${ended ? 'See' : 'Change'} ${first}'s answer, currently ${v || 'Not answered yet'}`, dir: 'auto',
    onClick: (e) => { e.stopPropagation(); S.menu = open ? null : { id: m.o.id, side }; draw(true).then(() => { if (S.menu) (root?.querySelector('.sh-popover .chosen') || root?.querySelector('.sh-popover button'))?.focus({ preventScroll: true }); }); } },
    h('small', {}, first + ':'), h('strong', {}, sh.answerLabel(v)));
  let panel = null;
  if (open) {
    const values = [['', 'Not answered yet'], ['Yes', 'Yes'], ['Thinking', 'Thinking'], ['No', 'No']];
    panel = h('div', { class: 'sh-popover' + (side === 'them' ? ' right' : ''), role: 'group', 'aria-label': `Choose ${first}'s answer`, 'data-id': 'shidduchim.answer-panel', onClick: (e) => e.stopPropagation() },
      h('div', { class: 'sh-popover-title' }, ended ? 'This try is already ended' : `Change ${first}'s answer`),
      ended ? [h('div', { class: 'note' }, 'Earlier answers are kept in History. Open details to start another try.'),
        h('a', { class: 'btn small', href: `#/shidduchim/${encodeURIComponent(m.o.id)}`, 'data-id': 'shidduchim.panel-open' }, 'Open details')]
        : h('div', { class: 'sh-choice-grid' }, values.map(([val, label]) => h('button', { type: 'button', class: 'sh-option ' + sh.answerClass(val) + ((v || '') === val ? ' chosen' : ''), 'aria-pressed': (v || '') === val ? 'true' : 'false', 'data-id': 'shidduchim.option',
          onClick: () => { S.menu = null; quickAnswer(m, side, val); } }, (v || '') === val ? h('span', { class: 'sh-tick', 'aria-hidden': 'true', html: icon('check') }).firstChild : null, label))));
  }
  return h('span', { class: 'sh-answer-cell ' + side }, trigger, panel);
}

function statusRow(m, mode) {
  const t = m.cur.t, st = m.lane, stg = sh.stageWord(t, m.cur.dates);
  const compactAnswers = mode === 'compact' && (st === 'ended' || !sh.bothYes(t));
  if (compactAnswers) return h('div', { class: 'sh-answers', 'aria-label': 'Current answers' }, answerBubble(m, 'me'), answerBubble(m, 'them'), st === 'ended' ? h('span', { class: 'sh-ended-word' }, 'Ended') : null);
  if (st === 'ended') return h('div', { class: 'sh-card-sub' }, h('span', { class: 'sh-stage ended' }, 'Ended'));
  const next = st === 'offers' ? 'Waiting for answers' : sh.summary(t, m.cur.dates).next;
  return h('div', { class: 'sh-card-sub' }, h('span', { class: 'sh-stage' + (stg.startsWith('Date') ? ' dating' : '') }, stg), next ? h('span', {}, '·') : null, next ? h('span', { dir: 'auto' }, next) : null);
}

function cardSummary(m, mode) {
  const t = m.cur.t, st = m.lane;
  return h('div', { class: 'sh-card-top' },
    h('div', { class: 'sh-heart' + (st === 'ended' ? ' ended' : ''), 'aria-hidden': 'true', html: icon('shidduchim') }),
    h('div', { class: 'sh-card-main' },
      h('div', { class: 'sh-card-names' },
        h('div', { class: 'sh-names', dir: 'auto' }, 'Me ', h('span', { class: 'sh-dash' }, '–'), ' ', sh.personName(m)),
        m.tries.length > 1 ? h('span', { class: 'sh-try' }, sh.tryName(m.tries.length)) : null),
      statusRow(m, mode),
      bar(t, m.cur.dates, { dim: st === 'ended' }),
      st === 'ended' && t.endedReason ? h('div', { class: 'sh-barhint', dir: 'auto' }, t.endedReason) : null));
}

const openHref = (m) => `#/shidduchim/${encodeURIComponent(m.o.id)}`;
const openDetails = (m) => navigate(`/shidduchim/${encodeURIComponent(m.o.id)}`);

function compactCard(m) {
  const names = `Me and ${sh.personName(m)}`;
  return h('article', { class: 'sh-match compact' + (S.menu && S.menu.id === m.o.id ? ' menu-open' : ''), 'aria-label': names, 'data-id': 'shidduchim.card' },
    h('a', { class: 'sh-card-open', href: openHref(m), 'aria-label': 'Open details for ' + names, 'data-id': 'shidduchim.card-open' }),
    cardSummary(m, 'compact'));
}

function expandedCard(m) {
  const t = m.cur.t, ended = m.lane === 'ended';
  const phase = t.phase;
  const choice = (cls, label, on, disabled, dataId, run) => h('button', { type: 'button', class: 'sh-choice ' + cls + (on ? ' active' : ''), 'aria-pressed': on ? 'true' : 'false', disabled: disabled || null, 'data-id': dataId, onClick: run }, label);
  const answersFor = (side) => {
    const v = side === 'me' ? t.myAnswer : t.theirAnswer;
    return h('div', { class: 'sh-quick-person' },
      h('div', { class: 'sh-quick-caption', dir: 'auto' }, side === 'me' ? 'My answer' : `${sh.sideName(m, side)}'s answer`),
      h('div', { class: 'sh-choice-group' }, [['Yes', 'yes'], ['No', 'no'], ['Thinking', 'thinking']].map(([val, cls]) =>
        choice(cls, val, v === val, ended, 'shidduchim.quick-' + side + '-' + cls, () => quickAnswer(m, side, val)))));
  };
  const update = S.updateId === m.o.id ? updateForm(m) : null;
  return h('article', { class: 'sh-match expanded', 'aria-label': `Shidduch: Me and ${sh.personName(m)}`, 'data-id': 'shidduchim.card' },
    h('div', { class: 'sh-expanded-body' },
      h('a', { class: 'sh-expanded-summary', href: openHref(m), title: 'Open full shidduch details', 'data-id': 'shidduchim.card-open' }, cardSummary(m, 'expanded')),
      h('div', { class: 'sh-expanded-actions' },
        h('div', { class: 'sh-quick-block' }, h('div', { class: 'sh-quick-caption' }, 'Stage'),
          h('div', { class: 'sh-choice-group' }, sh.PHASES.map(([k, l]) => choice(k, l, phase === k, ended, 'shidduchim.stage-' + k, () => quickStage(m, k))))),
        h('div', { class: 'sh-quick-persons' }, answersFor('me'), answersFor('them')),
        h('div', { class: 'sh-quick-foot' },
          h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduchim.add-update', 'aria-expanded': update ? 'true' : 'false', onClick: () => { S.updateId = update ? null : m.o.id; draw(true).then(() => root?.querySelector('[data-id="shidduchim.update-text"]')?.focus()); } }, 'Add update'),
          h('a', { class: 'linkish', href: openHref(m), 'data-id': 'shidduchim.open-details' }, 'Open details')))),
    update);
}

function updateForm(m) {
  const text = h('textarea', { class: 'input', rows: 3, dir: 'auto', required: true, placeholder: 'Spoke to the shadchan, checked references, got an answer…', 'data-id': 'shidduchim.update-text', onInput: (e) => { S.updateText = e.target.value; } }, S.updateText);
  return h('form', { class: 'sh-quick-update', 'data-id': 'shidduchim.update-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!text.value.trim()) { toast('Write a few words first'); text.focus(); return; }
    const r = await sh.addNote(m, text.value);
    S.updateId = null; S.updateText = '';
    toast('Dated update saved in History', 2600, { label: 'Undo', run: () => r.undo().then(() => toast('Last change undone')) });
  } },
    h('label', { for: 'sh-update-' + m.o.id }, 'What happened? ', h('span', { class: 'note' }, 'Saved with today’s date and time')),
    Object.assign(text, { id: 'sh-update-' + m.o.id }),
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduchim.update-cancel', onClick: () => { S.updateId = null; draw(true); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduchim.update-save' }, 'Save update')));
}

// ---------- quick actions (list only; Undo offered on each) ----------
async function quickAnswer(m, side, value) {
  const t = m.cur.t;
  if (m.lane === 'ended') return;
  if (((side === 'me' ? t.myAnswer : t.theirAnswer) || '') === (value || '')) { draw(true); return; }
  if (value === 'No') { await endDialog(m, { side }); return; }
  const r = await sh.setAnswer(m, side, value);
  if (!r) return;
  const movedLane = sh.laneOf({ ...t, [side === 'me' ? 'myAnswer' : 'theirAnswer']: value, phase: sh.bothYes({ ...t, [side === 'me' ? 'myAnswer' : 'theirAnswer']: value }) && t.phase === 'checking' ? 'dating' : t.phase });
  if (movedLane !== S.lane) S.lane = movedLane;
  toast(`${sh.sideName(m, side)}'s answer → ${value || 'Not answered yet'}`, 2600, { label: 'Undo', run: () => undoTo(r.undo, m.lane) });
}

async function quickStage(m, phase) {
  if (m.lane === 'ended' || m.cur.t.phase === phase) return;
  if (phase === 'ended') { await endDialog(m, {}); return; }
  const r = await sh.setPhase(m, phase);
  if (!r) return;
  if (r.refused) { toast(r.refused, 4000); return; }
  S.lane = phase === 'dating' ? 'progress' : 'offers';
  toast('Stage updated', 2600, { label: 'Undo', run: () => undoTo(r.undo, m.lane) });
}

async function undoTo(undo, lane) { await undo(); S.lane = lane; toast('Last change undone'); }

// Ending asks first (SH-01). With `side`, that side said No; otherwise "Who ended it?" is asked.
// Reason and "who told you" are optional. Used by the list and by the details page.
export async function endDialog(m, { side = null, afterEnd = null } = {}) {
  let endedBy = side || 'unknown';
  const reason = h('textarea', { class: 'input', rows: 2, dir: 'auto', placeholder: 'Only if known', 'data-id': 'end-sheet.reason' });
  const source = h('input', { class: 'input', dir: 'auto', placeholder: 'e.g. the shadchan', 'data-id': 'end-sheet.source' });
  const who = side ? null : bubbles({ options: [['unknown', 'Not specified'], ['me', 'Me'], ['them', sh.personFirst(m)], ['both', 'Both']], selected: ['unknown'], multi: false, dataId: 'end-sheet.who', onChange: (v) => { endedBy = v || 'unknown'; } });
  const res = await sheet({ title: side ? 'End this shidduch?' : 'Move this shidduch to Ended?', dataId: 'end-sheet',
    body: [
      h('p', {}, side ? `${sh.sideFull(m, side)} said No. ` : '', 'Answers, dates and history stay saved. The ended try keeps its progress in gray.'),
      who ? h('div', { class: 'field' }, h('label', {}, 'Who ended it? (optional)'), who) : null,
      h('div', { class: 'field' }, h('label', {}, 'Reason (optional)'), reason),
      h('div', { class: 'field' }, h('label', {}, 'Who told you? (optional)'), source)],
    actions: [{ id: 'end', label: 'Move to Ended', danger: true, run: async () => {
      const r = await sh.endTry(m, { endedBy, reason: reason.value, source: source.value, saidNo: !!side });
      if (!r) return false;
      S.lane = 'ended'; S.menu = null;
      toast('Moved to Ended · history preserved', 2600, { label: 'Undo', run: () => undoTo(r.undo, m.lane) });
      afterEnd && afterEnd();
    } }] });
  if (res === null) draw(true);
  return res === 'end';
}

// SH-05: Make Match is not designed. Say so, and show the approved way to start an offer.
async function makeMatch() {
  const res = await sheet({ title: 'Make Match', dataId: 'make-match-sheet',
    body: [h('p', {}, 'The Make Match screen has not been designed yet. This button is here so its place can be reviewed.'),
      h('p', { class: 'note' }, 'To start a formal offer now: open the person in Ideas, then Offers → Start a formal offer. Saving a person or recording interest never starts one on its own.')],
    actions: [{ id: 'people', label: 'Go to Ideas', primary: true }] });
  if (res === 'people') navigate('/people');
}
