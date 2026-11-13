// Home in Shadchan Mode — made from blocks the shadchan arranges (spec/shadchan/design.md 6.1, stage S4).
// home.js keeps the top (gear, search, New Note) and the Notes, Follow Ups and History it already draws;
// this file adds To do (Your move, Waiting for them, then the follow-ups), At a glance, My singles,
// Edit Home and the backup reminder. "Your move" and "Waiting" come straight from m.step
// (sh-shidduch-data.js nextStep): the rules are never worked out again here.
import * as store from '../js/store.js';
import { h, toast, sheet, bubbles } from '../js/ui.js';
import * as sd from './sh-shidduch-data.js';
import { endDialog } from './sh-shidduch-parts.js';
import { sendSheet } from './sh-send.js';
import { statusOf, statusLabel } from './singles-data.js';

const T = {
  blocks: { todo: 'To do', glance: 'At a glance', notes: 'Notes', singles: 'My singles', history: 'History' },
  blockNote: {
    todo: 'Your move, Waiting for them, and your follow-ups',
    glance: 'A few numbers, and singles with nothing moving',
    notes: 'Pinned and latest notes',
    singles: 'Singles you are working on, one line each',
    history: 'The latest lines from History',
  },
  todoEyebrow: 'What to do now',
  yourMove: 'Your move', waiting: 'Waiting for them',
  nothingMove: 'Nothing is waiting on you.',
  seeAll: (n) => `See all (${n})`, showLess: 'Show less',
  markAsked: (sides) => (sides.length === 2 ? 'Mark both asked' : `Mark ${sd.T.sideLow[sides[0]]} asked`),
  arrange: (n) => `Arrange Date ${n}`,
  told: (name) => `${name} was told`,
  toldToast: 'Marked as told',
  askedToast: 'Marked as asked',
  send: (name) => `Send to ${name}`,
  undo: 'Undo', undone: 'Undone',
  remind: 'Remind', gotAnswer: 'Got an answer',
  // Remind
  remindTitle: 'Remind',
  remindWho: 'Whom to remind',
  remindMsg: 'Message (you can change it)',
  remindOffer: (other) => `Hello, I wanted to follow up about the suggestion of ${other}. Have you had a chance to think about it?`,
  remindDate: (n, other) => `Hello, I wanted to hear how Date ${n} with ${other} went.`,
  remindNote: 'Opening WhatsApp or copying does not record anything: nothing here claims the message was sent or read.',
  remindNoNumber: (name) => `No number to use for ${name}. Choose “Talk to” on the single’s card to add one.`,
  whatsapp: 'WhatsApp', copy: 'Copy', copied: 'Copied',
  copyFailed: 'Could not copy. Select the text and copy it yourself.',
  // Got an answer
  answerTitle: 'Got an answer',
  answerWho: 'From which side',
  answerSource: 'Who told you? (optional)',
  answerNote: 'No asks who already knows, and ends the shidduch.',
  answers: { thinking: 'Thinking', yes: 'Yes', no: 'No' },
  answerSaved: (side, a) => `${side}: ${a}`,
  noChange: 'That answer was already recorded',
  // At a glance
  glanceEyebrow: 'Where things stand',
  stats: [['open', 'Open'], ['waiting', 'Waiting'], ['dating', 'Dating'], ['ideas', 'Ideas']],
  statNote: { open: 'Offers and In Progress', waiting: 'asked, no answer yet', dating: 'In Progress', ideas: 'nobody asked yet' },
  noOpen: 'No open shidduch',
  noOpenNote: 'Singles you are working on with nothing in Offers or In Progress. Tap one to find a match.',
  noStarred: 'Star a single as “Working on” on their card, and they show here when nothing is moving for them.',
  allMoving: 'Every single you are working on has something moving.',
  // My singles
  singlesEyebrow: 'Working on',
  withWho: (name) => `with ${name}`,
  ideaWith: (name) => `Idea with ${name}`,
  nothingNext: 'No open shidduch',
  // Edit Home
  editHome: 'Edit Home',
  editLead: 'Choose which blocks show on Home and in what order. Search and New Note always stay on top.',
  show: 'Show', up: 'Up', down: 'Down',
  firstLayout: 'Back to the first layout',
  firstLayoutDone: 'Back to the first layout',
  empty: 'Your Home is empty',
  emptyNote: 'Every block is hidden. Edit Home to bring some back.',
  // Backup reminder
  backupNever: 'No backup has been made on this device yet.',
  backupOld: (n) => `Last backup was ${n} days ago.`,
  backupNow: 'Back up now',
  // Search
  searchGroup: 'Shidduchim',
};

// ---------- layout (which blocks, in what order; a device setting, kept in backups) ----------
const DEFAULT = [['todo', true], ['glance', true], ['notes', true], ['singles', false], ['history', false]];
const PREF = 'shHomeBlocks';
const BACKUP_DAYS = 14;
const FIRST = 5;

export function layout() {
  const saved = Array.isArray(store.getPrefs()[PREF]) ? store.getPrefs()[PREF] : [];
  const known = new Map(DEFAULT);
  const out = [];
  for (const b of saved) if (b && known.has(b.id) && !out.some(x => x.id === b.id)) out.push({ id: b.id, on: !!b.on });
  for (const [id, on] of DEFAULT) if (!out.some(x => x.id === id)) out.push({ id, on });
  return out;
}
const saveLayout = (L) => store.setPref(PREF, L.map(b => ({ id: b.id, on: b.on })));

// ---------- data ----------
export async function load() { return sd.loadAll(); }

// ---------- drawing ----------
const els = new WeakMap(); // per Home page: the block wrappers, made once so moving them keeps typing focus
let more = { move: false, wait: false, noOpen: false, singles: false };

// parts: { notes, fus, hist } — the sections home.js already draws. SH: load(). D: home's notes data.
// keepNotes: show Notes even when hidden (a note was opened from elsewhere).
export function draw(grid, parts, SH, D, { keepNotes = false } = {}) {
  let w = els.get(grid);
  if (!w) {
    w = {
      key: '',
      todo: h('section', { class: 'sh-block shh-todo', 'data-id': 'home.todo' }),
      todoTop: h('div', { class: 'shh-todo-top' }),
      glance: h('section', { class: 'sh-block shh-glance', 'data-id': 'home.glance' }),
      singles: h('section', { class: 'sh-block shh-singles', 'data-id': 'home.my-singles' }),
      backup: h('div', { class: 'shh-backup-slot' }),
      edit: h('div', { class: 'shh-edit-row' }, h('button', { type: 'button', class: 'linkish', 'data-id': 'home.edit-home', onClick: () => editHome() }, T.editHome)),
    };
    w.todo.append(head(T.todoEyebrow, T.blocks.todo, null, 'home.todo-head'), w.todoTop, parts.fus);
    els.set(grid, w);
  }
  drawTodo(w.todoTop, SH);
  drawGlance(w.glance, SH);
  drawSingles(w.singles, SH);
  drawBackup(w.backup, SH, D);
  const L = layout().map(b => (b.id === 'notes' && keepNotes ? { ...b, on: true } : b));
  const key = L.map(b => b.id + (b.on ? '1' : '0')).join(',');
  if (key === w.key) return;
  w.key = key;
  const node = { todo: w.todo, glance: w.glance, notes: parts.notes, singles: w.singles, history: parts.hist };
  const shown = L.filter(b => b.on);
  grid.replaceChildren(w.backup, ...shown.map(b => node[b.id]),
    shown.length ? '' : h('div', { class: 'shh-empty', 'data-id': 'home.empty' },
      h('h2', {}, T.empty), h('p', { class: 'note' }, T.emptyNote),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'home.empty-edit', onClick: () => editHome() }, T.editHome)),
    shown.length ? w.edit : '');
}

function head(eyebrow, title, count, id) {
  return h('div', { class: 'home-sec-head', 'data-id': id }, h('div', { class: 'home-sec-eyebrow' }, eyebrow),
    h('div', { class: 'home-sec-title' }, h('h2', {}, title), count === null ? '' : h('span', { class: 'count' }, String(count))));
}
function subHead(title, count, id) {
  return h('div', { class: 'note-group-title', 'data-id': id }, title, ' ', h('span', { class: 'count' }, String(count)));
}
function moreBtn(key, total, id, redraw) {
  if (total <= FIRST) return '';
  return h('button', { type: 'button', class: 'section-expand', 'data-id': id, 'aria-expanded': more[key] ? 'true' : 'false',
    onClick: () => { more[key] = !more[key]; redraw(); } }, more[key] ? T.showLess : T.seeAll(total));
}
const cut = (list, key) => (more[key] ? list : list.slice(0, FIRST));
const href = (m, tab = '') => `#/shidduchim/${encodeURIComponent(m.o.id)}${tab}`;
const lastAt = (m) => m.cur.t.endedAt || m.o.updatedAt || m.o.createdAt || '';
// replaceChildren does not take nested lists or skip empty parts; h() does, so use this.
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== '' && k !== null && k !== undefined && k !== false));
function undoToast(text, r) { toast(text, 4000, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } }); }

// ---------- To do: Your move, then Waiting for them (the follow-ups sit under them) ----------
function drawTodo(el, SH) {
  const redraw = () => drawTodo(el, SH);
  // Your move: oldest first, so nothing sits forgotten at the bottom.
  const moves = SH.list.filter(m => m.step.kind === 'move').sort((a, b) => lastAt(a).localeCompare(lastAt(b)));
  // Waiting: who was asked and has not answered, oldest first.
  const waits = SH.list.filter(m => m.step.kind === 'wait').sort((a, b) => (b.step.days || 0) - (a.step.days || 0));
  fill(el,
    subHead(T.yourMove, moves.length, 'home.your-move'),
    moves.length ? h('ul', { class: 'shh-list' }, cut(moves, 'move').map(moveRow)) : h('p', { class: 'note shh-none' }, T.nothingMove),
    moreBtn('move', moves.length, 'home.your-move-more', redraw),
    waits.length ? [subHead(T.waiting, waits.length, 'home.waiting'), h('ul', { class: 'shh-list' }, cut(waits, 'wait').map(waitRow)), moreBtn('wait', waits.length, 'home.waiting-more', redraw)] : '');
}
function rowMain(m, text, sub) {
  return h('a', { class: 'shh-main', href: href(m), 'data-id': 'home.shidduch-open' },
    h('strong', { dir: 'auto' }, text), h('span', { class: 'note clamp1', dir: 'auto' }, sub));
}
function moveRow(m) {
  const st = m.step;
  const btn = (label, id, run, primary) => h('button', { type: 'button', class: 'btn small' + (primary ? ' primary' : ''), 'data-id': id, onClick: run }, label);
  return h('li', { class: 'shh-row shh-move', 'data-id': 'home.move-row' },
    rowMain(m, st.text, sd.coupleName(m)),
    h('div', { class: 'shh-acts' },
      st.ask && m.round.kind === 'offer' ? st.ask.map(s => btn(T.send(sd.talkName(m, s)), 'home.move-send', () => sendSheet(m, s), true)) : '',
      st.ask && m.round.kind !== 'offer' ? btn(T.markAsked(st.ask), 'home.move-asked', () => markAsked(m, st.ask)) : '',
      st.date ? h('a', { class: 'btn small primary', href: href(m, '/dates?new'), 'data-id': 'home.move-arrange' }, T.arrange(st.date)) : '',
      (st.tell || []).map(s => btn(T.told(sd.talkName(m, s)), 'home.move-told-' + s, async () => { const r = await sd.markTold(m, s); if (r) undoToast(T.toldToast, r); }, true))));
}
async function markAsked(m, sides) {
  let cur = m, first = null;
  for (const s of sides) { const r = await sd.setAnswer(cur, s, 'asked'); if (r) { first = first || r; cur = (await sd.loadOne(m.o.id)) || cur; } }
  if (first) undoToast(T.askedToast, first);
}
function waitRow(m) {
  return h('li', { class: 'shh-row shh-wait', 'data-id': 'home.waiting-row' },
    rowMain(m, m.step.text, sd.coupleName(m)),
    h('div', { class: 'shh-acts' },
      h('button', { type: 'button', class: 'btn small', 'data-id': 'home.remind', onClick: () => remind(m) }, T.remind),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': 'home.got-answer', onClick: () => gotAnswer(m) }, T.gotAnswer)));
}

// One side, chosen in the sheet when both are waiting.
function sidePicker(m, sides, dataId, onPick) {
  if (sides.length < 2) return null;
  return h('div', { class: 'field' }, h('label', {}, dataId.endsWith('remind.who') ? T.remindWho : T.answerWho),
    bubbles({ options: sides.map(s => [s, `${sd.T.side[s]} · ${sd.talkName(m, s)}`]), selected: [sides[0]], multi: false, dataId, onChange: (v) => (v ? onPick(v) : null) }));
}

const waDigits = (p) => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d.length >= 8 && !d.startsWith('0') ? d : ''; };
function remindText(m, side) {
  const other = sd.other(side);
  return m.round.kind === 'date' ? T.remindDate(m.round.n, sd.firstName(m, other)) : T.remindOffer(sd.fullName(m, other));
}
async function remind(m) {
  const sides = m.step.sides || [];
  let side = sides[0];
  const msg = h('textarea', { class: 'input', rows: 4, dir: 'auto', 'data-id': 'home.remind.text', 'aria-label': T.remindMsg });
  const numberNote = h('p', { class: 'note', 'data-id': 'home.remind.number' });
  const wa = () => waDigits((sd.talkTo(m[side]) || {}).number);
  const sync = () => {
    msg.value = remindText(m, side);
    numberNote.textContent = wa() ? '' : T.remindNoNumber(sd.talkName(m, side));
  };
  const body = [sidePicker(m, sides, 'home.remind.who', (v) => { side = v; sync(); }),
    h('div', { class: 'field' }, h('label', {}, T.remindMsg), msg), numberNote, h('p', { class: 'note' }, T.remindNote)];
  sync();
  await sheet({ title: `${T.remindTitle} ${sd.talkName(m, side)}`, dataId: 'home.remind', body, actions: [
    { id: 'copy', label: T.copy, run: async () => {
      try { await navigator.clipboard.writeText(msg.value); toast(T.copied); } catch { toast(T.copyFailed, 4000); return false; }
    } },
    { id: 'whatsapp', label: T.whatsapp, primary: true, run: () => {
      const d = wa();
      if (!d) { toast(T.remindNoNumber(sd.talkName(m, side)), 4000); return false; }
      window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg.value)}`, '_blank', 'noopener');
    } }] });
}

async function gotAnswer(m) {
  const sides = m.step.sides || [];
  let side = sides[0];
  const source = h('input', { class: 'input', dir: 'auto', 'data-id': 'home.answer.source', 'aria-label': T.answerSource });
  const sync = () => { source.placeholder = sd.talkName(m, side); };
  sync();
  const pick = (value) => async () => {
    if (value === 'no') return 'no';
    const r = await sd.setAnswer(m, side, value, { source: source.value });
    if (!r) { toast(T.noChange); return; }
    undoToast(T.answerSaved(sd.T.side[side], T.answers[value]), r);
  };
  const res = await sheet({ title: T.answerTitle, dataId: 'home.answer', body: [
    sidePicker(m, sides, 'home.answer.who', (v) => { side = v; sync(); }),
    sides.length < 2 ? h('p', { dir: 'auto' }, `${sd.T.side[side]} · ${sd.fullName(m, side)}`) : null,
    h('div', { class: 'field' }, h('label', {}, T.answerSource), source),
    h('p', { class: 'note' }, T.answerNote)],
  actions: [
    { id: 'no', label: T.answers.no, danger: true, run: pick('no') },
    { id: 'thinking', label: T.answers.thinking, run: pick('thinking') },
    { id: 'yes', label: T.answers.yes, primary: true, run: pick('yes') }] });
  if (res === 'no') await endDialog(m, { side });
}

// ---------- At a glance: a few numbers, and No open shidduch ----------
const isLive = (m) => m.lane === 'offers' || m.lane === 'progress';
const working = (p) => p.starred && !['engaged', 'not-relevant', 'paused'].includes(statusOf(p));
function drawGlance(el, SH) {
  const n = {
    open: SH.list.filter(isLive).length,
    waiting: SH.list.filter(m => m.step.kind === 'wait').length,
    dating: SH.list.filter(m => m.lane === 'progress').length,
    ideas: SH.list.filter(m => m.lane === 'ideas').length,
  };
  const busy = new Set();
  for (const m of SH.list) if (isLive(m)) { busy.add(m.o.guyId); busy.add(m.o.girlId); }
  const starred = [...SH.idx.people.values()].filter(working);
  const idle = starred.filter(p => !busy.has(p.id)).sort((a, b) => store.personName(a).localeCompare(store.personName(b)));
  fill(el,
    head(T.glanceEyebrow, T.blocks.glance, null, 'home.glance-head'),
    h('div', { class: 'shh-stats' }, T.stats.map(([k, l]) => h('a', { class: 'shh-stat', href: '#/shidduchim', 'data-id': 'home.stat-' + k, title: T.statNote[k] },
      h('span', { class: 'shh-stat-n' }, String(n[k])), h('span', { class: 'shh-stat-l' }, l)))),
    subHead(T.noOpen, idle.length, 'home.no-open'),
    !starred.length ? h('p', { class: 'note shh-none' }, T.noStarred)
      : !idle.length ? h('p', { class: 'note shh-none' }, T.allMoving)
        : [h('p', { class: 'note shh-lead' }, T.noOpenNote),
          h('ul', { class: 'shh-list' }, cut(idle, 'noOpen').map(p => singleRow(p, statusOf(p) === 'available' ? T.nothingNext : statusLabel(statusOf(p)), 'home.no-open-row', 'match'))),
          moreBtn('noOpen', idle.length, 'home.no-open-more', () => drawGlance(el, SH))]);
}
function singleRow(p, sub, id, to = 'people') {
  return h('li', { class: 'shh-row', 'data-id': id },
    h('a', { class: 'shh-main', href: `#/${to}/${encodeURIComponent(p.id)}` },
      h('strong', { dir: 'auto' }, store.personName(p)), h('span', { class: 'note clamp1', dir: 'auto' }, sub)));
}

// ---------- My singles: starred singles, one line each with what is next ----------
function drawSingles(el, SH) {
  const of = new Map();
  for (const m of SH.list) for (const id of [m.o.guyId, m.o.girlId]) (of.get(id) || of.set(id, []).get(id)).push(m);
  const starred = [...SH.idx.people.values()].filter(p => p.starred).sort((a, b) => store.personName(a).localeCompare(store.personName(b)));
  fill(el, head(T.singlesEyebrow, T.blocks.singles, starred.length, 'home.my-singles-head'),
    !starred.length ? h('p', { class: 'note shh-none' }, T.noStarred)
      : [h('ul', { class: 'shh-list' }, cut(starred, 'singles').map(p => singleRow(p, nextFor(p, of.get(p.id) || []), 'home.my-single'))),
        moreBtn('singles', starred.length, 'home.my-singles-more', () => drawSingles(el, SH))]);
}
function nextFor(p, ms) {
  const otherName = (m) => sd.fullName(m, m.o.guyId === p.id ? 'girl' : 'guy');
  const rank = (m) => (m.step.kind === 'move' ? 0 : m.step.kind === 'wait' ? 1 : isLive(m) ? 2 : m.lane === 'ideas' ? 3 : 4);
  const m = [...ms].filter(x => isLive(x) || x.lane === 'ideas' || x.step.kind === 'move').sort((a, b) => rank(a) - rank(b))[0];
  if (m && m.lane === 'ideas') return T.ideaWith(otherName(m));
  if (m) return `${T.withWho(otherName(m))}: ${m.step.text || sd.pairStatus(m)}`;
  const s = statusOf(p);
  return s === 'available' ? T.nothingNext : statusLabel(s);
}

// ---------- Backup reminder (always on Home, outside the blocks) ----------
function drawBackup(el, SH, D) {
  const last = store.lastBackupAt();
  const days = last ? sd.daysSince(last) : null;
  const hasData = SH.idx.people.size > 0 || D.notes.length > 0 || D.contacts.length > 0;
  if (!hasData || (days !== null && days < BACKUP_DAYS)) { el.replaceChildren(); return; }
  el.replaceChildren(h('div', { class: 'shh-backup', 'data-id': 'home.backup-reminder' },
    h('span', {}, days === null ? T.backupNever : T.backupOld(days)),
    h('button', { type: 'button', class: 'linkish', 'data-id': 'home.backup-now', onClick: () => import('./backup-sheet.js').then(m => m.exportSheet()) }, T.backupNow)));
}

// ---------- Edit Home (also opened from Settings) ----------
export async function editHome() {
  const list = h('ol', { class: 'shh-edit-list', 'data-id': 'home.edit-list' });
  const drawList = () => {
    const L = layout();
    list.replaceChildren(...L.map((b, i) => {
      const move = (d) => () => { const n = [...L]; [n[i], n[i + d]] = [n[i + d], n[i]]; saveLayout(n); drawList(); };
      return h('li', { class: 'shh-edit-row' + (b.on ? '' : ' off'), 'data-id': 'home.edit-' + b.id },
        h('label', { class: 'shh-edit-show' },
          h('input', { type: 'checkbox', role: 'switch', checked: b.on || null, 'aria-label': `${T.show} ${T.blocks[b.id]}`, 'data-id': 'home.edit-' + b.id + '-show',
            onChange: (e) => { const n = L.map(x => (x.id === b.id ? { ...x, on: e.target.checked } : x)); saveLayout(n); drawList(); } }),
          h('span', { class: 'shh-edit-text' }, h('strong', {}, T.blocks[b.id]), h('span', { class: 'note' }, T.blockNote[b.id]))),
        h('div', { class: 'shh-edit-move' },
          h('button', { type: 'button', class: 'btn small', disabled: i === 0 || null, 'aria-label': `${T.up}: ${T.blocks[b.id]}`, 'data-id': 'home.edit-' + b.id + '-up', onClick: move(-1) }, T.up),
          h('button', { type: 'button', class: 'btn small', disabled: i === L.length - 1 || null, 'aria-label': `${T.down}: ${T.blocks[b.id]}`, 'data-id': 'home.edit-' + b.id + '-down', onClick: move(1) }, T.down)));
    }));
  };
  drawList();
  await sheet({ title: T.editHome, dataId: 'home.edit-sheet', body: [h('p', { class: 'note' }, T.editLead), list],
    actions: [{ id: 'reset', label: T.firstLayout, run: () => { store.setPref(PREF, null); drawList(); toast(T.firstLayoutDone); return false; } }] });
}

// ---------- Search: shidduchim by either single ----------
export function searchShidduchim(SH, has) {
  return SH.list.filter(m => has(sd.fullName(m, 'guy')) || has(sd.fullName(m, 'girl')))
    .map(m => ({ title: sd.coupleName(m), sub: sd.pairStatus(m), href: href(m) }));
}
