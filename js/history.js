import { h, fmt, dayLabel, mealGrams, amountText, pageHead, emptyState } from './ui.js';
import { allMeals, deleteMeal, saveMeal } from './db.js';
import { toast, show } from './app.js';
import { methodLabel } from './log.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const REVEAL = 88;

export async function render(root) {
  const meals = (await allMeals()).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  root.replaceChildren(pageHead('History', meals.length ? `${meals.length} meal${meals.length === 1 ? '' : 's'} logged` : 'Your kitchen diary'));

  if (!meals.length) {
    root.append(emptyState('No meals yet', 'Meals you log will show up here, grouped by day.',
      h('button', { class: 'btn primary', onclick: () => show('log') }, 'Log your first meal')));
    return;
  }

  const days = new Map();
  for (const m of meals) (days.get(m.date) || days.set(m.date, []).get(m.date)).push(m);

  for (const [date, list] of days) {
    const total = list.reduce((s, m) => s + mealGrams(m), 0);
    root.append(h('div', { class: 'day-head' },
      h('span', {}, dayLabel(date), h('small', {}, `${list.length} meal${list.length === 1 ? '' : 's'}`)),
      h('span', { class: 'sum' }, `${fmt(total)} g`)));
    for (const m of list) root.append(mealCard(m, root));
  }
}

function mealCard(m, root) {
    const sub = [methodLabel(m.method), m.minutes != null ? `${fmt(m.minutes)} min` : '', m.tempC != null ? `${fmt(m.tempC)}°C` : '', cap(m.heat)].filter(Boolean).join(' · ');
  const fats = [m.oilG != null && `${m.oilType || 'Oil'} ${fmt(m.oilG)} g`, m.fatG != null && `${m.fatName || 'Fat'} ${fmt(m.fatG)} g`].filter(Boolean).join(' · ');

  const card = h('div', { class: `card meal tag-${m.tag || 'none'}`, onclick: () => {
    if (card._moved) return;
    if (wrap.classList.contains('open')) { wrap.classList.remove('open'); card.style.transition = 'transform 160ms ease'; card.style.transform = ''; return; }
    show('log', { edit: m });
  } },
    h('div', { class: 'meal-top' }, h('span', { class: 'meta' }, m.time, ' ', h('span', { class: 'pill' }, cap(m.tag))), h('span', { class: 'sum' }, `${fmt(mealGrams(m))} g`)),
    h('div', { class: 'meal-dish' }, m.dish),
    sub && h('div', { class: 'meal-sub' }, sub),
    h('div', { class: 'ing-list' }, (m.ingredients || []).map((i) =>
      h('div', { class: 'ing-line' }, h('span', {}, i.name + (i.brand ? ` (${i.brand})` : '')), h('span', { class: 'g' }, `${amountText(i)}${i.state === 'cooked' ? ' cooked' : ''}`)))),
    fats && h('div', { class: 'meal-sub' }, fats));

  const del = h('button', { class: 'swipe-del', 'aria-label': 'Delete meal', onclick: async () => {
    await deleteMeal(m.id);
    wrap.style.height = wrap.offsetHeight + 'px';
    void wrap.offsetHeight;
    wrap.classList.add('removing');
    toast('Meal deleted', { action: { label: 'Undo', fn: async () => { await saveMeal(m); await render(root); } } });
    setTimeout(() => render(root), 190);
  } }, 'Delete');
  const wrap = h('div', { class: 'swipe' }, del, card);
  attachSwipe(wrap, card);
  return wrap;
}

// Swipe left to reveal Delete; swipe right or tap elsewhere to close.
function attachSwipe(wrap, card) {
  let x0 = 0, y0 = 0, dx = 0, dragging = false, decided = false, base = 0;
  const setX = (x, anim) => { card.style.transition = anim ? 'transform 160ms ease' : 'none'; card.style.transform = `translateX(${x}px)`; };
  wrap.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; dragging = false; decided = false; card._moved = false;
    base = wrap.classList.contains('open') ? -REVEAL : 0;
    document.querySelectorAll('.swipe.open').forEach((s) => { if (s !== wrap) { s.classList.remove('open'); s.firstChild.nextSibling.style.transform = ''; } });
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; const mx = t.clientX - x0, my = t.clientY - y0;
    if (!decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) { decided = true; dragging = Math.abs(mx) > Math.abs(my); }
    if (!dragging) return;
    card._moved = true; dx = mx; wrap.classList.add('dragging');
    setX(Math.max(-REVEAL - 20, Math.min(0, base + dx)));
  }, { passive: true });
  wrap.addEventListener('touchend', () => {
    if (!dragging) return;
    const open = base + dx < -REVEAL / 2;
    wrap.classList.toggle('open', open);
    setX(open ? -REVEAL : 0, true);
    setTimeout(() => { card._moved = false; if (!open) wrap.classList.remove('dragging'); }, 180);
  });
}
