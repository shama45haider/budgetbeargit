/* Budget Bear — Plans: Free, Premium (coming soon), and Business. */

import { navigate } from "../router.js";

export function renderPlans(view) {
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
          <h2 class="grow">Free</h2>
          <span class="shop-price">$0</span>
        </div>
        <p class="t-small t-secondary" style="margin-bottom:10px">Everything you see today. Supported by a few small promos.</p>
        <ul class="plan-list">
          <li>Full budgeting, goals, and coach</li>
          <li>Group Links with friends</li>
          <li>Daily Spin, points, and the Shop</li>
        </ul>
        <button class="btn btn-secondary btn-block" disabled style="margin-top:12px">Your current plan</button>
      </div>

      <div class="card plan-card plan-featured">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow">Premium</h2>
          <span class="shop-price">$4.99/mo · coming soon</span>
        </div>
        <p class="t-small t-secondary" style="margin-bottom:10px">For people who want the bear at full power.</p>
        <ul class="plan-list">
          <li>No promos, ever</li>
          <li>An exclusive new theme every month</li>
          <li>A second Daily Spin each day</li>
          <li>Early access to new features</li>
        </ul>
        <a class="btn btn-primary btn-block" style="margin-top:12px"
          href="mailto:help@budgetbear.xyz?subject=Notify%20me%20about%20Budget%20Bear%20Premium">Notify me when it launches</a>
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
}
