// My Profile — placeholder until Stage 7. Every control here says so out loud.
import { h, section, comingLater } from '../js/ui.js';
export async function render(root) {
  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'My Profile')),
    section(null, 'profile.placeholder',
      h('div', { class: 'callout', 'data-id': 'profile.coming' }, 'Profile, Short versions and private Notes, in the original Claude look, with safe sharing.'),
      h('p', { class: 'empty' }, 'Coming in Stage 7.'),
      h('button', { class: 'btn block', 'data-id': 'profile.add-btn', onClick: () => comingLater('Edit profile', 7) }, 'Edit profile — coming in Stage 7')));
}
