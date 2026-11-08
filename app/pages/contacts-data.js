// Contacts — shared page state + read model built from the ONE store (no copies kept
// between visits: every render reloads from store.js; only UI state lives here).
import * as store from '../js/store.js';

// UI state survives moving between pages and switching views (spec CT-13):
// selection, search, filters, scroll positions, unfinished notes.
export const S = {
  q: '', role: 'all', activity: 'all',
  cities: [], languages: [], communities: [], folder: '',
  selectedId: null, expandedId: null,
  scroll: {},          // keep-scroll key → scrollTop / scrollLeft
  pageScroll: 0,
  drafts: {},          // contactId → { text, type, date }
};

export const SORTS = [
  ['recent', 'Recent conversation'], ['oldest', 'Oldest conversation'], ['name', 'Name'],
  ['city', 'City'], ['language', 'Language'], ['community', 'Community served'],
];
export const ROLE_TABS = [['all', 'All'], ['shadchan', 'Shadchanim'], ['reference', 'References'], ['other', 'Other']];
export const ACTIVITY = [['all', 'All'], ['waiting', 'Waiting'], ['follow-up', 'Follow-up'], ['active', 'Active'], ['pinned', 'Pinned']];
export const STATUS_LABEL = { none: '', waiting: 'Waiting', 'follow-up': 'Follow-up', active: 'Active' };
export const LAYOUTS = [
  ['a', 'A — Outlook summary at top', 'Names upper left, quick facts upper right, full-width activity below.'],
  ['split', 'B — Top/bottom split', 'Names in the upper pane, the selected person below. Drag the bar to change the split.'],
  ['rail', 'Narrow left sidebar', 'A slim column of names on the left; the selected person uses the rest.'],
  ['tabs', 'Horizontal name tabs', 'Swipe names left and right across the top; the person fills the screen.'],
  ['list', 'Expanded list', 'One list. Tap a name to open their details right inside the list.'],
  ['inbox', 'Inbox-style drill-down', 'List → person → full conversation, with ordinary Back.'],
];

export const roleLabel = (r) => ({ shadchan: 'Shadchan', reference: 'Reference', friend: 'Friend', family: 'Family', helper: 'Helper', other: 'Other' })[r] || (r ? r[0].toUpperCase() + r.slice(1) : r);

export let D = null;

export async function load() {
  const [contacts, events, fus, folders, people, atts] = await Promise.all([
    store.contacts.list(), store.events.list(), store.followUps.list(), store.folders.list(), store.people.list(), store.attachments.list(),
  ]);
  const evBy = new Map(), fuBy = new Map(), attBy = new Map();
  for (const e of events) for (const cid of e.contactIds || []) (evBy.get(cid) || evBy.set(cid, []).get(cid)).push(e);
  for (const list of evBy.values()) list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  for (const f of fus) if (f.contactId) (fuBy.get(f.contactId) || fuBy.set(f.contactId, []).get(f.contactId)).push(f);
  for (const a of atts) if (a.contactId) (attBy.get(a.contactId) || attBy.set(a.contactId, []).get(a.contactId)).push(a);
  const x = new Map();
  for (const c of contacts) {
    const evs = evBy.get(c.id) || [];
    const open = (fuBy.get(c.id) || []).filter(f => !f.done);
    x.set(c.id, {
      last: store.lastRecorded(c, evs[0]?.at),
      latest: evs[0] || null,
      open,
      search: [store.displayName(c), c.name, c.city, c.country, (c.roles || []).map(roleLabel).join(' '), (c.languages || []).join(' '),
        (c.communities || []).join(' '), c.about, c.phone, c.email, evs.map(e => e.text).join(' ')].filter(Boolean).join(' ').toLowerCase(),
    });
  }
  D = {
    contacts, byId: new Map(contacts.map(c => [c.id, c])), x, evBy, fuBy, attBy,
    folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
    folderById: new Map(folders.map(f => [f.id, f])),
    people, peopleById: new Map(people.map(p => [p.id, p])),
  };
  if (S.selectedId && !D.byId.has(S.selectedId)) S.selectedId = null;
  if (S.folder && S.folder !== '_none' && !D.folderById.has(S.folder)) S.folder = '';
  return D;
}

const nameKey = (c) => ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '').toLowerCase();
const cmpName = (a, b) => nameKey(a).localeCompare(nameKey(b), undefined, { sensitivity: 'base' });
// Missing values always sort after present ones, whatever the direction.
const byKey = (get, dir = 1) => (a, b) => {
  const va = get(a), vb = get(b);
  if (!va && !vb) return cmpName(a, b);
  if (!va) return 1; if (!vb) return -1;
  return (va < vb ? -1 : va > vb ? 1 : 0) * dir || cmpName(a, b);
};
export function sorter(sort) {
  const last = (c) => D.x.get(c.id).last;
  switch (sort) {
    case 'oldest': return byKey(last, 1);
    case 'name': return cmpName;
    case 'city': return byKey(c => (c.city || '').toLowerCase());
    case 'language': return byKey(c => ((c.languages || [])[0] || '').toLowerCase());
    case 'community': return byKey(c => ((c.communities || [])[0] || '').toLowerCase());
    default: return byKey(last, -1);
  }
}

export function matches(c) {
  const x = D.x.get(c.id);
  const words = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length && !words.every(w => x.search.includes(w))) return false;
  const roles = c.roles || [];
  if (S.role === 'shadchan' && !roles.includes('shadchan')) return false;
  if (S.role === 'reference' && !roles.includes('reference')) return false;
  if (S.role === 'other' && (roles.includes('shadchan') || roles.includes('reference'))) return false;
  if (S.activity === 'waiting' && c.status !== 'waiting') return false;
  if (S.activity === 'follow-up' && !(c.status === 'follow-up' || x.open.length)) return false;
  if (S.activity === 'active' && c.status !== 'active') return false;
  if (S.activity === 'pinned' && !c.pinned) return false;
  if (S.cities.length && !S.cities.includes(c.city)) return false;
  if (S.languages.length && !(c.languages || []).some(l => S.languages.includes(l))) return false;
  if (S.communities.length && !(c.communities || []).some(l => S.communities.includes(l))) return false;
  if (S.folder === '_none' && c.folderId) return false;
  if (S.folder && S.folder !== '_none' && c.folderId !== S.folder) return false;
  return true;
}

// Returns { pinned, rest, total } — pinned is its own section; both keep the chosen sort.
export function visible() {
  const list = D.contacts.filter(matches).sort(sorter(store.getPrefs().contactsSort));
  const pinned = list.filter(c => c.pinned), rest = list.filter(c => !c.pinned);
  return { pinned, rest, all: [...pinned, ...rest], total: list.length };
}

export const extraFilterCount = () => S.cities.length + S.languages.length + S.communities.length + (S.folder ? 1 : 0);
export const anyFilter = () => !!(S.q.trim() || S.role !== 'all' || S.activity !== 'all' || extraFilterCount());
export function clearFilters() {
  S.q = ''; S.role = 'all'; S.activity = 'all'; S.cities = []; S.languages = []; S.communities = []; S.folder = '';
}

export function optionsFor(field) {
  const set = new Set();
  for (const c of D.contacts) {
    const v = c[field];
    if (Array.isArray(v)) v.forEach(x => x && set.add(x)); else if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Make sure something sensible is selected for views that show one person.
export function ensureSelection(all) {
  if (S.selectedId && D.byId.has(S.selectedId)) return D.byId.get(S.selectedId);
  S.selectedId = all[0]?.id || null;
  return S.selectedId ? D.byId.get(S.selectedId) : null;
}

// Strip nothing: records in D are exactly what the store returned, safe to save back.
export const fresh = (id) => store.contacts.get(id);
