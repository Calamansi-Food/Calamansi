// Made-up home data and a shifts.json shaped like Mandarin's, for the tests. Never real names, numbers or addresses.
// The month: day shifts (D1 08:00–20:00) on weekdays, Fri/Sat off, nights 19–21/11 (a stretch of three), off 22/11, leave 25/11.
import { STARTERS } from '../docs/js/kitchen.js';
const d = (n) => `2026-11-${String(n).padStart(2, '0')}`;
const myDays = [];
for (let n = 9; n <= 30; n++) {
  const dow = new Date(2026, 10, n).getDay();
  if ([19, 20, 21].includes(n)) myDays.push({ date: d(n), kind: 'work', code: 'N1', type: 'N', site: 'Upper Village', start: '20:00', end: '08:00', overnight: true });
  else if (n === 25) myDays.push({ date: d(n), kind: 'leave', code: 'AL', label: 'Annual leave' });
  else if (dow === 5 || dow === 6 || n === 22) myDays.push({ date: d(n), kind: 'off', code: '' });
  else myDays.push({ date: d(n), kind: 'work', code: 'D1', type: 'D', site: 'Upper Village', start: '08:00', end: '20:00' });
}
export const shifts = { app: 'mandarin', contract: 2, updatedAt: '2026-11-16T05:00:00Z', me: { name: 'Dr Test Me', key: 'id:1' }, days: myDays,
  roster: { 'id:1': { name: 'Dr Test Me', unit: 'gp', days: {} }, 'id:2': { name: 'Dr Ann Able', unit: 'gp', days: { [d(16)]: 'D2' } } },
  legend: { D1: { label: 'Day · Upper Village', site: 'Upper Village', type: 'D', start: '08:00', end: '20:00' }, N1: { label: 'Night · Upper Village', site: 'Upper Village', type: 'N', start: '20:00', end: '08:00' } } };

const at = Date.parse('2026-11-10T10:00:00Z');
const recipes = {};
STARTERS.forEach((r, i) => { const id = `r${i}`; recipes[id] = { ...r, id, steps: r.steps, tags: r.tags || [], fav: i === 0, keeps: r.keeps || 0, batch: !!r.batch, freezes: !!r.freezes, light: !!r.light, kcal: r.kcal || 0, protein: r.protein || 0, note: '', at }; });
export const state = {
  app: 'calamansi', version: 1, updatedAt: at,
  chores: {
    c1: { id: 'c1', title: 'Laundry', icon: '🧺', every: 4, mins: 120, lastDone: d(10), hist: [d(6), d(10)], next: null, at },
    c2: { id: 'c2', title: 'Room cleaning', icon: '🧹', every: 7, mins: 60, lastDone: d(12), hist: [d(12)], next: { date: d(17), start: 600, mins: 60, eventId: 'ev1', calendarId: 'primary', key: 'k1' }, at },
    c3: { id: 'c3', title: 'Change bed sheets', icon: '🛏️', every: 14, mins: 20, lastDone: d(15), hist: [d(1), d(15)], next: null, at },
    c4: { id: 'c4', title: 'A chore with a very very long name that keeps going and going to test the wrapping on narrow phones', icon: '🧽', every: 30, mins: 45, lastDone: '', hist: [], next: null, at: at - 864e5 * 3 },
  },
  recipes,
  meals: {
    m1: { id: 'm1', date: d(16), slot: 'dinner', recipeId: 'r1', servings: 2, at },
    m2: { id: 'm2', date: d(15), slot: 'dinner', recipeId: 'r0', servings: 2, cooked: d(15), at },
    m3: { id: 'm3', date: d(17), slot: 'lunch', text: 'Hospital canteen', servings: 1, at },
  },
  pantry: {
    p1: { id: 'p1', name: 'Eggs', qty: 6, unit: 'pcs', where: 'fridge', cat: 'dairy', expires: d(30), added: d(10), at },
    p2: { id: 'p2', name: 'Chicken thighs', qty: 500, unit: 'g', where: 'fridge', cat: 'meat', expires: d(17), added: d(14), at },
    p3: { id: 'p3', name: 'Greek yogurt', qty: 1, unit: 'pcs', where: 'fridge', cat: 'dairy', expires: d(15), added: d(8), at },
    p4: { id: 'p4', name: 'Basmati rice', qty: 2, unit: 'kg', where: 'cupboard', cat: 'dry', expires: '', added: d(1), at },
    p5: { id: 'p5', name: 'Frozen peas', qty: 0, unit: '', where: 'freezer', cat: 'frozen', expires: '2027-02-01', added: d(1), at },
  },
  shopping: {
    s1: { id: 's1', name: 'Milk', qty: 2, unit: 'l', cat: 'dairy', done: false, from: 'me', added: d(15), at },
    s2: { id: 's2', name: 'Bin bags', qty: 0, unit: '', cat: 'home', done: false, from: 'me', added: d(15), at },
    s3: { id: 's3', name: 'Lemons', qty: 3, unit: 'pcs', cat: 'produce', done: true, from: 'me', added: d(14), at },
  },
  bills: {
    b1: { id: 'b1', title: 'Electricity', icon: '💡', kind: 'bill', amount: 320, every: 1, due: d(18), remind: 3, autopay: false, paid: [], note: '', at },
    b2: { id: 'b2', title: 'Rent', icon: '🏠', kind: 'bill', amount: 2500, every: 1, due: d(14), remind: 5, autopay: false, paid: ['2026-10-14'], note: '', at },
    b3: { id: 'b3', title: 'Streaming', icon: '🎬', kind: 'subscription', amount: 30, every: 1, due: '2026-12-05', remind: 2, autopay: true, paid: [], note: '', at },
  },
  cars: { car1: { id: 'car1', name: 'Test Camry', icon: '🚗', model: 'camry-2016', severe: true, istimara: '2027-03-01', fahas: d(30), insurance: '2026-12-20', serviceMonths: 6, serviceKm: 10000, lastService: '', lastServiceKm: 0, odo: 49200, odoAt: d(10),
    odoLog: [{ date: '2026-10-01', km: 47800 }, { date: d(10), km: 49200 }],
    care: { oil: { last: '2026-07-20', lastKm: 41500, count: 3 }, rotate: { last: '2026-07-20', lastKm: 41500 }, airFilter: { last: '2025-12-01', lastKm: 33000 }, battery: { last: '2025-11-01' }, wash: { last: d(10) } },
    fuel: [{ date: d(1), litres: 40, cost: 93.2, km: 47000, full: true }, { date: d(8), litres: 45, cost: 104.85, km: 47600, full: true }],
    log: [{ date: '2026-07-20', km: 41500, items: ['oil', 'rotate'], cost: 260, place: 'Test workshop', note: '', what: 'care' }], at } },
  deleted: {}, stamps: {}, migrated: { from: 'citrus', at, counts: { chores: 4 } }, settings: {},
};
