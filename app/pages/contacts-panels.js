// Contacts — the pieces every view reuses: quick facts, the selected-person block
// (actions, follow-ups, conversation composer + history, linked people, notes,
// attachments) and the sheets (record/edit conversation, follow-up, folder,
// filters, view picker). Views only arrange these; data always goes through store.js.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, promptText, bubbles, confirmDialog, comingLater } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { S, D, LAYOUTS, SORTS, ROLE_TABS, ACTIVITY, STATUS_LABEL, roleLabel, optionsFor, clearFilters, fresh } from './contacts-data.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const NR = () => h('span', { class: 'muted' }, 'Not recorded');
const list = (arr) => (arr && arr.length ? arr.join(', ') : '');
export const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const shortDate = (iso) => store.formatDate(iso);

export function lastText(c) {
  const last = D.x.get(c.id).last;
  return last ? dateOnly(last) : 'No conversation recorded in the app';
}
export function statusText(c) {
  const open = D.x.get(c.id).open;
  const s = STATUS_LABEL[c.status] || '';
  if (open.length) return [s, `follow-up${open[0].dueAt ? ' ' + shortDate(open[0].dueAt) : ''}`].filter(Boolean).join(' · ');
  return s;
}

// ---------- quick facts ----------
export function quickFacts(c, dataId) {
  const f = (k, v, id) => h('div', { class: 'qf', 'data-id': `${dataId}.${id}` }, h('dt', {}, k), h('dd', { dir: 'auto' }, v || NR()));
  const folder = c.folderId && D.folderById.get(c.folderId);
  return h('dl', { class: 'quick-facts', 'data-id': dataId },
    f('Phone', c.phone ? h('a', { href: 'tel:' + c.phone.replace(/[^\d]/g, '') }, c.phone) : '', 'phone'),
    f('Email', c.email ? h('a', { href: 'mailto:' + c.email }, c.email) : '', 'email'),
    f('Speaks', list(c.languages), 'languages'),
    f('Works with', list(c.communities), 'communities'),
    f('Ages', list(c.ages), 'ages'),
    f('Preferred way', c.preferredContact, 'preferred'),
    f('Last recorded', lastText(c), 'last'),
    f('Status', statusText(c), 'status'),
    folder ? f('Folder', folder.name, 'folder') : null);
}

export function nameLine(c) {
  return [(c.roles || []).map(roleLabel).join(' · '), c.city].filter(Boolean).join(' · ') || 'Role and city not recorded';
}

// ---------- the selected person ----------
// opts: { facts: bool (include quick facts), historyLimit: n|null, historyLink: bool, compactHead: bool }
export function personBlock(c, opts = {}) {
  if (!c) return h('p', { class: 'empty', 'data-id': 'contact.none' }, 'No contact selected. Pick a name, or change the search and filters.');
  const pinBtn = h('button', { class: 'btn small', type: 'button', 'data-id': 'contact.pin-btn', 'aria-pressed': c.pinned ? 'true' : 'false',
    onClick: () => togglePin(c) }, ico('pin'), c.pinned ? 'Unpin' : 'Pin');
  return h('div', { class: 'person', 'data-id': 'contact.panel' },
    h('div', { class: 'person-head', 'data-id': 'contact.name' },
      h('div', { class: 'avatar' }, store.initials(c)),
      h('div', { class: 'person-title' },
        h('h2', { dir: 'auto' }, store.displayName(c)),
        h('div', { class: 'sub', dir: 'auto' }, nameLine(c))),
      pinBtn),
    actions(c),
    opts.facts ? h('section', { class: 'psec', 'data-id': 'contact.facts' }, quickFacts(c, 'contact.facts')) : null,
    followUpsSection(c),
    composer(c),
    historySection(c, opts),
    peopleSection(c),
    notesSection(c),
    attachmentsSection(c),
    h('div', { class: 'stamp', 'data-id': 'contact.stamp' }, `added ${shortDate(c.createdAt)} · updated ${shortDate(c.updatedAt)}${c.demo ? ' · demo record' : ''}`));
}

function actions(c) {
  return h('div', { class: 'person-actions', 'data-id': 'contact.actions' },
    h('button', { class: 'btn small primary', type: 'button', 'data-id': 'contact.record-btn', onClick: (e) => focusComposer(e.target) }, ico('message'), 'Record conversation'),
    h('button', { class: 'btn small', type: 'button', 'data-id': 'contact.followup-btn', onClick: () => followUpSheet(c) }, ico('clock'), 'Set follow-up'),
    h('button', { class: 'btn small', type: 'button', 'data-id': 'contact.folder-btn', onClick: () => folderSheet(c) }, ico('folder'), 'Move to folder'),
    h('button', { class: 'btn small', type: 'button', 'data-id': 'contact.edit-btn', onClick: () => navigate(`/contacts/${encodeURIComponent(c.id)}/edit`) }, ico('edit'), 'Edit contact'),
    h('button', { class: 'btn small', type: 'button', 'data-id': 'contact.share-btn', onClick: () => comingLater('Send my profile', 7) }, ico('send'), 'Send my profile'));
}

function focusComposer(from) {
  const box = from.closest('[data-id="contact.panel"]')?.querySelector('[data-id="contact.composer.text"]');
  if (!box) return;
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => box.focus({ preventScroll: true }), 250);
}

export async function togglePin(c) {
  const cur = await fresh(c.id);
  await store.contacts.save({ ...cur, pinned: !cur.pinned });
  toast(cur.pinned ? 'Unpinned' : 'Pinned — shown in the Pinned section');
}

// ---------- follow-ups ----------
function followUpsSection(c) {
  const fus = (D.fuBy.get(c.id) || []).filter(f => !f.done).sort((a, b) => (a.dueAt || '9').localeCompare(b.dueAt || '9'));
  const st = STATUS_LABEL[c.status];
  if (!fus.length && !st) return null;
  return h('section', { class: 'psec', 'data-id': 'contact.followups' },
    h('h3', { class: 'eyebrow' }, 'Next follow-up and current matter'),
    st ? h('p', { class: 'status-line', 'data-id': 'contact.status' }, h('span', { class: 'status-pill ' + c.status }, st)) : null,
    fus.map(f => h('div', { class: 'fu-row', 'data-id': 'contact.followup' },
      h('label', { class: 'fu-check' },
        h('input', { type: 'checkbox', 'aria-label': 'Mark done', 'data-id': 'contact.followup.done', onChange: async () => {
          await store.followUps.save({ ...f, done: true, doneAt: store.now() }); toast('Follow-up done');
        } }),
        h('span', { dir: 'auto' }, f.text || 'Follow up')),
      h('span', { class: 'when' }, f.dueAt ? shortDate(f.dueAt) : 'no date'),
      h('button', { class: 'linkish', type: 'button', 'data-id': 'contact.followup.edit', onClick: () => followUpSheet(c, f) }, 'Edit'))));
}

export async function followUpSheet(c, f = null) {
  const text = h('input', { class: 'input', dir: 'auto', value: f?.text || '', placeholder: 'e.g. Ask whether there is any news', 'data-id': 'followup-sheet.text' });
  const due = h('input', { class: 'input', type: 'date', value: f?.dueAt || '', 'data-id': 'followup-sheet.date' });
  const acts = [{ id: 'save', label: 'Save follow-up', primary: true, run: async () => {
    await store.followUps.save({ ...(f || {}), contactId: c.id, personId: f?.personId || null, text: text.value.trim() || 'Follow up', dueAt: due.value || null, done: false });
    toast('Follow-up saved');
  } }];
  if (f) acts.unshift({ id: 'delete', label: 'Delete', danger: true, run: async () => { await store.followUps.remove(f.id); toast('Follow-up deleted'); } });
  return sheet({ title: f ? 'Edit follow-up' : `Follow-up · ${store.displayName(c)}`, dataId: 'followup-sheet', actions: acts,
    body: [h('div', { class: 'field' }, h('label', {}, 'What to do'), text), h('div', { class: 'field' }, h('label', {}, 'When (optional)'), due)] });
}

// ---------- conversation composer + history ----------
const TYPE_OPTS = store.EVENT_TYPES.map(([v, l]) => [v || '_unknown', l]);

function composer(c) {
  const d = S.drafts[c.id] || (S.drafts[c.id] = { text: '', type: '_unknown', date: today() });
  const text = h('textarea', { class: 'input grow', rows: 2, dir: 'auto', placeholder: 'What was said? A quick note is fine.', 'data-id': 'contact.composer.text',
    onInput: (e) => { d.text = e.target.value; autoGrow(e.target); } }, d.text);
  const type = bubbles({ options: TYPE_OPTS, selected: [d.type], multi: false, dataId: 'contact.composer.type', onChange: (v) => { d.type = v || '_unknown'; } });
  const date = h('input', { class: 'input date', type: 'date', value: d.date, 'data-id': 'contact.composer.date', 'aria-label': 'Date', onChange: (e) => { d.date = e.target.value; } });
  return h('section', { class: 'psec composer', 'data-id': 'contact.composer' },
    h('h3', { class: 'eyebrow' }, 'Record a conversation or note'),
    text, type,
    h('div', { class: 'composer-foot' }, date,
      h('button', { class: 'btn primary', type: 'button', 'data-id': 'contact.composer.save', onClick: async () => {
        if (!d.text.trim()) { toast('Write a few words first'); text.focus(); return; }
        await store.recordEvent({ contactIds: [c.id], type: d.type === '_unknown' ? '' : d.type, text: d.text, at: atFromDate(d.date) });
        S.drafts[c.id] = { text: '', type: '_unknown', date: today() };
        toast('Saved to conversation history');
      } }, 'Save')),
    h('p', { class: 'note' }, 'Saving records what you write. It does not send anything to anyone.'));
}

export function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 420) + 'px'; }

// Date input → ISO. Today keeps the current time so same-day entries stay in order.
function atFromDate(d) {
  if (!d || d === today()) return store.now();
  return new Date(d + 'T12:00:00').toISOString();
}

function historySection(c, { historyLimit = null, historyLink = false } = {}) {
  const evs = D.evBy.get(c.id) || [];
  const shown = historyLimit ? evs.slice(0, historyLimit) : evs;
  return h('section', { class: 'psec', 'data-id': 'contact.history' },
    h('h3', { class: 'eyebrow' }, `Conversation history${evs.length ? ` · ${evs.length}` : ''}`),
    evs.length ? h('ol', { class: 'timeline' }, shown.map((e, i) => eventItem(e, c, i === 0)))
      : h('p', { class: 'note' }, 'No conversation recorded in the app yet. That does not mean you never spoke.'),
    historyLink && evs.length > shown.length
      ? h('a', { class: 'btn block', href: `#/contacts/${encodeURIComponent(c.id)}/history`, 'data-id': 'contact.history-all' }, `Full conversation (${evs.length})`, ico('chevron')) : null);
}

export function eventItem(e, c, latest) {
  const others = [
    ...(e.contactIds || []).filter(id => id !== c?.id).map(id => D.byId.get(id)).filter(Boolean).map(x => store.displayName(x)),
    ...(e.personIds || []).map(id => D.peopleById.get(id)).filter(Boolean).map(p => p.name || store.displayName(p)),
  ];
  return h('li', { class: 'tl-item', 'data-id': 'contact.event' },
    h('div', { class: 'tl-head' },
      h('span', { class: 'via' }, store.eventTypeLabel(e.type)),
      latest ? h('span', { class: 'chip' }, 'Latest') : null,
      h('time', { datetime: e.at }, dateOnly(e.at))),
    h('p', { dir: 'auto' }, e.text),
    others.length ? h('div', { class: 'note' }, 'Also linked: ' + others.join(', ')) : null,
    h('div', { class: 'tl-actions' },
      h('button', { class: 'linkish', type: 'button', 'data-id': 'contact.event.edit', onClick: () => eventSheet(e) }, 'Edit'),
      h('button', { class: 'linkish danger-text', type: 'button', 'data-id': 'contact.event.delete', onClick: async () => {
        if (await confirmDialog({ title: 'Delete this entry?', text: 'It disappears from every place it is linked to.', ok: 'Delete', danger: true, dataId: 'contact.event.delete-dialog' })) {
          await store.events.remove(e.id); toast('Entry deleted');
        }
      } }, 'Delete')));
}

// Editing the one record updates every linked view (contact, person, Home later).
export async function eventSheet(e) {
  let type = e.type || '_unknown';
  const text = h('textarea', { class: 'input grow', dir: 'auto', rows: 4, 'data-id': 'event-sheet.text', onInput: (ev) => autoGrow(ev.target) }, e.text || '');
  const date = h('input', { class: 'input', type: 'date', value: (e.at || '').slice(0, 10), 'data-id': 'event-sheet.date' });
  const people = D.people.length ? h('div', { class: 'field' }, h('label', {}, 'Linked suggested people'),
    bubbles({ options: D.people.map(p => [p.id, p.name || store.displayName(p)]), selected: e.personIds || [], dataId: 'event-sheet.people', onChange: (v) => { e = { ...e, personIds: v }; } })) : null;
  setTimeout(() => autoGrow(text), 30);
  return sheet({ title: 'Edit conversation entry', dataId: 'event-sheet',
    body: [h('div', { class: 'field' }, h('label', {}, 'Type'), bubbles({ options: TYPE_OPTS, selected: [type], multi: false, dataId: 'event-sheet.type', onChange: (v) => { type = v || '_unknown'; } })),
      h('div', { class: 'field' }, h('label', {}, 'What was said'), text),
      h('div', { class: 'field' }, h('label', {}, 'Date'), date), people],
    actions: [{ id: 'save', label: 'Save', primary: true, run: async () => {
      if (!text.value.trim()) { toast('The entry cannot be empty — delete it instead'); return false; }
      const keepTime = (e.at || '').slice(0, 10) === date.value;
      await store.recordEvent({ ...e, type: type === '_unknown' ? '' : type, text: text.value, at: keepTime ? e.at : new Date(date.value + 'T12:00:00').toISOString() });
      toast('Updated everywhere it appears');
    } }] });
}

// ---------- linked people, notes, attachments ----------
function peopleSection(c) {
  const ids = new Set();
  for (const p of D.people) if ((p.contactIds || []).includes(c.id) || p.sourceContactId === c.id) ids.add(p.id);
  for (const e of D.evBy.get(c.id) || []) for (const pid of e.personIds || []) ids.add(pid);
  const ppl = [...ids].map(id => D.peopleById.get(id)).filter(Boolean);
  return h('section', { class: 'psec', 'data-id': 'contact.people' },
    h('h3', { class: 'eyebrow' }, 'People suggested'),
    ppl.length ? h('div', {}, ppl.map(p => h('a', { class: 'row-link', href: '#/people', 'data-id': 'contact.person-link' },
      h('div', { class: 'avatar' }, store.initials(p)), h('div', { class: 'row-main' }, h('div', { class: 'row-title', dir: 'auto' }, p.name || store.displayName(p))))))
      : h('p', { class: 'note' }, 'No suggested people linked yet. Adding people arrives in Stage 3.'));
}

function notesSection(c) {
  const parts = [
    c.about ? h('p', { dir: 'auto', class: 'prewrap' }, c.about) : null,
    c.familiarity || c.yearsKnown || c.howKnow ? h('p', { class: 'note', dir: 'auto' },
      [c.familiarity, c.yearsKnown ? `${c.yearsKnown} years` : '', c.howKnow].filter(Boolean).join(' · ')) : null,
    c.background ? h('p', { class: 'note', dir: 'auto' }, `Their own background: ${c.background}`) : null,
    c.source ? h('p', { class: 'note', dir: 'auto' }, `Source: ${c.source}`) : null,
  ].filter(Boolean);
  return h('section', { class: 'psec', 'data-id': 'contact.notes' },
    h('h3', { class: 'eyebrow' }, 'Private notes'),
    parts.length ? parts : h('p', { class: 'note' }, 'Nothing written yet. Use Edit contact to add notes.'));
}

function attachmentsSection(c) {
  const atts = D.attBy.get(c.id) || [];
  if (!atts.length) return null;
  return h('section', { class: 'psec', 'data-id': 'contact.attachments' },
    h('h3', { class: 'eyebrow' }, `Attached items · ${atts.length}`),
    atts.map(a => h('a', { class: 'att-row', href: a.dataUrl, download: a.name, 'data-id': 'contact.attachment' }, ico('file'), h('span', { dir: 'auto' }, a.name))));
}

// ---------- move to folder ----------
export async function folderSheet(c) {
  let choice = c.folderId || '';
  const radios = h('div', { class: 'radio-list', 'data-id': 'folder-sheet.list' });
  const draw = () => {
    radios.innerHTML = '';
    for (const [id, name] of [['', 'No folder'], ...D.folders.map(f => [f.id, f.name])]) {
      radios.append(h('label', {}, h('input', { type: 'radio', name: 'folder', checked: choice === id || null, onChange: () => { choice = id; } }), h('span', { dir: 'auto' }, name)));
    }
  };
  draw();
  const res = await sheet({ title: `Move ${store.displayName(c)}`, dataId: 'folder-sheet',
    body: [h('p', { class: 'note' }, 'Folders are only for your own organising. The contact stays in All contacts and keeps every conversation.'), radios],
    actions: [
      { id: 'new', label: 'New folder', run: async () => {
        const name = await promptText({ title: 'New folder', label: 'Folder name', ok: 'Create', dataId: 'folder-sheet.new-dialog' });
        if (!name) return false;
        const exists = D.folders.find(f => f.name.toLowerCase() === name.toLowerCase());
        return exists ? exists.id : (await store.folders.save({ name })).id;
      } },
      { id: 'save', label: 'Move', primary: true, run: () => '=' + choice }] });
  if (res == null) return;
  const target = res.startsWith('=') ? res.slice(1) : res;
  const cur = await fresh(c.id);
  await store.contacts.save({ ...cur, folderId: target || null });
  const fname = target ? (D.folderById.get(target)?.name || (await store.folders.get(target))?.name) : '';
  toast(target ? `Moved to ${fname}` : 'Removed from folder');
}

// ---------- filters ----------
export async function filtersSheet() {
  const cityOpts = optionsFor('city').map(v => [v, v]);
  const langOpts = optionsFor('languages').map(v => [v, v]);
  const comOpts = optionsFor('communities').map(v => [v, v]);
  const folderOpts = [['_none', 'No folder'], ...D.folders.map(f => [f.id, f.name])];
  const grp = (label, node) => h('div', { class: 'field filter-group' }, h('label', {}, label), node);
  const body = () => [
    grp('Contact role', bubbles({ options: ROLE_TABS, selected: [S.role], multi: false, dataId: 'filters.role', onChange: v => { S.role = v || 'all'; } })),
    grp('Activity', bubbles({ options: ACTIVITY, selected: [S.activity], multi: false, dataId: 'filters.activity', onChange: v => { S.activity = v || 'all'; } })),
    grp('City', bubbles({ options: cityOpts, selected: S.cities, dataId: 'filters.city', onChange: v => { S.cities = v; } })),
    grp('Spoken language', bubbles({ options: langOpts, selected: S.languages, dataId: 'filters.language', onChange: v => { S.languages = v; } })),
    grp('Community served', bubbles({ options: comOpts, selected: S.communities, dataId: 'filters.community', onChange: v => { S.communities = v; } })),
    D.folders.length ? grp('Folder', bubbles({ options: folderOpts, selected: S.folder ? [S.folder] : [], multi: false, dataId: 'filters.folder', onChange: v => { S.folder = v; } }))
      : h('p', { class: 'note' }, 'Folders appear here once you create one (Move to folder on a contact).'),
    h('p', { class: 'note' }, 'Several choices in one group show contacts matching any of them. Groups combine.'),
  ];
  const wrap = h('div', { class: 'filters-body' }, body());
  await sheet({ title: 'Filters', dataId: 'filters', className: 'tall', body: wrap,
    actions: [
      { id: 'clear', label: 'Clear filters', run: () => { const q = S.q; clearFilters(); S.q = q; wrap.innerHTML = ''; wrap.append(...body()); return false; } },
      { id: 'done', label: 'Show contacts', primary: true }] });
}

// ---------- view picker ----------
export function viewPreview(id) {
  const b = (cls) => h('i', { class: cls });
  const shapes = {
    a: [b('pv-l'), b('pv-r'), b('pv-bottom')],
    split: [b('pv-top'), b('pv-bar'), b('pv-bottom2')],
    rail: [b('pv-rail'), b('pv-main')],
    tabs: [b('pv-tabs'), b('pv-full')],
    list: [b('pv-row'), b('pv-open'), b('pv-row'), b('pv-row')],
    inbox: [b('pv-row'), b('pv-row'), b('pv-arrow')],
  };
  return h('span', { class: 'pv pv-' + id, 'aria-hidden': 'true' }, shapes[id]);
}

export async function viewSheet(onPick) {
  const cur = store.getPrefs().contactsLayout;
  let dlg;
  const items = LAYOUTS.map(([id, name, desc]) => h('button', { type: 'button', class: 'lay', 'aria-pressed': cur === id ? 'true' : 'false', 'data-id': 'view.' + id,
    onClick: () => { store.setPref('contactsLayout', id); onPick && onPick(id); dlg?.finish(id); toast(`View: ${name}`); } },
    viewPreview(id),
    h('span', { class: 'lay-text' }, h('b', {}, name, cur === id ? h('span', { class: 'chip current' }, 'Current') : null), h('small', {}, desc))));
  const p = sheet({ title: 'Contacts view', dataId: 'view', className: 'tall', body: [
    h('p', { class: 'note' }, 'Changes only how Contacts looks on this phone. Your contacts, filters and selection stay the same. None of these is final yet — try them all.'),
    h('div', { class: 'lay-list' }, items),
    h('p', { class: 'note' }, 'On a wide screen (computer) Contacts always uses the Outlook-style three-area view.')] });
  dlg = document.querySelector('dialog[data-id="view"]');
  return p;
}

export const sortOptions = () => SORTS;
