"""App Bundle in den internen Test von Google Play hochladen (Google Play Developer API).

Aufruf: python tools/play_upload.py Balu-Mail-Play.aab "Änderungstext"
Zugang: Zugriffstoken in der Umgebungsvariable PLAY_TOKEN (kommt im Workflow per Workload Identity, ohne Schlüsseldatei).
"""
import json, os, sys, urllib.request, urllib.error

PKG = "de.balumail.app"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PKG}"
UP = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PKG}"
TOKEN = os.environ["PLAY_TOKEN"]


def call(method, url, body=None, data=None, ctype="application/json"):
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + TOKEN, "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {url.split(PKG)[-1]}: {e.code} {e.read().decode(errors='replace')[:800]}")


def upload(aab, notes):
    edit = call("POST", f"{API}/edits", {})["id"]
    with open(aab, "rb") as f:
        b = call("POST", f"{UP}/edits/{edit}/bundles?uploadType=media", data=f.read(), ctype="application/octet-stream")
    vc = str(b["versionCode"])
    print("Hochgeladen: versionCode", vc)
    rel = {"name": f"1.0.{vc}", "versionCodes": [vc], "status": "completed",
           "releaseNotes": [{"language": "de-DE", "text": (notes or "Neue Version")[:480]}]}
    try:
        call("PUT", f"{API}/edits/{edit}/tracks/internal", {"track": "internal", "releases": [rel]})
        call("POST", f"{API}/edits/{edit}:commit")
        print("Im internen Test veröffentlicht.")
    except RuntimeError as e:
        msg = str(e).lower()
        if "draft" not in msg and "rollout" not in msg:
            raise
        print("Direkt freigeben nicht möglich:", str(e)[:300])
        # Noch nie veröffentlichte App: Google erlaubt nur einen Entwurf, der einmal von Hand freigegeben wird
        edit = call("POST", f"{API}/edits", {})["id"]
        rel["status"] = "draft"
        call("PUT", f"{API}/edits/{edit}/tracks/internal", {"track": "internal", "releases": [rel]})
        call("POST", f"{API}/edits/{edit}:commit")
        print("::warning::Als Entwurf im internen Test angelegt – einmalig in der Play Console freigeben.")


if __name__ == "__main__":
    upload(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
