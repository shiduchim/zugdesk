// Shidduchim in Shadchan Mode — pieces shared by the list (sh-shidduchim.js), one shidduch's page
// (sh-shidduch-detail.js) and the single's card (person-card.js): the progress bar, the answer
// tags, the "end this shidduch" sheet, the "new idea" sheet with its already-tried warning, and the
// Shidduchim tab of a single's card. The look reuses Single Mode's Shidduchim classes (shidduchim.css).
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { norm, statusOf, statusLabel, summaryLine, KIND_WORDS, singlesIndex } from './singles-data.js';
import * as sd from './sh-shidduch-data.js';

const T = {
  barLabel: 'Progress: offer, references, dates 1 through 8, engaged',
  segDone: 'done', segNext: 'set up', segNot: 'not yet',
  // ending
  endTitle: 'Move this shidduch to Ended?',
  endTitleNo: 'End this shidduch?',
  endLead: 'Answers, dates and history stay saved.',
  endSaidNo: (who) => `${who} said No. `,
  endWho: 'Who ended it? (optional)',
  endWhoOpts: (g, r) => [['unknown', 'Not specified'], ['guy', `His side (${g})`], ['girl', `Her side (${r})`], ['both', 'Both'], ['me', 'Me']],
  endReason: 'Reason (optional)',
  endReasonPh: 'Only if known',
  endSource: 'Who told you? (optional)',
  endTold: 'Who already knows it ended?',
  endToldTick: (name) => `${name} was told`,
  endToldNote: 'Leave it unticked and the shidduch keeps a “Your move: tell …” reminder.',
  endBtn: 'Move to Ended',
  endDone: 'Moved to Ended · history kept',
  undo: 'Undo', undone: 'Last change undone',
  // new idea
  ideaTitle: 'New idea',
  ideaLead: 'A guy and a girl only you know about. Nobody is asked until you mark it.',
  guy: 'Guy', girl: 'Girl',
  choose: (w) => `Choose a ${w}`,
  change: 'Change',
  searchPh: (w) => `Search ${w}: name, city, any word…`,
  noMatch: (w) => `No ${w} match.`,
  noneYet: (w) => `No ${w} saved yet. Add some first.`,
  more: (n) => `${n} more · type to narrow`,
  already: (n) => `Already tried · ${n}`,
  alreadyTitle: 'These two were already put together',
  alreadyNote: 'One record per couple. Open it to see what happened; Try Again is there.',
  openIt: 'Open it',
  statusWarn: (name, st) => `${name} is marked ${st}.`,
  save: 'Save as idea',
  pickBoth: 'Choose a guy and a girl first',
  saved: 'Idea saved',
  open: 'Open',
  // the single's card
  tabHead: 'Shidduchim',
  tabNew: (first) => `New idea for ${first}`,
  tabEmpty: (name) => `No shidduch recorded for ${name} yet.`,
  tabOpen: 'Open now', tabIdeas: 'Ideas', tabPast: 'Finished',
  tabNote: 'Answers, dates and the history are on the shidduch itself. Tap one to open it.',
  yourMove: 'Your move',
};
const ico = (n) => h('span', { html: icon(n) }).firstChild;

// ---------- progress bar (11 steps: Offer, References, Dates 1–8, Engaged) ----------
export function bar(v, { dim = false, large = false, dataId = null } = {}) {
  const done = sd.segmentsDone(v), next = sd.segmentsNext(v);
  return h('div', { class: 'sh-bars' + (large ? ' large' : ''), role: 'img', 'aria-label': T.barLabel, 'data-id': dataId },
    sd.T.seg.map((label, i) => {
      let cls = '';
      if (dim) cls = done.has(i) ? 'past' : 'empty-past';
      else if (done.has(i) || next.has(i)) cls = (i < 2 ? 'a' : i < 6 ? 'b' : i < 10 ? 'c' : 'd') + (done.has(i) ? '' : ' next');
      return h('span', { class: 'sh-seg ' + cls, title: `${label}: ${done.has(i) ? T.segDone : next.has(i) ? T.segNext : T.segNot}` });
    }));
}
// The bar is gray only for a try that ended; an engaged couple keeps its colours.
export const barDim = (v) => v.t.phase === 'ended';

// A side's answer as a small tag that cannot be tapped (the single's card, older dates).
export function answerTag(rec, side) {
  const a = sd.ans(rec, side);
  return h('span', { class: 'sh-tag shs-static ' + sd.answerClass(a) }, h('small', {}, sd.T.side[side] + ':'), h('strong', {}, sd.answerLabel(a)));
}

// ---------- ending (asks first; with `side`, that side said No) ----------
// Who ended it, an optional reason, who told me, and one tick per side that should hear about it.
export async function endDialog(m, { side = null, onDone = null } = {}) {
  let endedBy = side || 'unknown';
  const told = { guy: false, girl: false };
  const reason = h('textarea', { class: 'input', rows: 2, dir: 'auto', placeholder: T.endReasonPh, 'data-id': 'sh-end.reason' });
  const source = h('input', { class: 'input', dir: 'auto', placeholder: side ? sd.talkName(m, side) : '', 'data-id': 'sh-end.source' });
  const ticks = h('div', { class: 'field', 'data-id': 'sh-end.told' });
  const drawTicks = () => {
    const need = sd.wouldNeedTelling(m.cur.t, endedBy);
    ticks.innerHTML = '';
    if (!need.length) return;
    ticks.append(h('label', {}, T.endTold),
      ...need.map(s => h('label', { class: 'shs-tick', 'data-id': 'sh-end.told-' + s },
        h('input', { type: 'checkbox', checked: told[s] || null, onChange: (e) => { told[s] = e.target.checked; } }), h('span', { dir: 'auto' }, T.endToldTick(sd.talkName(m, s))))),
      h('p', { class: 'note' }, T.endToldNote));
  };
  drawTicks();
  const who = side ? null : bubbles({ options: T.endWhoOpts(sd.firstName(m, 'guy'), sd.firstName(m, 'girl')), selected: ['unknown'], multi: false, dataId: 'sh-end.who',
    onChange: (v) => { endedBy = v || 'unknown'; drawTicks(); } });
  const res = await sheet({ title: side ? T.endTitleNo : T.endTitle, dataId: 'sh-end',
    body: [
      h('p', { dir: 'auto' }, side ? T.endSaidNo(`${sd.T.side[side]} (${sd.fullName(m, side)})`) : '', T.endLead),
      who ? h('div', { class: 'field' }, h('label', {}, T.endWho), who) : null,
      h('div', { class: 'field' }, h('label', {}, T.endReason), reason),
      h('div', { class: 'field' }, h('label', {}, T.endSource), source),
      ticks],
    actions: [{ id: 'end', label: T.endBtn, danger: true, run: async () => {
      const r = await sd.endTry(m, { endedBy, reason: reason.value, source: source.value, saidNo: !!side, told });
      if (!r) return false;
      toast(T.endDone, 2600, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } });
      onDone && onDone();
    } }] });
  return res === 'end';
}

// ---------- New idea: choose a guy and a girl (either may come already chosen) ----------
// Each row says what already happened between the two; couples already tried sink to the bottom.
// The app narrows nothing here and decides nothing (Find a match, stage S5, does the narrowing).
const ROWS = 30;
export async function newIdeaSheet({ guyId = null, girlId = null, lock = null, onSaved = null } = {}) {
  const all = await sd.loadAll();
  const people = all.idx.people;
  const pick = { guy: guyId, girl: girlId };
  let picking = !pick.guy ? 'guy' : !pick.girl ? 'girl' : null, q = '';
  const pairKey = (g, r) => g + '|' + r;
  const pairs = new Map(all.list.map(m => [pairKey(m.o.guyId, m.o.girlId), m]));
  const existing = () => (pick.guy && pick.girl ? pairs.get(pairKey(pick.guy, pick.girl)) || null : null);
  const wrap = h('div', { class: 'shs-pair' });
  let dlg = null;

  const slot = (k) => {
    const p = pick[k] && people.get(pick[k]);
    return h('div', { class: 'shs-slot' + (picking === k ? ' on' : ''), 'data-id': 'sh-idea.slot-' + k },
      h('span', { class: 'shs-slot-label' }, T[k]),
      p ? h('div', { class: 'grow' }, h('div', { class: 'row-title', dir: 'auto' }, store.personName(p)), h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(p)))
        : h('div', { class: 'grow muted' }, T.choose(KIND_WORDS[k].one)),
      lock === k ? null : h('button', { type: 'button', class: 'btn small', 'data-id': 'sh-idea.pick-' + k, 'aria-pressed': picking === k ? 'true' : 'false',
        onClick: () => { picking = picking === k ? null : k; q = ''; draw(); } }, p ? T.change : T.choose(KIND_WORDS[k].one)));
  };
  const rowsFor = (k) => {
    const o = sd.other(k), words = norm(q).split(/\s+/).filter(Boolean);
    const list = all.idx.rows.filter(r => r.kind === k && (!words.length || words.every(w => r.text.includes(w))));
    const hist = (r) => (pick[o] ? pairs.get(k === 'guy' ? pairKey(r.p.id, pick[o]) : pairKey(pick[o], r.p.id)) || null : null);
    const fresh = [], tried = [];
    for (const r of list) (hist(r) ? tried : fresh).push(r);
    const row = (r) => {
      const m = hist(r), st = statusOf(r.p);
      return h('button', { type: 'button', class: 'row-link shs-cand' + (m ? ' shs-tried' : ''), 'data-id': 'sh-idea.row', onClick: () => { pick[k] = r.p.id; picking = !pick[o] && lock !== o ? o : null; q = ''; draw(); } },
        h('div', { class: 'avatar' }, store.initials(r.p)),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title', dir: 'auto' }, store.personName(r.p)),
          h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(r.p)),
          m ? h('div', { class: 'row-sub shs-hist', dir: 'auto', 'data-id': 'sh-idea.row-history' }, sd.pairDetail(m)) : null),
        st === 'available' ? null : h('span', { class: 'chip' }, statusLabel(st)));
    };
    const shown = fresh.slice(0, ROWS), shownTried = tried.slice(0, Math.max(5, ROWS - shown.length));
    const left = list.length - shown.length - shownTried.length;
    const w = KIND_WORDS[k].many;
    return [
      shown.map(row),
      shownTried.length ? [h('div', { class: 'section-head', 'data-id': 'sh-idea.tried' }, h('div', { class: 'eyebrow' }, T.already(tried.length))), shownTried.map(row)] : null,
      !list.length ? h('p', { class: 'note', 'data-id': 'sh-idea.none' }, all.idx.rows.some(r => r.kind === k) ? T.noMatch(w) : T.noneYet(w)) : null,
      left > 0 ? h('p', { class: 'note' }, T.more(left)) : null];
  };
  function draw() {
    wrap.innerHTML = '';
    const ex = existing();
    let results = null;
    if (picking) {
      results = h('div', { class: 'shs-cands', 'data-id': 'sh-idea.results' }, rowsFor(picking));
      const input = h('input', { class: 'input', type: 'search', value: q, dir: 'auto', placeholder: T.searchPh(KIND_WORDS[picking].many), 'aria-label': 'Search', 'data-id': 'sh-idea.search',
        onInput: (e) => { q = e.target.value; results.innerHTML = ''; results.append(...rowsFor(picking).flat(Infinity).filter(Boolean)); } });
      wrap.append(slot('guy'), slot('girl'), h('div', { class: 'ct-search' }, ico('search'), input), results);
      return;
    }
    const warn = statusNotes(pick, people);
    wrap.append(...[slot('guy'), slot('girl'),
      ex ? h('div', { class: 'shs-already', 'data-id': 'sh-idea.already' },
        h('strong', {}, T.alreadyTitle), h('div', { dir: 'auto' }, sd.pairDetail(ex)), h('p', { class: 'note' }, T.alreadyNote),
        h('button', { type: 'button', class: 'btn small', 'data-id': 'sh-idea.open-existing', onClick: () => { dlg?.finish(null); navigate(`/shidduchim/${encodeURIComponent(ex.o.id)}`); } }, T.openIt)) : null,
      !ex && warn.length ? h('div', { class: 'shs-warn', 'data-id': 'sh-idea.status-note' }, warn.map(x => h('div', { dir: 'auto' }, x))) : null,
      h('p', { class: 'note' }, T.ideaLead)].filter(Boolean));
  }
  draw();
  const p = sheet({ title: T.ideaTitle, dataId: 'sh-idea', className: 'tall', body: wrap,
    actions: [{ id: 'save', label: T.save, primary: true, run: async () => {
      if (!pick.guy || !pick.girl) { toast(T.pickBoth); return false; }
      if (existing()) { toast(T.alreadyTitle); return false; }
      const res = await sd.createIdea(pick.guy, pick.girl);
      if (!res) return false;
      if (res.existing) { navigate(`/shidduchim/${encodeURIComponent(res.o.id)}`); return 'existing'; }
      toast(T.saved, 4000, { label: T.open, run: () => navigate(`/shidduchim/${encodeURIComponent(res.o.id)}`) });
      onSaved && onSaved(res.o);
    } }] });
  dlg = document.querySelector('dialog[data-id="sh-idea"]');
  return p;
}
// "Chana Levy is marked Busy." The shadchan decides; the app only says it.
function statusNotes(pick, people) {
  return sd.SIDES.map(k => people.get(pick[k])).filter(Boolean).filter(p => statusOf(p) !== 'available').map(p => T.statusWarn(store.personName(p), statusLabel(statusOf(p))));
}

// ---------- the Shidduchim tab on a single's card ----------
export function singleShidduchim(p, list, { refresh = null } = {}) {
  const k = p.kind, o = sd.other(k);
  const first = (store.personName(p) || '').trim().split(/\s+/)[0];
  const live = list.filter(m => m.lane === 'offers' || m.lane === 'progress');
  const ideas = list.filter(m => m.lane === 'ideas');
  const past = list.filter(m => m.lane === 'ended').sort((a, b) => (b.cur.t.endedAt || b.cur.t.engagedAt || '').localeCompare(a.cur.t.endedAt || a.cur.t.engagedAt || ''));
  const row = (m) => {
    const dim = m.lane === 'ended' && m.cur.t.phase !== 'engaged';
    const rec = m.round.kind === 'date' && m.round.upcoming ? null : m.round.rec;
    return h('a', { class: 'row-link shs-crow' + (dim ? ' shs-dim' : ''), href: `#/shidduchim/${encodeURIComponent(m.o.id)}`, 'data-id': 'person-card.shidduch' },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', dir: 'auto' }, sd.fullName(m, o), m.step.kind === 'move' ? h('span', { class: 'shs-move' }, T.yourMove) : null),
        h('div', { class: 'row-sub', dir: 'auto' }, [m[o] ? summaryLine(m[o]) : null, sd.pairStatus(m)].filter(Boolean).join(' · ')),
        m.lane !== 'ended' && m.lane !== 'ideas' && rec ? h('div', { class: 'shs-tags' }, answerTag(rec, 'guy'), answerTag(rec, 'girl')) : null,
        m.step.text && m.lane !== 'ideas' && m.cur.t.phase !== 'engaged' ? h('div', { class: 'row-sub', dir: 'auto' }, m.step.text) : null),
      ico('chevron'));
  };
  const grp = (title, rows, dataId) => (rows.length ? [h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `${title} · ${rows.length}`)), h('div', { 'data-id': dataId }, rows.map(row))] : null);
  return [h('section', { class: 'pc-sec', 'data-id': 'person-card.shidduchim' },
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow' }, T.tabHead),
      k === 'guy' || k === 'girl' ? h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.new-idea',
        onClick: () => newIdeaSheet({ [k + 'Id']: p.id, lock: k, onSaved: refresh }) }, T.tabNew(first)) : null),
    list.length ? null : h('p', { class: 'note', 'data-id': 'person-card.shidduchim-empty' }, T.tabEmpty(store.personName(p))),
    grp(T.tabOpen, live, 'person-card.shidduchim-open'), grp(T.tabIdeas, ideas, 'person-card.shidduchim-ideas'), grp(T.tabPast, past, 'person-card.shidduchim-past'),
    list.length ? h('p', { class: 'note' }, T.tabNote) : null)];
}
