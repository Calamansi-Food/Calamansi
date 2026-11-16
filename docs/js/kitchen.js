// Kitchen: recipes with per-machine times, the meal planner around your shifts, the fridge and the shopping list. Pure (no DOM).
// The planner never writes on its own: it proposes, you tap "Use this plan" (and can Undo). Diet goals are simple settings here
// for now (Citrus Plan owns goals; they may come from there later).
import { keyOf, fromKey, addDays, startOfDay, uid } from './util.js';
import { dayKind, KIND_LABEL } from './day.js';
import { MORE, SAFE } from './recipes-data.js';
export { SAFE };

const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const rec = (o) => Object.values(o || {});
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(',', '.'); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

// ───────────────────────── machines
export const MACHINES = [['airfryer', 'Air fryer', '🌪️'], ['oven', 'Oven', '🔥'], ['microwave', 'Microwave', '⚡'], ['stove', 'Hob', '🍳']];
export const machineName = (id) => MACHINES.find(m => m[0] === id)?.[1] || id;
export const machineIcon = (id) => MACHINES.find(m => m[0] === id)?.[2] || '🍽️';
/** "200°C · 18 min · shake halfway" / "High · 6 min". */
export function machineLine(m) {
  if (!m) return '';
  const heat = m.temp ? `${m.temp}°C` : m.power ? String(m.power) : '';
  return [heat, m.mins ? `${m.mins} min` : '', m.note || ''].filter(Boolean).join(' · ');
}
/** Machines a recipe uses that you own, fastest first. A recipe with no machine at all needs no cooking. */
export function usable(r, owned) { return Object.entries(r.machines || {}).filter(([k, m]) => owned.includes(k) && m && (m.mins || m.temp || m.power)).sort((a, b) => (+a[1].mins || 99) - (+b[1].mins || 99)); }
export const noCook = (r) => !Object.keys(r.machines || {}).length;
export const cookable = (r, owned) => noCook(r) || usable(r, owned).length > 0;
/** Total minutes on the quickest machine you own (the recipe's own time when it needs none). */
export function quickest(r, owned) { const u = usable(r, owned)[0]; return Math.max(+r.mins || 0, u ? (+u[1].mins || 0) + (+r.prep || 0) : 0) || +r.mins || 0; }

// ───────────────────────── units and categories
export const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup', 'can', 'pack', 'clove', 'bunch', 'portions'];
const UNIT_ALIAS = { gram: 'g', grams: 'g', gr: 'g', kilo: 'kg', kilos: 'kg', kgs: 'kg', millilitre: 'ml', milliliter: 'ml', mls: 'ml', litre: 'l', liter: 'l', litres: 'l', liters: 'l', piece: 'pcs', pieces: 'pcs', pc: 'pcs', x: 'pcs', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', teaspoon: 'tsp', teaspoons: 'tsp', cups: 'cup', cans: 'can', tin: 'can', tins: 'can', packs: 'pack', packet: 'pack', packets: 'pack', cloves: 'clove', bunches: 'bunch', portion: 'portions' };
export const unitOf = (u) => { const k = String(u || '').trim().toLowerCase(); return UNITS.includes(k) ? k : UNIT_ALIAS[k] || (k ? k.slice(0, 10) : ''); };
/** One unit family per kind of measure, so 1 kg + 500 g add up. → [qty in the base unit, base unit] */
export function toBase(qty, unit) { const u = unitOf(unit), q = +qty || 0; return u === 'kg' ? [q * 1000, 'g'] : u === 'l' ? [q * 1000, 'ml'] : [q, u || 'pcs']; }
/** Back to something readable: 1500 g → 1.5 kg, 250 ml stays. */
export function fromBase(q, base) {
  const r = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  if (base === 'g' && q >= 1000) return [r(q / 1000, 2), 'kg'];
  if (base === 'ml' && q >= 1000) return [r(q / 1000, 2), 'l'];
  if (base === 'g' || base === 'ml') return [q >= 100 ? Math.ceil(q / 10) * 10 : Math.ceil(q), base];
  return [q > 0 && q < 1 ? r(q, 2) : Math.ceil(q * 2 - 1e-9) / 2, base];
}
export const qtyText = (q, u) => { if (!q) return u && u !== 'pcs' ? u : ''; const [a, b] = fromBase(...toBase(q, u)); return `${a}${b === 'pcs' ? '' : b === 'g' || b === 'ml' || b === 'kg' || b === 'l' ? ' ' + b : ' ' + b}`.trim(); };

export const CATS = [['produce', 'Fruit & veg', '🥬'], ['meat', 'Meat & fish', '🥩'], ['dairy', 'Dairy & eggs', '🥚'], ['bakery', 'Bread', '🥖'], ['dry', 'Rice, pasta & tins', '🥫'], ['frozen', 'Frozen', '🧊'], ['spices', 'Spices & sauces', '🧂'], ['drinks', 'Drinks', '🧃'], ['home', 'Household', '🧽'], ['other', 'Other', '🛒']];
const CAT_WORDS = [
  ['meat', /chicken|beef|lamb|mutton|camel|mince|kofta|steak|fish|salmon|tuna|shrimp|prawn|hammour|turkey|sausage|liver/],
  ['dairy', /milk|labneh|laban|yog(h)?urt|cheese|halloumi|feta|butter|cream|egg|zabadi/],
  ['frozen', /frozen|ice cream|peas \(frozen\)/],
  ['bakery', /bread|pita|khubz|samoon|tortilla|wrap|bun|croissant|toast/],
  ['produce', /tomato|onion|garlic|potato|cucumber|lettuce|spinach|pepper(?! ?corn)|capsicum|carrot|zucchini|courgette|eggplant|aubergine|broccoli|cauliflower|lemon|lime|apple|banana|date|orange|berry|berries|herb|parsley|coriander|cilantro|mint|avocado|mushroom|ginger|chilli|chili|cabbage|okra|beans? \(green\)|fruit|veg/],
  ['spices', /salt|pepper|cumin|paprika|turmeric|cinnamon|cardamom|spice|baharat|kabsa|sauce|ketchup|mayo|mustard|vinegar|tahini|honey|oil|stock|bouillon|seasoning|oregano|thyme|chilli flakes|sumac|za.?atar/],
  ['dry', /rice|pasta|noodle|lentil|chickpea|bean|flour|sugar|oat|cereal|can|tin|foul|fava|bulgur|freekeh|couscous|nuts|almond|walnut|peanut|raisin|stock cube/],
  ['drinks', /water|juice|coffee|tea|soda|cola|drink/],
  ['home', /soap|detergent|tissue|toilet|bin bag|foil|cling|sponge|cleaner|bleach|paper towel/],
];
export function guessCat(name) { const n = String(name || '').toLowerCase(); return (CAT_WORDS.find(([, re]) => re.test(n)) || ['other'])[0]; }
export const catName = (id) => CATS.find(c => c[0] === id)?.[1] || 'Other';
export const catIcon = (id) => CATS.find(c => c[0] === id)?.[2] || '🛒';
/** Salt, pepper, oil and water: you have them. Left out of the list unless you say otherwise. */
export const STAPLE = /^(salt|black pepper|pepper|water|olive oil|oil|vegetable oil|cooking oil|ice)$/i;
/** Comparable name: lower-case, single spaces, simple plurals dropped. */
export function normName(n) { return String(n || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9؀-ۿ ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/(?<=[a-z]{2})(o|s|x|ch|sh)es$/, '$1').replace(/(?<=[a-z]{2}[^s])s$/, ''); }

/** "500 g chicken thighs" / "2 tbsp olive oil" / "1½ cups rice" / "Salt" → {item, qty, unit}. */
export function parseIngredient(line) {
  let t = String(line || '').trim().replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/^[-•*]\s*/, ''); if (!t) return null;
  const FR = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3 };
  const m = /^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*(?:x\s+)?/i.exec(t);
  let qty = 0;
  if (m && (m[1] || m[2])) { qty = (m[1] ? +m[1].replace(',', '.') : 0) + (m[2] ? FR[m[2]] : 0); if (m[3]) qty = Math.max(qty, +m[3].replace(',', '.')); t = t.slice(m[0].length); }
  else { const f = /^(\d+)\s*\/\s*(\d+)\s*/.exec(t); if (f && +f[2]) { qty = +f[1] / +f[2]; t = t.slice(f[0].length); } }
  let unit = '';
  const u = /^([a-zA-Z]+)\.?\s+(?:of\s+)?/.exec(t);
  if (qty && u) { const un = unitOf(u[1]); if (UNITS.includes(un)) { unit = un; t = t.slice(u[0].length); } }
  const tight = /^(\d+(?:[.,]\d+)?)(g|kg|ml|l)\s+/i.exec(String(line).trim());   // "500g chicken"
  if (!qty && tight) { qty = +tight[1].replace(',', '.'); unit = unitOf(tight[2]); t = String(line).trim().slice(tight[0].length); }
  const item = t.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!item) return null;
  return { item, qty: Math.round(qty * 100) / 100, unit: qty ? unit || 'pcs' : '' };
}
export const ingText = (i) => `${i.qty ? qtyText(i.qty, i.unit) + ' ' : ''}${i.item}`;

// ───────────────────────── recipes
export const MEAL_TYPES = [['main', 'Main'], ['breakfast', 'Breakfast'], ['snack', 'Snack / light'], ['side', 'Side']];
export const LIMITS = { title: 60, mins: [1, 600], serves: [1, 20], keeps: [0, 14], kcal: [0, 3000], protein: [0, 300] };
function cleanMachines(m) {
  const out = {};
  for (const [k] of MACHINES) { const x = m?.[k]; if (!x || typeof x !== 'object') continue; const temp = num(x.temp, 0, 300, 0), mins = num(x.mins, 0, 600, 0), power = txt(x.power, 12), note = txt(x.note, 80); if (temp || mins || power) out[k] = { ...(temp ? { temp } : {}), ...(power ? { power } : {}), ...(mins ? { mins } : {}), ...(note ? { note } : {}) }; }
  return out;
}
export function cleanRecipe(r) {
  const ing = (Array.isArray(r.ingredients) ? r.ingredients : []).map(i => typeof i === 'string' ? parseIngredient(i) : i && typeof i === 'object' ? { item: txt(i.item, 60), qty: num(i.qty, 0, 1e5, 0), unit: unitOf(i.unit), ...(i.cat ? { cat: txt(i.cat, 10) } : {}) } : null).filter(i => i && i.item).slice(0, 40);
  return {
    id: r.id || 'r' + uid(), title: txt(r.title, LIMITS.title), icon: txt(r.icon, 8) || '🍽️', meal: MEAL_TYPES.some(m => m[0] === r.meal) ? r.meal : 'main',
    mins: num(r.mins, 1, 600, 20), serves: Math.round(num(r.serves, 1, 20, 2)), ingredients: ing, steps: (Array.isArray(r.steps) ? r.steps : String(r.steps || '').split('\n')).map(x => txt(x, 300)).filter(Boolean).slice(0, 30),
    machines: cleanMachines(r.machines), batch: !!r.batch, keeps: Math.round(num(r.keeps, 0, 14, 2)), freezes: !!r.freezes, light: !!r.light,
    kcal: Math.round(num(r.kcal, 0, 3000, 0)), protein: Math.round(num(r.protein, 0, 300, 0)), tags: (Array.isArray(r.tags) ? r.tags : []).map(t => txt(t, 20)).filter(Boolean).slice(0, 8),
    fav: !!r.fav, note: txt(r.note, 400), ...(r.starter ? { starter: txt(r.starter, 20) } : {}), at: r.at || Date.now(),
  };
}
export function saveRecipe(s, r) { const c = cleanRecipe(r); if (!c.title) return s; return { ...s, recipes: { ...(s.recipes || {}), [c.id]: { ...c, at: Date.now() } } }; }
export function deleteRecipe(s, id) { const recipes = { ...(s.recipes || {}) }; delete recipes[id]; return { ...s, recipes, deleted: { ...(s.deleted || {}), [`recipe:${id}`]: Date.now() } }; }
export const recipeList = (s) => rec(s.recipes).sort((a, b) => (b.fav - a.fav) || a.title.localeCompare(b.title));
export function validateRecipe(r, s = null) {
  const out = {}, t = txt(r.title, 100);
  if (!t) out.title = 'Give it a name'; else if (t.length > LIMITS.title) out.title = `${LIMITS.title} characters at most`;
  else if (s && recipeList(s).some(x => x.id !== r.id && x.title.toLowerCase() === t.toLowerCase())) out.dup = `You already have “${t}”`;
  if (r.serves !== undefined && !(+r.serves >= 1 && +r.serves <= 20)) out.serves = 'Serves 1–20';
  for (const [k, m] of Object.entries(r.machines || {})) { if (m?.temp && !(+m.temp >= 40 && +m.temp <= 300)) out[`t:${k}`] = `${machineName(k)}: 40–300 °C`; if (m?.mins && !(+m.mins >= 1 && +m.mins <= 600)) out[`m:${k}`] = `${machineName(k)}: 1–600 minutes`; }
  return out;
}

// Starter recipes: plain, original, each with times for the machines you have. Doneness rules: chicken 74 °C inside, minced meat 71 °C, fish flakes.
const I = (item, qty, unit, cat) => ({ item, qty, unit, ...(cat ? { cat } : {}) });
const BASE = [
  { starter: 'af-thighs', title: 'Air-fryer chicken thighs', icon: '🍗', meal: 'main', mins: 25, serves: 2, batch: true, keeps: 3, freezes: true, kcal: 430, protein: 38,
    ingredients: [I('boneless chicken thighs', 500, 'g'), I('olive oil', 1, 'tbsp'), I('paprika', 1, 'tsp'), I('garlic powder', 1, 'tsp'), I('lemon', 1, 'pcs'), I('salt', 0, '')],
    machines: { airfryer: { temp: 200, mins: 18, note: 'turn at 10 min' }, oven: { temp: 200, mins: 28, note: 'on a rack' } },
    steps: ['Pat the thighs dry, rub with oil, paprika, garlic powder and salt.', 'Cook in one layer; turn halfway.', 'Done at 74 °C in the thickest part. Squeeze lemon over.'], tags: ['protein', 'meal prep'] },
  { starter: 'af-salmon', title: 'Air-fryer salmon with lemon', icon: '🐟', meal: 'main', mins: 15, serves: 2, keeps: 2, light: true, kcal: 380, protein: 34,
    ingredients: [I('salmon fillets', 2, 'pcs'), I('olive oil', 1, 'tsp'), I('lemon', 1, 'pcs'), I('dried dill or parsley', 1, 'tsp'), I('salt', 0, '')],
    machines: { airfryer: { temp: 200, mins: 9 }, oven: { temp: 200, mins: 13 } },
    steps: ['Brush the fillets with oil, season, skin side down.', 'Cook until the fish flakes easily.', 'Lemon and herbs on top.'], tags: ['quick', 'protein'] },
  { starter: 'prep-bowls', title: 'Chicken & rice prep bowls', icon: '🍱', meal: 'main', mins: 40, serves: 4, batch: true, keeps: 4, freezes: true, kcal: 560, protein: 42,
    ingredients: [I('chicken breast', 700, 'g'), I('basmati rice', 300, 'g'), I('broccoli', 1, 'pcs'), I('carrots', 2, 'pcs'), I('olive oil', 2, 'tbsp'), I('kabsa spice', 2, 'tsp'), I('salt', 0, '')],
    machines: { oven: { temp: 200, mins: 25, note: 'chicken and veg on one tray' }, airfryer: { temp: 200, mins: 16, note: 'in two batches' }, microwave: { power: 'High', mins: 15, note: 'rice: 1 part rice, 2 parts water, covered; rest 5 min' } },
    steps: ['Cut the chicken into strips, toss with oil and spice.', 'Roast chicken and veg; cook the rice.', 'Split into 4 boxes, cool within an hour, then fridge (4 days) or freezer.'], tags: ['meal prep', 'nights'] },
  { starter: 'kofta', title: 'Beef kofta', icon: '🍢', meal: 'main', mins: 25, serves: 3, batch: true, keeps: 3, freezes: true, kcal: 470, protein: 31,
    ingredients: [I('minced beef', 500, 'g'), I('onion', 1, 'pcs'), I('parsley', 1, 'bunch'), I('baharat', 2, 'tsp'), I('salt', 0, ''), I('pita bread', 3, 'pcs')],
    machines: { airfryer: { temp: 190, mins: 11, note: 'turn once' }, oven: { temp: 200, mins: 17 } },
    steps: ['Grate the onion, squeeze out the juice, mix with mince, parsley, spice and salt.', 'Shape into fingers.', 'Cook to 71 °C inside. Serve in pita.'], tags: ['protein'] },
  { starter: 'shawarma', title: 'Chicken shawarma strips', icon: '🌯', meal: 'main', mins: 25, serves: 3, batch: true, keeps: 3, kcal: 520, protein: 40,
    ingredients: [I('chicken thighs', 600, 'g'), I('plain yogurt', 3, 'tbsp'), I('garlic', 3, 'clove'), I('shawarma spice', 2, 'tsp'), I('lemon', 1, 'pcs'), I('tortilla wraps', 4, 'pcs'), I('garlic sauce (toum)', 1, 'pack')],
    machines: { airfryer: { temp: 200, mins: 13, note: 'shake twice' }, oven: { temp: 220, mins: 20 } },
    steps: ['Marinate strips in yogurt, garlic, spice and lemon (30 min or overnight).', 'Cook until charred at the edges and 74 °C inside.', 'Wrap with toum and pickles.'], tags: ['packable'] },
  { starter: 'lentil-soup', title: 'Red lentil soup', icon: '🥣', meal: 'main', mins: 35, serves: 4, batch: true, keeps: 4, freezes: true, light: true, kcal: 310, protein: 17,
    ingredients: [I('red lentils', 250, 'g'), I('onion', 1, 'pcs'), I('carrots', 1, 'pcs'), I('cumin', 1, 'tsp'), I('stock cube', 1, 'pcs'), I('lemon', 1, 'pcs'), I('water', 1.2, 'l')],
    machines: { stove: { mins: 30, note: 'simmer, then blend' }, microwave: { power: 'High', mins: 3, note: 'to reheat one bowl, stir halfway' } },
    steps: ['Soften chopped onion and carrot, add lentils, cumin, stock and water.', 'Simmer until soft, blend, lemon to taste.', 'Freezes well in single bowls.'], tags: ['after nights', 'meal prep'] },
  { starter: 'shakshuka', title: 'Oven shakshuka', icon: '🍳', meal: 'breakfast', mins: 25, serves: 2, kcal: 330, protein: 18,
    ingredients: [I('eggs', 4, 'pcs'), I('chopped tomatoes', 1, 'can'), I('onion', 1, 'pcs'), I('bell pepper', 1, 'pcs'), I('cumin', 1, 'tsp'), I('feta', 50, 'g'), I('bread', 1, 'pcs')],
    machines: { oven: { temp: 190, mins: 14, note: 'until the whites set' }, stove: { mins: 20 } },
    steps: ['Cook onion and pepper soft, add tomatoes and cumin, 8 min.', 'Make 4 wells, crack in the eggs.', 'Bake until the whites are set; feta on top.'], tags: ['day off'] },
  { starter: 'oats', title: 'Overnight oats', icon: '🥛', meal: 'breakfast', mins: 5, serves: 1, keeps: 3, light: true, kcal: 380, protein: 20,
    ingredients: [I('rolled oats', 50, 'g'), I('milk', 150, 'ml'), I('greek yogurt', 100, 'g'), I('banana', 1, 'pcs'), I('honey', 1, 'tsp')], machines: {},
    steps: ['Mix oats, milk and yogurt in a jar.', 'Fridge overnight; banana and honey on top.'], tags: ['no cook', 'before a day shift'] },
  { starter: 'mug-eggs', title: 'Microwave scrambled eggs', icon: '🥚', meal: 'breakfast', mins: 5, serves: 1, light: true, kcal: 220, protein: 14,
    ingredients: [I('eggs', 2, 'pcs'), I('milk', 2, 'tbsp'), I('salt', 0, '')], machines: { microwave: { power: 'High', mins: 2, note: 'stir every 30 s' } },
    steps: ['Whisk eggs and milk in a mug.', 'Microwave in 30-second bursts, stirring, until just set.'], tags: ['quick'] },
  { starter: 'foul', title: 'Foul medames', icon: '🫘', meal: 'breakfast', mins: 10, serves: 2, kcal: 340, protein: 16,
    ingredients: [I('fava beans (foul)', 1, 'can'), I('garlic', 1, 'clove'), I('lemon', 1, 'pcs'), I('cumin', 1, 'tsp'), I('olive oil', 1, 'tbsp'), I('tomato', 1, 'pcs'), I('pita bread', 2, 'pcs')],
    machines: { microwave: { power: 'High', mins: 4, note: 'covered, stir halfway' }, stove: { mins: 10 } },
    steps: ['Warm the beans with a splash of water.', 'Mash with garlic, lemon and cumin; oil and tomato on top.'], tags: ['day off'] },
  { starter: 'veg-tray', title: 'Roast vegetables', icon: '🥕', meal: 'side', mins: 20, serves: 2, keeps: 3, light: true, kcal: 160, protein: 4,
    ingredients: [I('zucchini', 1, 'pcs'), I('bell pepper', 1, 'pcs'), I('red onion', 1, 'pcs'), I('cauliflower', 0.5, 'pcs'), I('olive oil', 1, 'tbsp'), I('za’atar', 1, 'tsp')],
    machines: { airfryer: { temp: 200, mins: 13, note: 'shake halfway' }, oven: { temp: 220, mins: 22 } },
    steps: ['Cut into even pieces, toss with oil and za’atar.', 'Roast until browned at the edges.'], tags: ['side'] },
  { starter: 'potatoes', title: 'Crispy jacket potatoes', icon: '🥔', meal: 'side', mins: 20, serves: 2, kcal: 260, protein: 7,
    ingredients: [I('large potatoes', 2, 'pcs'), I('olive oil', 1, 'tsp'), I('salt', 0, ''), I('labneh', 2, 'tbsp')],
    machines: { microwave: { power: 'High', mins: 9, note: 'prick first; then 8 min in the air fryer to crisp' }, airfryer: { temp: 200, mins: 8, note: 'after the microwave' }, oven: { temp: 200, mins: 55 } },
    steps: ['Prick, microwave until soft.', 'Oil and salt the skin, crisp in the air fryer.', 'Split and fill with labneh.'], tags: ['side'] },
  { starter: 'falafel-wrap', title: 'Falafel wraps (frozen falafel)', icon: '🧆', meal: 'main', mins: 15, serves: 2, kcal: 480, protein: 15,
    ingredients: [I('frozen falafel', 12, 'pcs'), I('tortilla wraps', 2, 'pcs'), I('tahini', 2, 'tbsp'), I('cucumber', 1, 'pcs'), I('tomato', 1, 'pcs')],
    machines: { airfryer: { temp: 190, mins: 11, note: 'from frozen, shake once' }, oven: { temp: 200, mins: 17 } },
    steps: ['Cook the falafel from frozen.', 'Wrap with salad and tahini.'], tags: ['quick'] },
  { starter: 'tuna-wrap', title: 'Tuna wrap', icon: '🥙', meal: 'main', mins: 8, serves: 1, keeps: 1, kcal: 420, protein: 30,
    ingredients: [I('tuna', 1, 'can'), I('tortilla wraps', 1, 'pcs'), I('sweetcorn', 2, 'tbsp'), I('lettuce', 1, 'pcs'), I('mayonnaise', 1, 'tbsp')], machines: {},
    steps: ['Mix drained tuna, corn and mayo.', 'Roll in the wrap with lettuce; packs well for a shift.'], tags: ['no cook', 'packable'] },
  { starter: 'yogurt-bowl', title: 'Yogurt, fruit & nuts', icon: '🍓', meal: 'snack', mins: 3, serves: 1, light: true, kcal: 290, protein: 18,
    ingredients: [I('greek yogurt', 170, 'g'), I('berries or banana', 100, 'g'), I('almonds', 20, 'g'), I('honey', 1, 'tsp')], machines: {},
    steps: ['Yogurt in a bowl, fruit and nuts on top.'], tags: ['no cook', 'after nights'] },
  { starter: 'kabsa', title: 'Chicken kabsa (one tray)', icon: '🍛', meal: 'main', mins: 70, serves: 5, batch: true, keeps: 3, freezes: true, kcal: 640, protein: 38,
    ingredients: [I('chicken pieces', 1.2, 'kg'), I('basmati rice', 400, 'g'), I('onion', 2, 'pcs'), I('tomato', 2, 'pcs'), I('kabsa spice', 2, 'tbsp'), I('raisins', 30, 'g'), I('almonds', 30, 'g'), I('stock cube', 1, 'pcs')],
    machines: { oven: { temp: 190, mins: 50, note: 'covered with foil, then 10 min uncovered' }, stove: { mins: 60 } },
    steps: ['Brown onion and chicken, add tomato, spice and stock.', 'Add washed rice and hot water to 2 cm above, cover.', 'Bake until the rice is tender and the chicken 74 °C; nuts and raisins on top.'], tags: ['day off', 'meal prep'] },
];
/** Every starter recipe: the first 16 (1.0) and the bigger library (1.1). */
export const STARTERS = [...BASE, ...MORE];
/** The starter recipes you do not have yet (by starter id or by name). */
export function startersMissing(s) { const have = new Set(recipeList(s).flatMap(r => [r.starter, r.title.toLowerCase()].filter(Boolean))); return STARTERS.filter(r => !have.has(r.starter) && !have.has(r.title.toLowerCase())); }
export function addStarters(s, list = startersMissing(s)) { let out = s; for (const r of list) out = saveRecipe(out, { ...r, id: 'r' + uid() }); return out; }

// ───────────────────────── the fridge (pantry)
export const WHERE = [['fridge', 'Fridge', '🧊'], ['freezer', 'Freezer', '❄️'], ['cupboard', 'Cupboard', '🗄️']];
/** Rough days a thing keeps, by kind and place — only a starting guess you can change. */
export function shelfDays(cat, where) {
  if (where === 'freezer') return 90; if (where === 'cupboard') return cat === 'produce' ? 7 : cat === 'bakery' ? 4 : 180;
  return { produce: 5, meat: 2, dairy: 7, bakery: 4, dry: 30, frozen: 2, spices: 60, drinks: 7, home: 365, other: 5 }[cat] ?? 5;
}
export function addFood(s, f, now = new Date()) {
  const name = txt(f.name, 60); if (!name) return s;
  const cat = CATS.some(c => c[0] === f.cat) ? f.cat : guessCat(name), where = WHERE.some(w => w[0] === f.where) ? f.where : cat === 'frozen' ? 'freezer' : cat === 'dry' || cat === 'spices' || cat === 'home' ? 'cupboard' : 'fridge';
  const expires = isKey(f.expires) ? f.expires : f.expires === '' ? '' : keyOf(addDays(now, shelfDays(cat, where)));
  const id = f.id || 'p' + uid();
  return { ...s, pantry: { ...(s.pantry || {}), [id]: { id, name, qty: num(f.qty, 0, 1e5, 0), unit: f.qty ? unitOf(f.unit) || 'pcs' : '', where, cat, expires, added: f.added || keyOf(now), ...(f.fromMeal ? { fromMeal: f.fromMeal } : {}), at: Date.now() } } };
}
export const updateFood = (s, id, patch) => s.pantry?.[id] ? addFood(s, { ...s.pantry[id], ...patch, id }) : s;
export function removeFood(s, id) { const pantry = { ...(s.pantry || {}) }; delete pantry[id]; return { ...s, pantry, deleted: { ...(s.deleted || {}), [`food:${id}`]: Date.now() } }; }
/** Days until it expires (negative: past it), or null with no date. */
export const daysLeft = (f, now = new Date()) => isKey(f.expires) ? Math.round((fromKey(f.expires) - startOfDay(now)) / 864e5) : null;
export const foodList = (s) => rec(s.pantry).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999') || a.name.localeCompare(b.name));
/** Use these first: already past or within `days`. */
export const useFirst = (s, now = new Date(), days = 2) => foodList(s).filter(f => { const d = daysLeft(f, now); return d !== null && d <= days && f.where !== 'freezer'; });
/** What you have of an ingredient: {have: bool, qty in base units or Infinity when the fridge row has no amount, food[]} */
export function stockOf(s, item, unit) {
  const n = normName(item), [, base] = toBase(1, unit || 'pcs'); let qty = 0, any = false; const foods = [];
  for (const f of rec(s.pantry)) { if (normName(f.name) !== n && !normName(f.name).includes(n) && !n.includes(normName(f.name))) continue; if (normName(f.name).length < 3) continue; foods.push(f); any = true; if (!f.qty) { qty = Infinity; continue; } const [q, b] = toBase(f.qty, f.unit); if (b === base) qty += q; else qty = Infinity; }
  return { have: any, qty, foods };
}
/** Take `qty unit` of an item out of the fridge rows that hold it (oldest-expiring first); rows that reach 0 go. */
export function takeFrom(s, item, qty, unit) {
  const st = stockOf(s, item, unit); if (!st.have) return s; let left = toBase(qty, unit)[0], out = s;
  for (const f of st.foods.sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'))) {
    if (left <= 0) break; if (!f.qty) continue; const [q, b] = toBase(f.qty, f.unit); if (b !== toBase(1, unit || 'pcs')[1]) continue;
    if (q <= left + 1e-9) { out = removeFood(out, f.id); left -= q; } else { const [nq] = fromBase(q - left, b); out = updateFood(out, f.id, { qty: f.unit === 'kg' || f.unit === 'l' ? Math.round((q - left) / 10) / 100 : Math.round((q - left) * 100) / 100, unit: f.unit === 'kg' || f.unit === 'l' ? f.unit : b }); left = 0; void nq; }
  }
  return out;
}

// ───────────────────────── meals
export const SLOTS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['night', 'Night meal'], ['sleep', 'Before sleep'], ['snack', 'Snack']];
export const slotName = (id) => SLOTS.find(x => x[0] === id)?.[1] || id;
export function addMeal(s, m) {
  if (!isKey(m.date)) return s; const id = m.id || 'm' + uid(), r = m.recipeId ? s.recipes?.[m.recipeId] : null;
  const meal = { id, date: m.date, slot: SLOTS.some(x => x[0] === m.slot) ? m.slot : 'dinner', ...(r ? { recipeId: r.id } : {}), text: r ? '' : txt(m.text, 80), servings: Math.round(num(m.servings, 1, 30, r?.serves || 1)),
    ...(m.fromBatch ? { fromBatch: String(m.fromBatch).slice(0, 30) } : {}), ...(m.batch ? { batch: true } : {}), ...(m.packed ? { packed: true } : {}), ...(isKey(m.cooked) ? { cooked: m.cooked } : {}), at: Date.now() };
  if (!meal.recipeId && !meal.text) return s;
  return { ...s, meals: { ...(s.meals || {}), [id]: meal } };
}
export const updateMeal = (s, id, patch) => s.meals?.[id] ? addMeal(s, { ...s.meals[id], ...patch, id }) : s;
export function deleteMeal(s, id) { const meals = { ...(s.meals || {}) }; delete meals[id]; return { ...s, meals, deleted: { ...(s.deleted || {}), [`meal:${id}`]: Date.now() } }; }
const SLOT_ORDER = Object.fromEntries(SLOTS.map((x, i) => [x[0], i]));
export const mealsOn = (s, key) => rec(s.meals).filter(m => m.date === key).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
export const mealTitle = (s, m) => (m.recipeId && s.recipes?.[m.recipeId]?.title) || m.text || 'A meal';
export const mealIcon = (s, m) => (m.recipeId && s.recipes?.[m.recipeId]?.icon) || '🍽️';
/** Cooked or eaten. A batch leaves its extra portions in the fridge (for the packed meals planned from it); a packed meal from a
 *  batch takes one portion out. `take`: also take the ingredients out of the fridge list. */
export function cookMeal(s, id, now = new Date(), { take = true } = {}) {
  const m = s.meals?.[id]; if (!m) return s; let out = updateMeal(s, id, { cooked: keyOf(now) });
  const r = m.recipeId ? s.recipes?.[m.recipeId] : null;
  if (m.fromBatch) { const left = rec(out.pantry).find(f => f.fromMeal === m.fromBatch); if (left) out = left.qty > 1 ? updateFood(out, left.id, { qty: left.qty - 1 }) : removeFood(out, left.id); return out; }
  if (r && take) { const k = m.servings / (r.serves || 1); for (const i of r.ingredients) if (i.qty && !STAPLE.test(i.item.trim())) out = takeFrom(out, i.item, i.qty * k, i.unit); }
  const extra = (m.servings || 1) - 1;
  if (r && extra >= 1 && (m.batch || r.batch || r.keeps)) out = addFood(out, { name: `${r.title} (cooked)`, qty: extra, unit: 'portions', where: 'fridge', cat: 'other', expires: keyOf(addDays(now, Math.max(1, r.keeps || 3))), fromMeal: id }, now);
  return out;
}
export const uncook = (s, id) => s.meals?.[id] ? { ...s, meals: { ...s.meals, [id]: (({ cooked, ...m }) => ({ ...m, at: Date.now() }))(s.meals[id]) } } : s;

// ───────────────────────── the planner
/** What each kind of day needs, slot by slot: at (minutes), max (cooking minutes), need: main | quick | pack | light. */
export function slotsFor(dk) {
  const sh = dk.shift, st = sh.start ?? 480, en = sh.end ?? 1200;
  const S = (slot, at, max, need, why) => ({ slot, at: Math.max(0, Math.round(at / 15) * 15), max, need, why });
  switch (dk.kind) {
    case 'day': return [S('breakfast', st - 60, 10, 'quick', `before your ${hm(st)} start`), S('lunch', st + 300, 0, 'pack', 'packed for the shift'), S('dinner', en + 45, 25, 'quick', `home after ${hm(en)}: quick`)];
    case 'evening': return [S('lunch', Math.min(st - 120, 720), 40, 'main', 'before the shift'), S('dinner', st + 300, 0, 'pack', 'packed for the shift')];
    case 'first-night': return [S('lunch', 13 * 60 + 30, 45, 'main', 'a proper lunch'), S('dinner', st - 150, 40, 'main', `before your ${hm(st)} night`), S('night', st + 300, 0, 'pack', 'packed for the night')];
    case 'night': return [S('sleep', 510, 10, 'light', 'light, then sleep'), S('dinner', st - 150, 30, 'main', `when you wake, before ${hm(st)}`), S('night', st + 300, 0, 'pack', 'packed for the night')];
    case 'postnight': return [S('sleep', 8 * 60 + 30, 10, 'light', 'light, then sleep — nothing heavy'), S('dinner', 19 * 60, 60, 'main', 'your first proper meal')];
    default: return [S('breakfast', 9 * 60, 25, 'quick', ''), S('lunch', 13 * 60 + 30, 60, 'main', ''), S('dinner', 19 * 60 + 30, 60, 'main', '')];
  }
}
/** Does this recipe suit that slot? Breakfast slots take breakfast or snack recipes; "before sleep" only light ones; packed meals
 *  need a main that keeps (or needs no cooking); lunch and dinner take mains. Sides are never planned on their own. */
export function suits(r, slot, need) {
  if (r.meal === 'side') return false;
  if (need === 'light') return !!r.light;
  if (slot === 'breakfast') return r.meal === 'breakfast' || r.meal === 'snack';
  if (need === 'pack') return r.meal === 'main' && (r.keeps >= 1 || r.batch || noCook(r));
  return r.meal === 'main';
}
/** Food to use up that is still good on `key` (the slot's day): past its date it is never planned around. */
const expiringItems = (s, now, key = keyOf(now)) => useFirst(s, now, 3).filter(f => daysLeft(f, now) >= 0 && f.expires >= key).map(f => normName(f.name));
/** Score one recipe for one slot; returns {score, why[]}. */
function score(s, r, x, { owned, now, recent, used, diet }) {
  const why = []; let sc = 0;
  const mins = quickest(r, owned);
  if (x.max && mins > x.max) return null;
  if (!cookable(r, owned)) return null;
  const exp = expiringItems(s, now, x.key), hits = r.ingredients.filter(i => exp.some(e => e && (normName(i.item).includes(e) || e.includes(normName(i.item))))).map(i => i.item);
  if (hits.length) { sc += 3 * hits.length; why.push(`uses ${hits.slice(0, 2).join(', ')} before it goes off`); }
  const have = r.ingredients.filter(i => !STAPLE.test(i.item) && stockOf(s, i.item, i.unit).have).length, need = r.ingredients.filter(i => !STAPLE.test(i.item)).length || 1;
  sc += 2 * have / need; if (have / need >= .6) why.push('most of it is in the fridge');
  if (r.fav) { sc += 1; why.push('a favourite'); }
  if (diet.protein && r.protein) { const t = diet.protein / 3; if (r.protein >= t * .8) { sc += 1; why.push(`${r.protein} g protein`); } }
  if (diet.kcal && r.kcal) { const t = diet.kcal / 3; sc += Math.abs(r.kcal - t) <= t * .25 ? 1 : r.kcal > t * 1.5 ? -1.5 : 0; }
  if (x.need === 'quick') { sc += Math.max(0, (x.max - mins) / 10); if (mins <= 15) why.push(`${mins} min`); }
  if (recent.has(r.id)) sc -= 3;
  sc -= 2 * (used.get(r.id) || 0);
  sc += ((r.id.charCodeAt(r.id.length - 1) + x.at) % 7) / 20;   // a stable tie-break, so equal recipes rotate instead of the first always winning
  return { score: sc, why };
}
/**
 * A proposal for the next `days` days: for every slot that has no meal yet, the best recipe, and batch cooks before night
 * stretches and runs of day shifts (one cook → the packed meals). Nothing is saved until applyPlan().
 * → { days: [{key, date, dk, label, slots: [{slot, at, max, need, why, meal, pick: {recipeId, why[], fromBatch?}}]}], batches: [{key, recipeId, portions, forKeys, why}] }
 */
export function planWeek(s, { from = new Date(), days = 7, owned = ['airfryer', 'oven', 'microwave'], diet = {}, now = new Date() } = {}) {
  const start = startOfDay(from), recipes = recipeList(s), today = keyOf(now);
  const recent = new Set(rec(s.meals).filter(m => m.date >= keyOf(addDays(start, -3)) && m.date < keyOf(start) && m.recipeId).map(m => m.recipeId));
  const used = new Map(), bump = (id) => used.set(id, (used.get(id) || 0) + 1);
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i), key = keyOf(date), dk = dayKind(date), have = mealsOn(s, key);
    for (const m of have) if (m.recipeId) bump(m.recipeId);
    out.push({ key, date, dk, label: KIND_LABEL[dk.kind], slots: slotsFor(dk).map(x => ({ ...x, meal: have.find(m => m.slot === x.slot) || null, pick: null, past: key < today || (key === today && x.at < now.getHours() * 60 + now.getMinutes() - 60) })) });
  }
  // batch cooks: a run of packed meals of one kind (night meals, or packed lunches on shift days) on consecutive days is fed by one
  // cook: on the day before the run when that day is free (off, leave, after a night), else on the first day of the run when it
  // has a proper meal slot (the lunch before a first night). Day-shift runs with no free day before them get single picks instead.
  const batches = [];
  const packs = out.flatMap(d => d.slots.filter(x => x.need === 'pack' && !x.meal && !x.past).map(x => ({ d, x })));
  const free = (d) => d && !d.past && ['off', 'leave', 'postnight', 'unknown'].includes(d.dk.kind);
  let i = 0;
  while (i < packs.length) {
    const run = [packs[i]], kindOf = (p) => p.x.slot === 'night' ? 'night' : 'lunch';
    while (i + run.length < packs.length && run.length < 4) { const nx = packs[i + run.length], last = run[run.length - 1]; if (Math.round((nx.d.date - last.d.date) / 864e5) !== 1 || kindOf(nx) !== kindOf(last)) break; run.push(nx); }
    i += run.length; if (run.length < 2) continue;
    const first = run[0].d, idx = out.indexOf(first), prev = idx > 0 ? out[idx - 1] : null;
    const slotIn = (d) => d?.slots.find(x => !x.meal && !x.pick && !x.past && x.need === 'main') || null;
    let cookDay = null, cookSlot = null;
    if (free(prev) && slotIn(prev)) { cookDay = prev; cookSlot = slotIn(prev); }
    else if (kindOf(run[0]) === 'night' && slotIn(first)) { cookDay = first; cookSlot = slotIn(first); }
    if (!cookSlot) continue;
    const pool = recipes.filter(r => r.meal === 'main' && (r.batch || r.keeps >= run.length) && cookable(r, owned));
    const ranked = pool.map(r => ({ r, sc: score(s, r, { at: cookSlot.at, need: 'main', max: 0, key: cookDay.key }, { owned, now, recent, used, diet }) })).filter(x => x.sc).sort((a, b) => b.sc.score - a.sc.score);
    if (!ranked.length) continue;
    const r = ranked[0].r, nights = kindOf(run[0]) === 'night', portions = run.length;
    const b = { key: cookDay.key, slot: cookSlot.slot, recipeId: r.id, portions, forKeys: run.map(p => p.d.key), why: `${nights ? 'before your nights' : 'for your shift days'}: one cook, ${portions} packed meal${portions > 1 ? 's' : ''}${r.keeps < portions ? ' (freeze the last ones)' : ''}` };
    batches.push(b); bump(r.id);
    cookSlot.pick = { recipeId: r.id, why: [`batch: cook ${portions + 1} portions`, ...ranked[0].sc.why.slice(0, 1)], batch: portions };
    for (const p of run) p.x.pick = { recipeId: r.id, why: [cookDay === first ? 'from today’s batch' : 'from the batch the day before'], fromBatch: true };
  }
  // every other empty slot: the best recipe that suits it
  for (const d of out) for (const x of d.slots) {
    if (x.meal || x.pick || x.past) continue;
    const ranked = recipes.filter(r => suits(r, x.slot, x.need)).map(r => ({ r, sc: score(s, r, { ...x, key: d.key }, { owned, now, recent, used, diet }) })).filter(y => y.sc).sort((a, b) => b.sc.score - a.sc.score);
    if (ranked[0]) { x.pick = { recipeId: ranked[0].r.id, why: ranked[0].sc.why.slice(0, 2) }; bump(ranked[0].r.id); }
  }
  return { days: out, batches };
}
/** Save the proposal's picks as meals (empty slots only; your own meals are never replaced). → {state, ids} for Undo. */
export function applyPlan(s, plan, { only = null } = {}) {
  let out = s; const ids = [], batchIds = {};
  for (const d of plan.days) for (const x of d.slots) {
    if (!x.pick || x.meal || x.past || (only && !only.includes(`${d.key}|${x.slot}`))) continue;
    if (x.pick.batch) { const id = 'm' + uid(); out = addMeal(out, { id, date: d.key, slot: x.slot, recipeId: x.pick.recipeId, servings: x.pick.batch + 1, batch: true }); batchIds[x.pick.recipeId + '|' + d.key] = id; ids.push(id); }
  }
  for (const d of plan.days) for (const x of d.slots) {
    if (!x.pick || x.meal || x.past || x.pick.batch || (only && !only.includes(`${d.key}|${x.slot}`))) continue;
    let fromBatch = '';
    if (x.pick.fromBatch) { const b = plan.batches.find(b => b.recipeId === x.pick.recipeId && b.forKeys.includes(d.key)); fromBatch = b ? batchIds[b.recipeId + '|' + b.key] || '' : ''; }
    const id = 'm' + uid(); out = addMeal(out, { id, date: d.key, slot: x.slot, recipeId: x.pick.recipeId, servings: 1, ...(fromBatch ? { fromBatch } : {}), ...(x.need === 'pack' ? { packed: true } : {}) }); ids.push(id);
  }
  return { state: out, ids };
}
/** Calories and protein planned for a day (one serving per meal). */
export function dayTotals(s, key) { let kcal = 0, protein = 0, known = 0; for (const m of mealsOn(s, key)) { const r = m.recipeId && s.recipes?.[m.recipeId]; if (r && (r.kcal || r.protein)) { kcal += r.kcal; protein += r.protein; known++; } } return { kcal, protein, known }; }

// ───────────────────────── shopping
export function addShop(s, it, now = new Date()) {
  const name = txt(it.name, 60); if (!name) return s; const id = it.id || 's' + uid();
  return { ...s, shopping: { ...(s.shopping || {}), [id]: { id, name, qty: num(it.qty, 0, 1e5, 0), unit: it.qty ? unitOf(it.unit) || 'pcs' : '', cat: CATS.some(c => c[0] === it.cat) ? it.cat : guessCat(name), done: !!it.done, from: it.from === 'meals' ? 'meals' : 'me', ...(Array.isArray(it.for) && it.for.length ? { for: it.for.slice(0, 20) } : {}), added: it.added || keyOf(now), at: Date.now() } } };
}
export const updateShop = (s, id, patch) => s.shopping?.[id] ? addShop(s, { ...s.shopping[id], ...patch, id }) : s;
export function removeShop(s, id) { const shopping = { ...(s.shopping || {}) }; delete shopping[id]; return { ...s, shopping, deleted: { ...(s.deleted || {}), [`shop:${id}`]: Date.now() } }; }
export const shopList = (s) => rec(s.shopping).sort((a, b) => (a.done - b.done) || CATS.findIndex(c => c[0] === a.cat) - CATS.findIndex(c => c[0] === b.cat) || a.name.localeCompare(b.name));
export const openShop = (s) => shopList(s).filter(x => !x.done);
/**
 * What the planned meals from `fromKey` to `toKey` still need: ingredients scaled to servings, minus what the fridge holds and
 * what is already on the list. Packed meals from a batch need nothing (the batch was counted). Staples are left out unless asked.
 * → [{name, qty, unit, cat, for: [meal ids], recipes: [titles]}]
 */
export function neededFor(s, fromK, toK, { staples = false } = {}) {
  const need = new Map();
  for (const m of rec(s.meals)) {
    if (m.date < fromK || m.date > toK || m.cooked || m.fromBatch || !m.recipeId) continue;
    const r = s.recipes?.[m.recipeId]; if (!r) continue; const k = (m.servings || r.serves) / (r.serves || 1);
    for (const i of r.ingredients) {
      if (!staples && STAPLE.test(i.item.trim())) continue;
      const [q, base] = toBase((i.qty || 0) * k, i.unit), key = normName(i.item) + '|' + (i.qty ? base : '');
      const cur = need.get(key) || { name: i.item, qty: 0, base, has: !!i.qty, cat: i.cat || guessCat(i.item), for: [], recipes: [] };
      cur.qty += q; if (!cur.for.includes(m.id)) cur.for.push(m.id); if (!cur.recipes.includes(r.title)) cur.recipes.push(r.title); need.set(key, cur);
    }
  }
  const out = [];
  for (const n of need.values()) {
    let q = n.qty;
    const st = stockOf(s, n.name, n.base); if (st.have) q = n.has ? q - st.qty : 0;
    for (const x of openShop(s)) if (normName(x.name) === normName(n.name)) { if (!n.has || !x.qty) q = 0; else { const [xq, xb] = toBase(x.qty, x.unit); if (xb === n.base) q -= xq; else q = 0; } }
    if (n.has ? q <= 1e-6 : q < 0 || st.have || openShop(s).some(x => normName(x.name) === normName(n.name))) continue;
    const [qq, uu] = n.has ? fromBase(q, n.base) : [0, ''];
    out.push({ name: n.name, qty: qq, unit: uu, cat: n.cat, for: n.for, recipes: n.recipes });
  }
  return out.sort((a, b) => CATS.findIndex(c => c[0] === a.cat) - CATS.findIndex(c => c[0] === b.cat) || a.name.localeCompare(b.name));
}
/** Put needed items on the list: an open row of the same thing and unit grows, otherwise a new row. */
export function addNeeded(s, items, now = new Date()) {
  let out = s;
  for (const it of items) {
    const same = openShop(out).find(x => normName(x.name) === normName(it.name) && (!it.qty || !x.qty || toBase(1, x.unit)[1] === toBase(1, it.unit)[1]));
    if (same) { const [a, b] = toBase(same.qty, same.unit), [c] = toBase(it.qty, it.unit), [q, u] = same.qty && it.qty ? fromBase(a + c, b) : [same.qty || it.qty, same.unit || it.unit]; out = updateShop(out, same.id, { qty: q, unit: u, for: [...new Set([...(same.for || []), ...(it.for || [])])] }); }
    else out = addShop(out, { ...it, from: 'meals' }, now);
  }
  return out;
}
/** Ticked in the shop: it goes into the fridge list with a best-before guess (you can change it there). */
export function boughtToPantry(s, id, now = new Date()) {
  const x = s.shopping?.[id]; if (!x || x.cat === 'home') return s;
  return addFood(s, { name: x.name, qty: x.qty, unit: x.unit, cat: x.cat }, now);
}
/** Clear the ticked rows (after the shop). */
export function clearDone(s) { let out = s; for (const x of shopList(s).filter(x => x.done)) out = removeShop(out, x.id); return out; }

// ───────────────────────── cooking helpers (1.1)
/** An ingredient for `factor` × the recipe (1.5 eggs → 2; 375 g stays 375 g; 0.25 tsp kept). */
export function scaleIng(i, factor) {
  if (!i.qty) return { ...i };
  let q = i.qty * factor; const u = unitOf(i.unit);
  if (['pcs', 'can', 'pack', 'clove', 'bunch', 'portions'].includes(u)) q = q < 1 ? Math.round(q * 4) / 4 : Math.round(q * 2) / 2;
  else if (['tsp', 'tbsp', 'cup'].includes(u)) q = Math.round(q * 4) / 4;
  else if (u === 'g' || u === 'ml') q = q >= 100 ? Math.round(q / 5) * 5 : Math.round(q);
  else q = Math.round(q * 100) / 100;
  return { ...i, qty: q };
}
/** Oven ↔ air fryer, the common rule of thumb: about 20 °C lower and 20 % shorter in the air fryer. Check doneness, not the clock. */
export function convert(from, to, temp, mins) {
  const t = +temp || 0, m = +mins || 0;
  if (from === 'oven' && to === 'airfryer') return { temp: t ? Math.max(140, Math.round((t - 20) / 5) * 5) : 0, mins: Math.max(1, Math.round(m * 0.8)) };
  if (from === 'airfryer' && to === 'oven') return { temp: t ? Math.min(250, Math.round((t + 20) / 5) * 5) : 0, mins: Math.max(1, Math.round(m * 1.25)) };
  return { temp: t, mins: m };
}
/** Times written in a step ("8 min", "1–2 minutes", "1 hour", "30 seconds") → minutes, longest first; for one-tap timers. */
export function stepTimes(text) {
  const out = []; const t = String(text || '');
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)(?:\s*(?:–|-|to)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|h\b|minutes?|mins?|seconds?|secs?|s\b)/gi)) {
    const a = +m[1].replace(',', '.'), b = m[2] ? +m[2].replace(',', '.') : a, u = m[3].toLowerCase(), v = Math.max(a, b);
    const min = /^h/.test(u) ? v * 60 : /^s/.test(u) ? v / 60 : v;
    if (min > 0 && min <= 24 * 60 && !out.includes(min)) out.push(min);
  }
  return out.sort((x, y) => y - x).slice(0, 3);
}
/** What you can cook from the fridge right now: share of ingredients you have (staples count as had), the missing ones. */
export function cookNow(s, owned) {
  return recipeList(s).filter(r => cookable(r, owned)).map(r => {
    const need = r.ingredients.filter(i => !STAPLE.test(i.item.trim())), have = need.filter(i => stockOf(s, i.item, i.unit).have);
    return { r, share: need.length ? have.length / need.length : 0, have: have.length, need: need.length, missing: need.filter(i => !have.includes(i)) };
  }).filter(x => x.have >= 1).sort((a, b) => b.share - a.share || a.missing.length - b.missing.length || (b.r.fav - a.r.fav)).slice(0, 8);
}
/** How often you cooked a recipe, and when last (from cooked meals). */
export function cookedStats(s, id) { const l = rec(s.meals).filter(m => m.recipeId === id && m.cooked && !m.fromBatch).map(m => m.cooked).sort(); return { count: l.length, last: l[l.length - 1] || '' }; }
/**
 * A recipe from pasted text (a website, a WhatsApp message): the first line is the title; lines that start with an amount are
 * ingredients; the rest are steps (numbers and bullets stripped); °C and minutes near "air fryer" / "oven" / "microwave" fill
 * the machines. Returns a draft for the editor — nothing is saved until you press Save.
 */
export function parseRecipeText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const title = lines[0].replace(/^#+\s*/, '').slice(0, 60), ingredients = [], steps = [], machines = {};
  let mode = '';
  for (const raw of lines.slice(1)) {
    const l = raw.replace(/^[-•*·]\s*/, '');
    if (/^ingredients?:?$/i.test(l)) { mode = 'ing'; continue; }
    if (/^(method|steps?|directions?|instructions?|preparation):?$/i.test(l)) { mode = 'step'; continue; }
    if (/^(serves?|servings?|makes|yield|prep|cook(ing)? time|total time)\b/i.test(l)) continue;
    const numbered = /^(\d+[.)]\s|step\s*\d)/i.test(l);
    const looksIng = !numbered && /^(\d+([.,/]\d+)?|[½¼¾⅓⅔]|[٠-٩])/.test(l) && l.length < 70 && !/\b(min|minutes|°c|degrees)\b/i.test(l);
    if ((mode === 'ing' && !numbered) || (mode !== 'step' && looksIng)) { const p = parseIngredient(l); if (p) { ingredients.push(p); continue; } }
    steps.push(l.replace(/^(\d+[.)]|step\s*\d+:?)\s*/i, '').slice(0, 300));
    const lw = l.toLowerCase(), temp = /(\d{2,3})\s*°?\s*c\b/i.exec(l)?.[1], mins = stepTimes(l)[0];
    for (const [id, re] of [['airfryer', /air ?fryer/], ['oven', /\boven\b/], ['microwave', /microwave/], ['stove', /\b(pan|hob|stove|simmer|boil)\b/]]) if (re.test(lw) && !machines[id]) machines[id] = { ...(temp && id !== 'microwave' ? { temp: +temp } : {}), ...(id === 'microwave' ? { power: 'High' } : {}), ...(mins ? { mins: Math.round(mins) } : {}) };
  }
  const serves = +(/serves?\s*(\d+)/i.exec(text)?.[1] || 0);
  return { title, ingredients, steps: steps.slice(0, 30), machines, ...(serves ? { serves } : {}) };
}
/** Tags across your recipes, most used first — the cuisine and style filters. */
export function tagCloud(s) { const n = new Map(); for (const r of recipeList(s)) for (const t of r.tags) n.set(t, (n.get(t) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1]).map(x => x[0]); }
