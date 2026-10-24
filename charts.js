/* Life Dashboard – Linien-Diagramme (SVG, Breite wird beim Einhängen gemessen) */
"use strict";

const CHARTS = {};
function chartSlot(id, spec) {
  CHARTS[id] = spec;
  return `<div class="chart" data-chart="${id}" style="height:${spec.height || 200}px" role="img" aria-label="${esc(spec.label || "Diagramm")}"></div>`;
}
function mountCharts(root) {
  $$("[data-chart]", root).forEach((el) => { const s = CHARTS[el.dataset.chart]; if (s) drawLine(el, s); });
}
function niceStep(range, n = 4) {
  const raw = range / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
function drawLine(el, spec) {
  const W = Math.max(240, el.clientWidth), H = spec.height || 200;
  const M = { l: 38, r: 12, t: 12, b: 24 };
  const all = spec.series.flatMap((s) => s.pts);
  if (all.length === 0) { el.innerHTML = ""; return; }
  let x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x));
  if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y));
  const padY = Math.max((y1 - y0) * 0.15, spec.minPad || 0.5);
  y0 -= padY; y1 += padY;
  const step = niceStep(y1 - y0);
  y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (y) => M.t + (1 - (y - y0) / (y1 - y0)) * (H - M.t - M.b);
  const yFmt = spec.yFmt || ((v) => fmtMax(v, 1));
  const xFmt = spec.xFmt || ((v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }));
  let g = "";
  for (let v = y0; v <= y1 + step / 2; v += step) {
    const y = sy(v).toFixed(1);
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" style="stroke:var(--grid);stroke-width:1"/>`;
    g += `<text x="${M.l - 8}" y="${+y + 3.5}" text-anchor="end">${esc(yFmt(v))}</text>`;
  }
  const nx = Math.max(2, Math.min(5, Math.floor((W - M.l - M.r) / 90)));
  for (let i = 0; i <= nx; i++) {
    const v = x0 + ((x1 - x0) * i) / nx;
    const anchor = i === 0 ? "start" : i === nx ? "end" : "middle";
    g += `<text x="${sx(v).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc(xFmt(v))}</text>`;
  }
  let marks = "";
  for (const s of spec.series) {
    const pts = [...s.pts].sort((a, b) => a.x - b.x);
    if (s.kind === "dots") {
      marks += pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2.6" style="fill:${s.color}"/>`).join("");
    } else if (pts.length) {
      const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
      if (s.area) marks += `<path d="${d}L${sx(pts[pts.length - 1].x).toFixed(1)},${H - M.b}L${sx(pts[0].x).toFixed(1)},${H - M.b}Z" style="fill:${s.color};fill-opacity:.09;stroke:none"/>`;
      marks += `<path d="${d}" style="fill:none;stroke:${s.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>`;
      if (s.points) marks += pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" style="fill:${s.color};stroke:var(--surface);stroke-width:1.5"/>`).join("");
      const e = pts[pts.length - 1];
      marks += `<circle cx="${sx(e.x).toFixed(1)}" cy="${sy(e.y).toFixed(1)}" r="5" style="fill:${s.color};stroke:var(--surface);stroke-width:2"/>`;
    }
  }
  const hov = `<line class="xh" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" style="stroke:var(--ink-3);stroke-width:1;stroke-dasharray:3 3;opacity:0"/><circle class="xd" r="5.5" cx="-20" cy="-20" style="fill:var(--ink);stroke:var(--surface);stroke-width:2;opacity:0"/>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}${marks}${hov}<rect x="${M.l}" y="0" width="${W - M.l - M.r}" height="${H}" style="fill:transparent;cursor:crosshair"/></svg><div class="tip" hidden></div>`;
  const main = [...(spec.series.find((s) => s.hover) || spec.series[0]).pts].sort((a, b) => a.x - b.x);
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector(".xh"), xd = el.querySelector(".xd");
  const show = (clientX) => {
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = main[0], bd = Infinity;
    for (const p of main) { const d = Math.abs(sx(p.x) - px); if (d < bd) { bd = d; best = p; } }
    const cx = sx(best.x), cy = sy(best.y);
    xh.setAttribute("x1", cx); xh.setAttribute("x2", cx); xh.style.opacity = 1;
    xd.setAttribute("cx", cx); xd.setAttribute("cy", cy); xd.style.opacity = 1;
    tip.innerHTML = spec.tip ? spec.tip(best) : `<b>${esc(yFmt(best.y))}</b> · ${esc(xFmt(best.x))}`;
    tip.hidden = false;
    const left = Math.min(Math.max((cx / W) * r.width, 60), r.width - 60);
    tip.style.left = left + "px"; tip.style.top = (cy / H) * r.height + "px";
  };
  const hide = () => { tip.hidden = true; xh.style.opacity = 0; xd.style.opacity = 0; };
  svg.addEventListener("pointermove", (e) => show(e.clientX));
  svg.addEventListener("pointerdown", (e) => show(e.clientX));
  svg.addEventListener("pointerleave", hide);
}
