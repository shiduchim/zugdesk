// Shidduchim — placeholder until Stage 5. Every control here says so out loud.
import { h, section, comingLater } from '../js/ui.js';
export async function render(root) {
  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Shidduchim')),
    section(null, 'shidduchim.placeholder',
      h('div', { class: 'callout', 'data-id': 'shidduchim.coming' }, 'Offers, In Progress and Ended lanes with the 11-step bar, Overview, Dates and History.'),
      h('p', { class: 'empty' }, 'Coming in Stage 5.'),
      h('button', { class: 'btn block', 'data-id': 'shidduchim.add-btn', onClick: () => comingLater('New offer', 5) }, 'New offer — coming in Stage 5')));
}
