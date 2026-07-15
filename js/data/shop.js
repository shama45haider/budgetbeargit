/* Budget Bear — Points Shop catalog + level system.
   Visuals live here (CSS classes / gradients); PRICES are enforced
   server-side in shop_items — the values here are display only. */

export const SHOP_ITEMS = [
  /* ---------- Flairs: banner + avatar-ring themes ---------- */
  { id: "flair-mint",    type: "flair", name: "Mint Swirl",  price: 150,
    css: "linear-gradient(120deg,#7FC96A,#EDF8ED 60%,#7FC96A)" },
  { id: "flair-sunset",  type: "flair", name: "Sunset",      price: 250,
    css: "linear-gradient(120deg,#ff9a56,#ff6f91 55%,#c86dd7)" },
  { id: "flair-ocean",   type: "flair", name: "Ocean",       price: 250,
    css: "linear-gradient(120deg,#2193b0,#6dd5ed 60%,#a8e6cf)" },
  { id: "flair-night",   type: "flair", name: "Night Sky",   price: 300,
    css: "linear-gradient(135deg,#0f2027,#203a43 50%,#2c5364)" },
  { id: "flair-lava",    type: "flair", name: "Lava",        price: 400,
    css: "linear-gradient(120deg,#f83600,#f9d423)" },
  { id: "flair-rainbow", type: "flair", name: "Rainbow",     price: 500,
    css: "linear-gradient(120deg,#ff5f6d,#ffc371,#7FC96A,#2193b0,#c86dd7)" },
  { id: "flair-aurora",  type: "flair", name: "Aurora",      price: 550,
    css: "linear-gradient(130deg,#00c9a7,#7FC96A 40%,#845ec2 90%)" },
  { id: "flair-gold",    type: "flair", name: "Gold Foil",   price: 600,
    css: "linear-gradient(120deg,#b8860b,#ffd700 45%,#fff3b0 60%,#ffd700 75%,#b8860b)" },

  /* ---------- Tags: slogan pills next to your name ---------- */
  { id: "tag-penny",       type: "tag", name: "Penny Pincher",      price: 100, color: "#3E7A4D" },
  { id: "tag-coupon",      type: "tag", name: "Coupon Royalty",     price: 150, color: "#B05A6E" },
  { id: "tag-machine",     type: "tag", name: "Money Machine",      price: 200, color: "#3D6B8E" },
  { id: "tag-stacking",    type: "tag", name: "Stacking Coins",     price: 200, color: "#C9A227" },
  { id: "tag-bse",         type: "tag", name: "Big Saver Energy",   price: 250, color: "#7A5C8E" },
  { id: "tag-slayer",      type: "tag", name: "Debt Slayer",        price: 300, color: "#B9704F" },
  { id: "tag-millionaire", type: "tag", name: "Future Millionaire", price: 350, color: "#2E3440" },
  { id: "tag-ceo",         type: "tag", name: "CEO of Saving",      price: 400, color: "#2D5C3A" },

  /* ---------- Effects: animated username styles ---------- */
  { id: "fx-shimmer", type: "effect", name: "Shimmer",     price: 300, cls: "fx-shimmer" },
  { id: "fx-wave",    type: "effect", name: "Bouncy",      price: 450, cls: "fx-wave" },
  { id: "fx-gold",    type: "effect", name: "Golden Glow", price: 500, cls: "fx-gold" },
  { id: "fx-rainbow", type: "effect", name: "Rainbow Flow",price: 600, cls: "fx-rainbow" },
  { id: "fx-sparkle", type: "effect", name: "Sparkle",     price: 700, cls: "fx-sparkle" },
  { id: "fx-frost",   type: "effect", name: "Frost",       price: 900, cls: "fx-frost" },
];

export function shopItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id) || null;
}

/* ---------- Level system (from lifetime points) ---------- */

const LEVELS = [
  { at: 0,     title: "Cub" },
  { at: 100,   title: "Saver" },
  { at: 250,   title: "Smart Saver" },
  { at: 500,   title: "Money Bear" },
  { at: 1000,  title: "Budget Boss" },
  { at: 2000,  title: "Gold Bear" },
  { at: 3500,  title: "Coin Captain" },
  { at: 5500,  title: "Savings Star" },
  { at: 8000,  title: "Bear Legend" },
  { at: 12000, title: "Mythic Bear" },
];

export function levelFor(lifetimePoints = 0) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (lifetimePoints >= LEVELS[i].at) idx = i;
  }
  const next = LEVELS[idx + 1] || null;
  const base = LEVELS[idx].at;
  return {
    level: idx + 1,
    title: LEVELS[idx].title,
    progress: next ? (lifetimePoints - base) / (next.at - base) : 1,
    nextAt: next?.at ?? null,
    toNext: next ? next.at - lifetimePoints : 0,
  };
}

/* ---------- Rendering helpers used by profile + leaderboards ---------- */

/** Inline style for a flair background, or "" if none/unknown. */
export function flairStyle(equipped) {
  const item = equipped?.flair ? shopItem(equipped.flair) : null;
  return item ? `background:${item.css};` : "";
}

/** Class for a name effect, or "". */
export function effectClass(equipped) {
  const item = equipped?.effect ? shopItem(equipped.effect) : null;
  return item ? item.cls : "";
}

/** HTML for an equipped tag pill, or "". */
export function tagHTML(equipped) {
  const item = equipped?.tag ? shopItem(equipped.tag) : null;
  if (!item) return "";
  return `<span class="user-tag" style="--tag:${item.color}">${item.name}</span>`;
}
