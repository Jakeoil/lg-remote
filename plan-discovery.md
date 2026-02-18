# Plan: Auto-Discovery & Wake-on-LAN

## Findings (2/13/26)

Ran SSDP and mDNS scans from the Mac. Three of four controlled devices advertise themselves on the local network:

### LG TV (192.168.1.238)
- Advertises via **AirPlay** and **Google Cast** (mDNS)
- Google Cast name: `OLED65G4SUB`
- Does NOT respond to SSDP M-SEARCH
- Primary control API (SSAP over WebSocket port 3001) is not advertised via any discovery protocol — but we can find the TV by its AirPlay/Cast advertisement and then connect to port 3001

### Sonos Arc Ultra (192.168.1.245)
- Advertises via **SSDP** (23 responses!), **AirPlay**, **Spotify Connect**, **mDNS** (`_sonos._tcp`)
- mDNS name: `Living Room Sonos`
- RINCON ID is in the SSDP/mDNS metadata — no need to hardcode it
- Advertises 15+ UPnP services: AVTransport, RenderingControl, MusicServices, HTControl, QPlay, etc.

### Roku Ultra (192.168.1.244)
- Advertises via **SSDP** (`roku:ecp`, DIAL) and **AirPlay**
- Model: 4850X, firmware 15.1.4
- SSDP LOCATION gives us the ECP URL directly (`http://IP:8060/`)

### Kasa EP10 Smart Plug (192.168.1.246)
- **Not discoverable** via SSDP or mDNS
- Uses proprietary TP-Link protocol on port 9999
- The `tplink-smarthome-api` package has its own `Client.startDiscovery()` method that scans via broadcast UDP — this could work as a fallback

### Other devices on the network
- JakeMax (Mac), Debbie's MacBook Air — AirPlay
- HP OfficeJet Pro 9010 — printing/scanning via IPP

## Goal 1: Eliminate .env file (maybe)

With auto-discovery, we could remove most or all env vars:

| Env Var | Discovery Method | Confidence |
|---|---|---|
| `TV_IP` | mDNS `_googlecast._tcp` or `_airplay._tcp` → look for "LG" or "OLED" | High |
| `SONOS_IP` | mDNS `_sonos._tcp` or SSDP | High |
| `SONOS_RINCON` | Extracted from Sonos mDNS/SSDP metadata | High |
| `ROKU_IP` | SSDP `roku:ecp` | High |
| `KASA_IP` | `tplink-smarthome-api` broadcast discovery | Medium |
| `PORT` | Keep as env var or default 3000 | N/A |

Approach:
- On server startup, run discovery for ~5 seconds
- Match devices by service type (not IP)
- Fall back to .env values if discovery fails
- Log discovered IPs so user can verify

## Goal 2: Turn on the TV from the page

The TV has "Turn on via Wi-Fi" enabled in settings. LG webOS TVs support **Wake-on-LAN** — send a magic packet (UDP broadcast containing the TV's MAC address repeated) and the TV powers on.

Requirements:
- Need the TV's MAC address (one-time: get from router, ARP table, or TV settings)
- Send WoL magic packet from the server (npm package `wake_on_lan` or raw UDP)
- Add a power button to the frontend
- After WoL, poll for TV to come online, then auto-connect

This means the page could work even when the TV is off: tap power → TV wakes up → server connects → full control.

## Status

Research complete. Implementation not started.
