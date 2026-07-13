/* Budget Bear — realistic sample data for demo mode.
   Generated relative to today so the demo always feels current. */

import { uid } from "../store.js";

function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

function monthsFromNow(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return iso(d);
}

// Deterministic-ish pseudo random so amounts look organic but stable per day
let s = 42;
function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
function amt(min, max) { return Math.round((min + rnd() * (max - min)) * 100) / 100; }

export function buildSeed() {
  const categories = [
    { id: "housing", name: "Housing", icon: "🏠", limit: 1450, essential: true },
    { id: "utilities", name: "Utilities", icon: "💡", limit: 180, essential: true },
    { id: "groceries", name: "Groceries", icon: "🛒", limit: 420, essential: true },
    { id: "transport", name: "Transportation", icon: "🚗", limit: 220, essential: true },
    { id: "insurance", name: "Insurance", icon: "🛡️", limit: 160, essential: true },
    { id: "dining", name: "Dining out", icon: "🍽️", limit: 240, essential: false },
    { id: "subscriptions", name: "Subscriptions", icon: "📺", limit: 65, essential: false },
    { id: "shopping", name: "Shopping", icon: "🛍️", limit: 180, essential: false },
    { id: "entertainment", name: "Entertainment", icon: "🎬", limit: 100, essential: false },
    { id: "savings", name: "Savings", icon: "🌱", limit: 600, essential: true },
  ];

  const tx = [];
  const add = (categoryId, amount, note, date) =>
    tx.push({ id: uid(), categoryId, amount, note, date });

  // ~7 weeks of organic history
  for (let d = 49; d >= 0; d--) {
    const date = daysAgo(d);
    const dow = new Date(date + "T12:00").getDay();
    if (rnd() < 0.55) add("groceries", amt(18, 82), ["Trader Joe's", "Kroger", "Whole Foods", "Corner market"][Math.floor(rnd() * 4)], date);
    if ((dow === 5 || dow === 6) && rnd() < 0.6) add("dining", amt(24, 68), ["Dinner out", "Brunch", "Thai takeout", "Pizza night"][Math.floor(rnd() * 4)], date);
    else if (rnd() < 0.22) add("dining", amt(9, 26), ["Coffee & pastry", "Lunch", "Burrito bowl"][Math.floor(rnd() * 3)], date);
    if (rnd() < 0.18) add("transport", amt(28, 52), ["Gas", "Fuel"][Math.floor(rnd() * 2)], date);
    if (rnd() < 0.08) add("shopping", amt(20, 95), ["Target run", "Amazon", "New shirt"][Math.floor(rnd() * 3)], date);
    if (rnd() < 0.06) add("entertainment", amt(12, 45), ["Movie tickets", "Concert", "Mini golf"][Math.floor(rnd() * 3)], date);
  }

  // Fixed monthly items for current + previous month
  for (const back of [0, 1]) {
    const d = new Date();
    d.setMonth(d.getMonth() - back);
    const first = iso(new Date(d.getFullYear(), d.getMonth(), 1));
    const fifth = iso(new Date(d.getFullYear(), d.getMonth(), 5));
    if (new Date(first) <= new Date()) {
      add("housing", 1450, "Rent", first);
      add("savings", 600, "Auto-transfer to savings", first);
    }
    if (new Date(fifth) <= new Date()) {
      add("utilities", amt(130, 165), "Electric & water", fifth);
      add("subscriptions", 15.99, "Streaming", fifth);
      add("subscriptions", 11.99, "Music", fifth);
      add("insurance", 155, "Auto insurance", fifth);
    }
  }

  const goals = [
    {
      id: uid(), name: "Emergency fund", icon: "🛟", target: 6000, saved: 3150,
      deadline: monthsFromNow(8), priority: "high", createdAt: daysAgo(160), completedAt: null,
    },
    {
      id: uid(), name: "Japan trip", icon: "✈️", target: 3200, saved: 1240,
      deadline: monthsFromNow(6), priority: "medium", createdAt: daysAgo(90), completedAt: null,
    },
    {
      id: uid(), name: "New laptop", icon: "💻", target: 1500, saved: 1500,
      deadline: daysAgo(12), priority: "low", createdAt: daysAgo(200), completedAt: daysAgo(12),
    },
  ];

  const bills = [
    { id: uid(), name: "Rent", amount: 1450, dueDay: 1, icon: "🏠", autopay: true },
    { id: uid(), name: "Electric & water", amount: 148, dueDay: 5, icon: "💡", autopay: true },
    { id: uid(), name: "Auto insurance", amount: 155, dueDay: 5, icon: "🛡️", autopay: true },
    { id: uid(), name: "Internet", amount: 60, dueDay: 18, icon: "🌐", autopay: false },
    { id: uid(), name: "Phone", amount: 45, dueDay: 22, icon: "📱", autopay: true },
    { id: uid(), name: "Streaming", amount: 15.99, dueDay: 5, icon: "📺", autopay: true },
    { id: uid(), name: "Music", amount: 11.99, dueDay: 5, icon: "🎵", autopay: true },
    { id: uid(), name: "Gym", amount: 32, dueDay: 15, icon: "🏋️", autopay: true },
  ];

  const debts = [
    { id: uid(), name: "Credit card", balance: 1850, apr: 22.9, minPayment: 65 },
    { id: uid(), name: "Student loan", balance: 8400, apr: 5.1, minPayment: 120 },
  ];

  const checkIns = [];
  for (let d = 5; d >= 1; d--) checkIns.push(daysAgo(d));

  return {
    profile: {
      name: "Sam",
      currency: "$",
      paySchedule: "semimonthly",
      onboarded: true,
      demo: true,
      createdAt: daysAgo(160),
    },
    income: { monthly: 4800 },
    budget: { categories },
    transactions: tx.sort((a, b) => b.date.localeCompare(a.date)),
    bills,
    goals,
    debts,
    habits: { lastCheckIn: daysAgo(1), checkIns },
    points: {
      balance: 385,
      streak: 5,
      bestStreak: 12,
      history: [
        { id: uid(), reason: "Daily check-in", amount: 10, date: daysAgo(1) },
        { id: uid(), reason: "Goal contribution", amount: 25, date: daysAgo(2) },
        { id: uid(), reason: "Daily check-in", amount: 10, date: daysAgo(2) },
        { id: uid(), reason: "Stayed under budget this week", amount: 40, date: daysAgo(4) },
        { id: uid(), reason: "Daily check-in", amount: 10, date: daysAgo(4) },
      ],
    },
    achievements: {
      unlocked: {
        "first-plan": daysAgo(160),
        "first-goal": daysAgo(160),
        "first-100": daysAgo(140),
        "tracker-10": daysAgo(120),
        "streak-3": daysAgo(30),
        "goal-complete": daysAgo(12),
      },
    },
    settings: { savingsBuffer: 4390 },
  };
}
