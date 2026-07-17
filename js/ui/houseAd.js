/* Budget Bear — house-ad slot for free accounts.
   Rotates small self-promos (Premium / Support / Invite). Clearly labeled,
   dismissible per session, never shown to premium plans, never near
   money-entry flows. When a real ad network is added, this component is
   the mount point. */

import { currentUser, isPremium } from "../cloud/client.js";
import { DONATE_URL } from "../cloud/config.js";
import { navigate } from "../router.js";

const ADS = [
  {
    id: "premium",
    icon: "✨",
    title: "Do more with Premium",
    body: "Custom category images, unlimited goals, 100 AI messages a day, and no promos.",
    cta: "See plans",
    go: () => navigate("/plans"),
  },
  {
    id: "support",
    icon: "💛",
    title: "Enjoying Budget Bear?",
    body: "A small donation keeps it free — and earns the exclusive Aurora Crown.",
    cta: "Support",
    go: () => navigate("/profile"),
  },
  {
    id: "invite",
    icon: "🔗",
    title: "Saving is easier with friends",
    body: "Start a Group Link and race to a goal together.",
    cta: "Open Groups",
    go: () => navigate("/groups"),
  },
];

function dismissed(id) {
  try { return sessionStorage.getItem("bb.ad." + id) === "1"; } catch { return false; }
}

/** HTML for one rotating promo, or "" (premium plan / all dismissed). */
export function houseAdHTML(slot = 0) {
  if (isPremium()) return ""; // no promos for premium — a paid benefit
  const pool = ADS.filter((a) => !dismissed(a.id) && !(a.id === "support" && !DONATE_URL && !currentUser()));
  if (!pool.length) return "";
  const ad = pool[(new Date().getDate() + slot) % pool.length];
  return `
  <div class="card house-ad" data-ad="${ad.id}">
    <div class="row" style="align-items:flex-start">
      <span style="font-size:20px">${ad.icon}</span>
      <div class="grow">
        <div class="t-small" style="font-weight:var(--fw-semibold)">${ad.title}</div>
        <div class="t-small t-secondary" style="margin-top:2px">${ad.body}</div>
      </div>
      <button class="btn-ghost house-ad-x" data-ad-dismiss aria-label="Dismiss">✕</button>
    </div>
    <div class="row" style="margin-top:8px;justify-content:space-between">
      <span class="house-ad-label">Sponsored · Budget Bear</span>
      <button class="btn btn-sm btn-secondary" data-ad-go>${ad.cta}</button>
    </div>
  </div>`;
}

export function bindHouseAd(container) {
  const card = container.querySelector(".house-ad");
  if (!card) return;
  const ad = ADS.find((a) => a.id === card.dataset.ad);
  card.querySelector("[data-ad-go]")?.addEventListener("click", () => ad?.go());
  card.querySelector("[data-ad-dismiss]")?.addEventListener("click", () => {
    try { sessionStorage.setItem("bb.ad." + card.dataset.ad, "1"); } catch { /* ok */ }
    card.remove();
  });
}
