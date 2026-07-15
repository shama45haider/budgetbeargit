/* Budget Bear — theme engine.
   Applies a purchased theme by setting data-theme on <html> and mounting
   the ambient effect layer. The last equipped theme is cached locally so
   the app paints correctly on boot, before the session restores. */

const THEME_COLOR = {
  "theme-midnight": "#0e1411",
  "theme-sakura": "#fdf3f7",
  "theme-ocean": "#f2f8fb",
  "theme-royal": "#14120c",
};

const CACHE_KEY = "bb.theme";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let current = null;

export function currentTheme() {
  return current;
}

/** Apply a theme id (or null for the default Forest look). */
export function applyTheme(id, { cache = true } = {}) {
  const valid = id && THEME_COLOR[id] ? id : null;
  current = valid;

  const root = document.documentElement;
  if (valid) root.dataset.theme = valid;
  else root.removeAttribute("data-theme");

  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", valid ? THEME_COLOR[valid] : "#f9fbf9");

  mountFx(valid);

  if (cache) {
    try {
      if (valid) localStorage.setItem(CACHE_KEY, valid);
      else localStorage.removeItem(CACHE_KEY);
    } catch { /* storage unavailable */ }
  }
}

/** Instant paint on boot from the cached choice; reconciled after profile load. */
export function applyCachedTheme() {
  try { applyTheme(localStorage.getItem(CACHE_KEY), { cache: false }); }
  catch { /* storage unavailable */ }
}

/** Temporarily show a theme (shop try-on); returns a revert function. */
export function previewTheme(id) {
  const prev = current;
  applyTheme(id, { cache: false });
  return () => applyTheme(prev, { cache: false });
}

/* ---------- ambient effect layer ---------- */

function mountFx(id) {
  document.getElementById("theme-fx")?.remove();
  if (!id || reduceMotion) return;

  const fx = document.createElement("div");
  fx.id = "theme-fx";
  fx.setAttribute("aria-hidden", "true");

  const rand = (min, max) => min + Math.random() * (max - min);
  const addSpan = (cls, vars) => {
    const s = document.createElement("span");
    if (cls) s.className = cls;
    for (const [k, v] of Object.entries(vars)) s.style.setProperty(k, v);
    fx.appendChild(s);
  };

  if (id === "theme-midnight") {
    for (let i = 0; i < 6; i++) addSpan("", {
      "--x": rand(5, 92) + "%", "--y": rand(10, 88) + "%",
      "--dur": rand(12, 20) + "s", "--delay": -rand(0, 16) + "s",
    });
  } else if (id === "theme-sakura") {
    for (let i = 0; i < 6; i++) addSpan("", {
      "--x": rand(2, 95) + "%",
      "--dur": rand(10, 17) + "s", "--delay": -rand(0, 15) + "s",
    });
  } else if (id === "theme-ocean") {
    for (let i = 0; i < 7; i++) addSpan("", {
      "--x": rand(3, 94) + "%", "--size": rand(6, 14) + "px",
      "--dur": rand(11, 18) + "s", "--delay": -rand(0, 15) + "s",
    });
  } else if (id === "theme-royal") {
    addSpan("fx-sweep", {});
    for (let i = 0; i < 8; i++) addSpan("fx-dust", {
      "--x": rand(4, 94) + "%", "--y": rand(8, 90) + "%",
      "--dur": rand(3, 6) + "s", "--delay": -rand(0, 5) + "s",
    });
  }

  document.body.appendChild(fx);
}
