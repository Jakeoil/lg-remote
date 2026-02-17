# Mac Launch Agent Setup

Runs the LG TV Remote server automatically when you log in to your Mac.

## Install

```bash
# Copy the plist to LaunchAgents
cp com.jakeoil.lg-remote.plist ~/Library/LaunchAgents/

# Load and start the service
launchctl load ~/Library/LaunchAgents/com.jakeoil.lg-remote.plist
```

The server will now:
- Start automatically on login
- Restart if it crashes
- Run on `http://192.168.1.235:3000`

## Check Status

```bash
# Check if running
launchctl list | grep lg-remote

# View logs
tail -f /tmp/lg-remote.log
```

## Stop Temporarily

```bash
# Stop without removing (will restart on next login)
launchctl stop com.jakeoil.lg-remote
```

## Uninstall (Undo Everything)

```bash
# Stop the service
launchctl unload ~/Library/LaunchAgents/com.jakeoil.lg-remote.plist

# Remove the plist
rm ~/Library/LaunchAgents/com.jakeoil.lg-remote.plist
```

That's it — the server will no longer start automatically.
