/* Budget Bear — the Points Shop.
   Spend Bear Points on flairs, slogan tags, and animated name effects.
   Prices and balances are enforced server-side (buy_item RPC). */

import { get } from "../store.js";
import { esc } from "../format.js";
import { currentUser, myProfile, loadMyProfile } from "../cloud/client.js";
import * as api from "../cloud/api.js";
import { SHOP_ITEMS, shopItem, levelFor, flairStyle, effectClass, tagHTML } from "../data/shop.js";
import { openSheet, toast, animateNumbers } from "../ui/components.js";
import { showLoader, hideLoader } from "../ui/loader.js";
import { applyTheme, previewTheme } from "../ui/theme.js";
import { navigate, refresh } from "../router.js";
import { authNext } from "./auth.js";
import { infoDot, bindInfoDots } from "../data/glossary.js";

let owned = null; // cached item ids for this visit

export function renderShop(view) {
  const signedIn = !!currentUser();

  view.innerHTML = `
  <div class="screen">
    <header class="screen-header">
      <div class="row" style="gap:8px">
        <button class="wizard-back" id="shop-back" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <h1>Shop</h1>
      </div>
      <span class="sub points-balance" id="shop-balance"></span>
    </header>
    <div id="shop-body">
      <div class="skeleton" style="height:120px;margin-bottom:12px"></div>
      <div class="skeleton" style="height:90px;margin-bottom:8px"></div>
      <div class="skeleton" style="height:90px"></div>
    </div>
  </div>`;

  view.querySelector("#shop-back").addEventListener("click", () => navigate("/profile"));

  if (!signedIn) {
    paintBrowseOnly(view);
    return;
  }

  Promise.all([api.myItems(), loadMyProfile()])
    .then(([items, profile]) => {
      if (!view.isConnected) return;
      owned = new Set(items);
      paint(view, profile);
    })
    .catch(() => {
      if (!view.isConnected) return;
      view.querySelector("#shop-body").innerHTML =
        `<div class="callout danger"><span>⚠️</span><div>Couldn't load the shop. Check your connection and try again.</div></div>`;
    });
}

/* ---------- signed-in shop ---------- */

function paint(view, profile) {
  const equipped = profile.equipped || {};
  const lvl = levelFor(profile.lifetime_points || 0);

  view.querySelector("#shop-balance").innerHTML =
    `<img src="assets/bears/coinbear.png" alt="" width="18" height="18" style="vertical-align:-3px"> <strong class="t-num" data-count-to="${profile.points || 0}">0</strong> points ${infoDot("bear-points")}`;

  view.querySelector("#shop-body").innerHTML = `
    ${previewCard(profile, equipped)}

    <div class="card" style="padding:12px 16px;margin-top:12px">
      <div class="row">
        <div class="grow">
          <div class="t-small" style="font-weight:var(--fw-semibold)">Level ${lvl.level} · ${esc(lvl.title)} ${infoDot("level")}</div>
          <div class="t-small t-secondary">${lvl.nextAt ? `${lvl.toNext} points to the next level` : "Top level reached"}</div>
        </div>
      </div>
      <div class="progress" style="margin-top:8px"><i style="width:${Math.round(lvl.progress * 100)}%"></i></div>
    </div>

    ${section("App Themes", "Repaint the whole app — new colors, new mood, living effects", "theme", equipped)}
    ${section("Flairs", "Colorful banner + avatar ring your friends see on leaderboards", "flair", equipped)}
    ${section("Slogan tags", "A little badge that shows off next to your name", "tag", equipped)}
    ${section("Name effects", "Make your username move, shine, and sparkle", "effect", equipped)}

    <p class="t-small t-secondary" style="text-align:center;margin:20px 0 4px">
      Earn points with the Daily Spin, daily check-ins, goal savings, and achievements.
    </p>`;

  animateNumbers(view);
  bindInfoDots(view);

  view.querySelectorAll("[data-item]").forEach((el) =>
    el.addEventListener("click", () => openItem(el.dataset.item, profile, view)));
}

function previewCard(profile, equipped) {
  const fx = effectClass(equipped);
  const flair = flairStyle(equipped);
  const initial = (profile.display_name || "?").trim().charAt(0).toUpperCase();
  return `
  <div class="id-card shop-preview" style="--banner:${esc(profile.banner_color)};--accent:${esc(profile.accent_color)}">
    <div class="id-banner" style="height:58px;${flair}"></div>
    <div class="id-body" style="padding-top:0">
      <div class="id-avatar-wrap" style="margin-top:-28px">
        ${profile.avatar_url
          ? `<img class="avatar" src="${esc(profile.avatar_url)}" width="56" height="56" style="width:56px;height:56px;border:4px solid var(--surface)" alt="">`
          : `<span class="avatar avatar-fallback" style="width:56px;height:56px;font-size:23px;border:4px solid var(--surface);background:var(--accent);color:#fff">${esc(initial)}</span>`}
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <span class="id-name ${fx}" style="font-size:var(--fs-17)">${esc(profile.display_name)}</span>
        ${tagHTML(equipped)}
      </div>
      <div class="t-small t-secondary" style="margin-top:4px">This is how friends see you</div>
    </div>
  </div>`;
}

function section(title, subtitle, type, equipped) {
  const items = SHOP_ITEMS.filter((i) => i.type === type);
  return `
    <h2 class="section-title">${title}</h2>
    <p class="t-small t-secondary" style="margin:-6px 0 10px">${subtitle}</p>
    <div class="shop-grid">
      ${items.map((item) => {
        const isOwned = owned?.has(item.id);
        const isEquipped = equipped[type] === item.id;
        return `
        <button class="shop-tile ${isEquipped ? "equipped" : ""} ${item.type === "theme" ? "theme-tile" : ""}" data-item="${item.id}">
          ${swatch(item)}
          <small>${esc(item.name)}</small>
          ${item.tagline ? `<span class="theme-tagline">${esc(item.tagline)}</span>` : ""}
          ${isEquipped ? `<span class="shop-state on">Equipped</span>`
            : isOwned ? `<span class="shop-state">Owned</span>`
            : item.exclusive === "spin" ? `<span class="shop-price">🎡 Daily Spin prize</span>`
            : item.exclusive === "donate" ? `<span class="shop-price">💛 Supporter reward</span>`
            : `<span class="shop-price">${item.price} pts</span>`}
        </button>`;
      }).join("")}
    </div>`;
}

function swatch(item) {
  if (item.type === "theme") {
    return `<span class="theme-swatch" style="--mock-bg:${item.mock.bg};--mock-surface:${item.mock.surface};--mock-accent:${item.mock.accent}">
      <span class="mock-dot"></span></span>`;
  }
  if (item.type === "flair") {
    return `<span class="shop-swatch" style="background:${item.css}"></span>`;
  }
  if (item.type === "tag") {
    return `<span class="user-tag" style="--tag:${item.color};margin:6px 0">${esc(item.name)}</span>`;
  }
  return `<span class="shop-fx ${item.cls}">Abc</span>`;
}

function openItem(itemId, profile, view) {
  const item = shopItem(itemId);
  if (!item) return;
  const isOwned = owned.has(item.id);
  const equipped = profile.equipped || {};
  const isEquipped = equipped[item.type] === item.id;
  const canAfford = (profile.points || 0) >= item.price;

  openSheet(`
    <h2 class="sheet-title">${esc(item.name)}</h2>
    <div style="display:grid;place-items:center;padding:18px;background:var(--off-white);border-radius:var(--r-md);margin-bottom:16px">
      ${item.type === "flair" ? `<span class="shop-swatch" style="background:${item.css};width:180px;height:56px"></span>` : ""}
      ${item.type === "tag" ? `<span class="user-tag" style="--tag:${item.color};font-size:var(--fs-14);padding:6px 14px">${esc(item.name)}</span>` : ""}
      ${item.type === "effect" ? `<span class="shop-fx ${item.cls}" style="font-size:var(--fs-22)">${esc(profile.display_name)}</span>` : ""}
      ${item.type === "theme" ? `<span class="theme-swatch" style="width:200px;--mock-bg:${item.mock.bg};--mock-surface:${item.mock.surface};--mock-accent:${item.mock.accent}"><span class="mock-dot"></span></span>` : ""}
    </div>
    ${item.type === "theme" ? `<p class="t-small t-secondary" style="text-align:center;margin:-6px 0 14px">${esc(item.tagline)}</p>
      <button class="btn btn-secondary btn-block" id="shop-try" style="margin-bottom:8px">Try it for 5 seconds</button>` : ""}
    ${isOwned ? `
      <button class="btn ${isEquipped ? "btn-secondary" : "btn-primary"} btn-block" id="shop-equip">
        ${isEquipped ? "Take it off" : "Wear it"}
      </button>` : item.exclusive === "spin" ? `
      <div class="callout"><span>🎡</span><div>This one can't be bought — it's a rare prize on the <strong>Daily Spin</strong>. Spin every day for a chance!</div></div>` : item.exclusive === "donate" ? `
      <div class="callout"><span>💛</span><div>A thank-you reserved for supporters. Check <strong>Support Budget Bear</strong> on your Profile.</div></div>` : `
      <button class="btn btn-primary btn-block" id="shop-buy" ${canAfford ? "" : "disabled"}>
        Buy for ${item.price} points
      </button>
      ${canAfford ? "" : `<p class="t-small t-secondary" style="text-align:center;margin-top:10px">
        You have ${profile.points || 0} points. Daily check-ins are the fastest way to earn more.</p>`}`}
  `, {
    onOpen(sheet, close) {
      sheet.querySelector("#shop-try")?.addEventListener("click", () => {
        close();
        toast(`Previewing ${item.name}…`);
        const revert = previewTheme(item.id);
        setTimeout(revert, 5000);
      });
      sheet.querySelector("#shop-buy")?.addEventListener("click", async () => {
        close();
        showLoader("Wrapping it up…");
        try {
          const res = await api.buyItem(item.id);
          if (res.error === "not_enough_points") { hideLoader(); toast("Not enough points yet"); return; }
          if (res.error === "already_owned") { hideLoader(); owned.add(item.id); toast("You already own this"); return; }
          if (res.error) { hideLoader(); toast("Couldn't buy that"); return; }
          owned.add(item.id);
          // Auto-equip new purchases — buying and not seeing it feels broken.
          await api.equipItem(item.type, item.id);
          await loadMyProfile();
          if (item.type === "theme") applyTheme(item.id);
          hideLoader();
          toast(`${item.name} is yours — equipped!`);
          refresh();
        } catch (err) {
          hideLoader();
          toast(api.friendlyCloudError(err, "Couldn't buy that"));
        }
      });
      sheet.querySelector("#shop-equip")?.addEventListener("click", async () => {
        close();
        try {
          await api.equipItem(item.type, isEquipped ? null : item.id);
          await loadMyProfile();
          if (item.type === "theme") applyTheme(isEquipped ? null : item.id);
          toast(isEquipped ? "Taken off" : "Looking good");
          refresh();
        } catch (err) {
          toast(api.friendlyCloudError(err, "Couldn't change that"));
        }
      });
    },
  });
}

/* ---------- demo / signed-out ---------- */

function paintBrowseOnly(view) {
  view.querySelector("#shop-balance").textContent = "";
  view.querySelector("#shop-body").innerHTML = `
    <div class="callout" style="margin-bottom:14px">
      <span>✨</span>
      <div><strong>Window shopping.</strong> Create a free account to earn Bear Points and unlock these looks.</div>
    </div>
    ${["theme", "flair", "tag", "effect"].map((type) => `
      <h2 class="section-title">${type === "theme" ? "App Themes" : type === "flair" ? "Flairs" : type === "tag" ? "Slogan tags" : "Name effects"}</h2>
      <div class="shop-grid">
        ${SHOP_ITEMS.filter((i) => i.type === type).map((item) => `
          <div class="shop-tile locked-tile ${item.type === "theme" ? "theme-tile" : ""}">
            ${swatch(item)}
            <small>${esc(item.name)}</small>
            <span class="shop-price">${item.exclusive === "spin" ? "🎡 Daily Spin prize" : item.exclusive === "donate" ? "💛 Supporter reward" : item.price + " pts"}</span>
          </div>`).join("")}
      </div>`).join("")}
    <button class="btn btn-primary btn-block" style="margin-top:16px" id="shop-signup">Create a free account</button>`;

  view.querySelector("#shop-signup").addEventListener("click", () => {
    authNext("/shop");
    navigate("/auth");
  });
}
