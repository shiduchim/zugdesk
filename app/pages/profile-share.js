// Share My Profile (spec/my-profile.md MP-04, build-handoff E). Allowlisted text only,
// an exact preview, an explicit channel tap, and a record ONLY after the owner says
// "Yes, I sent it". Opening WhatsApp or email never counts as delivered or read.
import * as store from '../js/store.js';
import { h, toast, sheet, confirmDialog } from '../js/ui.js';
import { loadProfile, view, suggestedText, fullText, extrasText, langName, isRtl, fileKind } from './profile-data.js';
import { norm } from './notes-data.js';

// source: 'full' | 'suggested' | <profileVersion id>
export async function openShare({ contactId = null, source = null } = {}) {
  const P = await loadProfile();
  if (!P.me || !P.me.name) { toast('Fill in My Profile first (at least your name)'); location.hash = '#/profile'; return; }
  // Language follows the chosen text: a saved version keeps its own; Suggested and Full use the Suggested-card choice.
  const langOf = () => (S.source === 'suggested' || S.source === 'full') ? (store.getPrefs().profileLang || P.me.lang || 'en') : (P.versions.find(x => x.id === S.source)?.lang || P.me.lang || 'en');
  const contacts = await store.contacts.list();
  let lang = P.me.lang || 'en', v = view(P.me, lang);
  const S = { source: source || (P.versions.length ? P.versions[0].id : 'suggested'), contactId, phone: false, email: false, refIds: [], fileIds: [], q: '' };

  const sources = [['suggested', 'Suggested short'], ['full', 'Full profile'], ...P.versions.map(x => [x.id, x.title || 'Saved version'])];
  const whatLabel = () => S.source === 'full' ? 'Full profile' : S.source === 'suggested' ? 'Suggested short version' : 'Short version · ' + (P.versions.find(x => x.id === S.source)?.title || '');
  const textNow = () => {
    if (S.source === 'full') return fullText(P.me, lang, S);
    const base = S.source === 'suggested' ? suggestedText(P.me, lang) : (P.versions.find(x => x.id === S.source)?.text || '');
    const extra = extrasText(P.me, lang, S);
    return extra ? base + '\n\n' + extra : base;
  };
  const chosenFiles = () => P.files.filter(f => S.fileIds.includes(f.id));
  const recipient = () => contacts.find(c => c.id === S.contactId) || null;

  const body = h('div', { class: 'share-body' });
  const draw = () => {
    lang = langOf(); v = view(P.me, lang);
    body.innerHTML = '';
    // 1. what
    body.append(h('div', { class: 'field' }, h('label', {}, 'What to send'),
      h('div', { class: 'bubbles', role: 'radiogroup', 'data-id': 'share.what' }, sources.map(([id, label]) =>
        h('button', { type: 'button', class: 'bubble', 'aria-pressed': S.source === id ? 'true' : 'false', dir: 'auto', onClick: () => { S.source = id; draw(); } }, label)))));
    // 2. to whom
    const r = recipient();
    const to = h('div', { class: 'field', 'data-id': 'share.to' }, h('label', {}, 'To (optional — used for the share log and their phone or email)'));
    if (r) to.append(h('div', { class: 'share-to' }, h('strong', { dir: 'auto' }, store.displayName(r)), h('span', { class: 'note' }, [r.phone, r.email].filter(Boolean).join(' · ') || 'No phone or email saved'),
      h('button', { type: 'button', class: 'linkish', 'data-id': 'share.to-change', onClick: () => { S.contactId = null; draw(); } }, 'Change')));
    else {
      const input = h('input', { class: 'input', type: 'search', dir: 'auto', placeholder: 'Find a contact…', value: S.q, 'aria-label': 'Find a contact', 'data-id': 'share.to-search' });
      const list = h('div', { class: 'share-pick' });
      const fill = () => {
        list.innerHTML = '';
        const q = norm(input.value); S.q = input.value;
        if (!q) return;
        for (const c of contacts.filter(c => norm(store.displayName(c)).includes(q)).slice(0, 6))
          list.append(h('button', { type: 'button', class: 'qitem', dir: 'auto', 'data-id': 'share.to-row', onClick: () => { S.contactId = c.id; S.q = ''; draw(); } }, store.displayName(c), h('span', { class: 'qsub' }, c.city || '')));
      };
      input.addEventListener('input', fill); fill();
      to.append(input, list);
    }
    body.append(to);
    // 3. you choose
    const tick = (label, on, set, dataId) => h('label', { class: 'share-tick', 'data-id': dataId }, h('input', { type: 'checkbox', checked: on || null, onChange: (e) => { set(e.target.checked); draw(); } }), h('span', { dir: 'auto' }, label));
    const choose = h('div', { class: 'field' }, h('label', {}, 'Also include — you choose (all off until you tick them)'));
    if (v.contact.phone) choose.append(tick(`My phone · ${v.contact.phone}`, S.phone, (x) => { S.phone = x; }, 'share.include-phone'));
    if (v.contact.email) choose.append(tick(`My email · ${v.contact.email}`, S.email, (x) => { S.email = x; }, 'share.include-email'));
    for (const ref of (v.references || []).filter(r => (r.name || '').trim())) choose.append(tick(`Reference · ${ref.name}${ref.relation ? ' (' + ref.relation + ')' : ''}`, S.refIds.includes(ref.id), (x) => { S.refIds = x ? [...S.refIds, ref.id] : S.refIds.filter(i => i !== ref.id); }, 'share.include-ref'));
    for (const f of P.files) choose.append(tick(`File · ${f.name}`, S.fileIds.includes(f.id), (x) => { S.fileIds = x ? [...S.fileIds, f.id] : S.fileIds.filter(i => i !== f.id); }, 'share.include-file'));
    if (choose.children.length === 1) choose.append(h('p', { class: 'note' }, 'Nothing optional saved yet (own phone, email, references or files).'));
    body.append(choose);
    // 4. exact preview
    const fs = chosenFiles();
    body.append(h('div', { class: 'field' }, h('label', {}, `Preview — exactly what will be sent${lang !== 'en' ? ' · ' + langName(lang) : ''}`),
      h('pre', { class: 'share-preview', dir: isRtl(lang) ? 'rtl' : 'auto', 'data-id': 'share.preview' }, textNow()),
      fs.length ? h('p', { class: 'note' }, 'Files: ' + fs.map(f => f.name).join(', ') + (canShareFiles(fs) ? '' : ' — attach them yourself in WhatsApp or email (download them below).')) : null,
      h('p', { class: 'note share-privacy' }, 'Never included: your private notes, conversation history, reference notes, or anyone else’s details.')));
  };
  draw();

  const send = async (channel) => {
    const text = textNow(), r = recipient(), fs = chosenFiles();
    let opened = true;
    if (channel === 'copy') { opened = await copy(text); if (opened) toast('Copied — paste it where you want to send it'); }
    else if (channel === 'whatsapp') window.open(`https://wa.me/${waDigits(r?.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    else if (channel === 'email') location.href = `mailto:${encodeURIComponent(r?.email || '')}?subject=${encodeURIComponent(v.name || 'Profile')}&body=${encodeURIComponent(text)}`;
    else if (channel === 'share') {
      try {
        const files = canShareFiles(fs) ? await Promise.all(fs.map(toFile)) : undefined;
        await navigator.share(files ? { text, files } : { text });
      } catch (e) { opened = false; if (e && e.name !== 'AbortError') toast('Could not open the share menu'); }
    }
    if (!opened) return false;
    const yes = await confirmDialog({ title: 'Did you send it?', text: 'ZugDesk cannot see whether it arrived or was read. Tap “Yes, I sent it” only if you really sent it — then it is saved in Sharing activity' + (r ? ` and in ${store.displayName(r)}’s history.` : '.'),
      ok: 'Yes, I sent it', cancel: 'Not sent', dataId: 'share.confirm' });
    if (!yes) { toast('Nothing recorded'); return false; }
    await store.shares.save({ at: store.now(), recipientContactId: r?.id || null, recipientName: r ? store.displayName(r) : '', channel: CHANNEL[channel],
      what: whatLabel(), text, lang, files: fs.map(f => f.name), confirmed: true });
    if (r) await store.recordEvent({ contactIds: [r.id], type: channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : '', text: `Sent my profile (${whatLabel()}). Recorded after I confirmed sending.` });
    toast('Recorded in Sharing activity');
    return true;
  };

  const actions = [
    { id: 'copy', label: 'Copy text', run: () => send('copy') },
    { id: 'whatsapp', label: 'WhatsApp', run: () => send('whatsapp') },
    { id: 'email', label: 'Email', run: () => send('email') },
  ];
  if (navigator.share) actions.push({ id: 'share', label: 'More…', run: () => send('share') });
  await sheet({ title: 'Share My Profile', dataId: 'share', className: 'tall share-sheet', body: [body,
    P.files.length ? h('details', { class: 'share-files' }, h('summary', {}, 'Download my files'), P.files.map(f => h('a', { class: 'att-row', href: f.dataUrl, download: f.name }, f.name))) : null],
    actions });
}

const CHANNEL = { copy: 'copied', whatsapp: 'WhatsApp', email: 'email', share: 'share menu' };
const waDigits = (p) => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d.length >= 8 && !d.startsWith('0') ? d : ''; };
function canShareFiles(fs) { try { return fs.length > 0 && !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.txt', { type: 'text/plain' })] }); } catch { return false; } }
async function toFile(f) { const b = await (await fetch(f.dataUrl)).blob(); return new File([b], f.name, { type: f.type || b.type }); }
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove();
    if (!ok) toast('Copy is blocked here — select the text and copy it by hand');
    return ok;
  }
}
