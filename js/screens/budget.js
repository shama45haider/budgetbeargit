/* Budget Bear — Budget: categories, transactions, bills. */

import { get, update, uid } from "../store.js";
import { money, esc, monthLabel, todayISO, shortDate } from "../format.js";
import { spentThisMonth, totalBudgetLimit, billsMonthlyTotal } from "../engine/metrics.js";
import { openSheet, toast, animateNumbers, confirmSheet } from "../ui/components.js";
import { CATALOG, catInfo } from "../data/categories.js";
import { checkAchievements } from "../engine/points.js";
import { refresh } from "../router.js";

export function renderBudget(view) {
  const s = get();
  const spent = spentThisMonth();
  const limit = totalBudgetLimit();
  const pctSpent = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

  const cats = s.budget.categories.filter((c) => c.id !== "savings");
  const savings = s.budget.categories.find((c) => c.id === "savings");
  const savedThisMonth = spentThisMonth("savings", { includeSavings: true });
  const recent = s.transactions.slice(0, 6);

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header">
      <h1>Budget</h1>
      <span class="sub">${monthLabel()}</span>
    </header>

    <section class="card">
      <div class="row">
        <div class="grow">
          <div class="card-title">Spent this month</div>
          <div class="card-hero-value t-num" style="font-size:var(--fs-26)">${money(spent)}</div>
          <div class="t-small t-secondary">of ${money(limit)} planned</div>
        </div>
        <div style="text-align:right">
          <div class="card-title">Remaining</div>
          <div class="t-num" style="font-size:var(--fs-20);font-weight:var(--fw-bold)" class="${limit - spent < 0 ? "t-neg" : ""}">${money(Math.max(0, limit - spent))}</div>
        </div>
      </div>
      <div class="progress ${pctSpent > 100 ? "over" : pctSpent > 85 ? "warn" : ""}" style="margin-top:12px">
        <i style="width:${pctSpent}%"></i>
      </div>
    </section>

    <button class="btn btn-primary btn-block" style="margin-top:12px" id="btn-add-tx">Add expense</button>

    <h2 class="section-title">Categories</h2>
    <div class="stack">
      ${cats.map(categoryCard).join("")}
      ${savings ? `
        <div class="card" style="background:var(--tint);border-color:var(--green-100)">
          <div class="row">
            <div class="icon-bubble" style="background:var(--surface)">🌱</div>
            <div class="grow">
              <h3 style="font-size:var(--fs-15)">Savings</h3>
              <div class="t-small t-secondary">${money(savedThisMonth)} of ${money(savings.limit)} moved this month</div>
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-log-savings">Log</button>
          </div>
        </div>` : ""}
    </div>
    <button class="btn btn-ghost btn-block" id="btn-edit-budget" style="margin-top:8px">Adjust category budgets</button>

    <h2 class="section-title">Bills · ${money(billsMonthlyTotal())}/mo</h2>
    <div class="list">
      ${s.bills.length ? s.bills.slice().sort((a, b) => a.dueDay - b.dueDay).map((b) => `
        <button class="list-row" data-bill="${b.id}">
          <div class="icon-bubble">${b.icon || "📄"}</div>
          <div class="main">
            <div class="name">${esc(b.name)}</div>
            <div class="meta">Due the ${ordinal(b.dueDay)}${b.autopay ? " · autopay" : ""}</div>
          </div>
          <div class="end"><div class="amount t-num">${money(b.amount)}</div></div>
        </button>`).join("") : `<div class="list-row"><div class="main t-secondary t-small">No recurring bills yet.</div></div>`}
    </div>
    <button class="btn btn-ghost btn-block" id="btn-add-bill" style="margin-top:8px">Add a bill</button>

    <h2 class="section-title">Recent activity</h2>
    <div class="list">
      ${recent.length ? recent.map((t) => {
        const c = catInfo(t.categoryId);
        return `<button class="list-row" data-tx="${t.id}">
          <div class="icon-bubble">${c.icon}</div>
          <div class="main"><div class="name">${esc(t.note || c.name)}</div><div class="meta">${c.name} · ${shortDate(t.date)}</div></div>
          <div class="end"><div class="amount t-num">${t.categoryId === "savings" ? `<span class="t-pos">${money(t.amount)}</span>` : "−" + money(t.amount)}</div></div>
        </button>`;
      }).join("") : `<div class="list-row"><div class="main t-secondary t-small">Expenses you add will appear here.</div></div>`}
    </div>
  </div>`;

  animateNumbers(view);

  view.querySelector("#btn-add-tx").addEventListener("click", () => openAddTx());
  view.querySelector("#btn-edit-budget").addEventListener("click", openEditBudget);
  view.querySelector("#btn-add-bill").addEventListener("click", () => openBillSheet());
  view.querySelector("#btn-log-savings")?.addEventListener("click", () => openAddTx("savings"));
  view.querySelectorAll("[data-bill]").forEach((el) =>
    el.addEventListener("click", () => openBillSheet(el.dataset.bill)));
  view.querySelectorAll("[data-tx]").forEach((el) =>
    el.addEventListener("click", () => openTxDetail(el.dataset.tx)));
}

function categoryCard(c) {
  const spent = spentThisMonth(c.id);
  const p = c.limit ? Math.min(100, Math.round((spent / c.limit) * 100)) : 0;
  const over = spent > c.limit;
  return `
    <div class="card" style="padding:14px 16px">
      <div class="row">
        <div class="icon-bubble">${c.icon}</div>
        <div class="grow">
          <h3 style="font-size:var(--fs-15)">${esc(c.name)}</h3>
          <div class="t-small ${over ? "t-neg" : "t-secondary"}">
            ${over ? money(spent - c.limit) + " over" : money(Math.max(0, c.limit - spent)) + " left"} of ${money(c.limit)}
          </div>
        </div>
        <strong class="t-num t-small">${money(spent)}</strong>
      </div>
      <div class="progress ${over ? "over" : p > 85 ? "warn" : ""}" style="margin-top:10px"><i style="width:${p}%"></i></div>
    </div>`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ---------- Add transaction (2 taps: category → amount) ---------- */

export function openAddTx(presetCat = null) {
  const cats = get().budget.categories;
  openSheet(`
    <h2 class="sheet-title">Add expense</h2>
    <div class="cat-grid">
      ${cats.map((c) => `<button class="cat-tile ${presetCat === c.id ? "selected" : ""}" data-cat="${c.id}">
        <span>${c.icon}</span><small>${esc(c.name)}</small></button>`).join("")}
    </div>
    <form id="tx-form" style="margin-top:16px">
      <div class="amount-input-wrap">
        <span class="currency">$</span>
        <input class="input" id="tx-amount" inputmode="decimal" placeholder="0.00" autocomplete="off" required>
      </div>
      <input class="input" id="tx-note" placeholder="Note (optional)" autocomplete="off" style="margin-top:10px">
      <button class="btn btn-primary btn-block" style="margin-top:14px" disabled id="tx-save">Save</button>
    </form>
  `, {
    onOpen(sheet, close) {
      let cat = presetCat;
      const save = sheet.querySelector("#tx-save");
      const amountEl = sheet.querySelector("#tx-amount");
      const sync = () => {
        const v = parseFloat(amountEl.value.replace(/[^0-9.]/g, ""));
        save.disabled = !cat || isNaN(v) || v <= 0;
      };
      sheet.querySelectorAll(".cat-tile").forEach((b) =>
        b.addEventListener("click", () => {
          sheet.querySelectorAll(".cat-tile").forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          cat = b.dataset.cat;
          sync();
          amountEl.focus();
        }));
      amountEl.addEventListener("input", sync);
      if (presetCat) setTimeout(() => amountEl.focus(), 350);
      sheet.querySelector("#tx-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const amount = parseFloat(amountEl.value.replace(/[^0-9.]/g, ""));
        if (!cat || isNaN(amount) || amount <= 0) return;
        const note = sheet.querySelector("#tx-note").value.trim();
        update((s) => {
          s.transactions.unshift({ id: uid(), categoryId: cat, amount, note, date: todayISO() });
        });
        close();
        toast(cat === "savings" ? "Savings logged" : "Expense added");
        checkAchievements();
        refresh();
      });
    },
  });
}

function openTxDetail(id) {
  const t = get().transactions.find((x) => x.id === id);
  if (!t) return;
  const c = catInfo(t.categoryId);
  openSheet(`
    <h2 class="sheet-title">${esc(t.note || c.name)}</h2>
    <div class="coach-block">
      <div class="coach-row"><span>Amount</span><strong class="t-num">${money(t.amount)}</strong></div>
      <div class="coach-row"><span>Category</span><strong>${c.icon} ${esc(c.name)}</strong></div>
      <div class="coach-row"><span>Date</span><strong>${shortDate(t.date)}</strong></div>
    </div>
    <button class="btn btn-danger-ghost btn-block" id="tx-del" style="margin-top:14px">Delete transaction</button>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#tx-del").onclick = async () => {
        close();
        if (await confirmSheet({ title: "Delete this transaction?", body: "This can't be undone.", confirmLabel: "Delete", danger: true })) {
          update((s) => { s.transactions = s.transactions.filter((x) => x.id !== id); });
          toast("Deleted");
          refresh();
        }
      };
    },
  });
}

/* ---------- Edit budgets ---------- */

function openEditBudget() {
  const cats = get().budget.categories;
  const available = CATALOG.filter((c) => !cats.some((x) => x.id === c.id));
  openSheet(`
    <h2 class="sheet-title">Category budgets</h2>
    <form id="budget-form" class="stack">
      ${cats.map((c) => `
        <div class="row">
          <div class="icon-bubble">${c.icon}</div>
          <div class="grow" style="font-weight:var(--fw-medium);font-size:var(--fs-15)">${esc(c.name)}</div>
          <div class="amount-input-wrap" style="width:120px">
            <span class="currency" style="font-size:var(--fs-15)">$</span>
            <input class="input" style="min-height:44px;font-size:var(--fs-15)" inputmode="decimal"
              data-cat="${c.id}" value="${c.limit}">
          </div>
        </div>`).join("")}
      ${available.length ? `
        <select class="input" id="add-cat">
          <option value="">Add a category…</option>
          ${available.map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`).join("")}
        </select>` : ""}
      <button class="btn btn-primary btn-block" style="margin-top:6px">Save budgets</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#add-cat")?.addEventListener("change", (e) => {
        const id = e.target.value;
        if (!id) return;
        const info = CATALOG.find((c) => c.id === id);
        update((s) => { s.budget.categories.push({ ...info, limit: 0 }); });
        close();
        openEditBudget();
      });
      sheet.querySelector("#budget-form").addEventListener("submit", (e) => {
        e.preventDefault();
        update((s) => {
          sheet.querySelectorAll("input[data-cat]").forEach((inp) => {
            const cat = s.budget.categories.find((c) => c.id === inp.dataset.cat);
            const v = parseFloat(inp.value.replace(/[^0-9.]/g, ""));
            if (cat && !isNaN(v) && v >= 0) cat.limit = v;
          });
        });
        close();
        toast("Budgets updated");
        refresh();
      });
    },
  });
}

/* ---------- Bills ---------- */

function openBillSheet(id = null) {
  const bill = id ? get().bills.find((b) => b.id === id) : null;
  openSheet(`
    <h2 class="sheet-title">${bill ? "Edit bill" : "Add a bill"}</h2>
    <form id="bill-form" class="stack">
      <div class="field"><label class="field-label" for="bill-name">Name</label>
        <input class="input" id="bill-name" value="${esc(bill?.name || "")}" placeholder="Internet" required></div>
      <div class="row">
        <div class="field grow"><label class="field-label" for="bill-amount">Amount</label>
          <div class="amount-input-wrap"><span class="currency">$</span>
          <input class="input" id="bill-amount" inputmode="decimal" value="${bill?.amount ?? ""}" placeholder="60" required></div></div>
        <div class="field" style="width:130px"><label class="field-label" for="bill-day">Due day</label>
          <input class="input" id="bill-day" inputmode="numeric" value="${bill?.dueDay ?? ""}" placeholder="15" required></div>
      </div>
      <label class="row" style="min-height:44px;cursor:pointer">
        <input type="checkbox" id="bill-autopay" ${bill?.autopay ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--green-600)">
        <span style="font-size:var(--fs-15)">On autopay</span>
      </label>
      <button class="btn btn-primary btn-block">${bill ? "Save changes" : "Add bill"}</button>
      ${bill ? `<button type="button" class="btn btn-danger-ghost btn-block" id="bill-del">Remove bill</button>` : ""}
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#bill-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = sheet.querySelector("#bill-name").value.trim();
        const amount = parseFloat(sheet.querySelector("#bill-amount").value.replace(/[^0-9.]/g, ""));
        const dueDay = Math.min(28, Math.max(1, parseInt(sheet.querySelector("#bill-day").value, 10) || 1));
        const autopay = sheet.querySelector("#bill-autopay").checked;
        if (!name || isNaN(amount)) return;
        update((s) => {
          if (bill) {
            const b = s.bills.find((x) => x.id === id);
            Object.assign(b, { name, amount, dueDay, autopay });
          } else {
            s.bills.push({ id: uid(), name, amount, dueDay, autopay, icon: guessIcon(name) });
          }
        });
        close();
        toast(bill ? "Bill updated" : "Bill added");
        refresh();
      });
      sheet.querySelector("#bill-del")?.addEventListener("click", async () => {
        close();
        if (await confirmSheet({ title: "Remove this bill?", body: "It will no longer appear in upcoming bills.", confirmLabel: "Remove", danger: true })) {
          update((s) => { s.bills = s.bills.filter((b) => b.id !== id); });
          toast("Bill removed");
          refresh();
        }
      });
    },
  });
}

function guessIcon(name) {
  const n = name.toLowerCase();
  if (/rent|mortgage|hoa/.test(n)) return "🏠";
  if (/electric|power|water|gas bill|utility/.test(n)) return "💡";
  if (/net|wifi|fiber|broadband/.test(n)) return "🌐";
  if (/phone|mobile|cell/.test(n)) return "📱";
  if (/stream|netflix|hulu|disney|tv|prime|max/.test(n)) return "📺";
  if (/music|spotify/.test(n)) return "🎵";
  if (/gym|fitness/.test(n)) return "🏋️";
  if (/insur/.test(n)) return "🛡️";
  if (/car|auto/.test(n)) return "🚗";
  return "📄";
}
