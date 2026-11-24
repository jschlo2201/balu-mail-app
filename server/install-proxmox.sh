#!/usr/bin/env bash
# =============================================================================
#  Balu-Mail Web – Einrichtung auf einem Proxmox-Server (im Proxmox-Shell als root)
#
#  Legt einen eigenen, abgeschotteten LXC-Container an (Debian 12, unprivilegiert),
#  installiert Balu-Mail als Webseite, richtet automatische Updates ein und
#  fragt das Anmeldepasswort ab. Mehrfaches Ausführen ist unschädlich (Update).
#
#  Aufruf:  bash install-proxmox.sh
#  Optional: CTID=110 HOSTNAME=balu-mail BRIDGE=vmbr0 STORAGE=local-lvm
# =============================================================================
set -euo pipefail
export LC_ALL=C.UTF-8 LANG=C.UTF-8

REPO="${BALU_REPO:-jschlo2201/balu-mail-app}"
HOSTNAME="${HOSTNAME_CT:-balu-mail}"
BRIDGE="${BRIDGE:-vmbr0}"
PORT=8025
B="\e[1;34m"; G="\e[1;32m"; R="\e[1;31m"; N="\e[0m"
info(){ echo -e "${B}➜${N} $*"; }
ok(){ echo -e "${G}✔${N} $*"; }
fail(){ echo -e "${R}✘ $*${N}"; exit 1; }

command -v pct >/dev/null || fail "Dieses Skript muss im Proxmox-Shell (Host) laufen."
[ "$(id -u)" = 0 ] || fail "Bitte als root ausführen."

# Öffentliche Releases: kein Schlüssel nötig (für eine private Kopie: BALU_TOKEN=github_pat_… setzen)
TOKEN=$(printf %s "${BALU_TOKEN:-}" | tr -d "[:space:]")

# ---------------------------------------------------------------- Container finden oder anlegen
CTID="${CTID:-}"
if [ -z "$CTID" ]; then
  CTID=$(pct list | awk -v h="$HOSTNAME" 'NR>1 && $NF==h {print $1; exit}')
fi
if [ -n "$CTID" ] && pct status "$CTID" >/dev/null 2>&1; then
  info "Container $CTID ($HOSTNAME) gibt es schon – Balu-Mail wird aktualisiert."
  pct status "$CTID" | grep -q running || pct start "$CTID"
  NEW=0
else
  CTID="${CTID:-$(pvesh get /cluster/nextid)}"
  STORAGE="${STORAGE:-$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 && $3=="active" {print $1}' | grep -m1 -E '^local-(lvm|zfs)$' || true)}"
  STORAGE="${STORAGE:-$(pvesm status -content rootdir | awk 'NR>1 && $3=="active" {print $1; exit}')}"
  [ -n "$STORAGE" ] || fail "Kein Speicher für Container gefunden."
  info "Lade Debian-12-Vorlage …"
  pveam update >/dev/null
  TPL=$(pveam available --section system | awk '{print $2}' | grep -E '^debian-12-standard_.*amd64' | sort -V | tail -1)
  [ -n "$TPL" ] || fail "Debian-12-Vorlage nicht gefunden."
  pveam list local | grep -q "$TPL" || pveam download local "$TPL" >/dev/null
  info "Lege Container $CTID ($HOSTNAME) auf $STORAGE an …"
  pct create "$CTID" "local:vztmpl/$TPL" \
    --hostname "$HOSTNAME" --description "Balu-Mail Web (E-Mail im Browser)" \
    --cores 1 --memory 512 --swap 256 --rootfs "$STORAGE:4" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=dhcp,firewall=1" \
    --unprivileged 1 --features nesting=1 --onboot 1 --startup order=90 \
    --timezone host >/dev/null
  pct start "$CTID"
  NEW=1
  ok "Container $CTID angelegt und gestartet (startet nach Stromausfall automatisch)."
fi

info "Warte auf Netzwerk im Container …"
for i in $(seq 1 60); do
  pct exec "$CTID" -- getent hosts api.github.com >/dev/null 2>&1 && break
  sleep 2
done
pct exec "$CTID" -- getent hosts api.github.com >/dev/null 2>&1 || fail "Container hat kein Internet (DHCP/DNS prüfen)."

# ---------------------------------------------------------------- Pakete + automatische Sicherheitsupdates
info "Installiere Python und automatische Sicherheitsupdates …"
pct exec "$CTID" -- bash -c 'export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq && apt-get install -y -qq python3 ca-certificates curl unzip unattended-upgrades >/dev/null
  echo "unattended-upgrades unattended-upgrades/enable_auto_updates boolean true" | debconf-set-selections
  dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
  printf "APT::Periodic::Update-Package-Lists \"1\";\nAPT::Periodic::Unattended-Upgrade \"1\";\n" > /etc/apt/apt.conf.d/20auto-upgrades
  id balu >/dev/null 2>&1 || useradd --system --home-dir /var/lib/balu-mail --create-home --shell /usr/sbin/nologin balu
  chmod 700 /var/lib/balu-mail'
ok "Pakete bereit."

# ---------------------------------------------------------------- Programm laden
info "Lade die neueste Balu-Mail-Version von GitHub …"
pct exec "$CTID" -- env T="$TOKEN" R="$REPO" bash -c '
  set -e
  AUTH=(); [ -n "$T" ] && AUTH=(-H "Authorization: Bearer $T")
  J=$(curl -fsSL "${AUTH[@]}" -H "Accept: application/vnd.github+json" https://api.github.com/repos/$R/releases/latest)
  ID=$(printf "%s" "$J" | python3 -c "import sys,json; print(next(a[\"id\"] for a in json.load(sys.stdin)[\"assets\"] if a[\"name\"]==\"Balu-Mail-Programm.zip\"))")
  curl -fsSL "${AUTH[@]}" -H "Accept: application/octet-stream" -o /tmp/balu.zip https://api.github.com/repos/$R/releases/assets/$ID
  rm -rf /opt/balu-mail.neu && mkdir -p /opt/balu-mail.neu && unzip -q /tmp/balu.zip -d /opt/balu-mail.neu
  test -f /opt/balu-mail.neu/balumail.py && test -f /opt/balu-mail.neu/web/index.html
  rm -rf /opt/balu-mail && mv /opt/balu-mail.neu /opt/balu-mail && rm -f /tmp/balu.zip
  chown -R root:root /opt/balu-mail && chmod -R a+rX /opt/balu-mail
  grep -m1 "^VERSION" /opt/balu-mail/balumail.py' || fail "Download fehlgeschlagen – Internetverbindung des Containers prüfen."
ok "Programm installiert."

# Nur bei privater Kopie: Update-Schlüssel für stille Updates hinterlegen (nur Leserechte)
[ -n "$TOKEN" ] && pct exec "$CTID" -- runuser -u balu -- env HOME=/var/lib/balu-mail T="$TOKEN" python3 -c '
import os, json, base64
d = os.path.expanduser("~/.balu-mail"); os.makedirs(d, exist_ok=True)
p = os.path.join(d, "einstellungen.json")
c = json.load(open(p)) if os.path.exists(p) else {}
c.setdefault("update", {})["token"] = "plain:" + base64.b64encode(os.environ["T"].encode()).decode()
c["update"].setdefault("auto", True)
json.dump(c, open(p, "w"), indent=2); os.chmod(p, 0o600)'

# ---------------------------------------------------------------- Dienst
pct exec "$CTID" -- bash -c "cat > /etc/systemd/system/balu-mail.service <<'EOF'
[Unit]
Description=Balu-Mail Web
After=network-online.target
Wants=network-online.target

[Service]
User=balu
Group=balu
Environment=HOME=/var/lib/balu-mail
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /opt/balu-mail/balumail.py --server --port $PORT
Restart=always
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/balu-mail
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload"

# ---------------------------------------------------------------- Anmeldung einrichten (nur beim ersten Mal)
if ! pct exec "$CTID" -- test -f /var/lib/balu-mail/.balu-mail/server.json; then
  echo
  echo -e "${B}Jetzt das Anmeldepasswort für die Webseite festlegen${N} (mind. 10 Zeichen)."
  echo "Damit werden auch alle gespeicherten Mail-Passwörter verschlüsselt."
  while true; do
    read -rsp "Passwort: " P1 </dev/tty; echo
    read -rsp "Passwort wiederholen: " P2 </dev/tty; echo
    [ "$P1" = "$P2" ] && [ ${#P1} -ge 10 ] && break
    echo -e "${R}Passwörter stimmen nicht überein oder sind zu kurz – bitte nochmal.${N}"
  done
  printf '%s\n%s\n' "$P1" "$P2" | pct exec "$CTID" -- runuser -u balu -- env HOME=/var/lib/balu-mail \
    python3 /opt/balu-mail/balumail.py --server-setup | tail -n +2
  unset P1 P2
fi

pct exec "$CTID" -- systemctl enable --now balu-mail >/dev/null 2>&1
pct exec "$CTID" -- systemctl restart balu-mail
sleep 3
pct exec "$CTID" -- bash -c "curl -fsS -o /dev/null http://127.0.0.1:$PORT/" || fail "Balu-Mail startet nicht – Protokoll: pct exec $CTID -- journalctl -u balu-mail -n 50"

IP=$(pct exec "$CTID" -- hostname -I | awk '{print $1}')
MAC=$(pct config "$CTID" | grep -oP 'hwaddr=\K[^,]+' || true)
echo
ok "Balu-Mail Web läuft in Container $CTID unter http://$IP:$PORT"
echo "   MAC-Adresse (für eine feste IP im Router): $MAC"
echo
echo "Beispiel für einen Caddy-Eintrag (eigene Domain einsetzen):"
echo "  mail.ihre-domain.de {"
echo "      reverse_proxy $IP:$PORT"
echo "  }"
echo
echo "Code-App erneut anzeigen:  pct exec $CTID -- runuser -u balu -- env HOME=/var/lib/balu-mail python3 /opt/balu-mail/balumail.py --server-code"
