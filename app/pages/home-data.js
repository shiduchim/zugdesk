// Home: simple offline rules for Smart Suggestions (spec/home.md HOME-08 — not AI) and the
// History list, which is read straight from the records it describes (nothing copied).
import * as store from '../js/store.js';
import { norm } from './notes-data.js';
import { isShadchan } from '../js/mode.js';

// ---------- name index ----------
// alias (normalised) → [{ kind: 'c' | 'p', id }]. More than one = ambiguous, never auto-picked.
export function nameIndex(D) {
  const map = new Map();
  const add = (alias, ref) => {
    const k = norm(alias);
    if (!k || k.length < 3) return;
    const l = map.get(k) || map.set(k, []).get(k);
    if (!l.some(r => r.kind === ref.kind && r.id === ref.id)) l.push(ref);
  };
  for (const c of D.contacts) {
    const ref = { kind: 'c', id: c.id };
    add(store.displayName(c), ref);
    if (c.firstName && c.lastName) add(`${c.firstName} ${c.lastName}`, ref);
    if (c.title && c.lastName) add(`${c.title} ${c.lastName}`, ref);
    if (c.firstName) add(c.firstName, ref);
  }
  for (const p of D.people) {
    const ref = { kind: 'p', id: p.id };
    if (!p.name) continue;
    add(p.name, ref);
    add(p.name.trim().split(/\s+/)[0], ref);
  }
  let maxWords = 1;
  for (const k of map.keys()) maxWords = Math.max(maxWords, k.split(' ').length);
  return { map, maxWords: Math.min(maxWords, 4) };
}

const STOP = new Set(('i we the a an my it its called call back spoke talked met today tomorrow next in after before please he she her his him they them their there ' +
  'sent send want wants need needs maybe said says say profile new note notes remember asked ask reminder shidduch shidduchim match ideas idea work works ' +
  'seminary event dating phone number reference references family families someone about from person contact email message reply follow up done ' +
  'morning evening night last week weeks day days month months year this those that these can will for information also and but or so if then not no yes ' +
  'ok okay thanks thank good great nice very really just only still again waiting wait promised hope hopefully question questions what when where who why how ' +
  'did does do was were is are be been has have had am mr mrs ms dr rabbi rebbetzin reb shabbos shabbat yom tov chag pesach sukkos sukkot purim chanukah ' +
  'monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december ' +
  'jerusalem brooklyn lakewood israel usa english hebrew yiddish').split(' '));
const NAME_VERBS = /^(?:has|have|says|said|is|isn|will|wants|called|thinks|knows|sent|asked|told|mentioned|suggested|might|can|could|would)\b/i;
const VERB_BEFORE = /\b(?:call|called|text|texted|met|ask|asked|contact|message|messaged|saw|with|to|from|told|tell|email|emailed)\s+$/i;

const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3 };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const ymd = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
function dateFromPhrase(t) {
  t = t.toLowerCase().replace(/\s+/g, ' ');
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (t === 'tomorrow') { d.setDate(d.getDate() + 1); return ymd(d); }
  if (t === 'today' || t === 'tonight') return ymd(d);
  if (t === 'next week') { d.setDate(d.getDate() + 7); return ymd(d); }
  if (t === 'next month') { d.setMonth(d.getMonth() + 1); return ymd(d); }
  let m = t.match(/^in (?:a |an )?(a|an|one|two|three|four|five|six|couple of|few|\d+) ?(day|week|month)s?$/);
  if (m) {
    const n = NUM[m[1].replace(' of', '')] || Number(m[1]) || 1;
    if (m[2] === 'month') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (m[2] === 'week' ? 7 : 1));
    return ymd(d);
  }
  m = t.match(/^(?:next |on |this )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (m) { const add = ((DAYS.indexOf(m[1]) - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + add); return ymd(d); }
  return null;
}
const DATE_RE = /\b(?:in\s+(?:a\s+|an\s+)?(?:a|an|one|two|three|four|five|six|couple\s+of|few|\d+)\s*(?:days?|weeks?|months?)|tomorrow|tonight|next\s+(?:week|month)|(?:next\s+|on\s+|this\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi;
const ACTION_RE = /\b(?:call|calling|phone|ring|contact|check\s+(?:with|back|in)|follow\s+up|remind\s+me|text|message|ask|send|email|get\s+back)\b/i;
const WAIT_RE = /\b(?:promised\s+to|will\s+(?:send|call|reply|email|get\s+back|let\s+me\s+know|check|ask)|waiting\s+(?:for|to\s+hear)|(?:she|he|they)['’]ll\s+(?:send|call|let\s+me\s+know|get\s+back))\b/i;
const NO_RE = /\b(?:is\s+not\s+interested|isn['’]?t\s+interested|not\s+interested|said\s+no|says\s+no|declined|is\s+not\s+available|isn['’]?t\s+available)\b/i;
const YES_RE = /\b(?:said\s+yes|says\s+yes|wants\s+to\s+meet|is\s+interested|agreed\s+to\s+meet|agreed)\b/i;

// Returns { ranges, refs, unknown, date, action, waiting, answer } for one piece of text.
export function recognize(text, IX, D) {
  const ranges = [], refs = [];
  const overlaps = (s, e) => ranges.some(r => !(e <= r.start || s >= r.end));
  const words = [];
  const wr = /[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu; let m;
  while ((m = wr.exec(text))) {
    let w = m[0], end = m.index + w.length;
    const poss = w.match(/['’]s$/i); if (poss) { w = w.slice(0, -2); end -= 2; }
    while (w.endsWith('.') && !/^(?:mr|mrs|ms|dr|rav)\.$/i.test(w)) { w = w.slice(0, -1); end--; }
    if (w) words.push({ w, start: m.index, end });
  }
  // longest known name first, left to right
  for (let i = 0; i < words.length; i++) {
    for (let n = Math.min(IX.maxWords, words.length - i); n >= 1; n--) {
      const k = norm(words.slice(i, i + n).map(x => x.w).join(' '));
      const hit = IX.map.get(k);
      if (!hit) continue;
      const start = words[i].start, end = words[i + n - 1].end;
      if (overlaps(start, end)) continue;
      ranges.push({ start, end, type: 'known' });
      refs.push({ text: text.slice(start, end), start, end, matches: hit });
      i += n - 1;
      break;
    }
  }
  // dates
  let date = null;
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(text))) {
    const d = dateFromPhrase(m[0]);
    if (d && !overlaps(m.index, m.index + m[0].length)) { ranges.push({ start: m.index, end: m.index + m[0].length, type: 'time' }); if (!date) date = { due: d, word: m[0] }; }
  }
  // possible new names (rules only: a capitalised word that is not a known name or a common word)
  const unknown = [];
  for (let i = 0; i < words.length; i++) {
    const x = words[i];
    if (overlaps(x.start, x.end) || STOP.has(x.w.toLowerCase()) || x.w.length < 3 || /\d/.test(x.w)) continue;
    const before = text.slice(Math.max(0, x.start - 12), x.start);
    const after = text.slice(x.end, x.end + 14).trim();
    const latinCap = /^[A-Z][a-z'’-]+$/.test(x.w);
    const sentenceStart = i === 0 || /[.!?\n]\s*$/.test(text.slice(0, x.start));
    const ok = VERB_BEFORE.test(before) ? /^[A-Za-z][a-z'’-]+$/.test(x.w) : latinCap && (!sentenceStart || NAME_VERBS.test(after));
    if (!ok) continue;
    if (!unknown.some(u => norm(u.name) === norm(x.w))) unknown.push({ name: x.w, start: x.start });
    ranges.push({ start: x.start, end: x.end, type: 'new' });
  }
  // a reported answer about a suggested person ("Mrs. Cohen says Leah is not interested")
  let answer = null;
  // Single Mode only: there the answer is about me and one person. Shadchan Mode's two-sided answers come with stage S3.
  for (const r of isShadchan ? [] : refs) {
    const person = r.matches.length === 1 && r.matches[0].kind === 'p' ? r.matches[0] : null;
    if (!person) continue;
    const tail = text.slice(r.end, r.end + 60);
    const no = NO_RE.exec(tail), yes = YES_RE.exec(tail);
    const hit = no && (!yes || no.index <= yes.index) ? no : yes;
    if (!hit) continue;
    const s = r.end + hit.index, e = s + hit[0].length;
    if (!overlaps(s, e)) ranges.push({ start: s, end: e, type: 'status' });
    const reporter = refs.find(x => x !== r && x.matches.length === 1 && x.matches[0].kind === 'c' && x.start < r.start);
    answer = { personId: person.id, value: hit === no ? 'No' : 'Yes', phrase: hit[0], reporterId: reporter ? reporter.matches[0].id : null };
    break;
  }
  ranges.sort((a, b) => a.start - b.start);
  return { ranges, refs, unknown, date, action: ACTION_RE.test(text), waiting: WAIT_RE.test(text), answer };
}

export const firstSentence = (text) => (text.trim().split(/[.!?\n]/)[0] || '').trim().slice(0, 120) || 'Follow up';

// ---------- History ----------
// Each row points at its source record; one event can be listed once here and still show
// in every linked contact / person history.
export function buildHistory(D, extra) {
  const rows = [];
  const cName = (id) => { const c = D.contactsById.get(id); return c ? store.displayName(c) : null; };
  const pName = (id) => { const p = D.peopleById.get(id); return p ? store.personName(p) : null; };
  const namesOf = (x) => [...(x.contactIds || []).map(cName), ...(x.personIds || []).map(pName)].filter(Boolean);
  const notesById = new Map(D.notes.map(n => [n.id, n]));
  for (const e of D.events) {
    if (e.noteId) {
      const n = notesById.get(e.noteId); if (!n) continue;
      const first = (D.entries.get(n.id) || [])[0]?.id === e.id;
      rows.push({ key: 'ev:' + e.id, at: e.at, what: (first ? 'New note: ' : 'Dated update: ') + n.title, text: e.text, kind: first ? 'Note' : 'Note update', noteId: n.id, names: namesOf(e) });
    } else {
      const names = namesOf(e);
      const href = e.contactIds?.length ? `#/contacts/${encodeURIComponent(e.contactIds[0])}` : e.personIds?.length ? `#/people/${encodeURIComponent(e.personIds[0])}/notes` : null;
      rows.push({ key: 'ev:' + e.id, at: e.at, what: `${store.eventTypeLabel(e.type)}${names.length ? ' · ' + names.join(', ') : ''}`, text: e.text, kind: 'Conversation', href, hrefLabel: e.contactIds?.length ? 'Open contact' : 'Open person', names });
    }
  }
  for (const f of D.followUps) {
    const who = [cName(f.contactId), pName(f.personId)].filter(Boolean);
    const base = { noteId: f.noteId || null, names: who, href: f.contactId ? `#/contacts/${encodeURIComponent(f.contactId)}` : null, hrefLabel: 'Open contact' };
    if ((f.createdAt && !f.demo) || f.noteId) rows.push({ ...base, key: 'fu:' + f.id, at: f.createdAt || f.updatedAt, what: (f.kind === 'waiting' ? 'Waiting item added' : 'Follow Up added') + (who.length ? ' · ' + who.join(', ') : ''), text: f.text + (f.dueAt ? ` · due ${store.formatDate(f.dueAt)}` : ''), kind: 'Follow Up' });
    if (f.done && f.doneAt) rows.push({ ...base, key: 'fud:' + f.id, at: f.doneAt, what: 'Completed Follow Up' + (who.length ? ' · ' + who.join(', ') : ''), text: f.text, kind: 'Follow Up' });
  }
  for (const s of extra.stageEvents) {
    const o = extra.offersById.get(s.offerId);
    const name = o ? (pName(o.personId) || o.personName || 'Shidduch') : 'Shidduch';
    rows.push({ key: 'st:' + s.id, at: s.at, what: 'Shidduch · ' + name, text: s.text + (s.source ? ` (told by ${s.source})` : ''), kind: 'Shidduch', href: `#/shidduchim/${encodeURIComponent(s.offerId)}/history`, hrefLabel: 'Open shidduch' });
  }
  for (const i of extra.interests) {
    const name = pName(i.personId); if (!name) continue;
    rows.push({ key: 'in:' + i.id, at: i.at, what: (i.side === 'mine' ? 'My interest · ' : 'Their response · ') + name,
      text: i.value + (i.reportedBy ? ` — reported by ${i.reportedBy}` : '') + (i.reason ? `. ${i.reason}` : ''), kind: 'Answer', href: `#/people/${encodeURIComponent(i.personId)}/offers`, hrefLabel: 'Open person' });
  }
  for (const a of extra.activity) rows.push({ key: 'ac:' + a.id, at: a.at, what: a.what, text: a.text, kind: 'Change', noteId: a.noteId || null, href: a.href || null, hrefLabel: 'Open' });
  for (const s of extra.shares) rows.push({ key: 'sh:' + s.id, at: s.at, what: 'Shared my profile' + (s.recipientName ? ' · ' + s.recipientName : ''), text: `${s.what} — you confirmed you sent it${s.channel ? ' (' + s.channel + ')' : ''}.`, kind: 'Sharing', href: '#/profile/short', hrefLabel: 'Open sharing activity' });
  for (const p of D.people) if (p.createdAt) rows.push({ key: 'p:' + p.id, at: p.createdAt, what: (isShadchan ? 'New single · ' : 'New suggested person · ') + store.personName(p), text: [p.age, p.city, p.occupation].filter(Boolean).join(' · ') || 'Saved in Ideas', kind: 'Person', href: `#/people/${encodeURIComponent(p.id)}`, hrefLabel: 'Open person' });
  return rows.filter(r => r.at).sort((a, b) => b.at.localeCompare(a.at));
}

// Open follow-ups first by due date (undated after, newest first).
export function openFollowUps(list) {
  return list.filter(f => !f.done).sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1; if (b.dueAt) return 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}
