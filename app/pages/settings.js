// Settings — Show labels, navigation arrangement, demo data, backup/restore, reset.
import * as store from '../js/store.js';
import { h, icon, section, toast, confirmDialog, comingLater } from '../js/ui.js';

let unsub = null;

export async function render(root) {
  const prefs = store.getPrefs();
  const c = await store.counts();
  const all = await store.contacts.list();
  const demoCount = all.filter(x => x.demo).length;
  const ownCount = all.length - demoCount;
  root.classList.add('settings');

  const toggle = (id, label, hint, checked, onChange) => h('label', { class: 'toggle', 'data-id': id },
    h('span', { class: 'toggle-text' }, label, h('small', {}, hint)),
    h('input', { type: 'checkbox', role: 'switch', checked: checked || null, onChange: (e) => onChange(e.target.checked) }));

  const radio = (name, value, label, hint, current, onChange) => h('label', {},
    h('input', { type: 'radio', name, value, checked: current === value || null, onChange: () => onChange(value) }),
    h('span', {}, label, h('small', {}, hint)));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', 'data-id': 'settings.import-file', onChange: (e) => importFile(e.target.files[0], root) });

  root.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Settings')),

    section('Help Claude edit the app', 'settings.labels',
      toggle('settings.show-labels', 'Show labels', 'Overlays every element’s name. Tap a label to copy it, then paste it in your request (e.g. “contacts.add-btn bigger”).',
        prefs.showLabels, (v) => { store.setPref('showLabels', v); toast(v ? 'Labels on — tap one to copy its name' : 'Labels off'); })),

    section('Navigation', 'settings.nav',
      h('p', { class: 'note' }, 'Still being compared. Changing this moves nothing in your data.'),
      h('div', { class: 'radio-list', 'data-id': 'settings.nav-choice' },
        radio('nav', 'three', 'Three destinations', 'Home · Contacts · Shidduchim (People & Ideas lives inside Shidduchim) · My Profile', prefs.navArrangement, (v) => store.setPref('navArrangement', v)),
        radio('nav', 'four', 'Four destinations', 'Home · Contacts · People & Ideas · Shidduchim · Profile', prefs.navArrangement, (v) => store.setPref('navArrangement', v)))),

    section('Contacts view', 'settings.contacts-layout',
      h('p', { class: 'note' }, 'Phone layouts (Layout A, list, inbox, side-rail…) and sorting defaults arrive in Stage 2.'),
      h('button', { class: 'btn', 'data-id': 'settings.contacts-layout-btn', onClick: () => comingLater('Contacts layout picker', 2) }, 'Choose layout — coming in Stage 2')),

    section('Demo data', 'settings.demo',
      h('p', { class: 'note', 'data-id': 'settings.demo-count' },
        `${demoCount} fictional demo contacts and ${ownCount} of your own on this phone. Demo records are marked and can be removed without touching yours.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', 'data-id': 'settings.load-demo-btn', disabled: demoCount >= store.FULL_DEMO_SEED || null, onClick: async () => {
          const added = await store.loadDemoContacts(store.FULL_DEMO_SEED);
          toast(added ? `Added ${added} demo contacts` : 'All 200 demo contacts are already loaded');
        } }, `Load ${store.FULL_DEMO_SEED} demo contacts`),
        h('button', { class: 'btn danger', 'data-id': 'settings.remove-demo-btn', disabled: demoCount === 0 || null, onClick: async () => {
          if (await confirmDialog({ title: 'Remove all demo data?', text: `Removes ${demoCount} fictional demo contacts (and any other demo records). Everything you typed yourself stays.`, ok: 'Remove demo data', danger: true, dataId: 'settings.remove-demo-dialog' })) {
            const n = await store.removeDemoData(); toast(`Removed ${n} demo records`);
          }
        } }, h('span', { html: icon('trash') }).firstChild, 'Remove all demo data'))),

    section('Backup', 'settings.backup',
      h('p', { class: 'note' }, 'Everything lives only on this phone. Export saves one file you can keep or move to a new phone. Import brings it back.'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', 'data-id': 'settings.export-btn', onClick: async () => {
          const data = await store.exportAll();
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
          store.downloadJSON(data, `zugdesk-backup-${stamp}.json`); toast('Backup file created');
        } }, h('span', { html: icon('download') }).firstChild, 'Export backup'),
        h('button', { class: 'btn', 'data-id': 'settings.import-btn', onClick: () => fileInput.click() }, h('span', { html: icon('upload') }).firstChild, 'Import backup'),
        fileInput)),

    section('Reset', 'settings.reset',
      h('p', { class: 'note' }, 'Deletes everything on this phone and starts again with the 20 starter demo contacts. Export first if you want to keep anything.'),
      h('button', { class: 'btn danger', 'data-id': 'settings.reset-btn', onClick: async () => {
        if (await confirmDialog({ title: 'Reset everything?', text: 'All contacts, people, notes and settings on this phone will be deleted. This cannot be undone.', ok: 'Reset everything', danger: true, dataId: 'settings.reset-dialog' })) {
          await store.resetAll({ reseed: true }); toast('Reset done — starter data loaded'); location.hash = '#/home';
        }
      } }, 'Reset everything')),

    section('Install on phone', 'settings.install',
      h('p', { class: 'note' }, 'iPhone: open this link in Safari → Share → “Add to Home Screen”. Android: Chrome menu → “Install app” or “Add to Home screen”. It then opens full-screen and works offline.')),

    section('About', 'settings.about',
      h('dl', { class: 'facts about' },
        fact('App', `ZugDesk v${store.APP_VERSION} · Stage 1`),
        fact('Data schema', `v${store.SCHEMA_VERSION}`),
        fact('Records', Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'),
        fact('Storage', typeof indexedDB !== 'undefined' ? 'IndexedDB on this device' : 'unavailable'),
        fact('Offline', 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'ready' : 'installing…') : 'not supported'))),
  );

  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs') { root.innerHTML = ''; root.classList.remove('settings'); render(root); } });
}
export function destroy() { unsub && unsub(); unsub = null; }

function fact(k, v) { return h('div', { class: 'fact' }, h('dt', {}, k), h('dd', {}, v)); }

async function importFile(file, root) {
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON'); return; }
  const err = store.validateBackup(json);
  if (err) { toast(err, 5000); return; }
  const rows = Object.values(json.data).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  const replace = await confirmDialog({
    title: 'Import this backup?',
    text: `${rows} records from ${new Date(json.exportedAt).toLocaleString()}. “Replace” deletes what is on this phone first; “Merge” keeps it and adds the backup on top.`,
    ok: 'Replace', cancel: 'Merge', dataId: 'settings.import-dialog',
  });
  // Cancel in this dialog means Merge; closing with Escape also lands on merge — ask once more for safety.
  if (!replace) {
    const merge = await confirmDialog({ title: 'Merge backup into current data?', text: 'Records with the same id are overwritten by the backup copy; everything else is kept.', ok: 'Merge', dataId: 'settings.merge-dialog' });
    if (!merge) { toast('Import cancelled'); return; }
  }
  try {
    const n = await store.importAll(json, replace ? 'replace' : 'merge');
    toast(`Imported ${n} records`);
  } catch (e) { console.error(e); toast('Import failed: ' + e.message, 5000); }
}
