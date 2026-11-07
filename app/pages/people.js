// People & Ideas — every saved person (one record each), originals saved for later,
// and unsaved Add Person drafts. A saved idea is not a formal shidduch offer.
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog } from '../js/ui.js';
import { openDrafts, dropDraft } from './person-form.js';
import { kindLabel, dateOnly } from './people-data.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const S = { q: '', filter: 'all' };   // survives leaving the page
const FILTERS = [['all', 'All'], ['guy', 'Guys'], ['girl', 'Girls'], ['interested', 'I’m interested'], ['waiting', 'Waiting to hear']];
const MINE_POSITIVE = ['Interested', 'Want to learn more'];
const THEIRS_WAITING = ['Checking availability', 'Thinking about it', 'Not asked yet'];

let root = null, gen = 0, unsub = null, timer = 0;
export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container) {
  root = container;
  root.classList.add('people-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs') { clearTimeout(timer); timer = setTimeout(draw, 80); } });
  await draw();
}

async function draw() {
  const token = ++gen;
  const [people, later, ints, contacts, srcs] = await Promise.all([
    store.people.list(), store.unfiledSources(), store.interests.list(), store.contacts.list(), store.sources.list()]);
  if (token !== gen || !root) return;
  const byId = new Map(contacts.map(c => [c.id, c]));
  const latest = new Map(); // personId → { mine, theirs }
  for (const i of [...ints].sort((a, b) => (a.at || '').localeCompare(b.at || ''))) {
    const cur = latest.get(i.personId) || {}; cur[i.side] = i; latest.set(i.personId, cur);
  }
  const senders = new Map();
  for (const s of srcs) if (s.personId && s.sender) (senders.get(s.personId) || senders.set(s.personId, new Set()).get(s.personId)).add(s.sender);
  const searchText = (p) => [p.name, p.city, p.occupation, p.about, p.looking, p.sender, ...(p.languages || []),
    ...(p.contactCards || []).map(c => c.name), ...(p.contactIds || []).map(id => byId.get(id)).filter(Boolean).map(c => store.displayName(c)),
    ...(senders.get(p.id) || [])].filter(Boolean).join(' ').toLowerCase();
  const words = S.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = people.filter(p => {
    if (words.length && !words.every(w => searchText(p).includes(w))) return false;
    const l = latest.get(p.id) || {};
    if (S.filter === 'guy' || S.filter === 'girl') return p.kind === S.filter;
    if (S.filter === 'interested') return MINE_POSITIVE.includes(l.mine?.value);
    if (S.filter === 'waiting') return THEIRS_WAITING.includes(l.theirs?.value);
    return true;
  }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const search = h('input', { class: 'input', type: 'search', value: S.q, placeholder: 'Search name, city, shadchan…', 'aria-label': 'Search people', dir: 'auto', 'data-id': 'people.search',
    onInput: (e) => { S.q = e.target.value; clearTimeout(timer); timer = setTimeout(() => draw().then(() => { const s = root?.querySelector('[data-id="people.search"]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }), 150); } });
  const drafts = openDrafts();

  root.innerHTML = '';
  root.append(...[
    h('div', { class: 'page-head' }, h('h1', {}, 'People & Ideas'),
      h('a', { class: 'btn primary', href: '#/people/new', 'data-id': 'people.add-btn' }, 'Add Person')),
    h('p', { class: 'note intro' }, 'Everyone suggested to you, one record each. Saving someone here is not a formal offer.'),
    h('div', { class: 'ct-search' }, ico('search'), search),
    h('div', { class: 'chips filter-chips', role: 'group', 'aria-label': 'Show', 'data-id': 'people.filters' },
      FILTERS.map(([k, l]) => h('button', { type: 'button', class: 'bubble', 'aria-pressed': S.filter === k ? 'true' : 'false', 'data-id': 'people.filter-' + k,
        onClick: () => { S.filter = k; draw(); } }, l))),
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
      h('p', { class: 'note' }, 'Originals kept exactly as received. Whose profile it is has not been filed yet.'),
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
    h('section', { class: 'section', 'data-id': 'people.list' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, `People · ${list.length}${list.length !== people.length ? ' of ' + people.length : ''}`)),
      list.length ? list.map(p => personRow(p, latest.get(p.id) || {}, byId))
        : h('div', { class: 'empty' }, people.length ? 'Nobody matches. ' : 'No people saved yet. ',
            people.length ? h('button', { type: 'button', class: 'linkish', 'data-id': 'people.clear', onClick: () => { S.q = ''; S.filter = 'all'; draw(); } }, 'Show everyone')
              : h('a', { href: '#/people/new' }, 'Add the first person'))),
  ].filter(Boolean));
}

function firstLine(t) { return (t || '').trim().split('\n').find(l => l.trim())?.trim().slice(0, 80) || ''; }

function personRow(p, l, byId) {
  const from = (p.contactIds || []).map(id => byId.get(id)).filter(Boolean).map(c => store.displayName(c));
  const sub = [p.age, p.city, p.occupation].filter(Boolean).join(' · ') || 'Details not recorded';
  return h('a', { class: 'row-link person-row', href: `#/people/${encodeURIComponent(p.id)}`, 'data-id': 'people.row' },
    h('div', { class: 'avatar' }, store.initials(p)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, store.personName(p)),
      h('div', { class: 'row-sub', dir: 'auto' }, sub),
      from.length || p.sender ? h('div', { class: 'row-sub', dir: 'auto' }, 'via ' + (from.length ? from.join(', ') : p.sender)) : null),
    h('div', { class: 'row-tags' },
      p.kind ? h('span', { class: 'chip' }, kindLabel(p.kind)) : null,
      l.mine ? h('span', { class: 'chip strong' }, l.mine.value) : null));
}
