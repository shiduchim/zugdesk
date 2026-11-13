// Notes: one Note record (title, colour, pin, links) + its dated entries.
// Each entry is a conversation record (store.events with noteId), so the same words show in
// Home, in every linked contact's and person's history, and in My Profile → Notes (me: true).
// Nothing is copied: editing an entry anywhere edits the one record.
import * as store from '../js/store.js';
import { h, toast, sheet, promptText } from '../js/ui.js';

export const COLORS = [['plain', 'Default'], ['blue', 'Blue'], ['yellow', 'Yellow'], ['peach', 'Peach'], ['green', 'Green'], ['lilac', 'Lilac']];
export const colorLabel = (c) => (COLORS.find(x => x[0] === c) || COLORS[0])[1];

// ---------- reading ----------
export async function loadNotes() {
  const [notes, events, contacts, people, followUps] = await Promise.all([
    store.notes.list(), store.events.list(), store.contacts.list(), store.people.list(), store.followUps.list()]);
  const entries = new Map();
  for (const e of events) if (e.noteId) (entries.get(e.noteId) || entries.set(e.noteId, []).get(e.noteId)).push(e);
  for (const l of entries.values()) l.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  const contactsById = new Map(contacts.map(c => [c.id, c])), peopleById = new Map(people.map(p => [p.id, p]));
  const lastAt = (n) => { const l = entries.get(n.id); return (l && l.length ? l[l.length - 1].at : '') || n.updatedAt || ''; };
  notes.sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  return { notes, entries, events, contacts, people, followUps, contactsById, peopleById, lastAt };
}

// Names a note is linked to, as { label, href } (shortcuts into the same records).
export function linksOf(n, D) {
  const out = [];
  if (n.me) out.push({ label: 'Me', href: '#/profile' });
  for (const id of n.contactIds || []) { const c = D.contactsById.get(id); if (c) out.push({ label: store.displayName(c), href: `#/contacts/${encodeURIComponent(id)}` }); }
  for (const id of n.personIds || []) { const p = D.peopleById.get(id); if (p) out.push({ label: store.personName(p), href: `#/people/${encodeURIComponent(id)}/notes` }); }
  return out;
}

// ---------- writing ----------
const titleFrom = (text) => (text.trim().split('\n')[0] || '').slice(0, 60).trim() || 'Untitled note';

export async function createNote({ title = '', text, color = 'plain', pinned = false, contactIds = [], personIds = [], me = false, demo = false }) {
  const at = store.now();
  const note = await store.notes.save({ title: title.trim() || titleFrom(text), color, pinned, contactIds, personIds, me, ...(demo ? { demo } : {}) });
  const entry = await store.events.save({ noteId: note.id, type: 'note', contactIds, personIds, text: text.trim(), at });
  return { note, entry };
}

// A dated update never overwrites earlier entries.
export async function appendEntry(note, text, { contactIds, personIds } = {}) {
  let n = note;
  const cIds = [...new Set([...(note.contactIds || []), ...(contactIds || [])])];
  const pIds = [...new Set([...(note.personIds || []), ...(personIds || [])])];
  if (cIds.length !== (note.contactIds || []).length || pIds.length !== (note.personIds || []).length) n = await setLinks(note, cIds, pIds, { quiet: false });
  const entry = await store.events.save({ noteId: n.id, type: 'note', contactIds: n.contactIds, personIds: n.personIds, text: text.trim(), at: store.now() });
  n = await store.notes.save({ ...n });
  return { note: n, entry };
}

// Links belong to the note; every entry carries them so each linked history shows the words.
export async function setLinks(note, contactIds, personIds, { quiet = false } = {}) {
  const before = new Set([...(note.contactIds || []), ...(note.personIds || [])]);
  const n = await store.notes.save({ ...note, contactIds, personIds });
  for (const e of await store.events.list()) if (e.noteId === note.id) await store.events.save({ ...e, contactIds, personIds });
  const added = [...contactIds, ...personIds].filter(id => !before.has(id));
  if (!quiet && added.length) {
    const names = await namesFor(contactIds.filter(id => !before.has(id)), personIds.filter(id => !before.has(id)));
    await store.logActivity({ what: 'Linked to a note', text: `${n.title}: ${names.join(', ')}`, noteId: n.id, contactIds, personIds });
  }
  return n;
}

export async function setColor(note, color) {
  const n = await store.notes.save({ ...note, color });
  await store.logActivity({ what: 'Changed note colour', text: `${n.title} · ${colorLabel(color)}`, noteId: n.id });
  return n;
}

export async function togglePin(note) { return store.notes.save({ ...note, pinned: !note.pinned }); }

export function deleteNote(note) {
  return store.asOne(async () => {
    for (const e of await store.events.list()) if (e.noteId === note.id) await store.events.remove(e.id);
    for (const f of await store.followUps.list()) if (f.noteId === note.id) await store.unlink(store.followUps, f, 'noteId', note.id);
    await store.notes.remove(note.id);
  });
}

// Delete many notes at once (Home → "Delete all notes"). Same rules as one note.
export async function deleteNotes(notes) {
  // Shadchan Mode: one by one, so each note is its own line in Recently deleted.
  if (store.SOFT_DELETE) { for (const n of notes) await deleteNote(n); return; }
  const ids = new Set(notes.map(n => n.id));
  for (const e of await store.events.list()) if (ids.has(e.noteId)) await store.events.remove(e.id);
  for (const f of await store.followUps.list()) if (ids.has(f.noteId)) await store.followUps.save({ ...f, noteId: null });
  for (const id of ids) await store.notes.remove(id);
}

async function namesFor(contactIds, personIds) {
  const out = [];
  for (const id of contactIds) { const c = await store.contacts.get(id); if (c) out.push(store.displayName(c)); }
  for (const id of personIds) { const p = await store.people.get(id); if (p) out.push(store.personName(p)); }
  return out;
}

const TITLES = ['mr', 'mrs', 'ms', 'miss', 'rabbi', 'rebbetzin', 'dr', 'reb', 'harav'];
// Minimal new contact: only the name the owner typed. No phone or details are invented.
export async function createMinimalContact(name) {
  const parts = name.trim().split(/\s+/);
  let title = '';
  if (parts.length > 1 && TITLES.includes(parts[0].toLowerCase().replace(/\./g, ''))) title = parts.shift();
  const c = await store.contacts.save({ title, firstName: parts.shift() || '', lastName: parts.join(' '), roles: [], languages: [], communities: [], pinned: false, folderId: null });
  await store.logActivity({ what: 'New contact', text: store.displayName(c) + ' · created from a note, name only', contactIds: [c.id], href: `#/contacts/${encodeURIComponent(c.id)}` });
  return c;
}

// ---------- anchored dropdown (Actions / Link Contact) ----------
let openMenuEl = null, openMenuAnchor = null, outside = null;
export function closeMenu() {
  if (openMenuEl) { openMenuEl.remove(); openMenuAnchor?.setAttribute('aria-expanded', 'false'); }
  openMenuEl = null; openMenuAnchor = null;
  if (outside) { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', outside, true); outside = null; }
}
export function isMenuOpenFor(anchor) { return openMenuAnchor === anchor; }
export function openMenu(anchor, dataId, build) {
  if (openMenuAnchor === anchor) { closeMenu(); return null; }
  closeMenu();
  const panel = h('div', { class: 'qmenu', role: 'menu', 'data-id': dataId });
  build(panel);
  document.body.append(panel);
  openMenuEl = panel; openMenuAnchor = anchor; anchor.setAttribute('aria-expanded', 'true');
  place(panel, anchor);
  outside = (e) => {
    if (e.type === 'keydown') { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } return; }
    if (!panel.contains(e.target) && !anchor.contains(e.target)) closeMenu();
  };
  setTimeout(() => { if (!outside) return; document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', outside, true); }, 0);
  return panel;
}
function place(panel, anchor) {
  const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const w = panel.offsetWidth, ph = panel.offsetHeight;
  const left = Math.max(8, Math.min(r.left, vw - w - 8));
  let top = r.bottom + 6;
  if (top + ph > vh - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
  panel.style.left = left + 'px'; panel.style.top = Math.max(8, Math.min(top, vh - ph - 8)) + 'px';
}
export function menuItem(label, sub, onClick, { tick = false, dataId, cls = '' } = {}) {
  return h('button', { type: 'button', class: 'qitem ' + cls, role: 'menuitem', 'data-id': dataId, onClick },
    h('span', { class: 'qlabel', dir: 'auto' }, label, sub ? h('span', { class: 'qsub' }, ' · ' + sub) : null),
    h('span', { class: 'qtick', 'aria-hidden': 'true' }, tick ? '✓' : ''));
}

// Link Contact picker: search, tick several, create new. `sel` = { contactIds, personIds }.
// `suggest` = ids to list first (recognised in the text). Calls onChange(sel) on each tap.
export function linkMenu(anchor, dataId, D, sel, onChange, { suggest = [], allowCreate = true, createName = '', query = '' } = {}) {
  return openMenu(anchor, dataId, (panel) => {
    const all = [
      ...D.people.map(p => ({ kind: 'p', id: p.id, name: store.personName(p), sub: 'Suggested person', at: p.updatedAt || '' })),
      ...D.contacts.map(c => ({ kind: 'c', id: c.id, name: store.displayName(c), sub: (c.roles || [])[0] ? cap((c.roles || [])[0]) : 'Contact', at: c.updatedAt || '', pinned: c.pinned })),
    ];
    const isOn = (x) => (x.kind === 'c' ? sel.contactIds : sel.personIds).includes(x.id);
    const input = h('input', { class: 'input qsearch', type: 'search', placeholder: 'Find a contact or person…', 'aria-label': 'Find a contact or person', dir: 'auto', 'data-id': dataId + '.search', value: query });
    const list = h('div', { class: 'qlist' });
    const draw = () => {
      const q = norm(input.value);
      let rows;
      if (q) rows = all.filter(x => norm(x.name).includes(q)).slice(0, 40);
      else {
        const first = all.filter(x => isOn(x) || suggest.includes(x.id));
        const rest = all.filter(x => !first.includes(x)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.at || '').localeCompare(a.at || '')).slice(0, 25);
        rows = [...first, ...rest];
      }
      list.innerHTML = '';
      if (!rows.length) list.append(h('div', { class: 'qempty' }, 'No one by that name yet.'));
      for (const x of rows) list.append(menuItem(x.name, x.sub, () => {
        const key = x.kind === 'c' ? 'contactIds' : 'personIds';
        sel[key] = isOn(x) ? sel[key].filter(id => id !== x.id) : [...sel[key], x.id];
        onChange({ ...sel }); draw();
      }, { tick: isOn(x), dataId: dataId + '.row' }));
      if (!q) list.append(h('div', { class: 'qempty' }, `Showing ${rows.length} of ${all.length}. Type to find anyone.`));
    };
    input.addEventListener('input', draw);
    panel.append(h('div', { class: 'qtitle' }, 'Link people to note'), input, list);
    if (allowCreate) panel.append(h('div', { class: 'qdivider' }),
      menuItem('Create new contact…', '', async () => {
        closeMenu();
        const name = await promptText({ title: 'Create new contact', label: 'Name (only what you know — you can add details later)', value: input.value.trim() || createName, ok: 'Create', dataId: 'note.create-contact' });
        if (!name) return;
        const c = await createMinimalContact(name);
        sel.contactIds = [...sel.contactIds, c.id]; onChange({ ...sel });
        toast(`${store.displayName(c)} added to Contacts and linked`);
      }, { cls: 'qadd', dataId: dataId + '.create' }));
    draw();
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  });
}

// Choose an existing note (Add to an Existing Note). Resolves the note id or null.
export async function chooseNoteSheet(D, { only = null, title = 'Add to an existing note' } = {}) {
  const pool = only ? D.notes.filter(n => only.includes(n.id)) : D.notes;
  let pick = null, finish;
  const input = h('input', { class: 'input', type: 'search', placeholder: 'Find a note…', 'aria-label': 'Find a note', dir: 'auto', 'data-id': 'note-choose.search' });
  const list = h('div', { class: 'note-choose-list' });
  const draw = () => {
    const q = norm(input.value);
    list.innerHTML = '';
    const rows = pool.filter(n => !q || norm(n.title).includes(q) || (D.entries.get(n.id) || []).some(e => norm(e.text).includes(q))).slice(0, 40);
    if (!rows.length) list.append(h('p', { class: 'note' }, 'No matching notes.'));
    for (const n of rows) {
      const es = D.entries.get(n.id) || [];
      list.append(h('button', { type: 'button', class: 'note-choice tone-' + (n.color || 'plain'), 'data-id': 'note-choose.row', onClick: () => { pick = n.id; finish(); } },
        h('strong', { dir: 'auto' }, n.title),
        h('span', { class: 'note', dir: 'auto' }, (es[es.length - 1]?.text || '').slice(0, 90)),
        h('span', { class: 'stamp' }, `${store.formatDate(D.lastAt(n))} · ${es.length} dated ${es.length === 1 ? 'entry' : 'entries'}`)));
    }
  };
  input.addEventListener('input', draw); draw();
  const p = sheet({ title, dataId: 'note-choose', body: [only ? h('p', { class: 'note' }, 'More than one note matches. Pick the right one — nothing is merged by itself.') : null, input, list] });
  const dlg = document.querySelector('dialog[data-id="note-choose"]');
  finish = () => dlg && dlg.finish && dlg.finish('picked');
  await p;
  return pick;
}

export const norm = (s) => (s || '').toString().toLowerCase().replace(/[.’'`]/g, '').replace(/\s+/g, ' ').trim();
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
