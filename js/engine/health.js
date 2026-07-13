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
    { id: "savings", label: "Savings rate", score: savingsScore, weight: 0.22,
      detail: pctLabel(savingsRate) + " of income saved", target: "Aim for 20% of income" },
    { id: "debt", label: "Debt load", score: debtScore, weight: 0.18,
      detail: debt > 0 ? "Debt is " + pctLabel(debtRatio) + " of annual income" : "No tracked debt", target: "Keep debt under 25% of annual income" },
    { id: "cashflow", label: "Cash flow", score: flowScore, weight: 0.18,
      detail: free >= 0 ? "Income covers your plan" : "Plan exceeds income", target: "Spend less than you earn" },
    { id: "consistency", label: "Consistency", score: consistencyScore, weight: 0.14,
      detail: pctLabel(consistencyScore) + " of recent months on budget", target: "Stay under budget each month" },
    { id: "emergency", label: "Emergency fund", score: efScore, weight: 0.16,
      detail: efMonths.toFixed(1) + " months of essentials covered", target: "Build toward 3 months" },
    { id: "goals", label: "Goal progress", score: goalScore, weight: 0.12,
      detail: active.length ? active.length + " active goal" + (active.length > 1 ? "s" : "") + " in motion" : "No active goals yet", target: "Keep goals moving" },
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
