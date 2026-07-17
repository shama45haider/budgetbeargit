/* Budget Bear — cash-flow projection and what-if simulation.
   Projects net savings position month by month. */

import { get } from "../store.js";
import { cashFlow } from "./metrics.js";

/**
 * Project the user's cash cushion over `months`.
 * scenario: { raisePct, extraSavings, purchase: {amount, month}, payoffDebt }
 */
export function project(months = 12, scenario = {}) {
  const s = get();
  const { income, expenses } = cashFlow();
  let cushion = s.settings.savingsBuffer || 0;

  const debtMonthly = s.debts.reduce((a, d) => a + d.minPayment, 0);
  let debtBalance = s.debts.reduce((a, d) => a + d.balance, 0);
  const avgApr = s.debts.length
    ? s.debts.reduce((a, d) => a + d.apr * d.balance, 0) / Math.max(1, debtBalance)
    : 0;

  const monthlyIncome = income * (1 + (scenario.raisePct || 0) / 100);
  const extra = scenario.extraSavings || 0;
  const payoffExtra = scenario.payoffExtra ?? 200;

  const values = [cushion];
  for (let m = 1; m <= months; m++) {
    let net = monthlyIncome - expenses + extra;

    // Minimum debt payments already sit inside `expenses`. Accelerating payoff
    // has two effects, and the cushion has to feel both of them — previously
    // debtBalance was decremented here and then never read, so the scenario
    // produced a line identical to the baseline.
    if (scenario.payoffDebt) {
      if (debtBalance > 0) {
        // Throwing extra at the debt is money you don't bank this month.
        const grown = debtBalance * (1 + avgApr / 100 / 12);
        debtBalance = Math.max(0, grown - (debtMonthly + payoffExtra));
        net -= payoffExtra;
      } else {
        // Debt's gone: the minimum payment is yours to keep from here on.
        net += debtMonthly;
      }
    }

    cushion += net;
    if (scenario.purchase && scenario.purchase.month === m) {
      cushion -= scenario.purchase.amount;
    }
    values.push(Math.round(cushion));
  }
  return values;
}

/** Month labels for a projection, sparse (every 3rd). */
export function projectionLabels(months = 12) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out = [];
  const d = new Date();
  for (let m = 0; m <= months; m++) {
    const dd = new Date(d.getFullYear(), d.getMonth() + m, 1);
    out.push(m % 3 === 0 ? MONTHS[dd.getMonth()] : "");
  }
  return out;
}

/** Debt payoff comparison: avalanche (highest APR first) vs snowball (smallest first). */
export function debtStrategies(extraPerMonth = 200) {
  const debts = get().debts.map((d) => ({ ...d }));
  if (!debts.length) return null;

  const run = (order) => {
    const list = debts.map((d) => ({ ...d })).sort(order);
    let months = 0;
    let interestPaid = 0;
    const totalMin = list.reduce((a, d) => a + d.minPayment, 0);
    while (list.some((d) => d.balance > 0) && months < 600) {
      months++;
      let extra = extraPerMonth;
      for (const d of list) {
        if (d.balance <= 0) continue;
        const interest = d.balance * (d.apr / 100 / 12);
        interestPaid += interest;
        d.balance += interest;
        let pay = Math.min(d.balance, d.minPayment);
        d.balance -= pay;
      }
      // extra goes to first unpaid debt in priority order
      for (const d of list) {
        if (d.balance <= 0 || extra <= 0) continue;
        const pay = Math.min(d.balance, extra);
        d.balance -= pay;
        extra -= pay;
      }
    }
    return { months, interestPaid: Math.round(interestPaid), totalMin };
  };

  return {
    avalanche: run((a, b) => b.apr - a.apr),
    snowball: run((a, b) => a.balance - b.balance),
    extraPerMonth,
  };
}
