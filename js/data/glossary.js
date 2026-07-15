/* Budget Bear — plain-English explainers.
   Every money idea in the app gets a tappable ⓘ that opens a friendly
   "What's this?" sheet. Written so a 3rd grader gets it. */

import { esc } from "../format.js";
import { openSheet } from "../ui/components.js";
import { get } from "../store.js";
import { navigate } from "../router.js";

export const GLOSSARY = {
  "left-today": {
    title: "Left to spend today",
    body: "This is your fun money for today. We take the fun money you have left this month and split it across the days left. Spend less than this today and you're doing great.",
  },
  "fun-money": {
    title: "Fun money",
    body: "Money for things you want but don't need — snacks, games, eating out, shopping. Your must-pays (like rent and groceries) are already taken care of before this number.",
  },
  "must-pays": {
    title: "Must-pays",
    body: "Bills and needs you always have to pay — rent, lights, water, food, getting to work. These come first, before fun money and saving.",
  },
  "money-left-over": {
    title: "Money left over",
    body: "After your must-pays, fun money, and saving, this is what's still not being used. Giving it a job (like adding it to a goal) makes it grow instead of disappear.",
  },
  "health-score": {
    title: "Your money health score",
    body: "One number from 0 to 100 that shows how healthy your money is — like a report card grade. Saving more, owing less, and sticking to your plan all make it go up. Nothing here is ever meant to make you feel bad — it just shows what to work on next.",
  },
  "saving-rate": {
    title: "How much you save",
    body: "Out of every dollar you make, how much do you keep? Keeping 20 cents of every dollar is a great target.",
  },
  "what-you-owe": {
    title: "What you owe",
    body: "Money you have to pay back, like credit cards or loans. The less you owe compared to what you make, the better.",
  },
  "money-in-out": {
    title: "Money in vs. money out",
    body: "Simple rule: more money should come in than goes out. If your plan spends more than you make, something has to shrink.",
  },
  "sticking-to-plan": {
    title: "Sticking to your plan",
    body: "Did you stay under your budget in past months? Doing it again and again is how budgets actually work.",
  },
  "rainy-day": {
    title: "Rainy-day fund",
    body: "Money saved for surprises — a car repair, a broken phone, losing a job. Try to save enough to cover 3 months of your must-pays. It's the best safety net there is.",
  },
  "goal-progress": {
    title: "Goal progress",
    body: "How far along your goals are. Keeping goals moving — even a little each week — counts for a lot.",
  },
  "needed-monthly": {
    title: "Needed each month",
    body: "To finish this goal on time, this is how much you'd put away each month. Split it by weeks if that feels easier.",
  },
  "remaining-budget": {
    title: "Remaining",
    body: "What you can still spend this month before you go over your plan. When it hits zero, it's time to pause spending in that area.",
  },
  "timeline": {
    title: "Your money future",
    body: "This line guesses how much money you'll have saved over the next year if you keep your current plan. Tap the buttons to play 'what if?' — like getting a raise or making a big purchase.",
  },
  "bear-points": {
    title: "Bear Points",
    body: "Points you earn for good money habits — the Daily Spin, daily check-ins, adding to goals, keeping streaks. Spend them in the Shop on themes and cool looks for your profile that your friends can see.",
  },
  "level": {
    title: "Levels",
    body: "Every point you've ever earned counts toward your level — from Cub all the way to Mythic Bear. Levels never go down, even when you spend points in the Shop.",
  },
  "streak": {
    title: "Streak",
    body: "How many days in a row you've checked in. Longer streaks earn bonus points. Miss a day and it starts over — so come say hi to the bear every day.",
  },
};

/** Render a tappable ⓘ. Wire with bindInfoDots(container) after inserting HTML. */
export function infoDot(id) {
  return `<i class="info-dot" data-info="${id}" role="button" tabindex="0" aria-label="What's this?">i</i>`;
}

/** Attach open-sheet behavior to every ⓘ inside container. */
export function bindInfoDots(container) {
  container.querySelectorAll("[data-info]").forEach((dot) =>
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = GLOSSARY[dot.dataset.info];
      if (!entry) return;
      openSheet(`
        <h2 class="sheet-title">${esc(entry.title)}</h2>
        <p style="font-size:var(--fs-15);line-height:1.55">${esc(entry.body)}</p>
      `);
    }));
}

/** Demo-mode banner. Prepend inside .screen when profile.demo is true. */
export function demoBannerHTML() {
  if (!get().profile.demo) return "";
  return `<div class="demo-banner"><span>You're exploring a demo</span><button data-demo-signup>Create account</button></div>`;
}

export function bindDemoBanner(container) {
  container.querySelector("[data-demo-signup]")?.addEventListener("click", () => navigate("/auth"));
}
