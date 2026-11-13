// Backup sheets, shared by Settings and Shadchan Home's reminder:
// exportSheet() makes a backup (locked with a password by default),
// importBackup(file) reads one back (asks the password when it is locked).
import * as store from '../js/store.js';
import { canLock, makeBackup, isLocked, unlock, sizeText } from '../js/backup.js';
import { h, sheet, toast, confirmDialog } from '../js/ui.js';

const T = {
  title: 'Make a backup',
  lead: 'One file with everything on this device, both modes. Keep it somewhere safe (your email, a USB stick, a cloud folder) or move it to another device.',
  lockOn: 'Lock it with a password',
  lockHint: 'Anyone who finds the file sees nothing without the password.',
  pw: 'Password', pw2: 'Type it again',
  show: 'Show password',
  warn: 'Write the password down somewhere safe. If it is forgotten, the backup cannot be opened, not by you and not by us.',
  files: (n) => `Include attached files (${n} photo${n === 1 ? '' : 's'} or PDF${n === 1 ? '' : 's'})`,
  filesHint: 'Files make the backup much bigger. Without them the backup is small and quick; importing it never removes the files already on a device.',
  noFiles: 'No attached files on this device.',
  make: 'Make backup',
  short: 'Use at least 6 characters',
  differ: 'The two passwords are not the same',
  noLock: 'This browser cannot lock files. Open the app from its normal https link.',
  done: (s) => `Backup saved (${s}). Check your Downloads.`,
  busy: 'Making the backup…',
  // import
  openTitle: 'Open locked backup',
  openLead: (d) => `This backup${d ? ` from ${d}` : ''} is locked. Type the password it was made with.`,
  open: 'Open',
  wrong: 'That password does not open this backup. Check capital letters and try again.',
  opening: 'Opening…',
};

export async function exportSheet() {
  const nFiles = await store.fileCount();
  const lockBox = h('input', { type: 'checkbox', role: 'switch', checked: canLock() || null, disabled: !canLock() || null, 'data-id': 'backup.lock-toggle' });
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', 'data-id': 'backup.password' });
  const pw2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', 'data-id': 'backup.password-again' });
  const show = h('input', { type: 'checkbox', 'data-id': 'backup.show-password', onChange: (e) => { pw.type = pw2.type = e.target.checked ? 'text' : 'password'; } });
  const filesBox = h('input', { type: 'checkbox', checked: true, 'data-id': 'backup.files-toggle' });
  const msg = h('p', { class: 'note backup-msg', 'data-id': 'backup.message', role: 'status' });
  const pwPart = h('div', { class: 'backup-pw', 'data-id': 'backup.password-part' },
    h('label', { class: 'field' }, h('span', { class: 'note' }, T.pw), pw),
    h('label', { class: 'field' }, h('span', { class: 'note' }, T.pw2), pw2),
    h('label', { class: 'backup-check' }, show, h('span', {}, T.show)),
    h('p', { class: 'backup-warn', 'data-id': 'backup.warning' }, T.warn));
  const syncLock = () => { pwPart.hidden = !lockBox.checked; };
  lockBox.addEventListener('change', syncLock); syncLock();

  const body = [
    h('p', { class: 'note' }, T.lead),
    h('label', { class: 'toggle', 'data-id': 'backup.lock' }, h('span', { class: 'toggle-text' }, T.lockOn, h('small', {}, canLock() ? T.lockHint : T.noLock)), lockBox),
    pwPart,
    nFiles ? h('label', { class: 'toggle', 'data-id': 'backup.files' }, h('span', { class: 'toggle-text' }, T.files(nFiles), h('small', {}, T.filesHint)), filesBox)
      : h('p', { class: 'note', 'data-id': 'backup.files' }, T.noFiles),
    msg,
  ];
  const p = sheet({ title: T.title, dataId: 'backup.sheet', body, actions: [{ id: 'make', label: T.make, primary: true, run: async () => {
    const locked = lockBox.checked;
    if (locked && pw.value.length < 6) { msg.textContent = T.short; pw.focus(); return false; }
    if (locked && pw.value !== pw2.value) { msg.textContent = T.differ; pw2.focus(); return false; }
    msg.textContent = T.busy;
    try {
      const r = await makeBackup({ password: locked ? pw.value : '', files: !nFiles || filesBox.checked });
      toast(T.done(sizeText(r.size)), 4000);
      return 'made';
    } catch (e) { console.error(e); msg.textContent = 'Backup failed: ' + e.message; return false; }
  } }] });
  setTimeout(() => lockBox.checked && pw.focus(), 50);
  return p;
}

function askPassword(file) {
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', 'data-id': 'backup.open-password' });
  const msg = h('p', { class: 'note backup-msg', 'data-id': 'backup.open-message', role: 'status' });
  const when = file.exportedAt ? new Date(file.exportedAt).toLocaleString() : '';
  const p = sheet({ title: T.openTitle, dataId: 'backup.open-sheet',
    body: [h('p', { class: 'note' }, T.openLead(when)), h('label', { class: 'field' }, h('span', { class: 'note' }, T.pw), pw), msg],
    actions: [{ id: 'open', label: T.open, primary: true, run: async () => {
      if (!pw.value) { pw.focus(); return false; }
      msg.textContent = T.opening;
      try { return await unlock(file, pw.value); }
      catch (e) { msg.textContent = e.message === 'wrong-password' ? T.wrong : e.message; pw.select(); return false; }
    } }] });
  setTimeout(() => pw.focus(), 50);
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pw.closest('dialog').querySelector('[data-id="backup.open-sheet.open"]').click(); } });
  return p;
}

export async function importBackup(file) {
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); } catch { toast('That file is not a ZugDesk backup'); return; }
  if (isLocked(json)) {
    if (!globalThis.crypto || !crypto.subtle) { toast(T.noLock, 5000); return; }
    json = await askPassword(json);
    if (!json || typeof json !== 'object') { toast('Import cancelled'); return; }
  }
  const err = store.validateBackup(json);
  if (err) { toast(err, 5000); return; }
  const rows = store.backupRows(json);
  // A backup made before Shadchan Mode existed only holds Single Mode.
  const scope = json.shadchan ? 'It holds both modes.' : 'It holds Single Mode only, so Shadchan Mode records on this device are not touched.';
  const files = json.noFiles ? ' It has no attached files, so the files on this device stay.' : '';
  const replace = await confirmDialog({
    title: 'Import this backup?',
    text: `${rows} records from ${new Date(json.exportedAt).toLocaleString()}. ${scope}${files} “Replace” deletes what is on this device first; “Merge” keeps it and adds the backup on top.`,
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
