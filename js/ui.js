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
export const fmt = (n) => (n == null ? '' : String(Math.round(n * 100) / 100));

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

// Total grams of food in a meal: ingredients + oil + other fat + seasonings given in grams.
export function mealGrams(m) {
  let t = 0;
  for (const i of m.ingredients || []) t += i.grams || 0;
  t += (m.oilG || 0) + (m.fatG || 0);
  for (const s of m.seasonings || []) if (s.unit === 'g') t += s.amount || 0;
  return t;
}

export const METHODS = [
  ['pan-fry', 'Stove pan-fry'], ['deep-fry', 'Deep fry'], ['boil', 'Boil'], ['steam', 'Steam'],
  ['air-fryer', 'Air fryer'], ['oven', 'Oven bake'], ['grill', 'Grill'], ['microwave', 'Microwave'], ['none', 'No cook']
];
export const methodLabel = (k) => (METHODS.find((m) => m[0] === k) || [, k || ''])[1];

// Amounts: each ingredient has { amount, unit }. Only g and kg convert to grams; other units (pc, ml, L...)
// are kept as entered. Meals saved before units existed have just `grams`, treated as unit g.
export const UNITS = ['g', 'kg', 'ml', 'L', 'pc', 'tsp', 'tbsp', 'cup'];
export const SEASONING_UNITS = ['g', 'tsp', 'tbsp', 'ml', 'pc'];
export const toGrams = (amount, unit) => (amount == null ? null : unit === 'g' ? amount : unit === 'kg' ? amount * 1000 : null);
export const ingAmount = (i) => (i.unit ? { amount: i.amount, unit: i.unit } : { amount: i.grams, unit: 'g' });
export const amountText = (i) => { const a = ingAmount(i); return a.amount == null ? '' : `${fmt(a.amount)} ${a.unit}`; };

// Screen header: small accent eyebrow over a big serif title.
export function pageHead(title, eyebrow) {
  return h('header', { class: 'head' }, eyebrow && h('div', { class: 'eyebrow' }, eyebrow), h('h1', { class: 'title' }, title));
}

const PLATE_ART = `<svg class="art" viewBox="0 0 132 132" aria-hidden="true">
  <path class="steam" d="M52 44c-6-8 6-12 0-20"/><path class="steam" d="M66 40c-6-8 6-12 0-20"/><path class="steam" d="M80 44c-6-8 6-12 0-20"/>
  <g class="bowl"><ellipse class="plate" cx="66" cy="92" rx="52" ry="18"/><ellipse class="rim" cx="66" cy="90" rx="36" ry="11"/></g></svg>`;

// Friendly empty state with a gently steaming plate.
export function emptyState(title, text, action) {
  const el = h('div', { class: 'empty' }, h('h3', {}, title), h('p', {}, text), action);
  el.insertAdjacentHTML('afterbegin', PLATE_ART);
  return el;
}

// Counts a number up from 0 for a little life in stat tiles.
export function countUp(el, to, ms = 650) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dec = to % 1 !== 0;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = k < 1 ? (dec ? (to * e).toFixed(1) : Math.round(to * e)) : fmt(to);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
