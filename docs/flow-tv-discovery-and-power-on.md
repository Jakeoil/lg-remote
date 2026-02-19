# Flow: TV Discovery and Power On

## Discovery (server startup)

```
start()
  │
  ▼
discoverDevices() ─────────────────────────────┐
  │                                             │
  ├─ mDNS browse _googlecast._tcp              │  parallel
  │    └─ match name/model: "lg" / "oled"      │
  │         └─ Found: OLED65G4SUB → IP .238    │
  │                                             │
  ├─ mDNS browse _sonos._tcp                   │
  │    └─ Found: RINCON_... → IP .245          │
  │                                             │
  ├─ SSDP search roku:ecp                      │
  │    └─ Found: Roku → IP .244               │
  │                                             │
  └─ Kasa broadcast discovery ─────────────────┘
       └─ Found: "sonos power" → IP .246
  │
  ▼
arpLookup(192.168.1.238)
  └─ exec arp 192.168.1.238
       └─ parse MAC → 44:27:45:06:D6:E2
  │
  ▼
applyDiscovery()
  └─ TV_IP    = 192.168.1.238
     TV_MAC   = 44:27:45:06:D6:E2
     SONOS_IP = 192.168.1.245
     RINCON   = RINCON_74CA606BC09101400
     ROKU_IP  = 192.168.1.244
     KASA_IP  = 192.168.1.246
  │
  ▼
app.listen(:3000)
```

> `.env` values take precedence over discovery when set.

---

## Power On (Wake-on-LAN)

```
User clicks power button (red)
  │
  ▼
POST /tv/wake
  │
  ▼
wol.wake("44:27:45:06:D6:E2")
  └─ UDP magic packet → broadcast 255.255.255.255
  │
  ▼
Poll TCP port 3001 @ 192.168.1.238
  every 2s, up to 60s
  │
  ├─ not yet... (TV booting)
  ├─ not yet...
  └─ connected! TV is awake
  │
  ▼
connectTV()
  └─ WebSocket wss://192.168.1.238:3001
       ├─ TLS handshake (self-signed, no verify)
       ├─ SSAP pairing (client key from ~/.lgtv2/)
       └─ connected → tvConnected = true
            └─ subscribe ssap://audio/getVolume
                 └─ volume updates stream to browser via SSE
  │
  ▼
{ success: true } → browser
  │
  ▼
updatePowerButton(true) → green
  │
  ▼
GET /status
  └─ tvRequest(ssap://audio/getSoundOutput)
       └─ e.g. "external_arc" → status bar updated
```

---

## Power Off

```
User clicks power button (green)
  │
  ▼
POST /tv/off
  │
  ▼
tvRequest(ssap://system/turnOff)
  └─ SSAP command over existing WebSocket
  │
  ▼
tvConnected = false
tvConnection = null
  │
  ▼
{ success: true } → browser
  │
  ▼
updatePowerButton(false) → red
showStatus("TV is off")
```
