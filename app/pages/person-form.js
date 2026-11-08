// Add Person — Paste · Basic Info · Detailed Info (spec/add-person.md, layout and behaviour
// from source/ZivugMatch_Add_Person_Prototype_v3_0.html, drawn in the Claude look).
// One shared person record; originals are kept word for word as versions (store `sources`).
// Drafts live in memory per address, so switching tabs or pages never loses typing.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles, confirmDialog } from '../js/ui.js';
import { navigate } from '../js/router.js';
import * as PD from './profile-data.js';
import { seekingKind, KINDS, LISTS, GIRLS_ONLY, KNOW_CONTACT, KNOW_FLAGS, EXCLUSIVE, listType, listsOf, extract, managePersonForm, addChoice, dateOnly } from './people-data.js';

const MAX_FILE = 5 * 1024 * 1024;
const TABS = [['paste', 'Paste'], ['basic', 'Basic Info'], ['details', 'Detailed Info']];
const ico = (n) => h('span', { html: icon(n) }).firstChild;

const drafts = new Map();   // address key → draft
let root = null, gen = 0, d = null, ctx = null;

export function destroy() { root = null; gen++; }
// Ideas lists unsaved drafts so nothing typed is ever lost.
export function openDrafts() {
  return [...drafts.values()].filter(x => x.dirty && !x.me).map(x => ({ key: x.key, href: x.href, name: x.p.name || (x.sourceText || '').trim().split('\n')[0] || 'Untitled', editing: !!x.personId }));
}
export function dropDraft(key) { drafts.delete(key); }

export async function render(container, params = {}, path = '') {
  root = container;
  root.classList.add('person-form-page');
  const token = ++gen;
  const me = path.startsWith('/profile/edit');
  const editing = !!params.id;
  const key = me ? 'me' : editing ? 'edit:' + params.id : params.sourceId ? 'from:' + params.sourceId : params.contactId ? 'by:' + params.contactId : 'new';
  if (!drafts.has(key)) {
    const fresh = me ? await makeMeDraft() : await makeDraft({ key, editing, params, path });
    if (!fresh) { root.append(h('p', { class: 'empty' }, 'This person or original no longer exists.'), h('a', { class: 'btn', href: '#/people' }, 'Back to Ideas')); return; }
    drafts.set(key, fresh);
  }
  d = drafts.get(key);
  if (params.section) { d.tab = 'details'; d.jumpTo = params.section; }
  const [choices, cats, contacts, people, srcs] = await Promise.all([
    store.getChoices(), store.getPersonCategories(), store.contacts.list(), store.people.list(), store.sources.list()]);
  if (token !== gen) return;
  ctx = { choices, cats, contacts, contactsById: new Map(contacts.map(c => [c.id, c])), people, srcs };
  paint();
}

async function makeDraft({ key, editing, params, path }) {
  const prefs = store.getPrefs();
  const base = {
    key, href: '#' + path, personId: null, fromSourceId: null, tab: 'paste', kind: seekingKind(prefs) || prefs.personKind || 'guy', dirty: false,
    sourceText: '', sender: '', senderContactId: null, files: [],
    existingSources: [], existingAtts: [], newAtts: [], removedAttIds: [],
    p: { name: '', age: '', city: '', occupation: '', languages: [], about: '', looking: '', maxAge: '', contactCards: [],
      know: [], yearsKnown: '', howKnow: '', answers: {}, religiousOther: '' },
  };
  if (editing) {
    const p = await store.people.get(params.id);
    if (!p) return null;
    base.personId = p.id; base.kind = p.kind || ''; base.tab = 'basic';
    base.href = `#/people/${encodeURIComponent(p.id)}/edit`;
    base.p = { ...base.p, ...JSON.parse(JSON.stringify(p)) };
    base.p.answers = base.p.answers || {};
    base.sender = p.sender || ''; base.senderContactId = p.senderContactId || null;
    base.existingSources = await store.sourcesForPerson(p.id);
    base.existingAtts = await store.attachments.byIndex('personId', p.id);
  } else if (params.sourceId) {
    const s = await store.sources.get(params.sourceId);
    if (!s) return null;
    base.fromSourceId = s.id; base.sourceText = s.text || ''; base.sender = s.sender || ''; base.senderContactId = s.senderContactId || null;
    base.existingAtts = (await store.attachments.list()).filter(a => a.sourceId === s.id);
  } else if (params.contactId) {
    const c = await store.contacts.get(params.contactId);
    if (c) {
      base.sender = store.displayName(c); base.senderContactId = c.id;
      base.p.contactCards.push(card({ role: (c.roles || []).includes('shadchan') ? 'shadchan' : 'other', name: store.displayName(c), number: c.phone || '', contactId: c.id }));
    }
  }
  if (!base.p.contactCards.length) base.p.contactCards.push(card({}));
  return base;
}

function card({ role = 'unknown', name = '', number = '', email = '', contactId = null }) {
  return { id: store.newId('k'), role, name, number, email, contactId };
}

const touch = () => { if (d) d.dirty = true; };
const original = () => d.sourceText.trim() ? d.sourceText : (d.existingSources.at(-1)?.text || '');
const hasOriginal = () => !!(d.sourceText.trim() || d.files.length || d.existingSources.length || d.existingAtts.some(a => a.sourceId));

// ---------- drawing ----------
function paint({ keepScroll = false } = {}) {
  if (!root) return;
  const y = window.scrollY;
  root.innerHTML = '';
  if (d.me) { paintMe(); if (keepScroll) window.scrollTo(0, y); return; }
  const title = d.personId ? `Edit ${d.p.name || 'person'}` : `Add ${d.kind === 'girl' ? 'Girl' : d.kind === 'guy' ? 'Guy' : 'Person'}`;
  root.append(
    h('div', { class: 'page-head' },
      h('a', { class: 'icon-btn', href: d.personId ? `#/people/${encodeURIComponent(d.personId)}` : '#/people', 'aria-label': 'Back', 'data-id': 'person.back', html: icon('back') }),
      h('h1', { dir: 'auto' }, title)),
    h('p', { class: 'note intro' }, d.personId ? 'Changes save into the same person. Originals stay exactly as received.' : 'Start with what you have. Fill in the rest later.'),
    h('div', { class: 'typepick', role: 'group', 'aria-label': 'Who is this?', 'data-id': 'person.kind' },
      ...KINDS.filter(([k]) => d.personId || !seekingKind(store.getPrefs()) || k === seekingKind(store.getPrefs())).map(([k, l]) => h('button', { type: 'button', 'aria-pressed': d.kind === k ? 'true' : 'false', 'data-id': 'person.kind-' + k, onClick: () => {
        d.kind = k; touch(); store.setPref('personKind', k); paint({ keepScroll: true });
      } }, l)),
      d.personId ? null : h('a', { href: '#/contacts/new', 'data-id': 'person.kind-shadchan' }, 'Shadchan')),
    h('div', { class: 'ap-sheet', 'data-id': 'person.sheet' },
      h('div', { class: 'ap-tabs', role: 'tablist', 'data-id': 'person.tabs' },
        ...TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': d.tab === k ? 'true' : 'false', 'data-id': 'person.tab-' + k, onClick: () => goTab(k) }, l))),
      d.tab === 'paste' ? pasteTab() : d.tab === 'basic' ? basicTab() : detailsTab()));
  if (keepScroll) window.scrollTo(0, y);
  if (d.jumpTo) { const id = d.jumpTo; d.jumpTo = null; setTimeout(() => jump(id), 60); }
}

function goTab(k) {
  if (k !== 'paste' && d.tab === 'paste') applyExtraction();
  d.tab = k; paint(); window.scrollTo(0, 0);
}

// Fill only empty fields from labelled lines. Never overwrite what the owner typed.
function applyExtraction() {
  const x = extract(d.sourceText);
  for (const k of ['name', 'age', 'city', 'occupation', 'about', 'looking', 'maxAge']) if (x[k] && !String(d.p[k] || '').trim()) { d.p[k] = x[k]; touch(); }
  if (x.languages?.length && !d.p.languages.length) { d.p.languages = x.languages; touch(); }
  const have = new Set(d.p.contactCards.map(c => store.phoneDigits(c.number)).filter(Boolean));
  const names = new Set(d.p.contactCards.map(c => c.name.toLowerCase()).filter(Boolean));
  for (const c of x.cards) {
    if (c.number ? have.has(store.phoneDigits(c.number)) : names.has(c.name.toLowerCase())) continue;
    const blank = d.p.contactCards.find(k => !k.number && !k.name && !k.contactId);
    if (blank) Object.assign(blank, c); else d.p.contactCards.push(card(c));
    touch();
  }
}

// ---------- Paste ----------
function pasteTab() {
  const ta = h('textarea', { class: 'input', id: 'ap-source', rows: 10, dir: 'auto', 'data-id': 'person.source-text',
    placeholder: 'Paste or type the full WhatsApp message or profile here…', onInput: (e) => { d.sourceText = e.target.value; touch(); } }, d.sourceText);
  const fileIn = h('input', { type: 'file', multiple: true, class: 'hidden', accept: '.pdf,.txt,.png,.jpg,.jpeg,.webp,.heic,.mp3,.m4a,.wav,.ogg,.doc,.docx', 'data-id': 'person.original-file',
    onChange: async (e) => { await addFiles(e.target.files, d.files); e.target.value = ''; paint({ keepScroll: true }); } });
  const prior = d.personId && d.existingSources.length;
  return h('div', { class: 'ap-body', 'data-id': 'person.paste' },
    prior ? h('div', { class: 'callout', 'data-id': 'person.versions' },
      `${d.existingSources.length} saved original${d.existingSources.length > 1 ? 's' : ''}. Anything you paste here is kept as a new version; earlier ones stay unchanged. `,
      h('button', { type: 'button', class: 'linkish', 'data-id': 'person.versions-view', onClick: viewOriginal }, 'View originals')) : null,
    d.fromSourceId ? h('div', { class: 'callout' }, 'Continuing an original you saved for later. It stays kept exactly as it was.') : null,
    h('div', { class: 'paste-row' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'person.paste-btn', onClick: pasteClipboard }, ico('file'), 'Paste a profile'),
      h('span', { class: 'note' }, 'Copies text straight from your clipboard. You can also type below.')),
    h('div', { class: 'field' }, h('label', { for: 'ap-source' }, 'Profile text'), ta),
    h('div', { class: 'dropzone', 'data-id': 'person.dropzone' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'person.attach-original', onClick: () => fileIn.click() }, 'Attach a file'),
      h('span', { class: 'note' }, 'PDF, screenshot, photo or audio'), fileIn,
      fileTags(d.files, 'person.original-file-remove'),
      d.existingAtts.filter(a => a.sourceId && !d.removedAttIds.includes(a.id)).length ? h('p', { class: 'note' }, 'Already kept with the original: ' + d.existingAtts.filter(a => a.sourceId).map(a => a.name).join(', ')) : null),
    h('details', { class: 'source-toggle', open: d.sender ? true : null, 'data-id': 'person.source-optional' },
      h('summary', {}, 'Source · optional'),
      senderField()),
    h('div', { class: 'ap-actions' },
      d.personId ? h('span', { class: 'spacer' }) : h('button', { type: 'button', class: 'btn', 'data-id': 'person.save-later', onClick: saveForLater }, 'Save for later'),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'person.next', onClick: () => goTab('basic') }, 'Next', ico('chevron'))),
    h('p', { class: 'note' }, 'Only clearly labelled lines (like “Name: …” or “Age: …”) are filled in for you. Nothing is guessed, and you can change everything.'));
}

async function pasteClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) { toast('The clipboard is empty'); return; }
    d.sourceText = d.sourceText.trim() ? d.sourceText.replace(/\s*$/, '\n\n') + text : text;
    touch(); paint({ keepScroll: true }); toast('Pasted');
  } catch {
    toast('This browser blocked the clipboard. Tap the box, then long-press and choose Paste.', 4500);
    root?.querySelector('#ap-source')?.focus();
  }
}

// ---------- Basic Info ----------
function basicTab() {
  const side = hasOriginal();
  let rows = d.p.contactCards.filter(c => c.number || !c.name);
  if (!rows.length) { d.p.contactCards.push(card({})); rows = d.p.contactCards.slice(-1); }
  return h('div', { class: 'ap-body', 'data-id': 'person.basic' },
    h('div', { class: 'basic-layout' + (side ? '' : ' full') },
      side ? h('aside', { class: 'orig-pane', 'data-id': 'person.original-pane' },
        h('div', { class: 'eyebrow' }, 'Original profile'),
        h('div', { class: 'orig-text', dir: 'auto' }, original() || [...d.files, ...d.existingAtts].map(f => f.name).join('\n'))) : null,
      h('section', { class: 'form-pane' },
        h('div', { class: 'sec-head' }, h('h2', {}, 'Basic Info'), h('span', { class: 'eyebrow' }, 'Quick review')),
        textField('Name', 'name', { autocomplete: 'off', placeholder: 'Full name' }, 'person.name'),
        h('div', { class: 'field' }, h('label', {}, 'Phone numbers'),
          h('div', { class: 'phone-cards' }, rows.map(c => phoneCard(c))),
          h('button', { type: 'button', class: 'linkish', 'data-id': 'person.add-number', onClick: () => { d.p.contactCards.push(card({})); paint({ keepScroll: true }); } }, 'Add another number'),
          h('p', { class: 'note' }, 'Each number stays separate. A parent’s, shadchan’s or reference’s number is never their own number.')),
        textField('Age (optional)', 'age', { inputmode: 'numeric', class: 'input short', placeholder: 'Age' }, 'person.age'))),
    h('div', { class: 'ap-actions' },
      h('button', { type: 'button', class: 'btn', 'data-id': 'person.save-finish', onClick: () => save({ then: 'finish' }) }, 'Save and Finish'),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'person.more-details', onClick: () => save({ then: 'details' }) }, 'Add More Details', ico('chevron'))));
}

function phoneCard(c) {
  const roleB = bubbles({ options: store.PHONE_ROLES, selected: [c.role], multi: false, dataId: 'person.phone-role',
    onChange: (v) => { c.role = v || 'unknown'; touch(); } });
  return h('div', { class: 'phone-card', 'data-id': 'person.phone-card' },
    h('input', { class: 'input', type: 'tel', inputmode: 'tel', value: c.number, placeholder: 'Phone number', 'aria-label': 'Phone number', 'data-id': 'person.phone',
      onInput: (e) => { c.number = e.target.value; touch(); }, onChange: (e) => { c.number = store.cleanPhone(e.target.value); e.target.value = c.number; } }),
    h('div', { class: 'owner-q' }, 'Whose number is this?'),
    roleB);
}

// ---------- Detailed Info ----------
function detailsTab() {
  const visible = ctx.cats.filter(c => !c.hidden);
  const jumps = [...visible.flatMap(c => c.key === 'contacts' ? [[c.key, c.jump || c.name], ['references', 'References']] : [[c.key, c.jump || c.name]]), ['attachments', 'Attached items']];
  return h('div', { class: 'ap-body', 'data-id': 'person.details' },
    h('div', { class: 'details-top', 'data-id': 'person.details-top' },
      h('div', { class: 'details-title' }, h('h2', {}, 'Detailed Info'),
        hasOriginal() ? h('button', { type: 'button', class: 'btn small', 'data-id': 'person.view-original', onClick: viewOriginal }, ico('file'), 'View Original') : null),
      h('nav', { class: 'jumpnav', 'aria-label': 'Jump to category', 'data-id': 'person.jumpnav' },
        jumps.map(([k, l]) => h('button', { type: 'button', class: 'jump', 'data-id': 'person.jump-' + k, onClick: () => jump(k) }, l)))),
    ...visible.flatMap(c => c.key === 'contacts' ? [section(c), referencesSection()] : [section(c)]),
    attachmentsSection(),
    newCategory(),
    h('div', { class: 'form-foot', 'data-id': 'person.footer' },
      h('button', { type: 'button', class: 'linkish manage', 'data-id': 'person.manage-choices', onClick: async () => {
        if (await managePersonForm()) { [ctx.choices, ctx.cats] = await Promise.all([store.getChoices(), store.getPersonCategories()]); paint({ keepScroll: true }); }
      } }, 'Manage categories & choices'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn', 'data-id': 'person.cancel', onClick: cancel }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'person.save', onClick: () => save({ then: 'finish' }) }, d.personId ? 'Save changes' : 'Save person')));
}

function jump(key) {
  const el = root?.querySelector(`[data-sec="${CSS.escape(key)}"]`);
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function block(cat, ...kids) {
  return h('section', { class: 'ap-sec', 'data-sec': cat.key, 'data-id': 'person.sec-' + cat.key }, h('h3', { class: 'ap-sec-title', dir: 'auto' }, cat.name), ...kids);
}

function section(cat) {
  switch (cat.key) {
    case 'about': return block(cat,
      areaField('About the Person', 'about', 'Personality, background, interests…', 'person.about'),
      areaField('What are they looking for?', 'looking', 'Describe what they are looking for…', 'person.looking'),
      h('div', { class: 'inline-field' }, h('label', { for: 'ap-maxAge' }, 'Up to what age?'),
        h('input', { class: 'input tiny', id: 'ap-maxAge', type: 'number', min: 18, max: 120, inputmode: 'numeric', value: d.p.maxAge || '', placeholder: 'Age', 'data-id': 'person.max-age', onInput: (e) => { d.p.maxAge = e.target.value; touch(); } })));
    case 'personal': return block(cat,
      textField('Occupation', 'occupation', {}, 'person.occupation'),
      cityField(),
      h('div', { class: 'field' }, h('label', {}, 'Languages spoken'), choiceGroup('languages', 'person.languages')));
    case 'contacts': return block(cat,
      h('div', { class: 'contact-cards', 'data-id': 'person.contact-cards' }, contactCards((c) => c.role !== 'reference')),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person.add-contact', onClick: () => { const k = card({}); d.p.contactCards.push(k); d.editCard = k.id; paint({ keepScroll: true }); } }, 'Add a contact'),
      senderField(),
      h('p', { class: 'note' }, 'The sender and the shadchan may be the same person, but the app does not assume so.'));
    case 'known': return block(cat,
      ovalRows({ options: [...KNOW_CONTACT, ...KNOW_FLAGS], selected: d.p.know, dataId: 'person.know', onToggle: (v, on, sel) => {
        let next = on ? [...sel, v] : sel.filter(x => x !== v);
        if (on && v === 'Never spoke') next = next.filter(x => x !== 'Talked by phone' && x !== 'Met in person');
        if (on && (v === 'Talked by phone' || v === 'Met in person')) next = next.filter(x => x !== 'Never spoke');
        d.p.know = next; touch(); return next;
      } }),
      h('div', { class: 'inline-field' }, h('label', { for: 'ap-years' }, 'Years known'),
        h('input', { class: 'input tiny', id: 'ap-years', type: 'number', min: 0, max: 99, inputmode: 'numeric', value: d.p.yearsKnown || '', 'data-id': 'person.years-known', onInput: (e) => { d.p.yearsKnown = e.target.value; touch(); } })),
      areaField('How do you know them?', 'howKnow', 'Roommate, coworker, neighbour…', 'person.how-know'));
    case 'status': return block(cat, choiceGroup('pStatus', 'person.status'));
    case 'religious': return block(cat,
      sub('Religious Level', choiceGroup('pLevel', 'person.religious-level')),
      sub('Tzniut', choiceGroup('pTzniut', 'person.tzniut')),
      sub('Religious Background', choiceGroup('pBackground', 'person.religious-background')),
      choiceGroup('pReligious', 'person.religious-rows'),
      areaField('Other religious details', 'religiousOther', '', 'person.religious-other'));
    case 'lifestyle': return block(cat,
      choiceGroup('pTraits', 'person.traits'),
      h('div', { class: 'subcat' }, h('h4', {}, 'Body Type'), choiceGroup('pBody', 'person.body-type')));
    default: {
      if (cat.builtin) return null;
      const subAdder = inlineAdder('subcategory', async (name) => {
        const subs = cat.subs || (cat.subs = []);
        if (subs.some(s => s.name.toLowerCase() === name.toLowerCase())) { toast('That subcategory already exists'); return; }
        subs.push({ key: cat.key + '_' + Date.now().toString(36), name });
        await store.savePersonCategories(ctx.cats); paint({ keepScroll: true });
      }, 'person.add-subcategory', true);
      return block(cat,
        choiceGroup(cat.key, 'person.custom-' + cat.key),
        ...(cat.subs || []).map(s => h('div', { class: 'subcat' }, h('h4', { dir: 'auto' }, s.name), choiceGroup(s.key, 'person.custom-' + s.key))),
        h('div', {}, subAdder.btn, subAdder.holder));
    }
  }
}
const sub = (label, el) => h('div', { class: 'field' }, h('label', {}, label), el);

function textField(label, k, attrs = {}, dataId) {
  const id = 'ap-' + k;
  return h('div', { class: 'field' }, h('label', { for: id }, label),
    h('input', { class: 'input', id, value: d.p[k] ?? '', dir: 'auto', 'data-id': dataId, ...attrs, onInput: (e) => { d.p[k] = e.target.value; touch(); } }));
}
function areaField(label, k, placeholder, dataId) {
  const id = 'ap-' + k;
  const t = h('textarea', { class: 'input grow', id, rows: 2, dir: 'auto', placeholder, 'data-id': dataId, onInput: (e) => { d.p[k] = e.target.value; touch(); grow(e.target); } }, d.p[k] || '');
  setTimeout(() => grow(t), 0); setTimeout(() => grow(t), 400);
  return h('div', { class: 'field' }, h('label', { for: id }, label), t);
}
function grow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 480) + 'px'; }

// Recently used one-tap suggestions (newest first).
function recent(values, n = 4) {
  const out = [];
  for (const v of values) if (v && !out.some(x => x.toLowerCase() === v.toLowerCase())) out.push(v);
  return out.slice(0, n);
}
function byNewest(list) { return [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }

function cityField() {
  const input = h('input', { class: 'input', id: 'ap-city', value: d.p.city || '', dir: 'auto', autocomplete: 'off', 'data-id': 'person.city', onInput: (e) => { d.p.city = e.target.value; touch(); } });
  const cities = recent([...byNewest(ctx.people).map(p => p.city), ...byNewest(ctx.contacts).map(c => c.city)]);
  return h('div', { class: 'field' }, h('label', { for: 'ap-city' }, 'City'), input,
    cities.length ? h('div', { class: 'bubbles quick', 'data-id': 'person.city-recent' }, cities.map(c => h('button', { type: 'button', class: 'bubble', dir: 'auto',
      onClick: () => { d.p.city = c; input.value = c; touch(); } }, c))) : null);
}

function senderField() {
  const listId = 'ap-sender-list';
  const input = h('input', { class: 'input', id: 'ap-sender', value: d.sender, dir: 'auto', autocomplete: 'off', list: listId, placeholder: 'Sender or source', 'data-id': 'person.sender',
    onInput: (e) => { d.sender = e.target.value; touch(); const m = ctx.contacts.find(c => store.displayName(c) === d.sender.trim()); d.senderContactId = m ? m.id : null; linked.textContent = linkText(); } });
  const linkText = () => d.senderContactId && ctx.contactsById.get(d.senderContactId) ? 'Linked to this contact in Contacts.' : '';
  const linked = h('p', { class: 'note', 'data-id': 'person.sender-linked' }, linkText());
  const named = [...ctx.srcs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(s => [s.sender, s.senderContactId]);
  const seen = new Set(); const quick = [];
  for (const [name, cid] of named) if (name && !seen.has(name.toLowerCase()) && quick.length < 4) { seen.add(name.toLowerCase()); quick.push([name, cid]); }
  return h('div', { class: 'field' }, h('label', { for: 'ap-sender' }, 'Who sent the profile?'), input,
    h('datalist', { id: listId }, ctx.contacts.map(c => h('option', { value: store.displayName(c) }))),
    quick.length ? h('div', { class: 'bubbles quick', 'data-id': 'person.sender-recent' }, quick.map(([n, cid]) => h('button', { type: 'button', class: 'bubble', dir: 'auto', onClick: () => {
      d.sender = n; d.senderContactId = cid && ctx.contactsById.has(cid) ? cid : null; input.value = n; linked.textContent = linkText(); touch();
    } }, n))) : null,
    linked);
}

// ----- bubble groups with the three dots after the choices -----
function valueOf(key) {
  if (key === 'languages') return d.p.languages;
  const v = d.p.answers[key];
  return listType(key) === 'single' ? (v ? [v] : []) : (v || []);
}
function setValue(key, val) {
  if (key === 'languages') d.p.languages = val;
  else d.p.answers[key] = listType(key) === 'single' ? (val[0] || '') : val;
  touch();
}
function optionsFor(key) {
  const only = GIRLS_ONLY[key] || [];
  const vis = (ctx.choices[key] || []).filter(o => !o.hidden).map(o => o.v).filter(v => !only.includes(v) || d.kind === 'girl');
  const cur = valueOf(key).filter(v => !vis.includes(v)); // saved values stay visible even if hidden or deleted
  return [...vis, ...cur];
}

function choiceGroup(key, dataId) {
  const type = listType(key);
  const label = key === 'languages' ? 'language' : type === 'rows' ? 'detail' : 'option';
  const add = inlineAdder(label, async (name) => {
    const real = await addChoice(key, name);
    ctx.choices = await store.getChoices();
    const cur = valueOf(key);
    if (!cur.includes(real)) setValue(key, type === 'single' ? [real] : [...cur, real]);
    paint({ keepScroll: true });
  }, dataId + '-more');
  if (type === 'rows') {
    return h('div', { class: 'rows-group' },
      ovalRows({ options: optionsFor(key), selected: valueOf(key), dataId, onToggle: (v, on, sel) => {
        let next = on ? [...sel, v] : sel.filter(x => x !== v);
        for (const pair of EXCLUSIVE[key] || []) if (on && pair.includes(v)) next = next.filter(x => x === v || !pair.includes(x));
        setValue(key, next); return next;
      } }),
      h('div', { class: 'addend' }, add.btn), add.holder);
  }
  return h('div', { class: 'bubble-group' },
    bubbles({ options: optionsFor(key).map(v => [v, v]), selected: valueOf(key), multi: type === 'multi', dataId, extra: add.btn,
      onChange: (v) => setValue(key, type === 'multi' ? v : (v ? [v] : [])) }),
    add.holder);
}

// One-column soft oval rows: empty circle = not recorded, tick + highlight = yes.
function ovalRows({ options, selected, dataId, onToggle }) {
  let sel = [...selected];
  const wrap = h('div', { class: 'oval-rows', role: 'group', 'data-id': dataId });
  const draw = () => {
    wrap.innerHTML = '';
    for (const v of options) {
      const on = sel.includes(v);
      wrap.append(h('button', { type: 'button', class: 'oval', 'aria-pressed': on ? 'true' : 'false', dir: 'auto', onClick: () => { sel = onToggle(v, !on, sel); draw(); } },
        h('span', { class: 'tick', html: on ? icon('check') : '' }), h('span', {}, v)));
    }
  };
  draw();
  return wrap;
}

// The three dots open a small fillable bubble right there — no new screen.
function inlineAdder(what, onSave, dataId, asLink = false) {
  const holder = h('div', { class: 'adder hidden', 'data-id': dataId + '-box' });
  const btn = asLink
    ? h('button', { type: 'button', class: 'linkish', 'data-id': dataId }, `Add ${what}`)
    : h('button', { type: 'button', class: 'bubble more', 'aria-label': `Add another ${what}`, title: `Add another ${what}`, 'data-id': dataId, html: icon('more') });
  const close = () => { holder.classList.add('hidden'); holder.innerHTML = ''; };
  btn.addEventListener('click', () => {
    if (!holder.classList.contains('hidden')) { close(); return; }
    const input = h('input', { class: 'input', dir: 'auto', placeholder: `New ${what}`, 'aria-label': `New ${what}` });
    const go = async () => { const v = input.value.trim(); if (!v) { toast('Type something first'); return; } close(); await onSave(v); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } if (e.key === 'Escape') close(); });
    holder.append(input, h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn small primary', onClick: go }, 'Save'),
      h('button', { type: 'button', class: 'btn small', onClick: close }, 'Cancel')));
    holder.classList.remove('hidden'); input.focus();
  });
  return { btn, holder };
}

// ----- Contacts & Source: separate rounded cards with a small pencil -----
// References get their own section (owner request): numbers marked "Reference" in Basic Info show here.
function referencesSection() {
  return block({ key: 'references', name: 'References' },
    h('div', { class: 'contact-cards', 'data-id': 'person.reference-cards' }, contactCards((c) => c.role === 'reference', 'No references yet.')),
    h('button', { type: 'button', class: 'btn small', 'data-id': 'person.add-reference', onClick: () => { const k = card({ role: 'reference' }); d.p.contactCards.push(k); d.editCard = k.id; paint({ keepScroll: true }); } }, 'Add a reference'));
}

function contactCards(keep = () => true, empty = 'No contacts yet. Add one below.') {
  const shown = d.p.contactCards.filter(c => keep(c) && (c.number || c.name || c.email || c.contactId || d.editCard === c.id));
  if (!shown.length) return [h('p', { class: 'note' }, empty)];
  return shown.map(c => {
    const linked = c.contactId && ctx.contactsById.get(c.contactId);
    const name = c.name || (c.role === 'person' ? d.p.name : '');
    return h('div', { class: 'contact-card', 'data-id': 'person.contact-card' },
      h('div', { class: 'cc-summary' },
        h('span', { class: 'avatar small', html: icon(c.role === 'person' ? 'profile' : 'contacts') }),
        h('div', { class: 'cc-id' },
          h('small', {}, store.phoneRoleLabel(c.role)),
          h('strong', { dir: 'auto' }, name || (c.role === 'unknown' ? 'Unidentified contact' : 'Name not provided')),
          h('small', { class: 'mono' }, c.number || 'No phone recorded'),
          c.email ? h('small', {}, c.email) : null,
          linked ? h('small', { class: 'linked' }, 'In Contacts: ', store.displayName(linked)) : null),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit contact', title: 'Edit contact', 'data-id': 'person.contact-edit', html: icon('edit'),
          onClick: () => { d.editCard = d.editCard === c.id ? null : c.id; paint({ keepScroll: true }); } })),
      d.editCard === c.id ? cardEditor(c) : null);
  });
}

function cardEditor(c) {
  const showEmail = c.email || d.emailFor === c.id;
  const match = !c.contactId && findContactMatch(c);
  return h('div', { class: 'cc-edit', 'data-id': 'person.contact-editor' },
    h('div', { class: 'field' }, h('label', {}, 'Name'),
      h('input', { class: 'input', value: c.name, dir: 'auto', placeholder: 'Name (optional)', 'data-id': 'person.contact-name', onInput: (e) => { c.name = e.target.value; touch(); } })),
    h('div', { class: 'field' }, h('label', {}, 'Phone number'),
      h('input', { class: 'input', type: 'tel', inputmode: 'tel', value: c.number, placeholder: 'Phone', 'data-id': 'person.contact-phone',
        onInput: (e) => { c.number = e.target.value; touch(); }, onChange: (e) => { c.number = store.cleanPhone(e.target.value); e.target.value = c.number; } })),
    showEmail
      ? h('div', { class: 'field' }, h('label', {}, 'Email (optional)'),
          h('div', { class: 'email-row' },
            h('input', { class: 'input', type: 'email', inputmode: 'email', value: c.email, 'data-id': 'person.contact-email', onInput: (e) => { c.email = e.target.value; touch(); } }),
            h('button', { type: 'button', class: 'linkish', onClick: () => { c.email = ''; d.emailFor = null; touch(); paint({ keepScroll: true }); } }, 'Remove')))
      : h('button', { type: 'button', class: 'linkish', 'data-id': 'person.contact-add-email', onClick: () => { d.emailFor = c.id; paint({ keepScroll: true }); } }, 'Add email…'),
    h('div', { class: 'field' }, h('label', {}, 'Who is this?'),
      bubbles({ options: store.PHONE_ROLES, selected: [c.role], multi: false, dataId: 'person.contact-role', onChange: (v) => { c.role = v || 'unknown'; touch(); } })),
    linkArea(c, match),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person.contact-remove', onClick: () => {
        d.p.contactCards = d.p.contactCards.filter(x => x !== c); d.editCard = null; touch(); paint({ keepScroll: true });
      } }, 'Remove'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': 'person.contact-done', onClick: () => { d.editCard = null; paint({ keepScroll: true }); } }, 'Done')));
}

function findContactMatch(c) {
  const dg = store.phoneDigits(c.number);
  const nm = (c.name || '').trim().toLowerCase();
  return ctx.contacts.find(x => (dg.length >= 7 && store.phoneDigits(x.phone) === dg) || (nm && store.displayName(x).toLowerCase() === nm || nm && [x.firstName, x.lastName].filter(Boolean).join(' ').toLowerCase() === nm)) || null;
}

// Link to the one Contacts record instead of creating a second copy of a shadchan.
function linkArea(c, match) {
  if (c.role === 'person') return null;
  const linked = c.contactId && ctx.contactsById.get(c.contactId);
  if (linked) return h('div', { class: 'link-box', 'data-id': 'person.contact-link' },
    h('span', {}, 'Linked to ', h('a', { href: `#/contacts/${encodeURIComponent(linked.id)}` }, store.displayName(linked)), ' in Contacts.'),
    h('button', { type: 'button', class: 'linkish', onClick: () => { c.contactId = null; touch(); paint({ keepScroll: true }); } }, 'Unlink'));
  const pick = h('input', { class: 'input', list: 'ap-contact-list', dir: 'auto', placeholder: 'Type a name from Contacts', 'aria-label': 'Link to someone in Contacts' });
  return h('div', { class: 'link-box', 'data-id': 'person.contact-link' },
    match ? h('p', {}, 'This looks like ', h('b', { dir: 'auto' }, store.displayName(match)), ' in your Contacts. ',
      h('button', { type: 'button', class: 'linkish', 'data-id': 'person.contact-link-match', onClick: () => linkTo(c, match) }, 'Link to them')) : null,
    h('div', { class: 'link-pick' }, pick,
      h('datalist', { id: 'ap-contact-list' }, ctx.contacts.map(x => h('option', { value: store.displayName(x) }))),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person.contact-link-pick', onClick: () => {
        const m = ctx.contacts.find(x => store.displayName(x) === pick.value.trim());
        if (!m) { toast('Pick a name from the list'); return; }
        linkTo(c, m);
      } }, 'Link')),
    c.name.trim() ? h('button', { type: 'button', class: 'linkish', 'data-id': 'person.contact-to-contacts', onClick: () => addToContacts(c) }, 'Save as a new contact in Contacts') : null);
}

function linkTo(c, contact) {
  c.contactId = contact.id;
  if (!c.name) c.name = store.displayName(contact);
  if (!c.number && contact.phone) c.number = contact.phone;
  touch(); paint({ keepScroll: true }); toast('Linked');
}

async function addToContacts(c) {
  const full = c.name.trim().replace(/\s+/g, ' ');
  const parts = full.split(' ');
  const role = c.role === 'shadchan' ? 'shadchan' : c.role === 'reference' ? 'reference' : (c.role === 'mother' || c.role === 'father') ? 'family' : 'friend';
  const rec = await store.contacts.save({ name: full, firstName: parts[0], lastName: parts.slice(1).join(' '), title: '', phone: store.cleanPhone(c.number), email: c.email || '',
    city: '', roles: [role], languages: [], communities: [], status: 'none', pinned: false, folderId: null, source: d.sender ? `From a profile sent by ${d.sender}` : 'Added from Add Person' });
  ctx.contacts.push(rec); ctx.contactsById.set(rec.id, rec);
  c.contactId = rec.id; touch(); paint({ keepScroll: true }); toast(`${full} added to Contacts`);
}

// ----- attachments + new category -----
function attachmentsSection() {
  const fileIn = h('input', { type: 'file', multiple: true, class: 'hidden', 'data-id': 'person.file-input',
    onChange: async (e) => { await addFiles(e.target.files, d.newAtts); e.target.value = ''; paint({ keepScroll: true }); } });
  const kept = d.existingAtts.filter(a => !d.removedAttIds.includes(a.id));
  const all = [...kept.map(a => ({ a, saved: true })), ...d.files.map(a => ({ a, list: d.files })), ...d.newAtts.map(a => ({ a, list: d.newAtts }))];
  return h('section', { class: 'ap-sec', 'data-sec': 'attachments', 'data-id': 'person.sec-attachments' },
    h('h3', { class: 'ap-sec-title' }, 'Attached items'),
    all.length ? h('div', { class: 'att-list' }, all.map(({ a, saved, list }) => h('div', { class: 'att-row' }, ico('file'),
      h('span', { dir: 'auto', class: 'att-name' }, a.name), h('span', { class: 'note' }, a.sourceId || list === d.files ? 'original' : ''),
      h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'person.attachment-remove', onClick: () => {
        if (saved) d.removedAttIds.push(a.id); else list.splice(list.indexOf(a), 1);
        touch(); paint({ keepScroll: true });
      } }, 'Remove'))))
      : h('p', { class: 'note' }, 'No files attached.'),
    fileIn,
    h('button', { type: 'button', class: 'btn', 'data-id': 'person.attach-btn', onClick: () => fileIn.click() }, ico('file'), 'Attach a file'));
}

function newCategory() {
  const add = inlineAdder('category', async (name) => {
    if (ctx.cats.some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('That category already exists'); return; }
    const key = 'cat_' + Date.now().toString(36);
    ctx.cats.push({ key, name, builtin: false, hidden: false, subs: [] });
    await store.savePersonCategories(ctx.cats);
    paint({ keepScroll: true }); setTimeout(() => jump(key), 60);
  }, 'person.new-category', true);
  add.btn.textContent = 'New category …';
  return h('div', { class: 'new-cat', 'data-id': 'person.new-category-row' }, add.btn, add.holder);
}

function fileTags(list, dataId) {
  if (!list.length) return null;
  return h('div', { class: 'file-tags' }, list.map((f, i) => h('span', { class: 'chip file-tag', dir: 'auto' }, f.name,
    h('button', { type: 'button', class: 'linkish', 'aria-label': 'Remove file', 'data-id': dataId, onClick: () => { list.splice(i, 1); paint({ keepScroll: true }); } }, 'Remove'))));
}

async function addFiles(files, list) {
  for (const f of files) {
    if (f.size > MAX_FILE) { toast(`${f.name} is larger than 5 MB — not attached`); continue; }
    list.push({ name: f.name, type: f.type, size: f.size, dataUrl: await readAsDataURL(f) });
    touch();
  }
}
function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
}

// Read-only, scrollable, dismissible. Closing returns exactly where you were.
function viewOriginal() {
  const items = [];
  if (d.sourceText.trim() || d.files.length) items.push({ label: 'This intake · not saved yet', text: d.sourceText, files: d.files });
  for (const s of [...d.existingSources].reverse()) items.push({ label: [dateOnly(s.receivedAt || s.createdAt), s.sender].filter(Boolean).join(' · '), text: s.text, files: d.existingAtts.filter(a => a.sourceId === s.id) });
  if (d.fromSourceId && !d.existingSources.length) items.push({ label: 'Saved for later', text: '', files: d.existingAtts.filter(a => a.sourceId === d.fromSourceId) });
  sheet({ title: items.length > 1 ? 'Originals' : 'Original profile', dataId: 'person.original-view', className: 'tall',
    body: items.map((it, i) => h('div', { class: 'orig-item' },
      h('div', { class: 'eyebrow' }, it.label, items.length > 1 && i === items.length - 1 ? ' · earliest' : ''),
      it.text ? h('div', { class: 'orig-text', dir: 'auto' }, it.text) : null,
      it.files?.length ? h('p', { class: 'note' }, 'Files: ' + it.files.map(f => f.name).join(', ')) : null)) });
}

// ---------- saving ----------
async function cancel() {
  if (d.dirty && !(await confirmDialog({ title: 'Discard changes?', text: 'What you typed in this form will be lost. Saved people and originals are not touched.', ok: 'Discard', danger: true, dataId: 'person.discard-dialog' }))) return;
  const back = d.personId ? `/people/${encodeURIComponent(d.personId)}` : '/people';
  drafts.delete(d.key); navigate(back);
}

async function saveForLater() {
  if (!d.sourceText.trim() && !d.files.length) { toast('Paste some information or attach a file first'); return; }
  const prev = d.fromSourceId ? await store.sources.get(d.fromSourceId) : null;
  if (prev && prev.text === d.sourceText && !d.files.length) {
    if (prev.sender !== d.sender) await store.sources.save({ ...prev, sender: d.sender, senderContactId: d.senderContactId });
    toast('Already saved for later'); drafts.delete(d.key); navigate('/people'); return;
  }
  const src = await store.sources.save({ personId: null, text: d.sourceText, sender: d.sender.trim(), senderContactId: d.senderContactId, receivedAt: store.now(), kind: d.kind });
  for (const f of d.files) await store.attachments.save({ ...f, personId: null, contactId: null, sourceId: src.id });
  drafts.delete(d.key);
  toast('Saved for later — find it in Ideas');
  navigate('/people');
}

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function save({ then }) {
  const p = d.p;
  const own = p.contactCards.find(c => c.role === 'person' && c.number.trim());
  if (!p.name.trim() && !own) {
    toast(d.personId ? 'Write a name or their own phone number first' : 'Write a name or their own phone number — or use Save for later on the Paste tab', 4500);
    if (d.tab !== 'basic') { d.tab = 'basic'; paint(); }
    root?.querySelector('#ap-name')?.focus();
    return;
  }
  const cards = p.contactCards.filter(c => c.number.trim() || c.name.trim() || c.email.trim() || c.contactId)
    .map(c => ({ ...c, number: store.cleanPhone(c.number), name: c.name.trim(), email: c.email.trim() }));
  const answerLabels = { ...(p.answerLabels || {}) };
  for (const cat of ctx.cats) for (const k of listsOf(cat)) if (!LISTS[k]) answerLabels[k] = cat.key === k ? cat.name : `${cat.name} · ${(cat.subs || []).find(s => s.key === k)?.name || ''}`;
  const rec = {
    ...p, id: d.personId || undefined, kind: d.kind, name: p.name.trim().replace(/\s+/g, ' '), age: String(p.age || '').trim(),
    city: (p.city || '').trim(), occupation: (p.occupation || '').trim(), contactCards: cards, answerLabels,
    sender: d.sender.trim(), senderContactId: d.senderContactId,
    contactIds: [...new Set([...cards.map(c => c.contactId), d.senderContactId].filter(Boolean))],
  };
  let target = null;
  if (!d.personId) {
    const dup = ctx.people.find(x => (rec.name && norm(x.name) === norm(rec.name)) ||
      (own && (x.contactCards || []).some(c => c.role === 'person' && store.phoneDigits(c.number) === store.phoneDigits(own.number) && store.phoneDigits(own.number).length >= 7)));
    if (dup) {
      const res = await sheet({ title: 'Already in Ideas?', dataId: 'person.duplicate',
        body: [h('p', { dir: 'auto' }, `${dup.name || 'Someone'}${dup.age ? ', ' + dup.age : ''}${dup.city ? ' · ' + dup.city : ''} may be the same person.`),
          h('p', { class: 'note' }, 'Adding this as an updated version keeps one person with all originals. Nothing is merged automatically: only empty fields are filled in.')],
        actions: [{ id: 'open', label: 'Open existing' }, { id: 'version', label: 'Add as updated version' }, { id: 'new', label: 'Save as new person', primary: true }] });
      if (!res) return;
      if (res === 'open') { navigate('/people/' + encodeURIComponent(dup.id)); return; }
      if (res === 'version') target = dup;
    }
  }
  let saved;
  if (target) {
    const merged = { ...target };
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'id' || k === 'contactCards' || k === 'answers' || k === 'contactIds') continue;
      const empty = merged[k] == null || merged[k] === '' || (Array.isArray(merged[k]) && !merged[k].length);
      if (empty && v != null && v !== '' && !(Array.isArray(v) && !v.length)) merged[k] = v;
    }
    const haveNums = new Set((merged.contactCards || []).map(c => store.phoneDigits(c.number)).filter(Boolean));
    merged.contactCards = [...(merged.contactCards || []), ...cards.filter(c => !c.number || !haveNums.has(store.phoneDigits(c.number)))];
    merged.answers = { ...rec.answers, ...(merged.answers || {}) };
    merged.contactIds = [...new Set([...(merged.contactIds || []), ...rec.contactIds])];
    saved = await store.people.save(merged);
  } else {
    if (!rec.id) delete rec.id;
    saved = await store.people.save(rec);
  }
  // originals: kept word for word; a changed or new text becomes another version
  const prev = d.fromSourceId ? await store.sources.get(d.fromSourceId) : null;
  if (prev) await store.sources.save({ ...prev, personId: saved.id });
  let src = null;
  if ((d.sourceText.trim() && (!prev || prev.text !== d.sourceText)) || d.files.length) {
    src = await store.sources.save({ personId: saved.id, text: d.sourceText, sender: d.sender.trim(), senderContactId: d.senderContactId, receivedAt: store.now(), kind: d.kind });
  }
  if (prev) for (const a of d.existingAtts) if (a.sourceId === prev.id && !d.removedAttIds.includes(a.id)) await store.attachments.save({ ...a, personId: saved.id });
  for (const f of d.files) await store.attachments.save({ ...f, personId: saved.id, contactId: null, sourceId: (src || prev)?.id || null });
  for (const f of d.newAtts) await store.attachments.save({ ...f, personId: saved.id, contactId: null, sourceId: null });
  for (const id of d.removedAttIds) await store.attachments.remove(id);

  drafts.delete(d.key);
  toast(target ? `Added as a new version of ${saved.name}` : d.personId ? 'Saved' : `${saved.name || 'Person'} saved`);
  if (then === 'details') {
    const key = 'edit:' + saved.id;
    drafts.delete(key);
    const next = await makeDraft({ key, editing: true, params: { id: saved.id }, path: `/people/${saved.id}/edit` });
    next.tab = 'details'; drafts.set(key, next);
    if (location.hash === `#/people/${encodeURIComponent(saved.id)}/edit`) { d = next; ctx.people = await store.people.list(); paint(); window.scrollTo(0, 0); }
    else navigate(`/people/${encodeURIComponent(saved.id)}/edit`, { replace: true });
  } else navigate('/people/' + encodeURIComponent(saved.id));
}

// ---------- My Profile mode (#/profile/edit) ----------
// The same Detailed Info form, tailored to the owner's own profile (owner request, tweak mode):
// no Paste / Basic tabs, no "Know them", no sender or shadchan; adds my Contact, References,
// extra facts and extra sections. Saves into the one profile record (store.profile "me").
async function makeMeDraft() {
  const prof = await PD.loadProfile();
  const v = PD.view(prof.me, prof.me?.lang || 'en');
  const clone = (x) => JSON.parse(JSON.stringify(x ?? null));
  return {
    key: 'me', me: true, href: '#/profile/edit', personId: null, tab: 'details', kind: store.getPrefs().iAm || '', dirty: false,
    sourceText: '', sender: '', senderContactId: null, files: [], existingSources: [], existingAtts: [], newAtts: [], removedAttIds: [],
    rec: prof.me,
    p: { name: v.name || '', age: v.age || '', city: v.city || '', occupation: v.occupation || '', intro: v.intro || '',
      languages: clone(v.languages) || [], about: v.about || '', looking: v.looking || '', maxAge: v.maxAge || '',
      answers: clone(v.answers) || {}, answerLabels: clone(v.answerLabels) || {}, religiousOther: v.religiousOther || '', contactCards: [],
      facts: clone(v.customFacts) || [], contact: clone(v.contact), references: clone(v.references) || [], sections: clone(v.sections) || [] },
  };
}

const ME_SKIP = new Set(['contacts', 'known']);
function paintMe() {
  const visible = ctx.cats.filter(c => !c.hidden && !ME_SKIP.has(c.key));
  const jumps = [['me-basic', 'Basics'], ...visible.map(c => [c.key, c.key === 'about' ? 'About me' : (c.jump || c.name)]),
    ['me-facts', 'More facts'], ['me-contact', 'Contact'], ['me-refs', 'References'], ['me-sections', 'Sections']];
  const cancel = async () => {
    if (d.dirty && !(await confirmDialog({ title: 'Leave without saving?', text: 'Your changes on this page are lost.', ok: 'Leave', danger: true, dataId: 'me-form.leave-dialog' }))) return;
    drafts.delete('me'); navigate('/profile');
  };
  // Focus mode: no app bars; one slim sticky header (back · title · Save) with the jump links under it.
  root.append(
    h('div', { class: 'me-top', 'data-id': 'me-form.top' },
      h('div', { class: 'me-top-row' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Back to My Profile', 'data-id': 'me-form.back', html: icon('back'), onClick: cancel }),
        h('h1', {}, 'Edit profile'),
        h('button', { type: 'button', class: 'btn small primary', 'data-id': 'me-form.save-top', onClick: saveMe }, 'Save')),
      h('nav', { class: 'jumpnav', 'aria-label': 'Jump to section', 'data-id': 'me-form.jumpnav' },
        jumps.map(([k, l]) => h('button', { type: 'button', class: 'jump', 'data-id': 'me-form.jump-' + k, onClick: () => jump(k) }, l)))),
    h('div', { class: 'ap-body me-body', 'data-id': 'me-form.body' },
      block({ key: 'me-basic', name: 'Basics' },
        h('div', { class: 'typepick me-iam', role: 'group', 'aria-label': 'I am a', 'data-id': 'me-form.i-am' },
          ...KINDS.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': d.kind === k ? 'true' : 'false', 'data-id': 'me-form.i-am-' + k, onClick: () => {
            d.kind = k; touch(); store.setPref('iAm', k); paint({ keepScroll: true });
          } }, 'I am a ' + l.toLowerCase()))),
        textField('Name', 'name', { autocomplete: 'off', placeholder: 'Full name' }, 'me-form.name'),
        textField('Age', 'age', { inputmode: 'numeric', class: 'input short' }, 'me-form.age'),
        areaField('One-line introduction', 'intro', 'e.g. An architect who loves good conversations…', 'me-form.intro')),
      ...visible.map(c => c.key === 'about' ? meAbout(c) : section(c)),
      meFacts(), meContact(), meRefs(), meSections(),
      newCategory(),
      h('div', { class: 'me-foot', 'data-id': 'me-form.footer' },
        h('button', { type: 'button', class: 'linkish manage', 'data-id': 'me-form.manage-choices', onClick: async () => {
          if (await managePersonForm()) { [ctx.choices, ctx.cats] = await Promise.all([store.getChoices(), store.getPersonCategories()]); paint({ keepScroll: true }); }
        } }, 'Manage categories & choices'),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', 'data-id': 'me-form.cancel', onClick: cancel }, 'Cancel'),
        h('button', { type: 'button', class: 'btn primary', 'data-id': 'me-form.save', onClick: saveMe }, 'Save profile'))));
  if (d.jumpTo) { const id = d.jumpTo; d.jumpTo = null; setTimeout(() => jump(id), 60); }
}
function meAbout(cat) {
  return block(cat,
    areaField('About me', 'about', 'Personality, background, interests…', 'me-form.about'),
    areaField('What I’m looking for', 'looking', 'Describe who you are looking for…', 'me-form.looking'),
    h('div', { class: 'inline-field' }, h('label', { for: 'ap-maxAge' }, 'Up to what age?'),
      h('input', { class: 'input tiny', id: 'ap-maxAge', type: 'number', min: 18, max: 120, inputmode: 'numeric', value: d.p.maxAge || '', placeholder: 'Age', 'data-id': 'me-form.max-age', onInput: (e) => { d.p.maxAge = e.target.value; touch(); } })));
}
const mIn = (label, obj, k, dataId, extra = {}) => h('div', { class: 'field' }, h('label', {}, label),
  h('input', { class: 'input', dir: 'auto', value: obj[k] || '', 'data-id': dataId, ...extra, onInput: (e) => { obj[k] = e.target.value; touch(); } }));
const mRemove = (dataId, run) => h('button', { type: 'button', class: 'linkish danger-text', 'data-id': dataId, onClick: () => { run(); touch(); paint({ keepScroll: true }); } }, 'Remove');
function meFacts() {
  return block({ key: 'me-facts', name: 'More facts' },
    ...d.p.facts.map(f => h('div', { class: 'me-fact', 'data-id': 'me-form.fact' },
      h('input', { class: 'input', dir: 'auto', value: f.label, placeholder: 'What (e.g. Height)', 'aria-label': 'Fact name', 'data-id': 'me-form.fact-label', onInput: (e) => { f.label = e.target.value; touch(); } }),
      h('input', { class: 'input', dir: 'auto', value: f.value, placeholder: 'Answer', 'aria-label': 'Answer', 'data-id': 'me-form.fact-value', onInput: (e) => { f.value = e.target.value; touch(); } }),
      mRemove('me-form.fact-remove', () => { d.p.facts = d.p.facts.filter(x => x !== f); }))),
    h('button', { type: 'button', class: 'btn small me-add', 'data-id': 'me-form.add-fact', onClick: () => { d.p.facts.push({ id: store.newId('f'), label: '', value: '' }); paint({ keepScroll: true }); const a = root.querySelectorAll('[data-id="me-form.fact-label"]'); a[a.length - 1]?.focus(); } }, 'Add a fact'));
}
function meContact() {
  const c = d.p.contact;
  return block({ key: 'me-contact', name: 'Contact' },
    mIn('For inquiries — name', c, 'inquiriesName', 'me-form.inq-name', { placeholder: 'e.g. Mrs. Cohen (mother)' }),
    mIn('For inquiries — phone', c, 'inquiriesPhone', 'me-form.inq-phone', { inputmode: 'tel' }),
    mIn('My phone (you choose)', c, 'phone', 'me-form.my-phone', { inputmode: 'tel' }),
    mIn('My email (you choose)', c, 'email', 'me-form.my-email', { type: 'email', inputmode: 'email' }));
}
function meRefs() {
  return block({ key: 'me-refs', name: 'References' },
    ...d.p.references.map(r => h('div', { class: 'me-item', 'data-id': 'me-form.reference' },
      mIn('Name', r, 'name', 'me-form.reference-name'), mIn('How they know me', r, 'relation', 'me-form.reference-relation'),
      mIn('Phone', r, 'phone', 'me-form.reference-phone', { inputmode: 'tel' }), mIn('Private note — only me', r, 'privateNote', 'me-form.reference-note'),
      mRemove('me-form.reference-remove', () => { d.p.references = d.p.references.filter(x => x !== r); }))),
    h('button', { type: 'button', class: 'btn small me-add', 'data-id': 'me-form.add-reference', onClick: () => { d.p.references.push({ id: store.newId('ref'), name: '', relation: '', phone: '', privateNote: '' }); paint({ keepScroll: true }); const a = root.querySelectorAll('[data-id="me-form.reference-name"]'); a[a.length - 1]?.focus(); } }, 'Add a reference'));
}
function meSections() {
  return block({ key: 'me-sections', name: 'Your own sections' },
    ...d.p.sections.map(s => h('div', { class: 'me-item', 'data-id': 'me-form.section' },
      mIn('Title', s, 'title', 'me-form.section-title'),
      h('div', { class: 'field' }, h('label', {}, 'Text'), (() => { const t = h('textarea', { class: 'input grow', rows: 3, dir: 'auto', 'data-id': 'me-form.section-text', onInput: (e) => { s.text = e.target.value; touch(); grow(e.target); } }, s.text || ''); setTimeout(() => grow(t), 0); return t; })()),
      h('label', { class: 'share-tick' }, h('input', { type: 'checkbox', checked: s.share !== false || null, 'data-id': 'me-form.section-share', onChange: (e) => { s.share = e.target.checked; touch(); } }), h('span', {}, 'Include in the full profile when sharing')),
      mRemove('me-form.section-remove', () => { d.p.sections = d.p.sections.filter(x => x !== s); }))),
    h('button', { type: 'button', class: 'btn small me-add', 'data-id': 'me-form.add-section', onClick: () => { d.p.sections.push({ id: store.newId('s'), title: '', text: '', share: true }); paint({ keepScroll: true }); const a = root.querySelectorAll('[data-id="me-form.section-title"]'); a[a.length - 1]?.focus(); } }, 'Add a section'));
}
async function saveMe() {
  const p = d.p;
  if (!p.name.trim()) { toast('Write your name first'); jump('me-basic'); root?.querySelector('#ap-name')?.focus(); return; }
  const answerLabels = { ...(p.answerLabels || {}) };
  for (const cat of ctx.cats) for (const k of listsOf(cat)) if (!LISTS[k]) answerLabels[k] = cat.key === k ? cat.name : `${cat.name} · ${(cat.subs || []).find(s => s.key === k)?.name || ''}`;
  const t = (x) => String(x ?? '').trim();
  await PD.saveProfile(d.rec, d.rec?.lang || 'en', {
    name: t(p.name).replace(/\s+/g, ' '), age: t(p.age), city: t(p.city), occupation: t(p.occupation), intro: t(p.intro),
    about: t(p.about), looking: t(p.looking), maxAge: t(p.maxAge), languages: p.languages || [], answers: p.answers || {}, answerLabels,
    religiousOther: t(p.religiousOther),
    facts: p.facts.filter(f => t(f.label)).map(f => ({ ...f, label: t(f.label), value: t(f.value) })),
    contact: { inquiriesName: t(p.contact.inquiriesName), inquiriesPhone: store.cleanPhone(t(p.contact.inquiriesPhone)), phone: store.cleanPhone(t(p.contact.phone)), email: t(p.contact.email) },
    references: p.references.filter(r => t(r.name)).map(r => ({ ...r, name: t(r.name), phone: store.cleanPhone(t(r.phone)) })),
    sections: p.sections.filter(s => t(s.title) || t(s.text)).map(s => ({ ...s, title: t(s.title) || 'Section', text: t(s.text) })),
  });
  drafts.delete('me');
  toast('Profile saved');
  navigate('/profile');
}
