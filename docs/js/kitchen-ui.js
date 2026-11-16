// Kitchen tab: the week's meals around your shifts (with a proposal you accept), recipes with per-machine times and temperatures,
// the recipe editor, and the meal sheet. Every change goes through ctx.update; deletes and plans have Undo.
import { h, toast, keyOf, fromKey, addDays, startOfDay, relDay, fmtDate, DAY_SHORT, DAY_NAMES } from './util.js';
import * as K from './kitchen.js';
import * as CZ from './custom.js';
import * as D from './day.js';

let ctx = null;
export function initKitchen(c) { ctx = c; }
const S = () => ctx.S();
const cfg = () => CZ.custom(S());
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dayTitle = (d, now = new Date()) => { const r = relDay(d, now); return /^(Today|Tomorrow|Yesterday)$/.test(r) ? `${r} · ${DAY_SHORT[d.getDay()]} ${fmtDate(d).slice(0, 5)}` : `${DAY_NAMES[d.getDay()]} ${fmtDate(d).slice(0, 5)}`; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const kindCls = (k) => ({ day: 'D', evening: 'E', night: 'N', 'first-night': 'N', postnight: 'post', off: 'off', leave: 'leave' }[k] || 'unk');

let seg = 'week', query = '', filter = 'all', lastPlan = null;
export function kitchenPart(p) { if (['week', 'recipes'].includes(p)) seg = p; }

// ───────────────────────── tab
export function renderKitchen() {
  const out = [h('h1', {}, 'Kitchen'), h('div', { class: 'seg', role: 'tablist' }, [['week', 'This week'], ['recipes', `Recipes (${K.recipeList(S()).length})`]].map(([id, l]) => h('button', { class: seg === id ? 'active' : '', role: 'tab', 'aria-selected': String(seg === id), onClick: () => { seg = id; ctx.render(); } }, l)))];
  return out.concat(seg === 'recipes' ? recipesView() : weekView());
}

/** The proposal for the coming days, kept between renders while nothing changed. */
export function currentPlan(now = new Date()) {
  const c = cfg(), s = S(), sig = `${s.updatedAt}|${keyOf(now)}|${now.getHours()}`;
  if (lastPlan?.sig === sig) return lastPlan.plan;
  const plan = K.planWeek(s, { from: now, days: c.kitchen.days, owned: c.kitchen.machines, diet: c.diet, now });
  lastPlan = { sig, plan }; return plan;
}

function weekView() {
  const s = S(), now = new Date(), plan = currentPlan(now), c = cfg();
  const empty = plan.days.reduce((n, d) => n + d.slots.filter(x => !x.meal && !x.past && x.pick).length, 0);
  const out = [];
  if (!K.recipeList(s).length) {
    out.push(h('div', { class: 'card hero kt-hero' }, h('div', { class: 'title' }, 'Start with some recipes'), h('div', { class: 'small' }, `${K.STARTERS.length} simple ones come ready, each with air-fryer, oven or microwave times and temperatures. Add them, then the planner can fill your week around your shifts.`),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onClick: () => addStarters() }, `Add the ${K.STARTERS.length} starter recipes`), h('button', { class: 'btn', onClick: () => recipeEditor(null) }, '+ My own'))));
    return out;
  }
  out.push(h('div', { class: 'card hero kt-hero' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, `Next ${c.kitchen.days} days`), h('div', { class: 'small' }, empty ? `${plural(empty, 'meal')} still open. The planner fits them to your shifts: quick on 12-hour days, packed for nights, light before sleep.` : 'Every meal is planned.')),
      empty ? h('button', { class: 'btn primary', onClick: () => planSheet(plan) }, 'Plan my week') : null),
    plan.batches.length ? h('div', { class: 'kt-batches' }, plan.batches.map(b => { const r = s.recipes?.[b.recipeId]; return h('div', { class: 'kt-batch' }, h('span', { class: 'kt-bi' }, r?.icon || '🍱'), h('div', { class: 'grow' }, h('b', {}, `${dayTitle(fromKey(b.key), now)}: batch-cook ${r?.title || ''}`), h('div', { class: 'tiny dim' }, b.why))); })) : null));
  for (const d of plan.days) out.push(dayCard(d, now));
  out.push(h('div', { class: 'tiny dim', style: { margin: '4px 2px 10px' } }, D.shiftOn(now).status === 'unknown' && !ctx.hasShifts() ? 'Your shifts come from Mandarin. Until it shares them, every day is planned like a day off.' : 'Shifts from Mandarin. Tap a meal to change it, cook it or remove it.'));
  return out;
}
function dayCard(d, now) {
  const s = S(), c = cfg(), tot = K.dayTotals(s, d.key), sh = d.dk.shift;
  const head = h('div', { class: 'row kt-dayhead' }, h('div', { class: 'grow' }, h('b', {}, dayTitle(d.date, now)), h('span', { class: `chip kd ${kindCls(d.dk.kind)}` }, d.dk.kind === 'off' || d.dk.kind === 'unknown' ? d.label : `${d.label}${sh.status === 'work' ? ` · ${D.shiftText(sh)}` : ''}`)),
    (c.diet.kcal || c.diet.protein) && tot.known ? h('span', { class: 'tiny dim' }, [c.diet.kcal ? `${tot.kcal}/${c.diet.kcal} kcal` : '', c.diet.protein ? `${tot.protein}/${c.diet.protein} g protein` : ''].filter(Boolean).join(' · ')) : null);
  const extra = K.mealsOn(s, d.key).filter(m => !d.slots.some(x => x.slot === m.slot));
  const rows = [...d.slots.map(x => slotRow(d, x)), ...extra.map(m => slotRow(d, { slot: m.slot, at: null, meal: m, need: 'main', why: '' }))];
  return h('div', { class: `card kt-day ${d.key === keyOf(now) ? 'today' : ''}` }, head, h('div', { class: 'kt-slots' }, rows));
}
function slotRow(d, x) {
  const s = S(), m = x.meal;
  const label = h('div', { class: 'kt-slot' }, h('b', {}, K.slotName(x.slot)), x.at != null ? h('span', { class: 'tiny dim' }, hm(x.at)) : null);
  if (m) return h('div', { class: `kt-row has ${m.cooked ? 'cooked' : ''}`, role: 'button', tabindex: '0', onClick: () => mealSheet(m), onKeydown: (e) => { if (e.key === 'Enter') mealSheet(m); } }, label,
    h('div', { class: 'grow kt-what' }, h('span', { class: 'kt-ic' }, K.mealIcon(s, m)), h('span', { class: 'kt-t' }, K.mealTitle(s, m)), m.fromBatch ? h('span', { class: 'chip tiny-chip' }, 'from the batch') : m.batch ? h('span', { class: 'chip tiny-chip' }, `batch ×${m.servings}`) : m.packed ? h('span', { class: 'chip tiny-chip' }, 'packed') : null),
    m.cooked ? h('span', { class: 'kt-done', 'aria-label': 'cooked' }, '✓') : null);
  if (x.past) return h('div', { class: 'kt-row past' }, label, h('div', { class: 'grow tiny dim' }, '—'));
  const r = x.pick && s.recipes?.[x.pick.recipeId];
  return h('div', { class: 'kt-row open' }, label,
    h('button', { class: 'grow kt-sug', onClick: () => pickSheet(d.key, x) }, r ? [h('span', { class: 'kt-ic' }, r.icon), h('span', { class: 'kt-t' }, r.title), h('span', { class: 'tiny dim kt-why' }, [x.why, ...(x.pick.why || [])].filter(Boolean).slice(0, 2).join(' · '))] : h('span', { class: 'tiny dim' }, x.why || 'Choose…')),
    r ? h('button', { class: 'btn sm', 'aria-label': `Use ${r.title} for ${K.slotName(x.slot)}`, onClick: () => useOne(d, x) }, '＋') : null);
}
function useOne(d, x) {
  const before = S(), plan = currentPlan();
  const r = K.applyPlan(before, plan, { only: [`${d.key}|${x.slot}`] });
  if (!r.ids.length) return;
  ctx.update(() => r.state); ctx.render();
  toast(`${K.slotName(x.slot)} ${relDay(d.date).toLowerCase()}: ${K.mealTitle(S(), S().meals[r.ids[0]])}`, 'ok', { action: { label: 'Undo', run: () => { ctx.update(s => r.ids.reduce((a, id) => K.deleteMeal(a, id), s)); ctx.render(); } } });
}

// ───────────────────────── the proposal
function planSheet(plan) {
  const s = S(), picks = [];
  for (const d of plan.days) for (const x of d.slots) if (x.pick && !x.meal && !x.past) picks.push({ d, x, on: true });
  let alsoShop = true;
  const box = ctx.sheet([]), body = h('div', {}); box.box.append(body);
  const paint = () => body.replaceChildren(h('h2', {}, 'Plan my week'),
    h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Tick what to keep. Meals you already planned stay as they are.'),
    plan.batches.length ? h('div', { class: 'card kt-batchcard' }, ...plan.batches.map(b => h('div', { class: 'small' }, `🍱 ${dayTitle(fromKey(b.key))}: ${s.recipes?.[b.recipeId]?.title} ×${b.portions + 1} — ${b.why}`))) : null,
    h('div', { class: 'kt-plist' }, ...plan.days.filter(d => picks.some(p => p.d === d)).map(d => h('div', { class: 'kt-pday' }, h('div', { class: 'tiny dim kt-pdh' }, `${dayTitle(d.date)} · ${d.label}`),
      ...picks.filter(p => p.d === d).map(p => { const r = s.recipes[p.x.pick.recipeId];
        return h('label', { class: 'kt-pick' }, h('input', { type: 'checkbox', checked: p.on, onChange: (e) => { p.on = e.target.checked; } }), h('span', { class: 'kt-slot' }, K.slotName(p.x.slot)), h('span', { class: 'grow' }, `${r.icon} ${r.title}`, h('span', { class: 'tiny dim' }, ` · ${[p.x.why, ...(p.x.pick.why || [])].filter(Boolean).slice(0, 2).join(' · ')}`))); })))),
    h('label', { class: 'switch' }, h('span', { class: 'small' }, 'Add what these meals need to the shopping list'), h('input', { type: 'checkbox', checked: alsoShop, onChange: (e) => { alsoShop = e.target.checked; } })),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      const only = picks.filter(p => p.on).map(p => `${p.d.key}|${p.x.slot}`); if (!only.length) return toast('Nothing ticked');
      const before = S(); let { state, ids } = K.applyPlan(before, plan, { only });
      let added = 0;
      if (alsoShop) { const c = cfg(), need = K.neededFor(state, plan.days[0].key, plan.days[plan.days.length - 1].key, { staples: c.kitchen.staples }); added = need.length; state = K.addNeeded(state, need); }
      ctx.update(() => state); box.close(); ctx.render(); ctx.cheer?.();
      toast(`Planned ${plural(ids.length, 'meal')}${added ? ` · ${plural(added, 'thing')} on the list` : ''}`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
    } }, 'Use this plan'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel')));
  paint();
}

// ───────────────────────── choose a meal for a slot
function pickSheet(key, x) {
  const s = S(), c = cfg(), date = fromKey(key);
  const suited = K.recipeList(s).filter(r => K.suits(r, x.slot, x.need || 'main') && K.cookable(r, c.kitchen.machines));
  const others = K.recipeList(s).filter(r => !suited.includes(r));
  const sugg = x.pick ? s.recipes[x.pick.recipeId] : null;
  const box = ctx.sheet([]);
  const save = (m) => { const before = S(); ctx.update(st => K.addMeal(x._replace ? K.deleteMeal(st, x._replace) : st, { date: key, slot: x.slot, ...m })); box.close(); ctx.render(); toast(`${K.slotName(x.slot)} ${relDay(date).toLowerCase()} planned`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  const row = (r) => h('button', { class: 'item clickable kt-rrow', onClick: () => save({ recipeId: r.id, servings: x.need === 'pack' ? 1 : r.serves }) }, h('span', { class: 'kt-ic lg' }, r.icon), h('div', { class: 'grow' }, h('div', { class: 'name' }, r.title), h('div', { class: 'meta' }, recipeMeta(r))));
  const txtIn = h('input', { placeholder: 'e.g. Eating out, Leftovers, Hospital canteen', maxlength: 80 });
  box.box.append(h('h2', {}, `${K.slotName(x.slot)} · ${dayTitle(date)}`), x.why ? h('div', { class: 'small muted' }, x.why) : null,
    sugg ? h('div', { class: 'card kt-suggest' }, h('div', { class: 'tiny dim' }, 'Suggested'), row(sugg), x.pick.why?.length ? h('div', { class: 'tiny dim' }, x.pick.why.join(' · ')) : null) : null,
    suited.length ? h('div', { class: 'list' }, ...suited.filter(r => r !== sugg).map(row)) : h('div', { class: 'small muted' }, 'No recipe of yours fits this slot yet.'),
    others.length ? h('details', { class: 'adv' }, h('summary', { class: 'small' }, `Other recipes (${others.length})`), h('div', { class: 'list' }, ...others.map(row))) : null,
    h('div', { class: 'row', style: { marginTop: '10px' } }, txtIn, h('button', { class: 'btn', onClick: () => { if (txtIn.value.trim()) save({ text: txtIn.value }); } }, 'Add')));
}
const recipeMeta = (r) => { const own = cfg().kitchen.machines, u = K.usable(r, own)[0]; return [u ? `${K.machineIcon(u[0])} ${K.machineLine(u[1])}` : K.noCook(r) ? 'no cooking' : `needs ${Object.keys(r.machines).map(K.machineName).join(' / ')}`, `serves ${r.serves}`, r.batch ? 'batch' : '', r.light ? 'light' : '', r.kcal ? `${r.kcal} kcal` : ''].filter(Boolean).join(' · '); };

// ───────────────────────── a planned meal
export function mealSheet(m) {
  const s = S(), r = m.recipeId ? s.recipes?.[m.recipeId] : null, date = fromKey(m.date), c = cfg();
  const box = ctx.sheet([]);
  const close = () => { box.close(); ctx.render(); };
  const cook = () => { const before = S(); ctx.update(st => K.cookMeal(st, m.id, new Date(), { take: c.kitchen.take })); close(); ctx.cheer?.(); const left = Object.values(S().pantry || {}).find(f => f.fromMeal === m.id);
    toast(m.fromBatch ? 'Eaten · one portion out of the fridge' : `Cooked${left ? ` · ${plural(left.qty, 'portion')} in the fridge until ${fmtDate(fromKey(left.expires)).slice(0, 5)}` : ''}`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  const servings = h('input', { type: 'number', min: 1, max: 30, value: m.servings || 1, inputmode: 'numeric', style: { width: '80px' }, onChange: (e) => { ctx.update(st => K.updateMeal(st, m.id, { servings: e.target.value })); } });
  box.box.append(h('h2', {}, `${K.mealIcon(s, m)} ${K.mealTitle(s, m)}`), h('div', { class: 'small muted' }, `${K.slotName(m.slot)} · ${dayTitle(date)}${m.cooked ? ` · cooked ${relDay(fromKey(m.cooked)).toLowerCase()}` : ''}`),
    m.fromBatch ? h('div', { class: 'small', style: { marginTop: '6px' } }, `From the batch cooked for ${s.meals?.[m.fromBatch] ? dayTitle(fromKey(s.meals[m.fromBatch].date)) : 'earlier'}: take one portion from the fridge.`) : null,
    r ? machinesBox(r) : null,
    !m.fromBatch && r ? h('div', { class: 'row', style: { margin: '10px 0' } }, h('span', { class: 'small grow' }, `Portions${m.batch ? ' (the extra ones go in the fridge)' : ''}`), servings) : null,
    h('div', { class: 'row wrap sh-foot' },
      m.cooked ? h('button', { class: 'btn', onClick: () => { ctx.update(st => K.uncook(st, m.id)); close(); } }, 'Not cooked yet') : h('button', { class: 'btn primary grow', onClick: cook }, m.fromBatch ? 'Eaten ✓' : 'Cooked ✓'),
      r ? h('button', { class: 'btn', onClick: () => { box.close(); recipeSheet(r); } }, 'Recipe') : null,
      h('button', { class: 'btn', onClick: () => { box.close(); pickSheet(m.date, { slot: m.slot, need: m.packed ? 'pack' : m.slot === 'sleep' ? 'light' : 'main', at: null, why: '', pick: null, _replace: m.id }); } }, 'Change'),
      h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => K.deleteMeal(st, m.id)); close(); toast('Meal removed', '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Remove')));
}

// ───────────────────────── recipes
const FILTERS = [['all', 'All'], ['quick', '≤ 15 min'], ['batch', 'Batch / prep'], ['light', 'Light'], ['breakfast', 'Breakfast'], ['fav', '★']];
function recipesView() {
  const s = S(), own = cfg().kitchen.machines, q = query.trim().toLowerCase();
  const list = K.recipeList(s).filter(r => (!q || r.title.toLowerCase().includes(q) || r.ingredients.some(i => i.item.toLowerCase().includes(q)) || r.tags.some(t => t.toLowerCase().includes(q)))
    && (filter === 'all' || (filter === 'quick' && K.quickest(r, own) <= 15) || (filter === 'batch' && (r.batch || r.keeps >= 3)) || (filter === 'light' && r.light) || (filter === 'breakfast' && r.meal === 'breakfast') || (filter === 'fav' && r.fav)));
  const missing = K.startersMissing(s);
  const search = h('input', { type: 'search', class: 'inp kt-search', placeholder: 'Search recipes or ingredients', value: query, 'aria-label': 'Search recipes', onInput: (e) => { query = e.target.value; ctx.render(); } });
  return [h('div', { class: 'row kt-tools' }, search, h('button', { class: 'btn primary', onClick: () => recipeEditor(null) }, '+ Recipe')),
    h('div', { class: 'chips', style: { margin: '8px 0 12px' } }, FILTERS.map(([id, l]) => h('button', { class: `chip ${filter === id ? 'sel' : ''}`, 'aria-pressed': String(filter === id), onClick: () => { filter = id; ctx.render(); } }, l))),
    list.length ? h('div', { class: 'kt-rgrid' }, list.map(r => h('div', { class: `card kt-rcard ${K.cookable(r, own) ? '' : 'cant'}`, role: 'button', tabindex: '0', onClick: () => recipeSheet(r), onKeydown: (e) => { if (e.key === 'Enter') recipeSheet(r); } },
      h('div', { class: 'row' }, h('span', { class: 'kt-ic lg' }, r.icon), h('div', { class: 'grow' }, h('div', { class: 'name' }, r.title, r.fav ? h('span', { class: 'kt-fav' }, ' ★') : null), h('div', { class: 'tiny dim' }, recipeMeta(r)))),
      h('div', { class: 'kt-mach' }, Object.keys(r.machines).length ? Object.entries(r.machines).map(([k, m]) => h('span', { class: `chip mchip ${own.includes(k) ? '' : 'no'}` }, `${K.machineIcon(k)} ${K.machineLine(m).split(' · ').slice(0, 2).join(' · ')}`)) : h('span', { class: 'chip mchip' }, '🥄 no cooking')))))
      : h('div', { class: 'card empty' }, q || filter !== 'all' ? 'No recipe matches.' : 'No recipes yet.'),
    missing.length ? h('div', { class: 'card' }, h('div', { class: 'title' }, `Starter recipes you don’t have (${missing.length})`), h('div', { class: 'chips' }, missing.map(r => h('button', { class: 'chip', onClick: () => { ctx.update(st => K.addStarters(st, [r])); ctx.render(); toast(`${r.title} added`, 'ok'); } }, `${r.icon} ${r.title}`)), h('button', { class: 'chip sel', onClick: () => addStarters() }, 'Add all'))) : null];
}
function addStarters() { const before = S(), n = K.startersMissing(before).length; ctx.update(s => K.addStarters(s)); ctx.render(); toast(`${n} recipes added`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); }

/** Every machine's time and temperature; the ones you own first, the quickest marked. */
function machinesBox(r) {
  const own = cfg().kitchen.machines, ent = Object.entries(r.machines || {});
  if (!ent.length) return h('div', { class: 'kt-machines' }, h('div', { class: 'kt-m' }, h('span', { class: 'kt-mi' }, '🥄'), h('b', {}, 'No cooking'), h('span', { class: 'small muted' }, `${r.mins} min`)));
  const fast = K.usable(r, own)[0]?.[0];
  return h('div', { class: 'kt-machines' }, ent.sort((a, b) => (own.includes(b[0]) - own.includes(a[0])) || (+a[1].mins || 99) - (+b[1].mins || 99)).map(([k, m]) => h('div', { class: `kt-m ${own.includes(k) ? '' : 'no'} ${k === fast ? 'fast' : ''}` },
    h('span', { class: 'kt-mi' }, K.machineIcon(k)), h('b', {}, K.machineName(k)), h('span', { class: 'kt-heat' }, m.temp ? `${m.temp}°C` : m.power || ''), h('span', { class: 'kt-min' }, m.mins ? `${m.mins} min` : ''), m.note ? h('span', { class: 'tiny dim kt-note' }, m.note) : null, own.includes(k) ? null : h('span', { class: 'tiny dim kt-note' }, 'you don’t have one'))));
}
export function recipeSheet(r) {
  const s = S(), c = cfg(), box = ctx.sheet([]);
  const close = () => { box.close(); ctx.render(); };
  const ing = r.ingredients.map(i => { const st = K.STAPLE.test(i.item) ? { have: true } : K.stockOf(s, i.item, i.unit); return h('li', { class: st.have ? 'have' : '' }, K.ingText(i), st.have && !K.STAPLE.test(i.item) ? h('span', { class: 'tiny dim' }, ' · in the fridge') : null); });
  box.box.append(h('h2', {}, `${r.icon} ${r.title}`),
    h('div', { class: 'chips', style: { margin: '6px 0 10px' } }, [K.MEAL_TYPES.find(m => m[0] === r.meal)?.[1], `serves ${r.serves}`, `${r.mins} min`, r.keeps ? `keeps ${r.keeps} day${r.keeps === 1 ? '' : 's'}` : '', r.batch ? 'batch cook' : '', r.freezes ? 'freezes' : '', r.light ? 'light' : '', r.kcal ? `${r.kcal} kcal` : '', r.protein ? `${r.protein} g protein` : ''].filter(Boolean).map(t => h('span', { class: 'chip' }, t))),
    machinesBox(r),
    r.ingredients.length ? [h('h3', { class: 'kt-h3' }, 'Ingredients'), h('ul', { class: 'kt-ing' }, ing)] : null,
    r.steps.length ? [h('h3', { class: 'kt-h3' }, 'Steps'), h('ol', { class: 'kt-steps' }, r.steps.map(x => h('li', {}, x)))] : null,
    r.note ? h('div', { class: 'small muted', style: { marginTop: '8px' } }, r.note) : null,
    h('div', { class: 'row wrap sh-foot' },
      h('button', { class: 'btn primary', onClick: () => { box.close(); planRecipeSheet(r); } }, 'Plan it'),
      h('button', { class: 'btn', onClick: () => { const items = r.ingredients.filter(i => !K.STAPLE.test(i.item)).map(i => ({ name: i.item, qty: i.qty, unit: i.unit, cat: i.cat || K.guessCat(i.item) })).filter(i => !K.stockOf(S(), i.name, i.unit).have); if (!items.length) return toast('You have all of it'); const before = S(); ctx.update(st => K.addNeeded(st, items)); toast(`${plural(items.length, 'thing')} on the shopping list`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, '🛒 Add to list'),
      h('button', { class: 'btn', 'aria-pressed': String(!!r.fav), onClick: () => { ctx.update(st => K.saveRecipe(st, { ...r, fav: !r.fav })); close(); } }, r.fav ? '★ Favourite' : '☆ Favourite'),
      h('button', { class: 'btn', onClick: () => { box.close(); recipeEditor(r); } }, 'Edit'),
      h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => K.deleteRecipe(st, r.id)); close(); toast(`${r.title} deleted`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Delete')));
  void c;
}
/** Put a recipe on a day: the next days with the slots that suit it. */
function planRecipeSheet(r) {
  const plan = currentPlan(), box = ctx.sheet([]);
  const opts = plan.days.flatMap(d => d.slots.filter(x => !x.meal && !x.past && K.suits(r, x.slot, x.need)).map(x => ({ d, x })));
  const save = (d, x) => { const before = S(); ctx.update(st => K.addMeal(st, { date: d.key, slot: x.slot, recipeId: r.id, servings: x.need === 'pack' ? 1 : r.serves, ...(x.need === 'pack' ? { packed: true } : {}) })); box.close(); ctx.render(); toast(`${r.title}: ${K.slotName(x.slot).toLowerCase()} ${relDay(d.date).toLowerCase()}`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  const dIn = h('input', { type: 'date', value: keyOf(new Date()), min: keyOf(new Date()) }), sIn = h('select', {}, K.SLOTS.map(([id, l]) => h('option', { value: id, selected: id === (r.meal === 'breakfast' ? 'breakfast' : 'dinner') }, l)));
  box.box.append(h('h2', {}, `Plan ${r.title}`),
    opts.length ? h('div', { class: 'list' }, ...opts.slice(0, 10).map(({ d, x }) => h('button', { class: 'item clickable kt-rrow', onClick: () => save(d, x) }, h('div', { class: 'grow' }, h('div', { class: 'name' }, `${dayTitle(d.date)} · ${K.slotName(x.slot)}`), h('div', { class: 'meta' }, [d.label, x.why].filter(Boolean).join(' · '))), h('span', { class: 'chip sel' }, 'Plan')))) : h('div', { class: 'small muted' }, 'No open slot in the coming days suits it — pick one yourself.'),
    h('details', { class: 'adv', open: opts.length ? null : '' }, h('summary', { class: 'small' }, 'Another day or slot'), h('div', { class: 'grid2' }, field('Day', dIn), field('Meal', sIn)), h('button', { class: 'btn primary', onClick: () => { if (!dIn.value) return; save({ key: dIn.value, date: fromKey(dIn.value) }, { slot: sIn.value, need: sIn.value === 'night' ? 'pack' : 'main' }); } }, 'Plan it')));
}

export function recipeEditor(r) {
  const c = cfg();
  const t = h('input', { value: r?.title || '', placeholder: 'e.g. Air-fryer chicken thighs', maxlength: K.LIMITS.title }), ic = h('input', { value: r?.icon || '🍽️', style: { width: '70px' }, 'aria-label': 'Icon' });
  const meal = h('select', {}, K.MEAL_TYPES.map(([id, l]) => h('option', { value: id, selected: (r?.meal || 'main') === id }, l)));
  const serves = h('input', { type: 'number', min: 1, max: 20, value: r?.serves || 2, inputmode: 'numeric' }), mins = h('input', { type: 'number', min: 1, max: 600, value: r?.mins || 20, inputmode: 'numeric' });
  const keeps = h('input', { type: 'number', min: 0, max: 14, value: r?.keeps ?? 2, inputmode: 'numeric' }), kcal = h('input', { type: 'number', min: 0, max: 3000, value: r?.kcal || '', inputmode: 'numeric', placeholder: 'optional' }), prot = h('input', { type: 'number', min: 0, max: 300, value: r?.protein || '', inputmode: 'numeric', placeholder: 'optional' });
  const flag = (label, on) => { const i = h('input', { type: 'checkbox', checked: !!on }); return [i, h('label', { class: 'kt-flag' }, i, ` ${label}`)]; };
  const [batch, batchL] = flag('Batch / meal prep', r?.batch), [freezes, freezesL] = flag('Freezes well', r?.freezes), [light, lightL] = flag('Light (fine before sleep)', r?.light);
  const ing = h('textarea', { rows: 6, placeholder: '500 g chicken thighs\n1 tbsp olive oil\n1 tsp paprika\nSalt' }, (r?.ingredients || []).map(K.ingText).join('\n'));
  const steps = h('textarea', { rows: 5, placeholder: 'One step per line' }, (r?.steps || []).join('\n'));
  const mach = {}; const mrow = ([k, name, icon]) => { const m = r?.machines?.[k] || {}; const heat = k === 'microwave' ? h('select', { 'aria-label': `${name} power` }, ['', 'High', 'Medium', 'Low', 'Defrost'].map(p => h('option', { value: p, selected: (m.power || '') === p }, p || 'power'))) : h('input', { type: 'number', min: 40, max: 300, value: m.temp || '', inputmode: 'numeric', placeholder: '°C', 'aria-label': `${name} temperature` });
    const mi = h('input', { type: 'number', min: 1, max: 600, value: m.mins || '', inputmode: 'numeric', placeholder: 'min', 'aria-label': `${name} minutes` }), note = h('input', { value: m.note || '', placeholder: 'note (turn halfway…)', maxlength: 80, 'aria-label': `${name} note` });
    mach[k] = { heat, mi, note, micro: k === 'microwave' }; return h('div', { class: `kt-medit ${c.kitchen.machines.includes(k) ? '' : 'no'}` }, h('span', { class: 'kt-mi' }, icon), h('b', {}, name), heat, mi, note); };
  const err = h('div', { class: 'ch-err', role: 'alert' }); let dupOk = false;
  const read = () => ({ ...(r || {}), id: r?.id, title: t.value, icon: ic.value, meal: meal.value, serves: serves.value, mins: mins.value, keeps: keeps.value, kcal: kcal.value, protein: prot.value, batch: batch.checked, freezes: freezes.checked, light: light.checked,
    ingredients: ing.value.split('\n').map(K.parseIngredient).filter(Boolean), steps: steps.value.split('\n'), machines: Object.fromEntries(Object.entries(mach).map(([k, x]) => [k, x.micro ? { power: x.heat.value, mins: x.mi.value, note: x.note.value } : { temp: x.heat.value, mins: x.mi.value, note: x.note.value }])) });
  const save = h('button', { class: 'btn primary grow', onClick: () => {
    const v = read(), bad = K.validateRecipe(v, S()), hard = Object.entries(bad).filter(([k]) => k !== 'dup').map(([, m]) => m);
    if (hard.length) { err.textContent = hard.join(' · '); return; }
    if (bad.dup && !dupOk) { err.textContent = `${bad.dup}. Tap again to save anyway.`; dupOk = true; save.textContent = 'Save anyway'; return; }
    ctx.update(s => K.saveRecipe(s, v)); box.close(); ctx.render(); toast(r ? 'Recipe saved' : `${v.title} added`, 'ok'); } }, 'Save');
  t.addEventListener('input', () => { dupOk = false; save.textContent = 'Save'; err.textContent = ''; });
  const box = ctx.sheet([h('h2', {}, r ? 'Edit recipe' : 'New recipe'), h('div', { class: 'ch-name-row' }, field('Icon', ic), field('Name', t)),
    h('div', { class: 'grid3' }, field('Kind', meal), field('Serves', serves), field('Minutes in all', mins)),
    h('div', { class: 'title', style: { marginTop: '6px' } }, 'Machines — time and temperature for each one it can go in'), h('div', { class: 'kt-medits' }, K.MACHINES.map(mrow)),
    field('Ingredients (one per line: “500 g chicken”)', ing), field('Steps', steps),
    h('div', { class: 'grid3' }, field('Keeps in the fridge (days)', keeps), field('kcal per serving', kcal), field('Protein g per serving', prot)),
    h('div', { class: 'kt-flags' }, batchL, freezesL, lightL), err,
    h('div', { class: 'row wrap sh-foot' }, save, h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}

/** Today: the day's meals around your shift, each a tap to cook or fill. */
export function todayMealsCard() {
  const now = new Date(), plan = currentPlan(now), d = plan.days[0]; if (!d) return null;
  const s = S(), rows = d.slots.filter(x => x.meal || !x.past).map(x => slotRow(d, x));
  if (!K.recipeList(s).length && !K.mealsOn(s, d.key).length) return h('div', { class: 'card' }, h('div', { class: 'title' }, 'Meals today'), h('div', { class: 'small muted' }, 'Add recipes in Kitchen and Calamansi plans meals around your shifts.'), h('button', { class: 'btn sm', style: { marginTop: '8px' }, onClick: () => ctx.go('kitchen') }, 'Open Kitchen'));
  const tomorrow = plan.days[1], b = plan.batches.find(x => x.key === d.key || x.key === tomorrow?.key);
  return h('div', { class: 'card kt-today' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Meals today'), h('button', { class: 'btn sm ghost', onClick: () => { seg = 'week'; ctx.go('kitchen'); } }, 'Week')),
    rows.length ? h('div', { class: 'kt-slots' }, rows) : h('div', { class: 'small muted' }, 'Nothing left to plan today.'),
    b ? h('div', { class: 'kt-batch', style: { marginTop: '8px' } }, h('span', { class: 'kt-bi' }, s.recipes?.[b.recipeId]?.icon || '🍱'), h('div', { class: 'grow small' }, h('b', {}, `${b.key === d.key ? 'Today' : 'Tomorrow'}: batch-cook ${s.recipes?.[b.recipeId]?.title || ''}`), h('div', { class: 'tiny dim' }, b.why))) : null);
}
