// Guys and Girls (Shadchan Mode) — one page, shown once per bottom-bar tab.
// Stage S1: a plain list that proves the database, the bar and the shared pages (Add Person,
// the person card) work together. Stage S2 adds search, filters, Working on / All and
// loading more rows while scrolling.
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { peopleListPath, rememberList } from '../js/mode.js';
import { openDrafts, dropDraft } from './person-form.js';
import { dateOnly } from './people-data.js';
import { KIND_WORDS, statusOf, statusLabel, summaryLine, loadSingles, toFile } from './singles-data.js';

// Words on this page, in one place (other languages later).
const T = {
  soon: 'Search and filters are coming in stage S2.',
  empty: (w) => `No ${w.many} saved yet.`,
  emptyHint: 'Add the first one, or load 60 fictional singles to look around. They can be removed any time in Settings.',
  demoBtn: 'Try the demo',
  demoDone: (n) => (n ? `Demo loaded: ${n} singles` : 'The demo is already loaded'),
  draftsHead: (n) => `Not saved yet · ${n}`,
  draftSub: 'Unsaved form — tap to continue',
  discard: 'Discard',
  toFileHead: (n) => `To file · ${n}`,
  toFileNote: 'Profiles kept exactly as they arrived. Open one to file it.',
  noSender: 'sender not recorded',
  attached: 'Attached file',
  del: 'Delete',
  unmarkedHead: (n) => `Not marked Guy or Girl · ${n}`,
  more: (n) => `Show ${n} more`,
  working: 'Working on',
};
const PAGE = 60; // rows drawn at first; the rest come with "Show more"
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const firstLine = (t) => (t || '').trim().split('\n').find(l => l.trim())?.trim().slice(0, 80) || '';

let root = null, gen = 0, unsub = null, timer = 0, kind = 'guy';
const shown = { guy: PAGE, girl: PAGE }; // survives leaving the page

export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params, path) {
  // Shared pages go back to "/people": that is Guys or Girls here, whichever was used last in Add Person.
  if (!path.startsWith('/guys') && !path.startsWith('/girls')) { navigate(peopleListPath(store.getPrefs().personKind), { replace: true }); return; }
  root = container;
  kind = path.startsWith('/girls') ? 'girl' : 'guy';
  rememberList(kind);
  root.classList.add('singles-page');
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs') { clearTimeout(timer); timer = setTimeout(draw, 80); } });
  await draw();
}

async function draw() {
  const token = ++gen;
  const [{ list, unmarked, total }, later] = await Promise.all([loadSingles(kind), toFile(kind)]);
  if (token !== gen || !root) return;
  const w = KIND_WORDS[kind];
  const drafts = openDrafts();
  const rows = list.slice(0, shown[kind]);
  const rest = list.length - rows.length;

  root.innerHTML = '';
  root.append(...[
    h('div', { class: 'page-head' },
      h('h1', { 'data-id': 'singles.title' }, w.title, h('span', { class: 'sg-count', 'data-id': 'singles.count' }, String(list.length))),
      h('button', { type: 'button', class: 'btn primary', 'data-id': 'singles.add-btn', onClick: () => { store.setPref('personKind', kind); navigate('/people/new'); } }, w.add)),
    h('p', { class: 'note', 'data-id': 'singles.soon' }, T.soon),

    drafts.length ? h('section', { class: 'section', 'data-id': 'singles.drafts' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.draftsHead(drafts.length))),
      drafts.map(x => h('div', { class: 'row-link' },
        h('a', { class: 'row-main', href: x.href, 'data-id': 'singles.draft-open' },
          h('div', { class: 'row-title', dir: 'auto' }, x.editing ? `Editing ${x.name}` : x.name),
          h('div', { class: 'row-sub' }, T.draftSub)),
        h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'singles.draft-discard', onClick: async () => {
          if (await confirmDialog({ title: 'Discard this unsaved form?', text: 'Only the unsaved typing is lost. Saved people stay.', ok: T.discard, danger: true, dataId: 'singles.draft-dialog' })) { dropDraft(x.key); draw(); }
        } }, T.discard)))) : null,

    later.length ? h('section', { class: 'section', 'data-id': 'singles.to-file' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.toFileHead(later.length))),
      h('p', { class: 'note' }, T.toFileNote),
      later.map(s => h('div', { class: 'row-link' },
        h('div', { class: 'avatar', html: icon('file') }),
        h('a', { class: 'row-main', href: `#/people/new/from/${encodeURIComponent(s.id)}`, 'data-id': 'singles.to-file-open', onClick: () => store.setPref('personKind', kind) },
          h('div', { class: 'row-title', dir: 'auto' }, firstLine(s.text) || T.attached),
          h('div', { class: 'row-sub', dir: 'auto' }, [s.sender ? 'from ' + s.sender : T.noSender, dateOnly(s.receivedAt || s.createdAt)].join(' · '))),
        h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'singles.to-file-delete', onClick: async () => {
          if (!(await confirmDialog({ title: 'Delete this saved profile?', text: 'The text and any files kept with it go to Recently deleted for 30 days.', ok: T.del, danger: true, dataId: 'singles.to-file-dialog' }))) return;
          await store.asOne(async () => {
            for (const a of await store.attachments.list()) if (a.sourceId === s.id) await store.attachments.remove(a.id);
            await store.sources.remove(s.id);
          });
          toast('Deleted');
        } }, T.del)))) : null,

    h('section', { class: 'section', 'data-id': 'singles.list' },
      list.length ? [rows.map(personRow),
        rest > 0 ? h('button', { type: 'button', class: 'btn sg-more', 'data-id': 'singles.more', onClick: () => { shown[kind] += PAGE; draw(); } }, T.more(Math.min(rest, PAGE))) : null]
        : h('div', { class: 'empty', 'data-id': 'singles.empty' }, h('p', {}, T.empty(w)),
            total ? null : [h('p', { class: 'note' }, T.emptyHint),
              h('button', { type: 'button', class: 'btn', 'data-id': 'singles.try-demo', onClick: async (e) => { e.currentTarget.disabled = true; toast(T.demoDone(await store.loadFullDemo())); } }, T.demoBtn)])),

    unmarked.length ? h('section', { class: 'section', 'data-id': 'singles.unmarked' },
      h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, T.unmarkedHead(unmarked.length))),
      unmarked.map(personRow)) : null,
  ].filter(Boolean));
}

function personRow(p) {
  const st = statusOf(p);
  return h('a', { class: 'row-link sg-row' + (st === 'available' ? '' : ' sg-quiet'), href: `#/people/${encodeURIComponent(p.id)}`, 'data-id': 'singles.row' },
    h('div', { class: 'avatar' }, store.initials(p)),
    h('div', { class: 'row-main' },
      h('div', { class: 'row-title', dir: 'auto' }, store.personName(p),
        p.starred ? h('span', { class: 'sg-star', title: T.working, 'aria-label': T.working, 'data-id': 'singles.row-star', html: icon('star') }) : null),
      h('div', { class: 'row-sub', dir: 'auto' }, summaryLine(p))),
    st === 'available' ? null : h('span', { class: 'chip sg-status', 'data-id': 'singles.row-status' }, statusLabel(st)));
}
