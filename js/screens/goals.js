/* Budget Bear — Goals: create, track, contribute. */

import { get, update, uid } from "../store.js";
import { money, esc, shortDate, todayISO } from "../format.js";
import { goalStats, etaLabel, RISK_LABEL } from "../engine/goals.js";
import { openSheet, toast, confirmSheet, animateNumbers } from "../ui/components.js";
import { GOAL_TEMPLATES } from "../data/categories.js";
import { awardContribution, checkAchievements } from "../engine/points.js";
import { refresh } from "../router.js";
import { infoDot, bindInfoDots, demoBannerHTML, bindDemoBanner } from "../data/glossary.js";

export function renderGoals(view) {
  const s = get();
  const active = s.goals.filter((g) => !g.completedAt && g.saved < g.target);
  const done = s.goals.filter((g) => g.completedAt || g.saved >= g.target);
  const totalSaved = s.goals.reduce((a, g) => a + g.saved, 0);

  view.innerHTML = `
  <div class="screen">
    ${demoBannerHTML()}
    <header class="screen-header">
      <h1>Goals</h1>
      <span class="sub t-num">${money(totalSaved)} saved</span>
    </header>

    ${active.length === 0 && done.length === 0 ? `
      <div class="empty-state">
        <img src="assets/bears/pointbear.png" alt="">
        <h3>Give your money a direction</h3>
        <p>A goal turns saving from a chore into progress you can see.</p>
      </div>` : ""}

    <div class="stack-lg">
      ${active.map(goalCard).join("")}
    </div>

    <button class="btn ${active.length ? "btn-secondary" : "btn-primary"} btn-block" id="btn-new-goal" style="margin-top:${active.length ? "16px" : "0"}">
      New goal
    </button>

    ${done.length ? `
      <h2 class="section-title">Completed</h2>
      <div class="list">
        ${done.map((g) => `
          <div class="list-row">
            <div class="icon-bubble">${g.icon}</div>
            <div class="main"><div class="name">${esc(g.name)}</div>
              <div class="meta">Completed ${g.completedAt ? shortDate(g.completedAt) : ""}</div></div>
            <div class="end"><div class="amount t-num t-pos">${money(g.target)}</div></div>
          </div>`).join("")}
      </div>` : ""}
  </div>`;

  animateNumbers(view);
  bindInfoDots(view);
  bindDemoBanner(view);
  view.querySelector("#btn-new-goal").addEventListener("click", openNewGoal);
  view.querySelectorAll("[data-contribute]").forEach((b) =>
    b.addEventListener("click", () => openContribute(b.dataset.contribute)));
  view.querySelectorAll("[data-goal-menu]").forEach((b) =>
    b.addEventListener("click", () => openGoalDetail(b.dataset.goalMenu)));
}

function goalCard(g) {
  const st = goalStats(g);
  const p = Math.round(st.completion * 100);
  const risk = RISK_LABEL[st.risk];
  return `
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px">${g.icon}</div>
        <div class="grow">
          <h3>${esc(g.name)}</h3>
          <div class="t-small t-secondary">${g.deadline ? "Target " + shortDate(g.deadline) : "No deadline"} · <span class="${risk.cls}">${risk.text}</span></div>
        </div>
        <button class="btn-ghost" style="padding:8px;min-height:auto" data-goal-menu="${g.id}" aria-label="Goal options">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      </div>
      <div class="row" style="align-items:baseline;margin-bottom:8px">
        <span class="t-num" style="font-size:var(--fs-22);font-weight:var(--fw-bold)">${money(g.saved)}</span>
        <span class="t-small t-secondary grow">of ${money(g.target)}</span>
        <strong class="t-num">${p}%</strong>
      </div>
      <div class="progress"><i style="width:${p}%"></i></div>
      <div class="goal-stats">
        <div><small>Est. finish</small><strong>${etaLabel(st.etaMonths)}</strong></div>
        <div><small>Needed / mo ${infoDot("needed-monthly")}</small><strong class="t-num">${st.requiredMonthly ? money(st.requiredMonthly) : "—"}</strong></div>
        <div><small>Remaining</small><strong class="t-num">${money(st.remaining)}</strong></div>
      </div>
      <div class="t-small t-secondary" style="margin:10px 0 12px">${esc(st.nextAction)}</div>
      <button class="btn btn-primary btn-block btn-sm" data-contribute="${g.id}">Add money</button>
    </div>`;
}

/* ---------- New goal ---------- */

function openNewGoal() {
  openSheet(`
    <h2 class="sheet-title">New goal</h2>
    <div class="cat-grid">
      ${GOAL_TEMPLATES.map((t) => `<button class="cat-tile" data-tpl="${t.id}"><span>${t.icon}</span><small>${esc(t.name)}</small></button>`).join("")}
    </div>
    <form id="goal-form" class="stack" style="margin-top:16px">
      <div class="field"><label class="field-label" for="goal-name">Name</label>
        <input class="input" id="goal-name" placeholder="Emergency fund" required></div>
      <div class="row">
        <div class="field grow"><label class="field-label" for="goal-target">Target amount</label>
          <div class="amount-input-wrap"><span class="currency">$</span>
          <input class="input" id="goal-target" inputmode="decimal" placeholder="3,000" required></div></div>
        <div class="field grow"><label class="field-label" for="goal-deadline">Target date</label>
          <input class="input" id="goal-deadline" type="date"></div>
      </div>
      <div class="field"><label class="field-label">Priority</label>
        <div class="segmented" id="goal-priority">
          <button type="button" data-p="high" aria-pressed="false">High</button>
          <button type="button" data-p="medium" aria-pressed="true">Medium</button>
          <button type="button" data-p="low" aria-pressed="false">Low</button>
        </div></div>
      <button class="btn btn-primary btn-block">Create goal</button>
    </form>
  `, {
    onOpen(sheet, close) {
      let icon = "🎯";
      let priority = "medium";
      const nameEl = sheet.querySelector("#goal-name");
      sheet.querySelectorAll(".cat-tile").forEach((b) =>
        b.addEventListener("click", () => {
          sheet.querySelectorAll(".cat-tile").forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          const tpl = GOAL_TEMPLATES.find((t) => t.id === b.dataset.tpl);
          icon = tpl.icon;
          if (tpl.id !== "custom") nameEl.value = tpl.name;
          else { nameEl.value = ""; nameEl.focus(); }
        }));
      sheet.querySelectorAll("#goal-priority button").forEach((b) =>
        b.addEventListener("click", () => {
          sheet.querySelectorAll("#goal-priority button").forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          priority = b.dataset.p;
        }));
      sheet.querySelector("#goal-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = nameEl.value.trim();
        const target = parseFloat(sheet.querySelector("#goal-target").value.replace(/[^0-9.]/g, ""));
        const deadline = sheet.querySelector("#goal-deadline").value || null;
        if (!name || isNaN(target) || target <= 0) return;
        update((s) => {
          s.goals.push({ id: uid(), name, icon, target, saved: 0, deadline, priority, createdAt: todayISO(), completedAt: null });
        });
        close();
        toast("Goal created");
        checkAchievements();
        refresh();
      });
    },
  });
}

/* ---------- Contribute ---------- */

function openContribute(id) {
  const g = get().goals.find((x) => x.id === id);
  if (!g) return;
  const st = goalStats(g);
  const suggest = st.requiredMonthly ? Math.min(st.remaining, Math.round(st.requiredMonthly / 4.345 / 5) * 5) : 25;
  openSheet(`
    <h2 class="sheet-title">${g.icon} Add to ${esc(g.name)}</h2>
    <div class="chip-row" style="margin-bottom:14px">
      ${[suggest, 25, 50, 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => `<button class="chip" data-v="${v}">${money(v)}</button>`).join("")}
    </div>
    <form id="add-form">
      <div class="amount-input-wrap">
        <span class="currency">$</span>
        <input class="input" id="add-amount" inputmode="decimal" placeholder="0.00" required>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px">Add money</button>
    </form>
    <p class="t-small t-secondary" style="margin-top:12px">${money(st.remaining)} to go. Contributions also count toward your monthly savings.</p>
  `, {
    onOpen(sheet, close) {
      const amountEl = sheet.querySelector("#add-amount");
      sheet.querySelectorAll(".chip").forEach((c) =>
        c.addEventListener("click", () => { amountEl.value = c.dataset.v; amountEl.focus(); }));
      sheet.querySelector("#add-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = parseFloat(amountEl.value.replace(/[^0-9.]/g, ""));
        if (isNaN(amount) || amount <= 0) return;
        let completed = false;
        update((s) => {
          const goal = s.goals.find((x) => x.id === id);
          goal.saved = Math.round((goal.saved + amount) * 100) / 100;
          if (goal.saved >= goal.target && !goal.completedAt) {
            goal.completedAt = todayISO();
            completed = true;
          }
          s.transactions.unshift({ id: uid(), categoryId: "savings", amount, note: "→ " + goal.name, date: todayISO() });
          s.settings.savingsBuffer = (s.settings.savingsBuffer || 0) + amount;
        });
        close();
        awardContribution(amount);
        if (completed) setTimeout(checkAchievements, 400);
        else checkAchievements();
        refresh();
      });
    },
  });
}

/* ---------- Goal detail / edit ---------- */

function openGoalDetail(id) {
  const g = get().goals.find((x) => x.id === id);
  if (!g) return;
  openSheet(`
    <h2 class="sheet-title">${g.icon} ${esc(g.name)}</h2>
    <form id="edit-goal" class="stack">
      <div class="row">
        <div class="field grow"><label class="field-label">Target</label>
          <div class="amount-input-wrap"><span class="currency">$</span>
          <input class="input" id="eg-target" inputmode="decimal" value="${g.target}"></div></div>
        <div class="field grow"><label class="field-label">Deadline</label>
          <input class="input" id="eg-deadline" type="date" value="${g.deadline || ""}"></div>
      </div>
      <button class="btn btn-primary btn-block">Save changes</button>
      <button type="button" class="btn btn-danger-ghost btn-block" id="eg-del">Delete goal</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#edit-goal").addEventListener("submit", (e) => {
        e.preventDefault();
        const target = parseFloat(sheet.querySelector("#eg-target").value.replace(/[^0-9.]/g, ""));
        const deadline = sheet.querySelector("#eg-deadline").value || null;
        update((s) => {
          const goal = s.goals.find((x) => x.id === id);
          if (!isNaN(target) && target > 0) goal.target = target;
          goal.deadline = deadline;
        });
        close(); toast("Goal updated"); refresh();
      });
      sheet.querySelector("#eg-del").addEventListener("click", async () => {
        close();
        if (await confirmSheet({ title: "Delete " + g.name + "?", body: "Saved amounts stay in your history, but the goal is removed.", confirmLabel: "Delete", danger: true })) {
          update((s) => { s.goals = s.goals.filter((x) => x.id !== id); });
          toast("Goal deleted"); refresh();
        }
      });
    },
  });
}
