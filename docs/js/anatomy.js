// Car anatomy: the parts that matter for looking after a Camry 2016 (2.5 L), where they sit, what they do, what to check and the
// signs of trouble, each linked to its care items. Two original schematic drawings (under the bonnet from above, the whole car
// from the side); positions are approximate — the real layout can differ slightly by trim. Pure data + small helpers.

/** view: 'bay' (under the bonnet, from above; the front of the car at the top) or 'car' (side view; the front on the left). */
export const PARTS = [
  { id: 'engine', view: 'bay', x: 190, y: 120, icon: '🧠', name: 'Engine (2.5 L, 4 cylinders)', does: 'Burns 91 fuel to turn the wheels. Sits sideways across the bay; a timing chain inside (no belt to replace).', check: 'Listen at cold start: a short rattle that goes away is normal-ish; a constant knock is not.', warn: 'Check-engine light, rough idle, oil spots under the car.', care: ['oil', 'plugs'] },
  { id: 'oilcap', view: 'bay', x: 205, y: 96, icon: '🛢️', name: 'Oil filler cap', does: 'Where fresh oil goes in, on top of the engine. Marked with an oil-can symbol and “0W-20”.', check: 'Only top up 0W-20 (or 5W-20 short-term) — a little at a time, then re-check the dipstick.', warn: 'Milky goo under the cap can mean coolant in the oil (see a workshop).', care: ['oil'] },
  { id: 'dipstick', view: 'bay', x: 170, y: 148, icon: '📏', name: 'Oil dipstick (yellow loop)', does: 'Shows how much oil is in the engine.', check: 'Engine off 5 min on level ground: pull, wipe, push in fully, pull again. Between the two dots is good.', warn: 'Below the low dot, or oil black and gritty well before its change.', care: ['oil'] },
  { id: 'battery', view: 'bay', x: 92, y: 70, icon: '🔋', name: 'Battery', does: '12 V; starts the car and feeds the electrics when the engine is off.', check: 'White-blue crust on the terminals = clean it. The date code on the case tells its age.', warn: 'Slow cranking, dim lights at start, clicking. Heat kills it in 2–3 years.', care: ['battery', 'batteryNew'] },
  { id: 'fuses', view: 'bay', x: 92, y: 116, icon: '🔌', name: 'Fuse and relay box', does: 'Protects circuits (headlights, fans, AC). A second fuse box is under the dashboard, driver’s side.', check: 'The lid’s inside shows the map; spare fuses and a puller are inside.', warn: 'One thing dead (a light, the horn) while everything else works.', care: [] },
  { id: 'airbox', view: 'bay', x: 120, y: 172, icon: '🌬️', name: 'Engine air filter box', does: 'Cleans the air the engine breathes. Clips open by hand.', check: 'Hold the filter up to light: if you can’t see light through it, change it.', warn: 'Sluggish, thirstier — common after dusty months.', care: ['airFilter'] },
  { id: 'brakefluid', view: 'bay', x: 106, y: 222, icon: '💧', name: 'Brake fluid reservoir', does: 'Feeds the hydraulic brakes. Near the windscreen on the driver’s side.', check: 'Level between MIN and MAX; fluid should look light amber, not dark brown.', warn: 'Soft or long brake pedal; level dropping (pads worn or a leak).', care: ['brakeFluid', 'brakes'] },
  { id: 'coolant', view: 'bay', x: 280, y: 92, icon: '🌡️', name: 'Coolant reservoir', does: 'The see-through overflow tank of the cooling system. Toyota pink coolant.', check: 'Cold engine only: level between LOW and FULL. Never open the radiator cap hot.', warn: 'Temperature needle above the middle, sweet smell, pink crust on the engine.', care: ['coolant'] },
  { id: 'radiator', view: 'bay', x: 190, y: 28, icon: '🧊', name: 'Radiator and AC condenser', does: 'At the very front: the condenser (AC) in front of the radiator (engine), with electric fans behind.', check: 'Look through the grille: bugs and dust packed in the fins? A gentle hose from behind clears them.', warn: 'AC cooling poorly in traffic, engine running hot when idling.', care: ['coolant', 'ac'] },
  { id: 'washer', view: 'bay', x: 300, y: 50, icon: '🫧', name: 'Washer fluid', does: 'For the windscreen squirters; the cap has a windscreen symbol.', check: 'Top up with water plus washer concentrate; dust storms empty it fast.', warn: '—', care: ['wipers'] },
  { id: 'belt', view: 'bay', x: 288, y: 150, icon: '➰', name: 'Drive belt and water pump', does: 'One ribbed belt on the passenger-side end of the engine spins the alternator, AC compressor and water pump.', check: 'Cracks across the ribs, glazing; pink crust near the pump.', warn: 'Squeal on cold start or with AC on; coolant marks at this end.', care: ['belt', 'coolant'] },
  { id: 'alternator', view: 'bay', x: 262, y: 186, icon: '⚡', name: 'Alternator', does: 'Charges the battery while driving, driven by the belt.', check: 'Battery light on the dash while driving = charging fault.', warn: 'Lights dimming at idle, a new battery going flat again.', care: [] },
  { id: 'gearbox', view: 'bay', x: 140, y: 140, icon: '⚙️', name: 'Automatic gearbox (6-speed)', does: 'Under the air box, on the driver’s side end of the engine. No dipstick: fluid is checked by a workshop at a set temperature.', check: 'Watch for a shudder at 40–70 km/h on light throttle.', warn: 'Shudder, slipping, delayed engagement into D or R, red fluid spots.', care: ['atf'] },
  { id: 'cabinfilter', view: 'car', x: 150, y: 80, icon: '❄️', name: 'Cabin (AC) filter', does: 'Behind the glovebox: cleans the air from the vents.', check: 'Empty the glovebox, unclip its sides, slide the filter out — a 5-minute job.', warn: 'Weak airflow, musty smell, dust on the dashboard.', care: ['cabinFilter'] },
  { id: 'frontbrakes', view: 'car', x: 84, y: 128, icon: '🛑', name: 'Front brakes', does: 'Discs and pads do most of the stopping.', check: 'Through the wheel spokes: pad thickness against the disc.', warn: 'Squeal (wear indicator), grinding (metal on metal: stop and fix), pulling to one side.', care: ['brakes', 'brakeFluid'] },
  { id: 'tyres', view: 'car', x: 296, y: 140, icon: '🛞', name: 'Tyres', does: 'The only thing touching the road.', check: 'Pressure cold, monthly, to the door sticker. Tread above 1.6 mm. The 4-digit DOT date (week, year) on the sidewall.', warn: 'Cracks in the sidewall, a bulge, uneven wear on one edge (alignment).', care: ['tyrePressure', 'rotate', 'tyres'] },
  { id: 'suspension', view: 'car', x: 300, y: 104, icon: '🪀', name: 'Suspension and shocks', does: 'Springs and shock absorbers keep the tyres on the road.', check: 'Push down a corner hard: it should settle in one bounce.', warn: 'Clunks over bumps, floaty ride, one corner sitting low.', care: [] },
  { id: 'exhaust', view: 'car', x: 220, y: 150, icon: '💨', name: 'Exhaust and catalytic converter', does: 'Carries and cleans the exhaust; the converter sits near the engine.', check: 'Look for rust holes and hanging rubbers when the car is up for an oil change.', warn: 'Loud rumble, rattle from underneath, rotten-egg smell.', care: [] },
  { id: 'fueltank', view: 'car', x: 250, y: 126, icon: '⛽', name: 'Fuel tank', does: 'About 70 L, under the rear seat. Filler on the driver’s side.', check: 'Fill to the first click; topping off floods the vapour canister.', warn: 'Fuel smell, check-engine light after a fill (loose cap).', care: [] },
  { id: 'headlights', view: 'car', x: 30, y: 96, icon: '💡', name: 'Headlights', does: 'Halogen or LED by trim.', check: 'Yellowed lenses? Polish restores them; the sun is the cause.', warn: 'A bulb out, dim beam from cloudy lenses.', care: ['wash'] },
  { id: 'wipers', view: 'car', x: 118, y: 68, icon: '🌧️', name: 'Wipers', does: 'Lift them off the glass in summer parking to stop the rubber baking.', check: 'Streaks or chatter = new blades.', warn: 'Cracked rubber.', care: ['wipers'] },
  { id: 'obd', view: 'car', x: 132, y: 98, icon: '🔎', name: 'OBD-II port', does: 'Under the dashboard, driver’s side: a plug any cheap scanner can read codes from.', check: 'A Bluetooth OBD reader and a phone app tell you what a check-engine light means before the workshop does.', warn: '—', care: [] },
];
export const partsIn = (view) => PARTS.filter(p => p.view === view);
export const VIEWS = [['bay', 'Under the bonnet'], ['car', 'The whole car']];

/** A shuffled round of "Find it": n parts from one view, different every round. */
export function findRound(view, n = 6, rnd = Math.random) { const l = [...partsIn(view)]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l.slice(0, n); }

/** Original schematic drawings (SVG markup). Generic shapes, not a manufacturer's artwork. */
export function drawing(view) {
  if (view === 'bay') return `<svg viewBox="0 0 380 250" class="an-svg" role="img" aria-label="Under the bonnet, seen from above; the front of the car at the top">
  <defs><linearGradient id="anBay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--an-a)"/><stop offset="1" stop-color="var(--an-b)"/></linearGradient></defs>
  <path d="M40 10 H340 Q362 12 364 36 L370 200 Q368 236 336 242 H44 Q12 236 10 200 L16 36 Q18 12 40 10Z" fill="url(#anBay)" stroke="var(--an-line)" stroke-width="2"/>
  <rect x="70" y="16" width="240" height="26" rx="8" class="an-blk" /><path d="M80 22v14M96 22v14M112 22v14M128 22v14M144 22v14M160 22v14M176 22v14M192 22v14M208 22v14M224 22v14M240 22v14M256 22v14M272 22v14M288 22v14M300 22v14" class="an-fin"/>
  <rect x="146" y="76" width="118" height="92" rx="16" class="an-blk an-eng"/><circle cx="174" cy="96" r="6" class="an-bolt"/><circle cx="204" cy="96" r="6" class="an-bolt"/><circle cx="234" cy="96" r="6" class="an-bolt"/>
  <rect x="62" y="52" width="60" height="38" rx="7" class="an-blk an-bat"/><rect x="70" y="46" width="10" height="7" rx="2" class="an-blk"/><rect x="104" y="46" width="10" height="7" rx="2" class="an-blk"/>
  <rect x="66" y="100" width="54" height="30" rx="6" class="an-blk"/>
  <rect x="86" y="146" width="62" height="44" rx="12" class="an-blk"/><rect x="118" y="124" width="36" height="40" rx="8" class="an-blk an-gear"/>
  <rect x="90" y="208" width="32" height="22" rx="6" class="an-blk an-fluid"/>
  <rect x="262" y="74" width="38" height="40" rx="8" class="an-blk an-cool"/><rect x="282" y="36" width="44" height="28" rx="8" class="an-blk an-wash"/>
  <circle cx="288" cy="150" r="14" class="an-blk"/><circle cx="262" cy="186" r="12" class="an-blk"/><path d="M276 140 Q300 150 288 166 Q270 196 252 192 Q248 176 262 174" class="an-belt"/>
  <path d="M170 148 q-10 4 -4 14 q8 4 10 -6" class="an-dip"/>
  <rect x="26" y="232" width="328" height="8" rx="4" class="an-wall"/><text x="190" y="8" class="an-cap" text-anchor="middle">FRONT</text><text x="190" y="248" class="an-cap" text-anchor="middle">WINDSCREEN</text>
  ${partsIn('bay').map((p, i) => `<g class="an-hot" data-part="${p.id}" tabindex="0" role="button" aria-label="${p.name}"><circle cx="${p.x}" cy="${p.y}" r="13"/><text x="${p.x}" y="${p.y + 4.5}" text-anchor="middle">${i + 1}</text></g>`).join('')}
</svg>`;
  return `<svg viewBox="0 0 400 180" class="an-svg" role="img" aria-label="The whole car from the side; the front on the left">
  <defs><linearGradient id="anCar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--an-a)"/><stop offset="1" stop-color="var(--an-b)"/></linearGradient></defs>
  <path d="M14 120 Q12 96 40 90 L96 82 Q120 58 158 48 L238 46 Q276 50 306 80 L360 88 Q388 94 388 118 L386 132 Q384 140 372 140 H336 A36 36 0 0 0 264 140 H122 A36 36 0 0 0 50 140 H24 Q14 138 14 120Z" fill="url(#anCar)" stroke="var(--an-line)" stroke-width="2"/>
  <path d="M110 82 Q132 60 162 54 L200 53 L200 82Z M208 53 L240 53 Q268 56 290 82 L208 82Z" class="an-glass"/>
  <circle cx="86" cy="140" r="27" class="an-tyre"/><circle cx="86" cy="140" r="12" class="an-hub"/><circle cx="300" cy="140" r="27" class="an-tyre"/><circle cx="300" cy="140" r="12" class="an-hub"/>
  <path d="M120 150 H360" class="an-pipe"/><rect x="210" y="146" width="26" height="8" rx="4" class="an-blk"/><rect x="232" y="118" width="46" height="16" rx="5" class="an-blk an-fuel"/>
  <rect x="22" y="92" width="18" height="10" rx="3" class="an-light"/><rect x="372" y="98" width="12" height="10" rx="3" class="an-light an-rear"/>
  ${partsIn('car').map((p, i) => `<g class="an-hot" data-part="${p.id}" tabindex="0" role="button" aria-label="${p.name}"><circle cx="${p.x}" cy="${p.y}" r="12"/><text x="${p.x}" y="${p.y + 4.5}" text-anchor="middle">${i + 1}</text></g>`).join('')}
</svg>`;
}
