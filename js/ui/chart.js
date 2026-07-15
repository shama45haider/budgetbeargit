/* Budget Bear — hand-rolled SVG charts.
   Colors are CSS variables so charts repaint with purchased themes;
   red stays reserved for negatives. */

const C = {
  forest: "var(--green-600)",
  sage: "var(--green-400)",
  mint: "var(--green-50)",
  gray: "var(--border)",
  text2: "var(--text-2)",
  red: "var(--error)",
};

/** Sparkline: values[], small inline trend. */
export function sparkline(values, { width = 96, height = 30, color = C.forest } = {}) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/** Vertical bar chart: items = [{label, value, muted?, negative?}] */
export function bars(items, { width = 320, height = 140, barRadius = 4 } = {}) {
  if (!items.length) return "";
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  const labelH = 18;
  const chartH = height - labelH;
  const gap = 8;
  const bw = Math.min(34, (width - gap * (items.length - 1)) / items.length);
  const totalW = bw * items.length + gap * (items.length - 1);
  const startX = (width - totalW) / 2;

  let svg = "";
  items.forEach((it, i) => {
    const h = Math.max(3, (Math.abs(it.value) / max) * (chartH - 8));
    const x = startX + i * (bw + gap);
    const y = chartH - h;
    const fill = it.negative ? C.red : it.muted ? C.gray : it.highlight ? C.sage : C.forest;
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
      rx="${barRadius}" fill="${fill}"/>`;
    svg += `<text x="${(x + bw / 2).toFixed(1)}" y="${height - 4}" text-anchor="middle"
      font-size="10" fill="${C.text2}">${it.label}</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${width} ${height}" aria-hidden="true">${svg}</svg>`;
}

/** Line/area projection chart with optional second (simulated) series.
    series: [{values, color, dashed?}], labels: x labels (sparse ok) */
export function lineChart(seriesList, labels, { width = 340, height = 170, zeroLine = true } = {}) {
  const all = seriesList.flatMap((s) => s.values);
  if (!all.length) return "";
  let min = Math.min(...all, 0);
  let max = Math.max(...all);
  if (max === min) max = min + 1;
  const padT = 10, padB = 22, padL = 6, padR = 6;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const xOf = (i, n) => padL + (i / (n - 1 || 1)) * w;
  const yOf = (v) => padT + (1 - (v - min) / (max - min)) * h;

  let svg = "";
  if (zeroLine && min < 0) {
    const y0 = yOf(0);
    svg += `<line x1="${padL}" y1="${y0}" x2="${width - padR}" y2="${y0}" stroke="${C.gray}" stroke-width="1" stroke-dasharray="3 4"/>`;
  }

  for (const s of seriesList) {
    const n = s.values.length;
    const pts = s.values.map((v, i) => `${xOf(i, n).toFixed(1)},${yOf(v).toFixed(1)}`);
    if (s.area) {
      const areaPts = [`${xOf(0, n)},${yOf(Math.max(min, 0))}`, ...pts, `${xOf(n - 1, n)},${(padT + h).toFixed(1)}`];
      svg += `<polygon points="${xOf(0, n)},${(padT + h).toFixed(1)} ${pts.join(" ")} ${xOf(n - 1, n)},${(padT + h).toFixed(1)}"
        fill="${s.color}" opacity="0.09"/>`;
    }
    svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round" ${s.dashed ? 'stroke-dasharray="5 5"' : ""}/>`;
  }

  // sparse x labels
  if (labels?.length) {
    const n = labels.length;
    labels.forEach((lb, i) => {
      if (!lb) return;
      svg += `<text x="${xOf(i, n).toFixed(1)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="${C.text2}">${lb}</text>`;
    });
  }

  return `<svg width="100%" viewBox="0 0 ${width} ${height}" aria-hidden="true">${svg}</svg>`;
}

export const chartColors = C;
