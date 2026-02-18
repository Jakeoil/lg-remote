# TP-Link Kasa EP10 Local API Reference

Device: Kasa Smart Plug EP10 at `192.168.1.246`
Protocol: TCP port 9999, XOR-encrypted JSON (key: 171), no authentication
npm package: `tplink-smarthome-api`

All commands are JSON payloads sent over TCP. The `tplink-smarthome-api` npm package handles encryption automatically.

## System Commands

| Command | Description |
|---|---|
| `{"system":{"get_sysinfo":null}}` | Device info, power state, uptime |
| `{"system":{"set_relay_state":{"state":1}}}` | Turn on |
| `{"system":{"set_relay_state":{"state":0}}}` | Turn off |
| `{"system":{"set_led_off":{"off":1}}}` | Turn off status LED |
| `{"system":{"set_led_off":{"off":0}}}` | Turn on status LED |
| `{"system":{"set_dev_alias":{"alias":"Sonos Plug"}}}` | Rename device |
| `{"system":{"reboot":{"delay":1}}}` | Reboot (delay in seconds) |
| `{"system":{"reset":{"delay":1}}}` | Factory reset (destructive!) |

### get_sysinfo Response Fields

| Field | Description |
|---|---|
| `relay_state` | 0 = off, 1 = on |
| `on_time` | Seconds the plug has been on (current session) |
| `alias` | Device name |
| `rssi` | WiFi signal strength (dBm) |
| `sw_ver` | Firmware version |
| `hw_ver` | Hardware version |
| `mac` | MAC address |
| `model` | Device model (EP10) |
| `led_off` | 0 = LED on, 1 = LED off |

## Schedule Commands

| Command | Description |
|---|---|
| `{"schedule":{"get_rules":null}}` | List all schedule rules |
| `{"schedule":{"add_rule":{...}}}` | Create scheduled on/off |
| `{"schedule":{"edit_rule":{...}}}` | Modify a rule |
| `{"schedule":{"delete_rule":{"id":"..."}}}` | Delete a rule |
| `{"schedule":{"delete_all_rules":null}}` | Clear all schedules |
| `{"schedule":{"get_next_action":null}}` | Get next scheduled event |

### Schedule Rule Format

```json
{
  "schedule": {
    "add_rule": {
      "stime_opt": 0,
      "wday": [1, 0, 0, 1, 1, 0, 0],
      "smin": 480,
      "enable": 1,
      "repeat": 1,
      "sact": 1,
      "name": "morning on"
    }
  }
}
```

| Field | Description |
|---|---|
| `smin` | Minutes from midnight (480 = 8:00 AM) |
| `wday` | Array for Sun through Sat (1 = active) |
| `sact` | 1 = turn on, 0 = turn off |
| `stime_opt` | 0 = specific time, 1 = sunset, 2 = sunrise |
| `repeat` | 1 = recurring, 0 = one-time |
| `enable` | 1 = enabled, 0 = disabled |

## Countdown Timer

| Command | Description |
|---|---|
| `{"count_down":{"get_rules":null}}` | Get active countdown timers |
| `{"count_down":{"add_rule":{...}}}` | Start a countdown |
| `{"count_down":{"delete_all_rules":null}}` | Cancel all timers |

### Countdown Rule Format

```json
{
  "count_down": {
    "add_rule": {
      "enable": 1,
      "delay": 1800,
      "act": 1,
      "name": "turn on in 30 min"
    }
  }
}
```

| Field | Description |
|---|---|
| `delay` | Seconds until action |
| `act` | 1 = turn on, 0 = turn off |
| `enable` | 1 = enabled |

## Anti-Theft / Away Mode

| Command | Description |
|---|---|
| `{"anti_theft":{"get_rules":null}}` | List away-mode rules |
| `{"anti_theft":{"add_rule":{...}}}` | Simulate occupancy (random on/off) |
| `{"anti_theft":{"delete_all_rules":null}}` | Disable away mode |

## Time

| Command | Description |
|---|---|
| `{"time":{"get_time":null}}` | Device's current time |
| `{"time":{"get_timezone":null}}` | Timezone setting |

## Cloud Info (read-only)

| Command | Description |
|---|---|
| `{"cnCloud":{"get_info":null}}` | Cloud connection status |

## Notes

- **No energy monitoring** on EP10. The `emeter` commands only work on HS110, KP115, KP125, EP25.
- LED state is inverted: `led_off: 1` means LED is off.
- Booleans are 0/1 integers, not true/false.
- The npm package `tplink-smarthome-api` wraps all of these with a cleaner JS API.
