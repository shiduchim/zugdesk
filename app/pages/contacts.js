// Contacts — Stage 1: a plain list + record view to prove the shared store works
// (open, edit, pin, reload). Search/sort/filters/layouts/folders come in Stage 2.
import * as store from '../js/store.js';
import { h, icon, section, toast, comingLater } from '../js/ui.js';
import { navigate } from '../js/router.js';

let unsub = null;

export async function render(root, params) {
  if (params.id) return renderDetail(root, params.id);
  return renderList(root);
}
export function destroy() { unsub && unsub(); unsub = null; }

const byName = (a, b) => store.displayName(a).localeCompare(store.displayName(b), undefined, { sensitivity: 'base' });

async function renderList(root) {
  const all = (await store.contacts.list()).sort(byName);
  const pinned = all.filter(c => c.pinned);
  const rest = all.filter(c => !c.pinned);

  root.append(
    h('div', { class: 'page-head' },
      h('h1', {}, 'Contacts'),
      h('button', { class: 'btn', 'data-id': 'contacts.add-btn', onClick: () => comingLater('Add Shadchan', 2) }, h('span', { html: icon('plus') }).firstChild, 'Add')),
    h('div', { class: 'contacts-tools' },
      h('input', { class: 'input', type: 'search', placeholder: 'Search — coming in Stage 2', 'data-id': 'contacts.search', onFocus: (e) => { e.target.blur(); comingLater('Search', 2); } }),
      h('button', { class: 'btn', 'data-id': 'contacts.sort-btn', onClick: () => comingLater('Sort', 2) }, 'Sort'),
      h('button', { class: 'btn', 'data-id': 'contacts.filter-btn', onClick: () => comingLater('Filters', 2) }, 'Filters')),
    h('p', { class: 'note', 'data-id': 'contacts.count' }, `${all.length} contacts · sorted by name`),
  );

  if (!all.length) {
    root.append(h('p', { class: 'empty', 'data-id': 'contacts.empty' }, 'No contacts yet. Add one, or load demo contacts in Settings.'));
    return;
  }
  if (pinned.length) root.append(section('Pinned', 'contacts.pinned', h('div', { class: 'contacts-list' }, pinned.map(row))));
  root.append(section(pinned.length ? 'All contacts' : null, 'contacts.list', h('div', { class: 'contacts-list' }, rest.map(row))));

  unsub = store.subscribe((ch) => { if (ch.store === 'contacts' || ch.store === '*') { root.innerHTML = ''; renderList(root); } });
}

function row(c) {
  const sub = [c.city, c.roles?.join(', ')].filter(Boolean).join(' · ');
  return h('a', { class: 'row-link', href: '#/contacts/' + encodeURIComponent(c.id), 'data-id': 'contacts.row' },
    h('div', { class: 'avatar' }, store.initials(c)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, store.displayName(c)),
      h('div', { class: 'row-sub', dir: 'auto' }, sub || '—')),
    c.status && c.status !== 'none' ? h('span', { class: 'status-pill ' + c.status }, c.status) : null);
}

async function renderDetail(root, id) {
  const c = await store.contacts.get(id);
  if (!c) { root.append(h('p', { class: 'empty' }, 'This contact no longer exists.'), h('a', { class: 'btn', href: '#/contacts' }, 'Back to contacts')); return; }

  const fact = (k, v) => h('div', { class: 'fact' }, h('dt', {}, k), h('dd', { dir: 'auto' }, v || h('span', { class: 'muted' }, 'not recorded')));
  const list = (arr) => arr && arr.length ? arr.join(', ') : '';

  root.classList.add('contact-detail');
  root.append(
    h('div', { class: 'page-head' },
      h('a', { class: 'icon-btn', href: '#/contacts', 'data-id': 'contact.back', 'aria-label': 'Back to contacts', html: icon('back') }),
      h('h1', { style: 'font-size:var(--font-base);color:var(--muted);font-weight:500' }, 'Contact'),
      h('button', { class: 'btn', 'data-id': 'contact.pin-btn', 'aria-pressed': c.pinned ? 'true' : 'false', onClick: async () => {
        await store.contacts.save({ ...c, pinned: !c.pinned });
        toast(c.pinned ? 'Unpinned' : 'Pinned'); root.innerHTML = ''; root.classList.remove('contact-detail'); renderDetail(root, id);
      } }, h('span', { html: icon('pin') }).firstChild, c.pinned ? 'Unpin' : 'Pin')),
    h('div', { class: 'name-row', 'data-id': 'contact.name' },
      h('div', { class: 'avatar' }, store.initials(c)),
      h('div', { style: 'min-width:0' },
        h('h1', { dir: 'auto' }, store.displayName(c)),
        h('div', { class: 'sub', dir: 'auto' }, [c.city, c.country].filter(Boolean).join(', ') || 'City not recorded'))),
    section('Facts', 'contact.facts',
      h('dl', { class: 'facts' },
        fact('Roles', list(c.roles)),
        fact('Phone', c.phone),
        fact('Email', c.email),
        fact('Preferred', c.preferredContact),
        fact('Languages', list(c.languages)),
        fact('Works with', list(c.communities)),
        fact('Background', c.background),
        fact('Status', c.status && c.status !== 'none' ? c.status : ''),
        fact('Last contact', c.lastContactAt ? store.formatDate(c.lastContactAt) : ''))),
    section('About', 'contact.about', h('p', { dir: 'auto' }, c.about || h('span', { class: 'muted' }, 'Nothing written yet.'))),
    section('Edit basics', 'contact.edit', editForm(c, root, id)),
    section('Conversations', 'contact.history', h('p', { class: 'empty' }, 'Conversation log arrives in Stage 2.')),
    h('div', { class: 'btn-row', style: 'padding-top:12px' },
      h('button', { class: 'btn', 'data-id': 'contact.record-btn', onClick: () => comingLater('Record conversation', 2) }, 'Record conversation'),
      h('button', { class: 'btn', 'data-id': 'contact.folder-btn', onClick: () => comingLater('Move to folder', 2) }, 'Move to folder'),
      h('button', { class: 'btn', 'data-id': 'contact.share-btn', onClick: () => comingLater('Send my profile', 7) }, 'Send my profile')),
    h('div', { class: 'stamp', style: 'padding-top:16px' }, `updated ${store.formatDate(c.updatedAt)}${c.demo ? ' · demo record' : ''}`),
  );
}

// Minimal edit so Stage 1 can prove save → reload. The full Add/Edit Shadchan form is Stage 2.
function editForm(c, root, id) {
  const f = (name, label, value, type = 'text') => h('div', { class: 'field' },
    h('label', { for: 'f-' + name }, label),
    h('input', { class: 'input', id: 'f-' + name, name, type, value: value || '', dir: 'auto', 'data-id': 'contact.edit.' + name }));
  const form = h('form', { 'data-id': 'contact.edit-form', style: 'display:flex;flex-direction:column;gap:10px', onSubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const upd = { ...c };
    for (const k of ['title', 'firstName', 'lastName', 'city', 'phone', 'email', 'about']) upd[k] = (fd.get(k) || '').toString().trim();
    await store.contacts.save(upd);
    toast('Saved'); root.innerHTML = ''; root.classList.remove('contact-detail'); renderDetail(root, id);
  } },
    f('title', 'Title (Mrs., Rabbi …)', c.title), f('firstName', 'First name', c.firstName), f('lastName', 'Last name', c.lastName),
    f('city', 'City', c.city), f('phone', 'Phone', c.phone, 'tel'), f('email', 'Email', c.email, 'email'),
    h('div', { class: 'field' }, h('label', { for: 'f-about' }, 'About / how to work with them'),
      h('textarea', { class: 'input', id: 'f-about', name: 'about', dir: 'auto', 'data-id': 'contact.edit.about' }, c.about || '')),
    h('p', { class: 'note' }, 'Languages, communities, roles and status get proper pickers in Stage 2.'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', type: 'submit', 'data-id': 'contact.save-btn' }, 'Save'),
      h('button', { class: 'btn danger', type: 'button', 'data-id': 'contact.delete-btn', onClick: async () => {
        const { confirmDialog } = await import('../js/ui.js');
        if (await confirmDialog({ title: 'Delete this contact?', text: `${store.displayName(c)} will be removed from this phone. This cannot be undone.`, ok: 'Delete', danger: true, dataId: 'contact.delete-dialog' })) {
          await store.contacts.remove(id); toast('Contact deleted'); navigate('/contacts');
        }
      } }, 'Delete')));
  return form;
}
