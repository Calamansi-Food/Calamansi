// Life tab: bills, renewals and subscriptions (paid ✓ moves a repeating one to its next date), and the car — istimara, fahas,
// insurance and the service by date or km. Calamansi only reminds; nothing is paid from here.
import { h, toast, keyOf, fromKey, fmtDate } from './util.js';
import * as L from './life.js';

let ctx = null;
export function initLife(c) { ctx = c; }
const S = () => ctx.S();
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const dmy = (k) => k ? fmtDate(fromKey(k)) : '—';
let seg = 'bills';
export function lifePart(p) { if (['bills', 'car'].includes(p)) seg = p; }

export function renderLife() {
  const s = S(), due = L.billsDue(s).length, alerts = L.carAlerts(s).length;
  return [h('h1', {}, 'Life'), h('div', { class: 'seg', role: 'tablist' }, [['bills', `Bills${due ? ` · ${due} due` : ''}`], ['car', `Car${alerts ? ` · ${alerts}` : ''}`]].map(([id, l]) => h('button', { class: seg === id ? 'active' : '', role: 'tab', 'aria-selected': String(seg === id), onClick: () => { seg = id; ctx.render(); } }, l))),
    ...(seg === 'car' ? carView() : billsView())];
}

// ───────────────────────── bills
function billsView() {
  const s = S(), now = new Date(), list = L.billList(s), m = L.monthly(s), have = new Set(list.map(b => b.title.toLowerCase()));
  const out = [];
  if (list.length) out.push(h('div', { class: 'card hero lf-hero' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, 'Bills and renewals'), h('div', { class: 'small' }, `${L.billsDue(s, now).length ? `${L.billsDue(s, now).length} waiting on you` : 'Nothing due right now'}${m ? ` · about ${m} SAR a month` : ''}`)), h('button', { class: 'btn primary', onClick: () => billSheet(null) }, '+ Add'))));
  out.push(h('div', { class: 'lf-list' }, list.map(b => billRow(b, now))));
  const rest = L.BILL_PRESETS.filter(p => !have.has(p.title.toLowerCase()));
  out.push(h('div', { class: 'card' }, h('div', { class: 'title' }, list.length ? 'Add another' : 'Start with'), h('div', { class: 'chips' }, rest.map(p => h('button', { class: 'chip', onClick: () => billSheet(p) }, `${p.icon} ${p.title}`)), h('button', { class: 'chip', onClick: () => billSheet(null) }, '+ Your own')),
    h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Bills due soon go to Citrus as tasks on their day. Calamansi never pays anything itself.')));
  return out;
}
function billRow(b, now) {
  const st = L.billState(b, now);
  const pay = () => { const before = S(); ctx.update(s => L.payBill(s, b.id, now)); ctx.render(); ctx.cheer?.(); const nb = S().bills[b.id]; toast(`${b.title} ${b.kind === 'renewal' ? 'renewed' : 'paid'}${nb.done ? '' : ` · next ${dmy(nb.due)}`}`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  return h('div', { class: `card lf-bill st-${st.cls}` }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, b.icon), h('div', { class: 'grow ch-main', role: 'button', tabindex: '0', onClick: () => billSheet(b), onKeydown: (e) => { if (e.key === 'Enter') billSheet(b); } }, h('div', { class: 'name' }, b.title, b.autopay ? h('span', { class: 'chip tiny-chip' }, 'auto-pay') : null), h('div', { class: 'tiny dim' }, [b.amount ? `${b.amount} SAR` : '', L.EVERY.find(e => e[0] === b.every)?.[1] || `every ${b.every} months`, `due ${dmy(b.due)}`].filter(Boolean).join(' · '))),
    b.done ? h('span', { class: 'chip off' }, 'Done') : h('button', { class: `btn sm ${st.cls === 'ok' ? '' : 'primary'}`, onClick: pay }, b.kind === 'renewal' ? 'Renewed ✓' : 'Paid ✓')),
    b.done ? null : h('div', { class: `ch-status ${st.cls === 'soon' ? 'due' : st.cls}` }, st.text));
}
function billSheet(b) {
  const isNew = !b?.id, now = new Date();
  const t = h('input', { value: b?.title || '', maxlength: 50, placeholder: 'e.g. Electricity' }), ic = h('input', { value: b?.icon || '🧾', style: { width: '70px' }, 'aria-label': 'Icon' });
  const kind = h('select', {}, L.BILL_KINDS.map(([id, l]) => h('option', { value: id, selected: (b?.kind || 'bill') === id }, l))), every = h('select', {}, L.EVERY.map(([v, l]) => h('option', { value: v, selected: (b?.every ?? 1) === v }, l)));
  if (b?.every && !L.EVERY.some(e => e[0] === b.every)) every.append(h('option', { value: b.every, selected: true }, `Every ${b.every} months`));
  const amount = h('input', { type: 'number', min: 0, step: 'any', value: b?.amount || '', inputmode: 'decimal', placeholder: 'optional' }), due = h('input', { type: 'date', value: b?.due || keyOf(now) }), remind = h('input', { type: 'number', min: 0, max: 60, value: b?.remind ?? 3, inputmode: 'numeric' });
  const auto = h('input', { type: 'checkbox', checked: !!b?.autopay }), note = h('input', { value: b?.note || '', maxlength: 200, placeholder: 'account name, where to pay…' }), err = h('div', { class: 'ch-err', role: 'alert' });
  const box = ctx.sheet([h('h2', {}, isNew ? 'New bill or renewal' : b.title), h('div', { class: 'ch-name-row' }, field('Icon', ic), field('Name', t)), h('div', { class: 'grid2' }, field('Kind', kind), field('Repeats', every)),
    h('div', { class: 'grid3' }, field('Amount (SAR)', amount), field('Next due', due), field('Remind (days before)', remind)), h('label', { class: 'kt-flag' }, auto, ' Paid automatically (remind me to check it went through)'), field('Note', note), err,
    !isNew && b.paid?.length ? h('div', { class: 'tiny dim' }, `Paid: ${b.paid.slice(-6).reverse().map(dmy).join(' · ')}`) : null,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      if (!t.value.trim()) { err.textContent = 'Give it a name'; return; } if (!due.value) { err.textContent = 'When is it due next?'; return; }
      ctx.update(s => L.saveBill(s, { ...(b || {}), id: b?.id, title: t.value, icon: ic.value, kind: kind.value, every: +every.value, amount: amount.value, due: due.value, remind: remind.value, autopay: auto.checked, note: note.value, done: b?.done && due.value === b.due })); box.close(); ctx.render(); } }, 'Save'),
      !isNew ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(s => L.deleteBill(s, b.id)); box.close(); ctx.render(); toast(`${b.title} deleted`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Delete') : null)]);
  box.box.classList.add('ch-sheet');
}

// ───────────────────────── the car
function carView() {
  const s = S(), now = new Date(), cars = L.carList(s), out = [];
  if (!cars.length) { out.push(h('div', { class: 'card empty' }, 'No car yet.', h('div', { class: 'tiny dim' }, 'Add it with its istimara, fahas and insurance dates, and when it was last serviced: Calamansi reminds you a few weeks ahead.'), h('button', { class: 'btn primary', style: { marginTop: '10px' }, onClick: () => carSheet(null) }, '+ Add your car'))); return out; }
  for (const c of cars) {
    const sv = L.serviceDue(c, now), dl = (k) => L.daysUntil(k, now);
    const line = (icon, label, key, warn) => { const d = dl(key); return h('div', { class: `lf-paper ${d === null ? '' : d < 0 ? 'late' : d <= warn ? 'soon' : ''}` }, h('span', {}, icon), h('span', { class: 'grow' }, label), h('b', {}, key ? dmy(key) : 'not set'), h('span', { class: 'tiny dim' }, d === null ? '' : d < 0 ? `${-d} d ago` : `${d} d`)); };
    const odo = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: c.odo ? String(c.odo) : 'km now', 'aria-label': 'Odometer', style: { maxWidth: '130px' } });
    out.push(h('div', { class: 'card lf-car' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, c.icon), h('div', { class: 'grow' }, h('div', { class: 'name' }, c.name), h('div', { class: 'tiny dim' }, c.odo ? `${c.odo.toLocaleString('en')} km on ${dmy(c.odoAt)}` : 'odometer not set')), h('button', { class: 'btn sm ghost', 'aria-label': `Edit ${c.name}`, onClick: () => carSheet(c) }, '⋯')),
      h('div', { class: 'lf-papers' }, ...L.CAR_PAPERS.map(([k, label, icon, warn]) => line(icon, label, c[k], warn)), line('🛠️', `Service${sv.kmLeft != null ? ` (${Math.max(0, sv.kmLeft).toLocaleString('en')} km left)` : ''}`, sv.due, 14)),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, odo, h('button', { class: 'btn sm', onClick: () => { const v = +odo.value; if (!(v > 0)) return toast('Type the km on the dash'); if (c.odo && v < c.odo) return toast(`That is less than the last reading (${c.odo} km)`, 'err'); ctx.update(st => L.updateCar(st, c.id, { odo: v, odoAt: keyOf(now) })); ctx.render(); toast('Reading saved', 'ok'); } }, 'Save km'),
        h('button', { class: 'btn sm primary', onClick: () => { const before = S(); ctx.update(st => L.serviced(st, c.id, { date: keyOf(now), km: +odo.value || c.odo || 0 })); ctx.render(); toast('Service logged', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Serviced today'))));
  }
  out.push(h('button', { class: 'btn', onClick: () => carSheet(null) }, '+ Another car'), h('div', { class: 'tiny dim', style: { margin: '10px 2px' } }, 'Renew the istimara in Absher; fahas needs a booking at an inspection centre before it lapses. Reminders go to Citrus 3–4 weeks ahead.'));
  return out;
}
function carSheet(c) {
  const isNew = !c, now = new Date();
  const n = h('input', { value: c?.name || '', maxlength: 40, placeholder: 'e.g. My car' }), ic = h('input', { value: c?.icon || '🚗', style: { width: '70px' }, 'aria-label': 'Icon' });
  const dates = Object.fromEntries(L.CAR_PAPERS.map(([k]) => [k, h('input', { type: 'date', value: c?.[k] || '' })]));
  const sm = h('input', { type: 'number', min: 0, max: 36, value: c?.serviceMonths ?? 6, inputmode: 'numeric' }), sk = h('input', { type: 'number', min: 0, max: 100000, value: c?.serviceKm ?? 10000, inputmode: 'numeric' });
  const ls = h('input', { type: 'date', value: c?.lastService || '' }), lk = h('input', { type: 'number', min: 0, value: c?.lastServiceKm || '', inputmode: 'numeric' }), odo = h('input', { type: 'number', min: 0, value: c?.odo || '', inputmode: 'numeric' }), err = h('div', { class: 'ch-err', role: 'alert' });
  const box = ctx.sheet([h('h2', {}, isNew ? 'Your car' : c.name), h('div', { class: 'ch-name-row' }, field('Icon', ic), field('Name', n)),
    h('div', { class: 'grid3' }, ...L.CAR_PAPERS.map(([k, label]) => field(`${label.replace(/ \(.*\)$/, '')} expires`, dates[k]))),
    h('div', { class: 'grid3' }, field('Service every (months)', sm), field('or every (km)', sk), field('Odometer now (km)', odo)), h('div', { class: 'grid2' }, field('Last service', ls), field('At (km)', lk)), err,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      if (!n.value.trim()) { err.textContent = 'Give it a name'; return; }
      ctx.update(s => L.saveCar(s, { ...(c || {}), id: c?.id, name: n.value, icon: ic.value, ...Object.fromEntries(Object.entries(dates).map(([k, i]) => [k, i.value])), serviceMonths: sm.value, serviceKm: sk.value, lastService: ls.value, lastServiceKm: lk.value, odo: odo.value, odoAt: +odo.value !== (c?.odo || 0) ? keyOf(now) : c?.odoAt }, now)); box.close(); ctx.render(); } }, 'Save'),
      !isNew ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(s => L.deleteCar(s, c.id)); box.close(); ctx.render(); toast(`${c.name} removed`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Remove') : null)]);
  box.box.classList.add('ch-sheet');
}
