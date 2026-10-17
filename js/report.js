// Pure functions: turn meals into CSV rows and a plain-text report. No DOM, no storage.
import { methodLabel, fmt, parseYmd } from './ui.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const wk = (d) => parseYmd(d).toLocaleDateString('en-US', { weekday: 'short' });
const sortMeals = (meals) => [...meals].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || (a.createdAt || 0) - (b.createdAt || 0));

// Everything eaten as one flat list of items: ingredients first, then oil, other fat, seasonings, liquid.
// grams is null when the amount was given in tsp/tbsp/ml; that amount goes in `measure`.
export function mealItems(m) {
  const items = (m.ingredients || []).map((i) => ({
    name: i.name, grams: i.grams, state: i.state || 'raw', brand: i.brand || '', measure: '', kind: 'ingredient'
  }));
  if (m.oilG != null) items.push({ name: m.oilType ? `${m.oilType} oil`.replace(/ oil oil$/i, ' oil') : 'Oil', grams: m.oilG, state: 'added', brand: '', measure: '', kind: 'oil' });
  if (m.fatG != null) items.push({ name: m.fatName || 'Other fat', grams: m.fatG, state: 'added', brand: '', measure: '', kind: 'fat' });
  for (const s of m.seasonings || []) {
    if (!s.name) continue;
    const grams = s.unit === 'g' ? s.amount : null;
    items.push({ name: s.name, grams, state: 'added', brand: '', measure: grams == null && s.amount != null ? `${fmt(s.amount)} ${s.unit}` : '', kind: 'seasoning' });
  }
  if (m.liquidMl != null) items.push({ name: 'Water/liquid', grams: null, state: 'added', brand: '', measure: `${fmt(m.liquidMl)} ml`, kind: 'liquid' });
  return items;
}

const ateText = (m) => (m.ate ? `${fmt(m.ate.value)}${m.ate.unit === '%' ? '%' : ' g'}` : '');

export const CSV_HEADER = ['date', 'meal', 'dish', 'method', 'heat', 'temp_c', 'cook_min', 'cookware', 'oil_type', 'oil_g',
  'ingredient', 'brand', 'grams', 'measure', 'raw_cooked', 'dish_cooked_weight_g', 'ate', 'notes'];

export function csvRows(meals) {
  const rows = [];
  for (const m of sortMeals(meals)) {
    for (const i of mealItems(m)) {
      rows.push([m.date, m.tag, m.dish, methodLabel(m.method), m.heat || '', m.tempC ?? '', m.minutes ?? '', m.cookware || '',
        m.oilType || '', m.oilG ?? '', i.name, i.brand, i.grams ?? '', i.measure, i.state, m.cookedG ?? '', ateText(m), m.notes || '']);
    }
  }
  return rows;
}

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = (meals) => [CSV_HEADER, ...csvRows(meals)].map((r) => r.map(esc).join(',')).join('\n') + '\n';

// Totals per item across meals; "times" counts meals containing it.
export function totals(meals) {
  const map = new Map();
  for (const m of meals) {
    const seen = new Set();
    for (const i of mealItems(m)) {
      if (i.grams == null) continue;
      const key = i.name.trim().toLowerCase();
      const t = map.get(key) || { name: i.name.trim(), grams: 0, raw: 0, cooked: 0, times: 0 };
      t.grams += i.grams;
      if (i.state === 'raw') t.raw += i.grams; else if (i.state === 'cooked') t.cooked += i.grams;
      if (!seen.has(key)) { t.times++; seen.add(key); }
      map.set(key, t);
    }
  }
  return [...map.values()].sort((a, b) => b.grams - a.grams);
}

export function toText(meals, start, end) {
  const L = [];
  const list = sortMeals(meals);
  const days = [...new Set(list.map((m) => m.date))];
  L.push(`FOOD LOG ${start} to ${end}`);
  L.push(`${list.length} meal${list.length === 1 ? '' : 's'} on ${days.length} day${days.length === 1 ? '' : 's'}. Grams are as weighed for each item; "ate" is how much of the dish I ate.`);
  for (const d of days) {
    L.push('', `${d} (${wk(d)})`);
    for (const m of list.filter((x) => x.date === d)) {
      L.push('', `${cap(m.tag)}${m.time ? ' ' + m.time : ''}: ${m.dish}`);
      const how = [methodLabel(m.method), m.cookware, m.heat && `${m.heat} heat`, m.tempC != null && `${fmt(m.tempC)}°C`, m.minutes != null && `${fmt(m.minutes)} min`].filter(Boolean).join(', ');
      if (how) L.push(`  Method: ${how}`);
      const fats = [m.oilG != null && `${m.oilType ? m.oilType + ' oil' : 'oil'} ${fmt(m.oilG)} g`, m.fatG != null && `${m.fatName || 'other fat'} ${fmt(m.fatG)} g`].filter(Boolean).join(', ');
      if (fats) L.push(`  Fat: ${fats}`);
      L.push('  Ingredients:');
      for (const i of m.ingredients || []) L.push(`    - ${i.name}${i.brand ? ` (${i.brand})` : ''} ${fmt(i.grams)} g ${i.state || 'raw'}`);
      const sea = (m.seasonings || []).filter((s) => s.name).map((s) => `${s.name} ${fmt(s.amount)} ${s.unit}`.trim());
      if (sea.length) L.push(`  Seasonings: ${sea.join(', ')}`);
      if (m.liquidMl != null) L.push(`  Liquid added: ${fmt(m.liquidMl)} ml`);
      const tail = [m.cookedG != null && `cooked weight ${fmt(m.cookedG)} g`, m.ate && `ate ${ateText(m)}`].filter(Boolean).join(', ');
      if (tail) L.push(`  Dish: ${tail}`);
      if (m.notes) L.push(`  Notes: ${m.notes}`);
    }
  }
  const t = totals(list);
  if (t.length) {
    L.push('', 'TOTALS PER INGREDIENT (grams, times eaten)');
    for (const x of t) {
      const split = x.raw && x.cooked ? ` [raw ${fmt(x.raw)}, cooked ${fmt(x.cooked)}]` : '';
      L.push(`- ${x.name}: ${fmt(x.grams)} g, ${x.times}x${split}`);
    }
  }
  return L.join('\n');
}
