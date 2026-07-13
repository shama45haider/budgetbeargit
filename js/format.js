/* Budget Bear — formatting helpers */

import { get } from "./store.js";

export function money(n, { sign = false, decimals = "auto" } = {}) {
  const cur = get().profile.currency || "$";
  const abs = Math.abs(n);
  const useDecimals = decimals === "auto" ? abs % 1 !== 0 && abs < 10000 : decimals;
  const num = abs.toLocaleString("en-US", {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  });
  const prefix = n < 0 ? "−" : sign && n > 0 ? "+" : "";
  return `${prefix}${cur}${num}`;
}

export function moneyShort(n) {
  const cur = get().profile.currency || "$";
  const abs = Math.abs(n);
  let s;
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  else if (abs >= 10_000) s = (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  else s = Math.round(abs).toLocaleString("en-US");
  return (n < 0 ? "−" : "") + cur + s;
}

export function pct(n) {
  return Math.round(n) + "%";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shortDate(iso) {
  const d = parseISO(iso);
  return MONTHS[d.getMonth()] + " " + d.getDate();
}

export function relativeDay(iso) {
  const today = parseISO(todayISO());
  const d = parseISO(iso);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return shortDate(iso);
}

export function monthLabel(date = new Date()) {
  return MONTHS[date.getMonth()] + " " + date.getFullYear();
}

export function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function daysLeftInMonth(date = new Date()) {
  return daysInMonth(date) - date.getDate() + 1; // including today
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Escape text for safe HTML interpolation. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Months between now and an ISO date (fractional, min 0). */
export function monthsUntil(iso) {
  const now = new Date();
  const d = parseISO(iso);
  return Math.max(0, (d - now) / (86400000 * 30.44));
}
