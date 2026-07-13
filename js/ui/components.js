/* Budget Bear — shared UI primitives: sheet, toast, progress ring, animated numbers */

import { esc } from "../format.js";

/* ---------- Bottom sheet ---------- */

let activeSheet = null;

export function openSheet(contentHTML, { onOpen, onClose } = {}) {
  closeSheet();
  const root = document.getElementById("overlay-root");

  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `<div class="sheet-grab"></div><div class="sheet-body">${contentHTML}</div>`;

  root.append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add("open");
    sheet.classList.add("open");
  });

  const close = () => {
    backdrop.classList.remove("open");
    sheet.classList.remove("open");
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 380);
    activeSheet = null;
    onClose?.();
  };
  backdrop.addEventListener("click", close);
  activeSheet = { close, el: sheet };
  onOpen?.(sheet, close);
  return activeSheet;
}

export function closeSheet() {
  activeSheet?.close();
}

/* ---------- Toast ---------- */

let toastTimer = null;

export function toast(message) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.getElementById("overlay-root").appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

/* ---------- Progress ring (SVG) ---------- */

export function ring({ size = 120, stroke = 9, value = 0, labelHTML = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = c * (1 - clamped);
  return `
    <div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" aria-hidden="true">
        <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
      </svg>
      <div class="ring-label">${labelHTML}</div>
    </div>`;
}

/* ---------- Animated number ---------- */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate all [data-count-to] elements inside container. */
export function animateNumbers(container) {
  container.querySelectorAll("[data-count-to]").forEach((el) => {
    const target = parseFloat(el.dataset.countTo);
    const format = el.dataset.countFormat || "plain"; // plain | money
    const prefix = el.dataset.countPrefix || "";
    const render = (v) => {
      const rounded = Math.round(v);
      el.textContent = format === "money"
        ? prefix + rounded.toLocaleString("en-US")
        : prefix + rounded.toLocaleString("en-US");
    };
    if (reduceMotion || Math.abs(target) < 1) { render(target); return; }
    const dur = 650;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      render(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Confirm sheet ---------- */

export function confirmSheet({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      <p class="t-secondary" style="margin-bottom:20px">${esc(body)}</p>
      <div class="stack">
        <button class="btn ${danger ? "btn-danger-ghost" : "btn-primary"} btn-block" data-act="yes"
          ${danger ? 'style="border:1px solid var(--error);border-radius:var(--r-md)"' : ""}>${esc(confirmLabel)}</button>
        <button class="btn btn-ghost btn-block" data-act="no">Cancel</button>
      </div>
    `, {
      onOpen(sheet, close) {
        sheet.querySelector('[data-act="yes"]').onclick = () => { resolve(true); close(); };
        sheet.querySelector('[data-act="no"]').onclick = () => { resolve(false); close(); };
      },
      onClose() { resolve(false); },
    });
  });
}
