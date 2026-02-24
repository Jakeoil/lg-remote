# Sonos Arc Ultra Local API Reference

Device: Sonos Arc Ultra (S45) at `192.168.1.245`
Protocol: UPnP/SOAP over HTTP, port 1400, no authentication
RINCON ID: `RINCON_74CA606BC09101400`

All requests are `POST` with `Content-Type: text/xml; charset="utf-8"` and a `SOAPAction` header.

## AVTransport (Playback)

Endpoint: `/MediaRenderer/AVTransport/Control`
SOAPAction: `"urn:schemas-upnp-org:service:AVTransport:1#<Action>"`

| Action | Parameters | Description |
|---|---|---|
| `Play` | `<Speed>1</Speed>` | Resume playback |
| `Pause` | — | Pause |
| `Stop` | — | Stop (enters low-power idle) |
| `Next` | — | Skip to next track |
| `Previous` | — | Skip to previous track |
| `Seek` | `<Unit>REL_TIME</Unit><Target>0:02:30</Target>` | Seek to position |
| `SetAVTransportURI` | `<CurrentURI>...</CurrentURI>` | Set playback source |
| `SetNextAVTransportURI` | `<NextURI>...</NextURI>` | Queue next track (gapless) |
| `GetTransportInfo` | — | Returns: PLAYING, PAUSED_PLAYBACK, STOPPED, TRANSITIONING |
| `GetPositionInfo` | — | Returns: track title, artist, album, album art URI, position, duration |
| `GetMediaInfo` | — | Returns: current URI, metadata, track count |
| `SetPlayMode` | `<NewPlayMode>SHUFFLE</NewPlayMode>` | Modes: NORMAL, REPEAT_ALL, REPEAT_ONE, SHUFFLE, SHUFFLE_NOREPEAT |
| `GetCrossfadeMode` | — | Returns crossfade state |
| `SetCrossfadeMode` | `<CrossfadeMode>1</CrossfadeMode>` | Enable/disable crossfade |
| `ConfigureSleepTimer` | `<NewSleepTimerDuration>01:00:00</NewSleepTimerDuration>` | Set sleep timer (empty to cancel) |
| `GetRemainingSleepTimerDuration` | — | Time remaining on sleep timer |
| `AddURIToQueue` | `<EnqueuedURI>...</EnqueuedURI>` | Add track to queue |
| `RemoveAllTracksFromQueue` | — | Clear the queue |
| `SaveQueue` | `<Title>My Playlist</Title>` | Save queue as Sonos playlist |
| `BecomeCoordinatorOfStandaloneGroup` | — | Leave group, go standalone |
| `DelegateGroupCoordinationTo` | `<NewCoordinator>RINCON_...</NewCoordinator>` | Transfer group coordinator |

All actions require `<InstanceID>0</InstanceID>`.

TV input URI: `x-sonos-htastream:RINCON_74CA606BC09101400:spdif`

## RenderingControl (Volume, EQ, Audio Settings)

Endpoint: `/MediaRenderer/RenderingControl/Control`
SOAPAction: `"urn:schemas-upnp-org:service:RenderingControl:1#<Action>"`

### Volume & Mute

| Action | Parameters | Description |
|---|---|---|
| `GetVolume` | `<Channel>Master</Channel>` | Get volume (0-100) |
| `SetVolume` | `<Channel>Master</Channel><DesiredVolume>50</DesiredVolume>` | Set volume |
| `RampToVolume` | `<Channel>Master</Channel><RampType>SLEEP_TIMER_RAMP_TYPE</RampType><DesiredVolume>20</DesiredVolume>` | Gradual volume change |
| `GetMute` | `<Channel>Master</Channel>` | Get mute state |
| `SetMute` | `<Channel>Master</Channel><DesiredMute>1</DesiredMute>` | Mute (1) / unmute (0) |

### EQ Controls

All use `SetEQ` / `GetEQ` with `<EQType>` and `<DesiredValue>`.

| EQType | Range | Description |
|---|---|---|
| `NightMode` | 0 / 1 | Night mode (compressed dynamics) |
| `SpeechEnhanceEnabled` | 0 / 1 | Speech enhancement on/off (Arc Ultra) |
| `DialogLevel` | 1–4 | Speech enhancement intensity: 1=Low, 2=Medium, 3=High, 4=Max (Arc Ultra). Does not return 0 when disabled — use `SpeechEnhanceEnabled` to toggle. On older devices (Arc, Beam) this is 0/1 boolean. |
| `SubGain` | -10 to +10 | Subwoofer level |
| `SurroundEnable` | 0 / 1 | Surround sound on/off |
| `SurroundLevel` | -15 to +15 | Surround speaker level |
| `SurroundMode` | 0 / 1 | 0=Ambient, 1=Full (Arc Ultra) |
| `MusicSurroundLevel` | -15 to +15 | Music surround level |
| `HeightChannelLevel` | -10 to +10 | Atmos height channel level |

Not all EQ types are available on every speaker model.

### Bass & Treble

| Action | Parameters | Description |
|---|---|---|
| `GetBass` | — | Get bass level (-10 to +10) |
| `SetBass` | `<DesiredBass>5</DesiredBass>` | Set bass |
| `GetTreble` | — | Get treble level (-10 to +10) |
| `SetTreble` | `<DesiredTreble>3</DesiredTreble>` | Set treble |
| `GetLoudness` | `<Channel>Master</Channel>` | Get loudness state |
| `SetLoudness` | `<Channel>Master</Channel><DesiredLoudness>1</DesiredLoudness>` | Enable/disable loudness |
| `ResetBasicEQ` | — | Reset bass/treble/loudness to defaults |

All actions require `<InstanceID>0</InstanceID>`.

## GroupRenderingControl (Group Volume)

Endpoint: `/MediaRenderer/GroupRenderingControl/Control`
SOAPAction: `"urn:schemas-upnp-org:service:GroupRenderingControl:1#<Action>"`

| Action | Description |
|---|---|
| `GetGroupVolume` | Volume of entire group |
| `SetGroupVolume` | Set volume for all grouped speakers |
| `GetGroupMute` / `SetGroupMute` | Mute/unmute entire group |
| `SetRelativeGroupVolume` | Increment/decrement group volume |
| `SnapshotGroupVolume` | Capture volume ratios before adjusting |

## DeviceProperties

Endpoint: `/DeviceProperties/Control`
SOAPAction: `"urn:schemas-upnp-org:service:DeviceProperties:1#<Action>"`

| Action | Parameters | Description |
|---|---|---|
| `GetLEDState` | — | Returns LED on/off |
| `SetLEDState` | `<DesiredLEDState>On</DesiredLEDState>` | On or Off |
| `GetButtonLockState` | — | Physical button lock state |
| `SetButtonLockState` | `<DesiredButtonLockState>On</DesiredButtonLockState>` | Child lock |
| `GetZoneInfo` | — | Serial, software version, IP, MAC |
| `GetZoneAttributes` | — | Room name, icon |
| `SetZoneAttributes` | `<DesiredZoneName>Living Room</DesiredZoneName>` | Rename room |

## AlarmClock

Endpoint: `/AlarmClock/Control`
SOAPAction: `"urn:schemas-upnp-org:service:AlarmClock:1#<Action>"`

| Action | Description |
|---|---|
| `ListAlarms` | Get all alarms as XML |
| `CreateAlarm` | Set alarm (time, days, source, volume, duration) |
| `UpdateAlarm` | Modify existing alarm |
| `DestroyAlarm` | Delete alarm by ID |
| `GetTimeNow` | Speaker's current time |

## ZoneGroupTopology

Endpoint: `/ZoneGroupTopology/Control`
SOAPAction: `"urn:schemas-upnp-org:service:ZoneGroupTopology:1#<Action>"`

| Action | Description |
|---|---|
| `GetZoneGroupState` | XML of all groups and members in household |
| `CheckForUpdate` | Check for firmware updates |

## ContentDirectory (Music Library / Favorites)

Endpoint: `/MediaServer/ContentDirectory/Control`
SOAPAction: `"urn:schemas-upnp-org:service:ContentDirectory:1#Browse"`

Browse IDs:
- `FV:2` — Sonos Favorites
- `R:0/0` — Radio stations
- `SQ:` — Sonos playlists
- `Q:0` — Current queue
- `A:` — Music library
