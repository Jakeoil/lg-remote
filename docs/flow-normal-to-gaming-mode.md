# Flow: Normal Mode → Gaming Mode

Normal mode: TV audio via HDMI ARC → Sonos Arc Ultra (powered on via Kasa plug)
Gaming mode: TV audio via built-in speakers, Sonos powered off

---

## Frontend

```
User clicks Gaming Mode button
  │
  ▼
setMode('gaming')
  ├─ btn.classList.add('sending')     ← button dims, pointer-events off
  └─ showStatus("Switching to TV Speakers...")
  │
  ▼
POST /audio/gaming
  │
  ▼
(await response)
  │
  ▼
setTimeout(fetchStatus, 1500)         ← TV needs moment to finish switching
btn.classList.remove('sending')
  │
  ▼
GET /status
  └─ response: { output: "tv_speaker" }
       ├─ showStatus("Current Audio: TV Speakers")
       ├─ gamingBtn.classList.add('active')
       └─ updateOutputRadio("tv_speaker")
```

---

## Server: POST /audio/gaming

```
/audio/gaming
  │
  ▼
tvRequest(ssap://audio/changeSoundOutput, { output: "tv_speaker" })
  │
  ├─ connectTV() if not already connected
  │    └─ WebSocket wss://192.168.1.238:3001
  │
  └─ SSAP request over WebSocket
       └─ LG TV switches audio output to built-in speakers
  │
  ▼ (TV switched — if this fails, we stop here before touching Sonos)
  │
  ▼
getPlug()
  └─ kasaClient.getDevice({ host: 192.168.1.246 })
       └─ TCP connection to Kasa EP10 on port 9999
  │
  ▼
plugOff()
  └─ plug.setPowerState(false)
       └─ TP-Link encrypted command → 192.168.1.246:9999
            └─ Kasa plug cuts power to Sonos Arc Ultra
  │
  ▼
{ success: true, output: "tv_speaker", sonos: "powered_off" }
```

---

## State Before and After

| | Normal Mode | Gaming Mode |
|---|---|---|
| TV audio output | `external_arc` (HDMI ARC) | `tv_speaker` |
| Kasa plug | On | Off |
| Sonos Arc Ultra | Powered on, playing TV input | Powered off |

---

## Notes

- The TV audio switch happens **before** Sonos is powered off.
  If the TV is off, the SSAP command fails immediately and Sonos is left untouched.
- If the Kasa plug is unreachable, falls back to sending Sonos a Stop + Mute command via UPnP/SOAP.
- The 1500ms delay before `fetchStatus` gives the TV time to fully commit the output switch before querying it.
