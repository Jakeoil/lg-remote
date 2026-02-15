# Raspberry Pi Deployment Guide

Target: **lx200pi** (192.168.1.239) — Raspberry Pi 4 Model B, Debian 12 bookworm, aarch64

## 1. Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:
```bash
node -v   # v22.x.x
npm -v
```

## 2. Copy project files from Mac

From the Mac (192.168.1.235):

```bash
# Create the directory structure on the Pi
ssh jakeoil@192.168.1.239 "mkdir -p ~/lg-remote/server"

# Copy server files
scp server/server.js server/package.json jakeoil@192.168.1.239:~/lg-remote/server/

# Copy frontend files (served as static files by Express)
scp index.html styles.css app.js jakeoil@192.168.1.239:~/lg-remote/
```

The Express server serves the frontend via `express.static(path.join(__dirname, '..'))`, so the layout on the Pi should be:

```
~/lg-remote/
├── index.html
├── styles.css
├── app.js
└── server/
    ├── server.js
    └── package.json
```

## 3. Install npm dependencies

```bash
cd ~/lg-remote/server
npm install
```

This installs: `express`, `cors`, `lgtv2`, `tplink-smarthome-api`

## 4. Create systemd service

The setup script creates `/etc/systemd/system/lg-remote.service`:

```ini
[Unit]
Description=LG TV Remote Proxy Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=jakeoil
WorkingDirectory=/home/jakeoil/lg-remote/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable lg-remote   # auto-start on boot
sudo systemctl start lg-remote
```

## 5. Accept TV pairing

On first connection, the LG TV displays a pairing prompt that must be accepted manually. The `lgtv2` library saves the client key to `~/.lgtv2/client-key` for subsequent connections.

To trigger pairing:
```bash
curl http://localhost:3000/status
```

Then accept the prompt on the TV screen.

## Service management

```bash
sudo systemctl status lg-remote      # check status
sudo systemctl restart lg-remote     # restart
sudo systemctl stop lg-remote        # stop
journalctl -u lg-remote -f           # live logs
```

## Automated setup

All of the above (except copying files) is handled by `setup-pi.sh`:

```bash
# From the Mac, copy everything first:
scp -r server/* jakeoil@192.168.1.239:~/lg-remote/server/
scp index.html styles.css app.js jakeoil@192.168.1.239:~/lg-remote/
scp setup-pi.sh jakeoil@192.168.1.239:~/lg-remote/

# Then on the Pi:
cd ~/lg-remote
bash setup-pi.sh
```
