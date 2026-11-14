// Claude paste import (spec/build-handoff.md → Session handoff, step 1).
// The owner writes call notes to a Claude Project "ZugDesk"; Claude answers with ONE block:
//   ZUGDESK 1 · [Single] · [Shadchan] · [To do] · [Update] · [Date] · Unclear: … · END
// This module finds that block in any pasted text, shows a preview (edit, include, duplicates),
// saves everything in one go and offers Undo. Nothing is guessed: unknown lines go to About / Note.
import * as store from '../js/store.js';
import { h, toast, sheet } from '../js/ui.js';
import { isShadchan } from '../js/mode.js';
import { seekingKind, findPersonDup, fillEmpty } from './people-data.js';
import { findContactDuplicate } from './contacts-data.js';
import { createNote } from './notes-data.js';

export const FORMAT_VERSION = 1;

// The text the owner pastes into the Claude Project's instructions (Settings → Claude instructions).
// Change FORMAT_VERSION whenever this text changes, so old pastes say "your Claude text is old".
export const CLAUDE_INSTRUCTIONS = `You help me keep shidduch notes for my app ZugDesk.
I write you notes about phone calls and messages. Answer with ONE block in a code box, exactly in this format, and nothing else inside the code box.

ZUGDESK ${FORMAT_VERSION}
[Single]
Name:
Kind: Guy or Girl
Age:
City:
Job:
Shadchan: (the name of the shadchan who suggested or handles this single)
About:
[Shadchan]
Name:
Phone:
City:
Note:
[To do]
Text:
When: YYYY-MM-DD HH:MM (then my original words in brackets)
[Update]
Pair: (first name and last name of both, joined with "and")
Text:
[Date]
Pair:
When: YYYY-MM-DD HH:MM (then my original words in brackets)
Where:
Unclear: (anything you are not sure about)
END

Rules:
1. Repeat a section for every single, shadchan, to do, update or date in my note. Leave out sections and lines you have nothing for.
2. One field per line: the label, a colon, then the value. Never put two fields on one line and never use the | sign.
3. Keep every name exactly as I typed it. Never invent a name, age, phone, city or date. If you are not sure, leave the line out and write the doubt under Unclear.
4. Kind is Guy or Girl only. If my note does not say, leave Kind out and say so under Unclear.
5. Phone: digits only, no spaces. For a country code write 00 at the start, never the plus sign.
6. About and Note: short, in my own words, in the language I wrote in.
7. Write the dates from today's date. If I wrote "next Tuesday", give the date and keep my words in brackets.
8. Start the code box with the line ZUGDESK ${FORMAT_VERSION} and end it with the line END.
9. Outside the code box you may write one short line, nothing more.`;

// ---------- reading the block ----------
const SECTIONS = {
  single: /^(single|person|guy|girl|בחור|בחורה|רווק|רווקה|מועמד|מועמדת)$/i,
  shadchan: /^(shadchan|shadchanit|matchmaker|שדכן|שדכנית)$/i,
  todo: /^(to ?do|todo|task|follow ?up|משימה|לעשות|מעקב)$/i,
  update: /^(update|news|עדכון)$/i,
  date: /^(date|meeting|פגישה|דייט)$/i,
};
const LABELS = {
  name: /^(name|full name|שם|имя)$/i,
  kind: /^(kind|gender|guy or girl|type|מין|סוג|בן או בת)$/i,
  age: /^(age|גיל|возраст)$/i,
  city: /^(city|location|lives in|עיר|מקום מגורים|город)$/i,
  job: /^(job|occupation|profession|work|מקצוע|עיסוק|עבודה|профессия)$/i,
  shadchan: /^(shadchan|shadchanit|matchmaker|שדכן|שדכנית)$/i,
  about: /^(about|about me|info|details|על|עליו|עליה|פרטים|о себе)$/i,
  phone: /^(phone|tel|telephone|mobile|cell|טלפון|נייד|פלאפון)$/i,
  note: /^(note|notes|comment|הערה|הערות)$/i,
  text: /^(text|what|טקסט|מה)$/i,
  when: /^(when|date|time|מתי|תאריך|שעה)$/i,
  where: /^(where|place|location of date|איפה|מקום)$/i,
  pair: /^(pair|couple|between|זוג|בין)$/i,
  unclear: /^(unclear|doubts?|not sure|לא ברור|ספק)$/i,
};
// Where an unknown label lands, per section (kept as "Label: value", never dropped).
const SPILL = { single: 'about', shadchan: 'note', todo: 'text', update: 'text', date: 'text', other: 'text' };

function cleanLine(raw) {
  return raw.replace(/[‎‏‪-‮⁦-⁩﻿]/g, '').replace(/[   ]/g, ' ')
    .replace(/：/g, ':').replace(/\*\*|__/g, '').replace(/^\s*(?:[-*•>]\s*)+/, '').trim();
}
const isFence = (l) => /^\s*(```|~~~)/.test(l);
const labelOf = (word) => Object.keys(LABELS).find(k => LABELS[k].test(word.trim())) || null;
const sectionOf = (line) => {
  const m = line.match(/^\[\s*(.+?)\s*\]$/) || line.match(/^#{1,4}\s*(.+?)\s*:?$/);
  if (!m) return null;
  return Object.keys(SECTIONS).find(k => SECTIONS[k].test(m[1])) || 'other';
};

// Finds "ZUGDESK n" anywhere in the text. Returns null when there is no block.
export function parseBlock(text) {
  if (!text) return null;
  const rawLines = String(text).split(/\r?\n/);
  let start = -1, version = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const m = cleanLine(rawLines[i]).match(/\bZUGDESK\s*(\d+)\b/i);
    if (m) { start = i; version = Number(m[1]); break; }
  }
  if (start < 0) return null;
  const items = [], unclear = [];
  let cur = null, field = null, ended = false;
  for (let i = start + 1; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (isFence(raw)) break;
    const line = cleanLine(raw);
    if (/^END\.?$/i.test(line)) { ended = true; break; }
    if (!line) { if (cur) cur.raw.push(''); continue; }
    const sec = sectionOf(line);
    if (sec) { cur = { type: sec, title: line.replace(/^[[#\s]+|[\]:\s]+$/g, ''), f: {}, raw: [raw.trim()] }; items.push(cur); field = null; continue; }
    const colon = line.indexOf(':');
    const key = colon > 0 && colon < 40 ? labelOf(line.slice(0, colon)) : null;
    const value = colon > 0 ? line.slice(colon + 1).trim() : line;
    if (key === 'unclear') { if (value) unclear.push(value); field = 'unclear'; continue; }
    if (field === 'unclear' || !cur) { unclear.push(line); continue; } // more doubts, or loose words before any section
    cur.raw.push(raw.trim());
    if (key) {
      field = key;
      cur.f[key] = cur.f[key] ? cur.f[key] + '\n' + value : value;
    } else if (colon > 0 && colon < 40) {
      const spill = SPILL[cur.type];
      field = spill;
      cur.f[spill] = [cur.f[spill], line].filter(Boolean).join('\n');
    } else if (field) {
      cur.f[field] = [cur.f[field], line].filter(Boolean).join('\n');
    } else {
      const spill = SPILL[cur.type];
      cur.f[spill] = [cur.f[spill], line].filter(Boolean).join('\n');
    }
  }
  for (const it of items) { while (it.raw.length && !it.raw.at(-1)) it.raw.pop(); }
  return { version, items: items.filter(it => Object.keys(it.f).length), unclear, ended };
}
// How many things a block adds before any are switched off (the Home chip uses it).
export function countThings(parsed) {
  if (!parsed) return 0;
  const shadchanim = new Set(parsed.items.filter(i => i.type === 'shadchan').map(i => norm(i.f.name)));
  const extra = new Set(parsed.items.filter(i => i.type === 'single' && i.f.shadchan && !shadchanim.has(norm(i.f.shadchan))).map(i => norm(i.f.shadchan)));
  return parsed.items.length + extra.size;
}
export const hasBlock = (text) => /\bZUGDESK\s*\d+\b/i.test(text || '');

// ---------- turning the block into preview items ----------
const norm = (s) => (s || '').toLowerCase().replace(/^(mrs?|ms|rabbi|rebbetzin|reb|dr|harav)\.?\s+/i, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function kindOf(v) {
  const s = (v || '').trim().toLowerCase();
  const end = '(?=$|[^\\p{L}])';
  if (new RegExp('^(girl|woman|female|maidel|בחורה|בת|נקבה)' + end, 'u').test(s)) return 'girl';
  if (new RegExp('^(guy|boy|man|male|bochur|bachur|בחור|בן|זכר)' + end, 'u').test(s)) return 'guy';
  return '';
}
// Digits only; a leading plus becomes 00 (no plus signs in the app).
export function phoneOf(v) {
  const s = (v || '').trim();
  if (!s) return '';
  const lead = /^\s*(\+|00)/.test(s) ? '00' : '';
  const d = s.replace(/\D/g, '');
  return lead && !d.startsWith('00') ? lead + d.replace(/^00/, '') : d;
}
const ageOf = (v) => ((v || '').match(/\d{1,3}/) || [''])[0];
const splitPair = (v) => (v || '').split(/\s+and\s+|\s+ו(?=\S)|\s*[&/,]\s*|\s+-\s+|\s+with\s+|\s+עם\s+/i).map(s => s.trim()).filter(Boolean);

async function buildModel(parsed) {
  const [people, contacts] = await Promise.all([store.people.list(), store.contacts.list()]);
  const prefs = store.getPrefs();
  const defaultKind = seekingKind(prefs);
  const model = { version: parsed.version, unclear: parsed.unclear, people, contacts, cards: [] };
  for (const it of parsed.items) {
    const f = it.f;
    const base = { include: true, type: it.type, title: it.title, raw: it.raw.join('\n') };
    if (it.type === 'single') {
      const c = { ...base, name: (f.name || '').trim(), kind: kindOf(f.kind) || defaultKind, age: ageOf(f.age), city: (f.city || '').trim(),
        job: (f.job || '').trim(), shadchan: (f.shadchan || '').trim(), about: (f.about || '').trim(),
        phone: phoneOf(f.phone), kindNote: f.kind && !kindOf(f.kind) ? f.kind : '' };
      if (f.phone) c.about = [c.about, 'Phone: ' + c.phone].filter(Boolean).join('\n');
      if (f.note) c.about = [c.about, f.note].filter(Boolean).join('\n');
      c.dup = findPersonDup(people, { name: c.name });
      c.action = c.dup ? 'update' : 'new';
      model.cards.push(c);
    } else if (it.type === 'shadchan') {
      const c = { ...base, name: (f.name || '').trim(), phone: phoneOf(f.phone), city: (f.city || '').trim(),
        note: [f.note, f.about, f.text].filter(Boolean).join('\n').trim() };
      c.dup = findContactDuplicate(contacts, { name: c.name, phone: c.phone });
      c.action = c.dup ? 'update' : 'new';
      model.cards.push(c);
    } else {
      const lines = [];
      if (f.pair) lines.push(f.pair);
      if (f.text) lines.push(f.text);
      if (f.when) lines.push('When: ' + f.when);
      if (f.where) lines.push('Where: ' + f.where);
      for (const [k, v] of Object.entries(f)) if (!['pair', 'text', 'when', 'where'].includes(k)) lines.push(`${k[0].toUpperCase() + k.slice(1)}: ${v}`);
      model.cards.push({ ...base, pair: splitPair(f.pair), text: lines.join('\n'), action: 'new' });
    }
  }
  // A shadchan named on a single but not given a section of their own: one card per name.
  for (const s of model.cards.filter(c => c.type === 'single' && c.shadchan)) {
    if (model.cards.some(c => c.type === 'shadchan' && norm(c.name) === norm(s.shadchan))) continue;
    const dup = findContactDuplicate(contacts, { name: s.shadchan, phone: '' });
    model.cards.push({ include: true, type: 'shadchan', title: 'Shadchan', raw: '', name: s.shadchan, phone: '', city: '', note: '',
      fromSingle: true, dup, action: dup ? 'link' : 'new' });
  }
  return model;
}

// ---------- preview ----------
const TYPE_LABEL = { single: 'Single', shadchan: 'Shadchan', todo: 'To do', update: 'Update', date: 'Date', other: 'Other' };
const counted = (m) => m.cards.filter(c => c.include && c.action !== 'skip');

// Opens the preview for pasted text. Resolves true when something was saved.
export async function openImport(text, { onSaved, onUndone } = {}) {
  const parsed = parseBlock(text);
  if (!parsed) { toast('No ZugDesk block found. Copy Claude’s whole answer and try again.', 4500); return false; }
  if (!parsed.items.length) { toast('The ZugDesk block is empty. Ask Claude to fill it in.', 4500); return false; }
  const m = await buildModel(parsed);
  const body = h('div', { class: 'bulk-body', 'data-id': 'bulk.body' });
  let saveBtn = null;
  const relabel = () => {
    const n = counted(m).length;
    if (saveBtn) { saveBtn.textContent = n ? `Add ${n} thing${n === 1 ? '' : 's'}` : 'Nothing to add'; saveBtn.disabled = !n; }
  };
  const draw = () => {
    const y = body.parentElement?.scrollTop;
    body.innerHTML = '';
    if (m.version < FORMAT_VERSION) body.append(oldCallout());
    if (m.version > FORMAT_VERSION) body.append(h('div', { class: 'callout', 'data-id': 'bulk.newer' }, 'This block was made for a newer ZugDesk. Close and reopen the app to update it; what can be read is shown below.'));
    if (m.unclear.length) body.append(h('div', { class: 'callout bulk-unclear', 'data-id': 'bulk.unclear' },
      h('b', {}, 'Claude was not sure about:'), h('ul', {}, m.unclear.map(u => h('li', { dir: 'auto' }, u)))));
    m.cards.forEach((c, i) => body.append(cardEl(c, i, m, draw, relabel)));
    body.append(h('p', { class: 'note' }, 'The whole paste is also kept as one note, linked to everyone in it.'));
    relabel();
    if (y != null && body.parentElement) body.parentElement.scrollTop = y;
  };
  draw();
  const p = sheet({ title: 'Add from Claude', dataId: 'bulk', className: 'tall bulk-sheet', body,
    actions: [{ id: 'save', label: 'Add', primary: true, run: async () => {
      const missing = counted(m).find(c => c.type === 'single' && c.action === 'new' && !c.kind);
      if (missing) {
        toast(`Choose Guy or Girl for ${missing.name || 'the single'} first`, 4000);
        body.querySelector(`[data-card="${m.cards.indexOf(missing)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return false;
      }
      const noName = counted(m).find(c => (c.type === 'single' || c.type === 'shadchan') && c.action === 'new' && !c.name.trim());
      if (noName) {
        toast('Write a name first, or switch that card off', 4000);
        body.querySelector(`[data-card="${m.cards.indexOf(noName)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return false;
      }
      return 'save';
    } }] });
  saveBtn = document.querySelector('dialog[data-id="bulk"] [data-id="bulk.save"]');
  relabel();
  if (await p !== 'save') return false;
  const result = await saveAll(m, text);
  onSaved && onSaved(result);
  const msg = `Added ${result.count} thing${result.count === 1 ? '' : 's'} from Claude`;
  toast(msg, 8000, { label: 'Undo', run: async () => { await undo(result); toast('Undone — nothing from that paste is kept'); onUndone && onUndone(); } });
  if (m.version < FORMAT_VERSION) setTimeout(() => toast('Your Claude text is old, tap to copy the new one', 8000, { label: 'Copy', run: copyInstructions }), 8200);
  return true;
}

function oldCallout() {
  return h('div', { class: 'callout', 'data-id': 'bulk.old-version' }, 'Your Claude text is old. It still works, but the new one reads better. ',
    h('button', { type: 'button', class: 'linkish', 'data-id': 'bulk.copy-new', onClick: copyInstructions }, 'Copy the new text'));
}

function cardEl(c, i, m, draw, relabel) {
  const off = !c.include || c.action === 'skip';
  const sw = h('label', { class: 'toggle bulk-include', 'data-id': 'bulk.include' },
    h('span', { class: 'toggle-text' }, 'Include'),
    h('input', { type: 'checkbox', role: 'switch', checked: c.include || null, 'aria-label': 'Include this', onChange: (e) => { c.include = e.target.checked; draw(); } }));
  const head = h('div', { class: 'bulk-head' },
    h('span', { class: 'eyebrow' }, TYPE_LABEL[c.type] + (c.type === 'other' && c.title ? ' · ' + c.title : '')),
    h('span', { class: 'spacer' }), sw);
  const wrap = h('article', { class: 'bulk-card' + (off ? ' off' : ''), 'data-card': String(i), 'data-id': 'bulk.card-' + c.type }, head);
  if (!c.include) return wrap;
  if (c.type === 'single') {
    wrap.append(
      field('Name', c, 'name', 'bulk.name', relabel),
      h('div', { class: 'bulk-row' }, field('Age', c, 'age', 'bulk.age', null, { inputmode: 'numeric', class: 'input short' }), field('City', c, 'city', 'bulk.city')),
      field('Job', c, 'job', 'bulk.job'));
    if (c.action !== 'update' || !c.dup?.kind) wrap.append(h('div', { class: 'typepick bulk-kind' + (c.kind ? '' : ' need'), role: 'group', 'aria-label': 'Guy or girl', 'data-id': 'bulk.kind' },
      ...[['guy', 'Guy'], ['girl', 'Girl']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': c.kind === k ? 'true' : 'false', 'data-id': 'bulk.kind-' + k,
        onClick: () => { c.kind = k; draw(); } }, l))),
      c.kind ? null : h('span', { class: 'note bulk-need' }, c.kindNote ? `Claude wrote “${c.kindNote}”. Choose one.` : 'Choose Guy or Girl'));
    if (c.shadchan) wrap.append(h('p', { class: 'note', dir: 'auto' }, 'Shadchan: ' + c.shadchan));
    if (c.about) wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.about));
    if (c.dup) wrap.append(dupChoice(c, `Already have ${c.dup.name}${c.dup.age ? ', ' + c.dup.age : ''}${c.dup.city ? ' · ' + c.dup.city : ''}`, draw));
  } else if (c.type === 'shadchan') {
    wrap.append(field('Name', c, 'name', 'bulk.shadchan-name', relabel),
      h('div', { class: 'bulk-row' }, field('Phone', c, 'phone', 'bulk.phone', null, { inputmode: 'tel', dir: 'ltr' }), field('City', c, 'city', 'bulk.shadchan-city')));
    if (c.note) wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.note));
    if (c.fromSingle) wrap.append(h('p', { class: 'note' }, 'Named as a shadchan above.'));
    if (c.dup) wrap.append(dupChoice(c, `Already have ${store.displayName(c.dup)}${c.dup.phone ? ' · ' + c.dup.phone : ''}`, draw, true));
  } else {
    wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.text || '(empty)'),
      h('p', { class: 'note' }, 'Saved as a note for now' + (c.pair.length ? ', linked to ' + c.pair.join(' and ') : '') + '.'));
  }
  return wrap;
}

function field(label, c, k, dataId, onInput, extra = {}) {
  return h('label', { class: 'field bulk-field' }, h('span', { class: 'bulk-label' }, label),
    h('input', { class: 'input', dir: 'auto', value: c[k] || '', 'data-id': dataId, ...extra,
      onInput: (e) => { c[k] = e.target.value; onInput && onInput(); } }));
}

function dupChoice(c, text, draw, contact = false) {
  const opts = contact
    ? [[c.fromSingle ? 'link' : 'update', c.fromSingle ? 'Use this one' : 'Update (fill empty only)'], ['new', 'Save as new'], ['skip', 'Skip']]
    : [['update', 'Update (fill empty only)'], ['new', 'Save as new'], ['skip', 'Skip']];
  return h('div', { class: 'bulk-dup', 'data-id': 'bulk.duplicate' },
    h('p', { dir: 'auto' }, text),
    h('div', { class: 'bulk-dup-btns' }, opts.map(([v, l]) => h('button', { type: 'button', class: 'btn small' + (c.action === v ? ' primary' : ''),
      'aria-pressed': c.action === v ? 'true' : 'false', 'data-id': 'bulk.dup-' + v, onClick: () => { c.action = v; draw(); } }, l))));
}

// ---------- saving (one batch) and Undo ----------
const noPlus = (t) => (t || '').replace(/\+\s?(?=\d)/g, '00'); // owner rule: no plus signs, 00 for a country code
async function saveAll(m, text) {
  text = noPlus(text);
  const batch = store.newId('imp');
  const made = { contacts: [], people: [], sources: [], notes: [], events: [] };
  const before = { contacts: [], people: [] }; // records changed, as they were
  const t = store.now();
  const take = (c) => c.include && c.action !== 'skip';
  // 1. shadchanim first, so singles can link to them by name
  const byName = new Map(); // norm(name) → contact
  for (const c of m.cards.filter(c => c.type === 'shadchan' && take(c))) {
    let rec;
    if (c.dup && (c.action === 'update' || c.action === 'link')) {
      rec = c.dup;
      if (c.action === 'update') {
        const next = { ...rec };
        if (!next.phone && c.phone) next.phone = c.phone;
        if (!next.city && c.city) next.city = c.city.trim();
        if (c.note) next.about = next.about ? (next.about.includes(c.note) ? next.about : next.about + '\n' + c.note) : c.note;
        if (!(next.roles || []).includes('shadchan')) next.roles = [...(next.roles || []), 'shadchan'];
        if (JSON.stringify(next) !== JSON.stringify(rec)) { before.contacts.push(rec); rec = await store.contacts.save(next); }
      }
    } else {
      const full = c.name.trim().replace(/\s+/g, ' ');
      const parts = full.split(' ');
      let title = '';
      if (parts.length > 1 && /^(mrs?|ms|rabbi|rebbetzin|reb|dr|harav)\.?$/i.test(parts[0])) title = parts.shift();
      rec = await store.contacts.save({ name: full, title, firstName: parts[0] || '', lastName: parts.slice(1).join(' '), phone: c.phone, email: '',
        city: c.city.trim(), about: c.note, roles: ['shadchan'], languages: [], communities: [], status: 'none', pinned: false, folderId: null,
        source: 'Added from a Claude note', importBatch: batch });
      made.contacts.push(rec.id);
    }
    byName.set(norm(c.name), rec);
    if (c.dup) byName.set(norm(store.displayName(c.dup)), rec);
  }
  for (const c of m.cards) if (c.raw) c.raw = noPlus(c.raw);
  const contactFor = (name) => (name ? byName.get(norm(name)) || null : null);
  // 2. singles, each with its own block kept as an original
  const personByName = new Map();
  for (const c of m.cards.filter(c => c.type === 'single' && take(c))) {
    const sh = contactFor(c.shadchan);
    const cards = [];
    if (c.shadchan) cards.push({ id: store.newId('k'), role: 'shadchan', name: sh ? store.displayName(sh) : c.shadchan, number: sh?.phone || '', email: '', contactId: sh?.id || null });
    if (c.phone) cards.push({ id: store.newId('k'), role: 'person', name: c.name.trim(), number: c.phone, email: '', contactId: null });
    const rec = { name: c.name.trim().replace(/\s+/g, ' '), kind: c.kind, age: String(c.age || '').trim(), city: c.city.trim(), occupation: c.job.trim(),
      about: c.about, languages: [], looking: '', maxAge: '', know: [], answers: {}, contactCards: cards,
      sender: sh ? store.displayName(sh) : c.shadchan, senderContactId: sh?.id || null, contactIds: sh ? [sh.id] : [] };
    let saved;
    if (c.dup && c.action === 'update') {
      before.people.push(c.dup);
      const merged = fillEmpty(c.dup, rec, cards);
      if (c.about && c.dup.about && !c.dup.about.includes(c.about)) merged.about = c.dup.about + '\n\n' + c.about;
      saved = await store.people.save(merged);
    } else {
      saved = await store.people.save({ ...rec, importBatch: batch });
      made.people.push(saved.id);
    }
    personByName.set(norm(c.name), saved);
    if (c.raw) {
      const src = await store.sources.save({ personId: saved.id, text: c.raw, sender: rec.sender, senderContactId: rec.senderContactId, receivedAt: t, kind: saved.kind, importBatch: batch });
      made.sources.push(src.id);
    }
  }
  // names inside the block, then people already saved
  const allPeople = await store.people.list();
  const findLink = (name) => {
    const n = norm(name);
    const p = personByName.get(n) || allPeople.find(x => norm(x.name) === n);
    if (p) return { personId: p.id };
    const ct = byName.get(n) || m.contacts.find(x => norm(store.displayName(x)) === n || norm(x.name) === n);
    return ct ? { contactId: ct.id } : null;
  };
  // 3. To do / Update / Date / other: notes linked to the names (later steps make them real)
  const allC = new Set([...byName.values()].map(x => x.id)), allP = new Set([...personByName.values()].map(x => x.id));
  for (const c of m.cards.filter(c => !['single', 'shadchan'].includes(c.type) && take(c))) {
    const pIds = [], cIds = [];
    const names = c.pair.length ? c.pair : [...personByName.keys(), ...byName.keys()].filter(n => n && norm(c.text).includes(n));
    for (const n of names) { const l = findLink(n); if (l?.personId) pIds.push(l.personId); if (l?.contactId) cIds.push(l.contactId); }
    pIds.forEach(id => allP.add(id)); cIds.forEach(id => allC.add(id));
    const title = `${TYPE_LABEL[c.type]}${c.pair.length ? ': ' + c.pair.join(' and ') : ': ' + (c.text.split('\n')[0] || '').slice(0, 40)}`;
    const { note, entry } = await createNote({ title, text: c.text, contactIds: [...new Set(cIds)], personIds: [...new Set(pIds)] });
    made.notes.push(note.id); made.events.push(entry.id);
  }
  // 4. the whole paste as one note, linked to everyone in it
  const { note, entry } = await createNote({ title: 'From Claude · ' + store.formatDate(t), text, contactIds: [...allC], personIds: [...allP] });
  made.notes.push(note.id); made.events.push(entry.id);
  return { batch, made, before, count: counted(m).length };
}

export async function undo({ made, before }) {
  for (const [col, ids] of Object.entries(made)) await store.discard(store[col], ids);
  for (const rec of before.people) await store.people.save(rec);
  for (const rec of before.contacts) await store.contacts.save(rec);
}

// ---------- clipboard ----------
export async function copyInstructions() {
  try { await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS); toast('Copied. Paste it into the ZugDesk project’s instructions in Claude.', 4500); return true; }
  catch {
    const ta = h('textarea', { class: 'clip-helper', readonly: true }, CLAUDE_INSTRUCTIONS);
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    toast(ok ? 'Copied. Paste it into the ZugDesk project’s instructions in Claude.' : 'This browser blocked copying. Open “Show the text”, long-press it and choose Copy.', 5000);
    return ok;
  }
}

// Home → "Paste from Claude". Falls back to the notepad when the clipboard is blocked.
export async function pasteFromClaude({ fallback, onSaved, onUndone } = {}) {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch {
    toast('This browser blocked the clipboard. Long-press in New Note, choose Paste, then tap “Add … from this note”.', 6000);
    fallback && fallback();
    return false;
  }
  if (!text.trim()) { toast('The clipboard is empty. In Claude, tap Copy on the code box first.', 4500); return false; }
  if (!hasBlock(text)) { toast('No ZugDesk block in the clipboard. In Claude, tap Copy on the code box and try again.', 5000); return false; }
  return openImport(text, { onSaved, onUndone });
}
