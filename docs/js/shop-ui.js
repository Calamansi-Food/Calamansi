// Shop tab: the shopping list (by aisle, filled from the week's meals on a tap) and the fridge — what is in the fridge, freezer
// and cupboard, what to use first, and recipes that use it up. Ticking an item can put it in the fridge list.
import { h, toast, keyOf, fromKey, addDays, relDay, fmtDate } from './util.js';
import * as K from './kitchen.js';
import * as CZ from './custom.js';

let ctx = null;
export function initShop(c) { ctx = c; }
const S = () => ctx.S();
const cfg = () => CZ.custom(S());
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
let seg = 'list';
export function shopPart(p) { if (['list', 'fridge'].includes(p)) seg = p; }

export function renderShop() {
  const s = S(), open = K.openShop(s).length, soon = K.useFirst(s).length;
  return [h('h1', {}, 'Shop'), h('div', { class: 'seg', role: 'tablist' }, [['list', `List${open ? ` (${open})` : ''}`], ['fridge', `Fridge${soon ? ` · ${soon} to use` : ''}`]].map(([id, l]) => h('button', { class: seg === id ? 'active' : '', role: 'tab', 'aria-selected': String(seg === id), onClick: () => { seg = id; ctx.render(); } }, l))),
    ...(seg === 'fridge' ? fridgeView() : listView())];
}

// ───────────────────────── the list
function addRow(placeholder, onAdd) {
  const inp = h('input', { class: 'inp', placeholder, maxlength: 70, enterkeyhint: 'done', 'aria-label': placeholder, onKeydown: (e) => { if (e.key === 'Enter') go(); } });
  const go = () => { const v = inp.value.trim(); if (!v) return; onAdd(v); inp.value = ''; setTimeout(() => document.querySelector('.sp-add input')?.focus({ preventScroll: true }), 30); };
  return h('div', { class: 'row sp-add' }, inp, h('button', { class: 'btn primary', onClick: go }, 'Add'));
}
function weekRange() { const c = cfg(), now = new Date(); return [keyOf(now), keyOf(addDays(now, c.kitchen.days - 1))]; }
function listView() {
  const s = S(), list = K.shopList(s), [a, b] = weekRange(), need = K.neededFor(s, a, b, { staples: cfg().kitchen.staples });
  const out = [addRow('Add something: “2 kg rice”, “milk”', (v) => { const p = K.parseIngredient(v) || { item: v }; ctx.update(st => K.addShop(st, { name: p.item, qty: p.qty, unit: p.unit })); ctx.render(); })];
  if (need.length) out.push(h('div', { class: 'card sp-need' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', {}, `The planned meals need ${plural(need.length, 'more thing')}`), h('div', { class: 'tiny dim' }, `${need.slice(0, 5).map(x => x.name).join(', ')}${need.length > 5 ? '…' : ''} — what the fridge already has is left out.`)), h('button', { class: 'btn primary', onClick: () => needSheet(need) }, 'Review'))));
  if (!list.length) { out.push(h('div', { class: 'card empty' }, 'The list is empty.', h('div', { class: 'tiny dim' }, 'Plan meals in Kitchen, then add what they need here in one tap.'))); return out; }
  const groups = new Map(); for (const x of list.filter(x => !x.done)) (groups.get(x.cat) || groups.set(x.cat, []).get(x.cat)).push(x);
  for (const [cat, items] of groups) out.push(h('div', { class: 'card sp-cat' }, h('div', { class: 'title' }, `${K.catIcon(cat)} ${K.catName(cat)}`), items.map(itemRow)));
  const done = list.filter(x => x.done);
  if (done.length) out.push(h('div', { class: 'card sp-cat done' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, `In the basket (${done.length})`), h('button', { class: 'btn sm', onClick: () => { const before = S(); ctx.update(st => K.clearDone(st)); ctx.render(); toast('Cleared', '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Clear')), done.map(itemRow)));
  out.push(h('div', { class: 'row wrap', style: { margin: '4px 0 12px' } }, h('button', { class: 'btn sm', onClick: shareList }, '↗ Share the list'), h('span', { class: 'tiny dim grow' }, cfg().kitchen.toPantry ? 'Ticked things go to the fridge list too.' : '')));
  return out;
}
function itemRow(x) {
  const s = S(), meta = [x.qty ? K.qtyText(x.qty, x.unit) : '', x.for?.length ? `for ${[...new Set(x.for.map(id => s.meals?.[id]).filter(Boolean).map(m => K.mealTitle(s, m)))].slice(0, 2).join(', ')}` : ''].filter(Boolean).join(' · ');
  const tick = () => {
    const before = S(), now = new Date(), toP = cfg().kitchen.toPantry && !x.done;
    ctx.update(st => { let o = K.updateShop(st, x.id, { done: !x.done }); if (toP) o = K.boughtToPantry(o, x.id, now); return o; }); ctx.render();
    if (toP && x.cat !== 'home') toast(`${x.name} → fridge list`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
  };
  return h('div', { class: `sp-row ${x.done ? 'done' : ''}` }, h('button', { class: `sp-tick ${x.done ? 'on' : ''}`, role: 'checkbox', 'aria-checked': String(!!x.done), 'aria-label': x.name, onClick: tick }, x.done ? '✓' : ''),
    h('div', { class: 'grow sp-main', onClick: tick }, h('div', { class: 'name' }, x.name), meta ? h('div', { class: 'tiny dim' }, meta) : null),
    h('button', { class: 'btn sm ghost', 'aria-label': `Edit ${x.name}`, onClick: () => editItem(x) }, '⋯'));
}
function editItem(x) {
  const n = h('input', { value: x.name, maxlength: 60 }), q = h('input', { type: 'number', min: 0, step: 'any', value: x.qty || '', inputmode: 'decimal' }), u = h('select', {}, ['', ...K.UNITS].map(v => h('option', { value: v, selected: (x.unit || '') === v }, v || '—'))), c = h('select', {}, K.CATS.map(([id, l]) => h('option', { value: id, selected: x.cat === id }, l)));
  const box = ctx.sheet([h('h2', {}, 'Shopping item'), field('What', n), h('div', { class: 'grid3' }, field('Amount', q), field('Unit', u), field('Aisle', c)),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { if (!n.value.trim()) return; ctx.update(st => K.updateShop(st, x.id, { name: n.value, qty: q.value, unit: u.value, cat: c.value })); box.close(); ctx.render(); } }, 'Save'),
      h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => K.removeShop(st, x.id)); box.close(); ctx.render(); toast(`${x.name} removed`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Remove'))]);
}
function needSheet(need) {
  const rows = need.map(x => ({ x, on: true }));
  const box = ctx.sheet([h('h2', {}, 'For the planned meals'), h('div', { class: 'small muted' }, 'Scaled to the portions you planned; what the fridge list already has is left out. Untick what you have anyway.'),
    h('div', { class: 'sp-needlist' }, rows.map(r => h('label', { class: 'kt-pick' }, h('input', { type: 'checkbox', checked: true, onChange: (e) => { r.on = e.target.checked; } }), h('span', { class: 'grow' }, `${K.catIcon(r.x.cat)} ${r.x.name}`, h('span', { class: 'tiny dim' }, ` · ${[r.x.qty ? K.qtyText(r.x.qty, r.x.unit) : '', r.x.recipes.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}`))))),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const pick = rows.filter(r => r.on).map(r => r.x); if (!pick.length) return box.close(); const before = S(); ctx.update(st => K.addNeeded(st, pick)); box.close(); ctx.render(); toast(`${plural(pick.length, 'thing')} on the list`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Add to the list'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
}
async function shareList() {
  const open = K.openShop(S()); if (!open.length) return toast('Nothing on the list');
  const groups = new Map(); for (const x of open) (groups.get(x.cat) || groups.set(x.cat, []).get(x.cat)).push(x);
  const text = `🛒 Shopping list (${fmtDate(new Date())})\n` + [...groups].map(([cat, items]) => `\n${K.catName(cat)}\n${items.map(x => `• ${x.name}${x.qty ? ` — ${K.qtyText(x.qty, x.unit)}` : ''}`).join('\n')}`).join('\n');
  try { if (navigator.share) { await navigator.share({ title: 'Shopping list', text }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('List copied — paste it into WhatsApp', 'ok'); } catch { ctx.sheet([h('h2', {}, 'Shopping list'), h('textarea', { class: 'inp', rows: 12, readonly: true }, text)]); }
}

// ───────────────────────── the fridge
const leftText = (f, now = new Date()) => { const d = K.daysLeft(f, now); return d === null ? 'no date' : d < 0 ? `${-d} day${d === -1 ? '' : 's'} past` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d} days`; };
const leftCls = (f) => { const d = K.daysLeft(f); return d === null ? '' : d < 0 ? 'late' : d <= 2 ? 'soon' : ''; };
function fridgeView() {
  const s = S(), now = new Date(), first = K.useFirst(s, now), all = K.foodList(s);
  const out = [addRow('Add to the fridge: “6 eggs”, “chicken 500 g”', (v) => { const p = K.parseIngredient(v) || { item: v }; ctx.update(st => K.addFood(st, { name: p.item, qty: p.qty, unit: p.unit }, now)); ctx.render(); })];
  if (first.length) {
    const own = cfg().kitchen.machines, names = first.map(f => K.normName(f.name));
    const ideas = K.recipeList(s).filter(r => K.cookable(r, own) && r.ingredients.some(i => names.some(n => n && (K.normName(i.item).includes(n) || n.includes(K.normName(i.item)))))).slice(0, 4);
    out.push(h('div', { class: 'card sp-first' }, h('div', { class: 'title' }, 'Use these first'), first.map(f => foodRow(f)),
      ideas.length ? h('div', { class: 'sp-ideas' }, h('div', { class: 'tiny dim' }, 'Recipes that use them'), h('div', { class: 'chips' }, ideas.map(r => h('button', { class: 'chip', onClick: () => ctx.recipeSheet(r) }, `${r.icon} ${r.title}`)))) : null));
  }
  if (!all.length) { out.push(h('div', { class: 'card empty' }, 'Nothing in the fridge list yet.', h('div', { class: 'tiny dim' }, 'Add what you have, or tick things off the shopping list: they land here with a best-before guess.'))); return out; }
  for (const [w, label, icon] of K.WHERE) { const items = all.filter(f => f.where === w && !first.includes(f)); if (items.length) out.push(h('div', { class: 'card sp-cat' }, h('div', { class: 'title' }, `${icon} ${label} (${items.length})`), items.map(f => foodRow(f)))); }
  return out;
}
function foodRow(f) {
  const used = () => { const before = S(); ctx.update(st => K.removeFood(st, f.id)); ctx.render(); toast(`${f.name} used up`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  return h('div', { class: 'sp-row' }, h('div', { class: 'grow sp-main', role: 'button', tabindex: '0', onClick: () => foodSheet(f), onKeydown: (e) => { if (e.key === 'Enter') foodSheet(f); } }, h('div', { class: 'name' }, f.name), h('div', { class: 'tiny dim' }, [f.qty ? K.qtyText(f.qty, f.unit) : '', f.expires ? `best before ${fmtDate(fromKey(f.expires)).slice(0, 5)}` : ''].filter(Boolean).join(' · '))),
    h('span', { class: `chip sp-left ${leftCls(f)}` }, leftText(f)), h('button', { class: 'btn sm', 'aria-label': `${f.name} used up`, onClick: used }, 'Used'));
}
function foodSheet(f) {
  const n = h('input', { value: f.name, maxlength: 60 }), q = h('input', { type: 'number', min: 0, step: 'any', value: f.qty || '', inputmode: 'decimal' }), u = h('select', {}, ['', ...K.UNITS].map(v => h('option', { value: v, selected: (f.unit || '') === v }, v || '—')));
  const w = h('select', {}, K.WHERE.map(([id, l]) => h('option', { value: id, selected: f.where === id }, l))), e = h('input', { type: 'date', value: f.expires || '' });
  const box = ctx.sheet([h('h2', {}, f.name), f.fromMeal ? h('div', { class: 'small muted' }, 'Cooked portions from a batch.') : null, field('What', n), h('div', { class: 'grid3' }, field('Amount', q), field('Unit', u), field('Where', w)), field('Best before', e),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { if (!n.value.trim()) return; ctx.update(st => K.updateFood(st, f.id, { name: n.value, qty: q.value, unit: u.value, where: w.value, expires: e.value })); box.close(); ctx.render(); } }, 'Save'),
      h('button', { class: 'btn', onClick: () => { const before = S(); ctx.update(st => K.addShop(K.removeFood(st, f.id), { name: f.fromMeal ? f.name.replace(/ \(cooked\)$/, '') : f.name, cat: f.cat })); box.close(); ctx.render(); toast(`${f.name}: used up and on the list`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Used up · buy again'),
      h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => K.removeFood(st, f.id)); box.close(); ctx.render(); toast(`${f.name} removed`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Remove'))]);
}
