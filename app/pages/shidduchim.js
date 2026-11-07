// Shidduchim — lanes arrive in Stage 5. People & Ideas (Stage 4) is reachable from here,
// which is where it lives in the three-destination navigation.
import * as store from '../js/store.js';
import { h, section, comingLater } from '../js/ui.js';
export async function render(root) {
  const people = await store.people.count();
  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Shidduchim')),
    section('People & Ideas', 'shidduchim.people',
      h('a', { class: 'row-link', href: '#/people', 'data-id': 'shidduchim.people-link' },
        h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, `People & Ideas · ${people}`),
          h('div', { class: 'row-sub' }, 'Everyone suggested to you. Saving someone is not a formal offer.'))),
      h('a', { class: 'btn block', href: '#/people/new', 'data-id': 'shidduchim.add-person' }, 'Add Person')),
    section('Offers · In Progress · Ended', 'shidduchim.placeholder',
      h('div', { class: 'callout', 'data-id': 'shidduchim.coming' }, 'Offers, In Progress and Ended lanes with the 11-step bar, Overview, Dates and History arrive in Stage 5.'),
      h('button', { class: 'btn block', 'data-id': 'shidduchim.add-btn', onClick: () => comingLater('New offer', 5) }, 'New offer — coming in Stage 5')));
}
