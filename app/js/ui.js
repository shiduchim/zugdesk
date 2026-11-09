// Small DOM helpers shared by every page. No framework.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Inline SVG icons (stroke style matches the My Profile source).
const paths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  contacts: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.2.2 3.8 1.6 4.3 4.3"/>',
  idea: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M18.5 13.2l-2.6-2.5a1.6 1.6 0 0 1 2.3-2.3l.3.3.3-.3a1.6 1.6 0 0 1 2.3 2.3z"/>', // Ideas: a suggested person (person + small heart)
  people: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><circle cx="18" cy="16" r="3"/>',   // Ideas: a list
  shidduchim: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>', // Shidduchim: a heart
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 15V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/><path d="M10 11h11"/>',
  sort: '<path d="M7 4v16"/><path d="M3.5 16.5 7 20l3.5-3.5"/><path d="M14 6h7"/><path d="M14 11h5"/><path d="M14 16h3"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
};
export function icon(name, size) {
  const s = size ? `width="${size}" height="${size}"` : '';
  return `<svg ${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}
// Dock: the page's main button(s) stay on screen at the bottom, where the thumb is (owner request).
// Put it last in the page; it sticks above the bottom bar while the page scrolls.
export function dock(dataId, ...kids) { return h('div', { class: 'dock', 'data-id': dataId }, ...kids); }

// Phone / email links: same look everywhere (green phone, blue mail).
export function telLink(n, dataId) { return h('a', { class: 'tel-link', href: 'tel:' + String(n).replace(/[^0-9]/g, ''), dir: 'ltr', 'data-id': dataId || null, html: icon('phone') }, String(n)); }
export function mailLink(e, dataId) { return h('a', { class: 'mail-link', href: 'mailto:' + e, dir: 'ltr', 'data-id': dataId || null, html: icon('mail') }, e); }
export function iconEl(name) { const span = h('span', { class: 'ico', html: icon(name) }); return span.firstChild; }

let toastTimer;
// Optional `action`: { label, run } adds one button (e.g. Undo) to the toast.
export function toast(msg, ms = 2600, action = null) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg; t.classList.remove('hidden');
  if (action) t.append(h('button', { type: 'button', class: 'toast-action', 'data-id': 'toast.action', onClick: () => { t.classList.add('hidden'); clearTimeout(toastTimer); action.run(); } }, action.label));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), action ? Math.max(ms, 5000) : ms);
}

// Confirm dialog. Resolves true/false. `danger` colours the OK button.
export function confirmDialog({ title, text, ok = 'OK', cancel = 'Cancel', danger = false, dataId = 'dialog.confirm' }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'sheet', 'data-id': dataId },
      h('h2', {}, title),
      h('p', {}, text),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', 'data-id': dataId + '.cancel', onClick: () => { dlg.close(); resolve(false); } }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', 'data-id': dataId + '.ok', onClick: () => { dlg.close(); resolve(true); } }, ok),
      ));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function comingLater(what, stage) {
  toast(`${what} — coming in Stage ${stage}`);
}

export function section(eyebrow, dataId, ...children) {
  return h('section', { class: 'section', 'data-id': dataId },
    eyebrow ? h('div', { class: 'section-head' }, h('div', { class: 'eyebrow' }, eyebrow)) : null,
    ...children);
}

// Sheet dialog with arbitrary body. Resolves with the action id (or the value its
// `run` returns), or null when closed. A `run` returning false keeps it open.
export function sheet({ title, dataId, body, actions = [], className = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    // Close sits at the bottom right, after the other buttons, where a thumb can reach it (owner request).
    const closeBtn = h('button', { class: 'btn', type: 'button', 'data-id': dataId + '.close', onClick: () => finish(null) }, 'Close');
    const dlg = h('dialog', { class: 'sheet form-sheet ' + className, 'data-id': dataId },
      h('div', { class: 'sheet-head' }, h('h2', {}, title)),
      h('div', { class: 'sheet-body' }, body),
      h('div', { class: 'btn-row sheet-actions' }, actions.map(a =>
        h('button', { class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : ''), type: 'button', 'data-id': dataId + '.' + a.id,
          onClick: async () => { const v = a.run ? await a.run() : a.id; if (v !== false) finish(v === undefined ? a.id : v); } }, a.label)), closeBtn));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dlg.addEventListener('close', () => finish(null));
    document.body.append(dlg);
    dlg.showModal();
    dlg.finish = finish;
  });
}

// Small text prompt (e.g. "New folder", "Add a language"). Resolves trimmed text or null.
export async function promptText({ title, label, value = '', ok = 'Add', dataId = 'dialog.prompt' }) {
  const input = h('input', { class: 'input', value, dir: 'auto', 'data-id': dataId + '.input', 'aria-label': label });
  const p = sheet({ title, dataId, body: [h('div', { class: 'field' }, h('label', {}, label), input)],
    actions: [{ id: 'ok', label: ok, primary: true, run: () => input.value.trim() || (toast('Type something first'), false) }] });
  setTimeout(() => input.focus(), 50);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.closest('dialog').querySelector('[data-id$=".ok"]').click(); } });
  return p;
}

// Selectable bubbles. `multi` toggles many; otherwise one (tap again clears).
export function bubbles({ options, selected = [], multi = true, dataId, onChange, extra }) {
  let sel = [...selected];
  const wrap = h('div', { class: 'bubbles', role: multi ? 'group' : 'radiogroup', 'data-id': dataId });
  const draw = () => {
    wrap.innerHTML = '';
    for (const [v, label] of options) {
      const on = sel.includes(v);
      wrap.append(h('button', { type: 'button', class: 'bubble', 'aria-pressed': on ? 'true' : 'false', dir: 'auto', onClick: () => {
        sel = multi ? (on ? sel.filter(x => x !== v) : [...sel, v]) : (on ? [] : [v]);
        draw(); onChange && onChange(multi ? sel : (sel[0] ?? ''));
      } }, label));
    }
    if (extra) wrap.append(extra);
  };
  draw();
  wrap.getValue = () => multi ? sel : (sel[0] ?? '');
  wrap.setOptions = (o) => { options = o; draw(); };
  wrap.select = (v) => { if (!sel.includes(v)) sel = multi ? [...sel, v] : [v]; draw(); onChange && onChange(multi ? sel : v); };
  return wrap;
}

// Swipe left / right on a page to move between its tabs (owner request, tweak mode).
// The page container is shared, so the listeners go on once and each page registers its own
// tabs with swipeTabs(root, { keys, current, go }) and clears them with swipeTabs(root, null).
// Ignores the left-edge swipe that opens the menu, typing, and things that scroll sideways.
export function swipeTabs(el, cfg) {
  el.__swipe = cfg;
  if (el.__swipeOn || !cfg) return;
  el.__swipeOn = true;
  let sx = null, sy = 0, st = 0;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0], tg = e.target;
    sx = null;
    if (!el.__swipe || e.touches.length > 1 || t.clientX < 30) return;
    if (tg.closest('input, textarea, select, [contenteditable], dialog, .sheet, [data-noswipe]')) return;
    for (let n = tg; n && n !== el; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return;
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const c = el.__swipe;
    if (sx == null || !c) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    sx = null;
    if (Math.abs(dx) < 70 || dy > Math.abs(dx) * 0.5 || Date.now() - st > 800) return;
    const keys = c.keys(), i = keys.indexOf(c.current());
    const next = keys[i + (dx < 0 ? 1 : -1)];
    if (i >= 0 && next) c.go(next);
  }, { passive: true });
}
