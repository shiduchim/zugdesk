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

// ---------- Stage S2: one in-memory search index (scale target: 3,000 singles) ----------
// Built once from people + their pasted originals + open shidduchim, then reused until one of
// those stores changes. Pages never keep their own copies: they ask for the index each draw.
let INDEX = null;
store.subscribe((ch) => { if (['people', 'sources', 'offers', '*'].includes(ch.store)) INDEX = null; });

// Lower-case, no Hebrew vowel marks, curly quotes made plain: "Bnei-Brak" and "bnei brak" both match.
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[֑-ׇ̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/[-_/.,;:()]+/g, ' ');
export const ageNum = (p) => { const n = parseInt(p.age, 10); return Number.isFinite(n) && n > 0 && n < 130 ? n : null; };
export const backgroundsOf = (p) => [].concat((p.answers || {}).pBackground || []).filter(Boolean);

export async function singlesIndex() {
  if (INDEX) return INDEX;
  const built = (async () => {
    const [all, srcs, offs] = await Promise.all([store.people.list(), store.sources.list(), store.offers.list()]);
    const origText = new Map();
    for (const s of srcs) if (s.personId) origText.set(s.personId, (origText.get(s.personId) || '') + '\n' + (s.text || ''));
    const open = new Set();
    for (const o of offs) if (o.status !== 'ended') { if (o.guyId) open.add(o.guyId); if (o.girlId) open.add(o.girlId); }
    const rows = all.map(p => {
      const A = p.answers || {};
      const words = [p.name, p.firstName, p.lastName, p.age, p.city, p.country, p.occupation, p.about, p.looking, p.sender, p.religiousOther, p.howKnow,
        ...(p.languages || []), ...Object.values(A).flat(), ...(p.contactCards || []).flatMap(c => [c.name, c.number, c.email]), origText.get(p.id)];
      return { p, kind: p.kind, age: ageNum(p), status: statusOf(p), text: norm(words.filter(Boolean).join(' \n ')),
        orig: origText.get(p.id) || '', open: open.has(p.id), backgrounds: backgroundsOf(p) };
    });
    const byNewest = (a, b) => (b.p.updatedAt || '').localeCompare(a.p.updatedAt || '');
    rows.sort(byNewest);
    return { rows, total: all.length };
  })();
  INDEX = built;
  return built;
}

// The filter state of one list. Kept per kind while the app is open.
export const emptyFilters = () => ({ q: '', scope: 'all', ageFrom: '', ageTo: '', cities: [], backgrounds: [], languages: [], statuses: [] });
export const filterCount = (f) => (f.ageFrom || f.ageTo ? 1 : 0) + f.cities.length + f.backgrounds.length + f.languages.length + f.statuses.length;

// Apply search + filters. Design rule 4: with an age filter on, singles with no age are not
// hidden; they come back apart as `noAge`.
export function applyFilters(rows, kind, f) {
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  const from = parseInt(f.ageFrom, 10), to = parseInt(f.ageTo, 10);
  const ageOn = Number.isFinite(from) || Number.isFinite(to);
  const shown = [], noAge = [];
  let working = 0, all = 0;
  for (const r of rows) {
    if (r.kind !== kind) continue;
    all++; if (r.p.starred) working++;
    if (f.scope === 'working' && !r.p.starred) continue;
    if (words.length && !words.every(w => r.text.includes(w))) continue;
    if (f.statuses.length && !f.statuses.includes(r.status)) continue;
    if (f.cities.length && !f.cities.includes(r.p.city)) continue;
    if (f.languages.length && !(r.p.languages || []).some(l => f.languages.includes(l))) continue;
    if (f.backgrounds.length && !r.backgrounds.some(b => f.backgrounds.includes(b))) continue;
    if (ageOn) {
      if (r.age == null) { noAge.push(r); continue; }
      if (Number.isFinite(from) && r.age < from) continue;
      if (Number.isFinite(to) && r.age > to) continue;
    }
    shown.push(r);
  }
  return { shown, noAge, working, all };
}

// The choices offered in the Filters sheet: only what this list really holds, most common first.
export function filterOptions(rows, kind) {
  const tally = (get) => {
    const m = new Map();
    for (const r of rows) if (r.kind === kind) for (const v of [].concat(get(r) || [])) if (v) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([v]) => v);
  };
  return { cities: tally(r => r.p.city), backgrounds: tally(r => r.backgrounds), languages: tally(r => r.p.languages) };
}

// A few words around the first search word, for rows found only inside the pasted original.
export function snippet(r, q) {
  const w = norm(q).split(/\s+/).filter(Boolean)[0];
  if (!w || !r.orig) return '';
  const plain = r.orig.replace(/\s+/g, ' ').trim(), i = norm(plain).indexOf(w);
  if (i < 0) return '';
  const start = Math.max(0, i - 30);
  return (start ? '…' : '') + plain.slice(start, i + w.length + 40).trim() + '…';
}

// "3 months ago" for "Last confirmed looking".
export function agoWords(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d.length === 10 ? d + 'T12:00:00' : d).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
