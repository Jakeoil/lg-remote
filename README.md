# LG TV Remote

A mobile-friendly web remote for LG WebOS TVs. Switch between TV speakers (gaming) and HDMI ARC/Sonos (normal viewing) from your phone.

## How It Works

```
Phone Browser  →  GitHub Pages (frontend)  →  Mac Proxy Server  →  LG TV (WebSocket)
```

The frontend is a static webapp hosted on GitHub Pages. It sends HTTP requests to a small Node.js proxy server running on your Mac, which communicates with the TV over your local network via WebSocket.

## Setup

### 1. Find Your TV's IP Address

On your LG TV: **Settings → Network → Wi-Fi → Advanced Settings** — note the IP address. As of 2/13/26, the TV is at `192.168.1.238`.

### 2. Find Your Mac's IP Address

```bash
ipconfig getifaddr en0
```

As of 2/13/26, the MacBookPro is at `192.168.1.235`.

### 3. Install and Run the Proxy Server

```bash
cd server
npm install
TV_IP=192.168.1.238 node server.js
```

### 4. Pair With Your TV

The first time the server connects to the TV, a pairing prompt will appear on the TV screen. **Press "Accept" on the TV** using your physical remote. The pairing key is saved automatically for future use.

### 5. Deploy Frontend to GitHub Pages

Push this repo to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jakeoil/lg-remote.git
git branch -M main
git push -u origin main
```

Then go to **Settings → Pages** in the GitHub repo and set the source to the `main` branch root (`/`).

Your remote will be live at: **https://jakeoil.github.io/lg-remote**

### 6. Use the Remote

1. Open `https://jakeoil.github.io/lg-remote` on your phone
2. Enter your proxy server URL: `http://192.168.1.235:3000`
3. Tap **Connect**
4. Use the buttons to switch audio modes or adjust volume

### 7. Add to Android Home Screen

In Chrome on Android: tap the **⋮** menu → **Add to Home screen**. This gives you a quick app-like shortcut.

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
| `PORT`              | `3000`          | Proxy server port        |

## Troubleshooting

- **"Cannot reach server"** — Make sure the proxy is running and your phone is on the same WiFi network as your Mac.
- **Connection timeout** — The TV may be off or in deep sleep. Turn it on and try again.
- **Pairing prompt doesn't appear** — Restart the proxy server. The TV only shows the prompt on the first connection attempt.
- **CORS errors** — The proxy server includes CORS headers. Make sure you're connecting to the right URL.
