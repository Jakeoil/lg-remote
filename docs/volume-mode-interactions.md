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
| Physical remote vol-up → LG +1, Sonos +2 (intermittent) | Sonos drifts ahead | LG TV may send two CEC commands per button press (button-down + button-up); Sonos counts both |

---

## Web UI Volume Control Flows

### Flow 1 — User adjusts Sonos slider / ruler in web UI
```
User drags slider or ruler
        │
        ▼
POST /sonos/volume  { volume: N }
        │
        ▼
sonosEnsureTVInput()          ← activates ARC input if Sonos is stopped
        │
        ▼
Sonos UPnP SetVolume          ← direct, bypasses CEC entirely
        │
        ▼
Response → web UI confirms new value
```

### Flow 2 — User presses +/- step buttons in web UI
```
POST /volume/up  or  /volume/down
        │
        ▼
currentOutput === 'external_arc' ?
   YES → Sonos UPnP GetVolume → compute N±1 → SetVolume
   NO  → ssap://audio/volumeUp / volumeDown  →  LG TV speakers / optical
```

### Flow 3 — Physical IR remote changes volume
```
Remote button press
        │
        ├─► LG TV processes it  →  ssap://audio/getVolume SSE fires
        │                               │
        │                               ▼
        │                         Web UI receives SSE event
        │                               │
        │                               ├─► LG volume bar / knob updated immediately
        │                               │
        │                               └─► Sonos poll triggered (in-flight guard):
        │                                     if no poll in flight → GET /sonos/volume
        │                                     → UPnP GetVolume → update Sonos slider/ruler
        │
        └─► In ARC mode: LG sends CEC to Sonos (only if CEC listener active/primed)
```

### Flow 4 — Sonos volume changed externally (Sonos app, touch panel)
```
External change
        │
        ▼
No push event reaches server
        │
        ▼
Web UI Sonos slider drifts until next SSE-triggered poll
(next remote press will re-sync it)
```

### In-flight guard (Sonos polling)
The SSE can fire rapidly (e.g. holding a remote button). To prevent concurrent Sonos
UPnP requests from piling up and starving the SSE connection, a boolean `sonosFetching`
flag ensures only one GET /sonos/volume is in flight at a time. If an event arrives
while a poll is in progress, it is dropped — the in-progress poll will return the
latest value anyway.

---

## Potential Improvements

1. **Fix `/volume/set` to respect ARC mode** — same routing logic as `/volume/up` and `/volume/down`
2. **Sonos webhook/subscription** — Sonos supports UPnP event subscriptions (`SUBSCRIBE` HTTP method
   on `RenderingControl` endpoint) for push notifications of volume changes from any source
3. **Unified mute** — in ARC mode, LG mute could simultaneously mute/unmute the Sonos so they
   stay in sync
4. **Route Sonos volume through LG SSAP** — instead of directly calling Sonos UPnP `SetVolume`,
   call `ssap://audio/setVolume` with an absolute value. The LG TV forwards it to Sonos via CEC
   as a single atomic command. This avoids the double-increment problem and removes the need for
   the Sonos-specific GetVolume→compute→SetVolume round-trip. Requires CEC to be primed (same
   limitation as the old path), but sonosEnsureTVInput() could be called first to activate it.
