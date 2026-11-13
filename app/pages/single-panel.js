// Shadchan Mode — the top of a single's card (design.md 6.2): Status, Working on, looking-for
// age from–to, Talk to, Last confirmed looking, Find a match. Lives on the Profile tab of the
// shared person card. Saves straight to the one person record through the card's save().
import * as store from '../js/store.js';
import { h, icon, toast, sheet } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { STATUSES, statusOf, agoWords } from './singles-data.js';
import { dateOnly } from './people-data.js';

const T = {
  head: 'Shadchan',
  status: 'Status',
  working: 'Working on',
  workingOn: 'Working on',
  workingOff: 'On file',
  ages: 'Looking for ages',
  from: 'from', to: 'to',
  talkTo: 'Talk to',
  notChosen: 'Not chosen yet',
  noCards: 'No numbers saved yet. Edit the person to add a parent’s or their own number.',
  confirmed: 'Last confirmed looking',
  never: 'never confirmed',
  confirmBtn: 'Still looking — today',
  confirmedToast: 'Marked as confirmed today',
  busyUntil: (d) => `Busy · check again on ${dateOnly(d)}`,
  busyAuto: 'Busy while dating: set by the shidduch itself.',
  engagedAuto: 'Engaged: set by the shidduch itself.',
  openShidduch: 'Open the shidduch',
  busyTitle: 'Busy elsewhere',
  busyText: 'When should you check again? A follow-up is made for that day. Leave empty for no reminder.',
  busyFu: (name) => `Check if ${name} is free again`,
  find: 'Find a match',
};
const STALE_DAYS = 90; // older than this, "Last confirmed looking" is shown in the warning colour
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const today = () => new Date().toISOString().slice(0, 10);
const roleWord = (c, p) => (c.role === 'person' ? 'Own number' : store.phoneRoleLabel(c.role));
const cardName = (c, p) => c.name || (c.role === 'person' ? store.personName(p) : '') || 'Name not recorded';

export function singlePanel(p, save) {
  const st = statusOf(p);
  const cards = (p.contactCards || []).filter(c => c.role !== 'unknown' || c.name || c.number);
  const days = p.confirmedAt ? (Date.now() - new Date(p.confirmedAt.slice(0, 10) + 'T12:00:00').getTime()) / 86400000 : Infinity;
  const row = (label, dataId, ...kids) => h('div', { class: 'sp-row', 'data-id': dataId }, h('span', { class: 'sp-label' }, label), ...kids);
  const ageInput = (key, ph, dataId) => h('input', { class: 'input tiny', type: 'number', min: 18, max: 120, inputmode: 'numeric', value: p[key] || '', placeholder: ph, 'aria-label': `${T.ages} ${ph}`, 'data-id': dataId,
    onChange: (e) => save({ [key]: e.target.value.trim() }, true) });

  return h('section', { class: 'pc-sec sp-panel', 'data-id': 'person-card.shadchan' },
    row(T.status, 'person-card.status',
      h('select', { class: 'input', 'aria-label': T.status, 'data-id': 'person-card.status-select', onChange: (e) => setStatus(p, e.target.value, save, e.target) },
        STATUSES.map(([v, l]) => h('option', { value: v, selected: st === v || null }, l))),
      h('button', { type: 'button', class: 'btn small sp-star', 'aria-pressed': p.starred ? 'true' : 'false', 'data-id': 'person-card.working-on',
        title: p.starred ? 'Tap to put back on file' : 'Tap to mark Working on',
        onClick: () => save({ starred: !p.starred }, true) }, ico('star'), p.starred ? T.workingOn : T.workingOff)),
    st === 'busy' && p.busyUntil ? h('p', { class: 'note', 'data-id': 'person-card.busy-until' }, T.busyUntil(p.busyUntil)) : null,
    // Stage S3: Busy or Engaged that a shidduch set by itself (it goes back to Available when that shidduch ends).
    p.statusBy && (st === 'busy' || st === 'engaged') ? h('p', { class: 'note', 'data-id': 'person-card.status-by' }, st === 'busy' ? T.busyAuto : T.engagedAuto, ' ',
      h('a', { href: `#/shidduchim/${encodeURIComponent(p.statusBy)}`, 'data-id': 'person-card.status-by-open' }, T.openShidduch)) : null,
    row(T.ages, 'person-card.ages', ageInput('minAge', T.from, 'person-card.min-age'), h('span', { class: 'note' }, '–'), ageInput('maxAge', T.to, 'person-card.max-age')),
    row(T.talkTo, 'person-card.talk-to', cards.length
      ? h('select', { class: 'input', 'aria-label': T.talkTo, 'data-id': 'person-card.talk-to-select', onChange: (e) => save({ talkTo: e.target.value || null }, true) },
          h('option', { value: '', selected: !p.talkTo || null }, T.notChosen),
          cards.map(c => h('option', { value: c.id, selected: p.talkTo === c.id || null }, `${roleWord(c, p)} · ${cardName(c, p)}`)))
      : h('span', { class: 'note grow' }, T.noCards)),
    row(T.confirmed, 'person-card.confirmed',
      h('span', { class: 'grow small' + (days > STALE_DAYS ? ' sp-stale' : '') }, p.confirmedAt ? agoWords(p.confirmedAt) : T.never),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.confirm-btn', onClick: async () => { await save({ confirmedAt: today() }, true); toast(T.confirmedToast); } }, T.confirmBtn)),
    // Main action, last and full width (easy to reach with the thumb), with a line above it.
    h('button', { type: 'button', class: 'btn primary sp-find', 'data-id': 'person-card.find-match', onClick: () => navigate(`/match/${encodeURIComponent(p.id)}`) }, T.find));
}

// Busy by hand asks "check again on …" and makes a follow-up for that day (design.md 6.2).
async function setStatus(p, v, save, select) {
  if (v !== 'busy') { await save({ status: v, busyUntil: null, statusBy: null }, true); return; }
  const input = h('input', { class: 'input', type: 'date', min: today(), 'data-id': 'person-card.busy-date' });
  const res = await sheet({ title: T.busyTitle, dataId: 'person-card.busy-sheet',
    body: [h('p', {}, T.busyText), h('div', { class: 'field' }, h('label', {}, 'Check again on'), input)],
    actions: [{ id: 'ok', label: 'Set Busy', primary: true }] });
  if (res !== 'ok') { select.value = statusOf(p); return; }
  const d = input.value || null;
  await save({ status: 'busy', busyUntil: d, statusBy: null }, true);
  if (d) {
    await store.followUps.save({ personId: p.id, contactId: null, noteId: null, kind: 'task', text: T.busyFu(store.personName(p)), dueAt: d, done: false });
    toast('Busy · follow-up made for ' + dateOnly(d));
  }
}
