// What Calamansi tells the other apps (pure, no DOM): My Apps/hub/calamansi/status.json (HUB.md contract v2) — the one-line
// summary, next, metrics, what is waiting on you, date tasks for bills and car papers, time it asks Citrus for (batch cooking),
// deep links, and extra { chores, meals, shopping } for Citrus's Today. Never amounts of money beyond the bill line you typed,
// never notes.
import { keyOf, fromKey, addDays, startOfDay } from './util.js';
import * as C from './chores.js';
import * as K from './kitchen.js';
import * as L from './life.js';
import * as CZ from './custom.js';
import * as D from './day.js';
import * as R from './roster.js';

export const SITE_URL = 'https://calamansi-food.github.io/Calamansi/';
export const CONTRACT = 2;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** The Sunday that starts `now`'s week (the Saudi week), as a key. */
const weekStart = (now) => keyOf(addDays(startOfDay(now), -now.getDay()));

/** The chore line Citrus shows: "Laundry · 2 days overdue". */
function choreLine(c, now) {
  const late = C.daysLate(c, now), planned = c.next && c.next.date >= keyOf(now);
  return { title: c.title, icon: c.icon, late: c.lastDone ? Math.max(0, late) : 0, status: planned ? `planned ${c.next.date === keyOf(now) ? 'today' : c.next.date} ${hm(c.next.start)}` : !c.lastDone ? 'due now' : late > 0 ? `${plural(late, 'day')} overdue` : late === 0 ? 'due today' : `due in ${plural(-late, 'day')}`, ...(planned ? { planned: { date: c.next.date, start: hm(c.next.start) } } : {}) };
}

/** status.json for Citrus (HUB.md v2). */
export function buildStatus(s, now = new Date(), { plan = null } = {}) {
  const c = CZ.custom(s); D.setTiming(c.day);
  const t = keyOf(now), tomorrow = keyOf(addDays(now, 1));
  const due = C.dueSoon(s, now), late = due.filter(x => x.c.lastDone && x.late > 0), dueToday = due.filter(x => x.late >= 0 || !x.c.lastDone);
  const mealsToday = K.mealsOn(s, t), nextMeal = mealsToday.find(m => !m.cooked) || null;
  const open = K.openShop(s), soon = K.useFirst(s, now, 2), bills = L.billsDue(s, now), cars = L.carAlerts(s, now);
  const p = plan || K.planWeek(s, { from: now, days: c.kitchen.days, owned: c.kitchen.machines, diet: c.diet, now });
  const batches = p.batches.filter(b => b.key >= t);
  const bits = [];
  if (dueToday.length) bits.push(`${plural(dueToday.length, 'chore')} due`);
  if (nextMeal) bits.push(`${K.slotName(nextMeal.slot).toLowerCase()}: ${K.mealTitle(s, nextMeal).toLowerCase()}`);
  else if (batches[0] && batches[0].key <= tomorrow) bits.push(`batch-cook ${batches[0].key === t ? 'today' : 'tomorrow'} for your nights`);
  if (soon.length) bits.push(`${soon.length} to use up`);
  if (bills.length) bits.push(`${plural(bills.length, 'bill')} due`);
  if (!bits.length) bits.push(open.length ? `${plural(open.length, 'thing')} on the shopping list` : 'home on track');

  const pending = [];
  for (const x of late.slice(0, 4)) pending.push(`${x.c.title}: ${plural(x.late, 'day')} overdue`);
  for (const f of soon.slice(0, 3)) { const d = K.daysLeft(f, now); pending.push(`${f.name} ${d < 0 ? 'is past its date' : d === 0 ? 'goes off today' : `goes off in ${plural(d, 'day')}`}`); }
  for (const b of bills.slice(0, 3)) pending.push(`${b.title}: ${L.billState(b, now).text.toLowerCase()}`);
  for (const a of cars.slice(0, 2)) pending.push(L.alertText(a));

  const inbox = [];
  for (const b of bills.slice(0, 8)) inbox.push({ id: `bill-${b.id}-${b.due}`.slice(0, 60), type: 'task', title: `${b.kind === 'renewal' ? 'Renew' : 'Pay'} ${b.title}${b.amount ? ` (${b.amount} SAR)` : ''}`, date: b.due < t ? t : b.due, minutes: 5, pri: b.due <= t ? 1 : 2, url: `${SITE_URL}?do=bills`, expires: keyOf(addDays(fromKey(b.due < t ? t : b.due), 7)) });
  for (const a of cars.slice(0, 6)) inbox.push({ id: `car-${a.car.id}-${a.kind}-${a.date}`.slice(0, 60), type: 'task', title: a.kind === 'service' ? `Book a service for ${a.car.name}` : `Renew ${a.label.replace(/ \(.*\)$/, '').toLowerCase()} for ${a.car.name}`, date: a.date < t ? t : a.date, minutes: a.kind === 'service' ? 15 : 20, pri: a.days <= 7 ? 1 : 2, url: `${SITE_URL}?do=car`, expires: keyOf(addDays(fromKey(a.date < t ? t : a.date), 14)) });
  // time Calamansi wants: the batch cook before a night stretch (Citrus places it around your shifts)
  const asks = batches.slice(0, 3).map(b => { const r = s.recipes?.[b.recipeId]; return { date: b.key, title: `Calamansi: batch-cook ${r ? r.title : 'for the week'}`, minutes: Math.min(120, Math.max(30, (r?.mins || 45) + 15)), slot: 'free' }; });
  if (open.length >= 5) asks.push({ date: t, title: `Calamansi: groceries (${open.length} things)`, minutes: 45, slot: 'free' });

  const ws = weekStart(now), cooked = Object.values(s.meals || {}).filter(m => m.cooked && m.cooked >= ws && !m.fromBatch).length;
  const metrics = [
    { key: 'chores-week', label: 'Chores done this week', value: C.doneSince(s, ws), unit: 'chores', date: t },
    { key: 'chores-overdue', label: 'Chores overdue', value: late.length, goal: 0, unit: 'chores', date: t },
    { key: 'meals-cooked-week', label: 'Meals cooked this week', value: cooked, unit: 'meals', date: t },
    { key: 'shopping-open', label: 'On the shopping list', value: open.length, unit: 'items', date: t },
    { key: 'food-expiring', label: 'Food to use up', value: soon.length, goal: 0, unit: 'items', date: t },
  ];
  if (bills.length) metrics.push({ key: 'bills-due', label: 'Bills due', value: bills.length, goal: 0, unit: 'bills', date: t });

  const nextChore = due[0]?.c || null;
  const next = nextMeal ? { title: `${K.slotName(nextMeal.slot)}: ${K.mealTitle(s, nextMeal)}`, minutes: Math.max(5, K.quickest(s.recipes?.[nextMeal.recipeId] || { mins: 10, machines: {} }, c.kitchen.machines)) }
    : nextChore ? { title: `${nextChore.icon} ${nextChore.title}`, minutes: nextChore.mins } : null;
  const base = SITE_URL;
  const actions = [
    { id: 'today', label: 'Today at home', url: `${base}#today`, icon: '🍋' },
    { id: 'chores', label: 'Chores', url: `${base}?do=chores`, icon: '🧹', minutes: 2 },
    { id: 'plan', label: 'Plan meals', url: `${base}?do=plan`, icon: '🍱', minutes: 5 },
    { id: 'shop', label: 'Shopping list', url: `${base}?do=shop`, icon: '🛒', minutes: 2 },
    { id: 'fridge', label: 'What’s in the fridge', url: `${base}?do=fridge`, icon: '🧊', minutes: 2 },
    { id: 'bills', label: 'Bills and the car', url: `${base}?do=bills`, icon: '🧾', minutes: 2 },
  ];
  const mealOut = (m) => ({ slot: m.slot, label: K.slotName(m.slot), title: K.mealTitle(s, m), icon: K.mealIcon(s, m), done: !!m.cooked, ...(m.packed ? { packed: true } : {}) });
  return {
    app: 'calamansi', title: 'Calamansi', icon: '🍋', color: '#9fd94a', url: base, contract: CONTRACT,
    updatedAt: now.toISOString(),
    summary: bits.join(' · ').slice(0, 140),
    today: { date: t, done: !late.length && !due.some(x => x.late >= 0) },
    next, asks: asks.slice(0, 4), metrics, pending: pending.slice(0, 10), inbox: inbox.slice(0, 25), actions,
    extra: {
      chores: due.slice(0, 6).map(x => choreLine(x.c, now)),
      meals: { today: mealsToday.map(mealOut), tomorrow: K.mealsOn(s, tomorrow).map(mealOut), batch: batches[0] ? { date: batches[0].key, title: s.recipes?.[batches[0].recipeId]?.title || '', portions: batches[0].portions } : null },
      shopping: { open: open.length, items: open.slice(0, 8).map(x => x.name) },
      fridge: soon.slice(0, 5).map(f => ({ name: f.name, days: K.daysLeft(f, now) })),
      bills: bills.slice(0, 5).map(b => ({ title: b.title, due: b.due, ...(b.amount ? { amount: b.amount } : {}) })),
      roster: R.has() ? R.updatedAt() : null,
    },
  };
}
