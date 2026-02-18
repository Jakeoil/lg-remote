# LG TV Remote

A mobile-friendly web remote for LG WebOS TVs. Switch between TV speakers (gaming), HDMI ARC/Sonos (normal viewing), and optical output for Sennheiser RS 185 wireless headphones — all from your phone.

## How It Works

```
Phone Browser  →  Raspberry Pi (http://192.168.1.239:3000)  →  LG TV (WebSocket)
                                                             →  Sonos (UPnP/SOAP)
                                                             →  Kasa Smart Plug (local API)
```

Everything runs locally on the Raspberry Pi (`lx200pi` at `192.168.1.239`). The Pi hosts both the frontend and the proxy server on port 3000. It communicates with the TV over WebSocket, controls the Sonos soundbar via UPnP, and manages the Kasa smart plug that powers the Sonos.

## Devices

| Device | IP | Protocol |
|--------|-----|----------|
| Raspberry Pi (lx200pi) | `192.168.1.239` | Express server on port 3000 |
| LG TV | `192.168.1.238` | WebSocket (SSAP) on port 3001 |
| Sonos Soundbar | `192.168.1.245` | UPnP/SOAP on port 1400 |
| Kasa Smart Plug (EP10) | `192.168.1.246` | TP-Link local API on port 9999 |
| Roku | `192.168.1.244` | ECP on port 8060 |

## Setup

### 1. Raspberry Pi

The server runs as a systemd service on the Pi:

```bash
cd ~/projects/lg-remote/server
npm install
```

The service is configured at `/etc/systemd/system/lg-remote.service` and starts automatically on boot.

To restart manually:

```bash
sudo systemctl restart lg-remote.service
```

### 2. Find Your TV's IP Address

On your LG TV: **Settings → Network → Wi-Fi → Advanced Settings** — note the IP address.

### 3. Pair With Your TV

The first time the server connects to the TV, a pairing prompt will appear on the TV screen. **Press "Accept" on the TV** using your physical remote. The pairing key is saved automatically for future use.

### 4. Deploy Frontend to GitHub Pages (Backup)

The frontend is also available on GitHub Pages as a fallback if the Pi is down:

```bash
git push origin main
```

Then go to **Settings → Pages** in the GitHub repo and set the source to the `main` branch root (`/`).

Backup URL: **https://jakeoil.github.io/lg-remote**

### 5. Mac Proxy Server (Backup)

If the Pi is unavailable, the Mac can run the server. Install dependencies first:

```bash
cd server && npm install
```

**Option A: Run manually**

```bash
node server.js
```

**Option B: Auto-start on login (launch agent)**

Install:
```bash
./mac-install.sh
```

Uninstall:
```bash
./mac-uninstall.sh
```

Check status and logs:
```bash
launchctl list | grep lg-remote
tail -f /tmp/lg-remote.log
```

The Mac server is at `http://192.168.1.235:3000`.

### 6. Use the Remote

**Primary — Raspberry Pi (http://192.168.1.239:3000):**

1. Open **http://192.168.1.239:3000** on your phone or computer
2. The page auto-connects to the Pi server — no setup needed
3. Use the buttons to switch audio modes, adjust volume, or toggle the Sonos power
4. The TV must be on for audio mode commands to work

The Pi runs 24/7 and auto-starts the server on boot. This is the recommended way to use the remote.

**Fallback — GitHub Pages (https://jakeoil.github.io/lg-remote):**

If the Pi is down, the frontend is also hosted on GitHub Pages. Since GitHub Pages can't reach your local network, you need a proxy server running on your Mac (or the Pi):

1. Open **https://jakeoil.github.io/lg-remote** on your phone
2. Enter the proxy server URL (e.g. `http://192.168.1.235:3000` for Mac, or `http://192.168.1.239:3000` for Pi)
3. Tap **Connect** — the URL is saved for next time

**How auto-connect works:** When the page is served from a local network address (Pi or Mac), it automatically uses that server — no URL entry needed. When served from GitHub Pages, you must enter the server URL once and it's remembered in your browser.

### 7. Add to Phone Home Screen

- **Android (Chrome):** tap **⋮** menu → **Add to Home screen**
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**

## Audio Modes

| Button | Sound Output | Sonos Power | Description |
|--------|-------------|-------------|-------------|
| Gaming Mode | TV Speakers | Off | Low-latency audio for gaming |
| Normal Mode | HDMI ARC / Sonos | On | Soundbar for movies and music |
| Headphone Mode | Optical + TV Speakers (muted) | Off | Sennheiser RS 185 wireless headphones via optical out |

## Project Structure

```
lg-remote/
├── index.html          # Frontend UI
├── styles.css          # Styles
├── app.js              # Frontend logic
├── server/
│   ├── server.js       # Proxy server
│   └── package.json    # Node.js dependencies
└── README.md
```

## Configuration

| Environment Variable | Default         | Description              |
|---------------------|-----------------|--------------------------|
| `TV_IP`             | `192.168.1.238` | LG TV IP address         |
| `SONOS_IP`          | `192.168.1.245` | Sonos soundbar IP        |
| `KASA_IP`           | `192.168.1.246` | Kasa smart plug IP       |
| `ROKU_IP`           | `192.168.1.244` | Roku IP address          |
| `PORT`              | `3000`          | Server port              |

## Troubleshooting

- **"Connection timed out - is the TV on?"** — The TV is off or in deep sleep. Turn it on and try again. Audio mode commands require the TV to be on.
- **"Cannot reach server"** — The Pi or proxy server is not running, or your phone is on a different network.
- **Pairing prompt doesn't appear** — Restart the service (`sudo systemctl restart lg-remote.service`). The TV only shows the prompt on the first connection attempt.
- **Volume number not updating** — Refresh the page to re-establish the SSE connection.
- **Sonos not responding after power on** — The Sonos takes ~30 seconds to boot after the plug is powered on. Normal Mode waits for it automatically.
