/* Budget Bear — Profile: Discord-style customizable identity card (cloud)
   + local points, achievements, settings, and data controls. */

import { get, update, resetAll, exportJSON, importJSON } from "../store.js";
import { money, esc, shortDate } from "../format.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { openSheet, toast, confirmSheet, animateNumbers } from "../ui/components.js";
import { showAchievement } from "../ui/achievement.js";
import { navigate, refresh } from "../router.js";
import { currentUser, myProfile, updateProfile, uploadAvatar, signOut } from "../cloud/client.js";
import { cloudConfigured, DONATE_URL } from "../cloud/config.js";
import { redeemCode, friendlyCloudError } from "../cloud/api.js";
import { accentPickerHTML, bindAccentPicker } from "../data/accents.js";
import { authNext } from "./auth.js";
import { flairStyle, effectClass, tagHTML, levelFor } from "../data/shop.js";
import { infoDot, bindInfoDots, demoBannerHTML, bindDemoBanner } from "../data/glossary.js";

export function renderProfile(view) {
  const s = get();
  const unlockedCount = Object.keys(s.achievements.unlocked).length;
  const user = currentUser();
  const p = myProfile();
  const points = user && p ? (p.points ?? 0) : s.points.balance;
  const lvl = levelFor(user && p ? (p.lifetime_points ?? 0) : s.points.balance);

  view.innerHTML = `
  <div class="screen">
    ${demoBannerHTML()}
    <header class="screen-header">
      <h1>Profile</h1>
      ${user ? `<button class="btn-ghost t-small" id="btn-signout">Sign out</button>` : ""}
    </header>

    ${user && p ? identityCard(p) : signedOutCard()}

    <div class="profile-stats card" style="margin-top:12px">
      <div><strong class="t-num" data-count-to="${points}">0</strong><small>Bear Points ${infoDot("bear-points")}</small></div>
      <div><strong class="t-num">${s.points.streak}</strong><small>Streak ${infoDot("streak")}</small></div>
      <div><strong class="t-num">${lvl.level}</strong><small>${esc(lvl.title)} ${infoDot("level")}</small></div>
    </div>

    <button class="card tappable shop-cta" id="btn-shop" style="width:100%;text-align:left;margin-top:12px">
      <div class="row">
        <div class="icon-bubble" style="width:44px;height:44px;border-radius:14px;font-size:20px">🛍️</div>
        <div class="grow">
          <h3>Points Shop</h3>
          <div class="t-small t-secondary">Spend <strong class="t-num">${points}</strong> points on flairs, tags, and name effects</div>
        </div>
        <span class="chev">›</span>
      </div>
    </button>

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
      ${settingRow("What I make each month", money(s.income.monthly), "income")}
      ${settingRow("Savings I have right now", money(s.settings.savingsBuffer || 0), "cushion")}
      ${settingRow("What I owe", s.debts.length ? s.debts.length + " tracked · " + money(s.debts.reduce((a, d) => a + d.balance, 0)) : "Nothing tracked", "debts")}
    </div>

    <h2 class="section-title">Data</h2>
    <div class="list">
      <button class="list-row" id="btn-export"><div class="main"><div class="name">Export data</div><div class="meta">Download a JSON backup</div></div><span class="chev">›</span></button>
      <button class="list-row" id="btn-import"><div class="main"><div class="name">Import data</div><div class="meta">Restore from a backup</div></div><span class="chev">›</span></button>
      <button class="list-row" id="btn-reset"><div class="main"><div class="name" style="color:var(--error)">Start over</div><div class="meta">Erase local data on this device</div></div></button>
    </div>

    <h2 class="section-title">About</h2>
    <div class="list">
      <button class="list-row" id="btn-plans"><div class="main"><div class="name">Budget Bear Plans</div><div class="meta">Free, Premium, and Business</div></div><span class="chev">›</span></button>
      ${user && (DONATE_URL || true) ? `<button class="list-row" id="btn-support"><div class="main"><div class="name">♥ Support Budget Bear</div><div class="meta">Help keep the bear fed — get an exclusive thank-you</div></div><span class="chev">›</span></button>` : ""}
      <a class="list-row" href="https://budgetbear.xyz" target="_blank" rel="noopener"><div class="main"><div class="name">budgetbear.xyz</div><div class="meta">Website</div></div><span class="chev">›</span></a>
      <a class="list-row" href="mailto:help@budgetbear.xyz"><div class="main"><div class="name">help@budgetbear.xyz</div><div class="meta">Support</div></div><span class="chev">›</span></a>
    </div>
    <p class="t-small t-secondary" style="text-align:center;margin-top:20px">
      Your budget stays on this device.${user ? " Your account stores your profile, points, and groups." : ""}
    </p>
  </div>`;

  animateNumbers(view);

  view.querySelector("#btn-edit-profile")?.addEventListener("click", () => openEditProfile(view));
  view.querySelector("#btn-create-profile")?.addEventListener("click", () => {
    authNext("/profile");
    navigate("/auth");
  });
  view.querySelector("#btn-shop").addEventListener("click", () => navigate("/shop"));
  bindInfoDots(view);
  bindDemoBanner(view);
  view.querySelector("#btn-signout")?.addEventListener("click", async () => {
    if (await confirmSheet({ title: "Sign out?", body: "Your local budget stays on this device. Groups and profile need you signed in.", confirmLabel: "Sign out" })) {
      await signOut();
      toast("Signed out");
      refresh();
    }
  });

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

  view.querySelector("#btn-plans").addEventListener("click", () => navigate("/plans"));
  view.querySelector("#btn-support")?.addEventListener("click", openSupportSheet);
  view.querySelector("#btn-export").addEventListener("click", doExport);
  view.querySelector("#btn-import").addEventListener("click", doImport);
  view.querySelector("#btn-reset").addEventListener("click", async () => {
    if (await confirmSheet({ title: "Erase local data?", body: "This removes your budget, goals, and history from this device. Your online account and groups are not affected. No undo.", confirmLabel: "Erase local data", danger: true })) {
      resetAll();
      navigate("/onboarding");
    }
  });
}

/* ---------- identity card ---------- */

function identityCard(p) {
  const flair = flairStyle(p.equipped);
  const fx = effectClass(p.equipped);
  return `
  <section class="id-card" style="--banner:${esc(p.banner_color)};--accent:${esc(p.accent_color)}">
    <div class="id-banner" ${flair ? `style="${flair}"` : ""}></div>
    <div class="id-body">
      <div class="id-avatar-wrap">${bigAvatar(p, 76)}</div>
      <div class="row" style="align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <h2 class="id-name ${fx}">${esc(p.display_name)}</h2>
            ${tagHTML(p.equipped)}
          </div>
          ${p.pronouns ? `<span class="id-pronouns">${esc(p.pronouns)}</span>` : ""}
          ${p.status_emoji || p.status_text ? `
            <div class="id-status">${esc(p.status_emoji)} ${esc(p.status_text)}</div>` : ""}
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-edit-profile">Edit profile</button>
      </div>
      ${p.about ? `<p class="id-about">${esc(p.about)}</p>` : ""}
    </div>
  </section>`;
}

function bigAvatar(p, size) {
  if (p.avatar_url) {
    return `<img class="avatar" src="${esc(p.avatar_url)}" alt="" width="${size}" height="${size}"
      style="width:${size}px;height:${size}px;border:4px solid var(--surface)">`;
  }
  const initial = (p.display_name || "?").trim().charAt(0).toUpperCase();
  return `<span class="avatar avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;border:4px solid var(--surface);background:var(--accent);color:#fff">${esc(initial)}</span>`;
}

function signedOutCard() {
  return `
  <section class="card" style="text-align:center;padding:24px">
    <img src="assets/logo.png" alt="" width="60" height="60" style="margin:0 auto 10px">
    <h2>Create your profile</h2>
    <p class="t-secondary t-small" style="margin:6px auto 14px;max-width:260px">
      Pick any name, upload an avatar, choose your colors — and unlock Group Links with friends.
    </p>
    <button class="btn btn-primary" id="btn-create-profile" style="min-width:200px">
      ${cloudConfigured() ? "Sign in / create account" : "Setup required"}
    </button>
  </section>`;
}

/* ---------- edit profile sheet with live preview ---------- */

function openEditProfile(view) {
  const p = myProfile();
  const draft = {
    display_name: p.display_name,
    pronouns: p.pronouns,
    about: p.about,
    status_emoji: p.status_emoji,
    status_text: p.status_text,
    banner_color: p.banner_color,
    accent_color: p.accent_color,
    avatar_url: p.avatar_url,
  };

  openSheet(`
    <h2 class="sheet-title">Edit profile</h2>
    <div id="ep-preview">${identityPreview(draft)}</div>
    <form id="ep-form" class="stack" style="margin-top:14px">
      <label class="btn btn-secondary btn-block" style="cursor:pointer">
        Change avatar
        <input type="file" id="ep-avatar" accept="image/png,image/jpeg,image/webp" class="visually-hidden">
      </label>
      <div class="field"><label class="field-label" for="ep-name">Display name</label>
        <input class="input" id="ep-name" value="${esc(draft.display_name)}" maxlength="32" required></div>
      <div class="field"><label class="field-label" for="ep-pronouns">Pronouns (optional)</label>
        <input class="input" id="ep-pronouns" value="${esc(draft.pronouns)}" maxlength="24" placeholder="they/them"></div>
      <div class="row">
        <div class="field" style="width:86px"><label class="field-label" for="ep-emoji">Emoji</label>
          <input class="input" id="ep-emoji" value="${esc(draft.status_emoji)}" maxlength="4" placeholder="🌴" style="text-align:center"></div>
        <div class="field grow"><label class="field-label" for="ep-status">Status</label>
          <input class="input" id="ep-status" value="${esc(draft.status_text)}" maxlength="60" placeholder="Saving for Florida"></div>
      </div>
      <div class="field"><label class="field-label" for="ep-about">About me</label>
        <textarea class="input" id="ep-about" rows="2" maxlength="200" placeholder="A line about you">${esc(draft.about)}</textarea></div>
      <div class="field"><label class="field-label">Banner color</label>
        ${accentPickerHTML(draft.banner_color, { name: "banner" })}</div>
      <div class="field"><label class="field-label">Accent color</label>
        ${accentPickerHTML(draft.accent_color, { name: "accent" })}</div>
      <button class="btn btn-primary btn-block" id="ep-save">Save profile</button>
    </form>
  `, {
    onOpen(sheet, close) {
      const repaint = () => { sheet.querySelector("#ep-preview").innerHTML = identityPreview(draft); };
      const bind = (id, key) => sheet.querySelector(id).addEventListener("input", (e) => {
        draft[key] = e.target.value;
        repaint();
      });
      bind("#ep-name", "display_name");
      bind("#ep-pronouns", "pronouns");
      bind("#ep-emoji", "status_emoji");
      bind("#ep-status", "status_text");
      bind("#ep-about", "about");
      bindAccentPicker(sheet, "banner", (hex) => { draft.banner_color = hex; repaint(); });
      bindAccentPicker(sheet, "accent", (hex) => { draft.accent_color = hex; repaint(); });

      sheet.querySelector("#ep-avatar").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2MB"); return; }
        toast("Uploading…");
        try {
          draft.avatar_url = await uploadAvatar(file);
          repaint();
          toast("Avatar updated");
        } catch (err) {
          toast(err.message || "Upload failed");
        }
      });

      sheet.querySelector("#ep-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = sheet.querySelector("#ep-save");
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          await updateProfile({
            display_name: draft.display_name.trim() || "New Bear",
            pronouns: draft.pronouns.trim(),
            about: draft.about.trim(),
            status_emoji: draft.status_emoji.trim(),
            status_text: draft.status_text.trim(),
            banner_color: draft.banner_color,
            accent_color: draft.accent_color,
          });
          close();
          toast("Profile saved");
          refresh();
        } catch (err) {
          toast(err.message || "Couldn't save");
          btn.disabled = false;
          btn.textContent = "Save profile";
        }
      });
    },
  });
}

function identityPreview(d) {
  return `
  <div class="id-card" style="--banner:${esc(d.banner_color)};--accent:${esc(d.accent_color)}">
    <div class="id-banner" style="height:56px"></div>
    <div class="id-body" style="padding-top:0">
      <div class="id-avatar-wrap" style="margin-top:-30px">${bigAvatar(d, 60)}</div>
      <h3 class="id-name" style="font-size:var(--fs-16)">${esc(d.display_name || "Your name")}</h3>
      ${d.pronouns ? `<span class="id-pronouns">${esc(d.pronouns)}</span>` : ""}
      ${d.status_emoji || d.status_text ? `<div class="id-status">${esc(d.status_emoji)} ${esc(d.status_text)}</div>` : ""}
      ${d.about ? `<p class="id-about">${esc(d.about)}</p>` : ""}
    </div>
  </div>`;
}

/* ---------- Support Budget Bear ---------- */

function openSupportSheet() {
  openSheet(`
    <h2 class="sheet-title">♥ Support Budget Bear</h2>
    <p class="t-secondary" style="font-size:var(--fs-14);line-height:1.5;margin-bottom:14px">
      Budget Bear is free to use. If it's helped your money, a small donation keeps
      it running — and earns you a thank-you nobody can buy:</p>
    <div class="list" style="margin-bottom:14px">
      <div class="list-row" style="min-height:48px"><div class="icon-bubble">👑</div>
        <div class="main"><div class="name">Aurora Crown flair</div><div class="meta">The only animated flair in the app</div></div></div>
      <div class="list-row" style="min-height:48px"><div class="icon-bubble">💛</div>
        <div class="main"><div class="name">Early Supporter tag</div><div class="meta">Shows next to your name forever</div></div></div>
      <div class="list-row" style="min-height:48px"><div class="icon-bubble">🪙</div>
        <div class="main"><div class="name">200 Bear Points</div><div class="meta">Straight to your balance</div></div></div>
    </div>
    ${DONATE_URL ? `
      <a class="btn btn-primary btn-block" href="${esc(DONATE_URL)}" target="_blank" rel="noopener" style="margin-bottom:8px">Donate</a>
      <p class="t-small t-secondary" style="text-align:center;margin-bottom:14px">After donating you'll get a Supporter code by email.</p>
    ` : `
      <p class="t-small t-secondary" style="text-align:center;margin-bottom:14px">Donations open soon. Already have a Supporter code? Redeem it below.</p>
    `}
    <form id="redeem-form">
      <input class="input" id="redeem-code" placeholder="Supporter code" autocomplete="off"
        style="text-transform:uppercase;text-align:center;font-weight:var(--fw-semibold)">
      <button class="btn btn-secondary btn-block" style="margin-top:10px">Redeem code</button>
    </form>
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#redeem-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = sheet.querySelector("#redeem-code").value.trim();
        if (!code) return;
        try {
          const res = await redeemCode(code);
          if (res.error === "invalid_code") { toast("That code doesn't look right"); return; }
          if (res.error === "code_used_up") { toast("That code has already been used"); return; }
          if (res.error === "already_redeemed") { toast("You've already redeemed this one"); return; }
          close();
          toast("Thank you! +200 points, Aurora Crown, and your Supporter tag are yours");
          await import("../cloud/client.js").then((m) => m.loadMyProfile());
          refresh();
        } catch (err) {
          toast(friendlyCloudError(err, "Couldn't redeem that code"));
        }
      });
    },
  });
}

/* ---------- local settings (unchanged behavior) ---------- */

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
