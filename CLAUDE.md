# lg-remote

Web remote for an LG OLED (webOS) + Sonos Arc + Kasa plug + Roku, served from a
Raspberry Pi. Express proxy in `server/server.js` (~35 endpoints) serves the
static frontend from the repo root.

## Why this app exists

The LG **will not allow internal speakers or the optical port (headphones)
while the Sonos is powered on** — ARC/CEC holds the audio output. A Sonos has
no power-off of its own. So the Kasa plug ("sonos power") physically cuts Sonos
mains, and that is the *only* way to free the TV's internal/optical outputs.
The user's primary listening is headphones via optical.

`plugOff()` is therefore load-bearing, not an optimisation. Do not "simplify"
it into `sonosStop()`/`sonosMute()` — those leave the Sonos powered and
ARC-negotiated, so the TV still refuses optical.

The lockout is an eARC-era behavior, not blanket LG/ARC: the previous
plain-ARC soundbar coexisted with manual output override on this same TV.
The Sonos Arc arrived ~2026-01; this app followed within weeks.

The user also runs **Spotify Connect on the Sonos constantly, independently of
the TV**. Anything that cuts Sonos power or hijacks its input on a TV action
will kill their music. This rules out "cut the plug when the TV turns off".

## Running

Runs as a systemd unit, not by hand:

```
sudo systemctl restart lg-remote      # NOT `node server.js`
journalctl -u lg-remote -f
```

Panel: http://192.168.1.239:3000 · Devices: TV .238, Roku .244, Sonos .245,
Kasa .246. `.env` holds IPs + `TV_MAC`; discovery (mDNS/SSDP/ARP) fills gaps at
startup, and `.env` wins.

## The core trap: proxy state

Several bugs here share one shape — **inferring state from a proxy instead of
asking the authoritative source.** Look for it before adding new checks.

**TV power.** The LG has three states and two of them are "off":

| `getPowerState`  | Screen | webOS / SSAP         | port 3001 |
|------------------|--------|----------------------|-----------|
| `Active`         | ON     | serving              | open      |
| `Active Standby` | OFF    | **serving normally** | open      |
| `Suspend`        | OFF    | down (ECONNRESET)    | open      |

A TV that is *off* sits in `Active Standby` answering SSAP on a live socket for
minutes (measured: `getPowerState` for 96s+, `getSoundOutput` in 42ms), then
decays to `Suspend`. So none of these mean "on": an open port 3001, a completed
TLS handshake, a live socket, `tvConnected`, or `/status` succeeding.

Read power **only** from `tvPowerState()`
(`ssap://com.webos.service.tvpower/power/getPowerState`). This caused the
long-standing "can't turn the TV on" bug: the client inferred power from
`/status` succeeding, so the button went green on a dead TV and pressing it
sent `turnOff` instead of waking. Fixed in `9360f38`; an earlier attempt
(`1d2be79`) used handshake-success and was wrong the same way.

Wake-on-LAN **works** over WiFi (~7s warm, ~40s from cold standby). An IR
blaster is not needed.

**Don't re-investigate CEC.** The Sonos and Roku do *not* wake the TV. Tested
three ways (Sonos off-bus / idle / actively streaming ARC) — the TV stayed off
every time. An apparent self-wake was `Active Standby` being misread.

## Known issues

**`docs/worklist.md` is the single source of truth** — ranked, with fix
sketches, verification steps and risk. Read it before picking up work; add new
issues there rather than here.

Headline: the top item is that `sonosEnsureTVInput` hijacks **paused** Spotify
onto the TV input (and asserts CEC) on any `POST /sonos/volume`. Note the
ordering constraint recorded there — fixing `sonosRequest`'s ignored HTTP
status *before* that one makes the hijack fire more often, not less.

## Conventions

- Audio modes switch the **TV output first**, then touch the Sonos — so an off
  TV fails before the Sonos is disturbed. Keep that order.
- SSE (`/volume/events`) streams LG volume; Sonos volume is polled behind an
  in-flight guard.
- `docs/` has flow diagrams (`volume-mode-interactions.md`,
  `flow-tv-discovery-and-power-on.md`) and per-device API references.
- Roku control is unimplemented (`TODO` in `server.js`). ECP queries return 200
  but **keypresses return 403** — needs `Settings → System → Advanced system
  settings → Control by mobile apps → Network access` set to Default/Permissive
  on the device. Don't write Roku code blind; it can't be verified until then.
