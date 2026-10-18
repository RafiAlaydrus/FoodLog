import { h, amountText, pageHead, emptyState } from './ui.js';
import { allTemplates, deleteTemplate } from './db.js';
import { toast } from './app.js';

// Full-screen sheet listing saved dishes. onUse(template) is called when one is tapped.
export async function openDishes(onUse) {
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Saved dishes' });
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => close() });
  const close = () => {
    sheet.classList.remove('in'); backdrop.classList.remove('in');
    setTimeout(() => { sheet.remove(); backdrop.remove(); }, 320);
  };

  async function fill() {
    const list = (await allTemplates()).sort((a, b) => a.name.localeCompare(b.name));
    sheet.replaceChildren(
      h('div', { class: 'sheet-bar' }, pageHead('Saved dishes', 'Tap one to log it'), h('button', { class: 'btn soft', onclick: close }, 'Done')),
      list.length
        ? h('div', {}, list.map((t) => h('div', { class: 'card dish-row' },
            h('button', { class: 'dish-use', onclick: () => { close(); onUse(t); } },
              h('div', { class: 'meal-dish' }, t.name),
              h('div', { class: 'meal-sub' }, (t.ingredients || []).map((i) => `${i.name} ${amountText(i)}`).join(', '))),
            h('button', { class: 'x', 'aria-label': 'Delete saved dish', onclick: async () => {
              if (!confirm(`Remove "${t.name}" from saved dishes?`)) return;
              await deleteTemplate(t.id); toast('Removed'); fill();
            } }, '×'))))
        : emptyState('No saved dishes yet', 'Fill in a meal on the Log screen and tap “Save as dish” to reuse it in one tap.'));
  }
  await fill();
  document.body.append(backdrop, sheet);
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.classList.add('in'); backdrop.classList.add('in'); }));
}
