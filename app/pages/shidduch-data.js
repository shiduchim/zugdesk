// Shidduchim — shared pieces for the list (shidduchim.js), the details page
// (shidduch-detail.js) and the person card: loading, derived status, the 11-step bar,
// and every action (answers, stage, references, dates, notes, ending, trying again).
// Records (spec/build-handoff.md C): FormalOffer = one couple (me + one person);
// ShidduchTry = one attempt; StageEvent = one history line; DateEvent = one date.
// Data always goes through store.js; pages never keep their own copies.
import * as store from '../js/store.js';

export const LANES = [['offers', 'Offers'], ['progress', 'In Progress'], ['ended', 'Ended']];
export const ANSWERS = ['Yes', 'Thinking', 'No'];
export const PHASES = [['checking', 'Checking'], ['dating', 'Dating'], ['ended', 'Ended']];
export const SIDES = ['me', 'them'];
export const SEG_LABELS = ['Offer', 'References', 'Date 1', 'Date 2', 'Date 3', 'Date 4', 'Date 5', 'Date 6', 'Date 7', 'Date 8', 'Marriage'];

// ---------- derived facts ----------
export const bothYes = (t) => t.myAnswer === 'Yes' && t.theirAnswer === 'Yes';
export const laneOf = (t) => (t.phase === 'ended' ? 'ended' : t.phase === 'dating' ? 'progress' : 'offers');
export const laneLabel = (lane) => (LANES.find(l => l[0] === lane) || LANES[0])[1];
export const answerClass = (v) => (v === 'Yes' ? 'yes' : v === 'No' ? 'no' : v === 'Thinking' ? 'thinking' : 'waiting');
export const answerLabel = (v) => v || 'Waiting';
export function tryName(n) {
  const s = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${s} Try`;
}
export const dateNum = (d) => Number(d.n) || 0;
export const sortedDates = (dates) => [...dates].sort((a, b) => dateNum(a) - dateNum(b));

// Which of the 11 positions are filled: 0 offer (always, an offer exists), 1 references
// (only if actually checked), 2–9 dates 1–8 marked Happened, 10 marriage (not recorded in this stage).
export function segmentsDone(t, dates) {
  const done = new Set([0]);
  if (t.refsChecked) done.add(1);
  for (const d of dates) { const n = dateNum(d); if (d.status === 'Happened' && n >= 1 && n <= 8) done.add(n + 1); }
  if (t.married) done.add(10);
  return done;
}

// Stage word on a card: Ended / Date n (latest arranged, else latest happened) / References / Offer.
export function stageWord(t, dates) {
  if (t.phase === 'ended') return 'Ended';
  const list = sortedDates(dates);
  const arranged = list.filter(d => d.status === 'Arranged'), happened = list.filter(d => d.status === 'Happened');
  if (arranged.length) return `Date ${dateNum(arranged[arranged.length - 1])}`;
  if (happened.length) return `Date ${dateNum(happened[happened.length - 1])}`;
  if (t.refsChecked) return 'References';
  return 'Offer';
}

export function summary(t, dates) {
  if (t.phase === 'ended') return { title: 'Ended', next: '' };
  const upcoming = dates.filter(d => d.status === 'Arranged').sort((a, b) => (a.when || '').localeCompare(b.when || ''))[0];
  if (upcoming) return { title: 'Dating', next: `Next: Date ${dateNum(upcoming)} · ${whenNice(upcoming.when)}` };
  const nums = dates.map(dateNum);
  if (dates.some(d => d.status === 'Happened')) return { title: 'Dating', next: `Next: Date ${Math.max(0, ...nums) + 1}` };
  if (bothYes(t)) return { title: 'Both said Yes', next: 'Ready to arrange Date 1' };
  if (t.refsChecked) return { title: 'Checking references', next: 'Waiting for both answers' };
  return { title: 'Offer', next: 'Waiting for answers' };
}

// ---------- friendly dates (spec SH-03: "Oct 7 · 7:00 PM", never raw 2026-10-07 / 19:00) ----------
export function whenNice(x) {
  if (!x) return 'Time not set';
  const d = new Date(x); if (isNaN(d)) return x;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function dateTime(x) {
  if (!x) return '';
  const d = new Date(x); if (isNaN(d)) return x;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
// datetime-local input value from a stored "when"
export function toLocalInput(x) {
  if (!x) return '';
  const d = new Date(x); if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- loading (one read model per render; nothing is cached between visits) ----------
export async function loadAll() {
  const [offers, tries, events, dates, people, contacts, me] = await Promise.all([
    store.offers.list(), store.tries.list(), store.stageEvents.list(), store.dateEvents.list(),
    store.people.list(), store.contacts.list(), store.profile.get('me'),
  ]);
  const peopleById = new Map(people.map(p => [p.id, p])), contactsById = new Map(contacts.map(c => [c.id, c]));
  const triesByOffer = new Map(), evByTry = new Map(), dtByTry = new Map();
  for (const t of tries) (triesByOffer.get(t.offerId) || triesByOffer.set(t.offerId, []).get(t.offerId)).push(t);
  for (const e of events) (evByTry.get(e.tryId) || evByTry.set(e.tryId, []).get(e.tryId)).push(e);
  for (const d of dates) (dtByTry.get(d.tryId) || dtByTry.set(d.tryId, []).get(d.tryId)).push(d);
  for (const l of evByTry.values()) l.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const list = [];
  for (const o of offers) {
    const ts = (triesByOffer.get(o.id) || []).sort((a, b) => (a.n || 0) - (b.n || 0));
    if (!ts.length) continue; // an offer always has at least one try; skip anything half-written
    const person = peopleById.get(o.personId) || null;
    const view = (t) => ({ t, events: evByTry.get(t.id) || [], dates: sortedDates(dtByTry.get(t.id) || []) });
    const tries2 = ts.map(view), cur = tries2[tries2.length - 1];
    list.push({ o, person, shadchan: o.contactId ? contactsById.get(o.contactId) || null : null, tries: tries2, cur, lane: laneOf(cur.t) });
  }
  return { list, byId: new Map(list.map(x => [x.o.id, x])), peopleById, contactsById, me: me || null, people, contacts };
}
export async function loadOne(id) { const all = await loadAll(); return { all, m: all.byId.get(id) || null }; }
export async function offerForPerson(personId) {
  const all = await loadAll();
  return all.list.find(x => x.o.personId === personId) || null;
}

export const personName = (m) => (m.person ? store.personName(m.person) : m.o.personName || '(person removed)');
export const personFirst = (m) => personName(m).trim().split(/\s+/)[0];
export const sideName = (m, side) => (side === 'me' ? 'Me' : personFirst(m));
export const sideFull = (m, side) => (side === 'me' ? 'Me' : personName(m));
export const endedByName = (m, t) => (t.endedBy === 'me' ? 'me' : t.endedBy === 'them' ? personName(m) : t.endedBy === 'both' ? 'both sides' : 'not specified');

// ---------- writing (every change is one place; history lines are written once) ----------
async function touch(o, t, lane) {
  const at = store.now();
  const o2 = await store.offers.save({ ...o, status: lane || laneOf(t), updatedAt: at });
  return o2;
}
async function log(t, text, { source = '', eventAt = null, kind = 'note' } = {}) {
  return store.stageEvents.save({ tryId: t.id, offerId: t.offerId, text, source, eventAt, kind, at: store.now() });
}

// Snapshot for Undo on quick list changes: restores the try + offer and removes history
// lines written by the change. Nothing else is touched.
async function snapshot(m) {
  const evIds = new Set(m.cur.events.map(e => e.id));
  const dtIds = new Set(m.cur.dates.map(d => d.id));
  const before = { o: { ...m.o }, t: { ...m.cur.t } };
  return async () => {
    await store.offers.save(before.o);
    await store.tries.save(before.t);
    for (const e of await store.stageEvents.byIndex('tryId', before.t.id)) if (!evIds.has(e.id)) await store.stageEvents.remove(e.id);
    for (const d of await store.dateEvents.byIndex('tryId', before.t.id)) if (!dtIds.has(d.id)) await store.dateEvents.remove(d.id);
  };
}

// Start a formal offer for one person. Only this creates a FormalOffer (spec: a saved idea
// or recorded interest never does). One offer per person; a second attempt is Try Again.
export async function startOffer({ personId, contactId = null, myAnswer = '', theirAnswer = '' }) {
  const existing = await store.offers.byIndex('personId', personId);
  if (existing.length) return existing[0];
  const person = await store.people.get(personId);
  const o = await store.offers.save({ personId, personName: person ? store.personName(person) : '', contactId, status: 'offers' });
  const t = await store.tries.save({ offerId: o.id, personId, n: 1, myAnswer, theirAnswer, refsChecked: false, phase: 'checking', endedBy: null, endedReason: '', endedAt: null, startedAt: store.now() });
  await log(t, 'Offer recorded.', { kind: 'offer' });
  if (myAnswer) await log(t, `Me: ${myAnswer}.`, { kind: 'answer' });
  if (theirAnswer) await log(t, `${person ? store.personName(person).split(/\s+/)[0] : 'They'}: ${theirAnswer}.`, { kind: 'answer' });
  // Both Yes stays in Offers (checking references); a date moves it to In Progress (owner request).
  if (myAnswer === 'Yes' && theirAnswer === 'Yes') await log(t, 'Both said Yes. Moved here from Ideas.', { kind: 'stage' });
  return o;
}

// Change one side's answer (not No — that goes through endTry). Returns { undo, event } or null.
export async function setAnswer(m, side, value, { source = '' } = {}) {
  const t = m.cur.t;
  if (t.phase === 'ended') return null;
  const key = side === 'me' ? 'myAnswer' : 'theirAnswer';
  if ((t[key] || '') === (value || '')) return null;
  const undo = await snapshot(m);
  const t2 = { ...t, [key]: value || '' };
  await store.tries.save(t2);
  const event = await log(t2, `${sideName(m, side)}: ${value || 'Not answered yet'}.`, { source, kind: 'answer' });
  if (bothYes(t2) && !bothYes(t)) await log(t2, 'Both said Yes. Next: references and Date 1.', { kind: 'stage' });
  await touch(m.o, t2);
  return { undo, event };
}

// Expanded card: Stage choice. Dating needs both Yes; Ended goes through endTry.
export async function setPhase(m, phase) {
  const t = m.cur.t;
  if (t.phase === 'ended' || t.phase === phase) return null;
  if (phase === 'dating' && !bothYes(t)) return { refused: 'Dating needs a Yes from both sides. Update the answers first.' };
  const undo = await snapshot(m);
  const t2 = { ...t, phase };
  await store.tries.save(t2);
  await log(t2, `Stage changed to ${phase === 'dating' ? 'Dating' : 'Checking'} (by you).`, { kind: 'stage' });
  await touch(m.o, t2);
  return { undo };
}

// End the current try. side: 'me' | 'them' | 'both' | 'unknown'. `saidNo` marks that side's answer No.
export async function endTry(m, { endedBy = 'unknown', reason = '', source = '', saidNo = false }) {
  const t = m.cur.t;
  if (t.phase === 'ended') return null;
  const undo = await snapshot(m);
  const t2 = { ...t, phase: 'ended', endedBy, endedReason: reason.trim(), endedAt: store.now() };
  if (saidNo && endedBy === 'me') t2.myAnswer = 'No';
  if (saidNo && endedBy === 'them') t2.theirAnswer = 'No';
  await store.tries.save(t2);
  const who = endedBy === 'unknown' ? '' : endedByName(m, t2);
  const text = saidNo && who ? `${who === 'me' ? 'Me' : who}: No. The shidduch ended.` : `Shidduch moved to Ended${who ? ' by ' + who : ''}.`;
  await log(t2, text + (reason.trim() ? ` Reason: ${reason.trim()}` : ''), { source, kind: 'ended' });
  await touch(m.o, t2, 'ended');
  return { undo };
}

export async function markRefs(m) {
  const t = m.cur.t;
  if (t.refsChecked || t.phase === 'ended') return null;
  const t2 = { ...t, refsChecked: true };
  await store.tries.save(t2);
  await log(t2, 'References checked.', { kind: 'refs' });
  await touch(m.o, t2);
  return true;
}

export async function setShadchan(m, contactId) {
  await store.offers.save({ ...m.o, contactId: contactId || null });
}

// Add update / Add note: one dated and timed line on the current try's history.
export async function addNote(m, text) {
  const t = m.cur.t;
  const undo = await snapshot(m);
  await log(t, text.trim(), { kind: 'note' });
  await touch(m.o, t);
  return { undo };
}

// Arrange or edit a date. A changed status/time/place writes exactly one history line.
export async function saveDate(m, d, { when, where, status, feedback }) {
  const t = m.cur.t;
  const isNew = !d;
  const n = isNew ? Math.max(0, ...m.cur.dates.map(dateNum)) + 1 : dateNum(d);
  const rec = await store.dateEvents.save({ ...(d || { tryId: t.id, offerId: t.offerId, n }), when, where: where.trim(), status, feedback: feedback.trim(), at: d?.at || store.now() });
  const changed = isNew || d.status !== status || d.when !== when || d.where !== where.trim();
  if (changed) {
    const verb = status.toLowerCase();
    const text = isNew ? `Date ${n} ${verb}${status === 'Arranged' ? ' for ' + whenNice(when) : ''}.`
      : `Date ${n} ${verb}${d.when !== when ? ', schedule updated' : ''}.`;
    await log(t, text, { kind: 'date', eventAt: status === 'Happened' ? when : null });
  }
  let t2 = t;
  if (bothYes(t) && t.phase === 'checking') { t2 = { ...t, phase: 'dating' }; await store.tries.save(t2); await log(t2, 'First date set up; moved to In Progress.', { kind: 'stage' }); }
  await touch(m.o, t2);
  return rec;
}

// Try Again: same couple, same offer record, a new numbered try with a fresh bar.
export async function tryAgain(m) {
  const last = m.cur.t;
  if (last.phase !== 'ended') return null;
  const n = m.tries.length + 1;
  const t = await store.tries.save({ offerId: m.o.id, personId: m.o.personId, n, myAnswer: '', theirAnswer: '', refsChecked: false, phase: 'checking', endedBy: null, endedReason: '', endedAt: null, startedAt: store.now() });
  await log(t, `The ${tryName(n)} started.`, { kind: 'try' });
  await touch(m.o, t, 'offers');
  return t;
}

// Attach "who told you" to one history line after an answer change (optional, SH-02).
export async function setEventSource(event, source) {
  const e = await store.stageEvents.get(event.id);
  if (e) await store.stageEvents.save({ ...e, source: source.trim() });
}

export const PROVISIONAL_TRIES = 3; // spec: "three tries total" is provisional — shown as a note, never enforced
