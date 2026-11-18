// Nutrition from the ingredients: a small food table (per 100 g, approximate, from standard food-composition data such as
// USDA FoodData Central; packaged foods vary by brand — the label wins), units to grams, and the totals per portion.
// Pure (no DOM). One order everywhere so the eye learns it: cost · kcal · protein · carbs · fat · fibre, then micros.

// [kcal, protein, carbs, fat, fibre, sugar, sodium mg, calcium mg, iron mg, potassium mg, vitamin C mg], piece g, tbsp g
const F = (n, v, piece = 0, tbsp = 15) => [n, v, piece, tbsp];
const TABLE = [
  F('egg', [143, 12.6, 0.7, 9.5, 0, 0.4, 142, 56, 1.8, 138, 0], 50),
  F('chicken breast', [120, 22.5, 0, 2.6, 0, 0, 45, 5, 0.4, 334, 0], 200),
  F('chicken thigh', [121, 19.7, 0, 4.1, 0, 0, 95, 9, 0.9, 240, 0], 100),
  F('chicken wing', [191, 17.5, 0, 12.9, 0, 0, 73, 11, 0.6, 186, 0], 90),
  F('chicken quarter', [180, 17.5, 0, 12, 0, 0, 80, 10, 0.8, 200, 0], 200),   // edible meat of one quarter
  F('minced beef', [215, 18.6, 0, 15, 0, 0, 66, 18, 2.2, 290, 0]),
  F('beef', [190, 20, 0, 12, 0, 0, 60, 15, 2.3, 320, 0]),
  F('lamb', [250, 17, 0, 20, 0, 0, 60, 15, 1.6, 230, 0]),
  F('salmon', [208, 20, 0, 13, 0, 0, 59, 9, 0.3, 363, 0], 150),
  F('tuna', [116, 25.5, 0, 0.8, 0, 0, 338, 11, 1.5, 237, 0], 160),
  F('shrimp', [85, 20, 0, 0.5, 0, 0, 119, 70, 0.5, 260, 0]),
  F('greek yogurt 0', [59, 10.2, 3.6, 0.4, 0, 3.2, 36, 110, 0.1, 141, 0], 0, 15),
  F('greek yogurt', [97, 9, 4, 5, 0, 4, 35, 100, 0.1, 140, 0], 0, 15),
  F('yogurt', [61, 3.5, 4.7, 3.3, 0, 4.7, 46, 121, 0.1, 155, 0.5], 0, 15),
  F('labneh', [180, 7, 4, 15, 0, 4, 300, 120, 0.1, 150, 0], 0, 15),
  F('sour cream light', [133, 3.3, 6.7, 10.5, 0, 5, 70, 120, 0.1, 160, 0.5], 0, 15),
  F('sour cream', [198, 2.4, 4.6, 19.4, 0, 3.4, 31, 101, 0.1, 125, 0.9], 0, 15),
  F('light mayo', [250, 0.4, 7, 24, 0, 3, 800, 8, 0.2, 20, 0], 0, 15),
  F('mayo', [680, 1, 0.6, 75, 0, 0.6, 635, 8, 0.2, 20, 0], 0, 14),
  F('parmesan', [431, 38, 4.1, 29, 0, 0.9, 1529, 1184, 0.8, 92, 0], 0, 5),
  F('feta', [264, 14, 4, 21, 0, 4, 1116, 493, 0.7, 62, 0], 0, 10),
  F('cheddar', [403, 25, 1.3, 33, 0, 0.5, 621, 721, 0.7, 98, 0], 0, 7),
  F('mozzarella', [280, 28, 3, 17, 0, 1, 627, 505, 0.4, 76, 0], 0, 7),
  F('akkawi', [280, 20, 2, 21, 0, 1, 1000, 500, 0.4, 76, 0], 0, 7),
  F('cottage cheese', [98, 11, 3.4, 4.3, 0, 2.7, 364, 83, 0.1, 104, 0], 0, 15),
  F('milk', [61, 3.2, 4.8, 3.3, 0, 5, 43, 113, 0, 132, 0], 0, 15),
  F('butter', [717, 0.9, 0.1, 81, 0, 0.1, 11, 24, 0, 24, 0], 0, 14),
  F('olive oil', [884, 0, 0, 100, 0, 0, 2, 1, 0.6, 1, 0], 0, 13.5),
  F('oil', [884, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0], 0, 13.5),
  F('chickpea', [139, 7, 22.5, 2.8, 7.6, 0.4, 246, 43, 1.3, 172, 0.5], 240),
  F('black bean', [91, 6, 16.6, 0.3, 6.9, 0.3, 384, 35, 1.9, 308, 0], 240),
  F('kidney bean', [84, 5.2, 15.5, 0.6, 6.3, 1.9, 258, 40, 1.4, 260, 1], 240),
  F('lentil', [352, 24.6, 63, 1.1, 10.7, 2, 6, 35, 6.5, 677, 4.5], 0, 12),
  F('chopped tomato', [32, 1.6, 7.3, 0.3, 1.9, 4.4, 186, 34, 1, 191, 9], 400),
  F('tomato paste', [82, 4.3, 19, 0.5, 4.1, 12, 59, 36, 3, 1014, 22], 0, 16),
  F('basmati rice', [360, 7.5, 79, 0.6, 1.3, 0.1, 1, 10, 0.8, 115, 0], 0, 12),
  F('rice', [360, 6.6, 80, 0.6, 1.3, 0.1, 5, 9, 0.8, 86, 0], 0, 12),
  F('pasta', [371, 13, 75, 1.5, 3.2, 2.7, 6, 21, 3.3, 223, 0], 0, 10),
  F('rolled oat', [379, 13, 68, 6.5, 10, 1, 6, 52, 4.3, 362, 0], 0, 8),
  F('wholemeal tortilla', [300, 9, 46, 8, 7, 2, 600, 80, 3, 250, 0], 55),
  F('wholemeal saj', [300, 9, 46, 8, 7, 2, 600, 80, 3, 250, 0], 55),
  F('tortilla', [312, 8, 52, 8, 3.5, 2, 640, 120, 3.5, 140, 0], 55),
  F('wholemeal pita', [266, 9.8, 55, 2.6, 7.4, 1, 530, 15, 3.1, 170, 0], 60),
  F('pita', [275, 9, 55.7, 1.2, 2.2, 1.3, 536, 86, 2.6, 120, 0], 60),
  F('wholemeal bread', [252, 12.5, 43, 3.5, 6, 4.4, 450, 160, 2.5, 250, 0], 35),
  F('bread', [265, 9, 49, 3.2, 2.7, 5, 491, 260, 3.6, 115, 0], 35),
  F('potato', [77, 2, 17.5, 0.1, 2.2, 0.8, 6, 12, 0.8, 425, 19.7], 200),
  F('sweet potato', [86, 1.6, 20, 0.1, 3, 4.2, 55, 30, 0.6, 337, 2.4], 200),
  F('banana', [89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, 5, 0.3, 358, 8.7], 118),
  F('apple', [52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, 6, 0.1, 107, 4.6], 180),
  F('date', [282, 2.5, 75, 0.4, 8, 63, 2, 39, 1, 656, 0.4], 8),
  F('mango', [60, 0.8, 15, 0.4, 1.6, 13.7, 1, 11, 0.2, 168, 36], 200),
  F('berry', [57, 0.7, 14.5, 0.3, 2.4, 10, 1, 6, 0.3, 77, 9.7]),
  F('spinach', [23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, 99, 2.7, 558, 28], 0, 4),
  F('red pepper', [31, 1, 6, 0.3, 2.1, 4.2, 4, 7, 0.4, 211, 128], 120),
  F('pepper', [26, 1, 6, 0.3, 2, 3, 4, 10, 0.4, 175, 80], 120),
  F('onion', [40, 1.1, 9.3, 0.1, 1.7, 4.2, 4, 23, 0.2, 146, 7.4], 110),
  F('spring onion', [32, 1.8, 7.3, 0.2, 2.6, 2.3, 16, 72, 1.5, 276, 18.8], 15),
  F('garlic', [149, 6.4, 33, 0.5, 2.1, 1, 17, 181, 1.7, 401, 31], 3, 9),
  F('ginger', [80, 1.8, 18, 0.8, 2, 1.7, 13, 16, 0.6, 415, 5], 0, 6),
  F('tomato', [18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 10, 0.3, 237, 14], 120),
  F('cherry tomato', [18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, 10, 0.3, 237, 14], 17),
  F('cucumber', [15, 0.7, 3.6, 0.1, 0.5, 1.7, 2, 16, 0.3, 147, 2.8], 300),
  F('lettuce', [17, 1.2, 3.3, 0.3, 2.1, 1.2, 8, 33, 1, 247, 4], 300),
  F('broccoli', [34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, 47, 0.7, 316, 89], 300),
  F('carrot', [41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, 33, 0.3, 320, 5.9], 60),
  F('lemon juice', [22, 0.4, 6.9, 0.2, 0.3, 2.5, 1, 6, 0.1, 103, 38.7], 0, 15),
  F('lemon', [29, 1.1, 9.3, 0.3, 2.8, 2.5, 2, 26, 0.6, 138, 53], 60),
  F('parsley', [36, 3, 6.3, 0.8, 3.3, 0.9, 56, 138, 6.2, 554, 133], 0, 4),
  F('chive', [30, 3.3, 4.4, 0.7, 2.5, 1.9, 3, 92, 1.6, 296, 58], 0, 3),
  F('coriander', [23, 2.1, 3.7, 0.5, 2.8, 0.9, 46, 67, 1.8, 521, 27], 0, 4),
  F('honey', [304, 0.3, 82.4, 0, 0.2, 82, 4, 6, 0.4, 52, 0.5], 0, 21),
  F('sugar', [387, 0, 100, 0, 0, 100, 1, 1, 0, 2, 0], 0, 12.5),
  F('soy sauce', [53, 8, 4.9, 0.6, 0.8, 0.4, 5493, 33, 1.5, 435, 0], 0, 16),
  F('salsa', [36, 1.5, 7, 0.2, 1.9, 4, 711, 30, 0.4, 275, 4], 0, 16),
  F('dijon mustard', [66, 4.4, 5.8, 4, 3.3, 0.9, 1135, 58, 1.6, 138, 0.3], 0, 15),
  F('mustard', [66, 4.4, 5.8, 4, 3.3, 0.9, 1135, 58, 1.6, 138, 0.3], 0, 15),
  F('hot sauce', [11, 0.5, 1.8, 0.4, 0.3, 1.3, 2643, 8, 0.5, 144, 75], 0, 15),
  F('chipotle sauce', [40, 1, 7, 1, 1, 3, 1500, 20, 1, 200, 5], 0, 15),
  F('worcestershire sauce', [78, 0, 19.5, 0, 0, 10, 980, 107, 5.3, 800, 13], 0, 15),
  F('bbq sauce', [172, 0.8, 41, 0.6, 0.9, 33, 1027, 33, 0.6, 232, 0.6], 0, 17),
  F('curry powder', [325, 14, 58, 14, 33, 2.8, 52, 525, 19, 1543, 0.7], 0, 6),
  F('paprika', [282, 14, 54, 13, 35, 10, 68, 229, 21, 2280, 0.9], 0, 7),
  F('cumin', [375, 18, 44, 22, 10.5, 2.3, 168, 931, 66, 1788, 7.7], 0, 6),
  F('garlic powder', [331, 17, 73, 0.7, 9, 2.4, 60, 79, 5.7, 1193, 1.2], 0, 9),
  F('onion powder', [341, 10, 79, 1, 15, 6.6, 73, 384, 3.9, 985, 23], 0, 7),
  F('chilli flake', [318, 12, 57, 17, 27, 10, 30, 148, 7.8, 2014, 76], 0, 6),
  F('black pepper', [251, 10, 64, 3.3, 25, 0.6, 20, 443, 9.7, 1329, 0], 0, 7),
  F('kabsa spice', [300, 12, 55, 10, 25, 3, 50, 400, 15, 1500, 5], 0, 6),
  F('mandi spice', [300, 12, 55, 10, 25, 3, 50, 400, 15, 1500, 5], 0, 6),
  F('za atar', [250, 9, 45, 10, 25, 2, 300, 900, 30, 900, 5], 0, 6),
  F('stock cube', [250, 10, 25, 15, 0, 5, 24000, 50, 1, 300, 0], 10),
  F('baking powder', [53, 0, 28, 0, 0.2, 0, 10600, 5876, 11, 20, 0], 0, 14),
  F('chia seed', [486, 16.5, 42, 30.7, 34.4, 0, 16, 631, 7.7, 407, 1.6], 0, 12),
  F('peanut butter', [588, 25, 20, 50, 6, 9, 17, 49, 1.9, 649, 0], 0, 16),
  F('hummus', [166, 8, 14, 9.6, 6, 0.3, 379, 38, 2.4, 228, 0], 0, 15),
  F('water', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 15),
  F('salt', [0, 0, 0, 0, 0, 0, 38758, 24, 0.3, 8, 0], 0, 18),
];
export const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'sodium', 'calcium', 'iron', 'potassium', 'vitc'];
/** A man's daily need (adult, EU/US reference values) for the % bars. Sugar has no need: shown in grams only. */
export const DAILY = { kcal: 2500, protein: 0, carbs: 0, fat: 0, fibre: 30, sugar: 0, sodium: 2300, calcium: 1000, iron: 8, potassium: 3400, vitc: 90 };
export const MICROS = [['sodium', 'Sodium', 'mg'], ['sugar', 'Sugar', 'g'], ['calcium', 'Calcium', 'mg'], ['iron', 'Iron', 'mg'], ['potassium', 'Potassium', 'mg'], ['vitc', 'Vitamin C', 'mg']];
export const FOODS = TABLE.map(([n]) => n);

const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sing = (w) => w.replace(/(?<=[a-z]{2})(o|s|x|ch|sh)es$/, '$1').replace(/ies$/, 'y').replace(/(?<=[a-z]{2}[^s])s$/, '');
const BY = new Map(TABLE.map(r => [r[0], r]));
const SORTED = [...TABLE].sort((a, b) => b[0].length - a[0].length);
/** The food-table row for an ingredient name (or its chosen match), else null. "boneless chicken thighs" → chicken thigh. */
export function match(name, chosen = '') {
  if (chosen && BY.has(chosen)) return BY.get(chosen);
  const n = norm(name).split(' ').map(sing).join(' ');
  if (BY.has(n)) return BY.get(n);
  if (/greek yogurt/.test(n) && /\b0\b|fat free|non ?fat|zero/.test(n)) return BY.get('greek yogurt 0');
  if (/sour cream/.test(n) && /light|low/.test(n)) return BY.get('sour cream light');
  if (/mayo/.test(n) && /light|low/.test(n)) return BY.get('light mayo');
  for (const r of SORTED) if ((' ' + n + ' ').includes(' ' + r[0] + ' ')) return r;
  return null;
}
/** Grams of an ingredient: g/kg/ml/l by weight, tbsp/tsp/cup by the food's own spoon weight, pieces by its piece weight. */
export function gramsOf(ing, row) {
  const q = +ing.qty || 0, u = ing.unit || '', tb = row?.[3] || 15;
  if (!q) return 0;
  if (u === 'g') return q; if (u === 'kg') return q * 1000; if (u === 'ml') return q * (row?.[0] === 'honey' ? 1.4 : row?.[0]?.includes('oil') ? 0.92 : 1); if (u === 'l') return q * 1000;
  if (u === 'tbsp') return q * tb; if (u === 'tsp') return q * tb / 3; if (u === 'cup') return q * tb * 16; if (u === 'pinch') return q * 0.4;
  if (u === 'pcs' || !u) return q * (row?.[2] || 0);
  return 0;
}
/** Totals for a recipe and per portion. matched = ingredients with a food row and a weight; `share` of all that carry a quantity. */
export function ofRecipe(r, { servings = r.serves || 1 } = {}) {
  const lines = [], tot = Object.fromEntries(KEYS.map(k => [k, 0]));
  let counted = 0, withQty = 0;
  for (const i of r.ingredients || []) {
    const row = match(i.item, i.food), g = row ? gramsOf(i, row) : 0, has = +i.qty > 0;
    if (has) withQty++;
    const v = Object.fromEntries(KEYS.map((k, j) => [k, row && g ? row[1][j] * g / 100 : 0]));
    if (row && g) { counted++; for (const k of KEYS) tot[k] += v[k]; }
    lines.push({ ing: i, food: row?.[0] || '', grams: Math.round(g), ...v, missing: has && (!row || !g) });
  }
  const per = Object.fromEntries(KEYS.map(k => [k, tot[k] / (r.serves || 1)]));
  const energy = per.protein * 4 + per.carbs * 4 + per.fat * 9 || 1;
  return { total: tot, per, lines, counted, withQty, share: withQty ? counted / withQty : 0, split: { protein: per.protein * 4 / energy, carbs: per.carbs * 4 / energy, fat: per.fat * 9 / energy }, servings };
}
/** What to show: computed from the ingredients when most are counted, else the recipe's own figures (kcal, protein, fibre). */
export function best(r) {
  const n = ofRecipe(r);
  if (n.share >= 0.7 && n.per.kcal > 0) return { ...n, source: 'ingredients' };
  const own = { kcal: r.kcal || 0, protein: r.protein || 0, fibre: r.fibre || 0 };
  return { ...n, per: { ...Object.fromEntries(KEYS.map(k => [k, null])), ...Object.fromEntries(Object.entries(own).map(([k, v]) => [k, v || null])) }, source: 'recipe' };
}
export const round = (k, v) => v == null ? null : k === 'kcal' || ['sodium', 'calcium', 'potassium'].includes(k) ? Math.round(v) : Math.round(v * 10) / 10;
