import { h, ymd, addDays, parseYmd, fmt } from './ui.js';
import { mealsInRange, exportAll, importAll, requestPersistence } from './db.js';
import { toCSV, toText, totals } from './report.js';
import { toast } from './app.js';

let state = { start: '', end: '' };

function weekStart(d = new Date()) {   // Monday of this week
  const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return ymd(x);
}
const presets = {
  'Last 7 days': () => [addDays(ymd(), -6), ymd()],
  'This week': () => [weekStart(), ymd()],
  'Last month': () => { const n = new Date(); return [ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1)), ymd(new Date(n.getFullYear(), n.getMonth(), 0))]; }
};

export async function render(root) {
  if (!state.start) [state.start, state.end] = presets['Last 7 days']();
  root.replaceChildren();
  const startIn = h('input', { type: 'date', value: state.start, 'aria-label': 'Start date' });
  const endIn = h('input', { type: 'date', value: state.end, 'aria-label': 'End date' });
  const preview = h('div', {});
  const chips = h('div', { class: 'strip wrap' }, Object.keys(presets).map((k) =>
    h('button', { class: 'chip', onclick: () => { [state.start, state.end] = presets[k](); startIn.value = state.start; endIn.value = state.end; refresh(); } }, k)));

  root.append(h('h1', { class: 'title' }, 'Export'), chips,
    h('div', { class: 'card' }, h('div', { class: 'row2' },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'From'), startIn),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'To'), endIn))),
    preview, await backupCard());
  for (const el of [startIn, endIn]) el.addEventListener('change', () => { state.start = startIn.value; state.end = endIn.value; refresh(); });

  async function refresh() {
    if (!state.start || !state.end || state.start > state.end) {
      preview.replaceChildren(h('p', { class: 'hint' }, 'Pick a start date that is on or before the end date.'));
      return;
    }
    const meals = await mealsInRange(state.start, state.end);
    if (!meals.length) {
      preview.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'emoji' }, '🗓️'), h('h3', {}, 'Nothing logged in this range'), h('p', {}, 'Try a wider range, or log a meal first.')));
      return;
    }
    // Build everything now so the buttons can run synchronously inside the tap (iOS needs that for share/clipboard).
    const text = toText(meals, state.start, state.end);
    const csv = toCSV(meals);
    const name = `foodlog_${state.start}_to_${state.end}.csv`;
    const file = new File([csv], name, { type: 'text/csv' });
    const items = totals(meals).length;

    preview.replaceChildren(
      h('div', { class: 'actions export-actions' },
        h('button', { class: 'btn primary block big', onclick: () => copy(text) }, 'Copy as text'),
        h('div', { class: 'row2' },
          h('button', { class: 'btn soft block', onclick: () => download(csv, name) }, 'Download CSV'),
          h('button', { class: 'btn soft block', onclick: () => share(file, csv, name) }, 'Share'))),
      h('h2', { class: 'section' }, `Preview · ${meals.length} meal${meals.length === 1 ? '' : 's'} · ${items} items`),
      h('pre', { class: 'card report' }, text));
  }
  await refresh();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove();
    if (!ok) return toast('Could not copy');
  }
  toast('Copied. Paste it into Claude');
}

export function download(content, name, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function share(file, csv, name) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Food Log' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;   // user closed the sheet
  }
  download(csv, name);
  toast('Downloaded CSV');
}

const lastBackup = () => { try { return localStorage.getItem('foodlog-last-backup'); } catch { return null; } };

async function backupCard() {
  let persisted = false;
  try { persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false; } catch {}
  if (!persisted) persisted = await requestPersistence();
  const last = lastBackup();
  const status = h('p', { class: 'hint' },
    last ? `Last backup: ${new Date(last).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}. ` : 'No backup yet. ',
    persisted ? 'Storage is protected on this device.' : 'Safari may clear storage if the phone is low on space, so back up now and then.');
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const n = (data.meals || []).length, t = (data.templates || []).length;
      if (!confirm(`Restore ${n} meal${n === 1 ? '' : 's'} and ${t} saved dish${t === 1 ? '' : 'es'}? Entries with the same ID are overwritten, nothing else is removed.`)) return;
      await importAll(data);
      toast('Backup restored');
      await render(document.getElementById('view-export'));
    } catch (e) { toast(e.message.includes('Food Log') ? e.message : 'Could not read that file'); }
  } });
  return h('div', {},
    h('h2', { class: 'section' }, 'Backup'),
    h('div', { class: 'card' }, status,
      h('div', { class: 'row2' },
        h('button', { class: 'btn soft block', onclick: async () => {
          const data = await exportAll();
          download(JSON.stringify(data, null, 2), `foodlog-backup-${ymd()}.json`, 'application/json');
          try { localStorage.setItem('foodlog-last-backup', new Date().toISOString()); } catch {}
          toast('Backup saved');
        } }, 'Back up'),
        h('button', { class: 'btn soft block', onclick: () => file.click() }, 'Restore')),
      file));
}
