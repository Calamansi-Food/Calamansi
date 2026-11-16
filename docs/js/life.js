// Daily life: bills, renewals and subscriptions, and the car (service, istimara, fahas, insurance). Pure (no DOM).
// Amounts are reminders for you, never payments: Calamansi does not pay anything. Dates are dd/mm/yyyy on screen.
import { keyOf, fromKey, addDays, startOfDay, uid } from './util.js';
import * as CC from './carcare.js';

const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const rec = (o) => Object.values(o || {});
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(',', '.'); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
/** The same day `n` months later (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(key, n) { const d = fromKey(key), day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return keyOf(x); }
export const daysUntil = (key, now = new Date()) => isKey(key) ? Math.round((fromKey(key) - startOfDay(now)) / 864e5) : null;

// ───────────────────────── bills, renewals, subscriptions
export const BILL_KINDS = [['bill', 'Bill'], ['renewal', 'Renewal'], ['subscription', 'Subscription']];
export const EVERY = [[1, 'Every month'], [2, 'Every 2 months'], [3, 'Every 3 months'], [6, 'Every 6 months'], [12, 'Every year'], [24, 'Every 2 years'], [0, 'Once']];
export const BILL_PRESETS = [
  { title: 'Rent', icon: '🏠', kind: 'bill', every: 1, remind: 5 },
  { title: 'Electricity', icon: '💡', kind: 'bill', every: 1, remind: 3 },
  { title: 'Water', icon: '🚰', kind: 'bill', every: 1, remind: 3 },
  { title: 'Internet', icon: '📶', kind: 'bill', every: 1, remind: 3 },
  { title: 'Mobile', icon: '📱', kind: 'bill', every: 1, remind: 3 },
  { title: 'Streaming', icon: '🎬', kind: 'subscription', every: 1, remind: 2 },
  { title: 'Gym membership', icon: '🏋️', kind: 'subscription', every: 12, remind: 14 },
  { title: 'Driving licence', icon: '🪪', kind: 'renewal', every: 120, remind: 30 },
];
export function saveBill(s, b, now = new Date()) {
  const title = txt(b.title, 50); if (!title) return s; const id = b.id || 'b' + uid();
  const every = Math.round(num(b.every, 0, 120, 1));
  const bill = { id, title, icon: txt(b.icon, 8) || '🧾', kind: BILL_KINDS.some(k => k[0] === b.kind) ? b.kind : 'bill', amount: Math.round(num(b.amount, 0, 1e7, 0) * 100) / 100, every,
    due: isKey(b.due) ? b.due : keyOf(now), remind: Math.round(num(b.remind, 0, 60, 3)), autopay: !!b.autopay, paid: (Array.isArray(b.paid) ? b.paid.filter(isKey) : []).slice(-24), note: txt(b.note, 200), ...(b.done ? { done: true } : {}), at: Date.now() };
  return { ...s, bills: { ...(s.bills || {}), [id]: bill } };
}
export const updateBill = (s, id, patch) => s.bills?.[id] ? saveBill(s, { ...s.bills[id], ...patch, id }) : s;
export function deleteBill(s, id) { const bills = { ...(s.bills || {}) }; delete bills[id]; return { ...s, bills, deleted: { ...(s.deleted || {}), [`bill:${id}`]: Date.now() } }; }
/** Paid (or renewed): it is logged, and a repeating one moves to its next due date; a one-off is finished. */
export function payBill(s, id, now = new Date()) {
  const b = s.bills?.[id]; if (!b) return s; const today = keyOf(now), paid = [...(b.paid || []), today];
  if (!b.every) return updateBill(s, id, { paid, done: true });
  return updateBill(s, id, { paid, due: addMonths(b.due, b.every) });   // this period is settled; the next one keeps its own date
}
export function billState(b, now = new Date()) {
  if (b.done) return { cls: 'ok', days: null, text: 'Done' };
  const d = daysUntil(b.due, now);
  if (d < 0) return { cls: 'late', days: d, text: `${-d} day${d === -1 ? '' : 's'} overdue` };
  if (d === 0) return { cls: 'due', days: 0, text: 'Due today' };
  if (d <= b.remind) return { cls: 'soon', days: d, text: `Due in ${d} day${d === 1 ? '' : 's'}` };
  return { cls: 'ok', days: d, text: `Due ${d} days from now` };
}
export const billList = (s) => rec(s.bills).sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
/** Bills waiting on you: overdue, or inside their reminder window. */
export const billsDue = (s, now = new Date()) => billList(s).filter(b => !b.done && daysUntil(b.due, now) <= b.remind);
/** Roughly what the repeating bills cost per month. */
export const monthly = (s) => Math.round(billList(s).filter(b => !b.done && b.every && b.amount).reduce((t, b) => t + b.amount / b.every, 0));

// ───────────────────────── the car
// Saudi papers: istimara (registration), fahas (periodic inspection, MVPI), and the insurance. Renewals are done in Absher /
// the inspection centres; Calamansi only remembers the dates.
export const CAR_PAPERS = [['istimara', 'Istimara (registration)', '📄', 30], ['fahas', 'Fahas (inspection)', '🔧', 30], ['insurance', 'Insurance', '🛡️', 21]];
export function saveCar(s, c, now = new Date()) {
  const name = txt(c.name, 40); if (!name) return s; const id = c.id || 'c' + uid();
  const car = { id, name, icon: txt(c.icon, 8) || '🚗', ...Object.fromEntries(CAR_PAPERS.map(([k]) => [k, isKey(c[k]) ? c[k] : ''])),
    serviceMonths: Math.round(num(c.serviceMonths, 0, 36, 6)), serviceKm: Math.round(num(c.serviceKm, 0, 100000, 10000)), lastService: isKey(c.lastService) ? c.lastService : '', lastServiceKm: Math.round(num(c.lastServiceKm, 0, 2e6, 0)),
    odo: Math.round(num(c.odo, 0, 2e6, 0)), odoAt: isKey(c.odoAt) ? c.odoAt : c.odo ? keyOf(now) : '', log: (Array.isArray(c.log) ? c.log : []).filter(x => x && isKey(x.date)).slice(-200), ...CC.cleanCare(c), at: Date.now() };
  if (!car.odoLog.length && car.odo && car.odoAt) car.odoLog = [{ date: car.odoAt, km: car.odo }];   // cars from 1.0 keep their reading
  if (car.odoLog.length) { const l = car.odoLog[car.odoLog.length - 1]; car.odo = l.km; car.odoAt = l.date; }
  return { ...s, cars: { ...(s.cars || {}), [id]: car } };
}
export const updateCar = (s, id, patch) => s.cars?.[id] ? saveCar(s, { ...s.cars[id], ...patch, id }) : s;
export function deleteCar(s, id) { const cars = { ...(s.cars || {}) }; delete cars[id]; return { ...s, cars, deleted: { ...(s.deleted || {}), [`car:${id}`]: Date.now() } }; }
export const carList = (s) => rec(s.cars).sort((a, b) => a.name.localeCompare(b.name));
/** A service: logged with the reading, and it resets the clock. */
export const serviced = (s, id, { date, km = 0, note = '' }) => { const c = s.cars?.[id]; if (!c) return s; const k = Math.round(num(km, 0, 2e6, 0)); return updateCar(s, id, { lastService: date, lastServiceKm: k || c.lastServiceKm, odo: Math.max(c.odo || 0, k), odoAt: k > (c.odo || 0) ? date : c.odoAt, log: [...(c.log || []), { date, km: k, note: txt(note, 80), what: 'service' }] }); };
/** When the next service is due: by date, by km (from your km per day so far), whichever comes first. */
export function serviceDue(c, now = new Date()) {
  const byDate = c.lastService && c.serviceMonths ? addMonths(c.lastService, c.serviceMonths) : '';
  let byKm = '', kmLeft = null;
  if (c.serviceKm && c.lastServiceKm && c.odo) {
    kmLeft = c.lastServiceKm + c.serviceKm - c.odo;
    const days = c.lastService && c.odoAt ? Math.max(1, daysUntil(c.odoAt, fromKey(c.lastService))) : 0, perDay = days ? (c.odo - c.lastServiceKm) / days : 0;
    if (perDay > 1) byKm = keyOf(addDays(c.odoAt ? fromKey(c.odoAt) : now, Math.round(kmLeft / perDay)));
  }
  const due = [byDate, byKm].filter(Boolean).sort()[0] || '';
  return { due, byDate, byKm, kmLeft, days: due ? daysUntil(due, now) : null };
}
/** Everything about the cars that needs you within its warning window (papers 3–4 weeks ahead, the service 2 weeks). */
export function carAlerts(s, now = new Date()) {
  const out = [];
  for (const c of carList(s)) {
    for (const [k, label, icon, warn] of CAR_PAPERS) { const d = daysUntil(c[k], now); if (d !== null && d <= warn) out.push({ car: c, kind: k, label, icon, date: c[k], days: d }); }
    if (c.model) { for (const st of CC.careAlerts(c, now)) if (!CC.ITEMS[st.id].days) out.push({ car: c, kind: st.id, label: CC.ITEMS[st.id].label, icon: CC.ITEMS[st.id].icon, date: st.date || keyOf(now), days: st.days ?? 0, kmLeft: st.kmLeft, care: true }); continue; }
    const sv = serviceDue(c, now); if (sv.due && sv.days <= 14) out.push({ car: c, kind: 'service', label: 'Service', icon: '🛠️', date: sv.due, days: sv.days, kmLeft: sv.kmLeft });
  }
  return out.sort((a, b) => a.days - b.days);
}
export const alertText = (a) => {
  if (a.care && a.kmLeft != null && a.kmLeft < 0) return `${a.car.name}: ${a.label} ${(-a.kmLeft).toLocaleString('en')} km overdue`;
  const when = a.days < 0 ? (a.care ? `overdue by ${-a.days} day${a.days === -1 ? '' : 's'}` : `expired ${-a.days} day${a.days === -1 ? '' : 's'} ago`) : a.days === 0 ? 'due today' : `due in ${a.days} day${a.days === 1 ? '' : 's'}`;
  return `${a.car.name}: ${a.label.replace(/ \(.*\)$/, '')} ${when}${a.kmLeft != null && (a.kind === 'service' || a.care) && a.kmLeft < 1500 ? ` (${Math.max(0, a.kmLeft).toLocaleString('en')} km left)` : ''}`;
};
