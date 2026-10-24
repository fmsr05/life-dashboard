/* Life Dashboard – Körper: Gewicht, Größe, BMI, Trend */
"use strict";

const GOALS = { aufbau: "Aufbau", halten: "Halten", definition: "Definition" };
const body = () => ({ heightCm: null, goal: "aufbau", weights: [], ...(S.body || {}) });
function weightAt(list, date) {
  let v = null;
  for (const w of list) { if (parseYmd(w.d) <= date) v = w; else break; }
  return v;
}
function bodyStats() {
  const b = body();
  const ws = (b.weights || []).filter((w) => w && w.d && Number.isFinite(+w.kg)).slice().sort((a, c) => a.d.localeCompare(c.d));
  const now = new Date();
  const cur = ws[ws.length - 1] || null;
  const ref = (days) => {
    let r = weightAt(ws, addDays(startOfDay(now), -days));
    if (!r && ws[0] && dayDiff(parseYmd(ws[0].d), now) >= days * 0.75) r = ws[0];
    return r && cur && r !== cur ? cur.kg - r.kg : null;
  };
  const recent = ws.filter((w) => dayDiff(parseYmd(w.d), now) <= 28);
  let slope = null;
  if (recent.length >= 3) {
    const xs = recent.map((w) => +parseYmd(w.d) / 864e5), ys = recent.map((w) => +w.kg);
    const mx = xs.reduce((a, x) => a + x, 0) / xs.length, my = ys.reduce((a, y) => a + y, 0) / ys.length;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (den > 0 && xs[xs.length - 1] - xs[0] >= 6) slope = (num / den) * 7;
  }
  const bmi = cur && b.heightCm ? cur.kg / (b.heightCm / 100) ** 2 : null;
  const bmiCat = bmi === null ? "" : bmi < 18.5 ? "Untergewicht" : bmi < 25 ? "Normalgewicht" : bmi < 30 ? "Übergewicht" : "Adipositas";
  const avg = ws.map((w) => { const d = parseYmd(w.d); const win = ws.filter((x) => { const n = dayDiff(parseYmd(x.d), d); return n >= 0 && n < 7; }); return { x: +d, y: win.reduce((a, x) => a + +x.kg, 0) / win.length }; });
  return { b, ws, cur, d7: ref(7), d30: ref(30), dAll: cur && ws.length > 1 ? cur.kg - ws[0].kg : null, slope, bmi, bmiCat, avg };
}
function verdict(st) {
  if (st.slope === null) return { tone: "", text: st.ws.length ? "Trag ein paar Tage weiter ein, dann siehst du deinen Trend." : "" };
  const s = st.slope, g = st.b.goal;
  const dir = s > 0.1 ? "up" : s < -0.1 ? "down" : "flat";
  const head = dir === "up" ? "Du nimmst zu" : dir === "down" ? "Du nimmst ab" : "Dein Gewicht ist stabil";
  let tone = "accent", tip = "";
  if (g === "aufbau") {
    if (dir === "up" && s <= 0.5) { tone = "good"; tip = "Sauberes Aufbautempo (ca. 0,25–0,5 kg pro Woche)."; }
    else if (s > 0.75) { tone = "warn"; tip = "Recht schnell. Bei mehr als 0,5 kg pro Woche kommt oft mehr Fett als Muskel dazu."; }
    else if (dir !== "up") { tone = "warn"; tip = "Für Muskelaufbau brauchst du einen leichten Kalorienüberschuss."; }
    else tip = "Etwas über dem typischen Aufbautempo.";
  } else if (g === "definition") {
    if (dir === "down" && s >= -0.75) { tone = "good"; tip = "Gutes Tempo für eine Diät, ohne viel Muskulatur zu verlieren."; }
    else if (s < -0.75) { tone = "warn"; tip = "Sehr schnell. Achte auf genug Eiweiß und Krafttraining."; }
    else { tone = "warn"; tip = "Für Definition brauchst du ein leichtes Kaloriendefizit."; }
  } else { tone = dir === "flat" ? "good" : "warn"; tip = dir === "flat" ? "Genau richtig für dein Ziel." : "Du weichst von deinem Halteziel ab."; }
  return { tone, text: `${head}: ${signed(s, 2, " kg")} pro Woche. ${tip}` };
}

RENDER.koerper = () => {
  const st = bodyStats(), b = st.b, v = verdict(st);
  const loading = S.dbState !== "none" && !S.loaded.body;
  const range = S.bodyRange || 90;
  const cutoff = range === 0 ? 0 : +addDays(new Date(), -range);
  const pts = st.ws.map((w) => ({ x: +parseYmd(w.d), y: +w.kg })).filter((p) => p.x >= cutoff);
  const avg = st.avg.filter((p) => p.x >= cutoff);
  const quick = `<section class="card"><form data-form="weight" class="frow3" style="align-items:end" autocomplete="off">
      <label class="field"><span>Gewicht (kg)</span><input id="w-kg" name="kg" inputmode="decimal" placeholder="${st.cur ? fmtMax(st.cur.kg, 1) : "75,0"}" required></label>
      <label class="field"><span>Datum</span><input id="w-date" name="d" type="date" value="${ymd(new Date())}"></label>
      <button class="btn btn-primary" style="height:44px">${ICON.plus} Eintragen</button>
    </form><p class="muted small" style="margin:10px 0 0">Tipp: morgens nach dem Aufstehen wiegen, dann sind die Werte vergleichbar.</p></section>`;
  const hero = `<section class="card">
    <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div><div class="eyebrow">Aktuelles Gewicht</div><div class="num big">${st.cur ? fmtMax(st.cur.kg, 1) : "–"}<small class="soft" style="font-size:22px"> kg</small></div>
        <div class="muted small">${st.cur ? "gewogen " + relDay(parseYmd(st.cur.d)).replace(/^([A-Z])/, (m) => m.toLowerCase()) : "Noch kein Eintrag"}</div></div>
      ${v.text ? `<div class="note ${v.tone === "warn" ? "warn" : ""}" style="max-width:420px;${v.tone === "good" ? "background:var(--good-soft)" : ""}">${esc(v.text)}</div>` : ""}
    </div>
    <div class="statline" style="margin-top:16px">
      <div class="stat"><div class="eyebrow">7 Tage</div><div class="num v">${signed(st.d7, 1)}<small>kg</small></div></div>
      <div class="stat"><div class="eyebrow">30 Tage</div><div class="num v">${signed(st.d30, 1)}<small>kg</small></div></div>
      <div class="stat"><div class="eyebrow">Seit Start</div><div class="num v">${signed(st.dAll, 1)}<small>kg</small></div></div>
      <div class="stat"><div class="eyebrow">Trend</div><div class="num v">${signed(st.slope, 2)}<small>kg/Wo</small></div></div>
      <div class="stat"><div class="eyebrow">BMI</div><div class="num v">${st.bmi ? fmt(st.bmi, 1) : "–"}</div><div class="muted small">${st.bmiCat || (b.heightCm ? "" : "Größe fehlt")}</div></div>
    </div></section>`;
  const chart = pts.length > 1 ? chartSlot("weight", { height: 220, minPad: 0.6, label: "Gewichtsverlauf", series: [{ pts, kind: "dots", color: "var(--ink-3)" }, { pts: avg, color: "var(--accent)", area: false, hover: true }], yFmt: (x) => fmtMax(x, 1), tip: (p) => { const raw = st.ws.find((w) => +parseYmd(w.d) === p.x); return `<b>${fmtMax(p.y, 1)} kg</b> Schnitt${raw ? ` · gewogen ${fmtMax(+raw.kg, 1)}` : ""} · ${new Date(p.x).toLocaleDateString("de-DE")}`; } }) : `<div class="muted small">Ab zwei Einträgen erscheint hier dein Verlauf.</div>`;
  const chartCard = card("Verlauf", `<div class="lg" style="margin-bottom:8px"><span><i class="dot"></i>Messung</span><span><i></i>7-Tage-Schnitt</span></div>${chart}`,
    { eyebrow: `${st.ws.length} Messungen`, actions: `<div class="seg">${[[30, "30 T"], [90, "90 T"], [365, "1 J"], [0, "Alle"]].map(([d, l]) => `<button data-act="body-range" data-d="${d}" aria-pressed="${range === d}">${l}</button>`).join("")}</div>` });
  const prof = card("Profil", `<div class="statline">
      <div class="stat"><div class="eyebrow">Größe</div><div class="num v">${b.heightCm ? fmt(b.heightCm / 100, 2) : "–"}<small>m</small></div></div>
      <div class="stat"><div class="eyebrow">Ziel</div><div class="num v" style="font-variation-settings:'wdth' 100">${GOALS[b.goal] || "–"}</div></div>
    </div><p class="muted small" style="margin:12px 0 0">Der BMI unterscheidet nicht zwischen Muskeln und Fett. Wenn du viel trainierst, sagt der Gewichtstrend mehr aus.</p>`,
    { eyebrow: "Größe & Ziel", actions: `<button class="btn btn-sm" data-act="body-edit">${ICON.edit} Bearbeiten</button>` });
  const entries = st.ws.slice(-12).reverse();
  const list = card("Einträge", entries.length ? `<div class="list">${entries.map((w, i) => { const prev = st.ws[st.ws.length - 2 - i]; const d = prev ? w.kg - prev.kg : null; return `<div class="row"><div class="grow"><div class="t">${fmtDate(parseYmd(w.d), { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</div></div><span class="muted small tab">${d === null ? "" : signed(d, 1)}</span><div class="num" style="font-size:19px">${fmtMax(+w.kg, 1)} kg</div><button class="icon-btn" data-act="w-del" data-d="${w.d}" aria-label="Eintrag löschen">${ICON.trash}</button></div>`; }).join("")}</div>`
    : `<div class="empty"><span><b>Noch keine Messung.</b> Trag oben dein heutiges Gewicht ein und deine Größe im Profil.</span></div>`, { eyebrow: "Letzte 12" });
  return `<header class="head"><div><div class="eyebrow">Gewicht & Größe</div><h1>Körper</h1><div class="sub">${b.heightCm ? `${fmt(b.heightCm / 100, 2)} m` : "Größe noch nicht eingetragen"} · Ziel: ${GOALS[b.goal] || "–"}</div></div></header>
    ${exampleBanner("koerper")}
    ${quick}
    ${loading ? loadingRow() : hero}
    ${chartCard}
    <div class="grid2">${prof}${list}</div>`;
};
RENDER["koerper:after"] = (el) => mountCharts(el);
ACT["body-range"] = (el) => { S.bodyRange = Number(el.dataset.d); renderView("koerper", true); };
const bodyBase = () => (S.body && S.body.example ? { heightCm: null, goal: "aufbau", weights: [] } : body());
async function saveBody(patch) {
  const wasEx = !!(S.body && S.body.example);
  const ok = await Store.setDoc("life/body", { ...bodyBase(), ...patch, example: false, updatedAt: new Date().toISOString() });
  if (ok && wasEx) setTimeout(() => toast("Beispielwerte entfernt"), 2700);
  return ok;
}
FORMS.weight = async (f) => {
  const kg = parseNum(f.kg.value), d = f.d.value || ymd(new Date());
  if (kg === null || kg < 30 || kg > 300) return toast("Gewicht bitte in kg, z. B. 74,6.");
  const ws = bodyBase().weights.filter((w) => w.d !== d);
  ws.push({ d, kg });
  ws.sort((a, b) => a.d.localeCompare(b.d));
  if (await saveBody({ weights: ws })) { f.kg.value = ""; f.kg.blur(); toast(`${fmtMax(kg, 1)} kg eingetragen`); }
};
ACT["w-del"] = async (el) => { if (!armed(el, "Löschen?")) return; if (await saveBody({ weights: bodyBase().weights.filter((w) => w.d !== el.dataset.d) })) toast("Eintrag gelöscht"); };
ACT["body-edit"] = () => {
  const b = body();
  openSheet(`${sheetHead("Profil", "Körper")}
  <form class="form" data-form="bodyprof" autocomplete="off">
    <label class="field"><span>Größe (cm)</span><input name="h" inputmode="decimal" value="${esc(b.heightCm ?? "")}" placeholder="182"></label>
    <div class="field"><span>Ziel</span><div class="seg">${Object.entries(GOALS).map(([k, l]) => `<button type="button" data-act="goal-pick" data-v="${k}" aria-pressed="${b.goal === k}">${l}</button>`).join("")}</div><input type="hidden" name="goal" value="${esc(b.goal || "aufbau")}"></div>
    <div class="sheet-foot"><span></span><div class="r"><button type="button" class="btn" data-act="sheet-close">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></div>
  </form>`);
};
ACT["goal-pick"] = (el) => { const f = el.closest("form"); f.goal.value = el.dataset.v; $$("[data-act=goal-pick]", f).forEach((b) => b.setAttribute("aria-pressed", String(b === el))); };
FORMS.bodyprof = async (f) => {
  const h = parseNum(f.h.value);
  if (h !== null && (h < 120 || h > 230)) return toast("Größe bitte in Zentimetern, z. B. 182.");
  if (await saveBody({ heightCm: h, goal: f.goal.value })) { closeSheet(); toast("Profil gespeichert"); }
};
