# Worklist

Ordered by importance. Line numbers drift — trust the function names.

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` needs verification first

To add an item, copy the template at the bottom. Keep the ordering honest: rank
by *what actually hurts the user*, not by what's easy.

---

## 0. Confirm the power fix on a cold TV `[ ]`

**Not code.** Press power on a TV that has been off overnight. Expect: button
red, one press wakes it.

Everything in `9360f38` rests on one afternoon of testing against a TV that was
being power-cycled constantly. This is the only item that can invalidate the
rest of the list.

- Check first if it misbehaves: `journalctl -u lg-remote | grep -c ECONNRESET`
  (should stay near zero) and `curl -s localhost:3000/tv/status` (should report
  `state` honestly).

---

## 1. `sonosEnsureTVInput` hijacks paused Spotify `[ ]`

**Where:** `server/server.js` — `sonosEnsureTVInput()` (~261), called
unconditionally from `POST /sonos/volume` (~597). Reachable from all four
frontends (`app.js`, `channels-app.js`, `sonos-app.js`, `prototype.html`).

**Problem:** It tests *whether* the Sonos is playing, never *what*:

```js
if (state !== 'PLAYING') { await sonosPlayTV(); await sonosMute(false); }
```

Paused Spotify reports `PAUSED_PLAYBACK`, so nudging Sonos volume switches the
speaker to the TV input and hits Play — killing the session. The `catch` forces
`sonosPlayTV()` on *any* transient error. Actively-playing Spotify reports
`PLAYING` and slips through, which is likely why this has gone unnoticed.

**Why it's #1:** The user runs Spotify Connect constantly and independently of
the TV. This is the only item on the list that hurts them daily. It is also a
mechanism by which *the app itself* asserts CEC and can turn the TV on — the
false lead that cost hours on 2026-07-14.

**Fix:** Compare `CurrentURI` against `x-sonos-htastream:` (the TV input) rather
than testing transport state. Only re-activate if the Sonos is genuinely not on
the TV input. Drop the blind `catch → sonosPlayTV()`; on error, do nothing.

**Verify:** Pause Spotify → `POST /sonos/volume` → Spotify must still be the
loaded source, TV must not wake. Then play TV audio, stop the Sonos, and
confirm the volume path still re-activates ARC (the original reason this
function exists).

---

## 2. `sonosRequest` ignores HTTP status `[ ]`

**Where:** `server/server.js` — `sonosRequest()` (~250). Confirmed: zero
`statusCode` references in the function.

```js
res.on('end', () => resolve(data));   // resolves on 500 + SOAP fault too
```

**Problem:** Every Sonos call inherits this. A SOAP fault returns HTTP 500 with
a fault body and is treated as success, so Sonos failures are invisible.

> **Do #1 first — this ordering is load-bearing.** Making faults reject will
> make `sonosEnsureTVInput`'s `catch → sonosPlayTV()` fire *more often*,
> hijacking Spotify *more*. Fixing this before #1 actively makes things worse.

**Fix:** Reject on `statusCode >= 400`; parse `<faultstring>`/`errorCode` into
the message.

**Risk — the only real one on this list:** this will surface failures silently
swallowed for months. Flows that "work" today may start returning 500s
(correctly). Do it in a session where logs can be watched, not before bed.

**Verify:** Point a call at a bogus action and confirm it rejects; exercise
every audio mode + EQ path afterwards and watch `journalctl -u lg-remote -f`.

---

## 3. Plug-less fallback claims success it cannot deliver `[ ]`

**Where:** `POST /audio/gaming` (~367) and `POST /audio/headphone` (~426):

```js
if (plug) { await plugOff(); }
else { await sonosStop(); await sonosMute(true); }   // cannot free optical
```

**Problem:** Per the core constraint (see `CLAUDE.md`), stopping and muting
leaves the Sonos powered and ARC-negotiated, so the TV still refuses optical and
internal speakers. The endpoint returns `success: true` regardless. Worst case:
silent failure of the app's entire reason for existing — no audio, no
explanation.

Only runs when the Kasa is unreachable, so it may never have executed.

**Fix:** Fail loudly — return an error saying the plug is unreachable and the
audio mode cannot be honoured. Don't pretend.

**Verify:** Point `KASA_IP` at a dead address, call `/audio/headphone`, expect a
clear error rather than `success: true`.

---

## 4. `getPlug()` caches its handle forever `[ ]`

**Where:** `server/server.js` — `getPlug()` (~314): `if (kasaPlug) return
kasaPlug;` — never revalidated.

**Problem:** A stale handle survives the plug changing IP or dropping off the
network. The plug is load-bearing (it is the only way to free the optical
output), so a silently dead handle is worse than an obvious failure.

Low likelihood — `KASA_IP` is pinned in `.env`.

**Fix:** Reset `kasaPlug = null` on any error from a plug operation so the next
call re-resolves.

**Verify:** Hard to test without disturbing the plug. Reasonable to fix by
inspection alongside #3.

---

## 5. `sonosReachable()` is a port-1400 probe + magic 3s sleep `[ ]`

**Where:** `sonosReachable()` (~348), used by `/audio/normal` (~398), followed
by `await new Promise(r => setTimeout(r, 3000))  // Extra settle time`.

**Problem:** Same bug class as the TV power bug — "port open" stands in for
"ready", and the 3s sleep is a band-aid over the gap. **Harmless today**:
measured cold boot is ~22s against a 60s budget.

**Fix (only when touching this code):** Make readiness a real UPnP response, so
the wait is self-terminating and the magic sleep can go.

---

## Open questions — measure before fixing

### 6. Double-increment volume `[?]`
One remote vol-up → LG +1, Sonos +2, intermittent. Hypothesis (from Feb): the
LG emits two CEC commands per press. Proposed fix in
`docs/volume-mode-interactions.md` (#4): route Sonos volume through
`ssap://audio/setVolume` (absolute) instead of Sonos UPnP. **Still a
hypothesis** — reproduce and instrument before changing anything. Worth
revisiting now that `getPowerState` and the CEC picture are understood.

### 7. Audio output value mismatch `[?]`
`changeSoundOutput` docs list `external_optical` / `headphone`, but the TV
returns `tv_external_speaker` from `getSoundOutput`. Headphone mode works via
optical in practice. Needs a measurement, not a fix.

### 8. Roku control unimplemented — **blocked** `[ ]`
`TODO` in `server.js` (~343). ECP queries return 200; keypresses return **403**.
Blocked on a device setting: `Settings → System → Advanced system settings →
Control by mobile apps → Network access` → Default/Permissive.

Verify with:
```
curl -o /dev/null -w '%{http_code}' -X POST http://192.168.1.244:8060/keypress/Home
```
Expect 200. Don't write Roku code before that returns 200 — it cannot be tested.

Once unblocked, the Roku's HDMI-CEC one-touch-play is a wake path immune to WiFi
power-saving, using hardware already owned.

---

## Template

```
## N. Short title `[ ]`

**Where:** file — function (~line)
**Problem:** what's wrong, and what the user actually sees.
**Why this rank:** who it hurts and how often.
**Fix:** the intended change.
**Verify:** how to prove it worked.
**Risk:** what might break.
```
