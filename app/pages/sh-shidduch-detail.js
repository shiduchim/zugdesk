// One shidduch in Shadchan Mode — Overview / Dates / History (spec/shadchan/design.md 6.4).
// The bar (Offer · References · Dates 1–8 · Engaged), a "your move" line, one card per side
// (the single, whom I talk to, the answer and who told me), references, engaged, Try Again,
// dates with both sides' answers and private feedback after each one, and one shared history.
// Look: Single Mode's details page (shidduchim.css) plus the shs-… rules in singles.css.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, confirmDialog, dock, swipeTabs, telLink } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { statusOf, statusLabel, summaryLine } from './singles-data.js';
import * as sd from './sh-shidduch-data.js';
import { bar, barDim, endDialog, answerTag } from './sh-shidduch-parts.js';

const T = {
  gone: 'This shidduch is no longer saved.',
  back: 'Back to Shidduchim',
  legend: ['Offer', 'References', 'Dates 1–8', 'Engaged'],
  tabs: [['overview', 'Overview'], ['dates', 'Dates'], ['history', 'History']],
  tryEnded: (name) => `${name} · ended`,
  yourMove: 'Your move: ',
  markAsked: (sides) => (sides.length === 2 ? 'Mark both sides asked' : `Mark ${sd.T.sideLow[sides[0]]} asked`),
  askedNote: 'Sending the profile from here comes with Send (stage S5). For now, mark it when you have asked.',
  arrange: 'Arrange a date',
  arrangeN: (n) => `Arrange Date ${n}`,
  told: (name) => `${name} was told`,
  toldToast: 'Marked as told',
  endedBy: (who) => (who ? `Ended by ${who}` : 'Ended'),
  talkTo: 'Talk to: ',
  talkNone: 'not chosen yet',
  personGone: 'This single’s record was removed',
  answer: 'Answer',
  answerAfter: (n) => `After Date ${n}`,
  answersLater: (n) => `Answers come back after Date ${n}.`,
  asked: (ago) => `asked ${ago}`,
  answered: (ago) => `answered ${ago}`,
  toldBy: (name) => `told by ${name}`,
  wasTold: 'was told it ended',
  notTold: 'has not been told yet',
  answerSaved: (side) => `${side} updated`,
  whoTold: 'Who told you? ',
  optional: '(optional)',
  whoToldPh: 'e.g. the mother',
  saveSource: 'Save', skip: 'Skip', sourceSaved: 'Saved',
  refs: 'References', refsYes: 'Checked', refsNo: 'Not checked',
  refsDone: 'References have been checked.',
  refsHint: 'Leave this unfinished if references were skipped, even when dates begin.',
  refsBtn: 'Mark references checked', refsToast: 'References marked checked',
  engagedQ: 'Engaged?',
  engagedHint: 'When the couple agrees to marry. Both are then marked Engaged, and this moves to Ended with its colours kept.',
  engagedBtn: 'Mark as engaged',
  engagedTitle: (names) => `Mark ${names} as engaged?`,
  engagedText: 'Both singles get the status Engaged. You can undo it.',
  engagedToast: 'Engaged. Mazal tov!',
  engagedHead: (when) => `Engaged${when ? ' · ' + when : ''}`,
  engagedOff: 'No longer engaged',
  again: 'Another try?', againNote: 'Previous dates and history will be kept.', againBtn: 'Try Again',
  againLimit: (n) => `This couple already had ${n} tries.`,
  againConfirm: 'Start a new try with this same couple?', againConfirmNote: 'The past try stays saved. It starts as an idea again: nobody is asked until you mark it.',
  againStart: (name) => `Start ${name}`, againDone: 'New try started; past history saved',
  cancel: 'Cancel',
  recent: 'Recent history', addNote: 'Add note', allHistory: 'See all history', nothingYet: 'Nothing recorded yet.',
  del: 'Delete this shidduch',
  delTitle: (names) => `Delete ${names}?`,
  delText: 'The shidduch with its dates and history goes to Settings → Recently deleted for 30 days. The two singles stay.',
  delOk: 'Delete', delDone: 'Deleted. It waits 30 days in Settings → Recently deleted',
  end: 'End shidduch',
  // dates
  dates: 'Dates', datesNote: 'Arrange, update, and keep a record of each date.',
  datesEnded: 'This try has ended. Its dates stay as a record. Use Try Again on Overview for a new attempt.',
  noDates: 'No dates yet', noDatesHint: 'Use “Arrange a date” when both sides agree.',
  barNote: 'A date colours the bar once it is marked Happened; marking an answer after it does that by itself. Dates past the eighth keep their real number.',
  dateTitle: (n, status) => `Date ${n} · ${status}`,
  editDate: 'Edit', feedback: 'Feedback',
  feedbackTitle: (n) => `Feedback after Date ${n}`,
  feedbackNote: 'Private. What each side said about the date. Never part of anything you send.',
  feedbackOf: (side, name) => `${side} · ${name}`,
  feedbackSaved: 'Feedback saved',
  formNew: 'Arrange a date', formEdit: (n) => `Edit Date ${n}`,
  when: 'When', where: 'Where', wherePh: 'Meeting place', status: 'Status',
  marksYes: 'Saving this marks both sides as Yes: a date means both agreed.',
  whenMissing: 'Choose a date and time', dateSaved: 'Date saved', saveDate: 'Save date',
  // history
  history: 'History', noActivity: 'No activity yet.', previous: 'Previous tries',
  prevSummary: (name, who, reason) => `${name} · ${who ? 'Ended by ' + who : 'Previous try'}${reason ? ' · ' + reason : ''}`,
  privateNote: 'History, notes and feedback are private. They are never part of anything you send.',
  happened: (when) => ` · happened ${when}`,
  source: (s) => 'Told by: ' + s,
  newNote: 'New note', notePh: 'What happened?', noteEmpty: 'Write a few words first', noteSaved: 'Note saved', saveNote: 'Save note',
  bothSides: 'Both sides',
  undo: 'Undo', undone: 'Last change undone',
};
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const fresh = () => ({ dateEdit: null, noteOpen: false, noteText: '', reporter: null, confirmTry: false });
let root = null, gen = 0, unsub = null, timer = 0, M = null, tab = 'overview', currentId = null;
let U = fresh(); // what is open on this page; starts again for each shidduch

export function destroy() { if (root) swipeTabs(root, null); root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params) {
  root = container;
  root.classList.add('sh-page', 'sh-detail-page', 'shs-page');
  tab = T.tabs.some(t => t[0] === params.tab) ? params.tab : 'overview';
  swipeTabs(root, { keys: () => T.tabs.map(t => t[0]), current: () => tab, go: (k) => go(k, true) });
  if (currentId !== params.id) { currentId = params.id; U = fresh(); }
  // "#/shidduchim/<id>/dates?new" (the list's Arrange button) opens the date form straight away.
  if (location.hash.endsWith('?new')) { U.dateEdit = 'new'; history.replaceState(null, '', location.hash.slice(0, -4)); }
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => draw(true), 80); } });
  await draw();
  if (U.dateEdit === 'new') showForm();
}

const path = (k) => `/shidduchim/${encodeURIComponent(currentId)}${k === 'overview' ? '' : '/' + k}`;
function go(k, replace = false) { navigate(path(k), { replace }); }
const showForm = () => root?.querySelector('[data-id="shidduch.date-form"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
function undoToast(text, r) { toast(text, 2600, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } }); }

async function draw(keepScroll = false) {
  const token = ++gen;
  const m = await sd.loadOne(currentId);
  if (token !== gen || !root) return;
  const y = window.scrollY;
  root.innerHTML = '';
  if (!m) { root.append(h('p', { class: 'empty' }, T.gone), h('a', { class: 'btn', href: '#/shidduchim', 'data-id': 'shidduch.back' }, T.back)); return; }
  M = m;
  const t = m.cur.t, idx = m.tries.length, live = sd.isOpen(t);
  const label = t.phase === 'engaged' ? sd.T.stage.engaged : sd.laneLabel(m.lane);
  root.append(
    h('div', { class: 'sh-detailhead', 'data-id': 'shidduch.head' },
      h('div', { class: 'sh-detailhead-left' },
        h('a', { class: 'sh-back', href: '#/shidduchim', 'data-id': 'shidduch.back' }, ico('back'), T.back),
        h('div', { class: 'shs-couple', dir: 'auto', 'data-id': 'shidduch.couple' }, sd.coupleName(m), idx > 1 ? h('span', { class: 'sh-try' }, ' · ' + sd.tryName(idx)) : null)),
      h('span', { class: 'sh-statuslabel' + (t.phase === 'ended' ? ' ended' : t.phase === 'engaged' ? ' shs-engaged-label' : ''), 'data-id': 'shidduch.status' }, label)),
    h('div', { class: 'sh-detailbar', 'data-id': 'shidduch.bar' },
      bar(m.cur, { dim: barDim(m.cur), large: true }),
      h('div', { class: 'sh-legend' }, T.legend.map(x => h('span', {}, x))),
      idx > 1 ? h('div', { class: 'sh-pastbars', 'data-id': 'shidduch.past-bars' }, m.tries.slice(0, -1).map((old, i) => [
        h('div', { class: 'sh-pastname' }, T.tryEnded(sd.tryName(i + 1))), bar(old, { dim: true })])) : null),
    h('div', { class: 'sh-detailtabs', role: 'tablist', 'data-id': 'shidduch.tabs' },
      T.tabs.map(([k, l]) => h('a', { role: 'tab', class: 'sh-detailtab', 'aria-selected': tab === k ? 'true' : 'false', href: '#' + path(k), 'data-id': 'shidduch.tab-' + k }, l))),
    h('div', { class: 'sh-detailbody', 'data-id': 'shidduch.' + tab }, tab === 'overview' ? overview(m) : tab === 'dates' ? datesView(m) : historyView(m)),
    !live || U.dateEdit !== null || U.noteOpen ? '' : dock('shidduch.dock',
      h('button', { type: 'button', class: 'btn wide', 'data-id': 'shidduch.dock-note', onClick: openNote }, T.addNote),
      h('button', { type: 'button', class: 'btn primary wide', 'data-id': 'shidduch.dock-date', onClick: openDateForm }, m.step.date ? T.arrangeN(m.step.date) : T.arrange)));
  if (keepScroll) window.scrollTo(0, y);
}

function openNote() { U.noteOpen = true; if (tab === 'history') draw(true).then(() => root?.querySelector('[data-id="shidduch.note-text"]')?.focus()); else go('history'); }
function openDateForm() { U.dateEdit = 'new'; if (tab === 'dates') draw(true).then(showForm); else { go('dates'); setTimeout(showForm, 300); } }

// ---------- Overview ----------
function overview(m) {
  const t = m.cur.t, idx = m.tries.length, live = sd.isOpen(t);
  const recent = m.cur.events.slice(0, 3);
  return [
    stepLine(m),
    t.phase === 'ended' ? h('div', { class: 'sh-endpanel', 'data-id': 'shidduch.ended' }, h('strong', { dir: 'auto' }, [T.endedBy(sd.whoEnded(t)), sd.monthYear(t.endedAt)].filter(Boolean).join(' · ')),
      t.endedReason ? h('p', { dir: 'auto' }, t.endedReason) : null) : null,
    t.phase === 'engaged' ? h('div', { class: 'sh-panel shs-engaged-panel', 'data-id': 'shidduch.engaged' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.engagedHead(sd.monthYear(t.engagedAt))),
        h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.engaged-off', onClick: () => endDialog(m) }, T.engagedOff))) : null,
    h('div', { class: 'sh-people', 'data-id': 'shidduch.people' }, sideCard(m, 'guy'), sideCard(m, 'girl')),
    U.reporter ? reporterBox(m) : null,
    live && m.lane !== 'ideas' ? h('div', { class: 'sh-panel soft', 'data-id': 'shidduch.references' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.refs), h('span', { class: 'chip' }, t.refsChecked ? T.refsYes : T.refsNo)),
      h('div', { class: 'note' }, t.refsChecked ? T.refsDone : T.refsHint),
      !t.refsChecked ? h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.refs-btn', onClick: async () => { const r = await sd.markRefs(m); if (r) undoToast(T.refsToast, r); } }, T.refsBtn) : null) : null,
    t.phase === 'dating' ? h('div', { class: 'sh-panel', 'data-id': 'shidduch.engaged-ask' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.engagedQ),
        h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.engaged-btn', onClick: () => engaged(m) }, T.engagedBtn)),
      h('div', { class: 'note' }, T.engagedHint)) : null,
    t.phase === 'ended' ? h('div', { class: 'sh-panel', 'data-id': 'shidduch.try-again' },
      h('div', { class: 'sh-minihead' }, h('div', {}, h('h3', {}, T.again), h('div', { class: 'note' }, T.againNote)),
        h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-btn', 'aria-expanded': U.confirmTry ? 'true' : 'false', onClick: () => { U.confirmTry = !U.confirmTry; draw(true); } }, T.againBtn)),
      idx >= sd.PROVISIONAL_TRIES ? h('p', { class: 'note' }, T.againLimit(idx)) : null,
      U.confirmTry ? h('div', { class: 'sh-note-form', 'data-id': 'shidduch.try-confirm' },
        h('strong', {}, T.againConfirm), h('p', { class: 'note' }, T.againConfirmNote),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-confirm-btn', onClick: async () => { U.confirmTry = false; await sd.tryAgain(m); toast(T.againDone); } }, T.againStart(sd.tryName(idx + 1))),
          h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.try-cancel', onClick: () => { U.confirmTry = false; draw(true); } }, T.cancel))) : null) : null,
    h('div', { class: 'sh-history-head' }, h('h3', {}, T.recent),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.add-note', onClick: openNote }, T.addNote)),
    recent.length ? h('div', { class: 'sh-timeline', 'data-id': 'shidduch.recent' }, recent.map(logView)) : h('div', { class: 'note sh-emptyhistory' }, T.nothingYet),
    h('a', { class: 'linkish sh-notelink', href: '#' + path('history'), 'data-id': 'shidduch.all-history' }, T.allHistory),
    h('div', { class: 'shs-foot' },
      live ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.end', onClick: () => endDialog(m) }, T.end) : null,
      h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'shidduch.delete', onClick: () => remove(m) }, T.del)),
  ];
}

// One line that says what is expected now, with the one tap that records it.
function stepLine(m) {
  const st = m.step;
  if (!st.text || m.cur.t.phase === 'engaged') return null; // engaged has its own panel
  const btn = (label, dataId, run) => h('button', { type: 'button', class: 'btn small', 'data-id': dataId, onClick: run }, label);
  return h('div', { class: 'shs-step shs-step-' + st.kind, 'data-id': 'shidduch.your-move' },
    h('div', { class: 'shs-step-text', dir: 'auto' }, st.kind === 'move' ? h('strong', {}, T.yourMove) : null, st.text),
    st.ask || st.date || st.tell ? h('div', { class: 'shs-step-acts' },
      st.ask ? btn(T.markAsked(st.ask), 'shidduch.mark-asked', () => markAsked(m, st.ask)) : null,
      st.date ? btn(T.arrangeN(st.date), 'shidduch.step-arrange', openDateForm) : null,
      (st.tell || []).map(s => btn(T.told(sd.talkName(m, s)), 'shidduch.told-' + s, async () => { const r = await sd.markTold(m, s); if (r) undoToast(T.toldToast, r); }))) : null,
    st.ask && m.round.kind === 'offer' ? h('div', { class: 'note' }, T.askedNote) : null);
}

async function markAsked(m, sides) {
  let cur = m, first = null;
  for (const s of sides) { const r = await sd.setAnswer(cur, s, 'asked'); if (r) { first = first || r; cur = (await sd.loadOne(m.o.id)) || cur; } }
  if (first) undoToast(T.answerSaved(sides.length === 2 ? T.bothSides : sd.T.side[sides[0]]), first);
}

// The answer of one side in the round that is open now. Used on Overview and on the Dates tab.
function answerSelect(m, side, dataId) {
  const v = sd.ans(m.round.rec, side);
  return h('select', { class: 'input sh-answerselect ' + sd.answerClass(v), id: dataId, 'data-id': dataId, disabled: !sd.isOpen(m.cur.t) || null, 'aria-label': `${sd.T.side[side]}: ${sd.fullName(m, side)}`,
    onChange: (e) => selected(m, side, e.target.value) },
    sd.ANSWERS.map(a => h('option', { value: a, selected: v === a || null }, sd.answerLabel(a))));
}
async function selected(m, side, value) {
  if (value === 'no') { const ok = await endDialog(m, { side }); if (!ok) draw(true); return; }
  const r = await sd.setAnswer(m, side, value);
  if (!r) { draw(true); return; }
  U.reporter = value === 'thinking' || value === 'yes' ? { eventId: r.event.id, side } : null;
  undoToast(T.answerSaved(sd.T.side[side]), { undo: async () => { U.reporter = null; await r.undo(); } });
}

function sideCard(m, side) {
  const p = m[side], t = m.cur.t, r = m.round, x = sd.sideOf(r.rec, side);
  const st = p ? statusOf(p) : 'available', talk = sd.talkTo(p);
  const name = sd.fullName(m, side);
  const meta = [x.askedAt && (x.answer === 'asked' || x.answer === 'thinking') ? T.asked(sd.agoShort(x.askedAt)) : null,
    x.answeredAt && x.answer !== 'asked' && x.answer ? T.answered(sd.agoShort(x.answeredAt)) : null,
    x.toldBy ? T.toldBy(x.toldBy) : null].filter(Boolean).join(' · ');
  const told = t.phase === 'ended' && sd.wouldNeedTelling(t, t.endedBy).includes(side) ? ((t.told || {})[side] ? T.wasTold : T.notTold) : '';
  return h('div', { class: 'sh-person shs-sidecard ' + side, 'data-id': 'shidduch.person-' + side },
    h('div', { class: 'sh-personhead' },
      h('span', { class: 'avatar' + (side === 'girl' ? ' them' : '') }, p ? store.initials(p) : '?'),
      h('div', { class: 'grow' },
        h('div', { class: 'shs-sidelabel' }, sd.T.side[side]),
        p ? h('a', { class: 'sh-who', href: `#/people/${encodeURIComponent(p.id)}`, 'data-id': 'shidduch.person-link', dir: 'auto' }, name) : h('span', { class: 'sh-who', dir: 'auto' }, name)),
      st === 'available' ? null : h('span', { class: 'chip', 'data-id': 'shidduch.person-status' }, statusLabel(st))),
    h('div', { class: 'sh-persmeta', dir: 'auto' }, p ? summaryLine(p) : T.personGone),
    p ? h('div', { class: 'sh-persmeta shs-talk', dir: 'auto', 'data-id': 'shidduch.talk-to' }, T.talkTo,
      talk ? [h('strong', {}, talk.self ? (side === 'guy' ? sd.T.himself : sd.T.herself) : talk.name), talk.number ? [' ', telLink(talk.number, 'shidduch.talk-tel')] : null] : h('span', { class: 'muted' }, T.talkNone)) : null,
    t.phase === 'engaged' || (r.upcoming && !sd.isOpen(t)) ? null // finished with nothing asked in this round: no answer to show
      : r.kind === 'date' && r.upcoming ? h('div', { class: 'note shs-later' }, T.answersLater(r.n))
      : h('div', { class: 'sh-answerfield' },
        h('label', { class: 'sh-answerlabel', for: 'shidduch.answer-' + side }, r.kind === 'date' && !r.upcoming ? T.answerAfter(r.n) : T.answer),
        answerSelect(m, side, 'shidduch.answer-' + side),
        meta ? h('div', { class: 'shs-meta', dir: 'auto', 'data-id': 'shidduch.answer-meta' }, meta) : null),
    told ? h('div', { class: 'shs-meta' + ((t.told || {})[side] ? '' : ' shs-untold'), dir: 'auto', 'data-id': 'shidduch.told-state' }, `${sd.talkName(m, side)} ${told}`) : null);
}

// Shown right after Thinking or Yes was chosen: who told me (the Talk to person is one tap).
function reporterBox(m) {
  const { eventId, side } = U.reporter;
  const input = h('input', { class: 'input', dir: 'auto', placeholder: T.whoToldPh, 'data-id': 'shidduch.reporter-input', 'aria-label': T.whoTold });
  const save = async (name) => { U.reporter = null; if (name.trim()) { await sd.setSource(m, side, eventId, name); toast(T.sourceSaved); } else draw(true); };
  const talk = sd.talkTo(m[side]);
  return h('div', { class: 'sh-note-form', 'data-id': 'shidduch.reporter' },
    h('div', { class: 'sh-formlabel' }, `${sd.T.side[side]} · `, T.whoTold, h('span', { class: 'note' }, T.optional)),
    talk ? h('button', { type: 'button', class: 'bubble shs-quickname', dir: 'auto', 'data-id': 'shidduch.reporter-talk', onClick: () => save(talk.name) }, talk.name) : null,
    h('div', { class: 'sh-inlinepair' }, input,
      h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.reporter-save', onClick: () => save(input.value) }, T.saveSource),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.reporter-skip', onClick: () => save('') }, T.skip)));
}

async function engaged(m) {
  if (!(await confirmDialog({ title: T.engagedTitle(sd.coupleName(m)), text: T.engagedText, ok: T.engagedBtn, dataId: 'shidduch.engaged-dialog' }))) return;
  const r = await sd.markEngaged(m);
  if (r) undoToast(T.engagedToast, r);
}

async function remove(m) {
  if (!(await confirmDialog({ title: T.delTitle(sd.coupleName(m)), text: T.delText, ok: T.delOk, danger: true, dataId: 'shidduch.delete-dialog' }))) return;
  unsub && unsub(); unsub = null; // the page is leaving: no redraw of a record that is gone
  await sd.removeShidduch(m);
  toast(T.delDone, 5000); navigate('/shidduchim');
}

function logView(e) {
  return h('div', { class: 'sh-log', 'data-id': 'shidduch.history-item' }, h('span', { class: 'sh-dot' }),
    h('div', { class: 'sh-logbody' },
      h('div', { class: 'sh-logtitle', dir: 'auto' }, e.text),
      h('div', { class: 'sh-logmeta' }, sd.dateTime(e.at), e.eventAt && e.eventAt.slice(0, 16) !== (e.at || '').slice(0, 16) ? T.happened(sd.whenNice(e.eventAt)) : ''),
      e.source ? h('div', { class: 'sh-logextra', dir: 'auto' }, T.source(e.source)) : null));
}

// ---------- Dates ----------
function datesView(m) {
  const list = m.cur.dates, live = sd.isOpen(m.cur.t);
  return [
    h('div', { class: 'sh-section-title' },
      h('div', {}, h('h2', {}, T.dates), h('div', { class: 'note' }, T.datesNote)),
      live ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.arrange', onClick: openDateForm }, T.arrange) : null),
    m.cur.t.phase === 'ended' ? h('p', { class: 'note' }, T.datesEnded) : null,
    U.dateEdit !== null ? dateForm(m) : null,
    U.reporter ? reporterBox(m) : null,
    list.length ? h('div', { class: 'shs-dates', 'data-id': 'shidduch.dates-list' }, list.map(d => dateCard(m, d)))
      : h('div', { class: 'sh-blank plain' }, h('h3', {}, T.noDates), h('p', {}, T.noDatesHint)),
    h('div', { class: 'note' }, T.barNote),
  ];
}

// One date: when and where, then (once it is behind us) the two answers and each side's private feedback.
function dateCard(m, d) {
  const n = sd.dateNum(d), r = m.round, live = sd.isOpen(m.cur.t);
  const current = r.kind === 'date' && r.rec.id === d.id && !r.upcoming;
  const behind = d.status === 'Happened' || (d.status === 'Arranged' && current);
  const fb = sd.SIDES.map(s => [s, sd.sideOf(d, s).feedback]).filter(x => x[1]);
  return h('div', { class: 'shs-date' + (d.status === 'Cancelled' ? ' shs-dim' : ''), 'data-id': 'shidduch.date' },
    h('div', { class: 'shs-date-head' },
      h('span', { class: 'sh-calendar' }, n),
      h('span', { class: 'sh-dateinfo' }, h('strong', {}, T.dateTitle(n, d.status)), h('small', { dir: 'auto' }, sd.whenNice(d.when), d.where ? ' · ' + d.where : '')),
      live ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.date-edit', onClick: () => { U.dateEdit = d.id; draw(true).then(showForm); } }, T.editDate) : null),
    behind ? h('div', { class: 'shs-after', 'data-id': 'shidduch.after-date' },
      current && live ? sd.SIDES.map(s => h('label', { class: 'shs-after-side' }, h('span', { class: 'sh-answerlabel' }, sd.T.side[s]), answerSelect(m, s, 'shidduch.after-' + s)))
        : h('div', { class: 'shs-tags' }, answerTag(d, 'guy'), answerTag(d, 'girl'))) : null,
    fb.length ? h('div', { class: 'shs-feedback', 'data-id': 'shidduch.date-feedback' }, fb.map(([s, text]) => h('p', { dir: 'auto' }, h('span', { class: 'sh-answerlabel' }, sd.T.side[s] + ' '), text))) : null,
    behind ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.feedback-btn', onClick: () => feedbackSheet(m, d) }, T.feedback) : null);
}

async function feedbackSheet(m, d) {
  const box = (s) => { const a = h('textarea', { class: 'input', rows: 3, dir: 'auto', 'data-id': 'sh-feedback.' + s }); a.value = sd.sideOf(d, s).feedback || ''; return a; };
  const guy = box('guy'), girl = box('girl');
  await sheet({ title: T.feedbackTitle(sd.dateNum(d)), dataId: 'sh-feedback',
    body: [h('p', { class: 'note' }, T.feedbackNote),
      h('div', { class: 'field' }, h('label', { dir: 'auto' }, T.feedbackOf(sd.T.side.guy, sd.fullName(m, 'guy'))), guy),
      h('div', { class: 'field' }, h('label', { dir: 'auto' }, T.feedbackOf(sd.T.side.girl, sd.fullName(m, 'girl'))), girl)],
    actions: [{ id: 'save', label: T.saveSource, primary: true, run: async () => { await sd.saveFeedback(d, { guy: guy.value, girl: girl.value }); toast(T.feedbackSaved); } }] });
}

function dateForm(m) {
  const isNew = U.dateEdit === 'new';
  const d = isNew ? null : m.cur.dates.find(x => x.id === U.dateEdit);
  if (!isNew && !d) { U.dateEdit = null; return null; }
  const n = isNew ? Math.max(0, ...m.cur.dates.map(sd.dateNum)) + 1 : sd.dateNum(d);
  const when = h('input', { class: 'input', type: 'datetime-local', required: true, id: 'shs-date-when', value: sd.toLocalInput(d?.when), 'data-id': 'shidduch.date-when' });
  const where = h('input', { class: 'input', id: 'shs-date-where', placeholder: T.wherePh, dir: 'auto', value: d?.where || '', 'data-id': 'shidduch.date-where' });
  const status = h('select', { class: 'input', id: 'shs-date-status', 'data-id': 'shidduch.date-status' }, sd.DATE_STATUSES.map(x => h('option', { value: x, selected: x === (d?.status || 'Arranged') || null }, x)));
  const fld = (label, el) => h('div', { class: 'field' }, h('label', { for: el.id }, label), el);
  return h('form', { class: 'sh-formbox', 'data-id': 'shidduch.date-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!when.value) { toast(T.whenMissing); when.focus(); return; }
    const r = await sd.saveDate(m, d, { when: when.value, where: where.value, status: status.value });
    U.dateEdit = null;
    if (r) undoToast(T.dateSaved, r); else draw(true);
  } },
    h('h3', {}, isNew ? T.formNew + ` · ${sd.T.stage.date(n)}` : T.formEdit(n)),
    h('div', { class: 'sh-form-grid' }, h('div', { class: 'sh-form-row' }, fld(T.when, when), fld(T.where, where)), fld(T.status, status)),
    isNew && sd.dateMarksYes(m) ? h('p', { class: 'note', 'data-id': 'shidduch.date-marks-yes' }, T.marksYes) : null,
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.date-cancel', onClick: () => { U.dateEdit = null; draw(true); } }, T.cancel),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.date-save' }, T.saveDate)));
}

// ---------- History ----------
function historyView(m) {
  const v = m.cur;
  return [
    h('div', { class: 'sh-section-title' }, h('h2', {}, T.history),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.history-add-note', 'aria-expanded': U.noteOpen ? 'true' : 'false', onClick: () => { U.noteOpen = !U.noteOpen; draw(true).then(() => root?.querySelector('[data-id="shidduch.note-text"]')?.focus()); } }, T.addNote)),
    U.noteOpen ? noteForm(m) : null,
    h('div', { class: 'sh-timeline', 'data-id': 'shidduch.history-list' }, v.events.length ? v.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, T.noActivity)),
    m.tries.length > 1 ? h('div', { class: 'sh-older', 'data-id': 'shidduch.previous-tries' }, h('h3', {}, T.previous),
      m.tries.slice(0, -1).map((old, i) => h('details', { 'data-id': 'shidduch.previous-try' },
        h('summary', { dir: 'auto' }, T.prevSummary(sd.tryName(i + 1), sd.whoEnded(old.t), old.t.endedReason)),
        h('div', { class: 'sh-oldinner' }, bar(old, { dim: true }),
          old.dates.length ? h('div', { class: 'note' }, old.dates.map(d => `${T.dateTitle(sd.dateNum(d), d.status)} · ${sd.whenNice(d.when)}`).join(' / ')) : null,
          h('div', { class: 'sh-timeline' }, old.events.length ? old.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, T.noActivity)))))) : null,
    h('p', { class: 'note' }, T.privateNote),
  ];
}

function noteForm(m) {
  const text = h('textarea', { class: 'input', id: 'shs-note', rows: 3, dir: 'auto', required: true, placeholder: T.notePh, 'data-id': 'shidduch.note-text', onInput: (e) => { U.noteText = e.target.value; } }, U.noteText);
  return h('form', { class: 'sh-note-form', 'data-id': 'shidduch.note-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!text.value.trim()) { toast(T.noteEmpty); text.focus(); return; }
    const r = await sd.addNote(m, text.value);
    U.noteOpen = false; U.noteText = '';
    undoToast(T.noteSaved, r);
  } },
    h('label', { class: 'sh-formlabel', for: 'shs-note' }, T.newNote), text,
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.note-cancel', onClick: () => { U.noteOpen = false; draw(true); } }, T.cancel),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.note-save' }, T.saveNote)));
}
