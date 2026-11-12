// The single shared data store. Pages read and write ONLY through this module.
// Records: plain objects with { id, createdAt, updatedAt, demo? }.
// `demo: true` marks fictional seed records so Settings can remove them
// without touching anything the owner typed.
//
// Two modes, two databases (js/mode.js, js/db.js). Everything below works on the database of
// the mode the app is in; only backup, import and reset touch both.
import { SINGLE_DB, SHADCHAN_DB } from './db.js';
import { isShadchan } from './mode.js';
import { makeDemoContacts, makeDemoActivity, makeDemoPeople, makeDemoShidduchim, makeDemoNotes, makeDemoProfile } from './seed.js';

const DB = isShadchan ? SHADCHAN_DB : SINGLE_DB;
const { idb } = DB;
export const SCHEMA_VERSION = DB.version;
export const APP_VERSION = '0.9.0';
export const STAGE = isShadchan ? 'S1' : 8; // last finished stage of this mode (shown in Settings → About)

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(change) { for (const fn of listeners) { try { fn(change); } catch (e) { console.error(e); } } }

export function newId(prefix = 'r') {
  const rnd = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
  return `${prefix}_${rnd}`;
}
export const now = () => new Date().toISOString();

// ---------- Recently deleted (Shadchan Mode only) ----------
// There, remove() does not erase: the record gets `deletedAt` and waits KEEP_DELETED_DAYS in
// Settings → Recently deleted. list / get / byIndex / count never return such records, so pages
// need no changes. Single Mode erases at once, as before.
export const SOFT_DELETE = isShadchan;
export const KEEP_DELETED_DAYS = 30;
const alive = (r) => !!r && !r.deletedAt;
let openBatch = null;
// Everything removed inside `fn` counts as ONE deletion: one line in Recently deleted, one Restore.
// Use it wherever deleting one thing also deletes its parts (a person with their originals …).
export async function asOne(fn) {
  if (openBatch) return fn();
  openBatch = newId('del');
  try { return await fn(); } finally { openBatch = null; }
}
// Take one link off a record that stays (e.g. a conversation that also belongs to someone else).
// `field` holds one id or a list of ids. In Shadchan Mode the link is remembered, so Restore re-links it.
export async function unlink(col, rec, field, id) {
  const next = { ...rec, [field]: Array.isArray(rec[field]) ? rec[field].filter(x => x !== id) : null };
  if (SOFT_DELETE && openBatch) {
    next.unlinked = [...(rec.unlinked || []), { field, id, batch: openBatch }];
    next.unlinkedIn = [...new Set([...(rec.unlinkedIn || []), openBatch])];
  }
  return col.save(next);
}

// ---------- generic record API ----------
function collection(store, prefix) {
  const soft = SOFT_DELETE;
  return {
    store,
    list: soft ? async () => (await idb.getAll(store)).filter(alive) : () => idb.getAll(store),
    get: soft ? async (id) => { const r = await idb.get(store, id); return alive(r) ? r : undefined; } : (id) => idb.get(store, id),
    byIndex: soft ? async (index, value) => (await idb.byIndex(store, index, value)).filter(alive) : (index, value) => idb.byIndex(store, index, value),
    count: soft ? async () => (await idb.count(store)) - (await idb.countIndex(store, 'deletedAt')) : () => idb.count(store),
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
    async remove(id) {
      if (soft) {
        const rec = await idb.get(store, id);
        if (alive(rec)) { const t = now(); await idb.put(store, { ...rec, deletedAt: t, deletedBatch: openBatch || newId('del'), updatedAt: t }); }
      } else await idb.delete(store, id);
      emit({ store, type: 'remove', id });
    },
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
  mode: 'single',            // 'single' | 'shadchan' — changed only through switchMode() in js/mode.js (it reloads the app)
  showLabels: false,
  theme: 'dark',             // 'light' | 'dark' | 'auto' (match phone) — dark is the default (owner choice)
  contactsLayout: 'a',       // phone view: a | rail | tabs | list | inbox (spec/contacts.md CT-13)
  contactsSort: 'recent',    // recent | oldest | name | city | language | community
  iAm: '',                  // My Profile: 'guy' | 'girl' — Ideas then shows only the other
  personKind: 'guy',         // Add Person: last chosen Guy / Girl
  shidduchimView: 'compact', // Shidduchim list: compact | expanded
  homeSuggestions: true,     // Home: Smart Suggestions dot (blue = on)
  profileLang: 'en',         // My Profile: language being viewed / edited
};
export function getPrefs() {
  let p;
  try { p = { ...PREF_DEFAULTS, ...(JSON.parse(localStorage.getItem(PREF_KEY) || '{}')) }; }
  catch { p = { ...PREF_DEFAULTS }; }
  if (p.contactsLayout === 'split') p.contactsLayout = 'a'; // the top/bottom split view was removed
  return p;
}
// One time: dark becomes the default on phones that already chose light (owner request).
try {
  const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  if (!raw.darkDefaultV1) { raw.theme = 'dark'; raw.darkDefaultV1 = true; delete raw.shellStyle; delete raw.navArrangement; delete raw.contactsSplit; localStorage.setItem(PREF_KEY, JSON.stringify(raw)); }
} catch {}
export function setPref(key, value) {
  const p = { ...getPrefs(), [key]: value };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
  emit({ store: 'prefs', type: 'pref', key, value });
  return p;
}

// ---------- meta ----------
async function getMeta(key) { const r = await idb.get('meta', key); return r ? r.value : undefined; }
async function setMeta(key, value) { await idb.put('meta', { id: key, value }); }

// ---------- init: a new phone starts empty; the demo is one button in Settings ----------
export const FULL_DEMO_SEED = 200;

export async function init() {
  if (!(await getMeta('seeded'))) await setMeta('seeded', { at: now(), count: 0 });
  if (isShadchan) { // Shadchan Mode has none of Single Mode's older demo steps
    await purgeExpired();
    await setMeta('schemaVersion', SCHEMA_VERSION);
    return;
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

// Settings → "Try the demo": 200 fictional contacts plus people, shidduchim, notes and an example profile.
export async function loadFullDemo() {
  if (isShadchan) return loadShadchanDemo();
  const added = await loadDemoContacts(FULL_DEMO_SEED);
  await loadDemoPeople(); await loadDemoShidduchim(); await loadDemoNotes(); await loadDemoProfile();
  emit({ store: '*', type: 'import', total: added });
  return added;
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

// Shadchan Mode's demo: 60 fictional singles (30 guys, 30 girls) with a few made-up contacts,
// originals, notes and follow-ups. Fixed ids, so loading twice adds nothing; a demo record the
// user deleted stays deleted. Returns how many singles were added.
export const SH_DEMO_SINGLES = 60;
export async function loadShadchanDemo() {
  const { makeShadchanDemo } = await import('./seed-shadchan.js');
  const d = makeShadchanDemo();
  let singles = 0;
  for (const [col, rows] of [[contacts, d.contacts], [people, d.people], [sources, d.sources], [events, d.events], [followUps, d.followUps], [notes, d.notes]]) {
    const have = new Set(await idb.keys(col.store));
    const fresh = rows.filter(r => !have.has(r.id));
    if (fresh.length) await col.saveMany(fresh);
    if (col === people) singles = fresh.length;
  }
  emit({ store: '*', type: 'import', total: singles });
  return singles;
}

// Removes every record flagged demo:true in every store. Owner-typed data stays.
// (Read straight from the database, so demo records waiting in Recently deleted go too.)
export async function removeDemoData() {
  let removed = 0;
  for (const col of ALL) {
    const all = await idb.getAll(col.store);
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

// ---------- Recently deleted: list, restore, erase ----------
// One entry per deletion: { batch, at, items: [{ store, rec }] }, newest first.
export async function listDeleted() {
  if (!SOFT_DELETE) return [];
  const groups = new Map();
  for (const col of ALL) {
    for (const rec of await idb.byIndex(col.store, 'deletedAt')) {
      const key = rec.deletedBatch || rec.id;
      const g = groups.get(key) || groups.set(key, { batch: key, at: rec.deletedAt, items: [] }).get(key);
      if (rec.deletedAt > g.at) g.at = rec.deletedAt;
      g.items.push({ store: col.store, rec });
    }
  }
  return [...groups.values()].sort((x, y) => y.at.localeCompare(x.at));
}
// Puts back everything one deletion removed, and re-links what it had unlinked.
export async function restoreDeleted(batch) {
  if (!SOFT_DELETE) return 0;
  let count = 0;
  for (const col of ALL) {
    const out = [];
    const rows = new Map();
    for (const r of await idb.byIndex(col.store, 'deletedAt')) if ((r.deletedBatch || r.id) === batch) rows.set(r.id, r);
    for (const r of await idb.byIndex(col.store, 'unlinkedIn', batch)) if (!rows.has(r.id)) rows.set(r.id, r);
    for (const r of rows.values()) {
      const next = { ...r, updatedAt: now() };
      if (r.deletedAt && (r.deletedBatch || r.id) === batch) { delete next.deletedAt; delete next.deletedBatch; count++; }
      for (const u of (r.unlinked || []).filter(u => u.batch === batch)) {
        if (Array.isArray(next[u.field])) { if (!next[u.field].includes(u.id)) next[u.field] = [...next[u.field], u.id]; }
        else if (next[u.field] == null) next[u.field] = u.id;
      }
      forgetUnlinks(next, new Set([batch]));
      out.push(next);
    }
    if (out.length) await idb.putMany(col.store, out);
  }
  emit({ store: '*', type: 'restore', count });
  return count;
}
function forgetUnlinks(rec, batches) {
  if (!rec.unlinked) return;
  rec.unlinked = rec.unlinked.filter(u => !batches.has(u.batch));
  rec.unlinkedIn = (rec.unlinkedIn || []).filter(b => !batches.has(b));
  if (!rec.unlinked.length) { delete rec.unlinked; delete rec.unlinkedIn; }
}
// Erases one deletion for good ("Delete forever").
export async function eraseDeleted(batch) {
  if (!SOFT_DELETE) return 0;
  let count = 0;
  for (const col of ALL) {
    const ids = (await idb.byIndex(col.store, 'deletedAt')).filter(r => (r.deletedBatch || r.id) === batch).map(r => r.id);
    if (ids.length) { await idb.deleteMany(col.store, ids); count += ids.length; }
    const marked = await idb.byIndex(col.store, 'unlinkedIn', batch);
    if (marked.length) { marked.forEach(r => forgetUnlinks(r, new Set([batch]))); await idb.putMany(col.store, marked); }
  }
  emit({ store: '*', type: 'erase', count });
  return count;
}
// Runs when the app opens: erases what has waited longer than KEEP_DELETED_DAYS.
export async function purgeExpired() {
  if (!SOFT_DELETE) return 0;
  const cutoff = new Date(Date.now() - KEEP_DELETED_DAYS * 86400000).toISOString();
  let count = 0;
  for (const col of ALL) {
    const ids = await idb.keysByIndex(col.store, 'deletedAt', IDBKeyRange.upperBound(cutoff));
    if (ids.length) { await idb.deleteMany(col.store, ids); count += ids.length; }
  }
  return count;
}

// ---------- keeping the data: permanent storage and the last backup ----------
// Browsers may clear a site's storage when the device runs low on space, unless the site asked
// to keep it. 'kept' | 'not-kept' | 'unsupported'.
export async function storageState() {
  if (!navigator.storage || !navigator.storage.persisted) return 'unsupported';
  try { return (await navigator.storage.persisted()) ? 'kept' : 'not-kept'; } catch { return 'unsupported'; }
}
export async function askToKeepStorage() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}
const BACKUP_KEY = 'zugdesk.lastBackupAt';
export function lastBackupAt() { try { return localStorage.getItem(BACKUP_KEY) || null; } catch { return null; } }
export function noteBackupMade() { try { localStorage.setItem(BACKUP_KEY, now()); } catch {} emit({ store: 'prefs', type: 'backup' }); }

// ---------- export / import / reset (one file holds both modes) ----------
async function dump(db) {
  const data = {};
  for (const name of Object.keys(db.stores)) data[name] = await db.idb.getAll(name);
  return data;
}
// `data` is Single Mode (same place as before Shadchan Mode existed, so old backups still load);
// `shadchan.data` is Shadchan Mode.
export async function exportAll() {
  return {
    app: 'ZugDesk', appVersion: APP_VERSION, schemaVersion: SINGLE_DB.version,
    exportedAt: now(), prefs: getPrefs(), data: await dump(SINGLE_DB),
    shadchan: { schemaVersion: SHADCHAN_DB.version, data: await dump(SHADCHAN_DB) },
  };
}

export function validateBackup(json) {
  if (!json || typeof json !== 'object') return 'Not a JSON object';
  if (json.app !== 'ZugDesk') return 'This file is not a ZugDesk backup';
  if (typeof json.schemaVersion !== 'number') return 'Backup has no schema version';
  if (json.schemaVersion > SINGLE_DB.version) return `Backup is from a newer app (schema ${json.schemaVersion}); update the app first`;
  if (!json.data || typeof json.data !== 'object') return 'Backup has no data section';
  if (json.shadchan != null) {
    if (typeof json.shadchan !== 'object' || !json.shadchan.data || typeof json.shadchan.data !== 'object') return 'Backup has a broken Shadchan Mode section';
    if (json.shadchan.schemaVersion > SHADCHAN_DB.version) return `Backup is from a newer app (Shadchan schema ${json.shadchan.schemaVersion}); update the app first`;
  }
  return null;
}
export const backupRows = (json) => [json.data, json.shadchan && json.shadchan.data].filter(Boolean)
  .reduce((n, d) => n + Object.values(d).reduce((m, a) => m + (Array.isArray(a) ? a.length : 0), 0), 0);

async function loadInto(db, data, mode) {
  const names = Object.keys(db.stores);
  let total = 0;
  await db.tx(names, 'readwrite', (s) => {
    for (const name of names) {
      if (mode === 'replace') s[name].clear();
      const rows = Array.isArray(data[name]) ? data[name] : [];
      for (const r of rows) { if (r && r.id) { s[name].put(r); total++; } }
    }
    s.meta.put({ id: 'seeded', value: { at: now(), imported: true } });
    s.meta.put({ id: 'schemaVersion', value: db.version });
  });
  return total;
}

// mode 'replace' wipes current records first; 'merge' keeps current records and
// overwrites same-id records with the backup's copy.
// A backup made before Shadchan Mode has no Shadchan part: Shadchan Mode records are then left alone.
export async function importAll(json, mode = 'replace') {
  const err = validateBackup(json);
  if (err) throw new Error(err);
  let total = await loadInto(SINGLE_DB, json.data, mode);
  if (json.shadchan) total += await loadInto(SHADCHAN_DB, json.shadchan.data, mode);
  if (json.prefs && typeof json.prefs === 'object') {
    // The mode is this device's own choice; a backup never switches it.
    for (const [k, v] of Object.entries(json.prefs)) if (k in PREF_DEFAULTS && k !== 'mode') setPref(k, v);
  }
  emit({ store: '*', type: 'import', total });
  return total;
}

// Deletes both modes' records and the settings. The app stays in the mode it is in.
export async function resetAll({ reseed = true } = {}) {
  await SINGLE_DB.deleteDatabase();
  await SHADCHAN_DB.deleteDatabase();
  try {
    localStorage.removeItem(PREF_KEY); localStorage.removeItem(BACKUP_KEY);
    if (isShadchan) localStorage.setItem(PREF_KEY, JSON.stringify({ mode: 'shadchan', theme: 'dark', darkDefaultV1: true }));
  } catch {}
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
  languages: ['English', 'Hebrew', 'Russian', 'Yiddish'],
  // Shadchan Mode's contacts are everyone who is not a single (spec/shadchan/design.md 6.5).
  roles: isShadchan ? ['parent', 'shadchan', 'reference', 'rav', 'other'] : ['shadchan', 'reference', 'friend', 'family', 'helper'],
};
export const CHOICE_NAMES = { ages: 'Ages they work with', communities: 'Religious groups', languages: 'Languages', roles: 'Roles' };
// Add Person lists (spec/add-person.md AP-06 / AP-10). Same storage, own keys.
export const PERSON_CHOICE_DEFAULTS = {
  pStatus: ['Never been married', 'Divorced', 'Has children'],
  pReligious: ['Kohen', 'Prays 3× daily', 'Baal Teshuvah', 'Kosher for Kohen'],
  pLevel: ['Strong', 'Moderate', 'Light'],
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
