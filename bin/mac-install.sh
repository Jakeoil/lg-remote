#!/bin/bash
# Install LG TV Remote as a macOS launch agent (auto-starts on login)
set -e

PLIST="com.jakeoil.lg-remote.plist"
SRC="$(dirname "$0")/$PLIST"
DEST="$HOME/Library/LaunchAgents/$PLIST"

if [ ! -f "$SRC" ]; then
  echo "Error: $PLIST not found in project directory"
  exit 1
fi

# Stop existing service if running
launchctl unload "$DEST" 2>/dev/null || true

cp "$SRC" "$DEST"
launchctl load "$DEST"

echo "LG TV Remote server installed and started."
echo "  Status:  launchctl list | grep lg-remote"
echo "  Logs:    tail -f /tmp/lg-remote.log"
echo "  Remove:  ./mac-uninstall.sh"
