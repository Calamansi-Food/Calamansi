// Car insurance + identity, pure (no DOM): read a Saudi motor policy's text (from its PDF or pasted), decode a VIN, and the
// numbers to call. Only car and policy fields are kept — never the holder's name, ID, date of birth or address.
// Text from a PDF arrives with Arabic words in reverse order and some letters dropped, so Arabic cues are single words.

export const INSURERS = [
  ['Al Rajhi Takaful', /al\s*rajhi\s*takaful|alrajhitakaful|تكافل الراجحي|الراجحي تكافل/i],
  ['Tawuniya', /tawuniya|التعاونية/i], ['Walaa', /walaa|ولاء/i], ['Malath', /malath|ملاذ/i], ['MedGulf', /medgulf|ميدغلف/i],
  ['Salama', /salama|سلامة/i], ['GIG Saudi', /\bgig\b|axa cooperative/i], ['Allianz Saudi Fransi', /allianz/i], ['SAICO', /saico/i],
  ['Arabian Shield', /arabian shield|الدرع العربي/i], ['Buruj', /buruj|بروج/i], ['Gulf Union Alahlia', /gulf union/i], ['ACIG', /\bacig\b/i],
  ['Amana', /amana insurance/i], ['Wataniya', /wataniya|الوطنية/i], ['United Cooperative (UCA)', /united cooperative|\buca\b/i],
  ['Al Etihad', /al.?etihad/i], ['Chubb Arabia', /chubb/i], ['Liva', /\bliva\b/i], ['Saudi Enaya', /enaya|عناية/i],
];

// Najm handles every accident where a car is insured (stc's emergency list; Najm's unified line 199033, WhatsApp 920000560).
export const CALLS = [
  ['Najm (accidents, insured cars)', '199033', '🚔'], ['Najm WhatsApp', '920000560', '💬'], ['Traffic police', '993', '🚓'],
  ['Ambulance', '997', '🚑'], ['Unified emergency', '911', '🆘'], ['Road security (highways)', '996', '🛣️'],
];
export const ACCIDENT_STEPS = [
  ['Make it safe', 'Hazard lights on, triangle out, everyone away from traffic. If anyone is hurt, call 997 or 911 first.'],
  ['Photograph everything', 'Both cars from all sides, the plates, the damage close up, the road and any signs — before the cars move.'],
  ['Report it', 'Call Najm (199033) or use the Najm app if any car involved is insured. In cities where Najm doesn’t cover, call the traffic police (993).'],
  ['Wait for the report', 'Don’t agree who is at fault on the spot. Najm’s report decides it; you get the case number by SMS.'],
  ['Claim', 'If the other driver was at fault, their insurer pays (claim within the time your insurer gives). If it was you, your third-party policy pays the other car — your own car is only covered by a comprehensive policy.'],
];

const AR = /[؀-ۿ]/;
const has = (t, ...words) => words.some(w => t.includes(w));
const num = (s) => { const n = parseFloat(String(s).replace(/,/g, '')); return isFinite(n) ? n : null; };
const key = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const okDate = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100 && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;
const dayN = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 864e5;

/** Every date in the text, each in every reading it can have (1/2/2027 could be 1 Feb or 2 Jan). */
export function datesIn(text) {
  const out = [];
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) if (okDate(+m[1], +m[2], +m[3])) out.push([key(+m[1], +m[2], +m[3])]);
  for (const m of text.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/g)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], a = +m[1], b = +m[2], opts = [];
    if (okDate(y, b, a)) opts.push(key(y, b, a));                // dd/mm
    if (a !== b && okDate(y, a, b)) opts.push(key(y, a, b));     // mm/dd
    if (opts.length) out.push(opts);
  }
  return out;
}
/** The policy period: two dates about a year apart (end = start + 1 year − 1 day, give or take). The latest such pair wins. */
export function periodIn(text) {
  const all = [...new Set(datesIn(text).flat())].sort();
  let best = null;
  for (const s of all) for (const e of all) { const gap = dayN(e) - dayN(s); if (gap >= 358 && gap <= 368 && (!best || e > best.end)) best = { start: s, end: e }; }
  return best;
}

/** What a motor policy says, from its text. Unknown fields stay empty; nothing about the person is kept. */
export function parsePolicy(raw) {
  const t = String(raw || '').normalize('NFKC').replace(/[‎‏‪-‮]/g, '');
  const lower = t.toLowerCase(), out = { found: [] };
  const company = INSURERS.find(([, re]) => re.test(t)); if (company) { out.company = company[0]; out.found.push('insurer'); }
  const pol = /policy\s*(?:no\.?|number|#)\s*[:(]?\s*([A-Z0-9][A-Z0-9\-/]{5,40})/i.exec(t) || /\b(P\d{3,}-[A-Z0-9\-/]{6,40})/.exec(t);
  if (pol) { out.policy = pol[1].replace(/[).,]+$/, ''); out.found.push('policy number'); }
  // cover: "تأمين ضد الغير" (against others) = third party; "شامل" alone is ambiguous ("غير شامل ضريبة" = VAT not included)
  if (/comprehensive/i.test(t) || has(t, 'تأمين شامل', 'شامل تأمين', 'التأمين الشامل', 'الشامل التأمين')) out.kind = 'comp';
  else if (/third[\s-]*party|\btpl\b/i.test(t) || (has(t, 'الغير') && has(t, 'ضد'))) out.kind = 'third';
  if (out.kind) out.found.push('cover');
  const rep = /(outside\s+agency[^\n؀-ۿ]{0,20}|agency\s+repair|workshop\s+repair|dealer(?:ship)?\s+repair)/i.exec(t);
  if (rep) { out.repair = rep[1].trim().replace(/\s+/g, ' ').replace(/[\s\-–]+$/, ''); out.found.push('repair'); }
  const ded = /deductible[^\d\n]{0,60}([\d,]+(?:\.\d+)?)/i.exec(t) || /(?:التحمل|لمحتلا)[^\d\n]{0,40}([\d,]+(?:\.\d+)?)/.exec(t) || /([\d,]+(?:\.\d+)?)[^\d\n]{0,40}(?:التحمل)/.exec(t);
  if (ded && num(ded[1]) !== null) { out.deductible = num(ded[1]); out.found.push('deductible'); }
  const prem = /total\s+(?:premium|amount|payable)[^\d\n]{0,40}([\d,]+\.\d\d)/i.exec(t) || /إجمالي[^\n]*?([\d,]+\.\d\d)/.exec(t) || /([\d,]+\.\d\d)[^\d\n]*إجمالي/.exec(t);
  if (prem && num(prem[1])) { out.premium = num(prem[1]); out.found.push('premium'); }
  const per = periodIn(t); if (per) { out.start = per.start; out.end = per.end; out.found.push('dates'); }
  const ph = /\b(800\s?\d{3}\s?\d{4}|9200\s?\d{5}|8001\s?\d{3}\s?\d{3})\b/.exec(t); if (ph) { out.phone = ph[1].replace(/\s+/g, ' '); out.found.push('helpline'); }
  const lim = /(\d+)\s*(?:million|مليون|مليين|ملايين)/i.exec(t) || /(?:million|مليون|مليين|ملايين)\s*(\d+)/i.exec(t);
  if (lim && +lim[1] > 0 && +lim[1] < 100) out.limit = `Up to ${lim[1]} million SAR for damage to others`;
  // roadside extras
  const perks = [];
  const tow = /(?:السحب|towing)[^\d\n]{0,25}(\d{2,3})/i.exec(t) || /(\d{2,3})[^\d\n]{0,25}(?:السحب|towing)/i.exec(t);
  if (has(t, 'سحب', 'السحب') || /towing/i.test(t)) perks.push(tow ? `Towing up to ${tow[1]} km` : 'Towing');
  if (has(t, 'البطارية', 'بطارية') || /battery\s+(?:boost|jump)/i.test(t)) perks.push('Battery jump-start');
  if (has(t, 'الوقود') || /fuel\s+delivery/i.test(t)) perks.push('Fuel delivery (you pay the fuel)');
  if (has(t, 'الإطار', 'الطار', 'الاطار') || /(?:tyre|tire)\s+change/i.test(t)) perks.push('Flat tyre change');
  if (has(t, 'تاكسي') || /taxi/i.test(t)) perks.push('Taxi home after an accident');
  if (has(t, 'الولء', 'الولاء') || /loyalty/i.test(t)) perks.push('Loyalty discount if renewed before it ends');
  if (has(t, 'مطالبات') || /no[\s-]claims?/i.test(t)) perks.push('No-claims discount');
  if (perks.length) { out.perks = perks; out.found.push('extras'); }
  // the car on it
  const vin = /\b([A-HJ-NPR-Z0-9]{17})\b/.exec(t.toUpperCase()); if (vin && vinInfo(vin[1]).ok) { out.vin = vin[1]; out.found.push('VIN'); }
  // plate: digits + up to 3 Arabic letters on the "plate number" line. PDF text has Arabic words reversed ("الغير ضد" for
  // "ضد الغير"), so the letters are put back in reading order then.
  const reversed = has(t, 'الغير ضد', 'له المؤمن');
  const plateLine = t.split('\n').find(l => /plate\s*(?:number|no)/i.test(l) || has(l, 'اللوحة', 'االلوحة'));
  const pm = plateLine && /(\d{1,4})\s+((?:[\u0621-\u064a]\s){0,2}[\u0621-\u064a])(?![\u0621-\u064a])/.exec(plateLine);
  if (pm) { const letters = [...pm[2].replace(/\s/g, '')]; out.plate = `${(reversed ? letters.reverse() : letters).join(' ')} ${pm[1]}`; out.found.push('plate'); }
  const make = /\b(TOYOTA|LEXUS|HYUNDAI|KIA|NISSAN|HONDA|CHEVROLET|FORD|GMC|MAZDA|MITSUBISHI|ISUZU|SUZUKI|MERCEDES|BMW|AUDI|VOLKSWAGEN|GEELY|CHANGAN|MG)\b/i.exec(t);
  const model = make && new RegExp(`\\b(CAMRY|COROLLA|YARIS|LAND CRUISER|HILUX|RAV4|AVALON|PRADO|FORTUNER|SONATA|ELANTRA|ACCENT|TUCSON|ALTIMA|SUNNY|PATROL|ACCORD|CIVIC|TAHOE|YUKON)\\b`, 'i').exec(t);
  if (make) out.make = make[1][0] + make[1].slice(1).toLowerCase();
  if (model) out.modelName = model[1].split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
  const yr = /(?:manufactur\w*|model)\s*year[^\d]{0,10}(20\d\d|19\d\d)/i.exec(t) || /\b(20[0-3]\d|19[89]\d)\s+(?:sedan|suv|hatchback|pickup|coupe)/i.exec(t) || /(?:sedan|suv|hatchback|pickup)\s+(20[0-3]\d)/i.exec(t);
  if (yr) out.year = +yr[1]; else if (out.vin) out.year = vinInfo(out.vin).year || undefined;
  return out;
}

// ───────────── VIN: world maker (first 3), check digit (9th), model year (10th)
const YEAR = 'ABCDEFGHJKLMNPRSTVWXY123456789';   // 1980…2009, then repeats from 2010 (A = 1980 / 2010)
const WMI = { JT: 'Toyota, Japan', '4T': 'Toyota, USA', '5T': 'Toyota, USA', '6T1': 'Toyota, Australia (Altona)', '2T': 'Toyota, Canada', MR0: 'Toyota, Thailand', MHF: 'Toyota, Indonesia', JTM: 'Toyota, Japan',
  KMH: 'Hyundai, Korea', KNA: 'Kia, Korea', JN: 'Nissan, Japan', JH: 'Honda, Japan', '1G': 'GM, USA', '1F': 'Ford, USA', WDD: 'Mercedes-Benz, Germany', WBA: 'BMW, Germany', JM: 'Mazda, Japan', LS: 'China' };
const VAL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
const WEIGHT = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
export function vinInfo(v, nowYear = new Date().getFullYear()) {
  const vin = String(v || '').toUpperCase().replace(/\s/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { ok: false };
  const maker = WMI[vin.slice(0, 3)] || WMI[vin.slice(0, 2)] || '';
  const sum = [...vin].reduce((a, ch, i) => a + (/\d/.test(ch) ? +ch : VAL[ch] || 0) * WEIGHT[i], 0), cd = sum % 11 === 10 ? 'X' : String(sum % 11);
  const yi = YEAR.indexOf(vin[9]); let year = null;
  if (yi >= 0) { year = 1980 + yi; while (year + 30 <= nowYear + 1) year += 30; }
  return { ok: true, vin, maker, year, check: cd === vin[8], serial: vin.slice(11), plant: vin[10] };
}
