// Shidduch details — Overview / Dates / History (spec/shidduchim.md SH-02 … SH-04).
// Same 11-segment bar as the list, past tries dimmed underneath, two person cards with
// their own Answer dropdown, one Shadchan line, References, Try Again (only after Ended),
// Recent history (3 items with date and time), Dates with the simple Astra form, History
// with inline Add note and expandable previous tries. The quick-choice panel from the list
// is deliberately NOT repeated here.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import * as sh from './shidduch-data.js';
import { bar, endDialog } from './shidduchim.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const TABS = [['overview', 'Overview'], ['dates', 'Dates'], ['history', 'History']];
let root = null, gen = 0, unsub = null, timer = 0, M = null, tab = 'overview';
const U = { dateEdit: null, noteOpen: false, noteText: '', reporter: null, confirmTry: false }; // UI state, reset per record
let currentId = null;

export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params) {
  root = container;
  root.classList.add('sh-page', 'sh-detail-page');
  tab = TABS.some(t => t[0] === params.tab) ? params.tab : 'overview';
  if (currentId !== params.id) { currentId = params.id; Object.assign(U, { dateEdit: null, noteOpen: false, noteText: '', reporter: null, confirmTry: false }); }
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => draw(params.id, true), 80); } });
  await draw(params.id);
}

async function draw(id, keepScroll = false) {
  const token = ++gen;
  const { all, m } = await sh.loadOne(id);
  if (token !== gen || !root) return;
  const y = window.scrollY;
  root.innerHTML = '';
  if (!m) { root.append(h('p', { class: 'empty' }, 'This shidduch is no longer saved.'), h('a', { class: 'btn', href: '#/shidduchim' }, 'Back to Shidduchim')); return; }
  M = { ...m, all };
  const t = m.cur.t, st = m.lane, idx = m.tries.length;
  const enc = encodeURIComponent(m.o.id);
  root.append(
    h('div', { class: 'sh-detailhead', 'data-id': 'shidduch.head' },
      h('div', { class: 'sh-detailhead-left' },
        h('a', { class: 'sh-back', href: '#/shidduchim', 'data-id': 'shidduch.back' }, ico('back'), 'Back to Shidduchim'),
        h('div', { class: 'sh-couple-line', dir: 'auto' }, `Me & ${sh.personName(m)}`, idx > 1 ? ` · ${sh.tryName(idx)}` : '')),
      h('span', { class: 'sh-statuslabel' + (st === 'ended' ? ' ended' : ''), 'data-id': 'shidduch.status' }, st === 'offers' ? 'Offer' : st === 'progress' ? 'In Progress' : 'Ended')),
    h('div', { class: 'sh-detailbar', 'data-id': 'shidduch.bar' },
      bar(t, m.cur.dates, { dim: st === 'ended', large: true }),
      h('div', { class: 'sh-legend' }, ['Offer', 'References', 'Dates 1–8', 'Marriage'].map(x => h('span', {}, x))),
      m.tries.length > 1 ? h('div', { class: 'sh-pastbars', 'data-id': 'shidduch.past-bars' }, m.tries.slice(0, -1).map((old, i) => [
        h('div', { class: 'sh-pastname' }, `${sh.tryName(i + 1)} · ended`), bar(old.t, old.dates, { dim: true })])) : null),
    h('div', { class: 'sh-detailtabs', role: 'tablist', 'data-id': 'shidduch.tabs' },
      TABS.map(([k, l]) => h('a', { role: 'tab', class: 'sh-detailtab', 'aria-selected': tab === k ? 'true' : 'false', href: `#/shidduchim/${enc}${k === 'overview' ? '' : '/' + k}`, 'data-id': 'shidduch.tab-' + k }, l))),
    h('div', { class: 'sh-detailbody', 'data-id': 'shidduch.' + tab }, tab === 'overview' ? overview(m) : tab === 'dates' ? datesView(m) : historyView(m)));
  if (keepScroll) window.scrollTo(0, y);
}

function go(k) { navigate(`/shidduchim/${encodeURIComponent(M.o.id)}${k === 'overview' ? '' : '/' + k}`); }

// ---------- Overview ----------
function overview(m) {
  const t = m.cur.t, st = m.lane, summ = sh.summary(t, m.cur.dates);
  const idx = m.tries.length;
  const recent = m.cur.events.slice(0, 3);
  return [
    h('div', { class: 'sh-overview-title', 'data-id': 'shidduch.summary' }, h('h2', {}, summ.title), summ.next ? h('p', { dir: 'auto' }, summ.next) : null),
    st === 'ended' ? h('div', { class: 'sh-endpanel', 'data-id': 'shidduch.ended' }, h('strong', { dir: 'auto' }, `Ended by ${sh.endedByName(m, t)}`), t.endedReason ? h('p', { dir: 'auto' }, t.endedReason) : null) : null,
    h('div', { class: 'sh-people', 'data-id': 'shidduch.people' }, personCard(m, 'me'), personCard(m, 'them')),
    U.reporter ? reporterBox() : null,
    h('div', { class: 'sh-underpeople', 'data-id': 'shidduch.shadchan' },
      h('span', { class: 'sh-shadchan' }, 'Shadchan: ', m.shadchan
        ? h('a', { href: `#/contacts/${encodeURIComponent(m.shadchan.id)}`, 'data-id': 'shidduch.shadchan-link', dir: 'auto' }, store.displayName(m.shadchan))
        : h('span', { class: 'muted' }, 'not recorded')),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.shadchan-set', onClick: () => shadchanSheet(m) }, m.shadchan ? 'Change' : 'Set')),
    st !== 'ended' ? h('div', { class: 'sh-panel soft', 'data-id': 'shidduch.references' },
      h('div', { class: 'sh-minihead' }, h('h3', {}, 'References'), h('span', { class: 'chip' }, t.refsChecked ? 'Checked' : 'Not checked')),
      h('div', { class: 'note' }, t.refsChecked ? 'References have been checked.' : 'Leave this unfinished if references were skipped, even when dates begin.'),
      !t.refsChecked ? h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.refs-btn', onClick: async () => { await sh.markRefs(m); toast('References marked checked'); } }, 'Mark references checked') : null) : null,
    st === 'ended' ? h('div', { class: 'sh-panel', 'data-id': 'shidduch.try-again' },
      h('div', { class: 'sh-minihead' }, h('div', {}, h('h3', {}, 'Another try?'), h('div', { class: 'note' }, 'Previous dates and history will be kept.')),
        h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-btn', 'aria-expanded': U.confirmTry ? 'true' : 'false', onClick: () => { U.confirmTry = !U.confirmTry; draw(m.o.id, true); } }, 'Try Again')),
      idx >= sh.PROVISIONAL_TRIES ? h('p', { class: 'note' }, `This couple already had ${idx} tries. Three tries total is the provisional limit in the design; it is not enforced here.`) : null,
      U.confirmTry ? h('div', { class: 'sh-note-form', 'data-id': 'shidduch.try-confirm' },
        h('strong', {}, 'Start a new try with this same couple?'), h('p', { class: 'note' }, 'The past try stays saved. New dates start from Date 1.'),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn primary', 'data-id': 'shidduch.try-confirm-btn', onClick: async () => { U.confirmTry = false; await sh.tryAgain(m); toast('New try started; past history saved'); } }, `Start ${sh.tryName(idx + 1)}`),
          h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.try-cancel', onClick: () => { U.confirmTry = false; draw(m.o.id, true); } }, 'Cancel'))) : null) : null,
    h('div', { class: 'sh-history-head' }, h('h3', {}, 'Recent history'),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.add-note', onClick: () => { U.noteOpen = true; go('history'); } }, 'Add note')),
    recent.length ? h('div', { class: 'sh-timeline', 'data-id': 'shidduch.recent' }, recent.map(logView)) : h('div', { class: 'note sh-emptyhistory' }, 'Nothing recorded yet.'),
    h('a', { class: 'linkish sh-notelink', href: `#/shidduchim/${encodeURIComponent(m.o.id)}/history`, 'data-id': 'shidduch.all-history' }, 'See all history'),
  ];
}

function personCard(m, side) {
  const t = m.cur.t, ended = m.lane === 'ended';
  const v = side === 'me' ? t.myAnswer : t.theirAnswer;
  let first = 'Me', last = '', meta1 = '', meta2 = '', href = '#/profile', initials = 'ME';
  if (side === 'me') {
    const me = M.all.me;
    if (me && me.name) { const parts = me.name.trim().split(/\s+/); first = parts[0]; last = parts.slice(1).join(' '); initials = store.initials(me); }
    meta1 = [me?.age, me?.city].filter(Boolean).join(' · ') || 'My Profile';
    meta2 = me?.occupation || (me ? '' : 'Fill in My Profile to show your details here');
  } else if (m.person) {
    const parts = sh.personName(m).trim().split(/\s+/); first = parts[0]; last = parts.slice(1).join(' ');
    meta1 = [m.person.age, m.person.city].filter(Boolean).join(' · ') || 'Age and city not recorded';
    meta2 = m.person.occupation || '';
    href = `#/people/${encodeURIComponent(m.person.id)}`; initials = store.initials(m.person);
  } else { first = sh.personName(m); href = null; initials = '?'; meta1 = 'Person record removed'; }
  const sel = h('select', { class: 'input sh-answerselect ' + sh.answerClass(v), id: 'sh-answer-' + side, 'data-id': 'shidduch.answer-' + side, disabled: ended || null, 'aria-label': `${sh.sideName(m, side)}'s answer`,
    onChange: (e) => selectedAnswer(m, side, e.target.value) },
    h('option', { value: '', selected: !v || null }, 'Not answered yet'),
    sh.ANSWERS.map(o => h('option', { value: o, selected: v === o || null }, o)));
  return h('div', { class: 'sh-person ' + side, 'data-id': 'shidduch.person-' + side },
    h('div', { class: 'sh-personhead' },
      h('span', { class: 'avatar' + (side === 'them' ? ' them' : '') }, initials),
      href ? h('a', { class: 'sh-who', href, title: side === 'me' ? 'Open My Profile' : 'Open person profile', 'data-id': 'shidduch.person-link', dir: 'auto' }, h('span', {}, first), last ? h('span', {}, last) : null)
        : h('span', { class: 'sh-who', dir: 'auto' }, h('span', {}, first))),
    h('div', { class: 'sh-persmeta', dir: 'auto' }, meta1, meta2 ? h('br') : null, meta2 || null),
    h('div', { class: 'sh-answerfield' }, h('label', { class: 'sh-answerlabel', for: 'sh-answer-' + side }, 'Answer'), sel));
}

async function selectedAnswer(m, side, value) {
  if (m.lane === 'ended') return;
  if (value === 'No') { const ok = await endDialog(m, { side }); if (!ok) draw(m.o.id, true); return; }
  const r = await sh.setAnswer(m, side, value);
  if (!r) return;
  U.reporter = r.event.id;
  toast(`${sh.sideName(m, side)}'s answer updated`);
}

function reporterBox() {
  const input = h('input', { class: 'input', dir: 'auto', placeholder: 'e.g. Mrs. Cohen', 'data-id': 'shidduch.reporter-input', 'aria-label': 'Who told you?' });
  return h('div', { class: 'sh-note-form', 'data-id': 'shidduch.reporter' },
    h('div', { class: 'sh-formlabel' }, 'Who told you? ', h('span', { class: 'note' }, '(optional)')),
    h('div', { class: 'sh-inlinepair' }, input,
      h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.reporter-save', onClick: async () => {
        const ev = M.cur.events.find(e => e.id === U.reporter); U.reporter = null;
        if (ev && input.value.trim()) { await sh.setEventSource(ev, input.value); toast('Source saved'); } else draw(M.o.id, true);
      } }, 'Save source'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'shidduch.reporter-skip', onClick: () => { U.reporter = null; draw(M.o.id, true); } }, 'Skip')));
}

async function shadchanSheet(m) {
  const linked = (m.person?.contactIds || []).map(id => M.all.contactsById.get(id)).filter(Boolean);
  const shadchanim = M.all.contacts.filter(c => (c.roles || []).includes('shadchan') && !linked.some(l => l.id === c.id));
  const opts = [...linked, ...shadchanim.sort((a, b) => store.displayName(a).localeCompare(store.displayName(b)))].map(c => [c.id, store.displayName(c)]);
  let chosen = m.o.contactId || '';
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search contacts…', dir: 'auto', 'data-id': 'shadchan-sheet.search' });
  const picker = bubbles({ options: opts, selected: chosen ? [chosen] : [], multi: false, dataId: 'shadchan-sheet.pick', onChange: (v) => { chosen = v; } });
  search.addEventListener('input', () => { const q = search.value.trim().toLowerCase(); picker.setOptions(opts.filter(o => !q || o[1].toLowerCase().includes(q))); });
  await sheet({ title: 'Shadchan for this shidduch', dataId: 'shadchan-sheet', className: 'tall',
    body: [h('p', { class: 'note' }, 'One contact record, linked here. Contacts linked to the person come first.'), search, picker,
      h('p', { class: 'note' }, 'Not in the list? Add them from Contacts → Add Shadchan first.')],
    actions: [{ id: 'clear', label: 'Clear', run: async () => { await sh.setShadchan(m, null); toast('Shadchan cleared'); } },
      { id: 'save', label: 'Save', primary: true, run: async () => { await sh.setShadchan(m, chosen || null); toast(chosen ? 'Shadchan saved' : 'Shadchan cleared'); } }] });
}

function logView(e) {
  return h('div', { class: 'sh-log', 'data-id': 'shidduch.history-item' }, h('span', { class: 'sh-dot' }),
    h('div', { class: 'sh-logbody' },
      h('div', { class: 'sh-logtitle', dir: 'auto' }, e.text),
      h('div', { class: 'sh-logmeta' }, sh.dateTime(e.at), e.eventAt && e.eventAt.slice(0, 16) !== (e.at || '').slice(0, 16) ? ` · happened ${sh.whenNice(e.eventAt)}` : ''),
      e.source ? h('div', { class: 'sh-logextra', dir: 'auto' }, 'Source: ' + e.source) : null));
}

// ---------- Dates ----------
function datesView(m) {
  const list = m.cur.dates;
  const ended = m.lane === 'ended';
  return [
    h('div', { class: 'sh-section-title' },
      h('div', {}, h('h2', {}, 'Dates'), h('div', { class: 'note' }, 'Arrange, update, and keep a record of each date.')),
      !ended ? h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.arrange', onClick: () => { U.dateEdit = 'new'; draw(m.o.id, true).then(() => root?.querySelector('[data-id="shidduch.date-form"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); } }, 'Arrange a date') : null),
    ended ? h('p', { class: 'note' }, 'This try has ended. Its dates stay as a record. Use Try Again on Overview for a new attempt.') : null,
    U.dateEdit !== null ? dateForm(m) : null,
    list.length ? h('div', { class: 'sh-dates', 'data-id': 'shidduch.dates-list' }, list.map(d => h('button', { type: 'button', class: 'sh-dateitem', 'data-id': 'shidduch.date', onClick: () => { U.dateEdit = d.id; draw(m.o.id, true).then(() => root?.querySelector('[data-id="shidduch.date-form"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); } },
      h('span', { class: 'sh-calendar' }, sh.dateNum(d)),
      h('span', { class: 'sh-dateinfo' }, h('strong', {}, `Date ${sh.dateNum(d)} · ${d.status}`), h('small', { dir: 'auto' }, sh.whenNice(d.when), d.where ? ' · ' + d.where : '')),
      ico('chevron'))))
      : h('div', { class: 'sh-blank plain' }, h('h3', {}, 'No dates yet'), h('p', {}, 'Use “Arrange a date” when both people are ready.')),
    h('div', { class: 'note' }, 'Dates only colour the progress bar after they are marked Happened. Cancelled dates stay in the list. Dates past the eighth keep their real number even though the bar stops at Date 8.'),
  ];
}

function dateForm(m) {
  const isNew = U.dateEdit === 'new';
  const d = isNew ? null : m.cur.dates.find(x => x.id === U.dateEdit);
  if (!isNew && !d) { U.dateEdit = null; return null; }
  const n = isNew ? Math.max(0, ...m.cur.dates.map(sh.dateNum)) + 1 : sh.dateNum(d);
  const when = h('input', { class: 'input', type: 'datetime-local', required: true, id: 'sh-date-when', value: sh.toLocalInput(d?.when), 'data-id': 'shidduch.date-when' });
  const where = h('input', { class: 'input', id: 'sh-date-where', placeholder: 'Meeting place', dir: 'auto', value: d?.where || '', 'data-id': 'shidduch.date-where' });
  const status = h('select', { class: 'input', id: 'sh-date-status', 'data-id': 'shidduch.date-status' }, ['Arranged', 'Happened', 'Cancelled'].map(x => h('option', { value: x, selected: x === (d?.status || 'Arranged') || null }, x)));
  const feedback = h('textarea', { class: 'input', id: 'sh-date-feedback', rows: 3, dir: 'auto', placeholder: 'Optional notes about the date', 'data-id': 'shidduch.date-feedback' }, d?.feedback || '');
  const fld = (label, el) => h('div', { class: 'field' }, h('label', { for: el.id }, label), el);
  return h('form', { class: 'sh-formbox', 'data-id': 'shidduch.date-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!when.value) { toast('Choose a date and time'); when.focus(); return; }
    await sh.saveDate(m, d, { when: when.value, where: where.value, status: status.value, feedback: feedback.value });
    U.dateEdit = null; toast('Date saved');
  } },
    h('h3', {}, isNew ? 'Arrange a date' : `Edit Date ${n}`),
    h('div', { class: 'sh-form-grid' },
      h('div', { class: 'sh-form-row' }, fld('When', when), fld('Where', where)),
      fld('Status', status), fld('Feedback (private)', feedback)),
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.date-cancel', onClick: () => { U.dateEdit = null; draw(m.o.id, true); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.date-save' }, 'Save date')));
}

// ---------- History ----------
function historyView(m) {
  const t = m.cur;
  return [
    h('div', { class: 'sh-section-title' }, h('h2', {}, 'History'),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'shidduch.history-add-note', 'aria-expanded': U.noteOpen ? 'true' : 'false', onClick: () => { U.noteOpen = !U.noteOpen; draw(m.o.id, true).then(() => root?.querySelector('[data-id="shidduch.note-text"]')?.focus()); } }, 'Add note')),
    U.noteOpen ? noteForm(m) : null,
    h('div', { class: 'sh-timeline', 'data-id': 'shidduch.history-list' }, t.events.length ? t.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, 'No activity yet.')),
    m.tries.length > 1 ? h('div', { class: 'sh-older', 'data-id': 'shidduch.previous-tries' }, h('h3', {}, 'Previous tries'),
      m.tries.slice(0, -1).map((old, i) => h('details', { 'data-id': 'shidduch.previous-try' },
        h('summary', { dir: 'auto' }, `${sh.tryName(i + 1)} · ${old.t.endedBy ? 'Ended by ' + sh.endedByName(m, old.t) : 'Previous try'}${old.t.endedReason ? ' · ' + old.t.endedReason : ''}`),
        h('div', { class: 'sh-oldinner' }, bar(old.t, old.dates, { dim: true }),
          old.dates.length ? h('div', { class: 'note' }, old.dates.map(d => `Date ${sh.dateNum(d)} · ${d.status} · ${sh.whenNice(d.when)}`).join(' / ')) : null,
          h('div', { class: 'sh-timeline' }, old.events.length ? old.events.map(logView) : h('div', { class: 'note sh-emptyhistory' }, 'No activity recorded.')))))) : null,
    h('p', { class: 'note' }, 'History and notes are private. They are never part of a shared profile.'),
  ];
}

function noteForm(m) {
  const text = h('textarea', { class: 'input', id: 'sh-note', rows: 3, dir: 'auto', required: true, placeholder: 'What happened?', 'data-id': 'shidduch.note-text', onInput: (e) => { U.noteText = e.target.value; } }, U.noteText);
  return h('form', { class: 'sh-note-form', 'data-id': 'shidduch.note-form', onSubmit: async (e) => {
    e.preventDefault();
    if (!text.value.trim()) { toast('Write a few words first'); text.focus(); return; }
    await sh.addNote(m, text.value);
    U.noteOpen = false; U.noteText = ''; toast('Note saved');
  } },
    h('label', { class: 'sh-formlabel', for: 'sh-note' }, 'New note'), text,
    h('div', { class: 'sh-formfoot' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'shidduch.note-cancel', onClick: () => { U.noteOpen = false; draw(m.o.id, true); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shidduch.note-save' }, 'Save note')));
}
