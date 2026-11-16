// Taking over the Home part of Citrus (pure). Calamansi reads My Apps/hub/citrus/state.json (or a Citrus backup file) once and
// copies what it now owns: the chores (with their last-done dates and any time already planned in your calendar) and the
// chore tombstones, so a chore you deleted in Citrus stays deleted. It never writes into Citrus's file; Citrus stops writing
// chores once Calamansi is live. Running it twice is harmless: the copy is merged record by record, newest edit wins.
import { mergeStates, sanitize } from './store.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const TAKE = ['chores'];
const TOMB = /^chore:/;

/** The Home part of a Citrus state, shaped as a Calamansi state. → {part, counts} (part is null when there is nothing to take). */
export function homePart(citrus) {
  if (!isObj(citrus)) return { part: null, counts: {} };
  const part = { updatedAt: +citrus.updatedAt || 0, stamps: {}, deleted: {}, settings: {} }, counts = {};
  for (const k of TAKE) if (isObj(citrus[k]) && Object.keys(citrus[k]).length) {
    const m = {};
    for (const [id, v] of Object.entries(citrus[k])) if (isObj(v) && (typeof v.title === 'string' || typeof v.title === 'number')) m[id] = { ...v, id, title: String(v.title), at: +v.at || +v.createdAt || 1, hist: Array.isArray(v.hist) ? v.hist : v.lastDone ? [v.lastDone] : [] };
    if (Object.keys(m).length) { part[k] = m; counts[k] = Object.keys(m).length; }
  }
  for (const [k, t] of Object.entries(citrus.deleted || {})) if (TOMB.test(k) && Number.isFinite(+t)) part.deleted[k] = +t;
  if (Number.isFinite(+citrus.settings?.alarmPlan)) { part.settings.alarmPlan = +citrus.settings.alarmPlan; counts.alarm = 1; }
  return { part: counts.chores ? sanitize(part) : null, counts };
}

/** Merge the Home part into this device's state. Local edits that are newer win; nothing local is lost. */
export function applyMigration(local, citrus, { source = 'citrus' } = {}) {
  const { part, counts } = homePart(citrus);
  if (!part) return { state: local, counts, changed: false };
  const settings = { ...(local.settings || {}) };
  if (part.settings.alarmPlan !== undefined && !local.stamps?.['set:alarmPlan']) settings.alarmPlan = part.settings.alarmPlan;
  const merged = mergeStates(local, { ...local, ...part, settings, stamps: { ...(local.stamps || {}) }, deleted: { ...(local.deleted || {}), ...part.deleted }, updatedAt: Math.max(local.updatedAt || 0, part.updatedAt) });
  merged.settings = { ...merged.settings, alarmPlan: settings.alarmPlan ?? merged.settings.alarmPlan };
  merged.migrated = { from: source, at: Date.now(), counts };
  return { state: merged, counts, changed: true };
}
/** "5 chores" for the confirmation and the toast. */
export function describe(counts) { const n = counts?.chores || 0; return n ? `${n} chore${n === 1 ? '' : 's'}` : 'no chores'; }
const CITRUS_ONLY = ['tasks', 'goals', 'plan', 'rotas', 'memos', 'media', 'notes', 'dayLog', 'habits', 'aims', 'study', 'swaps', 'friends'];
/** A backup that is not Calamansi's own: anything without app:"calamansi" that holds a Citrus-only key. */
export function looksLikeCitrus(j) { return isObj(j) && j.app !== 'calamansi' && (j.app === 'citrus' || CITRUS_ONLY.some(k => k in j)); }
