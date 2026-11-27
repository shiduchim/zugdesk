// Ideas → Shidduchim flow (owner request, tweak mode).
// Everyone stays in Ideas until BOTH sides say yes; only then a shidduch is started (Offers lane).
//   new      → nobody decided yet (she may already have said yes)
//   waiting  → I'm interested, waiting for her answer
//   closed   → Not for me, or she said no / not available (hidden unless "Closed" is chosen)
//   shidduch → a shidduch exists (lives in Shidduchim)
// Status is read from the dated interest records (history kept); nothing is deleted.
import * as store from '../js/store.js';
import { pron } from './people-data.js';
import { startOffer, tryAgain, offerForPerson, saveDate, endTry } from './shidduch-data.js';
import { h, toast, sheet } from '../js/ui.js';

export const MINE_YES = ['Interested', 'Want to learn more'];
export const MINE_NO = ['Not interested'];
export const THEIRS_YES = ['Yes, interested'];
export const THEIRS_NO = ['No', 'Not available now'];

export function latestByPerson(ints) {
  const out = new Map(); // personId → { mine, theirs }
  for (const i of [...ints].sort((a, b) => (a.at || '').localeCompare(b.at || ''))) {
    const cur = out.get(i.personId) || {}; cur[i.side] = i; out.set(i.personId, cur);
  }
  return out;
}

// endedOffer: when the ended shidduch was last changed (or true). An interest saved after that
// (Reopen, or a new answer) puts the person back among the open ideas.
export function ideaStatus(p, l = {}, hasOffer = false, endedOffer = false) {
  const P = pron(p), mine = l.mine?.value, theirs = l.theirs?.value;
  if (hasOffer) return { key: 'shidduch', label: 'In a shidduch' };
  const newer = typeof endedOffer === 'string' && [l.mine, l.theirs].some(i => i?.at && i.at > endedOffer);
  if (endedOffer && !newer) return { key: 'closed', label: 'Shidduch ended' };
  if (MINE_NO.includes(mine)) return { key: 'closed', label: 'Not for me' };
  if (THEIRS_NO.includes(theirs)) return { key: 'closed', label: `${P.He} said no` };
  if (MINE_YES.includes(mine)) return { key: 'waiting', label: `Waiting for ${P.him}` };
  if (THEIRS_YES.includes(theirs)) return { key: 'new', label: `${P.He} said yes` };
  return { key: 'new', label: 'New' };
}

// Save one interest record, then start the shidduch when both sides are now yes.
// Returns the offer when the person just moved to Shidduchim.
export async function recordInterest(personId, rec) {
  await store.interests.save({ personId, at: store.now(), reason: '', ...rec });
  return maybeStart(personId);
}
export async function maybeStart(personId) {
  const [ints, offers] = await Promise.all([store.interestsForPerson(personId), store.offers.byIndex('personId', personId)]);
  if (offers.some(o => o.status !== 'ended')) return null;
  const l = latestByPerson(ints).get(personId) || {};
  if (!MINE_YES.includes(l.mine?.value) || !THEIRS_YES.includes(l.theirs?.value)) return null;
  const ended = offers[0];
  if (ended) { // same couple again after an ended shidduch: a new try on the same record (Try Again), both Yes
    const tries = (await store.tries.byIndex('personId', personId)).filter(t => t.offerId === ended.id).sort((a, c) => (a.n || 0) - (c.n || 0));
    const t = await tryAgain({ o: ended, cur: { t: tries[tries.length - 1] || { phase: 'ended' } }, tries });
    if (t) await store.tries.save({ ...t, myAnswer: 'Yes', theirAnswer: 'Yes' });
    return store.offers.get(ended.id);
  }
  const p = await store.people.get(personId);
  return startOffer({ personId, contactId: p?.senderContactId || (p?.contactIds || [])[0] || null, myAnswer: 'Yes', theirAnswer: 'Yes' });
}

// Reopen a closed idea: new records put both sides back to "not decided"; history stays.
export async function reopen(personId, l = {}, endedOffer = false) {
  if (endedOffer) {
    await store.interests.save({ personId, side: 'mine', value: 'Not sure yet', reason: 'Reopened', at: store.now() });
    await store.interests.save({ personId, side: 'theirs', value: 'Not asked yet', reason: 'Reopened', at: store.now() });
    return;
  }
  if (MINE_NO.includes(l.mine?.value)) await store.interests.save({ personId, side: 'mine', value: 'Not sure yet', reason: 'Reopened', at: store.now() });
  if (THEIRS_NO.includes(l.theirs?.value)) await store.interests.save({ personId, side: 'theirs', value: 'Not asked yet', reason: 'Reopened', at: store.now() });
}

// ---------- One-tap steps (Fable's design, owner request Nov 2026) ----------
// The same buttons under each person in Ideas and at the bottom of the person card. Only the steps still
// ahead show, and a later step fills in the earlier ones: "We met" = I'm interested + she said yes + the
// shidduch starts + Date 1 happened now. Every step has Undo in the message instead of a question.
async function personState(personId) {
  const [ints, offers, tries] = await Promise.all([store.interestsForPerson(personId), store.offers.byIndex('personId', personId), store.tries.byIndex('personId', personId)]);
  const per = (col) => Promise.all(tries.map(t => col.byIndex('tryId', t.id))).then(x => x.flat());
  const [evs, dts] = await Promise.all([per(store.stageEvents), per(store.dateEvents)]);
  return { ints, offers, tries, evs, dts };
}
// Undo: records this step made go (for good, not to Recently deleted); records it changed go back.
async function undoTo(personId, before) {
  const now = await personState(personId);
  const cols = { ints: store.interests, offers: store.offers, tries: store.tries, evs: store.stageEvents, dts: store.dateEvents };
  for (const [k, col] of Object.entries(cols)) {
    const old = new Map(before[k].map(r => [r.id, r]));
    await store.discard(col, now[k].filter(r => !old.has(r.id)).map(r => r.id));
    for (const r of now[k]) { const o = old.get(r.id); if (o && o.updatedAt !== r.updatedAt) await col.save(o); }
  }
}
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// step: interested | yes | met | metAgain | pass (not for me) | theyNo | endMe | endThem | endBoth
export async function advance(p, step) {
  const before = await personState(p.id);
  const l = latestByPerson(before.ints).get(p.id) || {};
  const live = before.offers.some(o => o.status !== 'ended');
  const at = store.now(), mine = (value) => store.interests.save({ personId: p.id, side: 'mine', value, reason: '', at });
  const theirs = (value) => store.interests.save({ personId: p.id, side: 'theirs', value, reason: '', reportedBy: '', at });
  if (step === 'interested') await mine('Interested');
  if ((step === 'yes' || step === 'met') && !live) {
    if (!MINE_YES.includes(l.mine?.value)) await mine('Interested');
    if (!THEIRS_YES.includes(l.theirs?.value)) await theirs('Yes, interested');
    await maybeStart(p.id); // starts the shidduch (or a new try on the same one after it ended)
  }
  if (step === 'met' || step === 'metAgain') {
    const m = await offerForPerson(p.id);
    if (m && m.cur.t.phase !== 'ended') await saveDate(m, null, { when: localNow(), where: '', status: 'Happened', feedback: '' });
  }
  if (step === 'pass') await mine('Not interested');
  if (step === 'theyNo') await theirs('No');
  if (step.startsWith('end')) {
    const m = await offerForPerson(p.id);
    if (m) await endTry(m, { endedBy: step === 'endMe' ? 'me' : step === 'endThem' ? 'them' : 'both', saidNo: step !== 'endBoth' });
  }
  return () => undoTo(p.id, before);
}

const DONE = { interested: 'Saved: you are interested', yes: (P) => `Saved: both said yes · in Shidduchim`, met: () => 'Saved: you met today (Date 1) · in Shidduchim',
  metAgain: () => 'Saved: you met today · added to the shidduch’s dates', pass: () => 'Saved: not for you', theyNo: (P) => `Saved: ${P.he} said no`, end: () => 'Shidduch ended' };
let busy = false; // one step at a time (a quick second tap never records twice)
async function run(p, step) {
  if (busy) return; busy = true;
  try {
    const undo = await advance(p, step);
    const P = pron(p), msg = DONE[step.startsWith('end') ? 'end' : step];
    toast(typeof msg === 'function' ? msg(P) : msg, 6000, { label: 'Undo', run: async () => { await undo(); toast('Undone'); } });
  } finally { busy = false; }
}
async function noSheet(p, inShidduch) {
  const P = pron(p);
  const acts = inShidduch
    ? [{ id: 'endMe', label: 'I ended it' }, { id: 'endThem', label: `${P.He} ended it` }, { id: 'endBoth', label: 'Both' }]
    : [{ id: 'pass', label: 'Not for me' }, { id: 'theyNo', label: `${P.He} said no` }];
  const r = await sheet({ title: inShidduch ? `End the shidduch with ${store.personName(p)}?` : `No · ${store.personName(p)}`, dataId: 'idea.no-sheet', body: [], actions: acts });
  if (r) run(p, r);
}
// st: ideaStatus(...). Returns the button row, or null when there is no step ahead (closed).
export function stepChips(p, st) {
  const P = pron(p);
  const b = (label, id, onClick, primary) => h('button', { type: 'button', class: 'btn small' + (primary ? ' primary' : ''), 'data-id': 'idea.step-' + id,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); onClick(); } }, label);
  const row = (...kids) => h('div', { class: 'pc-status-btns idea-steps', 'data-id': 'idea.steps' }, ...kids);
  if (st.key === 'new') return row(b('I’m interested', 'interested', () => run(p, 'interested'), true), b(`${P.He} said yes`, 'yes', () => run(p, 'yes')), b('We met', 'met', () => run(p, 'met')), b('No', 'no', () => noSheet(p, false)));
  if (st.key === 'waiting') return row(b(`${P.He} said yes`, 'yes', () => run(p, 'yes'), true), b('We met', 'met', () => run(p, 'met')), b('No', 'no', () => noSheet(p, false)));
  if (st.key === 'shidduch') return row(b('We met', 'again', () => run(p, 'metAgain'), true), b('Ended', 'end', () => noSheet(p, true)));
  return null;
}
