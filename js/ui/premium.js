/* Budget Bear — Premium gating helpers.
   Two kinds of gate live in this app:
     - SERVER-enforced (AI quota, group cap, spins, image upload) — the RPC or
       storage policy is the real boundary; the client just avoids a pointless
       round-trip and shows a nicer message.
     - CLIENT-only (goal count, Insights depth) — honour-system, since that data
       is on-device. Bypassable in devtools; that's an accepted tradeoff.
   Either way the UX is the same: an upsell sheet, never a dead end. */

import { openSheet } from "./components.js";
import { isPremium, currentUser } from "../cloud/client.js";
import { navigate } from "../router.js";
import { esc } from "../format.js";

/** True if the current account may use premium features. Signed-out/demo = no. */
export function premiumActive() {
  return !!currentUser() && isPremium();
}

/** Show the upsell for `feature`. Always returns false, so callers can
    `if (!premiumActive()) return upsell("…");` in one line. */
export function upsell(feature, detail = "") {
  openSheet(`
    <div style="text-align:center;padding-top:6px">
      <div style="font-size:44px;line-height:1">✨</div>
      <h2 class="sheet-title" style="margin-top:8px">${esc(feature)} is a Premium feature</h2>
      <p class="t-secondary" style="font-size:var(--fs-14);line-height:1.5;margin:8px auto 16px;max-width:300px">
        ${esc(detail || "Premium unlocks custom category images, unlimited goals, 100 AI messages a day, deeper insights, and more.")}
      </p>
    </div>
    <button class="btn btn-primary btn-block" id="up-see">See Premium</button>
    <button class="btn btn-ghost btn-block" id="up-close" style="margin-top:8px">Maybe later</button>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#up-see").addEventListener("click", () => { close(); navigate("/plans"); });
      sheet.querySelector("#up-close").addEventListener("click", close);
    },
  });
  return false;
}
