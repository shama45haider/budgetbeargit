/* Budget Bear — tiny hash router.
   Routes: #/home #/goals #/budget #/coach #/insights #/profile #/onboarding */

const routes = new Map();
let currentPath = null;
let beforeEach = null;

export function register(path, render) {
  routes.set(path, render);
}

export function setGuard(fn) {
  beforeEach = fn;
}

export function navigate(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}

export function current() {
  return currentPath;
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
  const handler = routes.get(path) || routes.get("/home");
  currentPath = path;
  const view = document.getElementById("view");
  view.innerHTML = "";
  handler(view);
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
