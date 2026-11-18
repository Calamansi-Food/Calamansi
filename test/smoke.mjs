// Every tab and the main sheets render at phone and desktop sizes (and in each interface) with made-up data, with no page errors,
// no stray "undefined" / "NaN" / "null" on screen and no sideways scroll. Run: node test/smoke.mjs
import { chromium, serve, page, sleep, checker } from './helpers.mjs';
import { shifts, state } from './fixture.mjs';
import { POLICY_TEXT } from './policy-sample.mjs';
import fs from 'node:fs'; import path from 'node:path';
const shots = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'shots/smoke'); fs.rmSync(shots, { recursive: true, force: true }); fs.mkdirSync(shots, { recursive: true });
const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const TABS = ['today', 'home', 'kitchen', 'shop', 'car', 'life', 'more'];
const clean = async (p, sel, what) => {
  const txt = await p.locator(sel).innerText();
  check(txt.length > 30, `${what} renders (${txt.length} chars)`);
  check(!/\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/.test(txt), `${what}: no undefined / NaN / null`);
  check(!/hit a problem|could not be shown/.test(txt), `${what}: no crash card`);
  return txt;
};
for (const [w, hgt, time, ui] of [[390, 844, '2026-11-16T09:30:00+03:00', 'clean'], [320, 640, '2026-11-20T09:00:00+03:00', 'arcade'], [1500, 900, '2026-11-19T15:00:00+03:00', 'paper']]) {
  console.log(`${w}px at ${time.slice(5, 16)} (${ui})`);
  const { p, ctx, errors } = await page(browser, { width: w, height: hgt, time, seed: state, shifts });
  await p.addInitScript((u) => localStorage.setItem('calamansi.ui', JSON.stringify({ ui: u, size: 'normal' })), ui);
  await p.goto(url); await sleep(500);
  for (const t of TABS) {
    if (t === 'more') await p.click('#btnMore'); else await p.click(`nav.tabs button[data-view=${t}]`);
    await sleep(300);
    await clean(p, `#view-${t}`, t);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 1, `${t}: no sideways scroll (${over}px)`);
    await p.screenshot({ path: `${shots}/${w}-${t}.png`, fullPage: true });
  }
  const sheetCheck = async (open, what) => { await open(); await sleep(400); const t = await clean(p, '.sheet', what); await p.screenshot({ path: `${shots}/${w}-${what.replace(/\W+/g, '-')}.png` }); const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 1, `${what}: no sideways scroll`); await p.keyboard.press('Escape'); await sleep(350); if (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await sleep(350); } return t; };
  const tab = async (t, seg) => { await p.click(`nav.tabs button[data-view=${t}]`); await sleep(150); if (seg) { await p.click(`#view-${t} .seg button:has-text("${seg}")`); await sleep(200); } };
  // Kitchen
  await tab('kitchen', 'This week');
  const plan = await sheetCheck(() => p.click('#view-kitchen button:has-text("Plan my week")'), 'plan my week');
  check(/batch/i.test(plan) && /Night meal/.test(plan), 'the proposal shows the batch and the night meals');
  await sheetCheck(() => p.click('#view-kitchen .kt-sug >> nth=0'), 'pick a meal');
  if (!(await p.locator('#view-kitchen .kt-row.has').count())) { await p.click('#view-kitchen .kt-row.open button.btn.sm >> nth=0'); await sleep(300); }
  await sheetCheck(() => p.click('#view-kitchen .kt-row.has >> nth=0'), 'meal sheet');
  await tab('kitchen', 'Recipes'); await clean(p, '#view-kitchen', 'Kitchen › Recipes'); await p.screenshot({ path: `${shots}/${w}-recipes.png`, fullPage: true });
  const rs = await sheetCheck(() => p.click('#view-kitchen .kt-rcard >> nth=0'), 'recipe sheet');
  check(/°C/.test(rs) && /min/.test(rs), 'the recipe shows machine temperatures and times');
  await sheetCheck(() => p.click('#view-kitchen button:has-text("+ Recipe")'), 'recipe editor');
  await sheetCheck(() => p.click('#view-kitchen button:has-text("Oven ↔ air fryer")'), 'converter');
  await sheetCheck(() => p.click('#view-kitchen button:has-text("Safe temperatures")'), 'safe temperatures');
  await p.click('#view-kitchen button:has-text("Paste a recipe")'); await sleep(250); await p.fill('.sheet textarea', 'Test lemon chicken\n500 g chicken\n1 lemon\n1. Air fryer 200°C 15 min'); await p.click('.sheet button:has-text("Read it")'); await sleep(350);
  check(await p.locator('.sheet input[value="Test lemon chicken"]').count() === 1, 'a pasted recipe opens in the editor'); await p.keyboard.press('Escape'); await sleep(300);
  await p.click('#view-kitchen .kt-rcard >> nth=0'); await sleep(300); await p.click('.sheet button:has-text("Cook it now")'); await sleep(300);
  check(await p.locator('.ck').count() === 1, 'cook mode opens'); await clean(p, '.ck', 'cook mode · get ready'); await p.screenshot({ path: `${shots}/${w}-cook-ready.png` });
  await p.click('.ck-next'); await sleep(200); await clean(p, '.ck', 'cook mode · step 1');
  const tb = p.locator('.ck-tbtn'); if (await tb.count()) { await tb.first().click(); await sleep(300); check(await p.locator('.ck-timer').count() >= 1, 'a timer starts from the step'); }
  await p.screenshot({ path: `${shots}/${w}-cook-step.png` });
  await p.keyboard.press('Escape'); await sleep(250); check(await p.locator('.ck').count() === 0, 'Esc closes cook mode');
  await p.click('#view-kitchen .chips button:has-text("Light")'); await sleep(200); await clean(p, '#view-kitchen', 'recipes filtered');
  await p.click('#view-kitchen .chips button:has-text("All")'); await sleep(150);
  // Shop
  await tab('shop', 'List');
  await sheetCheck(() => p.click('#view-shop .sp-need button:has-text("Review")'), 'needed for meals').catch(() => {});
  await sheetCheck(() => p.click('#view-shop .sp-row button[aria-label^="Edit"] >> nth=0'), 'shopping item');
  await tab('shop', 'Fridge'); await clean(p, '#view-shop', 'Shop › Fridge'); await p.screenshot({ path: `${shots}/${w}-fridge.png`, fullPage: true });
  await sheetCheck(() => p.click('#view-shop .sp-main >> nth=0'), 'food sheet');
  // Life
  await tab('life'); await sheetCheck(() => p.click('#view-life .lf-bill .ch-main >> nth=0'), 'bill sheet');
  await tab('car'); await clean(p, '#view-car', 'Car'); await p.screenshot({ path: `${shots}/${w}-car.png`, fullPage: true });
  await sheetCheck(() => p.click('#view-car .lf-carhero button[aria-label^="Edit"]'), 'car sheet');
  const it = await sheetCheck(() => p.click('#view-car .lf-item >> nth=0'), 'care item sheet'); check(/Toyota|Saudi|Forums/.test(it), 'a care item shows what the sources say');
  await sheetCheck(() => p.click('#view-car button:has-text("Log a service") >> nth=0'), 'service visit');
  await sheetCheck(() => p.click('#view-car .lf-acts button:has-text("Fuel")'), 'fuel sheet');
  check(await p.locator('#view-car .ksa-plate').count() === 1 && await p.locator('#view-car .lf-ring b').count() === 1, 'the hero shows the plate and the health ring');
  const acc = await sheetCheck(() => p.click('#view-car .lf-acts button:has-text("Accident")'), 'accident sheet'); check(/Najm/.test(acc) && /199033/.test(acc) && /1M8GDM9AXKP042788/.test(acc), 'the accident card has Najm, the steps and the VIN');
  // Service: by system, with the Arabic workshop names; a planned service and the workshop list; a road trip
  await tab('car', 'Service'); const svc = await clean(p, '#view-car', 'Car › Service'); await p.screenshot({ path: `${shots}/${w}-car-service.png`, fullPage: true });
  check(/Suspension/i.test(svc) && /المساعدات/.test(svc) && /المقصات وجلود المقصات/.test(svc) && /البواجي/.test(svc), 'parts are grouped and named in Arabic too');
  await p.click('#view-car button:has-text("Plan a service")'); await sleep(300);
  await p.click('.sheet button:has-text("Everything due")'); await sleep(150); await p.click('.sheet .chip:has-text("Shock absorbers")'); await sleep(150);
  await p.fill('.sheet input[type=date]', '2026-12-05'); await p.click('.sheet button:has-text("Save the plan")'); await sleep(400);
  await tab('car', 'Overview'); const ov = await p.locator('#view-car .cr-plan').innerText().catch(() => '');
  check(/Planned service/i.test(ov) && /Shock absorbers/.test(ov) && /المساعدات/.test(ov), 'the planned service shows on the overview, English + Arabic');
  const ws = await sheetCheck(() => p.click('#view-car .cr-plan button:has-text("Show the workshop")'), 'workshop list'); check(/المساعدات/.test(ws) && /KYB/.test(ws) && /1M8GDM9AXKP042788/.test(ws), 'the workshop list has Arabic, the part to ask for and the VIN');
  await tab('car', 'Road trip'); await p.fill('#view-car input[placeholder^="e.g. East"]', 'Test loop'); await p.fill('#view-car input[placeholder="total km"]', '3300'); await p.fill('#view-car .cr-trip input[type=date]', '2026-12-15'); await p.click('#view-car .cr-trip button:has-text("Save")'); await sleep(400);
  const trip = await clean(p, '#view-car', 'Car › Road trip'); await p.screenshot({ path: `${shots}/${w}-car-trip.png`, fullPage: true });
  check(/3,300/.test(trip) && /litres/i.test(trip) && /Before you leave/i.test(trip), 'the trip shows fuel and the checklist');
  await p.click('#view-car .cr-check >> nth=0'); await sleep(300); check(/1\/12/.test(await p.locator('#view-car .cr-checks').innerText()), 'a check ticks and stays');
  // insurance from a (made-up) policy PDF, read in the browser with pdf.js
  await tab('car', 'Papers'); await clean(p, '#view-car', 'Car › Papers');
  await p.click('#view-car .lf-ins button:has-text("Add policy")'); await sleep(300);
  await p.setInputFiles('.sheet input[type=file]', path.resolve(path.dirname(new URL(import.meta.url).pathname), 'policy-sample.pdf'));
  const okPdf = await p.waitForSelector('.sheet .lf-found.ok', { timeout: 15000 }).then(() => true).catch(() => false);
  check(okPdf, `the policy PDF is read (${(await p.locator('.sheet .lf-found').innerText().catch(() => '')).slice(0, 80)})`);
  await p.screenshot({ path: `${shots}/${w}-policy-read.png` });
  await p.click('.sheet button:has-text("Save")'); await sleep(400);
  const ins = await p.locator('#view-car .lf-ins').innerText();
  check(/Tawuniya/i.test(ins) && /third party only/i.test(ins) && /980/.test(ins) && /Towing up to 100 km/i.test(ins), 'the insurance card shows insurer, cover, price and extras');
  // the same from pasted text (bilingual, Arabic words reversed as pdf.js gives them)
  await p.click('#view-car .lf-ins button:has-text("Edit")'); await sleep(300);
  await p.fill('.sheet textarea', POLICY_TEXT); await sleep(200);
  check(/Found: insurer/.test(await p.locator('.sheet .lf-found').innerText()), 'pasted policy text is read');
  await p.click('.sheet button:has-text("Save")'); await sleep(400);
  check(/Al Rajhi Takaful/i.test(await p.locator('#view-car .lf-ins').innerText()), 'and replaces the details');
  // the driver
  await p.click('#view-car .lf-driver button'); await sleep(300);
  await p.fill('.sheet input[type=date] >> nth=0', '2030-04-06'); await p.fill('.sheet input[type=date] >> nth=1', '2016-09-04'); await p.click('.sheet button:has-text("Save")'); await sleep(400);
  check(/until 06\/04\/2030/.test(await p.locator('#view-car .lf-driver').innerText()) && /years driving/i.test(await p.locator('#view-car .lf-driver').innerText()), 'the licence and years driving show');
  await clean(p, '#view-car', 'Car › Papers with policy'); await p.screenshot({ path: `${shots}/${w}-car-papers.png`, fullPage: true });
  await tab('car', 'Overview'); const lifeTxt = await p.locator('#view-car').innerText(); check(/What Camry owners run into/i.test(lifeTxt) && /L \/ 100 km/i.test(lifeTxt), 'known issues and the fuel card show');
  await tab('car', 'Anatomy'); await clean(p, '#view-car', 'Car › Anatomy'); await p.screenshot({ path: `${shots}/${w}-anatomy.png`, fullPage: true });
  const part = await sheetCheck(() => p.click('#view-car .an-hot >> nth=3'), 'anatomy part'); check(/What it does/i.test(part) && /How to check/i.test(part), 'a part explains itself');
  await p.click('#view-car .an-hero button:has-text("Find it")'); await sleep(200);
  const want = (await p.locator('#view-car .an-hero').innerText()).match(/Find: (.+)/)?.[1]?.trim();
  if (want) { await p.click(`#view-car .an-hot[aria-label="${want.replace(/"/g, '\\"')}"]`).catch(() => {}); await sleep(300); check(/1\/6/.test(await p.locator('#view-car .an-score').innerText()), 'Find it scores a right answer'); }
  await tab('car', 'Anatomy'); await p.click('#view-car .an-hero .seg button:has-text("The whole car")').catch(() => {}); await sleep(200); await clean(p, '#view-car', 'Anatomy › whole car');
  if (w === 1500) {   // a setup link (#setup=…) proposes the car + papers + licence; nothing is saved until "Update"
    const payload = { car: { name: 'Test Camry', model: 'camry-2016', vin: '1M8GDM9AXKP042788', istimara: '2028-01-02', fahas: '2027-02-03', colour: 'ازرق فاتح' }, driver: { licence: '2031-01-01' } };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await p.goto(`${url}?do=car#setup=${b64}`); await sleep(900);
    const su = await p.locator('.sheet').innerText().catch(() => '');
    check(/Update Test Camry/.test(su) && /Istimara until 02\/01\/2028/.test(su), 'a setup link proposes the update');
    check(!/setup=/.test(await p.evaluate(() => location.href)), 'and is wiped from the address bar');
    await p.click('.sheet button:has-text("Update")'); await sleep(900);
    await p.click('#view-car .cr-seg button:has-text("Papers")'); await sleep(200); const after = await p.locator('#view-car').innerText();
    check(/02\/01\/2028/.test(after) && /until 01\/01\/2031/.test(after) && await p.evaluate(() => Object.keys(window.__calamansi.store.get().cars).length) === 1, 'the car is updated, not doubled');
  }
  // Home
  await tab('home'); await sheetCheck(() => p.click('#view-home button:has-text("Find a time") >> nth=0'), 'chore planner'); await sheetCheck(() => p.click('#view-home .chore button[aria-label^="Edit"] >> nth=0'), 'chore editor');
  await sheetCheck(() => p.click('#btnSearch'), 'search').catch(() => {});
  await p.keyboard.press('Escape'); await sleep(200);
  await p.keyboard.press('a'); await sleep(300); check(await p.locator('.sheet h2:has-text("Add to the shopping list")').count() === 1, '“a” opens Add to the list'); await p.keyboard.press('Escape'); await sleep(300);
  check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
await browser.close(); server.close();
if (bad()) { console.log(`${bad()} smoke check(s) FAILED`); process.exit(1); }
