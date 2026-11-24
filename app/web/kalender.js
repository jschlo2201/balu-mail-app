"use strict";
/* Balu-Mail – Kalender (Tag / Arbeitswoche / Woche / Monat / Liste), Erinnerungen, Einladungen */
window.Kal = (function () {
  const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const WDL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const WDS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const RR_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const HOUR = 48;                                     // Pixel pro Stunde
  const K = {
    view: localStorageGet("bm_kal_view") || (matchMedia("(max-width: 760px)").matches ? "list" : "week"),
    date: new Date(), sources: [], events: [], rangeKey: "", active: false, showSide: false,
  };

  // ------------------------------------------------------------ Datum-Hilfen
  const p2 = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const ymdhm = d => `${ymd(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const parse = s => { const [a, b] = s.split("T"); const [y, m, d] = a.split("-").map(Number); const [h, mi] = (b || "00:00").split(":").map(Number); return new Date(y, m - 1, d, h || 0, mi || 0); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekStart = d => addDays(day0(d), -((d.getDay() + 6) % 7));
  const sameDay = (a, b) => ymd(a) === ymd(b);
  const hm = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const wdIdx = d => (d.getDay() + 6) % 7;
  function kw(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); }
  const longDate = d => `${WDL[wdIdx(d)]}, ${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`;

  function evStart(e) { return parse(e.start); }
  function evEnd(e) { return parse(e.end); }
  function whenText(e) {
    const s = evStart(e), en = evEnd(e);
    if (e.allday) { const last = addDays(en, -1); return sameDay(s, last) || last < s ? `${longDate(s)} (ganztägig)` : `${s.getDate()}.${s.getMonth() + 1}. – ${longDate(last)} (ganztägig)`; }
    return sameDay(s, en) ? `${longDate(s)}, ${hm(s)} – ${hm(en)} Uhr` : `${longDate(s)}, ${hm(s)} – ${longDate(en)}, ${hm(en)} Uhr`;
  }

  // ------------------------------------------------------------ Bereich & Laden
  function range() {
    const d = K.date;
    if (K.view === "day") return [day0(d), addDays(day0(d), 1)];
    if (K.view === "work") { const s = weekStart(d); return [s, addDays(s, 5)]; }
    if (K.view === "week") { const s = weekStart(d); return [s, addDays(s, 7)]; }
    if (K.view === "month") { const s = weekStart(new Date(d.getFullYear(), d.getMonth(), 1)); return [s, addDays(s, 42)]; }
    return [day0(d), addDays(day0(d), 45)];
  }
  async function loadSources() { try { K.sources = await api("/api/cal/sources"); } catch (e) { toast(e.message, true); } }
  async function loadEvents(force) {
    const [a, b] = range(), key = ymd(a) + ymd(b);
    if (!force && key === K.rangeKey) return;
    try { K.events = await api("/api/cal/events?" + qs({ from: ymdhm(a), to: ymdhm(b) })); K.rangeKey = key; }
    catch (e) { toast(e.message, true); K.events = []; }
  }
  const srcOf = id => K.sources.find(s => s.id === id) || {};

  // ------------------------------------------------------------ Öffnen
  async function open() {
    K.active = true;
    appEl().classList.add("cal-mode");
    $("#calPane").hidden = false;
    await loadSources();
    await loadEvents(true);
    render();
    reminders.refresh();
  }
  function close() {
    K.active = false;
    appEl().classList.remove("cal-mode");
    $("#calPane").hidden = true;
  }
  function go(delta) {
    const d = new Date(K.date);
    if (K.view === "day") d.setDate(d.getDate() + delta);
    else if (K.view === "week" || K.view === "work") d.setDate(d.getDate() + 7 * delta);
    else if (K.view === "month") d.setMonth(d.getMonth() + delta, 1);
    else d.setDate(d.getDate() + 30 * delta);
    K.date = d; refresh();
  }
  async function refresh(force) { await loadEvents(force); render(); }
  function setViewMode(v) { K.view = v; localStorageSet("bm_kal_view", v); refresh(); }

  // ------------------------------------------------------------ Darstellung
  function title() {
    const [a, b] = range();
    if (K.view === "day") return longDate(K.date);
    if (K.view === "month") return `${MON[K.date.getMonth()]} ${K.date.getFullYear()}`;
    if (K.view === "list") return `Ab ${a.getDate()}. ${MON[a.getMonth()]} ${a.getFullYear()}`;
    const last = addDays(b, -1);
    return `${a.getDate()}.${a.getMonth() === last.getMonth() ? "" : " " + MON[a.getMonth()]} – ${last.getDate()}. ${MON[last.getMonth()]} ${last.getFullYear()} · KW ${kw(a)}`;
  }
  function render() {
    if (!K.active) return;
    const views = [["day", "Tag"], ["work", "Arbeitswoche"], ["week", "Woche"], ["month", "Monat"], ["list", "Liste"]];
    $("#calPane").innerHTML = `
      <div class="kal-bar">
        <button class="btn primary" id="kNew">${ic("add", 'style="width:18px;height:18px"')}<span>Neuer Termin</span></button>
        <button class="btn ghost kal-side-btn" id="kSide" title="Kalender ein-/ausblenden">${ic("folder", 'style="width:18px;height:18px"')}<span>Kalender</span></button>
        <button class="btn ghost" id="kToday">Heute</button>
        <button class="icon-btn" id="kPrev" title="Zurück">${ic("up", 'style="transform:rotate(-90deg)"')}</button>
        <button class="icon-btn" id="kNext" title="Weiter">${ic("up", 'style="transform:rotate(90deg)"')}</button>
        <h2 class="kal-title">${esc(title())}</h2>
        <span class="grow"></span>
        <div class="kal-views" role="group" aria-label="Ansicht">${views.map(([v, l]) => `<button data-kv="${v}" aria-pressed="${K.view === v}">${l}</button>`).join("")}</div>
        <button class="icon-btn" id="kSync" title="Kalender abgleichen">${ic("refresh")}</button>
      </div>
      <div class="kal-body">
        <aside class="kal-side ${K.showSide ? "open" : ""}">${sideHtml()}</aside>
        <div class="kal-main" id="kMain">${K.view === "month" ? monthHtml() : K.view === "list" ? listHtml() : gridHtml()}</div>
      </div>`;
    $("#kNew").onclick = () => editor(null, { start: defaultStart() });
    $("#kToday").onclick = () => { K.date = new Date(); refresh(); };
    $("#kPrev").onclick = () => go(-1);
    $("#kNext").onclick = () => go(1);
    $("#kSide").onclick = () => { K.showSide = !K.showSide; $(".kal-side").classList.toggle("open", K.showSide); };
    $("#kSync").onclick = async e => { e.currentTarget.classList.add("spin"); try { await api("/api/cal/sync", { body: {} }); } catch {} setTimeout(async () => { await loadSources(); await refresh(true); }, 2500); };
    $$("[data-kv]").forEach(b => b.onclick = () => setViewMode(b.dataset.kv));
    bindSide();
    if (K.view === "month") bindMonth(); else if (K.view === "list") bindList(); else bindGrid();
  }
  function defaultStart() {
    const d = new Date(K.view === "month" || K.view === "list" ? K.date : K.date);
    const now = new Date();
    if (sameDay(d, now)) { d.setHours(now.getHours() + 1, 0, 0, 0); } else d.setHours(9, 0, 0, 0);
    return d;
  }

  // ---- Seitenleiste: Mini-Monat + Kalenderliste
  function sideHtml() {
    const m = new Date(K.date.getFullYear(), K.date.getMonth(), 1), s = weekStart(m), today = new Date();
    let mini = `<div class="kal-mini"><div class="kal-mini-head"><button data-mm="-1" aria-label="Voriger Monat">‹</button><b>${MON[m.getMonth()]} ${m.getFullYear()}</b><button data-mm="1" aria-label="Nächster Monat">›</button></div><div class="kal-mini-grid">`;
    mini += WDS.map(w => `<span class="h">${w}</span>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = addDays(s, i);
      mini += `<button data-md="${ymd(d)}" class="${d.getMonth() !== m.getMonth() ? "o" : ""} ${sameDay(d, today) ? "t" : ""} ${sameDay(d, K.date) ? "s" : ""}">${d.getDate()}</button>`;
    }
    mini += `</div></div>`;
    const groups = [["Meine Kalender", x => x.type === "local"], ["Kalender der Mail-Konten", x => x.type === "caldav"],
      ["Internet-Kalender", x => x.type === "ics"], ["Feiertage", x => x.type === "holiday"]];
    let list = "";
    for (const [label, f] of groups) {
      const items = K.sources.filter(f);
      if (!items.length) continue;
      list += `<div class="kal-grp">${label}</div>` + items.map(s => `
        <div class="kal-src" title="${esc(s.error || s.account || s.url || "")}">
          <label><input type="checkbox" data-ks="${esc(s.id)}" ${s.enabled ? "checked" : ""} style="accent-color:${esc(s.color)}"><span class="kal-dot" style="background:${esc(s.color)}"></span><span class="n">${esc(s.name)}</span></label>
          ${s.error ? `<span class="kal-err" title="${esc(s.error)}">!</span>` : ""}
          <button class="kal-src-more" data-kmore="${esc(s.id)}" aria-label="Optionen für ${esc(s.name)}">${ic("more")}</button>
        </div>`).join("");
    }
    return mini + `<div class="kal-srcs">${list}</div><button class="btn ghost kal-add" id="kAdd">${ic("add", 'style="width:18px;height:18px"')} Kalender hinzufügen</button>`;
  }
  function bindSide() {
    $$("[data-mm]").forEach(b => b.onclick = () => { const d = new Date(K.date); d.setMonth(d.getMonth() + +b.dataset.mm, 1); K.date = d; refresh(); });
    $$("[data-md]").forEach(b => b.onclick = () => { K.date = parse(b.dataset.md); if (K.view === "list") K.view = "day"; refresh(); });
    $$("[data-ks]").forEach(c => c.onchange = async () => {
      try { K.sources = await api("/api/cal/source/save", { body: { id: c.dataset.ks, enabled: c.checked } }); await refresh(true); } catch (e) { toast(e.message, true); }
    });
    $$("[data-kmore]").forEach(b => b.onclick = e => { e.stopPropagation(); sourceMenu(b, srcOf(b.dataset.kmore)); });
    $("#kAdd").onclick = addDialog;
  }
  function sourceMenu(anchor, s) {
    const items = [["Umbenennen", async () => {
      const n = prompt("Neuer Name:", s.name); if (!n) return;
      K.sources = await api("/api/cal/source/save", { body: { id: s.id, name: n } }); render();
    }], ["Farbe ändern", () => pickColor(s)]];
    if (s.type === "ics") items.push(["Adresse ändern", async () => {
      const u = prompt("Kalender-Adresse:", s.url || ""); if (!u) return;
      try { K.sources = await api("/api/cal/source/save", { body: { id: s.id, url: u } }); await refresh(true); } catch (e) { toast(e.message, true); }
    }]);
    if (s.type !== "local") items.push(null, ["Kalender entfernen", async () => {
      if (!confirm(`„${s.name}“ aus Balu-Mail entfernen? (Beim Anbieter bleibt er erhalten.)`)) return;
      K.sources = await api("/api/cal/source/delete", { body: { id: s.id } }); await refresh(true);
    }]);
    showMenu(anchor, items);
  }
  function pickColor(s) {
    const inp = document.createElement("input"); inp.type = "color"; inp.value = s.color || "#1a6fe6";
    inp.style.cssText = "position:fixed;left:-100px;top:0";
    document.body.appendChild(inp);
    inp.onchange = async () => { K.sources = await api("/api/cal/source/save", { body: { id: s.id, color: inp.value } }); inp.remove(); await refresh(true); };
    inp.click();
  }

  // ---- Durchgehende Balken für mehrtägige Termine
  const BAR = 22;
  const dDiff = (a, b) => Math.round((day0(a) - day0(b)) / 86400000);
  const lastDay = e => e.allday ? addDays(parse(e.end), -1) : day0(new Date(+evEnd(e) - 1));
  const isMulti = e => dDiff(lastDay(e), evStart(e)) >= 1;
  const isLong = e => e.allday || +evEnd(e) - +evStart(e) >= 86400000;     // gehört in die Ganztags-Leiste
  function spanBars(start, n, evs) {
    const end = addDays(start, n);
    const items = evs.map(e => {
      const f = day0(evStart(e)), l = lastDay(e);
      const c0 = Math.max(0, dDiff(f, start)), c1 = Math.min(n - 1, dDiff(l, start));
      return c1 < c0 ? null : { e, c0, c1, starts: f >= start, ends: l < end };
    }).filter(Boolean).sort((a, b) => a.c0 - b.c0 || (b.c1 - b.c0) - (a.c1 - a.c0));
    const lanes = [];
    items.forEach(it => { let l = lanes.findIndex(x => x < it.c0); if (l < 0) { l = lanes.length; lanes.push(-1); } lanes[l] = it.c1; it.lane = l; });
    return { items, lanes: lanes.length };
  }
  function barHtml(it, n, top) {
    const e = it.e, span = it.c1 - it.c0 + 1;
    const t = e.allday ? "" : (it.starts ? hm(evStart(e)) + " " : "");
    const tail = !e.allday && it.ends ? ` <small>bis ${hm(evEnd(e))}</small>` : "";
    return `<div class="kal-span ${it.starts ? "s" : ""} ${it.ends ? "e" : ""} ${e.allday ? "ad" : ""}" data-ev="${esc(e.id)}" tabindex="0" role="button"
      title="${esc(e.title + " – " + whenText(e))}" style="--c:${esc(e.color)};left:calc(${it.c0} * 100% / ${n} + 3px);width:calc(${span} * 100% / ${n} - 6px);top:${top + it.lane * BAR}px">
      ${it.starts ? "" : "◂ "}${t}<b>${esc(e.title)}</b>${tail}${it.ends ? "" : " ▸"}</div>`;
  }

  // ---- Tag / Woche: Zeitraster
  function gridDays() {
    const [a, b] = range(); const out = [];
    for (let d = a; d < b; d = addDays(d, 1)) out.push(d);
    return out;
  }
  function layoutDay(evs) {
    evs.sort((x, y) => x._s - y._s || y._e - x._e);
    let cluster = [], end = -1;
    const flush = () => { const cols = []; cluster.forEach(e => { let c = cols.findIndex(t => t <= e._s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = e._e; e._col = c; }); cluster.forEach(e => e._cols = cols.length); cluster = []; };
    evs.forEach(e => { if (e._s >= end && cluster.length) { flush(); end = -1; } cluster.push(e); end = Math.max(end, e._e); });
    flush();
    return evs;
  }
  function gridHtml() {
    const days = gridDays(), today = new Date();
    const band = spanBars(days[0], days.length, K.events.filter(e => isLong(e)));
    const timed = days.map(d => {
      const d1 = addDays(d, 1);
      return layoutDay(K.events.filter(e => !isLong(e) && evStart(e) < d1 && (evEnd(e) > d || +evEnd(e) === +evStart(e) && sameDay(evStart(e), d)))
        .map(e => Object.assign({}, e, { _s: Math.max(0, (evStart(e) - d) / 60000), _e: Math.min(1440, Math.max((evEnd(e) - d) / 60000, (evStart(e) - d) / 60000 + 20)) })));
    });
    let h = `<div class="kal-grid" style="--days:${days.length}">
      <div class="kal-ghead"><div class="kal-gutter"></div>${days.map(d => `<div class="kal-dh ${sameDay(d, today) ? "t" : ""}"><button data-goday="${ymd(d)}"><span>${WDS[wdIdx(d)]}</span> <b>${d.getDate()}</b>${days.length === 1 ? ` ${MON[d.getMonth()]}` : ""}</button></div>`).join("")}</div>
      <div class="kal-gallday"><div class="kal-gutter">ganztägig</div>${days.map(d => `<div class="kal-ad" data-adday="${ymd(d)}" style="min-height:${Math.max(30, band.lanes * BAR + 8)}px"></div>`).join("")}
        <div class="kal-spans">${band.items.map(it => barHtml(it, days.length, 4)).join("")}</div></div>
      <div class="kal-gscroll" id="kScroll"><div class="kal-gbody" style="height:${24 * HOUR}px">
        <div class="kal-gutter">${Array.from({ length: 24 }, (_, i) => `<div class="kal-hl" style="top:${i * HOUR}px">${i ? p2(i) + ":00" : ""}</div>`).join("")}</div>
        ${days.map((d, i) => `<div class="kal-col ${sameDay(d, today) ? "t" : ""} ${wdIdx(d) > 4 ? "we" : ""}" data-col="${ymd(d)}">
          ${sameDay(d, today) ? `<div class="kal-now" style="top:${(today.getHours() * 60 + today.getMinutes()) * HOUR / 60}px"></div>` : ""}
          ${timed[i].map(e => `<div class="kal-ev ${e.readonly ? "ro" : ""}" data-ev="${esc(e.id)}" tabindex="0" role="button"
             style="top:${e._s * HOUR / 60}px;height:${Math.max(18, (e._e - e._s) * HOUR / 60 - 2)}px;left:calc(${e._col} * 100% / ${e._cols});width:calc(100% / ${e._cols} - 4px);--c:${esc(e.color)}">
             <b>${esc(e.title)}</b><span>${dayTime(e, days[i])}${e.location ? " · " + esc(e.location) : ""}</span>${e.recurring ? `<i class="rec" title="Serientermin">↻</i>` : ""}</div>`).join("")}
        </div>`).join("")}
      </div></div></div>`;
    return h;
  }
  // Uhrzeit-Text eines Termins für einen bestimmten Tag (auch bei mehrtägigen Terminen)
  function dayTime(e, d) {
    const s = evStart(e), en = evEnd(e);
    if (!d || sameDay(s, en) || +en === +addDays(day0(s), 1)) return hm(s);
    const first = sameDay(s, d), last = sameDay(en, d) || (+en === +addDays(d, 1));
    if (first) return hm(s) + " →";
    if (last) return "→ " + hm(en);
    return "ganzer Tag";
  }
  function chip(e, extra = "", d) {
    const t = e.allday ? "" : dayTime(e, d) + " ";
    return `<div class="kal-chip ${e.allday ? "ad" : ""}" data-ev="${esc(e.id)}" tabindex="0" role="button" style="--c:${esc(e.color)}" title="${esc(e.title)}">${extra}${t}${esc(e.title)}</div>`;
  }
  function bindGrid() {
    const sc = $("#kScroll");
    sc.scrollTop = K.scroll != null ? K.scroll : 7 * HOUR - 8;
    sc.onscroll = () => K.scroll = sc.scrollTop;
    bindEventClicks();
    $$("[data-goday]").forEach(b => b.onclick = () => { K.date = parse(b.dataset.goday); setViewMode("day"); });
    $$(".kal-col").forEach(col => col.addEventListener("click", e => {
      if (e.target.closest(".kal-ev")) return;
      const r = col.getBoundingClientRect(), min = Math.floor((e.clientY - r.top) / HOUR * 2) * 30;
      const d = parse(col.dataset.col); d.setMinutes(min);
      editor(null, { start: d });
    }));
    $$(".kal-ad").forEach(c => c.addEventListener("click", e => { if (e.target.closest("[data-ev]")) return; editor(null, { start: parse(c.dataset.adday), allday: true }); }));
    // Termine mit der Maus verschieben (keine Serien, nicht schreibgeschützt)
    $$(".kal-ev:not(.ro)").forEach(el => el.addEventListener("pointerdown", ev => {
      const e = K.events.find(x => x.id === el.dataset.ev); if (!e || e.recurring || ev.button !== 0) return;
      const y0 = ev.clientY, x0 = ev.clientX, top0 = parseFloat(el.style.top); let moved = false, target = el.parentElement;
      const mv = m => {
        if (!moved && Math.abs(m.clientY - y0) + Math.abs(m.clientX - x0) < 6) return;
        moved = true; el.classList.add("drag");
        el.style.top = Math.max(0, Math.round((top0 + m.clientY - y0) / (HOUR / 4)) * (HOUR / 4)) + "px";
        const col = document.elementsFromPoint(m.clientX, m.clientY).find(x => x.classList && x.classList.contains("kal-col"));
        if (col && col !== target) { target = col; col.appendChild(el); }
      };
      const up = async () => {
        removeEventListener("pointermove", mv); removeEventListener("pointerup", up);
        if (!moved) return;
        el.dataset.dragged = "1"; setTimeout(() => delete el.dataset.dragged, 50);
        const s = parse(target.dataset.col); s.setMinutes(parseFloat(el.style.top) / HOUR * 60);
        const dur = evEnd(e) - evStart(e), en = new Date(+s + dur);
        await saveMoved(e, ymdhm(s), ymdhm(en));
      };
      addEventListener("pointermove", mv); addEventListener("pointerup", up);
    }));
  }
  async function saveMoved(e, start, end) {
    try {
      await api("/api/cal/event/save", { body: { sid: e.sid, uid: e.uid, title: e.title, location: e.location, desc: e.desc, start, end,
        allday: e.allday, alarm: e.alarm == null ? -1 : e.alarm, attendees: (e.attendees || []).map(a => a.email).join(", "), invite: false } });
      toast("Termin verschoben"); await refresh(true); reminders.refresh();
    } catch (err) { toast(err.message, true); refresh(true); }
  }

  // ---- Monat
  function monthHtml() {
    const [a] = range(), m = K.date.getMonth(), today = new Date();
    let h = `<div class="kal-month"><div class="kal-mhead">${WDS.map(w => `<div>${w}</div>`).join("")}</div><div class="kal-mgrid">`;
    for (let w = 0; w < 6; w++) {
      const ws = addDays(a, w * 7), we = addDays(ws, 7);
      const multi = K.events.filter(e => isMulti(e) && evStart(e) < we && addDays(lastDay(e), 1) > ws);
      const sb = spanBars(ws, 7, multi), ids = new Set(multi.map(e => e.id));
      const room = Math.max(0, 4 - sb.lanes);
      h += `<div class="kal-mweek">`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i), d1 = addDays(d, 1);
        const evs = K.events.filter(e => !ids.has(e.id) && (e.allday ? (parse(e.start) <= d && parse(e.end) > d)
          : (evStart(e) < d1 && (evEnd(e) > d || +evEnd(e) === +evStart(e) && sameDay(evStart(e), d)))));
        const hidden = evs.length - room;
        h += `<div class="kal-mcell ${d.getMonth() !== m ? "o" : ""} ${sameDay(d, today) ? "t" : ""} ${wdIdx(d) > 4 ? "we" : ""}" data-mday="${ymd(d)}">
          <button class="kal-mnum" data-goday="${ymd(d)}">${d.getDate() === 1 ? d.getDate() + ". " + MON[d.getMonth()].slice(0, 3) : d.getDate()}</button>
          <div style="height:${sb.lanes * BAR}px;flex:none"></div>
          ${evs.slice(0, room).map(e => chip(e, "", d)).join("")}${hidden > 0 ? `<button class="kal-more" data-goday="${ymd(d)}">+${hidden} weitere</button>` : ""}</div>`;
      }
      h += `<div class="kal-spans">${sb.items.map(it => barHtml(it, 7, 29)).join("")}</div></div>`;
    }
    return h + `</div></div>`;
  }
  function bindMonth() {
    bindEventClicks();
    $$("[data-goday]").forEach(b => b.onclick = e => { e.stopPropagation(); K.date = parse(b.dataset.goday); setViewMode("day"); });
    $$(".kal-mcell").forEach(c => {
      c.addEventListener("click", e => { if (e.target.closest("[data-ev],[data-goday]")) return; const d = parse(c.dataset.mday); d.setHours(9); editor(null, { start: d }); });
      c.addEventListener("dragover", e => { e.preventDefault(); c.classList.add("drop"); });
      c.addEventListener("dragleave", () => c.classList.remove("drop"));
      c.addEventListener("drop", async e => {
        e.preventDefault(); c.classList.remove("drop");
        const ev = K.events.find(x => x.id === e.dataTransfer.getData("text/kal")); if (!ev) return;
        const nd = parse(c.dataset.mday), s = evStart(ev), en = evEnd(ev), shift = Math.round((nd - day0(s)) / 86400000);
        if (!shift) return;
        const ns = addDays(s, shift), ne = addDays(en, shift);
        await saveMoved(ev, ev.allday ? ymd(ns) : ymdhm(ns), ev.allday ? ymd(ne) : ymdhm(ne));
      });
    });
    $$(".kal-mcell .kal-chip, .kal-month .kal-span").forEach(ch => {
      const e = K.events.find(x => x.id === ch.dataset.ev);
      if (e && !e.readonly && !e.recurring) { ch.draggable = true; ch.ondragstart = d => d.dataTransfer.setData("text/kal", e.id); }
    });
  }

  // ---- Liste (Agenda)
  function listHtml() {
    const [a, b] = range(); let h = `<div class="kal-list">`, any = false;
    for (let d = a; d < b; d = addDays(d, 1)) {
      const d1 = addDays(d, 1);
      const evs = K.events.filter(e => e.allday ? (parse(e.start) <= d && parse(e.end) > d) : (evStart(e) < d1 && evEnd(e) > d || +evStart(e) === +evEnd(e) && sameDay(evStart(e), d)));
      if (!evs.length) continue; any = true;
      h += `<div class="kal-lday ${sameDay(d, new Date()) ? "t" : ""}"><div class="kal-ldate"><b>${d.getDate()}</b><span>${WDS[wdIdx(d)]}, ${MON[d.getMonth()].slice(0, 3)}</span></div><div class="kal-litems">` +
        evs.map(e => `<div class="kal-litem" data-ev="${esc(e.id)}" tabindex="0" role="button" style="--c:${esc(e.color)}">
          <span class="tm">${e.allday ? "ganztägig" : sameDay(evStart(e), evEnd(e)) ? hm(evStart(e)) + " – " + hm(evEnd(e)) : dayTime(e, d)}</span><span class="tt"><b>${esc(e.title)}</b>${e.location ? `<small>${esc(e.location)}</small>` : ""}</span>
          <span class="src">${esc(srcOf(e.sid).name || "")}</span></div>`).join("") + `</div></div>`;
    }
    return h + (any ? "" : `<div class="list-empty">In den nächsten Wochen stehen keine Termine an.</div>`) + `</div>`;
  }
  function bindList() { bindEventClicks(); }
  function bindEventClicks() {
    $$("#kMain [data-ev]").forEach(el => {
      const openIt = ev => { ev.stopPropagation(); if (el.dataset.dragged) return; const e = K.events.find(x => x.id === el.dataset.ev); if (e) editor(e); };
      el.addEventListener("click", openIt);
      el.addEventListener("keydown", ev => { if (ev.key === "Enter") openIt(ev); });
    });
  }

  // ------------------------------------------------------------ Termin-Dialog
  function writable() { return K.sources.filter(s => s.writable); }
  function editor(e, preset = {}) {
    const ro = e && e.readonly;
    if (ro) return showReadonly(e);
    const isNew = !e;
    const start = e ? (e.recurring ? parse(e.seriesStart) : evStart(e)) : preset.start;
    const allday = e ? e.allday : !!preset.allday;
    let end = e ? (e.recurring ? parse(e.seriesEnd) : evEnd(e)) : (allday ? addDays(day0(start), 1) : new Date(+start + 3600000));
    if (allday) end = addDays(end, -1);                // Anzeige: letzter Tag inklusive
    const rr = (e && e.rrule) || { freq: "", interval: 1, until: "", count: 0, byday: "" };
    const ws = writable();
    const defSid = e ? e.sid : (localStorageGet("bm_kal_last") && ws.some(s => s.id === localStorageGet("bm_kal_last")) ? localStorageGet("bm_kal_last") : (ws[0] || {}).id);
    const accOpts = S.accounts.map(a => `<option value="${esc(a.id)}">${esc(a.email)}</option>`).join("");
    const atts = e ? (e.attendees || []).map(a => a.email).join(", ") : "";
    const alarms = [["-1", "Keine"], ["0", "Zu Beginn"], ["5", "5 Minuten vorher"], ["10", "10 Minuten vorher"], ["15", "15 Minuten vorher"], ["30", "30 Minuten vorher"], ["60", "1 Stunde vorher"], ["120", "2 Stunden vorher"], ["1440", "1 Tag vorher"], ["2880", "2 Tage vorher"], ["10080", "1 Woche vorher"]];
    const alarmVal = e ? (e.alarm == null ? "-1" : String(e.alarm)) : (allday ? "-1" : "15");
    modal(`<h2>${isNew ? "Neuer Termin" : "Termin bearbeiten"}</h2>
      ${e && e.recurring ? `<p class="kal-note">Serientermin – Änderungen gelten für die ganze Serie.</p>` : ""}
      <div class="form kal-form">
        <label for="eT">Betreff</label><input id="eT" value="${esc(e ? e.title : "")}" autocomplete="off">
        <label for="eL">Ort</label><input id="eL" value="${esc(e ? e.location : "")}" autocomplete="off">
        <label>Ganztägig</label><label class="kal-inl"><input type="checkbox" id="eA" ${allday ? "checked" : ""}> ganztägiger Termin</label>
        <label for="eSD">Beginn</label><div class="kal-dt"><input type="date" id="eSD" value="${ymd(start)}"><input type="time" id="eST" value="${hm(start)}" step="900"></div>
        <label for="eED">Ende</label><div class="kal-dt"><input type="date" id="eED" value="${ymd(end)}"><input type="time" id="eET" value="${hm(end)}" step="900"></div>
        <label for="eR">Wiederholung</label><div class="kal-dt"><select id="eR">
          ${[["", "Keine"], ["daily", "Täglich"], ["weekly", "Wöchentlich"], ["monthly", "Monatlich"], ["yearly", "Jährlich"]].map(([v, l]) => `<option value="${v}" ${rr.freq === v ? "selected" : ""}>${l}</option>`).join("")}
          </select><span class="kal-rr" id="eRI">alle <input type="number" id="eRN" min="1" max="99" value="${rr.interval || 1}" style="width:62px"> <span id="eRU"></span></span></div>
        <div class="full kal-rr" id="eRD">${RR_DAYS.map((d, i) => `<label class="kal-wd"><input type="checkbox" value="${d}" ${(rr.byday || RR_DAYS[wdIdx(start)]).includes(d) ? "checked" : ""}>${WDS[i]}</label>`).join("")}</div>
        <label class="kal-rr" id="eREl" for="eRE">Serie endet</label><div class="kal-dt kal-rr" id="eREw"><select id="eRE"><option value="">nie</option><option value="until" ${rr.until ? "selected" : ""}>am</option></select><input type="date" id="eRED" value="${esc(rr.until || "")}"></div>
        <label for="eAl">Erinnerung</label><select id="eAl">${alarms.map(([v, l]) => `<option value="${v}" ${v === alarmVal ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label for="eS">Kalender</label><select id="eS" ${isNew ? "" : "disabled"}>${ws.map(s => `<option value="${esc(s.id)}" ${s.id === defSid ? "selected" : ""}>${esc(s.name)}${s.account ? " (" + esc(s.account) + ")" : ""}</option>`).join("")}</select>
        <label for="eP">Teilnehmer</label><input id="eP" value="${esc(atts)}" placeholder="E-Mail-Adressen, mit Komma getrennt (lädt per E-Mail ein)" autocomplete="off">
        <label class="kal-inv" for="eF">Einladen von</label><select class="kal-inv" id="eF">${accOpts}</select>
        <label for="eD">Notizen</label><textarea id="eD" rows="4">${esc(e ? e.desc : "")}</textarea>
      </div>
      <div id="eMsg"></div>
      <div class="row-btns">${isNew ? "" : `<button class="btn ghost danger" id="eDel">Löschen</button><span class="grow"></span>`}
        <button class="btn ghost" data-close>Abbrechen</button><button class="btn primary" id="eSave">Speichern</button></div>`);
    if (!ws.length) $("#eMsg").innerHTML = `<div class="msg-err">Es gibt keinen Kalender, in den geschrieben werden kann.</div>`;
    const upd = () => {
      const ad = $("#eA").checked, f = $("#eR").value;
      $("#eST").hidden = $("#eET").hidden = ad;
      $$(".kal-rr").forEach(x => x.hidden = !f);
      $("#eRD").hidden = f !== "weekly";
      $("#eRU").textContent = { daily: "Tage", weekly: "Wochen", monthly: "Monate", yearly: "Jahre" }[f] || "";
      $("#eRED").hidden = $("#eRE").value !== "until";
      const inv = $("#eP").value.includes("@"); $$(".kal-inv").forEach(x => x.hidden = !inv);
    };
    ["eA", "eR", "eRE"].forEach(id => $("#" + id).onchange = upd);
    $("#eP").oninput = upd;
    // Ende mitziehen, wenn der Beginn verschoben wird
    let dur = end - start;
    $("#eSD").onchange = $("#eST").onchange = () => {
      const s = parse($("#eSD").value + "T" + ($("#eST").value || "00:00")), n = new Date(+s + dur);
      $("#eED").value = ymd(n); $("#eET").value = hm(n);
    };
    $("#eED").onchange = $("#eET").onchange = () => { dur = parse($("#eED").value + "T" + ($("#eET").value || "00:00")) - parse($("#eSD").value + "T" + ($("#eST").value || "00:00")); };
    upd();
    $("#eT").focus();
    $("#eSave").onclick = async () => {
      const ad = $("#eA").checked;
      let s = $("#eSD").value + (ad ? "" : "T" + ($("#eST").value || "09:00")), en = $("#eED").value + (ad ? "" : "T" + ($("#eET").value || "10:00"));
      if (ad) en = ymd(addDays(parse(en), 1));
      if (parse(en) < parse(s)) return $("#eMsg").innerHTML = `<div class="msg-err">Das Ende liegt vor dem Beginn.</div>`;
      const f = $("#eR").value;
      const body = { sid: isNew ? $("#eS").value : e.sid, uid: e ? e.uid : "", title: $("#eT").value.trim(), location: $("#eL").value.trim(),
        desc: $("#eD").value, start: s, end: en, allday: ad, alarm: $("#eAl").value, attendees: $("#eP").value, from_acc: $("#eF").value,
        rrule: f ? { freq: f, interval: +$("#eRN").value || 1, byday: f === "weekly" ? $$("#eRD input:checked").map(x => x.value).join(",") : "",
          until: $("#eRE").value === "until" ? $("#eRED").value : "" } : null };
      if (!body.title) return $("#eMsg").innerHTML = `<div class="msg-err">Bitte einen Betreff eingeben.</div>`;
      const b = $("#eSave"); b.disabled = true;
      try {
        const r = await api("/api/cal/event/save", { body });
        localStorageSet("bm_kal_last", body.sid);
        closeModal(); toast(r.invited ? `Termin gespeichert – ${r.invited} Einladung(en) verschickt` : "Termin gespeichert");
        await refresh(true); reminders.refresh();
      } catch (err) { b.disabled = false; $("#eMsg").innerHTML = `<div class="msg-err">${esc(err.message)}</div>`; }
    };
    const del = $("#eDel");
    if (del) del.onclick = async () => {
      let only = false;
      if (e.recurring) {
        const ans = prompt("Serientermin löschen:\n1 = nur diesen Termin\n2 = ganze Serie", "1");
        if (ans === null) return; only = ans.trim() !== "2";
      } else if (!confirm(`Termin „${e.title}“ löschen?`)) return;
      try { await api("/api/cal/event/delete", { body: { sid: e.sid, uid: e.uid, occ: e.occ, only_this: only } }); closeModal(); toast("Termin gelöscht"); await refresh(true); }
      catch (err) { $("#eMsg").innerHTML = `<div class="msg-err">${esc(err.message)}</div>`; }
    };
  }
  function showReadonly(e) {
    const s = srcOf(e.sid);
    modal(`<h2>${esc(e.title)}</h2>
      <div class="kal-ro"><div><b>Wann:</b> ${esc(whenText(e))}</div>
      ${e.location ? `<div><b>Wo:</b> ${esc(e.location)}</div>` : ""}
      <div><b>Kalender:</b> <span class="kal-dot" style="background:${esc(e.color)}"></span> ${esc(s.name || "")}</div>
      ${e.desc ? `<div class="kal-desc">${esc(e.desc)}</div>` : ""}
      <p class="kal-note">Dieser Kalender kann nur gelesen werden.</p></div>
      <div class="row-btns"><button class="btn primary" data-close>Schließen</button></div>`);
  }

  // ------------------------------------------------------------ Kalender hinzufügen
  function addDialog() {
    const accs = S.accounts;
    modal(`<h2>Kalender hinzufügen</h2>
      <div class="kal-add-opts">
        <button class="kal-opt" data-add="acc"><b>Kalender eines Mail-Kontos</b><span>GMX, WEB.DE, iCloud, mailbox.org … – zum Lesen und Schreiben</span></button>
        <button class="kal-opt" data-add="ics"><b>Internet-Kalender (Adresse)</b><span>Müllabfuhr, Gremien, Feiertage, Schulferien, Vereine … – zum Lesen</span></button>
        <button class="kal-opt" data-add="dav"><b>Eigener Kalender-Server (CalDAV)</b><span>z. B. Nextcloud auf dem eigenen Server</span></button>
      </div><div id="kaBody"></div>
      <div class="row-btns"><button class="btn ghost" data-close>Schließen</button></div>`);
    $$("[data-add]").forEach(b => b.onclick = () => {
      $$("[data-add]").forEach(x => x.classList.toggle("on", x === b));
      const t = b.dataset.add, box = $("#kaBody");
      if (t === "acc") {
        box.innerHTML = `<div class="form" style="margin-top:14px"><label for="kaAcc">Mail-Konto</label><select id="kaAcc">${accs.map(a => `<option value="${esc(a.id)}">${esc(a.email)}</option>`).join("")}</select></div>
          <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaFind">Kalender suchen</button></div><div id="kaRes"></div>`;
        $("#kaFind").onclick = () => discover({ acc: $("#kaAcc").value });
      } else if (t === "ics") {
        box.innerHTML = `<div class="form" style="margin-top:14px"><label for="kaN">Name</label><input id="kaN" placeholder="z. B. Müllabfuhr" autocomplete="off">
          <label for="kaU">Adresse</label><input id="kaU" placeholder="https://… oder webcal://… (endet oft auf .ics)" autocomplete="off">
          <div class="hint">Auf der Webseite des Anbieters nach „iCal“, „ICS“, „Kalender abonnieren“ oder „Export“ suchen und die Adresse kopieren.</div>
          <details class="hint" style="margin-top:6px"><summary style="cursor:pointer;color:var(--blue-text)">🗑 Müllabfuhr-Kalender meiner Gemeinde – wie finde ich die Adresse?</summary>
            <ol style="margin:6px 0 0 18px;padding:0;line-height:1.55">
              <li>Auf der Webseite Ihres Abfallbetriebs (z. B. „Abfuhrtermine“ des Landkreises) Ort und Straße auswählen.</li>
              <li>Nach „Kalender abonnieren“, „iCal“ oder „ICS“ suchen. Gibt es nur „ICS herunterladen“: mit der <b>rechten Maustaste</b> darauf klicken → <b>„Link-Adresse kopieren“</b>.</li>
              <li>Die Adresse hier oben einfügen und einen Namen wie „Müllabfuhr“ vergeben.</li>
            </ol>
            <div style="margin-top:4px">Viele Landkreise nutzen den Dienst „AbfallPlus“ (abfall.io) – dort stellt Balu-Mail den Zeitraum automatisch auf das aktuelle und das nächste Jahr, das Abo veraltet also nicht.</div>
          </details></div>
          <div id="kaRes"></div><div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaSave">Hinzufügen</button></div>`;
        $("#kaSave").onclick = async () => {
          $("#kaRes").innerHTML = `<div class="msg-ok">Kalender wird geladen …</div>`;
          try { K.sources = await api("/api/cal/source/save", { body: { type: "ics", name: $("#kaN").value.trim(), url: $("#kaU").value.trim() } });
            const s = K.sources[K.sources.length - 1];
            if (s.error) { $("#kaRes").innerHTML = `<div class="msg-err">${esc(s.error)}</div>`; }
            else { closeModal(); toast(`„${s.name}“ hinzugefügt`); }
            await refresh(true);
          } catch (e) { $("#kaRes").innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
        };
      } else {
        box.innerHTML = `<div class="form" style="margin-top:14px"><label for="kaSU">Server-Adresse</label><input id="kaSU" placeholder="https://cloud.example.de/remote.php/dav" autocomplete="off">
          <label for="kaUs">Benutzername</label><input id="kaUs" autocomplete="off"><label for="kaPw">Passwort</label><input id="kaPw" type="text" class="secret" autocomplete="off"></div>
          <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaFind">Kalender suchen</button></div><div id="kaRes"></div>`;
        $("#kaFind").onclick = () => discover({ url: $("#kaSU").value.trim(), user: $("#kaUs").value.trim(), password: $("#kaPw").value });
      }
    });
  }
  async function discover(q) {
    const res = $("#kaRes"); res.innerHTML = `<div class="msg-ok">Suche Kalender …</div>`;
    try {
      const r = await api("/api/cal/discover", { body: q });
      if (r.provider === "google") return googleConnect(q, res);
      if (r.provider === "google-ics") return res.innerHTML = providerHelp("Google", "https://calendar.google.com/calendar/r/settings",
        "Links unter „Einstellungen für meine Kalender“ deinen Kalender anklicken → ganz unten bei <b>„Privatadresse im iCal-Format“</b> auf Kopieren klicken. (Nicht die „öffentliche Adresse“ – die funktioniert nur bei freigegebenen Kalendern.)",
        "https://calendar.google.com/calendar/ical/…/private-…/basic.ics");
      if (r.provider === "microsoft") return res.innerHTML = providerHelp("Outlook.com", "https://outlook.live.com/calendar/0/options/calendar/SharedCalendars",
        "Unter <b>„Einen Kalender veröffentlichen“</b> den Kalender und „Alle Details anzeigen“ wählen → <b>Veröffentlichen</b> → den <b>ICS-Link</b> kopieren.",
        "https://outlook.live.com/owa/calendar/…/calendar.ics");
      res.innerHTML = `<div class="kal-found">${r.calendars.map((c, i) => `<label><input type="checkbox" data-ci="${i}" ${c.known ? "disabled" : "checked"}> <span class="kal-dot" style="background:${esc(c.color || "#1a6fe6")}"></span> ${esc(c.name)}${c.readonly ? " <small>(nur lesen)</small>" : ""}${c.known ? " <small>(schon da)</small>" : ""}</label>`).join("")}</div>
        <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaTake">Ausgewählte übernehmen</button></div>`;
      $("#kaTake").onclick = async () => {
        for (const cb of $$("[data-ci]:checked")) {
          const c = r.calendars[+cb.dataset.ci];
          K.sources = await api("/api/cal/source/save", { body: { type: "caldav", url: c.url, name: c.name, color: c.color, readonly: c.readonly, acc: q.acc, user: q.user, password: q.password, google: c.google } });
        }
        closeModal(); toast("Kalender übernommen"); await refresh(true);
      };
    } catch (e) { res.innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
  }
  // ---- Google: Anmeldung für Abgleich in beide Richtungen
  function googleConnect(q, res) {
    res.innerHTML = `<div class="kal-help"><b>Google-Kalender verbinden</b> – Termine werden in beide Richtungen abgeglichen: Neues und Änderungen
      aus Balu-Mail landen bei Google, Einträge vom Handy erscheinen hier.
      <div class="row-btns" style="justify-content:flex-start;margin-top:10px"><button class="btn primary" id="kaG">Mit Google anmelden</button></div>
      <div id="kaGMsg"></div>
      <details style="margin-top:8px"><summary style="cursor:pointer;color:var(--blue-text)">Nur ansehen, ohne Anmeldung</summary><div id="kaGIcs"></div></details></div>`;
    $("#kaGIcs").innerHTML = providerHelp("Google", "https://calendar.google.com/calendar/r/settings",
      "Links den Kalender anklicken → ganz unten bei <b>„Privatadresse im iCal-Format“</b> auf Kopieren klicken.", "https://calendar.google.com/calendar/ical/…/private-…/basic.ics");
    $("#kaG").onclick = () => googleLogin(q);
  }
  async function googleLogin(q) {
    const msg = $("#kaGMsg");
    let r;
    try { r = await api("/api/oauth/google/start", { body: { origin: location.origin } }); }
    catch (e) { return msg.innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
    if (r.setup) return googleSetup(q);
    const w = window.open(r.url, "_blank", "width=520,height=680");
    if (!w) location.href = r.url;
    msg.innerHTML = `<div class="msg-ok">Bitte im Google-Fenster anmelden und „Zulassen“ klicken …</div>`;
    for (let i = 0; i < 300; i++) {
      await new Promise(x => setTimeout(x, 1500));
      let p; try { p = await api("/api/oauth/google/poll?" + qs({ state: r.state })); } catch (e) { return msg.innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
      if (!$("#kaGMsg")) return;
      if (p.done) {
        if (p.error) return msg.innerHTML = `<div class="msg-err">${esc(p.error)}</div>`;
        msg.innerHTML = `<div class="msg-ok">Verbunden mit ${esc(p.email)} – suche Kalender …</div>`;
        return discover(q);
      }
    }
  }
  function googleSetup(q) {
    const L = (u, t) => `<a href="${u}" target="_blank">${t}</a>`;
    $("#kaRes").innerHTML = `<div class="kal-help"><b>Einmalig: Google-Zugang für Balu-Mail anlegen</b> (ca. 5 Minuten, kostenlos)
      <ol>
        <li>${L("https://console.cloud.google.com/projectcreate", "Neues Projekt anlegen")} – Name: <b>Balu-Mail</b> → Erstellen.</li>
        <li>Im Projekt diese zwei Dienste <b>aktivieren</b>: ${L("https://console.cloud.google.com/apis/library/calendar-json.googleapis.com", "Google Calendar API")} und ${L("https://console.cloud.google.com/apis/library/caldav.googleapis.com", "CalDAV API")}.</li>
        <li>${L("https://console.cloud.google.com/auth/overview", "Google Auth Platform öffnen")} → „Jetzt starten“: App-Name <b>Balu-Mail</b>, deine E-Mail, Zielgruppe <b>Extern</b> → Erstellen.
            Danach unter <b>„Zielgruppe“</b> auf <b>„App veröffentlichen“</b> klicken (sonst muss man sich alle 7 Tage neu anmelden).</li>
        <li>${L("https://console.cloud.google.com/auth/clients/create", "OAuth-Client erstellen")}: Anwendungstyp <b>„Desktop-App“</b>, Name Balu-Mail → Erstellen.</li>
        <li>Client-ID und Clientschlüssel hier einfügen:</li>
      </ol>
      <div class="form"><label for="kaGId">Client-ID</label><input id="kaGId" placeholder="….apps.googleusercontent.com" autocomplete="off" spellcheck="false">
        <label for="kaGSec">Clientschlüssel</label><input id="kaGSec" type="text" class="secret" placeholder="GOCSPX-…" autocomplete="off" spellcheck="false"></div>
      <div id="kaGSMsg"></div><div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaGSave">Speichern und mit Google anmelden</button></div>
      <p class="kal-note" style="margin-top:8px">Hinweis: Bei der Anmeldung zeigt Google „Diese App wurde nicht überprüft“. Das ist bei einer eigenen App normal → „Erweitert“ → „Zu Balu-Mail wechseln“.</p></div>`;
    $("#kaGSave").onclick = async () => {
      const id = $("#kaGId").value.trim(), sec = $("#kaGSec").value.trim();
      if (!id.endsWith(".apps.googleusercontent.com") || !sec) return $("#kaGSMsg").innerHTML = `<div class="msg-err">Bitte Client-ID (endet auf .apps.googleusercontent.com) und Clientschlüssel einfügen.</div>`;
      try { await api("/api/settings", { body: { google_client_id: id, google_client_secret: sec } }); }
      catch (e) { return $("#kaGSMsg").innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
      $("#kaRes").innerHTML = `<div id="kaGMsg"></div>`;
      googleLogin(q);
    };
  }

  // Google/Outlook: Anleitung + Adressfeld direkt darunter (nur lesen)
  function providerHelp(name, url, step, hint) {
    setTimeout(() => {
      $("#kaPSave").onclick = async () => {
        const u = $("#kaPU").value.trim(), out = $("#kaPMsg");
        if (!u) return out.innerHTML = `<div class="msg-err">Bitte die kopierte Adresse einfügen.</div>`;
        out.innerHTML = `<div class="msg-ok">Kalender wird geladen …</div>`;
        try {
          K.sources = await api("/api/cal/source/save", { body: { type: "ics", name: $("#kaPN").value.trim() || name + "-Kalender", url: u } });
          const s = K.sources[K.sources.length - 1];
          if (s.error) { out.innerHTML = `<div class="msg-err">${esc(s.error)}</div>`; K.sources = await api("/api/cal/source/delete", { body: { id: s.id } }); return; }
          closeModal(); toast(`„${s.name}“ hinzugefügt`); await refresh(true);
        } catch (e) { out.innerHTML = `<div class="msg-err">${esc(e.message)}</div>`; }
      };
    }, 0);
    return `<div class="kal-help"><b>${name}-Kalender einblenden</b> (nur lesen – ${name} erlaubt hier keinen direkten Abgleich):
      <ol><li><a href="${url}" target="_blank">${name}-Kalendereinstellungen öffnen</a></li><li>${step}</li><li>Die Adresse hier einfügen:</li></ol>
      <div class="form"><label for="kaPN">Name</label><input id="kaPN" value="${name}-Kalender" autocomplete="off">
        <label for="kaPU">Adresse</label><input id="kaPU" placeholder="${hint}" autocomplete="off"></div>
      <div id="kaPMsg"></div><div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="kaPSave">Hinzufügen</button></div></div>`;
  }

  // ------------------------------------------------------------ Erinnerungen
  const reminders = (function () {
    let list = [], timer = null, lastLoad = 0;
    // Geschlossene/verschobene Erinnerungen liegen zentral (für alle Fenster und Geräte, per Abgleich)
    let remState = {};
    const dismissed = () => remState;
    const remKey = e => e.id + "|" + (e.start || "");
    const remSet = (key, val) => { remState[key] = val; api("/api/cal/rem", { body: { key, val } }).catch(() => {}); };
    async function refresh() {
      const now = new Date();
      try { remState = await api("/api/cal/rem"); } catch {}
      try { list = await api("/api/cal/events?" + qs({ from: ymdhm(addDays(day0(now), -1)), to: ymdhm(addDays(day0(now), 8)) })); lastLoad = Date.now(); } catch {}
      check();
    }
    function due() {
      const now = Date.now(), dm = dismissed();
      return list.filter(e => e.alarm != null && e.alarm >= 0).filter(e => {
        const s = +evStart(e), at = s - e.alarm * 60000, key = remKey(e);
        const snooze = dm[key] ?? dm[e.id];
        if (snooze === "x") return false;
        if (typeof snooze === "number" && now < snooze) return false;
        return now >= at && now < Math.max(+evEnd(e), s + 3600000);
      });
    }
    function check() {
      if (Date.now() - lastLoad > 300000) return refresh();
      const d = due();
      let box = $("#kalRem");
      if (!d.length) { if (box) box.remove(); return; }
      const fresh = d.filter(e => !shown.has(e.id));
      if (!box) { box = document.createElement("div"); box.id = "kalRem"; box.className = "kal-rem card"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", "Erinnerungen"); document.body.appendChild(box); }
      box.innerHTML = `<div class="kal-rem-h">${ic("drafts")}<b>${d.length === 1 ? "Erinnerung" : d.length + " Erinnerungen"}</b></div>` + d.map(e => {
        const mins = Math.round((+evStart(e) - Date.now()) / 60000);
        const rel = mins > 0 ? `in ${mins >= 1440 ? Math.round(mins / 1440) + " Tag(en)" : mins >= 60 ? Math.round(mins / 60) + " Std." : mins + " Min."}` : mins > -5 ? "jetzt" : "läuft";
        return `<div class="kal-rem-i" style="--c:${esc(e.color)}"><div><b>${esc(e.title)}</b><span>${esc(whenText(e))}${e.location ? " · " + esc(e.location) : ""}</span><em>${rel}</em></div>
          <div class="kal-rem-b"><button class="btn ghost" data-snz="${esc(remKey(e))}">In 5 Min.</button><button class="btn primary" data-dis="${esc(remKey(e))}">Schließen</button></div></div>`;
      }).join("") + (window.Notification && Notification.permission === "default" ? `<button class="kal-rem-n" id="kalNotif">Auch als Windows-Benachrichtigung anzeigen</button>` : "");
      $$("[data-dis]", box).forEach(b => b.onclick = () => { remSet(b.dataset.dis, "x"); check(); });
      $$("[data-snz]", box).forEach(b => b.onclick = () => { remSet(b.dataset.snz, Date.now() + 300000); shown.delete(b.dataset.snz); check(); });
      const n = $("#kalNotif", box); if (n) n.onclick = () => Notification.requestPermission().then(check);
      if (fresh.length) {
        fresh.forEach(e => shown.add(e.id));
        ding();
        if (window.Notification && Notification.permission === "granted" && document.hidden)
          fresh.forEach(e => { try { new Notification("Erinnerung: " + e.title, { body: whenText(e) + (e.location ? "\n" + e.location : ""), tag: e.id }); } catch {} });
      }
    }
    const shown = new Set();
    function ding() {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)(), t = ac.currentTime;
        [[660, 0], [880, .18], [1100, .36]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.16, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .35); o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + .4); });
      } catch {}
    }
    function start() { if (timer) return; refresh(); timer = setInterval(check, 30000); }
    return { start, refresh, check };
  })();

  // ------------------------------------------------------------ Einladungen in E-Mails
  function inviteCard(d) {
    const v = d.invite; if (!v) return "";
    const e = { start: v.start, end: v.end, allday: v.allday };
    const cancel = v.method === "CANCEL", reply = v.method === "REPLY";
    const ws = writable();
    const who = reply ? (v.attendees || []).map(a => `${esc(a.name || a.email)}: ${{ ACCEPTED: "zugesagt", DECLINED: "abgesagt", TENTATIVE: "mit Vorbehalt" }[a.status] || esc(a.status)}`).join(", ") : "";
    return `<div class="kal-inv-card" id="kInv">
      <div class="kal-inv-i">${ic("drafts")}</div>
      <div class="kal-inv-t"><b>${cancel ? "Termin abgesagt: " : reply ? "Antwort auf Einladung: " : "Einladung: "}${esc(v.title)}</b>
        <span>${esc(whenText(e))}${v.location ? " · " + esc(v.location) : ""}${v.recurring ? " · Serientermin" : ""}</span>
        ${v.organizer && !reply ? `<span>Von: ${esc(v.organizer.name || v.organizer.email)}</span>` : ""}${who ? `<span>${who}</span>` : ""}</div>
      ${reply ? "" : `<div class="kal-inv-b">
        ${cancel ? `<button class="btn ghost" data-ans="REMOVE">Aus Kalender entfernen</button>` :
          `<select id="kInvS" aria-label="Kalender">${ws.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
          <button class="btn primary" data-ans="ACCEPTED">Annehmen</button><button class="btn ghost" data-ans="TENTATIVE">Mit Vorbehalt</button><button class="btn ghost danger" data-ans="DECLINED">Ablehnen</button>`}
      </div>`}</div>`;
  }
  async function bindInvite(d) {
    if (!d.invite) return;
    if (!K.sources.length) { await loadSources(); const c = $("#kInv"); if (c) c.outerHTML = inviteCard(d); }
    $$("#kInv [data-ans]").forEach(b => b.onclick = async () => {
      const ans = b.dataset.ans; b.disabled = true;
      try {
        await api("/api/cal/invite", { body: { acc: d.acc, folder: d.folder, uid: d.uid, answer: ans, sid: ($("#kInvS") || {}).value || "lokal" } });
        toast({ ACCEPTED: "Zugesagt – Termin ist im Kalender", TENTATIVE: "Mit Vorbehalt zugesagt – Termin ist im Kalender", DECLINED: "Abgesagt – Antwort verschickt", REMOVE: "Termin entfernt" }[ans]);
        $("#kInv .kal-inv-b").innerHTML = `<span class="kal-done">${{ ACCEPTED: "✓ Angenommen", TENTATIVE: "✓ Mit Vorbehalt", DECLINED: "Abgelehnt", REMOVE: "Entfernt" }[ans]}</span>`;
        K.rangeKey = ""; reminders.refresh();
      } catch (e) { b.disabled = false; toast(e.message, true); }
    });
  }

  return { open, close, render, reminders, inviteCard, bindInvite, get active() { return K.active; } };
})();
