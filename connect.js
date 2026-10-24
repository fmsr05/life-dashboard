/* Life Dashboard – Live-Daten: Google Kalender & Gmail direkt über die Google-APIs */
"use strict";

const CAL = "Google Kalender", GM = "Gmail";
const G_SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_KEY = "ld:gtoken";
let tokenClient = null, gToken = null;

/* ---------- Google-Anmeldung ---------- */
function googleReady() { return !!(window.CONFIG && CONFIG.GOOGLE_CLIENT_ID && window.google && google.accounts && google.accounts.oauth2); }
function loadToken() {
  try { const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); if (t && t.exp > Date.now() + 60e3) gToken = t; } catch (_) {}
}
function initGoogle() {
  if (!(window.CONFIG && CONFIG.GOOGLE_CLIENT_ID)) { S.google = "unconfigured"; setGoogleState(); return; }
  if (!googleReady()) { setTimeout(initGoogle, 400); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: G_SCOPES,
    callback: (resp) => {
      if (resp.error) { S.google = "signedout"; setGoogleState(); toast("Google-Anmeldung abgebrochen"); return; }
      if (!google.accounts.oauth2.hasGrantedAllScopes(resp, ...G_SCOPES.split(" "))) toast("Bitte erlaube Kalender und Gmail, sonst bleiben die Karten leer.");
      gToken = { t: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
      try { localStorage.setItem(TOKEN_KEY, JSON.stringify(gToken)); localStorage.setItem("ld:gconnected", "1"); } catch (_) {}
      S.google = "ok"; refreshGoogle();
    },
    error_callback: () => { S.google = "signedout"; setGoogleState(); },
  });
  loadToken();
  if (gToken) { S.google = "ok"; refreshGoogle(); }
  else { S.google = localStorage.getItem("ld:gconnected") ? "expired" : "signedout"; setGoogleState(); }
}
function googleConnect() {
  if (!tokenClient) return toast("Google ist noch nicht eingerichtet.");
  tokenClient.requestAccessToken({ prompt: localStorage.getItem("ld:gconnected") ? "" : "consent" });
}
function googleDisconnect() {
  if (gToken && window.google) google.accounts.oauth2.revoke(gToken.t, () => {});
  gToken = null;
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("ld:gconnected"); } catch (_) {}
  S.google = "signedout"; setGoogleState(); toast("Google getrennt");
}
function setGoogleState() {
  const msg = {
    unconfigured: { text: "Google ist noch nicht eingerichtet. Trag die Client-ID in config.js ein.", canAllow: false },
    signedout: { text: `Verbinde dein Google-Konto, dann siehst du hier deine Termine und Mails.`, canAllow: true },
    expired: { text: "Die Google-Verbindung ist abgelaufen (Google erlaubt nur 1 Stunde am Stück). Ein Tipp verbindet neu.", canAllow: true },
  }[S.google];
  if (msg) {
    S.cal.state = "error"; S.cal.error = msg; S.cal.events = [];
    S.mail.state = "error"; S.mail.error = msg; S.mail.threads = [];
  }
  invalidate();
}
async function gfetch(url) {
  if (!gToken || gToken.exp < Date.now()) { S.google = "expired"; setGoogleState(); throw { code: "expired" }; }
  const r = await fetch(url, { headers: { Authorization: "Bearer " + gToken.t } });
  if (r.status === 401) { gToken = null; try { localStorage.removeItem(TOKEN_KEY); } catch (_) {} S.google = "expired"; setGoogleState(); throw { code: "expired" }; }
  if (!r.ok) {
    let reason = "";
    try { const j = await r.json(); reason = (j.error && (j.error.message || j.error.status)) || ""; } catch (_) {}
    throw { code: r.status === 403 ? "forbidden" : "http", status: r.status, message: reason };
  }
  return r.json();
}
const apiError = (server, e) => ({
  text: e.code === "forbidden" ? `${server}: Zugriff verweigert. Ist die API im Google-Cloud-Projekt aktiviert? ${e.message || ""}`
    : `${server} antwortet gerade nicht${e.status ? ` (Fehler ${e.status})` : ""}. Versuch es gleich nochmal.`,
  canAllow: false,
});
function refreshGoogle() { startCalendar(); watchMail(); }
ACT["google-connect"] = googleConnect;
ACT["google-disconnect"] = googleDisconnect;
ACT["cal-allow"] = googleConnect;
ACT["mail-allow"] = googleConnect;

/* ---------- Kalender ---------- */
function parseKit(summary) {
  const m = summary.match(/^\s*\d{5,8}\s*[-–]\s*(.+?)\s*\(([^)]{1,4})\)\s*(?:,\s*(.+))?$/);
  if (!m) return { title: summary.trim() };
  const kinds = { V: "Vorlesung", "Ü": "Übung", T: "Tutorium", S: "Seminar", P: "Praktikum", "VÜ": "Vorlesung + Übung", PS: "Proseminar" };
  const who = (m[3] || "").split(",").map((x) => x.trim()).filter((x) => x && !/^(WIWI|INFO|MATH|ETIT|MACH|PHYS)$/i.test(x)).join(", ");
  return { title: m[1].replace(/\s{2,}/g, " "), kind: kinds[m[2]] || m[2], who };
}
function calMeta(c, i, primaryId) {
  const id = c.id || "", name = c.summary || id;
  if (id.includes("#holiday")) return { color: "var(--bad)", holiday: true, short: "Feiertag" };
  if (/kit/i.test(name)) return { color: "var(--accent)", short: "KIT" };
  if (/tutor/i.test(name)) return { color: "var(--signal)", short: "Tutorium" };
  if (/famil/i.test(name)) return { color: "var(--s7)", short: "Familie" };
  if (id === primaryId || c.primary) return { color: "var(--s1)", short: "Privat" };
  return { color: ["var(--s5)", "var(--s2)", "var(--s6)"][i % 3], short: name };
}
const calByCal = {};
let calWindowKey = "", calBusy = false;
function calWindow() {
  const mon = startOfWeek(new Date());
  return { start: addDays(mon, -7), end: addDays(mon, 14), key: ymd(mon) };
}
function normEvent(ev, cal) {
  if (!ev || ev.status === "cancelled" || !ev.start) return null;
  const allDay = !!(ev.start.date && !ev.start.dateTime);
  const start = allDay ? parseYmd(ev.start.date) : new Date(ev.start.dateTime);
  const end = ev.end ? (allDay ? parseYmd(ev.end.date) : new Date(ev.end.dateTime)) : start;
  const k = parseKit(ev.summary || "");
  return {
    id: (ev.id || uid()) + "@" + cal.id, title: k.title || "(ohne Titel)", kind: k.kind || "", who: k.who || "",
    start, end, allDay, loc: ev.location || "", link: ev.htmlLink || "",
    cal: cal.id, calShort: cal.short, color: cal.color, holiday: !!cal.holiday,
  };
}
function rebuildEvents() {
  const hidden = new Set(prefs().hiddenCals || []);
  S.cal.events = Object.entries(calByCal).filter(([id]) => !hidden.has(id)).flatMap(([, list]) => list).sort((a, b) => a.start - b.start || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0));
}
async function startCalendar() {
  if (S.google !== "ok" || calBusy) return;
  calBusy = true;
  if (!S.cal.events.length) S.cal.state = "loading";
  S.cal.error = null; invalidate();
  try {
    const list = await gfetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader");
    const cals = list.items || [];
    const primaryId = (cals.find((c) => c.primary) || {}).id;
    S.cal.calendars = cals.map((c, i) => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, ...calMeta(c, i, primaryId) }));
    const w = calWindow(); calWindowKey = w.key;
    await Promise.all(S.cal.calendars.map(async (cal) => {
      const q = new URLSearchParams({ timeMin: w.start.toISOString(), timeMax: w.end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
      try {
        const r = await gfetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${q}`);
        calByCal[cal.id] = (r.items || []).map((x) => normEvent(x, cal)).filter(Boolean);
      } catch (e) { if (e.code === "expired") throw e; }
    }));
    rebuildEvents();
    S.cal.state = "ready"; S.cal.storedAt = Date.now(); S.cal.stale = false;
  } catch (e) {
    if (e.code !== "expired") { if (S.cal.events.length) S.cal.stale = true; else { S.cal.state = "error"; S.cal.error = apiError(CAL, e); } }
  } finally { calBusy = false; invalidate(); }
}
const eventsOn = (day) => {
  const a = startOfDay(day), b = addDays(a, 1);
  return S.cal.events.filter((e) => e.start < b && (e.end > a || (+e.end === +e.start && e.start >= a)));
};
ACT["cal-refresh"] = () => { if (S.google === "ok") { startCalendar(); toast("Kalender wird neu geladen"); } else googleConnect(); };
ACT["cal-toggle"] = async (el) => {
  const id = el.dataset.id, h = new Set(prefs().hiddenCals || []);
  h.has(id) ? h.delete(id) : h.add(id);
  await setPrefs({ hiddenCals: [...h] });
  rebuildEvents(); invalidate();
};

/* ---------- Gmail ---------- */
const MAILQ = {
  inbox: "in:inbox -category:promotions -category:social",
  unread: "in:inbox is:unread -category:promotions -category:social",
  all: "in:inbox",
};
const GENERIC = /^(no-?reply|noreply|donotreply|hello|hey|hi|info|news|newsletter|mail|mailer|support|team|service|notifications?|contact|kontakt|account|accounts|updates?|marketing|post|office)$/i;
const PERSONAL = /^(gmail\.com|googlemail\.com|web\.de|gmx\.(de|net|at)|outlook\.(com|de)|hotmail\.(com|de)|yahoo\.(com|de)|icloud\.com|me\.com|t-online\.de|posteo\.de|proton(mail)?\.(me|com))$/i;
function senderName(raw) {
  const s = String(raw || "");
  const m = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>/);
  if (m && m[1].trim()) return m[1].trim();
  const email = (m ? m[2] : s).trim();
  const [local = "", domain = ""] = email.split("@");
  const pretty = (x) => x.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  if (/(^|\.)kit\.edu$/i.test(domain) && (GENERIC.test(local) || /\d/.test(local))) return "KIT";
  if (!GENERIC.test(local) && !/\d{3,}/.test(local) && (PERSONAL.test(domain) || /\./.test(local))) return pretty(local);
  const parts = domain.split(".");
  const org = parts.length >= 2 ? parts[parts.length - 2] : domain;
  return org ? org[0].toUpperCase() + org.slice(1) : email;
}
function mailDate(d) {
  const n = dayDiff(d, new Date());
  if (n === 0) return fmtTime(d);
  if (n === 1) return "Gestern";
  if (n < 7) return DOW[d.getDay()] + ".";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}
function normThread(t) {
  const msgs = t.messages || [];
  const last = msgs[msgs.length - 1] || {};
  const hdr = (m, n) => (((m.payload || {}).headers || []).find((h) => h.name.toLowerCase() === n) || {}).value || "";
  const labels = new Set(msgs.flatMap((m) => m.labelIds || []));
  return {
    id: t.id, subject: decode(hdr(last, "subject") || "(kein Betreff)"), snippet: decode(last.snippet || t.snippet || ""),
    from: senderName(hdr(last, "from")), date: last.internalDate ? new Date(Number(last.internalDate)) : null,
    unread: labels.has("UNREAD"), important: labels.has("IMPORTANT"), starred: labels.has("STARRED"),
    count: msgs.length, url: `https://mail.google.com/mail/u/0/#inbox/${t.id}`,
  };
}
let mailBusy = false;
async function watchMail() {
  if (S.google !== "ok" || mailBusy) return;
  mailBusy = true;
  if (!S.mail.threads.length) S.mail.state = "loading";
  S.mail.error = null; invalidate();
  try {
    const q = new URLSearchParams({ q: MAILQ[S.mail.filter] || MAILQ.inbox, maxResults: "12" });
    const list = await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${q}`);
    const meta = "format=metadata&metadataHeaders=From&metadataHeaders=Subject";
    const threads = await Promise.all((list.threads || []).map((t) => gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?${meta}`).catch(() => ({ id: t.id, snippet: t.snippet, messages: [] }))));
    S.mail.threads = threads.map(normThread);
    S.mail.state = "ready"; S.mail.storedAt = Date.now(); S.mail.stale = false;
  } catch (e) {
    if (e.code !== "expired") { if (S.mail.threads.length) S.mail.stale = true; else { S.mail.state = "error"; S.mail.error = apiError(GM, e); } }
  } finally { mailBusy = false; invalidate(); }
}
ACT["mail-filter"] = (el) => { S.mail.filter = el.dataset.f; S.mail.threads = []; try { localStorage.setItem("ld:mailf", S.mail.filter); } catch (_) {} watchMail(); };
ACT["mail-refresh"] = () => { if (S.google === "ok") { watchMail(); toast("Mails werden neu geladen"); } else googleConnect(); };

/* ---------- Auffrischen ---------- */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  loadNews();
  if (S.google === "ok") {
    if (!gToken || gToken.exp < Date.now() + 60e3) { S.google = "expired"; setGoogleState(); return; }
    if (calWindow().key !== calWindowKey || Date.now() - (S.cal.storedAt || 0) > 10 * 60e3) startCalendar();
    if (Date.now() - (S.mail.storedAt || 0) > 5 * 60e3) watchMail();
  }
});
const freshness = (t) => {
  if (!t) return "";
  const min = Math.round((Date.now() - t) / 60000);
  return min < 1 ? "gerade aktualisiert" : min < 60 ? `vor ${min} Min.` : `um ${fmtTime(new Date(t))}`;
};
