// Car tab: your car looked after — care by km or date (English + Arabic workshop names), a planned service you can show the
// workshop, papers + insurance + your licence, a road-trip planner, the accident card and the anatomy. Calamansi only reminds.
import { h, toast, keyOf, fromKey, fmtDate } from './util.js';
import * as L from './life.js';
import * as CC from './carcare.js';
import * as AN from './anatomy.js';
import * as PO from './policy.js';

let ctx = null;
export function initCar(c) { ctx = c; }
const S = () => ctx.S();
const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
const dmy = (k) => k ? fmtDate(fromKey(k)) : '—';
let seg = 'overview', carId = '', planOpen = false;
const PARTS = [['overview', 'Overview'], ['service', 'Service'], ['papers', 'Papers'], ['trip', 'Road trip'], ['anatomy', 'Anatomy']];
export function carPart(p) { if (p === 'car') p = 'overview'; if (PARTS.some(([id]) => id === p)) seg = p; }
const kmT = (n) => `${Math.round(n).toLocaleString('en')} km`;
const putCar = (c) => ctx.update(st => L.saveCar(st, c));
export function renderCar() {
  const s = S(), now = new Date(), cars = L.carList(s);
  if (!cars.length) return [h('h1', {}, 'Car'),
    h('div', { class: 'card hero lf-carhero empty' }, h('div', { class: 'lf-big' }, '🚗'), h('div', { class: 'title' }, 'Your car, looked after'), h('div', { class: 'small' }, 'Oil, tyres, brakes, suspension, the papers, fuel and road trips — each part due by km or by date, with the Arabic name to tell the workshop.'),
      h('div', { class: 'row wrap', style: { marginTop: '12px' } }, h('button', { class: 'btn primary', onClick: () => newCar('camry-2016') }, '🚗 Toyota Camry 2016'), h('button', { class: 'btn', onClick: () => newCar('generic') }, 'Another car'), h('button', { class: 'btn', onClick: () => insSheet(null) }, '📄 Start from my insurance policy'))),
    driverCard(now)];
  const c = cars.find(x => x.id === carId) || cars[0];
  const alerts = L.carAlerts(s, now).filter(a => a.car.id === c.id || a.driver).length;
  return [h('div', { class: 'row cr-head' }, h('h1', { class: 'grow' }, 'Car'), cars.length > 1 ? h('div', { class: 'chips' }, cars.map(x => h('button', { class: `chip ${x.id === c.id ? 'sel' : ''}`, onClick: () => { carId = x.id; ctx.render(); } }, `${x.icon} ${x.name}`))) : null),
    h('div', { class: 'seg cr-seg', role: 'tablist' }, PARTS.map(([id, l]) => h('button', { class: seg === id ? 'active' : '', role: 'tab', 'aria-selected': String(seg === id), onClick: () => { seg = id; ctx.render(); window.scrollTo(0, 0); } }, l, id === 'papers' && alerts ? h('span', { class: 'cr-dot' }) : null))),
    ...(seg === 'service' ? serviceView(c, now) : seg === 'papers' ? papersView(c, now) : seg === 'trip' ? tripView(c, now) : seg === 'anatomy' ? anatomyView() : overview(c, now, cars))];
}
function newCar(model) { const base = CC.fromModel(model); carSheet(null, base); }
function hero(c, now) {
  if (!c.model) return legacyCar(c, now);
  const odo = CC.odoNow(c, now), kpd = CC.kmPerDay(c), items = CC.plan(c, now);
  const odoIn = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: 'km on the dash', 'aria-label': `Odometer for ${c.name}` });
  const saveKm = () => { const v = +odoIn.value; if (!(v > 0)) return toast('Type the km on the dash'); const nc = CC.addReading(c, v, keyOf(new Date())); if (!nc) return toast(`That is less than the last reading (${kmT(odo.last || c.odo)})`, 'err'); putCar(nc); ctx.render(); toast('Reading saved', 'ok'); };
  odoIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKm(); });
  const m = CC.MODELS[c.model];
  return h('div', { class: 'card hero lf-carhero' },
    h('div', { class: 'row lf-top' }, healthRing(items), h('div', { class: 'grow' }, h('div', { class: 'lf-carname' }, c.name), h('div', { class: 'tiny dim' }, [c.year || '', colourName(c.colour), m?.name && !c.year ? m.name : ''].filter(Boolean).join(' · ') || m?.name || ''), c.plate ? plateBadge(c) : null), h('button', { class: 'btn sm ghost', 'aria-label': `Edit ${c.name}`, onClick: () => carSheet(c) }, '⋯')),
    h('div', { class: 'lf-odo' }, h('div', {}, h('div', { class: 'lf-odo-n' }, odo.km ? `${odo.guessed ? '≈ ' : ''}${Math.round(odo.km).toLocaleString('en')}` : '—', h('small', {}, ' km')), h('div', { class: 'tiny dim' }, odo.km ? `${odo.guessed ? `last read ${dmy(odo.at)} · ` : ''}${kpd ? `${kpd} km a day` : 'two readings a week apart give your km a day'}` : 'Type today’s reading: every km-based date comes from it')),
      h('div', { class: 'row lf-odo-in' }, odoIn, h('button', { class: 'btn sm primary', onClick: saveKm }, 'Save'))),
    h('div', { class: 'row wrap lf-acts' }, h('button', { class: 'btn primary', onClick: () => visitSheet(c) }, '🔧 Log a service'), h('button', { class: 'btn', onClick: () => fuelSheet(c) }, '⛽ Fuel'), h('button', { class: 'btn lf-sos', onClick: () => accidentSheet(c) }, '🚨 Accident')));
}
function overview(c, now, cars) {
  if (!c.model) return [hero(c, now), papersCard(c, now)];
  const items = CC.plan(c, now), urgent = items.filter(x => x.state === 'late' || x.state === 'soon'), known = items.filter(x => x.state === 'ok'), unknown = items.filter(x => x.state === 'unknown');
  const planned = new Set(c.plan?.items || []);
  return [hero(c, now),
    c.plan ? planCard(c, now) : null,
    glance(c, now),
    urgent.length ? h('div', { class: 'card lf-due' }, h('div', { class: 'title' }, 'Due now'), urgent.filter(x => !planned.has(x.id)).slice(0, 8).map(st => careRow(c, st)), urgent.some(x => planned.has(x.id)) ? h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `${urgent.filter(x => planned.has(x.id)).length} more are in your planned service.`) : null) : h('div', { class: 'card lf-due ok' }, h('div', { class: 'small' }, unknown.length === items.length ? 'Say when things were last done (Service tab) to start the countdowns.' : '✨ Nothing due. Next: ' + (known[0] ? `${known[0].def.label} ${CC.dueText(known[0], dmy)}` : '—'))),
    known.length ? h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Coming up'), h('button', { class: 'btn sm ghost', onClick: () => { seg = 'service'; ctx.render(); } }, 'All parts →')), known.slice(0, 5).map(st => careRow(c, st))) : null,
    !c.plan ? h('button', { class: 'card cr-cta', onClick: () => planSheet(c) }, h('span', { class: 'lf-ic' }, '🗓️'), h('span', { class: 'grow' }, h('b', {}, 'Plan a service'), h('span', { class: 'tiny dim' }, ' · pick the parts, a date, and show the workshop the list in Arabic')), h('span', {}, '→')) : null,
    c.trip ? tripTeaser(c, now) : h('button', { class: 'card cr-cta', onClick: () => { seg = 'trip'; ctx.render(); } }, h('span', { class: 'lf-ic' }, '🛣️'), h('span', { class: 'grow' }, h('b', {}, 'Planning a road trip?'), h('span', { class: 'tiny dim' }, ' · fuel cost, what falls due on the way, a pre-trip checklist')), h('span', {}, '→')),
    fuelCard(c, CC.costs(c, now)),
    c.model === 'camry-2016' ? h('div', { class: 'card lf-known' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'What Camry owners run into'), h('button', { class: 'btn sm ghost', onClick: () => { seg = 'anatomy'; ctx.render(); } }, '🔍 Anatomy')), h('div', { class: 'lf-kgrid' }, CC.KNOWN.map(k => h('div', { class: 'lf-k' }, h('span', { class: 'lf-ki' }, k.icon), h('div', {}, h('b', {}, k.title), h('div', { class: 'tiny dim' }, k.body)))))) : null,
    h('div', { class: 'row wrap', style: { margin: '4px 0 14px' } }, h('button', { class: 'btn sm', onClick: () => newCar('generic') }, '+ Another car'))];
}
/** Papers at a glance: four tiles with days left. */
function glance(c, now) {
  const d = L.driverOf(S());
  const tile = (icon, label, key, warn, go) => { const n = L.daysUntil(key, now); return h('button', { class: `cr-tile ${n === null ? 'none' : n < 0 ? 'late' : n <= warn ? 'soon' : ''}`, onClick: go }, h('span', { class: 'cr-ti' }, icon), h('b', {}, n === null ? '—' : n < 0 ? 'expired' : n > 365 ? `${(n / 365).toFixed(1)} y` : `${n} d`), h('span', { class: 'tiny' }, label)); };
  const toPapers = () => { seg = 'papers'; ctx.render(); };
  return h('div', { class: 'cr-tiles' }, tile('📄', 'Istimara', c.istimara, 30, toPapers), tile('🔧', 'Fahas', c.fahas, 30, toPapers), tile('🛡️', 'Insurance', c.insurance, 21, toPapers), tile('🪪', 'Licence', d.licence, L.LICENCE_WARN, toPapers));
}
function serviceView(c, now) {
  if (!c.model) return [legacyCar(c, now)];
  const items = CC.plan(c, now), by = Object.fromEntries(items.map(x => [x.id, x]));
  const cost = CC.costs(c, now);
  return [h('div', { class: 'card cr-svc-top' }, h('div', { class: 'row wrap', style: { gap: '8px' } }, h('button', { class: 'btn primary', onClick: () => visitSheet(c) }, '🔧 Log a service'), h('button', { class: 'btn', onClick: () => planSheet(c) }, c.plan ? '🗓️ Edit the plan' : '🗓️ Plan a service'), h('button', { class: 'btn', onClick: () => workshopSheet(c) }, '🧾 Workshop list'),
      h('button', { class: `chip lf-sev ${c.severe !== false ? 'sel' : ''}`, 'aria-pressed': String(c.severe !== false), onClick: () => { putCar({ ...c, severe: c.severe === false }); ctx.render(); } }, c.severe !== false ? '🔥 Hot & dusty plan' : 'Normal plan')),
      h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Each part shows its Arabic workshop name. Tap one to see what Toyota, Saudi workshops and owners say, set when it was last done, or change its interval.')),
    c.tyre ? tyreCard(c, now) : null,
    ...CC.GROUPS.map(([name, icon, ids]) => { const rows = ids.filter(id => by[id]).map(id => by[id]); if (!rows.length) return null;
      const late = rows.filter(x => x.state === 'late').length;
      return h('div', { class: 'card cr-group' }, h('div', { class: 'row' }, h('span', { class: 'cr-gi' }, icon), h('div', { class: 'title grow' }, name), late ? h('span', { class: 'chip lf-tag late' }, `${late} overdue`) : null), rows.map(st => careRow(c, st))); }),
    historyCard(c),
    h('details', { class: 'card adv' }, h('summary', {}, h('b', {}, 'Where these numbers come from')), h('ul', { class: 'lf-src' }, CC.SOURCES.map(([t, u]) => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, t))))),
    h('div', { class: 'tiny dim', style: { margin: '4px 2px 14px' } }, 'Intervals mix Toyota’s published schedule with what Saudi service sources and owner forums advise; the “hot & dusty” plan is Toyota’s severe-use one (heat, dust, city traffic). Your workshop’s advice wins — change any interval by tapping it.'),
    cost.care ? null : null];
}
function papersView(c, now) {
  return [papersCard(c, now), insCard(c, now), driverCard(now), idCard(c, CC.MODELS[c.model]),
    h('button', { class: 'card cr-cta sos', onClick: () => accidentSheet(c) }, h('span', { class: 'lf-ic' }, '🚨'), h('span', { class: 'grow' }, h('b', {}, 'After an accident'), h('span', { class: 'tiny dim' }, ' · Najm, the steps, and what to read out')), h('span', {}, '→')),
    h('div', { class: 'tiny dim', style: { margin: '4px 2px 14px' } }, 'Istimara and the licence renew in Absher; fahas needs a booking before it lapses; insurance with your insurer (renewing early often keeps a loyalty discount).')];
}
// ───────────────────────── tyres
function tyreCard(c, now) {
  const t = c.tyre, age = t.dot ? now.getFullYear() - +t.dot : null, months = t.fitted ? Math.round(-L.daysUntil(t.fitted, now) / 30.4) : null;
  const warrantyEnd = t.fitted && t.warranty ? `${+t.fitted.slice(0, 4) + t.warranty}${t.fitted.slice(4)}` : '';
  return h('div', { class: 'card cr-tyre' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, '🛞'), h('div', { class: 'grow' }, h('div', { class: 'title' }, t.brand || 'Tyres'), h('div', { class: 'tiny dim' }, [t.size, t.qty ? `× ${t.qty}` : ''].filter(Boolean).join(' '))), h('button', { class: 'btn sm ghost', onClick: () => tyreSheet(c) }, 'Edit')),
    h('div', { class: 'lf-stats' }, t.fitted ? st(dmy(t.fitted), `fitted${months != null ? ` · ${months} months ago` : ''}`) : null, t.dot ? st(t.dot, `made (DOT)${age ? ` · ${age} y old` : ''}`) : null, warrantyEnd ? st(dmy(warrantyEnd), `warranty (${t.warranty} y)`) : null, t.cost ? st(`${t.cost.toLocaleString('en')}`, 'SAR for the set') : null),
    h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Rotate every 8,000 km and balance with it; align after any suspension work. Keep the receipt for the warranty.'));
}
function tyreSheet(c) {
  const t = c.tyre || {}, f = { brand: h('input', { value: t.brand || '', maxlength: 40, placeholder: 'Goodyear EfficientGrip 2' }), size: h('input', { value: t.size || '', maxlength: 24, placeholder: '215/60R16 99V' }), dot: h('input', { value: t.dot || '', maxlength: 4, inputmode: 'numeric', placeholder: '2025' }),
    warranty: h('input', { type: 'number', min: 0, max: 10, value: t.warranty || '' }), fitted: h('input', { type: 'date', value: t.fitted || '' }), qty: h('input', { type: 'number', min: 1, max: 6, value: t.qty || 4 }), cost: h('input', { type: 'number', min: 0, step: 'any', value: t.cost || '' }), where: h('input', { value: t.where || '', maxlength: 60 }) };
  const box = ctx.sheet([h('h2', {}, '🛞 Tyres'), field('Brand and model', f.brand), h('div', { class: 'grid2' }, field('Size', f.size), field('DOT year', f.dot)), h('div', { class: 'grid3' }, field('Fitted', f.fitted), field('How many', f.qty), field('Warranty (years)', f.warranty)), h('div', { class: 'grid2' }, field('Paid (SAR)', f.cost), field('Where', f.where)),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const before = S(); let car = { ...c, tyre: Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value])) }; if (f.fitted.value && f.fitted.value !== t.fitted) car = CC.setLast(CC.setLast(car, 'tyres', { date: f.fitted.value }), 'balancing', { date: f.fitted.value }); putCar(car); box.close(); ctx.render(); toast('Tyres saved', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Save'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}
// ───────────────────────── a planned service + the list for the workshop
function planCard(c, now) {
  const p = c.plan, days = L.daysUntil(p.date, now), added = new Set(p.added || []);
  return h('div', { class: 'card cr-plan' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, '🗓️'), h('div', { class: 'grow' }, h('div', { class: 'title' }, 'Planned service'), h('div', { class: 'tiny dim' }, [p.date ? `${dmy(p.date)}${days != null ? (days < 0 ? ` · ${-days} d ago` : days === 0 ? ' · today' : ` · in ${days} d`) : ''}` : 'no date yet', `${p.items.length} items`].join(' · '))), h('button', { class: 'btn sm ghost', onClick: () => planSheet(c) }, 'Edit')),
    p.note ? h('div', { class: 'small', style: { margin: '8px 0' } }, p.note) : null,
    h('div', { class: 'cr-plist' }, (p.items.length > 7 && !planOpen ? p.items.slice(0, 6) : p.items).map(id => { const d = CC.ITEMS[id]; const st0 = CC.itemState(c, id, now); return h('button', { class: `cr-pi st-${st0.state}`, onClick: () => itemSheet(c, id) }, h('span', {}, d.icon), h('span', { class: 'grow' }, h('b', {}, d.label), h('span', { class: 'cr-ar', dir: 'rtl', lang: 'ar' }, d.ar)), added.has(id) ? h('span', { class: 'chip cr-sug', title: 'Suggested for this mileage' }, 'suggested') : null); })),
    p.items.length > 7 ? h('button', { class: 'btn sm ghost cr-more', onClick: () => { planOpen = !planOpen; ctx.render(); } }, planOpen ? 'Show less' : `+ ${p.items.length - 6} more`) : null,
    h('div', { class: 'row wrap', style: { marginTop: '10px', gap: '8px' } }, h('button', { class: 'btn primary', onClick: () => workshopSheet(c) }, '🧾 Show the workshop'), h('button', { class: 'btn', onClick: () => visitSheet(c, p.items) }, '✓ Done — log it'), h('button', { class: 'btn ghost', onClick: () => shareList(c) }, '📤 Share list')));
}
function planSheet(c) {
  const p = c.plan || { date: '', items: [], added: [], note: '' }, pick = new Set(p.items), now = new Date();
  const d = h('input', { type: 'date', value: p.date, min: keyOf(now) }), note = h('input', { value: p.note || '', maxlength: 140, placeholder: 'e.g. before the road trip' });
  const items = CC.plan(c, now), wrap = h('div');
  const paint = () => wrap.replaceChildren(...CC.GROUPS.map(([name, icon, ids]) => { const its = ids.filter(id => items.some(x => x.id === id) && !CC.ITEMS[id].days); if (!its.length) return null;
    return h('div', { class: 'cr-pgroup' }, h('div', { class: 'tiny dim' }, `${icon} ${name}`), h('div', { class: 'chips' }, its.map(id => { const st0 = items.find(x => x.id === id); return h('button', { class: `chip ${pick.has(id) ? 'sel' : ''} ${st0.state === 'late' ? 'cr-late' : ''}`, 'aria-pressed': String(pick.has(id)), onClick: () => { pick.has(id) ? pick.delete(id) : pick.add(id); paint(); } }, `${CC.ITEMS[id].label}${st0.state === 'late' ? ' ⚠' : ''}`); }))); }));
  paint();
  const box = ctx.sheet([h('h2', {}, '🗓️ Plan a service'), h('div', { class: 'grid2' }, field('When', d), field('Note', note)),
    h('div', { class: 'row wrap', style: { gap: '6px', margin: '4px 0 8px' } }, h('button', { class: 'btn sm', onClick: () => { for (const x of items) if ((x.state === 'late' || x.state === 'soon') && !x.def.days) pick.add(x.id); paint(); } }, '+ Everything due'), h('button', { class: 'btn sm ghost', onClick: () => { pick.clear(); paint(); } }, 'Clear')),
    wrap,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const before = S(); putCar({ ...c, plan: pick.size ? { date: d.value, items: CC.ITEM_ORDER.filter(i => pick.has(i)), added: (p.added || []).filter(i => pick.has(i)), note: note.value } : null }); box.close(); ctx.render(); toast(pick.size ? `${pick.size} items planned` : 'Plan cleared', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Save the plan'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}
/** The list to show at the counter: big Arabic first, English and the part to ask for under it, the car's details on top. */
function workshopSheet(c) {
  const ids = c.plan?.items?.length ? c.plan.items : CC.plan(c, new Date()).filter(x => (x.state === 'late' || x.state === 'soon') && !x.def.days).map(x => x.id);
  const m = CC.MODELS[c.model], odo = CC.odoNow(c, new Date()), done = new Set();
  const list = h('ol', { class: 'cr-wlist' });
  const paint = () => list.replaceChildren(...ids.map(id => { const d = CC.ITEMS[id]; return h('li', { class: done.has(id) ? 'done' : '', onClick: () => { done.has(id) ? done.delete(id) : done.add(id); paint(); } }, h('div', { class: 'cr-war', dir: 'rtl', lang: 'ar' }, d.ar), h('div', { class: 'small' }, `${d.icon} ${d.label}`), CC.PARTS[id] && CC.PARTS[id] !== '—' ? h('div', { class: 'tiny dim' }, CC.PARTS[id]) : null); }));
  paint();
  const carAr = [c.model === 'camry-2016' ? 'تويوتا كامري ٢٠١٦ — مكينة ٢٫٥ (2AR-FE)' : c.name, odo.km ? `الممشى: ${Math.round(odo.km).toLocaleString('ar-SA')} كم` : ''].filter(Boolean);
  const box = ctx.sheet([h('h2', {}, '🧾 For the workshop'),
    h('div', { class: 'cr-wcar' }, carAr.map(t => h('div', { dir: 'rtl', lang: 'ar' }, t)), c.vin ? h('div', { class: 'lf-vin small' }, `VIN ${c.vin}`) : null, m?.facts?.length ? h('div', { class: 'tiny dim' }, m.facts.slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')) : null),
    ids.length ? list : h('div', { class: 'small' }, 'Nothing planned or due. Plan a service first.'),
    h('div', { class: 'tiny dim' }, 'Tap a line to tick it off at the counter. Part makes are common good-quality choices; the shop matches the exact part to the VIN.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn', onClick: () => shareList(c, ids) }, '📤 Share'), h('button', { class: 'btn ghost grow', onClick: () => box.close() }, 'Close'))]);
  box.box.classList.add('ch-sheet', 'cr-wsheet');
}
function shareList(c, ids = c.plan?.items || []) {
  const odo = CC.odoNow(c, new Date());
  const text = [`${c.name}${c.year ? ` ${c.year}` : ''}${c.vin ? ` — VIN ${c.vin}` : ''}${odo.km ? ` — ${Math.round(odo.km).toLocaleString('en')} km` : ''}`, '', ...ids.map((id, i) => `${i + 1}. ${CC.ITEMS[id].ar} — ${CC.ITEMS[id].label}`)].join('\n');
  if (navigator.share) navigator.share({ title: `${c.name}: service list`, text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('List copied', 'ok'), () => toast(text));
}
// ───────────────────────── road trip
function tripTeaser(c, now) {
  const t = c.trip, days = L.daysUntil(t.date, now), due = L.dueByTrip(c, t, now), fu = t.km ? L.tripFuel(c, t.km, t.price) : null;
  return h('button', { class: 'card cr-tripteaser', onClick: () => { seg = 'trip'; ctx.render(); } }, h('span', { class: 'lf-ic' }, '🛣️'), h('span', { class: 'grow' }, h('b', {}, t.name || 'Road trip'), h('span', { class: 'tiny dim' }, ` · ${[t.date ? (days < 0 ? 'done' : days === 0 ? 'today' : `in ${days} days`) : '', t.km ? `${t.km.toLocaleString('en')} km` : '', fu?.sar ? `≈ ${fu.sar} SAR fuel` : '', due.length ? `${due.length} to do first` : ''].filter(Boolean).join(' · ')}`)), h('span', {}, '→'));
}
function tripView(c, now) {
  const t = c.trip || { name: '', date: '', km: 0, price: 0, checks: [] };
  const name = h('input', { value: t.name, maxlength: 60, placeholder: 'e.g. East, West & Qassim' }), date = h('input', { type: 'date', value: t.date }), km = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: t.km || '', placeholder: 'total km' });
  const fuelNow = L.tripFuel(c, 100, 0), price = h('input', { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', value: t.price || '', placeholder: fuelNow.price ? `${fuelNow.price}` : 'SAR / L' });
  const save = (patch) => { putCar({ ...c, trip: { ...t, ...patch } }); ctx.render(); };
  const plan = h('div', { class: 'card cr-trip' }, h('div', { class: 'title' }, '🛣️ Your trip'), field('Where to', name), h('div', { class: 'grid3' }, field('Leaving', date), field('Distance (km)', km), field('Fuel price (SAR/L)', price)),
    h('div', { class: 'row wrap', style: { gap: '8px' } }, h('button', { class: 'btn primary', onClick: () => save({ name: name.value, date: date.value, km: km.value, price: price.value }) }, 'Save'), c.trip ? h('button', { class: 'btn ghost', onClick: () => { const before = S(); putCar({ ...c, trip: null }); ctx.render(); toast('Trip cleared', '', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Clear') : null),
    h('div', { class: 'tiny dim' }, 'Distances: Riyadh–Dammam ≈ 400 km, Riyadh–Buraidah ≈ 350, Buraidah–Madinah ≈ 500, Madinah–Jeddah ≈ 420, Jeddah–Makkah ≈ 80, Makkah–Riyadh ≈ 870.'));
  if (!c.trip) return [plan];
  const fu = t.km ? L.tripFuel(c, t.km, t.price) : null, due = L.dueByTrip(c, t, now), checks = new Set(t.checks || []);
  const toggle = (id) => { const n = new Set(checks); n.has(id) ? n.delete(id) : n.add(id); save({ checks: [...n] }); };
  const paperIssues = [['Istimara', c.istimara], ['Fahas', c.fahas], ['Insurance', c.insurance], ['Licence', L.driverOf(S()).licence]].filter(([, k]) => k && t.date && k < keyOf(new Date(fromKey(t.date).getTime() + 14 * 864e5)));
  return [
    fu ? h('div', { class: 'card hero cr-triphero' }, h('div', { class: 'tiny dim' }, t.name || 'Road trip'), h('div', { class: 'lf-stats' }, st(`${t.km.toLocaleString('en')}`, 'km'), st(`${fu.litres}`, `litres (${fu.l100} L/100 km${fu.measured ? '' : ', typical'})`), st(fu.sar ? `${fu.sar}` : '—', fu.sar ? `SAR fuel at ${fu.price}/L` : 'add the fuel price'), st(`${fu.tanks}`, 'tanks (60 L)')),
      t.date ? h('div', { class: 'small', style: { marginTop: '10px' } }, `Leaving ${dmy(t.date)} · ${L.daysUntil(t.date, now) >= 0 ? `${L.daysUntil(t.date, now)} days to go` : 'under way or done'}`) : null) : null,
    due.length ? h('div', { class: 'card lf-due' }, h('div', { class: 'title' }, `Do before you go (${due.length})`), h('div', { class: 'tiny dim' }, 'Overdue, or due before the trip ends by date or by its km.'), due.map(st0 => careRow(c, st0)),
      h('button', { class: 'btn', style: { marginTop: '8px' }, onClick: () => { const before = S(); const items = [...new Set([...(c.plan?.items || []), ...due.map(x => x.id)])]; putCar({ ...c, plan: { date: c.plan?.date || '', items: CC.ITEM_ORDER.filter(i => items.includes(i)), added: c.plan?.added || [], note: c.plan?.note || `Before ${t.name || 'the trip'}` } }); ctx.render(); toast('Added to the planned service', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, '🗓️ Add them to the planned service')) : h('div', { class: 'card lf-due ok' }, h('div', { class: 'small' }, '✨ Nothing falls due on this trip.')),
    paperIssues.length ? h('div', { class: 'card lf-note warn' }, `⚠ ${paperIssues.map(([n]) => n).join(', ')} run${paperIssues.length === 1 ? 's' : ''} out during or right after the trip — renew first.`) : null,
    h('div', { class: 'card cr-checks' }, h('div', { class: 'row' }, h('div', { class: 'title grow' }, 'Before you leave'), h('span', { class: 'tiny dim' }, `${L.TRIP_CHECKS.filter(([id]) => checks.has(id)).length}/${L.TRIP_CHECKS.length}`)),
      L.TRIP_CHECKS.map(([id, en, ar]) => h('button', { class: `cr-check ${checks.has(id) ? 'on' : ''}`, 'aria-pressed': String(checks.has(id)), onClick: () => toggle(id) }, h('span', { class: 'cr-box' }, checks.has(id) ? '✓' : ''), h('span', { class: 'grow' }, en, h('span', { class: 'cr-ar tiny', dir: 'rtl', lang: 'ar' }, ar))))),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'On the road'), h('ul', { class: 'cr-tips' }, ['Fill up at half a tank between cities — stations thin out on some stretches.', 'Check tyre pressure cold each morning; a hot tyre reads higher.', 'If the temperature needle climbs: AC off, heater on full, pull over and let it cool before opening the radiator.', 'Sandstorm: slow down, lights on, never stop in the lane — pull fully off the road.', 'Rest every 2 hours; long straight highways make you sleepy.'].map(x => h('li', { class: 'small' }, x)))),
    plan];
}
function careRow(c, st) {
  const w = Math.round(Math.min(1, st.used) * 100);
  return h('button', { class: `lf-item st-${st.state}`, onClick: () => itemSheet(c, st.id) },
    h('span', { class: 'lf-ii' }, st.def.icon), h('span', { class: 'grow lf-im' }, h('span', { class: 'lf-in' }, st.def.label, st.def.ar ? h('span', { class: 'cr-ar', dir: 'rtl', lang: 'ar' }, st.def.ar) : null), h('span', { class: 'tiny lf-id' }, CC.dueText(st, dmy)), st.state !== 'unknown' ? h('span', { class: 'lf-bar' }, h('i', { style: { width: `${w}%` } })) : null),
    c.plan?.items?.includes(st.id) ? h('span', { class: 'chip lf-tag plan' }, `🗓️ ${c.plan.date ? dmy(c.plan.date).slice(0, 5) : 'planned'}`) : st.state === 'late' ? h('span', { class: 'chip lf-tag late' }, 'Overdue') : st.state === 'soon' ? h('span', { class: 'chip lf-tag soon' }, 'Soon') : null);
}
function itemSheet(c, id) {
  const now = new Date(), st = CC.itemState(c, id, now), iv = st.iv, def = st.def, odo = CC.odoNow(c, now);
  const d = h('input', { type: 'date', value: st.last || keyOf(now), max: keyOf(now) }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: st.lastKm || (st.last ? '' : Math.round(odo.km) || ''), placeholder: 'km' });
  const ik = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.km || '', placeholder: 'km' }), im = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.months || '', placeholder: 'months' }), idy = h('input', { type: 'number', min: 1, inputmode: 'numeric', value: iv.days || '', placeholder: 'days' });
  const done = () => { const before = S(); putCar(L.afterVisit(CC.logVisit(c, { date: keyOf(now), km: Math.round(odo.km) || 0, items: [id] }), [id])); box.close(); ctx.render(); ctx.cheer?.(); toast(`${def.label} done`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); };
  const inPlan = !!c.plan?.items?.includes(id);
  const togglePlan = () => { const items = inPlan ? c.plan.items.filter(x => x !== id) : [...(c.plan?.items || []), id]; putCar({ ...c, plan: items.length ? { date: c.plan?.date || '', note: c.plan?.note || '', added: (c.plan?.added || []).filter(x => items.includes(x)), items: CC.ITEM_ORDER.filter(x => items.includes(x)) } : null }); box.close(); ctx.render(); toast(inPlan ? 'Taken off the plan' : 'Added to the planned service', 'ok'); };
  const box = ctx.sheet([h('h2', {}, `${def.icon} ${def.label}`), def.ar ? h('div', { class: 'cr-war sm', dir: 'rtl', lang: 'ar' }, def.ar) : null, h('div', { class: 'small' }, def.what),
    CC.PARTS[id] && CC.PARTS[id] !== '—' ? h('div', { class: 'lf-note' }, h('b', {}, 'Ask for: '), CC.PARTS[id]) : null, h('div', { class: 'tiny dim', style: { margin: '4px 0 10px' } }, def.why),
    CC.VOICES[id] ? h('div', { class: 'lf-voices' }, CC.VOICES[id].map(([who, say]) => h('div', { class: 'lf-voice' }, h('b', {}, who), h('span', { class: 'small' }, say)))) : null,
    h('div', { class: `lf-duebox st-${st.state}` }, h('b', {}, st.state === 'unknown' ? 'Not set up yet' : CC.dueText(st, dmy)), st.last ? h('span', { class: 'tiny dim' }, ` · last ${dmy(st.last)}${st.lastKm ? ` at ${kmT(st.lastKm)}` : ''}`) : null),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: done }, 'Done today ✓'), def.days ? null : h('button', { class: 'btn', onClick: togglePlan }, inPlan ? '🗓️ Off the plan' : '🗓️ Add to plan')),
    h('div', { class: 'title', style: { marginTop: '14px' } }, 'Last done'), h('div', { class: 'grid2' }, field('Date', d), def.days ? null : field('At (km)', k)),
    h('button', { class: 'btn', onClick: () => { if (!d.value) return; putCar(CC.setLast(c, id, { date: d.value, km: k.value })); box.close(); ctx.render(); toast('Saved', 'ok'); } }, 'Save last done'),
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Interval'), def.days ? h('div', { class: 'grid2' }, field('Every (days)', idy)) : h('div', { class: 'grid2' }, field('Every (km)', ik), field('or every (months)', im)),
      h('div', { class: 'tiny dim' }, `Plan: ${def.days ? `every ${def.days} days` : [def.km || def.nKm ? `${kmT(c.severe !== false ? def.km : def.nKm)}` : '', (c.severe !== false ? def.months : def.nMonths) ? `${c.severe !== false ? def.months : def.nMonths} months` : ''].filter(Boolean).join(' / ')}. Empty = the plan.`),
      h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onClick: () => { putCar(CC.setInterval(c, id, def.days ? { days: idy.value } : { km: ik.value, months: im.value })); box.close(); ctx.render(); toast('Interval saved', 'ok'); } }, 'Save interval'),
        h('button', { class: 'btn sm ghost', onClick: () => { putCar(CC.setInterval(c, id, { off: true })); box.close(); ctx.render(); toast(`${def.label} hidden — bring it back in the car’s ⋯ sheet`); } }, 'Not for my car'))) ]);
}
function visitSheet(c, pre = null) {
  const now = new Date(), odo = CC.odoNow(c, now), items = CC.plan(c, now);
  const pick = new Set(pre || items.filter(x => x.state === 'late' || x.state === 'soon').filter(x => !x.def.days).map(x => x.id));
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
      putCar(L.afterVisit(CC.logVisit(c, { date: d.value, km: k.value, items: [...pick], cost: cost.value, place: place.value, note: note.value }), [...pick])); box.close(); ctx.render(); ctx.cheer?.();
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
// ───────────────────────── the car on paper: plate, VIN, policy, accident, driver
const AR_DIG = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const AR2LAT = { 'ا': 'A', 'أ': 'A', 'ب': 'B', 'ح': 'J', 'د': 'D', 'ر': 'R', 'س': 'S', 'ص': 'X', 'ط': 'T', 'ع': 'E', 'ق': 'G', 'ك': 'K', 'ل': 'L', 'م': 'Z', 'ن': 'N', 'ه': 'H', 'و': 'U', 'ى': 'V', 'ي': 'V' };
const COLOURS = { 'ازرق فاتح': ['Light blue', '#8ec5f2'], 'ازرق': ['Blue', '#2f6fd6'], 'ابيض': ['White', '#f4f4f4'], 'أبيض': ['White', '#f4f4f4'], 'اسود': ['Black', '#1b1b1b'], 'أسود': ['Black', '#1b1b1b'], 'فضي': ['Silver', '#c7cbd1'], 'رمادي': ['Grey', '#8a8f98'], 'احمر': ['Red', '#d33a3a'], 'أحمر': ['Red', '#d33a3a'], 'بيج': ['Beige', '#d9c7a3'], 'ذهبي': ['Gold', '#cfa94a'], 'بني': ['Brown', '#7a5236'], 'اخضر': ['Green', '#3a9a5b'] };
const colourOf = (c) => COLOURS[(c || '').trim()] || Object.values(COLOURS).find(([en]) => en.toLowerCase() === (c || '').trim().toLowerCase()) || null;
const colourName = (c) => colourOf(c)?.[0] || c || '';
/** "ر س ط 4821" → Arabic letters, digits; Latin letters read the other way (T S R), as on the plate itself. */
export function plateParts(c) {
  const m = /^(.*?)\s*(\d{1,4})\s*$/.exec((c.plate || '').trim()) || /^(\d{1,4})\s*(.*)$/.exec((c.plate || '').trim());
  if (!m) return null;
  const [digits, letters] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  const ar = [...letters.replace(/\s/g, '')];
  const lat = c.plateLatin ? c.plateLatin.replace(/\s/g, '').split('') : ar.map(x => AR2LAT[x] || '?').reverse();
  return { digits, ar, lat };
}
function plateBadge(c) {
  const p = plateParts(c); if (!p) return h('div', { class: 'tiny' }, c.plate);
  return h('div', { class: 'ksa-plate', role: 'img', 'aria-label': `Plate ${p.digits} ${p.lat.join(' ')}` },
    h('div', { class: 'kp-grid' }, h('span', { class: 'kp-ar', dir: 'ltr' }, AR_DIG(p.digits)), h('span', { class: 'kp-ar', dir: 'rtl' }, p.ar.join(' ')), h('span', {}, p.digits), h('span', {}, p.lat.join(' '))),
    h('div', { class: 'kp-strip' }, h('span', {}, 'السعودية'), h('b', {}, 'KSA')));
}
/** One number for how the car is doing: tracked items on time; "soon" counts half. */
function healthRing(items) {
  const tracked = items.filter(x => x.state !== 'unknown'); const late = tracked.filter(x => x.state === 'late').length, soon = tracked.filter(x => x.state === 'soon').length;
  const enough = tracked.length >= Math.min(8, Math.ceil(items.length / 3));   // a score from 3 known parts out of 27 would flatter
  const pct = enough ? Math.round(100 * (tracked.length - late - soon / 2) / tracked.length) : null;
  const tone = pct === null ? 'none' : pct >= 85 ? 'good' : pct >= 60 ? 'mid' : 'bad', C = 2 * Math.PI * 26;
  const svg = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="hr-bg"/><circle cx="32" cy="32" r="26" class="hr-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (pct ?? 0) / 100)}" transform="rotate(-90 32 32)"/></svg>`;
  const el = h('div', { class: `lf-ring ${tone}`, title: pct === null ? `${tracked.length} of ${items.length} parts have a last-done date; the health score starts once a third are known` : `${tracked.length - late - soon} on time · ${soon} soon · ${late} overdue` });
  el.innerHTML = svg; el.append(h('b', { class: pct === null ? 'few' : '' }, pct === null ? `${tracked.length}/${items.length}` : `${pct}`), h('small', {}, pct === null ? 'known' : 'health'));
  return el;
}
const copyBtn = (text, label) => h('button', { class: 'btn sm ghost', 'aria-label': `Copy ${label}`, onClick: async () => { try { await navigator.clipboard.writeText(text); toast(`${label} copied`, 'ok'); } catch { toast(text); } } }, '⧉');
const tel = (n) => `tel:${String(n).replace(/\s/g, '')}`;
function insCard(c, now) {
  const i = c.ins; const days = L.daysUntil(c.insurance, now);
  if (!i) return h('div', { class: 'card lf-ins empty' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, '🛡️'), h('div', { class: 'grow' }, h('div', { class: 'title' }, 'Insurance'), h('div', { class: 'tiny dim' }, 'Read your policy PDF and Calamansi keeps the cover, the helpline, the extras and the renewal date.')), h('button', { class: 'btn sm primary', onClick: () => insSheet(c) }, '📄 Add policy')));
  const total = i.start && c.insurance ? Math.max(1, L.daysUntil(c.insurance, fromKey(i.start))) : 365, left = Math.max(0, days ?? 0), used = Math.min(1, Math.max(0, 1 - left / total));
  const third = i.kind === 'third';
  return h('div', { class: `card lf-ins ${third ? 'third' : i.kind === 'comp' ? 'comp' : ''}` },
    h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, '🛡️'), h('div', { class: 'grow' }, h('div', { class: 'title' }, i.company || 'Insurance'), h('div', { class: 'tiny dim' }, [L.INS_KIND[i.kind], i.policy].filter(Boolean).join(' · '))), i.policy ? copyBtn(i.policy, 'Policy number') : null, h('button', { class: 'btn sm ghost', onClick: () => insSheet(c) }, 'Edit')),
    c.insurance ? h('div', { class: 'lf-period' }, h('div', { class: 'row tiny' }, h('span', { class: 'grow' }, i.start ? dmy(i.start) : ''), h('b', {}, days < 0 ? `Expired ${-days} d ago` : `${days} days left`), h('span', { class: 'grow', style: { textAlign: 'right' } }, dmy(c.insurance))), h('span', { class: 'lf-bar' }, h('i', { style: { width: `${Math.round(used * 100)}%` } }))) : null,
    third ? h('div', { class: 'lf-note warn' }, h('b', {}, 'Third party only. '), 'It pays for damage you cause to others', i.limit ? ` (${i.limit.replace(/^Up to /, 'up to ').replace(' for damage to others', '')})` : '', ' — repairs to your own Camry, theft and fire are not covered. A comprehensive policy would cover those.') : i.kind === 'comp' ? h('div', { class: 'lf-note' }, 'Comprehensive: your own car is covered too, after the deductible.') : null,
    h('div', { class: 'lf-stats' }, i.premium != null ? st(`${i.premium.toLocaleString('en')}`, 'SAR a year') : null, i.deductible != null ? st(`${i.deductible.toLocaleString('en')}`, 'SAR deductible') : null, i.repair ? h('div', { class: 'lf-stat' }, h('span', { class: 'small', style: { fontWeight: 700 } }, i.repair), h('span', { class: 'tiny dim' }, third ? 'repairs to the other car' : 'repairs')) : null),
    i.perks?.length ? h('div', { class: 'chips lf-perks' }, i.perks.map(p => h('span', { class: 'chip' }, perkIcon(p), ' ', p))) : null,
    h('div', { class: 'row wrap', style: { marginTop: '10px' } }, i.phone ? h('a', { class: 'btn primary', href: tel(i.phone) }, `📞 ${i.phone}`) : null, h('button', { class: 'btn', onClick: () => accidentSheet(c) }, '🚨 If you have an accident'),
      days !== null && days <= 45 && i.perks?.some(p => /loyalty/i.test(p)) ? h('span', { class: 'tiny lf-hint' }, '💡 Renew before it ends to keep the loyalty discount') : null));
}
const st = (n, l) => h('div', { class: 'lf-stat' }, h('b', {}, n), h('span', { class: 'tiny dim' }, l));
const perkIcon = (p) => /tow/i.test(p) ? '🛻' : /battery/i.test(p) ? '🔋' : /fuel/i.test(p) ? '⛽' : /tyre/i.test(p) ? '🛞' : /taxi/i.test(p) ? '🚕' : /loyal/i.test(p) ? '💎' : /claim/i.test(p) ? '⭐' : '✓';
function idCard(c, m) {
  const v = c.vin ? PO.vinInfo(c.vin) : null, col = colourOf(c.colour);
  const rows = [
    c.vin ? ['VIN', h('span', { class: 'lf-vin' }, c.vin, ' ', copyBtn(c.vin, 'VIN'))] : null,
    v?.maker ? ['Built by', `${v.maker}${v.year ? ` · model year ${v.year}` : ''}${v.check ? ' · VIN check ✓' : ''}`] : null,
    c.colour ? ['Colour', h('span', {}, col ? h('i', { class: 'lf-swatch', style: { background: col[1] } }) : null, ` ${col ? `${col[0]} (${c.colour})` : c.colour}`)] : null,
    c.seats ? ['Seats', `${c.seats}`] : null, c.weight ? ['Weight on the istimara', `${c.weight.toLocaleString('en')} kg`] : null, c.regType ? ['Registration', c.regType] : null,
    ...(m?.facts || []).map(([k, val]) => [k, val]),
  ].filter(Boolean);
  if (!rows.length) return null;
  return h('details', { class: 'card adv lf-facts' }, h('summary', {}, h('b', {}, `${c.name}: the details`)), h('div', { class: 'lf-factgrid' }, rows.map(([k, val]) => [h('span', { class: 'tiny dim' }, k), h('span', { class: 'small' }, val)])),
    h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'The VIN is what parts shops and the agency ask for: it pins down the exact engine, gearbox and trim.'));
}
function accidentSheet(c) {
  const s = S(), dr = L.driverOf(s), i = c?.ins;
  const box = ctx.sheet([h('h2', {}, '🚨 After an accident'),
    h('div', { class: 'lf-calls' }, PO.CALLS.slice(0, 4).map(([l, n, ic]) => h('a', { class: `btn ${n === '199033' ? 'primary' : ''}`, href: n === '920000560' ? 'https://wa.me/966920000560' : tel(n), target: n === '920000560' ? '_blank' : null, rel: 'noopener' }, `${ic} ${l.replace(/ \(.*\)/, '')} · ${n}`)),
      i?.phone ? h('a', { class: 'btn', href: tel(i.phone) }, `🛡️ ${i.company || 'Insurer'} · ${i.phone}`) : null),
    h('ol', { class: 'lf-steps' }, PO.ACCIDENT_STEPS.map(([t, b]) => h('li', {}, h('b', {}, t), h('div', { class: 'small' }, b)))),
    c ? h('div', { class: 'card lf-quick' }, h('div', { class: 'tiny dim' }, 'Read these out when asked'), h('div', { class: 'lf-factgrid' },
      ...[c.plate ? ['Plate', `${c.plate}${plateParts(c) ? ` (${plateParts(c).digits} ${plateParts(c).lat.join(' ')})` : ''}`] : null, c.vin ? ['VIN', c.vin] : null, i?.company ? ['Insurer', i.company] : null, i?.policy ? ['Policy', i.policy] : null, i?.kind ? ['Cover', L.INS_KIND[i.kind]] : null, dr.blood ? ['Your blood type', dr.blood] : null, dr.ice ? ['Call in an emergency', dr.ice] : null]
        .filter(Boolean).flatMap(([k, v]) => [h('span', { class: 'tiny dim' }, k), h('b', { class: 'small' }, v)]))) : null,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn ghost grow', onClick: () => box.close() }, 'Close'))]);
  box.box.classList.add('ch-sheet');
}
function driverCard(now) {
  const s = S(), d = L.driverOf(s), days = L.daysUntil(d.licence, now), held = L.heldFor(d.issued, now);
  return h('div', { class: 'card lf-driver' }, h('div', { class: 'row' }, h('span', { class: 'lf-ic' }, '🪪'), h('div', { class: 'grow' }, h('div', { class: 'title' }, 'You, the driver'),
      h('div', { class: 'tiny dim' }, d.licence ? `${d.type || 'Driving'} licence until ${dmy(d.licence)}` : 'Add your licence expiry and Calamansi reminds you two months before.')),
    d.licence ? h('span', { class: `chip lf-tag ${days < 0 ? 'late' : days <= L.LICENCE_WARN ? 'soon' : 'okc'}` }, days < 0 ? 'Expired' : days > 365 ? `${Math.floor(days / 365)} y ${Math.floor(days % 365 / 30)} m` : `${days} d`) : null, h('button', { class: 'btn sm ghost', onClick: driverSheet }, d.licence ? 'Edit' : 'Add')),
    held || d.blood ? h('div', { class: 'lf-stats' }, held ? st(`${held.years}`, `years driving (since ${dmy(d.issued)})`) : null, d.blood ? st(d.blood, 'blood type (accident card)') : null) : null);
}
function driverSheet() {
  const d = L.driverOf(S());
  const lic = h('input', { type: 'date', value: d.licence }), iss = h('input', { type: 'date', value: d.issued }), ty = h('select', {}, ['Private', 'Public', 'Motorcycle', 'Heavy', 'Temporary'].map(x => h('option', { selected: d.type === x }, x)));
  const bl = h('select', {}, ['', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(x => h('option', { value: x, selected: d.blood === x }, x || '—'))), ice = h('input', { value: d.ice, maxlength: 40, placeholder: 'e.g. Brother 05x xxx xxxx' });
  const box = ctx.sheet([h('h2', {}, '🪪 Your licence'), h('div', { class: 'grid2' }, field('Expires', lic), field('Issued', iss)), field('Type', ty),
    h('div', { class: 'grid2' }, field('Blood type (optional)', bl), field('Emergency contact (optional)', ice)),
    h('div', { class: 'tiny dim' }, 'Blood type and the emergency contact only show on the accident card, on your devices. Renew the licence in Absher.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const before = S(); ctx.update(st => L.setDriver(st, { licence: lic.value, issued: iss.value, type: ty.value, blood: bl.value, ice: ice.value })); box.close(); ctx.render(); toast('Saved', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } }); } }, 'Save'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}
/** Insurance: typed, or read from the policy PDF / pasted text. With no car yet, the policy starts one (make, model, year, plate, VIN). */
function insSheet(c) {
  const i = c?.ins || {}, file = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'sr-only', 'aria-label': 'Policy PDF' });
  const f = { company: h('input', { value: i.company || '', maxlength: 40, list: 'lf-insurers' }), policy: h('input', { value: i.policy || '', maxlength: 48 }), kind: h('select', {}, [['', '—'], ['third', 'Third party'], ['comp', 'Comprehensive']].map(([v, l]) => h('option', { value: v, selected: (i.kind || '') === v }, l))),
    start: h('input', { type: 'date', value: i.start || '' }), end: h('input', { type: 'date', value: c?.insurance || '' }), premium: h('input', { type: 'number', min: 0, step: 'any', value: i.premium ?? '' }), deductible: h('input', { type: 'number', min: 0, step: 'any', value: i.deductible ?? '' }),
    phone: h('input', { value: i.phone || '', maxlength: 20, inputmode: 'tel' }), repair: h('input', { value: i.repair || '', maxlength: 40 }) };
  let extra = { perks: i.perks || [], limit: i.limit || '' }, carBits = {};
  const found = h('div', { class: 'lf-found', role: 'status' }), paste = h('textarea', { rows: 3, placeholder: 'Or paste the policy text here' });
  const apply = (p) => {
    if (!p.found.length) { found.textContent = 'Nothing recognisable in that — type the details below.'; found.className = 'lf-found bad'; return; }
    for (const k of ['company', 'policy', 'kind', 'start', 'phone', 'repair']) if (p[k]) f[k].value = p[k];
    if (p.end) f.end.value = p.end; if (p.premium != null) f.premium.value = p.premium; if (p.deductible != null) f.deductible.value = p.deductible;
    extra = { perks: p.perks || extra.perks, limit: p.limit || extra.limit }; carBits = { vin: p.vin, plate: p.plate, year: p.year, make: p.make, modelName: p.modelName };
    found.className = 'lf-found ok'; found.textContent = `Found: ${p.found.join(', ')}. Check them, then Save.`;
  };
  file.addEventListener('change', async () => {
    const fl = file.files?.[0]; if (!fl) return; found.className = 'lf-found'; found.textContent = 'Reading the PDF…';
    try { const { pdfText } = await import('./pdftext.js'); apply(PO.parsePolicy(await pdfText(fl))); } catch (e) { found.className = 'lf-found bad'; found.textContent = `Couldn’t read that PDF (${e.message}). Paste its text instead.`; }
    file.value = '';
  });
  paste.addEventListener('input', () => { if (paste.value.trim().length > 40) apply(PO.parsePolicy(paste.value)); });
  const box = ctx.sheet([h('h2', {}, c ? `🛡️ ${c.name}: insurance` : '📄 Start from your policy'),
    h('label', { class: 'btn primary lf-pdf' }, file, '📄 Read my policy PDF'), h('div', { class: 'tiny dim' }, 'Read on this phone only: the PDF isn’t uploaded or kept. Your name, ID and date of birth on it are ignored.'), paste, found,
    h('datalist', { id: 'lf-insurers' }, PO.INSURERS.map(([n]) => h('option', { value: n }))),
    h('div', { class: 'grid2' }, field('Insurer', f.company), field('Cover', f.kind)), field('Policy number', f.policy), h('div', { class: 'grid2' }, field('Starts', f.start), field('Ends', f.end)),
    h('div', { class: 'grid3' }, field('Paid (SAR)', f.premium), field('Deductible', f.deductible), field('Helpline', f.phone)), field('Repairs', f.repair),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      const ins = { company: f.company.value, policy: f.policy.value, kind: f.kind.value, start: f.start.value, premium: f.premium.value, deductible: f.deductible.value, phone: f.phone.value, repair: f.repair.value, ...extra };
      const before = S(); let car;
      if (c) car = { ...c, ins, insurance: f.end.value || c.insurance };
      else {
        const camry = /camry/i.test(carBits.modelName || '') && (carBits.year === 2016 || !carBits.year);
        const base = CC.fromModel(camry ? 'camry-2016' : 'generic');
        car = { ...base, name: carBits.modelName ? `${carBits.make || ''} ${carBits.modelName}`.trim() : base.name || 'My car', vin: carBits.vin, plate: carBits.plate, year: carBits.year, ins, insurance: f.end.value };
      }
      ctx.update(st => L.saveCar(st, car)); box.close(); ctx.render(); toast(c ? 'Insurance saved' : `${car.name} added from your policy`, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
    } }, 'Save'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('ch-sheet');
}
/** A setup link (…#setup=<base64url JSON>, never sent to a server) proposes a car + papers + policy + licence; Save to keep it. */
export function setupSheet(o) {
  const car = o?.car || {}, dr = o?.driver || null;
  const existing = L.carList(S()).find(x => (car.vin && x.vin === car.vin) || (!car.vin && x.name === car.name));
  const lines = [car.name && `🚗 ${car.name}${car.year ? ` ${car.year}` : ''}${car.colour ? `, ${colourName(car.colour).toLowerCase()}` : ''}`, car.plate && `🔢 Plate ${car.plate}${car.plateLatin ? ` (${car.plateLatin})` : ''}`, car.vin && `🧬 VIN ${car.vin}`,
    car.istimara && `📄 Istimara until ${dmy(car.istimara)}`, car.fahas && `🔧 Fahas until ${dmy(car.fahas)}`, car.insurance && `🛡️ ${car.ins?.company || 'Insurance'} until ${dmy(car.insurance)}${car.ins?.kind ? ` · ${L.INS_KIND[car.ins.kind]}` : ''}`,
    dr?.licence && `🪪 Licence until ${dmy(dr.licence)}`, car.tyre && `🛞 ${car.tyre.brand || 'Tyres'} ${car.tyre.size || ''}${car.tyre.fitted ? `, fitted ${dmy(car.tyre.fitted)}` : ''}`, car.plan && `🗓️ Planned service${car.plan.date ? ` ${dmy(car.plan.date)}` : ''}: ${car.plan.items.length} items`, car.trip && `🛣️ ${car.trip.name || 'Road trip'}${car.trip.date ? ` from ${dmy(car.trip.date)}` : ''}`].filter(Boolean);
  const box = ctx.sheet([h('h2', {}, existing ? `Update ${existing.name}?` : 'Add your car?'), h('ul', { class: 'lf-setup-list' }, lines.map(l => h('li', {}, l))),
    h('div', { class: 'tiny dim' }, existing ? 'Your care plan, readings and history stay as they are.' : 'Then say when the oil and the rest were last done to start the countdowns.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      const before = S();
      ctx.update(st => { let n = st; const base = existing || { ...CC.fromModel(car.model && CC.MODELS[car.model] ? car.model : 'generic') }; n = L.saveCar(n, { ...base, ...car, id: existing?.id, care: { ...(car.care || {}), ...(base.care || {}) }, odoLog: base.odoLog, log: [...(base.log || []), ...(car.log || []).filter(x => !(base.log || []).some(y => y.date === x.date && y.what === x.what))].sort((a, b) => a.date.localeCompare(b.date)), fuel: base.fuel, ins: { ...(base.ins || {}), ...(car.ins || {}) }, plan: base.plan || car.plan, trip: base.trip || car.trip, tyre: base.tyre || car.tyre }); if (dr) n = L.setDriver(n, dr); return n; });
      box.close(); seg = 'overview'; ctx.render(); toast(existing ? 'Updated' : 'Car added', 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
    } }, existing ? 'Update' : 'Add it'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Not now'))]);
  box.box.classList.add('ch-sheet');
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
  const idf = { plate: h('input', { value: src.plate || '', maxlength: 24, placeholder: 'د أ أ 1234', dir: 'auto' }), plateLatin: h('input', { value: src.plateLatin || '', maxlength: 12, placeholder: 'A A D' }), vin: h('input', { value: src.vin || '', maxlength: 17, placeholder: '17 characters', autocapitalize: 'characters' }),
    year: h('input', { type: 'number', min: 1950, max: 2100, value: src.year || '' }), colour: h('input', { value: src.colour || '', maxlength: 24, placeholder: 'Light blue' }) };
  const box = ctx.sheet([h('h2', {}, isNew ? 'Your car' : c.name), h('div', { class: 'ch-name-row' }, field('Icon', ic), field('Name', n)), field('Model', model),
    h('div', { class: 'grid3' }, ...L.CAR_PAPERS.map(([k, label]) => field(`${label.replace(/ \(.*\)$/, '')} expires`, dates[k]))), field(isNew ? 'Odometer now (km)' : 'New odometer reading (km)', odo),
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Plate, VIN, year, colour'), h('div', { class: 'grid2' }, field('Plate (Arabic)', idf.plate), field('Plate (Latin)', idf.plateLatin)), field('VIN (on the istimara)', idf.vin), h('div', { class: 'grid2' }, field('Model year', idf.year), field('Colour', idf.colour))),
    hidden.length ? h('div', { class: 'chips' }, h('span', { class: 'tiny dim' }, 'Hidden:'), hidden.map(id => h('button', { class: 'chip', onClick: () => { putCar(CC.setInterval(c, id, { off: false })); box.close(); ctx.render(); } }, `${CC.ITEMS[id].icon} ${CC.ITEMS[id].label} — show`))) : null, err,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => {
      if (!n.value.trim()) { err.textContent = 'Give it a name'; return; }
      let car = { ...src, ...(c || {}), id: c?.id, name: n.value, icon: ic.value, model: model.value, ...Object.fromEntries(Object.entries(dates).map(([k, i]) => [k, i.value])), ...Object.fromEntries(Object.entries(idf).map(([k, i]) => [k, i.value])) };
      if (idf.vin.value.trim() && !PO.vinInfo(idf.vin.value).ok) { err.textContent = 'A VIN has 17 letters and numbers (no I, O or Q)'; return; }
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
  return [h('div', { class: 'card hero an-hero' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, 'Camry 2016 anatomy'), h('div', { class: 'small' }, game ? `Find: ${game.list[game.i]?.name || '—'}` : 'Tap a number to see what it does, how to check it and the signs of trouble.')),
      h('button', { class: `btn ${game ? '' : 'primary'}`, onClick: () => { game = game ? null : { list: AN.findRound(anView), i: 0, right: 0, tries: 0, flash: null }; ctx.render(); } }, game ? 'Stop' : '🎯 Find it')),
      h('div', { class: 'seg', style: { marginTop: '10px' } }, AN.VIEWS.map(([id, l]) => h('button', { class: anView === id ? 'active' : '', onClick: () => { anView = id; game = null; ctx.render(); } }, l))),
      game ? h('div', { class: 'an-score' }, h('b', {}, `${game.right}/${game.list.length}`), h('span', { class: 'tiny dim' }, ` · part ${Math.min(game.i + 1, game.list.length)} of ${game.list.length}`)) : null),
    h('div', { class: 'card an-card' }, wrap, h('div', { class: 'tiny dim' }, anView === 'bay' ? 'Seen from above: the grille at the top, the driver’s side on the left. Positions are approximate.' : anView === 'under' ? 'Seen from below, as if lying under the car: the front at the top, so the driver’s side is on the right. Positions are approximate.' : 'Seen from the driver’s side, the front on the left. Positions are approximate.')),
    h('div', { class: 'card' }, h('div', { class: 'an-list' }, parts.map((p, i) => h('button', { class: 'an-li', onClick: () => game ? guess(p.id) : partSheet(p) }, h('span', { class: 'an-n' }, i + 1), h('span', { class: 'an-ic' }, p.icon), h('span', { class: 'grow small' }, p.name, h('span', { class: 'cr-ar', dir: 'rtl', lang: 'ar' }, p.ar)))))),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'Good to know about the XV50 2.5 L'), h('ul', { class: 'an-notes' }, AN.NOTES.map(n => h('li', { class: 'small' }, n))))];
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
  const box = ctx.sheet([h('h2', {}, `${p.icon} ${p.name}`), p.ar ? h('div', { class: 'cr-war sm', dir: 'rtl', lang: 'ar' }, p.ar) : null, h('div', { class: 'an-sec' }, h('b', {}, 'What it does'), h('div', { class: 'small' }, p.does)),
    h('div', { class: 'an-sec' }, h('b', {}, 'How to check'), h('div', { class: 'small' }, p.check)), p.warn !== '—' ? h('div', { class: 'an-sec warn' }, h('b', {}, 'Signs of trouble'), h('div', { class: 'small' }, p.warn)) : null,
    care.length ? h('div', { class: 'an-sec' }, h('b', {}, `On ${car.name}`), care.map(st => h('button', { class: `lf-item st-${st.state}`, onClick: () => { box.close(); itemSheet(car, st.id); } }, h('span', { class: 'lf-ii' }, st.def.icon), h('span', { class: 'grow lf-im' }, h('span', { class: 'lf-in' }, st.def.label), h('span', { class: 'tiny lf-id' }, CC.dueText(st, dmy)))))) : null]);
}

