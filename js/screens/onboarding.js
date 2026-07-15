/* Budget Bear — onboarding wizard.
   One field per step, a persistent Continue button, and a working Back button.
   No auto-advance, no timers, no animation-gated content — every step is
   reachable and recoverable at all times. */

import { update, uid } from "../store.js";
import { navigate } from "../router.js";
import { esc, money, todayISO } from "../format.js";
import { buildSeed } from "../data/seed.js";
import { checkAchievements } from "../engine/points.js";

const answers = {};
let index = 0;

const PAY_SCHEDULES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
];

const GOAL_OPTIONS = [
  { id: "emergency", icon: "🛟", name: "Emergency fund" },
  { id: "vacation", icon: "✈️", name: "Vacation" },
  { id: "house", icon: "🏡", name: "House" },
  { id: "car", icon: "🚙", name: "New car" },
  { id: "skip", icon: "—", name: "Skip for now" },
];

const STEPS = [
  { id: "welcome", kind: "welcome" },
  {
    id: "name", kind: "text", key: "name",
    title: "What should I call you?",
    subtitle: "Your first name is perfect.",
    placeholder: "Alex",
  },
  {
    id: "income", kind: "amount", key: "income",
    title: (a) => a.name ? `Nice to meet you, ${esc(a.name)}.` : "Your income",
    subtitle: "What's your monthly take-home income, after taxes?",
    placeholder: "4,200",
  },
  {
    id: "schedule", kind: "choice", key: "paySchedule",
    title: "How often do you get paid?",
    options: PAY_SCHEDULES,
  },
  {
    id: "housing", kind: "amount", key: "housing",
    title: "Housing",
    subtitle: "What do you pay for rent or mortgage each month?",
    placeholder: "1,400",
  },
  {
    id: "utilities", kind: "amount", key: "utilities",
    title: "Utilities",
    subtitle: "Electric, water, internet, phone — a rough monthly total.",
    placeholder: "200",
  },
  {
    id: "groceries", kind: "amount", key: "groceries",
    title: "Groceries",
    subtitle: "About how much do you spend per month?",
    placeholder: "400",
  },
  {
    id: "transport", kind: "amount", key: "transport",
    title: "Transportation",
    subtitle: "Gas, transit, or a car payment.",
    placeholder: "200",
  },
  {
    id: "subscriptions", kind: "amount", key: "subscriptions", allowZero: true,
    title: "Subscriptions",
    subtitle: "Streaming, music, apps — a rough monthly total. Zero is fine.",
    placeholder: "40",
  },
  {
    id: "dining", kind: "amount", key: "dining", allowZero: true,
    title: "Dining out & fun",
    subtitle: "How much would you like to allow each month?",
    placeholder: "250",
  },
  {
    id: "cushion", kind: "amount", key: "cushion", allowZero: true,
    title: "Savings on hand",
    subtitle: "An estimate is fine — this becomes your safety cushion.",
    placeholder: "2,000",
  },
  {
    id: "savings", kind: "amount", key: "savings", allowZero: true,
    title: "Monthly savings target",
    subtitle: (a) => {
      const committed = ["housing", "utilities", "groceries", "transport", "subscriptions", "dining"]
        .reduce((sum, k) => sum + (a[k] || 0), 0);
      const left = Math.max(0, a.income - committed);
      const suggested = Math.min(left, Math.max(50, Math.round(a.income * 0.15 / 25) * 25));
      a.suggestedSavings = suggested;
      return `After those costs you have about ${money(left)} left each month. We'd suggest ${money(suggested)} to start — you can change this anytime.`;
    },
    placeholder: () => String(answers.suggestedSavings || 100),
  },
  { id: "goal", kind: "goal" },
  { id: "summary", kind: "summary" },
];

export function renderOnboarding(view) {
  index = 0;
  for (const k of Object.keys(answers)) delete answers[k];

  view.innerHTML = `
    <div class="screen wizard">
      <header class="wizard-header">
        <button class="wizard-back" id="wz-back" aria-label="Back" hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <div class="wizard-progress"><i style="width:0%"></i></div>
        <span class="wizard-step-count" id="wz-count"></span>
      </header>
      <div class="wizard-body" id="wz-body"></div>
      <div class="wizard-footer" id="wz-footer">
        <button class="btn btn-primary btn-block" id="wz-continue" disabled>Continue</button>
      </div>
    </div>`;

  view.querySelector("#wz-back").addEventListener("click", goBack);
  renderStep(view);
}

function goBack() {
  if (index === 0) return;
  index--;
  renderStep(document.getElementById("view"));
}

function renderStep(view) {
  const step = STEPS[index];
  const body = view.querySelector("#wz-body");
  const footer = view.querySelector("#wz-footer");
  const backBtn = view.querySelector("#wz-back");
  const continueBtn = view.querySelector("#wz-continue");

  view.querySelector(".wizard-progress i").style.width = Math.round((index / (STEPS.length - 1)) * 100) + "%";
  view.querySelector("#wz-count").textContent = index === 0 ? "" : `${index} of ${STEPS.length - 1}`;
  backBtn.hidden = index === 0;

  continueBtn.textContent = step.kind === "summary" ? "Looks good — let's go" : "Continue";
  continueBtn.disabled = true;
  continueBtn.onclick = () => attemptAdvance(step);

  if (step.kind === "welcome") {
    footer.hidden = true;
    body.innerHTML = welcomeHTML();
    body.querySelector("#wz-build").addEventListener("click", () => { index++; renderStep(view); });
    body.querySelector("#wz-demo").addEventListener("click", loadDemo);
    return;
  }
  footer.hidden = false;

  if (step.kind === "text") {
    body.innerHTML = fieldShellHTML(step) + `
      <input class="input" id="wz-input" placeholder="${esc(step.placeholder)}" autocomplete="off" value="${esc(answers[step.key] ?? "")}">`;
    const input = body.querySelector("#wz-input");
    const check = () => { continueBtn.disabled = input.value.trim().length === 0; };
    input.addEventListener("input", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !continueBtn.disabled) attemptAdvance(step); });
    check();
    setTimeout(() => input.focus(), 50);
  }

  else if (step.kind === "amount") {
    const shell = fieldShellHTML(step); // may set answers.suggestedSavings etc. — must run before placeholder()
    const placeholder = typeof step.placeholder === "function" ? step.placeholder() : step.placeholder;
    const existing = answers[step.key];
    body.innerHTML = shell + `
      <div class="amount-input-wrap">
        <span class="currency">$</span>
        <input class="input" id="wz-input" inputmode="decimal" placeholder="${esc(placeholder)}" autocomplete="off"
          value="${existing != null ? existing : ""}">
      </div>`;
    const input = body.querySelector("#wz-input");
    const check = () => {
      const v = parseFloat(input.value.replace(/[^0-9.]/g, ""));
      continueBtn.disabled = isNaN(v) || (step.allowZero ? v < 0 : v <= 0);
    };
    input.addEventListener("input", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !continueBtn.disabled) attemptAdvance(step); });
    check();
    setTimeout(() => input.focus(), 50);
  }

  else if (step.kind === "choice") {
    body.innerHTML = fieldShellHTML(step) + `
      <div class="wizard-choice-list">
        ${step.options.map((o) => `
          <button type="button" class="wizard-choice" data-v="${o.value}" aria-pressed="${answers[step.key] === o.value}">
            ${esc(o.label)}<span class="check"></span>
          </button>`).join("")}
      </div>`;
    body.querySelectorAll(".wizard-choice").forEach((b) =>
      b.addEventListener("click", () => {
        body.querySelectorAll(".wizard-choice").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        answers[step.key] = b.dataset.v;
        continueBtn.disabled = false;
      }));
    continueBtn.disabled = answers[step.key] === undefined;
  }

  else if (step.kind === "goal") {
    body.innerHTML = `
      <h1 class="wizard-title">What's the first thing you'd like to save toward?</h1>
      <div class="wizard-goal-grid">
        ${GOAL_OPTIONS.map((g) => `
          <button type="button" class="cat-tile" data-id="${g.id}" style="min-height:84px">
            <span>${g.icon}</span><small>${esc(g.name)}</small>
          </button>`).join("")}
      </div>`;
    body.querySelectorAll(".cat-tile").forEach((b) =>
      b.addEventListener("click", () => {
        body.querySelectorAll(".cat-tile").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        answers.goal = b.dataset.id;
        continueBtn.disabled = false;
      }));
    if (answers.goal) body.querySelector(`.cat-tile[data-id="${answers.goal}"]`)?.classList.add("selected");
    continueBtn.disabled = answers.goal === undefined;
  }

  else if (step.kind === "summary") {
    const plan = computePlan();
    body.innerHTML = `
      <h1 class="wizard-title">Here's your plan, ${esc(answers.name)}.</h1>
      <p class="wizard-subtitle">You can change any of this later — nothing is locked in.</p>
      <div class="wizard-summary-card">
        ${plan.categories.map((c) => `<div class="row-item"><span>${c.icon} ${esc(c.name)}</span><strong class="t-num">${money(c.limit)}</strong></div>`).join("")}
      </div>
      <div class="wizard-summary-card total">
        <div class="row-item"><span>Monthly income</span><strong class="t-num">${money(answers.income)}</strong></div>
        <div class="row-item"><span>Left over each month</span><strong class="t-num">${money(plan.free)}</strong></div>
      </div>
      ${plan.goal ? `<div class="wizard-summary-card"><div class="row-item"><span>${plan.goal.icon} ${esc(plan.goal.name)} goal</span><strong class="t-num">${money(plan.goal.target)} by ${new Date(plan.goal.deadline).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong></div></div>` : ""}
    `;
    continueBtn.disabled = false;
  }
}

function fieldShellHTML(step) {
  const title = typeof step.title === "function" ? step.title(answers) : step.title;
  const subtitle = typeof step.subtitle === "function" ? step.subtitle(answers) : step.subtitle;
  return `<h1 class="wizard-title">${title}</h1>${subtitle ? `<p class="wizard-subtitle">${subtitle}</p>` : ""}`;
}

function welcomeHTML() {
  return `
    <div class="wizard-welcome">
      <img src="assets/logo.png" alt="Budget Bear">
      <h1>Let's set up your plan</h1>
      <p>A few quick questions — about two minutes, no spreadsheets.</p>
      <div class="stack">
        <button type="button" class="wizard-option primary" id="wz-build">
          <div class="icon-bubble">🧮</div>
          <div><h3>Build my budget</h3><p>Answer a few questions and I'll set everything up.</p></div>
        </button>
        <button type="button" class="wizard-option" id="wz-demo">
          <div class="icon-bubble">✨</div>
          <div><h3>Try with sample data</h3><p>Explore Budget Bear instantly with a realistic example.</p></div>
        </button>
      </div>
    </div>`;
}

function attemptAdvance(step) {
  const view = document.getElementById("view");
  const input = view.querySelector("#wz-input");

  if (step.kind === "text") {
    const v = input.value.trim();
    if (!v) return;
    answers[step.key] = v;
  } else if (step.kind === "amount") {
    const v = parseFloat(input.value.replace(/[^0-9.]/g, ""));
    if (isNaN(v) || (step.allowZero ? v < 0 : v <= 0)) return;
    answers[step.key] = v;
  } else if (step.kind === "choice" && answers[step.key] === undefined) {
    return;
  } else if (step.kind === "goal" && answers.goal === undefined) {
    return;
  } else if (step.kind === "summary") {
    buildPlan();
    return;
  }

  index++;
  renderStep(view);
}

function computePlan() {
  const cats = [
    { id: "housing", name: "Housing", icon: "🏠", limit: answers.housing, essential: true },
    { id: "utilities", name: "Utilities", icon: "💡", limit: answers.utilities, essential: true },
    { id: "groceries", name: "Groceries", icon: "🛒", limit: answers.groceries, essential: true },
    { id: "transport", name: "Transportation", icon: "🚗", limit: answers.transport, essential: true },
  ];
  if (answers.subscriptions > 0) cats.push({ id: "subscriptions", name: "Subscriptions", icon: "📺", limit: answers.subscriptions, essential: false });
  if (answers.dining > 0) cats.push({ id: "dining", name: "Dining out", icon: "🍽️", limit: answers.dining, essential: false });
  const committed = cats.reduce((a, c) => a + c.limit, 0) + answers.savings;
  const shopping = Math.max(0, Math.round((answers.income - committed) * 0.4));
  cats.push({ id: "shopping", name: "Shopping", icon: "🛍️", limit: shopping, essential: false });
  cats.push({ id: "savings", name: "Savings", icon: "🌱", limit: answers.savings, essential: true });

  const free = answers.income - cats.reduce((a, c) => a + c.limit, 0);

  let goal = null;
  if (answers.goal && answers.goal !== "skip") {
    const meta = GOAL_OPTIONS.find((g) => g.id === answers.goal);
    const targets = {
      emergency: Math.round((answers.housing + answers.utilities + answers.groceries + answers.transport) * 3),
      vacation: 2500, house: 40000, car: 8000,
    };
    const target = targets[answers.goal] || 2000;
    const months = Math.max(3, Math.ceil(target / Math.max(50, answers.savings)));
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + months);
    goal = { icon: meta.icon, name: meta.name, target, deadline: deadline.toISOString().slice(0, 10) };
  }

  return { categories: cats, free, goal };
}

function loadDemo() {
  const seed = buildSeed();
  update((s) => Object.assign(s, seed));
  navigate("/home");
}

function buildPlan() {
  const plan = computePlan();

  const goals = [];
  if (plan.goal) {
    goals.push({
      id: uid(), name: plan.goal.name, icon: plan.goal.icon, target: plan.goal.target, saved: 0,
      deadline: plan.goal.deadline, priority: "high", createdAt: todayISO(), completedAt: null,
    });
  }

  update((s) => {
    s.profile.name = answers.name;
    s.profile.paySchedule = answers.paySchedule;
    s.profile.onboarded = true;
    s.profile.demo = false;
    s.profile.createdAt = todayISO();
    s.income.monthly = answers.income;
    s.budget.categories = plan.categories;
    s.goals = goals;
    s.settings.savingsBuffer = answers.cushion;
  });

  navigate("/home");
  setTimeout(checkAchievements, 300);
}
