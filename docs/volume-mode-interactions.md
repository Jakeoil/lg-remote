# Volume, Mode, and Audio Routing — Interactions and Inconsistencies

## The Three Audio Modes

| Mode | TV Output Setting | Who Controls Volume | Physical Path |
|------|------------------|---------------------|---------------|
| **Gaming** | `tv_speaker` | LG TV (SSAP) | TV internal speakers |
| **Normal** | `external_arc` | Sonos Arc Ultra (UPnP) | HDMI ARC → Sonos |
| **Headphone** | `tv_external_speaker` | LG TV (SSAP) | Toslink optical → Sennheiser |

---

## Two Separate Volume Universes

The LG TV and the Sonos each maintain **completely independent volume levels**. There is no
automatic synchronisation between them — they are different devices with different numbering.

### LG TV Volume
- Controlled via SSAP (WebSocket on port 3001): `ssap://audio/volumeUp`, `ssap://audio/volumeDown`, `ssap://audio/setVolume`
- Scale: 0–100
- Reflected in the LG volume OSD on screen
- **Only relevant in Gaming and Headphone modes** (when TV speakers or optical output is active)
- The SSE subscription (`ssap://audio/getVolume`) pushes any change to the web UI in real time,
  including changes made by the physical remote or Sonos CEC commands

### Sonos Arc Ultra Volume
- Controlled via UPnP/SOAP on port 1400: `RenderingControl` / `SetVolume` / `GetVolume`
- Scale: 0–100 (but Sonos internally may use a different curve than the LG)
- Reflected in the Sonos app and on the soundbar's own LED
- **Only relevant in Normal (ARC) mode**
- Changes made in the Sonos app or via the Sonos physical touch controls are **not pushed to
  the web UI** — there is no SSE equivalent for Sonos. The web UI slider will drift out of sync
  if volume is changed externally (Sonos app, touch panel, or remote CEC).

---

## How the Web App Routes Volume Commands

```
User presses +/- in web UI
        │
        ▼
  currentOutput === 'external_arc' ?
        │
   YES  │  NO
        │   └──► ssap://audio/volumeUp/Down  →  LG TV  →  TV speakers / optical
        │
        ▼
  sonosRequest GetVolume  →  Sonos UPnP
  calculate new level
  sonosRequest SetVolume  →  Sonos UPnP
```

The routing decision is made on the server using `currentOutput`, which is kept current by the
LG TV's SSE subscription (`ssap://audio/getVolume` pushes `soundOutput` on every change).

### Why Not Just Use `ssap://audio/volumeUp` in ARC Mode?

In ARC mode the LG TV is supposed to forward its volume commands to the Sonos via **HDMI ARC
CEC** (Consumer Electronics Control). But CEC requires the Sonos to have its CEC listener
"active". The Sonos CEC listener goes dormant when the Sonos has been idle or controlled
directly. It only activates reliably after a physical button press on the original LG remote
("priming"). Until primed, `ssap://audio/volumeUp` appears to succeed on the TV but the Sonos
ignores it — hence no audible volume change and no web UI update.

**The fix (current):** In ARC mode, bypass CEC entirely. GetVolume → compute → SetVolume
directly via Sonos UPnP. This always works regardless of CEC state.

### The `/volume/set` Gap

`POST /volume/set` always calls `ssap://audio/setVolume` regardless of mode. This means:
- In Gaming/Headphone mode: works correctly (LG TV speakers/optical)
- In ARC/Normal mode: sets the **TV's internal volume** (not the Sonos), which has no effect
  on what you hear (audio is going through the Sonos, not the TV speakers). The web UI will
  also not reflect the change since the Sonos volume is unaffected.

This is why the slider on the prototype page and the knob widget behave unexpectedly in ARC
mode — they use `/volume/set`. The step buttons (+/-) are correct because they use
`/volume/up` and `/volume/down` which have the ARC routing logic.

---

## The Physical Remote (IR / CEC)

The LG Bluetooth/IR remote operates on a completely separate path:

```
Physical remote button press
        │
        ├─► LG TV processes it internally (SSAP subscription sees the result)
        │
        └─► In ARC mode: LG TV sends CEC command over HDMI ARC to Sonos
                (only if Sonos CEC listener is active / "primed")
```

Because the TV's `ssap://audio/getVolume` subscription sees all volume changes regardless of
source, the web UI's LG volume bar **will update** when the physical remote changes TV volume
(Gaming/Headphone modes). However, if the remote changes Sonos volume via CEC in ARC mode,
the Sonos volume bar in the web UI will **not update** (no push mechanism from Sonos).

---

## The Sonos App

The Sonos app controls the Sonos directly via its own protocol (not UPnP from this server). It
has no awareness of the LG TV's state. Changes made in the Sonos app:

| What changes | Web UI updates? | TV updates? |
|---|---|---|
| Sonos volume via Sonos app | **No** — no push from Sonos | No |
| Sonos mute via Sonos app | **No** | No |
| Sonos input source via Sonos app | **No** | No (but TV may lose ARC audio) |

The web UI's Sonos volume slider will be stale until the next time the app polls `/sonos/volume`
(which currently only happens on initial page load and mode switch, not periodically).

---

## Mute Inconsistencies

### LG Mute (`POST /volume/mute`)
- Calls `ssap://audio/getVolume` to read current mute state, then toggles with `ssap://audio/setMute`
- Works in all modes (mutes whatever the TV is sending to its active output)
- In ARC mode this mutes the TV's output to the Sonos — effectively silencing the Sonos, but
  the Sonos itself is not muted (its volume level is unchanged). The Sonos app will show it
  as playing at full volume.

### Sonos Mute (`POST /sonos/mute`)
- Calls `RenderingControl/SetMute` directly on the Sonos
- Independent of the LG TV mute state
- These two mutes can stack: both the TV output and the Sonos can be muted simultaneously,
  requiring both to be unmuted to hear audio.

---

## Summary of Known Drift Scenarios

| Scenario | What drifts | Why |
|---|---|---|
| Physical remote adjusts volume in ARC mode | Sonos volume bar in web UI | No Sonos push event |
| Sonos app changes volume | Sonos volume bar in web UI | No Sonos push event |
| Sonos app changes input/source | Web UI mode indicator | No push; TV may or may not detect ARC loss |
| `/volume/set` called in ARC mode | LG bar shows wrong value; Sonos unchanged | Routes to TV, not Sonos |
| CEC not primed + old volume path used | Web UI updates but no audible change | CEC dormant |
| LG mute active + Sonos volume shown as non-zero | Both mutes shown independently | Two separate mutes |

---

## Potential Improvements

1. **Poll Sonos volume periodically** (e.g. every 10s) to reduce drift of the Sonos bar
2. **Fix `/volume/set` to respect ARC mode** — same routing logic as `/volume/up` and `/volume/down`
3. **Sonos webhook/subscription** — Sonos supports UPnP event subscriptions (`SUBSCRIBE` HTTP method
   on `RenderingControl` endpoint) for push notifications of volume changes from any source
4. **Unified mute** — in ARC mode, LG mute could simultaneously mute/unmute the Sonos so they
   stay in sync
