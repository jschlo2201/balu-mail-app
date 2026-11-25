#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Balu-Mail – schlanker E-Mail-Client mit Weboberfläche.
Nur Python-Standardbibliothek, keine Zusatzpakete nötig.

Start:   python balumail.py            (normal)
         python balumail.py --demo     (mit Beispiel-Mails, ohne echte Konten)
Optionen: --port 8025  --no-browser  --app (eigenes Programmfenster)
"""
import base64, binascii, copy, datetime as dt, email, email.header, email.policy, email.utils, html, imaplib, json
import mimetypes, os, re, secrets, shutil, subprocess, smtplib, socket, ssl, sys, threading, time, uuid, webbrowser
import urllib.request, urllib.error
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

APP_NAME = "Balu-Mail"
VERSION = "1.0.0"  # wird beim Build durch die echte Versionsnummer ersetzt
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
TOKEN = secrets.token_urlsafe(24)
TOKEN_IN_PAGE = True
PAGE_SIZE = 50

# --------------------------------------------------------------------------
# Datenablage (Konten) – Passwörter unter Windows mit DPAPI verschlüsselt
# --------------------------------------------------------------------------
def ssl_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()

def data_dir():
    if os.name == "nt":
        d = os.path.join(os.environ.get("APPDATA", BASE_DIR), APP_NAME)
    else:
        d = os.path.join(os.path.expanduser("~"), ".balu-mail")
    os.makedirs(d, exist_ok=True)
    return d

ACCOUNTS_FILE = os.path.join(data_dir(), "konten.json")

def _dpapi(data: bytes, protect: bool) -> bytes:
    import ctypes
    from ctypes import wintypes
    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
    buf = ctypes.create_string_buffer(data, len(data))
    blob_in = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    blob_out = BLOB()
    fn = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    if not fn(ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
        raise OSError("DPAPI-Fehler")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)

# --------------------------------------------------------------------------
# Server-Modus (Webseite): Tresor – alle Passwörter werden mit einem Schlüssel
# verschlüsselt, der nur aus dem Anmeldepasswort entsteht und nur im Arbeitsspeicher liegt.
# --------------------------------------------------------------------------
import builtins, hashlib as _hl, hmac as _hm
SERVER_MODE = "--server" in sys.argv
if not hasattr(builtins, "_balu_shared"):   # überlebt stille Updates im selben Prozess
    builtins._balu_shared = {"key": None, "sessions": {}, "fails": {}, "totp_last": 0}
_SH = builtins._balu_shared

class Locked(RuntimeError):
    pass

def _v_stream(key, nonce, n):
    out, i = bytearray(), 0
    while len(out) < n:
        out += _hm.new(key, b"enc" + nonce + i.to_bytes(8, "big"), _hl.sha256).digest(); i += 1
    return bytes(out[:n])

def _v_enc(key: bytes, raw: bytes) -> bytes:
    nonce = os.urandom(16)
    ct = bytes(a ^ b for a, b in zip(raw, _v_stream(key, nonce, len(raw))))
    tag = _hm.new(key, b"mac" + nonce + ct, _hl.sha256).digest()
    return nonce + tag + ct

def _v_dec(key: bytes, blob: bytes) -> bytes:
    nonce, tag, ct = blob[:16], blob[16:48], blob[48:]
    if not _hm.compare_digest(tag, _hm.new(key, b"mac" + nonce + ct, _hl.sha256).digest()):
        raise ValueError("Tresor-Daten beschädigt oder falscher Schlüssel")
    return bytes(a ^ b for a, b in zip(ct, _v_stream(key, nonce, len(ct))))

def _vault_key():
    if _SH["key"] is None:
        raise Locked("Balu-Mail ist gesperrt – bitte anmelden.")
    return _SH["key"]

def enc_pw(pw: str) -> str:
    raw = pw.encode("utf-8")
    if SERVER_MODE:
        return "vault:" + base64.b64encode(_v_enc(_vault_key(), raw)).decode()
    if os.name == "nt":
        try:
            return "dpapi:" + base64.b64encode(_dpapi(raw, True)).decode()
        except Exception:
            pass
    return "plain:" + base64.b64encode(raw).decode()

def enc_plain(pw: str) -> str:
    """Nur für unkritische Werte, die auch gesperrt lesbar sein müssen (Update-Schlüssel mit Leserechten)."""
    return enc_pw(pw) if not SERVER_MODE else "plain:" + base64.b64encode(pw.encode("utf-8")).decode()

def dec_pw(s: str) -> str:
    kind, _, b = s.partition(":")
    raw = base64.b64decode(b)
    if kind == "dpapi":
        raw = _dpapi(raw, False)
    elif kind == "vault":
        raw = _v_dec(_vault_key(), raw)
    return raw.decode("utf-8")

_acc_lock = threading.Lock()

def load_accounts():
    if not os.path.exists(ACCOUNTS_FILE):
        return []
    with open(ACCOUNTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_accounts(accs):
    tmp = ACCOUNTS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(accs, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ACCOUNTS_FILE)

FOLDER_BAD = re.compile(r'[\\/*%"]')

def folder_action(d):
    """Ordner anlegen / umbenennen / verschieben / löschen (in den Papierkorb bzw. endgültig) / Papierkorb leeren."""
    c = client(d["acc"]); act = d.get("action")
    fl = c.list_folders(); dl = c._delim()
    paths = {f["path"]: f for f in fl}
    trash = next((f["path"] for f in fl if f["special"] == "trash"), None)
    path = d.get("path") or ""
    f = paths.get(path) if path else None
    if path and not f: raise RuntimeError("Ordner nicht gefunden – bitte aktualisieren.")
    in_trash = bool(trash and path.startswith(trash + dl))
    def check_name(n):
        n = (n or "").strip()
        if not n: raise RuntimeError("Bitte einen Namen eingeben.")
        if dl in n or FOLDER_BAD.search(n): raise RuntimeError(f"Der Name darf keine Zeichen wie {dl} * % \" enthalten.")
        return n
    def free(p):
        if p not in paths: return p
        i = 2
        while f"{p} ({i})" in paths: i += 1
        return f"{p} ({i})"
    def protect():
        if f and f["special"]: raise RuntimeError("Spezialordner (Posteingang, Gesendet, Papierkorb …) können nicht geändert werden.")
    if act == "create":
        n = check_name(d.get("name"))
        new = (path + dl + n) if path else n
        if new in paths: raise RuntimeError("Diesen Ordner gibt es schon.")
        c.folder_create(new); return {"ok": True, "path": new}
    if act == "rename":
        protect(); n = check_name(d.get("name"))
        parent = path.rsplit(dl, 1)[0] if dl in path else ""
        new = (parent + dl + n) if parent else n
        if new == path: return {"ok": True, "path": path}
        if new in paths: raise RuntimeError("Es gibt schon einen Ordner mit diesem Namen.")
        c.folder_rename(path, new); return {"ok": True, "path": new}
    if act == "move":
        protect(); tgt = d.get("target") or ""
        if tgt and tgt not in paths: raise RuntimeError("Zielordner nicht gefunden.")
        if tgt == path or tgt.startswith(path + dl): raise RuntimeError("Ein Ordner kann nicht in sich selbst verschoben werden.")
        leaf = path.rsplit(dl, 1)[-1]
        new = (tgt + dl + leaf) if tgt else leaf
        if new == path: return {"ok": True, "path": path}
        if new in paths: raise RuntimeError(f"Im Ziel gibt es schon einen Ordner „{leaf}“.")
        c.folder_rename(path, new); return {"ok": True, "path": new}
    if act == "delete":
        protect()
        if in_trash or not trash:
            if not d.get("final"): raise RuntimeError("Bitte bestätigen.")
            c.folder_delete(path); return {"ok": True, "final": True}
        new = free(trash + dl + path.rsplit(dl, 1)[-1])
        c.folder_rename(path, new); return {"ok": True, "path": new}
    if act == "empty":
        if not (f and f["special"] == "trash") and not in_trash: raise RuntimeError("Nur der Papierkorb und seine Unterordner können geleert werden.")
        if not d.get("final"): raise RuntimeError("Bitte bestätigen.")
        return {"ok": True, "deleted": c.folder_empty(path)}
    raise RuntimeError("Unbekannte Aktion.")

DRAFT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")

_draft_locks, _draft_gone, _draft_glock = {}, {}, threading.Lock()

def _draft_lock(did):
    with _draft_glock:
        now = time.time()
        for k in [k for k, t in _draft_gone.items() if now - t > 3600]: _draft_gone.pop(k, None)
        return _draft_locks.setdefault(did, threading.Lock())

def draft_save(data):
    """Entwurf ablegen; mit draft_id ersetzt er ältere Fassungen desselben Entwurfs (auch aus anderen Konten).
    Gleichzeitige Sicherungen desselben Entwurfs laufen nacheinander, damit immer genau eine Fassung übrig bleibt."""
    did = data.get("draft_id") or ""
    if did and not DRAFT_ID_RE.match(did): raise RuntimeError("Ungültige Entwurfs-Kennung")
    if not did: return _draft_save(data, did)
    with _draft_lock(did):
        if did in _draft_gone: return {"ok": True, "skipped": True}     # schon gesendet/verworfen
        return _draft_save(data, did)

def _draft_save(data, did):
    c = client(data["acc"])
    em = make_email(c.acc, data)
    if data.get("bcc"): em["Bcc"] = data["bcc"]
    if did: em["X-Balu-Draft"] = did
    if DEMO:
        c._add("Entwürfe", {"from": {"name": c.acc["name"], "email": data.get("from") or c.acc["email"]}, "to": addr_list(data.get("to") or ""),
                             "subject": data.get("subject") or "(kein Betreff)", "html": data.get("html") or "",
                             "date": dt.datetime.now().astimezone().isoformat(), "body": data.get("text", ""), "flags": ["\\Seen", "\\Draft"], "draft_id": did})
        if did: draft_delete(data["acc"], did, keep_newest=True)
        return {"ok": True}
    if not c.special_folder("drafts"): raise RuntimeError("Dieses Konto hat keinen Entwürfe-Ordner.")
    new_uid = c.append("drafts", em.as_bytes(), "(\\Seen \\Draft)")
    if did:
        draft_delete(data["acc"], did, keep_newest=True, keep_uid=new_uid)
        for a in load_accounts():          # Absender gewechselt: alte Fassung im anderen Konto entfernen
            if a["id"] != data["acc"]:
                try: draft_delete(a["id"], did, only_if_cached=True)
                except Exception: pass
    return {"ok": True}

def draft_delete(acc_id, did, keep_newest=False, only_if_cached=False, keep_uid=None):
    """Alle Fassungen eines Entwurfs (X-Balu-Draft) löschen – auf Wunsch die neueste behalten."""
    if not did or not DRAFT_ID_RE.match(did): return {"ok": True, "deleted": 0}
    if not keep_newest and not only_if_cached:          # gesendet/verworfen: späte Sicherungen nicht mehr ablegen
        with _draft_glock: _draft_gone[did] = time.time()
        with _draft_lock(did): return _draft_delete(acc_id, did, False, False, None)
    return _draft_delete(acc_id, did, keep_newest, only_if_cached, keep_uid)

def _draft_delete(acc_id, did, keep_newest, only_if_cached, keep_uid):
    if only_if_cached and acc_id not in _clients: return {"ok": True, "deleted": 0}
    c = client(acc_id)
    if DEMO:
        box = c.boxes.get("Entwürfe", [])
        hits = [m for m in box if m.get("draft_id") == did]
        if keep_newest and hits: hits = hits[:-1]
        for m in hits: box.remove(m)
        return {"ok": True, "deleted": len(hits)}
    folder = c.special_folder("drafts")
    if not folder: return {"ok": True, "deleted": 0}
    uids = sorted(u for u, k in draft_ids(c, folder).items() if k == did)
    if keep_newest and uids:
        keep = keep_uid if keep_uid in uids else uids[-1]
        uids = [u for u in uids if u != keep]
    if uids: c.delete_forever(folder, uids)
    return {"ok": True, "deleted": len(uids)}

def draft_ids(c, folder):
    """{UID: Entwurfs-Kennung} aller Balu-Entwürfe im Ordner – direkt aus den Kopfzeilen gelesen.
    (Die Server-Suche nach eigenen Kopfzeilen liefert bei manchen Anbietern, z. B. GMX, nichts.)"""
    def fn(c2):
        c.selected = None                    # frisch öffnen, damit gerade abgelegte Fassungen sichtbar sind
        c.select(c2, folder)
        typ, d = c2.uid("FETCH", "1:*", "(UID BODY.PEEK[HEADER.FIELDS (X-Balu-Draft)])")
        out = {}
        if typ != "OK": return out
        for it in d or []:
            if not isinstance(it, tuple): continue
            m = re.search(rb"UID (\d+)", it[0]); h = re.search(rb"(?im)^X-Balu-Draft:\s*(\S+)", it[1] or b"")
            if m and h: out[int(m.group(1))] = h.group(1).decode("ascii", "replace")
        return out
    try: return c.run(fn)
    except Exception: return {}

def draft_sent(did):
    """Nach dem Senden: alle Fassungen des Entwurfs in allen Konten löschen (im Hintergrund)."""
    if not did or not DRAFT_ID_RE.match(did): return
    with _draft_glock: _draft_gone[did] = time.time()
    def job():
        for a in load_accounts():
            try: draft_delete(a["id"], did)
            except Exception: pass
    threading.Thread(target=job, daemon=True).start()

def _hdr_infos(c, folder, uids_spec, fields):
    """{UID: (Zeitstempel, {Kopfzeile: Wert})} für die angegebenen Nachrichten."""
    def fn(c2):
        c.selected = None
        c.select(c2, folder)
        if uids_spec is None:
            spec = "1:*"
        else:
            typ, d = c2.uid("SEARCH", *uids_spec)
            ids = (d[0] or b"").split() if typ == "OK" else []
            if not ids: return {}
            spec = b",".join(ids[-300:]).decode()
        typ, d = c2.uid("FETCH", spec, f"(UID INTERNALDATE BODY.PEEK[HEADER.FIELDS ({' '.join(fields)})])")
        out = {}
        if typ != "OK": return out
        for it in d or []:
            if not isinstance(it, tuple): continue
            m = re.search(rb"UID (\d+)", it[0]); t = imaplib.Internaldate2tuple(it[0])
            if not m: continue
            h = email.message_from_bytes(it[1] or b"", policy=email.policy.default)
            vals = {}
            for k in fields:
                try: vals[k] = str(h.get(k) or "")
                except Exception: vals[k] = ""
            out[int(m.group(1))] = (time.mktime(t) if t else 0, vals)
        return out
    try: return c.run(fn)
    except Exception: return {}

def _norm_subj(v):
    try: v = str(email.header.make_header(email.header.decode_header(v)))
    except Exception: pass
    return re.sub(r"\s+", " ", v).strip().lower()

def _norm_to(v):
    return frozenset(a.lower() for _, a in email.utils.getaddresses([v]) if a)

def draft_cleanup_sent(c, folder):
    """Balu-Entwürfe entfernen, deren Mail bereits gesendet wurde (gleicher Betreff und Empfänger, danach gesendet)."""
    sent = c.special_folder("sent")
    if not sent: return 0
    drafts = {u: v for u, v in _hdr_infos(c, folder, None, ["X-Balu-Draft", "Subject", "To"]).items() if v[1]["X-Balu-Draft"]}
    if not drafts: return 0
    g = time.gmtime(min(t for t, _ in drafts.values()) - 86400)
    since = f"{g.tm_mday:02d}-{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][g.tm_mon - 1]}-{g.tm_year}"
    sent_msgs = [(t, _norm_subj(h["Subject"]), _norm_to(h["To"])) for t, h in _hdr_infos(c, sent, ("SINCE", since), ["Subject", "To"]).values()]
    gone = []
    for u, (t, h) in drafts.items():
        subj, to = _norm_subj(h["Subject"]), _norm_to(h["To"])
        if not to: continue
        if any(st >= t - 120 and ss == subj and sto == to for st, ss, sto in sent_msgs): gone.append(u)
    if gone: c.delete_forever(folder, sorted(gone))
    return len(gone)

def draft_cleanup(acc_id):
    """Aufräumen: von jedem Entwurf nur die neueste Fassung behalten (entfernt Mehrfach-Sicherungen)."""
    c = client(acc_id)
    if DEMO: return 0
    folder = c.special_folder("drafts")
    if not folder: return 0
    seen, extra = set(), []
    for u, k in sorted(draft_ids(c, folder).items(), reverse=True):
        if k in seen: extra.append(u)
        else: seen.add(k)
    if extra: c.delete_forever(folder, sorted(extra))
    try: extra += [0] * draft_cleanup_sent(c, folder)
    except Exception: pass
    return len(extra)

def share_take(sid):
    """Handy: von einer anderen App geteilte Dateien abholen (die App legt sie unter teilen/<id>/ ab)."""
    if not re.fullmatch(r"[0-9a-f]{8,40}", str(sid or "")): raise RuntimeError("Ungültige Kennung")
    base = os.path.join(os.path.dirname(os.path.abspath(CONFIG_FILE)), "teilen")
    d = os.path.join(base, sid)
    atts, skipped = [], []
    try:
        with open(os.path.join(d, "dateien.json"), encoding="utf-8") as f: meta = json.load(f)
    except Exception: meta = []
    total = 0
    for m in meta:
        if m.get("too_big"): skipped.append(m.get("name") or "Datei"); continue
        if not m.get("file"): continue
        fp = os.path.join(d, os.path.basename(m.get("file") or ""))
        try: size = os.path.getsize(fp)
        except OSError: continue
        name = m.get("name") or os.path.basename(fp)
        if size > 25 * 1048576 or total + size > 40 * 1048576: skipped.append(name); continue
        total += size
        with open(fp, "rb") as f: data = base64.b64encode(f.read()).decode()
        atts.append({"name": name, "size": size, "ctype": m.get("mime") or mimetypes.guess_type(name)[0] or "application/octet-stream", "data": data})
    shutil.rmtree(d, ignore_errors=True)
    try:                                         # Reste älterer Teilen-Vorgänge entfernen
        for x in os.listdir(base):
            p = os.path.join(base, x)
            if time.time() - os.path.getmtime(p) > 86400: shutil.rmtree(p, ignore_errors=True)
    except OSError: pass
    return {"attachments": atts, "skipped": skipped}

def open_url(url):
    """Handy: Link im Browser bzw. in der passenden App öffnen (Android-Intent)."""
    url = str(url or "").strip()
    if not re.match(r"(?i)^(https?|tel|sms|geo):", url) or len(url) > 8000: raise RuntimeError("Ungültiger Link")
    if not ANDROID:
        webbrowser.open(url); return {"ok": True}
    from java import jclass, cast
    try:
        if jclass("de.balumail.app.Updater").openUrl(url): return {"ok": True}
    except Exception: pass
    Intent, Uri = jclass("android.content.Intent"), jclass("android.net.Uri")
    plat = jclass("com.chaquo.python.Python").getPlatform()
    app = cast(jclass("com.chaquo.python.android.AndroidPlatform"), plat).getApplication()
    i = Intent(Intent.ACTION_VIEW, Uri.parse(url))
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    app.startActivity(i)
    return {"ok": True}

def draft_cleanup_all():
    if STOP.wait(20): return
    for a in load_accounts():
        try:
            n = draft_cleanup(a["id"])
            if n: say(f"Entwürfe aufgeräumt ({a.get('email')}): {n} ältere Fassungen entfernt")
        except Exception: pass

def _apply_order(accs, order):
    """Konten nach gespeicherter Reihenfolge (Liste von E-Mail-Adressen) sortieren; unbekannte bleiben hinten."""
    if not order: return accs
    pos = {e: i for i, e in enumerate(order)}
    return sorted(accs, key=lambda a: pos.get((a.get("email") or "").lower(), len(pos)))

def reorder_accounts(ids):
    """Neue Reihenfolge der Konten speichern (ids = Konto-IDs in gewünschter Reihenfolge)."""
    ids = [str(x) for x in (ids or [])]
    pos = {i: n for n, i in enumerate(ids)}
    key = lambda a: pos.get(a["id"], len(pos))
    if DEMO:
        _demo_accs.sort(key=key)
        return [public_account(a) for a in _demo_accs]
    with _acc_lock:
        accs = sorted(load_accounts(), key=key)
        save_accounts(accs)
        cfg = load_config()
        cfg["acc_order"] = [(a.get("email") or "").lower() for a in accs]
        cfg["acc_order_updated"] = time.time()
        save_config(cfg)
    sync_soon()
    return [public_account(a) for a in accs]

def public_account(a):
    return {k: a.get(k) for k in ("id", "name", "email", "color", "identities", "auth",
                                  "imap_host", "imap_port", "smtp_host", "smtp_port", "user", "save_sent")}


CONFIG_FILE = os.path.join(data_dir(), "einstellungen.json")

LOGOS = ("balu", "leuchten", "siegel", "stempel", "origami")   # Programm-Symbole; "balu" ist der Standard

def cur_logo():
    l = load_config().get("logo") or "balu"
    return l if l in LOGOS else "balu"

def logo_apply(lg=None):
    """Gewähltes Symbol auch außerhalb des Fensters zeigen: Windows-Verknüpfungen bzw. Android-App-Symbol."""
    lg = lg or cur_logo()
    try:
        if ANDROID:
            from java import jclass
            jclass("de.balumail.app.AppIcon").set(lg)
        elif os.name == "nt":
            _logo_windows(lg)
    except Exception as e:
        print("Programm-Symbol:", e)

def logo_startup():
    """Beim Start einmal je Version/Symbol: Verknüpfungen bzw. App-Symbol angleichen (z. B. nach Updates)."""
    time.sleep(5)
    if DEMO: return
    lg, cfg = cur_logo(), load_config()
    mark = f"{lg}:{VERSION}"
    if cfg.get("logo_applied") == mark: return
    logo_apply(lg)
    cfg = load_config(); cfg["logo_applied"] = mark; save_config(cfg)

def _logo_windows(lg):
    src = os.path.join(WEB_DIR, "icons", "logos", lg + ".ico")
    if not os.path.isfile(src): return
    ico = os.path.join(data_dir(), f"symbol-{lg}.ico")   # eigener Name je Symbol, damit Windows den Symbol-Speicher erneuert
    if not os.path.isfile(ico): shutil.copyfile(src, ico)
    ps = r"""
$ico = $env:BALU_ICO
$sh = New-Object -ComObject WScript.Shell
$dirs = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('CommonPrograms'),
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar", "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\ImplicitAppShortcuts")
foreach ($d in $dirs) { if (Test-Path $d) { Get-ChildItem -Path $d -Filter *.lnk -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
  try { $l = $sh.CreateShortcut($_.FullName)
    if ($l.TargetPath -like '*Balu-Mail.exe' -or $l.Arguments -like '*127.0.0.1:8025*' -or $_.BaseName -like 'Balu-Mail*') {
      if ($l.IconLocation -ne "$ico,0") { $l.IconLocation = "$ico,0"; $l.Save() } } } catch {} } } }
try { Start-Process -WindowStyle Hidden ie4uinit.exe -ArgumentList '-show' } catch {}
"""
    env = dict(os.environ, BALU_ICO=ico)
    subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
                   env=env, creationflags=0x08000000, timeout=60, capture_output=True)

def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f: return json.load(f)
    except Exception:
        return {}

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f: json.dump(cfg, f, ensure_ascii=False, indent=2)

def http(url, data=None, timeout=8, headers=None):
    import urllib.request, urllib.parse
    body = urllib.parse.urlencode(data).encode() if isinstance(data, dict) else data
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "Balu-Mail/" + VERSION, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx()) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

# ---- Automatische Servererkennung (wie Thunderbird) ----
def _parse_autoconfig(xml_bytes, email_addr):
    import xml.etree.ElementTree as ET
    root = ET.fromstring(xml_bytes)
    local, _, domain = email_addr.partition("@")
    def sub(v): return (v or "").replace("%EMAILADDRESS%", email_addr).replace("%EMAILLOCALPART%", local).replace("%EMAILDOMAIN%", domain)
    prov = root.find("emailProvider")
    if prov is None: return None
    def pick(tag, typ):
        best = None
        for srv in prov.findall(tag):
            if srv.get("type") != typ: continue
            sock = (srv.findtext("socketType") or "").upper()
            cand = {"host": sub(srv.findtext("hostname")), "port": int(srv.findtext("port") or 0), "sock": sock,
                    "user": sub(srv.findtext("username")), "auth": srv.findtext("authentication") or ""}
            if best is None or (sock in ("SSL", "STARTTLS") and best["sock"] not in ("SSL", "STARTTLS")):
                best = cand
        return best
    imap, smtp = pick("incomingServer", "imap"), pick("outgoingServer", "smtp")
    if not imap or not smtp: return None
    oauth = "OAuth2" in (imap["auth"] + smtp["auth"])
    return {"imap_host": imap["host"], "imap_port": imap["port"] or 993, "smtp_host": smtp["host"], "smtp_port": smtp["port"] or 587,
            "user": imap["user"] or email_addr, "oauth_possible": oauth, "source": "autoconfig"}

def mx_hosts(domain):
    try:
        st, b = http("https://dns.google/resolve?name=" + domain + "&type=MX", timeout=6)
        if st == 200:
            ans = json.loads(b).get("Answer") or []
            return [a["data"].split()[-1].rstrip(".").lower() for a in sorted(ans, key=lambda a: int(a["data"].split()[0]))]
    except Exception:
        pass
    return []

MS_HOSTS = ("outlook.com", "hotmail.com", "live.com", "live.de", "msn.com", "hotmail.de", "outlook.de")

def autoconfig(email_addr):
    email_addr = email_addr.strip()
    domain = email_addr.partition("@")[2].lower()
    if not domain: raise ValueError("Ungültige E-Mail-Adresse")
    ms = {"imap_host": "outlook.office365.com", "imap_port": 993, "smtp_host": "smtp-mail.outlook.com", "smtp_port": 587,
          "user": email_addr, "oauth_possible": True, "microsoft": True, "source": "microsoft"}
    if domain in MS_HOSTS: return ms
    urls = [f"https://autoconfig.{domain}/mail/config-v1.1.xml?emailaddress={email_addr}",
            f"https://{domain}/.well-known/autoconfig/mail/config-v1.1.xml?emailaddress={email_addr}",
            f"https://autoconfig.thunderbird.net/v1.1/{domain}"]
    for u in urls:
        try:
            st, b = http(u, timeout=6)
            if st == 200:
                r = _parse_autoconfig(b, email_addr)
                if r: return r
        except Exception:
            continue
    mx = mx_hosts(domain)
    if mx:
        if any(h.endswith("protection.outlook.com") for h in mx):
            ms["note"] = "Ihre Domain nutzt Microsoft 365."; return ms
        base = ".".join(mx[0].split(".")[-2:])
        if base != domain:
            try:
                st, b = http(f"https://autoconfig.thunderbird.net/v1.1/{base}", timeout=6)
                if st == 200:
                    r = _parse_autoconfig(b, email_addr)
                    if r: r["source"] = "mx"; return r
            except Exception:
                pass
    # letzte Möglichkeit: übliche Namen raten
    return {"imap_host": "imap." + domain, "imap_port": 993, "smtp_host": "smtp." + domain, "smtp_port": 587,
            "user": email_addr, "source": "guess"}

# ---- Microsoft-Anmeldung (OAuth2, Gerätecode-Verfahren) ----
MS_SCOPE = "https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access"
MS_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0/"
_ms_flows = {}
_ms_tokens = {}

MS_ID_RE = re.compile(r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$")

def valid_ms_id(cid):
    return bool(MS_ID_RE.match((cid or "").strip()))

def ms_client_id():
    cid = load_config().get("ms_client_id", "").strip()
    if not valid_ms_id(cid): raise RuntimeError("Für Microsoft-Konten fehlt noch die App-ID (siehe Konten & Einstellungen).")
    return cid

def ms_start():
    st, b = http(MS_BASE + "devicecode", {"client_id": ms_client_id(), "scope": MS_SCOPE})
    j = json.loads(b or b"{}")
    if st != 200: raise RuntimeError(j.get("error_description", "Microsoft-Anmeldung konnte nicht gestartet werden"))
    fid = secrets.token_hex(8)
    _ms_flows[fid] = {"device_code": j["device_code"], "interval": j.get("interval", 5), "refresh": None}
    return {"flow": fid, "code": j["user_code"], "url": j["verification_uri"]}

def ms_poll(fid):
    f = _ms_flows.get(fid)
    if not f: raise KeyError("Anmeldevorgang abgelaufen")
    if f["refresh"]: return {"status": "ok"}
    st, b = http(MS_BASE + "token", {"client_id": ms_client_id(), "grant_type": "urn:ietf:params:oauth:grant-type:device_code", "device_code": f["device_code"]})
    j = json.loads(b or b"{}")
    if st == 200 and j.get("refresh_token"):
        f["refresh"] = j["refresh_token"]; return {"status": "ok"}
    err = j.get("error", "")
    if err in ("authorization_pending", "slow_down"): return {"status": "pending"}
    return {"status": "error", "error": j.get("error_description", err or "Anmeldung fehlgeschlagen")}

def ms_access_token(acc):
    cached = _ms_tokens.get(acc["id"])
    if cached and cached[1] > time.time() + 60: return cached[0]
    st, b = http(MS_BASE + "token", {"client_id": ms_client_id(), "grant_type": "refresh_token",
                                      "refresh_token": dec_pw(acc["refresh_token"]), "scope": MS_SCOPE})
    j = json.loads(b or b"{}")
    if st != 200: raise RuntimeError("Microsoft-Anmeldung abgelaufen – bitte Konto neu anmelden. (" + j.get("error", "") + ")")
    _ms_tokens[acc["id"]] = (j["access_token"], time.time() + int(j.get("expires_in", 3600)))
    if j.get("refresh_token") and acc.get("id") and not acc.get("_temp"):
        with _acc_lock:
            accs = load_accounts()
            for a in accs:
                if a["id"] == acc["id"]: a["refresh_token"] = enc_pw(j["refresh_token"]); acc["refresh_token"] = a["refresh_token"]
            save_accounts(accs)
    return j["access_token"]

# ---- Google-Anmeldung (für den Kalender-Abgleich in beide Richtungen) ----
_GT = os.environ.get("BALU_GOOGLE_TEST", "")          # nur für Tests: alle Google-Adressen auf einen Testserver
G_AUTH = (_GT or "https://accounts.google.com") + "/o/oauth2/v2/auth"
G_TOKEN = (_GT or "https://oauth2.googleapis.com") + "/token"
G_API = _GT or "https://www.googleapis.com"
G_DAV = _GT or "https://apidata.googleusercontent.com"
G_SCOPE = "openid email https://www.googleapis.com/auth/calendar"
_g_flows = {}
_g_tokens = {}

def g_client():
    cfg = load_config()
    cid, sec = (cfg.get("google_client_id") or "").strip(), (cfg.get("google_client_secret") or "").strip()
    if not cid.endswith(".apps.googleusercontent.com") or not sec:
        raise RuntimeError("GOOGLE_SETUP")
    return cid, sec

def g_start(origin):
    cid, _ = g_client()
    state, verifier = secrets.token_urlsafe(16), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    redirect = origin.rstrip("/") + "/oauth/google"
    _g_flows[state] = {"verifier": verifier, "redirect": redirect, "t": time.time(), "email": None, "error": None}
    from urllib.parse import urlencode
    q = urlencode({"client_id": cid, "redirect_uri": redirect, "response_type": "code", "scope": G_SCOPE,
                   "access_type": "offline", "prompt": "consent", "state": state,
                   "code_challenge": challenge, "code_challenge_method": "S256"})
    return {"url": G_AUTH + "?" + q, "state": state}

def g_finish(state, code, error=None):
    f = _g_flows.get(state)
    if not f: raise RuntimeError("Der Anmeldevorgang ist abgelaufen – bitte noch einmal starten.")
    if error:
        f["error"] = "Anmeldung abgebrochen." if error == "access_denied" else "Google meldet: " + error
        return f
    cid, sec = g_client()
    st, b = http(G_TOKEN, {"code": code, "client_id": cid, "client_secret": sec, "redirect_uri": f["redirect"],
                           "grant_type": "authorization_code", "code_verifier": f["verifier"]})
    j = json.loads(b or b"{}")
    if st != 200 or not j.get("refresh_token"):
        f["error"] = "Google-Anmeldung fehlgeschlagen: " + (j.get("error_description") or j.get("error") or f"Fehler {st}")
        return f
    try:
        payload = j["id_token"].split(".")[1]
        email_addr = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["email"].lower()
    except Exception:
        email_addr = "google"
    with _acc_lock:
        cfg = load_config()
        cfg.setdefault("google_tokens", {})[email_addr] = enc_pw(j["refresh_token"])
        cfg["google_tokens_updated"] = time.time()
        save_config(cfg)
    sync_soon()
    _g_tokens[email_addr] = (j["access_token"], time.time() + int(j.get("expires_in", 3600)))
    f["email"] = email_addr
    return f

def g_access(email_addr):
    cached = _g_tokens.get(email_addr)
    if cached and cached[1] > time.time() + 60: return cached[0]
    rt = load_config().get("google_tokens", {}).get(email_addr)
    if not rt: raise RuntimeError("Google-Anmeldung fehlt – bitte den Kalender neu verbinden.")
    cid, sec = g_client()
    st, b = http(G_TOKEN, {"client_id": cid, "client_secret": sec, "grant_type": "refresh_token", "refresh_token": dec_pw(rt)})
    j = json.loads(b or b"{}")
    if st != 200:
        raise RuntimeError("Google-Anmeldung abgelaufen – bitte im Kalender bei „Kalender hinzufügen“ neu mit Google anmelden.")
    _g_tokens[email_addr] = (j["access_token"], time.time() + int(j.get("expires_in", 3600)))
    return j["access_token"]

def g_calendars(email_addr):
    tok = g_access(email_addr)
    req = urllib.request.Request(G_API + "/calendar/v3/users/me/calendarList?minAccessRole=reader",
                                 headers={"Authorization": "Bearer " + tok, "User-Agent": "Balu-Mail/" + VERSION})
    try:
        with urllib.request.urlopen(req, context=ssl_ctx(), timeout=20) as r:
            items = json.loads(r.read().decode()).get("items", [])
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", "replace")
        if "accessNotConfigured" in msg or "has not been used" in msg or "disabled" in msg:
            raise RuntimeError("In deinem Google-Cloud-Projekt ist die „Google Calendar API“ noch nicht aktiviert.")
        raise RuntimeError(f"Google-Kalender konnten nicht gelesen werden (Fehler {e.code}).")
    from urllib.parse import quote
    out = []
    for it in items:
        if it.get("deleted"): continue
        out.append({"url": G_DAV + "/caldav/v2/" + quote(it["id"], safe="@.") + "/events/",
                    "name": it.get("summaryOverride") or it.get("summary") or it["id"], "color": (it.get("backgroundColor") or "")[:7],
                    "readonly": it.get("accessRole") not in ("owner", "writer"), "google": email_addr})
    return out

def xoauth2(user, token):
    return f"user={user}\x01auth=Bearer {token}\x01\x01"

def imap_login(c, a):
    user = a.get("user") or a["email"]
    if a.get("auth") == "oauth_ms":
        tok = ms_access_token(a)
        c.authenticate("XOAUTH2", lambda _: xoauth2(user, tok).encode())
    else:
        c.login(user, dec_pw(a["password"]))

def smtp_open(a, timeout=60):
    port = int(a.get("smtp_port") or 587); ctx = ssl_ctx()
    if port == 465:
        s = smtplib.SMTP_SSL(a["smtp_host"], port, context=ctx, timeout=timeout)
    else:
        s = smtplib.SMTP(a["smtp_host"], port, timeout=timeout); s.ehlo(); s.starttls(context=ctx); s.ehlo()
    user = a.get("user") or a["email"]
    if a.get("auth") == "oauth_ms":
        tok = ms_access_token(a)
        s.auth("XOAUTH2", lambda challenge=None: xoauth2(user, tok), initial_response_ok=True)
    else:
        s.login(user, dec_pw(a["password"]))
    return s

# --------------------------------------------------------------------------
# IMAP-Hilfen
# --------------------------------------------------------------------------
def mutf7_decode(s: str) -> str:
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "&":
            j = s.index("-", i)
            chunk = s[i + 1:j]
            if chunk == "":
                out.append("&")
            else:
                b = chunk.replace(",", "/")
                b += "=" * (-len(b) % 4)
                out.append(base64.b64decode(b).decode("utf-16-be"))
            i = j + 1
        else:
            out.append(c); i += 1
    return "".join(out)

def mutf7_encode(s: str) -> str:
    out, buf = [], []
    def flush():
        if buf:
            b = base64.b64encode("".join(buf).encode("utf-16-be")).decode().rstrip("=").replace("/", ",")
            out.append("&" + b + "-"); buf.clear()
    for c in s:
        if 0x20 <= ord(c) <= 0x7e:
            flush()
            out.append("&-" if c == "&" else c)
        else:
            buf.append(c)
    flush()
    return "".join(out)

def q(name: str) -> str:
    n = mutf7_encode(name)
    return '"' + n.replace("\\", "\\\\").replace('"', '\\"') + '"'

SPECIAL_NAMES = {
    "trash":  ["papierkorb", "gelöscht", "geloescht", "trash", "deleted items", "deleted", "[gmail]/papierkorb", "[gmail]/trash", "bin"],
    "junk":   ["spamverdacht", "spam", "junk", "junk-e-mail", "junk e-mail", "[gmail]/spam"],
    "sent":   ["gesendet", "gesendete objekte", "gesendete elemente", "sent", "sent items", "sent messages", "[gmail]/gesendet", "[gmail]/sent mail"],
    "drafts": ["entwürfe", "entwuerfe", "drafts", "[gmail]/entwürfe", "[gmail]/drafts"],
    "archive": ["archiv", "archive", "[gmail]/alle nachrichten", "[gmail]/all mail"],
}
SPECIAL_FLAGS = {"\\trash": "trash", "\\junk": "junk", "\\sent": "sent", "\\drafts": "drafts", "\\archive": "archive", "\\all": "archive"}

LIST_RE = re.compile(r'\((?P<flags>[^)]*)\) (?P<delim>"(?:[^"\\]|\\.)*"|NIL) (?P<name>.*)$')

def parse_list(data):
    res = []
    for item in data:
        if item is None:
            continue
        if isinstance(item, tuple):
            m = LIST_RE.match(item[0].decode("utf-8", "replace").strip())
            if not m: continue
            name = item[1].decode("utf-8", "replace")
        else:
            m = LIST_RE.match(item.decode("utf-8", "replace").strip())
            if not m: continue
            name = m.group("name").strip()
            if name.startswith('"') and name.endswith('"'):
                name = re.sub(r'\\(.)', r'\1', name[1:-1])
        delim = m.group("delim")
        delim = None if delim == "NIL" else delim[1:-1].replace("\\\\", "\\")
        flags = [f.lower() for f in m.group("flags").split()]
        res.append({"raw": name, "path": mutf7_decode(name), "delim": delim, "flags": flags})
    return res

FETCH_UID = re.compile(rb"UID (\d+)")
FETCH_FLAGS = re.compile(rb"FLAGS \(([^)]*)\)")
FETCH_DATE = re.compile(rb'INTERNALDATE "([^"]+)"')
FETCH_SIZE = re.compile(rb"RFC822\.SIZE (\d+)")

def parse_fetch(data):
    recs, cur = [], None
    for item in data:
        if isinstance(item, tuple):
            cur = {"meta": item[0], "body": item[1]}
            recs.append(cur)
        elif isinstance(item, bytes) and cur is not None:
            cur["meta"] += item
        elif isinstance(item, bytes):
            recs.append({"meta": item, "body": b""})
    out = []
    for r in recs:
        m = FETCH_UID.search(r["meta"])
        if not m: continue
        f = FETCH_FLAGS.search(r["meta"])
        d = FETCH_DATE.search(r["meta"])
        s = FETCH_SIZE.search(r["meta"])
        out.append({
            "uid": int(m.group(1)),
            "flags": f.group(1).decode().split() if f else [],
            "internaldate": d.group(1).decode() if d else None,
            "size": int(s.group(1)) if s else 0,
            "body": r["body"],
        })
    return out

def addr_list(hval):
    try:
        return [{"name": a.display_name or "", "email": a.addr_spec or ""} for a in hval.addresses]
    except Exception:
        s = str(hval or "")
        return [{"name": n, "email": e} for n, e in email.utils.getaddresses([s])] if s else []

def safe_header(msg, name):
    try:
        v = msg[name]
        return v
    except Exception:
        raw = msg.get_all(name, failobj=[None])[0] if hasattr(msg, "get_all") else None
        return raw

def to_iso(datehdr, internal):
    try:
        if datehdr:
            d = email.utils.parsedate_to_datetime(str(datehdr))
            if d.tzinfo is None: d = d.replace(tzinfo=dt.timezone.utc)
            return d.isoformat()
    except Exception:
        pass
    try:
        if internal:
            t = imaplib.Internaldate2tuple(b'INTERNALDATE "' + internal.encode() + b'"')
            return dt.datetime.fromtimestamp(time.mktime(t)).astimezone().isoformat()
    except Exception:
        pass
    return dt.datetime.now().astimezone().isoformat()

def summarize(acc_id, folder, rec):
    hdr = email.message_from_bytes(rec["body"] or b"", policy=email.policy.default)
    frm = addr_list(safe_header(hdr, "From"))
    to = addr_list(safe_header(hdr, "To"))
    ctype = str(safe_header(hdr, "Content-Type") or "").lower()
    flags = [f.lower() for f in rec["flags"]]
    return {
        "acc": acc_id, "folder": folder, "uid": rec["uid"],
        "from": frm[0] if frm else {"name": "", "email": ""},
        "to": to,
        "subject": str(safe_header(hdr, "Subject") or ""),
        "date": to_iso(safe_header(hdr, "Date"), rec["internaldate"]),
        "seen": "\\seen" in flags, "flagged": "\\flagged" in flags, "answered": "\\answered" in flags,
        "attachment": "multipart/mixed" in ctype, "size": rec["size"],
    }

# --------------------------------------------------------------------------
# Nachricht aufbereiten (HTML sicher anzeigen)
# --------------------------------------------------------------------------
def strip_dangerous(h: str) -> str:
    h = re.sub(r"(?is)<(script|iframe|object|embed|form|base|meta)[^>]*>.*?</\1\s*>", "", h)
    h = re.sub(r"(?is)<(script|iframe|object|embed|form|base|meta|link)[^>]*/?>", "", h)
    h = re.sub(r'(?i)\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)', "", h)
    h = re.sub(r'(?i)(href|src)\s*=\s*(["\']?)\s*javascript:', r'\1=\2#', h)
    return h

def text_to_html(t: str) -> str:
    esc = html.escape(t)
    esc = re.sub(r"(https?://[^\s<]+)", r'<a href="\1">\1</a>', esc)
    return '<div style="white-space:pre-wrap;font-family:inherit">' + esc + "</div>"

def build_message(acc_id, folder, uid, raw: bytes, flags):
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    body_html, body_text = None, None
    try:
        part = msg.get_body(preferencelist=("html",))
        if part is not None: body_html = part.get_content()
    except Exception:
        pass
    try:
        part = msg.get_body(preferencelist=("plain",))
        if part is not None: body_text = part.get_content()
    except Exception:
        pass
    attachments, idx = [], 0
    for part in msg.walk():
        if part.is_multipart():
            continue
        disp = part.get_content_disposition()
        ctype = part.get_content_type()
        fname = part.get_filename()
        cid = (part.get("Content-ID") or "").strip("<> ")
        is_body = part is not None and disp is None and ctype in ("text/plain", "text/html") and not fname
        if not is_body:
            try:
                payload = part.get_payload(decode=True) or b""
            except Exception:
                payload = b""
            attachments.append({"idx": idx, "name": fname or (("eingebettet-" + str(idx)) + (mimetypes.guess_extension(ctype) or "")),
                                "ctype": ctype, "size": len(payload), "cid": cid,
                                "inline": disp == "inline" or (bool(cid) and not fname)})
        idx += 1
    if body_html:
        content = strip_dangerous(body_html)
        from urllib.parse import quote
        folder_q = quote(folder)
        def repl(m):
            c = m.group(2)
            for a in attachments:
                if a["cid"] == c:
                    return m.group(1) + f'/api/attachment?acc={acc_id}&folder={folder_q}&uid={uid}&idx={a["idx"]}&t=__BMT__'   # Schlüssel setzt die Oberfläche ein (PC: Programm-, Webseite: Sitzungsschlüssel)
            return m.group(0)
        content = re.sub(r'(src=["\']?)cid:([^"\'\s>]+)', repl, content)
        has_remote = bool(re.search(r'(?i)(src|background)\s*=\s*["\']?https?:|url\(\s*["\']?https?:', content))
    else:
        content = text_to_html(body_text or "")
        has_remote = False
    hdr = lambda n: str(safe_header(msg, n) or "")
    fl = [f.lower() for f in flags]
    return {
        "acc": acc_id, "folder": folder, "uid": uid,
        "subject": hdr("Subject"), "from": (addr_list(safe_header(msg, "From")) or [{"name": "", "email": ""}])[0],
        "to": addr_list(safe_header(msg, "To")), "cc": addr_list(safe_header(msg, "Cc")),
        "reply_to": addr_list(safe_header(msg, "Reply-To")),
        "date": to_iso(safe_header(msg, "Date"), None),
        "message_id": hdr("Message-ID"), "references": hdr("References"),
        "draft_id": hdr("X-Balu-Draft"), "in_reply_to": hdr("In-Reply-To"), "bcc": addr_list(safe_header(msg, "Bcc")),
        "html": content, "text": body_text or "", "has_remote": has_remote,
        "attachments": [a for a in attachments if not (a["inline"] and a["cid"] and a["cid"] in (body_html or ""))],
        "seen": True, "flagged": "\\flagged" in fl,
        "invite": invite_from_message(msg),
    }

def get_attachment(raw: bytes, idx: int):
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    i = 0
    for part in msg.walk():
        if part.is_multipart():
            continue
        if i == idx:
            return part.get_content_type(), part.get_filename() or f"anhang-{idx}", part.get_payload(decode=True) or b""
        i += 1
    raise KeyError("Anhang nicht gefunden")

# --------------------------------------------------------------------------
# Echte IMAP-Verbindung je Konto
# --------------------------------------------------------------------------
class ImapAccount:
    def __init__(self, acc):
        self.acc = acc
        self.lock = threading.RLock()
        self.conn = None
        self.selected = None
        self.last = 0
        self.folders = None

    def _connect(self):
        a = self.acc
        port = int(a.get("imap_port") or 993)
        ctx = ssl_ctx()
        if port == 143:
            c = imaplib.IMAP4(a["imap_host"], port, timeout=30); c.starttls(ctx)
        else:
            c = imaplib.IMAP4_SSL(a["imap_host"], port, ssl_context=ctx, timeout=30)
        imap_login(c, a)
        self.conn, self.selected, self.last = c, None, time.time()
        self.caps = set(x.upper() for x in c.capabilities)

    def run(self, fn):
        with self.lock:
            for attempt in (1, 2):
                try:
                    if self.conn is None:
                        self._connect()
                    elif time.time() - self.last > 120:
                        self.conn.noop()
                    r = fn(self.conn)
                    self.last = time.time()
                    return r
                except (imaplib.IMAP4.abort, OSError, ssl.SSLError, EOFError):
                    try:
                        if self.conn: self.conn.shutdown()
                    except Exception:
                        pass
                    self.conn = None
                    if attempt == 2:
                        raise

    def select(self, c, folder):
        if self.selected != folder:
            typ, d = c.select(q(folder))
            if typ != "OK":
                raise RuntimeError(f"Ordner „{folder}“ nicht gefunden")
            self.selected = folder

    def list_folders(self):
        def fn(c):
            typ, d = c.list()
            items = parse_list(d)
            out = []
            for it in items:
                if "\\noselect" in it["flags"] or "\\nonexistent" in it["flags"]:
                    special = None
                else:
                    special = None
                for f in it["flags"]:
                    if f in SPECIAL_FLAGS: special = SPECIAL_FLAGS[f]
                if it["path"].upper() == "INBOX": special = "inbox"
                if not special:
                    low = it["path"].lower()
                    leaf = low.split(it["delim"])[-1] if it["delim"] else low
                    for k, names in SPECIAL_NAMES.items():
                        if low in names or leaf in names:
                            special = k; break
                unread = total = 0
                if "\\noselect" not in it["flags"]:
                    try:
                        typ, st = c.status(q(it["path"]), "(MESSAGES UNSEEN)")
                        s = st[0].decode() if st and st[0] else ""
                        m1 = re.search(r"MESSAGES (\d+)", s); m2 = re.search(r"UNSEEN (\d+)", s)
                        total = int(m1.group(1)) if m1 else 0; unread = int(m2.group(1)) if m2 else 0
                    except Exception:
                        pass
                if it["path"] == SYNC_FOLDER: continue
                out.append({"path": it["path"], "delim": it["delim"], "special": special,
                            "noselect": "\\noselect" in it["flags"], "unread": unread, "total": total})
            # Spezialordner nur einmal je Typ
            seen = set()
            for f in out:
                if f["special"] in seen and f["special"] != "inbox": f["special"] = None
                elif f["special"]: seen.add(f["special"])
            self.folders = out
            return out
        return self.run(fn)

    def special_folder(self, kind):
        if self.folders is None: self.list_folders()
        for f in self.folders:
            if f["special"] == kind: return f["path"]
        return None

    def messages(self, folder, page=0, filt=None, query=None):
        def fn(c):
            self.select(c, folder)
            crit = ["ALL"]
            if filt == "unread": crit = ["UNSEEN"]
            elif filt == "flagged": crit = ["FLAGGED"]
            if query:
                c.literal = query.encode("utf-8")
                typ, d = c.uid("SEARCH", "CHARSET", "UTF-8", *([] if crit == ["ALL"] else crit), "TEXT")
            else:
                typ, d = c.uid("SEARCH", *crit)
            uids = sorted((int(x) for x in (d[0] or b"").split()), reverse=True)
            chunk = uids[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]
            if not chunk:
                return {"items": [], "total": len(uids)}
            typ, d = c.uid("FETCH", ",".join(map(str, chunk)),
                           "(UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE CONTENT-TYPE)])")
            recs = parse_fetch(d)
            items = [summarize(self.acc["id"], folder, r) for r in recs]
            items.sort(key=lambda x: x["uid"], reverse=True)
            return {"items": items, "total": len(uids)}
        return self.run(fn)

    def raw(self, folder, uid):
        def fn(c):
            self.select(c, folder)
            typ, d = c.uid("FETCH", str(uid), "(UID FLAGS BODY.PEEK[])")
            recs = parse_fetch(d)
            if not recs: raise KeyError("Nachricht nicht gefunden")
            return recs[0]
        return self.run(fn)

    def message(self, folder, uid):
        r = self.raw(folder, uid)
        if "\\seen" not in [f.lower() for f in r["flags"]]:
            self.flags(folder, [uid], add=["\\Seen"])
        return build_message(self.acc["id"], folder, uid, r["body"], r["flags"])

    def flags(self, folder, uids, add=None, remove=None):
        def fn(c):
            self.select(c, folder)
            s = ",".join(map(str, uids))
            if add: c.uid("STORE", s, "+FLAGS.SILENT", "(" + " ".join(add) + ")")
            if remove: c.uid("STORE", s, "-FLAGS.SILENT", "(" + " ".join(remove) + ")")
        return self.run(fn)

    def move(self, folder, uids, target):
        if target in ("trash", "junk", "archive"):
            kind = target
            target = self.special_folder(kind)
            if not target:
                if kind == "trash":
                    return self.delete_forever(folder, uids)
                raise RuntimeError("Kein passender Ordner gefunden")
            if target == folder and kind == "trash":
                return self.delete_forever(folder, uids)
        def fn(c):
            self.select(c, folder)
            s = ",".join(map(str, uids))
            if "MOVE" in self.caps:
                typ, d = c.uid("MOVE", s, q(target))
                if typ == "OK": return
            c.uid("COPY", s, q(target))
            c.uid("STORE", s, "+FLAGS.SILENT", "(\\Deleted)")
            if "UIDPLUS" in self.caps: c.uid("EXPUNGE", s)
            else: c.expunge()
        return self.run(fn)

    def delete_forever(self, folder, uids):
        def fn(c):
            self.select(c, folder)
            s = ",".join(map(str, uids))
            c.uid("STORE", s, "+FLAGS.SILENT", "(\\Deleted)")
            if "UIDPLUS" in self.caps: c.uid("EXPUNGE", s)
            else: c.expunge()
        return self.run(fn)

    # ---- Ordnerverwaltung
    def _delim(self):
        if self.folders is None: self.list_folders()
        return next((f["delim"] for f in self.folders if f.get("delim")), "/") or "/"

    def _unselect(self, c, path=None):
        if self.selected and (path is None or self.selected == path or self.selected.startswith(path + self._delim())):
            try: c.close()
            except Exception: pass
            self.selected = None

    def _imap_ok(self, typ, d, what):
        if typ != "OK":
            msg = (d[0].decode(errors="replace") if d and isinstance(d[0], bytes) else str(d)) if d else ""
            raise RuntimeError(f"{what} fehlgeschlagen: {msg}".strip())

    def folder_create(self, path):
        def fn(c):
            typ, d = c.create(q(path)); self._imap_ok(typ, d, "Ordner anlegen")
            try: c.subscribe(q(path))
            except Exception: pass
        r = self.run(fn); self.folders = None; return r

    def folder_rename(self, path, new):
        def fn(c):
            self._unselect(c, path)
            typ, d = c.rename(q(path), q(new)); self._imap_ok(typ, d, "Umbenennen")
            try: c.subscribe(q(new))
            except Exception: pass
        r = self.run(fn); self.folders = None; return r

    def folder_delete(self, path):
        """Ordner samt Unterordnern und Inhalt endgültig löschen (tiefste zuerst)."""
        dl = self._delim()
        paths = [f["path"] for f in (self.folders or []) if f["path"].startswith(path + dl)]
        paths.sort(key=lambda x: x.count(dl), reverse=True)
        def fn(c):
            self._unselect(c, path)
            for p in paths + [path]:
                try: c.unsubscribe(q(p))
                except Exception: pass
                typ, d = c.delete(q(p)); self._imap_ok(typ, d, f"Löschen von „{p}“")
        r = self.run(fn); self.folders = None; return r

    def folder_empty(self, path):
        """Alle Mails eines Ordners endgültig löschen (Unterordner bleiben)."""
        def fn(c):
            self.selected = None
            typ, d = c.select(q(path)); self._imap_ok(typ, d, "Ordner öffnen")
            self.selected = path
            n = int((d[0] or b"0").decode() or 0) if d else 0
            if n:
                typ, d = c.store("1:*", "+FLAGS.SILENT", "(\\Deleted)"); self._imap_ok(typ, d, "Markieren")
                c.expunge()
            return n
        r = self.run(fn); self.folders = None; return r

    def append_to(self, path, msg_bytes, flags="(\\Seen)", when=None):
        def fn(c):
            typ, d = c.append(q(path), flags, when or imaplib.Time2Internaldate(time.time()), msg_bytes)
            self._imap_ok(typ, d, f"Ablegen in „{path}“")
        return self.run(fn)

    def move_to_account(self, folder, uids, dest, dest_path):
        """In einen Ordner eines anderen Kontos verschieben: kopieren (mit Flags), dann hier entfernen."""
        if dest_path in ("trash", "junk", "archive", "INBOX"):
            dest_path = "INBOX" if dest_path == "INBOX" else dest.special_folder(dest_path)
            if not dest_path: raise RuntimeError("Kein passender Ordner im Zielkonto")
        done = []
        for uid in uids:
            r = self.raw(folder, uid)
            fl = [f for f in r["flags"] if f.lower() not in ("\\recent", "\\deleted")]
            when = None
            try:   # Eingangsdatum beibehalten (aus dem Date-Kopf)
                m = re.search(rb"(?im)^Date:[ \t]*(.+)$", r["body"][:20000])
                if m: when = imaplib.Time2Internaldate(email.utils.parsedate_to_datetime(m.group(1).decode(errors="replace").strip()))
            except Exception: when = None
            dest.append_to(dest_path, r["body"], "(" + " ".join(fl) + ")", when)
            done.append(uid)
        if done: self.delete_forever(folder, done)

    def append(self, kind, msg_bytes, flags="(\\Seen)"):
        target = self.special_folder(kind)
        if not target: return
        def fn(c):
            typ, d = c.append(q(target), flags, imaplib.Time2Internaldate(time.time()), msg_bytes)
            m = re.search(rb"APPENDUID \d+ (\d+)", b" ".join(x for x in (d or []) if isinstance(x, bytes)))
            if target == self.selected:          # Ordner ist geöffnet: neue Nachricht sichtbar machen
                try: c.noop()
                except Exception: pass
            return int(m.group(1)) if m else None
        return self.run(fn)

    def send(self, em: EmailMessage, rcpts=None, dsn=False):
        """Senden; dsn=True fordert eine Übermittlungsbestätigung an. Rückgabe: False, wenn der Server das nicht kann."""
        a = self.acc
        s = smtp_open(a)
        dsn_ok = True
        try:
            if dsn:
                try: s.ehlo_or_helo_if_needed()
                except Exception: pass
                dsn_ok = s.has_extn("dsn")
            if dsn and dsn_ok:
                if not rcpts:
                    rcpts = [x for _, x in email.utils.getaddresses(em.get_all("To", []) + em.get_all("Cc", [])) if x]
                s.send_message(em, to_addrs=rcpts, mail_options=["RET=HDRS"], rcpt_options=["NOTIFY=SUCCESS,FAILURE,DELAY"])
            else:
                s.send_message(em, to_addrs=rcpts) if rcpts else s.send_message(em)
        finally:
            try: s.quit()
            except Exception: pass
        if a.get("save_sent", True):
            try:
                self.append("sent", em.as_bytes())
            except Exception:
                pass
        return dsn_ok

# --------------------------------------------------------------------------
# Demo-Konten (zum Ausprobieren ohne echte Zugangsdaten)
# --------------------------------------------------------------------------
class DemoAccount:
    def __init__(self, acc, mails):
        self.acc = acc
        self.boxes = {"INBOX": [], "Entwürfe": [], "Gesendet": [], "Spamverdacht": [], "Gelöscht": [], "Archiv": [], "Privat": [], "Privat/Rechnungen": []}
        self.special = {"INBOX": "inbox", "Entwürfe": "drafts", "Gesendet": "sent", "Spamverdacht": "junk", "Gelöscht": "trash", "Archiv": "archive"}
        self.next_uid = 1
        for folder, m in mails:
            self._add(folder, m)

    def _add(self, folder, m):
        m = dict(m); m["uid"] = self.next_uid; self.next_uid += 1
        m.setdefault("flags", [])
        self.boxes[folder].append(m)
        return m

    def list_folders(self):
        out = []
        for p, ms in self.boxes.items():
            out.append({"path": p, "delim": "/", "special": self.special.get(p), "noselect": False,
                        "unread": sum(1 for m in ms if "\\Seen" not in m["flags"]), "total": len(ms)})
        return out

    def special_folder(self, kind):
        for p, k in self.special.items():
            if k == kind: return p

    def _delim(self): return "/"
    def folder_create(self, path):
        if path in self.boxes: raise RuntimeError("Diesen Ordner gibt es schon.")
        self.boxes[path] = []
    def folder_rename(self, path, new):
        for p in [x for x in list(self.boxes) if x == path or x.startswith(path + "/")]:
            self.boxes[new + p[len(path):]] = self.boxes.pop(p)
    def folder_delete(self, path):
        for p in [x for x in list(self.boxes) if x == path or x.startswith(path + "/")]:
            self.boxes.pop(p)
    def folder_empty(self, path):
        n = len(self.boxes[path]); self.boxes[path] = []; return n

    def _sum(self, folder, m):
        return {"acc": self.acc["id"], "folder": folder, "uid": m["uid"], "from": m["from"], "to": m.get("to", []),
                "subject": m["subject"], "date": m["date"], "seen": "\\Seen" in m["flags"],
                "flagged": "\\Flagged" in m["flags"], "answered": "\\Answered" in m["flags"],
                "attachment": bool(m.get("attachments")), "size": len(m.get("body", ""))}

    def messages(self, folder, page=0, filt=None, query=None):
        ms = sorted(self.boxes[folder], key=lambda m: m["date"], reverse=True)
        if filt == "unread": ms = [m for m in ms if "\\Seen" not in m["flags"]]
        if filt == "flagged": ms = [m for m in ms if "\\Flagged" in m["flags"]]
        if query:
            ql = query.lower()
            ms = [m for m in ms if ql in (m["subject"] + m["from"]["name"] + m["from"]["email"] + m.get("body", "")).lower()]
        chunk = ms[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]
        return {"items": [self._sum(folder, m) for m in chunk], "total": len(ms)}

    def _find(self, folder, uid):
        for m in self.boxes[folder]:
            if m["uid"] == uid: return m
        raise KeyError("Nachricht nicht gefunden")

    def message(self, folder, uid):
        m = self._find(folder, uid)
        if "\\Seen" not in m["flags"]: m["flags"].append("\\Seen")
        body = m.get("html") or text_to_html(m.get("body", ""))
        return {"acc": self.acc["id"], "folder": folder, "uid": uid, "subject": m["subject"], "from": m["from"],
                "to": m.get("to", []), "cc": [], "reply_to": [], "date": m["date"], "message_id": f"<demo{uid}@balu-mail>",
                "references": "", "draft_id": m.get("draft_id", ""), "in_reply_to": "", "bcc": [],
                "html": strip_dangerous(body), "text": m.get("body", ""), "has_remote": False,
                "attachments": m.get("attachments", []), "seen": True, "flagged": "\\Flagged" in m["flags"],
                "invite": invite_from_message(email.message_from_string(
                    "Content-Type: text/calendar; method=REQUEST; charset=utf-8\n\n" + m["ics"], policy=email.policy.default)) if m.get("ics") else None}

    def flags(self, folder, uids, add=None, remove=None):
        for u in uids:
            m = self._find(folder, u)
            for f in add or []:
                if f not in m["flags"]: m["flags"].append(f)
            for f in remove or []:
                if f in m["flags"]: m["flags"].remove(f)

    def move(self, folder, uids, target):
        if target in ("trash", "junk", "archive"):
            kind = target; target = self.special_folder(kind)
            if kind == "trash" and target == folder:
                self.boxes[folder] = [m for m in self.boxes[folder] if m["uid"] not in uids]; return
        moving = [m for m in self.boxes[folder] if m["uid"] in uids]
        self.boxes[folder] = [m for m in self.boxes[folder] if m["uid"] not in uids]
        for m in moving:
            self._add(target, {k: v for k, v in m.items() if k != "uid"})

    def raw(self, folder, uid):
        m = self._find(folder, uid)
        return {"body": b"", "flags": m["flags"], "demo": m}

    def move_to_account(self, folder, uids, dest, dest_path):
        if dest_path in ("trash", "junk", "archive"): dest_path = dest.special_folder(dest_path)
        moving = [m for m in self.boxes[folder] if m["uid"] in uids]
        self.boxes[folder] = [m for m in self.boxes[folder] if m["uid"] not in uids]
        for m in moving:
            dest._add(dest_path, {k: v for k, v in m.items() if k != "uid"})

    def append(self, kind, msg_bytes, flags=None):
        pass

    def send(self, em: EmailMessage, rcpts=None, dsn=False):
        body = em.get_body(preferencelist=("plain",))
        self._add("Gesendet", {"from": {"name": self.acc["name"], "email": str(em["From"])}, "to": addr_list(em["To"]),
                               "subject": str(em["Subject"] or ""), "date": dt.datetime.now().astimezone().isoformat(),
                               "body": body.get_content() if body else "", "flags": ["\\Seen"]})

def demo_setup():
    now = dt.datetime.now().astimezone()
    d = lambda days, h=10, m=0: (now - dt.timedelta(days=days)).replace(hour=h, minute=m).isoformat()
    accs = [
        {"id": "demo1", "name": "Max Mustermann", "email": "max.mustermann@example.de", "color": "#1a6fe6", "identities": ["max@example.de"]},
        {"id": "demo2", "name": "Max Mustermann", "email": "max.privat@example.com", "color": "#e8710a", "identities": []},
        {"id": "demo3", "name": "Verein Musterdorf", "email": "vorstand@musterdorf-verein.de", "color": "#188038", "identities": []},
    ]
    html_mail = """<div style="font-family:Arial,sans-serif;font-size:14px">
<p>Hallo Max,</p><p>die Arbeiten für das <b>Fundament</b> starten am Montag. Bitte denken Sie an:</p>
<ul><li>Zufahrt freihalten</li><li>Stromanschluss bereitstellen</li><li>Schlüssel für das Gartentor</li></ul>
<p>Bei Fragen erreichen Sie uns unter <a href="https://example.com">example.com</a>.</p>
<p>Viele Grüße<br>Ihr Bau-Team</p></div>"""
    fun_mail = """<div data-balu-briefpapier="ballons" style="background-color:#FFF4E8;color:#3A2414;padding:28px 26px;border-radius:18px;font-size:16px;line-height:1.6">
<p>Hallo Max,</p><p>anbei ganz liebe Grüße – der Kuchen vom Wochenende war ruck, zuck weg!</p>
<p><span class="bm-st" style="display:inline-block;width:64px;height:64px;vertical-align:middle"><svg viewBox="0 0 24 24" width="64" height="64"><path fill="#FF5A7A" d="M12 21s-7.6-4.6-10-9.4C.4 8.3 2.4 4.5 6.1 4.5c2.3 0 3.4 1.2 5.9 3.6 2.5-2.4 3.6-3.6 5.9-3.6 3.7 0 5.7 3.8 4.1 7.1C19.6 16.4 12 21 12 21z"/></svg></span></p>
<p>Deine Oma Erna</p></div>"""
    sat = (now + dt.timedelta(days=(5 - now.weekday()) % 7 or 7)).strftime("%Y%m%d")
    invite_ics = ("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:grillen-demo@example.net\r\n"
                  f"DTSTART;TZID=Europe/Berlin:{sat}T170000\r\nDTEND;TZID=Europe/Berlin:{sat}T220000\r\n"
                  "SUMMARY:Grillen bei Anna\r\nLOCATION:Gartenweg 3\r\nORGANIZER;CN=Anna Beispiel:mailto:anna@example.net\r\n"
                  "ATTENDEE;CN=Max Mustermann;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:max.mustermann@example.de\r\n"
                  "SEQUENCE:0\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n")
    m1 = [
        ("INBOX", {"from": {"name": "Anna Beispiel", "email": "anna@example.net"}, "subject": "Einladung: Grillen bei Anna", "date": d(0, 16, 5),
                   "body": "Hallo Max,\n\nich lade dich zum Grillen ein – sag kurz Bescheid, ob du kommst!\n\nAnna", "ics": invite_ics}),
        ("INBOX", {"from": {"name": "Oma Erna", "email": "oma.erna@example.de"}, "subject": "Grüße mit Luftballons", "date": d(0, 15, 20), "html": fun_mail}),
        ("INBOX", {"from": {"name": "Hausarztpraxis Musterstadt", "email": "praxis@example.org"}, "subject": "AW: Anfrage „neuer Patient“", "date": d(0, 13, 57),
                   "body": "Hallo,\n\nwir nehmen ab Januar wieder neue Patienten auf. Bitte kommen Sie vorab bei uns vorbei, damit wir Ihre Versichertenkarte einlesen können.\n\nMit freundlichen Grüßen\nIhre Praxis"}),
        ("INBOX", {"from": {"name": "Noreply Baufirma", "email": "noreply@bau.example"}, "subject": "Jetzt vorbereiten für die Fundamentarbeiten", "date": d(3, 10, 30), "html": html_mail, "flags": ["\\Flagged"]}),
        ("INBOX", {"from": {"name": "Stadtwerke Musterstadt", "email": "service@stadtwerke.example"}, "subject": "Ihre Jahresabrechnung 2026 ist da", "date": d(5, 8, 12),
                   "body": "Sehr geehrter Herr Mustermann,\n\nanbei erhalten Sie Ihre Jahresabrechnung.\n\nIhre Stadtwerke",
                   "attachments": [{"idx": 0, "name": "Jahresabrechnung_2026.pdf", "ctype": "application/pdf", "size": 184320, "cid": "", "inline": False}], "flags": ["\\Seen"]}),
        ("INBOX", {"from": {"name": "Paketdienst", "email": "info@paket.example"}, "subject": "Ihre Sendung wird heute zugestellt", "date": d(6, 7, 45), "body": "Ihre Sendung 00340 4345 wird heute zwischen 10 und 14 Uhr zugestellt.", "flags": ["\\Seen"]}),
        ("INBOX", {"from": {"name": "Anna Beispiel", "email": "anna@example.net"}, "subject": "Grillen am Samstag?", "date": d(8, 19, 2), "body": "Hi Max,\n\nhast du Samstag Zeit? Wir wollen ab 17 Uhr grillen.\n\nLG Anna", "flags": ["\\Seen", "\\Answered"]}),
        ("INBOX", {"from": {"name": "Online-Shop", "email": "bestellung@shop.example"}, "subject": "Bestellbestätigung Nr. 4711", "date": d(12, 14, 20), "body": "Vielen Dank für Ihre Bestellung!", "flags": ["\\Seen"]}),
        ("Spamverdacht", {"from": {"name": "Gewinnspiel", "email": "win@spam.example"}, "subject": "Sie haben gewonnen!!!", "date": d(2), "body": "Klicken Sie hier …"}),
        ("Gesendet", {"from": {"name": "Max Mustermann", "email": "max.mustermann@example.de"}, "to": [{"name": "Anna Beispiel", "email": "anna@example.net"}], "subject": "Re: Grillen am Samstag?", "date": d(8, 20, 0), "body": "Klar, ich bringe Salat mit!", "flags": ["\\Seen"]}),
        ("Privat/Rechnungen", {"from": {"name": "Versicherung", "email": "kunde@versicherung.example"}, "subject": "Beitragsrechnung", "date": d(20), "body": "Ihre Beitragsrechnung.", "flags": ["\\Seen"]}),
    ]
    m2 = [
        ("INBOX", {"from": {"name": "Verein Musterdorf", "email": "info@musterdorf-verein.de"}, "subject": "Einladung Jahreshauptversammlung", "date": d(1, 18, 0), "body": "Liebe Mitglieder,\n\nwir laden herzlich ein …"}),
        ("INBOX", {"from": {"name": "Newsletter Technik", "email": "news@technik.example"}, "subject": "Die Neuheiten der Woche", "date": d(4, 6, 0), "body": "Neuheiten …", "flags": ["\\Seen"]}),
    ]
    m3 = [
        ("INBOX", {"from": {"name": "Kassenwart", "email": "kasse@musterdorf-verein.de"}, "subject": "Kassenbericht Q3", "date": d(0, 9, 15), "body": "Anbei der Kassenbericht.", "flags": []}),
    ]
    return accs, {"demo1": DemoAccount(accs[0], m1), "demo2": DemoAccount(accs[1], m2), "demo3": DemoAccount(accs[2], m3)}

# --------------------------------------------------------------------------
# Kontoverwaltung zur Laufzeit
# --------------------------------------------------------------------------
DEMO = "--demo" in sys.argv
_clients = {}
_demo_accs = []

def get_accounts():
    return _demo_accs if DEMO else load_accounts()

# ---- Zwischenspeicher der Mail-Listen (Seite 1): sofort anzeigen, dann frisch nachladen
LIST_CACHE, _list_lock = {}, threading.Lock()

def _list_file():
    return os.path.join(os.path.dirname(CONFIG_FILE), "listen-cache.json")

def _list_key(acc, folder, filt):
    return f"{acc}|{folder}|{filt or ''}"

def list_cache_load():
    try:
        with open(_list_file(), encoding="utf-8") as f: LIST_CACHE.update(json.load(f))
    except Exception:
        pass

def list_cache_put(acc, folder, filt, data):
    with _list_lock:
        LIST_CACHE[_list_key(acc, folder, filt)] = {"t": time.time(), "data": data}
        if ANDROID:   # Handy: auch nach Neustart der App sofort verfügbar
            try:
                keep = {k: v for k, v in LIST_CACHE.items() if k.endswith("|INBOX|") or k.split("|")[1] == "INBOX"}
                with open(_list_file() + ".tmp", "w", encoding="utf-8") as f: json.dump(keep, f, ensure_ascii=False)
                os.replace(_list_file() + ".tmp", _list_file())
            except Exception:
                pass

def list_messages(acc, folder, page=0, filt=None, query=None, cached=False):
    """Mail-Liste; cached=True liefert sofort den zuletzt geladenen Stand (oder {"miss": True})."""
    if cached:
        if page or query: return {"miss": True}
        with _list_lock: e = LIST_CACHE.get(_list_key(acc, folder, filt))
        return dict(e["data"], cached=e["t"]) if e else {"miss": True}
    data = client(acc).messages(folder, page, filt, query)
    if not page and not query: list_cache_put(acc, folder, filt, data)
    return data

def client(acc_id):
    if DEMO:
        return _clients[acc_id]
    with _acc_lock:
        if acc_id not in _clients:
            acc = next((a for a in load_accounts() if a["id"] == acc_id), None)
            if not acc: raise KeyError("Konto nicht gefunden")
            _clients[acc_id] = ImapAccount(acc)
        return _clients[acc_id]

def folders_of(acc_id):
    """Ordnerliste mit Zählern über eine eigene zweite Verbindung – blockiert das Laden der Mails nicht."""
    cl = client(acc_id)
    if DEMO or not isinstance(cl, ImapAccount): return cl.list_folders()
    tw = getattr(cl, "_twin", None)
    if tw is None:
        tw = cl._twin = ImapAccount(cl.acc)
    r = tw.list_folders()
    cl.folders = r
    return r

COLORS = ["#1a6fe6", "#e8710a", "#188038", "#a142f4", "#d93025", "#12b5cb", "#f9ab00", "#5f6368"]

def compose_defaults(cfg=None):
    c = (cfg or load_config()).get("compose") or {}
    return {"prio": bool(c.get("prio", False)), "dsn": bool(c.get("dsn", True)), "mdn": bool(c.get("mdn", True))}

def make_email(acc, data):
    em = EmailMessage()
    sender = data.get("from") or acc["email"]
    em["From"] = email.utils.formataddr((acc.get("name") or "", sender))
    for k, h in (("to", "To"), ("cc", "Cc")):
        if data.get(k): em[h] = data[k]
    em["Subject"] = data.get("subject", "")
    em["Date"] = email.utils.formatdate(localtime=True)
    em["Message-ID"] = email.utils.make_msgid(domain=sender.split("@")[-1])
    if data.get("priority") == "high":                 # Hohe Priorität (von allen gängigen Programmen verstanden)
        em["X-Priority"] = "1 (Highest)"; em["Importance"] = "High"; em["Priority"] = "urgent"
    if data.get("read_receipt"):                       # Lesebestätigung anfordern (MDN)
        em["Disposition-Notification-To"] = email.utils.formataddr((acc.get("name") or "", sender))
    if data.get("in_reply_to"):
        em["In-Reply-To"] = data["in_reply_to"]
        em["References"] = (data.get("references", "") + " " + data["in_reply_to"]).strip()
    em.set_content(data.get("text") or "")
    if data.get("html"):
        em.add_alternative('<html><body style="font-family:Arial,sans-serif;font-size:14px">' + data["html"] + "</body></html>", subtype="html")
    for att in data.get("attachments") or []:
        raw = base64.b64decode(att["data"])
        mt = (att.get("ctype") or mimetypes.guess_type(att["name"])[0] or "application/octet-stream").split("/", 1)
        em.add_attachment(raw, maintype=mt[0], subtype=mt[1] if len(mt) > 1 else "octet-stream", filename=att["name"])
    return em

def recipients(data):
    rs = []
    for k in ("to", "cc", "bcc"):
        rs += [e for _, e in email.utils.getaddresses([data.get(k) or ""]) if e]
    return rs

# --------------------------------------------------------------------------
# Automatische Updates – öffentliche GitHub-Releases (kein Schlüssel nötig)
# --------------------------------------------------------------------------
UPDATE_REPO = os.environ.get("BALU_UPDATE_REPO", "jschlo2201/balu-mail-app")
UPDATE_API = os.environ.get("BALU_UPDATE_API", "https://api.github.com")
UPDATE_TOKEN_URL = ""   # öffentliche Releases: kein Schlüssel nötig
ANDROID = False
LAST_HIT = 0.0
# Offene Programmfenster: Das zuletzt geöffnete bleibt, ältere schließen sich selbst
FENSTER = {}
_fenster_lock = threading.Lock()

def fenster_ping(fid, host=False):
    """Nur ein Fenster bleibt aktiv: das Programmfenster (Balu-Mail.exe) hat immer Vorrang, sonst das neueste."""
    now = time.time()
    with _fenster_lock:
        for k in [k for k, v in FENSTER.items() if now - v["seen"] > 12]:
            del FENSTER[k]
        f = FENSTER.setdefault(fid, {"born": now, "seen": now, "host": host})
        f["seen"] = now; f["host"] = host
        hosts = [k for k, v in FENSTER.items() if v.get("host")]
        pool = hosts or list(FENSTER)
        newest = max(pool, key=lambda k: FENSTER[k]["born"])
    return {"close": newest != fid, "count": len(FENSTER)}

# ---- Erinnerungen: geschlossen/verschoben (zentral, per Abgleich auf allen Geräten)
def rem_state():
    st = load_config().get("rem") or {}
    return {k: v[0] for k, v in st.items()}

def rem_set(key, val):
    if not key or len(key) > 400: raise RuntimeError("Ungültig")
    if not (val == "x" or isinstance(val, (int, float))): raise RuntimeError("Ungültig")
    cfg = load_config(); st = cfg.setdefault("rem", {}); now = time.time()
    st[key] = [val, now]
    for k in [k for k, v in st.items() if now - v[1] > 60 * 86400]: del st[k]   # nach 60 Tagen vergessen
    save_config(cfg); sync_soon()
    return {"ok": True}

def rem_merge(cfg, remote):
    """Erinnerungs-Zustand eines anderen Geräts übernehmen: „geschlossen“ gewinnt, sonst das spätere Verschieben."""
    st = cfg.setdefault("rem", {}); ch = False
    for k, v in (remote or {}).items():
        try: rv, rt = v[0], float(v[1])
        except Exception: continue
        lv = st.get(k)
        if lv is None or (rv == "x" and lv[0] != "x") or (lv[0] != "x" and rv != "x" and rv > lv[0]):
            st[k] = [rv, rt]; ch = True
    return ch
UPD = {"state": "idle", "latest": "", "notes": "", "error": "", "checked": "", "file": "", "progress": 0}
_upd_lock = threading.Lock()

def vtuple(v):
    return tuple(int(x) for x in re.findall(r"\d+", v or "")[:3]) or (0,)

def upd_cfg():
    return load_config().get("update", {})

def upd_token():
    t = upd_cfg().get("token", "")
    try:
        return dec_pw(t) if t else ""
    except Exception:
        return ""

class _DropAuthOnRedirect(urllib.request.HTTPRedirectHandler):
    """GitHub leitet Downloads auf einen anderen Server um – dorthin darf der Schlüssel nicht mit."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and urlparse(newurl).netloc != urlparse(req.full_url).netloc:
            new.headers.pop("Authorization", None)
            new.unredirected_hdrs.pop("Authorization", None)
        return new

def gh_open(url, token, accept="application/vnd.github+json", timeout=20):
    h = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Balu-Mail/" + VERSION}
    if token: h["Authorization"] = "Bearer " + token     # nur für private Kopien des Projekts
    req = urllib.request.Request(url, headers=h)
    opener = urllib.request.build_opener(_DropAuthOnRedirect, urllib.request.HTTPSHandler(context=ssl_ctx()))
    return opener.open(req, timeout=timeout)

def upd_latest(token):
    try:
        with gh_open(f"{UPDATE_API}/repos/{UPDATE_REPO}/releases/latest", token) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RuntimeError("Es gibt noch keine fertige Version zum Herunterladen.")
        if e.code in (403, 429):
            raise RuntimeError("GitHub bremst gerade zu viele Abfragen – Balu-Mail versucht es später automatisch noch einmal.")
        raise RuntimeError(f"GitHub antwortet mit Fehler {e.code}.")
    except urllib.error.URLError:
        raise RuntimeError("Keine Verbindung zu GitHub – Internetverbindung prüfen.")

def upd_dir():
    d = os.path.join(os.path.dirname(CONFIG_FILE), "updates")
    os.makedirs(d, exist_ok=True)
    return d

_apk_lock = threading.Lock()

def apk_file():
    """Neueste Handy-App aus dem GitHub-Release holen (zwischengespeichert) – für den Download über die Webseite."""
    tok = upd_token()
    rel = upd_latest(tok)
    ver = re.sub(r"[^\w.]", "", (rel.get("tag_name") or "").lstrip("vV")) or "neu"
    asset = next((a for a in rel.get("assets", []) if (a.get("name") or "").lower().endswith(".apk")), None)
    if not asset:
        raise RuntimeError("In der neuesten Version fehlt die Handy-App.")
    fp = os.path.join(upd_dir(), f"Balu-Mail-{ver}.apk")
    with _apk_lock:
        if not os.path.isfile(fp):
            for old in os.listdir(upd_dir()):
                if old.lower().endswith(".apk") or old.endswith(".apk.part"):
                    try: os.remove(os.path.join(upd_dir(), old))
                    except OSError: pass
            part = fp + ".part"
            with gh_open(asset["url"], tok, accept="application/octet-stream", timeout=120) as r, open(part, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            os.replace(part, fp)
    return fp

def apk_update_loop():
    """Handy-App: neue App-Version im WLAN laden und über Android installieren, wenn die App nicht offen ist."""
    try:
        from java import jclass
        U = jclass("de.balumail.app.Updater")
    except Exception:
        return
    if STOP.wait(120): return
    tried = {}
    while not STOP.is_set():
        try:
            tok = upd_token()
            if upd_cfg().get("auto", True) and U.unmetered() and not U.isForeground():
                rel = upd_latest(tok)
                latest = (rel.get("tag_name") or "").lstrip("vV")
                if vtuple(latest) > vtuple(str(U.appVersion())) and time.time() - tried.get(latest, 0) > 12 * 3600:
                    fp = apk_file()
                    if not U.isForeground():
                        tried[latest] = time.time()
                        U.install(fp)
        except Exception as e:
            say("App-Update:", e)
        if STOP.wait(3 * 3600): return

# Stille Updates: Neue Programmdateien (balumail.py + web/) landen im Datenordner,
# der ohne Administratorrechte beschreibbar ist. Beim Start und nach einem Update
# läuft immer die neueste vorhandene Version – ohne Installer, ohne Nachfrage.
UPD_ASSET = "Balu-Mail-Programm.zip"

def host_exe():
    """Pfad zu Balu-Mail.exe der Installation (Windows) oder None."""
    if os.name != "nt": return None
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(sys.executable))), "Balu-Mail.exe")
    return p if os.path.isfile(p) else None

def msi_run(fp, inst):
    """Befehlsdatei: warten bis Balu-Mail beendet ist, MSI installieren (Windows fragt einmal), danach neu starten."""
    import tempfile
    exe = os.path.join(inst, "Balu-Mail.exe")
    bat = os.path.join(tempfile.gettempdir(), "Balu-Mail-Installation.cmd")
    with open(bat, "w", encoding="mbcs" if os.name == "nt" else "utf-8", newline="\r\n") as f:
        f.write("@echo off\n"
                "ping -n 4 127.0.0.1 >nul\n"
                "taskkill /im Balu-Mail.exe /f >nul 2>&1\n"
                f'msiexec /i "{fp}" /passive /norestart\n'
                f'start "" "{exe}"\n'
                'del "%~f0"\n')
    subprocess.Popen(["cmd.exe", "/c", bat], close_fds=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000))
    return bat

def msi_install():
    """Windows: neueste MSI laden und installieren (Windows fragt einmal nach „Ja“); danach startet Balu-Mail neu."""
    if os.name != "nt" or SERVER_MODE: raise RuntimeError("Nur am Windows-PC möglich.")
    tok = upd_token()
    rel = upd_latest(tok)
    asset = next((a for a in rel.get("assets", []) if (a.get("name") or "").lower() == "balu-mail.msi"), None)
    if not asset: raise RuntimeError("In der neuesten Version fehlt die MSI.")
    import tempfile
    fp = os.path.join(tempfile.gettempdir(), "Balu-Mail-Installation.msi")
    with gh_open(asset["url"], tok, accept="application/octet-stream", timeout=180) as r, open(fp + ".part", "wb") as f:
        shutil.copyfileobj(r, f)
    os.replace(fp + ".part", fp)
    msi_run(fp, os.path.dirname(os.path.dirname(os.path.abspath(sys.executable))))
    threading.Thread(target=lambda: (time.sleep(1.0), os._exit(0)), daemon=True).start()   # Dateien für die Installation freigeben
    return {"ok": True, "version": (rel.get("tag_name") or "").lstrip("vV")}
STOP = threading.Event()          # beendet die Hintergrund-Schleifen dieser Programmversion
SERVER = None
RESTART = False

def prog_dir():
    return os.path.join(os.path.dirname(CONFIG_FILE), "programm")

def file_version(path):
    try:
        with open(path, encoding="utf-8") as f:
            m = re.search(r'^VERSION = "([^"]+)"', f.read(6000), re.M)
        return m.group(1) if m else ""
    except OSError:
        return ""

def newer_program():
    """Pfad zur neueren balumail.py im Datenordner – oder None."""
    fp = os.path.join(prog_dir(), "balumail.py")
    if os.path.isfile(fp) and os.path.isfile(os.path.join(prog_dir(), "web", "index.html")) \
            and vtuple(file_version(fp)) > vtuple(VERSION):
        return fp
    return None

def _broken_file():
    return os.path.join(os.path.dirname(CONFIG_FILE), "update-fehler.json")

def broken_info():
    try:
        with open(_broken_file(), encoding="utf-8") as f: return json.load(f)
    except Exception:
        return {}

def mark_broken():
    """Eine neue Version startet nicht: Fehler merken und beiseitelegen, damit die eingebaute weiterläuft."""
    import traceback
    try:
        fp = os.path.join(prog_dir(), "balumail.py")
        info = {"version": file_version(fp) if os.path.isfile(fp) else "", "time": time.time(),
                "running": VERSION, "error": traceback.format_exc()[-4000:]}
        with open(_broken_file(), "w", encoding="utf-8") as f: json.dump(info, f, ensure_ascii=False, indent=1)
    except Exception:
        pass
    try:
        shutil.rmtree(prog_dir() + ".defekt", ignore_errors=True)
        os.replace(prog_dir(), prog_dir() + ".defekt")
    except OSError:
        pass

def play_build():
    """Handy-App aus dem Play Store: Updates kommen nur über Google Play (Richtlinie), keine eigenen Updates."""
    return os.environ.get("BALU_PLAY") == "1"

def load_newer_module():
    if play_build(): return None
    fp = newer_program()
    if not fp: return None
    import importlib.util
    try:
        spec = importlib.util.spec_from_file_location("balumail_" + re.sub(r"\W", "_", file_version(fp)), fp)
        mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)
        return mod
    except Exception:
        mark_broken(); return None

def upd_installable():
    return True

def upd_check(download=True):
    with _upd_lock:
        if UPD["state"] in ("checking", "downloading"):
            return
        UPD.update(state="checking", error="")
    try:
        tok = upd_token()
        rel = upd_latest(tok)
        latest = (rel.get("tag_name") or "").lstrip("vV")
        UPD.update(latest=latest, notes=rel.get("body") or "", checked=dt.datetime.now().astimezone().isoformat())
        if vtuple(latest) <= vtuple(VERSION):
            UPD.update(state="current", file="")
            return
        bi = broken_info()
        if bi.get("version") == latest and not download_forced():
            UPD.update(state="error", error=f"Version {latest} startete auf diesem Gerät nicht – Details unter „Startfehler“. Neuer Versuch mit „Jetzt prüfen“.")
            return
        if newer_program() and vtuple(file_version(newer_program())) >= vtuple(latest):
            UPD.update(state="ready", file=newer_program(), progress=100)   # schon geladen, wartet auf Neustart
            return
        asset = next((a for a in rel.get("assets", []) if a.get("name") == UPD_ASSET), None)
        if not asset:
            raise RuntimeError(f"In Version {latest} fehlt das Programm-Paket.")
        if not download:
            UPD.update(state="available")
            return
        UPD.update(state="downloading", progress=0)
        zp = os.path.join(upd_dir(), UPD_ASSET + ".part")
        total, done = asset.get("size") or 0, 0
        with gh_open(asset["url"], tok, accept="application/octet-stream", timeout=60) as r, open(zp, "wb") as f:
            while True:
                b = r.read(256 * 1024)
                if not b: break
                f.write(b); done += len(b)
                if total: UPD["progress"] = min(99, int(done * 100 / total))
        if total and os.path.getsize(zp) != total:
            raise RuntimeError("Download unvollständig – wird später erneut versucht.")
        # Auspacken und prüfen, erst dann austauschen
        import zipfile
        neu = prog_dir() + ".neu"
        shutil.rmtree(neu, ignore_errors=True)
        with zipfile.ZipFile(zp) as z:
            names = z.namelist()
            if "balumail.py" not in names or "web/index.html" not in names:
                raise RuntimeError("Das Programm-Paket ist unvollständig.")
            for n in names:
                if n.startswith(("/", "\\")) or ".." in n.replace("\\", "/").split("/"):
                    raise RuntimeError("Das Programm-Paket enthält ungültige Pfade.")
            z.extractall(neu)
        nf = os.path.join(neu, "balumail.py")
        if file_version(nf) != latest:
            raise RuntimeError(f"Das Paket hat die falsche Versionsnummer ({file_version(nf) or 'keine'}).")
        with open(nf, encoding="utf-8") as f:
            compile(f.read(), nf, "exec")          # Syntaxfehler? Dann gar nicht erst übernehmen
        alt = prog_dir() + ".alt"
        shutil.rmtree(alt, ignore_errors=True)
        if os.path.isdir(prog_dir()):
            os.replace(prog_dir(), alt)
        os.replace(neu, prog_dir())
        shutil.rmtree(alt, ignore_errors=True)
        try: os.remove(zp)
        except OSError: pass
        UPD.update(state="ready", file=os.path.join(prog_dir(), "balumail.py"), progress=100)
    except Exception as e:
        UPD.update(state="error", error=str(e) if isinstance(e, RuntimeError) else "Update fehlgeschlagen: " + friendly(e))

def download_forced():
    return getattr(_upd_force, "on", False)

class _UpdForce: on = False
_upd_force = _UpdForce()

def upd_status():
    c = upd_cfg()
    bi = broken_info()
    he = host_exe()
    return {"broken": bi if bi and vtuple(bi.get("version", "0")) > vtuple(VERSION) else None, "version": VERSION,
            "msi_needed": bool(he and not os.path.isfile(os.path.join(os.path.dirname(he), "Microsoft.Web.WebView2.Core.dll"))), "configured": True, "auto": c.get("auto", True),
            "android": ANDROID, "installable": True, "token_url": UPDATE_TOKEN_URL, "play": play_build(),
            **{k: v for k, v in UPD.items() if k != "file"}}

def upd_save(data):
    cfg = load_config(); u = cfg.get("update", {})
    tok = (data.get("token") or "").strip()
    if data.get("remove_token"):
        u.pop("token", None); u["token_updated"] = time.time()
    elif tok:
        try:
            upd_latest(tok)
        except RuntimeError as e:
            if "noch keine fertige Version" not in str(e):
                raise
        u["token"] = enc_plain(tok); u["token_updated"] = time.time()
    if "auto" in data:
        u["auto"] = bool(data["auto"])
    cfg["update"] = u; save_config(cfg)
    if tok or data.get("remove_token"):
        try: sync_soon()
        except Exception: pass
    if u.get("token"):
        threading.Thread(target=upd_check, daemon=True).start()

def upd_apply():
    """Neue Version übernehmen: Server dieser Version anhalten, die neue startet im selben Prozess."""
    global RESTART
    if not newer_program():
        raise RuntimeError("Es liegt kein Update bereit.")
    RESTART = True
    STOP.set()
    threading.Thread(target=lambda: (time.sleep(.4), SERVER and SERVER.shutdown()), daemon=True).start()

def upd_loop():
    """Alle 30 Minuten prüfen und laden; ein fertiges Update spielt sich ein, sobald
    niemand aktiv zuschaut (offene Fenster übernehmen es selbst, außer beim Schreiben)."""
    if STOP.wait(15): return
    last = 0
    while not STOP.is_set():
        try:
            c = upd_cfg()
            if c.get("auto", True):
                if time.time() - last > 1800 or UPD["state"] == "error" and time.time() - last > 600:
                    last = time.time(); upd_check(True)
                if UPD["state"] == "ready" and time.time() - LAST_HIT > 180:
                    upd_apply(); return
        except Exception:
            pass
        if STOP.wait(60): return

def start_newer(after_update):
    """Startet die neueste Programmversion aus dem Datenordner (Windows/Desktop)."""
    fp = newer_program()
    if not fp: return False
    argv = [a for a in sys.argv if a not in ("--app", "--nach-update")]
    if after_update: argv.append("--nach-update")
    elif "--app" in sys.argv: argv.append("--app")
    sys.argv = argv
    import runpy
    try:
        runpy.run_path(fp, run_name="__main__")
    except SystemExit:
        raise
    except Exception:
        mark_broken(); return False
    return True

# --------------------------------------------------------------------------
# Kalender – eigene Termine, CalDAV (Konten), Internet-Kalender (ICS), Feiertage RLP
# Alle Zeiten intern als "lokale" Uhrzeit (naiv), wie im klassischen Outlook.
# --------------------------------------------------------------------------
import xml.etree.ElementTree as ET

KAL_LOCK = threading.RLock()
KAL_TZ = "Europe/Berlin"
KAL_COLORS = ["#1a6fe6", "#e8710a", "#188038", "#a142f4", "#d93025", "#12b5cb", "#f9ab00", "#c2185b", "#5f6368"]
VTIMEZONE_BERLIN = ("BEGIN:VTIMEZONE\r\nTZID:Europe/Berlin\r\n"
                    "BEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:MESZ\r\nDTSTART:19700329T020000\r\n"
                    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\n"
                    "BEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:MEZ\r\nDTSTART:19701025T030000\r\n"
                    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n")
WIN_TZ = {"W. Europe Standard Time": "Europe/Berlin", "Romance Standard Time": "Europe/Paris",
          "Central Europe Standard Time": "Europe/Budapest", "GMT Standard Time": "Europe/London",
          "UTC": "UTC", "Coordinated Universal Time": "UTC"}
LOCAL_ZONES = {"europe/berlin", "europe/vienna", "europe/zurich", "europe/amsterdam", "europe/paris", "europe/rome",
               "europe/madrid", "europe/brussels", "europe/luxembourg", "europe/copenhagen", "europe/stockholm",
               "europe/oslo", "europe/prague", "europe/warsaw", "w. europe standard time", "mitteleuropäische zeit"}

def kal_file():
    return os.path.join(os.path.dirname(CONFIG_FILE), "kalender-demo.json" if DEMO else "kalender.json")

def kal_cache_dir():
    d = os.path.join(os.path.dirname(CONFIG_FILE), "kalender-daten-demo" if DEMO else "kalender-daten")
    os.makedirs(d, exist_ok=True)
    return d

def kal_load():
    with KAL_LOCK:
        try:
            with open(kal_file(), encoding="utf-8") as f: k = json.load(f)
        except Exception:
            k = {}
        k.setdefault("sources", [])
        k.setdefault("local", {})            # uid -> ICS-Text der eigenen Termine
        ids = {s["id"] for s in k["sources"]}
        if "lokal" not in ids:
            k["sources"].insert(0, {"id": "lokal", "type": "local", "name": "Mein Kalender", "color": "#1a6fe6", "enabled": True})
        if "feiertage" not in ids:
            k["sources"].append({"id": "feiertage", "type": "holiday", "name": "Feiertage", "color": "#188038", "enabled": True})
        return k

def kal_save(k):
    with KAL_LOCK:
        tmp = kal_file() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f: json.dump(k, f, ensure_ascii=False, indent=1)
        os.replace(tmp, kal_file())

def kal_cache_get(sid):
    try:
        with open(os.path.join(kal_cache_dir(), re.sub(r"[^\w-]", "_", sid) + ".json"), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def kal_cache_put(sid, data):
    fp = os.path.join(kal_cache_dir(), re.sub(r"[^\w-]", "_", sid) + ".json")
    with open(fp + ".tmp", "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False)
    os.replace(fp + ".tmp", fp)

def kal_source(k, sid):
    s = next((s for s in k["sources"] if s["id"] == sid), None)
    if not s: raise RuntimeError("Kalender nicht gefunden.")
    return s

# ---- iCalendar lesen ----
def ics_lines(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    out = []
    for ln in text.split("\n"):
        if ln.startswith((" ", "\t")) and out: out[-1] += ln[1:]
        elif ln.strip(): out.append(ln)
    return out

def ics_unesc(v):
    return re.sub(r"\\([nN,;\\])", lambda m: "\n" if m.group(1) in "nN" else m.group(1), v)

def ics_esc(v):
    return (v or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")

def ics_parse(text):
    """Liefert Liste der Komponenten als {"name","props":[(NAME, {param:wert}, wert)],"subs":[...]}"""
    root = {"name": "ROOT", "props": [], "subs": []}
    stack = [root]
    for ln in ics_lines(text):
        m = re.match(r'^([A-Za-z0-9-]+)((?:;[^:;"]+=(?:"[^"]*"|[^:;]*))*):(.*)$', ln)
        if not m: continue
        name, params_s, val = m.group(1).upper(), m.group(2), m.group(3)
        if name == "BEGIN":
            c = {"name": val.strip().upper(), "props": [], "subs": []}
            stack[-1]["subs"].append(c); stack.append(c); continue
        if name == "END":
            if len(stack) > 1: stack.pop()
            continue
        params = {}
        for pm in re.finditer(r';([^=;:]+)=("[^"]*"|[^;:]*)', params_s):
            params[pm.group(1).upper()] = pm.group(2).strip('"')
        stack[-1]["props"].append((name, params, val))
    return root["subs"]

def ics_prop(c, name, default=None):
    for n, p, v in c["props"]:
        if n == name: return (p, v)
    return default

def ics_props(c, name):
    return [(p, v) for n, p, v in c["props"] if n == name]

def _to_local_naive(d, tzid):
    """Zeitangabe in lokale (naive) Uhrzeit umrechnen – ohne Zeitzonendatenbank lauffähig."""
    if tzid is None:
        return d
    if tzid == "UTC":
        return dt.datetime.fromtimestamp(d.replace(tzinfo=dt.timezone.utc).timestamp())
    t = WIN_TZ.get(tzid, tzid)
    if t.lower() in LOCAL_ZONES:
        return d
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.fromtimestamp(d.replace(tzinfo=ZoneInfo(t)).timestamp())
    except Exception:
        return d

def ics_dt(pv):
    """(params, wert) -> (datetime|date, ganztägig)"""
    if not pv: return None, False
    p, v = pv
    v = v.strip()
    if p.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", v):
        return dt.datetime.strptime(v[:8], "%Y%m%d").date(), True
    utc = v.endswith("Z")
    d = dt.datetime.strptime(v.rstrip("Z")[:15], "%Y%m%dT%H%M%S")
    return _to_local_naive(d, "UTC" if utc else p.get("TZID")), False

def ics_duration(v):
    m = re.fullmatch(r"([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", (v or "").strip())
    if not m: return None
    sign = -1 if m.group(1) == "-" else 1
    w, d, h, mi, s = (int(x or 0) for x in m.groups()[1:])
    return sign * dt.timedelta(weeks=w, days=d, hours=h, minutes=mi, seconds=s)

def ics_events(text):
    """Alle VEVENTs als normalisierte Dicts."""
    out = []
    for cal in ics_parse(text):
        if cal["name"] != "VCALENDAR": continue
        method = (ics_prop(cal, "METHOD") or ({}, ""))[1].strip().upper()
        for c in cal["subs"]:
            if c["name"] != "VEVENT": continue
            start, allday = ics_dt(ics_prop(c, "DTSTART"))
            if start is None: continue
            end, _ = ics_dt(ics_prop(c, "DTEND"))
            if end is None:
                du = ics_duration((ics_prop(c, "DURATION") or ({}, ""))[1])
                end = start + (du if du else (dt.timedelta(days=1) if allday else dt.timedelta(0)))
            if allday and isinstance(end, dt.datetime): end = end.date()
            if not allday and isinstance(end, dt.date) and not isinstance(end, dt.datetime):
                end = dt.datetime.combine(end, dt.time())
            g = lambda n: ics_unesc((ics_prop(c, n) or ({}, ""))[1])
            alarm = None
            for a in c["subs"]:
                if a["name"] == "VALARM":
                    tr = ics_prop(a, "TRIGGER")
                    if tr and tr[0].get("VALUE") != "DATE-TIME":
                        du = ics_duration(tr[1])
                        if du is not None and du <= dt.timedelta(0):
                            alarm = int(-du.total_seconds() // 60); break
            rid = ics_prop(c, "RECURRENCE-ID")
            ridv = ics_dt(rid)[0] if rid else None
            exd = []
            for p, v in ics_props(c, "EXDATE"):
                for part in v.split(","):
                    x, _ = ics_dt((p, part))
                    if x is not None: exd.append(x)
            org = ics_prop(c, "ORGANIZER")
            atts = []
            for p, v in ics_props(c, "ATTENDEE"):
                atts.append({"email": re.sub(r"(?i)^mailto:", "", v).strip(), "name": p.get("CN", ""),
                             "status": p.get("PARTSTAT", "NEEDS-ACTION")})
            out.append({
                "uid": g("UID") or ("ohne-uid-" + str(start)), "title": g("SUMMARY") or "(ohne Titel)",
                "location": g("LOCATION"), "desc": g("DESCRIPTION"), "start": start, "end": end, "allday": allday,
                "rrule": (ics_prop(c, "RRULE") or ({}, ""))[1].strip(), "exdates": exd, "rid": ridv,
                "alarm": alarm, "status": g("STATUS").upper(), "seq": int(g("SEQUENCE") or 0), "method": method,
                "organizer": {"email": re.sub(r"(?i)^mailto:", "", org[1]).strip(), "name": org[0].get("CN", "")} if org else None,
                "attendees": atts, "transp": g("TRANSP"),
            })
    return out

# ---- Wiederholungen ----
WD = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
WD_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

def rrule_parse(s):
    r = {}
    for part in (s or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1); r[k.upper()] = v
    return r

def _nth_weekday(y, m, wd, n):
    import calendar
    days = [d for d in range(1, calendar.monthrange(y, m)[1] + 1) if dt.date(y, m, d).weekday() == wd]
    try: return days[n - 1] if n > 0 else days[n]
    except IndexError: return None

def _month_days(y, m, r, start):
    import calendar
    last = calendar.monthrange(y, m)[1]
    days = []
    if "BYDAY" in r:
        for tok in r["BYDAY"].split(","):
            mm = re.fullmatch(r"([+-]?\d+)?([A-Z]{2})", tok.strip())
            if not mm or mm.group(2) not in WD: continue
            wd = WD[mm.group(2)]
            if mm.group(1):
                d = _nth_weekday(y, m, wd, int(mm.group(1)))
                if d: days.append(d)
            else:
                days += [d for d in range(1, last + 1) if dt.date(y, m, d).weekday() == wd]
    elif "BYMONTHDAY" in r:
        for tok in r["BYMONTHDAY"].split(","):
            try: n = int(tok)
            except ValueError: continue
            d = n if n > 0 else last + 1 + n
            if 1 <= d <= last: days.append(d)
    else:
        if start.day <= last: days.append(start.day)
    if "BYSETPOS" in r and days:
        days = sorted(days)
        try: days = [days[int(r["BYSETPOS"]) - 1 if int(r["BYSETPOS"]) > 0 else int(r["BYSETPOS"])]]
        except (IndexError, ValueError): days = []
    return sorted(set(days))

def rrule_occurrences(ev, rng_start, rng_end):
    """Startzeitpunkte im Zeitraum (beides naive datetimes)."""
    start = ev["start"]
    allday = ev["allday"]
    s0 = dt.datetime.combine(start, dt.time()) if allday else start
    r = rrule_parse(ev["rrule"])
    freq = r.get("FREQ", "")
    try: interval = max(1, int(r.get("INTERVAL", "1")))
    except ValueError: interval = 1
    count = int(r["COUNT"]) if r.get("COUNT", "").isdigit() else None
    until = None
    if r.get("UNTIL"):
        u, ud = ics_dt(({}, r["UNTIL"]))
        until = dt.datetime.combine(u, dt.time(23, 59, 59)) if ud else u
    ex = {(dt.datetime.combine(x, dt.time()) if not isinstance(x, dt.datetime) else x) for x in ev.get("exdates", [])}
    exd = {x.date() for x in ex} if allday else set()
    tod = s0.time()
    out, n, guard = [], 0, 0

    def emit(c):
        nonlocal n
        if c < s0: return True
        if until and c > until: return False
        if count is not None and n >= count: return False
        n += 1
        if c in ex or (allday and c.date() in exd): return True
        if c >= rng_end: return False
        if c >= rng_start - dt.timedelta(days=60): out.append(c)
        return True

    if freq == "DAILY":
        k = 0
        while guard < 20000:
            guard += 1
            if not emit(s0 + dt.timedelta(days=k * interval)): break
            k += 1
    elif freq == "WEEKLY":
        wds = sorted({WD[t.strip()[-2:]] for t in r.get("BYDAY", "").split(",") if t.strip()[-2:] in WD}) or [s0.weekday()]
        week0 = s0.date() - dt.timedelta(days=s0.weekday())
        k, go = 0, True
        while go and guard < 20000:
            guard += 1
            base = week0 + dt.timedelta(weeks=k * interval)
            for wd in wds:
                if not emit(dt.datetime.combine(base + dt.timedelta(days=wd), tod)): go = False; break
            k += 1
    elif freq in ("MONTHLY", "YEARLY"):
        k, go = 0, True
        while go and guard < 5000:
            guard += 1
            if freq == "MONTHLY":
                mi = s0.month - 1 + k * interval
                months = [(s0.year + mi // 12, mi % 12 + 1)]
            else:
                y = s0.year + k * interval
                bym = [int(x) for x in r.get("BYMONTH", "").split(",") if x.isdigit()] or [s0.month]
                months = [(y, m) for m in sorted(bym)]
            for (y, m) in months:
                rr = r if (freq == "MONTHLY" or "BYDAY" in r or "BYMONTHDAY" in r) else {}
                for d in _month_days(y, m, rr, s0):
                    if not emit(dt.datetime.combine(dt.date(y, m, d), tod)): go = False; break
                if not go: break
            k += 1
            if s0.year + (k * interval if freq == "YEARLY" else (k * interval) // 12) > rng_end.year + 1: break
    else:
        if s0 < rng_end: out.append(s0)
    return out

def rrule_simple(s):
    """RRULE in einfache Form für den Termin-Dialog."""
    r = rrule_parse(s)
    if not r: return None
    u = r.get("UNTIL")
    until = ""
    if u:
        d, _ = ics_dt(({}, u)); until = (d.date() if isinstance(d, dt.datetime) else d).isoformat()
    return {"freq": r.get("FREQ", "").lower(), "interval": int(r.get("INTERVAL", "1") or 1), "until": until,
            "count": int(r["COUNT"]) if r.get("COUNT", "").isdigit() else 0, "byday": r.get("BYDAY", "")}

# ---- iCalendar schreiben ----
def ics_fmt_dt(d, allday):
    if allday:
        return ";VALUE=DATE:" + d.strftime("%Y%m%d")
    return f";TZID={KAL_TZ}:" + d.strftime("%Y%m%dT%H%M%S")

def ics_fold(line):
    b = line.encode("utf-8")
    if len(b) <= 75: return line + "\r\n"
    out, cur = [], b""
    for ch in line:
        e = ch.encode("utf-8")
        if len(cur) + len(e) > (75 if not out else 74):
            out.append(cur); cur = b""
        cur += e
    out.append(cur)
    return "\r\n ".join(x.decode("utf-8") for x in out) + "\r\n"

def ics_build_event(e, method=None, organizer=None, attendees=None, partstat_for=None):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Balu-Mail//Kalender//DE", "CALSCALE:GREGORIAN"]
    if method: L.append("METHOD:" + method)
    s = ["BEGIN:VEVENT", "UID:" + e["uid"], "DTSTAMP:" + stamp,
         "DTSTART" + ics_fmt_dt(e["start"], e["allday"]), "DTEND" + ics_fmt_dt(e["end"], e["allday"]),
         "SUMMARY:" + ics_esc(e.get("title", "")), "SEQUENCE:" + str(e.get("seq", 0))]
    if e.get("location"): s.append("LOCATION:" + ics_esc(e["location"]))
    if e.get("desc"): s.append("DESCRIPTION:" + ics_esc(e["desc"]))
    if e.get("rrule") and method != "REPLY": s.append("RRULE:" + e["rrule"])
    for x in e.get("exdates", []) if method != "REPLY" else []:
        s.append("EXDATE" + ics_fmt_dt(x if not e["allday"] else (x.date() if isinstance(x, dt.datetime) else x), e["allday"]))
    if e.get("status"): s.append("STATUS:" + e["status"])
    org = organizer or e.get("organizer")
    if org and org.get("email"):
        s.append("ORGANIZER" + (f';CN="{org["name"]}"' if org.get("name") else "") + ":mailto:" + org["email"])
    for a in (attendees if attendees is not None else e.get("attendees", [])):
        ps = a.get("status") or "NEEDS-ACTION"
        if partstat_for and a["email"].lower() == partstat_for[0].lower(): ps = partstat_for[1]
        s.append("ATTENDEE" + (f';CN="{a["name"]}"' if a.get("name") else "") +
                 f";ROLE=REQ-PARTICIPANT;PARTSTAT={ps};RSVP=TRUE:mailto:{a['email']}")
    if e.get("alarm") is not None and method != "REPLY":
        s += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Erinnerung", f"TRIGGER:-PT{int(e['alarm'])}M", "END:VALARM"]
    s.append("END:VEVENT")
    body = "".join(ics_fold(x) for x in L) + ("" if e["allday"] else VTIMEZONE_BERLIN) + "".join(ics_fold(x) for x in s) + "END:VCALENDAR\r\n"
    return body

# ---- Gesetzliche Feiertage (bundesweit + je Bundesland) ----
BUNDESLAENDER = {"": "nur bundesweite Feiertage", "BW": "Baden-Württemberg", "BY": "Bayern", "BE": "Berlin", "BB": "Brandenburg",
                 "HB": "Bremen", "HH": "Hamburg", "HE": "Hessen", "MV": "Mecklenburg-Vorpommern", "NI": "Niedersachsen",
                 "NW": "Nordrhein-Westfalen", "RP": "Rheinland-Pfalz", "SL": "Saarland", "SN": "Sachsen", "ST": "Sachsen-Anhalt",
                 "SH": "Schleswig-Holstein", "TH": "Thüringen"}
def easter(y):
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451; month = (h + l - 7 * m + 114) // 31; day = ((h + l - 7 * m + 114) % 31) + 1
    return dt.date(y, month, day)

def holidays(y, land=""):
    """Gesetzliche Feiertage für ein Jahr; land = Kürzel des Bundeslandes ("" = nur bundesweite)."""
    o = easter(y); td = dt.timedelta
    out = [(dt.date(y, 1, 1), "Neujahr"), (o - td(2), "Karfreitag"), (o + td(1), "Ostermontag"),
           (dt.date(y, 5, 1), "Tag der Arbeit"), (o + td(39), "Christi Himmelfahrt"), (o + td(50), "Pfingstmontag"),
           (dt.date(y, 10, 3), "Tag der Deutschen Einheit"), (dt.date(y, 12, 25), "1. Weihnachtstag"), (dt.date(y, 12, 26), "2. Weihnachtstag")]
    if land in ("BW", "BY", "ST"): out.append((dt.date(y, 1, 6), "Heilige Drei Könige"))
    if land == "BE" or (land == "MV" and y >= 2023): out.append((dt.date(y, 3, 8), "Internationaler Frauentag"))
    if land == "BB": out += [(o, "Ostersonntag"), (o + td(49), "Pfingstsonntag")]
    if land in ("BW", "BY", "HE", "NW", "RP", "SL"): out.append((o + td(60), "Fronleichnam"))
    if land == "SL": out.append((dt.date(y, 8, 15), "Mariä Himmelfahrt"))
    if land == "TH" and y >= 2019: out.append((dt.date(y, 9, 20), "Weltkindertag"))
    if land in ("BB", "MV", "SN", "ST", "TH", "HB", "HH", "NI", "SH"): out.append((dt.date(y, 10, 31), "Reformationstag"))
    if land in ("BW", "BY", "NW", "RP", "SL"): out.append((dt.date(y, 11, 1), "Allerheiligen"))
    if land == "SN":   # Buß- und Bettag: Mittwoch vor dem 23. November
        d = dt.date(y, 11, 22)
        while d.weekday() != 2: d -= td(1)
        out.append((d, "Buß- und Bettag"))
    return sorted(out)

def holiday_land():
    return (load_config().get("feiertage_land") or "")

# ---- Termine einer Quelle ----
def kal_source_events(k, s):
    """Liste (ev, href_oder_None) einer Quelle aus Speicher/Zwischenspeicher."""
    if s["type"] == "local":
        return [(ev, uid) for uid, txt in k["local"].items() for ev in ics_events(txt)]
    if s["type"] == "caldav":
        c = kal_cache_get(s["id"])
        return [(ev, href) for href, it in c.get("items", {}).items() for ev in ics_events(it.get("ics", ""))]
    if s["type"] == "ics":
        return [(ev, None) for ev in ics_events(kal_cache_get(s["id"]).get("ics", ""))]
    return []

def kal_occurrences(frm, to):
    k = kal_load()
    out = []
    for s in k["sources"]:
        if not s.get("enabled", True): continue
        ro = s["type"] in ("ics", "holiday") or s.get("readonly")
        if s["type"] == "holiday":
            for y in range(frm.year, to.year + 1):
                for d, name in holidays(y, holiday_land()):
                    if frm.date() <= d < to.date() + dt.timedelta(days=1):
                        out.append({"id": f"feiertage|{d}", "sid": s["id"], "uid": f"feiertag-{d}", "title": name,
                                    "start": d.isoformat(), "end": (d + dt.timedelta(days=1)).isoformat(), "allday": True,
                                    "color": s["color"], "readonly": True, "location": "", "desc": "", "alarm": None,
                                    "recurring": False, "occ": d.isoformat()})
            continue
        evs = kal_source_events(k, s)
        overrides = {}
        for ev, href in evs:
            if ev["rid"] is not None:
                rk = ev["rid"] if isinstance(ev["rid"], dt.datetime) else dt.datetime.combine(ev["rid"], dt.time())
                overrides.setdefault(ev["uid"], {})[rk] = ev
        for ev, href in evs:
            if ev["rid"] is not None or ev["status"] == "CANCELLED": continue
            dur = (dt.datetime.combine(ev["end"], dt.time()) - dt.datetime.combine(ev["start"], dt.time())) if ev["allday"] \
                else (ev["end"] - ev["start"])
            starts = rrule_occurrences(ev, frm, to) if ev["rrule"] else \
                [dt.datetime.combine(ev["start"], dt.time()) if ev["allday"] else ev["start"]]
            for st in starts:
                o = overrides.get(ev["uid"], {}).get(st)
                e2 = o or ev
                if o:
                    if o["status"] == "CANCELLED": continue
                    s_ = dt.datetime.combine(o["start"], dt.time()) if o["allday"] else o["start"]
                    e_ = dt.datetime.combine(o["end"], dt.time()) if o["allday"] else o["end"]
                else:
                    s_, e_ = st, st + dur
                if e_ <= frm or s_ >= to:
                    if not (s_ == e_ and frm <= s_ < to): continue
                fmt = (lambda x: x.date().isoformat()) if e2["allday"] else (lambda x: x.strftime("%Y-%m-%dT%H:%M"))
                out.append({"id": f"{s['id']}|{ev['uid']}|{st.isoformat()}", "sid": s["id"], "uid": ev["uid"],
                            "title": e2["title"], "start": fmt(s_), "end": fmt(e_), "allday": e2["allday"],
                            "location": e2["location"], "desc": e2["desc"], "color": s["color"], "readonly": bool(ro),
                            "alarm": e2["alarm"], "recurring": bool(ev["rrule"]), "rrule": rrule_simple(ev["rrule"]),
                            "occ": st.isoformat(), "organizer": ev["organizer"], "attendees": ev["attendees"],
                            "seriesStart": fmt(dt.datetime.combine(ev["start"], dt.time()) if ev["allday"] else ev["start"]),
                            "seriesEnd": fmt(dt.datetime.combine(ev["end"], dt.time()) if ev["allday"] else ev["end"])})
    out.sort(key=lambda e: (e["start"], not e["allday"]))
    return out

# ---- CalDAV ----
DAV_NS = {"d": "DAV:", "c": "urn:ietf:params:xml:ns:caldav", "a": "http://apple.com/ns/ical/", "cs": "http://calendarserver.org/ns/"}
DAV_HOSTS = [(r"@gmx\.(de|net|at|ch|com)$", "https://caldav.gmx.net"), (r"@web\.de$", "https://caldav.web.de"),
             (r"@(icloud|me|mac)\.com$", "https://caldav.icloud.com"), (r"@mailbox\.org$", "https://dav.mailbox.org"),
             (r"@posteo\.de$", "https://posteo.de:8443"), (r"@(t-online|magenta)\.de$", "https://caldav.t-online.de")]

def dav_creds(s):
    if s.get("google"):
        return "__bearer__", g_access(s["google"])
    if s.get("acc"):
        a = next((a for a in load_accounts() if a["id"] == s["acc"]), None)
        if not a: raise RuntimeError("Das zugehörige Mail-Konto gibt es nicht mehr.")
        return a.get("user") or a["email"], dec_pw(a["password"]) if a.get("password") else ""
    return s.get("user", ""), dec_pw(s["password"]) if s.get("password") else ""

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **kw):
        return None          # Weiterleitungen selbst behandeln (auch bei PROPFIND/REPORT)

def dav(method, url, user, pw, body=None, depth=None, headers=None, timeout=30):
    h = {"User-Agent": "Balu-Mail/" + VERSION,
         "Authorization": ("Bearer " + pw) if user == "__bearer__" else "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()}
    if body is not None: h["Content-Type"] = "application/xml; charset=utf-8" if body.lstrip().startswith("<") else "text/calendar; charset=utf-8"
    if depth is not None: h["Depth"] = str(depth)
    h.update(headers or {})
    for _ in range(6):
        req = urllib.request.Request(url, data=body.encode("utf-8") if isinstance(body, str) else body, headers=h, method=method)
        opener = urllib.request.build_opener(_NoRedirect, urllib.request.HTTPSHandler(context=ssl_ctx()))
        try:
            r = opener.open(req, timeout=timeout)
            return r.status, r.read(), r.headers, url
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                from urllib.parse import urljoin
                url = urljoin(url, e.headers["Location"]); continue
            if e.code == 401: raise RuntimeError("Kalender-Anmeldung fehlgeschlagen – Benutzername/Passwort prüfen.")
            return e.code, e.read(), e.headers, url
        except urllib.error.URLError as e:
            raise RuntimeError("Kalender-Server nicht erreichbar: " + str(e.reason))
    raise RuntimeError("Zu viele Weiterleitungen beim Kalender-Server.")

def _href_join(base, href):
    from urllib.parse import urljoin
    return urljoin(base, href)

def dav_propfind(url, user, pw, props, depth=0):
    body = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" ' \
           'xmlns:a="http://apple.com/ns/ical/" xmlns:cs="http://calendarserver.org/ns/"><d:prop>' + props + '</d:prop></d:propfind>'
    st, data, hd, final = dav("PROPFIND", url, user, pw, body, depth)
    if st not in (200, 207): return final, []
    try: root = ET.fromstring(data)
    except ET.ParseError: return final, []
    res = []
    for r in root.findall("d:response", DAV_NS):
        href = r.findtext("d:href", "", DAV_NS)
        props_ok = {}
        for ps in r.findall("d:propstat", DAV_NS):
            if "200" not in (ps.findtext("d:status", "", DAV_NS) or ""): continue
            for p in ps.find("d:prop", DAV_NS) or []:
                props_ok[p.tag] = p
        res.append((_href_join(final, href), props_ok))
    return final, res

def caldav_discover(base, user, pw):
    """Findet alle Terminkalender (VEVENT) eines Kontos."""
    tried, principal = [], None
    for start in [base, base.rstrip("/") + "/.well-known/caldav"]:
        tried.append(start)
        final, res = dav_propfind(start, user, pw, "<d:current-user-principal/>")
        for href, p in res:
            cup = p.get("{DAV:}current-user-principal")
            if cup is not None and cup.findtext("d:href", None, DAV_NS):
                principal = _href_join(final, cup.findtext("d:href", "", DAV_NS)); break
        if principal: break
    if not principal: raise RuntimeError("Für diese Adresse bietet der Anbieter keinen Kalender-Abgleich (CalDAV) an.")
    final, res = dav_propfind(principal, user, pw, "<c:calendar-home-set/>")
    home = None
    for href, p in res:
        hs = p.get("{urn:ietf:params:xml:ns:caldav}calendar-home-set")
        if hs is not None and hs.findtext("d:href", None, DAV_NS):
            home = _href_join(final, hs.findtext("d:href", "", DAV_NS))
    if not home: raise RuntimeError("Kalender-Verzeichnis nicht gefunden.")
    final, res = dav_propfind(home, user, pw, "<d:resourcetype/><d:displayname/><a:calendar-color/>"
                              "<c:supported-calendar-component-set/><d:current-user-privilege-set/>", depth=1)
    cals = []
    for href, p in res:
        rt = p.get("{DAV:}resourcetype")
        if rt is None or rt.find("c:calendar", DAV_NS) is None: continue
        comps = p.get("{urn:ietf:params:xml:ns:caldav}supported-calendar-component-set")
        if comps is not None and len(comps) and not any(c.get("name") == "VEVENT" for c in comps): continue
        priv = p.get("{DAV:}current-user-privilege-set")
        ro = priv is not None and len(priv) and priv.find(".//d:write", DAV_NS) is None and priv.find(".//d:all", DAV_NS) is None \
            and priv.find(".//d:write-content", DAV_NS) is None
        name = (p.get("{DAV:}displayname").text if p.get("{DAV:}displayname") is not None else "") or href.rstrip("/").rsplit("/", 1)[-1]
        col = p.get("{http://apple.com/ns/ical/}calendar-color")
        color = (col.text or "")[:7] if col is not None and (col.text or "").startswith("#") else ""
        cals.append({"url": href if href.endswith("/") else href + "/", "name": name, "color": color, "readonly": bool(ro)})
    if not cals: raise RuntimeError("Im Konto wurde kein Terminkalender gefunden.")
    return cals

def caldav_sync(s):
    user, pw = dav_creds(s)
    cache = kal_cache_get(s["id"]); items = cache.get("items", {})
    final, res = dav_propfind(s["url"], user, pw, "<d:getetag/><d:resourcetype/>", depth=1)
    if not res: raise RuntimeError("Kalender konnte nicht gelesen werden.")
    remote = {}
    for href, p in res:
        rt = p.get("{DAV:}resourcetype")
        if rt is not None and len(rt): continue           # Sammlung selbst
        et = p.get("{DAV:}getetag")
        remote[href] = (et.text or "") if et is not None else ""
    need = [h for h, et in remote.items() if h not in items or items[h].get("etag") != et]
    for i in range(0, len(need), 40):
        chunk = need[i:i + 40]
        from urllib.parse import urlparse as _up
        body = '<?xml version="1.0" encoding="utf-8"?><c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' \
               '<d:prop><d:getetag/><c:calendar-data/></d:prop>' + "".join(f"<d:href>{html.escape(_up(h).path)}</d:href>" for h in chunk) + \
               '</c:calendar-multiget>'
        st, data, hd, fin = dav("REPORT", s["url"], user, pw, body, depth=1)
        got = set()
        if st in (200, 207):
            try:
                for r in ET.fromstring(data).findall("d:response", DAV_NS):
                    href = _href_join(fin, r.findtext("d:href", "", DAV_NS))
                    cd = r.find(".//c:calendar-data", DAV_NS); et = r.find(".//d:getetag", DAV_NS)
                    if cd is not None and cd.text:
                        items[href] = {"etag": (et.text if et is not None else remote.get(href, "")), "ics": cd.text}; got.add(href)
            except ET.ParseError:
                pass
        for h in chunk:
            if h in got: continue
            st, data, hd, fin = dav("GET", h, user, pw)
            if st == 200: items[h] = {"etag": hd.get("ETag", remote.get(h, "")), "ics": data.decode("utf-8", "replace")}
    for h in list(items):
        if h not in remote: del items[h]
    kal_cache_put(s["id"], {"items": items, "synced": time.time()})

def caldav_put(s, uid, ics_text, href=None):
    user, pw = dav_creds(s)
    cache = kal_cache_get(s["id"]); items = cache.setdefault("items", {})
    from urllib.parse import quote
    if not href:
        href = s["url"] + quote(re.sub(r"[^\w.@-]", "_", uid)) + ".ics"
        hd = {"If-None-Match": "*"}
    else:
        et = items.get(href, {}).get("etag")
        hd = {"If-Match": et} if et else {}
    st, data, h, fin = dav("PUT", href, user, pw, ics_text, headers=hd)
    if st == 412: raise RuntimeError("Der Termin wurde inzwischen woanders geändert. Bitte neu laden.")
    if st not in (200, 201, 204): raise RuntimeError(f"Speichern im Kalender fehlgeschlagen (Fehler {st}).")
    items[href] = {"etag": h.get("ETag", ""), "ics": ics_text}
    kal_cache_put(s["id"], cache)
    if not h.get("ETag"):
        threading.Thread(target=lambda: kal_sync_one(s["id"]), daemon=True).start()

def caldav_delete(s, href):
    user, pw = dav_creds(s)
    cache = kal_cache_get(s["id"]); items = cache.get("items", {})
    et = items.get(href, {}).get("etag")
    st, data, h, fin = dav("DELETE", href, user, pw, headers={"If-Match": et} if et else {})
    if st not in (200, 204, 404): raise RuntimeError(f"Löschen im Kalender fehlgeschlagen (Fehler {st}).")
    items.pop(href, None); kal_cache_put(s["id"], cache)

# ---- Internet-Kalender (ICS-Abo) ----
GOOGLE_ICS_HINT = ("Google gibt den Kalender unter dieser Adresse nicht heraus. Bitte in den Google-Kalender-Einstellungen "
                   "die „Privatadresse im iCal-Format“ kopieren (endet auf /basic.ics).")

def ics_normalize_url(url):
    """Häufige Fehl-Adressen von Google/Outlook in die iCal-Adresse umwandeln."""
    from urllib.parse import urlparse as _up, parse_qs as _pq, unquote
    url = re.sub(r"(?i)^webcal(s)?://", "https://", url.strip())
    u = _up(url); q = _pq(u.query)
    if "calendar.google.com" in u.netloc and not u.path.endswith(".ics"):
        cal = (q.get("src") or [None])[0]
        if not cal and q.get("cid"):
            c = q["cid"][0]
            try: cal = base64.b64decode(c + "=" * (-len(c) % 4)).decode() if "@" not in c else c
            except Exception: cal = c
        if cal: return f"https://calendar.google.com/calendar/ical/{quote_plus_safe(unquote(cal))}/public/basic.ics"
    if "outlook." in u.netloc and u.path.endswith("/calendar.html"):
        return url[: url.rindex(".html")] + ".ics"
    if u.netloc.endswith("abfall.io") and q.get("timeperiod"):
        # Abfuhrtermine (AbfallPlus/abfall.io): Zeitraum immer aktuelles + nächstes Jahr, damit das Abo nicht veraltet
        y = dt.date.today().year
        url = re.sub(r"timeperiod=[^&]*", f"timeperiod={y}0101-{y + 1}1231", url)
    return url

def quote_plus_safe(s):
    from urllib.parse import quote
    return quote(s, safe="@.")

def ics_fetch(s):
    url = ics_normalize_url(s["url"])
    google = "google.com" in url
    st, data = http(url, timeout=30)
    if st != 200:
        if google and st in (401, 403, 404): raise RuntimeError(GOOGLE_ICS_HINT)
        raise RuntimeError(f"Kalender-Adresse antwortet mit Fehler {st}.")
    text = data.decode("utf-8", "replace")
    if "BEGIN:VCALENDAR" not in text.upper():
        if google: raise RuntimeError(GOOGLE_ICS_HINT)

        raise RuntimeError("Unter dieser Adresse liegt kein Kalender, sondern eine normale Webseite. Bitte die Adresse des Kalenders selbst nehmen (endet oft auf .ics oder ist mit „iCal“, „ICS“ oder „Kalender abonnieren“ beschriftet) – siehe Hilfe unter dem Eingabefeld.")
    kal_cache_put(s["id"], {"ics": text, "fetched": time.time()})

def kal_sync_one(sid, force=True):
    k = kal_load(); s = kal_source(k, sid)
    if s["type"] not in ("caldav", "ics") or DEMO: return
    if not force and s["type"] == "ics" and time.time() - kal_cache_get(sid).get("fetched", 0) < 6 * 3600: return
    err = ""
    try:
        caldav_sync(s) if s["type"] == "caldav" else ics_fetch(s)
    except Exception as e:
        err = str(e) if isinstance(e, RuntimeError) else friendly(e)
    with KAL_LOCK:
        k = kal_load()
        for x in k["sources"]:
            if x["id"] == sid: x["error"] = err; x["synced"] = time.time() if not err else x.get("synced", 0)
        kal_save(k)

def kal_sync_all(force=False):
    for s in kal_load()["sources"]:
        if s.get("enabled", True) and s["type"] in ("caldav", "ics"):
            kal_sync_one(s["id"], force=force or s["type"] == "caldav")

def kal_loop():
    if STOP.wait(8): return
    while not STOP.is_set():
        try: kal_sync_all()
        except Exception: pass
        if STOP.wait(900): return

# ---- Bearbeiten ----
def _parse_local(v, allday):
    if allday: return dt.date.fromisoformat(v[:10])
    return dt.datetime.fromisoformat(v[:16])

def kal_find(k, s, uid):
    """(ics_text, href) des Termins mit UID in der Quelle."""
    if s["type"] == "local":
        return (k["local"].get(uid), uid) if uid in k["local"] else (None, None)
    if s["type"] == "caldav":
        for href, it in kal_cache_get(s["id"]).get("items", {}).items():
            if any(ev["uid"] == uid for ev in ics_events(it.get("ics", ""))): return it["ics"], href
    return None, None

def kal_store(k, s, uid, ics_text, href=None):
    if s["type"] == "local":
        with KAL_LOCK:
            k = kal_load(); k["local"][uid] = ics_text; kal_save(k)
    elif s["type"] == "caldav":
        caldav_put(s, uid, ics_text, href)
    else:
        raise RuntimeError("Dieser Kalender kann nur gelesen werden.")

def ics_patch(text, old, ev):
    """Vorhandenen Termin gezielt ändern: nur geänderte Felder ersetzen, alles andere
    (Meet-Link, Farbe, Anhänge, Ausnahmen einer Serie, eigene Felder) bleibt erhalten."""
    lines = ics_lines(text)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    times = (ev["start"], ev["end"], ev["allday"]) != (old["start"], old["end"], old["allday"])
    new_props, drop = [], {"DTSTAMP", "LAST-MODIFIED", "SEQUENCE"}
    def setp(name, val, cond):
        if cond:
            drop.add(name)
            if val: new_props.append(f"{name}:{ics_esc(val)}")
    setp("SUMMARY", ev["title"], ev["title"] != old["title"])
    setp("LOCATION", ev["location"], (ev["location"] or "") != (old["location"] or ""))
    setp("DESCRIPTION", ev["desc"], (ev["desc"] or "").replace("\r\n", "\n") != (old["desc"] or "").replace("\r\n", "\n"))
    if times:
        drop.update({"DTSTART", "DTEND", "DURATION"})
        new_props += ["DTSTART" + ics_fmt_dt(ev["start"], ev["allday"]), "DTEND" + ics_fmt_dt(ev["end"], ev["allday"])]
    if ev["rrule"] != old["rrule"]:
        drop.add("RRULE")
        if ev["rrule"]: new_props.append("RRULE:" + ev["rrule"])
    if times or ev.get("exdates", []) != old["exdates"]:
        drop.add("EXDATE")
        for x in ev.get("exdates", []):
            new_props.append("EXDATE" + ics_fmt_dt(x if not ev["allday"] else (x.date() if isinstance(x, dt.datetime) else x), ev["allday"]))
    att_changed = sorted(a["email"].lower() for a in ev.get("attendees", [])) != sorted(a["email"].lower() for a in old["attendees"])
    if att_changed:
        drop.add("ATTENDEE")
        for a in ev["attendees"]:
            new_props.append("ATTENDEE" + (f';CN="{a["name"]}"' if a.get("name") else "") +
                             f";ROLE=REQ-PARTICIPANT;PARTSTAT={a.get('status') or 'NEEDS-ACTION'};RSVP=TRUE:mailto:{a['email']}")
        if ev["attendees"] and not old.get("organizer") and ev.get("organizer"):
            o = ev["organizer"]; new_props.append("ORGANIZER" + (f';CN="{o["name"]}"' if o.get("name") else "") + ":mailto:" + o["email"])
    alarm_changed = ev.get("alarm") != old.get("alarm")
    new_props += ["DTSTAMP:" + stamp, "LAST-MODIFIED:" + stamp, "SEQUENCE:" + str(ev.get("seq", 0))]
    alarm_block = ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Erinnerung", f"TRIGGER:-PT{int(ev['alarm'])}M", "END:VALARM"] \
        if alarm_changed and ev.get("alarm") is not None else []
    out, i, n, done = [], 0, len(lines), False
    while i < n:
        ln = lines[i]
        if ln.upper() == "BEGIN:VEVENT" and not done:
            j = i
            while j < n and lines[j].upper() != "END:VEVENT": j += 1
            block = lines[i:j + 1]
            props = [b.split(":", 1)[0].split(";", 1)[0].upper() for b in block]
            uid = next((ics_unesc(b.split(":", 1)[1]) for b, pn in zip(block, props) if pn == "UID"), "")
            if uid == old["uid"] and "RECURRENCE-ID" not in props:
                nb, depth, skip_alarm = [block[0]], 0, False
                for b, pn in zip(block[1:-1], props[1:-1]):
                    if b.upper() == "BEGIN:VALARM":
                        skip_alarm = alarm_changed
                    if skip_alarm:
                        if b.upper() == "END:VALARM": skip_alarm = False
                        continue
                    if b.upper().startswith("BEGIN:"): depth += 1
                    if b.upper().startswith("END:"): depth -= 1; nb.append(b); continue
                    if depth == 0 and pn in drop: continue
                    nb.append(b)
                out += nb + new_props + alarm_block + ["END:VEVENT"]
                done = True; i = j + 1; continue
        out.append(ln); i += 1
    if not done:
        return ics_build_event(ev)
    body = "".join(ics_fold(x) for x in out)
    if times and not ev["allday"] and "TZID:EUROPE/BERLIN" not in body.upper().replace(" ", ""):
        body = body.replace("BEGIN:VEVENT", VTIMEZONE_BERLIN.rstrip("\r\n") + "\r\nBEGIN:VEVENT", 1)
    return body

def kal_event_save(d):
    k = kal_load()
    s = kal_source(k, d["sid"])
    if s["type"] not in ("local", "caldav") or s.get("readonly"): raise RuntimeError("In diesen Kalender kann nicht geschrieben werden.")
    allday = bool(d.get("allday"))
    start, end = _parse_local(d["start"], allday), _parse_local(d["end"], allday)
    if allday and end <= start: end = start + dt.timedelta(days=1)
    if not allday and end < start: end = start + dt.timedelta(hours=1)
    rr = d.get("rrule") or {}
    rrule = ""
    if rr.get("freq") in ("daily", "weekly", "monthly", "yearly"):
        rrule = "FREQ=" + rr["freq"].upper()
        if int(rr.get("interval") or 1) > 1: rrule += f";INTERVAL={int(rr['interval'])}"
        if rr["freq"] == "weekly" and rr.get("byday"): rrule += ";BYDAY=" + rr["byday"]
        if rr.get("until"): rrule += ";UNTIL=" + rr["until"].replace("-", "") + ("" if allday else "T225959Z")
        elif int(rr.get("count") or 0) > 0: rrule += f";COUNT={int(rr['count'])}"
    uid = d.get("uid") or (uuid.uuid4().hex + "@balu-mail")
    old_txt, href = kal_find(k, s, uid) if d.get("uid") else (None, None)
    old = next((e for e in ics_events(old_txt or "") if e["uid"] == uid and e["rid"] is None), None)
    atts = [{"email": a, "name": "", "status": "NEEDS-ACTION"} for a in
            [x.strip() for x in re.split(r"[,;\s]+", d.get("attendees") or "") if "@" in x]]
    if old:
        prev = {a["email"].lower(): a for a in old["attendees"]}
        atts = [prev.get(a["email"].lower(), a) for a in atts]
    org = None
    if atts:
        acc = next((a for a in get_accounts() if a["id"] == d.get("from_acc")), None) or (get_accounts() or [None])[0]
        org = {"email": acc["email"], "name": acc.get("name", "")} if acc else None
    ev = {"uid": uid, "title": d.get("title") or "(ohne Titel)", "location": d.get("location", ""), "desc": d.get("desc", ""),
          "start": start, "end": end, "allday": allday, "rrule": rrule,
          "exdates": old["exdates"] if old and old["rrule"] == rrule else [],
          "alarm": int(d["alarm"]) if str(d.get("alarm", "")).lstrip("-").isdigit() and int(d["alarm"]) >= 0 else None,
          "seq": (old["seq"] + 1) if old else 0, "attendees": atts, "organizer": org or (old or {}).get("organizer")}
    kal_store(k, s, uid, ics_patch(old_txt, old, ev) if old else ics_build_event(ev), href)
    sent = 0
    if atts and d.get("invite", True):
        sent = kal_send_invites(ev, d.get("from_acc"))
    return {"ok": True, "uid": uid, "invited": sent}

def kal_event_delete(d):
    k = kal_load(); s = kal_source(k, d["sid"])
    if s["type"] not in ("local", "caldav") or s.get("readonly"): raise RuntimeError("Aus diesem Kalender kann nicht gelöscht werden.")
    txt, href = kal_find(k, s, d["uid"])
    if txt is None: raise RuntimeError("Termin nicht gefunden.")
    if d.get("occ") and d.get("only_this"):
        # nur dieses Vorkommen: als Ausnahme (EXDATE) eintragen
        old = next(e for e in ics_events(txt) if e["uid"] == d["uid"] and e["rid"] is None)
        ev = dict(old)
        occ = dt.datetime.fromisoformat(d["occ"])
        ev["exdates"] = old["exdates"] + [occ.date() if old["allday"] else occ]
        ev["seq"] = old["seq"] + 1
        kal_store(k, s, d["uid"], ics_patch(txt, old, ev), href); return {"ok": True}
    if s["type"] == "local":
        with KAL_LOCK:
            k = kal_load(); k["local"].pop(d["uid"], None); kal_save(k)
    else:
        caldav_delete(s, href)
    return {"ok": True}

# ---- Einladungen ----
def invite_from_message(msg):
    """text/calendar-Teil einer E-Mail -> Einladungs-Infos für die Oberfläche."""
    for part in msg.walk():
        ct = part.get_content_type()
        fn = (part.get_filename() or "").lower()
        if ct == "text/calendar" or fn.endswith(".ics"):
            try:
                raw = part.get_payload(decode=True) or b""
                text = raw.decode(part.get_content_charset() or "utf-8", "replace")
            except Exception:
                continue
            evs = [e for e in ics_events(text) if e["rid"] is None] or ics_events(text)
            if not evs: continue
            e = evs[0]
            fmt = (lambda x: x.isoformat()) if e["allday"] else (lambda x: x.strftime("%Y-%m-%dT%H:%M"))
            return {"method": e["method"] or "PUBLISH", "uid": e["uid"], "title": e["title"], "location": e["location"],
                    "start": fmt(e["start"]), "end": fmt(e["end"]), "allday": e["allday"], "organizer": e["organizer"],
                    "attendees": e["attendees"], "recurring": bool(e["rrule"]), "ics": text}
    return None

def kal_send_invites(ev, acc_id):
    acc = next((a for a in get_accounts() if a["id"] == acc_id), None) or (get_accounts() or [None])[0]
    if not acc: return 0
    c = client(acc["id"])
    em = EmailMessage()
    em["From"] = email.utils.formataddr((acc.get("name") or "", acc["email"]))
    em["To"] = ", ".join(a["email"] for a in ev["attendees"])
    em["Subject"] = "Einladung: " + ev["title"]
    em["Date"] = email.utils.formatdate(localtime=True)
    em["Message-ID"] = email.utils.make_msgid(domain=acc["email"].split("@")[-1])
    when = kal_when_text(ev)
    em.set_content(f"Sie sind eingeladen: {ev['title']}\n\nWann: {when}\n" + (f"Wo: {ev['location']}\n" if ev.get("location") else "") +
                   (f"\n{ev['desc']}\n" if ev.get("desc") else ""))
    ics = ics_build_event(ev, method="REQUEST")
    em.add_alternative(ics, subtype="calendar", params={"method": "REQUEST"})
    em.add_attachment(ics.encode("utf-8"), maintype="application", subtype="ics", filename="einladung.ics")
    c.send(em)
    return len(ev["attendees"])

def kal_when_text(ev):
    s, e = ev["start"], ev["end"]
    if ev["allday"]:
        last = e - dt.timedelta(days=1) if isinstance(e, dt.date) else e
        return s.strftime("%d.%m.%Y") + ("" if last <= s else " – " + last.strftime("%d.%m.%Y")) + " (ganztägig)"
    same = s.date() == e.date()
    return s.strftime("%d.%m.%Y, %H:%M") + " – " + (e.strftime("%H:%M") if same else e.strftime("%d.%m.%Y, %H:%M")) + " Uhr"

def kal_invite_answer(d):
    """Einladung annehmen/ablehnen: in Kalender übernehmen und Antwort an den Organisator senden."""
    c = client(d["acc"])
    m = c.message(d["folder"], int(d["uid"]))
    inv = m.get("invite")
    if not inv: raise RuntimeError("In dieser E-Mail steckt keine Einladung.")
    answer = d["answer"]                       # ACCEPTED / TENTATIVE / DECLINED / REMOVE
    evs = [e for e in ics_events(inv["ics"]) if e["uid"] == inv["uid"]]
    master = next((e for e in evs if e["rid"] is None), evs[0])
    k = kal_load()
    sid = d.get("sid") or "lokal"
    s = kal_source(k, sid)
    if inv["method"] == "CANCEL" or answer == "REMOVE":
        txt, href = kal_find(k, s, master["uid"])
        if txt is not None: kal_event_delete({"sid": sid, "uid": master["uid"]})
        return {"ok": True}
    me = [c.acc["email"].lower()] + [x.lower() for x in c.acc.get("identities", [])]
    my = next((a["email"] for a in master["attendees"] if a["email"].lower() in me), c.acc["email"])
    if answer != "DECLINED":
        master["method"] = ""
        for a in master["attendees"]:
            if a["email"].lower() == my.lower(): a["status"] = answer
        txt, href = kal_find(k, s, master["uid"])
        kal_store(k, s, master["uid"], ics_build_event(master), href)
    if master.get("organizer") and master["organizer"].get("email") and d.get("reply", True):
        em = EmailMessage()
        em["From"] = email.utils.formataddr((c.acc.get("name") or "", my))
        em["To"] = master["organizer"]["email"]
        word = {"ACCEPTED": "Zugesagt", "TENTATIVE": "Mit Vorbehalt", "DECLINED": "Abgesagt"}[answer]
        em["Subject"] = f"{word}: {master['title']}"
        em["Date"] = email.utils.formatdate(localtime=True)
        em["Message-ID"] = email.utils.make_msgid(domain=my.split("@")[-1])
        em.set_content(f"{c.acc.get('name') or my} hat die Einladung „{master['title']}“ beantwortet: {word}.")
        rep = ics_build_event(master, method="REPLY", attendees=[{"email": my, "name": c.acc.get("name", ""), "status": answer}])
        em.add_alternative(rep, subtype="calendar", params={"method": "REPLY"})
        c.send(em)
    return {"ok": True}

def kal_sources_public():
    k = kal_load()
    accs = {a["id"]: a["email"] for a in get_accounts()}
    out = []
    for s in k["sources"]:
        out.append({kk: s.get(kk) for kk in ("id", "type", "name", "color", "enabled", "readonly", "error", "synced", "acc", "url")}
                   | {"account": accs.get(s.get("acc"), "") or s.get("google") or "", "writable": s["type"] == "local" or (s["type"] == "caldav" and not s.get("readonly"))})
    return out

def kal_source_save(d):
    with KAL_LOCK:
        k = kal_load()
        if d.get("id"):
            s = kal_source(k, d["id"])
            for kk in ("name", "color", "enabled"):
                if kk in d: s[kk] = d[kk]
            if "url" in d and s["type"] == "ics": s["url"] = d["url"].strip()
        else:
            if d.get("type") == "ics":
                url = (d.get("url") or "").strip()
                if not re.match(r"(?i)^(https?|webcals?)://", url): raise RuntimeError("Bitte eine Kalender-Adresse eingeben (beginnt mit https:// oder webcal://).")
                s = {"id": "ics-" + secrets.token_hex(4), "type": "ics", "url": url, "name": d.get("name") or "Internet-Kalender",
                     "color": d.get("color") or KAL_COLORS[len(k["sources"]) % len(KAL_COLORS)], "enabled": True}
            elif d.get("type") == "caldav":
                s = {"id": "dav-" + secrets.token_hex(4), "type": "caldav", "url": d["url"], "name": d.get("name") or "Kalender",
                     "color": d.get("color") or KAL_COLORS[len(k["sources"]) % len(KAL_COLORS)], "enabled": True,
                     "readonly": bool(d.get("readonly")), "acc": d.get("acc") or None, "google": d.get("google") or None}
                if s["google"]: s["acc"] = None
                elif not s["acc"]:
                    s["user"] = d.get("user", ""); s["password"] = enc_pw(d.get("password", ""))
            else:
                raise RuntimeError("Unbekannte Kalenderart.")
            k["sources"].append(s)
        kal_save(k)
    if not d.get("id") or "url" in d:
        kal_sync_one(s["id"])
    return kal_sources_public()

def kal_source_delete(sid):
    if sid in ("lokal",): raise RuntimeError("„Mein Kalender“ kann nicht entfernt werden.")
    with KAL_LOCK:
        k = kal_load(); k["sources"] = [s for s in k["sources"] if s["id"] != sid]; kal_save(k)
    try: os.remove(os.path.join(kal_cache_dir(), re.sub(r"[^\w-]", "_", sid) + ".json"))
    except OSError: pass
    return kal_sources_public()

def kal_discover_account(acc_id, base=None, user=None, password=None):
    """Kalender eines Mail-Kontos suchen (oder eines eigenen CalDAV-Servers)."""
    if acc_id:
        a = next((a for a in load_accounts() if a["id"] == acc_id), None)
        if not a: raise RuntimeError("Konto nicht gefunden.")
        if a.get("auth") == "oauth_ms" or re.search(r"@(outlook|hotmail|live|msn)\.", a["email"], re.I):
            raise RuntimeError("MICROSOFT")
        if re.search(r"@(gmail|googlemail)\.com$", a["email"], re.I):
            if a["email"].lower() in load_config().get("google_tokens", {}):
                return g_calendars(a["email"].lower())
            raise RuntimeError("GOOGLE")
        u, pw = a.get("user") or a["email"], dec_pw(a["password"]) if a.get("password") else ""
        host = next((h for rx, h in DAV_HOSTS if re.search(rx, a["email"], re.I)), None)
        bases = [host] if host else []
        dom = a["email"].split("@")[-1]
        bases += [f"https://{dom}", f"https://caldav.{dom}", f"https://dav.{dom}"]
    else:
        bases, u, pw = [base.strip()], user or "", password or ""
    last = None
    for b in bases:
        try:
            return caldav_discover(b, u, pw)
        except RuntimeError as e:
            last = e
            if "Anmeldung" in str(e): raise
        except Exception as e:
            last = e
    raise RuntimeError(str(last) if isinstance(last, RuntimeError) else "Für diese Adresse bietet der Anbieter keinen Kalender-Abgleich (CalDAV) an.")

def kal_demo_setup():
    """Beispieltermine für den Demo-Modus."""
    with KAL_LOCK:
        k = kal_load()
        if k["local"]: return
        today = dt.date.today()
        mon = today - dt.timedelta(days=today.weekday())
        def add(title, d, h1, m1, h2, m2, **kw):
            ev = {"uid": uuid.uuid4().hex + "@demo", "title": title, "start": dt.datetime.combine(d, dt.time(h1, m1)),
                  "end": dt.datetime.combine(d, dt.time(h2, m2)), "allday": False, "location": kw.get("loc", ""),
                  "desc": "", "rrule": kw.get("rrule", ""), "exdates": [], "alarm": kw.get("alarm", 15), "seq": 0,
                  "attendees": [], "organizer": None}
            k["local"][ev["uid"]] = ics_build_event(ev)
        add("Zahnarzt", mon + dt.timedelta(days=1), 9, 30, 10, 15, loc="Praxis Dr. Muster")
        add("Training Sportverein", mon + dt.timedelta(days=3), 19, 0, 20, 30, rrule="FREQ=WEEKLY;BYDAY=TH")
        add("Team-Besprechung", mon, 10, 0, 11, 0, rrule="FREQ=WEEKLY;BYDAY=MO,WE", alarm=10)
        add("Geburtstag Oma Erna (Kaffee)", mon + dt.timedelta(days=5), 15, 0, 17, 30, loc="Bei Oma")
        ev = {"uid": uuid.uuid4().hex + "@demo", "title": "Urlaub", "start": mon + dt.timedelta(days=11),
              "end": mon + dt.timedelta(days=14), "allday": True, "location": "", "desc": "", "rrule": "", "exdates": [],
              "alarm": None, "seq": 0, "attendees": [], "organizer": None}
        k["local"][ev["uid"]] = ics_build_event(ev)
        k["sources"].append({"id": "ics-wab", "type": "ics", "url": "https://example.org/wab.ics", "name": "Müllabfuhr (Beispiel)",
                             "color": "#8d6e63", "enabled": True})
        kal_save(k)
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0"]
        for i, (t, off) in enumerate([("Restabfall", 2), ("Gelber Sack", 8), ("Altpapier", 16), ("Bioabfall", 9)]):
            d = today + dt.timedelta(days=off)
            lines += ["BEGIN:VEVENT", f"UID:wab{i}@demo", "DTSTART;VALUE=DATE:" + d.strftime("%Y%m%d"),
                      "DTEND;VALUE=DATE:" + (d + dt.timedelta(days=1)).strftime("%Y%m%d"), "SUMMARY:" + t,
                      "RRULE:FREQ=WEEKLY;INTERVAL=2", "END:VEVENT"]
        lines.append("END:VCALENDAR")
        kal_cache_put("ics-wab", {"ics": "\r\n".join(lines), "fetched": time.time() + 10 ** 9})


# --------------------------------------------------------------------------
# Server-Modus: Anmeldung mit Passwort + Einmal-Code (TOTP), Sitzungen, Schutz vor Durchprobieren
# --------------------------------------------------------------------------
SESSION_COOKIE = "bm_sid"
SAFE_INLINE = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "text/plain"}

def server_file():
    return os.path.join(os.path.dirname(CONFIG_FILE), "server.json")

def server_cfg():
    try:
        with open(server_file(), encoding="utf-8") as f: return json.load(f)
    except Exception:
        return None

def _kdf(password, salt):
    k = _hl.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000, dklen=64)
    return k[:32], k[32:]          # Prüfwert, Schlüssel-Verschlüsselung

def _write_server_cfg(cfg):
    fp = server_file(); tmp = fp + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(cfg, f, indent=2)
    try: os.chmod(tmp, 0o600)
    except OSError: pass
    os.replace(tmp, fp)

def server_setup(password, reset_totp=True):
    if len(password) < 10: raise ValueError("Das Passwort muss mindestens 10 Zeichen haben.")
    if server_cfg(): raise ValueError("Bereits eingerichtet. Zum Ändern: --server-passwort")
    salt = os.urandom(16); chk, kek = _kdf(password, salt)
    data_key = os.urandom(32)
    totp = base64.b32encode(os.urandom(20)).decode().rstrip("=")
    _write_server_cfg({"v": 1, "salt": base64.b64encode(salt).decode(),
                       "check": _hm.new(chk, b"balu-check", _hl.sha256).hexdigest(),
                       "wrapped": base64.b64encode(_v_enc(kek, data_key)).decode(), "totp": totp})
    return totp

def _verify_password(password):
    c = server_cfg()
    if not c: return None
    chk, kek = _kdf(password, base64.b64decode(c["salt"]))
    if not _hm.compare_digest(_hm.new(chk, b"balu-check", _hl.sha256).hexdigest(), c["check"]): return None
    return _v_dec(kek, base64.b64decode(c["wrapped"]))

def server_change_password(old, new):
    key = _verify_password(old)
    if key is None: raise ValueError("Das bisherige Passwort ist falsch.")
    if len(new) < 10: raise ValueError("Das neue Passwort muss mindestens 10 Zeichen haben.")
    c = server_cfg(); salt = os.urandom(16); chk, kek = _kdf(new, salt)
    c.update(salt=base64.b64encode(salt).decode(), check=_hm.new(chk, b"balu-check", _hl.sha256).hexdigest(),
             wrapped=base64.b64encode(_v_enc(kek, key)).decode())
    _write_server_cfg(c)

def totp_code(secret, counter):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    h = _hm.new(key, counter.to_bytes(8, "big"), _hl.sha1).digest()
    o = h[-1] & 15
    return "%06d" % ((int.from_bytes(h[o:o + 4], "big") & 0x7FFFFFFF) % 1_000_000)

def totp_ok(secret, code):
    code = re.sub(r"\D", "", code or "")
    if len(code) != 6: return False
    now = int(time.time() // 30)
    for c in (now - 1, now, now + 1):
        if _hm.compare_digest(totp_code(secret, c), code) and c > _SH["totp_last"]:
            _SH["totp_last"] = c      # jeder Code nur einmal
            return True
    return False

def otpauth_uri(secret):
    from urllib.parse import quote
    return f"otpauth://totp/{quote('Balu-Mail:Web')}?secret={secret}&issuer=Balu-Mail&digits=6&period=30"

def _fails(ip):
    now = time.time()
    lst = [t for t in _SH["fails"].get(ip, []) if now - t < 900]
    _SH["fails"][ip] = lst
    return lst

def server_login(ip, password, code, keep):
    if len(_fails(ip)) >= 5:
        raise PermissionError("Zu viele Fehlversuche – bitte 15 Minuten warten.")
    allf = sum(len(v) for v in _SH["fails"].values())
    if allf >= 20: time.sleep(3)
    c = server_cfg()
    key = _verify_password(password or "")
    if key is None or not totp_ok(c["totp"], code):
        _SH["fails"].setdefault(ip, []).append(time.time())
        time.sleep(1)
        raise PermissionError("Passwort oder Code falsch.")
    _SH["fails"].pop(ip, None)
    _SH["key"] = key
    sid = secrets.token_urlsafe(32)
    life = 30 * 86400 if keep else 12 * 3600
    _SH["sessions"][sid] = {"csrf": secrets.token_urlsafe(24), "exp": time.time() + life, "life": life}
    return sid, life

# --------------------------------------------------------------------------
# HTTP-Server
# --------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = APP_NAME + "/" + VERSION

    def log_message(self, fmt, *args):
        if "--verbose" in sys.argv:
            super().log_message(fmt, *args)

    def _host_ok(self):
        if SERVER_MODE: return True          # Zugriff wird über die Anmeldung geschützt
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost", "[::1]")

    def end_headers(self):
        if SERVER_MODE:
            self.send_header("X-Frame-Options", "SAMEORIGIN")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            if self._https(): self.send_header("Strict-Transport-Security", "max-age=31536000")
        super().end_headers()

    def _https(self):
        return (self.headers.get("X-Forwarded-Proto") or "").lower() == "https"

    def _client_ip(self):
        ip = self.client_address[0]
        xff = self.headers.get("X-Forwarded-For")
        if xff and (ip.startswith(("127.", "10.", "192.168.")) or re.match(r"172\.(1[6-9]|2\d|3[01])\.", ip)):
            return xff.split(",")[-1].strip()
        return ip

    def _session(self):
        ck = self.headers.get("Cookie") or ""
        m = re.search(SESSION_COOKIE + r"=([A-Za-z0-9_\-]+)", ck)
        if not m: return None
        s = _SH["sessions"].get(m.group(1))
        if not s or s["exp"] < time.time():
            _SH["sessions"].pop(m.group(1), None); return None
        if _SH["key"] is None: return None
        s["exp"] = max(s["exp"], time.time() + min(s["life"], 12 * 3600))   # aktive Sitzung verlängern
        s["sid"] = m.group(1)
        return s

    def _cookie(self, sid, life):
        sec = "; Secure" if self._https() else ""
        self.send_header("Set-Cookie", f"{SESSION_COOKIE}={sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age={life}{sec}")

    def _json(self, obj, status=200):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def _err(self, msg, status=400):
        self._json({"error": msg}, status)

    def _auth(self, qs):
        t = self.headers.get("X-Token") or (qs.get("t") or [""])[0]
        if SERVER_MODE:
            s = self._session()
            return bool(s) and secrets.compare_digest(t, s["csrf"])
        return secrets.compare_digest(t, TOKEN)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}") if n else {}

    def do_GET(self):
        global LAST_HIT
        if not self._host_ok(): return self._err("Nicht erlaubt", 403)
        LAST_HIT = time.time()
        u = urlparse(self.path); qs = parse_qs(u.query)
        if u.path == "/oauth/google":
            try:
                f = g_finish((qs.get("state") or [""])[0], (qs.get("code") or [""])[0], (qs.get("error") or [None])[0])
                ok, msg = not f.get("error"), f.get("error") or "Google-Kalender ist verbunden."
            except Exception as e:
                ok, msg = False, str(e)
            body = (f'<!doctype html><meta charset="utf-8"><title>Balu-Mail</title><body style="font:18px Segoe UI,sans-serif;'
                    f'display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;gap:10px;color:#222">'
                    f'<b style="font-size:22px;color:{"#188038" if ok else "#b3261e"}">{"✓ " if ok else ""}{html.escape(msg)}</b>'
                    f'<span>Du kannst dieses Fenster schließen und zu Balu-Mail zurückkehren.</span>'
                    f'<script>setTimeout(()=>window.close(),2500)</script></body>').encode()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        if not u.path.startswith("/api/"):
            if SERVER_MODE and u.path in ("/", "/index.html") and not self._session():
                return self._static("/login.html")
            return self._static(u.path)
        if not self._auth(qs): return self._err("Nicht angemeldet", 401)
        g = lambda k, d=None: (qs.get(k) or [d])[0]
        if SERVER_MODE and (u.path == "/api/eml" or (u.path == "/api/attachment" and g("eml"))):
            return self._err("Auf der Webseite nicht verfügbar", 403)
        try:
            if u.path == "/api/info":
                return self._json({"demo": DEMO, "version": VERSION, "name": APP_NAME, "windows": os.name == "nt" and not SERVER_MODE, "server": SERVER_MODE})
            if u.path == "/api/accounts":
                return self._json([public_account(a) for a in get_accounts()])
            if u.path == "/api/eml":
                path = g("path", "")
                if not path.lower().endswith(".eml") or not os.path.isfile(path): return self._err("Datei nicht gefunden", 404)
                with open(path, "rb") as f: raw = f.read()
                d = build_message("", "", 0, raw, ["\\Seen"])
                from urllib.parse import quote as _q
                d["html"] = d["html"].replace("&uid=0&idx=", "&uid=0&eml=" + _q(path, safe="") + "&idx=")
                d["eml_path"] = path
                return self._json(d)
            if u.path == "/api/sync/status":
                return self._json(sync_status())
            if u.path == "/api/autoconfig":
                return self._json(autoconfig(g("email", "")))
            if u.path == "/api/settings":
                cfg = load_config()
                return self._json({"ms_client_id": cfg.get("ms_client_id", "") if valid_ms_id(cfg.get("ms_client_id", "")) else "", "fun": cfg.get("fun", {}),
                                   "google_client_id": cfg.get("google_client_id", ""), "google_secret_set": bool(cfg.get("google_client_secret")),
                                   "logo": cur_logo(), "logos": LOGOS, "compose": compose_defaults(cfg),
                                   "feiertage_land": cfg.get("feiertage_land", ""), "laender": BUNDESLAENDER,
                                   "notify_intervals": (cfg.get("notify") or {}).get("intervals") or {}, "notify_default": NOTIFY_DEFAULT})
            if u.path == "/api/update":
                return self._json(upd_status())
            if u.path == "/api/app.apk":
                if not SERVER_MODE: return self._err("Nur auf der Webseite verfügbar", 404)
                fp = apk_file(); size = os.path.getsize(fp)
                if g("check"): return self._json({"ok": True, "size": size})
                self.send_response(200)
                self.send_header("Content-Type", "application/vnd.android.package-archive")
                self.send_header("Content-Disposition", 'attachment; filename="Balu-Mail.apk"')
                self.send_header("Content-Length", str(size)); self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with open(fp, "rb") as f: shutil.copyfileobj(f, self.wfile, 1 << 20)
                return
            if u.path == "/api/oauth/google/poll":
                f = _g_flows.get(g("state") or "")
                if not f: return self._err("Anmeldevorgang abgelaufen")
                return self._json({"done": bool(f["email"] or f["error"]), "email": f["email"], "error": f["error"]})
            if u.path == "/api/cal/sources":
                return self._json(kal_sources_public())
            if u.path == "/api/cal/events":
                frm = dt.datetime.fromisoformat(g("from")[:16]); to = dt.datetime.fromisoformat(g("to")[:16])
                if (to - frm).days > 400: return self._err("Zeitraum zu groß")
                return self._json(kal_occurrences(frm, to))
            if u.path == "/api/fenster":
                return self._json(fenster_ping((g("id") or "")[:40], g("host") == "1"))
            if u.path == "/api/cal/rem":
                return self._json(rem_state())
            if u.path == "/api/folders":
                return self._json(folders_of(g("acc")))
            if u.path == "/api/messages":
                return self._json(list_messages(g("acc"), g("folder", "INBOX"), int(g("page", "0")), g("filter"), g("q"), g("cached") == "1"))
            if u.path == "/api/message":
                return self._json(client(g("acc")).message(g("folder"), int(g("uid"))))
            if u.path == "/api/attachment":
                if g("eml") and not g("eml").lower().endswith(".eml"): return self._err("Nicht erlaubt", 403)
                if g("eml_id"):
                    rawb = _SH.setdefault("eml", {}).get(g("eml_id"))
                    if rawb is None: return self._err("Datei nicht mehr geöffnet – bitte erneut öffnen", 404)
                    ctype, name, data = get_attachment(rawb, int(g("idx")))
                elif DEMO and not g("eml"):
                    data = b"%PDF-1.4\n% Beispieldatei aus dem Demo-Modus\n"; ctype = "application/pdf"; name = "Beispiel.pdf"
                else:
                    if g("eml"):
                        with open(g("eml"), "rb") as f: rawb = f.read()
                    else:
                        rawb = client(g("acc")).raw(g("folder"), int(g("uid")))["body"]
                    ctype, name, data = get_attachment(rawb, int(g("idx")))
                ctype = (ctype or "application/octet-stream").lower()
                # Nur sichere Arten im Browser anzeigen (PDF, Bilder, Text) – alles andere wird heruntergeladen,
                # damit z. B. HTML-Anhänge keinen Zugriff auf Balu-Mail bekommen.
                safe = ctype in SAFE_INLINE
                disp = "attachment" if g("download") or not safe else "inline"
                if ctype == "text/plain": ctype = "text/plain; charset=utf-8"
                self.send_response(200)
                self.send_header("Content-Type", ctype if safe else "application/octet-stream")
                from urllib.parse import quote
                self.send_header("Content-Disposition", f"{disp}; filename*=UTF-8''{quote(name)}")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Cache-Control", "private, no-store")
                self.end_headers(); self.wfile.write(data); return
            return self._err("Unbekannt", 404)
        except Exception as e:
            return self._err(friendly(e), 500)

    def do_POST(self):
        if not self._host_ok(): return self._err("Nicht erlaubt", 403)
        u = urlparse(self.path)
        if SERVER_MODE and u.path == "/login":
            if self.headers.get("X-Requested-With") != "BaluMail": return self._err("Nicht erlaubt", 403)
            try:
                d = self._body()
                sid, life = server_login(self._client_ip(), d.get("password", ""), d.get("code", ""), bool(d.get("keep")))
            except PermissionError as e:
                return self._err(str(e), 401)
            except Exception:
                return self._err("Anmeldung fehlgeschlagen", 400)
            b = b'{"ok": true}'
            self.send_response(200); self._cookie(sid, life)
            self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
            self.end_headers(); self.wfile.write(b); return
        if SERVER_MODE and u.path == "/logout":
            s = self._session()
            if s and secrets.compare_digest(self.headers.get("X-Token") or "", s["csrf"]):
                _SH["sessions"].pop(s["sid"], None)
            b = b'{"ok": true}'
            self.send_response(200); self._cookie("x", 0)
            self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
            self.end_headers(); self.wfile.write(b); return
        if not self._auth({}): return self._err("Nicht angemeldet", 401)
        if SERVER_MODE and u.path in ("/api/quit", "/api/default-apps"):
            return self._err("Auf der Webseite nicht verfügbar", 403)
        try:
            data = self._body()
            if u.path == "/api/flags":
                client(data["acc"]).flags(data["folder"], data["uids"], data.get("add"), data.get("remove"))
                return self._json({"ok": True})
            if u.path == "/api/folder":
                return self._json(folder_action(data))
            if u.path == "/api/move":
                if data.get("target_acc") and data["target_acc"] != data["acc"]:
                    client(data["acc"]).move_to_account(data["folder"], data["uids"], client(data["target_acc"]), data["target"])
                else:
                    client(data["acc"]).move(data["folder"], data["uids"], data["target"])
                return self._json({"ok": True})
            if u.path == "/api/send":
                c = client(data["acc"])
                em = make_email(c.acc, data)
                dsn_ok = True
                if DEMO:
                    c.send(em)
                else:
                    rc = recipients(data)
                    if not rc: return self._err("Bitte mindestens einen Empfänger angeben")
                    del em["Bcc"]
                    dsn_ok = c.send(em, rc, bool(data.get("delivery_receipt")))
                if data.get("draft_uid"):
                    try: c.move(data["draft_folder"], [int(data["draft_uid"])], "trash")
                    except Exception: pass
                draft_sent(data.get("draft_id"))
                return self._json({"ok": True, "dsn": dsn_ok is not False})
            if u.path == "/api/draft":
                return self._json(draft_save(data))
            if u.path == "/api/share":
                return self._json(share_take(data.get("id")))
            if u.path == "/api/open":
                if SERVER_MODE: raise RuntimeError("Auf der Webseite öffnet der Browser Links selbst.")
                return self._json(open_url(data.get("url")))
            if u.path == "/api/draft/delete":
                return self._json(draft_delete(data.get("acc"), data.get("draft_id")))
            if u.path == "/api/settings":
                cfg = load_config()
                if "ms_client_id" in data:
                    cid = (data.get("ms_client_id") or "").strip()
                    if cid and not valid_ms_id(cid):
                        return self._err("Die Microsoft-App-ID sieht aus wie 1a2b3c4d-1234-… (keine E-Mail-Adresse).")
                    cfg["ms_client_id"] = cid; cfg["ms_client_id_updated"] = time.time()
                if isinstance(data.get("fun"), dict):  # Spaß-Modus: nur bekannte Schalter übernehmen
                    f = data["fun"]
                    cfg["fun"] = {k: bool(f.get(k)) for k in ("on", "anim", "sound")}
                    cfg["fun"].update({k: re.sub(r"[^a-z]", "", str(f.get(k) or ""))[:20] for k in ("theme", "incoming")})
                if isinstance(data.get("compose"), dict):  # Voreinstellungen beim Schreiben
                    cfg["compose"] = {k: bool(data["compose"].get(k)) for k in ("prio", "dsn", "mdn")}
                    cfg["compose_updated"] = time.time(); sync_soon()
                if data.get("feiertage_land") is not None and data["feiertage_land"] in BUNDESLAENDER:
                    cfg["feiertage_land"] = data["feiertage_land"]; cfg["prefs_updated"] = time.time(); sync_soon()
                if isinstance(data.get("notify_intervals"), dict):   # Handy: wie oft je Adresse nach neuen Mails sehen
                    iv = {}
                    for em, sec in data["notify_intervals"].items():
                        try: sec = int(sec)
                        except (TypeError, ValueError): continue
                        if 120 <= sec <= 86400 and "@" in em: iv[em.lower()[:200]] = sec
                    cfg.setdefault("notify", {})["intervals"] = iv; cfg["prefs_updated"] = time.time(); sync_soon()
                new_logo = data.get("logo") in LOGOS and data["logo"] != cur_logo()
                if new_logo: cfg["logo"] = data["logo"]; cfg["logo_updated"] = time.time()
                save_config(cfg)
                if new_logo:
                    threading.Thread(target=logo_apply, args=(data["logo"],), daemon=True).start(); sync_soon()
                if "google_client_id" in data or data.get("google_client_secret"):
                    gid = (data.get("google_client_id") or "").strip()
                    if gid and not gid.endswith(".apps.googleusercontent.com"):
                        return self._err("Die Google-Client-ID endet auf „.apps.googleusercontent.com“.")
                    cfg = load_config()
                    cfg["google_client_id"] = gid
                    if data.get("google_client_secret"): cfg["google_client_secret"] = data["google_client_secret"].strip()
                    cfg["google_updated"] = time.time(); save_config(cfg); sync_soon()
                if "ms_client_id" in data: sync_soon()
                return self._json({"ok": True})
            if u.path == "/api/sync/setup":
                if DEMO: return self._err("Im Demo-Modus nicht möglich")
                return self._json(sync_setup(data["acc"], data["password"]))
            if u.path == "/api/sync/join":
                if DEMO: return self._err("Im Demo-Modus nicht möglich")
                return self._json(sync_join(data))
            if u.path == "/api/sync/now":
                return self._json(sync_now())
            if u.path == "/api/sync/off":
                return self._json(sync_off())
            if u.path == "/api/oauth/ms/start":
                return self._json(ms_start())
            if u.path == "/api/oauth/ms/poll":
                return self._json(ms_poll(data.get("flow", "")))
            if u.path == "/api/accounts/test":
                return self._json(test_account(data))
            if u.path == "/api/accounts/save":
                if DEMO: return self._err("Im Demo-Modus können keine Konten gespeichert werden")
                return self._json(save_account(data))
            if u.path == "/api/accounts/order":
                return self._json(reorder_accounts(data.get("ids")))
            if u.path == "/api/accounts/delete":
                if DEMO: return self._err("Im Demo-Modus nicht möglich")
                with _acc_lock:
                    all_accs = load_accounts()
                    gone = next((a for a in all_accs if a["id"] == data["id"]), None)
                    accs = [a for a in all_accs if a["id"] != data["id"]]
                    save_accounts(accs); _clients.pop(data["id"], None)
                    if gone:
                        cfg = load_config(); cfg.setdefault("deleted", {})[gone["email"].lower()] = time.time(); save_config(cfg)
                sync_soon()
                return self._json({"ok": True})
            if u.path == "/api/cal/event/save":
                r = kal_event_save(data); sync_soon()
                return self._json(r)
            if u.path == "/api/cal/event/delete":
                r = kal_event_delete(data); sync_soon()
                return self._json(r)
            if u.path == "/api/cal/source/save":
                r = kal_source_save(data); sync_soon()
                return self._json(r)
            if u.path == "/api/cal/source/delete":
                r = kal_source_delete(data["id"]); sync_soon()
                return self._json(r)
            if u.path == "/api/cal/discover":
                if DEMO: return self._err("Im Demo-Modus nicht möglich")
                try:
                    cals = kal_discover_account(data.get("acc"), data.get("url"), data.get("user"), data.get("password"))
                except RuntimeError as e:
                    if str(e) in ("MICROSOFT", "GOOGLE"): return self._json({"provider": str(e).lower(), "calendars": []})
                    raise
                known = {s.get("url") for s in kal_load()["sources"]}
                return self._json({"calendars": [dict(c, known=c["url"] in known) for c in cals]})
            if u.path == "/api/oauth/google/start":
                try:
                    return self._json(g_start(data.get("origin") or f"http://{self.headers.get('Host')}"))
                except RuntimeError as e:
                    if str(e) == "GOOGLE_SETUP": return self._json({"setup": True})
                    raise
            if u.path == "/api/cal/sync":
                threading.Thread(target=lambda: kal_sync_all(force=True), daemon=True).start()
                return self._json({"ok": True})
            if u.path == "/api/cal/invite":
                r = kal_invite_answer(data); sync_soon()
                return self._json(r)
            if u.path == "/api/update/settings":
                upd_save(data)
                return self._json(upd_status())
            if u.path == "/api/cal/rem":
                return self._json(rem_set(data.get("key"), data.get("val")))
            if u.path == "/api/update/msi":
                return self._json(msi_install())
            if u.path == "/api/update/check":
                def _forced():
                    _upd_force.on = True
                    try: upd_check()
                    finally: _upd_force.on = False
                threading.Thread(target=_forced, daemon=True).start()
                time.sleep(.2)
                return self._json(upd_status())
            if u.path == "/api/update/install":
                upd_apply()
                return self._json({"ok": True})
            if u.path == "/api/eml/upload":
                raw = base64.b64decode(data.get("data") or "")
                if not raw or len(raw) > 40 * 1024 * 1024: return self._err("Datei leer oder zu groß (max. 40 MB)")
                store = _SH.setdefault("eml", {})
                while len(store) >= 20: store.pop(next(iter(store)))
                eid = secrets.token_hex(8); store[eid] = raw
                d = build_message("", "", 0, raw, ["\\Seen"])
                d["html"] = d["html"].replace("&uid=0&idx=", "&uid=0&eml_id=" + eid + "&idx=")
                d["eml_id"] = eid; d["eml_name"] = (data.get("name") or "nachricht.eml")[:200]
                return self._json(d)
            if u.path == "/api/default-apps":
                if os.name != "nt": return self._err("Nur unter Windows verfügbar")
                try: os.startfile("ms-settings:defaultapps?registeredAppMachine=Balu-Mail")
                except Exception: os.startfile("ms-settings:defaultapps")
                return self._json({"ok": True})
            if u.path == "/api/quit":
                self._json({"ok": True})
                threading.Thread(target=lambda: (time.sleep(.3), os._exit(0)), daemon=True).start(); return
            return self._err("Unbekannt", 404)
        except Exception as e:
            return self._err(friendly(e), 500)

    def _static(self, path):
        if path in ("/", ""): path = "/index.html"
        fp = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
        if not fp.startswith(WEB_DIR) or not os.path.isfile(fp):
            return self._err("Nicht gefunden", 404)
        with open(fp, "rb") as f: data = f.read()
        if fp.endswith("index.html"):
            if SERVER_MODE:
                se = self._session()
                data = data.replace(b"__TOKEN__", se["csrf"].encode() if se else b"")
            else:
                data = data.replace(b"__TOKEN__", TOKEN.encode() if TOKEN_IN_PAGE else b"")
        if fp.endswith(".html"):
            data = data.replace(b"__LOGO__", cur_logo().encode())   # gewähltes Programm-Symbol (Fenster, Taskleiste, Kopfzeile)
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"): ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

def _send_with_bcc(c, em, rcpts):
    c.send(em, rcpts)

def friendly(e):
    s = str(e)
    if isinstance(e, imaplib.IMAP4.error) and ("AUTH" in s.upper() or "LOGIN" in s.upper() or "credentials" in s.lower()):
        return "Anmeldung fehlgeschlagen – bitte E-Mail-Adresse/Passwort prüfen (bei GMX: IMAP in den Einstellungen freischalten, bei Gmail: App-Passwort nutzen)."
    if isinstance(e, smtplib.SMTPAuthenticationError):
        return "Anmeldung am Postausgangsserver fehlgeschlagen – Passwort prüfen."
    if isinstance(e, (socket.gaierror,)):
        return "Server nicht gefunden – Adresse des Servers prüfen."
    if isinstance(e, (socket.timeout, TimeoutError)):
        return "Zeitüberschreitung – keine Verbindung zum Server."
    if isinstance(e, ssl.SSLError):
        return "Sichere Verbindung fehlgeschlagen (SSL) – Port prüfen."
    return s or e.__class__.__name__

def test_account(data):
    acc = dict(data); acc["_temp"] = True
    if data.get("auth") == "oauth_ms":
        f = _ms_flows.get(data.get("oauth_flow") or "")
        if f and f["refresh"]:
            acc["refresh_token"] = enc_pw(f["refresh"]); acc["id"] = "tmp-" + secrets.token_hex(4)
        elif data.get("id"):
            old = next((a for a in load_accounts() if a["id"] == data["id"]), None)
            if old: acc["refresh_token"] = old.get("refresh_token")
        if not acc.get("refresh_token"):
            return {"ok": False, "errors": ["Bitte zuerst „Bei Microsoft anmelden“ ausführen."]}
    elif data.get("password"):
        acc["password"] = enc_pw(data["password"])
    elif data.get("id"):
        old = next((a for a in load_accounts() if a["id"] == data["id"]), None)
        if old: acc["password"] = old["password"]
    errors = []
    try:
        ia = ImapAccount(acc); ia._connect(); ia.conn.logout()
    except Exception as e:
        errors.append("Posteingang (IMAP): " + friendly(e))
    try:
        s = smtp_open(acc, timeout=20); s.quit()
    except Exception as e:
        errors.append("Postausgang (SMTP): " + friendly(e))
    return {"ok": not errors, "errors": errors}

def save_account(data):
    with _acc_lock:
        accs = load_accounts()
        if data.get("id"):
            acc = next((a for a in accs if a["id"] == data["id"]), None)
            if not acc: raise KeyError("Konto nicht gefunden")
        else:
            acc = {"id": uuid.uuid4().hex[:10], "color": COLORS[len(accs) % len(COLORS)]}
            accs.append(acc)
        for k in ("name", "email", "user", "imap_host", "smtp_host", "color"):
            if k in data: acc[k] = (data[k] or "").strip()
        acc["imap_port"] = int(data.get("imap_port") or 993)
        acc["smtp_port"] = int(data.get("smtp_port") or 587)
        acc["save_sent"] = bool(data.get("save_sent", True))
        acc["identities"] = [x.strip() for x in (data.get("identities") or []) if x.strip()]
        acc["auth"] = data.get("auth") or "password"
        if acc["auth"] == "oauth_ms":
            f = _ms_flows.get(data.get("oauth_flow") or "")
            if f and f["refresh"]:
                acc["refresh_token"] = enc_pw(f["refresh"]); _ms_tokens.pop(acc["id"], None)
            if not acc.get("refresh_token"):
                raise ValueError("Bitte zuerst „Bei Microsoft anmelden“ ausführen")
        else:
            if data.get("password"):
                acc["password"] = enc_pw(data["password"])
            if not acc.get("password"):
                raise ValueError("Bitte Passwort angeben")
        acc["updated"] = time.time()
        cfg = load_config(); cfg.get("deleted", {}).pop(acc["email"].lower(), None); save_config(cfg)
        save_accounts(accs)
        _clients.pop(acc["id"], None)
    sync_soon()
    return public_account(acc)


# --------------------------------------------------------------------------
# Synchronisation der Konten zwischen Geräten (verschlüsselt im eigenen Mailkonto)
# --------------------------------------------------------------------------
import hashlib, hmac, zlib
SYNC_FOLDER = "Balu-Mail-Sync"
SYNC_SUBJECT = "Balu-Mail Synchronisation – bitte nicht löschen"
_sync_lock = threading.Lock()
_sync_state = {"last": None, "error": None, "running": False, "rev": 0}

def _keys(password: str, salt: bytes):
    k = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 300_000, dklen=64)
    return k[:32], k[32:]

def _stream(key: bytes, nonce: bytes, n: int) -> bytes:
    out, i = bytearray(), 0
    while len(out) < n:
        out += hmac.new(key, nonce + i.to_bytes(8, "big"), hashlib.sha256).digest(); i += 1
    return bytes(out[:n])

def seal(obj, password: str) -> bytes:
    """Verschlüsseln + Integritätsschutz (PBKDF2-SHA256, HMAC-SHA256-Strom, HMAC-Prüfsumme)."""
    pt = zlib.compress(json.dumps(obj, ensure_ascii=False).encode("utf-8"), 9)
    salt, nonce = os.urandom(16), os.urandom(16)
    ek, mk = _keys(password, salt)
    ct = bytes(a ^ b for a, b in zip(pt, _stream(ek, nonce, len(pt))))
    tag = hmac.new(mk, b"BALU1" + salt + nonce + ct, hashlib.sha256).digest()
    return b"BALU1" + salt + nonce + tag + ct

def unseal(blob: bytes, password: str):
    if not blob.startswith(b"BALU1") or len(blob) < 69: raise ValueError("Keine gültigen Sync-Daten")
    salt, nonce, tag, ct = blob[5:21], blob[21:37], blob[37:69], blob[69:]
    ek, mk = _keys(password, salt)
    if not hmac.compare_digest(tag, hmac.new(mk, b"BALU1" + salt + nonce + ct, hashlib.sha256).digest()):
        raise ValueError("Sync-Passwort falsch")
    pt = bytes(a ^ b for a, b in zip(ct, _stream(ek, nonce, len(ct))))
    return json.loads(zlib.decompress(pt).decode("utf-8"))

SYNC_FIELDS = ("name", "email", "user", "imap_host", "imap_port", "smtp_host", "smtp_port", "save_sent", "identities", "auth", "color")

def _export_doc():
    accs = load_accounts(); cfg = load_config()
    out = []
    for a in accs:
        e = {k: a.get(k) for k in SYNC_FIELDS}
        e["updated"] = a.get("updated") or 1     # alte Konten ohne Zeitstempel trotzdem übertragen
        try:
            if a.get("auth") == "oauth_ms": e["refresh_token"] = dec_pw(a["refresh_token"])
            else: e["password"] = dec_pw(a["password"])
        except Exception:
            continue
        out.append(e)
    gt = {}
    for em, t in (cfg.get("google_tokens") or {}).items():
        try: gt[em] = dec_pw(t)
        except Exception: pass
    return {"v": 1, "accounts": out, "deleted": cfg.get("deleted", {}),
            "settings": {"ms_client_id": cfg.get("ms_client_id", ""), "ms_client_id_updated": cfg.get("ms_client_id_updated", 0),
                         "google_client_id": cfg.get("google_client_id", ""), "google_client_secret": cfg.get("google_client_secret", ""),
                         "google_updated": cfg.get("google_updated", 0),
                         "logo": cfg.get("logo", ""), "logo_updated": cfg.get("logo_updated", 0),
                         "acc_order": cfg.get("acc_order", []), "acc_order_updated": cfg.get("acc_order_updated", 0),
                         "google_tokens": gt, "google_tokens_updated": cfg.get("google_tokens_updated", 0),
                         "upd_token": upd_token(), "upd_token_updated": (cfg.get("update") or {}).get("token_updated", 0),
                         "compose": cfg.get("compose"), "compose_updated": cfg.get("compose_updated", 0),
                         "prefs": {"feiertage_land": cfg.get("feiertage_land", ""), "notify_intervals": (cfg.get("notify") or {}).get("intervals") or {}},
                         "prefs_updated": cfg.get("prefs_updated", 0),
                         "rem": cfg.get("rem", {})},
            "kal": _kal_export()}

# ---- Kalender im Abgleich ----
KAL_SYNC_KEYS = ("id", "type", "url", "name", "color", "enabled", "readonly", "google")

def _kal_items(k):
    """Alle abzugleichenden Kalender-Einträge: Kalenderliste (s:…) und eigene Termine (e:…)."""
    accs = {a["id"]: a["email"].lower() for a in load_accounts()}
    items = {}
    for src in k["sources"]:
        e = {kk: src.get(kk) for kk in KAL_SYNC_KEYS}
        if src.get("acc"): e["acc_email"] = accs.get(src["acc"], "")
        if src["type"] == "caldav" and not src.get("acc") and not src.get("google"): e["user"] = src.get("user", "")
        items["s:" + src["id"]] = e
    for uid, txt in k["local"].items(): items["e:" + uid] = txt
    return items

def _kal_hash(v):
    return hashlib.sha1(json.dumps(v, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def _kal_stamp(k):
    """Vergleicht mit dem zuletzt gesehenen Stand und vergibt Änderungs-/Löschzeitpunkte."""
    items = _kal_items(k)
    seen = k.setdefault("sync_seen", {}); ts = k.setdefault("sync_ts", {}); dele = k.setdefault("sync_deleted", {})
    now = time.time(); ch = False
    for key, val in items.items():
        h = _kal_hash(val)
        if seen.get(key) != h: seen[key] = h; ts[key] = now; dele.pop(key, None); ch = True
    for key in [x for x in seen if x not in items]:
        seen.pop(key, None); ts.pop(key, None); dele[key] = now; ch = True
    return items, ch

def _kal_export():
    with KAL_LOCK:
        k = kal_load(); items, ch = _kal_stamp(k)
        if ch: kal_save(k)
        out = {}
        for key, val in items.items():
            if key.startswith("s:"):
                val = dict(val); src = kal_source(k, key[2:])
                if "user" in val:
                    try: val["password"] = dec_pw(src.get("password", ""))
                    except Exception: pass
            out[key] = {"v": val, "t": k["sync_ts"].get(key, 0)}
        return {"items": out, "deleted": dict(k["sync_deleted"])}

def _kal_merge(rk):
    """Kalender eines anderen Geräts einspielen (neuere Änderung gewinnt). Gibt True zurück, wenn sich etwas geändert hat."""
    if not rk: return False
    new_src = []; changed = False
    with KAL_LOCK:
        k = kal_load(); _kal_stamp(k)
        seen, ts, dele = k["sync_seen"], k["sync_ts"], k["sync_deleted"]
        accs = {a["email"].lower(): a["id"] for a in load_accounts()}
        for key, t in (rk.get("deleted") or {}).items():
            if t <= max(ts.get(key, 0), dele.get(key, 0)): continue
            dele[key] = t; seen.pop(key, None); ts.pop(key, None)
            if key.startswith("e:"):
                if k["local"].pop(key[2:], None) is not None: changed = True
            elif key[2:] not in ("lokal", "feiertage"):
                before = len(k["sources"]); k["sources"] = [x for x in k["sources"] if x["id"] != key[2:]]
                if len(k["sources"]) != before:
                    changed = True
                    try: os.remove(os.path.join(kal_cache_dir(), re.sub(r"[^\w-]", "_", key[2:]) + ".json"))
                    except OSError: pass
        for key, it in (rk.get("items") or {}).items():
            t = it.get("t", 0); v = it.get("v")
            if t <= max(ts.get(key, 0), dele.get(key, 0)) or v is None: continue
            if key.startswith("e:"):
                k["local"][key[2:]] = v
            else:
                v = dict(v); pw = v.pop("password", None); acc_mail = v.pop("acc_email", None)
                src = next((x for x in k["sources"] if x["id"] == v.get("id")), None)
                if not src:
                    src = {}; k["sources"].append(src); new_src.append(v.get("id"))
                elif src.get("url") != v.get("url"): new_src.append(v.get("id"))
                for kk in KAL_SYNC_KEYS: src[kk] = v.get(kk)
                if acc_mail is not None: src["acc"] = accs.get(acc_mail)
                if "user" in v: src["user"] = v["user"]
                if pw is not None: src["password"] = enc_pw(pw)
            dele.pop(key, None); changed = True
            items = _kal_items(k)
            if key in items: seen[key] = _kal_hash(items[key]); ts[key] = t
        if changed: kal_save(k)
    for sid in new_src:
        threading.Thread(target=lambda x=sid: kal_sync_one(x), daemon=True).start()
    return changed

def _fingerprint(doc):
    d = {"a": sorted(doc["accounts"], key=lambda x: x["email"].lower()), "d": doc["deleted"], "s": doc["settings"], "k": doc.get("kal")}
    return hashlib.sha256(json.dumps(d, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def _merge(remote):
    """Fremde Daten einspielen: neuere Einträge gewinnen, Löschungen werden übernommen."""
    changed = False
    with _acc_lock:
        accs = load_accounts(); cfg = load_config()
        deleted = dict(cfg.get("deleted", {}))
        for em, ts in (remote.get("deleted") or {}).items():
            if ts > deleted.get(em, 0): deleted[em] = ts
        by_mail = {a["email"].lower(): a for a in accs}
        for r in remote.get("accounts", []):
            em = r["email"].lower()
            dts = deleted.get(em, 0)
            if dts and dts >= r.get("updated", 0): continue
            loc = by_mail.get(em)
            if loc and loc.get("updated", 0) >= r.get("updated", 0): continue
            if not loc:
                loc = {"id": uuid.uuid4().hex[:10]}; accs.append(loc); by_mail[em] = loc
            for k in SYNC_FIELDS:
                if k in r: loc[k] = r[k]
            loc["updated"] = r.get("updated", 0)
            if r.get("refresh_token"): loc["refresh_token"] = enc_pw(r["refresh_token"]); loc.pop("password", None)
            if r.get("password"): loc["password"] = enc_pw(r["password"]); loc.pop("refresh_token", None)
            loc.setdefault("color", COLORS[len(accs) % len(COLORS)])
            _clients.pop(loc["id"], None); _ms_tokens.pop(loc["id"], None)
            changed = True
        keep = []
        vault = ((cfg.get("sync") or {}).get("email") or "").lower()
        for a in accs:
            ts = deleted.get(a["email"].lower(), 0)
            if ts and ts >= a.get("updated", 0) and a["email"].lower() != vault:   # Sync-Konto nie automatisch entfernen
                _clients.pop(a["id"], None); changed = True
                _sync_state.setdefault("removed", []).append(a["email"])
            else:
                keep.append(a)
        st = remote.get("settings") or {}
        if st.get("ms_client_id_updated", 0) > cfg.get("ms_client_id_updated", 0):
            cfg["ms_client_id"] = st.get("ms_client_id", ""); cfg["ms_client_id_updated"] = st["ms_client_id_updated"]; changed = True
        if st.get("google_updated", 0) > cfg.get("google_updated", 0):
            for k in ("google_client_id", "google_client_secret", "google_updated"): cfg[k] = st.get(k, "")
            changed = True
        if st.get("logo_updated", 0) > cfg.get("logo_updated", 0) and st.get("logo") in LOGOS:
            cfg["logo"] = st["logo"]; cfg["logo_updated"] = st["logo_updated"]; changed = True
            threading.Thread(target=logo_apply, args=(st["logo"],), daemon=True).start()
        if st.get("acc_order_updated", 0) > cfg.get("acc_order_updated", 0):
            cfg["acc_order"] = list(st.get("acc_order") or []); cfg["acc_order_updated"] = st["acc_order_updated"]; changed = True
        rgt = st.get("google_tokens") or {}
        newer = st.get("google_tokens_updated", 0) > cfg.get("google_tokens_updated", 0)
        lgt = cfg.setdefault("google_tokens", {})
        for em, t in rgt.items():
            # neuere Anmeldung übernehmen – und fehlende immer (auch von älteren Ständen ohne Zeitstempel)
            if em not in lgt or newer:
                if em in lgt and dec_pw(lgt[em]) == t: continue
                lgt[em] = enc_pw(t); _g_tokens.pop(em, None); changed = True
        if newer: cfg["google_tokens_updated"] = st["google_tokens_updated"]
        if isinstance(st.get("prefs"), dict) and st.get("prefs_updated", 0) > cfg.get("prefs_updated", 0):
            pr = st["prefs"]
            if pr.get("feiertage_land", "") in BUNDESLAENDER: cfg["feiertage_land"] = pr.get("feiertage_land", "")
            if isinstance(pr.get("notify_intervals"), dict): cfg.setdefault("notify", {})["intervals"] = pr["notify_intervals"]
            cfg["prefs_updated"] = st["prefs_updated"]; changed = True
        if isinstance(st.get("compose"), dict) and st.get("compose_updated", 0) > cfg.get("compose_updated", 0):
            cfg["compose"] = st["compose"]; cfg["compose_updated"] = st["compose_updated"]; changed = True
        # Update-Schlüssel: neueren übernehmen, fehlenden immer ergänzen
        u = cfg.setdefault("update", {}); rt = (st.get("upd_token") or "").strip()
        lt = ""
        try: lt = dec_pw(u["token"]) if u.get("token") else ""
        except Exception: pass
        if st.get("upd_token_updated", 0) > u.get("token_updated", 0) or (rt and not lt):
            if rt != lt:
                if rt: u["token"] = enc_plain(rt)
                else: u.pop("token", None)
                changed = True
            u["token_updated"] = max(st.get("upd_token_updated", 0), u.get("token_updated", 0))
        if rem_merge(cfg, st.get("rem")): changed = True
        keep = _apply_order(keep, cfg.get("acc_order"))
        cfg["deleted"] = deleted
        save_accounts(keep); save_config(cfg)
    try:
        if _kal_merge(remote.get("kal")): changed = True
    except Exception as e:
        print("Kalender-Abgleich:", e)
    return changed

def _sync_client(sc):
    """IMAP-Verbindung zum Tresor-Konto (eingerichtetes Konto oder Zugangsdaten aus der Sync-Einstellung)."""
    acc = next((a for a in load_accounts() if a["email"].lower() == sc["email"].lower()), None)
    if acc: return client(acc["id"])
    tmp = {"id": "sync-" + hashlib.sha1(sc["email"].encode()).hexdigest()[:8], "_temp": True, **sc["server"]}
    return ImapAccount(tmp)

def _remote_read(ia, password):
    def fn(c):
        typ, _ = c.select(q(SYNC_FOLDER))
        ia.selected = None
        if typ != "OK": return None
        ia.selected = SYNC_FOLDER
        typ, d = c.uid("SEARCH", "ALL")
        uids = sorted(int(x) for x in (d[0] or b"").split())
        if not uids: return None
        typ, d = c.uid("FETCH", str(uids[-1]), "(UID BODY.PEEK[])")
        recs = parse_fetch(d)
        if not recs: return None
        msg = email.message_from_bytes(recs[0]["body"], policy=email.policy.default)
        for part in msg.iter_attachments():
            if part.get_filename() == "balu-sync.bin":
                return {"uids": uids, "doc": unseal(part.get_payload(decode=True), password)}
        return None
    return ia.run(fn)

def _remote_write(ia, doc, password, old_uids):
    em = EmailMessage()
    em["From"] = em["To"] = ia.acc["email"]
    em["Subject"] = SYNC_SUBJECT
    em["Date"] = email.utils.formatdate(localtime=True)
    em.set_content("Diese Nachricht enthält die verschlüsselten Konteneinstellungen von Balu-Mail.\n"
                   "Sie wird automatisch aktualisiert. Bitte nicht löschen oder verschieben.\n")
    em.add_attachment(seal(doc, password), maintype="application", subtype="octet-stream", filename="balu-sync.bin")
    def fn(c):
        c.create(q(SYNC_FOLDER))
        try: c.subscribe(q(SYNC_FOLDER))
        except Exception: pass
        typ, d = c.append(q(SYNC_FOLDER), "(\\Seen)", imaplib.Time2Internaldate(time.time()), em.as_bytes())
        if typ != "OK": raise RuntimeError("Sync-Daten konnten nicht gespeichert werden")
        if old_uids:
            c.select(q(SYNC_FOLDER)); ia.selected = SYNC_FOLDER
            s = ",".join(map(str, old_uids))
            c.uid("STORE", s, "+FLAGS.SILENT", "(\\Deleted)")
            if "UIDPLUS" in getattr(ia, "caps", set()): c.uid("EXPUNGE", s)
            else: c.expunge()
    ia.run(fn)

def sync_now():
    sc = load_config().get("sync")
    if not sc or DEMO: return {"enabled": False}
    if not _sync_lock.acquire(blocking=False): return sync_status()
    _sync_state["running"] = True
    try:
        pw = dec_pw(sc["password"])
        ia = _sync_client(sc)
        remote = _remote_read(ia, pw)
        changed = _merge(remote["doc"]) if remote else False
        doc = _export_doc()
        if not remote or _fingerprint(doc) != _fingerprint(remote["doc"]):
            _remote_write(ia, doc, pw, remote["uids"] if remote else [])
        if changed: _sync_state["rev"] += 1
        _sync_state["last"] = time.time(); _sync_state["error"] = None
    except Exception as e:
        _sync_state["error"] = friendly(e)
    finally:
        _sync_state["running"] = False
        _sync_lock.release()
    return sync_status()

def sync_status():
    sc = load_config().get("sync")
    return {"enabled": bool(sc), "email": sc["email"] if sc else None, "last": _sync_state["last"],
            "error": _sync_state["error"], "running": _sync_state["running"], "rev": _sync_state["rev"],
            "removed": _sync_state.get("removed", [])}

def sync_soon():
    if load_config().get("sync") and not DEMO:
        threading.Thread(target=sync_now, daemon=True).start()

def sync_loop():
    if STOP.wait(3): return
    while not STOP.is_set():
        try: sync_now()
        except Exception: pass
        if STOP.wait(300): return

def _server_of(acc):
    return {k: acc.get(k) for k in ("email", "user", "imap_host", "imap_port", "smtp_host", "smtp_port", "auth", "password")}

def sync_setup(acc_id, password):
    if len(password) < 8: raise ValueError("Das Sync-Passwort muss mindestens 8 Zeichen haben")
    acc = next((a for a in load_accounts() if a["id"] == acc_id), None)
    if not acc: raise KeyError("Konto nicht gefunden")
    if acc.get("auth") == "oauth_ms": raise ValueError("Bitte ein Konto mit Passwort-Anmeldung wählen (z. B. GMX)")
    ia = client(acc_id)
    try:
        remote = _remote_read(ia, password)
    except ValueError:
        raise ValueError("In diesem Konto gibt es schon Sync-Daten mit einem anderen Sync-Passwort")
    cfg = load_config()
    cfg["sync"] = {"email": acc["email"], "password": enc_pw(password), "server": _server_of(acc)}
    save_config(cfg)
    return sync_now()

def sync_join(data):
    """Neues Gerät: Tresor-Konto + Sync-Passwort eingeben, alle Konten übernehmen."""
    em = data["email"].strip(); pw = data["password"]; spw = data["sync_password"]
    srv = data.get("server") or autoconfig(em)
    server = {"email": em, "user": srv.get("user") or em, "imap_host": srv["imap_host"], "imap_port": int(srv.get("imap_port") or 993),
              "smtp_host": srv["smtp_host"], "smtp_port": int(srv.get("smtp_port") or 587), "auth": "password", "password": enc_pw(pw)}
    ia = ImapAccount({"id": "sync-join", "_temp": True, **server})
    remote = _remote_read(ia, spw)
    if not remote: raise ValueError("In diesem Konto wurden keine Balu-Mail-Sync-Daten gefunden. Bitte zuerst am anderen Gerät die Synchronisation einrichten.")
    _merge(remote["doc"])
    cfg = load_config()
    cfg["sync"] = {"email": em, "password": enc_pw(spw), "server": server}
    save_config(cfg)
    _sync_state["rev"] += 1
    return sync_now()

def sync_off():
    cfg = load_config(); cfg.pop("sync", None); save_config(cfg)
    return sync_status()

def open_window(url):
    """Öffnet Balu-Mail als eigenes Programmfenster (Balu-Mail.exe; sonst Edge/Chrome im App-Modus)."""
    if os.name == "nt" and not os.environ.get("BALUMAIL_NOHOST"):
        host = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(sys.executable))), "Balu-Mail.exe")
        # nur das neue Programmfenster (mit WebView2) – das alte Startprogramm würde Python erneut starten (Endlosschleife)
        if os.path.isfile(host) and os.path.isfile(os.path.join(os.path.dirname(host), "Microsoft.Web.WebView2.Core.dll")):
            try:
                args = [host, "--show"]
                from urllib.parse import unquote as _uq
                m = re.match(r".*#(mailto|eml)=(.*)$", url)
                if m: args += ["--" + m.group(1), _uq(m.group(2))]
                subprocess.Popen(args, close_fds=True)
                return
            except Exception:
                pass
    if os.name == "nt":
        cands = [shutil.which("msedge"),
                 os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
                 os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
                 shutil.which("chrome"),
                 os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                 os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe")]
        for c in cands:
            if c and os.path.exists(c):
                try:
                    subprocess.Popen([c, "--app=" + url, "--window-size=1500,900"], close_fds=True)
                    return
                except Exception:
                    pass
    webbrowser.open(url)

def set_data_dir(d):
    global ACCOUNTS_FILE, CONFIG_FILE
    os.makedirs(d, exist_ok=True)
    ACCOUNTS_FILE = os.path.join(d, "konten.json")
    CONFIG_FILE = os.path.join(d, "einstellungen.json")

# --------------------------------------------------------------------------
# Benachrichtigungen (Handy-App): Posteingänge regelmäßig auf neue Mails prüfen
NOTIFY_DEFAULT = 900                                   # alle 15 Minuten

def notify_interval(acc):
    iv = (load_config().get("notify") or {}).get("intervals") or {}
    em = (acc.get("email") or "").lower()
    try:
        return max(120, int(iv.get(em) or NOTIFY_DEFAULT))
    except (TypeError, ValueError):
        return NOTIFY_DEFAULT

def _notify_file():
    return os.path.join(os.path.dirname(CONFIG_FILE), "benachrichtigungen.json")

def _notify_load():
    try:
        with open(_notify_file(), encoding="utf-8") as f: return json.load(f)
    except Exception:
        return {}

def _notify_save(st):
    tmp = _notify_file() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(st, f)
    os.replace(tmp, _notify_file())

def _uids(c, crit):
    typ, d = c.uid("SEARCH", None, crit)
    if typ != "OK": raise RuntimeError("Suche fehlgeschlagen")
    return sorted(int(x) for x in (d[0] or b"").split())

def mail_check(acc, st):
    """Neue ungelesene Mails im Posteingang seit der letzten Prüfung (beim ersten Mal nur merken)."""
    cl = client(acc["id"])
    def fn(c):
        cl.selected = None
        typ, _ = c.select("INBOX", readonly=True)
        if typ != "OK": raise RuntimeError("Posteingang nicht gefunden")
        try:
            uv = (c.response("UIDVALIDITY")[1] or [b""])[0]
            uv = uv.decode() if isinstance(uv, bytes) else str(uv or "")
        except Exception:
            uv = ""
        try:
            last = int(st.get("last") or 0)
            if not last or st.get("uv") != uv:
                allu = _uids(c, "ALL")
                st.update(uv=uv, last=allu[-1] if allu else 0)
                return []
            new = [u for u in _uids(c, f"UID {last + 1}:*") if u > last]
            if not new: return []
            st["fresh"] = True
            st["last"] = new[-1]
            unseen = [u for u in _uids(c, f"UID {last + 1}:* UNSEEN") if u > last]
            out = []
            if unseen:
                pick = unseen[-5:]
                typ, d = c.uid("FETCH", ",".join(map(str, pick)), "(UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])")
                for part in d or []:
                    if not isinstance(part, tuple): continue
                    m = re.search(rb"UID (\d+)", part[0])
                    h = email.message_from_bytes(part[1] or b"", policy=email.policy.default)
                    frm = (addr_list(safe_header(h, "From")) or [{"name": "", "email": ""}])[0]
                    out.append({"uid": int(m.group(1)) if m else 0, "from": frm["name"] or frm["email"] or "Unbekannt",
                                "subject": str(safe_header(h, "Subject") or "(kein Betreff)")})
            return {"items": sorted(out, key=lambda x: x["uid"]), "count": len(unseen)}
        finally:
            cl.selected = None
            try: c.close()
            except Exception: pass
    return cl.run(fn)

def android_notify(acc, res):
    from java import jclass
    N = jclass("de.balumail.app.Notifier")
    items, count = res["items"], res["count"]
    if count > len(items):
        N.summary(acc["id"], acc.get("email") or "", int(count), ", ".join(dict.fromkeys(i["from"] for i in items)))
    for i in items:
        N.newMail(acc["id"], acc.get("email") or "", i["from"], i["subject"], "INBOX", str(i["uid"]))

def notify_loop():
    """Läuft in der Handy-App, solange der Hintergrunddienst aktiv ist."""
    due, st = {}, _notify_load()
    while not STOP.wait(15):
        try:
            accs = load_accounts()
        except Exception:
            continue
        now, changed = time.time(), False
        for a in accs:
            aid = a.get("id")
            if not aid or now < due.get(aid, 0): continue
            due[aid] = now + notify_interval(a)
            s = st.setdefault(aid, {})
            before = dict(s)
            try:
                res = mail_check(a, s)
                if res and res.get("count"):
                    android_notify(a, res)
                if s.pop("fresh", False):
                    # neue Mails: Posteingang gleich laden, damit er beim Öffnen der App schon da ist
                    list_messages(aid, "INBOX")
                    list_messages(aid, "INBOX", filt="unread")
            except Exception as e:
                say("Benachrichtigung", a.get("email"), e)
            if s != before: changed = True
            if STOP.is_set(): break
        for aid in [k for k in st if k not in {a.get("id") for a in accs}]:
            st.pop(aid, None); changed = True
        if changed:
            try: _notify_save(st)
            except Exception: pass

def run_android(data_path, token, port=8025):
    """Start aus der Android-App: Server im App-Prozess, Token kommt von der App."""
    global TOKEN, TOKEN_IN_PAGE, ANDROID, SERVER
    set_data_dir(data_path)
    mod = load_newer_module()            # per Update geladene neuere Version bevorzugen
    if mod is not None:
        return mod.run_android(data_path, token, port)
    TOKEN, TOKEN_IN_PAGE, ANDROID = token, False, True
    list_cache_load()
    srv = ThreadingHTTPServer(("127.0.0.1", int(port)), Handler)
    SERVER = srv
    if not play_build():
        threading.Thread(target=upd_loop, daemon=True).start()
        threading.Thread(target=apk_update_loop, daemon=True).start()
    threading.Thread(target=sync_loop, daemon=True).start()
    threading.Thread(target=kal_loop, daemon=True).start()
    threading.Thread(target=logo_startup, daemon=True).start()
    threading.Thread(target=draft_cleanup_all, daemon=True).start()
    threading.Thread(target=notify_loop, daemon=True).start()
    srv.serve_forever()
    srv.server_close()
    if RESTART:
        mod = load_newer_module()
        if mod is not None:
            return mod.run_android(data_path, token, port)
        return run_android_again(data_path, token, port)

def run_android_again(data_path, token, port):
    """Neue Version war defekt: eingebaute Version wieder starten."""
    global RESTART
    RESTART = False; STOP.clear()
    return run_android(data_path, token, port)

def say(*a):
    try:
        if sys.stdout: print(*a)
    except Exception:
        pass

def _arg(name):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv): return sys.argv[i + 1]
    return None

def launch_fragment():
    """mailto:-Link oder .eml-Datei aus dem Windows-Aufruf an die Oberfläche weitergeben."""
    from urllib.parse import quote
    m = _arg("--mailto")
    if m and m.lower().startswith("mailto:"): return "#mailto=" + quote(m, safe="")
    e = _arg("--eml")
    if e and os.path.isfile(e): return "#eml=" + quote(os.path.abspath(e), safe="")
    return ""

def server_cli():
    """Ersteinrichtung/Passwortwechsel für die Webseite (liest Eingaben von der Tastatur oder stdin)."""
    import getpass
    def ask(prompt):
        if sys.stdin.isatty(): return getpass.getpass(prompt)
        print(prompt, end="", flush=True); return sys.stdin.readline().rstrip("\n")
    if "--server-setup" in sys.argv:
        pw = ask("Neues Anmeldepasswort für die Webseite (mind. 10 Zeichen): ")
        if ask("Passwort wiederholen: ") != pw: print("\nFEHLER: Die Passwörter stimmen nicht überein."); sys.exit(1)
        try: secret = server_setup(pw)
        except ValueError as e: print("\nFEHLER:", e); sys.exit(1)
        print("\n\nOK – Webseite eingerichtet.")
        print("Code-App (z. B. Bitwarden/Google Authenticator) – Schlüssel manuell eingeben:")
        print("  " + " ".join(secret[i:i+4] for i in range(0, len(secret), 4)))
        print("Oder diesen Link auf dem Handy öffnen:  " + otpauth_uri(secret))
        sys.exit(0)
    if "--server-passwort" in sys.argv:
        try: server_change_password(ask("Bisheriges Passwort: "), ask("Neues Passwort (mind. 10 Zeichen): "))
        except ValueError as e: print("\nFEHLER:", e); sys.exit(1)
        print("\nOK – Passwort geändert."); sys.exit(0)
    if "--server-code" in sys.argv:
        c = server_cfg()
        if not c: print("Noch nicht eingerichtet."); sys.exit(1)
        print(" ".join(c["totp"][i:i+4] for i in range(0, len(c["totp"]), 4))); print(otpauth_uri(c["totp"])); sys.exit(0)

class BaluServer(ThreadingHTTPServer):
    """Unter Windows den Port exklusiv belegen – sonst können mehrere Balu-Mail gleichzeitig darauf lauschen."""
    allow_reuse_address = os.name != "nt"
    def server_bind(self):
        if os.name == "nt":
            try: self.socket.setsockopt(socket.SOL_SOCKET, getattr(socket, "SO_EXCLUSIVEADDRUSE", -5), 1)
            except OSError: pass
        super().server_bind()

def _running_instance(port):
    """Version und Token des Balu-Mail, das gerade auf dem Port antwortet (oder None)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=3) as r: page = r.read().decode("utf-8", "replace")
        m = re.search(r'BM_TOKEN = "([^"]+)"', page)
        if not m: return None
        req = urllib.request.Request(f"http://127.0.0.1:{port}/api/update", headers={"X-Token": m.group(1)})
        with urllib.request.urlopen(req, timeout=3) as r: v = json.load(r).get("version", "")
        return v, m.group(1)
    except Exception:
        return None

def bind_server(host, port):
    """Server starten; ältere Balu-Mail-Programme auf demselben Port werden beendet (Desktop)."""
    for attempt in range(15):
        try:
            return BaluServer((host, port), Handler)
        except OSError:
            if SERVER_MODE or DEMO or host != "127.0.0.1": raise
            inst = _running_instance(port)
            if not inst or vtuple(inst[0]) >= vtuple(VERSION): raise
            say(f"Ältere Balu-Mail {inst[0]} läuft noch – wird beendet")
            try:
                req = urllib.request.Request(f"http://127.0.0.1:{port}/api/quit", data=b"{}", method="POST",
                                             headers={"X-Token": inst[1], "Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=3).read()
            except Exception:
                pass
            time.sleep(1.2)
    raise OSError("Port belegt")

def main():
    global _demo_accs
    if any(a in sys.argv for a in ("--server-setup", "--server-passwort", "--server-code")):
        return server_cli()
    port = 8025
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    host = "127.0.0.1"
    if SERVER_MODE:
        host = sys.argv[sys.argv.index("--host") + 1] if "--host" in sys.argv else "0.0.0.0"
        if not server_cfg():
            say("Die Webseite ist noch nicht eingerichtet. Bitte zuerst:  balumail.py --server-setup"); sys.exit(2)
    if DEMO:
        _demo_accs, demo_clients = demo_setup()
        _clients.update(demo_clients)
    try:
        srv = bind_server(host, port)
    except OSError:
        say(f"{APP_NAME} läuft bereits (Port {port}).")
        if SERVER_MODE: time.sleep(5); sys.exit(1)
        if "--app" in sys.argv: open_window(f"http://127.0.0.1:{port}/" + launch_fragment())
        elif "--no-browser" not in sys.argv: webbrowser.open(f"http://127.0.0.1:{port}/")
        return
    url = f"http://127.0.0.1:{port}/"
    say(f"{APP_NAME} {VERSION} läuft auf {url}" + ("  (Demo-Modus)" if DEMO else ""))
    threading.Thread(target=sync_loop, daemon=True).start()
    threading.Thread(target=kal_loop, daemon=True).start()
    threading.Thread(target=logo_startup, daemon=True).start()
    threading.Thread(target=draft_cleanup_all, daemon=True).start()
    if DEMO: kal_demo_setup()
    frag = launch_fragment()
    if not DEMO:
        threading.Thread(target=upd_loop, daemon=True).start()
    if SERVER_MODE:
        pass                                   # Webseite: kein Programmfenster öffnen
    elif "--nach-update" in sys.argv:
        # Nach einem Update: Das offene Fenster lädt sich selbst neu; sonst ein neues öffnen
        threading.Timer(10, lambda: open_window(url) if time.time() - LAST_HIT > 9 else None).start()
    elif "--app" in sys.argv:
        threading.Timer(0.6, lambda: open_window(url + frag)).start()
    elif "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    global SERVER
    SERVER = srv
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    srv.server_close()
    if RESTART and not start_newer(after_update=True):
        # Neue Version startet nicht – mit der eingebauten weitermachen
        os.execv(sys.executable, [sys.executable, os.path.abspath(__file__), "--nach-update"] + [a for a in sys.argv[1:] if a not in ("--app", "--nach-update")])

if __name__ == "__main__":
    if not start_newer(after_update=False):
        main()
