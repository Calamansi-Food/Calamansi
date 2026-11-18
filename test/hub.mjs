// Calamansi against an in-memory Google (Drive + Calendar + sign-in): the first sign-in offers to bring the chores over from
// Citrus's state.json (with Undo), shifts come from Mandarin's shifts.json and blocks from Citrus's plan.json, status.json is
// written to hub/calamansi only, a planned chore lands in the calendar (and leaves it when done early), the week gets planned,
// and two devices converge. Made-up data only. Run: node test/hub.mjs
import { chromium, serve, sleep, checker } from './helpers.mjs';
import { createFakeGoogle } from './fake-google.mjs';
import { shifts } from './fixture.mjs';
import { STARTERS } from '../docs/js/kitchen.js';
const NS = STARTERS.length;

const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const at = Date.parse('2026-11-10T10:00:00Z');
const citrusState = { updatedAt: at, me: { id: '1', name: 'Dr Test Me' }, rotas: { r: { id: 'r', people: [], legend: {} } }, tasks: { t: { id: 't', title: 'not home' } }, friends: { f1: { id: 'f1', name: 'Ann Able', at } },
  chores: { c1: { id: 'c1', title: 'Laundry', icon: '🧺', every: 4, mins: 120, lastDone: '2026-11-10', at }, c2: { id: 'c2', title: 'Room cleaning', icon: '🧹', every: 7, mins: 60, lastDone: '2026-11-12', at } },
  settings: { alarmPlan: 10 } };
const plan = { app: 'citrus', updatedAt: '2026-11-16T05:00:00Z', days: { '2026-11-16': { blocks: [{ app: 'calamansi', title: 'Calamansi: groceries', start: '21:00', end: '21:45', status: 'accepted' }, { app: 'yuzu', title: 'Yuzu: reviews', start: '22:00', end: '22:30' }] } } };

const g = createFakeGoogle();
g.put('state.json', g.path(['My Apps', 'hub', 'citrus']), citrusState);
g.put('plan.json', g.path(['My Apps', 'hub', 'citrus']), plan);
g.put('shifts.json', g.path(['My Apps', 'hub', 'mandarin']), shifts);

async function device(label, { width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700, serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
  await g.attach(ctx);
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  await p.clock.install({ time: new Date('2026-11-16T09:30:00+03:00') });
  await p.addInitScript(() => { if (!localStorage.getItem('calamansi.google')) localStorage.setItem('calamansi.google', JSON.stringify({ access_token: 'tok', exp: Date.now() + 3600e3, email: 'tester@example.com' })); });
  await p.goto(url); await p.waitForSelector('#view-today.active'); p.label = label;
  return { ctx, p };
}
const state = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('calamansi.state.v1') || 'null'));
const until = async (p, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; };
const sync = async (p) => { await until(p, () => !window.__calamansi.rt.syncing); await p.evaluate(() => window.__calamansi.refreshAll(true)); await until(p, () => !window.__calamansi.rt.syncing); await sleep(300); };

console.log('first sign-in on the phone');
const A = await device('phone');
check(await until(A.p, () => !!document.querySelector('.sheet h2')?.textContent.includes('Bring your chores over')), 'offers to bring the chores over from Citrus');
check(/2 chores/.test(await A.p.locator('.sheet').innerText()), 'says what it found');
await A.p.click('.sheet button:has-text("Bring them over")'); await sleep(700);
let s = await state(A.p);
check(s.chores.c1 && s.chores.c2 && s.chores.c1.lastDone === '2026-11-10', 'the chores came over with their last-done dates');
check(!s.tasks && !s.rotas && !s.friends && !s.me, 'nothing else of Citrus did');
check(s.migrated?.from === 'citrus' && await A.p.locator('.toast button:has-text("Undo")').count() === 1, 'migration recorded, Undo offered');
check(await until(A.p, () => window.__calamansi.R.has()), 'the shifts were read from Mandarin');
await A.p.click('nav.tabs button[data-view=today]'); await sleep(300);
const today = await A.p.locator('#view-today').innerText();
check(/D1 08:00–20:00/.test(today) && /12-hour day/.test(today), 'Today shows the shift and what it means');
check(/Citrus planned 21:00–21:45: groceries/.test(today) && !/Yuzu/.test(today), 'Citrus’s block for Calamansi shows (not other apps’)');

console.log('recipes and the week');
await A.p.click('nav.tabs button[data-view=kitchen]'); await sleep(300);
await A.p.click(`#view-kitchen button:has-text("Add the ${NS} starter recipes")`); await sleep(400);
s = await state(A.p); check(Object.keys(s.recipes).length === NS, `${NS} starter recipes added`);
await A.p.click('#view-kitchen button:has-text("Plan my week")'); await sleep(400);
check(/batch-cook|×4/.test(await A.p.locator('.sheet').innerText()), 'the proposal has a batch cook for the nights');
await A.p.click('.sheet button:has-text("Use this plan")'); await sleep(600);
s = await state(A.p);
const meals = Object.values(s.meals);
check(meals.length > 10 && meals.some(m => m.batch) && meals.filter(m => m.fromBatch).length === 3, `the week is planned (${meals.length} meals; one batch for three nights)`);
check(Object.values(s.shopping).length > 3 && Object.values(s.shopping).every(x => x.from === 'meals'), 'and what it needs is on the shopping list');
await A.p.click('nav.tabs button[data-view=shop]'); await sleep(300);
await A.p.click('#view-shop .sp-tick >> nth=0'); await sleep(300);
s = await state(A.p); check(Object.values(s.shopping).some(x => x.done) && Object.keys(s.pantry).length === 1, 'ticking an item puts it in the fridge list');

console.log('a chore on the calendar');
await A.p.click('nav.tabs button[data-view=home]'); await sleep(300);
await A.p.click('#view-home .chore:has-text("Laundry") button:has-text("Find a time")'); await sleep(400);
await A.p.click('.sheet .ch-slots .item >> nth=0'); await sleep(900);
s = await state(A.p);
check(s.chores.c1.next?.eventId, 'the chore remembers its calendar event');
const evs = () => [...g.calendars.get('primary').events.values()].filter(e => e.status !== 'cancelled' && e.extendedProperties?.private?.calamansi === 'chore');
check(evs().length === 1 && /Laundry/.test(evs()[0].summary), 'the time is in the calendar');
await A.p.click('#view-home .chore:has-text("Laundry") button:has-text("Done")'); await sleep(900);
check(evs().length === 0 && (await state(A.p)).chores.c1.lastDone === '2026-11-16', 'done early: the calendar time is removed, last-done is today');

console.log('what Citrus gets');
await sync(A.p);
const st = g.readJsonAt(['My Apps', 'hub', 'calamansi'], 'status.json');
check(st?.app === 'calamansi' && st.contract === 2 && st.summary, `status.json: "${st?.summary}"`);
check(st.extra?.meals?.today && st.extra.shopping.open >= 3 && Array.isArray(st.extra.chores), 'extra carries chores, meals and shopping');
check(st.asks.every(a => /^\d{4}-\d\d-\d\d$/.test(a.date) && a.title && a.minutes > 0 && a.slot === 'free'), 'asks are well-formed');
check(!!g.readJsonAt(['My Apps', 'hub', 'calamansi'], 'state.json'), 'state.json in hub/calamansi');
check(JSON.stringify(g.readJsonAt(['My Apps', 'hub', 'citrus'], 'state.json')) === JSON.stringify(citrusState) && JSON.stringify(g.readJsonAt(['My Apps', 'hub', 'mandarin'], 'shifts.json')) === JSON.stringify(shifts), "Citrus's and Mandarin's files are untouched");
const files = g.tree().join('\n');
check(!/Rotas/.test(files) && !/📄 contacts\.json/.test(files), 'nothing written outside hub/calamansi');

console.log('a second device');
const B = await device('desktop', { width: 1400 });
await sleep(500);
check(!(await B.p.locator('.sheet h2:has-text("Bring your chores over")').count()), 'the second device does not ask again');
await sync(B.p);
const sb = await state(B.p); check(sb.chores.c1 && Object.keys(sb.recipes).length === NS && Object.keys(sb.meals).length === meals.length, 'the desktop has the phone’s data');
await B.p.evaluate(() => window.__calamansi.store.update(s => window.__calamansi.K.addShop(s, { name: 'Coffee beans' }))); await sleep(300);
await A.p.evaluate(() => window.__calamansi.store.update(s => { const r = { ...s.recipes }; const id = Object.keys(r)[0]; delete r[id]; return { ...s, recipes: r, deleted: { ...s.deleted, [`recipe:${id}`]: Date.now() } }; })); await sleep(300);
await sync(B.p); await sync(A.p); await sync(B.p);
const [ea, eb] = [await state(A.p), await state(B.p)];
check(Object.values(ea.shopping).some(x => x.name === 'Coffee beans') && Object.values(eb.shopping).some(x => x.name === 'Coffee beans'), 'an item added on the desktop reaches the phone');
check(Object.keys(ea.recipes).length === NS - 1 && Object.keys(eb.recipes).length === NS - 1, 'a recipe deleted on the phone stays deleted on both');
const twins = g.tree().filter(l => /(status|state)\.json/.test(l) && !/backups|citrus|mandarin/.test(l));
check(twins.length === new Set(twins).size, `no duplicate files (${twins.length})`);

// ---- a setup.json left in Calamansi's own folder (by Claude) is proposed, added only on a tap, then binned
const meDir = g.path(['My Apps', 'hub', 'calamansi'], false);
g.put('setup.json', meDir, { car: { name: 'Setup Camry', model: 'camry-2016', vin: '1M8GDM9AXKP042788', istimara: '2028-01-02' }, driver: { licence: '2031-01-01' } });
await A.p.evaluate(() => window.__calamansi.refreshAll(true, { full: true })); await sleep(1500);
check(/Add your car/.test(await A.p.locator('.sheet').innerText().catch(() => '')), 'a setup.json on Drive is proposed');
check(!Object.values((await state(A.p)).cars || {}).some(c => c.name === 'Setup Camry'), 'nothing is added before the tap');
await A.p.click('.sheet button:has-text("Add it")'); await sleep(900);
check(Object.values((await state(A.p)).cars || {}).some(c => c.name === 'Setup Camry' && c.istimara === '2028-01-02'), 'Add it adds the car');
check(!g.find('setup.json', meDir), 'and the setup file goes to the bin');
g.put('setup.json', meDir, { car: { name: 'Second Setup', model: 'generic' } });
await A.p.evaluate(() => window.__calamansi.checkSetup(true)); await sleep(600);
check(/Add your car/.test(await A.p.locator('.sheet').innerText().catch(() => '')), 'the Car tab button finds a setup file at once');
await A.p.click('.sheet button:has-text("Not now")'); await sleep(400);
await A.p.evaluate(() => window.__calamansi.checkSetup(true)); await sleep(600);
check(/Add your car/.test(await A.p.locator('.sheet').innerText().catch(() => '')), 'and asks again after "Not now" when asked by hand');
await A.p.click('.sheet button:has-text("Not now")'); await sleep(400);
const D = await device('fresh phone after the file was seen'); await sleep(2500);
check(/Add your car/.test(await D.p.locator('.sheet').innerText().catch(() => '')), 'a fresh app start finds it even when the changes feed already passed it');
await D.p.click('.sheet button:has-text("Not now")').catch(() => {});

// ---- drive-layout.md: folders found by tag; Citrus moves them and Calamansi follows ----
const folder = (name, parentParts) => g.find(name, g.path(parentParts, false));
const own = folder('calamansi', ['My Apps', 'hub']);
check(own?.appProperties?.citrusApp === 'calamansi', 'Calamansi tagged its own folder (citrusApp = calamansi)');
check(g.readJsonAt(['My Apps', 'hub', 'calamansi'], 'status.json')?.drive?.byTag === true, 'status.json says drive.byTag');
check(!folder('mandarin', ['My Apps', 'hub']).appProperties?.citrusApp && !folder('citrus', ['My Apps', 'hub']).appProperties?.citrusApp, "other apps' folders are never tagged by Calamansi");
// Citrus's organiser: tag Mandarin and Citrus, move all three into Citrus/…, renamed
const moveTo = (f, parts, name, tag) => { f.parents = [g.path(parts)]; f.name = name; if (tag) f.appProperties = { ...(f.appProperties || {}), citrusApp: tag }; g.touch(f); };
const mand = folder('mandarin', ['My Apps', 'hub']), cit = folder('citrus', ['My Apps', 'hub']);
moveTo(own, ['Citrus', 'Life'], 'Home & Kitchen - Calamansi');
moveTo(mand, ['Citrus', 'Work'], 'Mandarin', 'mandarin');
moveTo(cit, ['Citrus', '00 Hub'], 'Citrus', 'citrus');
await A.p.evaluate(() => window.__calamansi.store.update(s => window.__calamansi.K.addShop(s, { name: 'Cardamom' }))); await sleep(300);
await sync(A.p);
const moved = ['Citrus', 'Life', 'Home & Kitchen - Calamansi'];
check(Object.values(g.readJsonAt(moved, 'state.json')?.shopping || {}).some(x => x.name === 'Cardamom'), 'after the move, the phone saves into the moved folder');
check(g.readJsonAt(moved, 'status.json')?.drive?.byTag === true, 'and status.json is there too');
check(!g.path(['My Apps', 'hub', 'calamansi'], false), 'no new My Apps/hub/calamansi appeared');
const C = await device('fresh tablet', { width: 800 });
await sync(C.p);
const sc = await state(C.p);
check(Object.values(sc.shopping || {}).some(x => x.name === 'Cardamom') && Object.keys(sc.recipes || {}).length === NS - 1, 'a fresh device after the move finds the data by tag');
check(await until(C.p, () => window.__calamansi.R.has()), "and reads Mandarin's shifts from Mandarin's moved folder");
check(!g.path(['My Apps', 'hub', 'calamansi'], false) && !g.path(['My Apps', 'hub', 'mandarin'], false), 'and recreates nothing at the old paths');
check(!C.p.errors.length, `no page errors on the fresh device${C.p.errors.slice(0, 2).join(' | ')}`);

check(!A.p.errors.length && !B.p.errors.length, `no page errors${[...A.p.errors, ...B.p.errors].slice(0, 2).join(' | ')}`);
await browser.close(); server.close();
if (bad()) { console.log(`${bad()} hub check(s) FAILED`); process.exit(1); }
