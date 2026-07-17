/* Budget Bear — tiny hash router.
   Exact routes (#/home) plus parameterized ones (#/group/:id → render(view, id)). */

const routes = new Map();      // exact path → render(view)
const paramRoutes = [];        // { parts: ["group", ":id"], render(view, ...params) }
let currentPath = null;
let beforeEach = null;
let leaveHooks = [];           // teardown for the screen currently on-screen

export function register(path, render) {
  if (path.includes(":")) {
    paramRoutes.push({ parts: path.replace(/^\//, "").split("/"), render });
  } else {
    routes.set(path, render);
  }
}

export function setGuard(fn) {
  beforeEach = fn;
}

/** Register teardown for the screen being rendered — realtime channels, timers.
    Runs once, when the router leaves (or re-renders) this screen.

    Screens can't do this for themselves on the way out: nothing tells them
    they're gone. `view.isConnected` reads as a liveness check but #view is a
    permanent element that is only ever emptied, so it is always true. */
export function onLeave(fn) {
  leaveHooks.push(fn);
}

/** True while the screen that called onLeave//captured this path is still on
    screen. Async work should check this before painting. */
export function isCurrent(path) {
  return currentPath === path;
}

export function navigate(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}

export function current() {
  return currentPath;
}

function matchParam(path) {
  const segs = path.replace(/^\//, "").split("/");
  for (const r of paramRoutes) {
    if (r.parts.length !== segs.length) continue;
    const params = [];
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      if (r.parts[i].startsWith(":")) params.push(decodeURIComponent(segs[i]));
      else if (r.parts[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { render: r.render, params };
  }
  return null;
}

function render() {
  let path = location.hash.replace(/^#/, "") || "/home";
  if (beforeEach) {
    const redirect = beforeEach(path);
    if (redirect && redirect !== path) {
      location.replace("#" + redirect);
      return;
    }
  }
  const view = document.getElementById("view");

  // Tear down the outgoing screen before the incoming one registers its own.
  for (const fn of leaveHooks) { try { fn(); } catch { /* never block navigation */ } }
  leaveHooks = [];

  currentPath = path;
  view.innerHTML = "";

  const exact = routes.get(path);
  if (exact) {
    exact(view);
  } else {
    const m = matchParam(path);
    if (m) m.render(view, ...m.params);
    else routes.get("/home")(view);
  }

  view.scrollTop = 0;
  window.scrollTo(0, 0);
  updateNav(path);
}

function updateNav(path) {
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === "#" + path);
    if (a.classList.contains("active")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

export function start() {
  window.addEventListener("hashchange", render);
  render();
}

/** Re-render the current route (after state changes). */
export function refresh() {
  render();
}
