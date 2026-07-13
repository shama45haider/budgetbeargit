/* Budget Bear — plain-English insight generator.
   Turns the numbers into short, useful observations. */

import { get } from "../store.js";
import { money } from "../format.js";
import {
  spentThisMonth, spentInMonth, lastMonthKeys, dailyAllowance,
  subscriptions, flexibleRemaining, cashFlow,
} from "./metrics.js";
import { goalStats } from "./goals.js";

/** All current insights, ranked. type: win | watch | idea */
export function insights() {
  const s = get();
  const out = [];
  const dayOfMonth = new Date().getDate();
  const monthProgress = dayOfMonth / 30.44;

  // --- Category pace: over/under budget relative to how far through the month we are
  for (const cat of s.budget.categories) {
    if (cat.id === "savings" || !cat.limit) continue;
    const spent = spentThisMonth(cat.id);
    const expected = cat.limit * monthProgress;
    if (spent > cat.limit) {
      out.push({
        type: "watch", weight: 10,
        text: `${cat.name} is ${money(spent - cat.limit)} over budget this month.`,
        detail: `You've spent ${money(spent)} of a ${money(cat.limit)} budget.`,
      });
    } else if (!cat.essential && dayOfMonth >= 8 && spent > expected * 1.35 && spent > 40) {
      out.push({
        type: "watch", weight: 7,
        text: `${cat.name} spending is running ahead of pace.`,
        detail: `${money(spent)} so far — at this rate you'd end the month around ${money((spent / monthProgress))}.`,
      });
    } else if (dayOfMonth >= 15 && spent < expected * 0.65 && cat.limit >= 80 && !cat.essential) {
      out.push({
        type: "win", weight: 5,
        text: `You're well under your ${cat.name.toLowerCase()} budget.`,
        detail: `${money(spent)} spent vs about ${money(expected)} expected by now.`,
      });
    }
  }

  // --- Goals
  for (const g of s.goals.filter((g) => !g.completedAt)) {
    const st = goalStats(g);
    if (st.complete) continue;
    if (st.risk === "low" && st.completion > 0.15 && st.months) {
      out.push({
        type: "win", weight: 6,
        text: `${g.name} is on schedule.`,
        detail: `${Math.round(st.completion * 100)}% funded with ${Math.round(st.months)} months to go.`,
      });
    } else if (st.risk === "high") {
      out.push({
        type: "watch", weight: 9,
        text: `${g.name} needs attention.`,
        detail: st.nextAction,
      });
    }
  }

  // --- Savings opportunity from dining/discretionary
  const dining = s.budget.categories.find((c) => c.id === "dining");
  if (dining && dining.limit >= 100) {
    const weekly = 25;
    out.push({
      type: "idea", weight: 4,
      text: `Reducing dining out by ${money(weekly)}/week saves ${money(weekly * 52)}/year.`,
      detail: `Small consistent cuts add up faster than one-time savings.`,
    });
  }

  // --- Subscriptions
  const subs = subscriptions();
  if (subs.monthly > 0) {
    out.push({
      type: "idea", weight: subs.monthly > 60 ? 6 : 3,
      text: `Subscriptions cost you ${money(subs.monthly)}/month — ${money(subs.monthly * 12)}/year.`,
      detail: subs.bills.length + " recurring services. Worth a quick audit.",
    });
  }

  // --- Month over month trend
  const keys = lastMonthKeys(2);
  const prev = spentInMonth(keys[0]);
  const curr = spentThisMonth();
  if (prev > 0 && dayOfMonth >= 20) {
    const projected = curr / monthProgress;
    if (projected < prev * 0.93) {
      out.push({
        type: "win", weight: 6,
        text: `Spending is trending ${money(prev - projected)} lower than last month.`,
        detail: `Projected ${money(projected)} vs ${money(prev)} last month.`,
      });
    }
  }

  // --- Cash flow guard
  const { free, income } = cashFlow();
  if (free < 0) {
    out.push({
      type: "watch", weight: 10,
      text: `Your plan allocates ${money(-free)} more than you earn.`,
      detail: "Trim category budgets or adjust savings so the plan balances.",
    });
  } else if (income > 0 && free > income * 0.12) {
    out.push({
      type: "idea", weight: 5,
      text: `${money(free)}/month is unallocated.`,
      detail: "Putting it toward your top goal would speed it up meaningfully.",
    });
  }

  // --- Daily allowance nudge
  const da = dailyAllowance();
  if (da.monthRemaining > 0 && da.leftToday === 0 && da.spentToday > 0) {
    out.push({
      type: "watch", weight: 5,
      text: "You've used today's flexible spending.",
      detail: `Tomorrow resets to about ${money(da.perDay)}.`,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/** Single best recommendation for the Home screen. */
export function topRecommendation() {
  const list = insights();
  return list[0] || {
    type: "win",
    text: "Everything looks steady today.",
    detail: "No urgent actions. A quick check-in keeps your streak alive.",
  };
}
