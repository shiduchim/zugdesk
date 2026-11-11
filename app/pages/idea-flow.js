// Ideas → Shidduchim flow (owner request, tweak mode).
// Everyone stays in Ideas until BOTH sides say yes; only then a shidduch is started (Offers lane).
//   new      → nobody decided yet (she may already have said yes)
//   waiting  → I'm interested, waiting for her answer
//   closed   → Not for me, or she said no / not available (hidden unless "Closed" is chosen)
//   shidduch → a shidduch exists (lives in Shidduchim)
// Status is read from the dated interest records (history kept); nothing is deleted.
import * as store from '../js/store.js';
import { pron } from './people-data.js';
import { startOffer } from './shidduch-data.js';

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

export function ideaStatus(p, l = {}, hasOffer = false, endedOffer = false) {
  const P = pron(p), mine = l.mine?.value, theirs = l.theirs?.value;
  if (hasOffer) return { key: 'shidduch', label: 'In a shidduch' };
  if (endedOffer) return { key: 'closed', label: 'Shidduch ended' };
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
