"use strict";
/* Balu-Mail – Spaß-Modus: bewegtes Briefpapier, Sticker, Animationen und Töne.
   Wird vor app.js geladen; greift erst zur Laufzeit auf dessen Funktionen zu. */
window.Fun = (function () {
  const cfg = { on: false, anim: true, sound: true, theme: "ballons", incoming: "auto" };

  // ------------------------------------------------------------ Briefpapiere
  const THEMES = {
    ballons: { label: "Luftballons",   bg: "#FFF4E8", bgc: "#FFF4E8", text: "#3A2414", swatch: "#FFB27A", deco: "balloons" },
    sterne:  { label: "Sternenhimmel", bg: "linear-gradient(170deg,#1F2457 0%,#3B2C7E 100%)", bgc: "#2A2868", text: "#FFFFFF", swatch: "#2B2A6B", deco: "stars" },
    wiese:   { label: "Sommerwiese",   bg: "linear-gradient(180deg,#E3F5FF 0%,#E3F5FF 80%,#BDE7A8 80%,#A6DB8E 100%)", bgc: "#E3F5FF", text: "#1E3A1E", swatch: "#8FD07A", deco: "meadow" },
    herzen:  { label: "Herzen",        bg: "#FFF0F4", bgc: "#FFF0F4", text: "#4A1426", swatch: "#FF8FB0", deco: "hearts" },
    winter:  { label: "Winterzauber",  bg: "linear-gradient(180deg,#D6E7FF 0%,#F2F7FF 100%)", bgc: "#E6F0FF", text: "#12304F", swatch: "#A9C8F0", deco: "snow" },
    schlicht:{ label: "Ohne",          bg: "#FFFFFF", bgc: "#FFFFFF", text: "", swatch: "#FFFFFF", deco: null },
  };
  const AUTO = ["ballons", "sterne", "wiese", "herzen", "winter"];

  // ------------------------------------------------------------ Grafiken
  const SVG = {
    star: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z"/></svg>',
    balloon: '<svg viewBox="0 0 40 60"><ellipse cx="20" cy="18" rx="15" ry="18" fill="currentColor"/><ellipse cx="14" cy="11" rx="4" ry="6" fill="#FFFFFF" opacity=".35"/><path d="M20 36l-3 4h6z" fill="currentColor"/><path d="M20 40q-5 9 0 19" stroke="#8A6A50" fill="none" stroke-width="1.2"/></svg>',
    flower: '<svg viewBox="0 0 30 44"><path d="M15 20V44" stroke="#3F8A2E" stroke-width="2.5" fill="none"/><path d="M15 34q-8-2-9-8 7 0 9 6" fill="#5BAA43"/><circle cx="15" cy="7" r="5.5" fill="currentColor"/><circle cx="7.5" cy="12.5" r="5.5" fill="currentColor"/><circle cx="22.5" cy="12.5" r="5.5" fill="currentColor"/><circle cx="10.5" cy="20" r="5.5" fill="currentColor"/><circle cx="19.5" cy="20" r="5.5" fill="currentColor"/><circle cx="15" cy="14" r="4.5" fill="#FFD54A"/></svg>',
    bubble: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="7" r="2" fill="currentColor" opacity=".6"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-7.6-4.6-10-9.4C.4 8.3 2.4 4.5 6.1 4.5c2.3 0 3.4 1.2 5.9 3.6 2.5-2.4 3.6-3.6 5.9-3.6 3.7 0 5.7 3.8 4.1 7.1C19.6 16.4 12 21 12 21z"/></svg>',
    flake: '<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/></g></svg>',
  };
  // Sticker zum Einfügen (feste Farben, damit sie auch in anderen Programmen stimmen)
  const STICKERS = {
    herz:    ["Herz",      '<svg viewBox="0 0 24 24" width="64" height="64"><path fill="#FF5A7A" d="M12 21s-7.6-4.6-10-9.4C.4 8.3 2.4 4.5 6.1 4.5c2.3 0 3.4 1.2 5.9 3.6 2.5-2.4 3.6-3.6 5.9-3.6 3.7 0 5.7 3.8 4.1 7.1C19.6 16.4 12 21 12 21z"/><ellipse cx="7.5" cy="9" rx="1.8" ry="1.2" fill="#FFFFFF" opacity=".55"/></svg>'],
    sonne:   ["Sonne",     '<svg viewBox="0 0 24 24" width="64" height="64"><g stroke="#FFB020" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g><circle cx="12" cy="12" r="5.5" fill="#FFD54A"/><path d="M9.5 13.2q2.5 2 5 0" stroke="#7A4A00" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="10" cy="11" r=".8" fill="#7A4A00"/><circle cx="14" cy="11" r=".8" fill="#7A4A00"/></svg>'],
    lachen:  ["Smiley",    '<svg viewBox="0 0 24 24" width="64" height="64"><circle cx="12" cy="12" r="10" fill="#FFD54A"/><circle cx="8.5" cy="10" r="1.4" fill="#5A3A00"/><circle cx="15.5" cy="10" r="1.4" fill="#5A3A00"/><path d="M7.5 14q4.5 4.5 9 0" stroke="#5A3A00" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'],
    stern:   ["Stern",     '<svg viewBox="0 0 24 24" width="64" height="64"><path fill="#FFC531" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z"/></svg>'],
    mond:    ["Mond",      '<svg viewBox="0 0 24 24" width="64" height="64"><path fill="#F2C94C" d="M15.5 3.5A9 9 0 1 0 20.5 17 7.5 7.5 0 0 1 15.5 3.5z"/><circle cx="10" cy="11" r="1.2" fill="#D9A92A"/><circle cx="13" cy="16" r="1.6" fill="#D9A92A"/></svg>'],
    ballon:  ["Luftballon",'<svg viewBox="0 0 40 60" width="64" height="64"><ellipse cx="20" cy="18" rx="15" ry="18" fill="#FF6B6B"/><ellipse cx="14" cy="11" rx="4" ry="6" fill="#FFFFFF" opacity=".35"/><path d="M20 36l-3 4h6z" fill="#FF6B6B"/><path d="M20 40q-5 9 0 19" stroke="#8A6A50" fill="none" stroke-width="1.2"/></svg>'],
    blume:   ["Blume",     '<svg viewBox="0 0 30 44" width="64" height="64"><path d="M15 20V44" stroke="#3F8A2E" stroke-width="2.5" fill="none"/><circle cx="15" cy="7" r="5.5" fill="#FF7AA8"/><circle cx="7.5" cy="12.5" r="5.5" fill="#FF7AA8"/><circle cx="22.5" cy="12.5" r="5.5" fill="#FF7AA8"/><circle cx="10.5" cy="20" r="5.5" fill="#FF7AA8"/><circle cx="19.5" cy="20" r="5.5" fill="#FF7AA8"/><circle cx="15" cy="14" r="4.5" fill="#FFD54A"/></svg>'],
    geschenk:["Geschenk",  '<svg viewBox="0 0 24 24" width="64" height="64"><rect x="3" y="10" width="18" height="11" rx="2" fill="#FF6B6B"/><rect x="2" y="7" width="20" height="4.5" rx="1.5" fill="#FF8A8A"/><rect x="10.5" y="7" width="3" height="14" fill="#FFD54A"/><path d="M12 7c-2-4-6.5-4-6.5-1.5S10 7 12 7zm0 0c2-4 6.5-4 6.5-1.5S14 7 12 7z" fill="#FFD54A"/></svg>'],
  };
  const LOGO = '<svg viewBox="0 0 44 36" aria-hidden="true"><path d="M6 16 Q-2 8 4 4 Q10 6 12 14Z" fill="#FFD54A"/><path d="M38 16 Q46 8 40 4 Q34 6 32 14Z" fill="#FFD54A"/><rect x="8" y="12" width="28" height="20" rx="4" fill="#FFFFFF" stroke="#6A45F0" stroke-width="1.5"/><path d="M8 14 L22 24 L36 14" fill="none" stroke="#6A45F0" stroke-width="2.5" stroke-linejoin="round"/><circle cx="36" cy="12" r="5" fill="#FF8A3D"/></svg>';

  // ------------------------------------------------------------ Hintergrund-Deko
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const item = (cls, style, svg) => `<span class="${cls}" style="${style}">${svg}</span>`;
  function decoItems(kind) {
    let h = "";
    if (kind === "stars") {
      for (let i = 0; i < 20; i++) {
        const s = 8 + Math.round(rnd(i, 1) * 14);
        h += item("bm-tw", `left:${(rnd(i, 2) * 96).toFixed(1)}%;top:${(rnd(i, 3) * 94).toFixed(1)}%;width:${s}px;height:${s}px;color:#FFE27A;animation-delay:${(rnd(i, 4) * 2.6).toFixed(2)}s`, SVG.star);
      }
    } else if (kind === "balloons") {
      const cols = ["#FF6B6B", "#FFB020", "#6A45F0", "#2BB5A0", "#FF5A9E", "#3D8BFF", "#FF8A3D"];
      cols.forEach((c, i) => {
        h += item("bm-ri", `left:${4 + i * 13.5}%;top:100%;--rest:${12 + (i % 3) * 26}%;width:44px;height:66px;color:${c};animation-delay:-${(rnd(i, 5) * 14).toFixed(1)}s`, SVG.balloon);
      });
    } else if (kind === "meadow") {
      const cols = ["#FF7AA8", "#FFFFFF", "#B58CFF", "#FF9F43"];
      for (let i = 0; i < 11; i++) {
        h += item("bm-fl", `left:${(i * 9.4 + rnd(i, 6) * 3).toFixed(1)}%;bottom:4px;width:30px;height:44px;color:${cols[i % 4]};animation-delay:${(i * 0.37).toFixed(2)}s`, SVG.flower);
      }
      for (let i = 0; i < 6; i++) {
        const s = 14 + Math.round(rnd(i, 7) * 14);
        h += item("bm-fl", `left:${(8 + rnd(i, 8) * 84).toFixed(1)}%;top:${(8 + rnd(i, 9) * 50).toFixed(1)}%;width:${s}px;height:${s}px;color:#7FB8E0;animation-delay:${(rnd(i, 10) * 3).toFixed(2)}s`, SVG.bubble);
      }
    } else if (kind === "hearts") {
      const cols = ["#FF5A7A", "#FF8FB0", "#E83E6C", "#FFB3C7"];
      for (let i = 0; i < 12; i++) {
        const s = 16 + Math.round(rnd(i, 11) * 22);
        h += item("bm-ri", `left:${(rnd(i, 12) * 94).toFixed(1)}%;top:100%;--rest:${(6 + rnd(i, 13) * 80).toFixed(1)}%;width:${s}px;height:${s}px;color:${cols[i % 4]};animation-duration:${(10 + rnd(i, 14) * 8).toFixed(1)}s;animation-delay:-${(rnd(i, 15) * 16).toFixed(1)}s`, SVG.heart);
      }
    } else if (kind === "snow") {
      for (let i = 0; i < 28; i++) {
        const s = 10 + Math.round(rnd(i, 16) * 14);
        h += item("bm-fa", `left:${(rnd(i, 17) * 97).toFixed(1)}%;top:-6%;--rest:${(rnd(i, 18) * 92).toFixed(1)}%;width:${s}px;height:${s}px;color:#8DB3E8;animation-duration:${(9 + rnd(i, 19) * 9).toFixed(1)}s;animation-delay:-${(rnd(i, 20) * 18).toFixed(1)}s`, SVG.flake);
      }
    }
    return h;
  }
  function decoLayer(themeKey) {
    const t = THEMES[themeKey];
    if (!t || !t.deco) return "";
    return `<div class="bm-deco" aria-hidden="true" style="background:${t.bg}">${decoItems(t.deco)}</div>`;
  }
  const DECO_CSS = `
@keyframes bmTw{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes bmRise{from{transform:translateY(0)}to{transform:translateY(calc(-1 * var(--bm-h,130vh)))}}
@keyframes bmFall{from{transform:translate(0,0)}to{transform:translate(30px,var(--bm-h,130vh))}}
@keyframes bmFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-10px) rotate(5deg)}}
.bm-deco{pointer-events:none;overflow:hidden;z-index:0}
.bm-deco>span{position:absolute;display:block}
.bm-deco svg{width:100%;height:100%;display:block}
.bm-tw{animation:bmTw 2.6s ease-in-out infinite}
.bm-ri{animation:bmRise 14s linear infinite}
.bm-fa{animation:bmFall 12s linear infinite}
.bm-fl{animation:bmFloat 4s ease-in-out infinite}
.bm-st{display:inline-block;vertical-align:middle}
.bm-still .bm-deco>span,.bm-still .bm-st svg{animation:none!important}
.bm-still .bm-ri,.bm-still .bm-fa{top:var(--rest)!important}
@media (prefers-reduced-motion:reduce){.bm-deco>span,.bm-st svg{animation:none!important}.bm-ri,.bm-fa{top:var(--rest)!important}}`;

  // ------------------------------------------------------------ Einstellungen
  async function load() {
    try { const s = await api("/api/settings"); Object.assign(cfg, s.fun || {}); } catch {}
    if (!THEMES[cfg.theme]) cfg.theme = "ballons";
    apply();
  }
  function save() { api("/api/settings", { body: { fun: { ...cfg } } }).catch(e => toast(e.message, true)); }
  function set(patch) { Object.assign(cfg, patch); apply(); }

  function apply() {
    const root = document.documentElement;
    if (!document.getElementById("funDecoCss")) {
      const st = document.createElement("style"); st.id = "funDecoCss"; st.textContent = DECO_CSS; document.head.appendChild(st);
    }
    root.classList.toggle("fun", cfg.on);
    root.classList.toggle("fun-still", !cfg.anim);
    let sky = document.getElementById("funSky");
    if (cfg.on && !sky) {
      sky = document.createElement("div");
      sky.id = "funSky"; sky.setAttribute("aria-hidden", "true");
      sky.innerHTML = [[60, 170, -10], [170, 240, -45], [420, 200, -25], [640, 280, -60], [820, 180, -5]]
        .map(([top, w, d]) => `<span class="fun-cloud" style="top:${top}px;width:${w}px;height:${Math.round(w * .3)}px;animation-delay:${d}s"></span>`).join("");
      document.body.prepend(sky);
    }
    const b = document.getElementById("btnFun");
    if (b) b.setAttribute("aria-pressed", cfg.on ? "true" : "false");
    const logo = document.querySelector(".brand img");
    if (logo) logo.src = window.logoSrc ? window.logoSrc() : "/icons/logo.svg";   // gewähltes Programm-Symbol, auch im Spaß-Modus
  }
  function toggle() {
    set({ on: !cfg.on }); save();
    toast(cfg.on ? "Spaß-Modus an – viel Vergnügen!" : "Spaß-Modus aus");
    // Ansicht neu zeichnen, damit Briefpapier sofort erscheint bzw. verschwindet
    if (typeof C !== "undefined" && C) { /* Entwurf nicht anfassen */ }
    else if (S.curMsg) renderMsg(S.curMsg, lastRemote);
    else renderEmpty();
  }

  // ------------------------------------------------------------ Lesen
  const override = {};       // Briefpapier je E-Mail (nur für diese Sitzung)
  let lastRemote = false;
  const msgKey = d => d.acc + "|" + d.folder + "|" + d.uid;
  const marker = d => { const m = /data-balu-briefpapier="([a-z]+)"/.exec(d.html || ""); return m && THEMES[m[1]] ? m[1] : null; };
  function themeFor(d) {
    if (!cfg.on) return null;
    const o = override[msgKey(d)];
    if (o) return o === "schlicht" ? null : o;
    const mk = marker(d);
    if (mk) return mk === "schlicht" ? null : mk;
    if (cfg.incoming === "keins") return null;
    if (THEMES[cfg.incoming] && cfg.incoming !== "schlicht") return cfg.incoming;
    const s = ((d.from || {}).email || "").toLowerCase();
    let hsh = 0; for (const ch of s) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    return AUTO[hsh % AUTO.length];
  }
  // Ergänzungen für das iframe der gelesenen E-Mail
  function frame(d) {
    const k = themeFor(d);
    if (!k) return { css: "", cls: "", pre: "", post: "" };
    const t = THEMES[k], letter = !!marker(d);
    return {
      css: DECO_CSS + `
html,body{min-height:100%}
body.bm-fun{margin:0;padding:22px 20px 60px;position:relative;color:${t.text}}
body.bm-fun .bm-deco{position:fixed;inset:0}
.bm-paper{position:relative;z-index:1;background:rgba(255,255,255,.93);color:#1f1f1f;border-radius:18px;padding:16px 18px;box-shadow:0 6px 24px rgba(0,0,0,.12)}
.bm-letter{position:relative;z-index:1;font-size:16px;line-height:1.6}
.bm-letter a{color:inherit}
.bm-letter blockquote{color:inherit;opacity:.85}
[data-balu-briefpapier]{background:transparent!important;color:inherit!important;padding:0!important}`,
      cls: "bm-fun" + (cfg.anim ? "" : " bm-still"),
      pre: decoLayer(k) + `<div class="${letter ? "bm-letter" : "bm-paper"}">`,
      post: "</div>",
    };
  }
  function themeBar(d) {
    if (!cfg.on) return "";
    const cur = themeFor(d) || "schlicht";
    return `<div class="fun-themebar" role="group" aria-label="Briefpapier"><span class="l">Briefpapier:</span>${Object.keys(THEMES).map(k =>
      `<button class="fun-chip" data-fun-theme="${k}" aria-pressed="${k === cur}"><i style="background:${THEMES[k].swatch}"></i>${THEMES[k].label}</button>`).join("")}</div>`;
  }
  function afterRender(d, allowRemote) {
    lastRemote = !!allowRemote;
    $$("[data-fun-theme]").forEach(b => b.onclick = () => { override[msgKey(d)] = b.dataset.funTheme; renderMsg(d, allowRemote); });
  }
  function emptyArt() {
    return `<div class="fun-empty">${LOGO}</div>`;
  }

  // ------------------------------------------------------------ Schreiben
  function onCompose() {
    if (!cfg.on || !C) return;
    const ed = $("#cpEditor"); if (!ed || ed.closest(".fun-stage")) return;
    C.funTheme = cfg.theme;
    const stage = document.createElement("div");
    stage.className = "fun-stage";
    ed.parentNode.insertBefore(stage, ed);
    stage.appendChild(ed);
    paintStage();
    const tools = $(".cp-tools"), grow = $(".cp-tools .grow");
    const mk = (id, label, svg) => { const b = document.createElement("button"); b.id = id; b.className = "fun-tool"; b.type = "button"; b.innerHTML = svg + `<span>${label}</span>`; tools.insertBefore(b, grow); return b; };
    mk("funPaper", "Briefpapier", '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 13l2.5 3 2-2.5L16 18H8z"/></svg>').onclick = e => { e.stopPropagation(); paperMenu(e.currentTarget); };
    mk("funSticker", "Sticker", '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-3.5 6.5A1.5 1.5 0 1 1 7 10a1.5 1.5 0 0 1 1.5-1.5zm7 0A1.5 1.5 0 1 1 14 10a1.5 1.5 0 0 1 1.5-1.5zM12 18a5.5 5.5 0 0 1-5-3.2h10A5.5 5.5 0 0 1 12 18z"/></svg>').onclick = e => { e.stopPropagation(); stickerMenu(e.currentTarget); };
  }
  function paintStage() {
    const stage = $(".fun-stage"); if (!stage) return;
    const t = THEMES[C.funTheme] || THEMES.schlicht;
    stage.classList.toggle("bm-still", !cfg.anim);
    const old = $(".bm-deco", stage); if (old) old.remove();
    stage.insertAdjacentHTML("afterbegin", decoLayer(C.funTheme));
    stage.style.background = C.funTheme === "schlicht" ? "" : t.bgc;
    $("#cpEditor").style.color = t.text || "";
  }
  function popover(anchor, html) {
    hideMenus();
    const m = document.createElement("div");
    m.className = "menu fun-pop"; m.innerHTML = html;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + "px";
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + "px";
    openMenuEl = m;
    return m;
  }
  function paperMenu(anchor) {
    const m = popover(anchor, `<h4>Briefpapier wählen</h4><div class="fun-grid">${Object.keys(THEMES).map(k =>
      `<button class="fun-th ${k === C.funTheme ? "on" : ""}" data-k="${k}" aria-pressed="${k === C.funTheme}"><span class="sw" style="background:${THEMES[k].bg}"></span>${THEMES[k].label}</button>`).join("")}</div>`);
    $$("[data-k]", m).forEach(b => b.onclick = () => { C.funTheme = b.dataset.k; paintStage(); hideMenus(); $("#cpEditor").focus(); });
  }
  function stickerMenu(anchor) {
    const m = popover(anchor, `<h4>Sticker einfügen</h4><div class="fun-grid st">${Object.keys(STICKERS).map(k =>
      `<button class="fun-stbtn" data-s="${k}" title="${STICKERS[k][0]}" aria-label="${STICKERS[k][0]} einfügen">${STICKERS[k][1]}</button>`).join("")}</div>`);
    $$("[data-s]", m).forEach(b => {
      b.onmousedown = e => e.preventDefault();          // Schreibmarke im Text behalten
      b.onclick = () => {
        const ed = $("#cpEditor"); ed.focus();
        const sel = getSelection();
        if (!sel.rangeCount || !ed.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
        document.execCommand("insertHTML", false, `<span class="bm-st" contenteditable="false" style="display:inline-block;width:64px;height:64px;vertical-align:middle">${STICKERS[b.dataset.s][1]}</span>&nbsp;`);
        beep("pop");
      };
    });
  }
  // Briefpapier in die gesendete E-Mail übernehmen (andere Programme zeigen die Hintergrundfarbe)
  function wrapHtml(html) {
    if (!cfg.on || !C || !C.funTheme || C.funTheme === "schlicht") return html;
    const t = THEMES[C.funTheme];
    const img = t.bg.startsWith("linear-gradient") ? `background-image:${t.bg};` : "";
    return `<div data-balu-briefpapier="${C.funTheme}" style="background-color:${t.bgc};${img}color:${t.text};padding:28px 26px;border-radius:18px;font-size:16px;line-height:1.6">${html}</div>`;
  }
  function sent() {
    if (!cfg.on) return;
    beep("send");
    if (!cfg.anim || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const f = document.createElement("div");
    f.className = "fun-fly"; f.innerHTML = LOGO;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1600);
  }

  // ------------------------------------------------------------ Neue Post
  let noteT;
  function checkNew(before, after) {
    if (!cfg.on || after <= before) return;
    const n = after - before;
    const m = S.msgs.find(x => !x.seen);
    const who = m ? (m.from.name || m.from.email) : "";
    let el = document.getElementById("funNote");
    if (!el) { el = document.createElement("div"); el.id = "funNote"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<span class="fun-bell" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-4.5-5.8V4.5a1.5 1.5 0 0 0-3 0v.7A6 6 0 0 0 6 11v5l-2 2v1h16v-1z"/></svg></span>
      <button class="fun-note-main" type="button"><b>Neue Post!</b><span>${n === 1 && who ? "Von " + esc(who) : n + " neue E-Mails"}</span></button>
      <button class="fun-note-x" type="button" aria-label="Hinweis schließen"><svg viewBox="0 0 24 24"><path d="${P.close}"/></svg></button>`;
    el.hidden = false;
    $(".fun-note-main", el).onclick = () => { el.hidden = true; if (m && n === 1) openMsg(key(m)); };
    $(".fun-note-x", el).onclick = () => el.hidden = true;
    clearTimeout(noteT); noteT = setTimeout(() => el.hidden = true, 8000);
    beep("ding");
  }

  // ------------------------------------------------------------ Töne (ohne Sounddateien)
  let ac;
  function beep(kind) {
    if (!cfg.on || !cfg.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const now = ac.currentTime;
      const tone = (f1, f2, start, dur, type = "sine", vol = .18) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f1, now + start);
        if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + start + dur);
        g.gain.setValueAtTime(0.0001, now + start);
        g.gain.exponentialRampToValueAtTime(vol, now + start + .02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        o.connect(g).connect(ac.destination); o.start(now + start); o.stop(now + start + dur + .05);
      };
      if (kind === "ding") { tone(880, 0, 0, .35); tone(1320, 0, .16, .5); }
      else if (kind === "send") { tone(320, 1400, 0, .38, "triangle", .14); }
      else if (kind === "pop") { tone(600, 1100, 0, .09, "sine", .12); }
    } catch {}
  }

  // ------------------------------------------------------------ Einstellungsdialog
  function settingsHtml() {
    const opt = (v, l, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`;
    const th = Object.keys(THEMES).map(k => opt(k, k === "schlicht" ? "Ohne Briefpapier" : THEMES[k].label, cfg.theme)).join("");
    const inc = opt("auto", "Automatisch (je Absender)", cfg.incoming) + AUTO.map(k => opt(k, "Immer " + THEMES[k].label, cfg.incoming)).join("") + opt("keins", "Keins", cfg.incoming);
    return `<div class="settings-sec"><h3>Spaß-Modus</h3>
      <div class="fun-checks">
        <label><input type="checkbox" id="sFunOn" ${cfg.on ? "checked" : ""}> Spaß-Modus einschalten</label>
        <label><input type="checkbox" id="sFunAnim" ${cfg.anim ? "checked" : ""}> Bewegte Animationen</label>
        <label><input type="checkbox" id="sFunSound" ${cfg.sound ? "checked" : ""}> Töne bei neuer Post und beim Senden</label>
      </div>
      <div class="form" style="margin-top:10px"><label>Briefpapier für neue E-Mails</label><select id="sFunTheme">${th}</select>
        <label>Briefpapier beim Lesen</label><select id="sFunIn">${inc}</select></div></div>`;
  }
  function readSettings() {
    return { on: $("#sFunOn").checked, anim: $("#sFunAnim").checked, sound: $("#sFunSound").checked, theme: $("#sFunTheme").value, incoming: $("#sFunIn").value };
  }

  return { cfg, THEMES, load, set, toggle, frame, themeBar, afterRender, emptyArt, onCompose, wrapHtml, sent, checkNew, settingsHtml, readSettings, get on() { return cfg.on; } };
})();
