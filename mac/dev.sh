#!/bin/bash
# Run AgentSpend-dev: build, install, launch, then rebuild and relaunch whenever
# a source file changes. The point is to stop round-tripping through a dmg to
# see a one-line UI change.
#
#   ./dev.sh          build, install, launch, then watch
#   ./dev.sh --once   build, install, launch, then exit
#   ./dev.sh --stop   quit the dev app and remove it
#
# Four things this gets right, each of which is a way a second copy of a menu bar
# app goes wrong:
#
#  1. **A different bundle identifier** (`com.agentspend.app.dev`). Two bundles
#     sharing an id means LaunchServices treats them as the same app, so `open`
#     can launch the wrong one and they fight over the same UserDefaults. The
#     dev copy gets its own id, and therefore its own window state and settings.
#  2. **A different name in the menu bar.** Same id or not, two identical bolt
#     icons showing similar dollar figures is unreadable. The dev build prefixes
#     its number with a dot (see MenuBarLabel.devPrefix).
#  3. **The same store.** Deliberately NOT sandboxed to its own database: the
#     whole point is to look at your real usage while iterating. Nothing here
#     writes anything the release build cannot read.
#  4. **Kill before replacing the bundle.** Swapping the executable under a
#     running process gives you a stale UI that no longer matches the source,
#     which is the most confusing possible outcome for a live-reload tool.
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="AgentSpend-dev"
DEST="/Applications/$APP_NAME.app"
BUNDLE_ID="com.agentspend.app.dev"
WATCH=(AgentSpend Package.swift)

stop() {
  # pkill matches the executable path, so this only ever hits the dev copy.
  pkill -f "$DEST/Contents/MacOS/AgentSpend" 2>/dev/null || true
  # Give the menu bar item a moment to actually leave.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "$DEST/Contents/MacOS/AgentSpend" >/dev/null || break
    sleep 0.1
  done
}

if [ "${1:-}" = "--stop" ]; then
  stop
  rm -rf "$DEST"
  echo "stopped and removed $DEST"
  exit 0
fi

build_and_launch() {
  if ! swift build -c debug 2>&1 | sed 's/^/  /'; then
    # A compile error must not take the running copy down: leaving the last good
    # build up means you can keep looking at it while you fix the error.
    echo "  build failed, leaving the running copy alone"
    return 1
  fi
  local bin
  bin="$(swift build -c debug --show-bin-path 2>/dev/null | tail -1)"
  [ -x "$bin/AgentSpend" ] || { echo "  no executable at $bin/AgentSpend"; return 1; }

  ./vendor-ccusage.sh >/dev/null

  stop
  rm -rf "$DEST"
  mkdir -p "$DEST/Contents/MacOS" "$DEST/Contents/Resources" "$DEST/Contents/Helpers"
  cp "$bin/AgentSpend" "$DEST/Contents/MacOS/"
  cp vendor/ccusage "$DEST/Contents/Helpers/ccusage"
  cp vendor/LICENSE-ccusage NOTICE-logos.md "$DEST/Contents/Resources/" 2>/dev/null || true
  cp AgentSpend/Resources/energy-model.json AgentSpend/Resources/pricing.json \
     assets/AgentSpend.icns "$DEST/Contents/Resources/"

  cat > "$DEST/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>            <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>     <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>      <string>$BUNDLE_ID</string>
  <key>CFBundleExecutable</key>      <string>AgentSpend</string>
  <key>CFBundleIconFile</key>        <string>AgentSpend</string>
  <key>CFBundlePackageType</key>     <string>APPL</string>
  <key>CFBundleShortVersionString</key> <string>dev</string>
  <key>CFBundleVersion</key>         <string>$(date +%s)</string>
  <key>LSMinimumSystemVersion</key>  <string>14.0</string>
  <key>LSUIElement</key>             <true/>
  <key>NSHighResolutionCapable</key> <true/>
</dict>
</plist>
PLIST

  # Inside-out, helper first. Ad-hoc is fine for a local build.
  codesign --force --sign - "$DEST/Contents/Helpers/ccusage" 2>/dev/null || true
  codesign --force --sign - "$DEST" 2>/dev/null || true

  open -n "$DEST"
  echo "  running: $DEST"
}

echo "building $APP_NAME"
build_and_launch || true
[ "${1:-}" = "--once" ] && exit 0

# Fingerprint every watched source. fswatch would be tidier but is not installed
# here, and a 1s stat sweep over ~30 files is far cheaper than the rebuild it
# guards, so polling costs nothing that matters.
fingerprint() {
  find "${WATCH[@]}" -type f \( -name '*.swift' -o -name '*.json' \) -exec stat -f '%m %N' {} + \
    | sort | shasum | cut -d' ' -f1
}

echo "watching ${WATCH[*]} — edit a file to rebuild, ctrl-c to stop"
trap 'echo; echo "left $APP_NAME running; ./dev.sh --stop to remove it"; exit 0' INT
last="$(fingerprint)"
while true; do
  sleep 1
  now="$(fingerprint)"
  if [ "$now" != "$last" ]; then
    last="$now"
    echo "change detected $(date +%H:%M:%S)"
    build_and_launch || true
    # Re-fingerprint: the build itself can touch files, and without this the
    # next tick would see its own output as a change and rebuild forever.
    last="$(fingerprint)"
  fi
done
