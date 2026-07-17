/* Budget Bear — standard budget category catalog + custom-category resolution */

import { get } from "../store.js";
import { esc, escUrl } from "../format.js";

export const CATALOG = [
  { id: "housing",       name: "Housing",        icon: "🏠", essential: true },
  { id: "utilities",     name: "Utilities",      icon: "💡", essential: true },
  { id: "groceries",     name: "Groceries",      icon: "🛒", essential: true },
  { id: "transport",     name: "Transportation", icon: "🚗", essential: true },
  { id: "insurance",     name: "Insurance",      icon: "🛡️", essential: true },
  { id: "dining",        name: "Dining out",     icon: "🍽️", essential: false },
  { id: "subscriptions", name: "Subscriptions",  icon: "📺", essential: false },
  { id: "shopping",      name: "Shopping",       icon: "🛍️", essential: false },
  { id: "health",        name: "Health",         icon: "❤️", essential: true },
  { id: "entertainment", name: "Entertainment",  icon: "🎬", essential: false },
  { id: "personal",      name: "Personal care",  icon: "🧴", essential: false },
  { id: "debt",          name: "Debt payments",  icon: "💳", essential: true },
  { id: "savings",       name: "Savings",        icon: "🌱", essential: true },
  { id: "other",         name: "Other",          icon: "📦", essential: false },
];

const UNCATEGORIZED = { id: "uncategorized", name: "Uncategorized", icon: "🏷️", essential: false };

/** Resolve a category id to its display info.
    The user's own budget list comes first — that's where custom categories and
    custom images live, and where an added standard category carries the user's
    edits. Then the built-in CATALOG. A transaction whose category was later
    deleted resolves to a distinct "Uncategorized" placeholder rather than
    silently masquerading as "Other". */
export function catInfo(id) {
  const mine = get().budget.categories.find((c) => c.id === id);
  if (mine) return mine;
  return CATALOG.find((c) => c.id === id) || UNCATEGORIZED;
}

/** Inner markup for a category's icon: the uploaded image if it has one (and
    the URL is one of ours), otherwise the escaped emoji. Custom images can only
    ever be set by a premium user (the upload is server-gated), but esc()/escUrl
    run regardless — a category name/icon is now user-authored, i.e. an XSS sink
    the moment it isn't escaped. */
export function catIconHTML(c) {
  if (c && c.imageUrl) {
    const src = escUrl(c.imageUrl);
    if (src) return `<img class="cat-img" src="${src}" alt="">`;
  }
  return esc(c?.icon ?? "📦");
}

/** Text-only category icon for contexts that can't hold an <img> (an <option>,
    or inline "emoji name" runs). Custom-image categories fall back to emoji. */
export function catIconText(c) {
  return esc(c?.icon ?? "📦");
}

let customSeq = 0;
/** A category id that can never collide with a CATALOG id. */
export function newCategoryId() {
  customSeq += 1;
  return "custom-" + Date.now().toString(36) + customSeq.toString(36);
}

export const GOAL_TEMPLATES = [
  { id: "emergency",  name: "Emergency fund", icon: "🛟" },
  { id: "vacation",   name: "Vacation",       icon: "✈️" },
  { id: "debt",       name: "Pay off debt",   icon: "💳" },
  { id: "wedding",    name: "Wedding",        icon: "💍" },
  { id: "house",      name: "House",          icon: "🏡" },
  { id: "car",        name: "New car",        icon: "🚙" },
  { id: "business",   name: "Business",       icon: "💼" },
  { id: "investing",  name: "Investments",    icon: "📈" },
  { id: "custom",     name: "Custom goal",    icon: "🎯" },
];
