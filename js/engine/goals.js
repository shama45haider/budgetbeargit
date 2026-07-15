/* Budget Bear — goal math: progress, required saving, ETA, risk, next action. */

import { get } from "../store.js";
import { monthsUntil, money } from "../format.js";
import { cashFlow, savingsPlanned } from "./metrics.js";

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

  let nextAction;
  if (complete) {
    nextAction = "Goal complete. Consider starting your next one.";
  } else if (risk === "high") {
    nextAction = months
      ? `Needs ${money(requiredMonthly)}/mo — more than you can put away right now. Push the date back or spend a little less on fun money.`
      : "Set a deadline so Budget Bear can pace this goal for you.";
  } else if (requiredMonthly) {
    const perWeek = requiredMonthly / 4.345;
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
