// Cook mode: a full-screen, step-by-step view for the kitchen counter. Big text, a "get ready" page (ingredients scaled to your
// portions to tick off, which machine to preheat and to what), one step per page with one-tap timers (the times written in the
// step and the machine's time), several timers at once with a chime and a buzz, the screen kept awake, swipe or arrow keys, and
// "Cooked" at the end. Esc / Back / ✕ close it; nothing is saved until you press Cooked.
import { h, toast, keyOf } from './util.js';
import * as K from './kitchen.js';

let ctx = null;
export function initCook(c) { ctx = c; }
const timers = [];   // {id, label, end, done} — kept while the page is open, across recipes
let tick = null, lock = null, audio = null;

function chime() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const t = audio.currentTime;
    for (const [f, d] of [[880, 0], [1175, .18], [1568, .36]]) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.35, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .5); o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + .55); }
  } catch {}
  try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch {}
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function startTimer(label, minutes) { const t = { id: Math.random().toString(36).slice(2), label, end: Date.now() + minutes * 60000, done: false }; timers.push(t); ensureTick(); return t; }
function ensureTick() {
  if (tick) return;
  tick = setInterval(() => {
    for (const t of timers) if (!t.done && Date.now() >= t.end) { t.done = true; chime(); toast(`⏰ ${t.label} — time’s up`, 'ok'); }
    document.querySelectorAll('.ck-timer[data-id]').forEach(el => { const t = timers.find(x => x.id === el.dataset.id); if (t) { el.querySelector('b').textContent = t.done ? 'Done' : mmss(t.end - Date.now()); el.classList.toggle('done', t.done); } });
    if (!timers.some(t => !t.done) && !document.querySelector('.ck')) { clearInterval(tick); tick = null; }
  }, 500);
}
async function keepAwake(on) { try { if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); else { await lock?.release(); lock = null; } } catch {} }

/** Open cook mode for a recipe. opts: servings (default the recipe's), mealId (marks that meal cooked at the end). */
export function openCook(r, { servings = r.serves, mealId = '' } = {}) {
  document.querySelector('.ck')?.remove();
  const own = K.MACHINES.map(m => m[0]).filter(id => ctx.owned().includes(id));
  const machine = K.usable(r, own)[0] || null;
  let page = 0, portions = servings;
  const ticked = new Set();
  const total = () => r.steps.length + 1;   // page 0 = get ready
  const root = h('div', { class: 'ck', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Cooking ${r.title}` });
  const close = () => { root.remove(); keepAwake(false); document.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPop); };
  const onPop = () => close();
  const onKey = (e) => { if (e.key === 'Escape') { close(); e.preventDefault(); } else if (e.key === 'ArrowRight' || e.key === ' ') { go(1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); } };
  const go = (d) => { page = Math.max(0, Math.min(total(), page + d)); paint(); };
  let x0 = null; root.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); x0 = null; });
  const timerRow = (opts) => h('div', { class: 'ck-trow' }, opts.map(([label, m]) => h('button', { class: 'ck-tbtn', onClick: () => { startTimer(label, m); paint(); } }, `⏱ ${m < 1 ? `${Math.round(m * 60)} s` : `${+m.toFixed(1)} min`}`)));
  const running = () => timers.filter(t => !t.done || Date.now() - t.end < 60000);
  function paint() {
    const f = portions / (r.serves || 1);
    let body;
    if (page === 0) {
      body = [h('div', { class: 'ck-kick' }, 'Get ready'), h('h1', { class: 'ck-h' }, r.title),
        h('div', { class: 'ck-por' }, h('button', { class: 'ck-pm', 'aria-label': 'Fewer portions', onClick: () => { portions = Math.max(1, portions - 1); paint(); } }, '−'), h('b', {}, `${portions} portion${portions === 1 ? '' : 's'}`), h('button', { class: 'ck-pm', 'aria-label': 'More portions', onClick: () => { portions = Math.min(30, portions + 1); paint(); } }, '+')),
        machine ? h('div', { class: 'ck-mach' }, h('span', {}, K.machineIcon(machine[0])), h('div', {}, h('b', {}, `${K.machineName(machine[0])}: ${K.machineLine(machine[1])}`), machine[1].temp ? h('div', { class: 'ck-sm' }, `Preheat to ${machine[1].temp} °C now.`) : null)) : K.noCook(r) ? h('div', { class: 'ck-mach' }, h('span', {}, '🥄'), h('b', {}, 'No cooking needed')) : null,
        h('div', { class: 'ck-ings' }, r.ingredients.map((i, n) => { const si = K.scaleIng(i, f), on = ticked.has(n); return h('button', { class: `ck-ing ${on ? 'on' : ''}`, 'aria-pressed': String(on), onClick: () => { on ? ticked.delete(n) : ticked.add(n); paint(); } }, h('span', { class: 'ck-box' }, on ? '✓' : ''), h('span', {}, K.ingText(si))); }))];
    } else if (page <= r.steps.length) {
      const st = r.steps[page - 1], times = K.stepTimes(st), opts = times.map(m => [`Step ${page}`, m]);
      if (machine?.[1]?.mins && page === r.steps.findIndex(x => /cook|roast|bake|air|fry|until/i.test(x)) + 1 && !times.includes(machine[1].mins)) opts.unshift([`${K.machineName(machine[0])}`, machine[1].mins]);
      body = [h('div', { class: 'ck-kick' }, `Step ${page} of ${r.steps.length}`), h('div', { class: 'ck-step' }, st), opts.length ? timerRow(opts) : null,
        machine && page === 1 && machine[1].note ? h('div', { class: 'ck-sm' }, `${K.machineName(machine[0])}: ${machine[1].note}`) : null];
    } else {
      body = [h('div', { class: 'ck-kick' }, 'Done'), h('div', { class: 'ck-big' }, '🍋'), h('h1', { class: 'ck-h' }, 'Enjoy it'), h('div', { class: 'ck-sm' }, r.keeps ? `Keeps ${r.keeps} day${r.keeps === 1 ? '' : 's'} in the fridge — cool it within an hour.` : 'Best eaten fresh.'),
        h('button', { class: 'ck-go', onClick: () => { ctx.cooked(r, { portions, mealId }); close(); } }, mealId ? 'Cooked ✓ — update the plan' : 'Cooked ✓ — log it for today')];
    }
    const rn = running();
    root.replaceChildren(
      h('div', { class: 'ck-top' }, h('button', { class: 'ck-x', 'aria-label': 'Close cook mode', onClick: close }, '✕'), h('div', { class: 'ck-dots' }, Array.from({ length: total() + 1 }, (_, i) => h('i', { class: i === page ? 'on' : i < page ? 'past' : '' })))),
      h('div', { class: 'ck-body' }, ...body),
      rn.length ? h('div', { class: 'ck-timers' }, rn.map(t => h('button', { class: `ck-timer ${t.done ? 'done' : ''}`, 'data-id': t.id, title: 'Tap to stop', onClick: () => { timers.splice(timers.indexOf(t), 1); paint(); } }, h('span', {}, t.label), h('b', {}, t.done ? 'Done' : mmss(t.end - Date.now()))))) : null,
      h('div', { class: 'ck-nav' }, h('button', { class: 'ck-prev', disabled: page === 0, onClick: () => go(-1) }, '←'), page < total() ? h('button', { class: 'ck-next', onClick: () => go(1) }, page === 0 ? 'Start cooking →' : page === r.steps.length ? 'Finish →' : 'Next step →') : null));
  }
  document.body.append(root); paint(); keepAwake(true); ensureTick();
  document.addEventListener('keydown', onKey);
  // a sheet closing just before this steps history back; listen for Back only once that has settled
  setTimeout(() => { if (!root.isConnected) return; history.pushState({ ...(history.state || {}), cook: 1 }, ''); window.addEventListener('popstate', onPop, { once: true }); }, 350);
  setTimeout(() => root.querySelector('.ck-next')?.focus(), 50);
}
