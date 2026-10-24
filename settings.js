/* Life Dashboard – Einstellungen: Google-Konto, Backup, Installation */
"use strict";

let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; invalidate(); });
window.addEventListener("appinstalled", () => { installPrompt = null; invalidate(); toast("App installiert"); });

ACT.settings = () => {
  let last = null;
  try { last = localStorage.getItem("ld:lastBackup"); } catch (_) {}
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const g = S.google;
  const gText = g === "ok" ? "Verbunden. Kalender und Gmail werden geladen."
    : g === "expired" ? "Verbindung abgelaufen. Google erlaubt Web-Apps nur 1 Stunde am Stück, dann reicht ein Tipp."
    : g === "unconfigured" ? "Noch nicht eingerichtet: In config.js fehlt die Google-Client-ID."
    : "Nicht verbunden.";
  openSheet(`${sheetHead("Einstellungen", "App")}
  <div class="form">
    <label class="field"><span>Dein Vorname (für die Begrüßung)</span><input id="set-name" value="${esc(prefs().name || "")}" placeholder="Fabio" autocomplete="given-name"></label>
    <section class="form" style="gap:10px;border-top:1px solid var(--line);padding-top:14px">
      <div class="eyebrow">Google-Konto</div>
      <div class="soft small">${esc(gText)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${g === "unconfigured" ? "" : g === "ok" ? `<button class="btn btn-sm" data-act="google-disconnect">Trennen</button>` : `<button class="btn btn-primary btn-sm" data-act="google-connect">Mit Google verbinden</button>`}
        ${S.cal.calendars.length ? `<button class="btn btn-sm" data-act="cal-settings">Kalender auswählen</button>` : ""}
      </div>
    </section>
    <section class="form" style="gap:10px;border-top:1px solid var(--line);padding-top:14px">
      <div class="eyebrow">Backup</div>
      <div class="soft small">Deine Noten, Trainings, Finanzen und dein Gewicht liegen nur auf diesem Handy. Speicher ab und zu ein Backup, z. B. in Google Drive.${last ? ` Letztes Backup: ${new Date(last).toLocaleDateString("de-DE")}.` : " Bisher noch kein Backup."}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-act="backup-export">Backup speichern</button>
        <label class="btn btn-sm" for="backup-file" style="cursor:pointer">Backup importieren</label>
        <input id="backup-file" type="file" accept="application/json,.json" hidden>
      </div>
      <div class="muted small">Beim Import werden die Daten auf diesem Gerät ersetzt.</div>
    </section>
    <section class="form" style="gap:10px;border-top:1px solid var(--line);padding-top:14px">
      <div class="eyebrow">App</div>
      <div class="soft small">${standalone ? "Läuft als installierte App." : installPrompt ? "Du kannst das Dashboard als App auf deinem Startbildschirm installieren." : "Zum Installieren in Chrome: Menü ⋮ → „App installieren“ oder „Zum Startbildschirm hinzufügen“."}</div>
      ${!standalone && installPrompt ? `<div><button class="btn btn-primary btn-sm" data-act="install">App installieren</button></div>` : ""}
    </section>
  </div>
  <div class="sheet-foot"><span class="muted small">Version ${esc((window.CONFIG && CONFIG.VERSION) || "")}</span><div class="r"><button class="btn" data-act="sheet-close">Fertig</button></div></div>`, (body) => {
    const f = $("#backup-file", body);
    f.onchange = () => { if (f.files && f.files[0]) importBackup(f.files[0]); };
    const n = $("#set-name", body);
    n.onchange = () => setPrefs({ name: n.value.trim() });
  });
};
ACT["backup-export"] = exportBackup;
ACT.install = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (_) {}
  installPrompt = null; closeSheet();
};
