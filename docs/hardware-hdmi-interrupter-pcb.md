# HDMI Link Interrupter — Route B PCB (KiCad spec)

Status: **spec, not laid out.** Companion to
`hardware-hdmi-link-interrupter.md` (concept, why, test plan). This file is
the input to the KiCad work: netlist, BOM with footprints, placement, routing
rules, and fab notes. Do Route A (perfboard) first; this board is the
clean-up, not the experiment.

## Two corrections to the Route A sketch

Found while specifying the layout; the design doc's circuit section is
updated to match.

1. **Relay pole assignment.** The perfboard sketch put pins 13+19 on K1 and
   pin 14 on K2. Wrong grouping for a PCB: pins 14/19 are a differential pair
   (eARC audio), so they belong on the **two poles of the same relay** with
   matched geometry. K1 = pins 14 & 19. K2 = pin 13 (CEC) + spare pole.
2. **The override toggle can't force-connect on a single supply.** With one
   Kasa-switched USB input, "force CONNECT" is impossible when the Kasa is
   off — there is no power to close the relays. See Power architecture below.

## Board overview

- Inline female-female, replacing the existing coupler: two HDMI-A
  receptacles on opposite board edges, mating axes collinear.
- 2-layer, 1.6 mm FR-4, ~60 × 30 mm, ground pour both sides, stitched.
- No microcontroller, no firmware. Relays driven directly from 5 V.
- 2× M3 mounting holes for the enclosure.

```
   TV side                                          Sonos side
  ┌─────────────────────────────────────────────────────────┐
  │ [J1 HDMI-A]  ═══ 16 straight-through lines ═══ [J2 HDMI-A]
  │     14,19 ──diff pair── K1 poles A,B ──diff pair── 14,19 │
  │     13 ───────────────── K2 pole A ──────────────── 13   │
  │                                                          │
  │  [J3 USB-C]  [K1 TQ2]  [K2 TQ2]  D1  SW1  LED  (J4 opt) │
  └─────────────────────────────────────────────────────────┘
```

Place K1 mid-board directly in the 14/19 path so both stubs stay short;
K2/CEC placement is uncritical (CEC is a ~kHz open-drain bus).

## Netlist

Pass-through (J1.n ↔ J2.n, no components): pins 1–12 (TMDS + shields — tie
shield pins 2/5/8/11 and pin 17 to the ground pour), 15, 16 (DDC), 17 (GND),
18 (+5V presence).

Switched (all contacts **normally open** — energized = connected):

| Net | Path |
|---|---|
| HEAC_P | J1.14 → K1 pole A (COM→NO) → J2.14 |
| HEAC_N | J1.19 → K1 pole B (COM→NO) → J2.19 |
| CEC | J1.13 → K2 pole A (COM→NO) → J2.13 |

Power:

| Net | Path |
|---|---|
| +5V | J3 VBUS → SW1 → K1 coil ‖ K2 coil → GND |
| — | D1 (1N4148WS) across the paralleled coils, cathode to +5V |
| — | J3 CC1, CC2: each 5.1 kΩ to GND (proper USB-C sink) |
| — | LED + 1 kΩ from switched 5 V to GND (link-closed indicator) |
| — | J3 shell/shield → GND |

Both HDMI receptacle shells → GND pour.

## Power architecture — pick before layout

**Option 1 — single input (recommended v1, matches system semantics).**
J3 is the Kasa-switched USB supply. SW1 is a plain SPST in the coil path:
closed = AUTO (relay follows Kasa), open = force DISCONNECT. There is no
force-CONNECT — with the Kasa off the board is dark. Acceptable because the
manual fallback is simply unplugging one HDMI cable from the board, exactly
as with the coupler today.

**Option 2 — always-on power + sense input (full manual override).**
J3 becomes an always-on wall wart; a second jack J4 receives the
Kasa-switched 5 V purely as a *signal*, driving the coils through a logic
P-MOSFET (or optocoupler). SW1 becomes SPDT center-off: CONNECT / AUTO /
DISCONNECT. Costs a second wall wart and three parts.

Lay out the board for Option 2 with J4, Q1, and the SPDT footprint marked
**DNP**, and populate Option 1. Full override becomes a soldering job, not a
respin.

Considered and rejected: latching relays would eliminate the ~280 mW
continuous coil draw during normal mode, but need pulse drive (an MCU or
one-shot circuit). TQ2-class relays are rated for continuous energization;
not worth the complexity.

## BOM with footprints

| Ref | Part | Package / footprint | Notes |
|---|---|---|---|
| J1, J2 | HDMI-A receptacle, 19P | prefer staggered through-hole pins (the type on cheap breakout boards) for hand soldering; SMD 0.5 mm pitch acceptable | **Verify the KiCad footprint against the exact part purchased before ordering boards** — HDMI receptacle mechanicals vary by vendor |
| K1, K2 | Panasonic TQ2-5V (TH) or TQ2SA-5V (SMD); Omron G6K-2F-Y 5VDC equivalent | vendor footprint | telecom/signal class is mandatory; a power relay is not a substitute |
| J3 | USB-C receptacle, 16-pin power-only (e.g., GCT USB4105) | SMD + TH shell tabs | 5 V only; D+/D− unconnected |
| D1 | 1N4148WS | SOD-323 | flyback |
| R1, R2 | 5.1 kΩ | 0603 | CC pulldowns |
| R3 | 1 kΩ | 0603 | LED |
| LED1 | any 0603/TH | | link-closed indicator |
| SW1 | SPST slide (Opt 1) / SPDT on-off-on (Opt 2) | TH | |
| J4, Q1, R4 | second USB jack, P-MOSFET (e.g., AO3401-class), 100 kΩ gate pull | | **DNP** — Option 2 provision |

## Routing rules

- **HEAC pair (J1.14/19 → K1 → J2.14/19):** route as a coupled pair on the
  top layer over unbroken ground. ~0.25 mm width / 0.2 mm gap lands near
  100 Ω differential on 1.6 mm 2-layer FR-4 — confirm with the KiCad
  calculator for the fab's actual stackup. Length-match within 2 mm.
  Honest engineering note: at eARC rates (~100 Mbps) over <60 mm, loose
  impedance is survivable — the rule is cheap insurance, not a cliff. What
  matters most is keeping the K1 contact stubs minimal: COM and NO pads
  directly in the path, no branches.
- All other pass-throughs: straight point-to-point, ≥0.2 mm, any layer.
- CEC: anywhere, any width.
- No ESD arrays on the switched lines: they'd add capacitance to the HEAC
  pair, and the device is permanently installed with near-zero handling.
  (Reconsider if boards will be handled often.)
- Net classes in KiCad: `HEAC_DIFF` (pair rules above), `Default` for the
  rest. DRC: 0.15 mm min clearance.

## Fab & assembly

- Any proto house 2-layer service (JLCPCB-class): 1.6 mm, 1 oz, HASL is fine
  (the mating contacts live in the connectors, not the board). Do not pay for
  impedance control; the geometry rule above is sufficient at this length.
- Hand assembly order: passives → D1 → relays → USB-C → HDMI receptacles
  (0.5 mm pitch: flux + drag solder, check for bridges under magnification).

## Bring-up

1. Before connectors carry signal: verify 5 V present, relays audibly click
   with supply applied/removed, LED tracks.
2. Continuity: all 19 pins J1↔J2 with coils energized; pins 13/14/19 **open**
   (>10 MΩ) de-energized; all others still through.
3. No shorts between any adjacent pins, both states.
4. Then run the in-system test plan in `hardware-hdmi-link-interrupter.md`
   (§ Test plan) — eARC soak, unattended renegotiation, rapid cycling.

## Open items

- [ ] Exact HDMI receptacle part chosen and footprint verified (blocks layout)
- [ ] Option 1 vs 2 confirmed (affects J3/J4 area only)
- [ ] Enclosure: printed vs project box (drives mounting-hole positions)
