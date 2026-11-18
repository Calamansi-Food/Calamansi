// The one nutrition view of Calamansi, the same everywhere so the eye learns it:
//   💰 cost · 🔥 kcal · 💪 protein · 🍚 carbs · 🥑 fat · 🌿 fibre   (always this order, always these colours)
//   an energy bar (protein / carbs / fat share of the calories), then the micros with a bar against a man's daily need.
// strip(r) is the one-line version for cards; panel(r) the full one; nutritionSheet(r) the interactive editor (change any
// amount, swap what an ingredient counts as, change portions — everything updates live; Save writes it back).
import { h, toast } from './util.js';
import * as K from './kitchen.js';
import * as N from './nutrition.js';

let ctx = null;
export function initNutri(c) { ctx = c; }
const S = () => ctx.S();
export const TILES = [['cost', '💰', 'SAR'], ['kcal', '🔥', 'kcal'], ['protein', '💪', 'protein'], ['carbs', '🍚', 'carbs'], ['fat', '🥑', 'fat'], ['fibre', '🌿', 'fibre']];
const fmt = (k, v) => v == null ? '—' : k === 'cost' ? `${v}` : k === 'kcal' ? `${Math.round(v)}` : `${Math.round(v * 10) / 10}`;
const unit = (k) => k === 'cost' || k === 'kcal' ? '' : ' g';

/** Numbers for a recipe at its own portion size: computed from the ingredients when most are counted, else its own figures. */
export function numbers(r) {
  const b = N.best(r), c = K.recipeCost(S(), r);
  return { ...b.per, cost: c ? c.perPortion : null, costEstimate: c?.estimate, split: b.split, source: b.source, share: b.share, lines: b.lines };
}
/** One line for cards and lists: 💰 8.4 · 🔥 515 · 💪 38.5 · 🌿 9.4 — same order and colours as the panel. */
export function strip(r, { all = false } = {}) {
  const n = numbers(r), keys = all ? TILES : TILES.filter(([k]) => ['cost', 'kcal', 'protein', 'fibre'].includes(k));
  if (keys.every(([k]) => n[k] == null)) return null;
  return h('div', { class: 'nu-strip', 'aria-label': 'Per portion: ' + keys.map(([k, , l]) => `${l} ${fmt(k, n[k])}`).join(', ') }, keys.map(([k, ic]) => n[k] == null ? null : h('span', { class: `nu-s nu-${k}` }, ic, ' ', fmt(k, n[k]), k === 'cost' ? '' : k === 'kcal' ? '' : 'g')));
}
/** The full panel: six tiles, the energy bar, the micros. onOpen → tapping it opens the interactive sheet. */
export function panel(r, { onOpen = null, live = null } = {}) {
  const n = live || numbers(r);
  const tile = ([k, ic, l]) => h('div', { class: `nu-t nu-${k}` }, h('span', { class: 'nu-ic' }, ic), h('b', {}, fmt(k, n[k]), h('small', {}, unit(k))), h('span', { class: 'nu-l' }, k === 'cost' ? (n.costEstimate ? 'SAR ≈' : 'SAR') : l));
  const sp = n.split || { protein: 0, carbs: 0, fat: 0 };
  const bar = n.kcal ? h('div', { class: 'nu-bar', role: 'img', 'aria-label': `Energy: ${Math.round(sp.protein * 100)}% protein, ${Math.round(sp.carbs * 100)}% carbs, ${Math.round(sp.fat * 100)}% fat` },
    ['protein', 'carbs', 'fat'].map(k => h('i', { class: `nu-${k}`, style: { width: `${Math.round((sp[k] || 0) * 100)}%` } }, sp[k] >= 0.12 ? `${Math.round(sp[k] * 100)}%` : ''))) : null;
  const micro = ([k, l, u]) => { const v = n[k], d = N.DAILY[k], pct = v != null && d ? Math.min(100, Math.round(v / d * 100)) : null;
    return h('div', { class: `nu-m ${k === 'sodium' && pct >= 40 ? 'hi' : ''}` }, h('span', { class: 'nu-ml' }, l), h('b', {}, v == null ? '—' : `${N.round(k, v)} ${u}`), pct != null ? h('span', { class: 'nu-mb' }, h('i', { style: { width: `${pct}%` } })) : h('span', { class: 'nu-mb none' }), h('span', { class: 'nu-mp' }, pct != null ? `${pct}%` : ''));
  };
  const el = h('div', { class: `nu-panel ${onOpen ? 'tap' : ''}`, ...(onOpen ? { role: 'button', tabindex: '0', onClick: onOpen, onKeydown: (e) => { if (e.key === 'Enter') onOpen(); } } : {}) },
    h('div', { class: 'nu-tiles' }, TILES.map(tile)), bar,
    n.source === 'ingredients' || live ? h('div', { class: 'nu-micros' }, N.MICROS.map(micro)) : null,
    h('div', { class: 'nu-foot tiny dim' }, n.source === 'ingredients' || live ? `Per portion · from the ingredients${n.share < 1 ? ` (${Math.round(n.share * 100)}% counted)` : ''} · % of a man’s daily need` : 'Per portion · the recipe’s own figures — add amounts to the ingredients for the full breakdown', onOpen ? h('span', { class: 'nu-open' }, ' · tap to edit ›') : null));
  return el;
}

/** The interactive nutrition editor: change amounts, what an ingredient counts as, the portions; Save writes it to the recipe. */
export function nutritionSheet(r, { onSaved } = {}) {
  let ings = r.ingredients.map(i => ({ ...i })), serves = r.serves || 1;
  const top = h('div'), list = h('div', { class: 'nu-lines' }), servesEl = h('b', {}, String(serves));
  const calc = () => { const n = N.ofRecipe({ ...r, ingredients: ings, serves }); const c = K.recipeCost(S(), { ...r, ingredients: ings, serves }); return { ...n.per, cost: c ? c.perPortion : null, costEstimate: c?.estimate, split: n.split, share: n.share, lines: n.lines, source: 'ingredients' }; };
  const paintTop = () => { const n = calc(); top.replaceChildren(panel(r, { live: n })); return n; };
  const paint = () => {
    const n = paintTop();
    list.replaceChildren(...n.lines.map((l, idx) => {
      const i = ings[idx], qty = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: i.qty || '', 'aria-label': `Amount of ${i.item}` });
      qty.addEventListener('input', () => { ings[idx] = { ...ings[idx], qty: +qty.value || 0 }; const m = paintTop(); const ln = m.lines[idx]; row.querySelector('.nu-li-n').textContent = lineText(ln); });
      const pick = h('select', { class: 'nu-pick', 'aria-label': `What ${i.item} counts as` }, [h('option', { value: '' }, l.food ? `= ${l.food}` : '— not counted —'), ...N.FOODS.map(f => h('option', { value: f, selected: i.food === f }, f))]);
      pick.addEventListener('change', () => { ings[idx] = { ...ings[idx], food: pick.value }; paint(); });
      const row = h('div', { class: `nu-li ${l.missing ? 'miss' : ''}` }, h('span', { class: 'grow' }, h('b', { class: 'small' }, i.item), h('span', { class: 'nu-li-n tiny dim' }, lineText(l))), qty, h('span', { class: 'tiny dim nu-u' }, i.unit || 'pcs'), pick);
      return row;
    }));
  };
  const lineText = (l) => l.missing ? ' · not counted: pick what it is →' : l.grams ? ` · ${l.grams} g · ${Math.round(l.kcal)} kcal · ${Math.round(l.protein * 10) / 10} g P · ${Math.round(l.fibre * 10) / 10} g fibre` : ' · to taste';
  const step = (d) => { serves = Math.max(1, Math.min(20, serves + d)); servesEl.textContent = String(serves); paintTop(); };
  paint();
  const box = ctx.sheet([h('h2', {}, `🔬 ${r.title}`), top,
    h('div', { class: 'row nu-serves' }, h('span', { class: 'grow small' }, 'Split into'), h('button', { class: 'btn sm', 'aria-label': 'Fewer portions', onClick: () => step(-1) }, '−'), servesEl, h('button', { class: 'btn sm', 'aria-label': 'More portions', onClick: () => step(1) }, '+'), h('span', { class: 'small' }, ' portions')),
    h('div', { class: 'title', style: { marginTop: '8px' } }, 'Ingredients — change any amount'), list,
    h('div', { class: 'tiny dim' }, 'Values are approximate, from standard food tables; a packet’s own label wins. Salt, oil and spices “to taste” are not counted unless they have an amount.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      const n = calc(), before = S();
      const patch = { ingredients: ings, serves, ...(n.share >= 0.7 ? { kcal: Math.round(n.kcal), protein: Math.round(n.protein), fibre: Math.round(n.fibre) } : {}) };
      ctx.update(st => K.saveRecipe(st, { ...st.recipes[r.id], ...patch })); box.close(); ctx.render(); onSaved?.(); toast('Recipe updated', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
    } }, 'Save to the recipe'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Close'))]);
  box.box.classList.add('ch-sheet', 'nu-sheet');
}
