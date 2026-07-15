/* Budget Bear — financial health score.
   Weighted 0–100 across six factors, with an educational breakdown. */

import { get } from "../store.js";
import {
  cashFlow, totalDebt, emergencyFundMonths, budgetConsistency,
} from "./metrics.js";
import { goalStats } from "./goals.js";

export function healthScore() {
  const s = get();
  const { income, free, savings } = cashFlow();

  // 1. Savings rate (planned savings ÷ income) — target 20%
  const savingsRate = income > 0 ? savings / income : 0;
  const savingsScore = clamp01(savingsRate / 0.2);

  // 2. Debt load (monthly debt payments + balance vs income) — lower is better
  const debt = totalDebt();
  const annualIncome = income * 12;
  const debtRatio = annualIncome > 0 ? debt / annualIncome : 1;
  const debtScore = clamp01(1 - debtRatio / 0.5); // 50%+ of annual income = 0

  // 3. Cash flow (unallocated income ÷ income) — breathing room
  const flowScore = income > 0 ? clamp01(0.5 + free / income / 0.2) : 0;

  // 4. Budget consistency over recent months
  const consistencyScore = budgetConsistency();

  // 5. Emergency fund — target 3 months of essentials
  const efMonths = emergencyFundMonths();
  const efScore = clamp01(efMonths / 3);

  // 6. Goal progress — average completion of active goals
  const active = s.goals.filter((g) => !g.completedAt);
  const goalScore = active.length
    ? active.reduce((a, g) => a + goalStats(g).completion, 0) / active.length
    : 0.5;

  const factors = [
    { id: "savings", label: "How much you save", info: "saving-rate", score: savingsScore, weight: 0.22,
      detail: "You keep " + pctLabel(savingsRate) + " of what you make", target: "Try to keep 20 cents of every dollar" },
    { id: "debt", label: "What you owe", info: "what-you-owe", score: debtScore, weight: 0.18,
      detail: debt > 0 ? "You owe " + pctLabel(debtRatio) + " of a year's pay" : "You don't owe anything", target: "Keep it under a quarter of a year's pay" },
    { id: "cashflow", label: "Money in vs. out", info: "money-in-out", score: flowScore, weight: 0.18,
      detail: free >= 0 ? "You make more than your plan spends" : "Your plan spends more than you make", target: "Make more than you spend" },
    { id: "consistency", label: "Sticking to your plan", info: "sticking-to-plan", score: consistencyScore, weight: 0.14,
      detail: "On budget " + pctLabel(consistencyScore) + " of recent months", target: "Stay under budget each month" },
    { id: "emergency", label: "Rainy-day fund", info: "rainy-day", score: efScore, weight: 0.16,
      detail: efMonths.toFixed(1) + " months of must-pays saved up", target: "Build toward 3 months" },
    { id: "goals", label: "Goal progress", info: "goal-progress", score: goalScore, weight: 0.12,
      detail: active.length ? active.length + " goal" + (active.length > 1 ? "s" : "") + " moving forward" : "No goals started yet", target: "Keep goals moving" },
  ];

  const score = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0) * 100);

  const sorted = [...factors].sort((a, b) => b.score - a.score);
  return {
    score,
    grade: gradeOf(score),
    factors,
    strengths: sorted.filter((f) => f.score >= 0.7).slice(0, 2),
    improvements: sorted.filter((f) => f.score < 0.7).slice(-2).reverse(),
  };
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }
function pctLabel(n) { return Math.round(n * 100) + "%"; }

function gradeOf(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Steady";
  if (score >= 40) return "Building";
  return "Needs attention";
}
