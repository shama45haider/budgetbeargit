/* Budget Bear — standard budget category catalog */

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

export function catInfo(id) {
  return CATALOG.find((c) => c.id === id) || CATALOG[CATALOG.length - 1];
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
