# Flow: Gaming Mode → Normal Mode

Gaming mode: TV audio via built-in speakers, Sonos powered off via Kasa plug
Normal mode: TV audio via HDMI ARC → Sonos Arc Ultra

This is the most complex mode switch — the Sonos must fully boot before the TV
can hand off audio to it.

---

## Frontend

```
User clicks Normal Mode button
  │
  ▼
setMode('normal')
  ├─ btn.classList.add('sending')     ← button dims, pointer-events off
  └─ showStatus("Switching to Sonos / ARC...")
  │
  ▼
POST /audio/normal
  │
  (server takes 30–60 seconds to respond while Sonos boots)
  │
  ▼
(await response)
  │
  ▼
setTimeout(fetchStatus, 1500)
btn.classList.remove('sending')
  │
  ▼
GET /status
  └─ response: { output: "external_arc" }
       ├─ showStatus("Current Audio: HDMI ARC / Sonos")
       ├─ normalBtn.classList.add('active')
       └─ updateOutputRadio("external_arc")
```

---

## Server: POST /audio/normal

```
/audio/normal
  │
  ▼
getPlug()
  └─ kasaClient.getDevice({ host: 192.168.1.246 })
       └─ TCP connection to Kasa EP10 on port 9999
  │
  ▼
plugOn()
  └─ plug.setPowerState(true)
       └─ TP-Link encrypted command → 192.168.1.246:9999
            └─ Kasa plug powers on Sonos Arc Ultra
  │
  ▼
Poll sonosReachable() every 2s, up to 60s
  └─ TCP probe → 192.168.1.245:1400
       ├─ not yet... (Sonos booting)
       ├─ not yet...
       └─ connected! Sonos is online
  │
  ▼
wait 3s extra                         ← settle time after Sonos becomes reachable
  │
  ▼
sonosPlayTV()
  │
  ├─ SOAP: SetAVTransportURI
  │    POST http://192.168.1.245:1400/MediaRenderer/AVTransport/Control
  │    SOAPAction: AVTransport#SetAVTransportURI
  │    body: CurrentURI = x-sonos-htastream:RINCON_74CA606BC09101400:spdif
  │              └─ tells Sonos to use the TV's eARC/optical input
  │
  └─ SOAP: Play
       POST http://192.168.1.245:1400/MediaRenderer/AVTransport/Control
       SOAPAction: AVTransport#Play
       body: Speed = 1
  │
  ▼
sonosMute(false)
  └─ SOAP: SetMute
       POST http://192.168.1.245:1400/MediaRenderer/RenderingControl/Control
       SOAPAction: RenderingControl#SetMute
       body: DesiredMute = 0
  │
  ▼
tvRequest(ssap://audio/changeSoundOutput, { output: "external_arc" })
  └─ SSAP command over WebSocket wss://192.168.1.238:3001
       └─ LG TV switches audio output to HDMI ARC
  │
  ▼
{ success: true, output: "external_arc", sonos: "playing" }
```

---

## Sonos SOAP Commands Detail

All Sonos commands are HTTP POST with a `text/xml` body to port 1400.

| Step | Endpoint | Service | Action | Key Parameter |
|------|----------|---------|--------|---------------|
| Set input | `/MediaRenderer/AVTransport/Control` | `AVTransport` | `SetAVTransportURI` | `CurrentURI: x-sonos-htastream:RINCON_...:spdif` |
| Play | `/MediaRenderer/AVTransport/Control` | `AVTransport` | `Play` | `Speed: 1` |
| Unmute | `/MediaRenderer/RenderingControl/Control` | `RenderingControl` | `SetMute` | `DesiredMute: 0` |

---

## State Before and After

| | Gaming Mode | Normal Mode |
|---|---|---|
| TV audio output | `tv_speaker` | `external_arc` (HDMI ARC) |
| Kasa plug | Off | On |
| Sonos Arc Ultra | Powered off | Powered on, playing TV eARC input |
| Sonos mute | — | Unmuted |

---

## Notes

- Sonos is powered on **before** the TV switches to ARC — the TV needs the Sonos
  to be ready to accept the handoff.
- The eARC URI format `x-sonos-htastream:RINCON_...:spdif` is Sonos's internal
  identifier for the TV audio input on the Arc Ultra.
- If the Kasa plug is unreachable, the server skips the boot wait and goes
  straight to the Sonos SOAP commands (assumes Sonos is already on).
- The 3s settle delay after Sonos becomes reachable prevents a race where
  Sonos accepts the TCP connection but isn't ready to process SOAP yet.
