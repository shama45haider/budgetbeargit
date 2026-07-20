/* Budget Bear — the AI Coach engine.
   A deterministic financial-analysis engine with an advisor's voice.
   Every answer is computed from the user's real numbers and shows its reasoning. */

import { get } from "../store.js";
import { money, esc, monthLabel, WEEKS_PER_MONTH } from "../format.js";
import {
  dailyAllowance, upcomingBills, cashFlow, flexibleRemaining,
  subscriptions, spentThisMonth, totalDebt, emergencyFundMonths,
} from "./metrics.js";
import { goalStats, etaLabel } from "./goals.js";
import { debtStrategies, project } from "./forecast.js";
import { healthScore } from "./health.js";
import { insights } from "./insights.js";

/* ---------- Public API ---------- */

/** Plain-text summary of the user's real numbers, sent as context to the real AI.
    No secrets here — same data the deterministic answers below already use. */
export function buildContext() {
  const s = get();
  const da = dailyAllowance();
  const flex = flexibleRemaining();
  const { income, free } = cashFlow();
  const bills = upcomingBills(14);
  const health = healthScore();
  const goals = s.goals.filter((g) => !g.completedAt);
  const debt = totalDebt();
  const cushion = s.settings.savingsBuffer || 0;

  const lines = [
    `Name: ${s.profile.name || "the user"}`,
    `Monthly income: ${money(income)}`,
    `Left to spend today (fun money): ${money(da.leftToday)}`,
    `Fun money left this month: ${money(Math.max(0, flex.remaining))}`,
    `Money left over each month after the plan: ${money(free)}`,
    `Savings cushion on hand: ${money(cushion)}`,
    `Total debt: ${money(debt)}`,
    `Bills due in the next 14 days: ${money(bills.reduce((a, b) => a + b.amount, 0))}`,
    `Money health score: ${health.score}/100 (${health.grade})`,
  ];
  if (goals.length) {
    lines.push("Active goals:");
    for (const g of goals.slice(0, 5)) {
      const st = goalStats(g);
      lines.push(`  - ${g.name}: ${money(g.saved)} of ${money(g.target)} (${Math.round(st.completion * 100)}%), ${st.nextAction}`);
    }
  } else {
    lines.push("Active goals: none yet");
  }
  return lines.join("\n");
}

/** Returns { html, chips? } — a rendered answer plus follow-up suggestions. */
export function ask(rawText) {
  const text = rawText.trim().toLowerCase();

  const amount = extractAmount(text);

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(text)) return greetingAnswer();
  if (/afford|should i (buy|get|spend)|can i (buy|get|spend)/.test(text)) return affordAnswer(text, amount);
  if (/(want|plan|planning|save|saving) .*(house|home)|buy a house|buy a home/.test(text)) return planAnswer("a house", amount || 60000, 0.2);
  if (/(want|plan|planning) to (buy|save|get)|i want|help me save|new goal|start saving/.test(text)) return planGeneric(text, amount);
  if (/debt|pay ?off|credit card|loan|avalanche|snowball/.test(text)) return debtAnswer();
  if (/subscription|recurring|streaming/.test(text)) return subsAnswer();
  if (/where.*money|spending|spent|biggest expense|break ?down/.test(text)) return spendingAnswer();
  if (/save more|cut|reduce|lower my/.test(text)) return saveMoreAnswer();
  if (/emergency/.test(text)) return emergencyAnswer();
  if (/health|score|how am i doing|doing ok|doing well|on track/.test(text)) return healthAnswer();
  if (/forecast|future|project|next (6|six|12|twelve)|year from now/.test(text)) return forecastAnswer();
  if (/goal/.test(text)) return goalsAnswer();
  if (amount) return affordAnswer(text, amount);

  return fallbackAnswer();
}

export const starterChips = [
  "Can I afford $400 right now?",
  "I want to buy a house",
  "How am I doing?",
  "Where is my money going?",
  "Help me pay off debt",
  "How can I save more?",
];

/* ---------- Helpers ---------- */

function extractAmount(text) {
  const m = text.replace(/,/g, "").match(/\$?\s?(\d+(?:\.\d{1,2})?)\s*(k\b)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2]) n *= 1000;
  return n >= 1 ? n : null;
}

function block(title, rows) {
  return `<div class="coach-block">
    ${title ? `<div class="coach-block-title">${title}</div>` : ""}
    ${rows.map(([k, v]) => `<div class="coach-row"><span>${k}</span><strong class="t-num">${v}</strong></div>`).join("")}
  </div>`;
}

function reasoning(items) {
  return `<div class="coach-reasoning">
    <div class="coach-block-title">Why</div>
    <ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>
  </div>`;
}

function verdict(kind, text) {
  // kind: yes | caution | no
  const cls = kind === "yes" ? "v-yes" : kind === "no" ? "v-no" : "v-caution";
  const label = kind === "yes" ? "Yes, comfortably" : kind === "no" ? "Not right now" : "Yes, with care";
  return `<div class="coach-verdict ${cls}"><span class="dot"></span>${text || label}</div>`;
}

/* ---------- Answers ---------- */

function greetingAnswer() {
  const name = get().profile.name;
  const da = dailyAllowance();
  return {
    html: `<p>${name ? `Hi ${esc(name)}. ` : "Hi. "}I'm your financial coach — I work from your actual numbers, not generic advice.</p>
      <p style="margin-top:8px">Today you have about <strong>${money(da.leftToday)}</strong> of fun money left today. Ask me anything below.</p>`,
    chips: starterChips,
  };
}

function affordAnswer(text, amount) {
  if (!amount) {
    return {
      html: `<p>Tell me the amount and I'll walk through whether it fits — for example, <em>"Can I afford $250?"</em></p>`,
      chips: ["Can I afford $100?", "Can I afford $400?", "Can I afford $1,500?"],
    };
  }
  const da = dailyAllowance();
  const flex = flexibleRemaining();
  const bills = upcomingBills(14);
  const billTotal = bills.reduce((a, b) => a + b.amount, 0);
  const cushion = get().settings.savingsBuffer || 0;
  const goals = get().goals.filter((g) => !g.completedAt);
  const topGoal = goals[0];

  const why = [];
  let kind;

  if (amount <= da.leftToday) {
    kind = "yes";
    why.push(`It fits inside today's fun money (${money(da.leftToday)}).`);
    why.push(`Your ${money(billTotal)} of bills due in the next 14 days are already accounted for.`);
  } else if (amount <= flex.remaining) {
    kind = "caution";
    why.push(`It's more than today's fun money (${money(da.leftToday)}), but it fits in the ${money(flex.remaining)} of fun money left this month.`);
    why.push(`Spending it means about ${money(Math.max(0, (flex.remaining - amount) / da.daysLeft))}/day for the rest of the month, down from ${money(da.perDay)}.`);
    if (billTotal > 0) why.push(`Bills due soon (${money(billTotal)}) are covered by your essential budget, so they're not at risk.`);
  } else if (amount <= cushion * 0.25 && cushion > 0) {
    kind = "caution";
    why.push(`It's more than the fun money you have left this month (${money(Math.max(0, flex.remaining))}).`);
    why.push(`You could cover it from savings (${money(cushion)} on hand), using ${Math.round((amount / cushion) * 100)}% of your cushion.`);
    if (topGoal) {
      const st = goalStats(topGoal);
      why.push(`That's roughly ${(amount / Math.max(1, st.fairShare)).toFixed(1)} months of progress on ${esc(topGoal.name)}.`);
    }
  } else {
    kind = "no";
    why.push(`It's bigger than the fun money you have left this month (${money(Math.max(0, flex.remaining))}).`);
    if (cushion > 0) why.push(`It would consume ${Math.round((amount / cushion) * 100)}% of your ${money(cushion)} savings cushion — too much for a discretionary purchase.`);
    else why.push(`You don't have a savings cushion to absorb it yet.`);
    why.push(`A safer path: set aside ${money(amount / 3)}/month and buy it in 3 months without touching your plan.`);
  }

  return {
    html: `
      ${verdict(kind, kind === "yes" ? `Yes — ${money(amount)} fits comfortably` : kind === "caution" ? `${money(amount)} is doable, with trade-offs` : `${money(amount)} doesn't fit right now`)}
      ${block("Your position", [
        ["Left today", money(da.leftToday)],
        ["Fun money left this month", money(Math.max(0, flex.remaining))],
        ["Bills next 14 days", money(billTotal)],
        ["Savings cushion", money(cushion)],
      ])}
      ${reasoning(why)}`,
    chips: ["How can I save more?", "Show my forecast", topGoal ? `How is ${topGoal.name} doing?` : "Help me set a goal"],
  };
}

function planAnswer(thing, target, downPct = null) {
  const s = get();
  const { free } = cashFlow();
  const plannedSavings = s.budget.categories.find((c) => c.id === "savings")?.limit || 0;
  const capacity = Math.max(50, plannedSavings + Math.max(0, free));
  const efMonths = emergencyFundMonths();
  const debt = totalDebt();

  const goalAmount = downPct ? target * downPct : target;
  const months = Math.ceil(goalAmount / capacity);
  const eta = new Date();
  eta.setMonth(eta.getMonth() + months);

  const why = [
    `Your plan can realistically put ${money(capacity)}/month toward this (planned savings ${money(plannedSavings)}${free > 0 ? ` + ${money(free)} left over each month` : ""}).`,
    downPct ? `For ${thing} around ${money(target)}, a ${Math.round(downPct * 100)}% down payment is ${money(goalAmount)} — that's the real savings target.` : `Target amount: ${money(goalAmount)}.`,
    `${money(goalAmount)} ÷ ${money(capacity)}/month ≈ ${months} months.`,
  ];
  const steps = [];
  if (efMonths < 3) {
    steps.push(`<strong>First:</strong> your emergency fund covers ${efMonths.toFixed(1)} months of essentials. Get it to 3 months before aggressive saving — it protects the plan.`);
  }
  if (debt > 0) {
    const highApr = s.debts.filter((d) => d.apr >= 10);
    if (highApr.length) {
      steps.push(`<strong>In parallel:</strong> pay down high-interest debt (${highApr.map((d) => esc(d.name)).join(", ")}). Interest above 10% outpaces most savings.`);
    }
  }
  steps.push(`<strong>Monthly:</strong> auto-transfer ${money(capacity)} on payday, before it can be spent.`);
  steps.push(`<strong>Weekly:</strong> that's ${money(capacity / WEEKS_PER_MONTH)}/week — check progress each Sunday.`);
  steps.push(`<strong>Milestones:</strong> 25% by ${milestone(months, 0.25)}, 50% by ${milestone(months, 0.5)}, done around ${eta.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`);

  return {
    html: `
      <p>Here's a realistic roadmap for ${esc(thing)}.</p>
      ${block("The plan", [
        ["Savings target", money(goalAmount)],
        ["Monthly amount", money(capacity)],
        ["Timeline", months + " months"],
        ["Projected finish", eta.toLocaleDateString("en-US", { month: "short", year: "numeric" })],
      ])}
      <div class="coach-reasoning"><div class="coach-block-title">Roadmap</div>
        <ul>${steps.map((s2) => `<li>${s2}</li>`).join("")}</ul></div>
      ${reasoning(why)}
      <p class="t-small t-secondary" style="margin-top:10px">Create it as a goal from the Goals tab and I'll track the pace for you.</p>`,
    chips: ["Create this goal", "Show my forecast", "How can I save more?"],
  };
}

function milestone(totalMonths, frac) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(totalMonths * frac));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function planGeneric(text, amount) {
  const things = [
    [/car/, "a car", 25000],
    [/wedding/, "a wedding", 20000],
    [/vacation|trip|travel/, "a vacation", 3000],
    [/business/, "a business", 10000],
    [/laptop|computer|phone/, "new tech", 1500],
    [/emergency/, "an emergency fund", null],
  ];
  for (const [re, label, def] of things) {
    if (re.test(text)) {
      if (label === "an emergency fund") return emergencyAnswer();
      return planAnswer(label, amount || def);
    }
  }
  return planAnswer("your goal", amount || 5000);
}

function debtAnswer() {
  const s = get();
  if (!s.debts.length) {
    return {
      html: `<p>You don't have any debts tracked. If you carry a balance anywhere, add it in your Profile and I'll build a payoff strategy with real numbers.</p>`,
      chips: ["How am I doing?", "How can I save more?"],
    };
  }
  const extra = 200;
  const st = debtStrategies(extra);
  const totalBal = totalDebt();
  const why = [
    `<strong>Avalanche</strong> (highest interest first): debt-free in ${st.avalanche.months} months, ${money(st.avalanche.interestPaid)} total interest.`,
    `<strong>Snowball</strong> (smallest balance first): ${st.snowball.months} months, ${money(st.snowball.interestPaid)} interest — ${money(st.snowball.interestPaid - st.avalanche.interestPaid)} more, but quicker early wins.`,
    `Both assume minimums plus ${money(extra)}/month extra. Every extra ${money(50)}/month shortens the timeline meaningfully.`,
  ];
  const rows = s.debts.map((d) => [esc(d.name), `${money(d.balance)} @ ${d.apr}%`]);
  return {
    html: `
      <p>You're carrying <strong>${money(totalBal)}</strong> across ${s.debts.length} account${s.debts.length > 1 ? "s" : ""}. My recommendation: <strong>avalanche</strong> — it's mathematically cheapest.</p>
      ${block("Your debts", rows)}
      ${reasoning(why)}`,
    chips: ["Show my forecast", "How can I save more?", "How am I doing?"],
  };
}

function subsAnswer() {
  const subs = subscriptions();
  if (!subs.bills.length) {
    return { html: `<p>No recurring subscriptions found in your bills. If you add them under Budget → Bills, I'll watch the total for you.</p>`, chips: starterChips.slice(0, 3) };
  }
  const rows = subs.bills.map((b) => [esc(b.name), money(b.amount) + "/mo"]);
  return {
    html: `
      <p>Your subscriptions total <strong>${money(subs.monthly)}/month</strong> — that's <strong>${money(subs.monthly * 12)}/year</strong>.</p>
      ${block("Recurring services", rows)}
      ${reasoning([
        `The test for each: did you use it in the last two weeks? If not, pause it.`,
        `Cancelling even one ${money(12)}/month service frees ${money(144)}/year for your goals.`,
      ])}`,
    chips: ["How can I save more?", "Where is my money going?"],
  };
}

function spendingAnswer() {
  const s = get();
  const cats = s.budget.categories
    .filter((c) => c.id !== "savings")
    .map((c) => ({ ...c, spent: spentThisMonth(c.id) }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const total = cats.reduce((a, c) => a + c.spent, 0);
  if (!total) {
    return { html: `<p>No spending logged yet this month. Add a transaction from the Budget tab and I'll start spotting patterns.</p>`, chips: starterChips.slice(0, 3) };
  }
  const rows = cats.slice(0, 5).map((c) => [`${c.icon} ${esc(c.name)}`, `${money(c.spent)} <span class="t-secondary t-small">(${Math.round((c.spent / total) * 100)}%)</span>`]);
  const biggestFlex = cats.find((c) => !c.essential);
  const why = [
    `Total spent so far in ${monthLabel()}: ${money(total)}.`,
    `${esc(cats[0].name)} is your largest area at ${Math.round((cats[0].spent / total) * 100)}% of spending.`,
  ];
  if (biggestFlex) why.push(`${esc(biggestFlex.name)} is your biggest want-not-need area — cutting there shows up fastest.`);
  return {
    html: `${block("This month", rows)}${reasoning(why)}`,
    chips: ["How can I save more?", "Subscriptions check", "How am I doing?"],
  };
}

function saveMoreAnswer() {
  const s = get();
  const ideas = [];
  const subs = subscriptions();
  const dining = s.budget.categories.find((c) => c.id === "dining");
  const shopping = s.budget.categories.find((c) => c.id === "shopping");
  const { free } = cashFlow();

  if (free > 20) ideas.push(`You have <strong>${money(free)} a month left over</strong> with no job yet. Point it at your top goal — it's the easiest win because nothing about your life has to change.`);
  if (subs.monthly > 30) ideas.push(`Audit subscriptions (${money(subs.monthly)}/mo). Cutting a third saves about ${money(subs.monthly * 4)}/year.`);
  if (dining?.limit >= 150) ideas.push(`Trim dining out by ${money(25)}/week — that's ${money(1300)}/year without cutting it entirely.`);
  if (shopping?.limit >= 100) ideas.push(`Try a 48-hour rule on shopping over ${money(50)}: if you still want it two days later, buy it.`);
  ideas.push(`Move savings to payday. Money that leaves checking first never gets spent.`);

  return {
    html: `
      <p>Ranked by impact-for-effort, based on your actual budget:</p>
      <div class="coach-reasoning"><ul>${ideas.slice(0, 4).map((i) => `<li>${i}</li>`).join("")}</ul></div>`,
    chips: ["Can I afford $200?", "Show my forecast", "Subscriptions check"],
  };
}

function emergencyAnswer() {
  const s = get();
  const months = emergencyFundMonths();
  const essentials = s.budget.categories.filter((c) => c.essential && c.id !== "savings").reduce((a, c) => a + c.limit, 0);
  const target = essentials * 3;
  const have = s.settings.savingsBuffer || 0;
  const gap = Math.max(0, target - have);
  const plannedSavings = s.budget.categories.find((c) => c.id === "savings")?.limit || 100;
  return {
    html: `
      ${verdict(months >= 3 ? "yes" : months >= 1.5 ? "caution" : "no",
        months >= 3 ? "Your emergency fund is solid" : `You're at ${months.toFixed(1)} of 3 months`)}
      ${block("Emergency fund", [
        ["Must-pays each month", money(essentials)],
        ["3-month target", money(target)],
        ["You have", money(have)],
        ["Gap", money(gap)],
      ])}
      ${reasoning([
        `Three months of must-pays (${money(essentials)}/mo) keeps you safe if your income stops for a while.`,
        gap > 0
          ? `At your planned ${money(plannedSavings)}/month savings pace, you'd close the gap in about ${Math.ceil(gap / plannedSavings)} months.`
          : `You've hit the 3-month benchmark — extra savings can now go toward goals or investments.`,
      ])}`,
    chips: ["How can I save more?", "How am I doing?"],
  };
}

function healthAnswer() {
  const h = healthScore();
  const rows = h.factors.map((f) => [f.label, `<span class="${f.score >= 0.7 ? "t-pos" : f.score < 0.4 ? "t-neg" : ""}">${Math.round(f.score * 100)}</span>`]);
  return {
    html: `
      <p>Your financial health score is <strong>${h.score}/100 — ${h.grade}</strong>.</p>
      ${block("Factor scores", rows)}
      ${reasoning([
        ...h.strengths.map((f) => `<strong>Strength:</strong> ${f.label.toLowerCase()} — ${f.detail}.`),
        ...h.improvements.map((f) => `<strong>To improve:</strong> ${f.label.toLowerCase()} — ${f.detail}. ${f.target}.`),
      ])}`,
    chips: ["How can I save more?", "Show my forecast", "Help me pay off debt"],
  };
}

function forecastAnswer() {
  const base = project(12);
  const end = base[base.length - 1];
  const start = base[0];
  const withExtra = project(12, { extraSavings: 100 });
  return {
    html: `
      ${block("12-month projection", [
        ["Cushion today", money(start)],
        ["Projected in 12 months", money(end)],
        ["Monthly trend", money((end - start) / 12, { sign: true })],
        ["With +$100/mo saved", money(withExtra[withExtra.length - 1])],
      ])}
      ${reasoning([
        `Based on your income minus your planned budget, compounded monthly.`,
        end > start
          ? `You're building about ${money((end - start) / 12)}/month. The Insights tab has the full timeline with what-if simulations.`
          : `Your plan currently loses ground each month — adjusting budgets would change this line's direction.`,
      ])}`,
    chips: ["How can I save more?", "How am I doing?"],
  };
}

function goalsAnswer() {
  const goals = get().goals.filter((g) => !g.completedAt);
  if (!goals.length) {
    return { html: `<p>No active goals yet. Tell me what you're saving for — say <em>"I want to buy a car"</em> — and I'll build the plan.</p>`, chips: ["I want to buy a house", "I want a vacation", "Emergency fund plan"] };
  }
  const rows = goals.map((g) => {
    const st = goalStats(g);
    return [`${g.icon} ${esc(g.name)}`, `${Math.round(st.completion * 100)}% · ${etaLabel(st.etaMonths)}`];
  });
  const first = goalStats(goals[0]);
  return {
    html: `${block("Active goals", rows)}${reasoning([
      `ETAs assume your realistic monthly capacity of ${money(first.monthlyCapacity)} split across ${goals.length} goal${goals.length > 1 ? "s" : ""}.`,
      first.nextAction,
    ])}`,
    chips: ["How can I save more?", "Show my forecast"],
  };
}

function fallbackAnswer() {
  const top = insights()[0];
  return {
    html: `<p>I can help with affordability, goal planning, debt payoff, subscriptions, and spending analysis.</p>
      ${top ? `<p style="margin-top:8px">One thing worth knowing right now: ${esc(top.text)}</p>` : ""}`,
    chips: starterChips,
  };
}
