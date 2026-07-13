/* Budget Bear — conversational onboarding.
   One question at a time; builds the budget automatically. */

import { update, uid } from "../store.js";
import { navigate } from "../router.js";
import { esc, money } from "../format.js";
import { buildSeed } from "../data/seed.js";
import { checkAchievements } from "../engine/points.js";

const answers = {};

const steps = [
  {
    id: "welcome",
    bubble: () => `Hi, I'm Budget Bear. I'll set up your plan with a few quick questions — about two minutes, no spreadsheets.`,
    input: { type: "choice", options: ["Let's start", "Try with sample data"] },
    handle(v) {
      if (v === "Try with sample data") { loadDemo(); return "done"; }
      return null;
    },
  },
  {
    id: "name",
    bubble: () => `What should I call you?`,
    input: { type: "text", placeholder: "Your first name" },
    handle(v) { answers.name = v; },
  },
  {
    id: "income",
    bubble: () => `Nice to meet you, ${esc(answers.name)}. What's your monthly take-home income — after taxes?`,
    input: { type: "amount", placeholder: "4,200" },
    handle(v) { answers.income = v; },
  },
  {
    id: "schedule",
    bubble: () => `How often do you get paid?`,
    input: { type: "choice", options: ["Weekly", "Every 2 weeks", "Twice a month", "Monthly"] },
    handle(v) {
      answers.paySchedule = { "Weekly": "weekly", "Every 2 weeks": "biweekly", "Twice a month": "semimonthly", "Monthly": "monthly" }[v];
    },
  },
  {
    id: "housing",
    bubble: () => `What do you pay for housing each month — rent or mortgage?`,
    input: { type: "amount", placeholder: "1,400" },
    handle(v) { answers.housing = v; },
  },
  {
    id: "utilities",
    bubble: () => `Roughly how much for utilities — electric, water, internet, phone?`,
    input: { type: "amount", placeholder: "200" },
    handle(v) { answers.utilities = v; },
  },
  {
    id: "groceries",
    bubble: () => `About how much do you spend on groceries per month?`,
    input: { type: "amount", placeholder: "400" },
    handle(v) { answers.groceries = v; },
  },
  {
    id: "transport",
    bubble: () => `And transportation — gas, transit, car payment?`,
    input: { type: "amount", placeholder: "200" },
    handle(v) { answers.transport = v; },
  },
  {
    id: "subscriptions",
    bubble: () => `Any subscriptions? Streaming, music, apps — a rough monthly total is fine.`,
    input: { type: "amount", placeholder: "40", allowZero: true },
    handle(v) { answers.subscriptions = v; },
  },
  {
    id: "dining",
    bubble: () => `How much would you like to allow for dining out and fun each month?`,
    input: { type: "amount", placeholder: "250", allowZero: true },
    handle(v) { answers.dining = v; },
  },
  {
    id: "cushion",
    bubble: () => `How much do you currently have in savings? This becomes your safety cushion — an estimate is fine.`,
    input: { type: "amount", placeholder: "2,000", allowZero: true },
    handle(v) { answers.cushion = v; },
  },
  {
    id: "savings",
    bubble: () => {
      const committed = answers.housing + answers.utilities + answers.groceries + answers.transport + answers.subscriptions + answers.dining;
      const left = Math.max(0, answers.income - committed);
      const suggested = Math.min(left, Math.max(50, Math.round(answers.income * 0.15 / 25) * 25));
      answers.suggestedSavings = suggested;
      return `After those costs you have about <strong>${money(left)}</strong> a month left. How much would you like to save each month? I'd suggest <strong>${money(suggested)}</strong> to start.`;
    },
    input: { type: "amount", placeholder: "500", allowZero: true },
    handle(v) { answers.savings = v; },
  },
  {
    id: "goal",
    bubble: () => `Last one. What's the first thing you'd like to save toward?`,
    input: { type: "choice", options: ["🛟 Emergency fund", "✈️ Vacation", "🏡 House", "🚙 New car", "Skip for now"] },
    handle(v) { answers.goal = v === "Skip for now" ? null : v; },
  },
  {
    id: "finish",
    bubble: () => `That's everything. I've built your budget${answers.goal ? " and started your first goal" : ""} — you can adjust any number later. Welcome aboard, ${esc(answers.name)}.`,
    input: { type: "choice", options: ["Open Budget Bear"] },
    handle() { buildPlan(); return "done"; },
  },
];

let stepIndex = 0;

export function renderOnboarding(view) {
  stepIndex = 0;
  for (const k of Object.keys(answers)) delete answers[k];

  view.innerHTML = `
    <div class="screen onboarding">
      <div class="ob-header">
        <img src="assets/logo.png" alt="Budget Bear" width="52" height="52">
        <div class="ob-progress"><i style="width:5%"></i></div>
      </div>
      <div class="ob-chat" id="ob-chat" aria-live="polite"></div>
      <div class="ob-input" id="ob-input"></div>
    </div>`;

  askStep();
}

function askStep() {
  const step = steps[stepIndex];
  const chat = document.getElementById("ob-chat");
  const bubble = document.createElement("div");
  bubble.className = "ob-bubble bear";
  bubble.innerHTML = `<img class="ob-avatar" src="assets/bears/thinkbear.png" alt=""><div class="ob-msg">${step.bubble()}</div>`;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
  document.querySelector(".ob-progress i").style.width = Math.round(((stepIndex + 1) / steps.length) * 100) + "%";
  renderInput(step);
}

function renderInput(step) {
  const wrap = document.getElementById("ob-input");
  const { input } = step;

  if (input.type === "choice") {
    wrap.innerHTML = `<div class="ob-choices">${input.options
      .map((o) => `<button class="chip" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    wrap.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => submit(step, b.dataset.v)));
    return;
  }

  const isAmount = input.type === "amount";
  wrap.innerHTML = `
    <form class="ob-form">
      <div class="${isAmount ? "amount-input-wrap" : ""}" style="flex:1">
        ${isAmount ? `<span class="currency">$</span>` : ""}
        <input class="input" ${isAmount ? 'inputmode="decimal" pattern="[0-9.,]*"' : ""}
          placeholder="${esc(input.placeholder || "")}" autocomplete="off" required>
      </div>
      <button class="btn btn-primary" aria-label="Continue">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </form>`;
  const form = wrap.querySelector("form");
  const field = form.querySelector("input");
  field.focus();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let v = field.value.trim();
    if (isAmount) {
      v = parseFloat(v.replace(/[^0-9.]/g, ""));
      if (isNaN(v) || (!input.allowZero && v <= 0)) { field.value = ""; field.focus(); return; }
    } else if (!v) return;
    submit(step, v);
  });
}

function submit(step, value) {
  const chat = document.getElementById("ob-chat");
  const me = document.createElement("div");
  me.className = "ob-bubble me";
  me.innerHTML = `<div class="ob-msg">${typeof value === "number" ? money(value) : esc(String(value))}</div>`;
  chat.appendChild(me);
  chat.scrollTop = chat.scrollHeight;

  const result = step.handle(value);
  document.getElementById("ob-input").innerHTML = "";
  if (result === "done") return;

  stepIndex++;
  if (stepIndex < steps.length) setTimeout(askStep, 420);
}

function loadDemo() {
  const seed = buildSeed();
  update((s) => Object.assign(s, seed));
  navigate("/home");
}

function buildPlan() {
  const cats = [
    { id: "housing", name: "Housing", icon: "🏠", limit: answers.housing, essential: true },
    { id: "utilities", name: "Utilities", icon: "💡", limit: answers.utilities, essential: true },
    { id: "groceries", name: "Groceries", icon: "🛒", limit: answers.groceries, essential: true },
    { id: "transport", name: "Transportation", icon: "🚗", limit: answers.transport, essential: true },
  ];
  if (answers.subscriptions > 0) cats.push({ id: "subscriptions", name: "Subscriptions", icon: "📺", limit: answers.subscriptions, essential: false });
  if (answers.dining > 0) cats.push({ id: "dining", name: "Dining out", icon: "🍽️", limit: answers.dining, essential: false });
  cats.push({ id: "shopping", name: "Shopping", icon: "🛍️", limit: Math.max(0, Math.round((answers.income - answers.housing - answers.utilities - answers.groceries - answers.transport - answers.subscriptions - answers.dining - answers.savings) * 0.4)), essential: false });
  cats.push({ id: "savings", name: "Savings", icon: "🌱", limit: answers.savings, essential: true });

  const goals = [];
  if (answers.goal) {
    const [icon, ...nameParts] = answers.goal.split(" ");
    const name = nameParts.join(" ");
    const targets = { "Emergency fund": Math.round((answers.housing + answers.utilities + answers.groceries + answers.transport) * 3), "Vacation": 2500, "House": 40000, "New car": 8000 };
    const target = targets[name] || 2000;
    const months = Math.max(3, Math.ceil(target / Math.max(50, answers.savings)));
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + months);
    goals.push({
      id: uid(), name, icon, target, saved: 0,
      deadline: deadline.toISOString().slice(0, 10),
      priority: "high", createdAt: new Date().toISOString().slice(0, 10), completedAt: null,
    });
  }

  update((s) => {
    s.profile.name = answers.name;
    s.profile.paySchedule = answers.paySchedule;
    s.profile.onboarded = true;
    s.profile.demo = false;
    s.profile.createdAt = new Date().toISOString().slice(0, 10);
    s.income.monthly = answers.income;
    s.budget.categories = cats;
    s.goals = goals;
    s.settings.savingsBuffer = answers.cushion;
  });

  navigate("/home");
  setTimeout(checkAchievements, 600);
}
