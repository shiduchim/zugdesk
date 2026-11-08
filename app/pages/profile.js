// My Profile — Profile · Short versions · Notes (spec/my-profile.md; source My Profile.html and
// my profile short tab.html, Claude look). One owner record; the tabs are views of it.
// Private notes live in the shared notes store (me: true) and never enter outgoing text.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, confirmDialog, promptText } from '../js/ui.js';
import { navigate } from '../js/router.js';
import * as PD from './profile-data.js';
import * as N from './notes-data.js';
import { openShare, copy } from './profile-share.js';

const TABS = [['profile', 'Profile'], ['short', 'Short versions'], ['notes', 'Notes']];
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const MAX_FILE = 5 * 1024 * 1024;

let root = null, unsub = null, timer = 0, gen = 0, tab = 'profile';
let P = null, ND = null, lang = 'en';
let lastDeleted = null;               // { version } for the inline Undo line
let shareOpen = false;
const W = { noteId: null, entryId: null, text: '', saveTimer: 0, savedAt: null }; // note being written

export function destroy() { flushNote(); root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); N.closeMenu(); }

export async function render(container, params) {
  root = container;
  root.classList.add('profile-page', 'wide');
  tab = TABS.some(t => t[0] === params.tab) ? params.tab : 'profile';
  unsub = store.subscribe((ch) => {
    if (ch.store === 'prefs' || ch.store === 'meta') return;
    if (W.busy) return; // our own autosave: do not redraw under the typing finger
    clearTimeout(timer); timer = setTimeout(() => draw(true), 100);
  });
  await draw();
}

async function draw(keep = false) {
  const token = ++gen;
  const [p, nd] = await Promise.all([PD.loadProfile(), N.loadNotes()]);
  if (token !== gen || !root) return;
  P = p; ND = nd;
  lang = P.me?.lang || 'en'; // the profile is written in one language; each short version chooses its own
  const y = window.scrollY;
  const active = document.activeElement?.dataset?.id === 'profile.note-composer' ? document.activeElement : null;
  if (active && tab === 'notes') { refreshNotesList(); return; } // keep the composer as it is
  root.innerHTML = '';
  const v = PD.view(P.me, lang);
  const myNotes = ND.notes.filter(n => n.me);
  root.append(h('div', { class: 'mp-layout' },
    sideNav(v, myNotes.length),
    h('div', { class: 'mp-main' },
      header(v),
      h('div', { class: 'pc-tabs mp-tabs', role: 'tablist', 'data-id': 'profile.tabs' },
        TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', 'data-id': 'profile.tab-' + k, onClick: () => setTab(k) }, l))),
      h('div', { class: 'mp-body', dir: PD.isRtl(lang) && tab !== 'notes' ? 'rtl' : null, 'data-id': 'profile.' + tab },
        tab === 'profile' ? profileTab(v) : tab === 'short' ? shortTab(v) : notesTab(myNotes)))));
  if (keep) window.scrollTo(0, y);
}
function setTab(k) { navigate(k === 'profile' ? '/profile' : '/profile/' + k, { replace: true }); }

// ---------- header + desktop navigator ----------
function header(v) {
  return h('div', { class: 'mp-head', 'data-id': 'profile.header' },
    h('h1', { dir: 'auto' }, v.name || 'My Profile'),
    h('span', { class: 'spacer' }),
    h('a', { class: 'icon-btn bordered', href: '#/profile/edit', 'aria-label': 'Edit profile', title: 'Edit profile', 'data-id': 'profile.edit', html: icon('edit') }),
    h('button', { type: 'button', class: 'btn primary', 'data-id': 'profile.share', onClick: () => share() }, 'Share'));
}
async function share(opts) { if (shareOpen) return; shareOpen = true; try { await openShare(opts); } finally { shareOpen = false; } }

function sideNav(v, notesCount) {
  const go = (id) => (e) => { e.preventDefault(); if (tab !== 'profile') { setTab('profile'); setTimeout(() => scrollToSec(id), 250); } else scrollToSec(id); };
  const link = (label, id) => h('a', { href: '#/profile', class: 'mp-nav-sub', onClick: go(id) }, label);
  return h('nav', { class: 'mp-nav', 'aria-label': 'My Profile sections', 'data-id': 'profile.side-nav' },
    h('div', { class: 'mp-nav-title' }, 'My Profile'),
    h('a', { href: '#/profile', class: 'mp-nav-item', 'aria-current': tab === 'profile' ? 'page' : null }, 'Profile'),
    link('Facts', 'mp-facts'), link('About me', 'mp-about'), link('What I’m looking for', 'mp-looking'), link('Contact', 'mp-contact'), link('References', 'mp-refs'), link('Files', 'mp-files'),
    h('a', { href: '#/profile/short', class: 'mp-nav-item', 'aria-current': tab === 'short' ? 'page' : null }, 'Short versions', h('span', { class: 'mp-count' }, String(P.versions.length + 1))),
    h('a', { href: '#/profile/notes', class: 'mp-nav-item', 'aria-current': tab === 'notes' ? 'page' : null }, 'Notes', h('span', { class: 'mp-count' }, String(notesCount))),
    h('div', { class: 'mp-nav-foot' },
      h('button', { type: 'button', class: 'linkish', 'data-id': 'profile.side-add-section', onClick: () => navigate('/profile/edit/me-sections') }, 'Add section…'),
      h('div', { class: 'stamp' }, P.me?.updatedAt ? 'updated ' + store.formatDate(P.me.updatedAt) : 'not saved yet')));
}
function scrollToSec(id) { document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }

// ---------- Profile tab ----------
// Profile tab = how your profile reads (owner request, tweak mode). Editing happens in the
// Add Person–style form at #/profile/edit; each pencil opens it at that section.
const notYet = (what) => h('span', { class: 'muted' }, what || 'Not filled in yet');
const editAt = (s) => '#/profile/edit' + (s ? '/' + s : '');
function sec(title, id, dataId, editSec, ...kids) {
  return h('section', { class: 'pc-sec', id, 'data-id': dataId },
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow', dir: 'auto' }, title),
      editSec ? h('a', { class: 'icon-btn', href: editAt(editSec), 'aria-label': 'Edit ' + title.toLowerCase(), 'data-id': dataId + '-edit', html: icon('edit') }) : null),
    ...kids);
}
const fact = (k, v, dataId, extra = null) => h('div', { class: 'fact', 'data-id': dataId }, h('dt', { dir: 'auto' }, k), h('dd', { dir: 'auto' }, v || notYet()), extra);
function profileTab(v) {
  const l = PD.L(lang);
  const c = v.contact;
  const iAm = store.getPrefs().iAm;
  return [
    !P.me ? h('div', { class: 'callout', 'data-id': 'profile.start' }, 'This is your own profile — the one you send to shadchanim. Tap the pencil at the top to fill it in. Everything stays on this phone until you choose to share it.') : null,
    h('div', { class: 'pc-summary', 'data-id': 'profile.summary' },
      h('div', { class: 'avatar lg' }, P.me?.name ? store.initials({ name: P.me.name }) : 'ME'),
      h('div', { class: 'pc-summary-text' },
        h('div', { class: 'pc-summary-line', dir: 'auto' }, PD.summaryLine(v) || notYet('Age · city · work')),
        h('div', { class: 'muted', dir: 'auto' }, v.intro || 'A one-line introduction')),
      h('a', { class: 'icon-btn', href: editAt('me-basic'), 'aria-label': 'Edit summary', 'data-id': 'profile.summary-edit', html: icon('edit') })),
    sec(l.facts, 'mp-facts', 'profile.facts', 'personal',
      h('dl', { class: 'facts' },
        fact('I am a', iAm === 'guy' ? 'Guy' : iAm === 'girl' ? 'Girl' : '', 'profile.fact-i-am'),
        fact('Age', v.age, 'profile.fact-age'), fact('City', v.city, 'profile.fact-city'), fact('Work / learning', v.occupation, 'profile.fact-work'),
        ...v.facts.map(f => fact(f.label, f.value, 'profile.fact')))),
    sec(l.about, 'mp-about', 'profile.about', 'about', h('p', { dir: 'auto', class: 'prewrap' }, v.about || notYet())),
    sec(l.looking, 'mp-looking', 'profile.looking', 'about', h('p', { dir: 'auto', class: 'prewrap' }, v.looking || notYet())),
    sec('Contact', 'mp-contact', 'profile.contact', 'me-basic',
      h('dl', { class: 'facts mp-contact' },
        fact('Phone', c.phone, 'profile.fact-phone'),
        fact('Email', c.email, 'profile.fact-email'),
        fact(l.inquiries, c.inquiriesName || c.inquiriesPhone ? [c.inquiriesName, c.inquiriesName && c.inquiriesPhone ? ' · ' : '', c.inquiriesPhone].join('') : '', 'profile.fact-inquiries'))),
    sec('References', 'mp-refs', 'profile.references', 'me-refs',
      (v.references || []).length ? h('dl', { class: 'facts' }, v.references.map(r => fact(r.name, [r.relation, r.phone].filter(Boolean).join(' · '), 'profile.reference')))
        : h('p', {}, notYet('No references yet'))),
    ...v.sections.map(s => sec(s.title, 'mp-sec-' + s.id, 'profile.section', 'me-sections',
      h('p', { dir: 'auto', class: 'prewrap' }, s.text || notYet()),
      s.share === false ? h('p', { class: 'note' }, 'Kept out of the full profile when sharing.') : null)),
    sec('Files', 'mp-files', 'profile.files-sec', null,
      h('button', { type: 'button', class: 'pc-keep-row', 'data-id': 'profile.files', onClick: () => filesSheet() }, ico('folder'), h('span', { class: 'grow' }, 'Photos and résumé'), h('span', { class: 'priv' }, `${PD.filesSummary(P.files)}`), ico('chevron'))),
    h('div', { class: 'stamp pc-stamp' }, P.me?.updatedAt ? 'updated ' + store.formatDate(P.me.updatedAt) : 'not saved yet'),
  ];
}

const save = async (patch, msg = 'Saved') => { P.me = await PD.saveProfile(P.me, lang, patch); toast(msg); };
const field = (label, input) => h('div', { class: 'field' }, h('label', {}, label), input);
const inp = (value, dataId, extra = {}) => h('input', { class: 'input', dir: 'auto', value: value || '', 'data-id': dataId, ...extra });
const area = (value, dataId, rows = 6) => { const t = h('textarea', { class: 'input', dir: 'auto', rows, 'data-id': dataId }); t.value = value || ''; return t; };

async function filesSheet() {
  const list = h('div', { class: 'mp-files' });
  const picker = h('input', { type: 'file', multiple: true, class: 'hidden', accept: 'image/*,application/pdf', 'data-id': 'profile.files.input' });
  const drawFiles = () => {
    list.innerHTML = '';
    if (!P.files.length) list.append(h('p', { class: 'note' }, 'No files yet. Photos or a PDF résumé you may want to send.'));
    for (const f of P.files) list.append(h('div', { class: 'mp-file', 'data-id': 'profile.file' },
      h('a', { class: 'att-row', href: f.dataUrl, download: f.name }, ico('file'), h('span', { dir: 'auto' }, f.name), h('span', { class: 'priv' }, PD.fileKind(f))),
      h('button', { type: 'button', class: 'linkish danger-text', onClick: async () => {
        if (!(await confirmDialog({ title: 'Remove this file?', text: f.name, ok: 'Remove', danger: true, dataId: 'profile.file-remove-dialog' }))) return;
        await store.attachments.remove(f.id); P.files = P.files.filter(x => x.id !== f.id); drawFiles();
      } }, 'Remove')));
  };
  picker.addEventListener('change', async () => {
    for (const f of picker.files) {
      if (f.size > MAX_FILE) { toast(`${f.name} is larger than 5 MB`); continue; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      P.files.push(await store.attachments.save({ name: f.name, type: f.type, size: f.size, dataUrl, profileFile: true, personId: null, contactId: null }));
    }
    picker.value = ''; drawFiles();
  });
  drawFiles();
  await sheet({ title: 'Files', dataId: 'profile.files-sheet', body: [h('p', { class: 'note' }, 'Kept on this phone. Nothing is attached unless you tick it while sharing.'), list, picker,
    h('button', { type: 'button', class: 'btn', 'data-id': 'profile.files.add', onClick: () => picker.click() }, ico('upload'), 'Add files')] });
}

// ---------- Short versions ----------
// Language choice on each short version (owner request, Stage 8): the Suggested text follows the
// profileLang preference; a saved version keeps its own `lang`. Nothing is translated automatically.
function langPick(value, dataId, onChange) {
  return h('select', { class: 'input mp-lang-pick', 'aria-label': 'Language of this version', 'data-id': dataId, onChange: (e) => onChange(e.target.value) },
    PD.LANGS.map(([k, , code]) => h('option', { value: k, selected: k === value || null }, code)));
}
function shortTab(v) {
  const sLang = store.getPrefs().profileLang || lang;
  const sugg = PD.suggestedText(P.me, sLang);
  const cards = [card({ title: 'Suggested', sub: 'auto · always up to date', text: sugg, dataId: 'profile.short-suggested', lang: sLang,
    langPick: langPick(sLang, 'profile.short-suggested.lang', (k) => { store.setPref('profileLang', k); draw(true); toast(`Suggested shown in ${PD.langName(k)}`); }),
    menu: (a) => N.openMenu(a, 'profile.short-menu', (panel) => panel.append(
    N.menuItem('Save as a new version', 'keeps this text', async () => { N.closeMenu(); const t = await promptText({ title: 'Save as a new version', label: 'Name (e.g. who it is for)', ok: 'Save', dataId: 'profile.version-name' }); if (t) { await store.profileVersions.save({ title: t, lang: sLang, text: sugg, savedAt: store.now() }); toast('Saved'); } }, { dataId: 'profile.short-menu.save' }),
    N.menuItem('Share this text', '', () => { N.closeMenu(); share({ source: 'suggested' }); }, { dataId: 'profile.short-menu.share' }),
    N.menuItem('Choose what goes in it', '', () => { N.closeMenu(); shortSettings(); }, { dataId: 'profile.short-menu.settings' }))) })];
  for (const x of P.versions) cards.push(card({ title: x.title || 'Saved version', sub: `saved ${store.formatDate(x.savedAt || x.createdAt)}`, text: x.text, dataId: 'profile.short-version', edit: () => versionSheet(x), lang: x.lang || 'en',
    langPick: langPick(x.lang || 'en', 'profile.short-version.lang', async (k) => { await store.profileVersions.save({ ...x, lang: k }); toast(`Marked as ${PD.langName(k)}`); }),
    menu: (a) => N.openMenu(a, 'profile.version-menu', (panel) => panel.append(
      N.menuItem('Share this version', '', () => { N.closeMenu(); share({ source: x.id }); }, { dataId: 'profile.version-menu.share' }),
      N.menuItem('Duplicate', '', async () => { N.closeMenu(); await store.profileVersions.save({ title: (x.title || 'Version') + ' copy', lang: x.lang, text: x.text, savedAt: store.now() }); toast('Duplicated'); }, { dataId: 'profile.version-menu.duplicate' }),
      N.menuItem('Delete', '', async () => {
        N.closeMenu(); await store.profileVersions.remove(x.id); lastDeleted = x;
        toast(`“${x.title}” deleted`, 5000, { label: 'Undo', run: undoDelete });
      }, { cls: 'danger-text', dataId: 'profile.version-menu.delete' }))) }));
  return [
    h('div', { class: 'pc-sec-head mp-short-head' }, h('h2', { class: 'eyebrow' }, 'Short versions'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Choose what goes in Suggested', title: 'Choose what goes in Suggested', 'data-id': 'profile.short-settings', html: icon('settings'), onClick: () => shortSettings() })),
    h('div', { class: 'mp-cards' }, cards),
    lastDeleted ? h('div', { class: 'mp-undo', 'data-id': 'profile.short-undo' }, h('span', { class: 'stamp' }, `“${lastDeleted.title}” deleted`), h('button', { type: 'button', class: 'linkish', onClick: undoDelete }, 'Undo')) : null,
    h('button', { type: 'button', class: 'btn', 'data-id': 'profile.short-new', onClick: async () => {
      const t = await promptText({ title: 'New short version', label: 'Name (e.g. who it is for)', ok: 'Create', dataId: 'profile.version-name' });
      if (!t) return;
      const x = await store.profileVersions.save({ title: t, lang: sLang, text: sugg, savedAt: store.now() });
      versionSheet(x);
    } }, 'New short version'),
    h('p', { class: 'stamp mp-foot' }, 'these are the texts people receive · copy any box'),
  ];
}
async function undoDelete() { if (!lastDeleted) return; const x = lastDeleted; lastDeleted = null; await store.profileVersions.save(x); toast('Restored'); }
function card({ title, sub, text, dataId, edit, menu, lang: cardLang = 'en', langPick: pick = null }) {
  return h('article', { class: 'mp-card', 'data-id': dataId, dir: PD.isRtl(cardLang) ? 'rtl' : null },
    h('div', { class: 'mp-card-head' },
      h('div', { class: 'mp-card-title' }, h('strong', { dir: 'auto' }, title), h('span', { class: 'stamp' }, sub)),
      h('button', { type: 'button', class: 'btn small', 'data-id': dataId + '.copy', onClick: async () => { if (await copy(text)) toast('Copied. Copying is not sending — use Share to log a send.'); } }, 'Copy'),
      edit ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit ' + title, 'data-id': dataId + '.edit', html: icon('edit'), onClick: edit }) : null,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'More for ' + title, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-id': dataId + '.more', html: icon('more'), onClick: (e) => menu(e.currentTarget) })),
    h('pre', { class: 'mp-text', dir: 'auto' }, text || '(empty)'));
}
async function versionSheet(x) {
  const title = inp(x.title, 'profile.version-sheet.title'), text = area(x.text, 'profile.version-sheet.text', 12);
  text.classList.add('mono');
  await sheet({ title: 'Edit short version', dataId: 'profile.version-sheet', className: 'tall', body: [field('Name', title), field('Text people receive', text),
    h('p', { class: 'note' }, 'Saved versions stay as you wrote them — they do not change when your profile changes. Anything you already sent stays in Sharing activity exactly as sent.')],
    actions: [{ id: 'save', label: 'Save', primary: true, run: async () => { await store.profileVersions.save({ ...x, title: title.value.trim() || x.title, text: text.value, savedAt: store.now() }); toast('Saved'); } }] });
}
async function shortSettings() {
  const v = PD.view(P.me, lang);
  let ids = v.shortFacts && v.shortFacts.length ? [...v.shortFacts] : v.facts.slice(0, 5).map(f => f.id);
  const list = h('div', {}, v.facts.length ? v.facts.map(f => h('label', { class: 'share-tick' }, h('input', { type: 'checkbox', checked: ids.includes(f.id) || null, onChange: (e) => { ids = e.target.checked ? [...ids, f.id] : ids.filter(i => i !== f.id); } }), h('span', { dir: 'auto' }, `${f.label} · ${f.value}`))) : h('p', { class: 'note' }, 'Add facts on the Profile tab first.'));
  await sheet({ title: 'What goes in Suggested', dataId: 'profile.short-settings-sheet', body: [h('p', { class: 'note' }, 'Name, age · city · work, your intro, the first sentence of what you are looking for and the inquiries contact are always in it. Tick the facts to add.'), list],
    actions: [{ id: 'save', label: 'Save', primary: true, run: () => save({ shortFacts: v.facts.filter(f => ids.includes(f.id)).map(f => f.id) }) }] });
}

// ---------- Notes (only me) ----------
let notesListEl = null, sharingEl = null;
function notesTab(myNotes) {
  notesListEl = h('div', { class: 'mp-notes', 'data-id': 'profile.notes-list' });
  refreshNotesList(myNotes);
  const ta = h('textarea', { class: 'input mp-composer', rows: 2, dir: 'auto', placeholder: 'Write a note…', 'aria-label': 'Write a private note', 'data-id': 'profile.note-composer' });
  ta.value = W.text;
  const status = h('span', { class: 'stamp', 'data-id': 'profile.note-status' }, 'saves as you type · linked to you · add people after');
  ta.addEventListener('input', () => {
    W.text = ta.value; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px';
    clearTimeout(W.saveTimer); W.saveTimer = setTimeout(() => flushNote(status), 600);
  });
  ta.addEventListener('blur', async () => { await flushNote(status); if (W.noteId) { W.noteId = null; W.entryId = null; W.text = ''; ta.value = ''; ta.style.height = ''; status.textContent = 'saved · write another'; refreshNotesList(); } });
  sharingEl = h('section', { class: 'pc-sec', 'data-id': 'profile.sharing' });
  drawSharing();
  return [
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow' }, 'Notes'), h('span', { class: 'priv' }, 'only me')),
    notesListEl,
    h('div', { class: 'mp-compose' }, ta, status),
    sharingEl,
    h('p', { class: 'stamp mp-foot' }, 'nothing on this screen is ever shared'),
  ];
}
async function flushNote(status) {
  clearTimeout(W.saveTimer);
  const text = W.text.trim();
  if (!text) return;
  W.busy = true;
  try {
    if (!W.noteId) { const r = await N.createNote({ text, me: true }); W.noteId = r.note.id; W.entryId = r.entry.id; }
    else {
      const e = await store.events.get(W.entryId), n = await store.notes.get(W.noteId);
      if (e && e.text !== text) await store.events.save({ ...e, text });
      if (n) await store.notes.save({ ...n, title: (text.split('\n')[0] || '').slice(0, 60) || n.title });
    }
    if (status && root) status.textContent = 'saved ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' · linked to you · add people after';
  } finally { setTimeout(() => { W.busy = false; }, 150); }
}
async function refreshNotesList(list) {
  if (!notesListEl) return;
  if (!list) { ND = await N.loadNotes(); list = ND.notes.filter(n => n.me); }
  notesListEl.innerHTML = '';
  const shown = list.filter(n => n.id !== W.noteId);
  if (!shown.length) notesListEl.append(h('p', { class: 'note' }, 'No private notes yet. They stay on this phone and are never part of what you share.'));
  for (const n of shown) {
    const es = ND.entries.get(n.id) || [];
    const links = N.linksOf(n, ND);
    notesListEl.append(h('div', { class: 'mp-note', 'data-id': 'profile.note' },
      h('span', { class: 'mp-note-ico', html: icon('file') }),
      h('div', { class: 'mp-note-main' },
        h('p', { dir: 'auto', class: 'prewrap' }, es[0]?.text || n.title),
        es.length > 1 ? h('p', { class: 'note' }, `${es.length - 1} later update${es.length > 2 ? 's' : ''} — see it on Home`) : null,
        h('div', { class: 'mp-note-links' }, h('span', { 'aria-hidden': 'true' }, '↳ '),
          links.map((l, i) => [i ? ' · ' : '', h('a', { href: l.href, dir: 'auto' }, l.label)]),
          ' · ', h('a', { href: `#/home/note/${encodeURIComponent(n.id)}`, 'data-id': 'profile.note-home' }, 'Home'),
          ' · ', h('button', { type: 'button', class: 'linkish inline danger-text', 'data-id': 'profile.note-delete', onClick: async () => {
            if (!(await confirmDialog({ title: 'Delete this note?', text: 'It also disappears from Home and from anyone it is linked to.', ok: 'Delete note', danger: true, dataId: 'profile.note-delete-dialog' }))) return;
            await N.deleteNote(n); toast('Note deleted'); refreshNotesList();
          } }, 'delete'),
          ' · ', h('button', { type: 'button', class: 'linkish inline', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-id': 'profile.note-add-people', onClick: (e) => {
            const sel = { contactIds: [...(n.contactIds || [])], personIds: [...(n.personIds || [])] };
            N.linkMenu(e.currentTarget, 'profile.note-link-menu', ND, sel, async (s) => { await N.setLinks(n, s.contactIds, s.personIds); n.contactIds = s.contactIds; n.personIds = s.personIds; });
          } }, 'add people')))));
  }
}
function drawSharing() {
  const S = P.shares, last = S[0];
  sharingEl.innerHTML = '';
  sharingEl.append(h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow' }, 'Sharing activity')));
  if (!last) { sharingEl.append(h('p', { class: 'note' }, 'Nothing recorded yet. A share is saved here only after you confirm you sent it.')); return; }
  const det = h('details', { class: 'mp-share-log', 'data-id': 'profile.sharing-log' },
    h('summary', {}, h('span', { class: 'grow', dir: 'auto' }, `Last shared ${store.formatDate(last.at)}${last.recipientName ? ' with ' + last.recipientName : ''}`),
      h('span', { class: 'priv' }, `${S.length} share${S.length === 1 ? '' : 's'} · only me`), ico('chevron')),
    h('ul', { class: 'mp-share-list' }, S.map(s => h('li', {},
      h('button', { type: 'button', class: 'mp-share-row', 'data-id': 'profile.sharing-row', onClick: () => sheet({ title: 'Sent ' + store.formatDate(s.at), dataId: 'profile.share-snapshot', body: [
        h('p', { class: 'note' }, `${s.what}${s.recipientName ? ' · to ' + s.recipientName : ''} · ${s.channel || ''} · you confirmed you sent it. Delivery and reading are not known.`),
        h('pre', { class: 'mp-text', dir: 'auto' }, s.text), s.files?.length ? h('p', { class: 'note' }, 'Files: ' + s.files.join(', ')) : null] }) },
        h('span', { class: 'stamp' }, store.formatDate(s.at)), h('span', { class: 'grow', dir: 'auto' }, `${s.recipientName || 'No recipient chosen'} · ${s.what}`), ico('chevron'))))));
  sharingEl.append(det);
}
