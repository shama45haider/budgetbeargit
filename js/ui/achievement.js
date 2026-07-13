/* Budget Bear — achievement unlock overlay. Mascot scales in with a soft glow. */

import { esc } from "../format.js";

const queue = [];
let showing = false;

export function showAchievement(a) {
  queue.push(a);
  if (!showing) next();
}

function next() {
  const a = queue.shift();
  if (!a) { showing = false; return; }
  showing = true;

  const root = document.getElementById("overlay-root");
  const el = document.createElement("div");
  el.className = "achievement-overlay";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Achievement unlocked");
  el.innerHTML = `
    <div class="achievement-card">
      <div class="achievement-bear">
        <img src="assets/bears/${esc(a.bear)}" alt="">
      </div>
      <div class="achievement-kicker">Achievement unlocked</div>
      <div class="achievement-title">${esc(a.title)}</div>
      <p class="achievement-desc">${esc(a.desc)}</p>
      ${a.points ? `<div class="achievement-points">+<span data-count-to="${a.points}">0</span> Bear Points</div>` : ""}
      <div style="margin-top:28px">
        <button class="btn btn-primary" style="min-width:160px">Continue</button>
      </div>
    </div>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("open"));

  // count up points
  const counter = el.querySelector("[data-count-to]");
  if (counter) {
    const target = a.points;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      counter.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 350);
  }

  const close = () => {
    el.classList.remove("open");
    setTimeout(() => { el.remove(); next(); }, 380);
  };
  el.querySelector("button").onclick = close;
}
