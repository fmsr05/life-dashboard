/* Life Dashboard – Finanzen: Job, Einnahmen, Fixkosten, Monatsbudget */
"use strict";

const EXP_CATS = [
  { id: "wohnen", label: "Wohnen", c: "var(--s1)" },
  { id: "mobil", label: "Mobilität", c: "var(--s2)" },
  { id: "vers", label: "Versicherung", c: "var(--s3)" },
  { id: "abos", label: "Abos", c: "var(--s4)" },
  { id: "handy", label: "Handy & Internet", c: "var(--s5)" },
  { id: "uni", label: "Uni", c: "var(--s6)" },
  { id: "sport", label: "Sport", c: "var(--s7)" },
  { id: "sonst", label: "Sonstiges", c: "var(--s8)" },
];
const CYCLES = { m: { label: "monatlich", div: 1 }, s: { label: "pro Semester", div: 6 }, y: { label: "jährlich", div: 12 }, q: { label: "pro Quartal", div: 3 } };
const JOB_TYPES = ["Werkstudent", "Minijob", "Teilzeit", "Praktikum", "HiWi", "Selbstständig", "Vollzeit"];
const MINIJOB_LIMIT = 603;

const finance = () => ({ employer: "", role: "", hours: null, net: null, incomes: [], expenses: [], savings: null, ...(S.finance || {}) });
const monthly = (x) => (Number(x.amount) || 0) / (CYCLES[x.cycle || "m"] || CYCLES.m).div;
function financeStats() {
  const f = finance();
  const salary = Number(f.net) || 0;
  const other = sum(f.incomes, (i) => monthly(i));
  const income = salary + other;
  const fixed = sum(f.expenses, (e) => monthly(e));
  const savings = Number(f.savings) || 0;
  const free = income - fixed - savings;
  const byCat = EXP_CATS.map((c) => ({ ...c, v: sum(f.expenses.filter((e) => (e.cat || "sonst") === c.id), monthly) })).filter((c) => c.v > 0);
  const hourly = f.hours && salary ? salary / (f.hours * 4.33) : null;
  return { f, salary, other, income, fixed, savings, free, perWeek: (free * 12) / 52, perDay: (free * 12) / 365, byCat, hourly, has: income > 0 || fixed > 0 };
}

RENDER.geld = () => {
  const st = financeStats(), f = st.f;
  const loading = S.dbState !== "none" && !S.loaded.finance;
  const base = Math.max(st.income, st.fixed + st.savings, 1);
  const segs = [...st.byCat.map((c) => ({ c: c.c, v: c.v, label: c.label })), ...(st.savings > 0 ? [{ c: "var(--ink-3)", v: st.savings, label: "Sparen" }] : []), ...(st.free > 0 ? [{ c: "var(--accent-soft)", v: st.free, label: "Frei" }] : [])];
  const bar = st.has ? `<div class="stack" aria-hidden="true">${segs.map((s) => `<i style="width:${(s.v / base) * 100}%;background:${s.c}" title="${esc(s.label)}: ${eur(s.v)}"></i>`).join("")}</div>` : "";
  const hero = `<section class="card">
    <div class="eyebrow">Monatlich frei verfügbar</div>
    <div class="num big ${st.free < 0 ? "down" : ""}" style="margin:4px 0 6px">${st.has ? eur(st.free, 0) : "–"}</div>
    <div class="soft">${st.has ? `≈ <b>${eur(st.perWeek, 0)}</b> pro Woche · <b>${eur(st.perDay, 0)}</b> pro Tag${st.free < 0 ? " · <b>Du gibst mehr aus, als reinkommt.</b>" : ""}` : "Trag dein Gehalt und deine monatlichen Abgaben ein, dann steht hier dein Budget."}</div>
    ${bar ? `<div style="margin-top:16px">${bar}</div>` : ""}
    <div class="statline" style="margin-top:16px">
      <div class="stat"><div class="eyebrow">Einnahmen</div><div class="num v">${eur(st.income, 0)}</div></div>
      <div class="stat"><div class="eyebrow">Fixkosten</div><div class="num v">${eur(st.fixed, 0)}</div></div>
      <div class="stat"><div class="eyebrow">Sparrate</div><div class="num v">${eur(st.savings, 0)}</div></div>
      <div class="stat"><div class="eyebrow">Sparquote</div><div class="num v">${st.income ? fmt((st.savings / st.income) * 100, 0) : "–"}<small>%</small></div></div>
    </div>
  </section>`;

  const job = `${card(f.employer ? esc(f.employer) : "Kein Arbeitgeber eingetragen", `
    <div class="statline">
      <div class="stat"><div class="eyebrow">Netto / Monat</div><div class="num v">${eur(st.salary, 0)}</div></div>
      <div class="stat"><div class="eyebrow">Stunden / Woche</div><div class="num v">${f.hours ? fmtMax(f.hours, 1) : "–"}</div></div>
      <div class="stat"><div class="eyebrow">Netto / Stunde</div><div class="num v">${st.hourly ? eur(st.hourly, 2) : "–"}</div></div>
    </div>
    ${f.role === "Minijob" ? `<p class="note" style="margin:14px 0 0">Minijob-Grenze 2026: ${MINIJOB_LIMIT} € im Monat. ${st.salary > MINIJOB_LIMIT ? "<b>Du liegst darüber.</b>" : `Noch ${eur(MINIJOB_LIMIT - st.salary, 0)} Luft.`}</p>` : ""}
    ${f.role === "Werkstudent" && f.hours > 20 ? `<p class="note warn" style="margin:14px 0 0">Mehr als 20 Std./Woche in der Vorlesungszeit gefährdet den Werkstudentenstatus.</p>` : ""}`,
    { eyebrow: f.role ? esc(f.role) : "Job", actions: `<button class="btn btn-sm" data-act="job-edit">${ICON.edit} Bearbeiten</button>` })}`;

  const line = (x, kind) => `<div class="row">
    ${kind === "exp" ? `<span class="sw" style="background:${(EXP_CATS.find((c) => c.id === (x.cat || "sonst")) || EXP_CATS[7]).c}"></span>` : ""}
    <div class="grow"><div class="t clamp1">${esc(x.name)}</div><div class="s">${kind === "exp" ? esc((EXP_CATS.find((c) => c.id === (x.cat || "sonst")) || EXP_CATS[7]).label) + " · " : ""}${CYCLES[x.cycle || "m"].label}${(x.cycle || "m") !== "m" ? ` · ${eur(x.amount)} → ${eur(monthly(x))}/Monat` : ""}</div></div>
    <div class="num" style="font-size:19px">${eur(monthly(x), monthly(x) % 1 ? 2 : 0)}</div>
    <button class="icon-btn" data-act="line-edit" data-kind="${kind}" data-id="${x.id}" aria-label="Bearbeiten">${ICON.edit}</button></div>`;
  const incomes = card("Weitere Einnahmen", `<div class="list">${f.incomes.length ? f.incomes.map((x) => line(x, "inc")).join("") : `<div class="muted small">BAföG, Unterhalt, Kindergeld, Nebenjobs, Zinsen …</div>`}</div>`,
    { eyebrow: `${eur(st.other, 0)} / Monat`, actions: `<button class="btn btn-sm" data-act="line-new" data-kind="inc">${ICON.plus} Einnahme</button>` });
  const catLegend = st.byCat.length ? `<div class="lg" style="margin-bottom:10px">${st.byCat.map((c) => `<span><i class="sw" style="background:${c.c};width:10px;height:10px"></i>${esc(c.label)} ${eur(c.v, 0)}</span>`).join("")}</div>` : "";
  const exps = card("Monatliche Abgaben", `${catLegend}<div class="list">${f.expenses.length ? f.expenses.slice().sort((a, b) => monthly(b) - monthly(a)).map((x) => line(x, "exp")).join("") : `<div class="muted small">Miete, Deutschlandticket, Handy, Versicherungen, Gym, Streaming … Semesterbeitrag kannst du „pro Semester“ eintragen.</div>`}</div>`,
    { eyebrow: `${eur(st.fixed, 0)} / Monat`, actions: `<button class="btn btn-sm" data-act="line-new" data-kind="exp">${ICON.plus} Abgabe</button>` });

  return `<header class="head"><div><div class="eyebrow">Monatsbudget</div><h1>Finanzen</h1><div class="sub">${f.employer ? `${esc(f.role || "Job")} bei ${esc(f.employer)}` : "Gehalt, Einnahmen und Fixkosten"}</div></div>
    <div class="head-actions"><button class="btn" data-act="savings-edit">Sparrate</button><button class="btn btn-primary" data-act="line-new" data-kind="exp">${ICON.plus} Abgabe</button></div></header>
    ${exampleBanner("geld")}
    ${loading ? loadingRow() : hero}
    <div class="grid2">${job}${incomes}</div>
    ${exps}`;
};

/* ---------- Sheets ---------- */
const BLANK_FIN = { employer: "", role: "", hours: null, net: null, incomes: [], expenses: [], savings: null };
const finBase = () => (S.finance && S.finance.example ? { ...BLANK_FIN } : finance());
async function saveFinance(patch) {
  const wasEx = !!(S.finance && S.finance.example);
  const ok = await Store.setDoc("life/finance", { ...finBase(), ...patch, example: false, updatedAt: new Date().toISOString() });
  if (ok && wasEx) setTimeout(() => toast("Beispielwerte entfernt, deine Angaben sind gespeichert"), 2700);
  return ok;
}
ACT["job-edit"] = () => {
  const f = finance();
  openSheet(`${sheetHead("Job & Gehalt", "Finanzen")}
  <form class="form" data-form="job" autocomplete="off">
    <label class="field"><span>Aktueller Arbeitgeber</span><input name="employer" value="${esc(f.employer)}" placeholder="Firma"></label>
    <div class="frow">
      <label class="field"><span>Art</span><select name="role"><option value="">–</option>${JOB_TYPES.map((t) => `<option ${t === f.role ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="field"><span>Stunden pro Woche</span><input name="hours" inputmode="decimal" value="${esc(f.hours ?? "")}" placeholder="20"></label>
    </div>
    <label class="field"><span>Gehalt netto pro Monat (€)</span><input name="net" inputmode="decimal" value="${esc(f.net ?? "")}" placeholder="1.150"></label>
    <p class="muted small" style="margin:0">Netto ist das, was auf deinem Konto landet. Beim Minijob bis ${MINIJOB_LIMIT} € ist brutto meist gleich netto.</p>
    <div class="sheet-foot"><span></span><div class="r"><button type="button" class="btn" data-act="sheet-close">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></div>
  </form>`);
};
FORMS.job = async (f) => {
  const ok = await saveFinance({ employer: f.employer.value.trim(), role: f.role.value, hours: parseNum(f.hours.value), net: parseNum(f.net.value) });
  if (ok) { closeSheet(); toast("Job gespeichert"); }
};
ACT["savings-edit"] = () => {
  const f = finance();
  openSheet(`${sheetHead("Monatliche Sparrate", "Finanzen")}
  <form class="form" data-form="savings"><label class="field"><span>Betrag pro Monat (€), z. B. ETF-Sparplan oder Tagesgeld</span><input name="savings" inputmode="decimal" value="${esc(f.savings ?? "")}" placeholder="100"></label>
  <div class="sheet-foot"><span></span><div class="r"><button type="button" class="btn" data-act="sheet-close">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></div></form>`);
};
FORMS.savings = async (f) => { if (await saveFinance({ savings: parseNum(f.savings.value) })) { closeSheet(); toast("Sparrate gespeichert"); } };
function lineSheet(kind, item) {
  const x = item || { cycle: "m", cat: "wohnen" };
  openSheet(`${sheetHead(item ? "Bearbeiten" : kind === "exp" ? "Neue Abgabe" : "Neue Einnahme", "Finanzen")}
  <form class="form" data-form="line" autocomplete="off">
    <input type="hidden" name="kind" value="${kind}"><input type="hidden" name="id" value="${esc(x.id || "")}">
    <label class="field"><span>Bezeichnung</span><input name="name" required value="${esc(x.name || "")}" placeholder="${kind === "exp" ? "Miete WG" : "BAföG"}"></label>
    <div class="frow">
      <label class="field"><span>Betrag (€)</span><input name="amount" inputmode="decimal" required value="${esc(x.amount ?? "")}"></label>
      <label class="field"><span>Rhythmus</span><select name="cycle">${Object.entries(CYCLES).map(([k, c]) => `<option value="${k}" ${k === (x.cycle || "m") ? "selected" : ""}>${c.label}</option>`).join("")}</select></label>
    </div>
    ${kind === "exp" ? `<label class="field"><span>Kategorie</span><select name="cat">${EXP_CATS.map((c) => `<option value="${c.id}" ${c.id === (x.cat || "sonst") ? "selected" : ""}>${c.label}</option>`).join("")}</select></label>` : ""}
    <div class="sheet-foot">${item ? `<button type="button" class="btn btn-ghost" data-act="line-del" data-kind="${kind}" data-id="${x.id}">${ICON.trash} Löschen</button>` : "<span></span>"}
      <div class="r"><button type="button" class="btn" data-act="sheet-close">Abbrechen</button><button class="btn btn-primary">Speichern</button></div></div>
  </form>`);
}
const listKey = (k) => (k === "exp" ? "expenses" : "incomes");
ACT["line-new"] = (el) => lineSheet(el.dataset.kind);
ACT["line-edit"] = (el) => lineSheet(el.dataset.kind, finance()[listKey(el.dataset.kind)].find((x) => x.id === el.dataset.id));
ACT["line-del"] = async (el) => {
  if (!armed(el)) return;
  const k = listKey(el.dataset.kind);
  if (await saveFinance({ [k]: finBase()[k].filter((x) => x.id !== el.dataset.id) })) { closeSheet(); toast("Gelöscht"); }
};
FORMS.line = async (f) => {
  const amount = parseNum(f.amount.value);
  if (!f.name.value.trim() || amount === null || amount < 0) return toast("Bitte Bezeichnung und Betrag angeben.");
  const k = listKey(f.kind.value), id = f.id.value || uid();
  const item = { id, name: f.name.value.trim(), amount, cycle: f.cycle.value, ...(f.cat ? { cat: f.cat.value } : {}) };
  const list = finBase()[k].filter((x) => x.id !== id);
  const idx = finBase()[k].findIndex((x) => x.id === id);
  idx >= 0 ? list.splice(idx, 0, item) : list.push(item);
  if (await saveFinance({ [k]: list })) { closeSheet(); toast("Gespeichert"); }
};
