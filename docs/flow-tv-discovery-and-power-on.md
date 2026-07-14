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

## Power states (read this first)

The TV has three states and **two of them are "off"**. Port 3001 is open in all
three, so it says nothing about power:

| `getPowerState`  | Screen | webOS / SSAP         | TLS handshake |
|------------------|--------|----------------------|---------------|
| `Active`         | ON     | serving              | succeeds      |
| `Active Standby` | OFF    | **serving normally** | succeeds      |
| `Suspend`        | OFF    | down                 | ECONNRESET    |

A powered-off TV sits in `Active Standby` answering SSAP on a live socket for
minutes (measured: 96s+), then decays to `Suspend`. Power is therefore read
**only** via `tvPowerState()` →
`ssap://com.webos.service.tvpower/power/getPowerState`. A live socket,
a successful handshake, or `/status` succeeding all mean nothing.

---

## Power On (Wake-on-LAN)

```
User clicks power button (red)
  │
  ▼
POST /tv/wake
  │
  ▼
wol.wake("44:27:45:06:D6:E2")   (TV_MAC pinned in .env)
  └─ UDP magic packet → broadcast 255.255.255.255
  │
  ▼
Retry tvIsAwake() until deadline (90s)
  └─ connectTV() → getPowerState
       ├─ handshake fails      → Suspend, not awake yet
       ├─ state=Active Standby → still OFF, keep waiting
       └─ state=Active         → awake!
  │                    (measured: ~7s warm, ~40s from cold standby)
  ▼
{ success: true } → browser        ← only after a real Active reading
  │
  ▼
GET /status  (polled every 5s)
  └─ tvPowerState() → Active?
       ├─ no  → 500 { error: "TV is off" } → button red
       └─ yes → tvRequest(ssap://audio/getSoundOutput)
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
  ├─ !tvConnected        → { success: true, "TV is already off" }
  ├─ state !== "Active"  → { success: true, "TV is already off" }
  │                         (Active Standby serves SSAP — a live
  │                          socket is not proof the TV is on)
  ▼
tvRequest(ssap://system/turnOff)
  │
  ▼
TV → "Active Standby"; the socket STAYS UP and keeps serving.
Do not clear tvConnection here — orphaning it leaks the socket and
makes the reconnect loop open a second one. /status reports power
from getPowerState, so the button goes red on its own.
  │
  ▼
{ success: true } → browser
```

> The TV does **not** get woken back up by the Sonos or Roku over CEC. That was
> tested three ways and disproven; an apparent self-wake was `Active Standby`
> being misread as "on". See `CLAUDE.md`.
