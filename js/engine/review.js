/* Budget Bear — weekly review generator: wins, watch-outs, trends, next week's priorities. */

import { get } from "../store.js";
import { money, todayISO, parseISO, WEEKS_PER_MONTH } from "../format.js";
import { spentThisMonth, flexibleRemaining, upcomingBills } from "./metrics.js";
import { goalStats } from "./goals.js";
import { insights } from "./insights.js";

function lastNDaysSpend(n, offset = 0) {
  const today = parseISO(todayISO());
  let total = 0;
  for (const t of get().transactions) {
    if (t.categoryId === "savings") continue;
    const d = parseISO(t.date);
    const diff = Math.round((today - d) / 86400000);
    if (diff >= offset && diff < offset + n) total += t.amount;
  }
  return total;
}

export function weeklyReview() {
  const s = get();
  const thisWeek = lastNDaysSpend(7);
  const lastWeek = lastNDaysSpend(7, 7);
  const delta = thisWeek - lastWeek;

  const wins = [];
  const watch = [];

  if (lastWeek > 0 && delta < -10) {
    wins.push(`You spent ${money(-delta)} less than the week before.`);
  } else if (lastWeek > 0 && delta > 25) {
    watch.push(`Spending rose ${money(delta)} vs the previous week (${money(thisWeek)} total).`);
  }

  const checkedThisWeek = s.habits.checkIns.filter((c) => {
    const diff = (parseISO(todayISO()) - parseISO(c)) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;
  if (checkedThisWeek >= 5) wins.push(`${checkedThisWeek} daily check-ins this week — strong consistency.`);
  else if (checkedThisWeek >= 1) wins.push(`${checkedThisWeek} check-in${checkedThisWeek > 1 ? "s" : ""} this week. Aim for five next week.`);

  for (const g of s.goals.filter((g) => !g.completedAt)) {
    const st = goalStats(g);
    if (st.risk === "low" && st.completion > 0.1) {
      wins.push(`${g.name}: ${Math.round(st.completion * 100)}% funded and on pace.`);
      break;
    }
  }
  for (const g of s.goals.filter((g) => !g.completedAt)) {
    const st = goalStats(g);
    if (st.risk === "high") { watch.push(`${g.name} is at risk — ${st.nextAction}`); break; }
  }

  const flex = flexibleRemaining();
  if (flex.remaining < 0) watch.push(`Fun money is ${money(-flex.remaining)} over plan this month.`);

  // Trends: top 3 categories this month
  const byCat = s.budget.categories
    .filter((c) => c.id !== "savings")
    .map((c) => ({ name: c.name, spent: spentThisMonth(c.id) }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  // Priorities for next week
  const priorities = [];
  const bills = upcomingBills(7);
  if (bills.length) {
    const total = bills.reduce((a, b) => a + b.amount, 0);
    priorities.push(`${bills.length} bill${bills.length > 1 ? "s" : ""} due (${money(total)}) — make sure funds are ready.`);
  }
  const topInsight = insights().find((i) => i.type !== "win");
  if (topInsight) priorities.push(topInsight.text);
  const activeGoal = s.goals.find((g) => !g.completedAt);
  if (activeGoal) {
    const st = goalStats(activeGoal);
    if (!st.complete && st.requiredMonthly) {
      priorities.push(`Put ${money(st.requiredMonthly / WEEKS_PER_MONTH)} toward ${activeGoal.name}.`);
    }
  }
  if (!priorities.length) priorities.push("Keep your daily check-in streak going.");

  return {
    thisWeek, lastWeek, delta,
    wins: wins.slice(0, 3),
    watch: watch.slice(0, 3),
    topCategories: byCat,
    priorities: priorities.slice(0, 3),
  };
}
