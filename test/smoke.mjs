// Every tab and the main sheets render at phone and desktop sizes (and in each interface) with made-up data, with no page errors,
// no stray "undefined" / "NaN" / "null" on screen and no sideways scroll. Run: node test/smoke.mjs
import { chromium, serve, page, sleep, checker } from './helpers.mjs';
import { shifts, state } from './fixture.mjs';
import fs from 'node:fs'; import path from 'node:path';
const shots = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'shots/smoke'); fs.rmSync(shots, { recursive: true, force: true }); fs.mkdirSync(shots, { recursive: true });
const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const TABS = ['today', 'home', 'kitchen', 'shop', 'life', 'more'];
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
  await p.click('#view-kitchen .chips button:has-text("Light")'); await sleep(200); await clean(p, '#view-kitchen', 'recipes filtered');
  await p.click('#view-kitchen .chips button:has-text("All")'); await sleep(150);
  // Shop
  await tab('shop', 'List');
  await sheetCheck(() => p.click('#view-shop .sp-need button:has-text("Review")'), 'needed for meals').catch(() => {});
  await sheetCheck(() => p.click('#view-shop .sp-row button[aria-label^="Edit"] >> nth=0'), 'shopping item');
  await tab('shop', 'Fridge'); await clean(p, '#view-shop', 'Shop › Fridge'); await p.screenshot({ path: `${shots}/${w}-fridge.png`, fullPage: true });
  await sheetCheck(() => p.click('#view-shop .sp-main >> nth=0'), 'food sheet');
  // Life
  await tab('life', 'Bills'); await sheetCheck(() => p.click('#view-life .lf-bill .ch-main >> nth=0'), 'bill sheet');
  await tab('life', 'Car'); await clean(p, '#view-life', 'Life › Car'); await p.screenshot({ path: `${shots}/${w}-car.png`, fullPage: true });
  await sheetCheck(() => p.click('#view-life .lf-car button[aria-label^="Edit"]'), 'car sheet');
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
