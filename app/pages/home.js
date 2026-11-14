// Home — one page for writing and remembering (spec/home.md, source Home v8, Claude look).
// New Note on top; Existing Notes (Pinned / Other) and History on the left, Follow Ups on the
// right on a computer; one column on a phone: New Note → Notes → Follow Ups → History.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, confirmDialog, promptText, swipeTabs } from '../js/ui.js';
import * as N from './notes-data.js';
import { nameIndex, recognize, firstSentence, buildHistory, openFollowUps } from './home-data.js';
import { offerForPerson, setAnswer, endTry } from './shidduch-data.js';
import { recordInterest } from './idea-flow.js';
import { MODE, MODES, isShadchan, switchMode } from '../js/mode.js';
import * as CI from './claude-import.js';
// Shadchan Mode builds Home from blocks (pages/sh-home.js); Single Mode never loads it.
const SHH = isShadchan ? await import('./sh-home.js') : null;

const STAR = '<svg class="star" viewBox="230 215 533 605" width="12" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M 491 228 L 477 233 L 463 245 L 417 324 L 405 337 L 397 343 L 384 350 L 361 355 L 292 354 L 271 356 L 258 363 L 247 376 L 243 388 L 243 400 L 246 411 L 291 489 L 296 507 L 297 525 L 290 549 L 245 627 L 243 646 L 246 657 L 252 667 L 260 674 L 271 679 L 292 681 L 359 680 L 376 683 L 398 693 L 407 700 L 418 713 L 462 790 L 470 798 L 483 805 L 501 807 L 517 802 L 530 791 L 576 712 L 592 695 L 598 691 L 617 683 L 633 680 L 718 680 L 730 676 L 736 672 L 744 663 L 750 647 L 749 630 L 745 620 L 701 544 L 697 530 L 696 517 L 698 502 L 703 487 L 747 411 L 750 400 L 750 387 L 743 371 L 734 362 L 721 356 L 708 354 L 624 354 L 608 349 L 595 342 L 575 322 L 528 242 L 523 237 L 510 230 Z M 493 255 L 503 256 L 509 262 L 554 339 L 564 351 L 585 367 L 602 375 L 627 381 L 712 381 L 717 383 L 723 391 L 723 398 L 679 475 L 670 505 L 671 536 L 676 553 L 683 568 L 723 637 L 722 647 L 713 654 L 620 655 L 597 662 L 585 668 L 571 678 L 559 690 L 542 716 L 512 770 L 507 776 L 500 780 L 490 779 L 484 774 L 440 698 L 422 678 L 408 668 L 385 658 L 364 654 L 279 654 L 272 648 L 270 643 L 270 638 L 274 629 L 317 554 L 323 530 L 323 506 L 318 484 L 311 469 L 273 405 L 270 397 L 271 389 L 277 383 L 283 381 L 374 380 L 395 374 L 407 368 L 425 355 L 437 342 L 483 263 L 487 258 Z"/></svg>';
const FU_FIRST = 10, HIST_FIRST = 5, HIST_STEP = 50;
const DRAFT_KEY = 'zugdesk.homeDrafts';
const fine = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
const ico = (n) => h('span', { html: icon(n) }).firstChild;

let root = null, unsub = null, timer = 0, gen = 0;
let D = null, X = null, IX = null, SH = null;
let U = { expanded: null, fuAll: false, histN: HIST_FIRST, histOpen: new Set(), q: '' };
let drafts = {};
const els = {};

export function destroy() { if (root) swipeTabs(root, null); root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); N.closeMenu(); PHONE.removeEventListener('change', applySection); }

export async function render(container, params) {
  swipeTabs(container, { keys: () => PHONE.matches ? ['notes', 'followups', 'history'] : [], current: () => section, go: (k) => showSection(k) });
  root = container;
  root.classList.add('home-page', 'wide');
  if (SHH) root.classList.add('sh-home');
  U = { expanded: params.noteId || null, fuAll: false, histN: HIST_FIRST, histOpen: new Set(), q: '' };
  if (params.noteId) section = 'notes';
  try { drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { drafts = {}; }
  els.search = h('input', { class: 'input home-search', type: 'search', dir: 'auto', placeholder: 'Search…', 'aria-label': 'Search notes, people, conversations', 'data-id': 'home.search',
    onInput: (e) => { U.q = e.target.value; drawSearch(); } });
  els.results = h('section', { class: 'home-results hidden', 'data-id': 'home.search-results', 'aria-live': 'polite' });
  els.composer = h('div', { class: 'home-composer-slot' });
  els.notes = h('section', { class: 'home-notes', 'data-id': 'home.notes' });
  els.fus = h('section', { class: 'home-panel home-followups', 'data-id': 'home.followups' });
  els.hist = h('section', { class: 'home-panel home-history', 'data-id': 'home.history' });
  els.grid = SHH ? h('div', { class: 'shh-blocks', 'data-id': 'home.blocks' }) : h('div', { class: 'home-grid' }, els.notes, els.fus, els.hist);
  root.append(h('div', { class: 'home-wrap' },
    // Owner request, both modes: top row is search · tiny Single / Shadchan switch · gear;
    // the Notes / To Do List / History tabs sit underneath.
    h('div', { class: 'home-searchline', 'data-id': 'home.searchline' }, els.search, modeToggle(), settingsLink()),
    h('div', { class: 'home-tabline' }, tabRow()),
    els.results, els.composer, els.grid));
  PHONE.addEventListener('change', applySection);
  unsub = store.subscribe((ch) => {
    if (ch.store === 'prefs' && ch.key !== 'homeSuggestions' && !(SHH && (ch.key === 'shHomeBlocks' || ch.type === 'backup'))) return;
    if (ch.store === 'meta') return;
    clearTimeout(timer); timer = setTimeout(() => reload(), 120);
  });
  await reload(true);
}

async function reload(first = false) {
  const token = ++gen;
  const [d, stageEvents, offers, interests, activity, shares, sh] = await Promise.all([
    N.loadNotes(), store.stageEvents.list(), store.offers.list(), store.interests.list(), store.activity.list(), store.shares.list(), SHH ? SHH.load() : null]);
  if (token !== gen || !root) return;
  D = d; IX = nameIndex(D); SH = sh;
  X = { stageEvents, offersById: new Map(offers.map(o => [o.id, o])), interests, activity, shares };
  keepFocus(() => {
    if (first) drawComposer();
    drawNotes(); drawFollowUps(); drawHistory(); drawBlocks(); if (U.q) drawSearch();
    tabCounts(); applySection();
  });
  if (first && U.expanded) setTimeout(() => root?.querySelector(`[data-note="${CSS.escape(U.expanded)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
}

// Redrawing a list never loses what the owner is typing.
function keepFocus(fn) {
  const a = document.activeElement, key = a && a.dataset ? a.dataset.key : null;
  const s = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  fn();
  if (!key || !root) return;
  const n = root.querySelector(`textarea[data-key="${CSS.escape(key)}"]`);
  if (n && n !== a) { n.focus({ preventScroll: true }); if (s) try { n.setSelectionRange(s[0], s[1]); } catch {} }
}

// ---------- drafts ----------
function draft(key) {
  return drafts[key] || (drafts[key] = { title: '', text: '', color: 'plain', pinned: false, contactIds: [], personIds: [], followUp: null, waiting: false, answer: null, targetNoteId: null });
}
function persist() {
  const keep = {};
  for (const [k, d] of Object.entries(drafts)) if (d.text.trim() || d.title.trim() || k === 'new') keep[k] = d;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(keep)); } catch {}
}
const noteOf = (key) => (key.startsWith('note:') ? D.notes.find(n => n.id === key.slice(5)) || null : null);
const suggestionsOn = () => store.getPrefs().homeSuggestions !== false;

// ---------- the editor (New Note and inline "Add to note") ----------
function composer(key) {
  const d = draft(key), isNew = key === 'new', note = noteOf(key);
  const wrap = h('section', { class: `composer tone-${isNew ? d.color : note?.color || 'plain'}`, 'data-id': isNew ? 'home.new-note' : 'home.note-editor', 'data-key': key });
  const mirror = h('div', { class: 'ed-box ed-mirror', 'aria-hidden': 'true', dir: 'auto' });
  const ta = h('textarea', { class: 'ed-box ed-text', rows: isNew ? 4 : 3, dir: 'auto', spellcheck: 'true', 'data-key': key,
    'aria-label': isNew ? 'Write a new note' : 'Add dated text to this note', placeholder: isNew ? 'A call, a thought, a new idea… just write.' : 'Write an update…',
    'data-id': isNew ? 'home.new-note.text' : 'home.note-editor.text' });
  ta.value = d.text;
  const hints = h('div', { class: 'suggest-zone', 'data-id': isNew ? 'home.suggestions' : 'home.note-editor.suggestions' });
  const target = h('div', { class: 'ed-target' });
  const foot = h('div', { class: 'ed-foot' });
  const sync = () => {
    const a = recognize(d.text, IX, D);
    mirror.innerHTML = suggestionsOn() ? highlighted(d.text, a) : esc(d.text) + '\n';
    const writing = !!d.text.trim();
    wrap.classList.toggle('writing', writing);
    hints.innerHTML = '';
    if (writing && suggestionsOn()) hints.append(h('div', { class: 'suggest-head' }, h('span', { html: STAR }).firstChild, h('span', {}, 'Suggestions')), chips(key, a, sync));
    target.innerHTML = '';
    const t = isNew && d.targetNoteId ? D.notes.find(n => n.id === d.targetNoteId) : null;
    if (t) target.append(h('span', { dir: 'auto' }, `Will be added to “${t.title}” as a dated update. `),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'home.new-note.target-cancel', onClick: () => { d.targetNoteId = null; persist(); sync(); } }, 'Make it a new note instead'));
    // Claude paste import: a "ZUGDESK n" block pasted into New Note can be added in one go.
    const things = isNew && CI.hasBlock(d.text) ? CI.countThings(CI.parseBlock(d.text)) : 0;
    if (things) target.append(h('button', { type: 'button', class: 'btn small primary claude-chip', 'data-id': 'home.claude-chip',
      onClick: () => importFromNote() }, `Add ${things} thing${things === 1 ? '' : 's'} from this note`));
    drawFoot(key, foot, writing, sync);
  };
  ta.addEventListener('input', () => { d.text = ta.value; persist(); grow(ta); sync(); });
  if (isNew) {
    const pin = h('button', { type: 'button', class: 'pin-text', 'aria-pressed': d.pinned ? 'true' : 'false', 'data-id': 'home.new-note.pin',
      onClick: () => { d.pinned = !d.pinned; persist(); pin.textContent = d.pinned ? 'Unpin' : 'Pin'; pin.setAttribute('aria-pressed', d.pinned ? 'true' : 'false'); } }, d.pinned ? 'Unpin' : 'Pin');
    const on = suggestionsOn();
    const dot = h('button', { type: 'button', class: 'suggest-dot', 'aria-pressed': on ? 'true' : 'false', 'data-id': 'home.suggestions-dot',
      'aria-label': `Smart suggestions ${on ? 'on' : 'off'}. Tap to turn ${on ? 'off' : 'on'}.`, title: `Suggestions ${on ? 'on' : 'off'} · tap to switch`,
      onClick: () => { store.setPref('homeSuggestions', !suggestionsOn()); drawComposer(); toast(suggestionsOn() ? 'Suggestions on' : 'Suggestions off — saving still works the same'); } },
      h('span', { class: 'suggest-dot-core' }));
    const title = h('input', { class: 'ed-title', dir: 'auto', placeholder: 'Title (optional)', 'aria-label': 'Note title (optional)', value: d.title, 'data-id': 'home.new-note.title',
      onInput: (e) => { d.title = e.target.value; persist(); } });
    const fromClaude = h('button', { type: 'button', class: 'btn small mini', 'data-id': 'home.paste-claude', onClick: pasteClaude }, 'Paste from Claude');
    wrap.append(h('div', { class: 'ed-head' }, h('h2', {}, ico('edit'), 'New Note'), h('span', { class: 'spacer' }), pin, dot), h('div', { class: 'claude-row' }, fromClaude), title);
  }
  wrap.append(h('div', { class: 'ed-wrap' }, mirror, ta), target, hints, foot);
  sync();
  setTimeout(() => grow(ta), 0);
  return wrap;
}

// ---------- Claude paste import (pages/claude-import.js) ----------
function pasteClaude() {
  return CI.pasteFromClaude({ fallback: () => root?.querySelector('textarea[data-key="new"]')?.focus() });
}
// The pasted block becomes records; the New Note box is emptied, and Undo puts the words back.
async function importFromNote() {
  const d = draft('new'), kept = { text: d.text, title: d.title };
  await CI.openImport(d.text, {
    onSaved: () => { d.text = ''; d.title = ''; persist(); drawComposer(); },
    onUndone: () => { const n = draft('new'); if (!n.text.trim()) { n.text = kept.text; n.title = kept.title; persist(); drawComposer(); } },
  });
}

// The foot's buttons are made once per editor (so an open dropdown keeps its anchor);
// each keystroke only updates their labels.
function drawFoot(key, foot, writing, sync) {
  const d = draft(key), isNew = key === 'new';
  if (!foot.firstChild) {
    const p = isNew ? 'home.new-note.' : 'home.note-editor.';
    foot.actions = h('button', { type: 'button', class: 'btn small mini', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-id': p + 'actions', onClick: (e) => actionsMenu(e.currentTarget, key, sync) }, 'Actions');
    foot.link = h('button', { type: 'button', class: 'btn small mini', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-id': p + 'link', onClick: (e) => linkFor(e.currentTarget, key, sync) }, 'Link Contact');
    foot.fu = h('button', { type: 'button', class: 'btn small mini', 'data-id': p + 'follow-up', onClick: () => quickFollowUp(key, sync) }, 'Follow Up');
    foot.tools = h('div', { class: 'subtools' }, foot.actions, foot.link, foot.fu);
    foot.queued = h('div', { class: 'ed-queued note' });
    foot.append(foot.tools, foot.queued, h('button', { type: 'button', class: 'btn primary ed-save', 'data-id': p + 'save', onClick: () => save(key) }, isNew ? 'Save Note' : 'Save Update'));
  }
  const n = d.contactIds.length + d.personIds.length;
  foot.tools.classList.toggle('hidden', !writing);
  foot.link.textContent = 'Link Contact' + (n ? ' · ' + n : '');
  foot.fu.textContent = d.followUp ? '✓ Follow Up' : 'Follow Up';
  foot.fu.classList.toggle('on', !!d.followUp);
  foot.fu.setAttribute('aria-pressed', d.followUp ? 'true' : 'false');
  const q = writing ? queuedText(d) : '';
  foot.queued.textContent = q; foot.queued.classList.toggle('hidden', !q);
}
function queuedText(d) {
  const out = [];
  if (d.followUp) out.push(`Follow Up on save${d.followUp.due ? ' · ' + store.formatDate(d.followUp.due) : ' · no date'}`);
  if (d.waiting) out.push('Waiting item on save');
  if (d.answer) out.push(`Answer update approved: ${d.answer.name} → ${d.answer.value}`);
  return out.join(' · ');
}

function chips(key, a, sync) {
  const d = draft(key), isNew = key === 'new', note = noteOf(key);
  const list = [];
  const chip = (label, onClick, cls = '', dataId = 'home.suggestion') => h('button', { type: 'button', class: 'suggest-chip ' + cls, 'data-id': dataId, dir: 'auto', onClick }, label);
  const linkedHere = (m) => (m.kind === 'c' ? d.contactIds : d.personIds).includes(m.id) || (note && ((m.kind === 'c' ? note.contactIds : note.personIds) || []).includes(m.id));
  if (a.answer) {
    const p = D.peopleById.get(a.answer.personId), name = store.personName(p).split(/\s+/)[0];
    const on = d.answer && d.answer.personId === a.answer.personId;
    list.push(chip(on ? '✓ Answer update approved' : `Review ${name}’s answer → ${a.answer.value}`, () => reviewAnswer(key, a.answer, sync), on ? 'accepted' : 'status', 'home.suggestion-answer'));
  }
  const seen = new Set();
  for (const r of a.refs) {
    if (r.matches.length === 1) {
      const m = r.matches[0];
      if (seen.has(m.id) || (note && ((m.kind === 'c' ? note.contactIds : note.personIds) || []).includes(m.id))) continue;
      seen.add(m.id);
      const name = m.kind === 'c' ? store.displayName(D.contactsById.get(m.id)) : store.personName(D.peopleById.get(m.id));
      const on = (m.kind === 'c' ? d.contactIds : d.personIds).includes(m.id);
      list.push(chip(on ? `✓ Linked ${name}` : `Link ${name}`, () => {
        const k = m.kind === 'c' ? 'contactIds' : 'personIds';
        d[k] = on ? d[k].filter(x => x !== m.id) : [...d[k], m.id]; persist(); sync();
      }, on ? 'accepted' : '', 'home.suggestion-link'));
    } else if (!r.matches.some(linkedHere) && !seen.has('amb:' + N.norm(r.text))) {
      seen.add('amb:' + N.norm(r.text));
      list.push(chip(`Which ${r.text}? (${r.matches.length})`, (e) => linkFor(e.currentTarget, key, sync, r.text), '', 'home.suggestion-which'));
    }
  }
  if (isNew && !d.targetNoteId) {
    const ids = new Set(a.refs.filter(r => r.matches.length === 1).map(r => r.matches[0].id));
    const matches = D.notes.filter(n => [...(n.contactIds || []), ...(n.personIds || [])].some(id => ids.has(id)));
    if (matches.length === 1) list.push(chip(`Add dated update to “${matches[0].title}”`, () => { d.targetNoteId = matches[0].id; persist(); sync(); }, '', 'home.suggestion-append'));
    else if (matches.length > 1) list.push(chip('Add to an existing note', async () => { const id = await N.chooseNoteSheet(D, { only: matches.map(n => n.id) }); if (id) { d.targetNoteId = id; persist(); sync(); } }, '', 'home.suggestion-append'));
  }
  if (a.action || a.date) {
    if (a.action) list.push(chip(d.followUp ? `✓ Follow Up added${d.followUp.due ? ' · ' + store.formatDate(d.followUp.due) : ''}` : `Add follow up${a.date ? ' · ' + store.formatDate(a.date.due) : ''}`,
      () => quickFollowUp(key, sync), d.followUp ? 'accepted' : 'time', 'home.suggestion-follow-up'));
  }
  if (a.unknown.length) {
    const nm = a.unknown[0].name;
    list.push(chip(`Create contact: ${nm}`, async () => {
      const name = await promptText({ title: 'Create new contact', label: 'Name (no phone or details are added for you)', value: nm, ok: 'Create', dataId: 'home.create-contact' });
      if (!name) return;
      const c = await N.createMinimalContact(name);
      d.contactIds = [...d.contactIds, c.id]; persist(); D.contacts.push(c); D.contactsById.set(c.id, c); IX = nameIndex(D); sync();
      toast(`${store.displayName(c)} added to Contacts and linked`);
    }, 'new', 'home.suggestion-create'));
  }
  if (a.waiting && !a.action) list.push(chip(d.waiting ? '✓ Waiting item added' : 'Track waiting for a reply', () => { d.waiting = !d.waiting; persist(); sync(); }, d.waiting ? 'accepted' : '', 'home.suggestion-waiting'));
  const shown = list.slice(0, 3);
  return shown.length ? h('div', { class: 'suggest-chips' }, shown) : h('div', { class: 'note' }, 'No suggestions needed. Save the words as they are.');
}

function highlighted(text, a) {
  let cur = 0, s = '';
  for (const r of a.ranges) { s += esc(text.slice(cur, r.start)) + `<mark class="hl-${r.type}">${esc(text.slice(r.start, r.end))}</mark>`; cur = r.end; }
  return s + esc(text.slice(cur)) + '\n';
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 60) + 'px'; }

// ---------- one-tap and detailed Follow Up ----------
function quickFollowUp(key, sync) {
  const d = draft(key);
  if (d.followUp) { d.followUp = null; toast('Follow Up removed'); }
  else {
    if (!d.text.trim()) { toast('Write a note first'); return; }
    const a = recognize(d.text, IX, D);
    d.followUp = { text: firstSentence(d.text), due: a.date ? a.date.due : null };
    toast(d.followUp.due ? `Follow Up ready for ${store.formatDate(d.followUp.due)}` : 'Follow Up ready — no date needed');
  }
  persist(); sync();
}
async function followUpDetails(key, sync) {
  const d = draft(key), a = recognize(d.text, IX, D);
  const text = h('input', { class: 'input', dir: 'auto', value: d.followUp?.text || firstSentence(d.text), 'data-id': 'home.fu-details.text', 'aria-label': 'What needs to happen?' });
  const due = h('input', { class: 'input', type: 'date', value: d.followUp?.due || a.date?.due || '', 'data-id': 'home.fu-details.date', 'aria-label': 'Date (optional)' });
  const acts = [{ id: 'save', label: 'Use this Follow Up', primary: true, run: () => { d.followUp = { text: text.value.trim() || 'Follow up', due: due.value || null }; persist(); sync(); } }];
  if (d.followUp) acts.unshift({ id: 'remove', label: 'No Follow Up', run: () => { d.followUp = null; persist(); sync(); } });
  await sheet({ title: 'Follow Up details', dataId: 'home.fu-details', body: [
    h('div', { class: 'field' }, h('label', {}, 'What needs to happen?'), text),
    h('div', { class: 'field' }, h('label', {}, 'Date (optional)'), due),
    h('p', { class: 'note' }, 'Saved with the note. Nothing is sent to anyone.')], actions: acts });
}

// Consequential: needs a clear yes, keeps who reported it.
async function reviewAnswer(key, ans, sync) {
  const d = draft(key);
  if (d.answer) { d.answer = null; persist(); sync(); return; }
  const p = D.peopleById.get(ans.personId), m = await offerForPerson(ans.personId);
  const rep = ans.reporterId ? D.contactsById.get(ans.reporterId) : null;
  const name = store.personName(p).split(/\s+/)[0];
  const active = m && m.cur.t.phase !== 'ended';
  const effect = !active ? `There is no open shidduch for ${name}, so this is saved as ${name}’s reported response on the person card.`
    : ans.value === 'No' ? `This ends the shidduch with ${store.personName(p)} (it stays in Ended with its history).` : `Your own answer stays as it is.`;
  const ok = await confirmDialog({ title: `Update ${name}’s answer to ${ans.value}?`,
    text: `From your note: “${ans.phrase}”${rep ? ` — reported by ${store.displayName(rep)}` : ''}. ${effect} It happens only when you save the note.`,
    ok: 'Yes, on save', dataId: 'home.answer-dialog', danger: ans.value === 'No' && active });
  if (!ok) return;
  d.answer = { ...ans, name, reporterName: rep ? store.displayName(rep) : '' };
  persist(); sync();
}
async function applyAnswer(ans) {
  const m = await offerForPerson(ans.personId);
  const source = ans.reporterName || '';
  if (m && m.cur.t.phase !== 'ended') {
    if (ans.value === 'No') await endTry(m, { endedBy: 'them', saidNo: true, source, reason: '' });
    else await setAnswer(m, 'them', 'Yes', { source });
    return;
  }
  // Ideas flow: if I already said yes, her yes moves the person to Shidduchim → Offers.
  const o = await recordInterest(ans.personId, { side: 'theirs', value: ans.value === 'No' ? 'No' : 'Yes, interested', reason: 'From a note on Home', reportedBy: source, reportedByContactId: ans.reporterId || null });
  if (o) toast('Both said yes. Moved to Shidduchim → Offers', 4000);
}

// ---------- Actions / Link Contact dropdowns ----------
function actionsMenu(anchor, key, sync) {
  const d = draft(key), isNew = key === 'new', note = noteOf(key);
  N.openMenu(anchor, isNew ? 'home.actions-menu' : 'home.note-actions-menu', (panel) => {
    const chosen = isNew ? d.color : note?.color || 'plain';
    panel.append(...[h('div', { class: 'qtitle' }, 'More actions'),
      N.menuItem('Follow Up details', 'Date / description', () => { N.closeMenu(); followUpDetails(key, sync); }, { dataId: 'home.actions.follow-up-details' }),
      isNew ? N.menuItem('Add to an existing note', '', async () => { N.closeMenu(); const id = await N.chooseNoteSheet(D); if (id) { d.targetNoteId = id; persist(); sync(); } }, { dataId: 'home.actions.add-existing' }) : null,
      N.menuItem('Waiting for someone', d.waiting ? 'on save' : '', () => { d.waiting = !d.waiting; persist(); N.closeMenu(); sync(); toast(d.waiting ? 'Waiting item will be added when you save' : 'Waiting item removed'); }, { tick: d.waiting, dataId: 'home.actions.waiting' }),
      N.menuItem('Create new contact', '', async () => {
        N.closeMenu();
        const name = await promptText({ title: 'Create new contact', label: 'Name (only what you know)', ok: 'Create', dataId: 'home.create-contact' });
        if (!name) return;
        const c = await N.createMinimalContact(name);
        d.contactIds = [...d.contactIds, c.id]; persist(); sync(); toast(`${store.displayName(c)} added to Contacts and linked`);
      }, { dataId: 'home.actions.create-contact' }),
      note ? N.menuItem('Delete note', '', () => { N.closeMenu(); deleteNoteFlow(note, key); }, { cls: 'danger-text', dataId: 'home.actions.delete' }) : null,
      h('div', { class: 'qdivider' }),
      h('div', { class: 'qlabel-row' }, 'Change Color'),
      h('div', { class: 'qswatches', role: 'group', 'aria-label': 'Note colour' }, N.COLORS.map(([c, label]) =>
        h('button', { type: 'button', class: `qswatch tone-${c}`, 'aria-label': `${label} note colour`, title: label, 'aria-pressed': c === chosen ? 'true' : 'false', 'data-id': 'home.actions.color-' + c,
          onClick: async () => {
            N.closeMenu();
            if (isNew) { d.color = c; persist(); drawComposer(); toast(`${label} — used when you save`); }
            else if (note && note.color !== c) { await N.setColor(note, c); toast('Colour changed'); }
          } })))].filter(Boolean));
  });
}

// Delete a note: asks first. Used by the Actions menu and by the Delete button on an open note.
async function deleteNoteFlow(note, key = 'note:' + note.id) {
  if (!(await confirmDialog({ title: 'Delete this note?', text: 'Its dated entries also disappear from every linked contact and person. Follow Ups stay.', ok: 'Delete note', danger: true, dataId: 'home.delete-note-dialog' }))) return;
  await N.deleteNote(note); delete drafts[key]; persist(); if (U.expanded === note.id) U.expanded = null; toast('Note deleted');
}

function linkFor(anchor, key, sync, query = '') {
  const d = draft(key), note = noteOf(key);
  const a = recognize(d.text, IX, D);
  const suggest = a.refs.flatMap(r => r.matches.map(m => m.id));
  const sel = { contactIds: [...d.contactIds, ...(note?.contactIds || [])], personIds: [...d.personIds, ...(note?.personIds || [])] };
  N.linkMenu(anchor, 'home.link-menu', D, sel, async (s) => {
    if (note) {
      // An existing note's links change right away (they are the note's, not the update's).
      const removed = (note.contactIds || []).filter(x => !s.contactIds.includes(x)).length + (note.personIds || []).filter(x => !s.personIds.includes(x)).length;
      d.contactIds = s.contactIds.filter(x => !(note.contactIds || []).includes(x));
      d.personIds = s.personIds.filter(x => !(note.personIds || []).includes(x));
      if (removed) { await N.setLinks(note, s.contactIds.filter(x => (note.contactIds || []).includes(x)), s.personIds.filter(x => (note.personIds || []).includes(x)), { quiet: true }); }
    } else { d.contactIds = s.contactIds; d.personIds = s.personIds; }
    persist(); sync();
  }, { suggest, query });
}

// ---------- saving ----------
async function save(key) {
  const d = draft(key), text = d.text.trim();
  if (!text) { toast('Write something first'); root?.querySelector(`textarea[data-key="${CSS.escape(key)}"]`)?.focus(); return; }
  let note = key === 'new' ? (d.targetNoteId ? D.notes.find(n => n.id === d.targetNoteId) : null) : noteOf(key);
  let res;
  if (note) res = await N.appendEntry(note, text, { contactIds: d.contactIds, personIds: d.personIds });
  else res = await N.createNote({ title: d.title, text, color: d.color, pinned: d.pinned, contactIds: d.contactIds, personIds: d.personIds });
  note = res.note;
  const contactId = note.contactIds?.[0] || null, personId = note.personIds?.[0] || null;
  if (d.followUp) await store.followUps.save({ noteId: note.id, contactId, personId, kind: 'task', text: d.followUp.text, dueAt: d.followUp.due || null, done: false });
  if (d.waiting) await store.followUps.save({ noteId: note.id, contactId, personId, kind: 'waiting', text: 'Waiting: ' + firstSentence(text), dueAt: null, done: false });
  if (d.answer) await applyAnswer(d.answer);
  const msg = (key === 'new' && !d.targetNoteId ? 'Note saved' : 'Dated update added') + (d.followUp ? ' · Follow Up added' : '') + (d.answer ? ' · answer updated' : '');
  delete drafts[key]; persist();
  if (key === 'new') drawComposer(); else U.expanded = note.id;
  toast(msg + (!U.allNotes && aboutPerson(note) && U.expanded !== note.id ? ' · find it on the person’s Notes tab or under All' : ''), 4000);
}

function drawComposer() { if (!root) return; els.composer.innerHTML = ''; els.composer.append(composer('new')); }

// Section header band: a small label line, the title and the count — each section looks different
// at a glance (owner request, Stage 8). The ids anchor the phone jump row.
function secHead(eyebrow, title, count, id) {
  return h('div', { class: 'home-sec-head', id, 'data-id': id }, h('div', { class: 'home-sec-eyebrow' }, eyebrow), h('div', { class: 'home-sec-title' }, h('h2', {}, title), h('span', { class: 'count' }, String(count))));
}
// Phone: three tabs under New Note show ONE section at a time (Notes / Follow Ups / History), so
// each has its own screen. On a wide screen the tabs are hidden and all sections show in columns.
// Tabs inside Home, not navigation destinations (spec/home.md keeps both on Home).
const PHONE = window.matchMedia('(max-width: 899px)');
const SECTIONS = [['notes', 'Notes'], ['followups', 'To Do List'], ['history', 'History']];
let section = 'notes';
function tabRow() {
  els.tabs = h('div', { class: 'home-tabs', role: 'tablist', 'aria-label': 'Home sections', 'data-id': 'home.tabs' },
    SECTIONS.map(([k, l]) => h('button', { type: 'button', role: 'tab', class: 'home-tab home-tab-' + k, 'aria-selected': section === k ? 'true' : 'false', 'data-id': 'home.tab-' + k,
      onClick: () => { section = k; applySection(); window.scrollTo({ top: Math.min(window.scrollY, els.tabs.offsetTop - 8), behavior: 'auto' }); } },
      l, h('span', { class: 'count', 'data-count': k }, ''))));
  return els.tabs;
}
function applySection() {
  if (!root) return;
  const phone = PHONE.matches;
  els.tabs?.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', b.dataset.id === 'home.tab-' + section ? 'true' : 'false'));
  if (SHH) return applyShSection(phone);
  els.composer.classList.toggle('hidden', phone && section !== 'notes');
  els.notes.classList.toggle('hidden', phone && section !== 'notes');
  els.fus.classList.toggle('hidden', phone && section !== 'followups');
  els.hist.classList.toggle('hidden', phone && section !== 'history');
}
function showSection(k) { section = k; applySection(); }
// Shadchan Mode on a phone: Notes = New Note and the blocks chosen in Edit Home (not To do / History);
// To Do List = the To do block; History = the History block. Those two show on their tab even if
// hidden in Edit Home. On a wide screen the tabs are hidden and the Edit Home blocks all show.
function applyShSection(phone) {
  els.composer.classList.toggle('hidden', phone && section !== 'notes');
  for (const node of els.grid.children) {
    const tab = node.dataset.tab || 'notes', off = node.dataset.off === '1';
    node.classList.toggle('hidden', phone ? tab !== section : off);
  }
}
// Shadchan Mode: arrange the blocks. Notes stay on the page while a note is open, even if hidden.
function drawBlocks() { if (SHH && root && SH) SHH.draw(els.grid, { notes: els.notes, fus: els.fus, hist: els.hist }, SH, D, { keepNotes: !!U.expanded }); }
function tabCounts() {
  if (!els.tabs) return;
  const moves = SHH && SH ? SH.list.filter(m => m.step.kind === 'move').length : 0; // Shadchan To Do List also holds Your move
  const c = { notes: shownNotes().length, followups: openFollowUps(D.followUps).length + moves, history: buildHistory(D, X).length };
  els.tabs.querySelectorAll('[data-count]').forEach(el => { el.textContent = String(c[el.dataset.count] ?? ''); });
}

// ---------- Existing Notes ----------
// Home shows MY notes by default: notes not about a person (owner request, tweak mode).
// Notes about a person live on that person's Notes tab; "All" shows them here too.
const aboutPerson = (n) => (n.personIds || []).length > 0;
function shownNotes() { return U.allNotes ? D.notes : D.notes.filter(n => !aboutPerson(n) || n.id === U.expanded); }
function drawNotes() {
  const list = shownNotes(), people = D.notes.filter(aboutPerson).length;
  const pinned = list.filter(n => n.pinned), other = list.filter(n => !n.pinned);
  els.notes.innerHTML = '';
  els.notes.append(secHead('Notes', U.allNotes ? 'All Notes' : 'My Notes', list.length, 'home.notes-head'));
  if (people) els.notes.append(h('div', { class: 'notes-filter', role: 'group', 'aria-label': 'Which notes', 'data-id': 'home.notes-filter' },
    [[false, 'My notes', 'home.notes-mine'], [true, `All (with ${people} about people)`, 'home.notes-all']].map(([v, l, id]) =>
      h('button', { type: 'button', class: 'notes-filter-btn', 'aria-pressed': !!U.allNotes === v ? 'true' : 'false', 'data-id': id, onClick: () => { U.allNotes = v; drawNotes(); tabCounts(); } }, l))));
  if (!list.length) { els.notes.append(h('p', { class: 'note home-empty' }, D.notes.length ? 'No notes of your own yet. Notes about a person are on their Notes tab.' : 'No notes yet. Write one above — a title is optional.')); return; }
  if (pinned.length) els.notes.append(h('div', { class: 'note-group-title', 'data-id': 'home.pinned' }, 'Pinned ', h('span', { class: 'count' }, String(pinned.length))), h('div', { class: 'note-list' }, pinned.map(noteCard)));
  if (other.length) els.notes.append(pinned.length ? h('div', { class: 'note-group-title', 'data-id': 'home.other-notes' }, 'Other Notes ', h('span', { class: 'count' }, String(other.length))) : '', h('div', { class: 'note-list' }, other.map(noteCard)));
  els.notes.append(h('div', { class: 'notes-delete-all' },
    h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'home.notes-delete-all', onClick: () => deleteAllFlow(list) }, `Delete all ${list.length} notes`)));
}
// Deletes exactly the notes shown (My notes, or All). Pinned ones too. Follow Ups stay.
async function deleteAllFlow(list) {
  if (!list.length) return;
  const which = U.allNotes ? 'all your notes, including the ones about people' : 'all your own notes (notes about people stay)';
  if (!(await confirmDialog({ title: `Delete ${list.length} notes?`, text: `This deletes ${which}, pinned ones too, and their dated entries. Follow Ups stay. It cannot be undone — to keep a copy first, use Settings → Export backup.`, ok: `Delete ${list.length} notes`, danger: true, dataId: 'home.delete-all-dialog' }))) return;
  await N.deleteNotes(list);
  for (const n of list) delete drafts['note:' + n.id];
  persist(); U.expanded = null; toast(`${list.length} notes deleted`);
}

function noteCard(n) {
  const es = D.entries.get(n.id) || [], open = U.expanded === n.id;
  const links = N.linksOf(n, D);
  const pin = h('button', { type: 'button', class: 'pin-text corner', 'aria-pressed': n.pinned ? 'true' : 'false', 'data-id': 'home.note-pin',
    onClick: async (e) => { e.stopPropagation(); await N.togglePin(n); toast(n.pinned ? 'Unpinned' : 'Pinned'); } }, n.pinned ? 'Unpin' : 'Pin');
  const linkRow = links.length ? h('span', { class: 'note-links' }, links.map((l, i) => [i ? ', ' : '', h('a', { href: l.href, dir: 'auto', onClick: (e) => e.stopPropagation() }, l.label)])) : null;
  if (!open) {
    const card = h('article', { class: `note-card tone-${n.color || 'plain'}`, 'data-note': n.id, 'data-id': 'home.note',
      onClick: (e) => { if (!fine() || e.target.closest('a,button')) return; expand(n.id); } },
      pin,
      h('h3', { dir: 'auto' }, n.title),
      h('p', { class: 'preview', dir: 'auto' }, es[es.length - 1]?.text || ''),
      h('div', { class: 'note-meta' }, h('span', {}, `${store.formatDate(D.lastAt(n))} · ${es.length} dated ${es.length === 1 ? 'entry' : 'entries'}`), linkRow),
      h('div', { class: 'note-card-foot' },
        h('button', { type: 'button', class: 'add-to-note', 'data-id': 'home.note-add', onClick: (e) => { e.stopPropagation(); expand(n.id); } }, 'Add to note'),
        h('button', { type: 'button', class: 'add-to-note danger-text', 'data-id': 'home.note-delete', onClick: (e) => { e.stopPropagation(); deleteNoteFlow(n); } }, 'Delete')));
    return card;
  }
  return h('article', { class: `note-card expanded tone-${n.color || 'plain'}`, 'data-note': n.id, 'data-id': 'home.note-open' },
    h('div', { class: 'note-open-head' },
      h('h3', { dir: 'auto' }, n.title),
      h('div', { class: 'note-open-actions' },
        h('button', { type: 'button', class: 'pin-text', 'aria-pressed': n.pinned ? 'true' : 'false', 'data-id': 'home.note-pin', onClick: async () => { await N.togglePin(n); toast(n.pinned ? 'Unpinned' : 'Pinned'); } }, n.pinned ? 'Unpin' : 'Pin'),
        h('button', { type: 'button', class: 'pin-text', 'data-id': 'home.note-rename', onClick: async () => {
          const t = await promptText({ title: 'Rename note', label: 'Title', value: n.title, ok: 'Save', dataId: 'home.rename-dialog' });
          if (t && t !== n.title) { await store.notes.save({ ...n, title: t }); toast('Renamed'); }
        } }, 'Rename'),
        h('button', { type: 'button', class: 'pin-text danger-text', 'data-id': 'home.note-delete', onClick: () => deleteNoteFlow(n) }, 'Delete'),
        h('button', { type: 'button', class: 'pin-text', 'data-id': 'home.note-close', onClick: () => { U.expanded = null; drawNotes(); } }, 'Close'))),
    h('div', { class: 'note-meta' }, h('span', {}, `Started ${store.formatDate(n.createdAt)} · ${es.length} dated ${es.length === 1 ? 'entry' : 'entries'}`), linkRow),
    h('div', { class: 'note-entries', 'data-id': 'home.note-entries' }, es.map(e => h('div', { class: 'note-entry' },
      h('div', { class: 'date-divider' }, dateTimeLabel(e.at)),
      h('div', { class: 'prewrap', dir: 'auto' }, e.text)))),
    composer('note:' + n.id));
}
function expand(id) {
  U.expanded = id; N.closeMenu(); showSection('notes'); drawNotes(); drawBlocks();
  const ta = root?.querySelector(`textarea[data-key="note:${CSS.escape(id)}"]`);
  if (ta) { ta.focus({ preventScroll: true }); ta.closest('.note-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}
const dateTimeLabel = (at) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// ---------- Follow Ups ----------
function drawFollowUps() {
  const open = openFollowUps(D.followUps);
  const shown = U.fuAll ? open : open.slice(0, FU_FIRST);
  els.fus.innerHTML = '';
  els.fus.append(SHH ? h('div', { class: 'note-group-title', 'data-id': 'home.followups-head' }, 'My follow-ups ', h('span', { class: 'count' }, String(open.length))) : secHead('To do', 'Follow Ups', open.length, 'home.followups-head'));
  if (!open.length) { els.fus.append(h('p', { class: 'note home-empty' }, 'Nothing waiting. Tap Follow Up while writing a note to add one.')); return; }
  els.fus.append(h('ul', { class: 'fu-lines' }, shown.map(fuRow)));
  if (open.length > FU_FIRST) els.fus.append(h('button', { type: 'button', class: 'section-expand', 'data-id': 'home.followups-more', 'aria-expanded': U.fuAll ? 'true' : 'false',
    onClick: () => { U.fuAll = !U.fuAll; drawFollowUps(); } }, U.fuAll ? 'Show less' : `See all (${open.length})`));
}
function fuRow(f) {
  const c = f.contactId ? D.contactsById.get(f.contactId) : null, p = f.personId ? D.peopleById.get(f.personId) : null;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = f.dueAt && f.dueAt < today;
  const sub = [f.kind === 'waiting' ? 'Waiting' : 'Reminder', f.dueAt ? (overdue ? 'was due ' : '') + store.formatDate(f.dueAt) : null].filter(Boolean).join(' · ');
  return h('li', { class: 'fu-row', 'data-id': 'home.followup' },
    h('button', { type: 'button', class: 'fu-dot', 'aria-label': 'Mark done: ' + f.text, title: 'Mark done', 'data-id': 'home.followup-done', html: icon('check'),
      onClick: async () => {
        const before = { ...f };
        await store.followUps.save({ ...f, done: true, doneAt: store.now() });
        toast('Follow Up done — the note and history stay', 5000, { label: 'Undo', run: () => store.followUps.save(before) });
      } }),
    h('div', { class: 'fu-main' },
      h('button', { type: 'button', class: 'fu-title', dir: 'auto', 'data-id': 'home.followup-edit', onClick: () => editFollowUp(f) }, f.text),
      h('div', { class: 'fu-sub' + (overdue ? ' overdue' : '') }, sub,
        c ? [' · ', h('a', { href: `#/contacts/${encodeURIComponent(c.id)}`, dir: 'auto' }, store.displayName(c))] : null,
        p ? [' · ', h('a', { href: `#/people/${encodeURIComponent(p.id)}`, dir: 'auto' }, store.personName(p))] : null,
        f.noteId && D.notes.some(n => n.id === f.noteId) ? [' · ', h('button', { type: 'button', class: 'linkish inline', onClick: () => openNote(f.noteId) }, 'note')] : null)));
}
async function editFollowUp(f) {
  const text = h('input', { class: 'input', dir: 'auto', value: f.text, 'data-id': 'home.followup-sheet.text', 'aria-label': 'What needs to happen?' });
  const due = h('input', { class: 'input', type: 'date', value: f.dueAt || '', 'data-id': 'home.followup-sheet.date', 'aria-label': 'Date (optional)' });
  await sheet({ title: f.kind === 'waiting' ? 'Waiting item' : 'Follow Up', dataId: 'home.followup-sheet', body: [
    h('div', { class: 'field' }, h('label', {}, 'What needs to happen?'), text),
    h('div', { class: 'field' }, h('label', {}, 'Date (optional)'), due)],
    actions: [
      { id: 'delete', label: 'Delete', danger: true, run: async () => { if (!(await confirmDialog({ title: 'Delete this Follow Up?', text: 'Use the circle instead if it is done — that keeps it in History.', ok: 'Delete', danger: true, dataId: 'home.followup-delete-dialog' }))) return false; await store.followUps.remove(f.id); toast('Deleted'); } },
      { id: 'save', label: 'Save', primary: true, run: async () => { await store.followUps.save({ ...f, text: text.value.trim() || f.text, dueAt: due.value || null }); toast('Saved'); } }] });
}

// ---------- History ----------
function drawHistory() {
  const rows = buildHistory(D, X);
  const shown = rows.slice(0, U.histN);
  els.hist.innerHTML = '';
  els.hist.append(secHead('What happened', 'History', rows.length, 'home.history-head'));
  if (!rows.length) { els.hist.append(h('p', { class: 'note home-empty' }, 'Nothing recorded yet.')); return; }
  els.hist.append(h('ul', { class: 'hist-lines' }, shown.map(histRow)));
  const more = rows.length - shown.length;
  if (more > 0 || U.histN > HIST_FIRST) els.hist.append(h('div', { class: 'hist-foot' },
    more > 0 ? h('button', { type: 'button', class: 'section-expand', 'data-id': 'home.history-more', onClick: () => { U.histN = U.histN === HIST_FIRST ? HIST_STEP : U.histN + HIST_STEP; drawHistory(); } },
      U.histN === HIST_FIRST ? `See all (${rows.length})` : `Show ${Math.min(HIST_STEP, more)} more`) : null,
    U.histN > HIST_FIRST ? h('button', { type: 'button', class: 'section-expand', 'data-id': 'home.history-less', onClick: () => { U.histN = HIST_FIRST; drawHistory(); els.hist.scrollIntoView({ block: 'nearest' }); } }, 'Show less') : null));
}
function histRow(r) {
  const open = U.histOpen.has(r.key);
  const d = new Date(r.at);
  const detailId = 'hist-' + r.key.replace(/[^a-zA-Z0-9_-]/g, '-');
  return h('li', { class: 'hist-row' + (open ? ' open' : ''), 'data-id': 'home.history-row' },
    h('div', { class: 'hist-line' },
      h('span', { class: 'hist-date' }, store.formatDate(r.at), ' ', d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })),
      h('div', { class: 'hist-main' }, h('strong', { dir: 'auto' }, r.what), h('p', { dir: 'auto', class: open ? 'prewrap' : 'clamp1' }, r.text)),
      h('button', { type: 'button', class: 'hist-chevron' + (open ? ' on' : ''), 'aria-expanded': open ? 'true' : 'false', 'aria-controls': detailId,
        'aria-label': (open ? 'Collapse' : 'Expand') + ' history entry: ' + r.what, 'data-id': 'home.history-chevron', html: icon('chevron'),
        onClick: () => { open ? U.histOpen.delete(r.key) : U.histOpen.add(r.key); drawHistory(); } })),
    open ? h('div', { class: 'hist-detail', id: detailId },
      h('span', { class: 'stamp' }, `${r.kind} · ${dateTimeLabel(r.at)}${r.names?.length ? ' · ' + r.names.join(', ') : ''}`),
      h('div', { class: 'hist-links' },
        r.noteId && D.notes.some(n => n.id === r.noteId) ? h('button', { type: 'button', class: 'linkish', 'data-id': 'home.history-open-note', onClick: () => openNote(r.noteId) }, 'Open related note') : null,
        r.href ? h('a', { class: 'linkish', href: r.href, 'data-id': 'home.history-open' }, r.hrefLabel || 'Open') : null)) : null);
}
function openNote(id) {
  U.q = ''; els.search.value = ''; drawSearch();
  expand(id);
  root?.querySelector(`[data-note="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// ---------- Search (notes, people, contacts, conversations, follow-ups, history) ----------
function drawSearch() {
  const q = N.norm(U.q);
  els.results.classList.toggle('hidden', !q);
  els.grid.classList.toggle('hidden', !!q);
  els.results.innerHTML = '';
  if (!q) return;
  const has = (s) => N.norm(s).includes(q);
  const groups = [];
  const notes = D.notes.filter(n => has(n.title) || (D.entries.get(n.id) || []).some(e => has(e.text)));
  if (notes.length) groups.push(['Notes', notes.slice(0, 8).map(n => resultRow(n.title, (D.entries.get(n.id) || []).map(e => e.text).find(has) || '', null, () => openNote(n.id)))]);
  const people = D.people.filter(p => has(p.name) || has(p.city) || has(p.occupation));
  if (SH) { const sh = SHH.searchShidduchim(SH, has); if (sh.length) groups.push([`Shidduchim${sh.length > 8 ? ` · ${sh.length}` : ''}`, sh.slice(0, 8).map(r => resultRow(r.title, r.sub, r.href))]); }
  if (people.length) groups.push([SHH ? `Singles${people.length > 8 ? ` · ${people.length}` : ''}` : 'Suggested people', people.slice(0, 8).map(p => resultRow(store.personName(p), [p.age, p.city, p.occupation].filter(Boolean).join(' · '), `#/people/${encodeURIComponent(p.id)}`))]);
  const contacts = D.contacts.filter(c => has(store.displayName(c)) || has(c.city));
  if (contacts.length) groups.push([`Contacts${contacts.length > 8 ? ` · ${contacts.length}` : ''}`, contacts.slice(0, 8).map(c => resultRow(store.displayName(c), [c.city, ...(c.roles || [])].filter(Boolean).join(' · '), `#/contacts/${encodeURIComponent(c.id)}`))]);
  const convs = D.events.filter(e => !e.noteId && has(e.text));
  if (convs.length) groups.push([`Conversations${convs.length > 8 ? ` · ${convs.length}` : ''}`, convs.slice(0, 8).map(e => {
    const c = D.contactsById.get(e.contactIds?.[0]);
    return resultRow(`${store.eventTypeLabel(e.type)}${c ? ' · ' + store.displayName(c) : ''} · ${store.formatDate(e.at)}`, e.text, c ? `#/contacts/${encodeURIComponent(c.id)}` : null);
  })]);
  const fus = D.followUps.filter(f => has(f.text));
  if (fus.length) groups.push(['Follow Ups', fus.slice(0, 8).map(f => resultRow((f.done ? '✓ ' : '') + f.text, f.dueAt ? store.formatDate(f.dueAt) : (f.kind === 'waiting' ? 'Waiting' : 'No date'), null, () => editFollowUp(f)))]);
  const hist = buildHistory(D, X).filter(r => r.kind !== 'Note' && r.kind !== 'Note update' && r.kind !== 'Conversation' && (has(r.what) || has(r.text)));
  if (hist.length) groups.push(['History', hist.slice(0, 8).map(r => resultRow(r.what, r.text, r.href, r.noteId ? () => openNote(r.noteId) : null))]);
  els.results.append(h('div', { class: 'home-sec-head' }, h('h2', {}, 'Search results'),
    h('button', { type: 'button', class: 'linkish', 'data-id': 'home.search-clear', onClick: () => { U.q = ''; els.search.value = ''; drawSearch(); } }, 'Clear')));
  if (!groups.length) els.results.append(h('p', { class: 'note home-empty' }, `Nothing found for “${U.q}”.`));
  for (const [title, rows] of groups) els.results.append(h('div', { class: 'note-group-title' }, title), h('ul', { class: 'result-list' }, rows));
}
function resultRow(title, sub, href, onClick) {
  const inner = [h('strong', { dir: 'auto' }, title), sub ? h('span', { class: 'note clamp1', dir: 'auto' }, sub) : null];
  return h('li', {}, href ? h('a', { class: 'result-row', href, 'data-id': 'home.search-result' }, inner)
    : h('button', { type: 'button', class: 'result-row', 'data-id': 'home.search-result', onClick }, inner));
}


// Two-choice switch between Single Mode and Shadchan Mode. Switching reloads the app (each mode has its own records).
function modeToggle() {
  return h('div', { class: 'home-mode-toggle', role: 'radiogroup', 'aria-label': 'Mode', 'data-id': 'home.mode-toggle' },
    MODES.map(([value, label]) => h('button', {
      type: 'button', role: 'radio', class: 'home-mode-opt' + (value === MODE ? ' on' : ''),
      'aria-checked': value === MODE ? 'true' : 'false', 'data-id': 'home.mode-toggle.' + value,
      onClick: () => { if (value !== MODE) switchMode(value); },
    }, label)));
}

// The gear. The mode name is no longer written under it: the switch beside it shows the mode (owner request).
function settingsLink() {
  return h('a', { class: 'icon-btn home-settings', href: '#/settings', 'aria-label': 'Settings', title: 'Settings', 'data-id': 'home.settings', html: icon('settings') });
}
