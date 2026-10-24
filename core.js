/* Life Dashboard – Kern: Zustand, Helfer, Speicher, Navigation, Sheets */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const S = {
  view: "heute",
  google: null, sample: null,
  dbState: "ready",
  name: "",
  exams: [], workouts: [], weeks: {},
  finance: null, body: null, prefs: {}, news: null,
  loaded: {},                   // welche Snapshots schon da sind
  cal: { state: "loading", calendars: [], events: [], error: null, storedAt: null },
  mail: { state: "loading", threads: [], error: null, storedAt: null, filter: "inbox" },
  selDay: null,                 // ausgewählter Tag im Wochenstreifen (ymd)
  briefMode: null,              // "preview" | "review" – null = automatisch
};

/* ---------- Icons ---------- */
const ic = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  heute: ic('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>'),
  uni: ic('<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11"/><path d="M21.5 9v5"/>'),
  geld: ic('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/><path d="M6 6l9-3 1.5 3"/>'),
  training: ic('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
  koerper: ic('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a5 5 0 0 1 8 0l-2.6 2.2"/><circle cx="12" cy="12.3" r=".9"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: ic('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  refresh: ic('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  ext: ic('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  spark: ic('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
  copy: ic('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  trophy: ic('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4"/><path d="M12 13v4M8.5 20h7"/>'),
};
const VIEWS = [
  { id: "heute", label: "Heute" },
  { id: "uni", label: "Uni" },
  { id: "geld", label: "Finanzen" },
  { id: "training", label: "Training" },
  { id: "koerper", label: "Körper" },
];

/* ---------- Text & Zahlen ---------- */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const _ta = document.createElement("textarea");
const decode = (s) => { _ta.innerHTML = String(s ?? ""); return _ta.value; };
const parseNum = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const nf = (d = 0) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (n, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? "–" : nf(d).format(n));
const fmtMax = (n, d = 1) => (n === null || !Number.isFinite(n) ? "–" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: d }).format(n));
const eur = (n, d) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const dd = d ?? (Math.abs(n % 1) > 0.004 ? 2 : 0);
  return nf(dd).format(n) + " €";
};
const signed = (n, d = 1, unit = "") => (n === null || !Number.isFinite(n) ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), d) + unit);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Datum ---------- */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const localIso = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d) => { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dn);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 864e5 + 1) / 7) };
}
const weekKey = (d) => { const w = isoWeek(d); return `${w.year}-W${pad(w.week)}`; };
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const fmtDate = (d, o = { weekday: "short", day: "2-digit", month: "2-digit" }) => d.toLocaleDateString("de-DE", o);
const fmtTime = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
function relDay(d) {
  const n = dayDiff(new Date(), d);
  if (n === 0) return "Heute";
  if (n === 1) return "Morgen";
  if (n === -1) return "Gestern";
  return fmtDate(d);
}
function countdown(d) {
  const n = dayDiff(new Date(), d);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n < 0) return `vor ${-n} Tag${n === -1 ? "" : "en"}`;
  return `in ${n} Tagen`;
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), 2600);
}

/* ---------- Speicher (lokal auf dem Gerät) ---------- */
const DOCS = { "life/finance": "finance", "life/body": "body", "life/prefs": "prefs" };
const COLS = { exams: "exams", workouts: "workouts" };
const LS_KEY = "ld:data:v1";
const clean = (o) => JSON.parse(JSON.stringify(o));
function snapshotData() {
  const byId = (arr) => Object.fromEntries(arr.map(({ id, ...rest }) => [id, rest]));
  return { app: "life-dashboard", version: 1, exportedAt: new Date().toISOString(), exams: byId(S.exams), workouts: byId(S.workouts), finance: S.finance, body: S.body, prefs: S.prefs, weeks: S.weeks };
}
function applyData(d) {
  const toArr = (o) => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
  S.exams = toArr(d.exams); S.workouts = toArr(d.workouts);
  S.finance = d.finance || null; S.body = d.body || null; S.prefs = d.prefs || {}; S.weeks = d.weeks || {};
}
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshotData())); return true; }
  catch (e) { toast("Speichern auf dem Gerät hat nicht geklappt. Ist der Speicher voll?"); return false; }
}
function loadLocal() {
  try { const raw = localStorage.getItem(LS_KEY); if (raw) applyData(JSON.parse(raw)); } catch (e) { console.warn("load", e); }
  Object.assign(S.loaded, { exams: true, workouts: true, finance: true, body: true, prefs: true });
  S.dbState = "ready";
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
const Store = {
  async setDoc(path, data) { S[DOCS[path]] = clean(data); invalidate(); return persist(); },
  async put(col, id, data) {
    data = clean({ ...data, id: undefined });
    const arr = S[COLS[col]];
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr[i] = { id, ...data }; else arr.push({ id, ...data });
    invalidate(); return persist();
  },
  async del(col, id) {
    const arr = S[COLS[col]];
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
    invalidate(); return persist();
  },
  async setWeek(key, data) { S.weeks[key] = clean(data); invalidate(); return persist(); },
};
const prefs = () => ({ trainingGoal: 3, hiddenCals: [], semester: 3, ...(S.prefs || {}) });
async function setPrefs(patch) { return Store.setDoc("life/prefs", { ...prefs(), ...patch }); }

/* ---------- Backup ---------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify(snapshotData(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `life-dashboard-backup-${ymd(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { localStorage.setItem("ld:lastBackup", new Date().toISOString()); } catch (_) {}
  toast("Backup gespeichert");
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    if (!d || d.app !== "life-dashboard") throw new Error("Das ist keine Life-Dashboard-Datei.");
    applyData(d); persist(); closeSheet();
    toast(`Importiert: ${S.exams.length} Klausuren, ${S.workouts.length} Trainings`);
  } catch (e) { toast(e.message || "Datei konnte nicht gelesen werden."); }
}

/* ---------- Finanz-Briefing (news.json neben der App) ---------- */
async function loadNews() {
  try {
    const r = await fetch("news.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) { S.news = await r.json(); try { localStorage.setItem("ld:news", JSON.stringify(S.news)); } catch (_) {} }
  } catch (_) {
    try { S.news = JSON.parse(localStorage.getItem("ld:news") || "null"); } catch (__) {}
  }
  invalidate();
}

/* ---------- Beispiel-Daten ---------- */
function exampleCount() {
  return S.exams.filter((e) => e.example).length + S.workouts.filter((w) => w.example).length
    + (S.finance && S.finance.example ? 1 : 0) + (S.body && S.body.example ? 1 : 0);
}
function exampleBanner(scope) {
  const has = scope === "uni" ? S.exams.some((e) => e.example)
    : scope === "training" ? S.workouts.some((w) => w.example)
    : scope === "geld" ? !!(S.finance && S.finance.example)
    : scope === "koerper" ? !!(S.body && S.body.example)
    : exampleCount() > 0;
  if (!has) return "";
  const txt = scope === "all"
    ? "Du siehst gerade <b>Beispieldaten</b>, damit du siehst, wie alles funktioniert. Lösch sie, sobald du loslegst."
    : "Das hier sind <b>Beispiele</b>. Sie verschwinden automatisch, sobald du deinen ersten eigenen Eintrag speicherst.";
  return `<div class="banner"><span>${txt}</span><button class="btn btn-sm" data-act="clear-examples" data-scope="${scope}">${ICON.trash} Beispiele löschen</button></div>`;
}
async function clearExamples(col, keepId) {
  const arr = S[col].filter((x) => x.example && x.id !== keepId);
  await Promise.all(arr.map((x) => Store.del(col, x.id)));
  return arr.length;
}

/* ---------- Aktionen & Formulare ---------- */
const ACT = {};
const FORMS = {};
const RENDER = {};

function armed(el, label = "Wirklich löschen?") {
  if (el.dataset.armed === "1") return true;
  el.dataset.armed = "1";
  const old = el.innerHTML;
  el.innerHTML = label;
  el.classList.add("btn-danger");
  setTimeout(() => { if (el.isConnected) { el.dataset.armed = ""; el.innerHTML = old; } }, 3500);
  return false;
}

ACT["clear-examples"] = async (el) => {
  if (!armed(el, "Ja, Beispiele löschen")) return;
  const scope = el.dataset.scope;
  const all = scope === "all";
  const jobs = [];
  if (all || scope === "uni") S.exams.filter((e) => e.example).forEach((e) => jobs.push(Store.del("exams", e.id)));
  if (all || scope === "training") S.workouts.filter((w) => w.example).forEach((w) => jobs.push(Store.del("workouts", w.id)));
  if ((all || scope === "geld") && S.finance && S.finance.example) jobs.push(Store.setDoc("life/finance", { employer: "", role: "", hours: null, net: null, incomes: [], expenses: [], savings: null, example: false }));
  if ((all || scope === "koerper") && S.body && S.body.example) jobs.push(Store.setDoc("life/body", { heightCm: S.body.heightCm || null, goal: S.body.goal || "aufbau", weights: [], example: false }));
  await Promise.all(jobs);
  toast("Beispiele gelöscht");
};
ACT.go = (el) => go(el.dataset.view);

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (fn) fn(f, e);
});

/* ---------- Sheet ---------- */
let sheetCleanup = null, sheetOpenedAt = 0;
function openSheet(html, mount) {
  sheetOpenedAt = Date.now();
  const wrap = $("#sheet"), body = $("#sheet-body");
  body.innerHTML = html;
  wrap.hidden = false;
  document.body.style.overflow = "hidden";
  sheetCleanup = mount ? mount(body) || null : null;
  const first = body.querySelector("input:not([type=hidden]), select, textarea");
  if (first && window.matchMedia("(min-width: 760px)").matches) first.focus();
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet-body").innerHTML = "";
  document.body.style.overflow = "";
  if (typeof sheetCleanup === "function") sheetCleanup();
  sheetCleanup = null;
  invalidate();
}
ACT["sheet-close"] = (el) => { if (el && el.classList && el.classList.contains("sheet-backdrop") && Date.now() - sheetOpenedAt < 450) return; closeSheet(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
const sheetHead = (title, eyebrow = "") => `<div class="sheet-h"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<h2 id="sheet-title">${esc(title)}</h2></div><button type="button" class="icon-btn" data-act="sheet-close" aria-label="Schließen">${ICON.x}</button></div>`;

/* ---------- Navigation & Rendern ---------- */
function buildNav() {
  const btn = (v) => `<button type="button" data-act="go" data-view="${v.id}" ${v.id === S.view ? 'aria-current="page"' : ""}>${ICON[v.id]}<span>${v.label}</span></button>`;
  $("#tabbar").innerHTML = VIEWS.map(btn).join("");
  const rail = $("#rail");
  $$("button", rail).forEach((b) => b.remove());
  $$(".rail-foot", rail).forEach((b) => b.remove());
  rail.insertAdjacentHTML("beforeend", VIEWS.map(btn).join("") + `<button type="button" data-act="settings">${ICON.gear}<span>Einstellungen</span></button><div class="rail-foot" id="rail-foot"></div>`);
  updateFoot();
}
function updateFoot() {
  const el = $("#rail-foot");
  if (!el) return;
  el.textContent = "Daten liegen nur auf diesem Gerät. Mach ab und zu ein Backup.";
}
function go(view) {
  if (!VIEWS.some((v) => v.id === view)) view = "heute";
  S.view = view;
  $$(".view").forEach((s) => (s.hidden = s.dataset.view !== view));
  $$("#tabbar button, #rail button").forEach((b) => (b.dataset.view === view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  try { history.replaceState(null, "", "#" + view); } catch (_) {}
  try { localStorage.setItem("ld:view", view); } catch (_) {}
  renderView(view, true);
  window.scrollTo({ top: 0 });
}
let raf = 0, deferred = false;
function invalidate() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; renderView(S.view); updateFoot(); });
}
function renderView(view, force) {
  const el = $("#view-" + view);
  const fn = RENDER[view];
  if (!el || !fn) return;
  const a = document.activeElement;
  if (!force && a && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { deferred = true; return; }
  try { el.innerHTML = fn(); }
  catch (err) { console.error(err); el.innerHTML = `<div class="note bad">Dieser Bereich konnte nicht angezeigt werden: ${esc(err.message)}</div>`; }
  if (RENDER[view + ":after"]) RENDER[view + ":after"](el);
}
document.addEventListener("focusout", () => {
  setTimeout(() => {
    const a = document.activeElement;
    const el = $("#view-" + S.view);
    if (deferred && !(a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { deferred = false; invalidate(); }
  }, 0);
});
let rsT;
window.addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => renderView(S.view), 180); });

/* ---------- Bausteine ---------- */
const card = (title, body, { eyebrow = "", actions = "", cls = "" } = {}) =>
  `<section class="card ${cls}"><div class="card-h"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ""}<h2>${title}</h2></div>${actions ? `<div class="head-actions">${actions}</div>` : ""}</div>${body}</section>`;
const loadingRow = (txt = "Lädt …") => `<div class="muted small" style="padding:8px 0">${esc(txt)}</div>`;
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 17 ? "Hi" : h < 22 ? "Guten Abend" : "Noch wach";
}
