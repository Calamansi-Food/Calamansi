// Life tab: bills, renewals and subscriptions (paid ✓ moves a repeating one to its next date). The car has its own tab (car-ui.js).
// Calamansi only reminds; nothing is paid from here.
import { h, toast, keyOf, fromKey, fmtDate } from './util.js';
import * as L from './life.js';

let ctx = null;
export function initLife(c) { ctx = c; }
const S = () => ctx.S();
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const dmy = (k) => k ? fmtDate(fromKey(k)) : '—';
export function lifePart() {}
export function renderLife() {
  const s = S(), alerts = L.carAlerts(s).length;
  return [h('h1', {}, 'Life'), ...billsView(),
    h('button', { class: 'card lf-tocar', onClick: () => ctx.go('car') }, h('span', { class: 'lf-ic' }, '🚗'), h('span', { class: 'grow' }, h('b', {}, 'The car has its own tab'), h('span', { class: 'tiny dim' }, alerts ? ` · ${alerts} thing${alerts === 1 ? '' : 's'} need you` : ' · service, papers, road trips')), h('span', {}, '→'))];
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

// ───────────────────────── the car: care plan, readings, visits, fuel, papers
