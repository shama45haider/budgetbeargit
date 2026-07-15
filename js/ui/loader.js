/* Budget Bear — full-screen loader: the logo breathing in a soft mint glow.
   Transform/opacity only, so it stays smooth on low-end phones. */

let el = null;
let shownAt = 0;

export function showLoader(message = "One moment…") {
  if (el) {
    el.querySelector(".loader-text").textContent = message;
    return;
  }
  shownAt = Date.now();
  el = document.createElement("div");
  el.className = "app-loader";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <div class="loader-glow"></div>
    <img src="assets/logo.png" alt="" width="88" height="88">
    <div class="loader-text">${message}</div>`;
  document.getElementById("overlay-root").appendChild(el);
  requestAnimationFrame(() => el.classList.add("open"));
}

export function hideLoader() {
  if (!el) return;
  const node = el;
  el = null;
  // Keep it visible for at least 450ms so fast operations don't flash.
  const wait = Math.max(0, 450 - (Date.now() - shownAt));
  setTimeout(() => {
    node.classList.remove("open");
    setTimeout(() => node.remove(), 250);
  }, wait);
}
