/* Budget Bear — State layer over localStorage.
   Versioned schema, defaults, and a tiny pub/sub so screens re-render on change. */

const VERSION = 1;
const KEY = "bb.data.v" + VERSION;

const defaults = () => ({
  version: VERSION,
  profile: {
    name: "",
    currency: "$",
    paySchedule: "monthly", // weekly | biweekly | semimonthly | monthly
    onboarded: false,
    demo: false,
    createdAt: null,
  },
  income: { monthly: 0 },
  budget: {
    // categories: id, name, icon, limit (monthly), essential
    categories: [],
  },
  transactions: [], // { id, categoryId, amount, note, date }
  bills: [],        // { id, name, amount, dueDay, icon, autopay }
  goals: [],        // { id, name, icon, target, saved, deadline, priority, createdAt, completedAt }
  debts: [],        // { id, name, balance, apr, minPayment }
  habits: {
    lastCheckIn: null,   // ISO date of last daily review
    checkIns: [],        // ISO dates
  },
  points: {
    balance: 0,
    streak: 0,
    bestStreak: 0,
    history: [],         // { id, reason, amount, date }
  },
  achievements: {
    unlocked: {},        // { [id]: isoDate }
  },
  settings: {
    savingsBuffer: 0,    // current cash savings on hand
  },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    // Shallow-merge each top-level section over defaults so new fields appear
    const base = defaults();
    for (const k of Object.keys(base)) {
      if (parsed[k] !== undefined) {
        base[k] = typeof base[k] === "object" && !Array.isArray(base[k])
          ? { ...base[k], ...parsed[k] }
          : parsed[k];
      }
    }
    return base;
  } catch {
    return defaults();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full or unavailable — keep going in memory */ }
}

export function get() {
  return state;
}

/** Apply a mutation function and notify listeners. */
export function update(fn) {
  fn(state);
  persist();
  for (const l of listeners) l(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetAll() {
  state = defaults();
  persist();
  for (const l of listeners) l(state);
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text); // throws on invalid
  if (!parsed || typeof parsed !== "object" || !parsed.profile) {
    throw new Error("Not a Budget Bear backup file");
  }
  state = parsed;
  persist();
  for (const l of listeners) l(state);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
