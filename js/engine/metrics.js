/* Budget Bear — shared financial computations used by every engine and screen. */

import { get } from "../store.js";
import { todayISO, parseISO, daysInMonth, daysLeftInMonth } from "../format.js";

export function monthKey(iso) {
  return iso.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayISO());
}

/** Total spent this month, optionally for one category. Savings excluded from "spending". */
export function spentThisMonth(categoryId = null, { includeSavings = false } = {}) {
  const mk = currentMonthKey();
  return get().transactions
    .filter((t) => monthKey(t.date) === mk)
    .filter((t) => (categoryId ? t.categoryId === categoryId : true))
    .filter((t) => includeSavings || t.categoryId !== "savings")
    .reduce((a, t) => a + t.amount, 0);
}

export function spentInMonth(mk, categoryId = null) {
  return get().transactions
    .filter((t) => monthKey(t.date) === mk && (categoryId ? t.categoryId === categoryId : true))
    .filter((t) => t.categoryId !== "savings")
    .reduce((a, t) => a + t.amount, 0);
}

/** Last n month keys, oldest first, including current. */
export function lastMonthKeys(n) {
  const keys = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0"));
  }
  return keys;
}

export function totalBudgetLimit({ includeSavings = false } = {}) {
  return get().budget.categories
    .filter((c) => includeSavings || c.id !== "savings")
    .reduce((a, c) => a + c.limit, 0);
}

export function savingsPlanned() {
  return get().budget.categories.find((c) => c.id === "savings")?.limit || 0;
}

/** Bills due within next `days` days (rolls into next month). */
export function upcomingBills(days = 7) {
  const now = new Date();
  const today = now.getDate();
  const dim = daysInMonth(now);
  const out = [];
  for (const b of get().bills) {
    let diff = b.dueDay - today;
    if (diff < 0) diff += dim; // next month's occurrence
    if (diff <= days) {
      const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      const iso = due.getFullYear() + "-" + String(due.getMonth() + 1).padStart(2, "0") + "-" + String(due.getDate()).padStart(2, "0");
      out.push({ ...b, dueDate: iso, inDays: diff });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

export function billsMonthlyTotal() {
  return get().bills.reduce((a, b) => a + b.amount, 0);
}

export function subscriptions() {
  const subCat = get().budget.categories.find((c) => c.id === "subscriptions");
  const subBills = get().bills.filter((b) =>
    ["📺", "🎵", "🌐", "📱"].includes(b.icon) || /stream|music|tv|netflix|spotify|prime|hulu|disney|cloud|app/i.test(b.name));
  return { bills: subBills, monthly: subBills.reduce((a, b) => a + b.amount, 0), budget: subCat?.limit || 0 };
}

/** Money that can still be spent on flexible categories this month. */
export function flexibleRemaining() {
  const s = get();
  const flexCats = s.budget.categories.filter((c) => !c.essential && c.id !== "savings");
  const limit = flexCats.reduce((a, c) => a + c.limit, 0);
  const spent = flexCats.reduce((a, c) => a + spentThisMonth(c.id), 0);
  return { limit, spent, remaining: limit - spent };
}

/** Daily allowance = flexible money remaining ÷ days left in month.
    `remaining` already excludes today's flexible spend, so the daily figure is
    derived from `remaining + spentToday` (the day's budget before today
    happened); `leftToday = perDay − spentToday` then subtracts today's spend
    exactly once. (Dividing `remaining` directly and *also* subtracting
    spentToday double-counted the day's spending.) */
export function dailyAllowance() {
  const { remaining } = flexibleRemaining();
  const days = daysLeftInMonth();
  const spentToday = get().transactions
    .filter((t) => t.date === todayISO())
    .filter((t) => {
      const cat = get().budget.categories.find((c) => c.id === t.categoryId);
      return cat && !cat.essential && cat.id !== "savings";
    })
    .reduce((a, t) => a + t.amount, 0);
  const perDay = (remaining + spentToday) / days;
  return {
    perDay: Math.max(0, perDay),
    leftToday: Math.max(0, perDay - spentToday),
    spentToday,
    daysLeft: days,
    monthRemaining: remaining,
  };
}

/** Planned monthly cash flow: income − budget (incl. savings treated as allocation). */
export function cashFlow() {
  const income = get().income.monthly;
  const expenses = totalBudgetLimit();      // non-savings budget
  const savings = savingsPlanned();
  return {
    income,
    expenses,
    savings,
    free: income - expenses - savings,      // unallocated
    net: income - expenses,                 // before savings allocation
  };
}

export function totalDebt() {
  return get().debts.reduce((a, d) => a + d.balance, 0);
}

export function totalGoalSaved() {
  return get().goals.reduce((a, g) => a + g.saved, 0);
}

export function emergencyFundMonths() {
  const s = get();
  const essentials = s.budget.categories
    .filter((c) => c.essential && c.id !== "savings")
    .reduce((a, c) => a + c.limit, 0);
  const cushion = (s.settings.savingsBuffer || 0);
  if (!essentials) return 0;
  return cushion / essentials;
}

/** Budget consistency: fraction of the last 3 closed months where spending ≤ budget. */
export function budgetConsistency() {
  const keys = lastMonthKeys(4).slice(0, 3); // exclude current
  const limit = totalBudgetLimit();
  if (!limit) return 0;
  let months = 0, onTrack = 0;
  for (const k of keys) {
    const spent = spentInMonth(k);
    if (spent === 0) continue; // no data that month
    months++;
    if (spent <= limit * 1.02) onTrack++;
  }
  return months ? onTrack / months : 0.5;
}
