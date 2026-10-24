/* Life Dashboard – Start */
"use strict";

(function boot() {
  loadLocal();
  S.sampleOff = true;
  buildNav();
  let v = (location.hash || "").slice(1);
  if (!VIEWS.some((x) => x.id === v)) { try { v = localStorage.getItem("ld:view") || "heute"; } catch (_) { v = "heute"; } }
  try { const mf = localStorage.getItem("ld:mailf"); if (mf && MAILQ[mf]) S.mail.filter = mf; } catch (_) {}
  go(v);
  loadNews();
  initGoogle();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v !== S.view && VIEWS.some((x) => x.id === v)) go(v); });
setInterval(() => { if (document.visibilityState === "visible" && $("#sheet").hidden) invalidate(); }, 60e3);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target.closest && e.target.closest('[role="button"][data-act]');
  if (el && el === e.target) { e.preventDefault(); el.click(); }
});
