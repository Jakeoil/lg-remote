#!/bin/bash
# Remove LG TV Remote macOS launch agent
set -e

PLIST="com.jakeoil.lg-remote.plist"
DEST="$HOME/Library/LaunchAgents/$PLIST"

if [ ! -f "$DEST" ]; then
  echo "Launch agent not installed."
  exit 0
fi

launchctl unload "$DEST"
rm "$DEST"

echo "LG TV Remote server stopped and removed."
echo "It will no longer start on login."
