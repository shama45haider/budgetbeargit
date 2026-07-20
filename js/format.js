/* Budget Bear — formatting helpers */

import { get } from "./store.js";

/** Weeks in an average month. One source of truth for every weekly⇄monthly
    conversion (goals pacing, reviews, home targets) so the figures always agree. */
export const WEEKS_PER_MONTH = 4.345;

export function money(n, { sign = false, decimals = "auto" } = {}) {
  const cur = get().profile.currency || "$";
  const abs = Math.abs(n);
  // Show cents whenever the value is fractional. (Previously suppressed above
  // $10k, which silently rounded e.g. $10,000.50 to $10,001 — numbers must be
  // exact, so no size threshold.)
  const useDecimals = decimals === "auto" ? abs % 1 !== 0 : decimals;
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

/** A colour safe to drop inside style="...". esc() is not enough here: it
    leaves ';' and '(' intact, so a stored value could close one declaration
    and open another (background:url(...)). Only a literal hex passes. */
export function escCss(color, fallback = "#3E7A4D") {
  return /^#[0-9A-Fa-f]{6}$/.test(String(color ?? "")) ? color : fallback;
}

/** A URL safe for <img src>. Only our own public Storage objects are allowed,
    so a stored value can't beacon an attacker host on every render. */
export function escUrl(url) {
  const s = String(url ?? "");
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(s) ? esc(s) : "";
}

/** Months between now and an ISO date (fractional, min 0). Compares date-to-date
    (both floored to local midnight) so the result is stable through the day —
    otherwise the time-of-day on `now` made requiredMonthly drift hour to hour. */
export function monthsUntil(iso) {
  const today = parseISO(todayISO());
  const d = parseISO(iso);
  return Math.max(0, (d - today) / (86400000 * 30.44));
}

/** How far through the current month we are, 0–1, using the real number of days
    in the month. One shared definition so every "at this pace" projection agrees
    (previously insights divided by a flat 30.44, which exceeded 1.0 on the 31st). */
export function monthProgress(date = new Date()) {
  return date.getDate() / daysInMonth(date);
}
