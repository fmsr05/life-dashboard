/* Life Dashboard – Heute: Wochenstreifen, Kennzahlen, Wochenbrief, Kalender, Mails, Finanz-Briefing */
"use strict";

const weekInfo = (offset) => { const ws = addDays(startOfWeek(new Date()), 7 * offset); return { ws, we: addDays(ws, 7), key: weekKey(ws), kw: isoWeek(ws).week }; };
const eventsBetween = (a, b) => S.cal.events.filter((e) => !e.holiday && e.start < b && e.end > a);
const isUni = (e) => !!e.kind || e.calShort === "KIT" || e.calShort === "Tutorium";
const dayIdx = () => (new Date().getDay() + 6) % 7;
const briefMode = () => S.briefMode || (dayIdx() <= 3 ? "preview" : "review");

/* ---------- Kalender-Karte ---------- */
function evRow(e, now) {
  const running = !e.allDay && e.start <= now && e.end > now;
  const soon = !e.allDay && e.start > now && e.start - now < 60 * 60e3;
  const meta = [e.kind, e.loc, e.who].filter(Boolean).map(esc).join(" · ");
  const inner = `<div class="time">${e.allDay ? "Ganz-<small>tägig</small>" : `${fmtTime(e.start)}<small>${fmtTime(e.end)}</small>`}</div>
    <span class="ev-bar" style="background:${e.color}"></span>
    <div class="grow"><div class="t clamp1">${esc(e.title)}</div><div class="s">${running ? "<b>Läuft gerade</b> · " : soon ? `<b>In ${Math.max(1, Math.round((e.start - now) / 60e3))} Min.</b> · ` : ""}${meta || esc(e.calShort)}</div></div>`;
  return e.link ? `<a class="row rowlink ${running ? "now-ev" : ""}" href="${esc(e.link)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="row ${running ? "now-ev" : ""}">${inner}</div>`;
}
function calendarCard() {
  const now = new Date();
  const sel = S.selDay ? parseYmd(S.selDay) : startOfDay(now);
  const title = relDay(sel) === fmtDate(sel) ? fmtDate(sel, { weekday: "long", day: "numeric", month: "long" }) : relDay(sel);
  const actions = S.google === "ok" ? `<button class="icon-btn" data-act="cal-settings" aria-label="Kalender auswählen">${ICON.edit}</button><button class="icon-btn" data-act="cal-refresh" aria-label="Kalender neu laden">${ICON.refresh}</button>` : "";
  let body = "";
  if (S.cal.error && !S.cal.events.length) body = `<div class="note warn">${esc(S.cal.error.text)}</div>${S.cal.error.canAllow ? `<div style="margin-top:10px"><button class="btn btn-sm btn-primary" data-act="cal-allow">Mit Google verbinden</button></div>` : ""}`;
  else if (S.cal.state === "loading" && !S.cal.events.length) body = loadingRow("Kalender lädt …");
  else {
    const list = eventsOn(sel);
    const hol = list.filter((e) => e.holiday);
    const evs = list.filter((e) => !e.holiday);
    body = (hol.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${hol.map((h) => `<span class="chip bad">${esc(h.title)}</span>`).join("")}</div>` : "")
      + (evs.length ? `<div class="list">${evs.map((e) => evRow(e, now)).join("")}</div>`
        : `<div class="muted" style="padding:6px 0 4px">${dayDiff(now, sel) < 0 ? "An diesem Tag stand nichts im Kalender." : "Nichts im Kalender. Gute Gelegenheit für Deep Work oder Gym."}</div>`);
    const end = addDays(startOfDay(sel), 1);
    const next = S.cal.events.filter((e) => !e.holiday && e.start >= end).slice(0, 4);
    if (next.length) {
      let lastDay = "";
      body += `<div class="daylabel" style="padding-top:16px">Als Nächstes</div><div class="list">${next.map((e) => { const dl = relDay(e.start); const lbl = dl !== lastDay ? dl : ""; lastDay = dl; return `${lbl ? `<div class="daylabel" style="padding-top:8px">${esc(lbl)}</div>` : ""}${evRow(e, now)}`; }).join("")}</div>`;
    }
    if (S.cal.stale) body += `<p class="muted small" style="margin:10px 0 0">Kalender gerade nicht erreichbar, Stand ${freshness(S.cal.storedAt)}.</p>`;
  }
  const n = S.cal.state === "ready" ? eventsOn(sel).filter((e) => !e.holiday).length : null;
  return card(esc(title), body, { eyebrow: `Kalender${n !== null ? ` · ${n} Termin${n === 1 ? "" : "e"}` : ""}`, actions });
}
ACT.day = (el) => { S.selDay = el.dataset.d === ymd(new Date()) ? null : el.dataset.d; renderView("heute", true); };
ACT["cal-settings"] = () => {
  const hidden = new Set(prefs().hiddenCals || []);
  openSheet(`${sheetHead("Welche Kalender?", "Kalender")}
    <div class="list">${S.cal.calendars.map((c) => `<label class="row" style="cursor:pointer"><span class="sw" style="background:${c.color}"></span><span class="grow"><span class="t">${esc(c.name)}</span></span><input type="checkbox" data-act="cal-toggle" data-id="${esc(c.id)}" ${hidden.has(c.id) ? "" : "checked"} style="width:20px;height:20px"></label>`).join("") || '<div class="muted">Keine Kalender gefunden.</div>'}</div>
    <div class="sheet-foot"><span class="muted small">Gilt auf allen deinen Geräten.</span><div class="r"><button class="btn btn-primary" data-act="sheet-close">Fertig</button></div></div>`);
};

/* ---------- Mail-Karte ---------- */
function mailCard() {
  const f = S.mail.filter;
  const seg = `<div class="seg">${[["inbox", "Posteingang"], ["unread", "Ungelesen"], ["all", "Alle"]].map(([k, l]) => `<button data-act="mail-filter" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (S.mail.state === "error") body = `<div class="note warn">${esc(S.mail.error.text)}</div>${S.mail.error.canAllow ? `<div style="margin-top:10px"><button class="btn btn-sm btn-primary" data-act="mail-allow">Mit Google verbinden</button></div>` : ""}`;
  else if (S.mail.state === "loading") body = loadingRow("Mails laden …");
  else if (!S.mail.threads.length) body = `<div class="muted" style="padding:6px 0">${f === "unread" ? "Alles gelesen. Inbox Zero." : "Keine Mails in dieser Ansicht."}</div>`;
  else body = `<div class="list">${S.mail.threads.slice(0, 8).map((t) => `<a class="row rowlink ${t.unread ? "unread" : ""}" href="${esc(t.url || "https://mail.google.com/")}" target="_blank" rel="noopener" style="align-items:flex-start">
      <div class="grow"><div style="display:flex;justify-content:space-between;gap:10px"><span class="t clamp1">${esc(t.from)}${t.count > 1 ? ` <span class="muted">(${t.count})</span>` : ""}</span><span class="muted small tab" style="flex:none">${t.date ? esc(mailDate(t.date)) : ""}</span></div>
      <div class="clamp1" style="font-size:14px;${t.unread ? "font-weight:600" : ""}">${esc(t.subject)}</div><div class="s">${esc(t.snippet)}</div></div></a>`).join("")}</div>`;
  const unread = S.mail.threads.filter((t) => t.unread).length;
  const foot = S.mail.state === "ready" ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap"><a class="btn btn-sm" href="https://mail.google.com/" target="_blank" rel="noopener">${ICON.ext} Gmail öffnen</a><span class="muted small">${S.mail.stale ? "Gerade nicht erreichbar · " : ""}${freshness(S.mail.storedAt)}</span></div>` : "";
  return card("Mails", `<div style="margin-bottom:10px">${seg}</div>${body}${foot}`, { eyebrow: `Gmail${S.mail.state === "ready" ? ` · ${unread} ungelesen` : ""}`, actions: S.google === "ok" ? `<button class="icon-btn" data-act="mail-refresh" aria-label="Mails neu laden">${ICON.refresh}</button>` : "" });
}

/* ---------- Finanz-Briefing ---------- */
function newsCard() {
  const n = S.news;
  if (!n) {
    return card("Finanz-Briefing", `<div class="empty"><span><b>Noch kein Briefing da.</b> Jeden Morgen um 7 Uhr legt Claude hier die wichtigsten Finanzthemen aus Deutschland und der Welt ab.</span></div>`, { eyebrow: "Täglich" });
  }
  const age = n.date ? dayDiff(parseYmd(n.date), new Date()) : 0;
  const item = (x) => `<div class="news-item"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p>${x.source ? `<div class="src">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.source)}</a>` : esc(x.source)}</div>` : ""}</div>`;
  const tick = (m) => `<div class="ticker"><div class="eyebrow">${esc(m.label)}</div><div class="num v">${esc(m.value)}</div>${m.change ? `<div class="small ${m.dir === "up" ? "up" : m.dir === "down" ? "down" : "muted"}" style="font-weight:600">${esc(m.change)}</div>` : ""}</div>`;
  const body = `${age > 0 ? `<div class="note" style="margin-bottom:12px">Briefing von ${age === 1 ? "gestern" : `vor ${age} Tagen`}. Das nächste kommt morgen früh.</div>` : ""}
    ${(n.metrics || []).length ? `<div class="tickers" style="margin-bottom:14px">${n.metrics.map(tick).join("")}</div>` : ""}
    <div class="grid2">
      <div><div class="eyebrow" style="margin-bottom:8px">Welt</div>${(n.world || []).map(item).join("") || '<div class="muted small">–</div>'}</div>
      <div><div class="eyebrow" style="margin-bottom:8px">Deutschland & Europa</div>${(n.germany || []).map(item).join("") || '<div class="muted small">–</div>'}</div>
    </div>
    ${(n.dates || []).length ? `<div class="daylabel" style="padding-top:14px">Termine, die Märkte bewegen</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${n.dates.map((d) => `<span class="chip">${esc(d.date)} · ${esc(d.label)}</span>`).join("")}</div>` : ""}
    ${n.why ? `<p class="soft small" style="margin:14px 0 0;max-width:72ch"><b>Was das für dich heißt:</b> ${esc(n.why)}</p>` : ""}`;
  return card(esc(n.headline || "Finanz-Briefing"), body, { eyebrow: `Finanz-Briefing · ${esc(n.asOf || (n.date ? parseYmd(n.date).toLocaleDateString("de-DE") : ""))}`, cls: "span2" });
}

/* ---------- Wochenbrief ---------- */
function previewData(w) {
  const evs = eventsBetween(w.ws, w.we);
  const days = Array.from({ length: 7 }, (_, i) => { const d = addDays(w.ws, i); const l = eventsOn(d); return { d, evs: l.filter((e) => !e.holiday), hol: l.filter((e) => e.holiday) }; });
  const exams = examStats().planned.filter((e) => e.date && dayDiff(w.ws, parseYmd(e.date)) >= 0 && dayDiff(w.ws, parseYmd(e.date)) < 21);
  const busiest = days.reduce((a, b) => (b.evs.length > a.evs.length ? b : a), days[0]);
  return { evs, uni: evs.filter(isUni).length, days, exams, busiest, fin: financeStats(), goal: prefs().trainingGoal || 3 };
}
function reviewData(w) {
  const now = new Date();
  const st = trainingStats(w.ws);
  const bs = bodyStats();
  const end = w.we < now ? w.we : now;
  const before = weightAt(bs.ws, addDays(w.ws, -1)), last = weightAt(bs.ws, addDays(w.we, -1));
  const dW = before && last && before !== last ? last.kg - before.kg : null;
  const grades = S.exams.filter((e) => e.status === "done" && e.gradedAt && new Date(e.gradedAt) >= w.ws && new Date(e.gradedAt) < w.we);
  const evs = eventsBetween(w.ws, end).filter((e) => !e.allDay);
  return { st, dW, grades, evs, uni: evs.filter(isUni).length };
}
function briefCard() {
  const mode = briefMode();
  const off = mode === "preview" ? (dayIdx() <= 3 ? 0 : 1) : (dayIdx() >= 4 ? 0 : -1);
  const w = weekInfo(off);
  const doc = S.weeks[w.key] || {};
  const calOk = S.cal.state === "ready" || S.cal.events.length > 0;
  const seg = `<div class="seg"><button data-act="brief" data-v="preview" aria-pressed="${mode === "preview"}">Vorschau</button><button data-act="brief" data-v="review" aria-pressed="${mode === "review"}">Rückblick</button></div>`;
  const range = `${w.ws.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}–${addDays(w.we, -1).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
  const aiKey = mode === "preview" ? "aiPreview" : "aiReview";
  const busy = S.ai && S.ai.key === w.key && S.ai.kind === mode;
  const aiText = busy ? S.ai.text || "Claude denkt nach …" : doc[aiKey] || "";
  const aiBox = S.sampleOff ? "" : `<div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
      ${aiText ? `<div class="ai-text" id="ai-box">${esc(aiText)}</div>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${busy ? `<button class="btn btn-sm" data-act="ai-stop">Stopp</button>` : `<button class="btn btn-sm ${aiText ? "" : "btn-primary"}" data-act="ai" data-kind="${mode}" data-key="${w.key}">${ICON.spark} ${aiText ? "Neu schreiben lassen" : mode === "preview" ? "Wochenplan von Claude" : "Rückblick von Claude"}</button>`}</div></div>`;
  let body;
  if (mode === "preview") {
    const p = previewData(w);
    body = `<div class="brief-title">${off === 0 ? "Diese Woche" : "Nächste Woche"} steht an</div>
      <div class="brief-grid">
        <div class="stat"><div class="eyebrow">Termine</div><div class="num v">${calOk ? p.evs.length : "–"}</div><div class="muted small">${calOk ? `${p.uni} davon Uni` : "Kalender fehlt"}</div></div>
        <div class="stat"><div class="eyebrow">Klausuren (3 Wo.)</div><div class="num v">${p.exams.length}</div><div class="muted small clamp1">${p.exams[0] ? esc(p.exams[0].name) : "keine geplant"}</div></div>
        <div class="stat"><div class="eyebrow">Trainingsziel</div><div class="num v">${p.goal}<small>×</small></div><div class="muted small">Einheiten</div></div>
        <div class="stat"><div class="eyebrow">Budget</div><div class="num v">${p.fin.has ? eur(p.fin.perWeek, 0) : "–"}</div><div class="muted small">frei für die Woche</div></div>
      </div>
      ${calOk ? `<div class="daygrid" style="margin-top:16px">${p.days.map((d) => `<div><div class="eyebrow">${DOW[d.d.getDay()]}</div><div class="n">${d.evs.length}</div><div class="muted clamp1">${d.hol.length ? esc(d.hol[0].title) : d.evs[0] && !d.evs[0].allDay ? "ab " + fmtTime(d.evs[0].start) : d.evs.length ? "ganztägig" : "frei"}</div></div>`).join("")}</div>
        ${p.busiest.evs.length >= 3 ? `<p class="soft small" style="margin:12px 0 0">Vollster Tag: <b>${p.busiest.d.toLocaleDateString("de-DE", { weekday: "long" })}</b> mit ${p.busiest.evs.length} Terminen. Plan das Training lieber auf einen ruhigeren Tag.</p>` : ""}` : ""}
      ${p.exams.length ? `<div class="list" style="margin-top:12px">${p.exams.map((e) => `<div class="row"><div class="grow"><div class="t clamp1">${esc(e.name)}</div><div class="s muted">${fmtDate(parseYmd(e.date))}${e.time ? " · " + esc(e.time) : ""}</div></div><span class="chip signal">${countdown(parseYmd(e.date))}</span></div>`).join("")}</div>` : ""}`;
  } else {
    const r = reviewData(w);
    const g = r.st.goal, n = r.st.week.length;
    body = `<div class="brief-title">${n >= g ? "Starke Woche." : off === 0 ? "Deine Woche bis jetzt" : "So lief deine Woche"}</div>
      <div class="brief-grid">
        <div class="stat"><div class="eyebrow">Training</div><div class="num v">${n}<small>/ ${g}</small></div><div class="muted small">${fmtVol(r.st.weekVol)} Volumen</div></div>
        <div class="stat"><div class="eyebrow">Bestleistungen</div><div class="num v">${r.st.prsWeek.length}</div><div class="muted small clamp1">${r.st.prsWeek[0] ? esc(r.st.prsWeek[0].name) : "diesmal keine"}</div></div>
        <div class="stat"><div class="eyebrow">Gewicht</div><div class="num v">${signed(r.dW, 1)}<small>kg</small></div><div class="muted small">ggü. Vorwoche</div></div>
        <div class="stat"><div class="eyebrow">Termine</div><div class="num v">${calOk ? r.evs.length : "–"}</div><div class="muted small">${calOk ? `${r.uni} davon Uni` : "Kalender fehlt"}</div></div>
      </div>
      ${r.grades.length ? `<p class="soft small" style="margin:12px 0 0">Neue Noten: ${r.grades.map((e) => `<b>${esc(e.name)}</b> ${e.ungraded ? "bestanden" : gradeStr(e.grade)}`).join(" · ")}</p>` : ""}
      <div class="grid3" style="margin-top:16px">
        <label class="field"><span class="muted">Was lief gut?</span><textarea class="input" data-week="${w.key}" data-field="good" rows="2">${esc(doc.good || "")}</textarea></label>
        <label class="field"><span class="muted">Was machst du besser?</span><textarea class="input" data-week="${w.key}" data-field="better" rows="2">${esc(doc.better || "")}</textarea></label>
        <label class="field"><span class="muted">Fokus nächste Woche</span><textarea class="input" data-week="${w.key}" data-field="focus" rows="2">${esc(doc.focus || "")}</textarea></label>
      </div>`;
  }
  return `<section class="card brief"><div class="card-h"><div><div class="eyebrow">${mode === "preview" ? "Wochenvorschau" : "Wochenrückblick"} · KW ${w.kw} · ${range}</div></div>${seg}</div>${body}${aiBox}</section>`;
}
ACT.brief = (el) => { S.briefMode = el.dataset.v; renderView("heute", true); };

/* ---------- Claude (sample) ---------- */
let aiCtl = null;
function aiPrompt(kind, key) {
  const off = key === weekInfo(0).key ? 0 : key === weekInfo(1).key ? 1 : -1;
  const w = weekInfo(off);
  const ev = eventsBetween(w.ws, w.we).filter((e) => !e.allDay).slice(0, 60).map((e) => `${DOW[e.start.getDay()]} ${fmtTime(e.start)}–${fmtTime(e.end)} ${e.title}${e.kind ? " (" + e.kind + ")" : ""}`);
  const ex = examStats();
  const fin = financeStats();
  const base = `Du bist ein knapper, motivierender Coach für einen 21-jährigen Wirtschaftsinformatik-Studenten am KIT (3. Semester) mit großen Zielen. Antworte auf Deutsch in der Du-Form, höchstens 130 Wörter, ohne Überschriften und ohne Markdown außer Aufzählungspunkten mit "• ". Keine Anlageberatung.`;
  if (kind === "preview") {
    const p = previewData(w);
    return `${base}\n\nAufgabe: Erstelle einen kurzen Wochenplan für KW ${w.kw}. Zuerst 2 Sätze Einordnung (wie voll ist die Woche, worauf kommt es an). Dann 3 konkrete Prioritäten als Aufzählung, inkl. wann das Training (${p.goal}× geplant) am besten passt.\n\nDaten:\nTermine:\n${ev.join("\n") || "keine"}\nAnstehende Klausuren: ${ex.planned.filter((e) => e.date).slice(0, 5).map((e) => `${e.name} am ${e.date}`).join("; ") || "keine eingetragen"}\nBudget frei diese Woche: ${fin.has ? eur(fin.perWeek, 0) : "unbekannt"}`;
  }
  const r = reviewData(w), doc = S.weeks[key] || {};
  return `${base}\n\nAufgabe: Schreib einen ehrlichen Wochenrückblick für KW ${w.kw}. Zuerst 2–3 Sätze, was gut lief und was nicht. Dann 3 Fokuspunkte für nächste Woche als Aufzählung.\n\nDaten:\nTrainings: ${r.st.week.length} von ${r.st.goal} geplant, Volumen ${fmtVol(r.st.weekVol)}, neue Bestleistungen: ${r.st.prsWeek.map((b) => b.name).join(", ") || "keine"}\nGewichtsänderung zur Vorwoche: ${r.dW === null ? "unbekannt" : signed(r.dW, 1, " kg")} (Ziel: ${GOALS[body().goal] || "unbekannt"})\nTermine wahrgenommen: ${r.evs.length} (${r.uni} Uni)\nNeue Noten: ${r.grades.map((e) => `${e.name} ${e.grade ?? "bestanden"}`).join(", ") || "keine"}\nSchnitt aktuell: ${ex.avg === null ? "noch keiner" : gradeStr(ex.avg, 2)}\nEigene Notizen: gut: "${doc.good || "-"}"; besser: "${doc.better || "-"}"; Fokus: "${doc.focus || "-"}"`;
}
ACT.ai = async (el) => {
  if (!S.sample) return toast("Claude ist in dieser Ansicht nicht verfügbar.");
  const kind = el.dataset.kind, key = el.dataset.key;
  aiCtl = new AbortController();
  S.ai = { kind, key, text: "" };
  renderView("heute", true);
  try {
    const { text } = await S.sample(aiPrompt(kind, key), { cache: false, signal: aiCtl.signal, onText: ({ text }) => { S.ai.text = text; const b = $("#ai-box"); if (b) b.textContent = text; } });
    const field = kind === "preview" ? "aiPreview" : "aiReview";
    S.ai = null;
    await Store.setWeek(key, { ...(S.weeks[key] || {}), [field]: text, [field + "At"]: new Date().toISOString() });
  } catch (e) {
    S.ai = null;
    const c = e && e.code;
    if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(c)) { S.sampleOff = true; toast("Claude ist für dieses Dashboard nicht freigegeben."); }
    else if (c === "rate_limited") toast("Gerade zu viele Anfragen an Claude. Probier es später nochmal.");
    else if (c === "session_expired") toast("Bitte melde dich bei claude.ai neu an.");
    else if (c !== "cancelled") toast("Claude konnte gerade nicht antworten. Versuch es nochmal.");
  }
  renderView("heute", true);
};
ACT["ai-stop"] = () => { if (aiCtl) aiCtl.abort(); };

/* ---------- Heute ---------- */
RENDER.heute = () => {
  const now = new Date();
  const ws = startOfWeek(now);
  const st = trainingStats();
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i), key = ymd(d), l = S.cal.events.length ? eventsOn(d) : [];
    const n = l.filter((e) => !e.holiday).length, hol = l.some((e) => e.holiday);
    const tr = S.workouts.some((w) => w.date === key);
    const isToday = key === ymd(now), sel = S.selDay === key;
    return `<button class="wday ${isToday ? "today" : ""} ${sel ? "sel" : ""} ${d < startOfDay(now) ? "past" : ""}" data-act="day" data-d="${key}" aria-label="${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}: ${n} Termine${tr ? ", Training" : ""}">
      <span class="dn">${DOW[d.getDay()]}</span><span class="dd">${d.getDate()}</span>
      <span class="dots">${Array.from({ length: Math.min(3, n) }, () => "<i></i>").join("")}${hol ? '<i class="h"></i>' : ""}${tr ? '<i class="t"></i>' : ""}</span></button>`;
  }).join("");
  const ex = examStats(), fin = financeStats(), bs = bodyStats();
  const nextExam = ex.planned.find((e) => e.date && parseYmd(e.date) >= startOfDay(now));
  const todayN = S.cal.events.length ? eventsOn(now).filter((e) => !e.holiday && !e.allDay && e.end > now).length : null;
  const kpi = (view, label, v, d) => `<button class="kpi" data-act="go" data-view="${view}"><span class="eyebrow">${label}</span><span class="num v">${v}</span><span class="d">${d}</span></button>`;
  const first = (S.name || prefs().name || "").split(/\s+/)[0];
  return `<header class="head"><div><div class="eyebrow">${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · KW ${isoWeek(now).week}</div>
      <h1>${greeting()}${first ? ", " + esc(first) : ""}.</h1>
      <div class="sub">${todayN === null ? `${prefs().semester}. Semester Wirtschaftsinformatik` : todayN ? `Heute noch ${todayN} Termin${todayN === 1 ? "" : "e"}.` : "Heute keine Termine mehr."}${nextExam ? ` Nächste Klausur ${countdown(parseYmd(nextExam.date))}.` : ""}</div></div>
      <div class="head-actions"><button class="btn" data-act="settings" aria-label="Einstellungen">${ICON.gear}</button><button class="btn" data-act="wo-new">${ICON.plus} Training</button><button class="btn" data-act="quick-weight">${ICON.plus} Gewicht</button></div></header>
    <div class="weekstrip" role="group" aria-label="Diese Woche">${strip}</div>
    ${exampleBanner("all")}
    <div class="kpis">
      ${kpi("uni", "Notenschnitt", ex.avg === null ? "–" : gradeStr(ex.avg, 2), nextExam ? `${esc(nextExam.name)} ${countdown(parseYmd(nextExam.date))}` : `${fmtMax(ex.ects, 1)} / ${TOTAL_ECTS} ECTS`)}
      ${kpi("geld", "Frei / Monat", fin.has ? eur(fin.free, 0) : "–", fin.has ? `≈ ${eur(fin.perWeek, 0)} pro Woche` : "Budget einrichten")}
      ${kpi("training", "Training", `${st.week.length}<small>/ ${st.goal}</small>`, st.prsWeek.length ? `${st.prsWeek.length} neue Bestleistung${st.prsWeek.length === 1 ? "" : "en"}` : "diese Woche")}
      ${kpi("koerper", "Gewicht", bs.cur ? `${fmtMax(bs.cur.kg, 1)}<small>kg</small>` : "–", bs.d30 !== null ? `${signed(bs.d30, 1, " kg")} in 30 Tagen` : bs.cur ? "Trend folgt" : "Ersten Wert eintragen")}
    </div>
    ${briefCard()}
    <div class="grid2">${calendarCard()}${mailCard()}${newsCard()}</div>`;
};
RENDER["heute:after"] = (el) => {
  el.onchange = async (e) => {
    const t = e.target;
    if (!t.dataset.week) return;
    const key = t.dataset.week;
    await Store.setWeek(key, { ...(S.weeks[key] || {}), [t.dataset.field]: t.value.trim(), updatedAt: new Date().toISOString() });
    toast("Notiz gespeichert");
  };
};
ACT["quick-weight"] = () => { go("koerper"); setTimeout(() => { const i = $("#w-kg"); if (i) i.focus(); }, 60); };
