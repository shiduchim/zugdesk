// Add Shadchan / Edit contact — ONE screen (spec/add-person.md AS-01).
// Saves into the same shared contact record Contacts shows (no copies).
// Only the name is required. Nothing is guessed or prefilled from a name or city.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, promptText, bubbles, confirmDialog } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { S } from './contacts-data.js';
import { isShadchan } from '../js/mode.js';

const TITLES = ['Mrs.', 'Rabbi', 'Rebbetzin', 'Mr.', 'Dr.'];
const STATUS = [['waiting', 'Waiting'], ['follow-up', 'Follow-up'], ['active', 'Active']];
const METHODS = ['WhatsApp', 'Phone call', 'Email', 'Text message'];
const FAMILIARITY = ['Never spoke', 'Talked by phone', 'Met in person', 'Know personally', 'Would recommend'];
const ROLE_LABEL = { shadchan: 'Shadchan', reference: 'Reference', friend: 'Friend', family: 'Family', helper: 'Helper', parent: 'Parent', rav: 'Rav', other: 'Other' };
const MAX_FILE = 5 * 1024 * 1024;

let root = null, gen = 0;
export function destroy() { root = null; gen++; }

export async function render(container, params = {}) {
  root = container;
  root.classList.add('contact-form-page');
  const token = ++gen;
  const editing = !!params.id;
  const c = editing ? await store.contacts.get(params.id) : null;
  if (editing && !c) { root.append(h('p', { class: 'empty' }, 'This contact no longer exists.'), h('a', { class: 'btn', href: '#/contacts' }, 'Back to contacts')); return; }
  const id = c?.id || store.newId('c');
  let choices = await store.getChoices();
  const all = await store.contacts.list();
  const cities = [...new Set(all.map(x => x.city).filter(Boolean))].sort();
  if (token !== gen) return;

  // working copy of the attachments
  const existingAtts = editing ? await store.attachments.byIndex('contactId', id) : [];
  const atts = existingAtts.map(a => ({ ...a }));
  const removedAtts = [];
  if (token !== gen) return;

  const v = {
    title: c?.title || '', name: c ? ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || '') : '',
    roles: c?.roles?.length ? [...c.roles] : isShadchan ? [] : ['shadchan'], // Shadchan Mode: a new contact is as often a parent, so nothing is pre-chosen
    status: c?.status && c.status !== 'none' ? c.status : '', preferredContact: c?.preferredContact || '',
    ages: [...(c?.ages || [])], communities: [...(c?.communities || [])], languages: [...(c?.languages || [])],
    familiarity: c?.familiarity || '',
  };

  const input = (name, label, value, attrs = {}) => h('div', { class: 'field' },
    h('label', { for: 'cf-' + name }, label),
    h('input', { class: 'input', id: 'cf-' + name, name, value: value ?? '', dir: 'auto', 'data-id': 'shadchan.' + name, ...attrs }));
  const area = (name, label, value, placeholder) => {
    const t = h('textarea', { class: 'input grow', id: 'cf-' + name, name, dir: 'auto', rows: 2, placeholder, 'data-id': 'shadchan.' + name, onInput: (e) => grow(e.target) }, value || '');
    setTimeout(() => grow(t), 0);
    return h('div', { class: 'field' }, h('label', { for: 'cf-' + name }, label), t);
  };
  const block = (title, dataId, ...kids) => h('section', { class: 'form-sec', 'data-id': dataId }, h('h2', { class: 'eyebrow' }, title), ...kids);

  // bubbles backed by user-managed choices, with the three-dot "add" control
  const choiceBubbles = (key, dataId, addLabel) => {
    const opts = () => {
      const visibleChoices = choices[key].filter(o => !o.hidden).map(o => o.v);
      const extra = v[key].filter(x => !visibleChoices.includes(x)); // keep record values even if hidden/deleted
      return [...visibleChoices, ...extra].map(x => [x, key === 'roles' ? (ROLE_LABEL[x] || x) : x]);
    };
    const more = h('button', { type: 'button', class: 'bubble more', 'aria-label': addLabel, title: addLabel, 'data-id': dataId + '-more', html: icon('more') });
    const b = bubbles({ options: opts(), selected: v[key], dataId, onChange: (val) => { v[key] = val; }, extra: more });
    more.addEventListener('click', async () => {
      const name = await promptText({ title: addLabel, label: 'Name', ok: 'Add', dataId: dataId + '-add' });
      if (!name) return;
      if (!choices[key].some(o => o.v.toLowerCase() === name.toLowerCase())) { choices[key].push({ v: name, hidden: false }); await store.saveChoices(choices); }
      else { const o = choices[key].find(o => o.v.toLowerCase() === name.toLowerCase()); o.hidden = false; await store.saveChoices(choices); }
      const real = choices[key].find(o => o.v.toLowerCase() === name.toLowerCase()).v;
      b.setOptions(opts()); b.select(real);
    });
    b.refresh = () => b.setOptions(opts());
    return b;
  };

  const rolesB = choiceBubbles('roles', 'shadchan.roles', 'Add a role');
  const agesB = choiceBubbles('ages', 'shadchan.ages', 'Add an age range');
  const comB = choiceBubbles('communities', 'shadchan.groups', 'Add a religious group');
  const langB = choiceBubbles('languages', 'shadchan.languages', 'Add a language');

  const attList = h('div', { class: 'att-list', 'data-id': 'shadchan.attachments-list' });
  const drawAtts = () => {
    attList.innerHTML = '';
    if (!atts.length) attList.append(h('p', { class: 'note' }, 'Nothing attached.'));
    for (const a of atts) attList.append(h('div', { class: 'att-row' }, h('span', { html: icon('file') }).firstChild, h('span', { dir: 'auto', class: 'att-name' }, a.name),
      h('span', { class: 'note' }, Math.max(1, Math.round((a.size || 0) / 1024)) + ' KB'),
      h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'shadchan.attachment-remove', onClick: () => { atts.splice(atts.indexOf(a), 1); if (a.id) removedAtts.push(a.id); drawAtts(); } }, 'Remove')));
  };
  drawAtts();
  const fileIn = h('input', { type: 'file', multiple: true, class: 'hidden', 'data-id': 'shadchan.file-input', onChange: async (e) => {
    for (const f of e.target.files) {
      if (f.size > MAX_FILE) { toast(`${f.name} is larger than 5 MB — not attached`); continue; }
      atts.push({ name: f.name, type: f.type, size: f.size, dataUrl: await readAsDataURL(f) });
    }
    e.target.value = ''; drawAtts();
  } });

  const form = h('form', { class: 'shadchan-form', 'data-id': 'shadchan.form', novalidate: true, onSubmit: (e) => { e.preventDefault(); save(); } },
    block('Contact basics', 'shadchan.basics',
      h('div', { class: 'field' }, h('label', {}, 'Title (optional)'),
        bubbles({ options: TITLES.map(t => [t, t]), selected: v.title ? [v.title] : [], multi: false, dataId: 'shadchan.title', onChange: (x) => { v.title = x; } })),
      input('name', 'Name (required)', v.name, { required: true, autocomplete: 'off', placeholder: 'e.g. Miriam Cohen' }),
      input('phone', 'Phone number', c?.phone, { type: 'tel', inputmode: 'tel', placeholder: 'Use 00 for country codes' }),
      input('email', 'Email', c?.email, { type: 'email', inputmode: 'email' }),
      input('city', 'City', c?.city, { list: 'cf-cities', autocomplete: 'off' }),
      h('datalist', { id: 'cf-cities' }, cities.map(x => h('option', { value: x }))),
      h('div', { class: 'field' }, h('label', {}, 'Roles (a person can have several)'), rolesB),
      h('div', { class: 'field' }, h('label', {}, 'Preferred way to reach them'),
        bubbles({ options: METHODS.map(m => [m, m]), selected: v.preferredContact ? [v.preferredContact] : [], multi: false, dataId: 'shadchan.preferred', onChange: (x) => { v.preferredContact = x; } })),
      h('div', { class: 'field' }, h('label', {}, 'Current status'),
        bubbles({ options: STATUS, selected: v.status ? [v.status] : [], multi: false, dataId: 'shadchan.status', onChange: (x) => { v.status = x; } }))),
    block('Notes', 'shadchan.notes-sec',
      area('about', 'Private notes (never shared)', c?.about, 'e.g. Prefers not to receive calls before 5 PM')),
    block('Who do they work with?', 'shadchan.works-with',
      h('div', { class: 'field' }, h('label', {}, 'Ages'), agesB),
      h('div', { class: 'field' }, h('label', {}, 'Religious groups they work with'), comB),
      input('background', 'Their own background (optional, only if you know it)', c?.background)),
    block('How well do I know them?', 'shadchan.familiarity-sec',
      bubbles({ options: FAMILIARITY.map(x => [x, x]), selected: v.familiarity ? [v.familiarity] : [], multi: false, dataId: 'shadchan.familiarity', onChange: (x) => { v.familiarity = x; } }),
      input('yearsKnown', 'Years known (optional)', c?.yearsKnown, { type: 'number', min: 0, max: 99, inputmode: 'numeric', class: 'input short' }),
      area('howKnow', 'How do you know them?', c?.howKnow)),
    block('Languages spoken', 'shadchan.languages-sec', langB),
    block('Last contact', 'shadchan.last-sec',
      input('lastContactAt', 'Date of last contact (if you remember it)', c?.lastContactAt ? c.lastContactAt.slice(0, 10) : '', { type: 'date' }),
      h('p', { class: 'note' }, 'Conversations you record on the contact also count as contact.')),
    block('Source', 'shadchan.source-sec',
      area('source', 'Where did this contact’s details come from?', c?.source, 'e.g. Given by my aunt')),
    block('Attached items', 'shadchan.attachments',
      attList, fileIn,
      h('button', { type: 'button', class: 'btn', 'data-id': 'shadchan.attach-btn', onClick: () => fileIn.click() }, h('span', { html: icon('file') }).firstChild, 'Attach file or photo')),
    h('div', { class: 'form-foot', 'data-id': 'shadchan.footer' },
      h('button', { type: 'button', class: 'linkish manage', 'data-id': 'shadchan.manage-choices', onClick: () => manageChoices(choices, async (next) => {
        choices = next; await store.saveChoices(choices); [rolesB, agesB, comB, langB].forEach(b => b.refresh());
      }) }, 'Manage categories & choices'),
      h('span', { class: 'spacer' }),
      editing ? h('button', { type: 'button', class: 'btn danger', 'data-id': 'shadchan.delete-btn', onClick: del }, 'Delete') : null,
      h('button', { type: 'button', class: 'btn', 'data-id': 'shadchan.cancel-btn', onClick: cancel }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary', 'data-id': 'shadchan.save-btn' }, editing ? 'Save changes' : 'Save Shadchan')));

  root.append(
    h('div', { class: 'page-head' },
      h('a', { class: 'icon-btn', href: editing ? `#/contacts/${encodeURIComponent(id)}` : '#/contacts', 'aria-label': 'Back', 'data-id': 'shadchan.back', html: icon('back') }),
      h('h1', {}, editing ? 'Edit contact' : isShadchan ? 'Add Contact' : 'Add Shadchan')),
    h('p', { class: 'note intro' }, 'Everything is optional except the name. Leave anything you don’t know empty.'),
    form);

  function cancel() { navigate(editing ? `/contacts/${encodeURIComponent(id)}` : '/contacts'); }

  async function del() {
    if (!(await confirmDialog({ title: 'Delete this contact?', text: `${store.displayName(c)} will be removed from this phone, with their follow-ups and attachments. Conversation entries linked to someone else stay for them. ${store.SOFT_DELETE ? 'You can put it back for 30 days from Settings → Recently deleted.' : 'This cannot be undone.'}`, ok: 'Delete', danger: true, dataId: 'shadchan.delete-dialog' }))) return;
    await store.asOne(async () => { // one deletion: Shadchan Mode can restore it whole from Recently deleted
      for (const f of await store.followUps.byIndex('contactId', id)) await store.followUps.remove(f.id);
      for (const a of existingAtts) await store.attachments.remove(a.id);
      for (const e of await store.events.byIndex('contactIds', id)) {
        const rest = (e.contactIds || []).filter(x => x !== id);
        if (rest.length || (e.personIds || []).length) await store.unlink(store.events, e, 'contactIds', id); else await store.events.remove(e.id);
      }
      await store.contacts.remove(id);
    });
    if (S.selectedId === id) S.selectedId = null;
    toast(store.SOFT_DELETE ? 'Contact deleted. It waits 30 days in Settings → Recently deleted' : 'Contact deleted', store.SOFT_DELETE ? 5000 : undefined); navigate('/contacts');
  }

  async function save() {
    const fd = new FormData(form);
    const get = (k) => (fd.get(k) || '').toString().trim();
    const fullName = get('name').replace(/\s+/g, ' ');
    if (!fullName) { toast('Please write a name — it is the only required field'); form.querySelector('#cf-name').focus(); return; }
    const parts = fullName.split(' ');
    const rec = {
      ...(c || {}), id,
      title: v.title, name: fullName, firstName: parts[0], lastName: parts.slice(1).join(' '),
      phone: get('phone'), email: get('email'), city: get('city'), country: c?.city === get('city') ? (c?.country || '') : '',
      roles: rolesB.getValue(), status: v.status || 'none', preferredContact: v.preferredContact,
      about: get('about'), ages: agesB.getValue(), communities: comB.getValue(), background: get('background'),
      familiarity: v.familiarity, yearsKnown: get('yearsKnown') ? Number(get('yearsKnown')) : null, howKnow: get('howKnow'),
      languages: langB.getValue(), lastContactAt: get('lastContactAt') ? keepTime(c?.lastContactAt, get('lastContactAt')) : null,
      source: get('source'), pinned: !!c?.pinned, folderId: c?.folderId || null,
    };
    const PLUS = String.fromCharCode(43); // owner rule: no plus signs; country codes use 00
    if (rec.phone.includes(PLUS)) rec.phone = rec.phone.split(PLUS).join('00');
    if (!editing) {
      const dup = findDuplicate(all, rec);
      if (dup) {
        const res = await sheet({ title: 'Already in your contacts?', dataId: 'shadchan.duplicate',
          body: [h('p', { dir: 'auto' }, `${store.displayName(dup)}${dup.city ? ' · ' + dup.city : ''}${dup.phone ? ' · ' + dup.phone : ''} looks like the same person.`),
            h('p', { class: 'note' }, 'Opening the existing contact avoids two separate records for one person.')],
          actions: [{ id: 'open', label: 'Open existing' }, { id: 'save', label: 'Save as new anyway', primary: true }] });
        if (res === 'open') { S.selectedId = dup.id; navigate('/contacts/' + encodeURIComponent(dup.id)); return; }
        if (res !== 'save') return;
      }
    }
    await store.contacts.save(rec);
    for (const a of atts) if (!a.id) await store.attachments.save({ ...a, contactId: id, personId: null });
    for (const aid of removedAtts) await store.attachments.remove(aid);
    S.selectedId = id;
    toast(editing ? 'Saved' : `${store.displayName(rec)} added`);
    navigate('/contacts/' + encodeURIComponent(id));
  }
}

function keepTime(prevIso, date) {
  if (prevIso && prevIso.slice(0, 10) === date) return prevIso;
  return new Date(date + 'T12:00:00').toISOString();
}

function findDuplicate(all, rec) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const digits = (p) => (p || '').replace(/\D/g, '').slice(-9);
  const n = norm(rec.name), d = digits(rec.phone);
  return all.find(x => (n && norm([x.firstName, x.lastName].filter(Boolean).join(' ') || x.name) === n) || (d.length >= 7 && digits(x.phone) === d));
}

function grow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 480) + 'px'; }

function readAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
}

// Hide / Show / Delete for every bubble, built-in or custom. Hidden ≠ "No".
async function manageChoices(choices, onSave) {
  const work = JSON.parse(JSON.stringify(choices));
  const body = h('div', { class: 'manage-body' });
  const draw = () => {
    body.innerHTML = '';
    body.append(h('p', { class: 'note' }, 'Hidden choices disappear from the form but stay on contacts that already have them. Deleting removes the choice from the list only — no contact data is changed.'));
    for (const [key, label] of Object.entries(store.CHOICE_NAMES)) {
      body.append(h('h3', { class: 'eyebrow' }, label));
      if (!work[key].length) body.append(h('p', { class: 'note' }, 'No choices.'));
      work[key].forEach((o, i) => body.append(h('div', { class: 'manage-row', 'data-id': `manage.${key}` },
        h('span', { dir: 'auto', class: o.hidden ? 'muted' : '' }, key === 'roles' ? (ROLE_LABEL[o.v] || o.v) : o.v, o.hidden ? ' (hidden)' : ''),
        h('button', { type: 'button', class: 'linkish', disabled: i === 0 || null, 'aria-label': 'Move up', onClick: () => { [work[key][i - 1], work[key][i]] = [work[key][i], work[key][i - 1]]; draw(); } }, 'Up'),
        h('button', { type: 'button', class: 'linkish', onClick: () => { o.hidden = !o.hidden; draw(); } }, o.hidden ? 'Show' : 'Hide'),
        h('button', { type: 'button', class: 'linkish danger-text', onClick: () => { work[key].splice(i, 1); draw(); } }, 'Delete'))));
      body.append(h('button', { type: 'button', class: 'btn small', 'data-id': `manage.${key}.add`, onClick: async () => {
        const name = await promptText({ title: `Add to ${label}`, label: 'Name', dataId: 'manage.add-dialog' });
        if (name && !work[key].some(o => o.v.toLowerCase() === name.toLowerCase())) { work[key].push({ v: name, hidden: false }); draw(); }
      } }, 'Add choice'));
    }
  };
  draw();
  const res = await sheet({ title: 'Manage categories & choices', dataId: 'manage', className: 'tall', body,
    actions: [{ id: 'reset', label: 'Restore defaults', run: () => { for (const k of Object.keys(store.CHOICE_DEFAULTS)) work[k] = store.CHOICE_DEFAULTS[k].map(v => ({ v, hidden: false })); draw(); return false; } },
      { id: 'save', label: 'Save choices', primary: true }] });
  if (res === 'save') { await onSave(work); toast('Choices saved'); }
}
