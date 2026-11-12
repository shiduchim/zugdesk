// Recently deleted (Shadchan Mode) — everything deleted waits here for 30 days.
// One line per deletion: a single deleted with her originals and follow-ups is one line,
// and Restore puts all of it back together. The store does the work (js/store.js).
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog } from '../js/ui.js';

const T = {
  title: 'Recently deleted',
  lead: (d) => `Deleted things wait here for ${d} days. After that they are erased for good.`,
  empty: 'Nothing here.',
  restore: 'Restore',
  erase: 'Delete forever',
  restored: 'Restored',
  erased: 'Deleted forever',
  eraseTitle: 'Delete forever?',
  eraseText: (name) => `“${name}” will be erased from this device now. This cannot be undone.`,
  left: (n) => (n <= 0 ? 'last day' : n === 1 ? '1 day left' : `${n} days left`),
  parts: (n) => (n === 1 ? 'with 1 linked item' : `with ${n} linked items`),
};
// Which record names a deletion, most important first, and the word shown for it.
const KINDS = [
  ['people', 'Single', (r) => store.personName(r)],
  ['contacts', 'Contact', (r) => store.displayName(r)],
  ['notes', 'Note', (r) => r.title],
  ['offers', 'Shidduch', () => ''],
  ['sources', 'Saved profile', (r) => firstLine(r.text)],
  ['events', 'Conversation', (r) => firstLine(r.text)],
  ['followUps', 'Follow-up', (r) => r.text],
  ['folders', 'Folder', (r) => r.name],
  ['attachments', 'File', (r) => r.name],
];
const firstLine = (t) => (t || '').trim().split('\n').find(l => l.trim())?.trim().slice(0, 80) || '';

function describe(group) {
  for (const [storeName, word, nameOf] of KINDS) {
    const hit = group.items.find(i => i.store === storeName);
    if (hit) return { word, name: nameOf(hit.rec) || '(no name)' };
  }
  return { word: 'Record', name: group.items[0].store };
}

let root = null, gen = 0, unsub = null, timer = 0;
export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container) {
  root = container;
  root.classList.add('deleted-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs') { clearTimeout(timer); timer = setTimeout(draw, 80); } });
  await draw();
}

async function draw() {
  const token = ++gen;
  const groups = await store.listDeleted();
  if (token !== gen || !root) return;
  root.innerHTML = '';
  root.append(
    h('div', { class: 'page-head' },
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Back to Settings', 'data-id': 'deleted.back', html: icon('back') }),
      h('h1', {}, T.title)),
    h('p', { class: 'note', 'data-id': 'deleted.lead' }, T.lead(store.KEEP_DELETED_DAYS)),
    h('section', { class: 'section', 'data-id': 'deleted.list' },
      groups.length ? groups.map(row) : h('p', { class: 'empty', 'data-id': 'deleted.empty' }, T.empty)));
}

function row(g) {
  const { word, name } = describe(g);
  const daysLeft = store.KEEP_DELETED_DAYS - Math.floor((Date.now() - new Date(g.at).getTime()) / 86400000);
  const sub = [`Deleted ${store.formatDate(g.at)}`, T.left(daysLeft), g.items.length > 1 ? T.parts(g.items.length - 1) : null].filter(Boolean).join(' · ');
  return h('div', { class: 'del-row', 'data-id': 'deleted.row' },
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, `${word} · ${name}`),
      h('div', { class: 'row-sub' }, sub)),
    h('div', { class: 'del-acts' },
      h('button', { type: 'button', class: 'btn small', 'data-id': 'deleted.restore', onClick: async () => { await store.restoreDeleted(g.batch); toast(T.restored); } }, T.restore),
      h('button', { type: 'button', class: 'btn small danger', 'data-id': 'deleted.erase', onClick: async () => {
        if (!(await confirmDialog({ title: T.eraseTitle, text: T.eraseText(name), ok: T.erase, danger: true, dataId: 'deleted.erase-dialog' }))) return;
        await store.eraseDeleted(g.batch); toast(T.erased);
      } }, T.erase)));
}
