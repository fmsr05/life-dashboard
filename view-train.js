/* Life Dashboard – Training: Einheiten, Sätze (kg × Wdh.), Bestleistungen, Fortschritt */
"use strict";

const COMMON_EX = ["Bankdrücken", "Schrägbankdrücken", "Kniebeuge", "Kreuzheben", "Rumänisches Kreuzheben", "Schulterdrücken", "Klimmzüge", "Latzug", "Langhantelrudern", "Kabelrudern", "Dips", "Beinpresse", "Beinstrecker", "Beinbeuger", "Wadenheben", "Seitheben", "Bizepscurls", "Hammercurls", "Trizepsdrücken", "Face Pulls", "Hip Thrust", "Ausfallschritte", "Butterfly"];
const SPLITS = ["Push", "Pull", "Beine", "Oberkörper", "Unterkörper", "Ganzkörper", "Cardio"];
const e1rm = (kg, reps) => (reps > 0 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : 0);
const score = (s) => (Number(s.kg) > 0 ? e1rm(Number(s.kg), Number(s.reps) || 0) : (Number(s.reps) || 0) / 1000);
const exKey = (n) => String(n || "").trim().toLowerCase();
const wVolume = (w) => sum(w.exercises || [], (ex) => sum(ex.sets || [], (s) => (Number(s.kg) || 0) * (Number(s.reps) || 0)));
const wSets = (w) => sum(w.exercises || [], (ex) => (ex.sets || []).length);
const sortedWorkouts = () => S.workouts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
const fmtVol = (kg) => (kg >= 1000 ? fmt(kg / 1000, 1) + " t" : fmt(kg, 0) + " kg");
const setStr = (s) => `${fmtMax(Number(s.kg) || 0, 2)}×${s.reps}`;

function trainingStats(refDate = new Date()) {
  const ws = startOfWeek(refDate), we = addDays(ws, 7);
  const inWeek = (w) => { const d = parseYmd(w.date); return d >= ws && d < we; };
  const all = sortedWorkouts();
  const week = all.filter(inWeek);
  const best = {}, first = {};
  for (const w of all.slice().reverse()) {
    for (const ex of w.exercises || []) {
      const k = exKey(ex.name); if (!k) continue;
      if (!first[k] || w.date < first[k]) first[k] = w.date;
      for (const s of ex.sets || []) {
        const v = score(s);
        if (!best[k] || v > best[k].e1) best[k] = { name: ex.name.trim(), e1: v, set: s, date: w.date };
      }
    }
  }
  const prsWeek = Object.entries(best).filter(([k, b]) => { const d = parseYmd(b.date); return d >= ws && d < we && b.e1 > 0 && parseYmd(first[k]) < ws; }).map(([, b]) => b);
  const goal = prefs().trainingGoal || 3;
  let streak = 0;
  for (let i = 0; i < 104; i++) {
    const a = addDays(ws, -7 * i), b = addDays(a, 7);
    const n = all.filter((w) => { const d = parseYmd(w.date); return d >= a && d < b; }).length;
    if (n >= goal) streak++; else if (i > 0) break;
  }
  const last30 = all.filter((w) => dayDiff(parseYmd(w.date), refDate) < 30).length;
  return { all, week, weekVol: sum(week, wVolume), best, prsWeek, goal, streak, last30 };
}
function exerciseHistory(name) {
  const k = exKey(name), pts = [];
  for (const w of S.workouts) {
    const ex = (w.exercises || []).find((e) => exKey(e.name) === k);
    if (!ex) continue;
    let top = null;
    for (const s of ex.sets || []) { const v = score(s); if (!top || v > top.v) top = { v, set: s }; }
    if (top && top.v > 0) { const bw = !(Number(top.set.kg) > 0); pts.push({ x: +parseYmd(w.date), y: bw ? Number(top.set.reps) : top.v, bw, set: top.set }); }
  }
  return pts.sort((a, b) => a.x - b.x);
}
function lastPerformance(name, skipId) {
  const k = exKey(name);
  for (const w of sortedWorkouts()) {
    if (w.id === skipId) continue;
    const ex = (w.exercises || []).find((e) => exKey(e.name) === k);
    if (ex && (ex.sets || []).length) return { date: w.date, sets: ex.sets };
  }
  return null;
}

RENDER.training = () => {
  const st = trainingStats();
  const loading = S.dbState !== "none" && !S.loaded.workouts;
  const names = Object.values(st.best).sort((a, b) => b.e1 - a.e1);
  if (!S.trainEx || !st.best[exKey(S.trainEx)]) S.trainEx = names[0] ? names[0].name : "";
  const hist = S.trainEx ? exerciseHistory(S.trainEx) : [];
  const dots = Array.from({ length: Math.max(st.goal, st.week.length) }, (_, i) => `<i class="${i < st.week.length ? "on" : ""}"></i>`).join("");
  const hero = `<section class="card"><div class="statline">
      <div class="stat"><div class="eyebrow">Diese Woche</div><div class="num v">${st.week.length}<small>/ ${st.goal}</small></div><div class="ring-dots" style="margin-top:6px">${dots}</div></div>
      <div class="stat"><div class="eyebrow">Volumen (Woche)</div><div class="num v">${fmtVol(st.weekVol)}</div><div class="muted small">Σ kg × Wdh.</div></div>
      <div class="stat"><div class="eyebrow">Wochen im Ziel</div><div class="num v">${st.streak}</div><div class="muted small">in Folge</div></div>
      <div class="stat"><div class="eyebrow">Letzte 30 Tage</div><div class="num v">${st.last30}</div><div class="muted small">Einheiten</div></div>
      <div class="stat"><div class="eyebrow">Wochenziel</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px"><button class="icon-btn" style="border-color:var(--line)" data-act="goal" data-d="-1" aria-label="Ziel verringern">−</button><span class="num" style="font-size:24px;min-width:22px;text-align:center">${st.goal}</span><button class="icon-btn" style="border-color:var(--line)" data-act="goal" data-d="1" aria-label="Ziel erhöhen">+</button></div></div>
    </div></section>`;
  const progress = names.length ? card("Fortschritt", `
      <select class="input" id="ex-sel" style="margin-bottom:12px">${names.map((n) => `<option ${n.name === S.trainEx ? "selected" : ""}>${esc(n.name)}</option>`).join("")}</select>
      ${hist.length > 1 ? chartSlot("ex", { height: 190, label: "Geschätztes Maximalgewicht für " + S.trainEx, series: [{ pts: hist, color: "var(--accent)", area: true, points: true, hover: true }], yFmt: (v) => fmtMax(v, 0), tip: (p) => `${p.bw ? `<b>${p.y} Wdh.</b>` : `<b>${fmtMax(p.y, 1)} kg</b> e1RM`} · ${esc(setStr(p.set))} · ${new Date(p.x).toLocaleDateString("de-DE")}` }) : `<div class="muted small">Ab zwei Einheiten mit dieser Übung siehst du hier deine Kurve.</div>`}
      <p class="muted small" style="margin:10px 0 0">Kurve = geschätztes 1-Wiederholungs-Maximum (Epley: kg × (1 + Wdh./30)) des besten Satzes pro Training. Bei Übungen mit Körpergewicht zählen die Wiederholungen.</p>`,
    { eyebrow: "Geschätztes Maximum" }) : "";
  const prs = names.length ? card("Bestleistungen", `<div class="table-wrap"><table class="t"><thead><tr><th>Übung</th><th class="r">Bester Satz</th><th class="r">e1RM</th><th class="r hide-sm">Datum</th></tr></thead><tbody>
      ${names.slice(0, 10).map((b) => `<tr><td>${esc(b.name)} ${st.prsWeek.includes(b) ? '<span class="chip signal">neu</span>' : ""}</td><td class="r">${esc(setStr(b.set))}</td><td class="r"><b>${Number(b.set.kg) > 0 ? fmtMax(b.e1, 1) : "–"}</b></td><td class="r hide-sm">${parseYmd(b.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</td></tr>`).join("")}
    </tbody></table></div>`, { eyebrow: st.prsWeek.length ? `${st.prsWeek.length} neue diese Woche` : "Persönliche Rekorde" }) : "";
  const hist12 = st.all.slice(0, 14);
  const list = hist12.length ? hist12.map((w) => {
    const d = parseYmd(w.date);
    const summary = (w.exercises || []).map((ex) => { const top = (ex.sets || []).reduce((a, s) => (!a || score(s) > score(a) ? s : a), null); return `${ex.name} ${(ex.sets || []).length}× ${top ? "· " + setStr(top) : ""}`; }).join(" · ");
    return `<div class="row rowlink" data-act="wo-edit" data-id="${w.id}" role="button" tabindex="0">
      <div class="time">${pad(d.getDate())}.${pad(d.getMonth() + 1)}.<small>${DOW[d.getDay()]}</small></div>
      <div class="grow"><div class="t clamp1">${esc(w.title || "Training")} ${w.example ? '<span class="chip ex">Beispiel</span>' : ""}</div><div class="s">${esc(summary)}</div></div>
      <div style="text-align:right;flex:none"><div class="num" style="font-size:17px">${fmtVol(wVolume(w))}</div><div class="muted small">${wSets(w)} Sätze</div></div></div>`;
  }).join("") : `<div class="empty"><span><b>Noch kein Training eingetragen.</b> Leg nach jeder Einheit kurz deine Übungen mit Gewicht und Wiederholungen an. Beim nächsten Mal siehst du direkt, was du letztes Mal geschafft hast.</span><button class="btn btn-primary btn-sm" data-act="wo-new">${ICON.plus} Erstes Training</button></div>`;
  return `<header class="head"><div><div class="eyebrow">Gym-Log</div><h1>Training</h1><div class="sub">${st.week.length} von ${st.goal} Einheiten diese Woche${st.prsWeek.length ? ` · ${st.prsWeek.length} neue Bestleistung${st.prsWeek.length === 1 ? "" : "en"}` : ""}</div></div>
    <div class="head-actions">${st.all.length ? `<button class="btn" data-act="wo-repeat">${ICON.copy} Letztes wiederholen</button>` : ""}<button class="btn btn-primary" data-act="wo-new">${ICON.plus} Training</button></div></header>
    ${exampleBanner("training")}
    ${loading ? loadingRow() : hero}
    ${names.length ? `<div class="grid2">${progress}${prs}</div>` : ""}
    ${card("Verlauf", `<div class="list">${list}</div>`, { eyebrow: `${st.all.length} Einheiten` })}`;
};
RENDER["training:after"] = (el) => {
  mountCharts(el);
  const sel = $("#ex-sel", el);
  if (sel) sel.onchange = () => { S.trainEx = sel.value; renderView("training", true); };
};
ACT.goal = (el) => setPrefs({ trainingGoal: Math.max(1, Math.min(7, (prefs().trainingGoal || 3) + Number(el.dataset.d))) });

/* ---------- Sheet: Training erfassen ---------- */
let draft = null;
const DRAFT_KEY = "ld:wdraft";
const saveDraft = () => { try { if (draft && !draft.id) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {} };
const dropDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} };
function exNames() {
  const set = new Set(COMMON_EX);
  S.workouts.forEach((w) => (w.exercises || []).forEach((e) => e.name && set.add(e.name.trim())));
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}
function exHtml(ex, i) {
  const last = ex.name ? lastPerformance(ex.name, draft.id) : null;
  return `<div class="ex-card" data-exi="${i}">
    <div style="display:flex;gap:8px;align-items:center"><input class="input" style="background:var(--surface)" data-ex="${i}" data-f="name" list="ex-list" value="${esc(ex.name)}" placeholder="Übung, z. B. Bankdrücken" aria-label="Übung ${i + 1}">
      <button type="button" class="icon-btn" data-act="wo-ex-del" data-ex="${i}" aria-label="Übung entfernen">${ICON.trash}</button></div>
    <div class="muted small" data-last="${i}">${last ? `Letztes Mal (${parseYmd(last.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}): ${esc(last.sets.map(setStr).join(" · "))}` : ""}</div>
    <div class="set-head"><span>#</span><span>kg</span><span></span><span>Wdh.</span><span></span></div>
    ${ex.sets.map((s, j) => `<div class="set-row"><span class="idx">${j + 1}</span>
      <input inputmode="decimal" data-ex="${i}" data-set="${j}" data-f="kg" value="${esc(inVal(s.kg))}" placeholder="kg" aria-label="Gewicht Satz ${j + 1}">
      <span class="muted">×</span>
      <input inputmode="numeric" data-ex="${i}" data-set="${j}" data-f="reps" value="${esc(inVal(s.reps))}" placeholder="Wdh." aria-label="Wiederholungen Satz ${j + 1}">
      <button type="button" class="icon-btn" data-act="wo-set-del" data-ex="${i}" data-set="${j}" aria-label="Satz entfernen">${ICON.x}</button></div>`).join("")}
    <div><button type="button" class="btn btn-sm" data-act="wo-set-add" data-ex="${i}">${ICON.plus} Satz</button></div>
  </div>`;
}
function renderExercises(focus) {
  const box = $("#wo-ex");
  if (!box) return;
  box.innerHTML = draft.exercises.map(exHtml).join("");
  if (focus) { const el = $(focus, box); if (el) el.focus(); }
}
function workoutSheet(w, note) {
  draft = w;
  openSheet(`${sheetHead(w.id ? "Training bearbeiten" : "Training eintragen", "Training")}
  <form class="form" data-form="workout" autocomplete="off">
    ${note ? `<div class="note">${esc(note)}</div>` : ""}
    <div class="frow">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${esc(w.date)}" required></label>
      <label class="field"><span>Einheit</span><input name="title" list="split-list" value="${esc(w.title || "")}" placeholder="Push"></label>
    </div>
    <datalist id="split-list">${SPLITS.map((s) => `<option value="${s}"></option>`).join("")}</datalist>
    <datalist id="ex-list">${exNames().map((n) => `<option value="${esc(n)}"></option>`).join("")}</datalist>
    <div class="pickgrid">${SPLITS.map((s) => `<button type="button" data-act="wo-split" data-v="${s}" aria-pressed="${s === w.title}">${s}</button>`).join("")}</div>
    <div id="wo-ex" class="form"></div>
    <div><button type="button" class="btn" data-act="wo-ex-add">${ICON.plus} Übung hinzufügen</button></div>
    <label class="field"><span>Notiz</span><textarea name="notes" placeholder="Wie lief's? Schlaf, Energie, Schmerzen …">${esc(w.notes || "")}</textarea></label>
    <div class="sheet-foot">${w.id ? `<button type="button" class="btn btn-ghost" data-act="wo-del" data-id="${w.id}">${ICON.trash} Löschen</button>` : `<button type="button" class="btn btn-ghost" data-act="wo-discard">Verwerfen</button>`}
      <div class="r"><button type="button" class="btn" data-act="sheet-close">Schließen</button><button class="btn btn-primary">Speichern</button></div></div>
  </form>`, (body) => {
    renderExercises();
    const onInput = (e) => {
      const t = e.target;
      if (t.name === "date" || t.name === "title" || t.name === "notes") { draft[t.name] = t.value; saveDraft(); return; }
      const i = t.dataset.ex; if (i === undefined) return;
      const ex = draft.exercises[+i];
      if (t.dataset.f === "name") ex.name = t.value;
      else ex.sets[+t.dataset.set][t.dataset.f] = t.value;
      saveDraft();
    };
    const onChange = (e) => {
      const t = e.target;
      if (t.dataset.f === "name") {
        const i = +t.dataset.ex, last = lastPerformance(t.value, draft.id);
        const hint = $(`[data-last="${i}"]`, body);
        if (hint) hint.textContent = last ? `Letztes Mal (${parseYmd(last.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}): ${last.sets.map(setStr).join(" · ")}` : "";
        const ex = draft.exercises[i];
        if (last && ex.sets.length === 1 && !ex.sets[0].kg && !ex.sets[0].reps) { ex.sets = last.sets.map((s) => ({ kg: s.kg, reps: s.reps })); renderExercises(`[data-ex="${i}"][data-set="0"][data-f="kg"]`); }
      }
      if (t.name === "title") $$("[data-act=wo-split]", body).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === t.value)));
    };
    body.addEventListener("input", onInput);
    body.addEventListener("change", onChange);
    return () => { body.removeEventListener("input", onInput); body.removeEventListener("change", onChange); draft = null; };
  });
}
const inVal = (v) => (typeof v === "number" ? fmtMax(v, 2) : v ?? "");
const blankEx = () => ({ name: "", sets: [{ kg: "", reps: "" }] });
ACT["wo-new"] = () => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (_) {}
  if (saved && saved.exercises && saved.exercises.some((e) => e.name)) return workoutSheet(saved, "Dein nicht gespeicherter Entwurf ist wieder da.");
  workoutSheet({ date: ymd(new Date()), title: "", exercises: [blankEx()], notes: "" });
};
ACT["wo-repeat"] = () => {
  const last = sortedWorkouts()[0];
  if (!last) return ACT["wo-new"]();
  workoutSheet({ date: ymd(new Date()), title: last.title || "", notes: "", exercises: (last.exercises || []).map((e) => ({ name: e.name, sets: (e.sets || []).map((s) => ({ kg: s.kg, reps: s.reps })) })) }, `Vorlage: ${last.title || "Training"} vom ${parseYmd(last.date).toLocaleDateString("de-DE")}. Pass Gewichte und Wiederholungen an.`);
};
ACT["wo-edit"] = (el) => { const w = S.workouts.find((x) => x.id === el.dataset.id); if (w) workoutSheet(JSON.parse(JSON.stringify({ ...w, exercises: (w.exercises || []).map((e) => ({ name: e.name, sets: (e.sets || []).map((s) => ({ ...s })) })) }))); };
ACT["wo-split"] = (el) => { const f = el.closest("form"); f.title.value = el.dataset.v; draft.title = el.dataset.v; $$("[data-act=wo-split]", f).forEach((b) => b.setAttribute("aria-pressed", String(b === el))); saveDraft(); };
ACT["wo-ex-add"] = () => { draft.exercises.push(blankEx()); renderExercises(`[data-ex="${draft.exercises.length - 1}"][data-f="name"]`); saveDraft(); };
ACT["wo-ex-del"] = (el) => { draft.exercises.splice(+el.dataset.ex, 1); if (!draft.exercises.length) draft.exercises.push(blankEx()); renderExercises(); saveDraft(); };
ACT["wo-set-add"] = (el) => {
  const i = +el.dataset.ex, ex = draft.exercises[i], prev = ex.sets[ex.sets.length - 1] || { kg: "", reps: "" };
  ex.sets.push({ kg: prev.kg, reps: prev.reps });
  renderExercises(`[data-ex="${i}"][data-set="${ex.sets.length - 1}"][data-f="reps"]`); saveDraft();
};
ACT["wo-set-del"] = (el) => { const ex = draft.exercises[+el.dataset.ex]; ex.sets.splice(+el.dataset.set, 1); if (!ex.sets.length) ex.sets.push({ kg: "", reps: "" }); renderExercises(); saveDraft(); };
ACT["wo-discard"] = (el) => { if (!armed(el, "Entwurf verwerfen?")) return; dropDraft(); closeSheet(); };
ACT["wo-del"] = async (el) => { if (!armed(el)) return; if (await Store.del("workouts", el.dataset.id)) { closeSheet(); toast("Training gelöscht"); } };
FORMS.workout = async (f) => {
  const exercises = draft.exercises.map((e) => ({
    name: e.name.trim(),
    sets: e.sets.map((s) => ({ kg: parseNum(s.kg) ?? 0, reps: Math.round(parseNum(s.reps) || 0) })).filter((s) => s.reps > 0),
  })).filter((e) => e.name && e.sets.length);
  if (!exercises.length) return toast("Trag mindestens eine Übung mit Wiederholungen ein.");
  const old = draft.id ? S.workouts.find((x) => x.id === draft.id) : null;
  const doc = { date: f.date.value || ymd(new Date()), title: f.title.value.trim() || "Training", exercises, notes: f.notes.value.trim(), example: false, createdAt: (old && old.createdAt) || new Date().toISOString() };
  const before = trainingStats().best;
  const id = draft.id || uid();
  const ok = await Store.put("workouts", id, doc);
  if (!ok) return;
  dropDraft();
  const newPr = exercises.find((e) => { const b = before[exKey(e.name)]; const top = Math.max(...e.sets.map(score)); return b && !S.workouts.find((w) => w.id === id && w.example) && top > b.e1 + 0.01; });
  const removed = await clearExamples("workouts", id);
  closeSheet();
  toast(newPr && !removed ? `Neue Bestleistung: ${newPr.name}` : "Training gespeichert" + (removed ? " · Beispiele entfernt" : ""));
};
