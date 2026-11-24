"""Kurztest für den Webseiten-Modus (läuft auf GitHub bei jedem Bau)."""
import http.client, json, os, re, subprocess, sys, tempfile, time
home = tempfile.mkdtemp(); env = dict(os.environ, HOME=home)
app = os.path.join(os.path.dirname(__file__), "..", "app", "balumail.py")
out = subprocess.run([sys.executable, app, "--server-setup"], input="TestPasswort123\nTestPasswort123\n", env=env, capture_output=True, text=True).stdout
secret = re.search(r"secret=([A-Z2-7]+)", out).group(1)
p = subprocess.Popen([sys.executable, app, "--server", "--port", "8099", "--host", "127.0.0.1"], env=env)
time.sleep(3)
sys.path.insert(0, os.path.dirname(app)); sys.argv = ["x", "--server"]
import balumail as bm
def req(m, path, body=None, h=None, ck=None):
    c = http.client.HTTPConnection("127.0.0.1", 8099, timeout=30); h = dict(h or {})
    if body is not None: h["Content-Type"] = "application/json"; body = json.dumps(body)
    if ck: h["Cookie"] = ck
    c.request(m, path, body, h); r = c.getresponse(); return r.status, r.getheader("Set-Cookie"), r.read()
try:
    assert b"Bitte melden Sie sich an" in req("GET", "/")[2], "Anmeldeseite fehlt"
    assert req("GET", "/api/info", h={"X-Token": "x"})[0] == 401, "API ohne Anmeldung offen"
    assert req("POST", "/login", {"password": "falsch", "code": "000000"}, {"X-Requested-With": "BaluMail"})[0] == 401
    st, ck, _ = req("POST", "/login", {"password": "TestPasswort123", "code": bm.totp_code(secret, int(time.time() // 30))}, {"X-Requested-With": "BaluMail"})
    assert st == 200 and ck, "Anmeldung fehlgeschlagen"
    ck = ck.split(";")[0]
    tok = re.search(rb'BM_TOKEN = "([^"]+)"', req("GET", "/", ck=ck)[2]).group(1).decode()
    assert json.loads(req("GET", "/api/info", h={"X-Token": tok}, ck=ck)[2])["server"] is True
    assert req("POST", "/api/accounts/save", {"name": "T", "email": "t@example.org", "imap_host": "i", "smtp_host": "s", "password": "GeheimXYZ"}, {"X-Token": tok}, ck)[0] == 200
    raw = open(os.path.join(home, ".balu-mail", "konten.json")).read()
    assert "GeheimXYZ" not in raw and '"vault:' in raw, "Passwort nicht verschlüsselt"
    assert req("POST", "/api/quit", {}, {"X-Token": tok}, ck)[0] == 403
    # eingebettete Bilder: Adresse trägt Platzhalter, mit Sitzungsschlüssel erlaubt, ohne abgelehnt
    mime = (b"MIME-Version: 1.0\r\nSubject: x\r\nContent-Type: multipart/related; boundary=B\r\n\r\n--B\r\nContent-Type: text/html\r\n\r\n"
            b"<img src=\"cid:bild1\">\r\n--B\r\nContent-Type: image/png\r\nContent-ID: <bild1>\r\nContent-Transfer-Encoding: base64\r\n\r\niVBORw0KGgo=\r\n--B--\r\n")
    html = bm.build_message("a1", "INBOX", 5, mime, [])["html"]
    m_url = re.search(r'src="(/api/attachment\?[^"]+)"', html).group(1)
    assert "t=__BMT__" in m_url, "Platzhalter fehlt: " + m_url
    assert req("GET", m_url.replace("__BMT__", tok), ck=ck)[0] != 401, "Bild mit Sitzungsschlüssel abgelehnt"
    assert req("GET", m_url, ck=ck)[0] == 401, "Bild ohne gültigen Schlüssel erlaubt"
    print("WEBSEITEN-MODUS OK")
finally:
    p.terminate()
