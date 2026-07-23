/* Budget Bear — Daily Spin wheel.
   The SERVER decides the prize (daily_spin RPC, one per UTC day); the wheel
   then animates to land exactly on it. Pure CSS transform animation. */

import { dailySpin, friendlyCloudError } from "../cloud/api.js";
import { update } from "../store.js";
import { loadMyProfile } from "../cloud/client.js";
import { toast } from "./components.js";
import { shopItem } from "../data/shop.js";
import { refresh } from "../router.js";

/* Fixed display order; index = landing segment (45° each, pointer at top). */
const SEGMENTS = [
  { key: "p25", label: "25", points: 25 },
  { key: "flair", label: "🍀", item: "flair-lucky" },
  { key: "p75", label: "75", points: 75 },
  { key: "p150", label: "150", points: 150 },
  { key: "p50", label: "50", points: 50 },
  { key: "tag", label: "🎰", item: "tag-jackpot" },
  { key: "p100", label: "100", points: 100 },
  { key: "p300", label: "300", points: 300 },
];

const COLORS = ["#3E7A4D", "#7FC96A", "#2D5C3A", "#C9A227", "#3E7A4D", "#B05A6E", "#2D5C3A", "#7FC96A"];

function segmentFor(result) {
  if (result.prize === "flair-lucky") return SEGMENTS.findIndex((s) => s.item === "flair-lucky");
  if (result.prize === "tag-jackpot") return SEGMENTS.findIndex((s) => s.item === "tag-jackpot");
  const exact = SEGMENTS.findIndex((s) => s.points === result.points);
  return exact >= 0 ? exact : SEGMENTS.findIndex((s) => s.points === 100);
}

export function markSpunToday() {
  try { localStorage.setItem("bb.lastSpinDay", new Date().toISOString().slice(0, 10)); } catch { /* ok */ }
}

export function spunToday() {
  try { return localStorage.getItem("bb.lastSpinDay") === new Date().toISOString().slice(0, 10); }
  catch { return false; }
}

/** Confetti burst from the wheel center on a win. Skipped under reduced motion. */
function fireConfetti(stage) {
  if (!stage || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.documentElement.hasAttribute("data-reduce-motion")) return;
  const burst = document.createElement("div");
  burst.className = "spin-burst";
  const colors = ["#7FC96A", "#C9A227", "#3D6B8E", "#B05A6E", "#ff9a56", "#8b5fc7"];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("i");
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    p.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
    p.style.setProperty("--dy", (Math.sin(ang) * dist - 20).toFixed(1) + "px");
    p.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
    p.style.setProperty("--d", (Math.random() * 0.12).toFixed(2) + "s");
    p.style.setProperty("--cc", colors[i % colors.length]);
    burst.appendChild(p);
  }
  stage.appendChild(burst);
  setTimeout(() => burst.remove(), 1500);
}

export function openSpinWheel() {
  const root = document.getElementById("overlay-root");
  document.getElementById("spin-overlay")?.remove();

  const conic = SEGMENTS.map((_, i) =>
    `${COLORS[i]} ${i * 45}deg ${(i + 1) * 45}deg`).join(", ");

  const el = document.createElement("div");
  el.id = "spin-overlay";
  el.className = "achievement-overlay spin-overlay";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Daily spin");
  el.innerHTML = `
    <div class="achievement-card" style="max-width:340px">
      <div class="achievement-kicker">Daily spin</div>
      <div class="achievement-title" id="spin-title">Give it a whirl</div>
      <p class="achievement-desc" id="spin-desc">One free spin every day. Points, rare flairs, rare tags.</p>
      <div class="spin-stage">
        <div class="spin-rim"></div>
        <div class="spin-wheel" id="spin-wheel" style="background:conic-gradient(${conic})">
          ${SEGMENTS.map((s, i) => `
            <span class="spin-label" style="transform:rotate(${i * 45 + 22.5}deg) translateY(-38%)">${s.label}</span>`).join("")}
        </div>
        <div class="spin-glass"></div>
        <div class="spin-hub"><img src="assets/bears/coinbear.webp" alt="" width="34" height="34"></div>
        <div class="spin-pointer"></div>
      </div>
      <div class="stack" style="margin-top:18px">
        <button class="btn btn-primary btn-block" id="spin-go">Spin</button>
        <button class="btn btn-ghost btn-block" id="spin-close">Maybe later</button>
      </div>
    </div>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("open"));

  let landTimer = null;
  const close = () => {
    // The 4.2s landing timer outlives the overlay otherwise, and fires refresh()
    // against whatever screen the user has since navigated to.
    if (landTimer) { clearTimeout(landTimer); landTimer = null; }
    el.classList.remove("open");
    setTimeout(() => el.remove(), 350);
  };
  el.querySelector("#spin-close").addEventListener("click", close);

  el.querySelector("#spin-go").addEventListener("click", async () => {
    const goBtn = el.querySelector("#spin-go");
    goBtn.disabled = true;
    goBtn.textContent = "Spinning…";
    let result;
    try {
      result = await dailySpin();
    } catch (err) {
      toast(friendlyCloudError(err, "Couldn't spin right now"));
      close();
      return;
    }
    if (result.error === "already_spun") {
      markSpunToday();
      toast("You already spun today — come back tomorrow!");
      close();
      refresh();
      return;
    }

    markSpunToday();
    // The prize is already banked server-side; from here the animation is
    // cosmetic, so "Maybe later" can safely cancel the landing.
    el.querySelector("#spin-close").disabled = true;
    const idx = segmentFor(result);
    // pointer sits at top: rotate so the winning segment's center lands there
    const target = 5 * 360 + (360 - (idx * 45 + 22.5));
    const wheel = el.querySelector("#spin-wheel");
    wheel.style.transition = "transform 4s cubic-bezier(0.12, 0.8, 0.16, 1)";
    wheel.style.transform = `rotate(${target}deg)`;

    landTimer = setTimeout(async () => {
      landTimer = null;
      el.querySelector("#spin-close").disabled = false;
      const wonItem = result.prize !== "points" ? shopItem(result.prize) : null;
      el.querySelector("#spin-title").textContent = wonItem
        ? `You won ${wonItem.name}!`
        : `+${result.points} Bear Points!`;
      el.querySelector("#spin-desc").textContent = wonItem
        ? "A prize you can't buy — equip it in the Shop."
        : result.points === 100 && result.prize !== "points"
          ? "Already owned that prize, so points it is."
          : "Added straight to your balance.";
      goBtn.hidden = true;
      el.querySelector("#spin-close").textContent = "Nice!";
      el.querySelector("#spin-close").className = "btn btn-primary btn-block";

      // Celebrate the landing.
      const card = el.querySelector(".achievement-card");
      card.classList.add("spin-win");
      fireConfetti(el.querySelector(".spin-stage"));

      update((s) => { s.points.balance = result.balance; }); // mirror server truth
      await loadMyProfile().catch(() => {});
      refresh();
    }, 4200);
  });
}
