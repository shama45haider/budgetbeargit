/* Budget Bear — goal math: progress, required saving, ETA, risk, next action. */

import { get } from "../store.js";
import { monthsUntil, money, WEEKS_PER_MONTH, todayISO, parseISO } from "../format.js";
import { cashFlow, savingsPlanned } from "./metrics.js";

/* ---------- Cadence: optional daily/weekly savings pace + streak ----------
   A goal may carry `cadence: { type: "day"|"week", amount }`. We track progress
   within the current period (`cadenceProgress` under `cadencePeriodKey`), the
   last period whose target was met (`lastMetPeriodKey`), and a running
   `cadenceStreak`. Keeping the math here (not in the screen) means Home, the
   goal card, and the contribute flow all agree. */

function isoOf(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Canonical key for the period an ISO date falls in: the date itself for
    "day", or the Monday of that week for "week". */
export function periodKey(iso, type) {
  if (type === "day") return iso;
  const d = parseISO(iso);
  const mondayOffset = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - mondayOffset);
  return isoOf(d);
}

function prevPeriodKey(key, type) {
  const d = parseISO(key);
  d.setDate(d.getDate() - (type === "day" ? 1 : 7));
  return isoOf(d);
}

/** Live cadence view for display (does not mutate). Streak reads as broken
    unless the last met period is the current or the immediately previous one. */
export function cadenceState(goal) {
  if (!goal.cadence || !(goal.cadence.amount > 0)) return null;
  const { type, amount } = goal.cadence;
  const curKey = periodKey(todayISO(), type);
  const progress = goal.cadencePeriodKey === curKey ? (goal.cadenceProgress || 0) : 0;
  const lastMet = goal.lastMetPeriodKey || null;
  let streak = goal.cadenceStreak || 0;
  if (lastMet !== curKey && lastMet !== prevPeriodKey(curKey, type)) streak = 0;
  return {
    type,
    target: amount,
    progress,
    remaining: Math.max(0, amount - progress),
    streak,
    metThisPeriod: lastMet === curKey,
    unit: type === "day" ? "today" : "this week",
  };
}

/** Apply a contribution to a goal's cadence tracking (mutates the passed goal,
    which is expected to be the store draft inside update()). Returns true if
    this contribution is what tipped the current period over its target. */
export function applyCadenceContribution(goal, amount) {
  if (!goal.cadence || !(goal.cadence.amount > 0)) return false;
  const { type, amount: target } = goal.cadence;
  const curKey = periodKey(todayISO(), type);
  if (goal.cadencePeriodKey !== curKey) {
    goal.cadencePeriodKey = curKey;
    goal.cadenceProgress = 0;
  }
  goal.cadenceProgress = Math.round(((goal.cadenceProgress || 0) + amount) * 100) / 100;
  if (goal.cadenceProgress >= target && goal.lastMetPeriodKey !== curKey) {
    const prev = prevPeriodKey(curKey, type);
    goal.cadenceStreak = (goal.lastMetPeriodKey === prev ? (goal.cadenceStreak || 0) : 0) + 1;
    goal.lastMetPeriodKey = curKey;
    goal.lastCadenceMet = todayISO();
    return true;
  }
  return false;
}

export function goalStats(goal) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const completion = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  const complete = !!goal.completedAt || (goal.target > 0 && goal.saved >= goal.target);

  const months = goal.deadline ? Math.max(0.25, monthsUntil(goal.deadline)) : null;
  const requiredMonthly = months ? remaining / months : null;

  // Money realistically available for goals each month
  const plannedSavings = savingsPlanned();
  const { free } = cashFlow();
  const capacity = Math.max(0, plannedSavings + Math.max(0, free));

  // How many active goals compete for that capacity
  const activeGoals = get().goals.filter((g) => !g.completedAt && g.saved < g.target).length || 1;
  const share = capacity / activeGoals;

  // ETA at current realistic pace
  const pace = share > 0 ? share : plannedSavings / activeGoals;
  const etaMonths = pace > 0 ? remaining / pace : Infinity;

  let risk = "low";
  if (complete) risk = "none";
  else if (!months) risk = etaMonths > 24 ? "medium" : "low";
  else if (requiredMonthly > capacity) risk = "high";
  else if (requiredMonthly > share * 1.25) risk = "medium";

  const cadence = cadenceState(goal);

  let nextAction;
  if (complete) {
    nextAction = "Goal complete. Consider starting your next one.";
  } else if (cadence) {
    // A set pace is the primary signal when present.
    const Unit = cadence.type === "day" ? "Today" : "This week";
    if (cadence.metThisPeriod) {
      nextAction = cadence.streak > 1
        ? `${Unit}'s ${money(cadence.target)} is in — ${cadence.streak} in a row. 🔥`
        : `${Unit}'s ${money(cadence.target)} is in. Nice work.`;
    } else {
      nextAction = cadence.streak > 0
        ? `Save ${money(cadence.remaining)} ${cadence.unit} to keep your ${cadence.streak}-streak alive.`
        : `Save ${money(cadence.remaining)} ${cadence.unit} to start a streak.`;
    }
  } else if (risk === "high") {
    nextAction = months
      ? `Needs ${money(requiredMonthly)}/mo — more than you can put away right now. Push the date back or spend a little less on fun money.`
      : "Set a deadline so Budget Bear can pace this goal for you.";
  } else if (requiredMonthly) {
    const perWeek = requiredMonthly / WEEKS_PER_MONTH;
    nextAction = `Save ${money(perWeek)} this week to stay on schedule.`;
  } else {
    nextAction = `Set aside ${money(Math.max(25, share))} this month to keep momentum.`;
  }

  return {
    remaining,
    completion,
    complete,
    months,
    requiredMonthly,
    etaMonths: isFinite(etaMonths) ? etaMonths : null,
    risk,
    nextAction,
    monthlyCapacity: capacity,
    fairShare: share,
    cadence,
  };
}

export function etaLabel(etaMonths) {
  if (etaMonths == null) return "—";
  if (etaMonths < 1) return "under a month";
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(etaMonths));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export const RISK_LABEL = {
  none: { text: "Complete", cls: "t-pos" },
  low: { text: "On track", cls: "t-pos" },
  medium: { text: "Cutting it close", cls: "" },
  high: { text: "At risk", cls: "t-neg" },
};
