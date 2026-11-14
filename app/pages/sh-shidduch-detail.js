// One shidduch in Shadchan Mode — Overview / Dates / History (spec/shadchan/design.md 6.4).
// The bar (Offer · References · Dates 1–8 · Engaged), a "your move" line, one card per side
// (the single, whom I talk to, the answer and who told me), references, engaged, Try Again,
// dates with both sides' answers and private feedback after each one, and one shared history.
// Look: Single Mode's details page (shidduchim.css) plus the shs-… rules in singles.css.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, confirmDialog, dock, swipeTabs, telLink, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { statusOf, statusLabel, summaryLine } from './singles-data.js';
import * as sd from './sh-shidduch-data.js';
import { bar, barDim, endDialog, answerTag } from './sh-shidduch-parts.js';
import { sendSheet } from './sh-send.js';
import { addMic, savePending, voiceChips } from '../js/voice.js';
const VP = {}; // voice recordings waiting for Save, per shidduch (memory only)

const T = {
  gone: 'This shidduch is no longer saved.',
  back: 'Back to Shidduchim',
  legend: ['Offer', 'References', 'Dates 1–8', 'Engaged'],
  tabs: [['overview', 'Overview'], ['dates', 'Dates'], ['history', 'History']],
  tryEnded: (name) => `${name} · ended`,
  yourMove: 'Your move: ',
  markAsked: (sides) => (sides.length === 2 ? 'Mark both sides asked' : `Mark ${sd.T.sideLow[sides[0]]} asked`),
  send: (name) => `Send to ${name}`,
  suggestTo: (side) => `Suggest to ${side}`,
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
  happenedBtn: 'Date happened', happenedToast: (n) => `Date ${n} marked happened`,
  asked: (ago) => `asked ${ago}`,
  answered: (ago) => `answered ${ago}`,
  toldBy: (name) => `told by ${name}`,
  wasTold: 'was told it ended',
  answerSaved: (side) => `${side} updated`,
  whoTold: 'Who told you? ',
  optional: '(optional)',
  whoToldPh: 'e.g. the mother',
  saveSource: 'Save', skip: 'Skip', sourceSaved: 'Saved',
  refs: 'References', refsYes: 'Checked', refsNo: 'Not checked',
  refsBtn: 'Mark references checked', refsToast: 'References marked checked',
  engagedQ: 'Engaged?',
  engagedBtn: 'Mark as engaged',
  engagedTitle: (names) => `Mark ${names} as engaged?`,
  engagedText: 'Both singles get the status Engaged. You can undo it.',
  engagedToast: 'Engaged. Mazal tov!',
  engagedHead: (when) => `Engaged${when ? ' · ' + when : ''}`,
  engagedOff: 'No longer engaged',
  again: 'Another try?', againBtn: 'Try Again',
  againLimit: (n) => `This couple already had ${n} tries.`,
  againConfirm: 'Start a new try? The past try stays saved.',
  againStart: (name) => `Start ${name}`, againDone: 'New try started',
  cancel: 'Cancel',
  recent: 'Recent history', addNote: 'Add note', allHistory: 'See all history', nothingYet: 'Nothing recorded yet.',
  del: 'Delete this shidduch',
  delTitle: (names) => `Delete ${names}?`,
  delText: 'Stays 30 days in Settings → Recently deleted. The two singles stay.',
  delOk: 'Delete', delDone: 'Deleted',
  end: 'End shidduch',
  // dates
  noDates: 'No dates yet',
  dateTitle: (n, status) => `Date ${n} · ${status}`,
  editDate: 'Edit', feedback: 'Feedback',
  feedbackTitle: (n) => `Feedback after Date ${n}`,
  feedbackNote: 'Private. Never sent.',
  feedbackOf: (side, name) => `${side} · ${name}`,
  feedbackSaved: 'Feedback saved',
  formNew: 'Arrange a date', formEdit: (n) => `Edit Date ${n}`,
  when: 'When', where: 'Where', wherePh: 'Meeting place', status: 'Status',
  marksYes: 'Saving marks both sides Yes.',
  whenMissing: 'Choose a date and time', dateSaved: 'Date saved', saveDate: 'Save date',
  // history
  history: 'History', noActivity: 'No activity yet.', previous: 'Previous tries',
  prevSummary: (name, who, reason) => `${name} · ${who ? 'Ended by ' + who : 'Previous try'}${reason ? ' · ' + reason : ''}`,
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
      m.lane === 'ideas' || m.round.upcoming ? null : h('button', { type: 'button', class: 'btn primary wide', 'data-id': 'shidduch.dock-date', onClick: openDateForm }, m.step.date ? T.arrangeN(m.step.date) : T.arrange)));
  if (keepScroll) window.scrollTo(0, y);
}

function openNote() { U.noteOpen = true; if (tab === 'history') draw(true).then(() => root?.querySelector('[data-id="shidduch.note-text"]')?.focus()); else go('history'); }
function openDateForm() { U.dateEdit = 'new'; if (tab === 'dates') draw(true).then(showForm); else { go('dates'); setTimeout(showForm, 300); } }

// ---------- Overview ----------
function overview(m) {
  const t = m.cur.t, idx = m.tries.length, live = sd.isOpen(t);
  const recent = m.cur.events.slice(0, 3);
  return [
    roundPanel(m) || stepLine(m),
    t.phase === 'ended' ? h('div', { class: 'sh-endpanel', 'data-id': 'shidduch.ended' }, h('strong', { dir: 'auto' }, [T.endedBy(sd.whoEnded(t)), sd.monthYear(t.endedAt)].filter(Boolean).join(' · ')),
      t.endedReason ? h('p', { dir: 'auto' }, t.endedReason) : null) : null,
    t.phase === 'engaged' ? h('div', { class: 'sh-panel shs-engaged-panel', 'data-id': 'shidduch.engaged' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.engagedHead(sd.monthYear(t.engagedAt))),
        h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.engaged-off', onClick: () => endDialog(m) }, T.engagedOff))) : null,
    h('div', { class: 'sh-people', 'data-id': 'shidduch.people' }, sideCard(m, 'guy'), sideCard(m, 'girl')),
    U.reporter ? reporterBox(m) : null,
    live && m.lane !== 'ideas' ? h('div', { class: 'sh-panel soft', 'data-id': 'shidduch.references' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.refs), h('span', { class: 'chip' }, t.refsChecked ? T.refsYes : T.refsNo)),
      !t.refsChecked ? h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.refs-btn', onClick: async () => { const r = await sd.markRefs(m); if (r) undoToast(T.refsToast, r); } }, T.refsBtn) : null) : null,
    t.phase === 'dating' ? h('div', { class: 'sh-panel', 'data-id': 'shidduch.engaged-ask' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.engagedQ),
        h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.engaged-btn', onClick: () => engaged(m) }, T.engagedBtn))) : null,
    t.phase === 'ended' ? h('div', { class: 'sh-panel', 'data-id': 'shidduch.try-again' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, T.again),
        h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-btn', 'aria-expanded': U.confirmTry ? 'true' : 'false', onClick: () => { U.confirmTry = !U.confirmTry; draw(true); } }, T.againBtn)),
      idx >= sd.PROVISIONAL_TRIES ? h('p', { class: 'note' }, T.againLimit(idx)) : null,
      U.confirmTry ? h('div', { class: 'sh-note-form', 'data-id': 'shidduch.try-confirm' },
        h('strong', {}, T.againConfirm),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-confirm-btn', onClick: async () => { U.confirmTry = false; await sd.tryAgain(m); toast(T.againDone); } }, T.againStart(sd.tryName(idx + 1))),
          h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.try-cancel', onClick: () => { U.confirmTry = false; draw(true); } }, T.cancel))) : null) : null,
    h('div', { class: 'sh-history-head' }, h('h3', {}, T.recent),
      live ? null : h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.add-note', onClick: openNote }, T.addNote)),
    recent.length ? h('div', { class: 'sh-timeline', 'data-id': 'shidduch.recent' }, recent.map(logView)) : h('div', { class: 'note sh-emptyhistory' }, T.nothingYet),
    h('a', { class: 'linkish sh-notelink', href: '#' + path('history'), 'data-id': 'shidduch.all-history' }, T.allHistory),
    h('div', { class: 'shs-foot' },
      live ? h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'shidduch.end', onClick: () => endDialog(m) }, T.end) : null,
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
    st.ask || st.tell ? h('div', { class: 'shs-step-acts' },
      st.ask && m.round.kind === 'offer' ? st.ask.map(s => btn(T.send(sd.talkName(m, s)), 'shidduch.send', () => sendSheet(m, s))) : null,
      (st.tell || []).map(s => btn(T.told(sd.talkName(m, s)), 'shidduch.told-' + s, async () => { const r = await sd.markTold(m, s); if (r) undoToast(T.toldToast, r); }))) : null,
    null);
}

// The answer of one side in the round that is open now. Used on Overview and on the Dates tab.
// One tap per answer (owner: no dropdown). The chosen one is filled in its colour.
function answerSelect(m, side, dataId) {
  const v = sd.ans(m.round.rec, side), off = !sd.isOpen(m.cur.t);
  return h('div', { class: 'sh-ans-row', role: 'radiogroup', id: dataId, 'data-id': dataId, 'aria-label': `${sd.T.side[side]}: ${sd.fullName(m, side)}` },
    sd.ANSWERS.map(a => h('button', { type: 'button', class: 'sh-ans ' + (v === a ? 'on ' + sd.answerClass(a) : ''), 'aria-pressed': v === a ? 'true' : 'false', disabled: off || null,
      'data-id': dataId + '.' + (a || 'none'), onClick: () => { if (v !== a) selected(m, side, a); } }, sd.answerLabel(a))));
}
async function selected(m, side, value) {
  if (value === 'no') { const ok = await endDialog(m, { side }); if (!ok) draw(true); return; }
  const r = await sd.setAnswer(m, side, value);
  if (!r) { draw(true); return; }
  U.reporter = value === 'thinking' || value === 'yes' ? { eventId: r.event.id, side } : null;
  undoToast(T.answerSaved(sd.T.side[side]), { undo: async () => { U.reporter = null; await r.undo(); } });
  // Both said Yes: the next step is a date, so show the Dates tab (owner request).
  if (value === 'yes' && sd.ans(m.round.rec, side === 'guy' ? 'girl' : 'guy') === 'yes' && tab !== 'dates') go('dates');
}

// Only the latest time (answered, else asked) and who told me.
function answerMeta(x) {
  const time = x.answeredAt && x.answer && x.answer !== 'asked' ? T.answered(sd.agoShort(x.answeredAt))
    : x.askedAt && x.answer ? T.asked(sd.agoShort(x.askedAt)) : null;
  return [time, x.toldBy ? T.toldBy(x.toldBy) : null].filter(Boolean).join(' · ');
}

function sideCard(m, side) {
  const p = m[side], t = m.cur.t, r = m.round, x = sd.sideOf(r.rec, side);
  const st = p ? statusOf(p) : 'available', talk = sd.talkTo(p);
  const name = sd.fullName(m, side);
  const meta = answerMeta(x);
  const told = t.phase === 'ended' && sd.wouldNeedTelling(t, t.endedBy).includes(side) && (t.told || {})[side] ? T.wasTold : '';
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
      : r.kind === 'date' ? null // while dating, answers live in the "After Date" box (roundPanel)
      : h('div', { class: 'sh-answerfield' },
        h('label', { class: 'sh-answerlabel', for: 'shidduch.answer-' + side }, r.kind === 'date' && !r.upcoming ? T.answerAfter(r.n) : T.answer),
        sd.isOpen(t) ? answerSelect(m, side, 'shidduch.answer-' + side) : h('div', { class: 'shs-tags', 'data-id': 'shidduch.answer-' + side }, answerTag(r.rec, side)),
        r.kind === 'offer' && sd.isOpen(t) && !x.answer && p && !(m.step.ask || []).includes(side) ? h('button', { type: 'button', class: 'btn small shs-suggest', 'data-id': 'shidduch.suggest-' + side, onClick: () => sendSheet(m, side) }, T.suggestTo(sd.T.sideLow[side])) : null,
        meta ? h('div', { class: 'shs-meta', dir: 'auto', 'data-id': 'shidduch.answer-meta' }, meta) : null),
    told ? h('div', { class: 'shs-meta', dir: 'auto', 'data-id': 'shidduch.told-state' }, `${sd.talkName(m, side)} ${told}`) : null);
}

// While dating: ONE box at the top of Overview and Dates for the latest date (Fable review, owner approved).
// The step line ("Your move…") is its first line; each side gets one-tap answers. Nothing else shows answers.
function roundPanel(m) {
  const r = m.round, t = m.cur.t;
  if (r.kind !== 'date' || t.phase === 'engaged' || t.phase === 'ended') return null;
  if (r.upcoming) return h('div', { class: 'sh-panel shs-afterbox', 'data-id': 'shidduch.round' },
    h('div', { class: 'shs-afterbox-head' }, `Date ${r.n} · ${sd.whenNice(r.rec.when)}`),
    happenedBtn(m));
  const side = (s) => {
    const x = sd.sideOf(r.rec, s);
    const meta = answerMeta(x);
    return h('div', { class: 'shs-afterbox-side', 'data-id': 'shidduch.round-' + s },
      h('div', { class: 'shs-afterbox-who', dir: 'auto' }, h('strong', {}, sd.T.side[s]), ' · ' + (sd.fullName(m, s).split(' ')[0] || ''), meta ? h('span', { class: 'shs-meta' }, meta) : null),
      answerSelect(m, s, 'shidduch.answer-' + s));
  };
  return h('div', { class: 'sh-panel shs-afterbox', 'data-id': 'shidduch.round' },
    h('div', { class: 'shs-afterbox-head' }, T.answerAfter(r.n), r.rec.when ? ' · ' + sd.whenNice(r.rec.when).split(' · ')[0] : ''),
    stepLine(m), side('guy'), side('girl'));
}

// The date that is still ahead: one tap says it happened, so its answers can be recorded.
function happenedBtn(m) {
  const r = m.round;
  return h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.date-happened', onClick: async () => {
    const x = await sd.saveDate(m, r.rec, { when: r.rec.when, where: r.rec.where, status: 'Happened' });
    if (x) undoToast(T.happenedToast(r.n), x);
  } }, T.happenedBtn);
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
      e.audioIds?.length && e.text === 'Voice note' ? null : h('div', { class: 'sh-logtitle', dir: 'auto' }, e.text),
      voiceChips(e.audioIds, 'shidduch.history-voice'),
      h('div', { class: 'sh-logmeta' }, sd.dateTime(e.at), e.eventAt && e.eventAt.slice(0, 16) !== (e.at || '').slice(0, 16) ? T.happened(sd.whenNice(e.eventAt)) : ''),
      e.source ? h('div', { class: 'sh-logextra', dir: 'auto' }, T.source(e.source)) : null));
}

// ---------- Dates ----------
function datesView(m) {
  const list = m.cur.dates;
  return [
    m.round.upcoming ? null : roundPanel(m), // an upcoming date is already its own card below
    U.reporter ? reporterBox(m) : null,
    U.dateEdit !== null ? dateForm(m) : null,
    list.length ? h('div', { class: 'shs-dates', 'data-id': 'shidduch.dates-list' }, list.map(d => dateCard(m, d)))
      : h('div', { class: 'sh-blank plain' }, h('h3', {}, T.noDates)),
  ];
}

// One date: when and where, then (once it is behind us) the two answers and each side's private feedback.
function dateCard(m, d) {
  const n = sd.dateNum(d), r = m.round, live = sd.isOpen(m.cur.t);
  const current = r.kind === 'date' && r.rec.id === d.id && !r.upcoming;
  const behind = d.status === 'Happened' || (d.status === 'Arranged' && current);
  const fb = sd.SIDES.map(s => [s, sd.sideOf(d, s).feedback, sd.sideOf(d, s).audioIds]).filter(x => x[1] || x[2]?.length);
  return h('div', { class: 'shs-date' + (d.status === 'Cancelled' ? ' shs-dim' : ''), 'data-id': 'shidduch.date' },
    h('div', { class: 'shs-date-head' },
      h('span', { class: 'sh-calendar' }, n),
      h('span', { class: 'sh-dateinfo' }, h('strong', {}, T.dateTitle(n, d.status)), h('small', { dir: 'auto' }, sd.whenNice(d.when), d.where ? ' · ' + d.where : '')),
      live ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.date-edit', onClick: () => { U.dateEdit = d.id; draw(true).then(showForm); } }, T.editDate) : null),
    live && r.upcoming && r.rec.id === d.id ? happenedBtn(m) : null,
    behind && !current ? h('div', { class: 'shs-after', 'data-id': 'shidduch.after-date' },
      h('div', { class: 'shs-tags' }, answerTag(d, 'guy'), answerTag(d, 'girl'))) : null,
    fb.length ? h('div', { class: 'shs-feedback', 'data-id': 'shidduch.date-feedback' }, fb.map(([s, text, aIds]) => h('div', {}, h('p', { dir: 'auto' }, h('span', { class: 'sh-answerlabel' }, sd.T.side[s] + ' '), text || ''), voiceChips(aIds, 'shidduch.date-voice')))) : null,
    behind ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.feedback-btn', onClick: () => feedbackSheet(m, d) }, T.feedback) : null);
}

async function feedbackSheet(m, d) {
  const pg = {}, pw = {}; // voice notes per side, saved with Save
  const box = (s) => { const a = h('textarea', { class: 'input', rows: 3, dir: 'auto', 'data-id': 'sh-feedback.' + s }); a.value = sd.sideOf(d, s).feedback || ''; return a; };
  const guy = box('guy'), girl = box('girl');
  await sheet({ title: T.feedbackTitle(sd.dateNum(d)), dataId: 'sh-feedback',
    body: [h('p', { class: 'note' }, T.feedbackNote),
      h('div', { class: 'field' }, h('label', { dir: 'auto' }, T.feedbackOf(sd.T.side.guy, sd.fullName(m, 'guy'))), addMic(guy, { dataId: 'sh-feedback.guy-mic', pend: pg })),
      h('div', { class: 'field' }, h('label', { dir: 'auto' }, T.feedbackOf(sd.T.side.girl, sd.fullName(m, 'girl'))), addMic(girl, { dataId: 'sh-feedback.girl-mic', pend: pw }))],
    actions: [{ id: 'save', label: T.saveSource, primary: true, run: async () => { await sd.saveFeedback(d, { guy: guy.value, girl: girl.value, audio: { guy: await savePending(pg), girl: await savePending(pw) } }); toast(T.feedbackSaved); } }] });
}

function dateForm(m) {
  const isNew = U.dateEdit === 'new';
  const d = isNew ? null : m.cur.dates.find(x => x.id === U.dateEdit);
  if (!isNew && !d) { U.dateEdit = null; return null; }
  const n = isNew ? Math.max(0, ...m.cur.dates.map(sd.dateNum)) + 1 : sd.dateNum(d);
  const when = h('input', { class: 'input when-big', type: 'datetime-local', id: 'shs-date-when', value: sd.toLocalInput(d?.when), 'data-id': 'shidduch.date-when' });
  const where = h('input', { class: 'input', id: 'shs-date-where', placeholder: T.wherePh, dir: 'auto', value: d?.where || '', 'data-id': 'shidduch.date-where' });
  let stat = d?.status || 'Arranged';
  const status = isNew ? null : bubbles({ options: sd.DATE_STATUSES.map(x => [x, x]), selected: [stat], multi: false, dataId: 'shidduch.date-status', onChange: (x) => { stat = x || stat; } });
  const fld = (label, el) => h('div', { class: 'field' }, h('label', { for: el.id }, label), el);
  return h('form', { class: 'sh-formbox', 'data-id': 'shidduch.date-form', onSubmit: async (e) => {
    e.preventDefault();
    const r = await sd.saveDate(m, d, { when: when.value, where: where.value, status: stat });
    U.dateEdit = null;
    if (r) undoToast(T.dateSaved, r); else draw(true);
  } },
    h('h3', {}, isNew ? T.formNew + ` · ${sd.T.stage.date(n)}` : T.formEdit(n)),
    h('div', { class: 'sh-form-grid' }, h('div', { class: 'sh-form-row' }, fld(T.when, when), fld(T.where, where)), status ? h('div', { class: 'field' }, h('label', {}, T.status), status) : null),
    isNew && sd.dateMarksYes(m) ? h('p', { class: 'note', 'data-id': 'shidduch.date-marks-yes' }, T.marksYes) : null,
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.date-cancel', onClick: () => { U.dateEdit = null; draw(true); } }, T.cancel),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.date-save' }, T.saveDate)));
}

// ---------- History ----------
function historyView(m) {
  const v = m.cur;
  return [
    sd.isOpen(m.cur.t) ? null : h('div', { class: 'sh-section-title' }, h('h2', {}, T.history),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.history-add-note', 'aria-expanded': U.noteOpen ? 'true' : 'false', onClick: () => { U.noteOpen = !U.noteOpen; draw(true).then(() => root?.querySelector('[data-id="shidduch.note-text"]')?.focus()); } }, T.addNote)),
    U.noteOpen ? noteForm(m) : null,
    h('div', { class: 'sh-timeline', 'data-id': 'shidduch.history-list' }, v.events.length ? v.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, T.noActivity)),
    m.tries.length > 1 ? h('div', { class: 'sh-older', 'data-id': 'shidduch.previous-tries' }, h('h3', {}, T.previous),
      m.tries.slice(0, -1).map((old, i) => h('details', { 'data-id': 'shidduch.previous-try' },
        h('summary', { dir: 'auto' }, T.prevSummary(sd.tryName(i + 1), sd.whoEnded(old.t), old.t.endedReason)),
        h('div', { class: 'sh-oldinner' }, bar(old, { dim: true }),
          old.dates.length ? h('div', { class: 'note' }, old.dates.map(d => `${T.dateTitle(sd.dateNum(d), d.status)} · ${sd.whenNice(d.when)}`).join(' / ')) : null,
          h('div', { class: 'sh-timeline' }, old.events.length ? old.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, T.noActivity)))))) : null,
  ];
}

function noteForm(m) {
  const text = h('textarea', { class: 'input', id: 'shs-note', rows: 3, dir: 'auto', placeholder: T.notePh, 'data-id': 'shidduch.note-text', onInput: (e) => { U.noteText = e.target.value; } }, U.noteText);
  return h('form', { class: 'sh-note-form', 'data-id': 'shidduch.note-form', onSubmit: async (e) => {
    e.preventDefault();
    const pend = VP[m.o.id] || {};
    if (!text.value.trim() && !pend.audio?.length) { toast(T.noteEmpty); text.focus(); return; }
    const r = await sd.addNote(m, text.value.trim() || 'Voice note', await savePending(pend));
    U.noteOpen = false; U.noteText = '';
    undoToast(T.noteSaved, r);
  } },
    h('label', { class: 'sh-formlabel', for: 'shs-note' }, T.newNote), addMic(text, { dataId: 'shidduch.note-mic', pend: VP[m.o.id] || (VP[m.o.id] = {}) }),
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.note-cancel', onClick: () => { U.noteOpen = false; draw(true); } }, T.cancel),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.note-save' }, T.saveNote)));
}
