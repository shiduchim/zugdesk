// Shadchan Mode — what the pages share about singles: the status list and the short lines
// that describe one. A single is a `people` record (the same one Add Person saves) with a few
// extra fields; see spec/shadchan/build-notes.md.
import * as store from '../js/store.js';

// Stored as the key; the word on screen lives only here. (Owner: the list can change later.)
export const STATUSES = [['available', 'Available'], ['busy', 'Busy'], ['engaged', 'Engaged'], ['paused', 'Paused'], ['not-relevant', 'Not relevant']];
// A single saved before a status was chosen counts as Available.
export const statusOf = (p) => (STATUSES.some(s => s[0] === p.status) ? p.status : 'available');
export const statusLabel = (key) => (STATUSES.find(s => s[0] === key) || STATUSES[0])[1];

export const KIND_WORDS = { guy: { one: 'guy', many: 'guys', title: 'Guys', add: 'Add Guy' }, girl: { one: 'girl', many: 'girls', title: 'Girls', add: 'Add Girl' } };

// "24 · Jerusalem · Teacher". A missing age is said, never guessed or hidden (design rule 4).
export function summaryLine(p) {
  return [p.age || 'Age not recorded', p.city, p.occupation].filter(Boolean).join(' · ');
}

// Guys or girls, newest change first. People with no kind yet are returned apart.
export async function loadSingles(kind) {
  const all = await store.people.list();
  const byNewest = (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '');
  return {
    list: all.filter(p => p.kind === kind).sort(byNewest),
    unmarked: all.filter(p => p.kind !== 'guy' && p.kind !== 'girl').sort(byNewest),
    total: all.length,
  };
}

// "To file": originals saved as they arrived, not opened yet. One with no kind shows in both lists.
export async function toFile(kind) {
  return (await store.unfiledSources()).filter(s => !s.kind || s.kind === kind);
}
