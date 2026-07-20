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
  /* High-end animated flairs (above the 600 ceiling) */
  { id: "flair-prism",   type: "flair", name: "Prism",       price: 850,
    css: "linear-gradient(120deg,#ff6ec4,#7873f5 25%,#4ADEDE 50%,#7873f5 75%,#ff6ec4) 0 0/300% 100%",
    anim: "flair-flow 6s linear infinite" },
  { id: "flair-molten",  type: "flair", name: "Molten Gold",  price: 1000,
    css: "linear-gradient(120deg,#7a4d00,#ffcf3f 30%,#fff6cf 48%,#ffcf3f 66%,#7a4d00) 0 0/280% 100%",
    anim: "flair-flow 5s ease-in-out infinite" },
  { id: "flair-galaxy",  type: "flair", name: "Galaxy",       price: 1200,
    css: "linear-gradient(120deg,#0b1026,#3a1c71 30%,#b06ce8 50%,#4a8fff 70%,#0b1026) 0 0/300% 100%",
    anim: "flair-flow 8s linear infinite" },
  { id: "flair-lucky",   type: "flair", name: "Lucky Clover", price: 999999, exclusive: "spin",
    css: "linear-gradient(120deg,#1f7a33,#7FC96A 30%,#eaffde 50%,#7FC96A 70%,#1f7a33) 0 0/250% 100%",
    anim: "flair-flow 5s linear infinite" },
  { id: "flair-crown",   type: "flair", name: "Aurora Crown", price: 999999, exclusive: "donate",
    css: "linear-gradient(115deg,#00d4a0,#7FC96A 25%,#4aa8ff 50%,#b06ce8 75%,#00d4a0) 0 0/300% 100%",
    anim: "flair-flow 8s ease-in-out infinite" },

  /* ---------- Tags: slogan pills next to your name ---------- */
  { id: "tag-penny",       type: "tag", name: "Penny Pincher",      price: 100, color: "#3E7A4D" },
  { id: "tag-coupon",      type: "tag", name: "Coupon Royalty",     price: 150, color: "#B05A6E" },
  { id: "tag-machine",     type: "tag", name: "Money Machine",      price: 200, color: "#3D6B8E" },
  { id: "tag-stacking",    type: "tag", name: "Stacking Coins",     price: 200, color: "#C9A227" },
  { id: "tag-bse",         type: "tag", name: "Big Saver Energy",   price: 250, color: "#7A5C8E" },
  { id: "tag-slayer",      type: "tag", name: "Debt Slayer",        price: 300, color: "#B9704F" },
  { id: "tag-millionaire", type: "tag", name: "Future Millionaire", price: 350, color: "#2E3440", style: "gradient", glyph: "💰" },
  { id: "tag-ceo",         type: "tag", name: "CEO of Saving",      price: 400, color: "#C9A227", style: "metal", glyph: "👑" },
  /* High-end tags (above the 400 ceiling) with premium treatments */
  { id: "tag-legend",      type: "tag", name: "Living Legend",      price: 550, color: "#7A5C8E", style: "gradient", glyph: "🏆" },
  { id: "tag-diamond",     type: "tag", name: "Diamond Hands",      price: 700, color: "#8FB7CE", style: "metal", glyph: "💎" },
  { id: "tag-goat",        type: "tag", name: "Savings G.O.A.T.",   price: 900, color: "#C9A227", style: "holo", glyph: "🐐" },
  { id: "tag-jackpot",     type: "tag", name: "Jackpot",            price: 999999, exclusive: "spin", color: "#C9A227", style: "metal", glyph: "🎰" },
  { id: "tag-supporter",   type: "tag", name: "Early Supporter",    price: 999999, exclusive: "donate", color: "#c98b27", style: "gradient", glyph: "💛" },

  /* ---------- Effects: animated username styles ---------- */
  { id: "fx-shimmer", type: "effect", name: "Shimmer",     price: 300, cls: "fx-shimmer" },
  { id: "fx-wave",    type: "effect", name: "Bouncy",      price: 450, cls: "fx-wave" },
  { id: "fx-gold",    type: "effect", name: "Golden Glow", price: 500, cls: "fx-gold" },
  { id: "fx-rainbow", type: "effect", name: "Rainbow Flow",price: 600, cls: "fx-rainbow" },
  { id: "fx-sparkle", type: "effect", name: "Sparkle",     price: 700, cls: "fx-sparkle" },
  { id: "fx-frost",   type: "effect", name: "Frost",       price: 900, cls: "fx-frost" },
  /* High-end name effects (above the 900 ceiling) */
  { id: "fx-plasma",  type: "effect", name: "Plasma",      price: 1100, cls: "fx-plasma" },
  { id: "fx-ember",   type: "effect", name: "Ember",       price: 1300, cls: "fx-ember" },
  { id: "fx-prismatic", type: "effect", name: "Prismatic", price: 1600, cls: "fx-prismatic" },

  /* ---------- App Themes: repaint the whole app, with ambient effects ---------- */
  { id: "theme-midnight", type: "theme", name: "Midnight", price: 800,
    tagline: "Deep-forest dark mode with drifting fireflies",
    mock: { bg: "#0e1411", surface: "#171f19", accent: "#57a86b", text: "#e9efe9" } },
  { id: "theme-sakura", type: "theme", name: "Sakura Dream", price: 800,
    tagline: "Soft pink everything, petals falling as you save",
    mock: { bg: "#fdf3f7", surface: "#ffffff", accent: "#d6568f", text: "#33202b" } },
  { id: "theme-ocean", type: "theme", name: "Deep Ocean", price: 800,
    tagline: "Cool blue calm with bubbles floating up",
    mock: { bg: "#f2f8fb", surface: "#ffffff", accent: "#2f7fa8", text: "#16222b" } },
  { id: "theme-royal", type: "theme", name: "Royal Gold", price: 1500,
    tagline: "Black-and-gold luxury with a golden shimmer",
    mock: { bg: "#14120c", surface: "#1e1b12", accent: "#c9a227", text: "#f3ecd8" } },
  { id: "theme-amethyst", type: "theme", name: "Amethyst Haze", price: 800,
    tagline: "Dreamy purple with soft light orbs floating by",
    mock: { bg: "#f7f3fc", surface: "#ffffff", accent: "#8b5fc7", text: "#2a2033" } },
  { id: "theme-moneyrain", type: "theme", name: "Money Rain", price: 1200,
    tagline: "Bank-vault green and gold — cash literally falls",
    mock: { bg: "#0c1410", surface: "#14211a", accent: "#3fae62", text: "#e6f0e8" } },
  { id: "theme-crimson", type: "theme", name: "Crimson Ember", price: 800,
    tagline: "Smoldering dark red with embers drifting up",
    mock: { bg: "#160e0e", surface: "#211414", accent: "#d94f4f", text: "#f2e6e4" } },
  /* High-end themes (above the 1500 ceiling) with signature ambient effects */
  { id: "theme-obsidian", type: "theme", name: "Obsidian Prism", price: 1800,
    tagline: "Jet-black glass with a slow rainbow prism shimmer",
    mock: { bg: "#0a0a0e", surface: "#141419", accent: "#8a7bff", text: "#ecebf5" } },
  { id: "theme-emerald", type: "theme", name: "Emerald Vault", price: 2000,
    tagline: "Deep emerald and gold with drifting light motes",
    mock: { bg: "#08140f", surface: "#0f2019", accent: "#2fbf71", text: "#e7f3ec" } },
  { id: "theme-aurora", type: "theme", name: "Aurora Borealis", price: 2500,
    tagline: "Northern-lights ribbons sweeping across a night sky",
    mock: { bg: "#070c14", surface: "#101826", accent: "#4fd2c2", text: "#e6f0f2" } },
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
  if (!item) return "";
  return `background:${item.css};${item.anim ? `animation:${item.anim};` : ""}`;
}

/** Class for a name effect, or "". */
export function effectClass(equipped) {
  const item = equipped?.effect ? shopItem(equipped.effect) : null;
  return item ? item.cls : "";
}

/** HTML for an equipped tag pill, or "". Supports an optional premium `style`
    (gradient|metal|holo) and a leading `glyph`. */
export function tagHTML(equipped) {
  const item = equipped?.tag ? shopItem(equipped.tag) : null;
  if (!item) return "";
  const cls = item.style ? ` tag-${item.style}` : "";
  const glyph = item.glyph ? `<span class="tag-glyph">${item.glyph}</span>` : "";
  return `<span class="user-tag${cls}" style="--tag:${item.color}">${glyph}${item.name}</span>`;
}
