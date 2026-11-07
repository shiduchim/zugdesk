// Hash router: #/home, #/contacts, #/contacts/<id>, #/settings …
// Each page module exports render(container, params) and may export destroy().
const routes = [];
let current = null;

export function route(pattern, loader) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; }) + '$');
  routes.push({ re, keys, loader, pattern });
}

export function currentPath() {
  const hash = location.hash || '#/home';
  return hash.replace(/^#/, '').split('?')[0] || '/home';
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) location.replace(target); else location.hash = target;
}

export async function resolve(container, onChange) {
  const path = currentPath();
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (current && current.mod.destroy) { try { current.mod.destroy(); } catch (e) { console.error(e); } }
    const mod = await r.loader();
    container.innerHTML = '';
    container.className = 'content'; // pages add their own classes; never let them leak to the next page
    container.scrollTop = 0; window.scrollTo(0, 0);
    current = { mod, path, params };
    await mod.render(container, params, path);
    onChange && onChange(path, params, mod);
    return;
  }
  navigate('/home', { replace: true });
}

export function start(container, onChange) {
  window.addEventListener('hashchange', () => resolve(container, onChange));
  return resolve(container, onChange);
}
