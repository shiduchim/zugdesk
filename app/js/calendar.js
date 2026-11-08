// A normal month calendar for every date box in the app (owner request: the phone's own picker
// did not show the day of the week). Any <input type="date"> or "datetime-local" is enhanced
// automatically: the input stays (hidden) and keeps its value in the same format, so pages read
// and write `.value` exactly as before; a button shows the date with its weekday.
import { h, icon } from './ui.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

function parse(v, withTime) {
  if (!v) return null;
  const d = new Date(withTime ? v : v + 'T12:00');
  return isNaN(d) ? null : d;
}
export function niceDate(d, withTime) {
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: sameYear && withTime ? undefined : 'numeric' });
  return withTime ? day + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : day;
}

export function enhanceDates(scope = document) {
  for (const input of scope.querySelectorAll('input[type="date"]:not([data-cal]), input[type="datetime-local"]:not([data-cal])')) enhance(input);
}

function enhance(input) {
  const withTime = input.type === 'datetime-local';
  input.dataset.cal = withTime ? 'datetime' : 'date';
  const label = h('span', { class: 'cal-text' });
  const btn = h('button', { type: 'button', class: 'input cal-btn ' + (input.className.replace(/\binput\b/g, '') || ''), 'aria-label': input.getAttribute('aria-label') || 'Choose a date',
    'data-id': (input.dataset.id || 'date') + '.calendar', html: icon('clock') }, label);
  const refresh = () => {
    const d = parse(valueDesc.get.call(input), withTime);
    label.textContent = d ? niceDate(d, withTime) : (input.placeholder || 'Choose a date');
    btn.classList.toggle('empty', !d);
  };
  // keep the label right when a page sets .value itself
  Object.defineProperty(input, 'value', { configurable: true,
    get() { return valueDesc.get.call(this); },
    set(v) { valueDesc.set.call(this, v); refresh(); } });
  input.type = 'hidden';
  btn.addEventListener('click', () => openCalendar(input, withTime));
  if (input.id) { const l = document.querySelector(`label[for="${CSS.escape(input.id)}"]`); l && l.addEventListener('click', (e) => { e.preventDefault(); btn.click(); }); }
  input.after(btn);
  refresh();
}

function openCalendar(input, withTime) {
  const cur = parse(input.value, withTime);
  const today = new Date();
  let view = new Date((cur || today).getFullYear(), (cur || today).getMonth(), 1);
  let picked = cur ? new Date(cur) : null;
  if (withTime && !picked) { picked = null; }
  const time = { h: cur ? cur.getHours() : 19, m: cur ? cur.getMinutes() : 0 };

  const dlg = h('dialog', { class: 'sheet cal-sheet', 'data-id': 'calendar' });
  const close = () => { dlg.close(); dlg.remove(); };
  const set = (val) => { input.value = val; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const commit = () => {
    if (!picked) { close(); return; }
    if (withTime) { const d = new Date(picked); d.setHours(time.h, time.m, 0, 0); set(`${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`); }
    else set(ymd(picked));
    close();
  };

  const draw = () => {
    dlg.innerHTML = '';
    const first = view.getDay(), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(h('span', { class: 'cal-day blank' }));
    for (let n = 1; n <= days; n++) {
      const d = new Date(view.getFullYear(), view.getMonth(), n);
      const isToday = ymd(d) === ymd(today), isPicked = picked && ymd(d) === ymd(picked);
      cells.push(h('button', { type: 'button', class: 'cal-day' + (isToday ? ' today' : '') + (isPicked ? ' picked' : '') + (d.getDay() === 6 ? ' shabbos' : ''),
        'aria-label': d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), 'aria-pressed': isPicked ? 'true' : 'false', 'data-id': 'calendar.day',
        onClick: () => { picked = d; if (withTime) draw(); else commit(); } }, String(n)));
    }
    const hours = [], mins = [];
    for (let i = 0; i < 24; i++) hours.push(h('option', { value: i, selected: i === time.h || null }, new Date(2000, 0, 1, i).toLocaleTimeString(undefined, { hour: 'numeric' })));
    const mset = new Set([0, 15, 30, 45, time.m]);
    for (const m of [...mset].sort((a, b) => a - b)) mins.push(h('option', { value: m, selected: m === time.m || null }, ':' + pad(m)));
    dlg.append(
      h('div', { class: 'cal-head' },
        h('button', { type: 'button', class: 'icon-btn cal-prev', 'aria-label': 'Previous month', 'data-id': 'calendar.prev', html: icon('chevron'), onClick: () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(); } }),
        h('strong', { class: 'cal-month' }, view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next month', 'data-id': 'calendar.next', html: icon('chevron'), onClick: () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(); } })),
      h('div', { class: 'cal-grid', role: 'grid' }, DAYS.map(d => h('span', { class: 'cal-dow' + (d === 'Sat' ? ' shabbos' : '') }, d)), cells),
      h('div', { class: 'cal-picked', 'data-id': 'calendar.picked' }, picked ? niceDate(picked, false) : 'Tap a day'),
      withTime ? h('div', { class: 'cal-time' }, h('span', { class: 'note' }, 'Time'),
        h('select', { class: 'input', 'aria-label': 'Hour', 'data-id': 'calendar.hour', onChange: (e) => { time.h = +e.target.value; } }, hours),
        h('select', { class: 'input', 'aria-label': 'Minutes', 'data-id': 'calendar.minutes', onChange: (e) => { time.m = +e.target.value; } }, mins)) : null,
      h('div', { class: 'btn-row cal-actions' },
        h('button', { type: 'button', class: 'btn', 'data-id': 'calendar.today', onClick: () => { picked = new Date(); view = new Date(picked.getFullYear(), picked.getMonth(), 1); if (withTime) draw(); else commit(); } }, 'Today'),
        !input.required && input.value ? h('button', { type: 'button', class: 'btn', 'data-id': 'calendar.clear', onClick: () => { set(''); close(); } }, 'Clear') : null,
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', 'data-id': 'calendar.cancel', onClick: close }, 'Cancel'),
        withTime ? h('button', { type: 'button', class: 'btn primary', 'data-id': 'calendar.done', onClick: commit }, 'Done') : null));
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  draw();
  document.body.append(dlg);
  dlg.showModal();
}

// Watch the whole app: pages and sheets add date boxes at any time.
export function watchDates() {
  enhanceDates();
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) {
      if (n.matches?.('input[type="date"], input[type="datetime-local"]')) enhance(n);
      else if (n.querySelector) enhanceDates(n);
    }
  }).observe(document.body, { childList: true, subtree: true });
}
