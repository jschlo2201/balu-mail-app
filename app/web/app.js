"use strict";
window.BM_LAUNCH = {};
(function () {
  const h = location.hash; if (!h) return;
  const get = k => { const m = h.match(new RegExp("[#&]" + k + "=([^&]*)")); return m ? decodeURIComponent(m[1]) : null; };
  if (get("t")) window.BM_TOKEN = get("t");
  if (get("a") === "1") document.documentElement.classList.add("android");
  window.BM_LAUNCH = { mailto: get("mailto"), eml: get("eml"), open: get("open") };
  history.replaceState(null, "", location.pathname);
})();
const isMobile = () => matchMedia("(max-width: 760px)").matches;
const appEl = () => document.getElementById("app");
/* Balu-Mail – Oberfläche */

// ---------------------------------------------------------------- Symbole
const P = {
  menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
  search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  tune: "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z",
  delete: "M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z",
  spam: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.9 7.9 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.9 7.9 0 0 1 20 12c0 4.42-3.58 8-8 8z",
  move: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10zm-7.84-6H8v2h4.16l-1.59 1.59L11.99 17 16 13.01 11.99 9l-1.41 1.41L12.16 12z",
  reply: "M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  replyall: "M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z",
  forward: "M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z",
  up: "M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z",
  down: "M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  star: "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z",
  starfill: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  inbox: "M19 3H4.99C3.88 3 3 3.9 3 5v14c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10zm-3-5h-2V7h-4v3H8l4 4 4-4z",
  refresh: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z",
  dot: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  folder: "M9.17 6l2 2H20v10H4V6h5.17M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  sent: "M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3 2 10l15 2-15 2 .01 7L23 12 2.01 3z",
  drafts: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  archive: "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.81.97H5.44l.8-.97zM5 19V8h14v11H5zm8.45-9h-2.9v3H8l4 4 4-4h-2.55z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  full: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
  attach: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z",
  settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  caretdown: "M7 10l5 5 5-5z",
  caretright: "M10 17l5-5-5-5v10z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  download: "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z",
  power: "M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7A7 7 0 0 1 7.58 6.58L6.17 5.17A8.93 8.93 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.18-3.17-6.83z",
  party: "M3 21 8.2 6.8l9 9L3 21zm2.9-2.9 6.6-2.4-4.2-4.2-2.4 6.6zM14 2h2v3.5h-2zm5.2 3.4 1.4 1.4-2.5 2.5-1.4-1.4zM18.5 13H22v2h-3.5zM10.6 5.9l1.4-1.4 1.8 1.8-1.4 1.4z",
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z",
  outbox: "M19 3H4.99C3.88 3 3 3.9 3 5v14c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10zM8 11h2v3h4v-3h2l-4-4-4 4z",
};
const ic = (n, extra = "") => `<svg viewBox="0 0 24 24" ${extra}><path d="${P[n] || ""}"/></svg>`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function hydrateIcons(root = document) { $$("i[data-i]", root).forEach(el => { if (!el.firstChild) el.innerHTML = ic(el.dataset.i); }); }

// ---------------------------------------------------------------- API
async function api(path, opts = {}) {
  const o = { headers: { "X-Token": window.BM_TOKEN } };
  if (opts.body !== undefined) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(opts.body); }
  const r = await fetch(path, o);
  let j; try { j = await r.json(); } catch { j = {}; }
  if (r.status === 401 && S.info && S.info.server) { location.reload(); throw new Error("Bitte erneut anmelden"); }
  if (!r.ok || j.error) throw new Error(j.error || ("Fehler " + r.status));
  return j;
}
const qs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");

// ---------------------------------------------------------------- Zustand
const S = {
  info: {}, accounts: [], folders: {},            // folders[accId] = [...]
  view: { type: "inbox", acc: null, folder: "INBOX" }, // acc=null => alle Konten
  msgs: [], pages: {}, totals: {},
  sel: new Set(), cur: null, curMsg: null,
  q: "", scope: "view", collapsed: JSON.parse(localStorageGet("bm_collapsed") || "{}"),
  loading: false,
};
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
const key = m => m.acc + "|" + m.folder + "|" + m.uid;
const accOf = id => S.accounts.find(a => a.id === id) || {};

// ---------------------------------------------------------------- Hilfen
function initials(name, mail) {
  const s = (name || mail || "?").replace(/["'<>()]/g, "").trim();
  const parts = s.split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "?").slice(0, 2).toUpperCase();
}
function fmtDate(iso, long) {
  const d = new Date(iso), now = new Date();
  if (isNaN(d)) return "";
  const p = n => String(n).padStart(2, "0");
  const time = p(d.getHours()) + ":" + p(d.getMinutes());
  if (long) return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${time} Uhr`;
  if (d.toDateString() === now.toDateString()) return time;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Gestern";
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function addrText(a) { return a.name ? `${a.name} <${a.email}>` : a.email; }
let toastT;
function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, err ? 6000 : 2600); }

const SPECIAL = { inbox: ["inbox", "Posteingang"], trash: ["delete", "Papierkorb"], junk: ["spam", "Spam"], sent: ["sent", "Gesendet"], drafts: ["drafts", "Entwürfe"], archive: ["archive", "Archiv"] };
const SPECIAL_ORDER = ["drafts", "sent", "junk", "trash", "archive"];
function folderLabel(f) {
  if (f.special && SPECIAL[f.special]) return SPECIAL[f.special][1];
  const parts = f.delim ? f.path.split(f.delim) : [f.path];
  return parts[parts.length - 1];
}

// ---------------------------------------------------------------- Start
// Handy: im Posteingang nach unten ziehen = alle Postfächer neu abfragen
function initPullRefresh() {
  const list = $("#list"); if (!list) return;
  const ind = document.createElement("div"); ind.id = "ptr"; ind.innerHTML = `${ic("refresh")}<span>Zum Aktualisieren ziehen</span>`;
  list.parentNode.insertBefore(ind, list);
  let y0 = null, dy = 0, busy = false;
  const MAX = 90, GO = 64;
  const set = h => { ind.style.height = h + "px"; ind.classList.toggle("ready", h >= GO);
    ind.querySelector("span").textContent = h >= GO ? "Loslassen zum Aktualisieren" : "Zum Aktualisieren ziehen";
    ind.querySelector("svg") && (ind.querySelector("svg").style.transform = `rotate(${-h * 4}deg)`); };
  list.addEventListener("touchstart", e => { if (busy || e.touches.length !== 1 || list.scrollTop > 0 || !isMobile()) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  list.addEventListener("touchmove", e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || list.scrollTop > 0) { set(0); return; }
    e.preventDefault(); ind.classList.remove("anim"); set(Math.min(MAX, dy * 0.5));
  }, { passive: false });
  list.addEventListener("touchend", async () => {
    if (y0 == null) return; y0 = null; ind.classList.add("anim");
    if (dy * 0.5 < GO) { set(0); return; }
    busy = true; ind.classList.add("busy"); ind.querySelector("span").textContent = "Wird aktualisiert …"; ind.style.height = "48px";
    try { await refreshAll(); } finally { busy = false; ind.classList.remove("busy", "ready"); set(0); }
  });
}
async function init() {
  initPullRefresh();
  hydrateIcons();
  if (window.Fun) await Fun.load();
  try { S.info = await api("/api/info"); } catch (e) { toast(e.message, true); }
  loadComposeDefaults();
  $("#demoBadge").hidden = !S.info.demo;
  await loadAccounts();
  bindUI();
  windowWatch();
  if (window.Kal) Kal.reminders.start();
  if (!S.accounts.length) { renderNav(); renderList(); renderEmpty(); openAccounts(true); return; }
  if (loadCache()) { renderNav(); renderList(); renderEmpty(); }   // sofort den letzten Stand zeigen, dann auffrischen
  await refreshAll(true);
  if (!S.cur && !C) renderEmpty();
  updatePoll();
  setInterval(() => { refreshAll(false); updatePoll(); }, 60000);
  // Beim Zurückkehren ins Fenster nach Updates sehen (höchstens alle 10 Minuten)
  let lastUpdCheck = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || Date.now() - lastUpdCheck < 600000 || !U.st || !U.st.configured) return;
    lastUpdCheck = Date.now();
    api("/api/update/check", { body: {} }).then(() => setTimeout(updatePoll, 8000)).catch(() => {});
  });
  handleLaunch(window.BM_LAUNCH);
}

function handleLaunch(l) {
  if (!l) return;
  if (l.mailto) openMailto(l.mailto);
  else if (l.eml) openEml(l.eml);
  else if (l.open) { const [a, f, u] = l.open.split("|"); openMailRef(a, f, u); }
}

// Aus einer Benachrichtigung: Ordner des Kontos öffnen und die Mail anzeigen
async function openMailRef(acc, folder, uid) {
  if (!S.accounts.some(a => a.id === acc)) return;
  if (window.Kal && Kal.active) Kal.close();
  closeModal(); closeCompose();
  S.view = { type: "folder", acc, folder: folder || "INBOX" }; S.sel.clear(); S.cur = null; S.curMsg = null; S.q = ""; $("#search").value = "";
  renderNav(); await loadList();
  const k = acc + "|" + (folder || "INBOX") + "|" + uid;
  if (uid && S.msgs.some(m => key(m) === k)) openMsg(k); else renderEmpty();
}
window.bmOpenMail = openMailRef;

// mailto:-Link (aus Windows, Browser oder Android) im Schreiben-Fenster öffnen
function openMailto(url) {
  if (!S.accounts.length) { toast("Bitte zuerst ein E-Mail-Konto einrichten.", true); return openAccounts(true); }
  const u = String(url).replace(/^mailto:/i, "");
  const [addr, query = ""] = u.split("?");
  const p = {};
  query.split("&").filter(Boolean).forEach(kv => { const i = kv.indexOf("="); const k = decodeURIComponent((i < 0 ? kv : kv.slice(0, i)).replace(/\+/g, " ")).toLowerCase(); p[k] = decodeURIComponent((i < 0 ? "" : kv.slice(i + 1)).replace(/\+/g, "%20")); });
  closeModal();
  compose("new");
  const to = [decodeURIComponent(addr || ""), p.to].filter(Boolean).join(", ");
  $("#cpTo").value = to;
  if (p.cc || p.bcc) { $("#cpCcRow").hidden = false; $("#cpBccRow").hidden = false; $("#cpCcBtn").hidden = true; $("#cpCc").value = p.cc || ""; $("#cpBcc").value = p.bcc || ""; }
  if (p.subject) $("#cpSubject").value = p.subject;
  if (p.body) $("#cpEditor").innerHTML = esc(p.body).replace(/\r?\n/g, "<br>") + "<p><br></p>";
  (to ? (p.subject ? $("#cpEditor") : $("#cpSubject")) : $("#cpTo")).focus();
}
window.bmMailto = openMailto;

// .eml-Datei im Browser öffnen (Webseite und Programm)
function pickEml() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".eml,message/rfc822";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 40 * 1048576) return toast("Die Datei ist größer als 40 MB.", true);
    const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(f); });
    try {
      const d = await api("/api/eml/upload", { body: { name: f.name, data } });
      S.cur = null; S.curMsg = d; closeCompose(); closeModal();
      if (isMobile()) appEl().classList.add("reading");
      renderMsg(d, false);
    } catch (e) { toast(e.message, true); }
  };
  inp.click();
}

// .eml-Datei anzeigen (Doppelklick im Explorer)
async function openEml(path) {
  try {
    const d = await api("/api/eml?" + qs({ path }));
    S.cur = null; S.curMsg = d; closeCompose();
    if (isMobile()) appEl().classList.add("reading");
    renderMsg(d, false);
  } catch (e) { toast(e.message, true); }
}

async function loadAccounts() {
  try { S.accounts = await api("/api/accounts"); } catch (e) { toast(e.message, true); S.accounts = []; }
}

async function loadFolders() {
  await Promise.all(S.accounts.map(async a => {
    try { S.folders[a.id] = await api("/api/folders?" + qs({ acc: a.id })); }
    catch (e) { S.folders[a.id] = S.folders[a.id] || []; toast(`${a.email}: ${e.message}`, true); }
  }));
}

let syncRev = -1;
async function checkSync() {
  try {
    const st = await api("/api/sync/status");
    const gone = (st.removed || []).filter(e => !S.removedShown?.includes(e));
    if (gone.length) { S.removedShown = (S.removedShown || []).concat(gone); toast(`Abgleich: ${gone.join(", ")} wurde auf einem anderen Gerät entfernt`, true); }
    if (syncRev >= 0 && st.rev !== syncRev) { await loadAccounts(); syncRev = st.rev; api("/api/settings").then(x => { applyLogo(x.logo); if (x.compose) CDEF = x.compose; }).catch(() => {}); if (window.Kal && Kal.active) setTimeout(() => Kal.open(), 1500); return true; }
    syncRev = st.rev;
  } catch {}
  return false;
}
async function refreshAll(first) {
  const r = $(".refresh"); r && r.classList.add("spin");
  if (await checkSync() && !first) toast("Mit dem anderen Gerät abgeglichen");
  const before = inboxUnreadTotal();
  if (first && !S.q) await showCachedList(viewSources());   // vom Hintergrunddienst vorgeladene Mails sofort zeigen
  const keep = !first || S.msgs.length > 0;            // beim Start mit Zwischenspeicher: Liste nicht leeren
  if (S.view.type === "drafts" || S.view.type === "sent") { await loadFolders(); renderNav(); await loadList(keep); }
  else await Promise.all([loadFolders().then(renderNav), loadList(keep)]);   // Ordner und Mails gleichzeitig laden
  saveCache();
  r && r.classList.remove("spin");
  if (!first && window.Fun) Fun.checkNew(before, inboxUnreadTotal());
}

// Zwischenspeicher für den schnellen Start (nur App/Handy – nicht auf der Webseite, die evtl. an fremden Geräten läuft)
const CACHE_KEY = "bm_start_v1";
const cacheOk = () => S.info && !S.info.server && !S.info.demo;
function saveCache() {
  if (!cacheOk() || S.view.type !== "inbox" || S.view.acc || S.q) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ accs: S.accounts.map(a => a.id).join(","), folders: S.folders, msgs: S.msgs.slice(0, 80) }));
  } catch {}
}
function loadCache() {
  if (!cacheOk()) return false;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!c || c.accs !== S.accounts.map(a => a.id).join(",")) return false;
    S.folders = c.folders || {}; S.msgs = c.msgs || [];
    return S.msgs.length > 0;
  } catch { return false; }
}

// ---------------------------------------------------------------- Navigation
function unreadOf(accId, special) {
  const f = (S.folders[accId] || []).find(x => x.special === special);
  return f ? f.unread : 0;
}
function navItem({ cls = "", icon, label, cnt, active, data, tw = "", extra = "" }) {
  return `<div class="nav-item ${cls} ${active ? "active" : ""}" ${data}>
    <span class="tw">${tw}</span><span class="ico">${icon}</span><span class="lbl">${esc(label)}</span>
    ${cnt ? `<span class="cnt">${cnt}</span>` : ""}${extra}</div>`;
}
function isView(t, acc, folder) { const v = S.view; return v.type === t && v.acc === acc && (folder === undefined || v.folder === folder); }

function renderNav() {
  const multi = S.accounts.length > 1;
  const totalUnread = inboxUnreadTotal();
  let h = "";
  const inboxOpen = !S.collapsed.inbox;
  h += navItem({ cls: "bold", icon: ic("inbox"), label: "Posteingang", cnt: totalUnread || "", active: isView("inbox", null),
    data: `data-nav="inbox"`, tw: multi ? `<span data-tog="inbox">${ic(inboxOpen ? "caretdown" : "caretright")}</span>` : "",
    extra: `<span class="refresh" title="Aktualisieren" data-refresh>${ic("refresh")}</span>` });
  if (multi && inboxOpen) {
    for (const a of S.accounts) {
      const n = unreadOf(a.id, "inbox");
      h += navItem({ cls: "nav-sub" + (n ? " bold" : ""), icon: `<span class="dot" style="background:${a.color}"></span>`, label: a.email, cnt: n || "",
        active: isView("folder", a.id, inboxPath(a.id)), data: `data-nav="folder" data-acc="${a.id}" data-folder="${esc(inboxPath(a.id))}" draggable="true" data-accdrag="${a.id}" title="Zum Umsortieren ziehen"` });
    }
  }
  h += navItem({ icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>`, label: "Ungelesen", active: isView("unread", null), data: `data-nav="unread"` });
  h += navItem({ icon: ic("star"), label: "Favoriten", active: isView("flagged", null), data: `data-nav="flagged"` });
  const draftsTotal = S.accounts.reduce((n, a) => n + (((S.folders[a.id] || []).find(f => f.special === "drafts") || {}).total || 0), 0);
  h += navItem({ icon: ic("drafts"), label: "Entwürfe", cnt: draftsTotal || "", active: isView("drafts", null), data: `data-nav="drafts"` });
  h += navItem({ icon: ic("sent"), label: "Gesendet", active: isView("sent", null), data: `data-nav="sent"` });
  h += navItem({ icon: ic("calendar"), label: "Kalender", active: S.view.type === "calendar", data: `data-nav="calendar"` });
  h += `<div class="nav-sep"></div>`;
  const foldersOpen = !S.collapsed.folders;
  h += `<div class="nav-head" data-tog="folders">Ordner ${ic(foldersOpen ? "up" : "down")}</div>`;
  if (foldersOpen) {
    for (const a of S.accounts) {
      const open = !S.collapsed["acc_" + a.id];
      if (multi) h += `<div class="nav-acc" data-tog="acc_${a.id}" draggable="true" data-accdrag="${a.id}" title="Zum Umsortieren ziehen"><span class="tw">${ic(open ? "caretdown" : "caretright")}</span><span class="dot" style="background:${a.color};width:9px;height:9px;border-radius:50%"></span><span class="lbl">${esc(a.email)}</span></div>`;
      if (multi && !open) continue;
      h += folderTree(a);
    }
  }
  $("#nav").innerHTML = h;
}
function inboxUnreadTotal() { return S.accounts.reduce((s, a) => s + unreadOf(a.id, "inbox"), 0); }
function inboxPath(accId) { const f = (S.folders[accId] || []).find(x => x.special === "inbox"); return f ? f.path : "INBOX"; }

function folderTree(a) {
  const fs = (S.folders[a.id] || []).filter(f => f.special !== "inbox");
  const special = SPECIAL_ORDER.map(k => fs.find(f => f.special === k)).filter(Boolean);
  const others = fs.filter(f => !f.special).sort((x, y) => x.path.localeCompare(y.path, "de"));
  const pad = S.accounts.length > 1 ? " nav-sub" : "";
  const under = (f, p) => f.delim && f.path.startsWith(p.path + f.delim);
  const kidsOf = p => others.filter(o => under(o, p));
  const toggle = (f, kids) => {
    if (!kids) return "";
    const ck = "f_" + a.id + "_" + f.path;
    return `<span data-tog="${esc(ck)}">${ic(S.collapsed[ck] === false ? "caretdown" : "caretright")}</span>`;
  };
  // eigene Ordner als Baum; base = Tiefe des Spezialordners, unter dem sie hängen
  const tree = (list, base) => {
    let t = "";
    for (const f of list) {
      const depth = (f.delim ? f.path.split(f.delim).length - 1 : 0) - base;
      const parent = f.delim && f.path.includes(f.delim) ? f.path.split(f.delim).slice(0, -1).join(f.delim) : null;
      if (parent && isCollapsedChain(a.id, parent, f.delim)) continue;
      const hasKids = others.some(o => under(o, f));
      t += navItem({ cls: pad + (f.unread ? " bold" : ""), icon: ic("folder"), label: folderLabel(f), cnt: f.unread || "",
        active: isView("folder", a.id, f.path), tw: toggle(f, hasKids), data: `data-nav="folder" data-acc="${a.id}" data-folder="${esc(f.path)}" data-drop="1" style="padding-left:${4 + depth * 20 + (pad ? 22 : 0)}px"` + (f.noselect ? ` data-noselect="1"` : "") });
    }
    return t;
  };
  let h = "", placed = new Set();
  for (const f of special) {
    const kids = kidsOf(f);
    h += navItem({ cls: pad + (f.unread && f.special !== "trash" && f.special !== "junk" ? " bold" : ""), icon: ic(SPECIAL[f.special][0]), label: folderLabel(f),
      cnt: (f.special === "drafts" ? f.total : (f.special === "junk" || f.special === "trash" ? "" : f.unread)) || "",
      active: isView("folder", a.id, f.path), tw: toggle(f, kids.length),
      data: `data-nav="folder" data-acc="${a.id}" data-folder="${esc(f.path)}" data-drop="1"` });
    if (kids.length) { h += tree(kids, (f.delim ? f.path.split(f.delim).length - 1 : 0)); kids.forEach(k => placed.add(k)); }
  }
  // Baumstruktur für die übrigen eigenen Ordner
  h += tree(others.filter(f => !placed.has(f)), 0);
  return h;
}
function isCollapsedChain(accId, path, delim) {
  const parts = path.split(delim);
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join(delim);
    if (S.collapsed["f_" + accId + "_" + p] !== false) return true;
  }
  return false;
}

function setView(v) {
  if (window.Kal && Kal.active) Kal.close();
  S.view = v; S.sel.clear(); S.cur = null; S.curMsg = null; S.q = ""; $("#search").value = "";
  closeCompose(); renderNav(); loadList(); renderEmpty();
}

// ---------------------------------------------------------------- Liste
function viewSources() {
  const v = S.view;
  if (v.type === "folder") return [{ acc: v.acc, folder: v.folder, filter: null }];
  if (v.type === "drafts" || v.type === "sent") {
    return S.accounts.map(a => ({ acc: a.id, folder: ((S.folders[a.id] || []).find(f => f.special === v.type) || {}).path, filter: null })).filter(x => x.folder);
  }
  const filter = v.type === "unread" ? "unread" : v.type === "flagged" ? "flagged" : null;
  return S.accounts.map(a => ({ acc: a.id, folder: inboxPath(a.id), filter }));
}
function viewTitle() {
  const v = S.view;
  if (S.q) return `Suche: „${S.q}“`;
  if (v.type === "inbox") return "Posteingang";
  if (v.type === "unread") return "Ungelesen";
  if (v.type === "flagged") return "Favoriten";
  if (v.type === "drafts") return "Entwürfe";
  if (v.type === "sent") return "Gesendet";
  const f = (S.folders[v.acc] || []).find(x => x.path === v.folder) || { path: v.folder };
  return (f.special === "inbox" ? "Posteingang" : folderLabel(f)) + (S.accounts.length > 1 ? " · " + accOf(v.acc).email : "");
}

// Zuletzt geladenen Stand sofort zeigen (aus dem Zwischenspeicher bzw. vom Hintergrunddienst vorgeladen)
async function showCachedList(srcs) {
  if (S.q) return false;
  const v = S.view;
  const res = await Promise.all(srcs.map(s => api("/api/messages?" + qs({ acc: s.acc, folder: s.folder, filter: s.filter, page: 0, cached: 1 })).catch(() => ({ miss: true }))));
  if (S.view !== v || !res.some(r => !r.miss)) return false;
  S.msgs = res.flatMap(r => r.items || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  S.pages = {}; S.totals = {};
  srcs.forEach((s, i) => { S.pages[s.acc + "|" + s.folder] = 0; S.totals[s.acc + "|" + s.folder] = res[i].total || 0; });
  renderList();
  return true;
}
async function loadList(keep) {
  const srcs = viewSources();
  if (!keep && await showCachedList(srcs)) keep = true;   // danach frisch laden, ohne die Liste zu leeren
  const prevSel = new Set(S.sel), prevCur = S.cur;
  if (!keep) { $("#list").innerHTML = `<div class="list-loading">Wird geladen …</div>`; }
  S.loading = true;
  const scopeFilter = S.q && S.scope !== "view" ? S.scope : null;
  const vAtStart = S.view, partial = [];
  const results = await Promise.all(srcs.map(async s => {
    let r;
    try { r = await api("/api/messages?" + qs({ acc: s.acc, folder: s.folder, filter: scopeFilter || s.filter, q: S.q, page: 0 })); }
    catch (e) { toast(`${accOf(s.acc).email || ""}: ${e.message}`, true); r = { items: [], total: 0 }; }
    // Ohne vorhandene Liste: schnelle Konten schon anzeigen, während langsame noch laden
    if (!keep && S.view === vAtStart && srcs.length > 1 && r.items.length) {
      partial.push(...r.items);
      S.msgs = partial.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      renderList();
    }
    return r;
  }));
  S.pages = {}; S.totals = {};
  srcs.forEach((s, i) => { S.pages[s.acc + "|" + s.folder] = 0; S.totals[s.acc + "|" + s.folder] = results[i].total; });
  S.msgs = results.flatMap(r => r.items).sort((a, b) => new Date(b.date) - new Date(a.date));
  S.loading = false;
  if (keep) {
    const keys = new Set(S.msgs.map(key));
    S.sel = new Set([...prevSel].filter(k => keys.has(k)));
    S.cur = keys.has(prevCur) ? prevCur : null;
  }
  renderList();
}

async function loadMore() {
  const srcs = viewSources();
  const scopeFilter = S.q && S.scope !== "view" ? S.scope : null;
  const more = await Promise.all(srcs.map(async s => {
    const k = s.acc + "|" + s.folder, p = S.pages[k] + 1;
    if (p * 50 >= S.totals[k]) return [];
    S.pages[k] = p;
    try { return (await api("/api/messages?" + qs({ acc: s.acc, folder: s.folder, filter: scopeFilter || s.filter, q: S.q, page: p }))).items; }
    catch { return []; }
  }));
  S.msgs = S.msgs.concat(more.flat()).sort((a, b) => new Date(b.date) - new Date(a.date));
  renderList();
}
function hasMore() { return Object.keys(S.pages).some(k => (S.pages[k] + 1) * 50 < S.totals[k]); }

function renderList() {
  $("#viewTitle").textContent = viewTitle();
  const total = Object.values(S.totals).reduce((a, b) => a + b, 0);
  $("#viewCount").textContent = total ? total + (total === 1 ? " E-Mail" : " E-Mails") : "";
  const list = $("#list");
  if (!S.accounts.length) { list.innerHTML = `<div class="list-empty">Noch kein Konto eingerichtet.<br><br><button class="btn primary" onclick="openAccounts(true)">Jetzt einrichten</button></div>`; updateActionbar(); return; }
  if (!S.msgs.length) { list.innerHTML = `<div class="list-empty">${S.q ? "Keine Treffer." : "Hier sind keine E-Mails."}</div>`; updateActionbar(); return; }
  const multi = S.accounts.length > 1 && S.view.type !== "folder";
  const sentLike = ["drafts", "sent"].includes(S.view.type) || S.view.type === "folder" && ["sent", "drafts"].includes(((S.folders[S.view.acc] || []).find(f => f.path === S.view.folder) || {}).special);
  list.innerHTML = S.msgs.map(m => {
    const k = key(m), checked = S.sel.has(k);
    const who = sentLike ? (m.to[0] || { name: "", email: "" }) : m.from;
    const name = who.name || who.email || "(unbekannt)";
    return `<div class="row ${m.seen ? "" : "unread"} ${k === S.cur ? "current" : ""} ${checked ? "checked" : ""}" data-k="${esc(k)}" draggable="true" title="">
      ${multi ? `<span class="acc-bar" style="background:${accOf(m.acc).color}"></span>` : ""}
      <div class="avatar" data-check title="Auswählen">${checked ? ic("check") : esc(initials(who.name, who.email))}</div>
      <div class="row-main">
        <div class="r1"><span class="from" title="${esc(addrText(who))}">${sentLike ? "An: " : ""}${esc(name)}</span>
          <span class="date">${fmtDate(m.date)}</span>
          <span class="hov">
            <button class="hbtn" data-h="read" title="${m.seen ? "Als ungelesen markieren" : "Als gelesen markieren"}"><span class="ring ${m.seen ? "" : "full"}"></span></button>
            <button class="hbtn" data-h="delete" title="Löschen">${ic("delete")}</button>
          </span></div>
        <div class="r2"><span class="subj" title="${esc(m.subject)}">${esc(m.subject || "(kein Betreff)")}</span>
          ${m.attachment ? `<span class="clip">${ic("attach")}</span>` : ""}
          <button class="star ${m.flagged ? "on" : ""}" data-h="star" title="${m.flagged ? "Favorit entfernen" : "Als Favorit markieren"}">${ic(m.flagged ? "starfill" : "star")}</button></div>
      </div></div>`;
  }).join("") + (hasMore() ? `<div class="list-more" data-more>Weitere E-Mails laden</div>` : "");
  updateActionbar();
}

function selectedMsgs() {
  if (S.sel.size) return S.msgs.filter(m => S.sel.has(key(m)));
  if (S.cur) { const m = S.msgs.find(x => key(x) === S.cur); return m ? [m] : []; }
  return [];
}
function updateActionbar() {
  const sel = selectedMsgs(), n = sel.length;
  $("#selCount").textContent = n + " ausgewählt";
  const all = $("#chkAll");
  all.checked = S.msgs.length > 0 && S.sel.size === S.msgs.length;
  all.indeterminate = S.sel.size > 0 && S.sel.size < S.msgs.length;
  $$("#actionbar .act").forEach(b => {
    const a = b.dataset.act;
    b.disabled = n === 0 || (["reply", "replyall", "forward"].includes(a) && n !== 1);
  });
  const idx = S.msgs.findIndex(m => key(m) === S.cur);
  $('[data-act="prev"]').disabled = idx <= 0;
  $('[data-act="next"]').disabled = idx < 0 || idx >= S.msgs.length - 1;
  $('[data-act="close"]').disabled = !S.cur && !S.sel.size;
}

// ---------------------------------------------------------------- Lesen
function renderEmpty() {
  const n = S.sel.size;
  $("#readPane").innerHTML = `<div class="empty">
    ${window.Fun && Fun.on ? Fun.emptyArt() : `<div class="bubble"><svg viewBox="0 0 24 24"><defs><linearGradient id="gmail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a6fe6"/><stop offset="1" stop-color="#2bc4a8"/></linearGradient></defs><path d="${P.mail}"/></svg></div>`}
    <h3>${n ? n + (n === 1 ? " E-Mail" : " E-Mails") + " ausgewählt" : "Keine E-Mail ausgewählt"}</h3>
    <p>Bitte klicken Sie auf eine E-Mail</p></div>`;
}

async function openMsg(k) {
  S.cur = k; S.checkMode = false;
  if (isMobile()) appEl().classList.add("reading");
  const m = S.msgs.find(x => key(x) === k);
  renderList();
  if (!m) return;
  closeCompose();
  $("#readPane").innerHTML = `<div class="list-loading">Wird geladen …</div>`;
  try {
    const d = withToken(await api("/api/message?" + qs({ acc: m.acc, folder: m.folder, uid: m.uid })));
    if (S.cur !== k) return;
    S.curMsg = d;
    if (!m.seen) { m.seen = true; bumpUnread(m.acc, m.folder, -1); renderList(); }
    renderMsg(d, false);
  } catch (e) {
    $("#readPane").innerHTML = `<div class="list-empty">${esc(e.message)}</div>`;
  }
}

function bumpUnread(acc, folder, delta) {
  const f = (S.folders[acc] || []).find(x => x.path === folder);
  if (f) { f.unread = Math.max(0, f.unread + delta); renderNav(); }
}

function isDraftMsg(d) { return ((S.folders[d.acc] || []).find(f => f.path === d.folder) || {}).special === "drafts"; }
function renderMsg(d, allowRemote) {
  withToken(d);
  const a = d.from || {};
  const atts = d.attachments || [];
  const toLine = (d.to || []).map(addrText).join(", ");
  const ccLine = (d.cc || []).map(addrText).join(", ");
  $("#readPane").innerHTML = `
  <div class="rd-head">
    <div class="rd-subject"><h2>${esc(d.subject || "(kein Betreff)")}</h2>
      <button class="star ${d.flagged ? "on" : ""}" id="rdStar" title="Favorit">${ic(d.flagged ? "starfill" : "star")}</button></div>
    <div class="rd-from">
      <div class="avatar">${esc(initials(a.name, a.email))}</div>
      <div class="rd-meta">
        <div class="rd-name"><b>${esc(a.name || a.email)}</b> ${a.name ? `<span>&lt;${esc(a.email)}&gt;</span>` : ""}</div>
        <div class="rd-date">${fmtDate(d.date, true)}</div>
        <div class="rd-details" id="rdDetails">Details <span class="badge">${(d.to || []).length + (d.cc || []).length}</span></div>
      </div>
      <div class="rd-tools">
        <span class="rd-zoom"><button class="icon-btn" id="rdZoomOut" title="Mail verkleinern (Strg + Mausrad)">−</button><button class="rd-zpct" id="rdZoomPct" title="Zurück auf 100 %">100 %</button><button class="icon-btn" id="rdZoomIn" title="Mail vergrößern (Strg + Mausrad)">+</button></span>
        <button class="icon-btn" id="rdFull" title="Vollbild">${ic("full")}</button>
        ${isDraftMsg(d) ? `<button class="btn primary" id="rdEditDraft" style="height:32px">${ic("drafts", 'style="width:16px;height:16px;vertical-align:-3px"')} Bearbeiten</button>` : ""}
        <button class="icon-btn" id="rdReply" title="Antworten">${ic("reply")}</button>
        <span class="vsep"></span>
        <button class="icon-btn" id="rdMore" title="Mehr">${ic("more")}</button>
      </div>
    </div>
    <div class="rd-detail-box" id="rdDetailBox" hidden>
      <div><b>Von:</b> ${esc(addrText(a))}</div>
      <div><b>An:</b> ${esc(toLine)}</div>
      ${ccLine ? `<div><b>Kopie:</b> ${esc(ccLine)}</div>` : ""}
      ${d.eml_path ? `<div><b>Datei:</b> ${esc(d.eml_path)}</div>` : `<div><b>Konto:</b> ${esc(accOf(d.acc).email || "")}</div>
      <div><b>Ordner:</b> ${esc(d.folder)}</div>`}
    </div>
    ${atts.length ? `<div class="atts">${atts.map(t => { const base = d.eml_id ? { eml_id: d.eml_id, idx: t.idx } : d.eml_path ? { eml: d.eml_path, idx: t.idx } : { acc: d.acc, folder: d.folder, uid: d.uid, idx: t.idx };
      const view = "/api/attachment?" + qs({ ...base, t: window.BM_TOKEN }), dl = "/api/attachment?" + qs({ ...base, t: window.BM_TOKEN, download: 1 });
      const canView = /^(application\/pdf|image\/(png|jpeg|gif|webp|bmp)|text\/plain)/i.test(t.ctype || "");
      const isImg = /^image\/(png|jpeg|gif|webp|bmp)/i.test(t.ctype || "");
      return `<span class="att-wrap"><a class="att" ${isImg ? `data-img="${view}" data-name="${esc(t.name)}" data-dl="${dl}"` : ""} href="${canView ? view : dl}" ${canView ? 'target="_blank" rel="noopener" title="Öffnen (zum Drucken: im geöffneten Tab Strg+P)"' : `download="${esc(t.name)}" title="Herunterladen"`}>${ic("attach", 'style="width:18px;height:18px;transform:rotate(45deg)"')}<span class="an">${esc(t.name)}</span><span class="as">${fmtSize(t.size)}</span></a><a class="att-dl" href="${dl}" download="${esc(t.name)}" title="Herunterladen">${ic("download")}</a></span>`; }).join("")}</div>` : ""}
    ${d.has_remote && !allowRemote ? `<div class="remote-bar">Externe Bilder wurden zum Schutz Ihrer Privatsphäre blockiert. <button id="rdRemote">Bilder anzeigen</button></div>` : ""}
    ${window.Fun ? Fun.themeBar(d) : ""}
    ${window.Kal ? Kal.inviteCard(d) : ""}
  </div>
  <div class="rd-wrap"><iframe class="rd-body" id="rdFrame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe></div>`;
  const fx = window.Fun ? Fun.frame(d) : { css: "", cls: "", pre: "", post: "" };
  const csp = allowRemote ? "default-src 'none'; img-src * data:; style-src 'unsafe-inline' *; font-src * data:" : `default-src 'none'; img-src 'self' ${location.origin} data:; style-src 'unsafe-inline'; font-src data:`;
  $("#rdFrame").srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
    <style>body{font:14px/1.5 Roboto,"Segoe UI",Arial,sans-serif;color:#1f1f1f;margin:16px 14px;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #c9d6ea;color:#444}a{color:#1565d8}${fx.css}</style></head><body class="${fx.cls}">${fx.pre}${d.html}${fx.post}</body></html>`;
  if (d.eml_id && !d.eml_path) d.eml_path = d.eml_name;
  if (d.eml_path) { $("#rdStar").hidden = true; $("#rdDetails").insertAdjacentHTML("afterend", `<div class="rd-date" style="margin-top:4px">Geöffnete Datei: ${esc(d.eml_path.split(/[\\/]/).pop())}</div>`); }
  $("#rdStar").onclick = () => doFlag([findMsg(d)], !d.flagged);
  $("#rdDetails").onclick = () => { const b = $("#rdDetailBox"); b.hidden = !b.hidden; };
  $("#rdFull").onclick = () => document.getElementById("app").classList.toggle("fullread");
  $("#rdReply").onclick = () => compose("reply");
  const ed = $("#rdEditDraft"); if (ed) ed.onclick = () => compose("draft", d);
  $("#rdMore").onclick = e => showMenu(e.currentTarget, [
    ["Allen antworten", () => compose("replyall")], ["Weiterleiten", () => compose("forward")], null,
    ["Als ungelesen markieren", () => doRead([findMsg(d)], false)], ["Verschieben …", () => moveDialog([findMsg(d)])],
    ["Drucken", () => $("#rdFrame").contentWindow.print()],
  ]);
  const r = $("#rdRemote"); if (r) r.onclick = () => renderMsg(d, true);
  $$(".att[data-img]", $("#readPane")).forEach(x => x.onclick = e => { e.preventDefault(); imgViewer(x.dataset.img, x.dataset.name, x.dataset.dl); });
  const fr = $("#rdFrame");
  let mz = 1;
  const setZoom = (z, keepX, keepY) => {
    const doc = fr.contentDocument; if (!doc || !doc.body) return;
    const se = doc.scrollingElement || doc.documentElement, old = mz;
    mz = Math.min(5, Math.max(0.5, Math.round(z * 100) / 100));
    if (!fr._baseW) fr._baseW = doc.body.clientWidth;          // Breite bei 100 % festhalten, damit Bilder mitwachsen
    doc.body.style.width = mz === 1 ? "" : fr._baseW + "px";
    doc.body.style.zoom = mz;
    if (keepX != null) { se.scrollLeft = (se.scrollLeft + keepX) * mz / old - keepX; se.scrollTop = (se.scrollTop + keepY) * mz / old - keepY; }
    $("#rdZoomPct").textContent = Math.round(mz * 100) + " %";
  };
  $("#rdZoomIn").onclick = () => setZoom(mz * 1.25); $("#rdZoomOut").onclick = () => setZoom(mz / 1.25); $("#rdZoomPct").onclick = () => setZoom(1);
  fr.addEventListener("load", () => {
    const doc = fr.contentDocument; if (!doc) return;
    // Strg + Mausrad
    doc.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(mz * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY); }, { passive: false });
    // Zwei-Finger-Zoom
    let d0 = 0, z0 = 1;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    doc.addEventListener("touchstart", e => { if (e.touches.length === 2) { d0 = dist(e.touches); z0 = mz; } }, { passive: true });
    doc.addEventListener("touchmove", e => { if (e.touches.length === 2 && d0) { e.preventDefault(); const t = e.touches;
      setZoom(z0 * dist(t) / d0, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2); } }, { passive: false });
    doc.addEventListener("touchend", e => { if (e.touches.length < 2) d0 = 0; }, { passive: true });
    doc.addEventListener("click", e => {
      const im = e.target.closest && e.target.closest("img"); if (!im || im.closest("a")) return;
      if ((im.naturalWidth || 0) < 40 && (im.naturalHeight || 0) < 40) return;
      e.preventDefault(); imgViewer(im.currentSrc || im.src, im.alt || "Bild");
    });
    const st = doc.createElement("style"); st.textContent = "img{cursor:zoom-in}a img{cursor:pointer}html{touch-action:pan-x pan-y}"; doc.head && doc.head.appendChild(st);
  }, { once: true });
  if (window.Fun) Fun.afterRender(d, allowRemote);
  if (window.Kal) Kal.bindInvite(d);
}
// ---------------------------------------------------------------- Bildbetrachter
function imgViewer(src, name, dl) {
  const ov = document.createElement("div"); ov.className = "imgv";
  ov.innerHTML = `<div class="imgv-bar"><span class="imgv-name">${esc(name || "Bild")}</span>
    <button data-z="out" title="Verkleinern (−)">−</button><span class="imgv-pct">100 %</span><button data-z="in" title="Vergrößern (+)">+</button>
    <button data-z="fit" title="Einpassen (0)">Einpassen</button><button data-z="one" title="Originalgröße (1)">1:1</button>
    <a class="imgv-btn" href="${esc(dl || src)}" download="${esc(name || "bild")}" title="Speichern">Speichern</a>
    <button data-z="close" title="Schließen (Esc)" class="imgv-x">✕</button></div>
    <div class="imgv-stage"><img alt="${esc(name || "")}" draggable="false"></div>`;
  document.body.appendChild(ov);
  const img = ov.querySelector("img"), stage = ov.querySelector(".imgv-stage"), pct = ov.querySelector(".imgv-pct");
  let sc = 1, fit = 1, x = 0, y = 0;
  const apply = () => { img.style.transform = `translate(${x}px,${y}px) scale(${sc})`; pct.textContent = Math.round(sc * 100) + " %"; };
  const setFit = () => { const r = stage.getBoundingClientRect(); fit = Math.min(1, (r.width - 24) / img.naturalWidth, (r.height - 24) / img.naturalHeight) || 1; sc = fit; x = y = 0; apply(); };
  const zoom = (f, cx, cy) => {
    const r = stage.getBoundingClientRect(); cx = cx ?? r.left + r.width / 2; cy = cy ?? r.top + r.height / 2;
    const ns = Math.min(8, Math.max(0.05, sc * f)), k = ns / sc;
    const ox = cx - (r.left + r.width / 2), oy = cy - (r.top + r.height / 2);
    x = ox - (ox - x) * k; y = oy - (oy - y) * k; sc = ns; apply();
  };
  img.onload = setFit; img.onerror = () => { stage.innerHTML = `<div class="imgv-err">Das Bild konnte nicht geladen werden.</div>`; };
  img.src = src;
  const close = () => { ov.remove(); document.removeEventListener("keydown", key, true); };
  const key = e => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    else if (e.key === "+" || e.key === "=") zoom(1.25); else if (e.key === "-") zoom(0.8);
    else if (e.key === "0") setFit(); else if (e.key === "1") { sc = 1; x = y = 0; apply(); }
  };
  document.addEventListener("keydown", key, true);
  ov.querySelector(".imgv-bar").onclick = e => {
    const z = e.target.dataset && e.target.dataset.z; if (!z) return;
    if (z === "close") close(); else if (z === "in") zoom(1.25); else if (z === "out") zoom(0.8);
    else if (z === "fit") setFit(); else if (z === "one") { sc = 1; x = y = 0; apply(); }
  };
  stage.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  img.addEventListener("dblclick", e => { if (Math.abs(sc - fit) < 0.01) zoom(Math.max(1, fit * 2.5) / sc, e.clientX, e.clientY); else setFit(); });
  // Ziehen (Maus) und Zwei-Finger-Zoom (Handy)
  const pts = new Map(); let last = null, dist0 = 0, sc0 = 1, moved = false;
  stage.addEventListener("pointerdown", e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; dist0 = Math.hypot(a[0] - b[0], a[1] - b[1]); sc0 = sc; } last = [e.clientX, e.clientY]; });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (dist0) zoom((sc0 * d / dist0) / sc, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); moved = true; }
    else if (last) { x += e.clientX - last[0]; y += e.clientY - last[1]; last = [e.clientX, e.clientY]; if (Math.abs(x) + Math.abs(y) > 3) moved = true; apply(); }
  });
  const up = e => { pts.delete(e.pointerId); last = pts.size === 1 ? [...pts.values()][0] : null; if (pts.size < 2) dist0 = 0; };
  stage.addEventListener("pointerup", e => { const wasMoved = moved; up(e); if (!wasMoved && e.target === stage) close(); });
  stage.addEventListener("pointercancel", up);
}
function withToken(d) { if (d && typeof d.html === "string") d.html = d.html.split("__BMT__").join(encodeURIComponent(window.BM_TOKEN || "")); return d; }
function findMsg(d) { return S.msgs.find(m => m.acc === d.acc && m.folder === d.folder && m.uid === d.uid) || { acc: d.acc, folder: d.folder, uid: d.uid, flagged: d.flagged, seen: true }; }

// ---------------------------------------------------------------- Aktionen
function groupBy(msgs) {
  const g = {};
  for (const m of msgs) (g[m.acc + "\u0000" + m.folder] ||= []).push(m);
  return Object.values(g);
}
async function doRead(msgs, seen) {
  try {
    for (const grp of groupBy(msgs)) {
      await api("/api/flags", { body: { acc: grp[0].acc, folder: grp[0].folder, uids: grp.map(m => m.uid), [seen ? "add" : "remove"]: ["\\Seen"] } });
      grp.forEach(m => { if (m.seen !== seen) { m.seen = seen; bumpUnread(m.acc, m.folder, seen ? -1 : 1); } });
    }
    renderList();
  } catch (e) { toast(e.message, true); }
}
async function doFlag(msgs, on) {
  try {
    for (const grp of groupBy(msgs)) {
      await api("/api/flags", { body: { acc: grp[0].acc, folder: grp[0].folder, uids: grp.map(m => m.uid), [on ? "add" : "remove"]: ["\\Flagged"] } });
      grp.forEach(m => m.flagged = on);
    }
    if (S.curMsg && msgs.some(m => m.uid === S.curMsg.uid && m.acc === S.curMsg.acc)) { S.curMsg.flagged = on; const st = $("#rdStar"); if (st) { st.className = "star" + (on ? " on" : ""); st.innerHTML = ic(on ? "starfill" : "star"); } }
    if (S.view.type === "flagged" && !on) { S.msgs = S.msgs.filter(m => !msgs.includes(m)); }
    renderList();
  } catch (e) { toast(e.message, true); }
}
async function doMove(msgs, target, label, targetAcc) {
  if (!msgs.length) return;
  const idx = S.msgs.findIndex(m => key(m) === S.cur);
  try {
    for (const grp of groupBy(msgs)) {
      const body = { acc: grp[0].acc, folder: grp[0].folder, uids: grp.map(m => m.uid), target };
      if (targetAcc && targetAcc !== grp[0].acc) body.target_acc = targetAcc;   // in ein anderes Konto
      await api("/api/move", { body });
      grp.forEach(m => { if (!m.seen) bumpUnread(m.acc, m.folder, -1); });
    }
    const gone = new Set(msgs.map(key));
    const wasOpen = S.cur && gone.has(S.cur);
    S.msgs = S.msgs.filter(m => !gone.has(key(m)));
    S.sel.clear();
    if (wasOpen) {
      const next = S.msgs[Math.min(idx, S.msgs.length - 1)];
      S.cur = null; S.curMsg = null;
      if (next && msgs.length === 1 && !isMobile()) openMsg(key(next)); else { appEl().classList.remove("reading"); renderList(); renderEmpty(); }
    } else renderList();
    toast(label || (msgs.length === 1 ? "E-Mail verschoben" : msgs.length + " E-Mails verschoben"));
    loadFolders().then(renderNav);
  } catch (e) { toast(e.message, true); }
}
const doDelete = msgs => doMove(msgs, "trash", msgs.length === 1 ? "E-Mail gelöscht" : msgs.length + " E-Mails gelöscht");
const doSpam = msgs => doMove(msgs, "junk", msgs.length === 1 ? "Als Spam verschoben" : msgs.length + " E-Mails als Spam verschoben");

// Ziel-Ordner zum Verschieben: alle Konten, Suche, zuletzt benutzte oben
const MOVE_RECENT = "bm_move_recent";
function moveRecent() { try { return JSON.parse(localStorage.getItem(MOVE_RECENT) || "[]"); } catch (e) { return []; } }
function moveRemember(acc, path) {
  try { localStorage.setItem(MOVE_RECENT, JSON.stringify([{ acc, path }, ...moveRecent().filter(r => !(r.acc === acc && r.path === path))].slice(0, 6))); } catch (e) {}
}
function moveDialog(msgs) {
  if (!msgs.length) return;
  const srcAccs = [...new Set(msgs.map(m => m.acc))];
  const accs = [...srcAccs.map(accOf), ...S.accounts.filter(a => !srcAccs.includes(a.id))].filter(Boolean);
  const multiAcc = S.accounts.length > 1;
  const usable = f => !f.noselect && !msgs.every(m => m.folder === f.path && m.acc === f._acc);
  // Reihenfolge: Posteingang, eigene Ordner (z. B. „Privat“), Archiv, Gesendet, Spam, Papierkorb – Entwürfe nicht als Ziel
  const rank = f => ({ inbox: 0, archive: 2, sent: 3, junk: 4, trash: 5 })[f.special] ?? 1;
  const all = accs.flatMap(a => (S.folders[a.id] || []).filter(f => f.special !== "drafts").map((f, i) => ({ ...f, _acc: a.id, _i: i }))
    .sort((x, y) => rank(x) - rank(y) || x._i - y._i)).filter(usable);
  const name = f => f.special === "inbox" ? "Posteingang" : folderLabel(f);
  const btn = (f, opts = {}) => {
    const depth = !opts.flat && f.delim && !f.special ? f.path.split(f.delim).length - 1 : 0;
    const a = accOf(f._acc);
    const full = f.delim && !f.special ? f.path.split(f.delim).map(x => x === "INBOX" ? "Posteingang" : x).join(" › ") : name(f);
    return `<button data-acc="${esc(f._acc)}" data-f="${esc(f.path)}" data-s="${esc((full + " " + (a ? a.email : "")).toLowerCase())}" style="padding-left:${14 + depth * 20}px">
      ${ic(f.special ? SPECIAL[f.special][0] : "folder")}<span class="fp-name">${esc(opts.flat ? full : name(f))}</span>
      ${opts.showAcc && multiAcc && a ? `<small class="fp-acc"><i style="background:${a.color}"></i>${esc(a.email)}</small>` : ""}</button>`;
  };
  const recent = moveRecent().map(r => all.find(f => f._acc === r.acc && f.path === r.path)).filter(Boolean);
  const sections = accs.map(a => {
    const fs = all.filter(f => f._acc === a.id);
    if (!fs.length) return "";
    return `<div class="fp-sec">${multiAcc ? `<div class="fp-head"><i style="background:${a.color}"></i>${esc(a.email)}</div>` : ""}${fs.map(f => btn(f)).join("")}</div>`;
  }).join("");
  modal(`<h2>Verschieben nach …</h2>
    <input class="fp-search" id="fpSearch" type="search" placeholder="Ordner suchen …" autocomplete="off">
    <div class="folder-pick" id="fpList">
      ${recent.length ? `<div class="fp-sec" data-recent><div class="fp-head">Zuletzt verwendet</div>${recent.map(f => btn(f, { flat: true, showAcc: true })).join("")}</div>` : ""}
      ${sections}
      <div class="fp-none" hidden>Kein Ordner gefunden</div>
    </div>
    <div class="row-btns"><button class="btn ghost" data-close>Abbrechen</button></div>`);
  const list = $("#fpList"), search = $("#fpSearch");
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    let any = false;
    $$(".fp-sec", list).forEach(sec => {
      if (sec.hasAttribute("data-recent")) { sec.hidden = !!q; return; }
      let n = 0;
      $$("button", sec).forEach(b => { const ok = !q || b.dataset.s.includes(q); b.hidden = !ok; if (ok) n++; });
      sec.hidden = !n; if (n) any = true;
    });
    $(".fp-none", list).hidden = any || !q;
  };
  search.onkeydown = e => { if (e.key === "Enter") { const b = $$("button", list).find(x => !x.hidden && !x.closest("[hidden]")); if (b) b.click(); } };
  if (!isMobile()) setTimeout(() => search.focus(), 50);
  $$("button[data-f]", list).forEach(b => b.onclick = () => {
    closeModal();
    const acc = b.dataset.acc, path = b.dataset.f;
    moveRemember(acc, path);
    const a = accOf(acc), f = all.find(x => x._acc === acc && x.path === path);
    const where = (f ? (f.special === "inbox" ? "Posteingang" : folderLabel(f)) : path) + (srcAccs.length === 1 && acc === srcAccs[0] ? "" : " (" + (a ? a.email : acc) + ")");
    doMove(msgs.filter(m => !(m.acc === acc && m.folder === path)), path, (msgs.length === 1 ? "E-Mail" : msgs.length + " E-Mails") + " verschoben nach „" + where + "“", acc);
  });
}

// ---------------------------------------------------------------- Verfassen
let C = null; // aktueller Entwurf
// how: "sent" | "discard" – sonst wird ein angefangener Text automatisch als Entwurf gespeichert
function closeCompose(how) {
  if (C && !how && C.dirty) saveDraft(true);
  if (C && C.timer) clearInterval(C.timer);
  if (C && U.st && U.st.state === "ready") setTimeout(renderUpdateBar, 500);
  C = null; appEl().classList.remove("composing"); $("#composePane").hidden = true; $("#readPane").hidden = false; $("#listPane").hidden = false;
}
const newDraftId = () => "bm" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function compose(mode = "new", src) {
  if (window.Kal && Kal.active) { Kal.close(); S.view = { type: "inbox", acc: null, folder: "INBOX" }; renderNav(); loadList(); }
  if (C) closeCompose();                                   // offenen Entwurf vorher sichern
  const d = mode === "new" ? src : (src || S.curMsg);
  if (mode !== "new" && !d) return;
  // Neue E-Mail: Standard-Absender = oberstes Konto in der Kontenliste; Antworten: das Konto, bei dem die Mail ankam
  const acc = (d && d.acc) ? accOf(d.acc) : S.accounts[0];
  if (!acc || !acc.id) return openAccounts(true);
  const re = s => /^(re|aw|antw)\s*:/i.test(s) ? s : "AW: " + s;
  const fw = s => /^(wg|fw|fwd)\s*:/i.test(s) ? s : "WG: " + s;
  let to = "", cc = "", subject = "", body = "<p><br></p>";
  // Absender passend zur Empfängeradresse wählen (Mehrfach-Adressen)
  let from = acc.email;
  if (d) {
    const mine = [acc.email, ...(acc.identities || [])].map(x => x.toLowerCase());
    const hit = [...(d.to || []), ...(d.cc || [])].find(x => mine.includes((x.email || "").toLowerCase()));
    if (hit) from = hit.email;
  }
  let bcc = "";
  if (d && mode === "draft") {
    to = (d.to || []).map(addrText).join(", "); cc = (d.cc || []).map(addrText).join(", "); bcc = (d.bcc || []).map(addrText).join(", ");
    subject = d.subject || ""; body = d.html || "<p><br></p>"; if (d.from && d.from.email) from = d.from.email;
  } else if (d && mode !== "new") {
    const quoteHead = `<p><br></p><p style="color:#555">Am ${fmtDate(d.date, true)} schrieb ${esc(addrText(d.from))}:</p>`;
    if (mode === "reply" || mode === "replyall") {
      const rt = (d.reply_to && d.reply_to.length ? d.reply_to : [d.from]);
      to = rt.map(addrText).join(", ");
      if (mode === "replyall") {
        const me = [acc.email, ...(acc.identities || [])].map(x => x.toLowerCase());
        const others = [...(d.to || []), ...(d.cc || [])].filter(x => !me.includes((x.email || "").toLowerCase()) && !rt.some(r => r.email === x.email));
        cc = others.map(addrText).join(", ");
      }
      subject = re(d.subject || "");
      body = quoteHead + `<blockquote>${d.html}</blockquote>`;
    } else {
      subject = fw(d.subject || "");
      body = `<p><br></p><p style="color:#555">---------- Weitergeleitete Nachricht ----------<br>Von: ${esc(addrText(d.from))}<br>Datum: ${fmtDate(d.date, true)}<br>Betreff: ${esc(d.subject)}<br>An: ${esc((d.to || []).map(addrText).join(", "))}</p>` + d.html;
    }
  }
  C = { mode, acc: acc.id, src: d, attachments: [], inReplyTo: mode.startsWith("reply") ? d.message_id : (mode === "draft" ? d.in_reply_to || "" : ""), references: d ? d.references : "",
        draftId: (mode === "draft" && d.draft_id) || newDraftId(), dirty: false,
        oldDraft: mode === "draft" && !d.draft_id ? { acc: d.acc, folder: d.folder, uid: d.uid } : null };
  const opts = S.accounts.flatMap(a => [a.email, ...(a.identities || [])].map(e => ({ acc: a.id, email: e })));
  $("#readPane").hidden = true;
  appEl().classList.add("composing");
  const cp = $("#composePane"); cp.hidden = false;
  document.getElementById("app").classList.remove("fullread");
  cp.innerHTML = `
    <div class="cp-head"><h2>${mode === "new" ? "Neue E-Mail" : mode === "forward" ? "Weiterleiten" : mode === "draft" ? "Entwurf" : "Antworten"}</h2><span class="cp-saved" id="cpSaved"></span>
      <button class="btn ghost" id="cpDraft">Entwurf speichern</button>
      <button class="btn ghost danger" id="cpDiscard">Verwerfen</button>
      <button class="btn primary" id="cpSend">${ic("sent", 'style="width:18px;height:18px"')} Senden</button></div>
    <div class="cp-field"><label>Von</label><select id="cpFrom">${opts.map(o => `<option value="${esc(o.acc + "|" + o.email)}" ${o.acc === acc.id && o.email === from ? "selected" : ""}>${esc(accOf(o.acc).name ? accOf(o.acc).name + " <" + o.email + ">" : o.email)}</option>`).join("")}</select></div>
    <div class="cp-field"><label>An</label><input id="cpTo" value="${esc(to)}" placeholder="E-Mail-Adresse(n), mit Komma getrennt"><button class="lnk" id="cpCcBtn" ${cc || bcc ? "hidden" : ""}>Kopie / Blindkopie</button></div>
    <div class="cp-field" id="cpCcRow" ${cc || bcc ? "" : "hidden"}><label>Kopie</label><input id="cpCc" value="${esc(cc)}"></div>
    <div class="cp-field" id="cpBccRow" ${bcc ? "" : "hidden"}><label>Blindkopie</label><input id="cpBcc" value="${esc(bcc)}"></div>
    <div class="cp-field"><label>Betreff</label><input id="cpSubject" value="${esc(subject)}"></div>
    <div class="cp-opts">
      <label title="Die E-Mail wird beim Empfänger als wichtig markiert"><input type="checkbox" id="cpPrio" ${CDEF.prio ? "checked" : ""}> Hohe Priorität</label>
      <label title="Der Mailserver des Empfängers meldet, dass die E-Mail angekommen ist (nicht jeder Anbieter unterstützt das)"><input type="checkbox" id="cpDsn" ${CDEF.dsn ? "checked" : ""}> Übermittlungsbestätigung</label>
      <label title="Der Empfänger wird gefragt, ob er das Lesen bestätigen möchte"><input type="checkbox" id="cpMdn" ${CDEF.mdn ? "checked" : ""}> Lesebestätigung</label>
    </div>
    <div class="cp-tools">
      <button data-cmd="bold" title="Fett"><b>F</b></button><button data-cmd="italic" title="Kursiv"><i>K</i></button><button data-cmd="underline" title="Unterstrichen"><u>U</u></button>
      <button data-cmd="insertUnorderedList" title="Aufzählung">•</button><button data-cmd="insertOrderedList" title="Nummerierung">1.</button>
      <button data-cmd="createLink" title="Link einfügen">🔗</button><button data-cmd="removeFormat" title="Formatierung entfernen">⌫</button>
      <span class="grow"></span><button id="cpAttach" title="Datei anhängen" style="width:auto;padding:0 10px;color:var(--blue-text);font-weight:500">${ic("attach", 'style="width:18px;height:18px;display:inline;vertical-align:-4px;transform:rotate(45deg)"')} Anhang</button>
    </div>
    <div class="cp-atts" id="cpAtts" hidden></div>
    <div class="cp-editor" id="cpEditor" contenteditable="true">${body}</div>`;
  $("#cpCcBtn").onclick = () => { $("#cpCcRow").hidden = false; $("#cpBccRow").hidden = false; $("#cpCcBtn").hidden = true; };
  $$(".cp-tools [data-cmd]").forEach(b => b.onclick = () => {
    const c = b.dataset.cmd;
    if (c === "createLink") { const u = prompt("Link-Adresse:", "https://"); if (u) document.execCommand(c, false, u); }
    else document.execCommand(c, false, null);
    $("#cpEditor").focus();
  });
  $("#cpAttach").onclick = () => $("#filePick").click();
  $("#cpSend").onclick = sendMail;
  $("#cpDraft").onclick = saveDraft;
  $("#cpDiscard").onclick = () => {
    if (!confirmDiscard()) return;
    const c = C;
    if (c.saved && c.mode !== "draft") deleteDraft(c);           // nur selbst angelegte Zwischenstände entfernen
    closeCompose("discard"); S.curMsg ? renderMsg(S.curMsg) : renderEmpty();
  };
  // Änderungen merken; alle 20 Sekunden automatisch als Entwurf sichern
  const cpEl = $("#composePane"), mark = () => { if (C) { C.dirty = true; const sv = $("#cpSaved"); if (sv) sv.textContent = ""; } };
  cpEl.addEventListener("input", mark); cpEl.addEventListener("change", mark);
  $$(".cp-tools [data-cmd]").forEach(b => b.addEventListener("click", mark));
  C.timer = setInterval(() => { if (C && C.dirty) saveDraft(true); }, 20000);
  if (mode === "draft") restoreDraftAtts(d);
  if (window.Fun) Fun.onCompose();
  (mode === "new" || mode === "forward" ? $("#cpTo") : $("#cpEditor")).focus();
}
function confirmDiscard() { return !$("#cpEditor") || $("#cpEditor").innerText.trim().length < 3 || confirm("Entwurf verwerfen?"); }

// Voreinstellungen beim Schreiben (Priorität, Bestätigungen) – aus den Einstellungen
let CDEF = { prio: false, dsn: true, mdn: true };
function loadComposeDefaults() { api("/api/settings").then(x => { if (x.compose) CDEF = x.compose; }).catch(() => {}); }

function composeData() {
  const [acc, from] = $("#cpFrom").value.split("|");
  const ed = $("#cpEditor");
  return { acc, from, to: $("#cpTo").value.trim(), cc: $("#cpCc").value.trim(), bcc: $("#cpBcc").value.trim(),
    subject: $("#cpSubject").value.trim(), html: window.Fun ? Fun.wrapHtml(ed.innerHTML) : ed.innerHTML, text: ed.innerText,
    in_reply_to: C.inReplyTo, references: C.references, attachments: C.attachments,
    priority: $("#cpPrio").checked ? "high" : "normal", delivery_receipt: $("#cpDsn").checked, read_receipt: $("#cpMdn").checked };
}
async function sendMail() {
  const data = composeData();
  if (!data.to && !data.cc && !data.bcc) return toast("Bitte einen Empfänger eintragen.", true);
  if (!data.subject && !confirm("Ohne Betreff senden?")) return;
  const b = $("#cpSend"); b.disabled = true; b.lastChild.textContent = " Wird gesendet …";
  try {
    const res = await api("/api/send", { body: data });
    if (data.delivery_receipt && res && res.dsn === false) setTimeout(() => toast("Hinweis: Der Postausgangsserver dieses Kontos bietet keine Übermittlungsbestätigung an – gesendet wurde trotzdem."), 2600);
    if (C.src && C.mode.startsWith("reply")) { const m = findMsg(C.src); api("/api/flags", { body: { acc: m.acc, folder: m.folder, uids: [m.uid], add: ["\\Answered"] } }).catch(() => {}); }
    toast("E-Mail wurde gesendet");
    if (window.Fun) Fun.sent();
    const c = C;
    if (c.saved || c.mode === "draft") deleteDraft(c);
    if (c.oldDraft) api("/api/move", { body: { acc: c.oldDraft.acc, folder: c.oldDraft.folder, uids: [c.oldDraft.uid], target: "trash" } }).catch(() => {});
    closeCompose("sent"); S.curMsg ? renderMsg(S.curMsg) : renderEmpty();
    loadFolders().then(renderNav);
  } catch (e) { toast(e.message, true); b.disabled = false; b.lastChild.textContent = " Senden"; }
}
async function saveDraft(auto) {
  if (!C) return;
  const c = C, data = composeData();                       // Inhalt sofort festhalten (Fenster kann gleich zu sein)
  data.draft_id = c.draftId;
  c.dirty = false;
  try {
    await api("/api/draft", { body: data });
    c.saved = true;
    if (c.oldDraft) { const o = c.oldDraft; c.oldDraft = null; api("/api/move", { body: { acc: o.acc, folder: o.folder, uids: [o.uid], target: "trash" } }).catch(() => {}); }
    const sv = $("#cpSaved"); if (C === c && sv) sv.textContent = "Entwurf gespeichert " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (!auto || C !== c) toast(C === c ? "Entwurf gespeichert" : "Als Entwurf gespeichert (Entwürfe)");
    loadFolders().then(renderNav);
    if (S.view.type === "drafts" || (S.view.type === "folder" && ((S.folders[S.view.acc] || []).find(f => f.path === S.view.folder) || {}).special === "drafts")) loadList(true);
  } catch (e) { c.dirty = true; toast("Entwurf konnte nicht gespeichert werden: " + e.message, true); }
}
function deleteDraft(c) {
  S.accounts.forEach(a => api("/api/draft/delete", { body: { acc: a.id, draft_id: c.draftId } }).catch(() => {}));
}
// Anhänge eines gespeicherten Entwurfs wieder übernehmen
async function restoreDraftAtts(d) {
  const c = C;
  for (const t of (d.attachments || [])) {
    try {
      const r = await fetch("/api/attachment?" + qs({ acc: d.acc, folder: d.folder, uid: d.uid, idx: t.idx, t: window.BM_TOKEN }), { headers: { "X-Token": window.BM_TOKEN } });
      if (!r.ok) continue;
      const b = new Uint8Array(await r.arrayBuffer()); let bin = ""; for (let i = 0; i < b.length; i += 32768) bin += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
      if (C !== c) return;
      c.attachments.push({ name: t.name, size: t.size, ctype: t.ctype, data: btoa(bin) }); renderAtts();
    } catch {}
  }
}
function renderAtts() {
  const box = $("#cpAtts"); box.hidden = !C.attachments.length;
  box.innerHTML = C.attachments.map((a, i) => `<span class="att">${ic("attach", 'style="width:16px;height:16px;transform:rotate(45deg)"')}<span class="an">${esc(a.name)}</span><span class="as">${fmtSize(a.size)}</span><button data-rm="${i}" title="Entfernen">✕</button></span>`).join("");
  $$("[data-rm]", box).forEach(b => b.onclick = () => { C.attachments.splice(+b.dataset.rm, 1); renderAtts(); });
}

// ---------------------------------------------------------------- Konten
async function saveAccOrder(order, reopen = true) {
  if (order.join() === S.accounts.map(a => a.id).join()) { if (reopen && !$("#modal").hidden) openAccounts(); return; }
  try {
    S.accounts = await api("/api/accounts/order", { body: { ids: order } });
    renderNav(); renderList();
    if (reopen && !$("#modal").hidden && $(".acc-list", $("#modalBox"))) openAccounts();
    toast("Reihenfolge gespeichert");
  } catch (e) { toast(e.message, true); }
}
// Ziehen am Griff im Konten-Fenster (Maus und Finger)
function accGripDrag(box) {
  if (!box) return;
  $$(".acc-grip", box).forEach(g => g.onpointerdown = e => {
    const row = g.closest(".acc-row"); e.preventDefault();
    row.classList.add("dragging");
    const move = ev => {
      ev.preventDefault();
      const rows = $$(".acc-row", box).filter(r => r !== row);
      const next = rows.find(r => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
      if (next) { if (row.nextElementSibling !== next) box.insertBefore(row, next); }
      else if (box.lastElementChild !== row) box.appendChild(row);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      row.classList.remove("dragging");
      saveAccOrder($$(".acc-row", box).map(r => r.dataset.id));
    };
    window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}
// ---------------------------------------------------------------- Einstellungen (ein Fenster, mehrere Bereiche)
const SET_TABS = [
  ["konten", "Konten", "add"], ["allgemein", "Allgemein", "settings"], ["schreiben", "Schreiben", "drafts"],
  ["benachr", "Benachrichtigungen", "inbox"], ["kalender", "Kalender", "calendar"], ["abgleich", "Abgleich", "refresh"],
  ["zugang", "Google & Microsoft", "lock"], ["updates", "Updates", "download"], ["hilfe", "Hilfe", "help"]];
let SET_TAB = "konten";
function openAccounts(addNow) { openSettings("konten"); if (addNow && !S.accounts.length) firstStart(); }
function openSettingsGeneral() { openSettings("allgemein"); }
function openSettings(tab) {
  SET_TAB = tab || SET_TAB || "konten";
  const isAndroid = document.documentElement.classList.contains("android");
  const tabs = SET_TABS.filter(t => t[0] !== "benachr" || isAndroid || S.info.server || true);
  modal(`<div class="set-wrap"><div class="set-top"><h2>Einstellungen</h2><button class="icon-btn" data-close title="Schließen">✕</button></div>
    <nav class="set-nav">${tabs.map(t => `<button data-tab="${t[0]}" class="${t[0] === SET_TAB ? "on" : ""}">${esc(t[1])}</button>`).join("")}</nav>
    <div class="set-body" id="setBody"><div class="list-loading">Wird geladen …</div></div></div>`);
  $("#modalBox").classList.add("wide");
  $$(".set-nav [data-tab]").forEach(b => b.onclick = () => openSettings(b.dataset.tab));
  const body = $("#setBody");
  const run = { konten: setKonten, allgemein: setAllgemein, schreiben: setSchreiben, benachr: setBenachr, kalender: setKalender,
                abgleich: setAbgleich, zugang: setZugang, updates: setUpdates, hilfe: setHilfe }[SET_TAB] || setKonten;
  Promise.resolve(run(body)).catch(e => { body.innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; });
}
const setSaveBtn = (label = "Speichern") => `<div class="row-btns"><button class="btn primary" id="setSave">${label}</button></div>`;
const help = t => `<div class="hint">${t}</div>`;

// --- Konten
function setKonten(body) {
  const n = S.accounts.length;
  const list = S.accounts.map((a, i) => `<div class="acc-row" data-id="${a.id}">${n > 1 ? `<span class="acc-grip" title="Zum Umsortieren ziehen">⋮⋮</span>` : ""}<span class="dot" style="width:12px;height:12px;border-radius:50%;background:${a.color}"></span>
    <span class="lbl" title="${esc(a.email)}">${esc(a.email)}${i === 0 && n > 1 ? ` <span class="acc-std">Standard-Absender</span>` : ""}<small>${esc(a.imap_host || "")}${a.identities && a.identities.length ? " · weitere Adressen: " + esc(a.identities.join(", ")) : ""}</small></span>
    ${n > 1 ? `<span class="acc-move"><button class="btn ghost" data-up="${i}" title="Nach oben" ${i ? "" : "disabled"}>▲</button><button class="btn ghost" data-down="${i}" title="Nach unten" ${i < n - 1 ? "" : "disabled"}>▼</button></span>` : ""}
    <button class="btn ghost" data-edit="${a.id}">Bearbeiten</button><button class="btn ghost danger" data-del="${a.id}">Entfernen</button></div>`).join("");
  body.innerHTML = `<h3>E-Mail-Konten</h3>
    ${S.info.demo ? `<p class="msg-err">Im Demo-Modus werden Beispielkonten angezeigt. Echte Konten richten Sie im normalen Modus ein.</p>` : ""}
    ${help(n > 1 ? "Reihenfolge ändern: mit ▲▼ oder am Griff ⋮⋮ ziehen. Das oberste Konto ist der <b>Standard-Absender</b> für neue E-Mails." : "Hier richten Sie Ihre E-Mail-Adressen ein. Sie können beliebig viele Konten verschiedener Anbieter hinzufügen.")}
    <div class="acc-list">${list || `<p style="color:#666">Noch keine Konten eingerichtet.</p>`}</div>
    <div class="row-btns" style="justify-content:flex-start;gap:8px"><button class="btn primary" id="accAdd">${ic("add", 'style="width:18px;height:18px"')} Konto hinzufügen</button>
      ${n ? "" : `<button class="btn ghost" id="accJoin">🔄 Von einem anderen Gerät übernehmen</button>`}</div>`;
  hydrateIcons(body);
  $("#accAdd").onclick = () => accountForm();
  const j = $("#accJoin"); if (j) j.onclick = () => syncJoin();
  $$("[data-edit]", body).forEach(b => b.onclick = () => accountForm(accOf(b.dataset.edit)));
  const ids = () => S.accounts.map(a => a.id);
  const swap = (i, k) => { const o = ids(); [o[i], o[k]] = [o[k], o[i]]; saveAccOrder(o); };
  $$("[data-up]", body).forEach(b => b.onclick = () => { const i = +b.dataset.up; if (i > 0) swap(i, i - 1); });
  $$("[data-down]", body).forEach(b => b.onclick = () => { const i = +b.dataset.down; if (i < S.accounts.length - 1) swap(i, i + 1); });
  accGripDrag($(".acc-list", body));
  $$("[data-del]", body).forEach(b => b.onclick = async () => {
    if (!confirm("Konto wirklich aus Balu-Mail entfernen? Ihre E-Mails beim Anbieter bleiben erhalten – Balu-Mail zeigt sie nur nicht mehr an.")) return;
    try { await api("/api/accounts/delete", { body: { id: b.dataset.del } }); await loadAccounts(); delete S.folders[b.dataset.del]; setView({ type: "inbox", acc: null, folder: "INBOX" }); openSettings("konten"); }
    catch (e) { toast(e.message, true); }
  });
}

// --- Allgemein
async function setAllgemein(body) {
  const st = await api("/api/settings");
  const win = S.info.windows && !document.documentElement.classList.contains("android");
  body.innerHTML = `${logoSettingsHtml(st)}
    ${window.Fun ? Fun.settingsHtml() : ""}
    ${win ? `<div class="settings-sec"><h3>Standard-E-Mail-Programm</h3>
      ${help("Damit Links wie „E-Mail senden“ auf Webseiten und gespeicherte .eml-Dateien in Balu-Mail öffnen, in den Windows-Einstellungen bei <b>MAILTO</b> und <b>.eml</b> jeweils „Balu-Mail“ auswählen.")}
      <button class="btn ghost" id="sDefault" style="border:1px solid #cdd8ea;margin-top:8px">Windows-Standard-Apps öffnen</button></div>` : ""}
    ${setSaveBtn()}`;
  body.firstElementChild && body.firstElementChild.classList.remove("settings-sec");
  bindLogoSettings();
  const sd = $("#sDefault"); if (sd) sd.onclick = () => api("/api/default-apps", { body: {} }).catch(err => toast(err.message, true));
  $("#setSave").onclick = async () => {
    const b = {};
    if (window.Fun) b.fun = Fun.readSettings();
    const lg = pickedLogo(); if (lg && lg !== (st.logo || "balu")) b.logo = lg;
    try { await api("/api/settings", { body: b }); } catch (e) { return toast(e.message, true); }
    if (b.logo) applyLogo(b.logo);
    if (window.Fun) { Fun.set(b.fun); S.curMsg && !C ? renderMsg(S.curMsg) : (!C && renderEmpty()); }
    toast("Gespeichert");
  };
}

// --- Schreiben
async function setSchreiben(body) {
  const st = await api("/api/settings"), c = st.compose || {};
  body.innerHTML = `<h3>Beim Schreiben voreingestellt</h3>
    ${help("Diese Häkchen sind bei jeder neuen E-Mail gesetzt und lassen sich dort einzeln abwählen. Die Einstellung gilt auf allen Ihren Geräten.")}
    <label class="opt-chk"><input type="checkbox" id="sPrio" ${c.prio ? "checked" : ""}> <span><b>Hohe Priorität</b><br><small>Die E-Mail wird beim Empfänger als wichtig markiert.</small></span></label>
    <label class="opt-chk"><input type="checkbox" id="sDsn" ${c.dsn !== false ? "checked" : ""}> <span><b>Übermittlungsbestätigung</b><br><small>Der Mailserver des Empfängers meldet, dass die E-Mail angekommen ist. Nicht jeder Anbieter unterstützt das.</small></span></label>
    <label class="opt-chk"><input type="checkbox" id="sMdn" ${c.mdn !== false ? "checked" : ""}> <span><b>Lesebestätigung</b><br><small>Der Empfänger wird gefragt, ob er das Lesen bestätigen möchte – er kann ablehnen.</small></span></label>
    <div class="settings-sec"><h3>Entwürfe</h3>${help("Angefangene E-Mails speichert Balu-Mail automatisch im Ordner „Entwürfe“ – alle 20 Sekunden und sobald Sie woanders hinklicken. Über „Bearbeiten“ schreiben Sie dort weiter.")}</div>
    ${setSaveBtn()}`;
  $("#setSave").onclick = async () => {
    const compose = { prio: $("#sPrio").checked, dsn: $("#sDsn").checked, mdn: $("#sMdn").checked };
    try { await api("/api/settings", { body: { compose } }); CDEF = compose; toast("Gespeichert"); } catch (e) { toast(e.message, true); }
  };
}

// --- Benachrichtigungen (Handy)
async function setBenachr(body) {
  const st = await api("/api/settings"), iv = st.notify_intervals || {}, def = st.notify_default || 900;
  const opts = [[120, "alle 2 Minuten"], [300, "alle 5 Minuten"], [900, "alle 15 Minuten"], [1800, "alle 30 Minuten"], [3600, "jede Stunde"], [86400, "nie (nur beim Öffnen)"]];
  body.innerHTML = `<h3>Neue E-Mails melden</h3>
    ${help("Gilt für die <b>Handy-App</b>: Sie prüft im Hintergrund, ob neue E-Mails da sind, und zeigt eine Benachrichtigung mit Absender und Betreff. Häufiges Prüfen braucht etwas mehr Akku. Die Einstellung wird auf alle Geräte übertragen.")}
    <div class="form">${S.accounts.map(a => `<label>${esc(a.email)}</label><select data-iv="${esc(a.email.toLowerCase())}">${opts.map(o => `<option value="${o[0]}" ${(+(iv[a.email.toLowerCase()] || def)) === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select>`).join("") || `<p style="color:#666">Noch keine Konten eingerichtet.</p>`}</div>
    ${help("Damit die Benachrichtigungen ankommen, muss Balu-Mail in den Android-Einstellungen Benachrichtigungen senden dürfen und vom Akku-Sparen ausgenommen sein (Einstellungen → Apps → Balu-Mail → Akku → „Nicht eingeschränkt“).")}
    ${setSaveBtn()}`;
  $("#setSave").onclick = async () => {
    const out = {}; $$("[data-iv]", body).forEach(s => { out[s.dataset.iv] = +s.value; });
    try { await api("/api/settings", { body: { notify_intervals: out } }); toast("Gespeichert"); } catch (e) { toast(e.message, true); }
  };
}

// --- Kalender
async function setKalender(body) {
  const st = await api("/api/settings"), l = st.laender || {};
  body.innerHTML = `<h3>Feiertage</h3>
    ${help("Balu-Mail zeigt die gesetzlichen Feiertage im Kalender an. Wählen Sie Ihr Bundesland, damit auch die regionalen Feiertage (z. B. Fronleichnam, Reformationstag) stimmen.")}
    <div class="form"><label for="sLand">Bundesland</label><select id="sLand">${Object.entries(l).map(([k, v]) => `<option value="${k}" ${k === (st.feiertage_land || "") ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
    <div class="settings-sec"><h3>Weitere Kalender</h3>
      ${help("Kalender Ihrer E-Mail-Adressen, den Google-Kalender und Internet-Kalender (Müllabfuhr, Schulferien, Vereine …) fügen Sie direkt im Kalender hinzu: links auf <b>Kalender</b> → <b>Kalender hinzufügen</b>.")}</div>
    ${setSaveBtn()}`;
  $("#setSave").onclick = async () => {
    try { await api("/api/settings", { body: { feiertage_land: $("#sLand").value } }); toast("Gespeichert"); if (window.Kal && Kal.active) Kal.open(); } catch (e) { toast(e.message, true); }
  };
}

// --- Abgleich
async function setAbgleich(body) {
  let st = {}; try { st = await api("/api/sync/status"); } catch {}
  body.innerHTML = `<h3>Mehrere Geräte abgleichen</h3>
    ${help("Nutzen Sie Balu-Mail am PC, auf dem Handy oder als Webseite, müssen Sie Ihre Konten nur einmal einrichten. Balu-Mail legt die Einstellungen <b>verschlüsselt</b> in einem Ihrer eigenen Postfächer ab (Ordner „Balu-Mail-Sync“) – es gibt keinen fremden Server. Abgeglichen werden Konten, Reihenfolge, Kalender, Voreinstellungen und geschlossene Erinnerungen.")}
    <div class="code-box" style="text-align:left;margin:12px 0">${st.enabled
      ? `✔ <b>Aktiv</b> über <b>${esc(st.email)}</b><br><span style="color:#666">Letzter Abgleich: ${esc(fmtAgo(st.last))}</span>${st.error ? `<div class="msg-err">${esc(st.error)}</div>` : ""}`
      : `Abgleich ist auf diesem Gerät <b>nicht eingerichtet</b>.`}</div>
    <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="sySet">${st.enabled ? "Abgleich verwalten" : "Abgleich einrichten"}</button>
      ${st.enabled ? "" : `<button class="btn ghost" id="syJoin">Von einem anderen Gerät übernehmen</button>`}</div>`;
  $("#sySet").onclick = () => openSync();
  const j = $("#syJoin"); if (j) j.onclick = () => syncJoin();
}

// --- Google & Microsoft
async function setZugang(body) {
  const st = await api("/api/settings");
  body.innerHTML = `<h3>Microsoft (Outlook, Hotmail, Live, Microsoft 365)</h3>
    ${help("Microsoft lässt bei diesen Adressen keine Anmeldung mit normalem Passwort mehr zu. Dafür braucht Balu-Mail einmalig eine eigene, kostenlose <b>App-ID</b> von Microsoft. Sie gilt für alle Ihre Microsoft-Adressen und wird auf Ihre Geräte übertragen.")}
    <div class="form"><label for="sCid">Microsoft-App-ID</label><input id="sCid" value="${esc(st.ms_client_id || "")}" autocomplete="off" name="balu-ms-app-id" spellcheck="false" placeholder="z. B. 1a2b3c4d-1234-5678-9abc-1234567890ab"></div>
    <div class="hint"><a href="#" id="sHelp" style="color:var(--blue-text)">Schritt-für-Schritt-Anleitung: App-ID bekommen</a></div>
    <div class="settings-sec"><h3>Google (Gmail und Google-Kalender)</h3>
    ${help("<b>Gmail-E-Mails</b> brauchen keine Einrichtung hier: Verwenden Sie beim Konto ein <b>App-Passwort</b> (Anleitung unter „Hilfe“). Nur für den <b>Google-Kalender</b> (Termine in beide Richtungen abgleichen) braucht Balu-Mail einen eigenen, kostenlosen Google-Zugang.")}
    <div class="form"><label for="sGId">Client-ID</label><input id="sGId" value="${esc(st.google_client_id || "")}" placeholder="…apps.googleusercontent.com" autocomplete="off" name="balu-google-id" spellcheck="false">
      <label for="sGSec">Clientschlüssel</label><input id="sGSec" type="text" class="secret" placeholder="${st.google_secret_set ? "(gespeichert – nur zum Ändern ausfüllen)" : "GOCSPX-…"}" autocomplete="off" name="balu-google-secret" spellcheck="false" oninput="this.dataset.typed=1"></div>
    <div class="hint"><a href="#" id="sGHelp" style="color:var(--blue-text)">Schritt-für-Schritt-Anleitung: Google-Zugang bekommen</a></div></div>
    ${setSaveBtn()}`;
  $("#sHelp").onclick = ev => { ev.preventDefault(); msHelp(); };
  $("#sGHelp").onclick = ev => { ev.preventDefault(); googleHelp(); };
  $("#setSave").onclick = async () => {
    const b = {}, cid = $("#sCid").value.trim();
    if (cid !== (st.ms_client_id || "")) {
      if (cid && !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(cid))
        return toast("Die Microsoft-App-ID sieht aus wie 1a2b3c4d-1234-… (keine E-Mail-Adresse). Bitte das Feld leeren oder korrigieren.", true);
      b.ms_client_id = cid;
    }
    const gid = $("#sGId").value.trim(), gsec = $("#sGSec").dataset.typed ? $("#sGSec").value.trim() : "";
    if (gid !== (st.google_client_id || "") || gsec) { b.google_client_id = gid; if (gsec) b.google_client_secret = gsec; }
    if (!Object.keys(b).length) return toast("Nichts geändert");
    try { await api("/api/settings", { body: b }); toast("Gespeichert"); setZugang(body); } catch (e) { toast(e.message, true); }
  };
}
function googleHelp() {
  modal(`<h2>Google-Zugang für den Kalender (einmalig)</h2>
    <p style="margin-top:0;color:#444">Damit Balu-Mail Ihre Google-Termine lesen und schreiben darf, braucht es einen eigenen, kostenlosen Zugang bei Google. Das dauert etwa 10 Minuten:</p>
    <ol style="line-height:1.7;padding-left:20px;margin:0">
      <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" style="color:var(--blue-text)">Google Cloud Console öffnen</a>, mit Ihrem Google-Konto anmelden und ein <b>neues Projekt</b> „Balu-Mail“ anlegen.</li>
      <li><a href="https://console.cloud.google.com/apis/library/caldav.googleapis.com" target="_blank" style="color:var(--blue-text)">CalDAV API</a> aufrufen und <b>Aktivieren</b> klicken.</li>
      <li><a href="https://console.cloud.google.com/auth/overview" target="_blank" style="color:var(--blue-text)">Google Auth Platform</a> → <b>Jetzt starten</b>: App-Name „Balu-Mail“, Ihre E-Mail-Adresse, Zielgruppe <b>Extern</b>.</li>
      <li>Unter <b>Zielgruppe</b> → <b>Testnutzer</b> Ihre eigene Gmail-Adresse hinzufügen.</li>
      <li>Unter <b>Clients</b> → <b>Client erstellen</b> → Anwendungstyp <b>Desktop-App</b> → Erstellen.</li>
      <li><b>Client-ID</b> und <b>Clientschlüssel</b> kopieren und hier einfügen → Speichern.</li>
      <li>Danach im Kalender: <b>Kalender hinzufügen</b> → Ihr Gmail-Konto → <b>Mit Google anmelden</b>.</li>
    </ol>
    <p style="color:#444">Hinweis: Weil der Zugang nur für Sie selbst ist, zeigt Google beim Anmelden „Google hat diese App nicht überprüft“ – dort auf <b>Weiter</b> klicken.</p>
    <div class="row-btns"><button class="btn ghost" id="ghBack">Zurück</button><button class="btn primary" data-close>Verstanden</button></div>`);
  $("#ghBack").onclick = () => openSettings("zugang");
}

// --- Updates
async function setUpdates(body) {
  const ust = await updatePoll();
  body.innerHTML = updateSettingsHtml(ust).replace('class="settings-sec" id="updSec"', 'id="updSec"');
  bindUpdateSettings();
  const a = $("#uAuto"); if (a) a.onchange = async () => {
    try { U.st = await api("/api/update/settings", { body: { auto: a.checked } }); renderUpdateBar(); toast("Gespeichert"); } catch (e) { toast(e.message, true); }
  };
}

// --- Hilfe
function setHilfe(body) {
  const v = (U.st && U.st.version) || "";
  body.innerHTML = `<h3>Hilfe</h3>
    <details class="help-item" open><summary>Erste Schritte</summary><ol>
      <li><b>Konto hinzufügen:</b> Einstellungen → Konten → „Konto hinzufügen“. Name, E-Mail-Adresse und Passwort eingeben – die Servereinstellungen ergänzt Balu-Mail bei bekannten Anbietern selbst.</li>
      <li><b>Posteingang:</b> „Posteingang“ links zeigt die Mails aller Konten zusammen; darunter jedes Konto einzeln.</li>
      <li><b>Weitere Geräte:</b> unter „Abgleich“ einrichten – dann sind Ihre Konten am PC, auf dem Handy und auf der Webseite gleich.</li></ol></details>
    <details class="help-item"><summary>GMX und WEB.DE: Abruf erlauben</summary><p>Melden Sie sich einmal auf gmx.net bzw. web.de an → <b>Einstellungen</b> → <b>POP3/IMAP Abruf</b> → „Zugriff über POP3 und IMAP erlauben“ einschalten. Ohne das lehnt der Anbieter Balu-Mail ab.</p></details>
    <details class="help-item"><summary>Gmail: App-Passwort verwenden</summary><ol>
      <li>Im Google-Konto muss die <b>Bestätigung in zwei Schritten</b> eingeschaltet sein (myaccount.google.com → Sicherheit).</li>
      <li><a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:var(--blue-text)">App-Passwörter öffnen</a>, Namen „Balu-Mail“ eingeben → Erstellen.</li>
      <li>Das angezeigte 16-stellige Passwort (ohne Leerzeichen) in Balu-Mail als Passwort eintragen.</li></ol></details>
    <details class="help-item"><summary>Outlook, Hotmail, Live, Microsoft 365</summary><p>Beim Konto „Anmeldung: Microsoft-Anmeldung“ wählen. Voraussetzung ist eine Microsoft-App-ID unter <b>Google & Microsoft</b> – dort steht eine Schritt-für-Schritt-Anleitung.</p></details>
    <details class="help-item"><summary>iCloud, Yahoo, AOL</summary><p>Diese Anbieter verlangen ein <b>App-spezifisches Passwort</b>: iCloud unter appleid.apple.com → Anmeldung und Sicherheit; Yahoo/AOL in den Kontoeinstellungen → Sicherheit. Dieses Passwort statt Ihres normalen in Balu-Mail eintragen.</p></details>
    <details class="help-item"><summary>Andere Anbieter</summary><p>Beim Hinzufügen eines Kontos auf „Servereinstellungen“ klicken und die Angaben Ihres Anbieters eintragen (Posteingang/IMAP meist Port 993, Postausgang/SMTP meist 465 oder 587). Die Werte stehen in der Hilfe Ihres Anbieters unter „IMAP“.</p></details>
    <details class="help-item"><summary>Datenschutz</summary><p>Balu-Mail verbindet sich direkt mit Ihrem E-Mail-Anbieter. Passwörter werden verschlüsselt auf Ihrem Gerät gespeichert. Für den Abgleich mehrerer Geräte nutzt Balu-Mail nur Ihr eigenes Postfach (verschlüsselt) – es gibt keinen Balu-Mail-Server, der Ihre Daten sieht. Externe Bilder in E-Mails werden erst nach Klick auf „Bilder anzeigen“ geladen, damit Absender nicht sehen, wann Sie eine E-Mail öffnen.</p></details>
    <details class="help-item"><summary>Windows meldet „Der Computer wurde durch Windows geschützt“</summary><p>Balu-Mail ist ein kleines, privates Projekt ohne gekauftes Herausgeber-Zertifikat. Klicken Sie auf <b>Weitere Informationen</b> → <b>Trotzdem ausführen</b>. Updates spielt Balu-Mail danach selbst ein.</p></details>
    <p class="hint" style="margin-top:14px">Balu-Mail ${esc(v)} · <a href="https://github.com/jschlo2201/balu-mail-app" target="_blank" style="color:var(--blue-text)">Projektseite mit Downloads</a></p>`;
}

const PRESETS = [
  [/@gmx\.(de|net|at|ch)$/i, "imap.gmx.net", 993, "mail.gmx.net", 587],
  [/@gmx\.com$/i, "imap.gmx.com", 993, "mail.gmx.com", 587],
  [/@web\.de$/i, "imap.web.de", 993, "smtp.web.de", 587],
  [/@(gmail|googlemail)\.com$/i, "imap.gmail.com", 993, "smtp.gmail.com", 465],
  [/@t-online\.de$/i, "secureimap.t-online.de", 993, "securesmtp.t-online.de", 465],
  [/@(outlook|hotmail|live)\.[a-z.]+$/i, "outlook.office365.com", 993, "smtp-mail.outlook.com", 587],
  [/@(ionos|1und1|online)\.de$/i, "imap.ionos.de", 993, "smtp.ionos.de", 465],
  [/@(yahoo)\.[a-z.]+$/i, "imap.mail.yahoo.com", 993, "smtp.mail.yahoo.com", 465],
  [/@(icloud|me|mac)\.com$/i, "imap.mail.me.com", 993, "smtp.mail.me.com", 587],
  [/@(aol)\.[a-z.]+$/i, "imap.aol.com", 993, "smtp.aol.com", 465],
  [/@(freenet)\.de$/i, "mx.freenet.de", 993, "mx.freenet.de", 587],
  [/@(mailbox\.org)$/i, "imap.mailbox.org", 993, "smtp.mailbox.org", 465],
  [/@(posteo\.de)$/i, "posteo.de", 993, "posteo.de", 465],
];
const HINTS = [
  [/@gmx\./i, "GMX: Unter gmx.net → Einstellungen → POP3/IMAP-Abruf muss „Zugriff erlauben“ aktiviert sein."],
  [/@web\.de$/i, "WEB.DE: In den Einstellungen unter POP3/IMAP-Abruf den Zugriff erlauben."],
  [/@(gmail|googlemail)\.com$/i, "Gmail: Bitte ein App-Passwort verwenden (Google-Konto → Sicherheit → App-Passwörter)."],
  [/@(outlook|hotmail|live|msn)\./i, "Microsoft-Konto: Anmeldung erfolgt über „Microsoft-Anmeldung“ (kein Passwort hier eingeben)."],
  [/@(yahoo|aol)\./i, "Yahoo/AOL: Bitte ein App-Passwort verwenden (Kontoeinstellungen → Sicherheit)."],
  [/@(icloud|me|mac)\.com$/i, "iCloud: Bitte ein app-spezifisches Passwort verwenden (appleid.apple.com)."],
];
function accountForm(a) {
  const e = a || { name: "", email: "", user: "", imap_host: "", imap_port: 993, smtp_host: "", smtp_port: 587, identities: [], save_sent: true, auth: "password" };
  let flow = null, msOk = false, pollT = null, acT = null, acSeq = 0;
  modal(`<h2>${a ? "Konto bearbeiten" : "Konto hinzufügen"}</h2>
    <div class="form">
      <label>Ihr Name</label><input id="fName" value="${esc(e.name)}" placeholder="z. B. Max Mustermann">
      <label>E-Mail-Adresse</label><input id="fEmail" value="${esc(e.email)}" placeholder="name@anbieter.de">
      <label>Anmeldung</label><select id="fAuth"><option value="password">Mit Passwort</option><option value="oauth_ms">Microsoft-Anmeldung (Outlook, Hotmail, Live, Microsoft 365)</option></select>
      <label class="pwrow">Passwort</label><input class="pwrow" id="fPw" type="password" placeholder="${a ? "(unverändert lassen)" : ""}">
      <div class="hint" id="fHint"></div>
      <div class="full" id="fMs" hidden></div>
      <label>Weitere Absender­adressen</label><input id="fIds" value="${esc((e.identities || []).join(", "))}" placeholder="optional, mit Komma getrennt">
      <div class="full" style="margin-top:6px"><button class="lnk" id="fAdvBtn" style="color:var(--blue-text)">Servereinstellungen <span id="fSrc"></span> ▾</button></div>
      <div class="full form" id="fAdv" hidden style="grid-template-columns:150px 1fr 70px 80px">
        <label>Benutzername</label><input id="fUser" value="${esc(e.user)}" placeholder="meist die E-Mail-Adresse" style="grid-column:2/-1">
        <label>Posteingang (IMAP)</label><input id="fImap" value="${esc(e.imap_host)}"><label style="text-align:right">Port</label><input id="fImapPort" value="${e.imap_port}">
        <label>Postausgang (SMTP)</label><input id="fSmtp" value="${esc(e.smtp_host)}"><label style="text-align:right">Port</label><input id="fSmtpPort" value="${e.smtp_port}">
        <label>Gesendete speichern</label><label style="grid-column:2/-1"><input type="checkbox" id="fSave" ${e.save_sent !== false ? "checked" : ""} style="width:auto;height:auto"> Kopie in „Gesendet“ ablegen (bei Gmail und Microsoft ausschalten)</label>
      </div>
    </div>
    <div id="fMsg"></div>
    <div class="row-btns"><button class="btn ghost" id="fBack">Zurück</button><button class="btn ghost" id="fTest">Verbindung testen</button><button class="btn primary" id="fSaveBtn">Speichern</button></div>`);
  $("#fAuth").value = e.auth || "password";
  const setSrv = (c, label) => {
    $("#fImap").value = c.imap_host; $("#fImapPort").value = c.imap_port; $("#fSmtp").value = c.smtp_host; $("#fSmtpPort").value = c.smtp_port;
    if (c.user) $("#fUser").value = c.user;
    $("#fSrc").textContent = label ? "· " + label : "";
    $("#fAuth").value = c.microsoft ? "oauth_ms" : "password"; if (c.microsoft) $("#fSave").checked = false; authChanged();
  };
  const authChanged = () => {
    const ms = $("#fAuth").value === "oauth_ms";
    $$(".pwrow").forEach(x => x.hidden = ms);
    $("#fMs").hidden = !ms;
    if (ms) renderMs();
  };
  async function renderMs() {
    let cid = "";
    try { cid = (await api("/api/settings")).ms_client_id; } catch {}
    const box = $("#fMs");
    if (!cid) {
      box.innerHTML = `<div class="code-box" style="text-align:left">Für Microsoft-Konten wird einmalig eine <b>App-ID</b> benötigt (kostenlos, ca. 5 Minuten).
        <a href="#" id="fMsHelp" style="color:var(--blue-text)">So geht's</a><div style="display:flex;gap:8px;margin-top:10px"><input id="fCid" autocomplete="off" name="balu-ms-app-id" spellcheck="false" placeholder="App-ID (Anwendungs-ID), z. B. 1a2b3c4d-…" style="flex:1"><button class="btn primary" id="fCidSave">Übernehmen</button></div></div>`;
      $("#fMsHelp").onclick = ev => { ev.preventDefault(); msHelp(); };
      $("#fCidSave").onclick = async () => { await api("/api/settings", { body: { ms_client_id: $("#fCid").value } }); renderMs(); };
      return;
    }
    box.innerHTML = msOk ? `<div class="code-box msg-ok" style="margin:0">✔ Bei Microsoft angemeldet. Jetzt auf „Speichern“ klicken.</div>`
      : (a && a.auth === "oauth_ms" && !flow ? `<div class="code-box" style="text-align:left">Dieses Konto ist bereits angemeldet. <button class="btn ghost" id="fMsGo">Neu anmelden</button></div>`
      : `<div class="code-box"><button class="btn primary" id="fMsGo">Bei Microsoft anmelden</button></div>`);
    const go = $("#fMsGo"); if (go) go.onclick = startMs;
  }
  async function startMs() {
    try {
      const r = await api("/api/oauth/ms/start", { body: {} });
      flow = r.flow;
      $("#fMs").innerHTML = `<div class="code-box">1. Diesen Code kopieren:<div class="code">${esc(r.code)}</div>
        2. <a href="${esc(r.url)}" target="_blank" style="color:var(--blue-text)">Microsoft-Anmeldeseite öffnen</a>, Code einfügen und mit Ihrem Konto anmelden.<br><br><span style="color:#666">Warte auf Anmeldung …</span></div>`;
      try { navigator.clipboard.writeText(r.code); } catch {}
      window.open(r.url, "_blank");
      clearInterval(pollT);
      pollT = setInterval(async () => {
        if ($("#modal").hidden) return clearInterval(pollT);
        try {
          const p = await api("/api/oauth/ms/poll", { body: { flow } });
          if (p.status === "ok") { clearInterval(pollT); msOk = true; renderMs(); }
          else if (p.status === "error") { clearInterval(pollT); $("#fMs").innerHTML = `<div class="code-box msg-err">${esc(p.error)}<br><button class="btn ghost" id="fMsGo">Nochmal versuchen</button></div>`; $("#fMsGo").onclick = startMs; }
        } catch (err) { clearInterval(pollT); toast(err.message, true); }
      }, 5000);
    } catch (err) { toast(err.message, true); }
  }
  const fill = () => {
    const em = $("#fEmail").value.trim();
    const h = HINTS.find(x => x[0].test(em)); $("#fHint").textContent = h ? h[1] : "";
    if (a || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(em)) return;
    const p = PRESETS.find(x => x[0].test(em));
    if (p) { setSrv({ imap_host: p[1], imap_port: p[2], smtp_host: p[3], smtp_port: p[4], user: em, microsoft: /outlook\.office365/.test(p[1]) }, "bekannter Anbieter"); $("#fSave").checked = !/gmail|googlemail|outlook|hotmail|live/i.test(em); return; }
    clearTimeout(acT);
    acT = setTimeout(async () => {
      const seq = ++acSeq; $("#fSrc").textContent = "· werden gesucht …";
      try {
        const c = await api("/api/autoconfig?" + qs({ email: em }));
        if (seq !== acSeq) return;
        setSrv(c, { autoconfig: "automatisch gefunden", mx: "automatisch gefunden", microsoft: "Microsoft erkannt", guess: "geschätzt – bitte prüfen" }[c.source] || "");
        if (c.source === "guess") $("#fAdv").hidden = false;
      } catch { $("#fSrc").textContent = "· bitte ausfüllen"; $("#fAdv").hidden = false; }
    }, 600);
  };
  $("#fEmail").oninput = fill; fill();
  $("#fAuth").onchange = authChanged; authChanged();
  $("#fAdvBtn").onclick = () => $("#fAdv").hidden = !$("#fAdv").hidden;
  $("#fBack").onclick = () => { clearInterval(pollT); openAccounts(); };
  const data = () => ({ id: a && a.id, name: $("#fName").value, email: $("#fEmail").value.trim(), password: $("#fPw").value,
    auth: $("#fAuth").value, oauth_flow: flow,
    user: $("#fUser").value.trim() || $("#fEmail").value.trim(), imap_host: $("#fImap").value.trim(), imap_port: $("#fImapPort").value,
    smtp_host: $("#fSmtp").value.trim(), smtp_port: $("#fSmtpPort").value, save_sent: $("#fSave").checked,
    identities: $("#fIds").value.split(",").map(s => s.trim()).filter(Boolean) });
  const msg = (t, ok) => $("#fMsg").innerHTML = `<div class="${ok ? "msg-ok" : "msg-err"}">${esc(t)}</div>`;
  const valid = d => {
    if (!d.email.includes("@")) return "Bitte eine gültige E-Mail-Adresse eingeben.";
    if (!d.imap_host || !d.smtp_host) { $("#fAdv").hidden = false; return "Bitte die Servereinstellungen ausfüllen."; }
    if (d.auth === "password" && !a && !d.password) return "Bitte das Passwort eingeben.";
    if (d.auth === "oauth_ms" && !msOk && !(a && a.auth === "oauth_ms")) return "Bitte zuerst „Bei Microsoft anmelden“.";
  };
  $("#fTest").onclick = async () => {
    const d = data(), v = valid(d); if (v) return msg(v);
    msg("Verbindung wird getestet …", true);
    try { const r = await api("/api/accounts/test", { body: d }); r.ok ? msg("Alles in Ordnung – Empfang und Versand funktionieren.", true) : msg(r.errors.join("\n")); }
    catch (err) { msg(err.message); }
  };
  $("#fSaveBtn").onclick = async () => {
    const d = data(), v = valid(d); if (v) return msg(v);
    msg("Verbindung wird geprüft …", true);
    try {
      const r = await api("/api/accounts/test", { body: d });
      if (!r.ok && !confirm("Der Verbindungstest ist fehlgeschlagen:\n\n" + r.errors.join("\n") + "\n\nTrotzdem speichern?")) return msg(r.errors.join("\n"));
      await api("/api/accounts/save", { body: d });
      clearInterval(pollT);
      await loadAccounts(); closeModal(); toast("Konto gespeichert"); await refreshAll(true);
    } catch (err) { msg(err.message); }
  };
}

function firstStart() {
  modal(`<h2>Willkommen bei Balu-Mail</h2>
    <p style="color:#444;margin-top:0;line-height:1.5">Balu-Mail zeigt die E-Mails all Ihrer Adressen in einem Programm. Es verbindet sich direkt mit Ihrem Anbieter – Ihre Daten bleiben bei Ihnen.<br>Wie möchten Sie beginnen?</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn primary" id="fsNew" style="justify-content:center;height:44px">${ic("add", 'style="width:18px;height:18px"')} Erstes E-Mail-Konto hinzufügen</button>
      <button class="btn ghost" id="fsJoin" style="justify-content:center;height:44px;border:1px solid #cdd8ea">🔄 Konten von einem anderen Gerät übernehmen</button>
    </div>
    <p class="hint" style="margin-top:14px">Gmail, Outlook oder GMX? Vorher kurz in die <a href="#" id="fsHelp" style="color:var(--blue-text)">Hilfe zur Einrichtung</a> schauen – dort steht, was der jeweilige Anbieter braucht.</p>`);
  $("#fsHelp").onclick = ev => { ev.preventDefault(); openSettings("hilfe"); };
  $("#fsNew").onclick = () => accountForm();
  $("#fsJoin").onclick = () => syncJoin();
}

function fmtAgo(ts) {
  if (!ts) return "noch nie";
  const m = Math.round((Date.now() / 1000 - ts) / 60);
  return m < 1 ? "gerade eben" : m === 1 ? "vor 1 Minute" : m < 60 ? `vor ${m} Minuten` : fmtDate(new Date(ts * 1000).toISOString());
}

async function openSync() {
  let st; try { st = await api("/api/sync/status"); } catch (e) { return toast(e.message, true); }
  if (st.enabled) {
    modal(`<h2>Synchronisation</h2>
      <div class="code-box" style="text-align:left">✔ <b>Aktiv</b> über <b>${esc(st.email)}</b><br>
        <span style="color:#666">Letzter Abgleich: ${esc(fmtAgo(st.last))}</span>
        ${st.error ? `<div class="msg-err">${esc(st.error)}</div>` : ""}</div>
      <p style="color:#555;font-size:13.5px">Neue, geänderte und gelöschte Konten werden automatisch alle paar Minuten mit Ihren anderen Geräten abgeglichen.
      Auf einem neuen Gerät wählen Sie „Konten von einem anderen Gerät übernehmen“ und geben <b>${esc(st.email)}</b>, dessen Passwort und Ihr Sync-Passwort ein.</p>
      <div class="row-btns"><button class="btn ghost danger" id="syOff">Ausschalten</button><span class="grow"></span><button class="btn ghost" id="syBack">Zurück</button><button class="btn primary" id="syNow">Jetzt abgleichen</button></div>`);
    $("#syBack").onclick = () => openSettings("abgleich");
    $("#syOff").onclick = async () => { if (!confirm("Abgleich auf diesem Gerät ausschalten? Ihre Konten bleiben erhalten.")) return; await api("/api/sync/off", { body: {} }); toast("Abgleich ausgeschaltet"); openSettings("abgleich"); };
    $("#syNow").onclick = async () => {
      $("#syNow").disabled = true; $("#syNow").textContent = "Wird abgeglichen …";
      try { const r = await api("/api/sync/now", { body: {} }); if (r.error) toast(r.error, true); else toast("Abgeglichen"); await loadAccounts(); await refreshAll(false); openSync(); }
      catch (e) { toast(e.message, true); openSync(); }
    };
    return;
  }
  const pwAccs = S.accounts.filter(a => a.auth !== "oauth_ms");
  modal(`<h2>Synchronisation einrichten</h2>
    <p style="color:#444;margin-top:0;font-size:14px">Balu-Mail speichert Ihre Konteneinstellungen <b>verschlüsselt</b> in einem Ihrer Postfächer (eigener Ordner „Balu-Mail-Sync“).
    Alle Ihre Geräte gleichen sich darüber automatisch ab – ohne zusätzlichen Server.</p>
    ${pwAccs.length ? `<div class="form">
      <label>Tresor-Konto</label><select id="syAcc">${pwAccs.map(a => `<option value="${a.id}">${esc(a.email)}</option>`).join("")}</select>
      <label>Sync-Passwort</label><input id="syPw" type="password" placeholder="mind. 8 Zeichen – gut merken!">
      <label>Wiederholen</label><input id="syPw2" type="password">
      <div class="hint">Das Sync-Passwort verschlüsselt Ihre Zugangsdaten. Es wird nirgends im Klartext gespeichert und kann nicht wiederhergestellt werden.</div>
    </div>` : `<p class="msg-err">Bitte zuerst ein Konto mit Passwort-Anmeldung (z. B. GMX, WEB.DE, Gmail) hinzufügen.</p>`}
    <div id="syMsg"></div>
    <div class="row-btns"><button class="btn ghost" id="syJoin">Von anderem Gerät übernehmen</button><span class="grow"></span><button class="btn ghost" id="syBack">Zurück</button>${pwAccs.length ? `<button class="btn primary" id="syGo">Einrichten</button>` : ""}</div>`);
  $("#syBack").onclick = () => openSettings("abgleich");
  $("#syJoin").onclick = () => syncJoin();
  const go = $("#syGo");
  if (go) go.onclick = async () => {
    const pw = $("#syPw").value, msg = t => $("#syMsg").innerHTML = `<div class="msg-err">${esc(t)}</div>`;
    if (pw.length < 8) return msg("Das Sync-Passwort muss mindestens 8 Zeichen haben.");
    if (pw !== $("#syPw2").value) return msg("Die Passwörter stimmen nicht überein.");
    go.disabled = true; go.textContent = "Wird eingerichtet …";
    try {
      const r = await api("/api/sync/setup", { body: { acc: $("#syAcc").value, password: pw } });
      if (r.error) { msg(r.error); go.disabled = false; go.textContent = "Einrichten"; return; }
      toast("Synchronisation ist eingerichtet"); await loadAccounts(); await refreshAll(false); openSync();
    } catch (e) { msg(e.message); go.disabled = false; go.textContent = "Einrichten"; }
  };
}

function syncJoin() {
  modal(`<h2>Konten von einem anderen Gerät übernehmen</h2>
    <p style="color:#444;margin-top:0;font-size:14px">Geben Sie das <b>Tresor-Konto</b> ein, das Sie am anderen Gerät für die Synchronisation gewählt haben, und Ihr Sync-Passwort. Alle anderen Konten werden automatisch übernommen.</p>
    <div class="form">
      <label>E-Mail-Adresse</label><input id="sjEmail" type="email" placeholder="tresor@gmx.de" autocomplete="username">
      <label>Passwort des Postfachs</label><input id="sjPw" type="password" autocomplete="current-password">
      <label>Sync-Passwort</label><input id="sjSync" type="password">
    </div>
    <div id="sjMsg"></div>
    <div class="row-btns"><button class="btn ghost" id="sjBack">Zurück</button><button class="btn primary" id="sjGo">Übernehmen</button></div>`);
  $("#sjBack").onclick = () => S.accounts.length ? openSync() : firstStart();
  $("#sjGo").onclick = async () => {
    const b = $("#sjGo"), msg = (t, ok) => $("#sjMsg").innerHTML = `<div class="${ok ? "msg-ok" : "msg-err"}">${esc(t)}</div>`;
    const d = { email: $("#sjEmail").value.trim(), password: $("#sjPw").value, sync_password: $("#sjSync").value };
    if (!d.email.includes("@") || !d.password || !d.sync_password) return msg("Bitte alle Felder ausfüllen.");
    b.disabled = true; b.textContent = "Wird übernommen …"; msg("Verbinde mit dem Postfach und entschlüssele die Daten …", true);
    try {
      const r = await api("/api/sync/join", { body: d });
      if (r.error) throw new Error(r.error);
      await loadAccounts(); closeModal();
      toast(`${S.accounts.length} ${S.accounts.length === 1 ? "Konto" : "Konten"} übernommen`);
      await refreshAll(true);
    } catch (e) { msg(e.message); b.disabled = false; b.textContent = "Übernehmen"; }
  };
}

function msHelp() {
  modal(`<h2>Microsoft-App-ID einrichten (einmalig)</h2>
    <p style="margin-top:0;color:#444">Microsoft erlaubt bei Outlook-, Hotmail- und Live-Adressen keine Anmeldung mit normalem Passwort mehr. Deshalb braucht Balu-Mail eine eigene, kostenlose „App-Registrierung“:</p>
    <ol style="line-height:1.7;padding-left:20px;margin:0">
      <li>Nur nötig, wenn Sie noch kein eigenes Verzeichnis haben (private Outlook-/Hotmail-/Live-Konten haben keins mehr): einmalig ein <a href="https://azure.microsoft.com/de-de/pricing/purchase-options/azure-account" target="_blank" style="color:var(--blue-text)">kostenloses Azure-Konto</a> anlegen. Microsoft verlangt dabei Telefon und Kreditkarte nur zur Überprüfung.</li>
      <li><a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade" target="_blank" style="color:var(--blue-text)">Microsoft Entra öffnen</a> und mit Ihrem Microsoft-Konto anmelden.</li>
      <li>Name: <b>Balu-Mail</b>. Unter „Unterstützte Kontotypen“: <b>Konten in allen Organisationsverzeichnissen und persönliche Microsoft-Konten</b> wählen. → <b>Registrieren</b>.</li>
      <li>Links auf <b>Authentifizierung</b> → ganz unten <b>„Öffentliche Clientflows zulassen“</b> auf <b>Ja</b> → Speichern.</li>
      <li>Links auf <b>Übersicht</b> → die <b>Anwendungs-ID (Client)</b> kopieren und in Balu-Mail einfügen.</li>
    </ol>
    <p style="color:#444">Diese eine App-ID gilt für alle Ihre Microsoft-Adressen. Danach beim Konto „Anmeldung: Microsoft-Anmeldung“ wählen.</p>
    <div class="row-btns"><button class="btn ghost" id="msBack">Zurück</button><button class="btn primary" data-close>Verstanden</button></div>`);
  $("#msBack").onclick = () => openSettings("zugang");
}

// ---------------------------------------------------------------- Programm-Symbol
const LOGO_NAMES = { balu: "Balu lugt", leuchten: "Leuchten", siegel: "Siegel", stempel: "Poststempel", origami: "Origami-Bär" };
function curLogo() { return LOGO_NAMES[window.BM_LOGO] ? window.BM_LOGO : "balu"; }
function logoSrc(id) { return `/icons/logos/${id || curLogo()}.svg`; }
window.logoSrc = logoSrc;
function applyLogo(id) {
  if (!LOGO_NAMES[id] || id === window.BM_LOGO) return;
  window.BM_LOGO = id;
  document.querySelectorAll(".brand img").forEach(img => img.src = logoSrc(id));
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(l => {
    l.href = `/icons/logos/${id}-${l.sizes && l.sizes.value === "32x32" ? 32 : 192}.png`;
  });
}
function logoSettingsHtml(st) {
  const cur = st.logo || "balu";
  return `<div class="settings-sec"><h3>Programm-Symbol</h3>
    <div class="logo-pick" role="radiogroup" aria-label="Programm-Symbol">${(st.logos || Object.keys(LOGO_NAMES)).map(id =>
      `<button type="button" role="radio" aria-checked="${id === cur}" data-logo="${id}" title="${LOGO_NAMES[id] || id}">
        <img src="${logoSrc(id)}" alt=""><span>${LOGO_NAMES[id] || id}</span></button>`).join("")}</div>
    <div class="hint">Gilt für Fenster, Taskleiste, Verknüpfungen und die Handy-App – auf allen abgeglichenen Geräten.</div></div>`;
}
function bindLogoSettings() {
  document.querySelectorAll(".logo-pick [data-logo]").forEach(b => b.onclick = () => {
    document.querySelectorAll(".logo-pick [data-logo]").forEach(x => x.setAttribute("aria-checked", x === b));
  });
}
function pickedLogo() { const b = document.querySelector('.logo-pick [aria-checked="true"]'); return b ? b.dataset.logo : null; }

// ---------------------------------------------------------------- Nur ein Fenster
// Jedes Fenster meldet sich alle 3 Sekunden. Das zuletzt geöffnete bleibt offen,
// ältere schließen sich selbst (außer man schreibt gerade darin eine E-Mail).
const WIN = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)), gone: false };
async function windowWatch() {
  if (document.documentElement.classList.contains("android") || WIN.gone) return;
  try {
    const r = await fetch("/api/fenster?id=" + encodeURIComponent(WIN.id) + (window.chrome && chrome.webview ? "&host=1" : ""), { headers: { "X-Token": window.BM_TOKEN }, cache: "no-store" });
    if (r.status === 401) {
      // Balu-Mail wurde neu gestartet (z. B. nach einem Update): Seite einmal neu laden
      const last = +(sessionStorage.getItem("bm_reload") || 0);
      if (Date.now() - last > 30000) { sessionStorage.setItem("bm_reload", Date.now()); return location.reload(); }
    } else if (r.ok) {
      const j = await r.json();
      if (j.close && !C) return closeThisWindow();
    }
  } catch {}
  setTimeout(windowWatch, 3000);
}
function closeThisWindow() {
  WIN.gone = true;
  window.close();
  // Falls der Browser das Schließen nicht erlaubt: deutlicher Hinweis statt Doppel-Fenster
  setTimeout(() => {
    document.body.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px;height:100vh;align-items:center;justify-content:center;font:16px Roboto,Segoe UI,sans-serif;color:#333;text-align:center;padding:20px">
      <b style="font-size:18px">Balu-Mail ist in einem anderen Fenster geöffnet.</b>
      <span>Dieses Fenster wird nicht mehr gebraucht.</span>
      <button onclick="window.close()" style="height:38px;padding:0 20px;border-radius:20px;border:0;background:#1a6fe6;color:#fff;font:inherit;cursor:pointer">Fenster schließen</button></div>`;
  }, 400);
}

// ---------------------------------------------------------------- Updates
const U = { st: null, later: "" };
async function updatePoll() {
  try { U.st = await api("/api/update"); } catch { return; }
  renderUpdateBar();
  return U.st;
}
function renderUpdateBar() {
  const st = U.st, bar = $("#updBar");
  const ready = st && st.state === "ready";
  // Automatisch einspielen – nur nicht mitten im Schreiben oder in einem offenen Dialog
  if (ready && st.auto && !U.applying && !C && $("#modal").hidden) { bar.hidden = true; return installUpdate(true); }
  const show = ready && !U.applying && U.later !== st.latest;
  bar.hidden = !show;
  if (!show) return;
  bar.innerHTML = `${ic("refresh")}<span class="upd-txt"><b>Neue Version ${esc(st.latest)}</b> ist bereit (installiert: ${esc(st.version)}).${st.auto ? " Sie wird eingespielt, sobald Sie nicht mehr schreiben." : ""}</span>
    <button class="btn primary" id="updNow">Jetzt aktualisieren</button><button class="btn ghost" id="updLater">Später</button>`;
  $("#updNow").onclick = () => installUpdate(false);
  $("#updLater").onclick = () => { U.later = st.latest; renderUpdateBar(); };
}
async function installUpdate(auto) {
  if (U.applying) return;
  if (C && C.dirty) await saveDraft(true);
  U.applying = true;
  const old = U.st ? U.st.version : "";
  try { await api("/api/update/install", { body: {} }); }
  catch (e) { U.applying = false; return toast(e.message, true); }
  toast(`Balu-Mail wird auf Version ${U.st ? U.st.latest : ""} aktualisiert …`);
  // Die neue Version startet im selben Programm neu – danach Seite neu laden
  const t0 = Date.now();
  const reload = () => {
    if (document.documentElement.classList.contains("android"))
      location.href = "/?neu=" + Date.now() + "#t=" + encodeURIComponent(window.BM_TOKEN) + "&a=1";
    else location.reload();
  };
  const tick = async () => {
    try {
      const r = await fetch("/api/info", { headers: { "X-Token": window.BM_TOKEN }, cache: "no-store" });
      if (r.status === 401) return reload();
      if (r.ok) { const j = await r.json(); if (j.version && j.version !== old) return reload(); }
    } catch {}
    if (Date.now() - t0 > 60000) return reload();
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1200);
}
function updateSettingsHtml(st) {
  if (!st) return "";
  if (st.play) return `<div class="settings-sec" id="updSec"><h3>Updates</h3><div class="form">
      <label>Installierte Version</label><div>${esc(st.version)}</div></div>
      <div class="hint">Updates kommen über den Google Play Store. Der spielt sie von selbst ein, oft aber erst nach Stunden (meist im WLAN beim Laden).</div>
      <div class="row-btns" style="justify-content:flex-start;margin-top:8px"><a class="btn primary" href="market://details?id=de.balumail.app" style="text-decoration:none;display:inline-flex;align-items:center">Jetzt im Play Store nach Updates suchen</a></div></div>`;
  const when = st.checked ? fmtDate(st.checked, true) : "noch nie";
  const msg = st.state === "error" ? `<div class="msg-err">${esc(st.error)}</div>`
    : st.state === "ready" ? `<div class="msg-ok">Version ${esc(st.latest)} ist geladen und wird gleich eingespielt.</div>`
    : st.state === "downloading" ? `<div class="msg-ok">Version ${esc(st.latest)} wird geladen … ${st.progress} %</div>`
    : st.state === "checking" ? `<div class="msg-ok">Suche nach Updates …</div>`
    : st.state === "current" ? `<div class="msg-ok">Balu-Mail ist auf dem neuesten Stand.</div>`
    : st.state === "available" ? `<div class="msg-ok">Version ${esc(st.latest)} ist verfügbar.</div>` : "";
  return `<div class="settings-sec" id="updSec"><h3>Updates</h3>
    <div class="form">
      <label>Installierte Version</label><div>${esc(st.version)} <span style="color:#777">· zuletzt geprüft: ${esc(when)}</span></div>
      <label>Automatisch</label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="uAuto" ${st.auto ? "checked" : ""} style="width:auto;height:auto"> Updates automatisch laden und einspielen (ohne Nachfrage)</label>
    </div>
    <div id="uMsg">${msg}</div>
    ${st.msi_needed ? `<div class="msg-ok" style="margin-top:8px">Neues Programmfenster (eigenes Symbol in der Taskleiste, läuft nach „X“ im Hintergrund weiter) braucht einmalig die Installation.
      <button class="btn primary" id="uMsi" style="margin-top:6px">Jetzt installieren</button><div class="hint">Windows fragt einmal nach „Ja“. Balu-Mail schließt sich kurz und startet danach von selbst neu.</div></div>` : ""}
    ${st.broken ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:#c5221f">Startfehler: Version ${esc(st.broken.version)} startete nicht (${esc(fmtDate(new Date(st.broken.time * 1000).toISOString(), true))})</summary><pre style="white-space:pre-wrap;font-size:11px;background:#f6f6f6;padding:8px;border-radius:6px;max-height:220px;overflow:auto">${esc(st.broken.error)}</pre></details>` : ""}
    <div class="row-btns" style="justify-content:flex-start;margin-top:10px"><button class="btn ghost" id="uCheck" ${st.configured ? "" : "disabled"}>Jetzt prüfen</button>
      ${st.state === "ready" ? `<button class="btn primary" id="uInstall">Jetzt aktualisieren</button>` : ""}</div></div>`;
}
function bindUpdateSettings() {
  const chk = $("#uCheck"); if (!chk) return;
  chk.onclick = async () => {
    try {
      await api("/api/update/check", { body: {} });
      for (let i = 0; i < 240; i++) {
        const st = await updatePoll();
        if (!st || !["checking", "downloading"].includes(st.state)) break;
        const m = $("#uMsg"); if (!m) return;
        m.innerHTML = `<div class="msg-ok">${st.state === "checking" ? "Suche nach Updates …" : `Version ${esc(st.latest)} wird geladen … ${st.progress} %`}</div>`;
        await new Promise(r => setTimeout(r, 1000));
      }
      // Gefunden und geladen: gleich einspielen, ohne weiteren Klick
      if (U.st && U.st.state === "ready" && U.st.auto) { closeModal(); return installUpdate(true); }
      if ($("#updSec")) { $("#updSec").outerHTML = updateSettingsHtml(U.st); bindUpdateSettings(); }
    } catch (e) { toast(e.message, true); }
  };
  const ins = $("#uInstall"); if (ins) ins.onclick = () => { closeModal(); installUpdate(false); };
  const msi = $("#uMsi"); if (msi) msi.onclick = async () => {
    msi.disabled = true; msi.textContent = "Wird geladen …";
    try { await api("/api/update/msi", { body: {} }); document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font:16px Roboto,Segoe UI,sans-serif;color:#444;text-align:center;padding:20px">Balu-Mail wird installiert …<br>Bitte bei der Windows-Abfrage auf „Ja“ klicken.<br>Danach startet Balu-Mail von selbst neu.</div>'; }
    catch (e) { msi.disabled = false; msi.textContent = "Jetzt installieren"; toast(e.message, true); }
  };
}

// ---------------------------------------------------------------- Dialog & Menü
function modal(html) { $("#modalBox").classList.remove("wide"); $("#modalBox").innerHTML = html; $("#modal").hidden = false; hydrateIcons($("#modalBox")); $$("[data-close]", $("#modalBox")).forEach(b => b.onclick = closeModal); }
function closeModal() { $("#modal").hidden = true; }
let openMenuEl = null;
function showMenu(anchor, items) {
  hideMenus();
  const m = document.createElement("div"); m.className = "menu";
  m.innerHTML = items.map((it, i) => it ? `<button data-i="${i}">${esc(it[0])}</button>` : "<hr>").join("");
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + "px"; m.style.left = Math.max(8, Math.min(r.left, innerWidth - 240)) + "px";
  $$("button", m).forEach(b => b.onclick = () => { hideMenus(); items[+b.dataset.i][1](); });
  openMenuEl = m;
}
function showMenuAt(x, y, items) {
  const a = { getBoundingClientRect: () => ({ left: x, bottom: y - 4 }) };
  showMenu(a, items);
  const m = openMenuEl, h = m.getBoundingClientRect().height;
  if (y + h > innerHeight - 8) m.style.top = Math.max(8, innerHeight - h - 8) + "px";
}

// ---------------------------------------------------------------- Ordnerverwaltung (Rechtsklick)
function folderMenu(e) {
  const it = e.target.closest("#nav [data-folder], #nav .nav-acc");
  if (!it) return;
  e.preventDefault();
  const accId = it.dataset.acc || (it.dataset.tog || "").replace(/^acc_/, "");
  const fs = S.folders[accId] || [];
  const f = it.dataset.folder ? fs.find(x => x.path === it.dataset.folder) : null;
  const dl = (fs.find(x => x.delim) || {}).delim || "/";
  const trash = fs.find(x => x.special === "trash");
  const inTrash = !!(f && trash && f.path.startsWith(trash.path + dl));
  const leaf = f ? f.path.split(dl).pop() : "";
  const items = [];
  if (!f) items.push(["Neuer Ordner …", () => folderAsk(accId, "create", "", "Neuer Ordner", "")]);
  else if (f.special === "trash") {
    items.push(["Neuer Unterordner …", () => folderAsk(accId, "create", f.path, "Neuer Unterordner in „Papierkorb“", "")]);
    items.push(null, ["Alle Mails im Papierkorb endgültig löschen …", () => folderConfirm(accId, "empty", f, `Alle <b>${f.total}</b> Mails im Papierkorb werden <b>endgültig</b> gelöscht. Die Unterordner im Papierkorb bleiben erhalten.`, "Endgültig löschen")]);
  } else if (inTrash) {
    const kids = fs.filter(x => x.path.startsWith(f.path + dl));
    const n = f.total + kids.reduce((a, k) => a + (k.total || 0), 0);
    items.push(["Endgültig löschen …", () => folderConfirm(accId, "delete", f, `Der Ordner <b>„${esc(leaf)}“</b>${kids.length ? ` mit ${kids.length} Unterordner${kids.length > 1 ? "n" : ""}` : ""} und <b>${n}</b> Mail${n === 1 ? "" : "s"} wird <b>endgültig</b> gelöscht. Das lässt sich nicht rückgängig machen.`, "Endgültig löschen")]);
    if (f.total) items.push(["Nur die Mails darin endgültig löschen …", () => folderConfirm(accId, "empty", f, `Alle <b>${f.total}</b> Mails in „${esc(leaf)}“ werden endgültig gelöscht. Der Ordner bleibt.`, "Endgültig löschen")]);
    items.push(null, ["Wiederherstellen (verschieben) …", () => folderMove(accId, f)]);
  } else {
    items.push(["Neuer Unterordner …", () => folderAsk(accId, "create", f.path, `Neuer Unterordner in „${folderLabel(f)}“`, "")]);
    if (!f.special) {
      items.push(["Umbenennen …", () => folderAsk(accId, "rename", f.path, "Ordner umbenennen", leaf)]);
      items.push(["Verschieben …", () => folderMove(accId, f)]);
      if (trash) items.push(null, ["Löschen (in den Papierkorb)", () => folderDo({ acc: accId, action: "delete", path: f.path }, `„${leaf}“ liegt jetzt im Papierkorb`)]);
      else items.push(null, ["Endgültig löschen …", () => folderConfirm(accId, "delete", f, `Der Ordner „${esc(leaf)}“ wird samt Inhalt <b>endgültig</b> gelöscht (dieses Konto hat keinen Papierkorb).`, "Endgültig löschen")]);
    }
  }
  showMenuAt(e.clientX, e.clientY, items);
}
async function folderDo(body, okMsg) {
  try {
    const r = await api("/api/folder", { body });
    toast(okMsg || "Erledigt");
    await loadFolders(); renderNav();
    const v = S.view, dl = ((S.folders[body.acc] || []).find(x => x.delim) || {}).delim || "/";
    const hit = v.type === "folder" && v.acc === body.acc && body.path && (v.folder === body.path || v.folder.startsWith(body.path + dl));
    if (hit && body.action === "empty") loadList();
    else if (hit && r.path) setView({ type: "folder", acc: v.acc, folder: r.path + v.folder.slice(body.path.length) });
    else if (hit) setView({ type: "inbox", acc: null, folder: "INBOX" });
    return true;
  } catch (e) { toast(e.message, true); return false; }
}
function followView(acc, oldPath, newPath) {
  const v = S.view, dl = ((S.folders[acc] || []).find(x => x.delim) || {}).delim || "/";
  if (v.type === "folder" && v.acc === acc && (v.folder === oldPath || v.folder.startsWith(oldPath + dl)) && newPath)
    setView({ type: "folder", acc, folder: newPath + v.folder.slice(oldPath.length) });
}
function folderAsk(acc, action, path, title, value) {
  modal(`<h2>${esc(title)}</h2><div class="form"><label for="fName">Name</label><input id="fName" autocomplete="off" value="${esc(value)}"></div>
    <div id="fErr"></div><div class="row-btns"><button class="btn ghost" data-close>Abbrechen</button><button class="btn primary" id="fOk">${action === "create" ? "Anlegen" : "Umbenennen"}</button></div>`);
  const inp = $("#fName"); inp.focus(); inp.select();
  const go = async () => {
    const name = inp.value.trim(); if (!name) return;
    try { const r = await api("/api/folder", { body: { acc, action, path, name } }); closeModal(); toast(action === "create" ? `Ordner „${name}“ angelegt` : `Umbenannt in „${name}“`);
      if (action === "create" && path) { S.collapsed["f_" + acc + "_" + path] = false; localStorageSet("bm_collapsed", JSON.stringify(S.collapsed)); }
      await loadFolders(); renderNav(); if (action === "rename") followView(acc, path, r.path); }
    catch (e) { $("#fErr").innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
  };
  $("#fOk").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
}
function folderConfirm(acc, action, f, text, btn) {
  modal(`<h2>Wirklich endgültig löschen?</h2><p style="line-height:1.5">${text}</p>
    <div class="row-btns"><button class="btn ghost" data-close>Abbrechen</button><button class="btn primary" id="fOk" style="background:#c5221f">${esc(btn)}</button></div>`);
  $("#fOk").onclick = async () => { $("#fOk").disabled = true; $("#fOk").textContent = "Wird gelöscht …";
    if (await folderDo({ acc, action, path: f.path, final: true }, action === "empty" ? "Mails endgültig gelöscht" : "Ordner endgültig gelöscht")) closeModal(); else { $("#fOk").disabled = false; $("#fOk").textContent = btn; } };
}
function folderMove(acc, f) {
  const fs = S.folders[acc] || [];
  const dl = (fs.find(x => x.delim) || {}).delim || "/";
  const label = x => { const d = x.path.split(dl).length - 1; return "\u00a0\u00a0".repeat(d) + (x.special ? folderLabel(x) : x.path.split(dl).pop()); };
  const list = fs.filter(x => x.path !== f.path && !x.path.startsWith(f.path + dl) && x.special !== "inbox")
    .sort((a, b) => a.path.localeCompare(b.path, "de"));
  modal(`<h2>„${esc(f.path.split(dl).pop())}“ verschieben</h2><div class="form"><label for="fTgt">Nach</label>
    <select id="fTgt"><option value="">(oberste Ebene)</option>${list.map(x => `<option value="${esc(x.path)}">${esc(label(x))}</option>`).join("")}</select></div>
    <div id="fErr"></div><div class="row-btns"><button class="btn ghost" data-close>Abbrechen</button><button class="btn primary" id="fOk">Verschieben</button></div>`);
  $("#fOk").onclick = async () => {
    try { const r = await api("/api/folder", { body: { acc, action: "move", path: f.path, target: $("#fTgt").value } }); closeModal(); toast("Ordner verschoben");
      await loadFolders(); renderNav(); followView(acc, f.path, r.path); }
    catch (e) { $("#fErr").innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
  };
}
function hideMenus() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } $("#selMenu").hidden = true; $("#searchOpts").hidden = true; }

// ---------------------------------------------------------------- Ereignisse
function bindUI() {
  $("#btnCompose").onclick = () => compose("new");
  $("#btnSettings").onclick = () => openAccounts();
  $("#btnOpenEml").onclick = () => pickEml();
  $("#btnFun").onclick = () => window.Fun && Fun.toggle();
  if (S.info.server) {
    $("#btnQuit").hidden = true; $("#btnLogout").hidden = false;
    $("#btnApk").hidden = false;
    $("#btnApk").onclick = async () => {
      toast("Handy-App wird vorbereitet …");
      try { await api("/api/app.apk?check=1"); }
      catch (e) { return toast(e.message || "Handy-App nicht verfügbar", true); }
      location.href = "/api/app.apk?t=" + encodeURIComponent(window.BM_TOKEN);
      toast("Download läuft – danach die Datei öffnen und installieren.");
    };
    $("#btnLogout").onclick = async () => {
      try { await fetch("/logout", { method: "POST", headers: { "X-Token": window.BM_TOKEN } }); } catch {}
      location.replace("/");
    };
  }
  $("#btnQuit").onclick = async () => { if (!confirm("Balu-Mail beenden?")) return;
    if (window.chrome && chrome.webview) { chrome.webview.postMessage("quit"); return; }   // Programmfenster beendet alles
    try { await api("/api/quit", { body: {} }); } catch {} document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font:16px Roboto,Segoe UI,sans-serif;color:#444">Balu-Mail wurde beendet. Sie können dieses Fenster schließen.</div>'; setTimeout(() => window.close(), 400); };
  $("#btnMenu").onclick = () => appEl().classList.toggle(isMobile() ? "nav-open" : "nav-collapsed");
  $("#navShade").onclick = () => appEl().classList.remove("nav-open");
  $("#fab").onclick = () => (window.Kal && Kal.active) ? $("#kNew").click() : compose("new");
  $("#btnListRefresh").onclick = () => refreshAll(false);
  bindTouch();
  $("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };

  $("#nav").addEventListener("click", e => {
    const ref = e.target.closest("[data-refresh]");
    if (ref) { e.stopPropagation(); refreshAll(false); return; }
    const tog = e.target.closest("[data-tog]");
    if (tog) {
      const k = tog.dataset.tog;
      S.collapsed[k] = k.startsWith("f_") ? (S.collapsed[k] === false ? true : false) : !S.collapsed[k];
      localStorageSet("bm_collapsed", JSON.stringify(S.collapsed)); renderNav(); return;
    }
    const it = e.target.closest("[data-nav]");
    if (!it || it.dataset.noselect) return;
    const t = it.dataset.nav;
    appEl().classList.remove("nav-open", "reading");
    if (t === "calendar") { closeCompose(); S.view = { type: "calendar", acc: null, folder: "" }; renderNav(); return Kal.open(); }
    setView(t === "folder" ? { type: "folder", acc: it.dataset.acc, folder: it.dataset.folder } : { type: t, acc: null, folder: "INBOX" });
  });

  // Ziehen & Ablegen auf Ordner
  $("#list").addEventListener("dragstart", e => {
    const r = e.target.closest(".row"); if (!r) return;
    if (!S.sel.has(r.dataset.k)) { S.sel = new Set([r.dataset.k]); }
    e.dataTransfer.setData("text/plain", "pz"); e.dataTransfer.effectAllowed = "move";
  });
  const isAccDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes("text/balu-acc");
  let accDragId = null;
  const clearAccMarks = () => $$(".acc-drop-before,.acc-drop-after", $("#nav")).forEach(x => x.classList.remove("acc-drop-before", "acc-drop-after"));
  $("#nav").addEventListener("contextmenu", folderMenu);
  $("#nav").addEventListener("dragstart", e => {
    const t = e.target.closest && e.target.closest("[data-accdrag]"); if (!t) return;
    accDragId = t.dataset.accdrag;
    e.dataTransfer.setData("text/balu-acc", accDragId); e.dataTransfer.effectAllowed = "move";
  });
  $("#nav").addEventListener("dragend", () => { accDragId = null; clearAccMarks(); });
  $("#nav").addEventListener("dragover", e => {
    if (!isAccDrag(e)) return;
    const t = e.target.closest("[data-accdrag]"); clearAccMarks(); if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.dataTransfer.dropEffect = "move";
    const b = t.getBoundingClientRect(); t.classList.add(e.clientY < b.top + b.height / 2 ? "acc-drop-before" : "acc-drop-after");
  });
  $("#nav").addEventListener("drop", e => {
    if (!isAccDrag(e)) return;
    e.preventDefault(); e.stopImmediatePropagation(); clearAccMarks();
    const t = e.target.closest("[data-accdrag]"); const id = accDragId || e.dataTransfer.getData("text/balu-acc"); accDragId = null;
    if (!t || !id || t.dataset.accdrag === id) return;
    const o = S.accounts.map(a => a.id).filter(x => x !== id);
    const b = t.getBoundingClientRect(); let i = o.indexOf(t.dataset.accdrag); if (e.clientY >= b.top + b.height / 2) i++;
    o.splice(i, 0, id); saveAccOrder(o, false);
  });
  $("#nav").addEventListener("dragover", e => { const t = e.target.closest("[data-drop]"); if (t) { e.preventDefault(); $$(".nav-item.drop").forEach(x => x.classList.remove("drop")); t.classList.add("drop"); } });
  $("#nav").addEventListener("dragleave", e => { if (isAccDrag(e)) return; const t = e.target.closest("[data-drop]"); if (t) t.classList.remove("drop"); });
  $("#nav").addEventListener("drop", e => {
    const t = e.target.closest("[data-drop]"); if (!t) return; e.preventDefault(); t.classList.remove("drop");
    const msgs = selectedMsgs().filter(m => m.acc === t.dataset.acc);
    if (!msgs.length) return toast("E-Mails können nur innerhalb desselben Kontos verschoben werden.", true);
    doMove(msgs, t.dataset.folder);
  });

  let lastClick = null;
  $("#list").addEventListener("click", e => {
    if (e.target.closest("[data-more]")) return loadMore();
    const row = e.target.closest(".row"); if (!row) return;
    const k = row.dataset.k, m = S.msgs.find(x => key(x) === k);
    const h = e.target.closest("[data-h]");
    if (h) {
      e.stopPropagation();
      if (h.dataset.h === "delete") doDelete([m]);
      else if (h.dataset.h === "read") doRead([m], !m.seen);
      else if (h.dataset.h === "star") doFlag([m], !m.flagged);
      return;
    }
    if (e.target.closest("[data-check]") || e.ctrlKey || e.metaKey || (isMobile() && S.sel.size)) {
      S.checkMode = true;
      if (S.cur && !S.sel.size && S.cur !== k) S.sel.add(S.cur);
      S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k);
      lastClick = k; renderList(); if (!S.cur || S.sel.size !== 1) renderEmpty(); return;
    }
    if (e.shiftKey && lastClick) {
      const ks = S.msgs.map(key), a = ks.indexOf(lastClick), b = ks.indexOf(k);
      S.checkMode = true;
      ks.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => S.sel.add(x)); renderList(); renderEmpty(); return;
    }
    S.sel.clear(); lastClick = k; openMsg(k);
  });
  $("#list").addEventListener("dblclick", e => { const row = e.target.closest(".row"); if (row) document.getElementById("app").classList.add("fullread"); });

  $("#chkAll").onchange = e => { S.checkMode = true; S.sel = e.target.checked ? new Set(S.msgs.map(key)) : new Set(); renderList(); renderEmpty(); };
  $("#btnSelMenu").onclick = e => { e.stopPropagation(); const m = $("#selMenu"); const r = e.currentTarget.getBoundingClientRect(); m.style.top = r.bottom + 4 + "px"; m.style.left = r.left + "px"; m.hidden = !m.hidden; };
  $$("#selMenu button").forEach(b => b.onclick = () => {
    const s = b.dataset.sel; $("#selMenu").hidden = true; S.checkMode = true;
    if (s === "all") S.sel = new Set(S.msgs.map(key));
    else if (s === "none") S.sel.clear();
    else if (s === "unread") S.sel = new Set(S.msgs.filter(m => !m.seen).map(key));
    else if (s === "read") S.sel = new Set(S.msgs.filter(m => m.seen).map(key));
    else if (s === "markread") return doRead(selectedMsgs(), true);
    else if (s === "markunread") return doRead(selectedMsgs(), false);
    else if (s === "flag") return doFlag(selectedMsgs(), true);
    else if (s === "unflag") return doFlag(selectedMsgs(), false);
    renderList(); renderEmpty();
  });

  $("#actionbar").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const a = b.dataset.act, msgs = selectedMsgs();
    if (a === "delete") doDelete(msgs);
    else if (a === "spam") doSpam(msgs);
    else if (a === "move") moveDialog(msgs);
    else if (["reply", "replyall", "forward"].includes(a)) {
      if (S.curMsg && msgs.length === 1 && key(msgs[0]) === S.cur) compose(a);
      else if (msgs.length === 1) api("/api/message?" + qs({ acc: msgs[0].acc, folder: msgs[0].folder, uid: msgs[0].uid })).then(d => compose(a, withToken(d))).catch(err => toast(err.message, true));
    }
    else if (a === "back") window.bmBack();
    else if (a === "prev" || a === "next") step(a === "next" ? 1 : -1);
    else if (a === "close") { S.sel.clear(); S.cur = null; S.curMsg = null; closeCompose(); appEl().classList.remove("fullread", "reading"); renderList(); renderEmpty(); }
  });

  let st;
  $("#search").addEventListener("input", e => { clearTimeout(st); st = setTimeout(() => { S.q = e.target.value.trim(); S.sel.clear(); S.cur = null; loadList(); renderEmpty(); }, 400); });
  $("#btnSearchOpts").onclick = e => { e.stopPropagation(); $("#searchOpts").hidden = !$("#searchOpts").hidden; };
  $("#searchOpts").onclick = e => e.stopPropagation();
  $$('#searchOpts input').forEach(r => r.onchange = () => { S.scope = r.value; if (S.q) loadList(); });
  document.addEventListener("click", e => { if (!e.target.closest(".menu") && !e.target.closest("#btnSelMenu") && !e.target.closest("#rdMore")) hideMenus(); });

  $("#filePick").onchange = async e => {
    for (const f of e.target.files) {
      if (f.size > 25 * 1048576) { toast(`${f.name} ist größer als 25 MB`, true); continue; }
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(f); });
      C.attachments.push({ name: f.name, size: f.size, ctype: f.type, data }); C.dirty = true;
    }
    e.target.value = ""; renderAtts();
  };

  // App in den Hintergrund / Fenster schließen: angefangene Mail sichern
  document.addEventListener("visibilitychange", () => { if (document.hidden && C && C.dirty) saveDraft(true); });
  window.addEventListener("pagehide", () => {
    if (!C || !C.dirty) return;
    const data = composeData(); data.draft_id = C.draftId;
    const body = JSON.stringify(data);
    if (body.length < 60000) fetch("/api/draft", { method: "POST", keepalive: true, headers: { "X-Token": window.BM_TOKEN, "Content-Type": "application/json" }, body }).catch(() => {});
  });
  document.addEventListener("keydown", e => {
    const typing = e.target.closest("input,textarea,select,[contenteditable]");
    if (e.key === "Escape") { hideMenus(); closeModal(); document.getElementById("app").classList.remove("fullread"); return; }
    if (typing || !$("#modal").hidden) return;
    if (e.key === "Delete") { const m = selectedMsgs(); if (m.length) { e.preventDefault(); doDelete(m); } }
    else if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); step(-1); }
    else if (e.key === "r" && S.curMsg) compose(e.shiftKey ? "replyall" : "reply");
    else if (e.key === "f" && S.curMsg) compose("forward");
    else if (e.key === "n") { e.preventDefault(); compose("new"); }
    else if (e.key === "u" && selectedMsgs().length) doRead(selectedMsgs(), false);
    else if (e.key === "s" && selectedMsgs().length) doFlag(selectedMsgs(), !selectedMsgs()[0].flagged);
  });
  $("#list").addEventListener("scroll", e => { const l = e.target; if (l.scrollTop + l.clientHeight > l.scrollHeight - 200 && hasMore() && !S.loading) { S.loading = true; loadMore().finally(() => S.loading = false); } });
}
function step(d) {
  if (!S.msgs.length) return;
  let i = S.msgs.findIndex(m => key(m) === S.cur);
  i = i < 0 ? 0 : Math.max(0, Math.min(S.msgs.length - 1, i + d));
  S.sel.clear(); openMsg(key(S.msgs[i]));
  const r = $(`.row[data-k="${CSS.escape(key(S.msgs[i]))}"]`); r && r.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------- Handy: Zurück-Taste, Wischen, langes Drücken
window.bmBack = function () {
  const app = appEl();
  if (openMenuEl || !$("#selMenu").hidden || !$("#searchOpts").hidden) { hideMenus(); return true; }
  if (!$("#modal").hidden) { closeModal(); return true; }
  if (app.classList.contains("nav-open")) { app.classList.remove("nav-open"); return true; }
  if (window.Kal && Kal.active) { setView({ type: "inbox", acc: null, folder: "INBOX" }); return true; }
  if (C) { closeCompose(); S.curMsg ? renderMsg(S.curMsg) : renderEmpty(); return true; }
  if (app.classList.contains("fullread")) { app.classList.remove("fullread"); return true; }
  if (app.classList.contains("reading")) { app.classList.remove("reading"); S.cur = null; S.curMsg = null; renderList(); renderEmpty(); return true; }
  if (S.sel.size) { S.sel.clear(); renderList(); return true; }
  if (S.q) { S.q = ""; $("#search").value = ""; loadList(); return true; }
  if (!(S.view.type === "inbox" && !S.view.acc)) { setView({ type: "inbox", acc: null, folder: "INBOX" }); return true; }
  return false;
};

function bindTouch() {
  const list = $("#list");
  let sx = 0, sy = 0, row = null, dx = 0, lp = null, moved = false, lpAt = 0;
  list.addEventListener("touchstart", e => {
    row = e.target.closest(".row"); if (!row) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; moved = false;
    clearTimeout(lp);
    lp = setTimeout(() => { // langes Drücken = auswählen
      if (moved || !row) return;
      const k = row.dataset.k; S.checkMode = true;
      S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k);
      if (navigator.vibrate) navigator.vibrate(15);
      lpAt = Date.now(); renderList();
    }, 500);
  }, { passive: true });
  list.addEventListener("touchmove", e => {
    if (!row) return;
    const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) { moved = true; clearTimeout(lp); }
    if (Math.abs(y) > Math.abs(x) && !dx) return;
    if (Math.abs(x) > 12) {
      dx = x;
      row.style.transform = `translateX(${x}px)`;
      row.classList.toggle("sw-del", x < -60); row.classList.toggle("sw-read", x > 60);
    }
  }, { passive: true });
  list.addEventListener("touchend", () => {
    clearTimeout(lp);
    if (!row) return;
    const r = row, k = r.dataset.k, m = S.msgs.find(x => key(x) === k);
    r.style.transition = "transform .18s"; 
    if (dx < -110 && m) { r.style.transform = "translateX(-110%)"; setTimeout(() => doDelete([m]), 160); }
    else { r.style.transform = ""; if (dx > 110 && m) doRead([m], !m.seen); }
    setTimeout(() => { r.style.transition = ""; r.classList.remove("sw-del", "sw-read"); }, 200);
    row = null;
  });
  // Klick nach langem Drücken ignorieren
  // (die Zeile wird beim Auswählen neu gezeichnet – deshalb über die Zeit erkennen, nicht über das Element)
  list.addEventListener("click", e => { if (e.target.closest(".row") && Date.now() - lpAt < 800) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

window.openAccounts = openAccounts;
init();
