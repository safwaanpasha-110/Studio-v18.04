#!/usr/bin/env bash
#
# Image Enhancement Studio — OFFLINE installer
# --------------------------------------------------------
# This script ships inside the offline package alongside a bundled
# Node.js 16 runtime and a pre-populated node_modules folder, so it
# needs NO internet access and NO pre-installed Node.js on the target
# server. It:
#   1. Copies the app + bundled Node runtime to an install directory.
#   2. Asks for the FRS server IP + API token (baked into the build).
#   3. Builds the production bundle using the bundled Node/npm.
#   4. Registers + starts a systemd service on port 4000.
#
# Usage (from inside the extracted package folder):
#     sudo ./install.sh
#
# Optional: install to a custom location:
#     sudo INSTALL_DIR=/opt/my-studio ./install.sh
#
set -euo pipefail

# ----------------------------- config -----------------------------
APP_NAME="image-enhancement-studio"
PORT=4000
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/opt/image-enhancement-studio}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

RUN_USER="${SUDO_USER:-$(id -un)}"
RUN_GROUP="$(id -gn "$RUN_USER")"

echo "=================================================="
echo " Image Enhancement Studio — OFFLINE installer"
echo "=================================================="
echo "  Package dir : $PKG_DIR"
echo "  Install dir : $INSTALL_DIR"
echo "  Service     : $APP_NAME (port $PORT)"
echo "  Run as user : $RUN_USER ($RUN_GROUP)"
echo ""

# ------------------------- must be root ---------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run with sudo:  sudo ./install.sh" >&2
  exit 1
fi

if [ ! -t 0 ]; then
  echo "ERROR: install.sh needs an interactive terminal to read the FRS IP/token." >&2
  echo "       Run it directly:  sudo ./install.sh" >&2
  exit 1
fi

# ----------------- 1. sanity-check the bundled payload -------------
if [ ! -x "$PKG_DIR/node-runtime/bin/node" ]; then
  echo "ERROR: bundled Node runtime not found at $PKG_DIR/node-runtime/bin/node" >&2
  echo "       The package looks corrupted or incomplete — re-copy the .tar.gz and re-extract." >&2
  exit 1
fi
if [ ! -d "$PKG_DIR/app/node_modules" ]; then
  echo "ERROR: bundled node_modules not found at $PKG_DIR/app/node_modules" >&2
  echo "       The package looks corrupted or incomplete — re-copy the .tar.gz and re-extract." >&2
  exit 1
fi

BUNDLED_NODE_VER="$("$PKG_DIR/node-runtime/bin/node" -v)"
echo "==> Bundled Node.js: $BUNDLED_NODE_VER (no system Node required)"

# ------------------- 2. stop any existing service -------------------
if systemctl list-unit-files "${APP_NAME}.service" >/dev/null 2>&1 \
   && systemctl is-active --quiet "${APP_NAME}.service" 2>/dev/null; then
  echo "==> Stopping existing ${APP_NAME} service before upgrade ..."
  systemctl stop "${APP_NAME}.service"
fi

# ----------------- 3. install payload to $INSTALL_DIR ---------------
echo "==> Installing app + runtime to $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"

# Preserve an existing .env.local (if this is a re-run) so we can
# pre-fill the FRS prompts below with the previous answers.
PREV_ENV=""
if [ -f "$INSTALL_DIR/app/.env.local" ]; then
  PREV_ENV="$(mktemp)"
  cp "$INSTALL_DIR/app/.env.local" "$PREV_ENV"
fi

rm -rf "$INSTALL_DIR/app" "$INSTALL_DIR/node-runtime"
mkdir -p "$INSTALL_DIR/app"
cp -a "$PKG_DIR/app/." "$INSTALL_DIR/app/"
rm -rf "$INSTALL_DIR/app/.env.local" "$INSTALL_DIR/app/.next"
cp -a "$PKG_DIR/node-runtime" "$INSTALL_DIR/node-runtime"

if [ -n "$PREV_ENV" ]; then
  mv "$PREV_ENV" "$INSTALL_DIR/app/.env.local"
fi

chown -R "$RUN_USER:$RUN_GROUP" "$INSTALL_DIR"

NODE_BIN="$INSTALL_DIR/node-runtime/bin/node"
NPM_BIN="$INSTALL_DIR/node-runtime/bin/npm"
NODE_DIR="$INSTALL_DIR/node-runtime/bin"
APP_DIR="$INSTALL_DIR/app"

# ------------------ 4. configure FRS (env file) -------------------
# The "Enroll" feature talks to an FRS server using these values.
# NEXT_PUBLIC_* values are baked into the bundle at build time, so we
# ask for them now and write .env.local BEFORE building.
ENV_FILE="$APP_DIR/.env.local"

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

# Best-effort connectivity check (non-fatal — FRS may be on a network
# this shell can't reach even though the app server can, or curl may
# not be installed).
if command -v curl >/dev/null 2>&1; then
  echo "==> Checking connectivity to $FRS_URL ..."
  HTTP_CODE="$(curl -s -o /dev/null -m 6 -w '%{http_code}' \
    -H "Authorization: token $FRS_TOKEN" \
    "$FRS_URL/watch-lists/" 2>/dev/null || echo "000")"
  if [ "$HTTP_CODE" = "000" ]; then
    echo "    WARNING: could not reach $FRS_URL (no response)."
  elif [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "    OK — FRS responded with HTTP $HTTP_CODE."
  elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "    WARNING: FRS reachable but rejected the token (HTTP $HTTP_CODE). Double-check it."
  else
    echo "    WARNING: FRS responded with HTTP $HTTP_CODE."
  fi
  if [ "$HTTP_CODE" = "000" ] || [ "$HTTP_CODE" -ge 400 ]; then
    read -r -p "    Continue anyway? [Y/n]: " CONT
    case "$CONT" in
      [nN]*) echo "Aborted."; exit 1 ;;
    esac
  fi
else
  echo "    (curl not found — skipping connectivity check)"
fi

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

# ----------------------- 5. production build ----------------------
echo "==> Building production bundle (offline, using bundled Node $BUNDLED_NODE_VER) ..."
sudo -u "$RUN_USER" env PATH="$NODE_DIR:$PATH" bash -lc "cd '$APP_DIR' && '$NPM_BIN' run build"

# --------------------- 6. systemd service -------------------------
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

# ----------------------- 7. enable + start ------------------------
echo "==> Enabling & starting service ..."
systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl restart "${APP_NAME}.service"

sleep 2
systemctl --no-pager --full status "${APP_NAME}.service" || true

echo ""
echo "=================================================="
echo " Done — running at http://localhost:${PORT}"
echo "=================================================="
echo "  Install dir :  $INSTALL_DIR"
echo "  View logs   :  journalctl -u ${APP_NAME} -f"
echo "  Restart     :  sudo systemctl restart ${APP_NAME}"
echo "  Stop        :  sudo systemctl stop ${APP_NAME}"
echo "  Disable     :  sudo systemctl disable --now ${APP_NAME}"
echo "  Reconfigure :  re-run  sudo ./install.sh  from the package folder"
echo ""
