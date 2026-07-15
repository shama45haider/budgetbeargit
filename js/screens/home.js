/* Budget Bear — Home: "What should I do today?" */

import { get } from "../store.js";
import { money, esc, greeting, relativeDay, monthLabel } from "../format.js";
import { dailyAllowance, upcomingBills } from "../engine/metrics.js";
import { healthScore } from "../engine/health.js";
import { topRecommendation } from "../engine/insights.js";
import { goalStats } from "../engine/goals.js";
import { ring, animateNumbers, openSheet, toast } from "../ui/components.js";
import { dailyCheckIn, hasCheckedInToday, checkAchievements } from "../engine/points.js";
import { navigate, refresh } from "../router.js";
import { myProfile, currentUser } from "../cloud/client.js";
import { infoDot, bindInfoDots, demoBannerHTML, bindDemoBanner } from "../data/glossary.js";
import { openSpinWheel, spunToday } from "../ui/spinWheel.js";
import { authNext } from "./auth.js";

export function renderHome(view) {
  const s = get();
  const da = dailyAllowance();
  const bills = upcomingBills(7);
  const health = healthScore();
  const rec = topRecommendation();
  const goal = [...s.goals].filter((g) => !g.completedAt).sort(byPriority)[0];
  const checked = hasCheckedInToday();
  const points = currentUser() && myProfile() ? (myProfile().points ?? s.points.balance) : s.points.balance;

  view.innerHTML = `
  <div class="screen">
    ${demoBannerHTML()}
    <header class="home-top">
      <div>
        <div class="t-small t-secondary">${greeting()}${s.profile.name ? "," : ""}</div>
        <h1>${esc(s.profile.name || "Welcome")}</h1>
      </div>
      <button class="points-pill" data-nav="/shop" aria-label="Bear Points — open the Shop">
        <img src="assets/bears/coinbear.png" alt="" width="22" height="22">
        <span class="t-num" data-count-to="${points}">0</span>
      </button>
    </header>

    <section class="card hero-card" aria-label="Money left today">
      <div class="card-title">Left to spend today ${infoDot("left-today")}</div>
      <div class="card-hero-value t-num">${money(da.leftToday)}</div>
      <div class="hero-meta t-small t-secondary">
        about ${money(da.perDay)} each day · ${money(Math.max(0, da.monthRemaining))} fun money left in ${monthLabel().split(" ")[0]}
      </div>
      <div class="progress" style="margin-top:14px" role="progressbar" aria-valuenow="${Math.round((1 - da.leftToday / (da.perDay || 1)) * 100)}">
        <i style="width:${Math.min(100, Math.round((da.spentToday / (da.perDay || 1)) * 100))}%"></i>
      </div>
    </section>

    ${checked ? `
      <div class="callout" style="margin-top:12px">
        <span>✅</span>
        <div>Today's review is done. ${s.points.streak > 1 ? `<strong>${s.points.streak}-day streak.</strong>` : ""} See you tomorrow.</div>
      </div>` : `
      <button class="btn btn-primary btn-block" style="margin-top:12px" id="btn-checkin">
        Start today's review · under a minute
      </button>`}

    ${currentUser() && !spunToday() ? `
      <button class="card tappable spin-cta" id="btn-spin" style="width:100%;text-align:left">
        <div class="row">
          <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px;font-size:20px">🎡</div>
          <div class="grow">
            <h3 style="font-size:var(--fs-15)">Your daily spin is ready</h3>
            <div class="t-small t-secondary">Win Bear Points — or a prize money can't buy</div>
          </div>
          <span class="chev">›</span>
        </div>
      </button>` : ""}
    ${!currentUser() && s.profile.demo ? `
      <button class="card tappable spin-cta" id="btn-spin-locked" style="width:100%;text-align:left">
        <div class="row">
          <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px;font-size:20px">🎡</div>
          <div class="grow">
            <h3 style="font-size:var(--fs-15)">Daily spin</h3>
            <div class="t-small t-secondary">Create a free account to spin for prizes every day</div>
          </div>
          <span class="chev">›</span>
        </div>
      </button>` : ""}

    <h2 class="section-title">Today's plan</h2>
    <div class="card" style="padding:0">
      ${todayPlanRows(da, bills, goal)}
    </div>

    ${goal ? goalCard(goal) : `
      <h2 class="section-title">Current goal</h2>
      <button class="card tappable" style="width:100%;text-align:left" data-nav="/goals">
        <div class="row">
          <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px">🎯</div>
          <div class="grow">
            <h3>Set your first goal</h3>
            <div class="t-small t-secondary">A goal gives every dollar a direction.</div>
          </div>
        </div>
      </button>`}

    <h2 class="section-title">Money health ${infoDot("health-score")}</h2>
    <button class="card tappable" style="width:100%;text-align:left" data-nav="/insights">
      <div class="row">
        ${ring({ size: 74, stroke: 7, value: health.score / 100, labelHTML: `<strong class="t-num" style="font-size:1.05rem">${health.score}</strong>` })}
        <div class="grow">
          <h3>${health.grade}</h3>
          <div class="t-small t-secondary">${esc(health.improvements[0] ? "Next up: " + health.improvements[0].label.toLowerCase() : "Everything looks strong")}</div>
        </div>
        <span class="chev">›</span>
      </div>
    </button>

    <h2 class="section-title">From your coach</h2>
    <button class="card tappable coach-card" style="width:100%;text-align:left" data-nav="/coach">
      <div class="row" style="align-items:flex-start">
        <img src="assets/bears/${rec.type === "watch" ? "thinkbear" : "pointbear"}.png" alt="" width="46" height="46" style="flex-shrink:0">
        <div class="grow">
          <h3 style="font-size:var(--fs-15)">${esc(rec.text)}</h3>
          <div class="t-small t-secondary" style="margin-top:3px">${esc(rec.detail || "")}</div>
        </div>
      </div>
    </button>
  </div>`;

  animateNumbers(view);
  wireNav(view);
  bindInfoDots(view);
  bindDemoBanner(view);

  view.querySelector("#btn-checkin")?.addEventListener("click", () => openCheckIn(da, bills, goal));
  view.querySelector("#btn-spin")?.addEventListener("click", openSpinWheel);
  view.querySelector("#btn-spin-locked")?.addEventListener("click", () => {
    authNext("/home");
    navigate("/auth");
  });
}

function byPriority(a, b) {
  const p = { high: 0, medium: 1, low: 2 };
  return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
}

function todayPlanRows(da, bills, goal) {
  const rows = [];
  const billToday = bills.filter((b) => b.inDays === 0);
  if (billToday.length) {
    for (const b of billToday) {
      rows.push(row("📅", `${esc(b.name)} due today`, b.autopay ? "On autopay" : "Needs payment", money(b.amount)));
    }
  }
  const next = bills.find((b) => b.inDays > 0);
  if (next) rows.push(row("🔔", `${esc(next.name)} — ${relativeDay(next.dueDate)}`, next.autopay ? "Autopay scheduled" : "Plan for it", money(next.amount)));
  if (goal) {
    const st = goalStats(goal);
    if (!st.complete && st.requiredMonthly) {
      rows.push(row(goal.icon, `Save toward ${esc(goal.name)}`, "Weekly target", money(st.requiredMonthly / 4.345)));
    }
  }
  rows.push(row("☕", "Fun money today", "Try to stay under", money(da.leftToday)));
  return rows.join("");
}

function row(icon, name, meta, amount) {
  return `<div class="list-row">
    <div class="icon-bubble">${icon}</div>
    <div class="main"><div class="name">${name}</div><div class="meta">${meta}</div></div>
    <div class="end"><div class="amount t-num">${amount}</div></div>
  </div>`;
}

function goalCard(goal) {
  const st = goalStats(goal);
  const pctv = Math.round(st.completion * 100);
  return `
    <h2 class="section-title">Current goal</h2>
    <button class="card tappable" style="width:100%;text-align:left" data-nav="/goals">
      <div class="row" style="margin-bottom:10px">
        <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px">${goal.icon}</div>
        <div class="grow">
          <h3>${esc(goal.name)}</h3>
          <div class="t-small t-secondary">${money(goal.saved)} of ${money(goal.target)}</div>
        </div>
        <strong class="t-num">${pctv}%</strong>
      </div>
      <div class="progress"><i style="width:${pctv}%"></i></div>
      <div class="t-small t-secondary" style="margin-top:10px">${esc(st.nextAction)}</div>
    </button>`;
}

function openCheckIn(da, bills, goal) {
  const s = get();
  const st = goal ? goalStats(goal) : null;
  const billsSoon = bills.slice(0, 3);
  openSheet(`
    <h2 class="sheet-title">Today's review</h2>
    <div class="stack">
      <div class="callout"><span>💵</span><div><strong>${money(da.leftToday)}</strong> of fun money for today.</div></div>
      ${billsSoon.length ? `<div class="callout"><span>📅</span><div>${billsSoon.map((b) => `${esc(b.name)} ${b.inDays === 0 ? "due today" : relativeDay(b.dueDate).toLowerCase()} (${money(b.amount)})`).join(" · ")}</div></div>` : ""}
      ${goal && st && !st.complete ? `<div class="callout"><span>${goal.icon}</span><div>${esc(goal.name)}: ${esc(st.nextAction)}</div></div>` : ""}
      <div class="callout"><span>🔥</span><div>Streak: <strong>${s.points.streak} day${s.points.streak === 1 ? "" : "s"}</strong>. Checking in daily earns 10 Bear Points.</div></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:20px" id="btn-complete-checkin">Done — I've reviewed today</button>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#btn-complete-checkin").onclick = () => {
        const earned = dailyCheckIn();
        close();
        if (earned) toast(`Check-in complete · +${earned} Bear Points`);
        setTimeout(() => { checkAchievements(); refresh(); }, 300);
      };
    },
  });
}

function wireNav(view) {
  view.querySelectorAll("[data-nav]").forEach((el) =>
    el.addEventListener("click", () => navigate(el.dataset.nav)));
}
