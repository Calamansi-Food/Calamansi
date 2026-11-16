// Life tab: bills, renewals and subscriptions (paid ✓ moves a repeating one to its next date), and the car — istimara, fahas,
// insurance and the service by date or km. Calamansi only reminds; nothing is paid from here.
import { h, toast, keyOf, fromKey, fmtDate } from './util.js';
import * as L from './life.js';
import * as CC from './carcare.js';
import * as AN from './anatomy.js';

let ctx = null;
export function initLife(c) { ctx = c; }
const S = () => ctx.S();
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const dmy = (k) => k ? fmtDate(fromKey(k)) : '—';
let seg = 'bills';
export function lifePart(p) { if (['bills', 'car', 'anatomy'].includes(p)) seg = p; }

export function renderLife() {
  const s = S(), due = L.billsDue(s).length, alerts = L.carAlerts(s).length;
  return [h('h1', {}, 'Life'), h('div', { class: 'seg', role: 'tablist' }, [['bills', `Bills${due ? ` · ${due} due` : ''}`], ['car', `Car${alerts ? ` · ${alerts}` : ''}`], ['anatomy', 'Anatomy']].map(([id, l]) => h('button', { class: seg === id ? 'active' : '', role: 'tab', 'aria-selected': String(seg === id), onClick: () => { seg = id; ctx.render(); } }, l))),
    ...(seg === 'car' ? carView() : seg === 'anatomy' ? anatomyView() : billsView())];
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
const kmT = (n) => `${Math.round(n).toLocaleString('en')} km`;
const putCar = (c) => ctx.update(st => L.saveCar(st, c));
function carView() {
  const s = S(), now = new Date(), cars = L.carList(s), out = [];
  if (!cars.length) {
    out.push(h('div', { class: 'card hero lf-carhero empty' }, h('div', { class: 'lf-big' }, '🚗'), h('div', { class: 'title' }, 'Your car, looked after'), h('div', { class: 'small' }, 'Oil, tyres, filters, battery, AC, the papers and fuel — each due by km or by date, whichever comes first. Reminders reach Citrus before they are late.'),
      h('div', { class: 'row wrap', style: { marginTop: '12px' } }, h('button', { class: 'btn primary', onClick: () => newCar('camry-2016') }, '🚗 Toyota Camry 2016'), h('button', { class: 'btn', onClick: () => newCar('generic') }, 'Another car'))));
    return out;
  }
  for (const c of cars) out.push(...carBlock(c, now));
  out.push(h('div', { class: 'row wrap', style: { margin: '4px 0 10px' } }, h('button', { class: 'btn', onClick: () => newCar('camry-2016') }, '+ Another Camry'), h('button', { class: 'btn', onClick: () => newCar('generic') }, '+ Another car')),
    h('details', { class: 'card adv' }, h('summary', {}, h('b', {}, 'Where these numbers come from')), h('ul', { class: 'lf-src' }, CC.SOURCES.map(([t, u]) => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, t))))),
    h('div', { class: 'tiny dim', style: { margin: '4px 2px 14px' } }, 'Intervals mix Toyota’s published schedule with what Saudi service sources and owner forums advise; the “hot & dusty” plan is Toyota’s severe-use one (heat, dust, city traffic). Your owner’s manual and your workshop’s sticker win — change any interval by tapping it. Istimara renews in Absher; fahas needs a booking before it lapses.'));
  return out;
}
function newCar(model) { const base = CC.fromModel(model); carSheet(null, base); }
function carBlock(c, now) {
  if (!c.model) return [legacyCar(c, now)];
  const odo = CC.odoNow(c, now), kpd = CC.kmPerDay(c), items = CC.plan(c, now), m = CC.MODELS[c.model];
  const urgent = items.filter(x => x.state === 'late' || x.state === 'soon'), known = items.filter(x => x.state === 'ok'), unknown = items.filter(x => x.state === 'unknown');
  const odoIn = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: 'km on the dash', 'aria-label': `Odometer for ${c.name}` });
  const saveKm = () => { const v = +odoIn.value; if (!(v > 0)) return toast('Type the km on the dash'); const nc = CC.addReading(c, v, keyOf(new Date())); if (!nc) return toast(`That is less than the last reading (${kmT(odo.last || c.odo)})`, 'err'); putCar(nc); ctx.render(); toast('Reading saved', 'ok'); };
  odoIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKm(); });
  const cost = CC.costs(c, now);
  const blocks = [
    h('div', { class: 'card hero lf-carhero' },
      h('div', { class: 'row' }, h('span', { class: 'lf-big' }, c.icon), h('div', { class: 'grow' }, h('div', { class: 'lf-carname' }, c.name), h('div', { class: 'tiny dim' }, m?.name || '')), h('button', { class: 'btn sm ghost', 'aria-label': `Edit ${c.name}`, onClick: () => carSheet(c) }, '⋯')),
      h('div', { class: 'lf-odo' }, h('div', {}, h('div', { class: 'lf-odo-n' }, odo.km ? `${odo.guessed ? '≈ ' : ''}${Math.round(odo.km).toLocaleString('en')}` : '—', h('small', {}, ' km')), h('div', { class: 'tiny dim' }, odo.km ? `${odo.guessed ? `last read ${dmy(odo.at)} · ` : ''}${kpd ? `${kpd} km a day` : 'two readings a week apart give your km a day'}` : 'Add today’s reading to start')),
        h('div', { class: 'row lf-odo-in' }, odoIn, h('button', { class: 'btn sm primary', onClick: saveKm }, 'Save'))),
      h('div', { class: 'row wrap lf-acts' }, h('button', { class: 'btn primary', onClick: () => visitSheet(c) }, '🔧 Log a service'), h('button', { class: 'btn', onClick: () => fuelSheet(c) }, '⛽ Fuel'),
        h('button', { class: `chip lf-sev ${c.severe !== false ? 'sel' : ''}`, 'aria-pressed': String(c.severe !== false), onClick: () => { putCar({ ...c, severe: c.severe === false }); ctx.render(); } }, c.severe !== false ? '🔥 Hot & dusty plan' : 'Normal plan'))),
    urgent.length ? h('div', { class: 'card lf-due' }, h('div', { class: 'title' }, 'Due now'), urgent.map(st => careRow(c, st))) : h('div', { class: 'card lf-due ok' }, h('div', { class: 'small' }, unknown.length === items.length ? 'Set up the plan below: say when each thing was last done.' : '✨ Nothing due. Next: ' + (known[0] ? `${known[0].def.label} ${CC.dueText(known[0], dmy)}` : '—'))),
    known.length ? h('div', { class: 'card' }, h('div', { class: 'title' }, 'Coming up'), known.slice(0, 8).map(st => careRow(c, st)), known.length > 8 ? h('details', { class: 'adv' }, h('summary', { class: 'small' }, `${known.length - 8} more`), known.slice(8).map(st => careRow(c, st))) : null) : null,
    unknown.length ? h('div', { class: 'card lf-setup' }, h('div', { class: 'title' }, `Set up the plan (${unknown.length})`), h('div', { class: 'tiny dim', style: { marginBottom: '6px' } }, 'When was each last done? A guess is fine — it starts the countdown. The receipt or the sticker on the windscreen usually says.'), unknown.map(st => careRow(c, st))) : null,
    papersCard(c, now),
    fuelCard(c, cost),
    historyCard(c),
    c.model === 'camry-2016' ? h('div', { class: 'card lf-known' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'What Camry owners run into'), h('button', { class: 'btn sm ghost', onClick: () => { seg = 'anatomy'; ctx.render(); } }, '🔍 Anatomy')), h('div', { class: 'lf-kgrid' }, CC.KNOWN.map(k => h('div', { class: 'lf-k' }, h('span', { class: 'lf-ki' }, k.icon), h('div', {}, h('b', {}, k.title), h('div', { class: 'tiny dim' }, k.body)))))) : null,
    m?.facts?.length ? h('details', { class: 'card adv lf-facts' }, h('summary', {}, h('b', {}, `${c.name} facts`)), h('div', { class: 'lf-factgrid' }, m.facts.map(([k, v]) => [h('span', { class: 'tiny dim' }, k), h('span', { class: 'small' }, v)]))) : null,
  ];
  return blocks;
}
function careRow(c, st) {
  const w = Math.round(Math.min(1, st.used) * 100);
  return h('button', { class: `lf-item st-${st.state}`, onClick: () => itemSheet(c, st.id) },
    h('span', { class: 'lf-ii' }, st.def.icon), h('span', { class: 'grow lf-im' }, h('span', { class: 'lf-in' }, st.def.label), h('span', { class: 'tiny lf-id' }, CC.dueText(st, dmy)), st.state !== 'unknown' ? h('span', { class: 'lf-bar' }, h('i', { style: { width: `${w}%` } })) : null),
    st.state === 'late' ? h('span', { class: 'chip lf-tag late' }, 'Overdue') : st.state === 'soon' ? h('span', { class: 'chip lf-tag soon' }, 'Soon') : null);
}
function itemSheet(c, id) {
  const now = new Date(), st = CC.itemState(c, id, now), iv = st.iv, def = st.def, odo = CC.odoNow(c, now);
  const d = h('input', { type: 'date', value: st.last || keyOf(now), max: keyOf(now) }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: st.lastKm || (st.last ? '' : Math.round(odo.km) || ''), placeholder: 'km' });
  const ik = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.km || '', placeholder: 'km' }), im = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.months || '', placeholder: 'months' }), idy = h('input', { type: 'number', min: 1, inputmode: 'numeric', value: iv.days || '', placeholder: 'days' });
  const done = () => { const before = S(); putCar(CC.logVisit(c, { date: keyOf(now), km: Math.round(odo.km) || 0, items: [id] })); box.close(); ctx.render(); ctx.cheer?.(); toast(`${def.label} done`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  const box = ctx.sheet([h('h2', {}, `${def.icon} ${def.label}`), h('div', { class: 'small' }, def.what), h('div', { class: 'tiny dim', style: { margin: '4px 0 10px' } }, def.why),
    CC.VOICES[id] ? h('div', { class: 'lf-voices' }, CC.VOICES[id].map(([who, say]) => h('div', { class: 'lf-voice' }, h('b', {}, who), h('span', { class: 'small' }, say)))) : null,
    h('div', { class: `lf-duebox st-${st.state}` }, h('b', {}, st.state === 'unknown' ? 'Not set up yet' : CC.dueText(st, dmy)), st.last ? h('span', { class: 'tiny dim' }, ` · last ${dmy(st.last)}${st.lastKm ? ` at ${kmT(st.lastKm)}` : ''}`) : null),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: done }, 'Done today ✓')),
    h('div', { class: 'title', style: { marginTop: '14px' } }, 'Last done'), h('div', { class: 'grid2' }, field('Date', d), def.days ? null : field('At (km)', k)),
    h('button', { class: 'btn', onClick: () => { if (!d.value) return; putCar(CC.setLast(c, id, { date: d.value, km: k.value })); box.close(); ctx.render(); toast('Saved', 'ok'); } }, 'Save last done'),
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Interval'), def.days ? h('div', { class: 'grid2' }, field('Every (days)', idy)) : h('div', { class: 'grid2' }, field('Every (km)', ik), field('or every (months)', im)),
      h('div', { class: 'tiny dim' }, `Plan: ${def.days ? `every ${def.days} days` : [def.km || def.nKm ? `${kmT(c.severe !== false ? def.km : def.nKm)}` : '', (c.severe !== false ? def.months : def.nMonths) ? `${c.severe !== false ? def.months : def.nMonths} months` : ''].filter(Boolean).join(' / ')}. Empty = the plan.`),
      h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onClick: () => { putCar(CC.setInterval(c, id, def.days ? { days: idy.value } : { km: ik.value, months: im.value })); box.close(); ctx.render(); toast('Interval saved', 'ok'); } }, 'Save interval'),
        h('button', { class: 'btn sm ghost', onClick: () => { putCar(CC.setInterval(c, id, { off: true })); box.close(); ctx.render(); toast(`${def.label} hidden — bring it back in the car’s ⋯ sheet`); } }, 'Not for my car'))) ]);
}
function visitSheet(c) {
  const now = new Date(), odo = CC.odoNow(c, now), items = CC.plan(c, now);
  const pick = new Set(items.filter(x => x.state === 'late' || x.state === 'soon').filter(x => !x.def.days).map(x => x.id));
  const d = h('input', { type: 'date', value: keyOf(now), max: keyOf(now) }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: odo.km ? Math.round(odo.km) : '', placeholder: 'km on the dash' });
  const cost = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'SAR (optional)' }), place = h('input', { maxlength: 60, placeholder: 'workshop (optional)' }), note = h('input', { maxlength: 140, placeholder: 'note (optional)' });
  const chips = h('div', { class: 'chips' }); const paint = () => chips.replaceChildren(...items.map(x => h('button', { class: `chip ${pick.has(x.id) ? 'sel' : ''}`, 'aria-pressed': String(pick.has(x.id)), onClick: () => { pick.has(x.id) ? pick.delete(x.id) : pick.add(x.id); paint(); } }, `${x.def.icon} ${x.def.label}`))); paint();
  const err = h('div', { class: 'ch-err', role: 'alert' });
  const box = ctx.sheet([h('h2', {}, `Service for ${c.name}`), h('div', { class: 'small muted' }, 'Tick what was done. Each ticked item restarts from this date and reading.'), chips,
    h('div', { class: 'grid2', style: { marginTop: '10px' } }, field('Date', d), field('Odometer (km)', k)), h('div', { class: 'grid2' }, field('Cost', cost), field('Where', place)), field('Note', note), err,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      if (!pick.size) { err.textContent = 'Tick at least one thing'; return; }
      const before = S(), last = (c.odoLog || []).filter(r => r.date <= d.value).pop();
      if (+k.value && last && +k.value < last.km) { err.textContent = `The odometer read ${kmT(last.km)} on ${dmy(last.date)} — check the km`; return; }
      putCar(CC.logVisit(c, { date: d.value, km: k.value, items: [...pick], cost: cost.value, place: place.value, note: note.value })); box.close(); ctx.render(); ctx.cheer?.();
      toast(`${pick.size} item${pick.size === 1 ? '' : 's'} logged`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Save the service'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}
function fuelSheet(c) {
  const now = new Date(), odo = CC.odoNow(c, now);
  const d = h('input', { type: 'date', value: keyOf(now), max: keyOf(now) }), l = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'litres' }), sar = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'SAR' }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: odo.km ? `≈ ${Math.round(odo.km)}` : 'km' });
  const full = h('input', { type: 'checkbox', checked: true }), err = h('div', { class: 'ch-err', role: 'alert' });
  const box = ctx.sheet([h('h2', {}, '⛽ Fill-up'), h('div', { class: 'grid2' }, field('Litres', l), field('Paid (SAR)', sar)), h('div', { class: 'grid2' }, field('Odometer (km)', k), field('Date', d)), h('label', { class: 'kt-flag' }, full, ' Filled to full (needed for L/100 km)'), err,
    h('div', { class: 'tiny dim' }, 'Fill to full twice and Calamansi works out your consumption and fuel cost per km.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { if (!(+l.value > 0)) { err.textContent = 'How many litres?'; return; } const before = S(); putCar(CC.addFuel(c, { date: d.value, litres: l.value, cost: sar.value, km: k.value, full: full.checked })); box.close(); ctx.render(); toast('Fill-up saved', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Save'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
}
function papersCard(c, now) {
  const line = (icon, label, key, warn) => { const d = L.daysUntil(key, now); return h('div', { class: `lf-paper ${d === null ? '' : d < 0 ? 'late' : d <= warn ? 'soon' : ''}` }, h('span', {}, icon), h('span', { class: 'grow' }, label), h('b', {}, key ? dmy(key) : 'not set'), h('span', { class: 'tiny dim' }, d === null ? '' : d < 0 ? `${-d} d ago` : `${d} d`)); };
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Papers'), h('button', { class: 'btn sm ghost', onClick: () => carSheet(c) }, 'Edit')), h('div', { class: 'lf-papers' }, ...L.CAR_PAPERS.map(([k, label, icon, warn]) => line(icon, label, c[k], warn))));
}
function fuelCard(c, cost) {
  const eco = CC.economy(c), last = (c.fuel || []).slice(-1)[0];
  if (!c.fuel?.length && !cost.care) return null;
  const st = (n, l) => h('div', { class: 'lf-stat' }, h('b', {}, n), h('span', { class: 'tiny dim' }, l));
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Fuel and money'), h('button', { class: 'btn sm', onClick: () => fuelSheet(c) }, '+ Fill-up')),
    h('div', { class: 'lf-stats' }, st(cost.l100 ? `${cost.l100}` : '—', 'L / 100 km'), st(cost.perKm ? `${cost.perKm}` : '—', 'SAR per km'), st(`${cost.fuel.toLocaleString('en')}`, 'SAR fuel this year'), st(`${cost.care.toLocaleString('en')}`, 'SAR servicing this year')),
    last ? h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, `Last fill-up ${dmy(last.date)}: ${last.litres} L${last.cost ? ` for ${last.cost} SAR` : ''}${eco.length ? ` · last tank ${eco[eco.length - 1].l100} L/100 km` : ''}`) : null);
}
function historyCard(c) {
  const log = [...(c.log || [])].reverse().slice(0, 8); if (!log.length) return null;
  return h('div', { class: 'card' }, h('div', { class: 'title' }, 'History'), log.map(x => h('div', { class: 'lf-hist' }, h('b', {}, dmy(x.date)), h('span', { class: 'grow small' }, (x.items || []).map(i => CC.ITEMS[i]?.label || i).join(', ') || x.what || 'service', x.place ? h('span', { class: 'tiny dim' }, ` · ${x.place}`) : null), h('span', { class: 'tiny dim' }, [x.km ? kmT(x.km) : '', x.cost ? `${x.cost} SAR` : ''].filter(Boolean).join(' · ')))));
}
function legacyCar(c, now) {
  const sv = L.serviceDue(c, now);
  return h('div', { class: 'card lf-car' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, c.icon), h('div', { class: 'grow' }, h('div', { class: 'name' }, c.name), h('div', { class: 'tiny dim' }, sv.due ? `Service due ${dmy(sv.due)}` : 'No care plan yet'))),
    h('div', { class: 'small', style: { margin: '8px 0' } }, 'Give it a care plan: oil, tyres, filters, battery and more, each by km or date.'),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onClick: () => { putCar({ ...c, ...CC.fromModel('camry-2016'), name: c.name, icon: c.icon }); ctx.render(); } }, 'It’s a Camry 2016'), h('button', { class: 'btn', onClick: () => { putCar({ ...c, ...CC.fromModel('generic'), name: c.name, icon: c.icon }); ctx.render(); } }, 'Another car'), h('button', { class: 'btn ghost', onClick: () => carSheet(c) }, 'Edit')));
}
function carSheet(c, base = null) {
  const isNew = !c, now = new Date(), src = c || base || CC.fromModel('generic');
  const n = h('input', { value: src.name || '', maxlength: 40, placeholder: 'e.g. Camry' }), ic = h('input', { value: src.icon || '🚗', style: { width: '70px' }, 'aria-label': 'Icon' });
  const model = h('select', {}, Object.entries(CC.MODELS).map(([id, m]) => h('option', { value: id, selected: (src.model || 'generic') === id }, m.name)));
  const dates = Object.fromEntries(L.CAR_PAPERS.map(([k]) => [k, h('input', { type: 'date', value: src[k] || '' })]));
  const odo = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: isNew ? '' : '', placeholder: c?.odo ? `${c.odo}` : 'km now' }), err = h('div', { class: 'ch-err', role: 'alert' });
  const hidden = Object.entries(src.care || {}).filter(([, v]) => v.off).map(([id]) => id);
  const box = ctx.sheet([h('h2', {}, isNew ? 'Your car' : c.name), h('div', { class: 'ch-name-row' }, field('Icon', ic), field('Name', n)), field('Model', model),
    h('div', { class: 'grid3' }, ...L.CAR_PAPERS.map(([k, label]) => field(`${label.replace(/ \(.*\)$/, '')} expires`, dates[k]))), field(isNew ? 'Odometer now (km)' : 'New odometer reading (km)', odo),
    hidden.length ? h('div', { class: 'chips' }, h('span', { class: 'tiny dim' }, 'Hidden:'), hidden.map(id => h('button', { class: 'chip', onClick: () => { putCar(CC.setInterval(c, id, { off: false })); box.close(); ctx.render(); } }, `${CC.ITEMS[id].icon} ${CC.ITEMS[id].label} — show`))) : null, err,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      if (!n.value.trim()) { err.textContent = 'Give it a name'; return; }
      let car = { ...src, ...(c || {}), id: c?.id, name: n.value, icon: ic.value, model: model.value, ...Object.fromEntries(Object.entries(dates).map(([k, i]) => [k, i.value])) };
      if (+odo.value) { const r = CC.addReading(car, odo.value, keyOf(now)); if (!r) { err.textContent = 'That is less than the last reading'; return; } car = r; }
      ctx.update(s => L.saveCar(s, car, now)); box.close(); ctx.render(); toast(isNew ? `${car.name} added — now say when things were last done` : 'Saved', 'ok'); } }, 'Save'),
      !isNew ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(s => L.deleteCar(s, c.id)); box.close(); ctx.render(); toast(`${c.name} removed`, '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Remove') : null)]);
  box.box.classList.add('ch-sheet');
}

// ───────────────────────── anatomy: tap a part to learn it; "Find it" to test yourself
let anView = 'bay', game = null;
function anatomyView() {
  const wrap = h('div', { class: 'an-wrap' }); wrap.innerHTML = AN.drawing(anView);
  const svg = wrap.firstElementChild;
  const open = (id) => { const p = AN.PARTS.find(x => x.id === id); if (!p) return; if (game) return guess(id); partSheet(p); };
  svg.addEventListener('click', (e) => { const g = e.target.closest('.an-hot'); if (g) open(g.dataset.part); });
  svg.addEventListener('keydown', (e) => { const g = e.target.closest('.an-hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(g.dataset.part); } });
  if (game?.flash) for (const [id, cls] of Object.entries(game.flash)) svg.querySelector(`[data-part="${id}"]`)?.classList.add(cls);
  const parts = AN.partsIn(anView);
  return [h('div', { class: 'card hero an-hero' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, 'Camry anatomy'), h('div', { class: 'small' }, game ? `Find: ${game.list[game.i]?.name || '—'}` : 'Tap a number to see what it does, how to check it and the signs of trouble.')),
      h('button', { class: `btn ${game ? '' : 'primary'}`, onClick: () => { game = game ? null : { list: AN.findRound(anView), i: 0, right: 0, tries: 0, flash: null }; ctx.render(); } }, game ? 'Stop' : '🎯 Find it')),
      h('div', { class: 'seg', style: { marginTop: '10px' } }, AN.VIEWS.map(([id, l]) => h('button', { class: anView === id ? 'active' : '', onClick: () => { anView = id; game = null; ctx.render(); } }, l))),
      game ? h('div', { class: 'an-score' }, h('b', {}, `${game.right}/${game.list.length}`), h('span', { class: 'tiny dim' }, ` · part ${Math.min(game.i + 1, game.list.length)} of ${game.list.length}`)) : null),
    h('div', { class: 'card an-card' }, wrap, h('div', { class: 'tiny dim' }, anView === 'bay' ? 'Seen from above, front of the car at the top. Positions are approximate.' : 'Seen from the side, front on the left. Positions are approximate.')),
    h('div', { class: 'card' }, h('div', { class: 'an-list' }, parts.map((p, i) => h('button', { class: 'an-li', onClick: () => game ? guess(p.id) : partSheet(p) }, h('span', { class: 'an-n' }, i + 1), h('span', { class: 'an-ic' }, p.icon), h('span', { class: 'grow small' }, p.name)))))];
}
function guess(id) {
  const want = game.list[game.i]; if (!want) return;
  game.tries++; const ok = want.id === id;
  game.flash = { [id]: ok ? 'right' : 'wrong', ...(ok ? {} : { [want.id]: 'show' }) };
  if (ok) { game.right++; ctx.cheer?.(); }
  toast(ok ? `Yes — ${want.name}` : `That’s ${AN.PARTS.find(p => p.id === id)?.name}. ${want.name} is lit up.`, ok ? 'ok' : '');
  game.i++; ctx.render();
  if (game.i >= game.list.length) { const r = game.right, n = game.list.length; setTimeout(() => { toast(`${r}/${n}${r === n ? ' — you know this car' : r >= n - 2 ? ' — nearly' : ' — again?'}`, 'ok'); game = null; ctx.render(); }, 900); }
  else setTimeout(() => { if (game) { game.flash = null; ctx.render(); } }, 1100);
}
function partSheet(p) {
  const s = S(), car = L.carList(s).find(c => c.model === 'camry-2016') || L.carList(s)[0];
  const care = car?.model ? p.care.map(id => CC.itemState(car, id)) : [];
  const box = ctx.sheet([h('h2', {}, `${p.icon} ${p.name}`), h('div', { class: 'an-sec' }, h('b', {}, 'What it does'), h('div', { class: 'small' }, p.does)),
    h('div', { class: 'an-sec' }, h('b', {}, 'How to check'), h('div', { class: 'small' }, p.check)), p.warn !== '—' ? h('div', { class: 'an-sec warn' }, h('b', {}, 'Signs of trouble'), h('div', { class: 'small' }, p.warn)) : null,
    care.length ? h('div', { class: 'an-sec' }, h('b', {}, `On ${car.name}`), care.map(st => h('button', { class: `lf-item st-${st.state}`, onClick: () => { box.close(); itemSheet(car, st.id); } }, h('span', { class: 'lf-ii' }, st.def.icon), h('span', { class: 'grow lf-im' }, h('span', { class: 'lf-in' }, st.def.label), h('span', { class: 'tiny lf-id' }, CC.dueText(st, dmy)))))) : null]);
}
