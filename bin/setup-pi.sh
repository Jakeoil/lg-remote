#!/bin/bash
# Setup script for LG TV Remote on Raspberry Pi 4 (Debian 12 bookworm, aarch64)
# Run this on the Pi: bash setup-pi.sh

set -e

echo "=== LG TV Remote - Raspberry Pi Setup ==="

# 1. Install Node.js 22 LTS
echo ""
echo "--- Installing Node.js 22 LTS ---"
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "Node: $(node -v)"
echo "npm: $(npm -v)"

# 2. Clone or copy the project
echo ""
echo "--- Setting up project ---"
mkdir -p ~/lg-remote/server
cd ~/lg-remote/server

# Copy server files (these will be scp'd from your Mac beforehand)
if [ ! -f server.js ]; then
  echo "ERROR: server.js not found in ~/lg-remote/server/"
  echo "First copy files from your Mac:"
  echo "  scp -r server/* jakeoil@192.168.1.239:~/lg-remote/server/"
  exit 1
fi

# 3. Install npm dependencies
echo ""
echo "--- Installing dependencies ---"
npm install

# 4. Create systemd service for auto-start
echo ""
echo "--- Setting up systemd service ---"
sudo tee /etc/systemd/system/lg-remote.service > /dev/null << 'EOF'
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
EOF

sudo systemctl daemon-reload
sudo systemctl enable lg-remote
sudo systemctl start lg-remote

echo ""
echo "=== Setup complete ==="
echo ""
echo "Server status:"
sudo systemctl status lg-remote --no-pager
echo ""
echo "Useful commands:"
echo "  sudo systemctl status lg-remote    # check status"
echo "  sudo systemctl restart lg-remote   # restart"
echo "  sudo systemctl stop lg-remote      # stop"
echo "  journalctl -u lg-remote -f         # view logs"
echo ""
echo "NOTE: Accept the pairing prompt on your TV when it appears."
echo "      Run: curl http://localhost:3000/status  to trigger pairing."
