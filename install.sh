#!/usr/bin/env bash
#
# Image Enhancement Studio — installer + systemd service
# --------------------------------------------------------
# Installs all requirements, asks for the FRS server IP + API token,
# builds the app, and registers a systemd service that serves it on
# port 4000 and keeps it running (auto-restart on crash, auto-start
# on boot).
#
# Usage (from inside the project folder):
#     sudo ./install.sh
#
set -euo pipefail

# ----------------------------- config -----------------------------
APP_NAME="image-enhancement-studio"
PORT=4000
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NODE_MAJOR=18   # Node LTS to install if none is present

# Run the service as the user who invoked sudo (not root).
RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_GROUP="$(id -gn "$RUN_USER")"

echo "=================================================="
echo " Image Enhancement Studio — installer"
echo "=================================================="
echo "  Project dir : $APP_DIR"
echo "  Service     : $APP_NAME (port $PORT)"
echo "  Run as user : $RUN_USER ($RUN_GROUP)"
echo ""

# ------------------------- must be root ---------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run with sudo:  sudo ./install.sh" >&2
  exit 1
fi

# ----------------------- 1. Node.js + npm -------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js not found — installing Node ${NODE_MAJOR}.x ..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
else
  echo "==> Node.js found: $(node -v)"
fi

NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"
NODE_DIR="$(dirname "$NODE_BIN")"
echo "    node: $NODE_BIN"
echo "    npm : $NPM_BIN"

# -------------------- 2. install dependencies ---------------------
# On an air-gapped/offline server `npm install` hangs forever at
# "idealTree buildDeps" because it can't reach the registry. For offline
# installs, ship the project's node_modules folder alongside the code and
# we use it as-is instead of hitting the network.
if [ -d "$APP_DIR/node_modules" ] && [ -n "$(ls -A "$APP_DIR/node_modules" 2>/dev/null)" ]; then
  echo "==> node_modules already present — skipping npm install (offline mode)."
else
  echo "==> Installing npm dependencies ..."
  # Try offline-first (uses local cache/lockfile) before a networked install.
  if ! sudo -u "$RUN_USER" env PATH="$NODE_DIR:$PATH" bash -lc "cd '$APP_DIR' && '$NPM_BIN' ci --offline --no-audit --no-fund"; then
    echo "    Offline install failed — trying a normal (networked) install ..."
    if ! sudo -u "$RUN_USER" env PATH="$NODE_DIR:$PATH" bash -lc "cd '$APP_DIR' && '$NPM_BIN' install --no-audit --no-fund"; then
      echo "ERROR: could not install dependencies (no internet?)." >&2
      echo "       Copy a working 'node_modules' folder into:" >&2
      echo "         $APP_DIR/node_modules" >&2
      echo "       then re-run:  sudo ./install.sh" >&2
      exit 1
    fi
  fi
fi

# ------------------ 3. configure FRS (env file) -------------------
# The "Enroll" feature talks to an FRS server using these values.
# NEXT_PUBLIC_* values are baked into the bundle at build time, so we
# ask for them now and write .env.local BEFORE building.
ENV_FILE="$APP_DIR/.env.local"

if [ ! -t 0 ]; then
  echo "ERROR: install.sh needs an interactive terminal to read the FRS IP/token." >&2
  echo "       Run it directly:  sudo ./install.sh" >&2
  exit 1
fi

# Pre-fill defaults from an existing .env.local on re-runs.
get_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- || true; }
CUR_URL="$(get_env NEXT_PUBLIC_FRS_BASE_URL)"
CUR_TOKEN="$(get_env NEXT_PUBLIC_FRS_TOKEN)"
CUR_DEEPAI="$(get_env NEXT_PUBLIC_DEEPAI_API_KEY)"

echo ""
echo "--------------------------------------------------"
echo " FRS configuration (used by the Enroll feature)"
echo "--------------------------------------------------"

# FRS server IP / URL (required)
while true; do
  if [ -n "$CUR_URL" ]; then
    read -r -p "FRS server IP or URL [$CUR_URL]: " FRS_URL
    FRS_URL="${FRS_URL:-$CUR_URL}"
  else
    read -r -p "FRS server IP or URL (e.g. http://172.203.130.108): " FRS_URL
  fi
  [ -n "$FRS_URL" ] && break
  echo "    A value is required."
done
# Add a scheme if the user typed a bare IP/host, and drop any trailing slash.
case "$FRS_URL" in
  http://*|https://*) : ;;
  *) FRS_URL="http://$FRS_URL" ;;
esac
FRS_URL="${FRS_URL%/}"

# FRS API token (required)
while true; do
  if [ -n "$CUR_TOKEN" ]; then
    read -r -p "FRS API token [keep existing]: " FRS_TOKEN
    FRS_TOKEN="${FRS_TOKEN:-$CUR_TOKEN}"
  else
    read -r -p "FRS API token: " FRS_TOKEN
  fi
  [ -n "$FRS_TOKEN" ] && break
  echo "    A value is required."
done

# DeepAI API key (optional)
read -r -p "DeepAI API key (optional, press Enter to skip): " DEEPAI_KEY
DEEPAI_KEY="${DEEPAI_KEY:-$CUR_DEEPAI}"

echo "==> Writing $ENV_FILE"
cat > "$ENV_FILE" <<EOF
# Generated by install.sh — Image Enhancement Studio
NEXT_PUBLIC_FRS_BASE_URL=$FRS_URL
NEXT_PUBLIC_FRS_TOKEN=$FRS_TOKEN
NEXT_PUBLIC_DEEPAI_API_KEY=$DEEPAI_KEY
EOF
chown "$RUN_USER:$RUN_GROUP" "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "    FRS URL : $FRS_URL"
echo "    Token   : (saved, hidden)"

# ----------------------- 4. production build ----------------------
echo "==> Building production bundle ..."
sudo -u "$RUN_USER" env PATH="$NODE_DIR:$PATH" bash -lc "cd '$APP_DIR' && '$NPM_BIN' run build"

# --------------------- 5. systemd service -------------------------
echo "==> Writing systemd service: $SERVICE_FILE"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Image Enhancement Studio (Next.js) on port ${PORT}
After=network.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=PATH=${NODE_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${NODE_BIN} ${APP_DIR}/node_modules/.bin/next start -p ${PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# ----------------------- 6. enable + start ------------------------
echo "==> Enabling & starting service ..."
systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl restart "${APP_NAME}.service"

sleep 2
systemctl --no-pager --full status "${APP_NAME}.service" || true

echo ""
echo "=================================================="
echo " ✅ Done — running at http://localhost:${PORT}"
echo "=================================================="
echo "  View logs :  journalctl -u ${APP_NAME} -f"
echo "  Restart   :  sudo systemctl restart ${APP_NAME}"
echo "  Stop      :  sudo systemctl stop ${APP_NAME}"
echo "  Disable   :  sudo systemctl disable --now ${APP_NAME}"
echo ""
