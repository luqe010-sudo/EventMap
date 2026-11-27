#!/usr/bin/env bash
# One-time VPS setup for the MapaImprez Event Engine (Ubuntu 24.04 LTS / Debian 12).
# Run as root on a fresh server:
#   curl -fsSL <raw URL of this file> -o bootstrap-vps.sh && less bootstrap-vps.sh && bash bootstrap-vps.sh <git-repo-url>
# The repository is cloned with a read-only deploy key. Secrets are entered by the owner
# afterwards into engine/deploy/secrets/*.env (chmod 600); this script never asks for them.
set -euo pipefail

REPO_URL="${1:?usage: bootstrap-vps.sh <git-repo-url> [branch]}"
BRANCH="${2:-main}"
APP_DIR=/opt/mapaimprez
APP_USER=engine

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl git ufw unattended-upgrades fail2ban sqlite3

# Docker Engine + compose plugin from Docker's official repository.
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  . /etc/os-release
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# Firewall: SSH + HTTPS for the control API only.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
dpkg-reconfigure -f noninteractive unattended-upgrades

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
usermod -aG docker "$APP_USER"

if [ ! -d "$APP_DIR/.git" ]; then
  install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR/engine/deploy"
for template in env/common.env secrets/publisher.env secrets/control.env compose.env; do
  [ -f "$template" ] || sudo -u "$APP_USER" cp "$template.example" "$template"
done
chmod 600 secrets/*.env
if ! grep -q '^ENGINE_CONTROL_TOKEN=.\{32,\}' secrets/control.env; then
  sed -i "s/^ENGINE_CONTROL_TOKEN=.*/ENGINE_CONTROL_TOKEN=$(openssl rand -hex 32)/" secrets/control.env
  echo "Generated ENGINE_CONTROL_TOKEN in $APP_DIR/engine/deploy/secrets/control.env — copy it to Vercel (server env, not NEXT_PUBLIC)."
fi

# Restart the stack on boot even if Docker's restart policy is not enough (e.g. after compose changes).
cat > /etc/systemd/system/mapaimprez-engine.service <<UNIT
[Unit]
Description=MapaImprez Event Engine (docker compose)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
User=$APP_USER
ExecStart=/usr/bin/docker compose -f engine/deploy/docker-compose.yml --env-file engine/deploy/compose.env up -d
ExecStop=/usr/bin/docker compose -f engine/deploy/docker-compose.yml --env-file engine/deploy/compose.env stop

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable mapaimprez-engine.service

cat <<NEXT

Bootstrap done. Next steps (owner):
  1. Fill $APP_DIR/engine/deploy/env/common.env (public Supabase URL/key, notification URL).
  2. Put the Supabase service key ONLY in $APP_DIR/engine/deploy/secrets/publisher.env.
  3. Set ENGINE_PUBLIC_HOST in compose.env and point a DNS A record to this server.
  4. sudo -u $APP_USER bash $APP_DIR/engine/deploy/update.sh
NEXT
