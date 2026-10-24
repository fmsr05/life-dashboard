/* Life Dashboard – Uni: Klausuren, ECTS-gewichteter Schnitt, Prognose */
"use strict";

const GRADE_STEPS = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];
const TOTAL_ECTS = 180;
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const gradeStr = (g, d = 1) => (g === null || g === undefined ? "–" : fmt(g, d));
const truncGrade = (g) => (g === null ? null : Math.floor(g * 10 + 1e-9) / 10);
function predicate(g) {
  if (g === null || g === undefined) return "";
  return g <= 1.5 ? "sehr gut" : g <= 2.5 ? "gut" : g <= 3.5 ? "befriedigend" : g <= 4.0 ? "ausreichend" : "nicht bestanden";
}
const gradeTone = (g) => (g === null ? "" : g <= 1.5 ? "good" : g <= 2.5 ? "accent" : g <= 3.5 ? "signal" : g <= 4.0 ? "warn" : "bad");
const wavg = (list) => { const e = sum(list, (x) => x.ects); return e ? sum(list, (x) => x.grade * x.ects) / e : null; };

function examStats() {
  const done = S.exams.filter((e) => e.status === "done");
  const passed = done.filter((e) => e.ungraded || (e.grade !== null && e.grade !== undefined && e.grade <= 4.0));
  const graded = passed.filter((e) => !e.ungraded && e.grade !== null && e.grade !== undefined);
  const failed = done.filter((e) => !e.ungraded && e.grade > 4.0);
  const avg = wavg(graded);
  const planned = S.exams.filter((e) => e.status === "planned");
  const targets = planned.filter((p) => p.target && p.target <= 4.0).map((p) => ({ ...p, grade: p.target }));
  const prog = targets.length ? wavg([...graded, ...targets]) : null;
  const sems = {};
  for (const e of passed) { const k = e.semester || 0; (sems[k] = sems[k] || []).push(e); }
  const bySem = Object.entries(sems).map(([k, l]) => ({ sem: +k, ects: sum(l, (x) => x.ects), avg: wavg(l.filter((x) => !x.ungraded && x.grade != null)), n: l.length })).sort((a, b) => a.sem - b.sem);
  const upcoming = planned.slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  return { done, passed, graded, failed, avg, trunc: truncGrade(avg), ects: sum(passed, (x) => x.ects), planned: upcoming, prog, targetsN: targets.length, plannedEcts: sum(planned, (x) => x.ects), bySem };
}

RENDER.uni = () => {
  const st = examStats();
  const sem = prefs().semester || 3;
  const soll = Math.min(TOTAL_ECTS, (sem - 1) * 30);
  const pct = Math.min(100, (st.ects / TOTAL_ECTS) * 100);
  const loading = S.dbState !== "none" && !S.loaded.exams;
  const hero = `<section class="card">
    <div class="grid3">
      <div class="stat"><div class="eyebrow">Gewichteter Schnitt</div>
        <div class="num big">${st.avg === null ? "–" : gradeStr(st.avg, 2)}</div>
        <div class="soft small">${st.avg === null ? "Trag deine erste Note ein" : `Im Zeugnis: <b>${gradeStr(st.trunc)}</b> · ${predicate(st.trunc)}`}</div>
      </div>
      <div class="stat"><div class="eyebrow">ECTS</div>
        <div class="num big">${fmtMax(st.ects, 1)}<small class="soft" style="font-size:20px"> / ${TOTAL_ECTS}</small></div>
        <div class="progress" style="margin-top:8px" title="Soll zum Start von Semester ${sem}: ${soll} ECTS"><i style="width:${pct}%"></i><b style="left:${(soll / TOTAL_ECTS) * 100}%"></b></div>
        <div class="soft small" style="margin-top:6px">${st.ects >= soll ? `Im Plan: Soll zum ${sem}. Semester sind ${soll} ECTS` : `${fmtMax(soll - st.ects, 1)} ECTS unter Regelstudienzeit-Soll (${soll})`}</div>
      </div>
      <div class="stat"><div class="eyebrow">Prognose mit Zielnoten</div>
        <div class="num big">${st.prog === null ? "–" : gradeStr(st.prog, 2)}</div>
        <div class="soft small">${st.prog === null ? "Gib anstehenden Klausuren eine Zielnote" : `inkl. ${st.targetsN} anstehende${st.targetsN === 1 ? "" : "n"} Klausur${st.targetsN === 1 ? "" : "en"} · Zeugnis ${gradeStr(truncGrade(st.prog))}`}</div>
      </div>
    </div>
    <p class="muted small" style="margin:14px 0 0">Am KIT zählt beim Schnitt nur die erste Nachkommastelle, der Rest wird ohne Rundung gestrichen. Unbenotete Module zählen zu den ECTS, nicht zum Schnitt.</p>
  </section>`;

  const up = st.planned.length ? st.planned.map((e) => {
    const d = e.date ? parseYmd(e.date) : null;
    const n = d ? dayDiff(new Date(), d) : null;
    const tone = n === null ? "" : n < 0 ? "bad" : n <= 7 ? "signal" : "";
    return `<div class="row">
      <div class="grow"><div class="t">${esc(e.name)} ${e.example ? '<span class="chip ex">Beispiel</span>' : ""}</div>
        <div class="s">${d ? `${fmtDate(d, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}${e.time ? " · " + esc(e.time) : ""}${e.loc ? " · " + esc(e.loc) : ""}` : "Termin offen"} · ${fmtMax(e.ects, 1)} ECTS${e.target ? ` · Ziel ${gradeStr(e.target)}` : ""}</div></div>
      ${d ? `<span class="chip ${tone}">${n < 0 ? "Note fehlt" : countdown(d)}</span>` : ""}
      <button class="btn btn-sm" data-act="exam-grade" data-id="${e.id}">Note</button>
      <button class="icon-btn" data-act="exam-edit" data-id="${e.id}" aria-label="Bearbeiten">${ICON.edit}</button>
    </div>`;
  }).join("") : `<div class="empty"><span><b>Keine anstehenden Klausuren.</b> Trag ein, was du schreibst, dann zählt das Dashboard die Tage runter.</span><button class="btn btn-sm" data-act="exam-new" data-status="planned">${ICON.plus} Anstehende Klausur</button></div>`;

  const semRows = st.bySem.length ? st.bySem.map((s) => `<div class="row"><div class="grow"><div class="t">${s.sem ? s.sem + ". Semester" : "Ohne Semester"}</div><div class="s">${s.n} Modul${s.n === 1 ? "" : "e"} · ${fmtMax(s.ects, 1)} ECTS</div></div><div class="num" style="font-size:24px">${gradeStr(s.avg, 2)}</div></div>`).join("")
    : `<div class="muted small">Sobald du Noten einträgst, siehst du hier deinen Schnitt pro Semester.</div>`;

  const doneSorted = st.done.slice().sort((a, b) => (b.semester || 0) - (a.semester || 0) || (b.date || "").localeCompare(a.date || ""));
  const table = doneSorted.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Modul</th><th>Sem.</th><th class="r">ECTS</th><th class="r">Note</th><th class="hide-sm">Prädikat</th><th></th></tr></thead><tbody>${doneSorted.map((e) => `<tr>
      <td><span style="font-weight:600">${esc(e.name)}</span> ${e.example ? '<span class="chip ex">Beispiel</span>' : ""}</td>
      <td>${e.semester || "–"}</td><td class="r">${fmtMax(e.ects, 1)}</td>
      <td class="r"><span class="num" style="font-size:18px">${e.ungraded ? "b." : gradeStr(e.grade)}</span></td>
      <td class="hide-sm"><span class="chip ${e.ungraded ? "good" : gradeTone(e.grade)}">${e.ungraded ? "bestanden" : predicate(e.grade)}</span></td>
      <td class="r"><button class="icon-btn" data-act="exam-edit" data-id="${e.id}" aria-label="Bearbeiten">${ICON.edit}</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><span><b>Noch keine Klausuren eingetragen.</b> Trag deine Module aus Semester 1 und 2 mit ECTS und Note ein. Der Schnitt rechnet sich sofort.</span><button class="btn btn-primary btn-sm" data-act="exam-new" data-status="done">${ICON.plus} Klausur eintragen</button></div>`;

  return `<header class="head"><div><div class="eyebrow">Wirtschaftsinformatik B.Sc. · KIT</div><h1>Studium</h1><div class="sub">${sem}. Semester · ${st.passed.length} Module bestanden${st.failed.length ? ` · ${st.failed.length} nicht bestanden` : ""}</div></div>
    <div class="head-actions"><button class="btn" data-act="exam-new" data-status="planned">${ICON.plus} Anstehend</button><button class="btn btn-primary" data-act="exam-new" data-status="done">${ICON.plus} Note eintragen</button></div></header>
    ${exampleBanner("uni")}
    ${loading ? loadingRow() : hero}
    <div class="grid2">
      ${card("Anstehende Klausuren", `<div class="list">${up}</div>`, { eyebrow: st.planned.length ? `${st.planned.length} geplant · ${fmtMax(st.plannedEcts, 1)} ECTS` : "Klausurenphase" })}
      ${card("Schnitt pro Semester", `<div class="list">${semRows}</div>`, { eyebrow: "Verlauf", actions: `<label class="small soft" style="display:flex;gap:6px;align-items:center">Aktuell <select class="input" style="width:auto;padding:5px 8px;font-size:14px" id="sem-sel" data-act="noop">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === sem ? "selected" : ""}>${n}. Sem.</option>`).join("")}</select></label>` })}
    </div>
    ${card("Abgeschlossene Klausuren", table, { eyebrow: `${st.done.length} Einträge` })}`;
};
RENDER["uni:after"] = (el) => {
  const sel = $("#sem-sel", el);
  if (sel) sel.onchange = () => setPrefs({ semester: Number(sel.value) });
};

/* ---------- Sheet: Klausur ---------- */
function courseSuggestions() {
  const set = new Set(S.exams.map((e) => e.name));
  S.cal.events.filter((e) => e.kind).forEach((e) => set.add(e.title));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "de"));
}
function examSheet(ex, status) {
  const e = ex || { status: status || "done", semester: Math.max(1, (prefs().semester || 3) - (status === "planned" ? 0 : 1)), ects: "" };
  const st = status || e.status;
  const pick = (name, val) => `<div class="pickgrid" data-pick="${name}">${GRADE_STEPS.map((g) => `<button type="button" data-act="pick" data-v="${g}" aria-pressed="${val === g}">${gradeStr(g)}</button>`).join("")}</div>`;
  openSheet(`${sheetHead(ex ? "Klausur bearbeiten" : st === "planned" ? "Anstehende Klausur" : "Klausur eintragen", "Uni")}
  <form class="form" data-form="exam" autocomplete="off">
    <input type="hidden" name="id" value="${esc(e.id || "")}">
    <input type="hidden" name="status" value="${st}">
    <div class="seg" role="group" aria-label="Status">
      <button type="button" data-act="exam-status" data-v="done" aria-pressed="${st === "done"}">Geschrieben</button>
      <button type="button" data-act="exam-status" data-v="planned" aria-pressed="${st === "planned"}">Anstehend</button>
    </div>
    <label class="field"><span>Modul / Klausur</span><input name="name" required list="course-list" value="${esc(e.name || "")}" placeholder="z. B. Grundlagen der Theoretischen Informatik"></label>
    <datalist id="course-list">${courseSuggestions().map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
    <div class="frow">
      <label class="field"><span>ECTS</span><input name="ects" inputmode="decimal" required value="${esc(e.ects ?? "")}" placeholder="6"></label>
      <label class="field"><span>Semester</span><select name="semester">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}" ${n === Number(e.semester) ? "selected" : ""}>${n}. Semester</option>`).join("")}</select></label>
    </div>
    <div data-group="done" ${st === "done" ? "" : "hidden"} class="form">
      <div class="field"><span>Note</span>${pick("grade", e.grade)}<input type="hidden" name="grade" value="${e.grade ?? ""}"></div>
      <div class="frow">
        <label class="field"><span>Andere Note (z. B. 1,5 bei Teilprüfungen)</span><input name="gradeFree" inputmode="decimal" placeholder="optional" value="${e.grade && !GRADE_STEPS.includes(e.grade) ? esc(fmtMax(e.grade, 2)) : ""}"></label>
        <label class="field"><span>Datum</span><input type="date" name="dateDone" value="${esc(e.status === "done" ? e.date || "" : "")}"></label>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="ungraded" ${e.ungraded ? "checked" : ""}> Unbenotet bestanden (zählt nur zu den ECTS)</label>
    </div>
    <div data-group="planned" ${st === "planned" ? "" : "hidden"} class="form">
      <div class="frow3">
        <label class="field"><span>Datum</span><input type="date" name="date" value="${esc(e.date || "")}"></label>
        <label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${esc(e.time || "")}"></label>
        <label class="field"><span>Ort</span><input name="loc" value="${esc(e.loc || "")}" placeholder="Audimax"></label>
      </div>
      <div class="field"><span>Zielnote (für die Prognose)</span>${pick("target", e.target)}<input type="hidden" name="target" value="${e.target ?? ""}"></div>
    </div>
    <div class="sheet-foot">${ex ? `<button type="button" class="btn btn-ghost" data-act="exam-del" data-id="${e.id}">${ICON.trash} Löschen</button>` : "<span></span>"}
      <div class="r"><button type="button" class="btn" data-act="sheet-close">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></div>
  </form>`);
}
ACT.pick = (el) => {
  const grid = el.closest("[data-pick]");
  const input = grid.parentElement.querySelector(`input[name="${grid.dataset.pick}"]`);
  const on = el.getAttribute("aria-pressed") !== "true";
  $$("button", grid).forEach((b) => b.setAttribute("aria-pressed", "false"));
  el.setAttribute("aria-pressed", String(on));
  input.value = on ? el.dataset.v : "";
};
ACT["exam-status"] = (el) => {
  const f = el.closest("form");
  f.status.value = el.dataset.v;
  $$("[data-act=exam-status]", f).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
  $$("[data-group]", f).forEach((g) => (g.hidden = g.dataset.group !== el.dataset.v));
};
ACT["exam-new"] = (el) => examSheet(null, el.dataset.status);
ACT["exam-edit"] = (el) => examSheet(S.exams.find((x) => x.id === el.dataset.id));
ACT["exam-grade"] = (el) => { const e = S.exams.find((x) => x.id === el.dataset.id); examSheet({ ...e }, "done"); };
ACT["exam-del"] = async (el) => { if (!armed(el)) return; await Store.del("exams", el.dataset.id); closeSheet(); toast("Klausur gelöscht"); };
FORMS.exam = async (f) => {
  const v = (n) => (f[n] ? f[n].value.trim() : "");
  const status = v("status");
  const ects = parseNum(v("ects"));
  if (!v("name")) return toast("Gib einen Modulnamen ein.");
  if (!ects || ects <= 0 || ects > 60) return toast("ECTS bitte als Zahl zwischen 0,5 und 60.");
  const ungraded = status === "done" && f.ungraded.checked;
  let grade = parseNum(v("gradeFree")) ?? parseNum(v("grade"));
  if (status === "done" && !ungraded && (grade === null || grade < 1 || grade > 5)) return toast("Wähle eine Note zwischen 1,0 und 5,0.");
  const old = S.exams.find((x) => x.id === v("id"));
  const doc = {
    name: v("name"), ects, semester: Number(v("semester")) || null, status,
    grade: status === "done" && !ungraded ? grade : null, ungraded,
    date: status === "done" ? v("dateDone") || (old && old.date) || ymd(new Date()) : v("date") || null,
    time: status === "planned" ? v("time") || null : null,
    loc: status === "planned" ? v("loc") || null : null,
    target: status === "planned" ? parseNum(v("target")) : (old && old.target) || null,
    example: false,
    createdAt: (old && old.createdAt) || new Date().toISOString(),
    gradedAt: status === "done" ? (old && old.status === "done" && old.gradedAt) || new Date().toISOString() : null,
  };
  const id = v("id") || uid();
  const ok = await Store.put("exams", id, doc);
  if (!ok) return;
  const removed = await clearExamples("exams", id);
  closeSheet();
  toast((status === "done" ? "Note gespeichert" : "Klausur eingetragen") + (removed ? " · Beispiele entfernt" : ""));
};
