// The single shared data store. Pages read and write ONLY through this module.
// Records: plain objects with { id, createdAt, updatedAt, demo? }.
// `demo: true` marks fictional seed records so Settings can remove them
// without touching anything the owner typed.
import { idb, tx, STORES, DB_VERSION, deleteDatabase } from './db.js';
import { makeDemoContacts, makeDemoActivity, makeDemoPeople, makeDemoShidduchim, makeDemoNotes, makeDemoProfile } from './seed.js';

export const SCHEMA_VERSION = DB_VERSION;
export const APP_VERSION = '0.8.0';
export const STAGE = 8; // last finished stage (shown in Settings → About)

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(change) { for (const fn of listeners) { try { fn(change); } catch (e) { console.error(e); } } }

export function newId(prefix = 'r') {
  const rnd = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  return `${prefix}_${rnd}`;
}
export const now = () => new Date().toISOString();

// ---------- generic record API ----------
function collection(store, prefix) {
  return {
    store,
    list: () => idb.getAll(store),
    get: (id) => idb.get(store, id),
    byIndex: (index, value) => idb.byIndex(store, index, value),
    count: () => idb.count(store),
    async save(rec) {
      const t = now();
      const out = { ...rec, id: rec.id || newId(prefix), createdAt: rec.createdAt || t, updatedAt: t };
      await idb.put(store, out);
      emit({ store, type: 'save', id: out.id });
      return out;
    },
    async saveMany(recs) {
      const t = now();
      const out = recs.map(r => ({ ...r, id: r.id || newId(prefix), createdAt: r.createdAt || t, updatedAt: r.updatedAt || t }));
      await idb.putMany(store, out);
      emit({ store, type: 'saveMany', count: out.length });
      return out;
    },
    async remove(id) { await idb.delete(store, id); emit({ store, type: 'remove', id }); },
  };
}

export const contacts        = collection('contacts', 'c');
export const people          = collection('people', 'p');
export const notes           = collection('notes', 'n');
export const events          = collection('events', 'ev');
export const followUps       = collection('followUps', 'fu');
export const folders         = collection('folders', 'f');
export const sources         = collection('sources', 'src');
export const interests       = collection('interests', 'int');
export const offers          = collection('offers', 'off');
export const tries           = collection('tries', 'try');
export const stageEvents     = collection('stageEvents', 'st');
export const dateEvents      = collection('dateEvents', 'dt');
export const profile         = collection('profile', 'me');
export const profileVersions = collection('profileVersions', 'pv');
export const shares          = collection('shares', 'sh');
export const attachments     = collection('attachments', 'att');
export const activity        = collection('activity', 'act');

const ALL = [contacts, people, notes, events, followUps, folders, sources, interests, offers,
  tries, stageEvents, dateEvents, profile, profileVersions, shares, attachments, activity];

// ---------- presentation preferences (small, separate from records) ----------
const PREF_KEY = 'zugdesk.prefs';
const PREF_DEFAULTS = {
  showLabels: false,
  navArrangement: 'three',   // 'three' = Home/Contacts/Shidduchim (+Profile); 'four' adds People & Ideas
  contactsLayout: 'a',       // phone view: a | split | rail | tabs | list | inbox (spec/contacts.md CT-13)
  contactsSort: 'recent',    // recent | oldest | name | city | language | community
  contactsSplit: 260,
  iAm: '',                  // My Profile: 'guy' | 'girl' — Ideas then shows only the other
  personKind: 'guy',         // Add Person: last chosen Guy / Girl        // upper pane height (px) in the top/bottom split view
  shidduchimView: 'compact', // Shidduchim list: compact | expanded
  homeSuggestions: true,     // Home: Smart Suggestions dot (blue = on)
  profileLang: 'en',         // My Profile: language being viewed / edited
};
export function getPrefs() {
  try { return { ...PREF_DEFAULTS, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}')) }; }
  catch { return { ...PREF_DEFAULTS }; }
}
export function setPref(key, value) {
  const p = { ...getPrefs(), [key]: value };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
  emit({ store: 'prefs', type: 'pref', key, value });
  return p;
}

// ---------- meta ----------
async function getMeta(key) { const r = await idb.get('meta', key); return r ? r.value : undefined; }
async function setMeta(key, value) { await idb.put('meta', { id: key, value }); }

// ---------- init + first-run seed (about 20 fictional contacts) ----------
export const FIRST_RUN_SEED = 20;
export const FULL_DEMO_SEED = 200;

export async function init() {
  const seeded = await getMeta('seeded');
  if (!seeded) {
    const count = await contacts.count();
    if (count === 0) await loadDemoContacts(FIRST_RUN_SEED);
    await setMeta('seeded', { at: now(), count: FIRST_RUN_SEED });
  }
  // Stage 2: demo contacts loaded before conversations existed get their fictional history once.
  if (!(await getMeta('demoActivityV1'))) {
    await addDemoActivity((await contacts.list()).filter(c => c.demo));
    await setMeta('demoActivityV1', { at: now() });
  }
  // Stage 3/4: a few fictional suggested people, linked to the starter demo contacts.
  if (!(await getMeta('demoPeopleV1'))) {
    if ((await contacts.list()).some(c => c.demo)) await loadDemoPeople();
    await setMeta('demoPeopleV1', { at: now() });
  }
  // Stage 5: fictional formal offers, tries, dates and history for the demo people.
  if (!(await getMeta('demoShidduchimV1'))) {
    if ((await people.list()).some(p => p.demo)) await loadDemoShidduchim();
    await setMeta('demoShidduchimV1', { at: now() });
  }
  // Stage 6: a few fictional Home notes linked to the demo contacts and people.
  if (!(await getMeta('demoNotesV1'))) {
    if ((await contacts.list()).some(c => c.demo)) await loadDemoNotes();
    await setMeta('demoNotesV1', { at: now() });
  }
  // Stage 7: a fictional example owner profile (only while demo data is in use; never over a real one).
  if (!(await getMeta('demoProfileV1'))) {
    if ((await contacts.list()).some(c => c.demo)) await loadDemoProfile();
    await setMeta('demoProfileV1', { at: now() });
  }
  await setMeta('schemaVersion', SCHEMA_VERSION);
}

export async function loadDemoNotes() {
  const d = makeDemoNotes();
  let added = 0;
  for (const [col, rows] of [[notes, d.notes], [events, d.events], [followUps, d.followUps], [activity, d.activity]]) {
    const ids = new Set((await col.list()).map(r => r.id));
    const fresh = rows.filter(r => !ids.has(r.id));
    if (fresh.length) { await col.saveMany(fresh); added += fresh.length; }
  }
  return added;
}

export async function loadDemoProfile() {
  if (await profile.get('me')) return 0; // the owner's own profile is never replaced
  const d = makeDemoProfile();
  await profile.save(d.profile);
  const ids = new Set((await profileVersions.list()).map(r => r.id));
  const fresh = d.versions.filter(r => !ids.has(r.id));
  if (fresh.length) await profileVersions.saveMany(fresh);
  const nIds = new Set((await notes.list()).map(r => r.id));
  if (d.notes.some(n => !nIds.has(n.id))) { await notes.saveMany(d.notes.filter(n => !nIds.has(n.id))); await events.saveMany(d.events); }
  const sIds = new Set((await shares.list()).map(r => r.id));
  const fs = d.shares.filter(r => !sIds.has(r.id));
  if (fs.length) await shares.saveMany(fs);
  return 1;
}

// ---------- History lines for changes with no record of their own ----------
// (e.g. a note's colour changed, a contact linked). Everything else in Home → History is
// read straight from the source record (notes, conversations, follow-ups, shidduch steps).
export function logActivity({ what, text = '', noteId = null, contactIds = [], personIds = [], href = null }) {
  return activity.save({ at: now(), what, text, noteId, contactIds, personIds, href });
}

export async function loadDemoShidduchim() {
  const d = makeDemoShidduchim();
  let added = 0;
  for (const [col, rows] of [[offers, d.offers], [tries, d.tries], [stageEvents, d.stageEvents], [dateEvents, d.dateEvents]]) {
    const ids = new Set((await col.list()).map(r => r.id));
    const fresh = rows.filter(r => !ids.has(r.id));
    if (fresh.length) { await col.saveMany(fresh); added += fresh.length; }
  }
  return added;
}

export async function loadDemoPeople() {
  const d = makeDemoPeople();
  const have = new Set((await people.list()).map(p => p.id));
  if (d.people.every(p => have.has(p.id))) return 0;
  await people.saveMany(d.people.filter(p => !have.has(p.id)));
  for (const [col, rows] of [[sources, d.sources], [interests, d.interests], [events, d.events], [followUps, d.followUps]]) {
    const ids = new Set((await col.list()).map(r => r.id));
    const fresh = rows.filter(r => !ids.has(r.id));
    if (fresh.length) await col.saveMany(fresh);
  }
  await loadDemoShidduchim();
  return d.people.length;
}

// Adds fictional demo contacts up to `total` (idempotent: demo ids are fixed).
export async function loadDemoContacts(total = FULL_DEMO_SEED) {
  const existing = await contacts.list();
  const have = new Set(existing.map(c => c.id));
  const fresh = makeDemoContacts(total).filter(c => !have.has(c.id));
  if (fresh.length) { await contacts.saveMany(fresh); await addDemoActivity(fresh); }
  return fresh.length;
}

async function addDemoActivity(demoContacts) {
  if (!demoContacts.length) return;
  const { events: evs, followUps: fus } = makeDemoActivity(demoContacts);
  const haveEv = new Set((await events.list()).map(e => e.id));
  const haveFu = new Set((await followUps.list()).map(f => f.id));
  const e2 = evs.filter(e => !haveEv.has(e.id)), f2 = fus.filter(f => !haveFu.has(f.id));
  if (e2.length) await events.saveMany(e2);
  if (f2.length) await followUps.saveMany(f2);
}

// Removes every record flagged demo:true in every store. Owner-typed data stays.
export async function removeDemoData() {
  let removed = 0;
  for (const col of ALL) {
    const all = await col.list();
    const ids = all.filter(r => r.demo).map(r => r.id);
    if (ids.length) { await idb.deleteMany(col.store, ids); removed += ids.length; }
  }
  emit({ store: '*', type: 'removeDemo', removed });
  return removed;
}

export async function counts() {
  const out = {};
  for (const col of ALL) out[col.store] = await col.count();
  return out;
}

// ---------- export / import / reset ----------
export async function exportAll() {
  const data = {};
  for (const name of Object.keys(STORES)) data[name] = await idb.getAll(name);
  return {
    app: 'ZugDesk', appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION,
    exportedAt: now(), prefs: getPrefs(), data,
  };
}

export function validateBackup(json) {
  if (!json || typeof json !== 'object') return 'Not a JSON object';
  if (json.app !== 'ZugDesk') return 'This file is not a ZugDesk backup';
  if (typeof json.schemaVersion !== 'number') return 'Backup has no schema version';
  if (json.schemaVersion > SCHEMA_VERSION) return `Backup is from a newer app (schema ${json.schemaVersion}); update the app first`;
  if (!json.data || typeof json.data !== 'object') return 'Backup has no data section';
  return null;
}

// mode 'replace' wipes current records first; 'merge' keeps current records and
// overwrites same-id records with the backup's copy.
export async function importAll(json, mode = 'replace') {
  const err = validateBackup(json);
  if (err) throw new Error(err);
  const names = Object.keys(STORES);
  let total = 0;
  await tx(names, 'readwrite', (s) => {
    for (const name of names) {
      if (mode === 'replace') s[name].clear();
      const rows = Array.isArray(json.data[name]) ? json.data[name] : [];
      for (const r of rows) { if (r && r.id) { s[name].put(r); total++; } }
    }
    s.meta.put({ id: 'seeded', value: { at: now(), imported: true } });
    s.meta.put({ id: 'schemaVersion', value: SCHEMA_VERSION });
  });
  if (json.prefs && typeof json.prefs === 'object') {
    for (const [k, v] of Object.entries(json.prefs)) if (k in PREF_DEFAULTS) setPref(k, v);
  }
  emit({ store: '*', type: 'import', total });
  return total;
}

export async function resetAll({ reseed = true } = {}) {
  await deleteDatabase();
  try { localStorage.removeItem(PREF_KEY); } catch {}
  if (reseed) await init(); else await setMeta('seeded', { at: now(), count: 0 });
  emit({ store: '*', type: 'reset' });
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ---------- conversations (ConversationEvent: one record, many links) ----------
// type: 'call' | 'whatsapp' | 'email' | 'text' | 'note' | '' (unknown)
export const EVENT_TYPES = [
  ['call', 'Phone call'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['text', 'Text message'], ['note', 'Personal note'], ['', 'Not sure'],
];
export const eventTypeLabel = (t) => (EVENT_TYPES.find(x => x[0] === (t || '')) || EVENT_TYPES[5])[1];

export async function eventsForContact(contactId) {
  const list = await events.byIndex('contactIds', contactId);
  return list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
export async function recordEvent({ id, contactIds = [], personIds = [], type = '', text = '', at }) {
  const existing = id ? await events.get(id) : null;
  return events.save({ ...(existing || {}), id, contactIds, personIds, type, text: text.trim(), at: at || now() });
}
export async function followUpsForContact(contactId) {
  const list = await followUps.byIndex('contactId', contactId);
  return list.sort((a, b) => (a.done - b.done) || (a.dueAt || '9').localeCompare(b.dueAt || '9'));
}

// Last recorded conversation = newest of the typed "last contact" date and the newest logged event.
// Missing means "nothing recorded in the app", never "never contacted".
export function lastRecorded(c, latestEventAt) {
  const a = c.lastContactAt || '', b = latestEventAt || '';
  return (a > b ? a : b) || null;
}

// ---------- user-managed choices (bubbles in Add Shadchan) ----------
// Stored in `meta` so they travel with export/import. Each list keeps order;
// hidden choices stay on records that already use them.
export const CHOICE_DEFAULTS = {
  ages: ['30 and under'],
  communities: ['Chabad', 'Haredi', 'Litvish', 'Bukharian', 'Sephardi', 'Breslev', 'Dati Leumi', 'Modern Orthodox', 'Yeshivish'],
  languages: ['English', 'Hebrew', 'Yiddish', 'French', 'Russian', 'Spanish'],
  roles: ['shadchan', 'reference', 'friend', 'family', 'helper'],
};
export const CHOICE_NAMES = { ages: 'Ages they work with', communities: 'Religious groups', languages: 'Languages', roles: 'Roles' };
// Add Person lists (spec/add-person.md AP-06 / AP-10). Same storage, own keys.
export const PERSON_CHOICE_DEFAULTS = {
  pStatus: ['Never been married', 'Divorced', 'Has children'],
  pReligious: ['Kohen', 'Prays 3× daily', 'Baal Teshuvah', 'Kosher for Kohen'],
  pLevel: ['Light', 'Moderate', 'Strong'],
  pTzniut: ['Light', 'Moderate', 'Strong'],
  pBackground: ['Chabad', 'Yeshivish', 'Breslev', 'Sephardi', 'Dati Leumi'],
  pTraits: ['Kind', 'Quiet', 'Outgoing', 'Athletic'],
  pBody: ['Regular', 'Overweight', 'Highly overweight'],
};
export async function getChoices() {
  const saved = (await getMeta('choices')) || {};
  const out = {};
  for (const [k, defs] of Object.entries({ ...CHOICE_DEFAULTS, ...PERSON_CHOICE_DEFAULTS })) out[k] = saved[k] || defs.map(v => ({ v, hidden: false }));
  for (const [k, list] of Object.entries(saved)) if (!(k in out) && Array.isArray(list)) out[k] = list; // user-made categories
  return out;
}
export async function saveChoices(choices) { await setMeta('choices', choices); emit({ store: 'meta', type: 'choices' }); }

// ---------- Add Person categories (order, hide, delete, custom) ----------
// Saved in `meta` so backups carry them. Deleting a category only changes the form;
// values already saved on people stay on the person record.
export const PERSON_CATEGORY_DEFAULTS = [
  { key: 'about', name: 'About & Looking For', jump: 'About' },
  { key: 'personal', name: 'Personal Info', jump: 'Personal' },
  { key: 'contacts', name: 'Contacts & Source', jump: 'Contacts' },
  { key: 'known', name: 'How well do I know them?', jump: 'Know them' },
  { key: 'status', name: 'Status', jump: 'Status' },
  { key: 'religious', name: 'Religious', jump: 'Religious' },
  { key: 'lifestyle', name: 'Character & Lifestyle', jump: 'Character & Lifestyle' },
].map(c => ({ ...c, builtin: true, hidden: false }));
export async function getPersonCategories() {
  return (await getMeta('personCategories')) || PERSON_CATEGORY_DEFAULTS.map(c => ({ ...c }));
}
export async function savePersonCategories(list) { await setMeta('personCategories', list); emit({ store: 'meta', type: 'personCategories' }); }

// ---------- people helpers ----------
export const PHONE_ROLES = [['person', 'Their phone'], ['shadchan', 'Shadchan'], ['unknown', 'Unknown'], ['mother', 'Mother'], ['father', 'Father'], ['reference', 'Reference'], ['other', 'Other']];
export const phoneRoleLabel = (r) => (PHONE_ROLES.find(x => x[0] === r) || PHONE_ROLES[2])[1];
// No plus signs in the app: an international prefix is written as 00.
export function cleanPhone(n) { const s = (n || '').trim(); return s.startsWith(String.fromCharCode(43)) ? '00' + s.slice(1) : s; }
export const phoneDigits = (p) => (p || '').replace(/\D/g, '').slice(-9);
export const personName = (p) => (p && p.name) || '(no name yet)';
export async function sourcesForPerson(personId) {
  return (await sources.byIndex('personId', personId)).sort((a, b) => (a.receivedAt || a.createdAt || '').localeCompare(b.receivedAt || b.createdAt || ''));
}
export async function unfiledSources() {
  return (await sources.list()).filter(s => !s.personId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
export async function interestsForPerson(personId) {
  return (await interests.byIndex('personId', personId)).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
export async function eventsForPerson(personId) {
  return (await events.byIndex('personIds', personId)).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

// ---------- small helpers pages share ----------
export function displayName(c) {
  return [c.title, c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name || '(no name)';
}
export function initials(c) {
  let parts = [c.firstName, c.lastName].filter(Boolean);
  if (!parts.length && c.name) parts = c.name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const s = parts.length ? parts.map(p => [...p][0]).join('') : '?';
  return s.toUpperCase();
}
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
