/* Budget Bear — entry point: nav, routes, boot */

import { get } from "./store.js";
import * as router from "./router.js";
import { renderHome } from "./screens/home.js";
import { renderGoals } from "./screens/goals.js";
import { renderBudget } from "./screens/budget.js";
import { renderCoach } from "./screens/coach.js";
import { renderInsights } from "./screens/insights.js";
import { renderProfile } from "./screens/profile.js";
import { renderOnboarding } from "./screens/onboarding.js";

const icons = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5a2 2 0 0 1 4 0V21h3.5a1 1 0 0 0 1-1V9.5"/></svg>`,
  goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  budget: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11v4"/><path d="M4 5v13a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1"/><circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  coach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l1.7-3A8 8 0 1 1 21 12Z"/><path d="M9 11.5h.01M13 11.5h.01M17 11.5h.01"/></svg>`,
  insights: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M5 15.5 9.5 11l3.5 3 5.5-6"/><path d="M15.5 8H18.5V11"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 19.4a7.7 7.7 0 0 1 14.4 0"/></svg>`,
};

const tabs = [
  { path: "/home", label: "Home", icon: icons.home },
  { path: "/goals", label: "Goals", icon: icons.goals },
  { path: "/budget", label: "Budget", icon: icons.budget },
  { path: "/coach", label: "Coach", icon: icons.coach },
  { path: "/insights", label: "Insights", icon: icons.insights },
  { path: "/profile", label: "Profile", icon: icons.profile },
];

function buildNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = tabs
    .map((t) => `<a href="#${t.path}" aria-label="${t.label}">${t.icon}<span>${t.label}</span></a>`)
    .join("");
}

router.register("/home", renderHome);
router.register("/goals", renderGoals);
router.register("/budget", renderBudget);
router.register("/coach", renderCoach);
router.register("/insights", renderInsights);
router.register("/profile", renderProfile);
router.register("/onboarding", renderOnboarding);

router.setGuard((path) => {
  const onboarded = get().profile.onboarded;
  if (!onboarded && path !== "/onboarding") return "/onboarding";
  if (onboarded && path === "/onboarding") return "/home";
  return null;
});

function syncNavVisibility() {
  document.getElementById("nav").hidden = !get().profile.onboarded || router.current() === "/onboarding";
}

buildNav();
router.start();
syncNavVisibility();
window.addEventListener("hashchange", syncNavVisibility);

// Service worker (relative path — site may live under a subpath)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
