/* Budget Bear — Plans: Free, Premium, Business. Reflects the signed-in user's
   current plan and lists what each tier actually does today. */

import { navigate } from "../router.js";
import { currentUser, myProfile, isPremium } from "../cloud/client.js";
import { esc, shortDate } from "../format.js";

export function renderPlans(view) {
  const signedIn = !!currentUser();
  const premium = isPremium();
  const plan = myProfile()?.plan || "free";
  const expires = myProfile()?.plan_expires_at;

  const tag = (mine) => mine ? `<span class="plan-current-tag">Your plan</span>` : "";

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header">
      <div class="row" style="gap:8px">
        <button class="wizard-back" id="plans-back" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <h1>Plans</h1>
      </div>
    </header>

    <div class="stack-lg">
      <div class="card plan-card">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow">Free ${tag(signedIn && !premium && plan === "free")}</h2>
          <span class="shop-price">$0</span>
        </div>
        <p class="t-small t-secondary" style="margin-bottom:10px">The full budgeting core, free forever.</p>
        <ul class="plan-list">
          <li>Budget, expenses, and bills — no limits</li>
          <li>Up to 3 savings goals</li>
          <li>Money health score and everyday insights</li>
          <li>5 AI Coach messages a day</li>
          <li>Join any group · create 2 · daily spin</li>
        </ul>
      </div>

      <div class="card plan-card plan-featured">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow">Premium ${tag(premium && plan === "premium")}</h2>
          <span class="shop-price">$4.99/mo</span>
        </div>
        <p class="t-small t-secondary" style="margin-bottom:10px">The bear at full power.</p>
        <ul class="plan-list">
          <li><strong>Cloud budget sync</strong> — your budget, goals, and bills follow you to any device</li>
          <li><strong>Custom images</strong> for your budget categories</li>
          <li>Create your own categories</li>
          <li>Unlimited savings goals</li>
          <li>100 AI Coach messages a day</li>
          <li>12-month forecast, what-if scenarios, and a debt payoff planner</li>
          <li>Weekly review · create up to 30 groups · a second daily spin</li>
          <li>No promos, ever</li>
        </ul>
        ${premium
          ? `<button class="btn btn-secondary btn-block" disabled style="margin-top:12px">
               You're Premium${expires ? ` · renews ${esc(shortDate(String(expires).slice(0, 10)))}` : ""}</button>`
          : `<button class="btn btn-primary btn-block" id="plans-go-premium" style="margin-top:12px">Get Premium</button>`}
      </div>

      <div class="card plan-card">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow">Budget Bear for Business</h2>
          <span class="shop-price">Custom</span>
        </div>
        <p class="t-small t-secondary" style="margin-bottom:10px">
          Team budgeting for companies that need help keeping money on plan.</p>
        <ul class="plan-list">
          <li>Unlimited team groups</li>
          <li>Admin dashboard and reports</li>
          <li>Priority support</li>
          <li>Your company's branding</li>
        </ul>
        <a class="btn btn-secondary btn-block" style="margin-top:12px"
          href="mailto:help@budgetbear.xyz?subject=Budget%20Bear%20for%20Business%20inquiry">Contact sales</a>
      </div>
    </div>
  </div>`;

  view.querySelector("#plans-back").addEventListener("click", () => navigate("/profile"));
  view.querySelector("#plans-go-premium")?.addEventListener("click", () => {
    if (!signedIn) { navigate("/auth"); return; }
    openGetPremium();
  });
}

/* How you actually pay, today: a payment link + a redeem code. A Stripe webhook
   can later grant premium through the same redeem_code path with no UI change. */
function openGetPremium() {
  import("../ui/components.js").then(({ openSheet, toast }) => {
    import("../cloud/api.js").then(({ redeemCode, friendlyCloudError }) => {
      openSheet(`
        <h2 class="sheet-title">Get Premium</h2>
        <p class="t-secondary" style="font-size:var(--fs-14);line-height:1.5;margin-bottom:14px">
          Premium is $4.99/month. After you check out you'll get a code by email —
          redeem it here to switch it on. Codes stack, so a few months at once is fine.</p>
        <a class="btn btn-primary btn-block" href="mailto:help@budgetbear.xyz?subject=Budget%20Bear%20Premium"
          style="margin-bottom:14px">Get a Premium code</a>
        <form id="pr-form">
          <input class="input" id="pr-code" placeholder="Premium code" autocomplete="off"
            style="text-transform:uppercase;text-align:center;font-weight:var(--fw-semibold)">
          <button class="btn btn-secondary btn-block" style="margin-top:10px">Redeem code</button>
        </form>
      `, {
        onOpen(sheet, close) {
          sheet.querySelector("#pr-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const code = sheet.querySelector("#pr-code").value.trim();
            if (!code) return;
            try {
              const res = await redeemCode(code);
              if (res.error === "invalid_code") { toast("That code doesn't look right"); return; }
              if (res.error === "code_used_up") { toast("That code has already been used"); return; }
              if (res.error === "already_redeemed") { toast("You've already redeemed this one"); return; }
              close();
              await import("../cloud/client.js").then((m) => m.loadMyProfile());
              toast(res.bundle === "premium1m"
                ? "Premium unlocked — enjoy!"
                : "Code redeemed");
              navigate("/plans");
            } catch (err) {
              toast(friendlyCloudError(err, "Couldn't redeem that code"));
            }
          });
        },
      });
    });
  });
}
