const views = {};
const tabs = ['log', 'history', 'export'];

export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1800);
}

export function register(name, mod) { views[name] = mod; }

export async function show(name, opts) {
  for (const t of tabs) {
    document.getElementById('view-' + t).hidden = t !== name;
    document.querySelector(`.tab[data-tab="${t}"]`).classList.toggle('active', t === name);
  }
  const mod = views[name];
  if (mod) await mod.render(document.getElementById('view-' + name), opts);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => show(b.dataset.tab)));

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
