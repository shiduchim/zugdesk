// Voice notes: a small mic inside a note box (bottom-right, like a chat app).
// Tap mic → bar with red dot, timer, Cancel, Stop. After Stop a chip shows under the box.
// Nothing is saved until the page's own Save calls savePending(). Audio stays on this phone (attachments).
import * as store from './store.js';
import { h, icon, toast } from './ui.js';

const MAX_SEC = 180; // 3 minutes, then it stops by itself
export const canRecord = () => !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
const pickType = () => ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const toDataURL = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });

// pend: an object the page keeps (its draft). Recordings go in pend.audio = [{ blob, type, duration }].
export function addMic(textarea, { dataId, pend }) {
  pend.audio = pend.audio || [];
  const wrap = h('div', { class: 'voice-box' });
  const chips = h('div', { class: 'voice-chips', 'data-id': dataId + '-chips' });
  const out = h('div', { class: 'voice-field' }, wrap, chips);
  textarea.replaceWith?.(out); // when already in the page
  wrap.append(textarea);
  if (!canRecord()) return out;
  textarea.classList.add('has-mic');
  const mic = h('button', { type: 'button', class: 'voice-mic', 'aria-label': 'Record a voice note', title: 'Record a voice note', 'data-id': dataId, html: icon('mic') });
  wrap.append(mic);
  let rec = null, stream = null, parts = [], t0 = 0, timer = null, cancelled = false;
  const bar = h('div', { class: 'voice-bar', 'data-id': dataId + '-bar' });
  const drawChips = () => {
    chips.innerHTML = '';
    pend.audio.forEach((a, i) => chips.append(voiceChip(URL.createObjectURL(a.blob), a.duration, () => { pend.audio.splice(i, 1); drawChips(); }, dataId + '-chip')));
  };
  const finish = () => { clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); bar.remove(); mic.hidden = false; };
  mic.addEventListener('click', async () => {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast('The microphone is blocked. Allow it for this app in the phone settings.', 6000); return; }
    const type = pickType();
    rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    parts = []; cancelled = false; t0 = Date.now();
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      const duration = (Date.now() - t0) / 1000; finish();
      if (cancelled || !parts.length) return;
      const blob = new Blob(parts, { type: rec.mimeType || type || 'audio/webm' });
      pend.audio.push({ blob, type: blob.type, duration }); drawChips();
    };
    const time = h('span', { class: 'voice-time mono' }, '0:00');
    bar.innerHTML = '';
    bar.append(h('span', { class: 'voice-dot' }), time, h('span', { class: 'voice-grow' }),
      h('button', { type: 'button', class: 'btn small', 'data-id': dataId + '-cancel', onClick: () => { cancelled = true; rec.stop(); } }, 'Cancel'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': dataId + '-stop', onClick: () => rec.stop() }, h('span', { html: icon('stop') }).firstChild, 'Stop'));
    mic.hidden = true; out.insertBefore(bar, chips);
    timer = setInterval(() => { const s = (Date.now() - t0) / 1000; time.textContent = mmss(s); if (s >= MAX_SEC) { rec.stop(); toast('3 minutes reached, recording stopped'); } }, 250);
    rec.start(1000);
  });
  drawChips();
  return out;
}

// Saves the page's pending recordings as attachments. Returns their ids (put them on the record as audioIds).
export async function savePending(pend, link = {}) {
  const ids = [];
  for (const a of pend.audio || []) {
    const rec = await store.attachments.save({ kind: 'voice', name: 'Voice note', type: a.type, size: a.blob.size,
      duration: Math.round(a.duration), dataUrl: await toDataURL(a.blob), contactId: link.contactId || null, personId: link.personId || null });
    ids.push(rec.id);
  }
  pend.audio = [];
  return ids;
}

function voiceChip(src, duration, onRemove, dataId) {
  const audio = new Audio(); audio.preload = 'none'; audio.src = src;
  const btn = h('button', { type: 'button', class: 'voice-play', 'aria-label': 'Play', html: icon('play') });
  audio.onended = audio.onpause = () => { btn.innerHTML = icon('play'); };
  audio.onplay = () => { btn.innerHTML = icon('stop'); };
  btn.addEventListener('click', () => { audio.paused ? audio.play().catch(() => toast('This recording cannot play on this phone')) : (audio.pause(), audio.currentTime = 0); });
  return h('span', { class: 'voice-chip', 'data-id': dataId }, btn, h('span', { class: 'mono' }, 'Voice ' + mmss(duration || 0)),
    onRemove ? h('button', { type: 'button', class: 'linkish danger-text', 'data-id': dataId + '-remove', onClick: onRemove }, 'Remove') : null);
}

// Play chips for saved recordings (history items, notes).
export function voiceChips(audioIds, dataId) {
  const box = h('div', { class: 'voice-chips', 'data-id': dataId });
  if (!audioIds?.length) return null;
  (async () => {
    for (const id of audioIds) {
      const a = await store.attachments.get(id);
      if (a) box.append(voiceChip(a.dataUrl, a.duration, null, dataId + '-chip'));
    }
  })();
  return box;
}

export async function removeAudio(audioIds) { for (const id of audioIds || []) await store.attachments.remove(id); }
