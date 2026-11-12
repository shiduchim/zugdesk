// Shidduchim in Shadchan Mode — the records and every change to them (spec/shadchan/design.md 6.4).
// Here a shidduch is a guy and a girl with an answer from each side. Single Mode's
// shidduch-data.js (me and one person) is not used for these records.
// Records (all through store.js; shapes also in spec/shadchan/build-notes.md section 7):
//   offers      { guyId, girlId, guyName, girlName, status: 'idea'|'offer'|'progress'|'engaged'|'ended' }  one per couple
//   tries       { offerId, guyId, girlId, n, phase: 'open'|'dating'|'engaged'|'ended', sides: { guy, girl },
//                 refsChecked, endedBy, saidNo, endedReason, endedAt, told: { guy, girl }, engagedAt, startedAt }
//   a side      { answer: ''|'asked'|'thinking'|'yes'|'no', askedAt, answeredAt, toldBy }
//   dateEvents  { tryId, offerId, n, when, where, status, sides: { guy, girl } }   (a side here also keeps `feedback`)
//   stageEvents { tryId, offerId, text, source, eventAt, kind, at }                one history line
// The lane (Ideas / Offers / In Progress / Ended) is never typed: it follows from the answers and dates.
import * as store from '../js/store.js';
import { singlesIndex, statusOf } from './singles-data.js';

// Words, in one place (other languages later).
export const T = {
  lanes: { ideas: 'Ideas', offers: 'Offers', progress: 'In Progress', ended: 'Ended' },
  laneIntro: {
    ideas: 'Only you know about these. Nobody was asked yet.',
    offers: 'At least one side was asked. Waiting for answers, or checking references.',
    progress: 'Dating.',
    ended: 'Finished: ended or engaged. The history is kept.',
  },
  answers: { '': 'Not asked', asked: 'Asked', thinking: 'Thinking', yes: 'Yes', no: 'No' },
  side: { guy: 'His side', girl: 'Her side' },
  sideLow: { guy: 'his side', girl: 'her side' },
  removed: '(removed)',
  himself: 'himself', herself: 'herself',
  sideOf: (first) => `${first}’s side`,
  stage: { idea: 'Idea', offer: 'Offer', refs: 'References', engaged: 'Engaged', ended: 'Ended', date: (n) => `Date ${n}` },
  seg: ['Offer', 'References', 'Date 1', 'Date 2', 'Date 3', 'Date 4', 'Date 5', 'Date 6', 'Date 7', 'Date 8', 'Engaged'],
  // what is expected next
  ideaLine: 'Idea. Nobody was asked yet.',
  suggest: (first, otherFirst) => `Suggest ${first} to ${otherFirst}’s side`,
  arrange: (n) => `Arrange Date ${n}`,
  askBoth: (n) => `Ask both sides how Date ${n} went`,
  askOne: (first, n) => `Ask ${first}’s side how Date ${n} went`,
  tell: (names) => `Tell ${names.join(' and ')}`,
  waiting: (who, days) => `Waiting for ${who} · ${days}`,
  dateSet: (n, when) => `Date ${n} is set · ${when}`,
  engagedLine: (when) => `Engaged${when ? ' · ' + when : ''}`,
  days: (n) => (n < 1 ? 'today' : n === 1 ? '1 day' : `${n} days`),
  // short status of a couple (the single's card, the already-tried warning)
  endedOn: (when) => `Ended${when ? ' ' + when : ''}`,
  saidNo: (side) => `${side} said No`,
  endedBySide: (side) => `ended by ${side}`,
  endedByBoth: 'both sides ended it',
  endedByMe: 'ended by you',
  // history lines
  logIdea: 'Saved as an idea.',
  logAnswer: (side, first, answer) => `${side} (${first}): ${answer}.`,
  logAfter: (n, sideLow, first, answer) => `After Date ${n} · ${sideLow} (${first}): ${answer}.`,
  logBothYes: 'Both sides said Yes. Next: Date 1.',
  logBothContinue: (n) => `Both sides want to continue after Date ${n}.`,
  logHappened: (n) => `Date ${n} happened.`,
  logNo: (side, first) => `${side} (${first}) said No. The shidduch ended.`,
  logEnded: (who) => `Moved to Ended${who ? ' by ' + who : ''}.`,
  logReason: (r) => ` Reason: ${r}`,
  logTold: (name) => `${name} was told it ended.`,
  logToldAtEnd: (names) => ` Told: ${names.join(' and ')}.`,
  logRefs: 'References checked.',
  logYesByDate: 'A date was arranged, so both sides are marked Yes.',
  logDating: 'First date set up. Moved to In Progress.',
  logEngaged: 'Engaged. Mazal tov!',
  logTry: (name) => `The ${name} started.`,
  logDate: (n, verb, when) => `Date ${n} ${verb}${when ? ' for ' + when : ''}.`,
  logDateMoved: (n, verb) => `Date ${n} ${verb}, schedule updated.`,
  whoEnded: { guy: 'his side', girl: 'her side', both: 'both sides', me: 'you' },
  timeNotSet: 'Time not set',
};

export const LANES = ['ideas', 'offers', 'progress', 'ended'];
export const ANSWERS = ['', 'asked', 'thinking', 'yes', 'no'];
export const SIDES = ['guy', 'girl'];
export const other = (s) => (s === 'guy' ? 'girl' : 'guy');
export const DATE_STATUSES = ['Arranged', 'Happened', 'Cancelled'];
export const PROVISIONAL_TRIES = 3; // shown as a note after the third try, never enforced (same as Single Mode)

// ---------- one side's answer ----------
const blankSide = () => ({ answer: '', askedAt: null, answeredAt: null, toldBy: '' });
export const sideOf = (rec, s) => ({ ...blankSide(), ...(((rec || {}).sides || {})[s] || {}) });
export const ans = (rec, s) => sideOf(rec, s).answer;
export const answerLabel = (a) => T.answers[a] || T.answers[''];
export const answerClass = (a) => (a === 'yes' ? 'yes' : a === 'no' ? 'no' : a === 'thinking' ? 'thinking' : a === 'asked' ? 'waiting asked' : 'waiting none');
const withSide = (rec, s, next) => ({ ...rec, sides: { guy: sideOf(rec, 'guy'), girl: sideOf(rec, 'girl'), [s]: next } });
const bothYes = (rec) => ans(rec, 'guy') === 'yes' && ans(rec, 'girl') === 'yes';

// ---------- derived facts ----------
export const isOpen = (t) => t.phase !== 'ended' && t.phase !== 'engaged';
export function laneOf(t) {
  if (t.phase === 'ended' || t.phase === 'engaged') return 'ended';
  if (t.phase === 'dating') return 'progress';
  return ans(t, 'guy') || ans(t, 'girl') ? 'offers' : 'ideas';
}
// What is saved on the offer record (the Guys / Girls lists read it for the open-shidduch dot).
export const statusOfTry = (t) => (t.phase === 'engaged' ? 'engaged' : ({ ideas: 'idea', offers: 'offer', progress: 'progress', ended: 'ended' })[laneOf(t)]);
export const laneLabel = (lane) => T.lanes[lane] || T.lanes.ideas;
export function tryName(n) {
  const s = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${s} Try`;
}
export const dateNum = (d) => Number(d.n) || 0;
export const sortedDates = (dates) => [...dates].sort((a, b) => dateNum(a) - dateNum(b));
const isPast = (when) => { const d = new Date(when); return !isNaN(d) && d.getTime() <= Date.now(); };
export const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

// The round whose answers matter now: the offer itself, or the latest date that was not cancelled.
// While that date is still ahead (`upcoming`) nobody is asked anything.
export function roundOf(v) {
  const live = v.dates.filter(d => d.status !== 'Cancelled');
  const d = live[live.length - 1];
  if (!d) return { kind: 'offer', rec: v.t, n: 0, upcoming: false };
  return { kind: 'date', rec: d, n: dateNum(d), upcoming: !(d.status === 'Happened' || isPast(d.when)) };
}

// The 11 steps of the bar: 0 Offer (someone was asked), 1 References (only if checked),
// 2–9 Dates 1–8 marked Happened, 10 Engaged.
export function segmentsDone(v) {
  const done = new Set();
  if (laneOf(v.t) !== 'ideas' || v.dates.length) done.add(0);
  if (v.t.refsChecked) done.add(1);
  for (const d of v.dates) { const n = dateNum(d); if (d.status === 'Happened' && n >= 1 && n <= 8) done.add(n + 1); }
  if (v.t.phase === 'engaged' || v.t.engagedAt) done.add(10);
  return done;
}
export function segmentsNext(v) {
  const next = new Set();
  for (const d of v.dates) { const n = dateNum(d); if (d.status === 'Arranged' && n >= 1 && n <= 8) next.add(n + 1); }
  return next;
}
export function stageWord(v) {
  const t = v.t;
  if (t.phase === 'engaged') return T.stage.engaged;
  if (t.phase === 'ended') return T.stage.ended;
  const live = v.dates.filter(d => d.status !== 'Cancelled');
  if (live.length) return T.stage.date(dateNum(live[live.length - 1]));
  if (laneOf(t) === 'ideas') return T.stage.idea;
  return t.refsChecked ? T.stage.refs : T.stage.offer;
}

// ---------- friendly dates ----------
export function whenNice(x) {
  if (!x) return T.timeNotSet;
  const d = new Date(x); if (isNaN(d)) return x;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function dateTime(x) {
  if (!x) return '';
  const d = new Date(x); if (isNaN(d)) return x;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export const monthYear = (x) => { const d = new Date(x || ''); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); };
export function agoShort(iso) { const n = daysSince(iso); return n < 1 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`; }
export function toLocalInput(x) {
  if (!x) return '';
  const d = new Date(x); if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- names ----------
export const fullName = (m, s) => (m[s] ? store.personName(m[s]) : m.o[s + 'Name'] || T.removed);
export const firstName = (m, s) => fullName(m, s).trim().split(/\s+/)[0];
export const coupleName = (m) => `${fullName(m, 'guy')} – ${fullName(m, 'girl')}`;
// Whom I talk to about a single (design.md 6.2): one of the single's own contact cards, or nobody chosen.
export function talkTo(p) {
  const c = p && (p.contactCards || []).find(x => x.id === p.talkTo);
  if (!c) return null;
  const self = c.role === 'person';
  return { self, role: c.role, number: c.number || '', name: self ? store.personName(p) : (c.name || store.phoneRoleLabel(c.role)) };
}
// The name to say for a side: "Mrs. Stern" when a Talk to is chosen, otherwise "Yehuda's side".
export const talkName = (m, s) => { const t = talkTo(m[s]); return t ? t.name : T.sideOf(firstName(m, s)); };

// ---------- what is expected next (also the source for Home's "Your move" and "Waiting", stage S4) ----------
// Sides that were part of it, did not end it, and have not been told that it ended.
export function wouldNeedTelling(t, endedBy) {
  if (endedBy === 'both') return [];
  return SIDES.filter(s => s !== endedBy && ans(t, s) && ans(t, s) !== 'no');
}
export const needTelling = (t) => (t.phase === 'ended' ? wouldNeedTelling(t, t.endedBy).filter(s => !(t.told || {})[s]) : []);

// { kind: 'move' | 'wait' | 'none', text, days?, ask?: [sides to mark Asked], date?: n to arrange, tell?: [sides] }
// The app never says which side to ask first (design rule 5): an idea has no "your move".
export function nextStep(m) {
  const t = m.cur.t, r = m.round;
  if (t.phase === 'engaged') return { kind: 'none', text: T.engagedLine(monthYear(t.engagedAt)) };
  if (t.phase === 'ended') {
    const tell = needTelling(t);
    return tell.length ? { kind: 'move', text: T.tell(tell.map(s => talkName(m, s))), tell } : { kind: 'none', text: '' };
  }
  if (r.kind === 'date' && r.upcoming) return { kind: 'none', text: T.dateSet(r.n, whenNice(r.rec.when)) };
  const a = { guy: ans(r.rec, 'guy'), girl: ans(r.rec, 'girl') };
  if (a.guy === 'yes' && a.girl === 'yes') return { kind: 'move', text: T.arrange(r.n + 1), date: r.n + 1 };
  if (r.kind === 'offer') {
    if (!a.guy && !a.girl) return { kind: 'none', idea: true, text: T.ideaLine };
    for (const s of SIDES) if (a[s] === 'yes' && !a[other(s)]) return { kind: 'move', text: T.suggest(firstName(m, s), firstName(m, other(s))), ask: [other(s)] };
  } else {
    if (!a.guy && !a.girl) return { kind: 'move', text: T.askBoth(r.n), ask: [...SIDES] };
    for (const s of SIDES) if (a[s] && !a[other(s)]) return { kind: 'move', text: T.askOne(firstName(m, other(s)), r.n), ask: [other(s)] };
  }
  const waiting = SIDES.filter(s => a[s] === 'asked' || a[s] === 'thinking');
  if (waiting.length) {
    const since = (s) => { const x = sideOf(r.rec, s); return x.askedAt || x.answeredAt; };
    const days = Math.max(...waiting.map(s => daysSince(since(s))));
    const who = waiting.length === 2 ? 'both sides' : talkName(m, waiting[0]);
    return { kind: 'wait', text: T.waiting(who, T.days(days)), days, sides: waiting };
  }
  return { kind: 'none', text: '' };
}

// "Ended Mar 2026 · her side said No", "Offer", "In Progress · Date 2", "Idea" …
export function endedLine(t) {
  const by = t.endedBy;
  const why = by === 'guy' || by === 'girl' ? (t.saidNo ? T.saidNo(T.sideLow[by]) : T.endedBySide(T.sideLow[by])) : by === 'both' ? T.endedByBoth : by === 'me' ? T.endedByMe : '';
  return [T.endedOn(monthYear(t.endedAt)), why].filter(Boolean).join(' · ');
}
export function pairStatus(m) {
  const t = m.cur.t;
  let s = t.phase === 'engaged' ? T.engagedLine(monthYear(t.engagedAt)) : t.phase === 'ended' ? endedLine(t)
    : m.lane === 'ideas' ? T.stage.idea : m.lane === 'offers' ? T.lanes.offers : `${T.lanes.progress} · ${stageWord(m.cur)}`;
  if (m.tries.length > 1) s += ` · ${tryName(m.tries.length)}`;
  return s;
}
// The same, with both answers spelled out while it is open (the already-tried warning).
export function pairDetail(m) {
  const r = m.round;
  if (m.lane !== 'offers' && m.lane !== 'progress' || r.upcoming) return pairStatus(m);
  return `${pairStatus(m)} · ${SIDES.map(s => `${T.sideLow[s]}: ${answerLabel(ans(r.rec, s))}`).join(', ')}`;
}
export const whoEnded = (t) => T.whoEnded[t.endedBy] || '';

// ---------- loading (one read model per draw; nothing is kept between visits) ----------
function view(o, tries, datesByTry, people, eventsByTry) {
  const ts = [...tries].sort((a, b) => (a.n || 0) - (b.n || 0));
  if (!ts.length) return null; // a shidduch always has at least one try; skip anything half-written
  const all = ts.map(t => ({ t, dates: sortedDates(datesByTry.get(t.id) || []), events: (eventsByTry && eventsByTry.get(t.id)) || [] }));
  const m = { o, guy: people.get(o.guyId) || null, girl: people.get(o.girlId) || null, tries: all, cur: all[all.length - 1] };
  m.lane = laneOf(m.cur.t); m.round = roundOf(m.cur); m.step = nextStep(m);
  return m;
}
const group = (rows, key) => { const map = new Map(); for (const r of rows) (map.get(r[key]) || map.set(r[key], []).get(r[key])).push(r); return map; };
const byNewest = (a, b) => (b.at || '').localeCompare(a.at || '');

// Every shidduch, for the list. History lines are not read here (a list card does not show them).
export async function loadAll() {
  const [offers, tries, dates, idx] = await Promise.all([store.offers.list(), store.tries.list(), store.dateEvents.list(), singlesIndex()]);
  const triesBy = group(tries, 'offerId'), datesBy = group(dates, 'tryId');
  const list = offers.map(o => view(o, triesBy.get(o.id) || [], datesBy, idx.people)).filter(Boolean);
  return { list, byId: new Map(list.map(m => [m.o.id, m])), idx };
}
async function loadFor(offers, idx) {
  const out = [];
  for (const o of offers) {
    const tries = await store.tries.byIndex('offerId', o.id);
    const ev = new Map(), dt = new Map();
    await Promise.all(tries.map(async t => {
      const [e, d] = await Promise.all([store.stageEvents.byIndex('tryId', t.id), store.dateEvents.byIndex('tryId', t.id)]);
      ev.set(t.id, e.sort(byNewest)); dt.set(t.id, d);
    }));
    const m = view(o, tries, dt, idx.people, ev);
    if (m) out.push(m);
  }
  return out;
}
export async function loadOne(id) {
  const [o, idx] = await Promise.all([store.offers.get(id), singlesIndex()]);
  return o ? (await loadFor([o], idx))[0] || null : null;
}
// Every shidduch one single is part of (the single's card).
export async function forSingle(p) {
  if (p.kind !== 'guy' && p.kind !== 'girl') return [];
  const [offers, idx] = await Promise.all([store.offers.byIndex(p.kind + 'Id', p.id), singlesIndex()]);
  return (await loadFor(offers, idx)).sort((a, b) => (b.o.updatedAt || '').localeCompare(a.o.updatedAt || ''));
}
// The one record of a couple, if they were ever put together (the already-tried warning).
export async function pairOf(guyId, girlId) {
  const o = (await store.offers.byIndex('guyId', guyId)).find(x => x.girlId === girlId);
  return o ? loadOne(o.id) : null;
}

// ---------- writing (every change goes through here; each writes its history line once) ----------
let lastAt = '';
// History lines written in one tap keep their order: each gets a later time than the one before.
function stamp() {
  let at = store.now();
  if (at <= lastAt) at = new Date(new Date(lastAt).getTime() + 1).toISOString();
  lastAt = at;
  return at;
}
function log(t, text, { source = '', eventAt = null, kind = 'note' } = {}) {
  return store.stageEvents.save({ tryId: t.id, offerId: t.offerId, text, source, eventAt, kind, at: stamp() });
}
function touch(m, t) {
  return store.offers.save({ ...m.o, status: statusOfTry(t), guyName: fullName(m, 'guy'), girlName: fullName(m, 'girl') });
}

// Undo for one change: puts back the shidduch, its try, its dates and the two singles' status,
// and erases the history lines and dates the change added.
async function snapshot(m) {
  const t = m.cur.t;
  const [evs, dts, people] = await Promise.all([store.stageEvents.byIndex('tryId', t.id), store.dateEvents.byIndex('tryId', t.id),
    Promise.all(SIDES.map(s => store.people.get(m.o[s + 'Id'])))]);
  const evIds = new Set(evs.map(e => e.id));
  const before = { o: { ...m.o }, t: structuredClone(t), dates: new Map(dts.map(d => [d.id, structuredClone(d)])),
    people: people.filter(Boolean).map(p => ({ id: p.id, status: p.status ?? null, busyUntil: p.busyUntil ?? null, statusBy: p.statusBy ?? null })) };
  return async () => {
    await store.tries.save(before.t);
    await store.discard(store.stageEvents, (await store.stageEvents.byIndex('tryId', t.id)).filter(e => !evIds.has(e.id)).map(e => e.id));
    const now = await store.dateEvents.byIndex('tryId', t.id);
    await store.discard(store.dateEvents, now.filter(d => !before.dates.has(d.id)).map(d => d.id));
    for (const d of now) { const was = before.dates.get(d.id); if (was && JSON.stringify(was) !== JSON.stringify(d)) await store.dateEvents.save(was); }
    for (const s of before.people) {
      const p = await store.people.get(s.id);
      if (p && ((p.status ?? null) !== s.status || (p.statusBy ?? null) !== s.statusBy)) await store.people.save({ ...p, ...s });
    }
    await store.offers.save(before.o);
  };
}

// Busy by itself while dating, Engaged when the couple is (design.md 6.2). `statusBy` on the single
// remembers which shidduch set it, so ending that shidduch can free them again. A status the
// shadchan chose by hand (Paused, Busy elsewhere …) is left alone while dating.
async function setAuto(m, status) {
  for (const s of SIDES) {
    const p = await store.people.get(m.o[s + 'Id']);
    if (!p) continue;
    const cur = statusOf(p);
    if (status === 'busy' ? cur === 'available' : cur !== 'engaged') await store.people.save({ ...p, status, busyUntil: null, statusBy: m.o.id });
  }
}
async function releaseAuto(m) {
  for (const s of SIDES) {
    const p = await store.people.get(m.o[s + 'Id']);
    if (!p || p.statusBy !== m.o.id) continue;
    const elsewhere = (await store.offers.byIndex(s + 'Id', p.id)).find(o => o.id !== m.o.id && o.status === 'progress');
    await store.people.save({ ...p, status: elsewhere ? 'busy' : 'available', busyUntil: null, statusBy: elsewhere ? elsewhere.id : null });
  }
}

const newTry = (o, n) => ({ offerId: o.id, guyId: o.guyId, girlId: o.girlId, n, phase: 'open', sides: { guy: blankSide(), girl: blankSide() },
  refsChecked: false, endedBy: null, saidNo: false, endedReason: '', endedAt: null, told: { guy: false, girl: false }, engagedAt: null, startedAt: store.now() });

// A new idea: a couple only the shadchan knows about. One record per couple, ever: a second
// attempt is Try Again on that record. Returns { o, existing } (existing = they were already put together).
export async function createIdea(guyId, girlId) {
  const had = (await store.offers.byIndex('guyId', guyId)).find(x => x.girlId === girlId);
  if (had) return { o: had, existing: true };
  const [guy, girl] = await Promise.all([store.people.get(guyId), store.people.get(girlId)]);
  if (!guy || !girl) return null;
  const o = await store.offers.save({ guyId, girlId, guyName: store.personName(guy), girlName: store.personName(girl), status: 'idea' });
  const t = await store.tries.save(newTry(o, 1));
  await log(t, T.logIdea, { kind: 'offer' });
  return { o, existing: false };
}

// Change one side's answer in the round that is open now (the offer, or after the latest date).
// No is not set here: it ends the shidduch and goes through endTry. Returns { undo, event, lane } or null.
export async function setAnswer(m, side, value, { source = '' } = {}) {
  const t = m.cur.t, r = m.round;
  if (!isOpen(t) || value === 'no' || r.upcoming) return null;
  const was = sideOf(r.rec, side);
  if (was.answer === (value || '')) return null;
  const undo = await snapshot(m);
  const at = store.now();
  const next = { ...was, answer: value || '', toldBy: source.trim(),
    askedAt: !value ? null : was.askedAt || (value === 'asked' || value === 'thinking' ? at : null),
    answeredAt: value === 'thinking' || value === 'yes' ? at : null };
  let rec = withSide(r.rec, side, next), t2 = t;
  const first = firstName(m, side), label = answerLabel(value);
  let event;
  if (r.kind === 'date') {
    if (value && rec.status === 'Arranged') { rec = { ...rec, status: 'Happened' }; await log(t, T.logHappened(r.n), { kind: 'date', eventAt: rec.when }); }
    await store.dateEvents.save(rec);
    event = await log(t, T.logAfter(r.n, T.sideLow[side], first, label), { source, kind: 'answer' });
    if (bothYes(rec) && !bothYes(r.rec)) await log(t, T.logBothContinue(r.n), { kind: 'stage' });
  } else {
    t2 = rec; await store.tries.save(t2);
    event = await log(t, T.logAnswer(T.side[side], first, label), { source, kind: 'answer' });
    if (bothYes(rec) && !bothYes(r.rec)) await log(t, T.logBothYes, { kind: 'stage' });
  }
  await touch(m, t2);
  return { undo, event, lane: laneOf(t2) };
}

// "Who told you?" added after an answer was tapped (optional): kept on the side and on its history line.
export async function setSource(m, side, eventId, source) {
  const name = source.trim(); if (!name) return;
  const r = m.round, rec = withSide(r.rec, side, { ...sideOf(r.rec, side), toldBy: name });
  await (r.kind === 'date' ? store.dateEvents : store.tries).save(rec);
  const e = await store.stageEvents.get(eventId);
  if (e) await store.stageEvents.save({ ...e, source: name });
}

// End the current try. endedBy: 'guy' | 'girl' | 'both' | 'me' | 'unknown'. `saidNo` records that
// side's No in the open round. `told` = which sides already heard that it ended.
export async function endTry(m, { endedBy = 'unknown', reason = '', source = '', saidNo = false, told = {} } = {}) {
  const t = m.cur.t, r = m.round;
  if (t.phase === 'ended') return null;
  const undo = await snapshot(m);
  const at = store.now(), oneSide = endedBy === 'guy' || endedBy === 'girl';
  let t2 = { ...t, phase: 'ended', endedBy, saidNo: !!(saidNo && oneSide), endedReason: reason.trim(), endedAt: at, told: { guy: !!told.guy, girl: !!told.girl } };
  if (saidNo && oneSide) {
    const no = { ...sideOf(r.rec, endedBy), answer: 'no', answeredAt: at, toldBy: source.trim() };
    if (r.kind === 'date' && !r.upcoming) await store.dateEvents.save({ ...withSide(r.rec, endedBy, no), status: r.rec.status === 'Arranged' ? 'Happened' : r.rec.status });
    else if (r.kind === 'offer') t2 = withSide(t2, endedBy, no);
  }
  await store.tries.save(t2);
  const toldNames = wouldNeedTelling(t2, endedBy).filter(s => t2.told[s]).map(s => talkName(m, s));
  const text = (saidNo && oneSide ? T.logNo(T.side[endedBy], firstName(m, endedBy)) : T.logEnded(whoEnded(t2)))
    + (t2.endedReason ? T.logReason(t2.endedReason) : '') + (toldNames.length ? T.logToldAtEnd(toldNames) : '');
  await log(t2, text, { source, kind: 'ended' });
  await releaseAuto(m);
  await touch(m, t2);
  return { undo };
}

// "The other side was told" ticked after the shidduch ended.
export async function markTold(m, side) {
  const t = m.cur.t;
  if (t.phase !== 'ended' || (t.told || {})[side]) return null;
  const undo = await snapshot(m);
  const t2 = { ...t, told: { ...(t.told || {}), [side]: true } };
  await store.tries.save(t2);
  await log(t2, T.logTold(talkName(m, side)), { kind: 'told' });
  await touch(m, t2);
  return { undo };
}

export async function markRefs(m) {
  const t = m.cur.t;
  if (t.refsChecked || !isOpen(t)) return null;
  const undo = await snapshot(m);
  const t2 = { ...t, refsChecked: true };
  await store.tries.save(t2);
  await log(t2, T.logRefs, { kind: 'refs' });
  await touch(m, t2);
  return { undo };
}

export async function addNote(m, text) {
  const undo = await snapshot(m);
  await log(m.cur.t, text.trim(), { kind: 'note' });
  await touch(m, m.cur.t);
  return { undo };
}

// True when saving a new date would mark a side Yes (a date means both agreed to it).
export const dateMarksYes = (m) => !m.round.upcoming && !bothYes(m.round.rec);

// Arrange or edit a date. A new date means both sides agreed, so the open round becomes Yes / Yes,
// the shidduch moves to In Progress, and both singles become Busy by themselves.
export async function saveDate(m, d, { when, where, status }) {
  const t = m.cur.t, r = m.round;
  if (!isOpen(t)) return null;
  const undo = await snapshot(m);
  const isNew = !d;
  let t2 = t;
  if (isNew && dateMarksYes(m)) {
    const at = store.now();
    let rec = r.rec;
    for (const s of SIDES) if (ans(rec, s) !== 'yes') rec = withSide(rec, s, { ...sideOf(rec, s), answer: 'yes', answeredAt: at });
    if (r.kind === 'date') await store.dateEvents.save(rec.status === 'Arranged' ? { ...rec, status: 'Happened' } : rec);
    else { t2 = rec; await store.tries.save(t2); }
    await log(t, T.logYesByDate, { kind: 'answer' });
  }
  const n = isNew ? Math.max(0, ...m.cur.dates.map(dateNum)) + 1 : dateNum(d);
  const place = (where || '').trim();
  const base = d || { tryId: t.id, offerId: t.offerId, n, sides: { guy: { ...blankSide(), feedback: '' }, girl: { ...blankSide(), feedback: '' } }, at: store.now() };
  const rec = await store.dateEvents.save({ ...base, when, where: place, status });
  if (isNew || d.status !== status || d.when !== when) {
    const verb = status.toLowerCase();
    await log(t, isNew || d.when === when ? T.logDate(n, verb, isNew && status === 'Arranged' ? whenNice(when) : '') : T.logDateMoved(n, verb), { kind: 'date', eventAt: status === 'Happened' ? when : null });
  }
  if (t2.phase === 'open' && status !== 'Cancelled') {
    t2 = { ...t2, phase: 'dating' };
    await store.tries.save(t2);
    await log(t2, T.logDating, { kind: 'stage' });
    await setAuto(m, 'busy');
  }
  await touch(m, t2);
  return { undo, rec };
}

// Private feedback each side gave after a date. Not a history line: it stays on the date.
export async function saveFeedback(d, { guy = '', girl = '' }) {
  const cur = await store.dateEvents.get(d.id); if (!cur) return null;
  let rec = cur;
  for (const [s, text] of [['guy', guy], ['girl', girl]]) rec = withSide(rec, s, { ...sideOf(rec, s), feedback: text.trim() });
  return store.dateEvents.save(rec);
}

export async function markEngaged(m) {
  const t = m.cur.t;
  if (!isOpen(t)) return null;
  const undo = await snapshot(m);
  const t2 = { ...t, phase: 'engaged', engagedAt: store.now() };
  await store.tries.save(t2);
  await log(t2, T.logEngaged, { kind: 'engaged' });
  await setAuto(m, 'engaged');
  await touch(m, t2);
  return { undo };
}

// Try Again: the same couple and the same record, a new numbered try with an empty bar.
export async function tryAgain(m) {
  if (m.cur.t.phase !== 'ended') return null;
  const n = m.tries.length + 1;
  const t = await store.tries.save(newTry(m.o, n));
  await log(t, T.logTry(tryName(n)), { kind: 'try' });
  await touch(m, t);
  return t;
}

// After Restore in Recently deleted: a shidduch that came back while dating or engaged sets its
// singles' status again (deleting it had freed them).
export async function reapplyStatus(offerIds) {
  for (const id of offerIds) {
    const o = await store.offers.get(id);
    if (o && (o.status === 'progress' || o.status === 'engaged')) await setAuto({ o }, o.status === 'progress' ? 'busy' : 'engaged');
  }
}

// Delete one shidduch with all its parts as ONE deletion (Recently deleted restores it whole).
export function removeShidduch(m) {
  return store.asOne(async () => {
    await releaseAuto(m);
    for (const v of m.tries) {
      for (const e of await store.stageEvents.byIndex('tryId', v.t.id)) await store.stageEvents.remove(e.id);
      for (const d of await store.dateEvents.byIndex('tryId', v.t.id)) await store.dateEvents.remove(d.id);
      await store.tries.remove(v.t.id);
    }
    await store.offers.remove(m.o.id);
  });
}
