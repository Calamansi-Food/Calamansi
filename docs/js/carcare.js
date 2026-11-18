// Car care: a maintenance plan per car (oil and filter, tyres, filters, fluids, plugs, battery, AC…), each item due by km or by
// time, whichever comes first; service visits that tick several items at once; odometer readings that give your km per day,
// so a km-based item gets a date; and a fuel log (L/100 km, SAR per km). Pure (no DOM).
//
// The Toyota Camry 2016 (2.5 L, 2AR-FE) plan follows Toyota's published intervals for that engine family: 0W-20 synthetic,
// oil every 16,000 km / 12 months normally and every 8,000 km / 6 months under "severe" use, which includes driving in
// extreme heat, dust and stop-and-go traffic — so Riyadh driving uses the severe plan by default. Every interval can be
// changed per car; the owner's manual and the dealer's sticker win over these numbers.
import { keyOf, fromKey, addDays, startOfDay } from './util.js';
import { addMonths, daysUntil } from './life.js';

const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[, ]/g, ''); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);

/**
 * Care items. km / months = the severe (hot, dusty, stop-and-go) plan; nKm / nMonths = the normal plan; days = short checks.
 * what = what is done, why = one line of reason, shown on the item.
 */
export const ITEMS = {
  oil: { ar: 'زيت المكينة وفلتر الزيت', label: 'Oil + oil filter', icon: '🛢️', km: 8000, months: 6, nKm: 16000, nMonths: 12, what: 'Drain, new filter, fresh oil.', why: 'Heat and dust age oil faster; the engine’s main wear item.' },
  rotate: { ar: 'تدوير الكفرات', label: 'Tyre rotation', icon: '🔄', km: 8000, months: 6, nKm: 8000, nMonths: 6, what: 'Swap front and rear tyres; check tread and brakes while the wheels are off.', why: 'Even wear makes a set last much longer.' },
  brakes: { ar: 'الفحمات (تيل الفرامل)', label: 'Brake pads', icon: '🛑', km: 8000, months: 6, nKm: 16000, nMonths: 12, what: 'Check pad thickness at every oil change; replace when about 3 mm is left (front pads go first).', why: 'City driving and long downhill runs wear the fronts first; squealing is the wear indicator.' },
  airFilter: { ar: 'فلتر الهواء', label: 'Engine air filter', icon: '🌬️', km: 24000, months: 24, nKm: 48000, nMonths: 36, what: 'Replace (inspect at every oil change in dusty months).', why: 'Dust clogs it; a blocked filter costs power and fuel.' },
  cabinFilter: { ar: 'فلتر المكيف', label: 'Cabin (AC) filter', icon: '❄️', km: 16000, months: 12, nKm: 16000, nMonths: 12, what: 'Replace the filter behind the glovebox.', why: 'Keeps dust out of the cabin and the AC blowing strong.' },
  brakeFluid: { ar: 'زيت الفرامل', label: 'Brake fluid', icon: '💧', km: 0, months: 24, nKm: 0, nMonths: 36, what: 'Flush and refill.', why: 'Brake fluid takes up water over time and boils sooner when hot.' },
  coolant: { ar: 'موية الرديتر', label: 'Coolant', icon: '🌡️', km: 160000, months: 120, nKm: 160000, nMonths: 120, then: { km: 80000, months: 60 }, what: 'Drain and refill with Toyota Super Long Life Coolant (pink).', why: 'First change at 10 years / 160,000 km, then every 5 years / 80,000 km.' },
  atf: { ar: 'زيت القير', label: 'Transmission fluid (ATF WS)', icon: '⚙️', km: 48000, months: 48, nKm: 96000, nMonths: 72, what: 'Drain and fill with Toyota ATF WS — never a pressure “flush”.', why: 'Toyota calls it lifetime fluid; owners and Toyota techs drain-and-fill anyway, and the 6-speed’s torque-converter shudder often eases with fresh fluid.' },
  plugs: { ar: 'البواجي', label: 'Spark plugs (iridium)', icon: '⚡', km: 190000, months: 0, nKm: 190000, nMonths: 0, what: 'Replace all four.', why: 'Long-life iridium plugs; a misfire or rough idle means sooner.' },
  battery: { ar: 'فحص البطارية', label: 'Battery test', icon: '🔋', km: 0, months: 6, nKm: 0, nMonths: 12, what: 'Free load test at most battery shops; clean the terminals.', why: 'Saudi heat often ends a battery in 2–3 years, usually without warning.' },
  batteryNew: { ar: 'بطارية جديدة', label: 'New battery', icon: '🪫', km: 0, months: 36, nKm: 0, nMonths: 48, what: 'Replace before it strands you; the date code is on the case.', why: 'Saudi service sources put hot-climate battery life at 2–3 years.' },
  belt: { ar: 'السيور الخارجية', label: 'Drive belt', icon: '➰', km: 96000, months: 72, nKm: 96000, nMonths: 72, what: 'Look for cracks and glazing; listen for squeal on cold starts.', why: 'One belt runs the alternator, AC and water pump.' },
  ac: { ar: 'فحص المكيف وتعبئة الفريون', label: 'AC check before summer', icon: '🧊', km: 0, months: 12, nKm: 0, nMonths: 12, what: 'Gas pressure, compressor, condenser clean — best in March or April.', why: 'Fixing it before the heat beats a 45 °C wait at the workshop.' },
  wipers: { ar: 'المساحات', label: 'Wiper blades', icon: '🌧️', km: 0, months: 12, nKm: 0, nMonths: 12, what: 'Replace both blades.', why: 'Sun cracks the rubber; you find out on the first rain.' },
  rotors: { ar: 'الهوبات (الديسكات)', label: 'Brake discs (rotors)', icon: '💿', km: 60000, months: 48, nKm: 80000, nMonths: 60, what: 'Replace (or skim if thick enough) — usually every second set of pads, and always if they shake under braking.', why: 'Worn or warped discs shake the steering under braking and wear new pads fast.' },
  shocks: { ar: 'المساعدات', label: 'Shock absorbers', icon: '🦘', km: 80000, months: 72, nKm: 100000, nMonths: 96, what: 'Replace in pairs (both fronts or both rears), with new top mounts and dust boots; then a wheel alignment.', why: 'Tired shocks lengthen braking, float at highway speed and cup the tyres — worst on long trips.' },
  arms: { ar: 'المقصات وجلود المقصات', label: 'Control arms + bushings', icon: '🦾', km: 100000, months: 84, nKm: 120000, nMonths: 96, what: 'Lower control arms with their rubber bushings and ball joints; replace if the rubber is cracked or it clunks over bumps. Wheel alignment after.', why: 'Heat cracks the rubber; worn bushings cause clunks, pulling and uneven tyre wear.' },
  alignment: { ar: 'وزن الأذرعة (ميزان الأذرعة)', label: 'Wheel alignment', icon: '📐', km: 20000, months: 12, nKm: 20000, nMonths: 12, what: 'Set toe and camber. Always after new tyres, shocks, arms or a hard pothole.', why: 'A car that pulls or a crooked steering wheel eats new tyres in months.' },
  balancing: { ar: 'ترصيص الكفرات', label: 'Wheel balancing', icon: '⚖️', km: 10000, months: 12, nKm: 10000, nMonths: 12, what: 'Balance all four (with the rotation is easiest).', why: 'Vibration through the wheel at 100–120 km/h is usually balance.' },
  cvBoots: { ar: 'جلود العكوس', label: 'CV joint boots (check)', icon: '🧤', km: 40000, months: 24, nKm: 40000, nMonths: 24, what: 'Look for torn rubber and grease thrown around the inside of the wheel.', why: 'A torn boot lets sand in and the joint clicks on full turns — cheap boot, expensive axle.' },
  mounts: { ar: 'كراسي المكينة', label: 'Engine mounts (check)', icon: '🧱', km: 100000, months: 96, nKm: 120000, nMonths: 120, what: 'Check for cracked rubber and a thump when shifting into drive or reverse.', why: 'Heat hardens the rubber; worn mounts shake the cabin at idle with the AC on.' },
  bearings: { ar: 'رمان بلي العجلات', label: 'Wheel bearings (check)', icon: '🛞', km: 100000, months: 84, nKm: 120000, nMonths: 96, what: 'Listen for a hum that changes with speed and on bends; check for play with the wheel off the ground.', why: 'A failing bearing grows louder over weeks; better found before a long highway trip.' },
  waterPump: { ar: 'طرمبة الماء وليات الرديتر', label: 'Water pump + radiator hoses (check)', icon: '🚿', km: 80000, months: 48, nKm: 100000, nMonths: 60, what: 'Look for pink crust at the pump, soft or swollen hoses, and keep the coolant level between the lines.', why: 'Overheating in the desert ends trips; this pump is a known seep point on the 2.5 L.' },
  tyrePressure: { ar: 'ضغط هواء الكفرات', label: 'Tyre pressure', icon: '🎯', days: 30, what: 'Check cold, to the pressure on the driver’s door sticker; spare too.', why: 'Heat and low pressure together cause blow-outs.' },
  wash: { ar: 'غسيل السيارة', label: 'Wash', icon: '🫧', days: 14, what: 'Wash, and wipe the windscreen and lights.', why: 'Dust and sun dull the paint and the headlights.' },
  tyres: { ar: 'الكفرات', label: 'New tyres (by age)', icon: '🛞', km: 0, months: 60, nKm: 0, nMonths: 72, what: 'Replace the set; check the 4-digit date on the sidewall (week + year).', why: 'Rubber ages in the heat even with tread left.' },
};
/** The car by system, for the Service list. */
export const GROUPS = [
  ['Engine', '🔧', ['oil', 'airFilter', 'plugs', 'belt', 'coolant', 'waterPump', 'mounts']],
  ['Brakes', '🛑', ['brakes', 'rotors', 'brakeFluid']],
  ['Wheels & tyres', '🛞', ['tyres', 'tyrePressure', 'rotate', 'balancing', 'alignment', 'bearings']],
  ['Suspension', '🦘', ['shocks', 'arms', 'cvBoots']],
  ['Gearbox', '⚙️', ['atf']],
  ['Battery, AC & cabin', '🔋', ['battery', 'batteryNew', 'ac', 'cabinFilter', 'wipers']],
  ['Looks', '🫧', ['wash']],
];
/** What to ask the parts shop for: common good-quality aftermarket makes (often the same factories that supply Toyota). Match by VIN. */
export const PARTS = {
  oil: '0W-20 full synthetic, about 4.4 L, + a Toyota or Denso oil filter. At this mileage 5W-30 is a common choice if it burns oil.',
  airFilter: 'Denso, Sakura or Toyota.', cabinFilter: 'Denso (charcoal type keeps dust smell out) or Toyota.',
  brakes: 'Advics (Toyota’s own supplier) or Akebono ceramic pads — front set, rear if under 3 mm.', rotors: 'Advics, Brembo or Toyota — replace in pairs with the pads.',
  brakeFluid: 'DOT 3 (Toyota brake fluid), about 1 L for a flush.', atf: 'Toyota ATF WS only — about 3.5–4 L per drain-and-fill.',
  coolant: 'Toyota Super Long Life Coolant (pink, pre-mixed) — genuine is cheap; don’t mix with green.', plugs: 'Denso or NGK iridium (4) — the shop matches the part number to the VIN.',
  belt: 'Bando, Gates or Mitsuboshi; replace the tensioner too if it rattles.', waterPump: 'Aisin (makes Toyota’s pump) — with a new gasket and coolant.',
  shocks: 'KYB (Excel-G) or Monroe, with new top mounts and dust boots; front pair at least.', arms: '555 or CTR lower control arms (come with bushings and ball joint), in pairs.',
  cvBoots: 'A boot kit (with grease and clamps) — or a whole axle if it already clicks.', mounts: 'Toyota or a known make (e.g. Marmon); the right-side mount wears first.',
  bearings: 'Koyo or NSK hub bearings.', battery: 'Load test free at battery shops.', batteryNew: 'Size per the old battery (Group 24F/35 class); AC Delco, Varta or a local brand with warranty.',
  ac: 'Gas top-up only if there is no leak; ask for a leak test.', wipers: 'Bosch or Denso, 26" + 18".', tyres: '215/60R16 is the stock size for this Camry.',
  alignment: 'Ask for the before/after printout.', balancing: '—', rotate: '—', tyrePressure: 'Pressure on the driver’s door sticker.', wash: '—',
};
export const ITEM_ORDER = ['oil', 'rotate', 'brakes', 'rotors', 'tyrePressure', 'wash', 'airFilter', 'cabinFilter', 'alignment', 'balancing', 'battery', 'batteryNew', 'ac', 'wipers', 'brakeFluid', 'atf', 'coolant', 'waterPump', 'belt', 'plugs', 'shocks', 'arms', 'cvBoots', 'bearings', 'mounts', 'tyres'];

/**
 * What the other sources say, item by item — Toyota's schedule, Saudi service sites and dealers, and owner forums. Shown on
 * each item so you can see where the default came from and pick your own interval.
 */
export const VOICES = {
  oil: [['Toyota', '16,000 km / 12 months normal; 8,000 km / 6 months for severe use (heat, dust, stop-and-go).'], ['Saudi service sites', 'Dealers and quick-lube chains cap synthetic at about 10,000 km in Saudi heat; some advise 4,000–6,000 km on rough or very hot use.'], ['Forums', 'Many owners in hot climates settle on 8,000 km or every 6 months, whichever first, with 0W-20 full synthetic.']],
  atf: [['Toyota', 'ATF WS is “inspect only” on the normal schedule; replace for severe use.'], ['Forums and techs', 'Drain-and-fill (about a third each time), twice a week apart, every ~48,000 km. Avoid machine flushes.'], ['Known on this gearbox', 'A light-throttle shudder around 40–70 km/h (torque-converter lock-up) — a Toyota bulletin covered 2012–2014; fluid first, converter if it persists.']],
  battery: [['Saudi service sites', 'Hot-climate batteries usually last 2–3 years; test before summer, replace at about 3 years.'], ['Tip', 'Slow cranking after a hot day with the AC on is the usual first sign.']],
  batteryNew: [['Saudi service sites', 'Replace at about 3 years in the heat, even if it still starts.']],
  coolant: [['Toyota', 'Super Long Life Coolant: first at 10 years / 160,000 km, then every 5 years / 80,000 km.'], ['Saudi service sites', 'Some advise every 2–3 years in the heat; at least check the level monthly in summer.'], ['Known on the 2.5 L', 'The water pump can seep: pink crust near the belt end of the engine.']],
  ac: [['Saudi and UAE service sites', 'Service it in March–April, before the queues; run it year-round to keep the seals wet.']],
  airFilter: [['Toyota', 'Replace at 48,000 km normally; inspect every oil change on dusty roads.'], ['Forums', 'In dusty cities many change it at every second oil change.']],
  cabinFilter: [['Saudi service sites', 'Dust clogs it fast: change it before summer.']],
  plugs: [['Toyota', 'Iridium plugs, about 190,000 km (120,000 miles).'], ['Techs', 'Some change them earlier (~130,000 km) so they don’t seize in the aluminium head.']],
  brakeFluid: [['Toyota (Asia schedule)', 'Replace every 24 months.'], ['Forums', 'Some owners do it yearly in very hot climates.']],
  rotate: [['Toyota', 'Every 8,000 km.'], ['Other Saudi guides', 'Every 10,000 km at the latest.']],
  tyres: [['Saudi heat', 'Rubber cracks with age: check the sidewalls each summer; most replace by 5–6 years even with tread left.'], ['Tip', 'The 4-digit DOT code on the sidewall is the week and year it was made (2525 = week 25 of 2025). Age counts from there, not from fitting.']],
  rotors: [['Workshops', 'Measure the disc thickness at every pad change; skim only if it stays above the minimum stamped on the disc.'], ['Tip', 'New pads on worn discs squeal and wear fast — the usual reason both are done together.']],
  shocks: [['Workshops', 'Commonly replaced around 80,000–100,000 km on Saudi roads; sooner with speed bumps and rough desert roads.'], ['Check', 'Push down hard on each corner: more than one bounce, an oily shock body or a nose-dive under braking means they are done.']],
  arms: [['Workshops', 'On cars past 8–10 years, the lower arm bushings are a common replacement; the arm usually comes with new bushings and ball joint.'], ['Tip', 'Fit them with the car standing on its wheels (or tighten them there), or the new rubber twists and tears early.']],
  alignment: [['Tip', 'Ask for the printout before and after: green numbers on both sides.'], ['When', 'After new tyres, shocks or arms — so do it last, after all the suspension work.']],
  waterPump: [['Known on the 2.5 L', 'Pink crust around the pump pulley is the early sign of a seep; Toyota replaces it under the belt.'], ['Before a trip', 'Top up with the same pink coolant only; carry 1 L of it and water.']],
};
/** Where the plan and the notes come from (opened while building this). */
export const SOURCES = [
  ['Toyota Camry oil type and intervals (Keith Pierson Toyota)', 'https://www.keithpiersontoyota.com/toyota-camry-oil-type.html'],
  ['Camry 2.5 L maintenance schedule, normal vs severe, Europe/APAC (maintenanceschedule.com)', 'https://maintenanceschedule.com/toyota-camry-i4-2-5l-2018-8th-gen/'],
  ['Synthetic oil life in Saudi heat (Marqstats)', 'https://marqstats.com/insights/saudi-arabia-extreme-heat-oil-drain-interval-compression/'],
  ['Oil change tips for Saudi drivers (Motor283)', 'https://motor283.com/en/car-tips-mechanics-maintenance/oil-change-tips-every-saudi-driver-needs-to-know'],
  ['Petromin Express oil packages (Al Rajhi offer page)', 'https://www.alrajhibank.com.sa/en/Personal/Offers/CardsOffers/Kashtah/Petromin-Express'],
  ['Car batteries in the KSA summer (PitStopArabia)', 'https://www.pitstoparabia.com/en/news/truth-about-car-batteries-in-ksa-summer'],
  ['Protecting your car from Saudi heat and sandstorms (ZigWheels KSA)', 'https://www.zigwheelsksa.com/car-news/how-to-protect-your-car-from-saudi-heat-sandstorms-2025-updated-guide'],
  ['Summer car maintenance in Saudi Arabia (CarSwitch)', 'https://ksa.carswitch.com/newsroom/en/2025/06/24/how-to-maintain-your-car-saudi-arabia-summer-2025/'],
  ['Camry 2012–2017 common problems (Samarins)', 'https://www.samarins.com/reviews/camry_2012.html'],
  ['2AR-FE engine common problems (8020 Automotive)', 'https://8020automotive.com/the-3-most-common-toyota-2ar-fe-engine-problems/'],
  ['Camry maintenance schedule and ATF WS (Haynes)', 'https://us.haynes.com/blogs/tips-tutorials/2007-15-toyota-camry-avalon-and-lexus-es350-routine-maintenance-faq'],
];
/** Things owners of this generation report — what it feels like, and what to do. */
export const KNOWN = [
  { icon: '〰️', title: 'Shudder at 40–70 km/h', body: 'A brief rumble-strip feeling on light throttle as the gearbox locks up. Toyota issued bulletins for 2012–2014 cars. Fresh ATF WS often helps; if not, the torque converter.' },
  { icon: '💧', title: 'Water pump seep', body: 'Pink, crusty coolant marks at the belt end of the engine or a slowly dropping reservoir. Not urgent while small; it gets worse, not better.' },
  { icon: '🔋', title: 'Batteries and terminals', body: 'Corroded terminals and short battery life are common complaints — worse in the heat. Clean the terminals when you test it.' },
  { icon: '❄️', title: 'AC complaints', body: 'Weak cooling or a smell: cabin filter first, then a gas and leak check before summer.' },
  { icon: '🛞', title: 'Tyre-pressure light', body: 'TPMS sensor batteries age out at 7–10 years; the light can stay on even with good pressures.' },
  { icon: '🛢️', title: 'Small oil leaks', body: 'Minor seepage around the timing cover with age. Check the ground where you park; top up between changes if low.' },
];

/** Car models with a ready plan. `facts` show on the car card. */
export const MODELS = {
  'camry-2016': { name: 'Toyota Camry 2016 · 2.5 L', icon: '🚗', year: 2016, items: ITEM_ORDER,
    facts: [['Engine', '2.5 L 4-cylinder (2AR-FE), timing chain — no timing belt to change'], ['Engine oil', '0W-20 full synthetic, about 4.4 L with the filter'], ['Fuel', '91 octane'], ['Gearbox', '6-speed automatic (U760E), Toyota ATF WS'], ['Coolant', 'Toyota Super Long Life (pink), pre-mixed'], ['Spark plugs', 'Iridium, long-life'], ['Tyre pressure', 'see the driver’s door sticker']] },
  generic: { name: 'Another car', icon: '🚙', year: 0, items: ITEM_ORDER, facts: [] },
};

/** The interval in force for an item on a car: your own numbers first, then the plan (severe or normal). */
export function interval(car, id) {
  const def = ITEMS[id], own = car.care?.[id] || {}, severe = car.severe !== false;
  if (!def) return { km: 0, months: 0, days: 0 };
  if (def.days) return { km: 0, months: 0, days: own.days ? +own.days : def.days };
  let km = severe ? def.km : def.nKm, months = severe ? def.months : def.nMonths;
  if (def.then && own.last && (own.count || 0) >= 1) { km = def.then.km; months = def.then.months; }   // coolant after its first change
  return { km: own.km != null && own.km !== '' ? +own.km : km, months: own.months != null && own.months !== '' ? +own.months : months, days: 0 };
}

/** Odometer readings → km per day (from readings over the last ~6 months; at least 7 days apart). */
export function kmPerDay(car) {
  const log = (car.odoLog || []).filter(r => isKey(r.date) && r.km > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (log.length < 2) return 0;
  const last = log[log.length - 1], from = log.find(r => daysUntil(r.date, fromKey(last.date)) >= -183) || log[0];
  const days = -daysUntil(from.date, fromKey(last.date));
  return days >= 7 && last.km > from.km ? Math.round((last.km - from.km) / days * 10) / 10 : 0;
}
/** The odometer today: the last reading moved on by km per day (rounded), so km-based items keep counting between readings. */
export function odoNow(car, now = new Date()) {
  const log = (car.odoLog || []).filter(r => isKey(r.date) && r.km > 0).sort((a, b) => a.date.localeCompare(b.date)), last = log[log.length - 1];
  if (!last) return { km: car.odo || 0, guessed: false, at: car.odoAt || '' };
  const k = kmPerDay(car), days = Math.max(0, -daysUntil(last.date, now));
  return { km: Math.round(last.km + k * days), guessed: !!(k && days), at: last.date, last: last.km };
}

/**
 * Where an item stands: { id, def, iv, last, lastKm, nextKm, nextDate, kmLeft, days (until the earlier of the two), date,
 * by: 'km'|'time', state: 'late'|'soon'|'ok'|'unknown', used (0–1 of the interval) }.
 * Never logged → 'unknown' (tap to say when it was last done).
 */
export function itemState(car, id, now = new Date()) {
  const def = ITEMS[id], iv = interval(car, id), own = car.care?.[id] || {}, odo = odoNow(car, now), kpd = kmPerDay(car);
  const base = { id, def, iv, last: own.last || '', lastKm: own.lastKm || 0, count: own.count || 0 };
  if (!own.last) return { ...base, state: 'unknown', days: null, used: 0 };
  let byTime = '', kmLeft = null, byKm = '';
  if (iv.days) byTime = keyOf(addDays(fromKey(own.last), iv.days));
  else if (iv.months) byTime = addMonths(own.last, iv.months);
  if (iv.km && own.lastKm && odo.km) { kmLeft = own.lastKm + iv.km - odo.km; if (kpd > 0) byKm = keyOf(addDays(startOfDay(now), Math.round(kmLeft / kpd))); else if (kmLeft <= 0) byKm = keyOf(now); }
  const date = [byTime, byKm].filter(Boolean).sort()[0] || '', days = date ? daysUntil(date, now) : null;
  const usedT = byTime ? Math.min(1.2, Math.max(0, 1 - daysUntil(byTime, now) / Math.max(1, -daysUntil(own.last, fromKey(byTime))))) : 0;
  const usedK = kmLeft != null && iv.km ? Math.min(1.2, Math.max(0, 1 - kmLeft / iv.km)) : 0;
  const soonDays = iv.days ? 3 : 21, soonKm = Math.min(1000, (iv.km || 0) * .12);
  const late = (days !== null && days < 0) || (kmLeft !== null && kmLeft < 0);
  const soon = !late && ((days !== null && days <= soonDays) || (kmLeft !== null && kmLeft <= soonKm));
  return { ...base, nextKm: iv.km && own.lastKm ? own.lastKm + iv.km : 0, nextDate: byTime, kmLeft, date, days, by: byKm && byKm === date ? 'km' : 'time', state: late ? 'late' : soon ? 'soon' : 'ok', used: Math.max(usedT, usedK) };
}
/** A car's plan, most urgent first (late, soon, then by date; never-logged at the end). */
export function plan(car, now = new Date()) {
  const ids = (car.items || MODELS[car.model]?.items || ITEM_ORDER).filter(id => ITEMS[id] && !(car.care?.[id]?.off));
  const rank = { late: 0, soon: 1, ok: 2, unknown: 3 };
  return ids.map(id => itemState(car, id, now)).sort((a, b) => rank[a.state] - rank[b.state] || (a.date || '9').localeCompare(b.date || '9'));
}
/** "in 1,240 km or 23/01/2027" / "1,200 km overdue" — the plain line under an item. */
export function dueText(st, fmt = (k) => k) {
  if (st.state === 'unknown') return 'When was it last done? Tap to set';
  const parts = [];
  if (st.kmLeft !== null) parts.push(st.kmLeft < 0 ? `${(-st.kmLeft).toLocaleString('en')} km overdue` : `in ${st.kmLeft.toLocaleString('en')} km`);
  if (st.nextDate) { const d = daysUntil(st.nextDate); parts.push(d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'today' : d <= 45 ? `in ${d} day${d === 1 ? '' : 's'}` : `by ${fmt(st.nextDate)}`); }
  return parts.join(' or ');
}

/** Set up a car from a model: the plan, severe use (Riyadh heat) on. */
export const fromModel = (model) => ({ model, name: model === 'camry-2016' ? 'Camry' : 'My car', icon: MODELS[model]?.icon || '🚗', severe: true, care: {}, odoLog: [], fuel: [], log: [] });

/** A reading of the odometer. Lower than the last one is refused (returns null) unless it is a fix of that same day. */
export function addReading(car, km, date) {
  const k = Math.round(num(km, 0, 2e6, 0)); if (!k || !isKey(date)) return null;
  const log = (car.odoLog || []).filter(r => r.date !== date), prev = log.filter(r => r.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prev && k < prev.km) return null;
  const odoLog = [...log, { date, km: k }].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  return { ...car, odoLog, odo: odoLog[odoLog.length - 1].km, odoAt: odoLog[odoLog.length - 1].date };
}
/** A service visit: every ticked item restarts from this date and reading; one log line with cost and place. */
export function logVisit(car, { date, km = 0, items = [], cost = 0, place = '', note = '' }) {
  if (!isKey(date)) return car; const k = Math.round(num(km, 0, 2e6, 0));
  let out = { ...car, care: { ...(car.care || {}) } };
  for (const id of items) if (ITEMS[id]) { const cur = out.care[id] || {}; out.care[id] = { ...cur, last: !cur.last || date >= cur.last ? date : cur.last, lastKm: !cur.last || date >= cur.last ? (k || cur.lastKm || 0) : cur.lastKm, count: (cur.count || 0) + 1 }; }
  if (k) out = addReading(out, k, date) || out;
  out.log = [...(out.log || []), { date, km: k, items: items.filter(i => ITEMS[i]), cost: Math.round(num(cost, 0, 1e6, 0)), place: txt(place, 60), note: txt(note, 140), what: items.length ? 'care' : 'note' }].slice(-200);
  return out;
}
/** Say when an item was last done, without a visit (setting up the plan). */
export function setLast(car, id, { date, km = 0 }) { if (!ITEMS[id] || !isKey(date)) return car; return { ...car, care: { ...(car.care || {}), [id]: { ...(car.care?.[id] || {}), last: date, lastKm: Math.round(num(km, 0, 2e6, 0)) } } }; }
/** Your own interval for an item (empty = back to the plan), or switch it off. */
export function setInterval(car, id, { km, months, days, off } = {}) {
  const cur = { ...(car.care?.[id] || {}) };
  for (const [k, v] of Object.entries({ km, months, days })) { if (v === undefined) continue; if (v === '' || v === null) delete cur[k]; else cur[k] = Math.round(num(v, 0, k === 'km' ? 400000 : k === 'months' ? 240 : 365, 0)); }
  if (off !== undefined) { if (off) cur.off = true; else delete cur.off; }
  return { ...car, care: { ...(car.care || {}), [id]: cur } };
}

// ───────────────────────── fuel
/** A fill-up: litres, SAR, the reading, full tank or not. */
export function addFuel(car, { date, litres, cost, km, full = true }) {
  const l = Math.round(num(litres, 0, 200, 0) * 100) / 100, k = Math.round(num(km, 0, 2e6, 0)); if (!isKey(date) || !l) return car;
  let out = { ...car, fuel: [...(car.fuel || []), { date, litres: l, cost: Math.round(num(cost, 0, 5000, 0) * 100) / 100, km: k, full: !!full }].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km).slice(-300) };
  if (k) out = addReading(out, k, date) || out;
  return out;
}
/** L/100 km between full tanks (litres of every fill after the first full one, over the km between the two full ones). */
export function economy(car) {
  const f = (car.fuel || []).filter(x => x.km > 0).sort((a, b) => a.km - b.km), out = [];
  let start = null, litres = 0;
  for (const x of f) {
    if (start && x.km > start.km) { litres += x.litres; if (x.full) { const km = x.km - start.km; if (km >= 50) out.push({ date: x.date, km, litres, l100: Math.round(litres / km * 1000) / 10 }); start = x; litres = 0; } }
    else if (x.full) { start = x; litres = 0; }
  }
  return out;
}
/** This year's car money: fuel and service visits, and fuel cost per km. */
export function costs(car, now = new Date()) {
  const y = String(now.getFullYear()), fuel = (car.fuel || []).filter(x => x.date.startsWith(y)).reduce((t, x) => t + (x.cost || 0), 0), care = (car.log || []).filter(x => x.date.startsWith(y)).reduce((t, x) => t + (x.cost || 0), 0);
  const eco = economy(car).slice(-3), kmF = eco.reduce((t, x) => t + x.km, 0), lF = eco.reduce((t, x) => t + x.litres, 0);
  const lastPrice = [...(car.fuel || [])].reverse().find(x => x.cost && x.litres);
  const perKm = kmF && lastPrice ? Math.round(lF / kmF * (lastPrice.cost / lastPrice.litres) * 100) / 100 : 0;
  return { fuel: Math.round(fuel), care: Math.round(care), total: Math.round(fuel + care), l100: kmF ? Math.round(lF / kmF * 1000) / 10 : 0, perKm };
}

/** Care items that need you: late, or soon. For the hub and Today. */
export function careAlerts(car, now = new Date()) { return plan(car, now).filter(st => st.state === 'late' || st.state === 'soon'); }
/** Clean a car's care fields (from storage or another device). */
export function cleanCare(c) {
  const care = {};
  for (const [id, v] of Object.entries(c.care && typeof c.care === 'object' ? c.care : {})) if (ITEMS[id] && v && typeof v === 'object') care[id] = { ...(isKey(v.last) ? { last: v.last } : {}), ...(v.lastKm ? { lastKm: Math.round(num(v.lastKm, 0, 2e6, 0)) } : {}), ...(v.count ? { count: Math.round(num(v.count, 0, 999, 0)) } : {}), ...(v.km !== undefined && v.km !== '' ? { km: Math.round(num(v.km, 0, 400000, 0)) } : {}), ...(v.months !== undefined && v.months !== '' ? { months: Math.round(num(v.months, 0, 240, 0)) } : {}), ...(v.days ? { days: Math.round(num(v.days, 1, 365, 30)) } : {}), ...(v.off ? { off: true } : {}) };
  const odoLog = (Array.isArray(c.odoLog) ? c.odoLog : []).filter(r => r && isKey(r.date) && +r.km > 0).map(r => ({ date: r.date, km: Math.round(+r.km) })).slice(-120);
  const fuel = (Array.isArray(c.fuel) ? c.fuel : []).filter(r => r && isKey(r.date) && +r.litres > 0).map(r => ({ date: r.date, litres: +r.litres, cost: +r.cost || 0, km: Math.round(+r.km || 0), full: r.full !== false })).slice(-300);
  return { model: MODELS[c.model] ? c.model : '', severe: c.severe !== false, care, odoLog, fuel };
}
