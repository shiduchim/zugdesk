// "Show labels" overlay: draws each element's data-id on top of it so the owner
// can tap it on the phone, copy the name, and send it to Claude.
import { toast } from './ui.js';

let layer = null, observer = null, raf = 0, enabled = false;

function schedule() { if (!enabled) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }

function draw() {
  if (!layer) return;
  layer.innerHTML = '';
  const els = document.querySelectorAll('[data-id]');
  const vw = window.innerWidth, vh = window.innerHeight;
  for (const el of els) {
    if (el.closest('dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'lbl'; chip.textContent = el.dataset.id;
    chip.style.top = Math.max(2, r.top - 2) + 'px';
    chip.style.left = '0px';
    chip.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      const name = el.dataset.id;
      (navigator.clipboard?.writeText(name) || Promise.reject()).then(() => toast(`Copied: ${name}`), () => toast(name));
    });
    layer.append(chip);
    chip.style.left = Math.max(2, Math.min(r.left, vw - chip.offsetWidth - 2)) + 'px';
  }
}

export function setLabels(on) {
  enabled = !!on;
  document.body.classList.toggle('show-labels', enabled);
  if (enabled) {
    if (!layer) { layer = document.createElement('div'); layer.id = 'labels-layer'; document.body.append(layer); }
    if (!observer) {
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open'] });
    }
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    draw();
  } else {
    observer?.disconnect(); observer = null;
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    layer?.remove(); layer = null;
  }
}
export const labelsEnabled = () => enabled;
