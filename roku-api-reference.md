# Roku Ultra ECP API Reference

Device: Roku Ultra at `192.168.1.244`
Protocol: HTTP REST, port 8060, no authentication
Docs: https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md

## Query Endpoints (GET)

| Endpoint | Returns | Description |
|---|---|---|
| `/query/device-info` | XML | Model, serial, software version, WiFi signal, power mode |
| `/query/active-app` | XML | Currently running app name and ID |
| `/query/apps` | XML | All installed channels with IDs and versions |
| `/query/icon/{appID}` | PNG | App icon image |
| `/query/media-player` | XML | Playback state, position, duration, codec, bitrate, resolution |
| `/query/tv-channels` | XML | Available TV channels (Roku TV only) |
| `/query/tv-active-channel` | XML | Current channel (Roku TV only) |

## App Launch (POST)

| Endpoint | Parameters | Description |
|---|---|---|
| `/launch/{appID}` | Optional: contentID, mediaType | Launch an app |
| `/install/{appID}` | — | Open Channel Store page for app |

### Common App IDs

| App | ID |
|---|---|
| Netflix | 12 |
| YouTube | 837 |
| Disney+ | 291097 |
| Hulu | 2285 |
| Amazon Prime Video | 13 |
| Plex | 13535 |
| Apple TV+ | 551012 |
| Roku Media Player | 2213 |

Get all IDs from `/query/apps`.

## Keypress Commands (POST)

Send: `POST /keypress/{key}`
Also: `/keydown/{key}` and `/keyup/{key}` for press-and-hold.

### Navigation

| Key | Description |
|---|---|
| `Home` | Home screen |
| `Select` | OK / confirm |
| `Left` | Left |
| `Right` | Right |
| `Up` | Up |
| `Down` | Down |
| `Back` | Back |
| `Info` | Options / star button |

### Playback

| Key | Description |
|---|---|
| `Play` | Play/pause toggle |
| `Rev` | Rewind |
| `Fwd` | Fast forward |
| `InstantReplay` | Instant replay |

### Volume & Power

| Key | Description |
|---|---|
| `VolumeUp` | Volume up (via CEC to TV) |
| `VolumeDown` | Volume down (via CEC to TV) |
| `VolumeMute` | Mute toggle |
| `PowerOff` | Power off |
| `PowerOn` | Power on |

### Utility

| Key | Description |
|---|---|
| `Search` | Open search |
| `FindRemote` | Beep the physical remote |
| `Backspace` | Delete character |
| `Enter` | Submit text |

### Text Entry

Send individual characters: `POST /keypress/Lit_{character}`

Example: To type "Hello"
```
POST /keypress/Lit_H
POST /keypress/Lit_e
POST /keypress/Lit_l
POST /keypress/Lit_l
POST /keypress/Lit_o
```

URL-encode special characters (space = `%20`, etc.)

## Search (POST /search/browse)

| Parameter | Required | Description |
|---|---|---|
| `keyword` | Yes | Search term |
| `title` | No | Exact title match |
| `type` | No | movie, tv-show, person, channel, game |
| `season` | No | Season number |
| `launch` | No | Auto-launch if found |
| `provider-id` | No | Preferred channel IDs (comma-separated) |

## Input (POST /input)

Send arbitrary key-value pairs to the active app:
```
POST /input?param1=value1&param2=value2
```

## Media Player States

From `/query/media-player`:
- `close` — No media loaded
- `play` — Playing
- `pause` — Paused
- `buffer` — Buffering

Response includes: position (ms), duration (ms), audio format, video format, resolution, bitrate.
