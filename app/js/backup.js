// Backup files: make one (optionally locked with a password) and read one back.
// A locked file is the normal backup JSON, packed (gzip, when the browser can) and then
// scrambled with AES-GCM using a key made from the password (PBKDF2-SHA-256).
// Nothing about the password is kept anywhere: a forgotten password cannot be recovered.
import * as store from './store.js';

const ITERATIONS = 310000;
const te = new TextEncoder();
const td = new TextDecoder();

export const canLock = () => !!(globalThis.crypto && crypto.subtle);

// ---------- base64 for large buffers ----------
function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------- gzip (skipped on browsers without CompressionStream) ----------
const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }

async function keyFrom(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function lock(json, password) {
  let bytes = te.encode(JSON.stringify(json));
  const zip = canZip() ? 'gzip' : '';
  if (zip) bytes = await pipe(bytes, new CompressionStream('gzip'));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return {
    app: 'ZugDesk', locked: 1, note: 'Locked ZugDesk backup. Open it in ZugDesk: Settings, Backup, Import backup. It needs the password it was made with.',
    exportedAt: json.exportedAt, noFiles: json.noFiles || undefined,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) }, zip, data: toB64(data),
  };
}

export const isLocked = (json) => !!(json && json.app === 'ZugDesk' && json.locked);

// Throws Error('wrong-password') when the password does not open it.
export async function unlock(file, password) {
  if (file.zip && !canZip()) throw new Error('This browser cannot open packed backups. Try it in Chrome or a newer Safari.');
  const key = await keyFrom(password, fromB64(file.kdf.salt), file.kdf.iterations);
  let bytes;
  try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.cipher.iv) }, key, fromB64(file.data))); }
  catch { throw new Error('wrong-password'); }
  if (file.zip === 'gzip') bytes = await pipe(bytes, new DecompressionStream('gzip'));
  return JSON.parse(td.decode(bytes));
}

// Makes the file and hands it to the browser to save. Returns the file name.
export async function makeBackup({ password = '', files = true } = {}) {
  let json = await store.exportAll({ files });
  if (password) json = await lock(json, password);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `zugdesk-backup${password ? '-locked' : ''}-${stamp}.json`;
  const blob = new Blob([JSON.stringify(json, null, password ? 0 : 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  store.noteBackupMade();
  return { name, size: blob.size };
}

export function sizeText(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
