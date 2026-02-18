# LG webOS SSAP API Reference

All endpoints use the `ssap://` prefix over WebSocket (wss on port 3001 for webOS 25).

## Audio

| Endpoint | Payload | Description |
|---|---|---|
| `audio/getVolume` | — | Get volume level and mute state (subscribable) |
| `audio/getStatus` | — | Get full audio status |
| `audio/setVolume` | `{volume: 15}` | Set volume (0-100) |
| `audio/volumeUp` | — | Volume up |
| `audio/volumeDown` | — | Volume down |
| `audio/setMute` | `{mute: true}` | Mute/unmute |
| `audio/getSoundOutput` | — | Get current sound output device |
| `audio/changeSoundOutput` | `{output: "tv_speaker"}` | Switch output: `tv_speaker`, `external_arc`, `external_optical`, `bt_soundbar`, `headphone` |

## Picture Settings

Read with `settings/getSystemSettings`, write with `settings/setSystemSettings`.
Category: `picture`

| Key | Values |
|---|---|
| `pictureMode` | vivid, standard, eco, cinema, filmmaker, game, expert |
| `brightness` | 0-100 |
| `contrast` | 0-100 |
| `backlight` | 0-100 |
| `oledLight` | 0-100 |
| `color` | 0-100 |
| `sharpness` | 0-50 |
| `tint` | R50-G50 |
| `colorTemperature` | 0-50 |
| `dynamicContrast` | off, low, medium, high |
| `dynamicToneMapping` | on, off |
| `truMotionMode` | off, smooth, clear, cinemaSmooth, user |
| `realCinema` | on, off |
| `noiseReduction` | off, low, medium, high, auto |
| `gamma` | low, medium, high1, high2 |
| `blackLevel` | low, high, auto |
| `peakBrightness` | off, low, medium, high |

Example read:
```js
tvRequest('ssap://settings/getSystemSettings', {category: 'picture', keys: ['pictureMode', 'brightness']})
```

Example write:
```js
tvRequest('ssap://settings/setSystemSettings', {category: 'picture', settings: {pictureMode: 'game'}})
```

## Inputs

| Endpoint | Payload | Description |
|---|---|---|
| `tv/getExternalInputList` | — | List all HDMI/external inputs with labels and connected state |
| `tv/switchInput` | `{inputId: "HDMI_1"}` | Switch to an input |

## Apps

| Endpoint | Payload | Description |
|---|---|---|
| `com.webos.applicationManager/listLaunchPoints` | — | List installed apps (id, title, icon) |
| `com.webos.applicationManager/getForegroundAppInfo` | — | Get currently active app (subscribable) |
| `system.launcher/launch` | `{id: "netflix"}` | Launch an app |
| `system.launcher/close` | `{id: "com.webos.app.browser"}` | Close an app |

Common app IDs: `com.webos.app.hdmi1` - `hdmi4`, `com.webos.app.livetv`, `netflix`, `youtube.leanback.v4`, `amazon`, `com.webos.app.browser`, `com.webos.app.settings`

## Power / System

| Endpoint | Payload | Description |
|---|---|---|
| `system/turnOff` | — | Power off |
| `com.webos.service.tvpower/power/turnOffScreen` | — | Screen off (pixels off, TV stays on) |
| `com.webos.service.tvpower/power/turnOnScreen` | — | Screen back on |
| `com.webos.service.tvpower/power/getPowerState` | — | Get power state (subscribable) |
| `system/getSystemInfo` | — | Model, serial, firmware |
| `com.webos.service.update/getCurrentSWInformation` | — | Firmware version |

## Media Controls

| Endpoint | Description |
|---|---|
| `media.controls/play` | Play/resume |
| `media.controls/pause` | Pause |
| `media.controls/stop` | Stop |
| `media.controls/rewind` | Rewind |
| `media.controls/fastForward` | Fast forward |

## Channels

| Endpoint | Payload | Description |
|---|---|---|
| `tv/getChannelList` | — | List all channels |
| `tv/getCurrentChannel` | — | Current channel (subscribable) |
| `tv/openChannel` | `{channelId: "3-1"}` | Tune to channel |
| `tv/channelUp` | — | Channel up |
| `tv/channelDown` | — | Channel down |

## Notifications

| Endpoint | Payload | Description |
|---|---|---|
| `system.notifications/createToast` | `{message: "Hello"}` | Show toast on screen |
| `system.notifications/createAlert` | `{title, message, buttons}` | Show alert dialog |

## Remote Button Input

Get the input socket, then send button commands over a secondary WebSocket:

```js
tvRequest('ssap://com.webos.service.networkinput/getPointerInputSocket')
// Returns {socketPath: "wss://..."}
// Send: "type:button\nname:HOME\n\n"
```

**Navigation**: HOME, BACK, EXIT, UP, DOWN, LEFT, RIGHT, ENTER, MENU, QMENU, INFO
**Media**: PLAY, PAUSE, STOP, REWIND, FASTFORWARD
**Volume**: VOLUMEUP, VOLUMEDOWN, MUTE, CHANNELUP, CHANNELDOWN
**Color**: RED, GREEN, YELLOW, BLUE
**Numbers**: 0-9, DASH

## Sound Settings

Category: `sound`

| Key | Description |
|---|---|
| `soundMode` | Sound mode preset |
| `soundOutput` | Current output device |
| `avSync` | AV sync adjustment |
| `eArcSupport` | eARC enabled/disabled |
| `balance` | Left/right balance |

## Other Settings Categories

- `option`: menuLanguage, quickStartMode, magicRemoteEnable
- `caption`: captionEnable, captionFont, captionSize, captionColor
- `aiPicture`: ai_Brightness, ai_Genre, ai_Picture
