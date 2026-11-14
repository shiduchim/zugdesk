// Settings — appearance, Show labels, Contacts view, demo data, backup/restore, reset.
import * as store from '../js/store.js';
import { h, icon, section, toast, confirmDialog } from '../js/ui.js';
import { LAYOUTS, SORTS, load as loadData } from './contacts-data.js';
import { viewSheet } from './contacts-panels.js';
import { MODE, isShadchan, switchMode } from '../js/mode.js';
import { exportSheet, importBackup } from './backup-sheet.js';
import { CLAUDE_INSTRUCTIONS, FORMAT_VERSION, copyInstructions } from './claude-import.js';

let unsub = null;

let gen = 0; // bumps on every render/destroy so stale async work never paints another page

export async function render(root) {
  unsub && unsub(); unsub = null; // never stack listeners when Settings redraws itself
  const token = ++gen;
  const live = () => token === gen;
  const prefs = store.getPrefs();
  const c = await store.counts();
  // The demo is counted by what each mode is about: contacts in Single Mode, singles in Shadchan Mode.
  const all = isShadchan ? await store.people.list() : await store.contacts.list();
  const [kept, deleted] = await Promise.all([store.storageState(), store.listDeleted()]);
  if (!live()) return;
  const demoCount = all.filter(x => x.demo).length;
  const ownCount = all.length - demoCount;
  const demoFull = isShadchan ? store.SH_DEMO_SINGLES : store.FULL_DEMO_SEED;
  const lastBackup = store.lastBackupAt();
  root.classList.add('settings');

  const toggle = (id, label, hint, checked, onChange) => h('label', { class: 'toggle', 'data-id': id },
    h('span', { class: 'toggle-text' }, label, h('small', {}, hint)),
    h('input', { type: 'checkbox', role: 'switch', checked: checked || null, onChange: (e) => onChange(e.target.checked) }));

  const radio = (name, value, label, hint, current, onChange) => h('label', {},
    h('input', { type: 'radio', name, value, checked: current === value || null, onChange: () => onChange(value) }),
    h('span', {}, label, h('small', {}, hint)));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', 'data-id': 'settings.import-file', onChange: async (e) => { const f = e.target.files[0]; e.target.value = ''; await importBackup(f); } });

  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Settings')),

    section('Mode', 'settings.mode',
      h('div', { class: 'radio-list', 'data-id': 'settings.mode-choice' },
        radio('mode', 'single', 'Single', 'For one person looking: my shadchanim, ideas, shidduchim and my profile', MODE, switchMode),
        radio('mode', 'shadchan', 'Shadchan', 'For a shadchan: guys, girls, shidduchim and contacts', MODE, switchMode)),
      h('p', { class: 'note' }, 'Each mode keeps its own records, so nothing mixes. Switching back shows everything exactly as you left it.')),

    section('Appearance', 'settings.appearance',
      h('div', { class: 'radio-list', 'data-id': 'settings.theme-choice' },
        radio('theme', 'light', 'Light', 'Warm light colours', prefs.theme || 'dark', (v) => store.setPref('theme', v)),
        radio('theme', 'dark', 'Dark', 'Dark background, light text — easier at night', prefs.theme || 'dark', (v) => store.setPref('theme', v)),
        radio('theme', 'auto', 'Match my phone', 'Switches with your phone’s own light / dark setting', prefs.theme || 'dark', (v) => store.setPref('theme', v)))),

    section('Help Claude edit the app', 'settings.labels',
      toggle('settings.show-labels', 'Show labels', 'Overlays every element’s name. Tap a label to copy it, then paste it in your request (e.g. “contacts.add-btn bigger”).',
        prefs.showLabels, (v) => { store.setPref('showLabels', v); toast(v ? 'Labels on — tap one to copy its name' : 'Labels off'); })),

    section('Claude instructions', 'settings.claude-text',
      h('p', { class: 'note' }, 'Write your call notes to Claude; it answers with one block you copy and add on Home with “Paste from Claude”. One time only: in Claude make a Project called ZugDesk, then paste this text into the project’s instructions.'),
      h('p', { class: 'note' }, `Format ${FORMAT_VERSION}. When the app gets a new format, copy the text again and replace the old one in Claude.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', 'data-id': 'settings.claude-copy', onClick: copyInstructions }, 'Copy the instructions')),
      h('details', { class: 'claude-text', 'data-id': 'settings.claude-show' },
        h('summary', {}, 'Show the text'),
        h('pre', { class: 'claude-pre', dir: 'auto' }, CLAUDE_INSTRUCTIONS)),
      h('p', { class: 'note' }, 'Privacy: in Claude, open Settings → Privacy and turn off “Help improve Claude”.')),

    section('Contacts view', 'settings.contacts-layout',
      h('p', { class: 'note' }, `Phone view now: ${(LAYOUTS.find(l => l[0] === prefs.contactsLayout) || LAYOUTS[0])[1]}. Also changeable from the View button on Contacts. On a computer, Contacts always uses the three-area view.`),
      h('button', { class: 'btn', 'data-id': 'settings.contacts-layout-btn', onClick: async () => { await loadData(); await viewSheet(); if (live()) { root.innerHTML = ''; render(root); } } }, h('span', { html: icon('layout') }).firstChild, 'Choose Contacts view'),
      h('label', { class: 'field', 'data-id': 'settings.contacts-sort' }, h('span', { class: 'note' }, 'Default sort for Contacts'),
        h('select', { class: 'input', onChange: (e) => { store.setPref('contactsSort', e.target.value); toast('Sort saved'); } },
          SORTS.map(([v, l]) => h('option', { value: v, selected: prefs.contactsSort === v || null }, l))))),

    section('Demo data', 'settings.demo',
      h('p', { class: 'note', 'data-id': 'settings.demo-count' }, isShadchan
        ? (demoCount ? `${demoCount} fictional demo singles and ${ownCount} of your own on this device. Demo records are marked and can be removed without touching yours.`
          : 'Want to try the app first? Load 60 fictional singles (30 guys, 30 girls) with a few made-up contacts and notes. Remove them any time; your own records stay.')
        : (demoCount ? `${demoCount} fictional demo contacts and ${ownCount} of your own on this phone. Demo records are marked and can be removed without touching yours.`
          : 'Want to try the app first? Load 200 fictional shadchanim with made-up ideas, shidduchim and notes. Remove them any time; your own records stay.')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', 'data-id': 'settings.load-demo-btn', disabled: demoCount >= demoFull || null, onClick: async () => {
          const added = await store.loadFullDemo();
          toast(added ? `Demo loaded: ${added} ${isShadchan ? 'singles' : 'contacts'}` : 'The demo is already loaded');
        } }, `Try the demo (${demoFull} ${isShadchan ? 'singles' : 'contacts'})`),
        demoCount ? h('button', { class: 'btn danger', 'data-id': 'settings.remove-demo-btn', onClick: async () => {
          if (await confirmDialog({ title: 'Remove all demo data?', text: `Removes ${demoCount} fictional demo ${isShadchan ? 'singles' : 'contacts'} and the other demo records. Everything you typed yourself stays.`, ok: 'Remove demo data', danger: true, dataId: 'settings.remove-demo-dialog' })) {
            const n = await store.removeDemoData(); toast(`Removed ${n} demo records`);
          }
        } }, h('span', { html: icon('trash') }).firstChild, 'Remove all demo data') : null)),

    isShadchan ? section('Home', 'settings.home',
      h('p', { class: 'note' }, 'Choose which blocks show on Home and in what order.'),
      h('button', { class: 'btn', type: 'button', 'data-id': 'settings.edit-home-btn', onClick: () => import('./sh-home.js').then(m => m.editHome()) }, 'Edit Home')) : null,

    isShadchan ? section('Recently deleted', 'settings.deleted',
      h('p', { class: 'note', 'data-id': 'settings.deleted-count' }, deleted.length
        ? `${deleted.length} deleted ${deleted.length === 1 ? 'thing is' : 'things are'} waiting. Each one can be put back for ${store.KEEP_DELETED_DAYS} days.`
        : `Nothing is waiting. Anything you delete in Shadchan Mode can be put back for ${store.KEEP_DELETED_DAYS} days.`),
      h('a', { class: 'btn', href: '#/deleted', 'data-id': 'settings.deleted-btn' }, h('span', { html: icon('trash') }).firstChild, 'Open Recently deleted')) : null,

    section('Backup', 'settings.backup',
      h('p', { class: 'note' }, 'Everything lives only on this device. Export saves one file, with both modes in it, that you can keep or move to another phone or computer. It is locked with a password you choose; a forgotten password cannot be recovered. Import brings it back.'),
      h('p', { class: 'note', 'data-id': 'settings.in-step' }, 'Phone and computer: on the device you used last, Export backup. Move the file to the other device (email it to yourself, WhatsApp it to yourself, or a USB stick). There, Import backup and choose Merge. Whatever was changed last wins, so nothing newer is lost.'),
      h('p', { class: 'note', 'data-id': 'settings.last-backup' }, lastBackup ? `Last backup made on this device: ${store.formatDate(lastBackup)}.` : 'No backup has been made on this device yet.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', 'data-id': 'settings.export-btn', onClick: async () => {
          if (await exportSheet() === 'made' && live()) { root.innerHTML = ''; render(root); }
        } }, h('span', { html: icon('download') }).firstChild, 'Export backup'),
        h('button', { class: 'btn', 'data-id': 'settings.import-btn', onClick: () => fileInput.click() }, h('span', { html: icon('upload') }).firstChild, 'Import backup'),
        fileInput),
      // Some phones clear a site's storage when space runs low, unless the browser agreed to keep it.
      kept === 'unsupported' ? null : h('p', { class: 'note', 'data-id': 'settings.storage-kept' }, kept === 'kept'
        ? 'This browser has agreed to keep the app’s storage permanently.'
        : 'This browser has not yet agreed to keep the app’s storage permanently; it could clear it if the phone runs low on space. Installing the app on the home screen usually settles it. A backup file is the real safety net.'),
      kept === 'not-kept' ? h('button', { class: 'btn', 'data-id': 'settings.keep-storage-btn', onClick: async () => {
        const ok = await store.askToKeepStorage();
        toast(ok ? 'Done — storage is kept permanently' : 'The browser did not agree yet. Install the app on the home screen, then try again.', 5000);
        if (live()) { root.innerHTML = ''; render(root); }
      } }, 'Ask the browser to keep it') : null),

    section('Reset', 'settings.reset',
      h('p', { class: 'note' }, 'Deletes everything on this phone, in both modes, and starts again empty. Export first if you want to keep anything.'),
      h('button', { class: 'btn danger', 'data-id': 'settings.reset-btn', onClick: async () => {
        if (await confirmDialog({ title: 'Reset everything?', text: 'All contacts, people, notes and settings on this phone will be deleted, in Single Mode and in Shadchan Mode. This cannot be undone.', ok: 'Reset everything', danger: true, dataId: 'settings.reset-dialog' })) {
          await store.resetAll({ reseed: true }); toast('Reset done — the app is empty'); location.hash = '#/home';
          if (isShadchan) location.reload(); // start clean in the same mode
        }
      } }, 'Reset everything')),

    section('Install on phone', 'settings.install',
      h('p', { class: 'note' }, 'iPhone: open this link in Safari → Share → “Add to Home Screen”. Android: Chrome menu → “Install app” or “Add to Home screen”. It then opens full-screen and works offline.')),

    section('About', 'settings.about',
      h('dl', { class: 'facts about' },
        fact('App', `ZugDesk v${store.APP_VERSION} · Stage ${store.STAGE}`),
        fact('Mode', isShadchan ? 'Shadchan' : 'Single'),
        fact('Data schema', `v${store.SCHEMA_VERSION}`),
        fact('Records', Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'),
        fact('Storage', typeof indexedDB !== 'undefined' ? 'IndexedDB on this device' : 'unavailable'),
        fact('Offline', 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'ready' : 'installing…') : 'not supported'))),
  );

  unsub = store.subscribe((ch) => {
    if (ch.store === 'prefs' || !live()) return;
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(() => { if (live()) { root.innerHTML = ''; render(root); } }, 60);
  });
}
let redrawTimer = 0;
export function destroy() { unsub && unsub(); unsub = null; gen++; clearTimeout(redrawTimer); }

function fact(k, v) { return h('div', { class: 'fact' }, h('dt', {}, k), h('dd', {}, v)); }
