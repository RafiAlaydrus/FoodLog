// IndexedDB layer. Stores: meals (indexed by date) and templates (saved dishes).
const DB_NAME = 'foodlog';
const DB_VERSION = 1;
let dbPromise;

function open() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('meals', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('templates', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export async function saveMeal(meal) {
  meal.id ||= uid();
  meal.updatedAt = Date.now();
  meal.createdAt ||= meal.updatedAt;
  await wrap((await store('meals', 'readwrite')).put(meal));
  return meal;
}
export async function getMeal(id) { return wrap((await store('meals')).get(id)); }
export async function deleteMeal(id) { return wrap((await store('meals', 'readwrite')).delete(id)); }
export async function allMeals() { return wrap((await store('meals')).getAll()); }

// Inclusive date range, dates as YYYY-MM-DD strings.
export async function mealsInRange(start, end) {
  const s = await store('meals');
  return wrap(s.index('date').getAll(IDBKeyRange.bound(start, end)));
}

export async function saveTemplate(t) {
  t.id ||= uid();
  t.createdAt ||= Date.now();
  await wrap((await store('templates', 'readwrite')).put(t));
  return t;
}
export async function allTemplates() { return wrap((await store('templates')).getAll()); }
export async function deleteTemplate(id) { return wrap((await store('templates', 'readwrite')).delete(id)); }

// Names used before, most frequent first, for autocomplete.
export async function suggestions() {
  const [meals, templates] = await Promise.all([allMeals(), allTemplates()]);
  const count = (map, name) => { name = (name || '').trim(); if (name) map.set(name, (map.get(name) || 0) + 1); };
  const dishes = new Map(), ings = new Map(), cookware = new Map(), oils = new Map();
  for (const m of [...meals, ...templates]) {
    count(dishes, m.dish || m.name);
    count(cookware, m.cookware);
    count(oils, m.oilType);
    (m.ingredients || []).forEach((i) => count(ings, i.name));
    (m.seasonings || []).forEach((s) => count(ings, s.name));
  }
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return { dishes: top(dishes), ingredients: top(ings), cookware: top(cookware), oils: top(oils) };
}

export async function exportAll() {
  const [meals, templates] = await Promise.all([allMeals(), allTemplates()]);
  return { app: 'foodlog', version: 1, exportedAt: new Date().toISOString(), meals, templates };
}

export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'foodlog' || !Array.isArray(data.meals)) throw new Error('Not a Food Log backup file');
  const db = await open();
  const tx = db.transaction(['meals', 'templates'], 'readwrite');
  const m = tx.objectStore('meals'), t = tx.objectStore('templates');
  if (replace) { m.clear(); t.clear(); }
  data.meals.forEach((x) => m.put(x));
  (data.templates || []).forEach((x) => t.put(x));
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  return { meals: data.meals.length, templates: (data.templates || []).length };
}

export async function requestPersistence() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; }
  catch { return false; }
}
