// Shidduchim in Shadchan Mode — not built yet (stage S3). An honest page instead of an empty one.
// In this mode a shidduch is a guy and a girl with an answer from each side, so it gets its own
// data module; Single Mode's Shidduchim (me and one person) is not reused for the records.
import { h } from '../js/ui.js';

const T = {
  title: 'Shidduchim',
  lead: 'This is where every shidduch will live: one card for a guy and a girl, with each side’s answer and what happens next.',
  when: 'It is built in stage S3. Nothing is saved here yet.',
  parts: ['Ideas, Offers, In Progress and Ended', 'An answer for his side and for her side', 'Dates, with both answers after each one', 'One shared history'],
};

export function render(root) {
  root.classList.add('soon-page');
  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, T.title)),
    h('section', { class: 'section', 'data-id': 'sh-shidduchim.soon' },
      h('p', {}, T.lead),
      h('ul', { class: 'soon-list' }, T.parts.map(x => h('li', {}, x))),
      h('p', { class: 'note' }, T.when)));
}
