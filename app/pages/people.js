// Ideas — every saved person (one record each), originals saved for later,
// and unsaved Add Person drafts. A saved idea is not a formal shidduch offer.
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog, swipeTabs, dock } from '../js/ui.js';
import { openDrafts, dropDraft } from './person-form.js';
import { kindLabel, dateOnly, seekingKind, pron } from './people-data.js';
import { ideaStatus, latestByPerson, stepChips } from './idea-flow.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const S = { q: '', closedOpen: false };   // survives leaving the page
// One list in groups instead of tabs (owner request, Nov 2026: tabs made people hard to find).
// Closed is folded at the bottom. Each row carries its next-step buttons (idea-flow.js stepChips).
const GROUPS = (P) => [['new', 'To decide'], ['waiting', 'Waiting for ' + P.his + ' answer'], ['shidduch', 'In a shidduch'], ['closed', 'Closed']];

let root = null, gen = 0, unsub = null, timer = 0;
export function destroy() { if (root) swipeTabs(root, null); root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container) {
  root = container;
  root.classList.add('people-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs') { clearTimeout(timer); timer = setTimeout(draw, 80); } });
  await draw();
}

async function draw() {
  const token = ++gen;
  const [people, later, ints, contacts, srcs, offers] = await Promise.all([
    store.people.list(), store.unfiledSources(), store.interests.list(), store.contacts.list(), store.sources.list(), store.offers.list()]);
  if (token !== gen || !root) return;
  const byId = new Map(contacts.map(c => [c.id, c]));
  const latest = latestByPerson(ints);
  const withOffer = new Set(offers.filter(o => o.status !== 'ended').map(o => o.personId));
  const endedOnly = new Map(offers.filter(o => o.status === 'ended').map(o => [o.personId, o.updatedAt || true]));
  const status = new Map(people.map(p => [p.id, ideaStatus(p, latest.get(p.id), withOffer.has(p.id), endedOnly.get(p.id) || false)]));
  const senders = new Map();
  for (const s of srcs) if (s.personId && s.sender) (senders.get(s.personId) || senders.set(s.personId, new Set()).get(s.personId)).add(s.sender);
  const searchText = (p) => [p.name, p.city, p.occupation, p.about, p.looking, p.sender, ...(p.languages || []),
    ...(p.contactCards || []).map(c => c.name), ...(p.contactIds || []).map(id => byId.get(id)).filter(Boolean).map(c => store.displayName(c)),
    ...(senders.get(p.id) || [])].filter(Boolean).join(' ').toLowerCase();
  const words = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const seek = seekingKind(store.getPrefs());
  const list = people.filter(p => {
    if (seek && p.kind && p.kind !== seek) return false;
    return !words.length || words.every(w => searchText(p).includes(w));
  }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const P = pron({ kind: seek || 'girl' });
  const groups = GROUPS(P).map(([key, label]) => [key, label, list.filter(p => status.get(p.id).key === key)]);

  const search = h('input', { class: 'input', type: 'search', value: S.q, placeholder: 'Search name, city, shadchan…', 'aria-label': 'Search people', dir: 'auto', 'data-id': 'people.search',
    onInput: (e) => { S.q = e.target.value; clearTimeout(timer); timer = setTimeout(() => draw().then(() => { const s = root?.querySelector('[data-id="people.search"]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }), 150); } });
  const drafts = openDrafts();

  root.innerHTML = '';
  root.append(...[
    h('div', { class: 'page-head' }, h('h1', {}, 'Ideas')),
    h('div', { class: 'ct-search' }, ico('search'), search),
    drafts.length ? h('section', { class: 'section', 'data-id': 'people.drafts' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `Not saved yet · ${drafts.length}`)),
      drafts.map(x => h('div', { class: 'row-link' },
        h('a', { class: 'row-main', href: x.href, 'data-id': 'people.draft-open' },
          h('div', { class: 'row-title', dir: 'auto' }, x.editing ? `Editing ${x.name}` : x.name),
          h('div', { class: 'row-sub' }, 'Unsaved form — tap to continue')),
        h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'people.draft-discard', onClick: async () => {
          if (await confirmDialog({ title: 'Discard this unsaved form?', text: 'Only the unsaved typing is lost. Saved people stay.', ok: 'Discard', danger: true, dataId: 'people.draft-dialog' })) { dropDraft(x.key); draw(); }
        } }, 'Discard')))) : null,
    later.length ? h('section', { class: 'section', 'data-id': 'people.later' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `Saved for later · ${later.length}`)),
      later.map(s => h('div', { class: 'row-link' },
        h('div', { class: 'avatar', html: icon('file') }),
        h('a', { class: 'row-main', href: `#/people/new/from/${encodeURIComponent(s.id)}`, 'data-id': 'people.later-open' },
          h('div', { class: 'row-title', dir: 'auto' }, firstLine(s.text) || 'Attached file'),
          h('div', { class: 'row-sub', dir: 'auto' }, [s.sender ? 'from ' + s.sender : 'sender not recorded', dateOnly(s.receivedAt || s.createdAt)].join(' · '))),
        h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'people.later-delete', onClick: async () => {
          if (!(await confirmDialog({ title: 'Delete this saved original?', text: 'The text and any files kept with it are removed from this phone.', ok: 'Delete', danger: true, dataId: 'people.later-dialog' }))) return;
          for (const a of (await store.attachments.list()).filter(a => a.sourceId === s.id)) await store.attachments.remove(a.id);
          await store.sources.remove(s.id); toast('Deleted');
        } }, 'Delete')))) : null,
    !list.length ? h('section', { class: 'section', 'data-id': 'people.list' },
      h('div', { class: 'empty' }, people.length ? 'Nobody matches. ' : 'No people saved yet. ',
        people.length ? h('button', { type: 'button', class: 'linkish', 'data-id': 'people.clear', onClick: () => { S.q = ''; draw(); } }, 'Clear search')
          : h('a', { href: '#/people/new' }, 'Add the first person'))) : null,
    ...groups.filter(g => g[2].length).map(([key, label, rows]) => key === 'closed'
      ? h('details', { class: 'section people-closed', open: S.closedOpen || S.q ? true : null, 'data-id': 'people.group-closed',
          onToggle: (e) => { if (!S.q) S.closedOpen = e.currentTarget.open; } },
          h('summary', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `${label} · ${rows.length}`), h('span', { class: 'note people-closed-hint' }, S.closedOpen || S.q ? 'tap to hide' : 'tap to show')),
          rows.map(p => personRow(p, status.get(p.id), byId)))
      : h('section', { class: 'section', 'data-id': 'people.group-' + key },
          h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `${label} · ${rows.length}`)),
          rows.map(p => personRow(p, status.get(p.id), byId)))),
    // Add Person sits at the bottom, near the thumb (owner-approved, Nov 2026).
    dock('people.dock', h('a', { class: 'btn primary wide', href: '#/people/new', 'data-id': 'people.add-btn' }, 'Add Person')),
  ].filter(Boolean));
}

function firstLine(t) { return (t || '').trim().split('\n').find(l => l.trim())?.trim().slice(0, 80) || ''; }

function personRow(p, st, byId) {
  const from = (p.contactIds || []).map(id => byId.get(id)).filter(Boolean).map(c => store.displayName(c));
  const sub = [p.age, p.city, p.occupation].filter(Boolean).join(' · ') || 'Details not recorded';
  const link = h('a', { class: 'row-link person-row' + (st.key === 'closed' ? ' closed' : ''), href: `#/people/${encodeURIComponent(p.id)}`, 'data-id': 'people.row' },
    h('div', { class: 'avatar' }, store.initials(p)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, store.personName(p)),
      h('div', { class: 'row-sub', dir: 'auto' }, sub),
      from.length || p.sender ? h('div', { class: 'row-sub', dir: 'auto' }, 'via ' + (from.length ? from.join(', ') : p.sender)) : null,
      // Status sits on its own line under the details, so it never covers the work or city (owner request).
      st.key === 'closed' ? h('span', { class: 'chip row-status st-' + (st.key === 'new' ? 'yes' : st.key), 'data-id': 'people.row-status' }, st.label) : null),
    p.kind ? h('div', { class: 'row-tags' }, h('span', { class: 'chip' }, kindLabel(p.kind))) : null);
  // The next steps sit right under the person: one tap, Undo in the message (owner request, Nov 2026).
  const steps = stepChips(p, st);
  return steps ? h('div', { class: 'person-row-wrap', 'data-id': 'people.row-wrap' }, link, steps) : link;
}
