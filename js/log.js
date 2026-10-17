import { h, ymd, hm, num, fmt, mealTagFor, datalist } from './ui.js';
import { saveMeal, deleteMeal, suggestions } from './db.js';
import { toast, show } from './app.js';

export const METHODS = [
  ['pan-fry', 'Stove pan-fry'], ['deep-fry', 'Deep fry'], ['boil', 'Boil'], ['steam', 'Steam'],
  ['air-fryer', 'Air fryer'], ['oven', 'Oven bake'], ['grill', 'Grill'], ['microwave', 'Microwave'], ['none', 'No cook']
];
export const methodLabel = (k) => (METHODS.find((m) => m[0] === k) || [, k || ''])[1];
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

  const f = h('form', { class: 'logform', novalidate: true });
  root.append(
    h('h1', { class: 'title' }, ctx.editing ? 'Edit meal' : 'Log'),
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
  const addIng = (v = {}) => ingList.append(ingredientRow(v, ingList));
  const ingCard = h('div', { class: 'card' },
    ingList,
    h('button', { type: 'button', class: 'btn soft block', onclick: () => { addIng(); ingList.lastChild.querySelector('[name=iname]').focus(); } }, '+ Add ingredient'));

  // --- Cooking details
  const method = segmented(METHODS, { optional: true });
  method.el.classList.add('chips');
  const heat = segmented([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], { optional: true });
  const ate = segmented([['g', 'g'], ['%', '%']]);
  ate.set('g');
  const seaList = h('div', { class: 'rows' });
  const addSea = (v = {}) => seaList.append(seasoningRow(v, seaList));

  const details = h('details', { class: 'card details' },
    h('summary', {}, h('span', {}, 'Cooking details'), h('span', { class: 'chev' }, '›')),
    h('div', { class: 'detail-body' },
      h('div', { class: 'lbl' }, 'Method'), method.el,
      h('div', { class: 'row2' }, field('Cookware', input('cookware', { list: 'dl-cookware', placeholder: 'Pan, wok, pot…', autocapitalize: 'sentences' })),
        field('Time', dec('minutes', '0', 'min'))),
      h('div', { class: 'lbl' }, 'Heat'), heat.el,
      field('or temperature', dec('tempC', '180', '°C')),
      h('div', { class: 'row2' }, field('Oil type', input('oilType', { list: 'dl-oils', placeholder: 'Olive, canola…', autocapitalize: 'sentences' })), field('Oil', dec('oilG', '0', 'g'))),
      h('div', { class: 'row2' }, field('Other fat', input('fatName', { placeholder: 'Butter, ghee…', autocapitalize: 'sentences' })), field('Fat', dec('fatG', '0', 'g'))),
      h('div', { class: 'lbl' }, 'Seasonings and sauces'), seaList,
      h('button', { type: 'button', class: 'btn soft block', onclick: () => { addSea(); seaList.lastChild.querySelector('[name=sname]').focus(); } }, '+ Add seasoning'),
      h('div', { class: 'row2' }, field('Water / liquid added', dec('liquidMl', '0', 'ml')), field('Total cooked weight', dec('cookedG', '0', 'g'))),
      h('div', { class: 'lbl' }, 'How much I ate'),
      h('div', { class: 'row-ate' }, dec('ateVal', '0'), ate.el),
      field('Notes', h('textarea', { name: 'notes', rows: 2, placeholder: 'Anything worth remembering' }))));

  const saveBtn = h('button', { type: 'submit', class: 'btn primary block big' }, ctx.editing ? 'Save changes' : 'Save meal');
  const actions = h('div', { class: 'actions' }, saveBtn,
    ctx.editing && h('button', { type: 'button', class: 'btn plain block', onclick: () => show('history') }, 'Cancel'),
    ctx.editing && h('button', { type: 'button', class: 'btn danger block', onclick: async () => {
      if (!confirm('Delete this meal?')) return;
      await deleteMeal(ctx.editing.id); toast('Meal deleted'); show('history');
    } }, 'Delete meal'));
  f.append(basics, h('h2', { class: 'section' }, 'Ingredients'), ingCard, details, actions);
  f.addEventListener('submit', (e) => { e.preventDefault(); save(); });

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
  } else {
    tag.set(mealTagFor());
    addIng(); addIng();
  }
  if (!ingList.children.length) addIng();

  function collect() {
    const v = (n) => f[n].value.trim();
    const ingredients = [...ingList.children].map((r) => ({
      name: r.querySelector('[name=iname]').value.trim(),
      grams: num(r.querySelector('[name=igrams]').value),
      state: r.querySelector('.seg .on')?.dataset.k || 'raw',
      brand: r.querySelector('[name=ibrand]').value.trim()
    })).filter((i) => i.name || i.grams != null);
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

  async function save() {
    const m = collect();
    if (!m.dish) return fail('Add a dish name', f.dish);
    if (!m.ingredients.length) return fail('Add at least one ingredient');
    const bad = m.ingredients.find((i) => !i.name || i.grams == null);
    if (bad) return fail(bad.name ? `Add grams for ${bad.name}` : 'An ingredient is missing its name');
    if (ctx.editing) Object.assign(m, { id: ctx.editing.id, createdAt: ctx.editing.createdAt });
    await saveMeal(m);
    toast(ctx.editing ? 'Changes saved' : 'Meal saved');
    if (ctx.editing) await show('history'); else await render(root);
    if (!ctx.editing) window.scrollTo(0, 0);
  }
  function fail(msg, el) { toast(msg); el && el.focus(); }

  // Exposed for the saved-dishes feature (step 4) and tests.
  root._collect = collect;
}

const hasDetails = (m) => m.method || m.cookware || m.heat || m.tempC != null || m.minutes != null || m.oilG != null ||
  m.fatG != null || (m.seasonings || []).length || m.liquidMl != null || m.cookedG != null || m.ate || m.notes;

function ingredientRow(v, list) {
  const state = segmented([['raw', 'Raw'], ['cooked', 'Cooked']]);
  state.set(v.state || 'raw');
  state.el.classList.add('small');
  const row = h('div', { class: 'ing' },
    h('div', { class: 'ing-top' },
      input('iname', { placeholder: 'Ingredient', list: 'dl-ings', value: v.name || '', autocapitalize: 'sentences', 'aria-label': 'Ingredient name' }),
      h('div', { class: 'with-unit g' }, input('igrams', { inputmode: 'decimal', placeholder: '0', value: fmt(v.grams), 'aria-label': 'Grams' }), h('span', { class: 'unit' }, 'g')),
      h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ingredient', onclick: () => { row.remove(); } }, '×')),
    h('div', { class: 'ing-sub' }, state.el, input('ibrand', { placeholder: 'Brand (optional)', value: v.brand || '', autocapitalize: 'sentences', 'aria-label': 'Brand' })));
  return row;
}

function seasoningRow(v, list) {
  const unit = h('select', { name: 'sunit', 'aria-label': 'Unit' }, ['g', 'tsp', 'tbsp'].map((u) => h('option', { value: u }, u)));
  unit.value = v.unit || 'g';
  const row = h('div', { class: 'sea' },
    input('sname', { placeholder: 'Salt, soy sauce…', list: 'dl-ings', value: v.name || '', autocapitalize: 'sentences', 'aria-label': 'Seasoning name' }),
    input('samount', { inputmode: 'decimal', placeholder: '0', value: fmt(v.amount), 'aria-label': 'Amount' }),
    unit,
    h('button', { type: 'button', class: 'x', 'aria-label': 'Remove seasoning', onclick: () => row.remove() }, '×'));
  return row;
}
