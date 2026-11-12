// Shadchan Mode — Send (spec/shadchan/design.md 6.6, stage S5): suggest one single to the other
// side. The shadchan ticks what goes in (short profile text, resume file, phone numbers and
// references, photo); the ticks are remembered for next time (nothing is ticked on the first send).
// The exact message is shown before anything leaves. Only after "Yes, I sent it" is the side
// marked Asked (setAnswer), with one history line saying what was sent to whom. The app never
// claims the message arrived or was read.
import * as store from '../js/store.js';
import { h, toast, sheet, confirmDialog } from '../js/ui.js';
import { suggestedFor } from './people-data.js';
import { copy } from './profile-share.js';
import * as sd from './sh-shidduch-data.js';

const T = {
  title: (first) => `Suggest ${first}`,
  lead: (name, side) => `${name}’s profile goes to ${side}. Nothing is recorded until you say you sent it.`,
  to: 'To',
  toNone: 'No one chosen · Copy or More only',
  noCards: (first) => `No numbers saved for ${first} yet. Copy the message, or add a number on their card.`,
  opening: 'First line (you can change it)',
  openYou: (name) => `I have a suggestion for you: ${name}.`,
  openFor: (first, name) => `I have a suggestion for ${first}: ${name}.`,
  include: 'What goes in · you choose',
  includeNote: 'Ticks are remembered for next time.',
  text: 'Short profile text',
  textWhich: 'Which text',
  suggested: 'Suggested (made from the card)',
  files: (n) => (n ? `Resume file${n > 1 ? 's' : ''} (${n})` : 'Resume file'),
  numbers: (n) => (n ? `Phone numbers and references (${n})` : 'Phone numbers and references'),
  photo: (n) => (n ? `Photo${n > 1 ? 's' : ''} (${n})` : 'Photo'),
  noFiles: 'no file saved', noNumbers: 'no numbers saved', noPhoto: 'no photo saved',
  numbersHead: 'Phone numbers:',
  preview: 'Exactly what will be sent',
  filesNote: (names) => `Files: ${names}.`,
  filesAttach: ' Attach them yourself in WhatsApp or email (download below), or use More to send them with the text.',
  download: 'Download the files',
  privacy: 'Never included: your notes, the history, answers or anything about other singles.',
  other: 'Already asked by phone or in person?',
  otherBtn: 'Just mark asked',
  copied: 'Copied · paste it where you want to send it',
  copy: 'Copy', whatsapp: 'WhatsApp', email: 'Email', more: 'More…',
  noNumber: 'No WhatsApp number for this person. Copy the message instead.',
  noEmail: 'No email saved for this person.',
  shareFail: 'Could not open the share menu',
  didTitle: 'Did you send it?',
  didText: (side) => `ZugDesk cannot see whether it arrived or was read. Tap “Yes, I sent it” only if you really sent it. Then ${side} is marked Asked today and the wait starts counting on Home.`,
  yes: 'Yes, I sent it', notSent: 'Not sent',
  nothing: 'Nothing recorded',
  done: (side) => `${side} marked Asked · sent today`,
  doneOther: (side) => `${side} marked Asked`,
  undo: 'Undo', undone: 'Last change undone',
  already: 'This side was already asked.',
  line: (name, to, how, what) => `Sent ${name}’s profile to ${to}${how ? ' by ' + how : ''}${what.length ? ': ' + what.join(', ') : ''}.`,
  what: { text: 'short profile', files: 'resume file', numbers: 'phone numbers', photo: 'photo' },
  how: { copy: '', whatsapp: 'WhatsApp', email: 'email', share: 'the share menu' },
};
const PREF = 'shSendTicks';
const isImg = (f) => /^image\//.test(f.type || '');
const waDigits = (p) => { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d.length >= 8 && !d.startsWith('0') ? d : ''; };
const first = (s) => String(s || '').trim().split(/\s+/)[0];

// `side` is the side being asked ('guy' or 'girl'); the profile sent is the other single's.
// Resolves true when the side was marked Asked.
export async function sendSheet(m, side, { onDone = null } = {}) {
  const o = sd.other(side), P = m[o], Q = m[side];
  if (!P || !Q) { toast(sd.T.removed); return false; }
  if (sd.ans(m.round.rec, side)) { toast(T.already); return false; }
  const atts = await store.attachments.byIndex('personId', P.id);
  const files = atts.filter(f => !isImg(f) && f.dataUrl), photos = atts.filter(f => isImg(f) && f.dataUrl);
  const numbers = (P.contactCards || []).filter(c => c.role !== 'shadchan' && (c.number || c.email));
  const texts = [['suggested', T.suggested, suggestedFor(P)], ...(P.shortVersions || []).filter(x => (x.text || '').trim()).map(x => [x.id, x.title || 'Short version', x.text])];
  const cards = (Q.contactCards || []).filter(c => c.number || c.email);
  const saved = store.getPrefs()[PREF] || {};
  const S = {
    tick: { text: !!saved.text, files: !!saved.files && files.length > 0, numbers: !!saved.numbers && numbers.length > 0, photo: !!saved.photo && photos.length > 0 },
    textId: texts.some(x => x[0] === saved.textId) ? saved.textId : texts[texts.length > 1 ? 1 : 0][0],
    to: cards.some(c => c.id === Q.talkTo) ? Q.talkTo : (cards[0]?.id || ''),
    opening: null,
  };
  const card = () => cards.find(c => c.id === S.to) || null;
  const toName = () => { const c = card(); return c ? (c.role === 'person' ? store.personName(Q) : c.name || store.phoneRoleLabel(c.role)) : sd.talkName(m, side); };
  const openLine = () => (S.opening ?? (card()?.role === 'person' ? T.openYou(store.personName(P)) : T.openFor(sd.firstName(m, side), store.personName(P))));
  const chosenFiles = () => [...(S.tick.files ? files : []), ...(S.tick.photo ? photos : [])];
  const message = () => {
    const parts = [openLine().trim()];
    if (S.tick.text) parts.push((texts.find(x => x[0] === S.textId) || texts[0])[2].trim());
    if (S.tick.numbers) parts.push([T.numbersHead, ...numbers.map(c => [c.role === 'person' ? store.phoneRoleLabel('person') : store.phoneRoleLabel(c.role), c.role === 'person' ? '' : c.name, c.number, c.email].filter(Boolean).join(' · '))].join('\n'));
    return parts.filter(Boolean).join('\n\n');
  };

  const body = h('div', { class: 'share-body' });
  const pre = h('pre', { class: 'share-preview', dir: 'auto', 'data-id': 'sh-send.preview' });
  const filesNote = h('p', { class: 'note', 'data-id': 'sh-send.files-note' });
  const refresh = () => {
    pre.textContent = message();
    const fs = chosenFiles();
    filesNote.textContent = fs.length ? T.filesNote(fs.map(f => f.name).join(', ')) + (canShareFiles() ? '' : T.filesAttach) : '';
  };
  const tick = (key, label, n, none, dataId) => h('label', { class: 'share-tick' + (n ? '' : ' muted'), 'data-id': dataId },
    h('input', { type: 'checkbox', checked: S.tick[key] || null, disabled: !n || null, onChange: (e) => { S.tick[key] = e.target.checked; draw(); } }),
    h('span', { dir: 'auto' }, label, n ? '' : ` · ${none}`));
  function draw() {
    body.innerHTML = '';
    body.append(
      h('p', { class: 'note', dir: 'auto' }, T.lead(store.personName(P), `${sd.T.sideLow[side]} (${store.personName(Q)})`)),
      h('div', { class: 'field', 'data-id': 'sh-send.to' }, h('label', { for: 'sh-send-to' }, T.to),
        cards.length ? h('select', { class: 'input', id: 'sh-send-to', 'data-id': 'sh-send.to-select', onChange: (e) => { S.to = e.target.value; draw(); } },
          cards.map(c => h('option', { value: c.id, selected: S.to === c.id || null }, [c.role === 'person' ? `${store.personName(Q)} (own number)` : `${store.phoneRoleLabel(c.role)} · ${c.name || ''}`, c.number].filter(Boolean).join(' · '))),
          h('option', { value: '', selected: !S.to || null }, T.toNone))
          : h('p', { class: 'note', dir: 'auto' }, T.noCards(first(store.personName(Q))))),
      h('div', { class: 'field' }, h('label', { for: 'sh-send-open' }, T.opening),
        h('input', { class: 'input', id: 'sh-send-open', dir: 'auto', value: openLine(), 'data-id': 'sh-send.opening', onInput: (e) => { S.opening = e.target.value; refresh(); } })),
      h('div', { class: 'field', 'data-id': 'sh-send.include' }, h('label', {}, T.include),
        tick('text', T.text, 1, '', 'sh-send.include-text'),
        S.tick.text && texts.length > 1 ? h('select', { class: 'input ssn-which', 'aria-label': T.textWhich, 'data-id': 'sh-send.text-which', onChange: (e) => { S.textId = e.target.value; refresh(); } },
          texts.map(([id, label]) => h('option', { value: id, selected: S.textId === id || null }, label))) : null,
        tick('files', T.files(files.length), files.length, T.noFiles, 'sh-send.include-files'),
        tick('numbers', T.numbers(numbers.length), numbers.length, T.noNumbers, 'sh-send.include-numbers'),
        tick('photo', T.photo(photos.length), photos.length, T.noPhoto, 'sh-send.include-photo'),
        h('p', { class: 'note' }, T.includeNote)),
      h('div', { class: 'field' }, h('label', {}, T.preview), pre, filesNote,
        h('p', { class: 'note share-privacy' }, T.privacy)),
      chosenFiles().length ? h('details', { class: 'share-files', 'data-id': 'sh-send.download' }, h('summary', {}, T.download),
        chosenFiles().map(f => h('a', { class: 'att-row', href: f.dataUrl, download: f.name }, f.name))) : null,
      h('div', { class: 'ssn-other', 'data-id': 'sh-send.other' }, h('span', { class: 'note' }, T.other),
        h('button', { type: 'button', class: 'linkish', 'data-id': 'sh-send.just-mark', onClick: () => record(null) }, T.otherBtn)));
    refresh();
  }

  let dlg = null, result = false;
  // Mark the side Asked (with the "sent" history line when something was sent), then offer Undo.
  async function record(channel) {
    const what = channel ? Object.keys(T.what).filter(k => S.tick[k]).map(k => T.what[k]) : [];
    const note = channel ? T.line(store.personName(P), toName(), T.how[channel], what) : '';
    const r = await sd.setAnswer(m, side, 'asked', { note });
    if (!r) { toast(T.already); dlg?.finish(null); return; }
    result = true;
    const label = sd.T.side[side];
    toast(channel ? T.done(label) : T.doneOther(label), 4000, { label: T.undo, run: async () => { await r.undo(); toast(T.undone); } });
    dlg?.finish('sent');
    onDone && onDone();
  }
  async function send(channel) {
    const text = message(), c = card(), fs = chosenFiles();
    store.setPref(PREF, { ...S.tick, textId: S.textId });
    let opened = true;
    if (channel === 'copy') { opened = await copy(text); if (opened) toast(T.copied); }
    else if (channel === 'whatsapp') {
      const d = waDigits(c?.number);
      if (!d) { toast(T.noNumber, 4000); return false; }
      window.open(`https://wa.me/${d}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if (channel === 'email') {
      if (!c?.email) { toast(T.noEmail); return false; }
      location.href = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(store.personName(P))}&body=${encodeURIComponent(text)}`;
    } else if (channel === 'share') {
      try {
        const shareFiles = fs.length && canShareFiles() ? await Promise.all(fs.map(toFile)) : undefined;
        await navigator.share(shareFiles ? { text, files: shareFiles } : { text });
      } catch (e) { opened = false; if (e && e.name !== 'AbortError') toast(T.shareFail); }
    }
    if (!opened) return false;
    const yes = await confirmDialog({ title: T.didTitle, text: T.didText(sd.T.sideLow[side]), ok: T.yes, cancel: T.notSent, dataId: 'sh-send.confirm' });
    if (!yes) { toast(T.nothing); return false; }
    await record(channel);
    return 'sent';
  }

  draw();
  const actions = [
    { id: 'copy', label: T.copy, run: () => send('copy') },
    { id: 'whatsapp', label: T.whatsapp, primary: true, run: () => send('whatsapp') },
    { id: 'email', label: T.email, run: () => send('email') },
  ];
  if (navigator.share) actions.push({ id: 'share', label: T.more, run: () => send('share') });
  const p = sheet({ title: T.title(store.personName(P)), dataId: 'sh-send', className: 'tall share-sheet', body, actions });
  dlg = document.querySelector('dialog[data-id="sh-send"]');
  await p;
  return result;
}

function canShareFiles() { try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.txt', { type: 'text/plain' })] }); } catch { return false; } }
async function toFile(f) { const b = await (await fetch(f.dataUrl)).blob(); return new File([b], f.name, { type: f.type || b.type }); }
