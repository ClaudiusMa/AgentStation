#!/bin/bash
# Build dist/AgentStation.app: a double-clickable Mac app that starts the server and opens the page.
# The app bundle carries its own copy of server.mjs, lib/ and public/, so it can be given to someone else
# (they need Node 18+). Run: bash app/build.sh            (add --install to copy it into /Applications and
# restart the server the installed app started, so the icon serves the new build)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/AgentStation.app"
VERSION="$(node -p "require('$ROOT/package.json').version")"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app"

# the program itself
cp "$ROOT/server.mjs" "$ROOT/package.json" "$ROOT/README.md" "$APP/Contents/Resources/app/"
cp -R "$ROOT/lib" "$ROOT/public" "$APP/Contents/Resources/app/"
cp "$ROOT/app/launcher.sh" "$APP/Contents/MacOS/AgentStation"
chmod +x "$APP/Contents/MacOS/AgentStation"

# the icon: render the SVG with Quick Look, then build the icns
TMP="$(mktemp -d)"
qlmanage -t -s 1024 -o "$TMP" "$ROOT/app/icon.svg" >/dev/null 2>&1
PNG="$TMP/icon.svg.png"
[ -f "$PNG" ] || { echo "icon render failed"; exit 1; }
mkdir -p "$TMP/AppIcon.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$PNG" --out "$TMP/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$PNG" --out "$TMP/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$TMP/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
rm -rf "$TMP"

cat >"$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>AgentStation</string>
  <key>CFBundleDisplayName</key><string>AgentStation</string>
  <key>CFBundleIdentifier</key><string>lab.product.agentstation</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>AgentStation</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHumanReadableCopyright</key><string>Figure engine: Colorfigures (MIT, April Zhu)</string>
</dict></plist>
PLIST
# a fresh bundle id/icon only shows after Launch Services notices the new bundle
touch "$APP"
echo "built $APP"
if [ "${1:-}" = "--install" ]; then
  DEST=/Applications/AgentStation.app
  rm -rf "$DEST" && cp -R "$APP" "$DEST" && touch "$DEST"
  PIDF="$HOME/Library/Application Support/AgentStation/server.pid"
  if [ -f "$PIDF" ] && ps -p "$(cat "$PIDF")" -o command= 2>/dev/null | grep -q server.mjs; then kill "$(cat "$PIDF")"; echo "stopped the old server"; fi
  echo "installed $DEST (open it to start again)"
fi
