// Tiny DOM helpers and date/number utilities shared by the screens.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };

// Accepts "12,5" as well as "12.5" (iOS decimal keypad follows the phone's locale).
export function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export const fmt = (n) => (n == null ? '' : String(Math.round(n * 10) / 10));

export function dayLabel(s) {
  const today = ymd();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return parseYmd(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

export function mealTagFor(d = new Date()) {
  const t = d.getHours();
  return t < 11 ? 'breakfast' : t < 16 ? 'lunch' : t < 21 ? 'dinner' : 'snack';
}

export function datalist(id, items) {
  return h('datalist', { id }, items.slice(0, 200).map((v) => h('option', { value: v })));
}
