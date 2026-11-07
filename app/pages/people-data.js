// People & Ideas — shared pieces for Add Person (Stage 3) and the person card (Stage 4):
// labels, pronouns, the bubble lists each category holds, simple extraction from a
// pasted profile, and "Manage categories & choices". Data always goes through store.js.
import * as store from '../js/store.js';
import { h, toast, sheet, promptText, confirmDialog } from '../js/ui.js';

export const KINDS = [['guy', 'Guy'], ['girl', 'Girl']];
export const kindLabel = (k) => (KINDS.find(x => x[0] === k) || [, ''])[1];
export function pron(p) {
  if (p?.kind === 'guy') return { he: 'he', his: 'his', him: 'him', He: 'He', His: 'His' };
  if (p?.kind === 'girl') return { he: 'she', his: 'her', him: 'her', He: 'She', His: 'Her' };
  return { he: 'they', his: 'their', him: 'them', He: 'They', His: 'Their' };
}

// Bubble lists. type: rows = oval yes-rows (empty = not recorded), multi, single.
export const LISTS = {
  languages: { name: 'Languages spoken', type: 'multi' },
  pStatus: { name: 'Status', type: 'rows' },
  pLevel: { name: 'Religious Level', type: 'single' },
  pTzniut: { name: 'Tzniut', type: 'single' },
  pBackground: { name: 'Religious Background', type: 'multi' },
  pReligious: { name: 'Religious characteristics', type: 'rows' },
  pTraits: { name: 'Traits', type: 'multi' },
  pBody: { name: 'Body Type', type: 'single' },
};
// Which lists each built-in category shows, in order.
export const CATEGORY_LISTS = {
  personal: ['languages'], status: ['pStatus'], religious: ['pLevel', 'pTzniut', 'pBackground', 'pReligious'], lifestyle: ['pTraits', 'pBody'],
};
export const GIRLS_ONLY = { pReligious: ['Kosher for Kohen'] }; // spec AP-06: Girls only for now
export const KNOW_CONTACT = ['Never spoke', 'Talked by phone', 'Met in person'];
export const KNOW_FLAGS = ['Know personally', 'Would recommend'];
export const EXCLUSIVE = { pStatus: [['Never been married', 'Divorced']] };

export function listName(key, cats) {
  if (LISTS[key]) return LISTS[key].name;
  for (const c of cats || []) {
    if (c.key === key) return c.name;
    for (const s of c.subs || []) if (s.key === key) return `${c.name} · ${s.name}`;
  }
  return key;
}
export const listType = (key) => (LISTS[key] ? LISTS[key].type : 'multi');

// Every list key a category shows (built-in lists, or a custom category's own list + subcategories).
export function listsOf(cat) {
  if (cat.builtin) return CATEGORY_LISTS[cat.key] || [];
  return [cat.key, ...(cat.subs || []).map(s => s.key)];
}

// ---------- extraction (a suggestion, never proof) ----------
// Only labelled lines are read ("Name: …", "Age: …"). Missing or unclear values stay empty.
const PHONE_RE = /(?:\+\d[\d\s().-]{7,}\d|\(\d{3}\)\s?\d{3}-\d{4}|\b0\d[\d\s().-]{6,}\d)/g;
export function extract(raw) {
  const out = { cards: [] };
  if (!raw || !raw.trim()) return out;
  const lines = raw.split(/\r?\n/);
  const rules = {
    name: /^(?:name|שם|имя)\s*[:：-]\s*(.+)/i,
    age: /^(?:age|גיל|возраст)\s*[:：-]\s*(\d{1,3})\b/i,
    city: /^(?:city|location|lives in|עיר|город)\s*[:：-]\s*(.+)/i,
    occupation: /^(?:occupation|profession|work|job|מקצוע|עיסוק|профессия)\s*[:：-]\s*(.+)/i,
    about: /^(?:about|about me|על עצמי|о себе)\s*[:：-]\s*(.+)/i,
    looking: /^(?:looking for|מחפש|מחפשת|ищет)\s*[:：-]\s*(.+)/i,
    maxAge: /^(?:up to age|maximum age|max age|עד גיל)\s*[:：-]\s*(\d{1,3})\b/i,
  };
  for (const [k, re] of Object.entries(rules)) {
    const m = lines.map(l => l.trim().match(re)).find(Boolean);
    if (m) out[k] = m[1].trim();
  }
  const langs = lines.find(l => /^\s*(?:languages|שפות|языки)\s*[:：-]/i.test(l));
  if (langs) out.languages = langs.replace(/^[^:：-]+[:：-]/, '').split(/,|\/|;/).map(a => a.trim()).filter(Boolean);
  const shLine = lines.find(l => /^\s*(?:shadchan|shadchanit|matchmaker|שדכן|שדכנית)\s*[:：-]/i.test(l));
  if (shLine) out.shadchanName = shLine.replace(/^[^:：-]+[:：-]\s*/, '').replace(PHONE_RE, '').replace(/[,;]\s*$/, '').trim();

  const seen = new Set();
  for (const line of lines) {
    for (const m of line.matchAll(PHONE_RE)) {
      const number = store.cleanPhone(m[0].trim());
      const digits = number.replace(/\D/g, '');
      if (digits.length < 8 || seen.has(digits)) continue;
      seen.add(digits);
      const before = line.slice(0, m.index).toLowerCase();
      let role = 'unknown', name = '';
      if (/shadchan|matchmaker|שדכן|שדכנית/i.test(before)) { role = 'shadchan'; name = out.shadchanName || ''; }
      else if (/own phone|direct phone|his phone|her phone|their phone|טלפון אישי/i.test(before)) { role = 'person'; name = out.name || ''; }
      else if (/\bmother\b|\bmom\b|אמא/i.test(before)) role = 'mother';
      else if (/\bfather\b|\bdad\b|אבא/i.test(before)) role = 'father';
      else if (/\breference\b|\bref\b|ממליץ/i.test(before)) role = 'reference';
      if (['mother', 'father', 'reference'].includes(role)) {
        name = line.slice(0, m.index).replace(/^\s*[^:：]+[:：]\s*/, '').replace(/[^\p{L}\s.'-]/gu, '').trim();
      }
      out.cards.push({ role, name, number });
    }
  }
  if (out.shadchanName && !out.cards.some(c => c.role === 'shadchan')) out.cards.push({ role: 'shadchan', name: out.shadchanName, number: '' });
  // named references without a number ("Reference: Rabbi Adler")
  for (const line of lines) {
    const m = line.match(/^\s*(?:reference|ref|ממליץ)\s*[:：-]\s*([^\d]+)$/i);
    if (m && !out.cards.some(c => c.name === m[1].trim())) out.cards.push({ role: 'reference', name: m[1].trim(), number: '' });
  }
  return out;
}

// ---------- Manage categories & choices (Add Person) ----------
// Hide = off the form, easy to restore. Delete = removed from your list (asks first).
// Neither one changes anything already saved on people.
export async function managePersonForm() {
  let cats = JSON.parse(JSON.stringify(await store.getPersonCategories()));
  const choices = JSON.parse(JSON.stringify(await store.getChoices()));
  const body = h('div', { class: 'manage-body' });
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; draw(); };
  const row = (dataId, label, hidden, { up, down, toggle, del }) => h('div', { class: 'manage-row', 'data-id': dataId },
    h('span', { dir: 'auto', class: hidden ? 'muted' : '' }, label, hidden ? ' (hidden)' : ''),
    up ? h('button', { type: 'button', class: 'linkish', 'aria-label': 'Move up', onClick: up }, 'Up') : null,
    down ? h('button', { type: 'button', class: 'linkish', 'aria-label': 'Move down', onClick: down }, 'Down') : null,
    h('button', { type: 'button', class: 'linkish', onClick: toggle }, hidden ? 'Show' : 'Hide'),
    h('button', { type: 'button', class: 'linkish danger-text', onClick: del }, 'Delete'));

  function draw() {
    body.innerHTML = '';
    body.append(h('p', { class: 'note' }, 'Hide takes something off the form and keeps it ready to show again. Delete removes it from your list. Neither one changes what is already saved on people.'),
      h('h3', { class: 'eyebrow' }, 'Categories · form order'));
    cats.forEach((c, i) => body.append(row('manage-person.category', c.name, c.hidden, {
      up: i > 0 ? () => move(cats, i, -1) : null,
      down: i < cats.length - 1 ? () => move(cats, i, 1) : null,
      toggle: () => { c.hidden = !c.hidden; draw(); },
      del: async () => {
        if (!(await confirmDialog({ title: `Delete “${c.name}”?`, text: 'It disappears from the Add Person form. Answers already saved on people stay on them. Built-in categories come back with Restore defaults.', ok: 'Delete', danger: true, dataId: 'manage-person.delete-dialog' }))) return;
        cats.splice(i, 1); draw();
      } })));
    body.append(h('p', { class: 'note' }, 'Attached items always stay at the end.'));
    for (const c of cats) for (const key of listsOf(c)) {
      if (!choices[key]) choices[key] = [];
      body.append(h('h3', { class: 'eyebrow' }, listName(key, cats)));
      if (!choices[key].length) body.append(h('p', { class: 'note' }, 'No choices.'));
      choices[key].forEach((o, i) => body.append(row('manage-person.choice', o.v, o.hidden, {
        up: i > 0 ? () => move(choices[key], i, -1) : null,
        toggle: () => { o.hidden = !o.hidden; draw(); },
        del: async () => {
          if (!(await confirmDialog({ title: `Delete “${o.v}”?`, text: 'It disappears from the choices. People who already have it keep it.', ok: 'Delete', danger: true, dataId: 'manage-person.delete-dialog' }))) return;
          choices[key].splice(i, 1); draw();
        } })));
      body.append(h('button', { type: 'button', class: 'btn small', 'data-id': 'manage-person.add-choice', onClick: async () => {
        const name = await promptText({ title: `Add to ${listName(key, cats)}`, label: 'Name', dataId: 'manage-person.add-dialog' });
        if (name && !choices[key].some(o => o.v.toLowerCase() === name.toLowerCase())) { choices[key].push({ v: name, hidden: false }); draw(); }
      } }, 'Add choice'));
    }
  }
  draw();
  const res = await sheet({ title: 'Manage categories & choices', dataId: 'manage-person', className: 'tall', body,
    actions: [
      { id: 'reset', label: 'Restore defaults', run: async () => {
        if (!(await confirmDialog({ title: 'Restore defaults?', text: 'Brings back every built-in category and choice in the original order. Your own categories and choices stay.', ok: 'Restore', dataId: 'manage-person.reset-dialog' }))) return false;
        const custom = cats.filter(c => !c.builtin);
        cats = [...store.PERSON_CATEGORY_DEFAULTS.map(c => ({ ...c })), ...custom];
        for (const [k, defs] of Object.entries(store.PERSON_CHOICE_DEFAULTS)) {
          const extra = (choices[k] || []).filter(o => !defs.some(d => d.toLowerCase() === o.v.toLowerCase()));
          choices[k] = [...defs.map(v => ({ v, hidden: false })), ...extra];
        }
        draw(); return false;
      } },
      { id: 'save', label: 'Save', primary: true }] });
  if (res !== 'save') return false;
  await store.savePersonCategories(cats);
  await store.saveChoices(choices);
  toast('Saved — the form uses the new order');
  return true;
}

// Add a choice to a list from the form's three dots; returns the stored spelling.
export async function addChoice(key, value) {
  const choices = await store.getChoices();
  const list = choices[key] || (choices[key] = []);
  let o = list.find(x => x.v.toLowerCase() === value.toLowerCase());
  if (!o) list.push(o = { v: value, hidden: false }); else o.hidden = false;
  await store.saveChoices(choices);
  return o.v;
}

// Read every record that belongs to one person (one shared record, many views).
export async function loadPerson(id) {
  const p = await store.people.get(id);
  if (!p) return null;
  const [srcs, atts, ints, evs, fus, offers, tries, contacts] = await Promise.all([
    store.sourcesForPerson(id), store.attachments.byIndex('personId', id), store.interestsForPerson(id),
    store.eventsForPerson(id), store.followUps.byIndex('personId', id), store.offers.byIndex('personId', id),
    store.tries.byIndex('personId', id), store.contacts.list(),
  ]);
  return { p, srcs, atts, ints, evs, fus, offers, tries, contactsById: new Map(contacts.map(c => [c.id, c])) };
}

export const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
