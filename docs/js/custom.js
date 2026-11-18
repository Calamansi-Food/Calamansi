// Your choices for how Calamansi looks and behaves — synced with your state (settings.custom), unlike the per-device interface.
// Pure: defaults, sanitising and small getters. Settings › Customise edits it.
export const TABS = [['today', 'Today'], ['home', 'Home'], ['kitchen', 'Kitchen'], ['shop', 'Shop'], ['car', 'Car'], ['life', 'Life']];
export const SECTIONS = [['day', 'Your day'], ['meals', 'Meals today'], ['chores', 'Chores'], ['fridge', 'Use it up'], ['shop', 'Shopping'], ['life', 'Bills and the car'], ['actions', 'Quick actions']];
export const ACCENTS = [['calamansi', 'Calamansi', '#9fd94a'], ['leaf', 'Leaf', '#4cc27a'], ['pulp', 'Pulp', '#f6b93b'], ['mint', 'Mint', '#4fd6b0'], ['clementine', 'Clementine', '#ff6a3d'], ['sky', 'Sky', '#4fb4ff']];
export const MACHINE_IDS = ['airfryer', 'oven', 'microwave', 'stove'];
export const DEFAULTS = {
  start: 'today',
  tabs: { hidden: [], order: TABS.map(t => t[0]) },
  day: { wake: 8 * 60, late: 23 * 60 },
  kitchen: { machines: ['airfryer', 'oven', 'microwave'], staples: false, toPantry: true, take: true, days: 7 },
  diet: { kcal: 0, protein: 0 },
  today: { sections: { order: [], hidden: [] } },
  look: { accent: 'calamansi', shape: 'bubbly', density: 'comfy', fun: true },
};
const arr = (v, ok) => Array.isArray(v) ? [...new Set(v.filter(x => ok.includes(x)))] : [];
const num = (v, lo, hi, d) => Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.max(lo, Math.min(hi, Math.round(+v))) : d;
const ids = (l) => l.map(x => Array.isArray(x) ? x[0] : x);
/** Clean, complete settings — never trust what came from storage or another device. */
export function custom(s) {
  const c = s?.settings?.custom || {}, t = c.tabs || {};
  const order = [...arr(t.order, ids(TABS)), ...ids(TABS).filter(x => !(t.order || []).includes(x))];
  const hidden = arr(t.hidden, ids(TABS)).filter(x => x !== 'today');
  const dy = c.day || {}, k = c.kitchen || {}, dt = c.diet || {}, so = arr(c.today?.sections?.order, ids(SECTIONS)), l = c.look || {};
  const out = {
    start: ids(TABS).includes(c.start) && !hidden.includes(c.start) ? c.start : 'today',
    tabs: { hidden, order },
    day: { wake: num(dy.wake, 4 * 60, 14 * 60, 480), late: num(dy.late, 18 * 60, 26 * 60, 1380) },
    kitchen: { machines: Array.isArray(k.machines) ? arr(k.machines, MACHINE_IDS) : DEFAULTS.kitchen.machines, staples: !!k.staples, toPantry: k.toPantry !== false, take: k.take !== false, days: [3, 5, 7, 10, 14].includes(+k.days) ? +k.days : 7 },
    diet: { kcal: num(dt.kcal, 0, 6000, 0), protein: num(dt.protein, 0, 400, 0) },
    today: { sections: { order: [...so, ...ids(SECTIONS).filter(x => !so.includes(x))], hidden: arr(c.today?.sections?.hidden, ids(SECTIONS)) } },
    look: { accent: ids(ACCENTS).includes(l.accent) ? l.accent : 'calamansi', shape: ['bubbly', 'classic'].includes(l.shape) ? l.shape : 'bubbly', density: ['comfy', 'compact'].includes(l.density) ? l.density : 'comfy', fun: l.fun !== false },
  };
  if (out.day.late - out.day.wake < 4 * 60) out.day.late = Math.min(26 * 60, out.day.wake + 4 * 60);
  return out;
}
/** Change one part: returns the new state (patch is merged one level deep). */
export function setCustom(s, part, patch) { const cur = custom(s); return { ...s, settings: { ...s.settings, custom: { ...cur, [part]: typeof patch === 'object' && !Array.isArray(patch) ? { ...cur[part], ...patch } : patch } } }; }
export const toggleIn = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
export function move(list, id, dir) { const i = list.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return list; const l = [...list]; [l[i], l[j]] = [l[j], l[i]]; return l; }
export const visibleTabs = (s) => { const c = custom(s); return c.tabs.order.filter(t => !c.tabs.hidden.includes(t)); };
