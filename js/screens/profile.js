/* Budget Bear — Profile: points, achievements, settings, data. */

import { get, update, resetAll, exportJSON, importJSON } from "../store.js";
import { money, esc, shortDate } from "../format.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { openSheet, toast, confirmSheet, animateNumbers } from "../ui/components.js";
import { showAchievement } from "../ui/achievement.js";
import { navigate, refresh } from "../router.js";

export function renderProfile(view) {
  const s = get();
  const unlockedCount = Object.keys(s.achievements.unlocked).length;

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header">
      <h1>Profile</h1>
    </header>

    <section class="card" style="text-align:center;padding:24px">
      <img src="assets/logo.png" alt="" width="64" height="64" style="margin:0 auto 10px">
      <h2>${esc(s.profile.name || "Friend of the Bear")}</h2>
      <div class="t-small t-secondary">Member since ${s.profile.createdAt ? shortDate(s.profile.createdAt) : "today"}${s.profile.demo ? " · demo data" : ""}</div>
      <div class="profile-stats">
        <div><strong class="t-num" data-count-to="${s.points.balance}">0</strong><small>Bear Points</small></div>
        <div><strong class="t-num">${s.points.streak}</strong><small>Day streak</small></div>
        <div><strong class="t-num">${unlockedCount}</strong><small>Achievements</small></div>
      </div>
    </section>

    <h2 class="section-title">Achievements · ${unlockedCount}/${ACHIEVEMENTS.length}</h2>
    <div class="ach-grid">
      ${ACHIEVEMENTS.map((a) => {
        const when = s.achievements.unlocked[a.id];
        return `<button class="ach-tile ${when ? "" : "locked"}" data-ach="${a.id}" aria-label="${esc(a.title)}${when ? "" : " (locked)"}">
          <img src="assets/bears/${a.bear}" alt="">
          <small>${esc(a.title)}</small>
        </button>`;
      }).join("")}
    </div>

    <h2 class="section-title">Points history</h2>
    <div class="list">
      ${s.points.history.slice(0, 6).map((h) => `
        <div class="list-row" style="min-height:48px">
          <div class="main"><div class="name" style="font-size:var(--fs-14)">${esc(h.reason)}</div>
          <div class="meta">${shortDate(h.date)}</div></div>
          <div class="end"><div class="amount t-num t-pos">+${h.amount}</div></div>
        </div>`).join("") || `<div class="list-row"><div class="main t-secondary t-small">Earn points with daily check-ins and goal contributions.</div></div>`}
    </div>

    <h2 class="section-title">Money settings</h2>
    <div class="list">
      ${settingRow("Monthly income", money(s.income.monthly), "income")}
      ${settingRow("Savings on hand", money(s.settings.savingsBuffer || 0), "cushion")}
      ${settingRow("Debts", s.debts.length ? s.debts.length + " tracked · " + money(s.debts.reduce((a, d) => a + d.balance, 0)) : "None tracked", "debts")}
    </div>

    <h2 class="section-title">Data</h2>
    <div class="list">
      <button class="list-row" id="btn-export"><div class="main"><div class="name">Export data</div><div class="meta">Download a JSON backup</div></div><span class="chev">›</span></button>
      <button class="list-row" id="btn-import"><div class="main"><div class="name">Import data</div><div class="meta">Restore from a backup</div></div><span class="chev">›</span></button>
      <button class="list-row" id="btn-reset"><div class="main"><div class="name" style="color:var(--error)">Start over</div><div class="meta">Erase everything on this device</div></div></button>
    </div>

    <h2 class="section-title">About</h2>
    <div class="list">
      <a class="list-row" href="https://budgetbear.xyz" target="_blank" rel="noopener"><div class="main"><div class="name">budgetbear.xyz</div><div class="meta">Website</div></div><span class="chev">›</span></a>
      <a class="list-row" href="mailto:help@budgetbear.xyz"><div class="main"><div class="name">help@budgetbear.xyz</div><div class="meta">Support</div></div><span class="chev">›</span></a>
    </div>
    <p class="t-small t-secondary" style="text-align:center;margin-top:20px">Your data never leaves this device.</p>
  </div>`;

  animateNumbers(view);

  view.querySelectorAll("[data-ach]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = ACHIEVEMENTS.find((x) => x.id === b.dataset.ach);
      const when = get().achievements.unlocked[a.id];
      if (when) showAchievement({ ...a, points: 0 });
      else openSheet(`
        <h2 class="sheet-title">🔒 ${esc(a.title)}</h2>
        <p class="t-secondary">${esc(a.desc)}</p>
        ${a.points ? `<p class="t-small t-secondary" style="margin-top:8px">Worth ${a.points} Bear Points.</p>` : ""}
      `);
    }));

  view.querySelectorAll("[data-setting]").forEach((b) =>
    b.addEventListener("click", () => openSetting(b.dataset.setting)));

  view.querySelector("#btn-export").addEventListener("click", doExport);
  view.querySelector("#btn-import").addEventListener("click", doImport);
  view.querySelector("#btn-reset").addEventListener("click", async () => {
    if (await confirmSheet({ title: "Erase all data?", body: "This removes your budget, goals, and history from this device. There is no undo.", confirmLabel: "Erase everything", danger: true })) {
      resetAll();
      navigate("/onboarding");
    }
  });
}

function settingRow(name, value, key) {
  return `<button class="list-row" data-setting="${key}">
    <div class="main"><div class="name">${name}</div></div>
    <div class="end"><div class="meta" style="font-size:var(--fs-14)">${value}</div></div>
    <span class="chev">›</span>
  </button>`;
}

function openSetting(key) {
  const s = get();
  if (key === "debts") return openDebts();
  const cfg = {
    income: { title: "Monthly income", value: s.income.monthly, apply: (st, v) => { st.income.monthly = v; } },
    cushion: { title: "Savings on hand", value: s.settings.savingsBuffer || 0, apply: (st, v) => { st.settings.savingsBuffer = v; } },
  }[key];
  openSheet(`
    <h2 class="sheet-title">${cfg.title}</h2>
    <form id="set-form">
      <div class="amount-input-wrap"><span class="currency">$</span>
        <input class="input" id="set-value" inputmode="decimal" value="${cfg.value}"></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px">Save</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#set-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const v = parseFloat(sheet.querySelector("#set-value").value.replace(/[^0-9.]/g, ""));
        if (isNaN(v) || v < 0) return;
        update((st) => cfg.apply(st, v));
        close(); toast("Saved"); refresh();
      });
    },
  });
}

function openDebts() {
  const s = get();
  openSheet(`
    <h2 class="sheet-title">Debts</h2>
    ${s.debts.length ? `<div class="list" style="margin-bottom:14px">
      ${s.debts.map((d) => `
        <div class="list-row">
          <div class="main"><div class="name">${esc(d.name)}</div><div class="meta">${d.apr}% APR · min ${money(d.minPayment)}/mo</div></div>
          <div class="end"><div class="amount t-num">${money(d.balance)}</div>
            <button class="btn-ghost t-small" data-del-debt="${d.id}" style="color:var(--error)">Remove</button></div>
        </div>`).join("")}
    </div>` : `<p class="t-secondary t-small" style="margin-bottom:14px">Track debts so your coach can build payoff strategies.</p>`}
    <form id="debt-form" class="stack">
      <input class="input" id="d-name" placeholder="Name (e.g. Credit card)" required>
      <div class="row">
        <div class="amount-input-wrap grow"><span class="currency">$</span>
          <input class="input" id="d-balance" inputmode="decimal" placeholder="Balance" required></div>
        <input class="input" id="d-apr" inputmode="decimal" placeholder="APR %" style="width:100px" required>
      </div>
      <div class="amount-input-wrap"><span class="currency">$</span>
        <input class="input" id="d-min" inputmode="decimal" placeholder="Minimum payment / month" required></div>
      <button class="btn btn-secondary btn-block">Add debt</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelectorAll("[data-del-debt]").forEach((b) =>
        b.addEventListener("click", () => {
          update((st) => { st.debts = st.debts.filter((d) => d.id !== b.dataset.delDebt); });
          close(); toast("Debt removed"); refresh();
        }));
      sheet.querySelector("#debt-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = sheet.querySelector("#d-name").value.trim();
        const balance = parseFloat(sheet.querySelector("#d-balance").value.replace(/[^0-9.]/g, ""));
        const apr = parseFloat(sheet.querySelector("#d-apr").value.replace(/[^0-9.]/g, ""));
        const minPayment = parseFloat(sheet.querySelector("#d-min").value.replace(/[^0-9.]/g, ""));
        if (!name || [balance, apr, minPayment].some((v) => isNaN(v))) return;
        update((st) => { st.debts.push({ id: Date.now().toString(36), name, balance, apr, minPayment }); });
        close(); toast("Debt added"); refresh();
      });
    },
  });
}

function doExport() {
  const blob = new Blob([exportJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "budget-bear-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

function doImport() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJSON(reader.result);
        toast("Data restored");
        refresh();
      } catch {
        toast("That file doesn't look like a Budget Bear backup");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
