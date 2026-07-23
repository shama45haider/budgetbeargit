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
    cloudLastSyncedAt: null, // ISO timestamp, Premium cloud budget sync only
  },
});

let state = load();
const listeners = new Set();

/** Merge a parsed blob over defaults, section by section, so that every
    top-level key exists and has the right shape no matter what came in.
    Screens read `s.achievements.unlocked` etc. directly — a missing or
    wrong-typed section is an instant TypeError on render. */
function merge(parsed) {
  const base = defaults();
  if (!parsed || typeof parsed !== "object") return base;
  for (const k of Object.keys(base)) {
    const incoming = parsed[k];
    if (incoming === undefined || incoming === null) continue;
    if (Array.isArray(base[k])) {
      if (Array.isArray(incoming)) base[k] = incoming;      // never let an object become an array
    } else if (typeof base[k] === "object") {
      if (typeof incoming === "object" && !Array.isArray(incoming)) base[k] = { ...base[k], ...incoming };
    } else {
      if (typeof incoming === typeof base[k]) base[k] = incoming;
    }
  }
  return base;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return merge(JSON.parse(raw));
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
  // Through the same merge as load(): a file with only some sections (or with a
  // section of the wrong type) used to be stored verbatim, and the very next
  // render threw on the missing keys — leaving the app bricked until a reload.
  state = merge(parsed);
  persist();
  for (const l of listeners) l(state);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
