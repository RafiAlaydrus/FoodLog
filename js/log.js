import { h, ymd, hm, num, fmt, mealTagFor, datalist, METHODS, methodLabel, UNITS, SEASONING_UNITS, toGrams, ingAmount } from './ui.js';
import { saveMeal, deleteMeal, suggestions, allTemplates, saveTemplate } from './db.js';
import { openDishes } from './dishes.js';
import { toast, show } from './app.js';

export { METHODS, methodLabel };
const TAGS = ['breakfast', 'lunch', 'dinner', 'snack'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

let ctx = { editing: null };   // meal being edited, if any

// Segmented control; value() returns the selected key or '' (tap again to clear when optional).
function segmented(options, { optional = false, onchange } = {}) {
  let val = '';
  const wrap = h('div', { class: 'seg', role: 'group' });
  const btns = options.map(([k, label]) => h('button', { type: 'button', 'data-k': k, onclick: () => set(optional && val === k ? '' : k) }, label));
  wrap.append(...btns);
  function set(k) { val = k; btns.forEach((b) => b.classList.toggle('on', b.dataset.k === k)); onchange && onchange(k); }
  return { el: wrap, get: () => val, set };
}

const field = (label, ...ctl) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), ...ctl);
const input = (name, attrs = {}) => h('input', { name, autocomplete: 'off', autocapitalize: 'none', ...attrs });
const dec = (name, ph, unit) => h('div', { class: 'with-unit' }, input(name, { inputmode: 'decimal', placeholder: ph || '' }), unit && h('span', { class: 'unit' }, unit));

export async function render(root, opts = {}) {
  ctx.editing = opts.edit || null;
  const sug = await suggestions();
  root.replaceChildren();

  const f = h('form', { class: 'logform', novalidate: true, 'data-editing': ctx.editing ? '1' : null });
  const useDish = (t) => render(root, { prefill: t });
  const dishes = ctx.editing ? null : await dishStrip(useDish);
  root.append(
    h('h1', { class: 'title' }, ctx.editing ? 'Edit meal' : 'Log'),
    dishes,
    f,
    datalist('dl-dishes', sug.dishes), datalist('dl-ings', sug.ingredients),
    datalist('dl-cookware', sug.cookware), datalist('dl-oils', sug.oils)
  );

  // --- Basics
  const tag = segmented(TAGS.map((t) => [t, cap(t)]));
  const dish = input('dish', { placeholder: 'What did you cook?', list: 'dl-dishes', class: 'big', enterkeyhint: 'next', autocapitalize: 'sentences' });
  const basics = h('div', { class: 'card' },
    h('div', { class: 'row2' },
      field('Date', input('date', { type: 'date', value: ymd() })),
      field('Time', input('time', { type: 'time', value: hm() }))),
    tag.el,
    field('Dish', dish));

  // --- Ingredients
  const ingList = h('div', { class: 'rows' });
  const addIng = (v = {}, animate = false) => { const r = ingredientRow(v, sug.units); if (animate) r.classList.add('new'); ingList.append(r); return r; };
  const ingCard = h('div', { class: 'card' },
    ingList,
    h('button', { type: 'button', class: 'btn soft block', onclick: () => addIng({}, true).querySelector('[name=iname]').focus() }, '+ Add ingredient'));

  // --- Cooking details
  const method = segmented(METHODS, { optional: true });
  method.el.classList.add('chips');
  const heat = segmented([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], { optional: true });
  const ate = segmented([['g', 'g'], ['%', '%']]);
  ate.set('g');
  const seaList = h('div', { class: 'rows' });
  const addSea = (v = {}, animate = false) => { const r = seasoningRow(v, sug.units); if (animate) r.classList.add('new'); seaList.append(r); return r; };

  const details = h('details', { class: 'card details' },
    h('summary', {}, h('span', { class: 'sum-text' }, h('span', {}, 'Cooking details'), h('small', { class: 'recap' })), h('span', { class: 'chev' }, '›')),
    h('div', { class: 'detail-body' },
      h('div', { class: 'lbl' }, 'Method'), method.el,
      h('div', { class: 'row2' }, field('Cookware', input('cookware', { list: 'dl-cookware', placeholder: 'Pan, wok, pot…', autocapitalize: 'sentences' })),
        field('Time', dec('minutes', '0', 'min'))),
      h('div', { class: 'lbl' }, 'Heat'), heat.el,
      field('or temperature', dec('tempC', '180', '°C')),
      h('div', { class: 'row2' }, field('Oil type', input('oilType', { list: 'dl-oils', placeholder: 'Olive, canola…', autocapitalize: 'sentences' })), field('Oil', dec('oilG', '0', 'g'))),
      h('div', { class: 'row2' }, field('Other fat', input('fatName', { placeholder: 'Butter, ghee…', autocapitalize: 'sentences' })), field('Fat', dec('fatG', '0', 'g'))),
      h('div', { class: 'lbl' }, 'Seasonings and sauces'), seaList,
      h('button', { type: 'button', class: 'btn soft block', onclick: () => addSea({}, true).querySelector('[name=sname]').focus() }, '+ Add seasoning'),
      h('div', { class: 'row2' }, field('Water / liquid added', dec('liquidMl', '0', 'ml')), field('Total cooked weight', dec('cookedG', '0', 'g'))),
      h('div', { class: 'lbl' }, 'How much I ate'),
      h('div', { class: 'row-ate' }, dec('ateVal', '0'), ate.el),
      field('Notes', h('textarea', { name: 'notes', rows: 2, placeholder: 'Anything worth remembering' }))));

  const saveBtn = h('button', { type: 'submit', class: 'btn primary block big' }, ctx.editing ? 'Save changes' : 'Save meal');
  const actions = h('div', { class: 'actions' }, saveBtn,
    h('button', { type: 'button', class: 'btn soft block', onclick: saveDish }, '⭐ Save as dish'),
    ctx.editing && h('button', { type: 'button', class: 'btn plain block', onclick: () => show('history') }, 'Cancel'),
    ctx.editing && h('button', { type: 'button', class: 'btn danger block', onclick: async () => {
      if (!confirm('Delete this meal?')) return;
      await deleteMeal(ctx.editing.id); toast('Meal deleted'); show('history');
    } }, 'Delete meal'));
  f.append(basics, h('h2', { class: 'section' }, 'Ingredients'), ingCard, details, actions);
  f.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  // Return moves along the form instead of submitting: name -> grams -> next row (new row after the last).
  f.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== 'Enter' || t.tagName !== 'INPUT') return;
    e.preventDefault();
    const row = t.closest('.ing');
    if (t.name === 'dish') return (ingList.querySelector('[name=iname]') || t).focus();
    if (row && t.name === 'iname') return row.querySelector('[name=iamount]').focus();
    if (row && t.name === 'iamount') {
      const next = row.nextElementSibling || addIng({}, true);
      return next.querySelector('[name=iname]').focus();
    }
    t.blur();
  });

  // Pre-fill (edit, template, or blank)
  const src = ctx.editing || opts.prefill;
  if (src) {
    f.date.value = ctx.editing ? src.date : ymd();
    f.time.value = ctx.editing ? src.time : hm();
    tag.set(ctx.editing ? src.tag : mealTagFor());
    dish.value = src.dish || src.name || '';
    (src.ingredients || []).forEach(addIng);
    method.set(src.method || '');
    heat.set(src.heat || '');
    for (const k of ['cookware', 'oilType', 'fatName', 'notes']) f[k].value = src[k] || '';
    for (const k of ['minutes', 'tempC', 'oilG', 'fatG', 'liquidMl', 'cookedG']) f[k].value = fmt(src[k]);
    (src.seasonings || []).forEach(addSea);
    if (src.ate) { f.ateVal.value = fmt(src.ate.value); ate.set(src.ate.unit || 'g'); }
    // Template reuse: cooking details start closed; the user only edits what changed.
    details.open = !!ctx.editing && hasDetails(src);
    details.querySelector('.recap').textContent = detailSummary(src);
  } else {
    tag.set(mealTagFor());
    addIng(); addIng();
  }
  if (!ingList.children.length) addIng();

  function collect() {
    const v = (n) => f[n].value.trim();
    const ingredients = [...ingList.children].map((r) => ({
      name: r.querySelector('[name=iname]').value.trim(),
      amount: num(r.querySelector('[name=iamount]').value),
      unit: r.querySelector('[name=iunit]').value,
      state: r.querySelector('.seg .on')?.dataset.k || 'raw',
      brand: r.querySelector('[name=ibrand]').value.trim()
    })).filter((i) => i.name || i.amount != null).map((i) => ({ ...i, grams: toGrams(i.amount, i.unit) }));
    const seasonings = [...seaList.children].map((r) => ({
      name: r.querySelector('[name=sname]').value.trim(),
      amount: num(r.querySelector('[name=samount]').value),
      unit: r.querySelector('[name=sunit]').value
    })).filter((s) => s.name || s.amount != null);
    return {
      date: v('date') || ymd(), time: v('time'), tag: tag.get(), dish: v('dish'),
      method: method.get(), cookware: v('cookware'), heat: heat.get(), tempC: num(v('tempC')),
      minutes: num(v('minutes')), oilType: v('oilType'), oilG: num(v('oilG')),
      fatName: v('fatName'), fatG: num(v('fatG')), seasonings, liquidMl: num(v('liquidMl')),
      cookedG: num(v('cookedG')), ate: num(v('ateVal')) != null ? { value: num(v('ateVal')), unit: ate.get() } : null,
      notes: v('notes'), ingredients
    };
  }

  function validated() {
    const m = collect();
    if (!m.dish) return fail('Add a dish name', f.dish);
    if (!m.ingredients.length) return fail('Add at least one ingredient');
    const bad = m.ingredients.find((i) => !i.name || i.amount == null);
    if (bad) return fail(bad.name ? `Add an amount for ${bad.name}` : 'An ingredient is missing its name');
    return m;
  }

  async function save() {
    const m = validated();
    if (!m) return;
    if (ctx.editing) Object.assign(m, { id: ctx.editing.id, createdAt: ctx.editing.createdAt });
    await saveMeal(m);
    toast(ctx.editing ? 'Changes saved' : 'Meal saved', { ok: true });
    if (ctx.editing) await show('history'); else await render(root);
    if (!ctx.editing) window.scrollTo(0, 0);
  }
  function fail(msg, el) { toast(msg); el && el.focus(); }

  async function saveDish() {
    const m = validated();
    if (!m) return;
    const { date, time, tag: _t, ...body } = m;
    const same = (await allTemplates()).find((t) => t.name.toLowerCase() === m.dish.toLowerCase());
    if (same && !confirm(`Replace the saved dish "${same.name}"?`)) return;
    await saveTemplate({ ...body, name: m.dish, id: same?.id });
    toast('Saved as dish', { ok: true });
    const strip = root.querySelector('.dish-strip');
    if (strip) strip.replaceWith(await dishStrip(useDish));
  }

  // Exposed for the saved-dishes feature (step 4) and tests.
  root._collect = collect;
}

async function dishStrip(onUse) {
  const list = (await allTemplates()).sort((a, b) => a.name.localeCompare(b.name));
  return h('div', { class: 'dish-strip' },
    h('div', { class: 'strip-head' }, h('span', { class: 'lbl' }, 'Saved dishes'),
      h('button', { type: 'button', class: 'link', onclick: () => openDishes(onUse) }, list.length ? 'Manage' : 'How it works')),
    list.length
      ? h('div', { class: 'strip' }, list.map((t) => h('button', { type: 'button', class: 'chip', onclick: () => onUse(t) }, t.name)))
      : h('p', { class: 'hint' }, 'Save a meal as a dish to log it again in one tap.'));
}

// One-line recap of the cooking details, shown on the collapsed section header.
function detailSummary(m) {
  return [methodLabel(m.method), m.minutes != null && `${fmt(m.minutes)} min`, m.tempC != null && `${fmt(m.tempC)}°C`,
    m.oilG != null && `${m.oilType || 'oil'} ${fmt(m.oilG)} g`].filter(Boolean).join(' · ');
}

function removeRow(row) {
  row.classList.add('out');
  setTimeout(() => row.remove(), 170);
}

const hasDetails = (m) => m.method || m.cookware || m.heat || m.tempC != null || m.minutes != null || m.oilG != null ||
  m.fatG != null || (m.seasonings || []).length || m.liquidMl != null || m.cookedG != null || m.ate || m.notes;

// Picks the unit last used with this name (e.g. egg -> pc), unless the user already chose one or typed an amount.
function autoUnit(nameEl, amountEl, unitEl, units, touched) {
  nameEl.addEventListener('change', () => {
    const u = units[nameEl.value.trim().toLowerCase()];
    if (u && !touched() && amountEl.value === '') unitEl.value = u;
  });
}

function ingredientRow(v, units = {}) {
  const state = segmented([['raw', 'Raw'], ['cooked', 'Cooked']]);
  state.set(v.state || 'raw');
  state.el.classList.add('small');
  const a = ingAmount(v);
  const unit = h('select', { name: 'iunit', 'aria-label': 'Unit' }, UNITS.map((u) => h('option', { value: u }, u)));
  unit.value = a.unit;
  let touched = !!v.unit || !!v.grams;
  unit.addEventListener('change', () => { touched = true; });
  const name = input('iname', { placeholder: 'Ingredient', list: 'dl-ings', value: v.name || '', autocapitalize: 'sentences', 'aria-label': 'Ingredient name' });
  const amount = input('iamount', { inputmode: 'decimal', placeholder: '0', value: fmt(a.amount), 'aria-label': 'Amount' });
  autoUnit(name, amount, unit, units, () => touched);
  const row = h('div', { class: 'ing' },
    h('div', { class: 'ing-top' }, name, h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ingredient', onclick: () => removeRow(row) }, '×')),
    h('div', { class: 'ing-amt' }, amount, unit, state.el),
    input('ibrand', { placeholder: 'Brand (optional)', value: v.brand || '', autocapitalize: 'sentences', 'aria-label': 'Brand', class: 'brand' }));
  return row;
}

function seasoningRow(v, units = {}) {
  const unit = h('select', { name: 'sunit', 'aria-label': 'Unit' }, SEASONING_UNITS.map((u) => h('option', { value: u }, u)));
  unit.value = v.unit || 'g';
  let touched = !!v.unit;
  unit.addEventListener('change', () => { touched = true; });
  const name = input('sname', { placeholder: 'Salt, soy sauce…', list: 'dl-ings', value: v.name || '', autocapitalize: 'sentences', 'aria-label': 'Seasoning name' });
  const amount = input('samount', { inputmode: 'decimal', placeholder: '0', value: fmt(v.amount), 'aria-label': 'Amount' });
  autoUnit(name, amount, unit, units, () => touched);
  const row = h('div', { class: 'sea' }, name, amount, unit,
    h('button', { type: 'button', class: 'x', 'aria-label': 'Remove seasoning', onclick: () => removeRow(row) }, '×'));
  return row;
}
