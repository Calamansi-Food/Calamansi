// Today: your day at home in one screen — the shift (from Mandarin) and what it means for eating and chores, today's meals,
// chores due, food to use up, the shopping list, bills and the car. Cards follow your order (Settings › Customise › Today).
import { h, toast, keyOf, fromKey, addDays, fmtDate, DAY_NAMES, MONTHS } from './util.js';
import * as K from './kitchen.js';
import * as KU from './kitchen-ui.js';
import * as HU from './home-ui.js';
import * as L from './life.js';
import * as D from './day.js';
import * as CZ from './custom.js';

let ctx = null;
export function initToday(c) { ctx = c; }
const S = () => ctx.S();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** One plain sentence about what today's shift means at home. */
export function dayTip(dk) {
  const sh = dk.shift;
  switch (dk.kind) {
    case 'day': return `12-hour day until ${hm(sh.end)}: a quick breakfast, lunch packed, and something fast when you get home.`;
    case 'evening': return `Shift from ${hm(sh.start)}: a proper meal before you go, dinner packed.`;
    case 'first-night': return `Night from ${hm(sh.start)}: rest this afternoon, eat around ${hm(sh.start - 150)} and pack the night meal. No chores right before it.`;
    case 'night': return `Coming off a night and back on at ${hm(sh.start)}: sleep first, something light now, a proper meal when you wake.`;
    case 'postnight': return 'After the night: something light, then sleep. Nothing heavy; chores can wait for the afternoon.';
    case 'leave': return 'On leave: a good day for the big chores and a proper cook.';
    case 'unknown': return 'Mandarin hasn’t shared today’s shift: planned like a day off.';
    default: return 'Day off: the best day for chores, the shop and a batch cook.';
  }
}
function dayCard() {
  const now = new Date(), dk = D.dayKind(now), sh = dk.shift, blocks = ctx.planBlocks(keyOf(now));
  const tomorrow = D.dayKind(addDays(now, 1));
  return h('div', { class: 'card hero td-day' },
    h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, D.KIND_LABEL[dk.kind]), sh.status === 'work' ? h('div', { class: 'td-shift' }, D.shiftText(sh), sh.site ? h('span', { class: 'tiny dim' }, ` · ${sh.site}`) : null) : null), h('span', { class: `td-badge k-${dk.kind}` }, dk.kind === 'off' ? '🌿' : dk.kind === 'day' ? '☀️' : /night/.test(dk.kind) ? '🌙' : dk.kind === 'leave' ? '🏖️' : '❔')),
    h('div', { class: 'small', style: { marginTop: '6px' } }, dayTip(dk)),
    tomorrow.kind === 'first-night' && dk.kind !== 'first-night' && dk.kind !== 'night' ? h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `Tomorrow is a night (${D.shiftText(tomorrow.shift)}): cook today for the packed meals.`) : null,
    blocks.length ? h('div', { class: 'td-blocks' }, blocks.map(b => h('div', { class: 'tiny' }, `🍊 Citrus planned ${b.start}${b.end ? `–${b.end}` : ''}: ${String(b.title).replace(/^Calamansi:\s*/, '')}`))) : null);
}
function fridgeCard() {
  const s = S(), list = K.useFirst(s); if (!list.length) return null;
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Use it up'), h('button', { class: 'btn sm ghost', onClick: () => ctx.go('shop', 'fridge') }, 'Fridge')),
    list.slice(0, 4).map(f => { const d = K.daysLeft(f); return h('div', { class: 'row td-line' }, h('span', { class: 'grow small' }, f.name, f.qty ? h('span', { class: 'tiny dim' }, ` · ${K.qtyText(f.qty, f.unit)}`) : null), h('span', { class: `chip sp-left ${d < 0 ? 'late' : 'soon'}` }, d < 0 ? `${-d} d past` : d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d} days`)); }));
}
function shopCard() {
  const open = K.openShop(S()); if (!open.length) return null;
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, `Shopping list · ${open.length}`), h('button', { class: 'btn sm ghost', onClick: () => ctx.go('shop', 'list') }, 'Open')),
    h('div', { class: 'small' }, open.slice(0, 8).map(x => x.name).join(' · '), open.length > 8 ? ` +${open.length - 8}` : ''));
}
function lifeCard() {
  const s = S(), now = new Date(), bills = L.billsDue(s, now), cars = L.carAlerts(s, now); if (!bills.length && !cars.length) return null;
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Bills and the car'), h('button', { class: 'btn sm ghost', onClick: () => bills.length ? ctx.go('life', 'bills') : ctx.go('car') }, 'Open')),
    bills.slice(0, 4).map(b => { const st = L.billState(b, now); return h('div', { class: 'row td-line' }, h('span', {}, b.icon), h('span', { class: 'grow small' }, b.title, b.amount ? h('span', { class: 'tiny dim' }, ` · ${b.amount} SAR`) : null), h('span', { class: `tiny ch-status ${st.cls === 'soon' ? 'due' : st.cls}` }, st.text),
      h('button', { class: 'btn sm', onClick: () => { const before = S(); ctx.update(st2 => L.payBill(st2, b.id, now)); ctx.render(); toast(`${b.title} paid`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, '✓')); }),
    cars.slice(0, 3).map(a => h('div', { class: 'row td-line' }, h('span', {}, a.icon), h('span', { class: `grow small ${a.days < 0 ? 'late' : ''}` }, L.alertText(a)))));
}
function actionsCard() {
  return h('div', { class: 'card td-acts' }, h('div', { class: 'title' }, 'Quick'), h('div', { class: 'row wrap' },
    h('button', { class: 'btn sm', onClick: () => ctx.quickAdd() }, '🛒 Add to the list'), h('button', { class: 'btn sm', onClick: () => ctx.go('kitchen', 'week') }, '🍱 Plan meals'),
    h('button', { class: 'btn sm', onClick: () => ctx.go('shop', 'fridge') }, '🧊 Fridge'), h('button', { class: 'btn sm', onClick: () => ctx.go('kitchen', 'recipes') }, '📖 Recipes'), h('button', { class: 'btn sm', onClick: () => HU.editSheet(null) }, '🧹 New chore')));
}
export function renderToday() {
  const now = new Date(), c = CZ.custom(S());
  const head = h('div', { class: 'td-head' }, h('h1', {}, `${DAY_NAMES[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`), h('div', { class: 'small muted' }, `${fmtDate(now)} · ${ctx.summary()}`));
  const make = { day: dayCard, meals: KU.todayMealsCard, chores: HU.todayCard, fridge: fridgeCard, shop: shopCard, life: lifeCard, actions: actionsCard };
  const cards = c.today.sections.order.filter(id => !c.today.sections.hidden.includes(id)).map(id => { try { return make[id]?.(); } catch (e) { console.error(id, e); return h('div', { class: 'card warn tiny' }, `This card could not be shown (${String(e.message).slice(0, 60)})`); } }).filter(Boolean);
  const calm = !HU.todayCard() && !K.useFirst(S()).length && !L.billsDue(S(), now).length;
  return [head, ...cards, calm ? h('div', { class: 'tiny dim', style: { margin: '6px 2px 12px' } }, 'No chores due, nothing to use up, no bills waiting. 🍋') : null];
}
void fromKey; void plural;
