// My Profile — Profile · Short versions · Notes (spec/my-profile.md; source My Profile.html and
// my profile short tab.html, Claude look). One owner record; the tabs are views of it.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, confirmDialog, promptText, bubbles, telLink, mailLink, dock, swipeTabs } from '../js/ui.js';
import { listType, GIRLS_ONLY } from './people-data.js';
import { navigate } from '../js/router.js';
import * as PD from './profile-data.js';
import * as N from './notes-data.js';
import { openShare, copy } from './profile-share.js';

// No Notes tab here any more (owner request, tweak mode): your own notes live on Home.
const TABS = [['profile', 'Profile'], ['short', 'Short versions']];
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const MAX_FILE = 5 * 1024 * 1024;

let root = null, unsub = null, timer = 0, gen = 0, tab = 'profile';
let P = null, ND = null, lang = 'en';
let lastDeleted = null;               // { version } for the inline Undo line
let shareOpen = false;

export function destroy() { if (root) swipeTabs(root, null); EDIT = false; SEC = null; OPEN = null; root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); N.closeMenu(); }

export async function render(container, params) {
  root = container;
  root.classList.add('profile-page', 'wide');
  swipeTabs(root, { keys: () => (EDIT || SEC ? [] : TABS.map(t => t[0])), current: () => tab, go: (k) => setTab(k) });
  tab = TABS.some(t => t[0] === params.tab) ? params.tab : 'profile';
  unsub = store.subscribe((ch) => {
    if (ch.store === 'prefs' || ch.store === 'meta') return;
    if (EDIT || SEC) return; // editing in place: do not redraw under the typing finger
    clearTimeout(timer); timer = setTimeout(() => draw(true), 100);
  });
  await draw();
}

async function draw(keep = false) {
  const token = ++gen;
  const [p, nd, ch] = await Promise.all([PD.loadProfile(), N.loadNotes(), store.getChoices()]);
  CH = ch;
  if (token !== gen || !root) return;
  P = p; ND = nd;
  lang = P.me?.lang || 'en'; // the profile is written in one language; each short version chooses its own
  const y = window.scrollY;
  root.innerHTML = '';
  const v = PD.view(P.me, lang);
  root.append(h('div', { class: 'mp-layout' },
    sideNav(v),
    h('div', { class: 'mp-main' },
      header(v),
      h('div', { class: 'pc-tabs mp-tabs', role: 'tablist', 'data-id': 'profile.tabs' },
        TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', 'data-id': 'profile.tab-' + k, onClick: () => setTab(k) }, l))),
      h('div', { class: 'mp-body', dir: PD.isRtl(lang) ? 'rtl' : null, 'data-id': 'profile.' + tab },
        tab === 'short' ? shortTab(v) : profileTab(v)),
      !EDIT && !SEC ? dock('profile.dock', h('span', { class: 'grow note' }, 'Send your profile to a shadchan'),
        h('button', { type: 'button', class: 'btn primary wide', 'data-id': 'profile.dock-share', onClick: () => share() }, 'Share profile')) : null)));
  if (keep) window.scrollTo(0, y);
}
function setTab(k) { navigate(k === 'profile' ? '/profile' : '/profile/' + k, { replace: true }); }

// ---------- header + desktop navigator ----------
function header(v) {
  return h('div', { class: 'mp-head', 'data-id': 'profile.header' },
    h('h1', { dir: 'auto' }, v.name || 'My Profile'),
    h('span', { class: 'spacer' }),
    h('a', { class: 'icon-btn bordered', href: '#/profile/edit', 'aria-label': 'Edit profile', title: 'Edit profile', 'data-id': 'profile.edit', html: icon('edit') }),
    h('button', { type: 'button', class: 'btn primary mp-share-top', 'data-id': 'profile.share', onClick: () => share() }, 'Share'));
}
async function share(opts) { if (shareOpen) return; shareOpen = true; try { await openShare(opts); } finally { shareOpen = false; } }

function sideNav(v) {
  const go = (id) => (e) => { e.preventDefault(); if (tab !== 'profile') { setTab('profile'); setTimeout(() => scrollToSec(id), 250); } else scrollToSec(id); };
  const link = (label, id) => h('a', { href: '#/profile', class: 'mp-nav-sub', onClick: go(id) }, label);
  return h('nav', { class: 'mp-nav', 'aria-label': 'My Profile sections', 'data-id': 'profile.side-nav' },
    h('div', { class: 'mp-nav-title' }, 'My Profile'),
    h('a', { href: '#/profile', class: 'mp-nav-item', 'aria-current': tab === 'profile' ? 'page' : null }, 'Profile'),
    link('Facts', 'mp-facts'), link('About me', 'mp-about'), link('What I’m looking for', 'mp-looking'), link('Contact', 'mp-contact'), link('References', 'mp-refs'), link('Files', 'mp-files'),
    h('a', { href: '#/profile/short', class: 'mp-nav-item', 'aria-current': tab === 'short' ? 'page' : null }, 'Short versions', h('span', { class: 'mp-count' }, String(P.versions.length + 1))),
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
// Every pencil edits its section right here (owner request, tweak mode). Facts save as you go
// (one Done); the other sections are a small form with Cancel / Save.
const pencil = (label, dataId, onClick) => h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, 'data-id': dataId, html: icon('edit'), onClick });
const openSec = (key) => { SEC = key; EDIT = false; OPEN = null; draw(true); };
function sec(title, id, dataId, key, ...kids) {
  const facts = key === 'facts', editing = facts ? EDIT : key && SEC === key;
  return h('section', { class: 'pc-sec' + (editing ? ' mp-editing' : ''), id, 'data-id': dataId },
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow', dir: 'auto' }, title),
      facts && EDIT ? h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': dataId + '-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing facts'),
        h('button', { type: 'button', class: 'btn small', 'data-id': dataId + '-cancel', onClick: () => cancelFacts() }, 'Cancel'),
        h('button', { type: 'button', class: 'btn small primary', 'data-id': dataId + '-done', onClick: () => { document.activeElement?.blur(); EDIT = false; OPEN = null; SNAP = null; setTimeout(() => draw(true), 120); } }, 'Save'))
      : facts ? pencil('Edit facts here', dataId + '-edit', () => { EDIT = true; SEC = null; OPEN = null; SNAP = structuredClone(P.me || null); draw(true); })
      : key && !editing ? pencil('Edit ' + title.toLowerCase() + ' here', dataId + '-edit', () => openSec(key)) : null),
    ...(editing && !facts ? [secForm(key, dataId)] : kids));
}
const fact = (k, v, dataId, extra = null) => !v ? null : h('div', { class: 'fact', 'data-id': dataId }, h('dt', { dir: 'auto' }, k), h('dd', { dir: 'auto' }, v), extra); // empty = left out
function profileTab(v) {
  const l = PD.L(lang);
  const c = v.contact;
  const iAm = store.getPrefs().iAm;
  return [
    !P.me ? h('div', { class: 'callout', 'data-id': 'profile.start' }, 'This is your own profile — the one you send to shadchanim. Tap the pencil at the top to fill it in. Everything stays on this phone until you choose to share it.') : null,
    SEC === 'summary' ? h('div', { class: 'pc-summary mp-editing', 'data-id': 'profile.summary' }, secForm('summary', 'profile.summary')) :
    h('div', { class: 'pc-summary', 'data-id': 'profile.summary' },
      h('div', { class: 'avatar lg' }, P.me?.name ? store.initials({ name: P.me.name }) : 'ME'),
      h('div', { class: 'pc-summary-text' },
        h('div', { class: 'pc-summary-line', dir: 'auto' }, PD.summaryLine(v) || notYet('Age · city · work')),
        (c.phone || c.email) ? h('div', { class: 'reach', 'data-id': 'profile.reach' }, c.phone ? telLink(c.phone, 'profile.phone') : null, c.email ? mailLink(c.email, 'profile.email') : null) : null,
        h('div', { class: 'muted', dir: 'auto' }, v.intro || 'A one-line introduction')),
      pencil('Edit summary here', 'profile.summary-edit', () => openSec('summary'))),
    sec(l.facts, 'mp-facts', 'profile.facts', 'facts',
      h('dl', { class: 'facts' },
        ...tapFact('i-am', 'I am a', iAm === 'guy' ? 'Guy' : iAm === 'girl' ? 'Girl' : '', 'profile.fact-i-am'),
        ...tapFact('age', 'Age', v.age, 'profile.fact-age'), ...tapFact('city', 'City', v.city, 'profile.fact-city'), ...tapFact('work', 'Work / learning', v.occupation, 'profile.fact-work'),
        // one list in order: "name: value" rows and one-line facts (no value) together, newest last
        // "name: value" facts first, then the one-line facts together under "Other facts" (text in the second column)
        ...v.facts.filter(f => f.value).flatMap(f => isCustom(f.id) ? customFact(f) : tapFact(f.id, f.label, f.value, 'profile.fact')),
        ...v.facts.filter(f => !f.value && f.label).flatMap((f, i) => isCustom(f.id) ? customFact(f, i === 0 ? 'Other facts' : '')
          : [h('div', { class: 'fact', 'data-id': 'profile.fact-line' }, h('dt', {}, i === 0 ? 'Other facts' : ''), h('dd', { dir: 'auto' }, f.label))]),
        addFactRow())),
    sec(l.about, 'mp-about', 'profile.about', 'about', h('p', { dir: 'auto', class: 'prewrap' }, v.about || notYet())),
    sec(l.looking, 'mp-looking', 'profile.looking', 'looking', h('p', { dir: 'auto', class: 'prewrap' }, v.looking || notYet())),
    sec('Inquiries and references', 'mp-refs', 'profile.refs', 'refs',
      h('div', { class: 'mp-sub' }, 'Inquiries'),
      h('dl', { class: 'facts' }, fact('Call', c.inquiriesName || c.inquiriesPhone ? h('span', { class: 'reach' }, c.inquiriesName ? h('span', { dir: 'auto' }, c.inquiriesName) : null, c.inquiriesPhone ? telLink(c.inquiriesPhone) : null) : '', 'profile.fact-inquiries')),
      h('div', { class: 'mp-sub' }, 'References'),
      (v.references || []).length ? h('dl', { class: 'facts' }, v.references.map(r => fact(r.name, r.relation || r.phone ? h('span', { class: 'reach' }, r.relation ? h('span', { dir: 'auto' }, r.relation) : null, r.phone ? telLink(r.phone) : null) : '', 'profile.reference')))
        : h('p', {}, notYet('No references yet'))),
    ...v.sections.map(s => sec(s.title, 'mp-sec-' + s.id, 'profile.section', 'sec:' + s.id,
      h('p', { dir: 'auto', class: 'prewrap' }, s.text || notYet()),
      s.share === false ? h('p', { class: 'note' }, 'Kept out of the full profile when sharing.') : null)),
    sec('Photos and docs', 'mp-files', 'profile.files-sec', null, filesInline()),
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
    if (!P.files.length) list.append(h('p', { class: 'note' }, 'No files yet. Photos or documents you may want to send.'));
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
  const suggested = card({ title: 'Suggested', sub: 'auto · always up to date', experimental: true, text: sugg, dataId: 'profile.short-suggested', lang: sLang,
    langPick: langPick(sLang, 'profile.short-suggested.lang', (k) => { store.setPref('profileLang', k); draw(true); toast(`Suggested shown in ${PD.langName(k)}`); }),
    menu: (a) => N.openMenu(a, 'profile.short-menu', (panel) => panel.append(
    N.menuItem('Save as a new version', 'keeps this text', async () => { N.closeMenu(); const t = await promptText({ title: 'Save as a new version', label: 'Name (e.g. who it is for)', ok: 'Save', dataId: 'profile.version-name' }); if (t) { await store.profileVersions.save({ title: t, lang: sLang, text: sugg, savedAt: store.now() }); toast('Saved'); } }, { dataId: 'profile.short-menu.save' }),
    N.menuItem('Share this text', '', () => { N.closeMenu(); share({ source: 'suggested' }); }, { dataId: 'profile.short-menu.share' }),
    N.menuItem('Choose what goes in it', '', () => { N.closeMenu(); shortSettings(); }, { dataId: 'profile.short-menu.settings' }))) });
  const cards = [];
  for (const x of P.versions) cards.push(card({ title: x.title || 'Saved version', sub: `saved ${store.formatDate(x.savedAt || x.createdAt)}`, text: x.text, dataId: 'profile.short-version', edit: () => versionSheet(x), lang: x.lang || 'en',
    langPick: langPick(x.lang || 'en', 'profile.short-version.lang', async (k) => { await store.profileVersions.save({ ...x, lang: k }); toast(`Marked as ${PD.langName(k)}`); }),
    menu: (a) => N.openMenu(a, 'profile.version-menu', (panel) => panel.append(
      N.menuItem('Share this version', '', () => { N.closeMenu(); share({ source: x.id }); }, { dataId: 'profile.version-menu.share' }),
      N.menuItem('Duplicate', '', async () => { N.closeMenu(); await store.profileVersions.save({ title: (x.title || 'Version') + ' copy', lang: x.lang, text: x.text, savedAt: store.now() }); toast('Duplicated'); }, { dataId: 'profile.version-menu.duplicate' }),
      N.menuItem('Delete', '', async () => {
        N.closeMenu(); await store.profileVersions.remove(x.id); lastDeleted = x;
        toast(`“${x.title}” deleted`, 5000, { label: 'Undo', run: undoDelete });
      }, { cls: 'danger-text', dataId: 'profile.version-menu.delete' }))) }));
  cards.push(suggested); // Suggested sits last, outlined and marked Experimental (owner request)
  return [
    h('div', { class: 'pc-sec-head mp-short-head' }, h('h2', { class: 'eyebrow' }, 'Short versions'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Choose what goes in Suggested', title: 'Choose what goes in Suggested', 'data-id': 'profile.short-settings', html: icon('settings'), onClick: () => shortSettings() })),
    h('div', { class: 'mp-cards' }, cards),
    lastDeleted ? h('div', { class: 'mp-undo', 'data-id': 'profile.short-undo' }, h('span', { class: 'stamp' }, `“${lastDeleted.title}” deleted`), h('button', { type: 'button', class: 'linkish', onClick: undoDelete }, 'Undo')) : null,
    h('button', { type: 'button', class: 'btn', 'data-id': 'profile.short-new', onClick: async () => {
      const t = await promptText({ title: 'New short version', label: 'Name (e.g. who it is for)', ok: 'Create', dataId: 'profile.version-name' });
      if (!t) return;
      const x = await store.profileVersions.save({ title: t, lang: sLang, text: '', savedAt: store.now() });
      versionSheet(x);
    } }, 'New short version'),
    h('p', { class: 'stamp mp-foot' }, 'these are the texts people receive · copy any box'),
    (sharingEl = h('section', { class: 'pc-sec', 'data-id': 'profile.sharing' }), drawSharing(), sharingEl),
  ];
}
async function undoDelete() { if (!lastDeleted) return; const x = lastDeleted; lastDeleted = null; await store.profileVersions.save(x); toast('Restored'); }
function card({ title, sub, text, dataId, edit, menu, lang: cardLang = 'en', langPick: pick = null, experimental = false }) {
  return h('article', { class: 'mp-card' + (experimental ? ' mp-card-exp' : ''), 'data-id': dataId, dir: PD.isRtl(cardLang) ? 'rtl' : null },
    h('div', { class: 'mp-card-head' },
      h('div', { class: 'mp-card-title' }, h('strong', { dir: 'auto' }, title, experimental ? h('span', { class: 'mp-exp-tag', 'data-id': dataId + '.experimental' }, 'Experimental') : null), h('span', { class: 'stamp' }, sub)),
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

// ---------- Sharing activity (bottom of Short versions) ----------
let sharingEl = null;
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

// Photos and docs live right on the page: list, Add and Remove, no popup (owner request).
function filesInline() {
  const wrap = h('div', { class: 'mp-files', 'data-id': 'profile.files' });
  const picker = h('input', { type: 'file', multiple: true, class: 'hidden', accept: 'image/*,application/pdf', 'data-id': 'profile.files.input' });
  const draw = () => {
    wrap.innerHTML = '';
    const photos = P.files.filter(f => PD.fileKind(f) === 'photo'), docs = P.files.filter(f => PD.fileKind(f) !== 'photo');
    const del = async (f) => {
      if (!(await confirmDialog({ title: 'Remove this file?', text: f.name, ok: 'Remove', danger: true, dataId: 'profile.file-remove-dialog' }))) return;
      await store.attachments.remove(f.id); P.files = P.files.filter(x => x.id !== f.id); draw();
    };
    if (photos.length) wrap.append(h('div', { class: 'me-photos' }, photos.map(f => h('figure', { class: 'me-photo', 'data-id': 'profile.photo' },
      h('a', { href: f.dataUrl, download: f.name }, h('img', { src: f.dataUrl, alt: f.name })),
      h('button', { type: 'button', class: 'linkish danger-text', onClick: () => del(f) }, 'Remove')))));
    for (const f of docs) wrap.append(h('div', { class: 'me-doc', 'data-id': 'profile.file' }, ico('file'),
      h('a', { class: 'grow', dir: 'auto', href: f.dataUrl, download: f.name }, f.name), h('button', { type: 'button', class: 'linkish danger-text', onClick: () => del(f) }, 'Remove')));
    wrap.append(picker, h('button', { type: 'button', class: 'btn small me-add', 'data-id': 'profile.files.add', onClick: () => picker.click() }, ico('upload'), 'Add photos or docs'));
  };
  picker.addEventListener('change', async () => {
    for (const f of picker.files) {
      if (f.size > MAX_FILE) { toast(`${f.name} is larger than 5 MB`); continue; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
      P.files.push(await store.attachments.save({ name: f.name, type: f.type, size: f.size, dataUrl, profileFile: true, personId: null, contactId: null }));
    }
    picker.value = ''; draw();
  });
  draw();
  return wrap;
}

// ---------- Tap a fact to change it right here (owner request, tweak mode) ----------
// One row open at a time. One-choice lists save on tap; several-choice lists and text use Done.
let CH = {}, OPEN = null, EDIT = false, SEC = null; // SEC: section open as a small form // EDIT: Facts pencil opened every fact at once
const DKEY = { 'd:Languages': 'languages', 'd:Status': 'pStatus', 'd:Religious level': 'pLevel', 'd:Tzniut': 'pTzniut',
  'd:Religious background': 'pBackground', 'd:Religious': 'pReligious', 'd:Character & lifestyle': 'pTraits', 'd:Body type': 'pBody' };
function editorFor(id) {
  const me = P.me || {}, A = me.answers || {};
  const text = (get, set) => ({ type: 'text', get, set });
  const choice = (key) => ({ type: 'choice', key, get: () => key === 'languages' ? (me.languages || []) : [].concat(A[key] ?? []).filter(Boolean),
    set: (val) => key === 'languages' ? { languages: val } : { answers: { ...A, [key]: val } } });
  if (id === 'i-am') return { type: 'iam' };
  if (id === 'age') return text(() => me.age, (x) => ({ age: x }));
  if (id === 'city') return text(() => me.city, (x) => ({ city: x }));
  if (id === 'work') return text(() => me.occupation, (x) => ({ occupation: x }));
  if (id === 'd:Other religious details') return text(() => me.religiousOther, (x) => ({ religiousOther: x }));
  if (id === 'd:maxAge') return text(() => me.maxAge, (x) => ({ maxAge: x }));
  if (DKEY[id]) return choice(DKEY[id]);
  if (id.startsWith('d:')) return choice(id.slice(2));
  const f = (me.facts || []).find(x => x.id === id);
  if (f) return text(() => f.value, (x) => ({ facts: me.facts.map(y => y.id === id ? { ...y, value: x } : y) }));
  return null;
}
// Quick "Add a fact": one line (name + value) right in the Facts list, no full edit screen.
let ADDF = false, SNAP = null; // SNAP: profile as it was when Editing / Adding facts began (Cancel puts it back)
async function cancelFacts() {
  document.activeElement?.blur(); await new Promise(r => setTimeout(r, 120)); // let a half-typed field finish first
  EDIT = false; ADDF = false; OPEN = null;
  if (SNAP) { P.me = await store.profile.save(SNAP); toast('Changes undone'); }
  SNAP = null; draw(true);
}
function addFactRow() {
  if (!ADDF && !EDIT) return h('button', { type: 'button', class: 'linkish mp-more-link', 'data-id': 'profile.fact-add-open', onClick: () => { ADDF = true; SNAP = structuredClone(P.me || null); draw(true); setTimeout(() => document.querySelector('[data-id="profile.fact-add-label"]')?.focus(), 30); } }, 'Add a fact');
  const lab = h('input', { class: 'input', dir: 'auto', placeholder: 'Name, e.g. Shul', 'aria-label': 'Fact name', 'data-id': 'profile.fact-add-label' });
  const val = h('input', { class: 'input', dir: 'auto', placeholder: 'Fact', 'aria-label': 'Fact', 'data-id': 'profile.fact-add-value',
    onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
  async function add() {
    const label = lab.value.trim(), value = val.value.trim();
    if (!label && !value) { lab.focus(); return; }
    const f = { id: store.newId('fact'), label: label || value, value: label ? value : '' };
    P.me = await PD.saveProfile(P.me, lang, { facts: [...(P.me.facts || []), f] });
    toast('Fact added', 1200); draw(true);
    setTimeout(() => document.querySelector('[data-id="profile.fact-add-label"]')?.focus(), 30);
  }
  return h('div', { class: 'mp-add-fact', 'data-id': 'profile.fact-add' },
    h('div', { class: 'mp-add-fact-row' }, lab, val),
    h('div', { class: 'mp-add-fact-foot' },
      h('button', { type: 'button', class: 'btn small primary', 'data-id': 'profile.fact-add-save', onClick: add }, 'Add fact'),
      !EDIT ? h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': 'profile.fact-add-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Adding facts'),
        h('button', { type: 'button', class: 'btn small', 'data-id': 'profile.fact-add-cancel', onClick: () => cancelFacts() }, 'Cancel'),
        h('button', { type: 'button', class: 'btn small primary', 'data-id': 'profile.fact-add-close', onClick: () => { ADDF = false; SNAP = null; draw(true); } }, 'Save')) : null,
      h('a', { class: 'linkish mp-add-fact-full', href: editAt('personal'), 'data-id': 'profile.facts-full-edit' }, 'Full edit screen')));
}
// Facts the owner added (Add a fact): tap to change the name / text, or delete it.
const isCustom = (id) => (P.me?.facts || []).some(f => f.id === id);
function customFact(f, otherTitle = '') {
  const open = OPEN === f.id || EDIT;
  const show = f.value ? [h('dt', { dir: 'auto' }, f.label), h('dd', { dir: 'auto' }, f.value)] : [h('dt', {}, otherTitle), h('dd', { dir: 'auto' }, f.label)];
  const row = h('div', { class: 'fact mp-tap' + (open ? ' open' : ''), 'data-id': 'profile.fact-custom', role: 'button', tabindex: 0,
    'aria-expanded': String(open), onClick: EDIT ? null : () => { OPEN = OPEN === f.id ? null : f.id; draw(true); } }, ...show);
  if (!open) return [row];
  const lab = h('input', { class: 'input', dir: 'auto', value: f.value ? f.label : '', placeholder: 'Name (optional)', 'aria-label': 'Fact name', 'data-id': 'profile.fact-custom-label' });
  const val = h('input', { class: 'input', dir: 'auto', value: f.value ? f.value : f.label, placeholder: 'Fact', 'aria-label': 'Fact', 'data-id': 'profile.fact-custom-value' });
  const patchFor = () => {
    const l = lab.value.trim(), x = val.value.trim();
    if (!l && !x) return null;
    const nf = { ...f, label: l || x, value: l ? x : '' };
    return { facts: (P.me.facts || []).map(y => y.id === f.id ? nf : y) };
  };
  const saveNow = async (quiet) => { const pt = patchFor(); if (!pt) return; P.me = await PD.saveProfile(P.me, lang, pt); if (!quiet) toast('Saved'); };
  const del = async () => {
    if (!(await confirmDialog({ title: 'Delete this fact?', text: f.value ? `${f.label}: ${f.value}` : f.label, ok: 'Delete', danger: true, dataId: 'profile.fact-delete-dialog' }))) return;
    P.me = await PD.saveProfile(P.me, lang, { facts: (P.me.facts || []).filter(y => y.id !== f.id) });
    if (OPEN === f.id) OPEN = null; toast('Fact deleted'); draw(true);
  };
  const delBtn = h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'profile.fact-delete', onClick: del }, 'Delete');
  const box = h('div', { class: 'mp-inline mp-custom-edit', 'data-id': 'profile.fact-custom-editor' }, h('div', { class: 'mp-add-fact-row' }, lab, val));
  if (EDIT) { // editing all facts: saves as you leave a box; Cancel in the top bar undoes
    lab.addEventListener('change', () => saveNow(true)); val.addEventListener('change', () => saveNow(true));
    box.firstChild.classList.add('with-del'); box.firstChild.append(delBtn); return [h('div', { class: 'fact mp-edit-row fact-line', 'data-id': 'profile.fact-custom' }, h('dd', {}, box))];
  }
  // Tapped one fact: type right in its place (the text only), Delete beside it.
  const txt = h('input', { class: 'input', dir: 'auto', value: f.value || f.label, 'aria-label': 'Fact', 'data-id': 'profile.fact-custom-value' });
  const save = async () => {
    const x = txt.value.trim();
    if (x) { const nf = f.value ? { ...f, value: x } : { ...f, label: x }; P.me = await PD.saveProfile(P.me, lang, { facts: (P.me.facts || []).map(y => y.id === f.id ? nf : y) }); toast('Saved'); }
    OPEN = null; draw(true);
  };
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  setTimeout(() => { txt.focus(); txt.setSelectionRange(txt.value.length, txt.value.length); }, 30);
  return [h('div', { class: 'fact mp-edit-row', 'data-id': 'profile.fact-custom' },
    h('dt', { dir: 'auto' }, f.value ? f.label : otherTitle),
    h('dd', {}, h('div', { class: 'mp-fact-inplace' }, txt, delBtn)),
    h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': 'profile.inline-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'profile.inline-cancel', onClick: () => { OPEN = null; draw(true); } }, 'Cancel'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': 'profile.inline-done', onClick: save }, 'Save')))];
}
function tapFact(id, label, value, dataId) {
  if (!value) return [];
  const ed = editorFor(id), open = OPEN === id || (EDIT && !!ed);
  const row = h('div', { class: 'fact mp-tap' + (open ? ' open' : ''), 'data-id': dataId, role: ed ? 'button' : null, tabindex: ed ? 0 : null,
    'aria-expanded': ed ? String(open) : null, onClick: ed && !EDIT ? () => { OPEN = open ? null : id; draw(true); } : null },
    h('dt', { dir: 'auto' }, label), h('dd', { dir: 'auto' }, value));
  if (EDIT && ed) return [h('div', { class: 'fact mp-edit-row', 'data-id': dataId }, h('dt', { dir: 'auto' }, label), h('dd', {}, inlineEditor(id, ed)))];
  return open && ed ? [row, inlineEditor(id, ed)] : [row];
}
function inlineEditor(id, ed) {
  const done = async (patch) => {
    if (EDIT) { if (patch) { P.me = await PD.saveProfile(P.me, lang, patch); toast('Saved', 1200); } return; } // stay open, no redraw
    OPEN = null; if (patch) { P.me = await PD.saveProfile(P.me, lang, patch); toast('Saved'); } draw(true);
  };
  const box = h('div', { class: 'mp-inline', 'data-id': 'profile.inline-editor' });
  if (ed.type === 'iam') {
    box.append(bubbles({ options: [['guy', 'Guy'], ['girl', 'Girl']], selected: [store.getPrefs().iAm], multi: false, dataId: 'profile.inline-choice',
      onChange: (v) => { if (v) store.setPref('iAm', v); done(null); } }));
    return box;
  }
  if (ed.type === 'text') {
    const inp = h('input', { class: 'input', dir: 'auto', value: ed.get() || '', 'data-id': 'profile.inline-text' });
    const save = () => done(ed.set(inp.value.trim()));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    if (EDIT) { inp.addEventListener('change', save); box.append(inp); return box; } // saves when you leave the box
    setTimeout(() => inp.focus(), 30);
    box.append(inp, h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': 'profile.inline-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'profile.inline-cancel', onClick: () => done(null) }, 'Cancel'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': 'profile.inline-done', onClick: save }, 'Save')));
    return box;
  }
  const type = listType(ed.key), multi = type !== 'single';
  const girl = store.getPrefs().iAm === 'girl', only = GIRLS_ONLY[ed.key] || [];
  const opts = (CH[ed.key] || []).filter(o => !o.hidden && (girl || !only.includes(o.v))).map(o => [o.v, o.v]);
  let cur = ed.get();
  for (const v of cur) if (!opts.some(o => o[0] === v)) opts.push([v, v]); // keep answers no longer in the list
  box.append(bubbles({ options: opts, selected: cur, multi, dataId: 'profile.inline-choice',
    onChange: (v) => { if (multi) { cur = v; if (EDIT) done(ed.set(cur)); } else done(ed.set(v ? [v] : [])); } }));
  if (multi && !EDIT) box.append(h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': 'profile.inline-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing'),
    h('button', { type: 'button', class: 'btn small', 'data-id': 'profile.inline-cancel', onClick: () => done(null) }, 'Cancel'),
    h('button', { type: 'button', class: 'btn small primary', 'data-id': 'profile.inline-done', onClick: () => done(ed.set(cur)) }, 'Save')));
  return box;
}

// ---------- Section forms (pencil on summary, About, Looking for, References, own sections) ----------
function secForm(key, dataId) {
  const v = PD.view(P.me, lang), c = v.contact;
  const id = dataId + '-form';
  const row = (label, el) => h('label', { class: 'mp-frow' }, h('span', { class: 'mp-flabel' }, label), el);
  const tin = (val, name, extra = {}) => h('input', { class: 'input', dir: 'auto', value: val || '', 'data-id': id + '.' + name, ...extra });
  const tarea = (val, name, rows = 5) => { const t = h('textarea', { class: 'input mp-farea', dir: 'auto', rows, 'data-id': id + '.' + name }); t.value = val || ''; return t; };
  const t = (x) => (x || '').trim();
  let body = [], collect;
  if (key === 'summary') {
    const f = { name: tin(v.name, 'name'), age: tin(v.age, 'age', { inputmode: 'numeric' }), city: tin(v.city, 'city'), occupation: tin(v.occupation, 'work'),
      intro: tin(v.intro, 'intro'), phone: tin(c.phone, 'phone', { type: 'tel' }), email: tin(c.email, 'email', { type: 'email' }) };
    body = [row('Name', f.name), h('div', { class: 'mp-fgrid' }, row('Age', f.age), row('City', f.city)), row('Work / learning', f.occupation),
      row('One-line intro', f.intro), h('div', { class: 'mp-fgrid' }, row('My phone', f.phone), row('My email', f.email))];
    collect = () => ({ name: t(f.name.value), age: t(f.age.value), city: t(f.city.value), occupation: t(f.occupation.value), intro: t(f.intro.value),
      contact: { ...c, phone: store.cleanPhone(t(f.phone.value)), email: t(f.email.value) } });
  } else if (key === 'about' || key === 'looking') {
    const a = tarea(v[key], key, 6); body = [a]; collect = () => ({ [key]: a.value.trim() });
  } else if (key === 'refs') {
    const inqName = tin(c.inquiriesName, 'inquiries-name'), inqPhone = tin(c.inquiriesPhone, 'inquiries-phone', { type: 'tel' });
    const refs = (v.references || []).map(r => ({ ...r }));
    const list = h('div', { class: 'mp-frefs' });
    const paint = () => {
      list.innerHTML = '';
      refs.forEach((r, i) => {
        const nm = tin(r.name, 'ref-name', { placeholder: 'Name', 'aria-label': 'Reference name', onInput: (e) => { r.name = e.target.value; } });
        const rel = tin(r.relation, 'ref-relation', { placeholder: 'Relation', 'aria-label': 'Relation', onInput: (e) => { r.relation = e.target.value; } });
        const ph = tin(r.phone, 'ref-phone', { type: 'tel', placeholder: 'Phone', 'aria-label': 'Reference phone', onInput: (e) => { r.phone = e.target.value; } });
        list.append(h('div', { class: 'mp-fref', 'data-id': id + '.reference' }, nm, h('div', { class: 'mp-fgrid' }, rel, ph),
          h('button', { type: 'button', class: 'linkish danger-text', 'data-id': id + '.ref-remove', onClick: () => { refs.splice(i, 1); paint(); } }, 'Remove')));
      });
    };
    paint();
    body = [h('div', { class: 'mp-sub' }, 'Inquiries'), h('div', { class: 'mp-fgrid' }, row('Name', inqName), row('Phone', inqPhone)),
      h('div', { class: 'mp-sub' }, 'References'), list,
      h('button', { type: 'button', class: 'btn small', 'data-id': id + '.ref-add', onClick: () => { refs.push({ id: store.newId('ref'), name: '', relation: '', phone: '', privateNote: '' }); paint(); list.querySelector('.mp-fref:last-child input')?.focus(); } }, 'Add a reference')];
    collect = () => ({ contact: { ...c, inquiriesName: t(inqName.value), inquiriesPhone: store.cleanPhone(t(inqPhone.value)) },
      references: refs.filter(r => t(r.name)).map(r => ({ ...r, name: t(r.name), relation: t(r.relation), phone: store.cleanPhone(t(r.phone)) })) });
  } else if (key.startsWith('sec:')) {
    const sid = key.slice(4), s0 = v.sections.find(x => x.id === sid) || {};
    const title = tin(s0.title, 'section-title'), text = tarea(s0.text, 'section-text', 5);
    const shareBox = h('input', { type: 'checkbox', checked: s0.share !== false || null, 'data-id': id + '.section-share' });
    body = [row('Title', title), text, h('label', { class: 'share-tick' }, shareBox, h('span', {}, 'Include when sharing the full profile'))];
    collect = () => ({ sections: v.sections.map(x => x.id === sid ? { ...x, title: t(title.value) || x.title, text: text.value.trim(), share: shareBox.checked } : x) });
  }
  const close = () => { SEC = null; draw(true); };
  const form = h('div', { class: 'mp-form', 'data-id': id },
    h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': id + '.bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing'),
      h('button', { type: 'button', class: 'btn small', 'data-id': id + '.cancel', onClick: close }, 'Cancel'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': id + '.save', onClick: async () => { P.me = await PD.saveProfile(P.me, lang, collect()); toast('Saved'); close(); } }, 'Save')),
    ...body);
  setTimeout(() => form.querySelector('input,textarea')?.focus({ preventScroll: true }), 30);
  return form;
}
