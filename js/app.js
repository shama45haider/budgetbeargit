/* Budget Bear — entry point: nav, routes, accounts-first boot */

import { get } from "./store.js";
import * as router from "./router.js";
import { renderHome } from "./screens/home.js";
import { renderGoals } from "./screens/goals.js";
import { renderBudget } from "./screens/budget.js";
import { renderCoach } from "./screens/coach.js";
import { renderInsights } from "./screens/insights.js";
import { renderProfile } from "./screens/profile.js";
import { renderOnboarding } from "./screens/onboarding.js";
import { renderAuth } from "./screens/auth.js";
import { renderGroups, renderJoin } from "./screens/groups.js";
import { renderGroupDetail } from "./screens/groupDetail.js";
import { renderGroupChat } from "./screens/groupChat.js";
import { renderShop } from "./screens/shop.js";
import { renderPlans } from "./screens/plans.js";
import { initCloud, onAuthChange, currentUser, myProfile } from "./cloud/client.js";
import { showLoader, hideLoader } from "./ui/loader.js";
import { applyCachedTheme, applyTheme } from "./ui/theme.js";

const icons = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5a2 2 0 0 1 4 0V21h3.5a1 1 0 0 0 1-1V9.5"/></svg>`,
  groups: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19a6.2 6.2 0 0 1 12.4 0"/><circle cx="17" cy="9.5" r="2.6"/><path d="M15.4 13.6a5.2 5.2 0 0 1 5.8 5.4"/></svg>`,
  goals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  budget: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11v4"/><path d="M4 5v13a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1"/><circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  coach: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l1.7-3A8 8 0 1 1 21 12Z"/><path d="M9 11.5h.01M13 11.5h.01M17 11.5h.01"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 19.4a7.7 7.7 0 0 1 14.4 0"/></svg>`,
};

const tabs = [
  { path: "/home", label: "Home", icon: icons.home },
  { path: "/groups", label: "Groups", icon: icons.groups },
  { path: "/goals", label: "Goals", icon: icons.goals },
  { path: "/budget", label: "Budget", icon: icons.budget },
  { path: "/coach", label: "Coach", icon: icons.coach },
  { path: "/profile", label: "Profile", icon: icons.profile },
];

function buildNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = tabs
    .map((t) => `<a href="#${t.path}" aria-label="${t.label}">${t.icon}<span>${t.label}</span></a>`)
    .join("");
}

router.register("/home", renderHome);
router.register("/groups", renderGroups);
router.register("/goals", renderGoals);
router.register("/budget", renderBudget);
router.register("/coach", renderCoach);
router.register("/insights", renderInsights);
router.register("/profile", renderProfile);
router.register("/onboarding", renderOnboarding);
router.register("/auth", renderAuth);
router.register("/shop", renderShop);
router.register("/plans", renderPlans);
router.register("/group/:id", renderGroupDetail);
router.register("/group/:id/chat", renderGroupChat);
router.register("/join/:code", renderJoin);

router.setGuard((path) => {
  const signedIn = !!currentUser();
  const { demo, onboarded } = get().profile;

  // Accounts are the front door. Only the auth screen and invite links are
  // reachable without an account or the demo (join links route through auth
  // themselves, preserving the destination).
  if (!signedIn && !demo) {
    if (path === "/auth" || path.startsWith("/join/")) return null;
    return "/auth";
  }

  if (!onboarded && !["/onboarding", "/auth"].includes(path) && !path.startsWith("/join/") && !path.startsWith("/group/")) {
    return "/onboarding";
  }
  if (onboarded && path === "/onboarding") return "/home";
  return null;
});

function syncNavVisibility() {
  const path = router.current() || location.hash.replace(/^#/, "");
  const signedIn = !!currentUser();
  const { demo, onboarded } = get().profile;
  const hideOn = path === "/onboarding" || path === "/auth";
  document.getElementById("nav").hidden = hideOn || !(signedIn || demo) || !onboarded;
}

async function boot() {
  applyCachedTheme(); // paint the purchased theme instantly, before session restore
  buildNav();
  showLoader("Waking the bear…");
  try {
    await initCloud(); // restore session before first route so we never flash /auth
  } catch { /* offline — demo and cached sessions still work */ }
  router.start();
  syncNavVisibility();
  hideLoader();
  window.addEventListener("hashchange", syncNavVisibility);

  onAuthChange(() => {
    const p = router.current();
    if (!currentUser() && !get().profile.demo) {
      applyTheme(null); // themes are account cosmetics — default look when signed out
      router.navigate("/auth");
      return;
    }
    // Reconcile with the account's equipped theme (covers new device / other tab)
    const equippedTheme = myProfile()?.equipped?.theme || null;
    applyTheme(equippedTheme);
    if (p === "/groups" || p === "/profile" || p === "/auth" || p === "/shop" || p?.startsWith("/group/")) {
      router.refresh();
    }
    syncNavVisibility();
  });
}

boot();

// Service worker (relative path — site may live under a subpath)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
