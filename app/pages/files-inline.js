// Photos and docs right on the page: photos as a grid, documents as rows, Add and Remove, no popup
// (owner request). Shared by My Profile and the person card so both work the same way.
// `files` is the live list (the helper adds to it and removes from it); `extra` goes into every new
// attachment record (e.g. { profileFile: true } or { personId }).
import * as store from '../js/store.js';
import { h, icon, toast, confirmDialog } from '../js/ui.js';

const MAX_FILE = 5 * 1024 * 1024;
const ico = (n) => h('span', { html: icon(n) }).firstChild;
const isPhoto = (f) => /^image\//.test(f.type || '');
const readUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

export function filesInline({ files, dataId, extra, tag = () => '' }) {
  const wrap = h('div', { class: 'mp-files', 'data-id': dataId });
  const picker = h('input', { type: 'file', multiple: true, class: 'hidden', accept: 'image/*,application/pdf', 'data-id': dataId + '.input' });
  const del = async (f) => {
    if (!(await confirmDialog({ title: 'Remove this file?', text: f.name, ok: 'Remove', danger: true, dataId: dataId + '.remove-dialog' }))) return;
    await store.attachments.remove(f.id); files.splice(files.indexOf(f), 1); draw();
  };
  const removeBtn = (f) => h('button', { type: 'button', class: 'linkish danger-text', 'data-id': dataId + '.remove', onClick: () => del(f) }, 'Remove');
  function draw() {
    wrap.innerHTML = '';
    const photos = files.filter(isPhoto), docs = files.filter(f => !isPhoto(f));
    if (photos.length) wrap.append(h('div', { class: 'me-photos' }, photos.map(f => h('figure', { class: 'me-photo', 'data-id': dataId + '.photo' },
      h('a', { href: f.dataUrl, download: f.name }, h('img', { src: f.dataUrl, alt: f.name })), removeBtn(f)))));
    for (const f of docs) wrap.append(h('div', { class: 'me-doc', 'data-id': dataId + '.doc' }, ico('file'),
      h('a', { class: 'grow', dir: 'auto', href: f.dataUrl, download: f.name }, f.name),
      tag(f) ? h('span', { class: 'priv' }, tag(f)) : null, removeBtn(f)));
    wrap.append(picker, h('button', { type: 'button', class: 'btn small me-add', 'data-id': dataId + '.add', onClick: () => picker.click() }, ico('upload'), 'Add photos or docs'));
  }
  picker.addEventListener('change', async () => {
    for (const f of picker.files) {
      if (f.size > MAX_FILE) { toast(`${f.name} is larger than 5 MB`); continue; }
      files.push(await store.attachments.save({ name: f.name, type: f.type, size: f.size, dataUrl: await readUrl(f), personId: null, contactId: null, ...extra }));
    }
    picker.value = ''; draw();
  });
  draw();
  return wrap;
}
