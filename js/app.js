const views = {};
const tabs = ['log', 'history', 'export'];

const CHECK = '<span class="ok"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';

// toast('Saved', { ok: true }) or toast('Deleted', { action: { label: 'Undo', fn } })
export function toast(msg, { ok = false, action = null } = {}) {
  const el = document.getElementById('toast');
  el.replaceChildren();
  if (ok) el.insertAdjacentHTML('beforeend', CHECK);
  el.append(Object.assign(document.createElement('span'), { textContent: msg }));
  el.classList.toggle('has-action', !!action);
  if (action) {
    const b = Object.assign(document.createElement('button'), { className: 'act', textContent: action.label });
    b.onclick = () => { el.classList.remove('show'); action.fn(); };
    el.append(b);
  }
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), action ? 5000 : 1800);
}

export function register(name, mod) { views[name] = mod; }

export async function show(name, opts) {
  const t = document.getElementById('toast');
  if (t.classList.contains('has-action')) t.classList.remove('show', 'has-action');   // an Undo toast belongs to the screen that raised it
  for (const t of tabs) {
    document.getElementById('view-' + t).hidden = t !== name;
    document.querySelector(`.tab[data-tab="${t}"]`).classList.toggle('active', t === name);
  }
  const root = document.getElementById('view-' + name);
  const mod = views[name];
  root.classList.remove('enter');
  if (mod) await mod.render(root, opts);
  [...root.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
  void root.offsetWidth; root.classList.add('enter');
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    // Tapping the active tab scrolls back to the top, like native apps.
    if (b.classList.contains('active')) return window.scrollTo({ top: 0, behavior: 'smooth' });
    show(b.dataset.tab);
  }));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

import * as log from './log.js';
import * as history from './history.js';
import * as exportView from './export.js';
import { requestPersistence } from './db.js';

register('log', log);
register('history', history);
register('export', exportView);
requestPersistence();
show('log');
