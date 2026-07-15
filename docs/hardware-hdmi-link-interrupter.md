# HDMI Link Interrupter — design

Status: **design, not built.** See worklist item 9.

An inline female-female HDMI device that sits where the current 8K coupler
sits, on the TV↔Sonos ARC cable. Powered over USB from a Kasa-switched wall
adapter. Powered = link connected; unpowered = link broken.

## Why

Today the app switches between Sonos and headphone/internal audio with a
sledgehammer: the Kasa plug cuts Sonos **mains**, because a powered Sonos holds
the TV's ARC/CEC audio output and a Sonos has no power-off (see `CLAUDE.md`).
The cost: every switch to headphone/gaming mode **kills Spotify Connect**,
which the user runs constantly and independently of the TV, and returning to
normal mode eats a ~22s Sonos reboot.

The TV cannot see the Sonos's mains state. It only knows what the cable tells
it — hot-plug detect, CEC, and the eARC lines. Cutting mains "works" precisely
because it makes those lines go dead. This device cuts the same lines directly
and leaves the Sonos running:

- Spotify Connect survives every mode switch
- No ~22s reboot returning to normal mode; just an eARC renegotiation
- No daily hard power cycles on the Arc
- Manual unplugging at the coupler (the current habit) is replaced by a relay
  doing the same thing electrically

**Concept validation:** manually unplugging at the coupler while the Sonos is
powered is the exact electrical event this device produces. If that frees the
TV's optical/internal outputs (believed yes from daily practice — confirm
once, deliberately), the concept is proven.

## The key simplification

**No video crosses this link.** The soundbar connection on the TV's ARC port
carries no TMDS traffic, so 16 of 19 pins are dumb straight-through copper.
Only three pins are switched, and only two are fast:

| Pin | Function | Treatment | Why |
|-----|----------|-----------|-----|
| 1–12 | TMDS data/clock + shields | pass through | unused on a soundbar link |
| 13 | CEC | **relay** | Sonos must vanish from the CEC bus, not just the port |
| 14 | Utility / HEAC+ | **relay** | ARC/eARC audio pair, half |
| 15, 16 | DDC (SCL/SDA) | pass through | TV won't read EDID with HPD low |
| 17 | DDC/CEC ground | pass through | |
| 18 | +5V (TV→Sonos) | pass through | presence power; harmless |
| 19 | HPD / HEAC− | **relay** | HPD drop = "unplugged" to the TV; other half of eARC pair |

Cutting 13/14/19 together is electrically identical to unplugging the cable
for everything that matters on an audio-only link.

## Circuit

No microcontroller, no firmware.

```
USB 5V ──┬──────────────┬─────────────► (optional LED + resistor)
         │              │
      [coil K1]      [coil K2]      two DPDT signal relays,
         │              │           coils in parallel
         └──────┬───────┘
                │
         [1N4148 flyback diode across coils, cathode to +5V]
                │
USB GND ────────┴───────────────────────

K1 pole A: pin 13 (CEC)      — normally open
K1 pole B: pin 19 (HPD/HEAC−) — normally open
K2 pole A: pin 14 (HEAC+)     — normally open
K2 pole B: spare
```

- **Normally-open contacts, so powered = connected.** Kasa ON = normal mode,
  Kasa OFF = headphone/gaming — identical to today's plug semantics, so
  `plugOn()`/`plugOff()` and all three `/audio/*` endpoints work unchanged.
- Failure mode: USB supply dies → link drops → headphones work, Sonos keeps
  playing Spotify. The right way to fail.
- Coil draw ~40 mA total; any USB wall wart on the Kasa suffices.
- Route pins 14 and 19 through **adjacent poles with matched short leads** —
  they are a differential pair carrying eARC audio (~100 Mbps) when closed.
- Optional but recommended: a 3-position toggle in the coil supply —
  **CONNECT / AUTO / DISCONNECT** — preserving the manual-override habit and
  giving a bypass if the Kasa or app misbehaves.

## BOM (~$25)

| Qty | Part | Example | ~Cost |
|-----|------|---------|-------|
| 2 | HDMI-A female breakout board (all 19 pins) | generic, Amazon/AliExpress | $8 |
| 2 | DPDT 5V signal relay (telecom class) | Panasonic TQ2-5V or Omron G6K-2F-Y 5VDC | $8 |
| 1 | Flyback diode | 1N4148 | — |
| 1 | USB pigtail or USB-C breakout (5V only) | | $2 |
| 1 | Perfboard + hookup wire | | $3 |
| 1 | Project box / 3D-printed enclosure | | $4 |
| (1) | SPDT center-off toggle (manual override) | | $2 |

Relay class matters: TQ2/G6K are specified for small fast signals; a generic
power relay is not.

## Build routes

**Route A — perfboard first (recommended).** Two breakout boards, 16
pass-through jumpers, relays on perfboard for 13/14/19. Care points:

- Twist the pin 14/19 jumpers together and keep them short — that pair is
  live eARC audio when connected.
- TMDS wiring can be sloppy; it carries nothing. **Label the device "TV↔Sonos
  audio link only"** — it will never pass video and must not be repurposed.
- Bench-test with a continuity meter across all 19 pins in both relay states
  before ever inserting it in the chain.

**Route B — small 2-layer PCB** once Route A proves the concept: two HDMI-A
receptacles on opposite board edges, straight traces, 14/19 as a 100 Ω
differential pair through adjacent relay poles, USB-C for power. ~$10 in
boards from a proto house. KiCad design can be produced on request.

## Risks

- **eARC through closed relay contacts** is the one real unknown: the
  impedance bump can cause negotiation hiccups or dropouts. Mitigations:
  telecom-class relays, short matched leads. **Fallback is graceful:** if eARC
  won't hold, TV and Sonos drop to legacy ARC, which on a Sonos Arc still
  carries Atmos via Dolby Digital Plus — lower bitrate, not silence.
- Relay contact bounce (~1 ms) is far below TV HPD debounce (~100 ms); the TV
  sees a clean unplug/replug.
- Which side faces TV vs Sonos doesn't matter for the switched pins.

## Test plan

1. Bench: continuity all 19 pins, both relay states; no shorts between pins.
2. In-system, relay closed: TV↔Sonos audio works, eARC negotiated (check TV
   sound menu), soak a movie night for dropouts.
3. Relay open: TV offers optical/internal within seconds; Spotify on the Sonos
   uninterrupted throughout.
4. Cycle: close → does eARC renegotiate unattended? This is the make-or-break
   for the return-to-normal path (today a Sonos reboot forces renegotiation;
   here a hot-plug event must do it).
5. A dozen rapid cycles via the Kasa — no stuck states on either device.

## Software impact (after hardware proves out)

- v1: **none required.** Plug semantics are identical.
- Then: `/audio/normal` drops the Sonos-boot wait (`sonosReachable()` poll +
  3s settle) in favor of a short eARC-renegotiation wait — this also retires
  worklist item 5.
- Worklist item 1's trigger softens: the Sonos is never power-cycled into the
  "stopped" state that `sonosEnsureTVInput()` exists to fix. The hijack bug
  should be fixed regardless.
- The Sonos moves to always-on mains (plugged directly into the wall; the
  Kasa now feeds the interrupter's USB adapter).
