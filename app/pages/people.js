// People & Ideas — placeholder until Stage 4. Every control here says so out loud.
import { h, section, comingLater } from '../js/ui.js';
export async function render(root) {
  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'People & Ideas')),
    section(null, 'people.placeholder',
      h('div', { class: 'callout', 'data-id': 'people.coming' }, 'Saved people and ideas will show here as Profile-style cards with Profile, Offers and Notes tabs, populated from Add Person (Stage 3).'),
      h('p', { class: 'empty' }, 'Coming in Stage 4.'),
      h('button', { class: 'btn block', 'data-id': 'people.add-btn', onClick: () => comingLater('Add Person', 4) }, 'Add Person — coming in Stage 4')));
}
