// Claude paste import (spec/build-handoff.md → Session handoff, steps 1–3).
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
import * as sh from './shidduch-data.js';
import * as sd from './sh-shidduch-data.js';

export const FORMAT_VERSION = 3;

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
Who: (whose answer this is: the name, or Me)
Answer: Yes, Thinking, No or Asked
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
3. Keep every name exactly as I typed it. Never invent a name, age, phone, city or date. If you are not sure, leave the line out and write the doubt under Unclear. Linking people from my note to each other is not inventing: see rule 10.
4. Kind is Guy or Girl only. If my note does not say, leave Kind out and say so under Unclear.
5. Phone: digits only, no spaces. For a country code write 00 at the start, never the plus sign.
6. About and Note: short, in my own words, in the language I wrote in.
7. Write the dates from today's date. If I wrote "next Tuesday", give the date and keep my words in brackets.
8. Start the code box with the line ZUGDESK ${FORMAT_VERSION} and end it with the line END.
9. Outside the code box you may write one short line, nothing more.
10. Connect what belongs together. If my note names one shadchan and one or more singles, that shadchan is the Shadchan of each of those singles, even when I only wrote "the shadchan" or "the shadchanit" without a name. When you link like this, add under Unclear: "assumed <shadchan> is <single>'s shadchan".
11. A promise to do something later ("she will send me the profile tomorrow") is a [To do] with its date.
12. In [Update], write Answer only when my note says someone answered.`;

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
  who: /^(who|whose|side|מי|צד)$/i,
  answer: /^(answer|reply|said|תשובה)$/i,
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

// "2026-11-17 14:00 (next Tuesday)" → { date: '2026-11-17', time: '14:00', words: 'next Tuesday' }.
// No ISO date → date stays empty; the owner picks one (nothing is guessed).
export function whenOf(v) {
  const s = (v || '').trim();
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T,]+(\d{1,2})[:.](\d{2}))?/);
  const words = ((s.match(/\(([^)]*)\)/) || [])[1] || '').trim();
  if (!m) return { date: '', time: '', words };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d) || d.getMonth() !== Number(m[2]) - 1) return { date: '', time: '', words };
  const two = (n) => String(n).padStart(2, '0');
  const time = m[4] != null && Number(m[4]) < 24 ? `${two(m[4])}:${m[5]}` : '';
  return { date: `${m[1]}-${two(m[2])}-${two(m[3])}`, time, words };
}

// ---------- step 3: Update / Date → an existing shidduch ----------
const ME = /^(me|i|myself|אני|עצמי)$/i;
let myName = '';
// Every shidduch of the open mode, in one shape: who is in it, its sides and what can be recorded now.
async function loadPairs() {
  if (isShadchan) {
    const { list } = await sd.loadAll();
    return list.map(m => ({ id: m.o.id, label: sd.coupleName(m), lane: sd.laneLabel(m.lane), open: sd.isOpen(m.cur.t),
      upcoming: m.round.upcoming ? m.round.n : 0, marksYes: sd.dateMarksYes(m), personIds: [m.o.guyId, m.o.girlId].filter(Boolean),
      sides: [['guy', `${sd.T.side.guy} (${sd.firstName(m, 'guy')})`, sd.fullName(m, 'guy')], ['girl', `${sd.T.side.girl} (${sd.firstName(m, 'girl')})`, sd.fullName(m, 'girl')]] }));
  }
  const { list, me } = await sh.loadAll();
  myName = norm(me?.name || '');
  return list.map(m => ({ id: m.o.id, label: sh.personName(m), lane: sh.laneLabel(m.lane), open: m.cur.t.phase !== 'ended',
    upcoming: 0, marksYes: false, personIds: [m.o.personId].filter(Boolean),
    sides: [['me', 'Me', ''], ['them', sh.personFirst(m), sh.personName(m)]] }));
}
// 2 = same name, 1 = every word typed is in the name ("Moshe" in "Moshe Klein"), 0 = not this one.
function nameMatch(given, full) {
  const a = norm(given), b = norm(full);
  if (!a || !b) return 0;
  if (a === b) return 2;
  const words = b.split(' ');
  return a.split(' ').every(w => words.includes(w)) ? 1 : 0;
}
const isMe = (name) => { const n = norm(name); return ME.test(n) || (!!myName && n === myName); };
// Shidduchim whose names fit the Pair line: those with every name first, best first. Nothing is guessed.
export function findPairs(pairs, names) {
  const given = (names || []).filter(n => !isMe(n));
  if (!given.length) return [];
  const out = [];
  for (const p of pairs) {
    const best = given.map(g => Math.max(0, ...p.sides.filter(s => s[2]).map(s => nameMatch(g, s[2]))));
    if (!best.some(Boolean)) continue;
    out.push({ ...p, full: best.every(Boolean), score: best.reduce((a, b) => a + b, 0) });
  }
  return out.sort((a, b) => (b.full - a.full) || (b.score - a.score) || (b.open - a.open)).slice(0, 4);
}
// "Who: Rivka" → the side of that shidduch ('me' | 'them' | 'guy' | 'girl'), or '' when unsure.
export function whoSide(who, cand) {
  const w = norm(who);
  if (!w) return '';
  if (cand.sides[0][0] === 'me' && isMe(w)) return 'me';
  if (cand.sides[0][0] === 'guy') {
    if (/^(his|he|him|guy|boy|bochur|bachur|הבחור|בחור|הוא)( side)?$/.test(w)) return 'guy';
    if (/^(her|she|girl|הבחורה|בחורה|היא)( side)?$/.test(w)) return 'girl';
  }
  const hits = cand.sides.filter(s => s[2] && nameMatch(w, s[2]));
  return hits.length === 1 ? hits[0][0] : '';
}
// Answer words → 'yes' | 'thinking' | 'no' | 'asked' | '' (Asked only exists in Shadchan Mode).
export function answerOf(v) {
  const s = norm(v);
  let a = '';
  if (/^(yes|כן|agreed|wants to go out|wants to meet)/.test(s)) a = 'yes';
  else if (/^(no|לא|not interested|declined)/.test(s)) a = 'no';
  else if (/^(thinking|maybe|considering|חושב|חושבת|אולי)/.test(s)) a = 'thinking';
  else if (/^(asked|נשאל|נשאלה)/.test(s)) a = 'asked';
  return a === 'asked' && !isShadchan ? '' : a;
}
const ANSWER_BTNS = () => (isShadchan ? [['asked', 'Asked'], ['thinking', 'Thinking'], ['yes', 'Yes'], ['no', 'No']] : [['yes', 'Yes'], ['thinking', 'Thinking'], ['no', 'No']]);

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
    } else if (it.type === 'todo') {
      const w = whenOf(f.when);
      const extra = Object.entries(f).filter(([k]) => !['text', 'when', 'pair'].includes(k)).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`);
      model.cards.push({ ...base, text: [f.text, ...extra].filter(Boolean).join('\n').trim(), due: w.date, time: w.time, whenWords: w.words,
        whenRaw: w.date ? '' : (f.when || '').trim(), pair: splitPair(f.pair), action: 'new' });
    } else {
      const lines = [];
      if (f.pair) lines.push(f.pair);
      if (f.who) lines.push('Who: ' + f.who);
      if (f.answer) lines.push('Answer: ' + f.answer);
      if (f.text) lines.push(f.text);
      if (f.when) lines.push('When: ' + f.when);
      if (f.where) lines.push('Where: ' + f.where);
      const rest = Object.entries(f).filter(([k]) => !['pair', 'text', 'when', 'where', 'who', 'answer'].includes(k)).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`);
      lines.push(...rest);
      const c = { ...base, pair: splitPair(f.pair), text: lines.join('\n'), action: 'new' };
      if (it.type === 'update' || it.type === 'date') {
        // Step 3: find the shidduch for the Pair; the owner confirms (or taps Only a note).
        model.pairs = model.pairs || await loadPairs();
        c.body = [f.text, ...rest].filter(Boolean).join('\n').trim();
        c.matches = findPairs(model.pairs, c.pair);
        const top = c.matches.filter(x => x.full);
        c.target = top.length === 1 || (top.length > 1 && top[0].score > top[1].score) ? top[0].id : '';
        if (it.type === 'update') {
          c.who = (f.who || '').trim(); c.answerRaw = (f.answer || '').trim(); c.answer = answerOf(c.answerRaw);
          const cand = c.matches.find(x => x.id === c.target);
          c.side = cand ? whoSide(c.who, cand) : '';
        } else {
          const w = whenOf(f.when);
          Object.assign(c, { due: w.date, time: w.time, whenWords: w.words, whenRaw: w.date ? '' : (f.when || '').trim(), where: (f.where || '').trim() });
        }
      }
      model.cards.push(c);
    }
  }
  // Only one shadchan in the whole paste: she is most likely the shadchan of its singles. Pre-filled; owner can Change.
  const onlySh = model.cards.filter(c => c.type === 'shadchan');
  if (onlySh.length === 1 && onlySh[0].name) {
    for (const s of model.cards.filter(c => c.type === 'single' && !c.shadchan)) { s.shadchan = onlySh[0].name; s.autoSh = true; }
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
// A shadchan card made only because a single named them is dropped once no single names them any more.
const orphan = (c, m) => c.fromSingle && !m.cards.some(s => s.type === 'single' && s.include && s.action !== 'skip' && norm(s.shadchan) === norm(c.name));
const shown = (m) => m.cards.filter(c => !orphan(c, m));
const counted = (m) => shown(m).filter(c => c.include && c.action !== 'skip');

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
    const vis = shown(m);
    vis.forEach((c, i) => body.append(cardEl(c, i, m, draw, relabel, vis.length)));
    body.append(h('p', { class: 'note' }, 'The whole paste is also kept as one note, linked to everyone in it.'));
    relabel();
    if (y != null && body.parentElement) body.parentElement.scrollTop = y;
  };
  draw();
  const p = sheet({ title: 'Add from paste', dataId: 'bulk', className: 'tall bulk-sheet', body,
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
      const at = (c) => c.matches?.find(x => x.id === c.target);
      const noSide = counted(m).find(c => c.type === 'update' && at(c)?.open && !at(c).upcoming && c.answer && !c.side);
      if (noSide) {
        toast('Choose whose answer it is, or tap No answer', 4000);
        body.querySelector(`[data-card="${m.cards.indexOf(noSide)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return false;
      }
      const noWhen = counted(m).find(c => c.type === 'date' && at(c)?.open && !(/^\d{4}-\d{2}-\d{2}$/.test(c.due || '') && c.time));
      if (noWhen) {
        toast('Choose the date and time, or tap Only a note', 4000);
        body.querySelector(`[data-card="${m.cards.indexOf(noWhen)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

function cardEl(c, i, m, draw, relabel, total) {
  const off = !c.include || c.action === 'skip';
  const sw = h('label', { class: 'toggle bulk-include', 'data-id': 'bulk.include' },
    h('span', { class: 'toggle-text' }, 'Include'),
    h('input', { type: 'checkbox', role: 'switch', checked: c.include || null, 'aria-label': 'Include this', onChange: (e) => { c.include = e.target.checked; draw(); } }));
  // "1 of 3 · Single · Moshe Klein": where each card starts is easy to see (owner request)
  const who = h('span', { class: 'bulk-who', dir: 'auto' }, c.name || '');
  const head = h('div', { class: 'bulk-head', 'data-id': 'bulk.card-head' },
    h('span', { class: 'bulk-title' },
      h('span', { class: 'bulk-num' }, `${i + 1} of ${total}`), ' · ',
      TYPE_LABEL[c.type] + (c.type === 'other' && c.title ? ' · ' + c.title : ''),
      c.name ? ' · ' : '', who),
    sw);
  c.whoEl = who;
  const tone = ['single', 'shadchan', 'todo'].includes(c.type) ? c.type : 'other';
  const wrap = h('article', { class: `bulk-card tone-${tone}` + (off ? ' off' : ''), 'data-card': String(m.cards.indexOf(c)), 'data-id': 'bulk.card-' + c.type }, head);
  if (!c.include) return wrap;
  if (c.type === 'single') {
    wrap.append(
      field('Name', c, 'name', 'bulk.name', () => { relabel(); if (c.whoEl) c.whoEl.textContent = c.name; }),
      h('div', { class: 'bulk-row' }, field('Age', c, 'age', 'bulk.age', null, { inputmode: 'numeric', class: 'input short' }), field('City', c, 'city', 'bulk.city')),
      field('Job', c, 'job', 'bulk.job'));
    if (c.action !== 'update' || !c.dup?.kind) wrap.append(h('div', { class: 'typepick bulk-kind' + (c.kind ? '' : ' need'), role: 'group', 'aria-label': 'Guy or girl', 'data-id': 'bulk.kind' },
      ...[['guy', 'Guy'], ['girl', 'Girl']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': c.kind === k ? 'true' : 'false', 'data-id': 'bulk.kind-' + k,
        onClick: () => { c.kind = k; draw(); } }, l))),
      ...(c.kind ? [] : [h('span', { class: 'note bulk-need' }, c.kindNote ? `Claude wrote “${c.kindNote}”. Choose one.` : 'Choose Guy or Girl')]));
    wrap.append(shadchanPick(c, m, draw));
    if (c.about) wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.about));
    if (c.dup) wrap.append(dupChoice(c, `Already have ${c.dup.name}${c.dup.age ? ', ' + c.dup.age : ''}${c.dup.city ? ' · ' + c.dup.city : ''}`, draw));
  } else if (c.type === 'shadchan') {
    wrap.append(field('Name', c, 'name', 'bulk.shadchan-name', () => { relabel(); if (c.whoEl) c.whoEl.textContent = c.name; }),
      h('div', { class: 'bulk-row' }, field('Phone', c, 'phone', 'bulk.phone', null, { inputmode: 'tel', dir: 'ltr' }), field('City', c, 'city', 'bulk.shadchan-city')));
    if (c.note) wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.note));
    if (c.fromSingle) wrap.append(h('p', { class: 'note' }, 'Named as a shadchan above.'));
    if (c.dup) wrap.append(dupChoice(c, `Already have ${store.displayName(c.dup)}${c.dup.phone ? ' · ' + c.dup.phone : ''}`, draw, true));
  } else if (c.type === 'todo') {
    wrap.append(field('What to do', c, 'text', 'bulk.todo-text', relabel),
      h('div', { class: 'bulk-row' },
        field('Date', c, 'due', 'bulk.todo-date', null, { type: 'date', dir: 'ltr' }),
        field('Time', c, 'time', 'bulk.todo-time', null, { type: 'time', dir: 'ltr', class: 'input bulk-time' })));
    if (c.whenWords) wrap.append(h('p', { class: 'note', dir: 'auto' }, `You wrote: “${c.whenWords}”`));
    if (c.whenRaw) wrap.append(h('p', { class: 'note bulk-need', dir: 'auto' }, `Claude wrote “${c.whenRaw}”. Choose the date, or leave it empty.`));
    wrap.append(h('p', { class: 'note' }, 'Saved as a Follow Up on Home' + (c.pair.length ? ', for ' + c.pair.join(' and ') : '') + '.'));
  } else if (c.matches) {
    const cand = c.matches.find(x => x.id === c.target);
    const said = cand ? c.body : c.text;
    if (said) wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, said));
    wrap.append(shidduchPick(c, draw));
    if (cand && c.type === 'update') wrap.append(...answerPick(c, cand, draw));
    if (cand && c.type === 'date') wrap.append(...datePick(c, cand));
    wrap.append(h('p', { class: 'note' }, cand ? 'Added to this shidduch’s History.'
      : 'Saved as a note' + (c.pair.length ? ', linked to ' + c.pair.join(' and ') : '') + '.'));
  } else {
    wrap.append(h('p', { class: 'bulk-text', dir: 'auto' }, c.text || '(empty)'),
      h('p', { class: 'note' }, 'Saved as a note' + (c.pair.length ? ', linked to ' + c.pair.join(' and ') : '') + '.'));
  }
  return wrap;
}

// The single's shadchan: what Claude wrote, or one tap on a suggestion (this paste first,
// then shadchanim added or changed lately). Works across days: ZugDesk remembers, Claude does not.
const RECENT_DAYS = 14;
function ago(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  return days <= 0 ? 'added today' : days === 1 ? 'added yesterday' : `added ${days} days ago`;
}
export function shadchanSuggestions(m, cur = '') {
  const out = [], seen = new Set([norm(cur)]);
  for (const c of m.cards) {
    if (c.type !== 'shadchan' || c.fromSingle || !c.include || !c.name.trim() || seen.has(norm(c.name))) continue;
    seen.add(norm(c.name)); out.push({ name: c.name.trim(), hint: 'in this paste' });
  }
  const since = Date.now() - RECENT_DAYS * 86400000;
  const recent = m.contacts.filter(x => (x.roles || []).includes('shadchan') && new Date(x.updatedAt || x.createdAt || 0).getTime() >= since)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  for (const x of recent) {
    const name = store.displayName(x);
    if (!name || seen.has(norm(name)) || out.length >= 4) continue;
    seen.add(norm(name)); out.push({ name, hint: ago(x.createdAt || x.updatedAt) });
  }
  return out;
}
function shadchanPick(c, m, draw) {
  const set = (name) => { c.shadchan = name; c.autoSh = false; c.openSh = false; draw(); };
  const box = h('div', { class: 'bulk-dup bulk-sh', 'data-id': 'bulk.single-shadchan' });
  if (c.shadchan && !c.openSh) {
    box.append(h('div', { class: 'bulk-sh-row' },
      h('span', { dir: 'auto' }, 'Shadchan: ', h('b', {}, c.shadchan), c.autoSh ? ' (only shadchan in this paste)' : ''),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'bulk.shadchan-change', onClick: () => { c.openSh = true; draw(); } }, 'Change')));
    return box;
  }
  const sugg = shadchanSuggestions(m, c.shadchan);
  box.append(h('p', {}, c.shadchan ? 'Shadchan: ' + c.shadchan : 'Who is the shadchan?'));
  if (sugg.length) box.append(h('div', { class: 'bulk-dup-btns' }, ...sugg.map(x =>
    pickBtn(`${x.name} · ${x.hint}`, false, 'bulk.shadchan-pick', () => set(x.name)))));
  else box.append(h('p', { class: 'note' }, 'No shadchan in this paste or added lately. You can link one later on the single’s card.'));
  box.append(h('div', { class: 'bulk-dup-btns' }, pickBtn('No shadchan', !c.shadchan, 'bulk.shadchan-none', () => set(''))));
  return box;
}

const pickBtn = (label, on, dataId, run) => h('button', { type: 'button', class: 'btn small' + (on ? ' primary' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-id': dataId, dir: 'auto', onClick: run }, label);

// "Is this the shidduch?" Every match is a button; Only a note keeps it out of the shidduch.
function shidduchPick(c, draw) {
  if (!c.matches.length) return h('p', { class: 'note bulk-need', dir: 'auto', 'data-id': 'bulk.shidduch-none-found' },
    c.pair.some(n => !isMe(n)) ? `No shidduch found for ${c.pair.filter(n => !isMe(n)).join(' and ')}.` : 'No names in the Pair line, so no shidduch was looked for.');
  return h('div', { class: 'bulk-dup', 'data-id': 'bulk.shidduch' },
    h('p', {}, c.matches.length === 1 ? 'Is this the shidduch?' : 'Which shidduch is this?'),
    h('div', { class: 'bulk-dup-btns' },
      ...c.matches.map(x => pickBtn(`${x.label} · ${x.lane}`, c.target === x.id, 'bulk.shidduch-pick', () => { c.target = x.id; if (c.type === 'update') c.side = whoSide(c.who, x); draw(); })),
      pickBtn('Only a note', !c.target, 'bulk.shidduch-note', () => { c.target = ''; draw(); })));
}

function answerPick(c, cand, draw) {
  if (!cand.open) return [h('p', { class: 'note' }, 'This shidduch has ended, so no answer is changed.')];
  if (cand.upcoming) return [h('p', { class: 'note' }, `Date ${cand.upcoming} is still ahead, so no answer can be recorded yet.`)];
  const out = [h('div', { class: 'bulk-dup', 'data-id': 'bulk.answer' },
    h('p', {}, 'Record an answer?'),
    h('div', { class: 'bulk-dup-btns', role: 'group', 'aria-label': 'Whose answer' },
      ...cand.sides.map(([k, l]) => pickBtn(l, c.side === k, 'bulk.answer-side-' + k, () => { c.side = k; draw(); }))),
    h('div', { class: 'bulk-dup-btns', role: 'group', 'aria-label': 'Answer' },
      ...ANSWER_BTNS().map(([k, l]) => pickBtn(l, c.answer === k, 'bulk.answer-' + k, () => { c.answer = k; draw(); })),
      pickBtn('No answer', !c.answer, 'bulk.answer-none', () => { c.answer = ''; draw(); })))];
  if (c.answerRaw && !answerOf(c.answerRaw)) out.push(h('p', { class: 'note bulk-need', dir: 'auto' }, `Claude wrote “${c.answerRaw}”. Choose one, or No answer.`));
  if (c.answer && !c.side) out.push(h('p', { class: 'note bulk-need' }, 'Choose whose answer it is.'));
  if (c.answer === 'no') out.push(h('p', { class: 'note bulk-need' }, 'No ends this shidduch.'));
  return out;
}

function datePick(c, cand) {
  if (!cand.open) return [h('p', { class: 'note' }, 'This shidduch has ended, so no date is added.')];
  const out = [h('div', { class: 'bulk-row' },
      field('Date', c, 'due', 'bulk.date-date', null, { type: 'date', dir: 'ltr' }),
      field('Time', c, 'time', 'bulk.date-time', null, { type: 'time', dir: 'ltr', class: 'input bulk-time' })),
    field('Where', c, 'where', 'bulk.date-where')];
  if (c.whenWords) out.push(h('p', { class: 'note', dir: 'auto' }, `You wrote: “${c.whenWords}”`));
  if (c.whenRaw) out.push(h('p', { class: 'note bulk-need', dir: 'auto' }, `Claude wrote “${c.whenRaw}”. Choose the date and time.`));
  out.push(h('p', { class: 'note' }, 'Saved as a new date: Arranged, or Happened if the time has passed.' + (cand.marksYes ? ' This marks both sides Yes.' : '')));
  return out;
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
  const made = { contacts: [], people: [], sources: [], notes: [], events: [], followUps: [] };
  const before = { contacts: [], people: [] }; // records changed, as they were
  const t = store.now();
  const take = (c) => c.include && c.action !== 'skip';
  // 1. shadchanim first, so singles can link to them by name
  const byName = new Map(); // norm(name) → contact
  for (const c of m.cards.filter(c => c.type === 'shadchan' && take(c) && !orphan(c, m))) {
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
  const contactFor = (name) => (name ? byName.get(norm(name)) || m.contacts.find(x => (x.roles || []).includes('shadchan') && norm(store.displayName(x)) === norm(name)) || null : null);
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
  // Names a card is about: its Pair line, else full names found in its text (this paste first, then saved people / contacts).
  const known = [...personByName.keys(), ...byName.keys(),
    ...[...allPeople.map(x => norm(x.name)), ...m.contacts.map(x => norm(store.displayName(x)))].filter(n => n.includes(' '))].filter(Boolean);
  const linksOf = (c) => {
    const pIds = [], cIds = [];
    const t = ' ' + norm(c.text) + ' ';
    const names = c.pair.length ? c.pair : [...new Set(known)].filter(n => t.includes(' ' + n + ' '));
    for (const n of names) { const l = findLink(n); if (l?.personId) pIds.push(l.personId); if (l?.contactId) cIds.push(l.contactId); }
    return { pIds: [...new Set(pIds)], cIds: [...new Set(cIds)] };
  };
  const allC = new Set([...byName.values()].map(x => x.id)), allP = new Set([...personByName.values()].map(x => x.id));
  // 3a. To do: real Follow Ups (made after the whole-paste note, so they can point to it)
  const todos = m.cards.filter(c => c.type === 'todo' && take(c)).map(c => ({ c, ...linksOf(c) }));
  for (const x of todos) { x.pIds.forEach(id => allP.add(id)); x.cIds.forEach(id => allC.add(id)); }
  // 3b. Update / Date matched to a shidduch: its History, the answer, the new date (step 3)
  const shUndo = [], snapped = new Set();
  const D = isShadchan ? sd : sh;
  const loadSh = async (id) => (isShadchan ? sd.loadOne(id) : (await sh.loadOne(id)).m);
  for (const c of m.cards.filter(c => c.matches && c.target && take(c))) {
    const cand = c.matches.find(x => x.id === c.target);
    let mm = await loadSh(c.target);
    if (!mm) { c.target = ''; continue; } // gone meanwhile: becomes a note below
    if (!snapped.has(c.target)) { snapped.add(c.target); shUndo.push(await D.snapshot(mm)); }
    cand.personIds.forEach(id => allP.add(id));
    if (c.body) { await D.addNote(mm, 'From Claude: ' + noPlus(c.body)); mm = await loadSh(c.target); }
    const open = isShadchan ? sd.isOpen(mm.cur.t) : mm.cur.t.phase !== 'ended';
    if (c.type === 'update' && open && c.answer && c.side) {
      if (c.answer === 'no') await D.endTry(mm, { endedBy: c.side, saidNo: true });
      else await D.setAnswer(mm, c.side, isShadchan ? c.answer : c.answer[0].toUpperCase() + c.answer.slice(1));
    }
    if (c.type === 'date' && open && c.due && c.time) {
      const when = `${c.due}T${c.time}`;
      const status = new Date(when).getTime() <= Date.now() ? 'Happened' : 'Arranged';
      await D.saveDate(mm, null, { when, where: (c.where || '').trim(), status, feedback: '' });
    }
  }
  // 3c. Update / Date with no shidduch, and anything else: notes linked to the names
  for (const c of m.cards.filter(c => !['single', 'shadchan', 'todo'].includes(c.type) && !(c.matches && c.target) && take(c))) {
    const { pIds, cIds } = linksOf(c);
    pIds.forEach(id => allP.add(id)); cIds.forEach(id => allC.add(id));
    const title = `${TYPE_LABEL[c.type]}${c.pair.length ? ': ' + c.pair.join(' and ') : ': ' + (c.text.split('\n')[0] || '').slice(0, 40)}`;
    const { note, entry } = await createNote({ title, text: c.text, contactIds: [...new Set(cIds)], personIds: [...new Set(pIds)] });
    made.notes.push(note.id); made.events.push(entry.id);
  }
  // 4. the whole paste as one note, linked to everyone in it
  const { note, entry } = await createNote({ title: 'From Claude · ' + store.formatDate(t), text, contactIds: [...allC], personIds: [...allP] });
  made.notes.push(note.id); made.events.push(entry.id);
  for (const { c, pIds, cIds } of todos) {
    let text = c.text.trim() || 'Follow up';
    if (c.time && !text.includes(c.time)) text += ' · at ' + c.time;
    const fu = await store.followUps.save({ noteId: note.id, contactId: cIds[0] || null, personId: pIds[0] || null, kind: 'task',
      text, dueAt: /^\d{4}-\d{2}-\d{2}$/.test(c.due || '') ? c.due : null, done: false, importBatch: batch });
    made.followUps.push(fu.id);
  }
  return { batch, made, before, shUndo, count: counted(m).length };
}

export async function undo({ made, before, shUndo = [] }) {
  for (const u of [...shUndo].reverse()) await u();
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

// Home → "Paste". A ZugDesk block opens the Add sheet; any other text goes to onPlain (the New Note box).
// Falls back to the notepad when the clipboard is blocked.
export async function pasteFromClaude({ fallback, onSaved, onUndone, onPlain } = {}) {
  let text = '';
  try { text = await navigator.clipboard.readText(); }
  catch {
    toast('Long-press in the New Note box and choose Paste.', 5000);
    fallback && fallback();
    return false;
  }
  if (!text.trim()) { toast('Nothing copied yet. Copy something first, then tap Paste.', 4500); return false; }
  if (!hasBlock(text)) { if (onPlain) { onPlain(text); return false; } toast('Nothing to add in what was copied.', 4000); return false; }
  return openImport(text, { onSaved, onUndone });
}
