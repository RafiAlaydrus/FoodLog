// Pure functions: turn meals into CSV rows and a plain-text report. No DOM, no storage.
import { methodLabel, fmt, parseYmd, ingAmount, amountText } from './ui.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const wk = (d) => parseYmd(d).toLocaleDateString('en-US', { weekday: 'short' });
const sortMeals = (meals) => [...meals].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || (a.createdAt || 0) - (b.createdAt || 0));

// Everything eaten as one flat list of items: ingredients first, then oil, other fat, seasonings, liquid.
// Each item has amount + unit. grams is set only for g/kg amounts; anything else (pc, ml, tsp...) is kept in
// `measure` ("2 pc") so nothing is converted by guesswork.
const item = (name, amount, unit, extra = {}) => ({
  name, amount, unit, grams: unit === 'g' ? amount : unit === 'kg' && amount != null ? amount * 1000 : null,
  measure: unit !== 'g' && amount != null ? `${fmt(amount)} ${unit}` : '', state: 'added', brand: '', kind: 'ingredient', ...extra
});

export function mealItems(m) {
  const items = (m.ingredients || []).map((i) => {
    const a = ingAmount(i);
    return item(i.name, a.amount, a.unit, { state: i.state || 'raw', brand: i.brand || '', measure: a.unit !== 'g' && a.amount != null ? `${fmt(a.amount)} ${a.unit}` : '' });
  });
  if (m.oilG != null) items.push(item(m.oilType ? `${m.oilType} oil`.replace(/ oil oil$/i, ' oil') : 'Oil', m.oilG, 'g', { kind: 'oil' }));
  if (m.fatG != null) items.push(item(m.fatName || 'Other fat', m.fatG, 'g', { kind: 'fat' }));
  for (const s of m.seasonings || []) if (s.name) items.push(item(s.name, s.amount, s.unit || 'g', { kind: 'seasoning' }));
  if (m.liquidMl != null) items.push(item('Water/liquid', m.liquidMl, 'ml', { kind: 'liquid' }));
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

// Totals per item across meals; "times" counts meals containing it. Weights add up in grams, volumes in ml
// (L converted), counts and spoons per unit.
export function totals(meals) {
  const map = new Map();
  for (const m of meals) {
    const seen = new Set();
    for (const i of mealItems(m)) {
      if (i.amount == null) continue;
      const key = i.name.trim().toLowerCase();
      const t = map.get(key) || { name: i.name.trim(), grams: 0, raw: 0, cooked: 0, other: {}, times: 0 };
      if (i.grams != null) {
        t.grams += i.grams;
        if (i.state === 'raw') t.raw += i.grams; else if (i.state === 'cooked') t.cooked += i.grams;
      } else {
        const [amt, u] = i.unit === 'L' ? [i.amount * 1000, 'ml'] : [i.amount, i.unit];
        t.other[u] = (t.other[u] || 0) + amt;
      }
      if (!seen.has(key)) { t.times++; seen.add(key); }
      map.set(key, t);
    }
  }
  const size = (t) => t.grams + Object.keys(t.other).length * 1e-3;
  return [...map.values()].sort((a, b) => size(b) - size(a) || a.name.localeCompare(b.name));
}

export function toText(meals, start, end) {
  const L = [];
  const list = sortMeals(meals);
  const days = [...new Set(list.map((m) => m.date))];
  L.push(`FOOD LOG ${start} to ${end}`);
  L.push(`${list.length} meal${list.length === 1 ? '' : 's'} on ${days.length} day${days.length === 1 ? '' : 's'}. Amounts are as weighed or counted (g, pc, ml...); "ate" is how much of the dish I ate.`);
  for (const d of days) {
    L.push('', `${d} (${wk(d)})`);
    for (const m of list.filter((x) => x.date === d)) {
      L.push('', `${cap(m.tag)}${m.time ? ' ' + m.time : ''}: ${m.dish}`);
      const how = [methodLabel(m.method), m.cookware, m.heat && `${m.heat} heat`, m.tempC != null && `${fmt(m.tempC)}°C`, m.minutes != null && `${fmt(m.minutes)} min`].filter(Boolean).join(', ');
      if (how) L.push(`  Method: ${how}`);
      const fats = [m.oilG != null && `${m.oilType ? m.oilType + ' oil' : 'oil'} ${fmt(m.oilG)} g`, m.fatG != null && `${m.fatName || 'other fat'} ${fmt(m.fatG)} g`].filter(Boolean).join(', ');
      if (fats) L.push(`  Fat: ${fats}`);
      L.push('  Ingredients:');
      for (const i of m.ingredients || []) L.push(`    - ${i.name}${i.brand ? ` (${i.brand})` : ''} ${amountText(i)} ${i.state || 'raw'}`);
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
    L.push('', 'TOTALS PER INGREDIENT (amount, times eaten)');
    for (const x of t) {
      const split = x.raw && x.cooked ? ` [raw ${fmt(x.raw)}, cooked ${fmt(x.cooked)}]` : '';
      const amounts = [x.grams ? `${fmt(x.grams)} g` : '', ...Object.entries(x.other).map(([u, v]) => `${fmt(v)} ${u}`)].filter(Boolean).join(' + ');
      L.push(`- ${x.name}: ${amounts}, ${x.times}x${split}`);
    }
  }
  return L.join('\n');
}
