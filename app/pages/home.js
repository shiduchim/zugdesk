// Home — Stage 1 placeholder with live counts from the shared store.
// The real Home (notes, follow-ups, history) arrives in Stage 6 (spec/home.md).
import * as store from '../js/store.js';
import { h, section, comingLater } from '../js/ui.js';

let unsub = null;

export async function render(root) {
  const c = await store.counts();
  root.append(
    h('div', { class: 'home-hero', 'data-id': 'home.hero' },
      h('h1', {}, 'ZugDesk'),
      h('p', {}, 'Your shadchanim, suggested people and shidduchim — all in one place, kept on this phone.')),
    section('Right now', 'home.stats',
      h('div', { class: 'stats' },
        h('a', { class: 'stat', href: '#/contacts', 'data-id': 'home.stat-contacts' }, h('b', {}, c.contacts), h('span', {}, 'contacts')),
        h('a', { class: 'stat', href: '#/people', 'data-id': 'home.stat-people' }, h('b', {}, c.people), h('span', {}, 'people & ideas')),
        h('a', { class: 'stat', href: '#/shidduchim', 'data-id': 'home.stat-offers' }, h('b', {}, c.offers), h('span', {}, 'offers')),
        h('a', { class: 'stat', href: '#/home', 'data-id': 'home.stat-notes', onClick: (e) => { e.preventDefault(); comingLater('Notes', 6); } }, h('b', {}, c.notes), h('span', {}, 'notes')))),
    section('Quick note', 'home.notes',
      h('p', { class: 'note' }, 'Notes, follow-ups and history come in Stage 6. Until then this is a placeholder.'),
      h('button', { class: 'btn block', 'data-id': 'home.add-note', onClick: () => comingLater('Quick note', 6) }, 'Add a note — coming in Stage 6')),
    section('Follow-ups', 'home.followups',
      h('p', { class: 'empty' }, 'No follow-ups yet. Coming in Stage 6.')),
    h('div', { class: 'stamp', style: 'padding-top:12px' }, `Stage 1 foundation · v${store.APP_VERSION}`),
  );
  unsub = store.subscribe(() => {}); // placeholder for later live updates
}
export function destroy() { unsub && unsub(); unsub = null; }
