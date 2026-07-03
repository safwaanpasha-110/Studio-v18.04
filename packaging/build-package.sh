#!/usr/bin/env bash
#
# Builds the offline, self-contained deployment package for
# Image Enhancement Studio: source + node_modules + a bundled
# Node.js 16 runtime, ready to ship to air-gapped servers.
#
# Run this ONCE on a machine with internet access:
#     bash packaging/build-package.sh
#
# Output:
#     packaging/dist/image-enhancement-studio-offline_vX.Y.Z_YYYYMMDD.tar.gz
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGING_DIR="$PROJECT_DIR/packaging"
CACHE_DIR="$PACKAGING_DIR/cache"
DIST_DIR="$PACKAGING_DIR/dist"
NODE_VERSION="16.20.2"
NODE_DIST="node-v${NODE_VERSION}-linux-x64"
NODE_TARBALL="${NODE_DIST}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

mkdir -p "$CACHE_DIR" "$DIST_DIR"

VERSION="$(node -e "console.log(require('$PROJECT_DIR/package.json').version)" 2>/dev/null || echo "0.0.0")"
DATE_TAG="$(date +%Y%m%d)"
PKG_NAME="image-enhancement-studio-offline_v${VERSION}_${DATE_TAG}"
STAGE="$(mktemp -d)/$PKG_NAME"
mkdir -p "$STAGE"

echo "=================================================="
echo " Building offline package: $PKG_NAME"
echo "=================================================="

# --------------- 1. fetch + stage the Node.js runtime ---------------
if [ ! -f "$CACHE_DIR/$NODE_TARBALL" ]; then
  echo "==> Downloading Node.js ${NODE_VERSION} (linux-x64) ..."
  curl -fSL "$NODE_URL" -o "$CACHE_DIR/$NODE_TARBALL"
else
  echo "==> Using cached $NODE_TARBALL"
fi

echo "==> Staging Node.js runtime ..."
mkdir -p "$STAGE/node-runtime"
tar xJf "$CACHE_DIR/$NODE_TARBALL" --strip-components=1 -C "$STAGE/node-runtime"
# Trim docs/headers we don't need at runtime to keep the package smaller.
rm -rf "$STAGE/node-runtime/include" "$STAGE/node-runtime/share"

BUNDLED_NODE="$STAGE/node-runtime/bin/node"
BUNDLED_NPM="$STAGE/node-runtime/bin/npm"
"$BUNDLED_NODE" -v

# --------------------- 2. stage the app source -----------------------
echo "==> Staging app source ..."
mkdir -p "$STAGE/app"
cd "$PROJECT_DIR"
tar cf - \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='packaging' \
  --exclude='./install.sh' \
  --exclude='*.tsbuildinfo' \
  . | tar xf - -C "$STAGE/app"

# ------------- 3. clean, reproducible install under Node 16 -------------
echo "==> Running 'npm ci' under the bundled Node ${NODE_VERSION} (this validates the target runtime and needs internet once) ..."
( cd "$STAGE/app" && env PATH="$STAGE/node-runtime/bin:$PATH" "$BUNDLED_NPM" ci --no-audit --no-fund )

# ---------------- 4. smoke-test build (not shipped) ----------------
echo "==> Smoke-testing 'next build' under the bundled runtime with dummy FRS values ..."
cat > "$STAGE/app/.env.local" <<'EOF'
NEXT_PUBLIC_FRS_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_FRS_TOKEN=packaging-smoke-test
NEXT_PUBLIC_DEEPAI_API_KEY=
EOF
( cd "$STAGE/app" && env PATH="$STAGE/node-runtime/bin:$PATH" "$BUNDLED_NPM" run build )
# Real per-server builds happen after install.sh writes the real
# .env.local (NEXT_PUBLIC_* values are baked in at build time), so we
# must not ship this test build or its dummy env file.
rm -rf "$STAGE/app/.next" "$STAGE/app/.env.local"
echo "    Smoke-test build OK — target runtime can build this app."

# ------------------------ 5. bundle installer ------------------------
cp "$PACKAGING_DIR/install.sh" "$STAGE/install.sh"
chmod +x "$STAGE/install.sh"

cat > "$STAGE/README.txt" <<EOF
Image Enhancement Studio — offline install package
version ${VERSION}, built ${DATE_TAG}

No internet connection or pre-installed Node.js required.

Install:
    tar xzf ${PKG_NAME}.tar.gz
    cd ${PKG_NAME}
    sudo ./install.sh

You will be asked for the FRS server IP/URL and API token. The app
is installed to /opt/image-enhancement-studio and started as the
"image-enhancement-studio" systemd service on port 4000.

Re-running sudo ./install.sh later (e.g. after copying an updated
package) upgrades the app in place and reuses the previously entered
FRS settings as defaults.
EOF

# ------------------------- 6. create the tarball -------------------------
echo "==> Creating tarball ..."
OUT="$DIST_DIR/${PKG_NAME}.tar.gz"
tar czf "$OUT" -C "$(dirname "$STAGE")" "$PKG_NAME"
rm -rf "$(dirname "$STAGE")"

SIZE="$(du -h "$OUT" | cut -f1)"
SHA="$(sha256sum "$OUT" | cut -d' ' -f1)"

echo ""
echo "=================================================="
echo " Package ready"
echo "=================================================="
echo "  File   : $OUT"
echo "  Size   : $SIZE"
echo "  SHA256 : $SHA"
echo ""
echo "Copy this single .tar.gz to each of the 50 servers, extract, and"
echo "run: sudo ./install.sh"
echo ""
