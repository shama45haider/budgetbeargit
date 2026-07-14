/* Budget Bear — curated accent palette for profiles and group colors.
   Stays tasteful next to the brand greens; no neon. */

export const ACCENTS = [
  { id: "forest",    hex: "#3E7A4D", name: "Forest" },
  { id: "sage",      hex: "#7FC96A", name: "Sage" },
  { id: "pine",      hex: "#2D5C3A", name: "Pine" },
  { id: "ocean",     hex: "#3D6B8E", name: "Ocean" },
  { id: "slate",     hex: "#5B6770", name: "Slate" },
  { id: "plum",      hex: "#7A5C8E", name: "Plum" },
  { id: "terracotta",hex: "#B9704F", name: "Terracotta" },
  { id: "gold",      hex: "#C9A227", name: "Gold" },
  { id: "rose",      hex: "#B05A6E", name: "Rose" },
  { id: "midnight",  hex: "#2E3440", name: "Midnight" },
];

export function accentName(hex) {
  return ACCENTS.find((a) => a.hex.toLowerCase() === (hex || "").toLowerCase())?.name || "Custom";
}

export function accentPickerHTML(selectedHex, { name = "accent" } = {}) {
  return `<div class="accent-row" role="radiogroup" aria-label="Accent color">
    ${ACCENTS.map((a) => `
      <button type="button" class="accent-dot" role="radio" data-accent="${a.hex}" data-picker="${name}"
        aria-checked="${a.hex.toLowerCase() === (selectedHex || "").toLowerCase()}"
        aria-label="${a.name}" style="--dot:${a.hex}"></button>`).join("")}
  </div>`;
}

/** Wire an accent picker rendered with accentPickerHTML. */
export function bindAccentPicker(root, name, onPick) {
  root.querySelectorAll(`.accent-dot[data-picker="${name}"]`).forEach((d) =>
    d.addEventListener("click", () => {
      root.querySelectorAll(`.accent-dot[data-picker="${name}"]`).forEach((x) => x.setAttribute("aria-checked", "false"));
      d.setAttribute("aria-checked", "true");
      onPick(d.dataset.accent);
    }));
}
