/* Budget Bear — Insights: observations, health breakdown, trends, timeline simulator, weekly review. */

import { get } from "../store.js";
import { money, esc, moneyShort } from "../format.js";
import { insights } from "../engine/insights.js";
import { healthScore } from "../engine/health.js";
import { weeklyReview } from "../engine/review.js";
import { project, projectionLabels, debtStrategies } from "../engine/forecast.js";
import { lastMonthKeys, spentInMonth, spentThisMonth } from "../engine/metrics.js";
import { ring, animateNumbers, openSheet } from "../ui/components.js";
import { bars, lineChart, chartColors } from "../ui/chart.js";
import { infoDot, bindInfoDots, demoBannerHTML, bindDemoBanner } from "../data/glossary.js";
import { houseAdHTML, bindHouseAd } from "../ui/houseAd.js";
import { premiumActive, upsell } from "../ui/premium.js";

const scenarioState = { raise: false, extra: false, purchase: false, payoff: false };

export function renderInsights(view) {
  const list = insights();
  const health = healthScore();
  const keys = lastMonthKeys(6);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthItems = keys.map((k, i) => {
    const isCurrent = i === keys.length - 1;
    return {
      label: MONTHS[parseInt(k.slice(5), 10) - 1],
      value: isCurrent ? spentThisMonth() : spentInMonth(k),
      highlight: isCurrent,
    };
  }).filter((m) => m.value > 0 || m.highlight);

  view.innerHTML = `
  <div class="screen">
    ${demoBannerHTML()}
    <header class="screen-header">
      <h1>Insights</h1>
      <span class="sub">Plain English, real numbers</span>
    </header>

    <button class="btn btn-secondary btn-block" id="btn-review" style="margin-bottom:16px">This week's review</button>

    <div class="stack">
      ${list.slice(0, 5).map(insightCard).join("") || `
        <div class="empty-state">
          <img src="assets/bears/confusedbear.webp" alt="">
          <h3>Not enough data yet</h3>
          <p>Add a few expenses and insights will appear here.</p>
        </div>`}
    </div>

    ${monthItems.length > 1 ? `
      <h2 class="section-title">Monthly spending</h2>
      <div class="card">${bars(monthItems)}</div>` : ""}

    <h2 class="section-title">Your money health ${infoDot("health-score")}</h2>
    <div class="card">
      <div class="row" style="margin-bottom:14px">
        ${ring({ size: 84, stroke: 8, value: health.score / 100, labelHTML: `<strong class="t-num" style="font-size:1.2rem">${health.score}</strong>` })}
        <div class="grow">
          <h3>${health.grade}</h3>
          <div class="t-small t-secondary">Six things we look at, added up.</div>
        </div>
      </div>
      <div class="stack" style="--gap:8px">
        ${health.factors.map((f) => `
          <div>
            <div class="row" style="margin-bottom:4px">
              <span class="t-small grow">${f.label}</span>
              <span class="t-small t-secondary">${esc(f.detail)}</span>
            </div>
            <div class="progress" style="height:5px"><i style="width:${Math.round(f.score * 100)}%"></i></div>
          </div>`).join("")}
      </div>
    </div>

    <h2 class="section-title">Your money future ${infoDot("timeline")}</h2>
    ${premiumActive() ? `
    <div class="card">
      <div class="t-small t-secondary" style="margin-bottom:10px">Where your savings could be in a year. Tap a "what if?" to see how it changes.</div>
      <div id="timeline-chart">${timelineChart()}</div>
      <div class="chip-row" style="margin-top:12px" id="scenario-chips">
        <button class="chip" data-sc="raise" aria-pressed="${scenarioState.raise}">What if I get a raise?</button>
        <button class="chip" data-sc="extra" aria-pressed="${scenarioState.extra}">Save $150 more</button>
        <button class="chip" data-sc="purchase" aria-pressed="${scenarioState.purchase}">Buy something big ($2k)</button>
        <button class="chip" data-sc="payoff" aria-pressed="${scenarioState.payoff}">Pay off debt faster</button>
      </div>
      <div class="t-small" id="timeline-summary" style="margin-top:10px">${timelineSummary()}</div>
    </div>
    ${debtPlanCard()}` : premiumTeaser()}

    ${houseAdHTML(0)}
  </div>`;

  animateNumbers(view);
  bindInfoDots(view);
  bindDemoBanner(view);
  bindHouseAd(view);
  view.querySelector("#btn-review").addEventListener("click", () => {
    if (!premiumActive()) { upsell("Weekly review", "A deeper weekly breakdown of wins, watch-outs, and next steps."); return; }
    openWeeklyReview();
  });
  view.querySelector("#ins-premium")?.addEventListener("click", () =>
    upsell("Deeper insights", "The 12-month forecast, what-if scenarios, debt payoff planner, and weekly review are Premium."));
  view.querySelectorAll("#scenario-chips .chip").forEach((c) =>
    c.addEventListener("click", () => {
      scenarioState[c.dataset.sc] = !scenarioState[c.dataset.sc];
      c.setAttribute("aria-pressed", scenarioState[c.dataset.sc]);
      view.querySelector("#timeline-chart").innerHTML = timelineChart();
      view.querySelector("#timeline-summary").innerHTML = timelineSummary();
    }));
}

/** Locked teaser shown to free accounts in place of the forecast/scenarios.
    Shows a REAL computed one-year projection (the math isn't gated) so the value
    is concrete, then lists what Premium unlocks. */
function premiumTeaser() {
  const base = project(12);
  const end = base[base.length - 1];
  const start = base[0];
  const headline = end > 0 && end > start
    ? `You're on track for about <strong class="t-num">${moneyShort(end)}</strong> saved a year from now`
    : `See exactly where your money is headed`;
  return `
    <button class="card premium-teaser" id="ins-premium" style="width:100%;text-align:left">
      <div class="row" style="align-items:flex-start">
        <span style="font-size:22px">✨</span>
        <div class="grow">
          <div style="font-weight:var(--fw-semibold)">${headline}</div>
          <div class="t-small t-secondary" style="margin-top:4px">
            Unlock the full 12-month forecast, <strong>what-if scenarios</strong>
            (a raise, a big purchase, paying debt off faster), a debt payoff planner,
            and the weekly review — with Premium.</div>
          <div class="t-small" style="margin-top:8px;color:var(--green-700);font-weight:var(--fw-semibold)">See what Premium shows ›</div>
        </div>
      </div>
    </button>`;
}

/** Premium: avalanche vs snowball payoff, using the previously-dormant engine. */
function debtPlanCard() {
  const plan = debtStrategies(200);
  if (!plan) return "";
  const { avalanche, snowball, extraPerMonth } = plan;
  const fmtMonths = (m) => m >= 600 ? "60+ yrs" : `${Math.floor(m / 12)}y ${m % 12}m`;
  const best = avalanche.interestPaid <= snowball.interestPaid ? "avalanche" : "snowball";
  return `
    <h2 class="section-title">Debt payoff plan ${infoDot("timeline")}</h2>
    <div class="card">
      <div class="t-small t-secondary" style="margin-bottom:12px">
        With an extra ${money(extraPerMonth)}/mo, here's how two proven strategies compare.</div>
      <div class="row" style="gap:10px">
        <div class="card grow ${best === "avalanche" ? "" : ""}" style="padding:12px;${best === "avalanche" ? "border-color:var(--green-600)" : ""}">
          <div class="card-title">Avalanche${best === "avalanche" ? " · best" : ""}</div>
          <strong class="t-num" style="font-size:var(--fs-18)">${fmtMonths(avalanche.months)}</strong>
          <div class="t-small t-secondary">${money(avalanche.interestPaid)} interest · highest rate first</div>
        </div>
        <div class="card grow" style="padding:12px;${best === "snowball" ? "border-color:var(--green-600)" : ""}">
          <div class="card-title">Snowball${best === "snowball" ? " · best" : ""}</div>
          <strong class="t-num" style="font-size:var(--fs-18)">${fmtMonths(snowball.months)}</strong>
          <div class="t-small t-secondary">${money(snowball.interestPaid)} interest · smallest first</div>
        </div>
      </div>
    </div>`;
}

function insightCard(i) {
  const icon = i.type === "win" ? "✅" : i.type === "watch" ? "⚠️" : "💡";
  return `
    <div class="card" style="padding:14px 16px">
      <div class="row" style="align-items:flex-start">
        <span style="font-size:18px;line-height:1.4">${icon}</span>
        <div class="grow">
          <div style="font-weight:var(--fw-medium);font-size:var(--fs-15)">${esc(i.text)}</div>
          ${i.detail ? `<div class="t-small t-secondary" style="margin-top:3px">${esc(i.detail)}</div>` : ""}
        </div>
      </div>
    </div>`;
}

function activeScenario() {
  return {
    raisePct: scenarioState.raise ? 10 : 0,
    extraSavings: scenarioState.extra ? 150 : 0,
    purchase: scenarioState.purchase ? { amount: 2000, month: 2 } : null,
    payoffDebt: scenarioState.payoff,
  };
}

function anyScenario() {
  return Object.values(scenarioState).some(Boolean);
}

function timelineChart() {
  const base = project(12);
  const series = [{ values: base, color: chartColors.forest, area: true }];
  if (anyScenario()) {
    series.push({ values: project(12, activeScenario()), color: chartColors.sage, dashed: true });
  }
  return lineChart(series, projectionLabels(12));
}

function timelineSummary() {
  const base = project(12);
  const end = base[base.length - 1];
  if (!anyScenario()) {
    return `Keep going like this and you'd have about <strong class="t-num">${moneyShort(end)}</strong> saved a year from now.`;
  }
  const sim = project(12, activeScenario());
  const simEnd = sim[sim.length - 1];
  const diff = simEnd - end;
  return `With that change you'd have <strong class="t-num">${moneyShort(simEnd)}</strong> — ${diff >= 0
    ? `<span class="t-pos">${moneyShort(diff)} more</span>` : `<span class="t-neg">${moneyShort(-diff)} less</span>`} than staying the course.`;
}

function openWeeklyReview() {
  const r = weeklyReview();
  openSheet(`
    <h2 class="sheet-title">This week's review</h2>
    <div class="row" style="margin-bottom:16px">
      <div class="card grow" style="padding:12px">
        <div class="card-title">This week</div>
        <strong class="t-num" style="font-size:var(--fs-20)">${money(r.thisWeek)}</strong>
      </div>
      <div class="card grow" style="padding:12px">
        <div class="card-title">Last week</div>
        <strong class="t-num" style="font-size:var(--fs-20)">${money(r.lastWeek)}</strong>
      </div>
    </div>

    ${r.wins.length ? `<div class="coach-block-title">Wins</div>
      <ul class="review-list">${r.wins.map((w) => `<li>✅ ${esc(w)}</li>`).join("")}</ul>` : ""}
    ${r.watch.length ? `<div class="coach-block-title" style="margin-top:14px">Worth watching</div>
      <ul class="review-list">${r.watch.map((w) => `<li>⚠️ ${esc(w)}</li>`).join("")}</ul>` : ""}
    ${r.topCategories.length ? `<div class="coach-block-title" style="margin-top:14px">Where it went</div>
      <ul class="review-list">${r.topCategories.map((c) => `<li>${esc(c.name)} — <strong class="t-num">${money(c.spent)}</strong> this month</li>`).join("")}</ul>` : ""}
    <div class="coach-block-title" style="margin-top:14px">Next week</div>
    <ul class="review-list">${r.priorities.map((p) => `<li>→ ${esc(p)}</li>`).join("")}</ul>
  `);
}
