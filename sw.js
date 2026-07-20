/* Budget Bear — service worker: offline-first app shell. */

const CACHE = "budgetbear-v12";

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/tokens.css",
  "css/base.css",
  "css/components.css",
  "css/screens.css",
  "css/social.css",
  "css/themes.css",
  "js/app.js",
  "js/router.js",
  "js/store.js",
  "js/format.js",
  "js/vendor/supabase.js",
  "js/cloud/config.js",
  "js/cloud/client.js",
  "js/cloud/api.js",
  "js/data/accents.js",
  "js/data/groupExtras.js",
  "js/data/glossary.js",
  "js/data/shop.js",
  "js/ui/loader.js",
  "js/ui/premium.js",
  "js/ui/theme.js",
  "js/ui/spinWheel.js",
  "js/ui/houseAd.js",
  "js/cloud/ai.js",
  "js/screens/plans.js",
  "js/screens/shop.js",
  "js/screens/auth.js",
  "js/screens/groups.js",
  "js/screens/groupDetail.js",
  "js/screens/groupChat.js",
  "js/ui/components.js",
  "js/ui/chart.js",
  "js/ui/achievement.js",
  "js/engine/metrics.js",
  "js/engine/goals.js",
  "js/engine/health.js",
  "js/engine/insights.js",
  "js/engine/forecast.js",
  "js/engine/coach.js",
  "js/engine/review.js",
  "js/engine/points.js",
  "js/data/categories.js",
  "js/data/achievements.js",
  "js/data/seed.js",
  "js/screens/home.js",
  "js/screens/goals.js",
  "js/screens/budget.js",
  "js/screens/coach.js",
  "js/screens/insights.js",
  "js/screens/profile.js",
  "js/screens/onboarding.js",
  "assets/logo.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/bears/coinbear.png",
  "assets/bears/coin2bear.png",
  "assets/bears/confusedbear.png",
  "assets/bears/excitedbear.png",
  "assets/bears/graphbear.png",
  "assets/bears/happybear.png",
  "assets/bears/achievementbear.png",
  "assets/bears/pointbear.png",
  "assets/bears/pointbear2.png",
  "assets/bears/thinkbear.png",
  "assets/banner-wide.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GETs, so a fresh deploy is visible immediately
// to anyone online; cache is only a fallback for offline use. (A pure
// cache-first strategy here previously meant every deploy needed a manual
// CACHE version bump before real users would ever see it — network-first
// removes that whole failure mode.)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((cached) => cached || caches.match("index.html")))
  );
});
