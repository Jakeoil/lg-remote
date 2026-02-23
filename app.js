// LG TV Remote - Frontend Application

// Key to persist server URL in localStorage
const STORAGE_KEY = 'lg-remote-server-url';

// DOM elements
const serverInput = document.getElementById('server-url');
const connectBtn = document.getElementById('connect-btn');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const gamingBtn = document.getElementById('gaming-btn');
const normalBtn = document.getElementById('normal-btn');
const headphoneBtn = document.getElementById('headphone-btn');
const plugDot = document.getElementById('plug-dot');
const plugState = document.getElementById('plug-state');
const sonosDot = document.getElementById('sonos-dot');
const sonosState = document.getElementById('sonos-state');

const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', (e) => onSliderInput(e.target.value));

// Unified volume state: 'lg' or 'sonos'
let activeVolume = 'lg';

const LG_ICON_SVG = '<svg class="brand-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.522 14.078h3.27v1.33h-4.847v-6.83h1.577v5.5zm6.74-1.274h1.284v1.195c-.236.09-.698.18-1.137.18-1.42 0-1.893-.721-1.893-2.186 0-1.398.45-2.221 1.869-2.221.791 0 1.24.248 1.612.722l.982-.903c-.6-.855-1.646-1.114-2.629-1.114-2.208 0-3.368 1.205-3.368 3.504 0 2.288 1.047 3.528 3.358 3.528 1.06 0 2.096-.27 2.66-.665V11.53h-2.739v1.274zM5.291 6.709a5.29 5.29 0 1 1 0 10.582 5.291 5.291 0 1 1 0-10.582m3.16 8.457a4.445 4.445 0 0 0 1.31-3.161v-.242l-.22.001H6.596v.494h2.662l-.001.015a3.985 3.985 0 0 1-3.965 3.708 3.95 3.95 0 0 1-2.811-1.165 3.952 3.952 0 0 1-1.164-2.811c0-1.061.414-2.059 1.164-2.81a3.951 3.951 0 0 1 2.81-1.164l.252.003v-.495l-.251-.003a4.475 4.475 0 0 0-4.47 4.469c0 1.194.465 2.316 1.309 3.161a4.444 4.444 0 0 0 3.16 1.31 4.444 4.444 0 0 0 3.162-1.31m-2.91-1.297V9.644H5.04v4.72h1.556v-.495H5.543zm-1.265-3.552a.676.676 0 1 0-.675.674.676.676 0 0 0 .675-.674"/></svg>';

const SONOS_ICON_SVG = '<svg class="brand-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.988 12.36l-2.813-2.634v4.429h.837V11.7l2.813 2.633V9.905h-.837zM6.464 9.665A2.3 2.3 0 0 0 4.13 12c0 1.257 1.077 2.334 2.334 2.334A2.3 2.3 0 0 0 8.798 12a2.3 2.3 0 0 0-2.334-2.334m0 3.83A1.482 1.482 0 0 1 4.968 12c0-.838.658-1.496 1.496-1.496S7.96 11.162 7.96 12s-.658 1.496-1.496 1.496M2.694 12c-.24-.18-.54-.3-.958-.419-.838-.24-.838-.479-.838-.598 0-.24.299-.48.718-.48.36 0 .658.18.778.24l.06.06.658-.479-.06-.06s-.538-.598-1.436-.598c-.419 0-.838.12-1.137.359-.3.24-.479.598-.479.958s.18.718.479.957c.24.18.538.3.957.42.838.239.838.478.838.598 0 .239-.299.478-.718.478-.359 0-.658-.18-.778-.239l-.06-.06-.658.479.06.06s.538.598 1.436.598c.42 0 .838-.12 1.137-.359.3-.24.48-.598.48-.957 0-.36-.18-.659-.48-.958m14.843-2.334A2.3 2.3 0 0 0 15.202 12a2.337 2.337 0 0 0 2.334 2.334A2.3 2.3 0 0 0 19.87 12a2.337 2.337 0 0 0-2.334-2.334m0 3.83A1.482 1.482 0 0 1 16.04 12c0-.838.658-1.496 1.496-1.496s1.496.658 1.496 1.496-.718 1.496-1.496 1.496m3.77-1.556c.24.18.54.3.958.42.838.239.838.478.838.598 0 .239-.299.478-.718.478-.36 0-.658-.18-.778-.239h-.06l-.658.479.06.06s.538.598 1.436.598c.419 0 .838-.12 1.137-.359s.479-.598.479-.958-.18-.718-.479-.957c-.24-.18-.538-.3-.957-.42-.838-.239-.838-.478-.838-.598 0-.239.299-.478.718-.478.359 0 .658.18.778.239l.06.06.658-.479-.06-.06s-.538-.598-1.436-.598c-.42 0-.838.12-1.137.359-.3.24-.48.598-.48.957-.059.36.12.659.48.898"/></svg>';

// Load saved server URL on page load
serverInput.value = localStorage.getItem(STORAGE_KEY) || '';

// Connect button handler - saves URL and fetches status
connectBtn.addEventListener('click', () => {
  const url = serverInput.value.trim().replace(/\/+$/, ''); // strip trailing slash
  if (!url) return;
  localStorage.setItem(STORAGE_KEY, url);
  fetchStatus();
  startPolling();
  subscribeVolume();
});

// Get the saved proxy server base URL
function getBaseUrl() {
  return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/+$/, '');
}

// Send a command to the proxy server
async function sendCommand(path) {
  const base = getBaseUrl();
  if (!base) {
    showStatus('Set server URL first', 'error');
    return;
  }
  try {
    const res = await fetch(`${base}${path}`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // After a successful command, refresh the status display
    fetchStatus();
    return data;
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  }
}

// Switch audio mode (gaming = TV speakers, normal = HDMI ARC, headphone = optical)
const modeLabels = { gaming: 'TV Speakers', normal: 'Sonos / ARC', headphone: 'Optical' };
async function setMode(mode) {
  const btnMap = { gaming: gamingBtn, normal: normalBtn, headphone: headphoneBtn };
  const btn = btnMap[mode];
  if (btn) btn.classList.add('sending');
  showStatus(`Switching to ${modeLabels[mode] || mode}...`, 'connected');
  const data = await sendCommand(`/audio/${mode}`);
  if (data && data.muted !== undefined) updateMuteDisplay(data.muted);
  // TV needs a moment to finish switching audio output
  setTimeout(fetchStatus, 1500);
  if (btn) btn.classList.remove('sending');
}

// Toggle Sonos plug on/off
async function togglePlug() {
  const current = plugState.textContent.toLowerCase();
  const action = current === 'on' ? 'off' : 'on';
  await sendCommand(`/plug/${action}`);
  fetchDeviceStatus();
}

// Toggle mute (routes to active device)
async function toggleMute() {
  if (activeVolume === 'sonos') {
    const btn = document.getElementById('mute-btn');
    const muted = !btn.classList.contains('muted');
    const base = getBaseUrl();
    if (!base) return;
    try {
      const res = await fetch(`${base}/sonos/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted })
      });
      const data = await res.json();
      if (data.muted !== undefined) updateMuteDisplay(data.muted);
    } catch (err) { /* silently fail */ }
  } else {
    const data = await sendCommand('/volume/mute');
    if (data && data.muted !== undefined) {
      updateMuteDisplay(data.muted);
    }
  }
}

// Update mute button display
function updateMuteDisplay(muted) {
  const muteBtn = document.getElementById('mute-btn');
  const muteIcon = document.getElementById('mute-icon');
  if (muted) {
    muteIcon.textContent = '🔊';
    muteBtn.classList.add('muted');
  } else {
    muteIcon.textContent = '🔊';
    muteBtn.classList.remove('muted');
  }
}

// Adjust volume up or down (step buttons, routes to active device)
async function adjustVolume(direction) {
  if (activeVolume === 'sonos') {
    const delta = direction === 'up' ? 1 : -1;
    const current = parseInt(volumeSlider.value, 10) || 0;
    const next = Math.max(0, Math.min(100, current + delta));
    const base = getBaseUrl();
    if (!base) return;
    try {
      const res = await fetch(`${base}/sonos/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: next })
      });
      const data = await res.json();
      if (data.volume !== undefined) updateVolumeDisplay(data.volume);
    } catch (err) { /* silently fail */ }
  } else {
    const data = await sendCommand(`/volume/${direction}`);
    if (data && data.volume !== undefined) {
      updateVolumeDisplay(data.volume);
    }
  }
}

// Set volume to specific level (slider, routes to active device)
let volumeDebounce = null;
function onSliderInput(val) {
  document.getElementById('volume-level').textContent = val;
  clearTimeout(volumeDebounce);
  volumeDebounce = setTimeout(() => {
    const base = getBaseUrl();
    if (!base) return;
    const endpoint = activeVolume === 'sonos' ? '/sonos/volume' : '/volume/set';
    fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: parseInt(val, 10) })
    }).catch(() => {});
  }, 100);
}

// Update volume display (slider + number)
function updateVolumeDisplay(vol) {
  document.getElementById('volume-level').textContent = vol;
  document.getElementById('volume-slider').value = vol;
}

// Set audio output via mode endpoints
const outputModeMap = {
  tv_speaker: 'gaming',
  external_arc: 'normal',
  tv_external_speaker: 'headphone'
};

async function setOutput(value) {
  const mode = outputModeMap[value];
  if (!mode) return;
  showStatus(`Switching to ${modeLabels[mode] || mode}...`, 'connected');
  const data = await sendCommand(`/audio/${mode}`);
  if (data && data.muted !== undefined) updateMuteDisplay(data.muted);
  setTimeout(fetchStatus, 1500);
}

// Fetch and display current Sonos volume and mute state on the unified slider
async function fetchSonosVolume() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const [volRes, muteRes] = await Promise.all([
      fetch(`${base}/sonos/volume`).then(r => r.json()),
      fetch(`${base}/sonos/mute`).then(r => r.json())
    ]);
    if (activeVolume === 'sonos') {
      if (volRes.volume !== undefined) updateVolumeDisplay(volRes.volume);
      if (muteRes.muted !== null && muteRes.muted !== undefined) updateMuteDisplay(muteRes.muted);
    }
  } catch (err) {
    // silently fail
  }
}

// Update output radio buttons to match current state
function updateOutputRadio(output) {
  const radios = document.querySelectorAll('#output-radios input[type="radio"]');
  radios.forEach(r => { r.checked = r.value === output; });
}

// Update mode buttons, radio, and status from an output value
function updateAudioOutput(output) {
  const allBtns = [gamingBtn, normalBtn, headphoneBtn];
  allBtns.forEach(b => b.classList.remove('active'));
  if (output === 'tv_speaker') {
    showStatus('Current Audio: TV Speakers', 'connected');
    gamingBtn.classList.add('active');
  } else if (output === 'external_arc') {
    showStatus('Current Audio: HDMI ARC / Sonos', 'connected');
    normalBtn.classList.add('active');
  } else if (output === 'tv_external_speaker') {
    showStatus('Current Audio: Optical / Headphones', 'connected');
    headphoneBtn.classList.add('active');
  }
  updateOutputRadio(output);

  const brand = document.getElementById('volume-brand');
  if (output === 'external_arc') {
    activeVolume = 'sonos';
    brand.innerHTML = SONOS_ICON_SVG;
    volumeSlider.classList.add('sonos-slider');
    fetchSonosVolume();
  } else {
    activeVolume = 'lg';
    brand.innerHTML = LG_ICON_SVG;
    volumeSlider.classList.remove('sonos-slider');
  }
}

// Fetch current audio output status from proxy server
let statusFailCount = 0;
const STATUS_FAIL_THRESHOLD = 3; // consecutive failures before showing "off"

async function fetchStatus() {
  const base = getBaseUrl();
  if (!base) return;

  try {
    const res = await fetch(`${base}/status`);
    const data = await res.json();
    if (!res.ok) {
      statusFailCount++;
      flashPollLight(false);
      if (!powerBusy && statusFailCount >= STATUS_FAIL_THRESHOLD) {
        updatePowerButton(false);
        const allBtns = [gamingBtn, normalBtn, headphoneBtn];
        allBtns.forEach(b => b.classList.remove('active'));
        showStatus('TV is off', 'connected');
      }
      return;
    }

    statusFailCount = 0;
    flashPollLight(true);
    if (!powerBusy) updatePowerButton(true);
    updateAudioOutput(data.output);
  } catch (err) {
    statusFailCount++;
    flashPollLight(false);
    if (statusFailCount >= STATUS_FAIL_THRESHOLD) {
      showStatus(`Cannot reach server`, 'error');
    }
  }
}

// Update the status bar display
function showStatus(message, type) {
  statusText.textContent = message;
  statusEl.className = 'status ' + (type || '');
}

// Fetch device status indicators (plug + Sonos reachability)
async function fetchDeviceStatus() {
  const base = getBaseUrl();
  if (!base) return;

  try {
    const [plugRes, sonosRes] = await Promise.all([
      fetch(`${base}/plug/status`).then(r => r.json()).catch(() => null),
      fetch(`${base}/sonos/status`).then(r => r.json()).catch(() => null)
    ]);

    // Update plug indicator
    if (plugRes && plugRes.reachable) {
      plugDot.className = 'dot ' + (plugRes.state === 'on' ? 'dot-on' : 'dot-off');
      plugState.textContent = plugRes.state === 'on' ? 'On' : 'Off';
    } else {
      plugDot.className = 'dot dot-unknown';
      plugState.textContent = 'N/A';
    }

    // Update Sonos indicator
    if (sonosRes) {
      if (sonosRes.reachable) {
        sonosDot.className = 'dot dot-on';
        sonosState.textContent = 'Online';
      } else if (plugRes && plugRes.state === 'on') {
        sonosDot.className = 'dot dot-booting';
        sonosState.textContent = 'Booting';
      } else {
        sonosDot.className = 'dot dot-off';
        sonosState.textContent = 'Offline';
      }
    }
  } catch (err) {
    // Silently fail — indicators just won't update
  }
}

// Flash poll light green on success, red on failure
function flashPollLight(success) {
  const light = document.getElementById('poll-light');
  light.classList.remove('active', 'error');
  void light.offsetWidth; // force reflow to restart transition
  light.classList.add(success ? 'active' : 'error');
  setTimeout(() => light.classList.remove('active', 'error'), 600);
}

// Poll device and TV status every 5 seconds
let pollInterval = null;
function startPolling() {
  if (pollInterval) return;
  fetchDeviceStatus();
  fetchStatus();
  pollInterval = setInterval(() => {
    fetchDeviceStatus();
    fetchStatus();
  }, 5000);
}

// Subscribe to real-time volume updates via SSE
let volumeSource = null;
function subscribeVolume() {
  const base = getBaseUrl();
  if (!base || volumeSource) return;
  volumeSource = new EventSource(`${base}/volume/events`);
  volumeSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.output !== undefined) updateAudioOutput(data.output);
    if (activeVolume === 'lg') {
      if (data.volume !== undefined) updateVolumeDisplay(data.volume);
      if (data.muted !== undefined) updateMuteDisplay(data.muted);
    }
    // SSE fires on LG volume change — use as trigger to poll Sonos
    if (activeVolume === 'sonos') fetchSonosVolume();
  };
  volumeSource.onerror = () => {
    volumeSource.close();
    volumeSource = null;
  };
}

// TV power toggle
let tvOn = false;
let powerBusy = false;

function updatePowerButton(on) {
  tvOn = on;
  const btn = document.getElementById('power-btn');
  btn.classList.toggle('on', on);
  btn.classList.toggle('off', !on);
}

async function toggleTvPower() {
  const base = getBaseUrl();
  if (!base) {
    showStatus('Set server URL first', 'error');
    return;
  }
  if (powerBusy) return; // prevent double-clicks
  powerBusy = true;
  const btn = document.getElementById('power-btn');
  btn.classList.add('waking');

  if (tvOn) {
    showStatus('Turning off TV...', 'connected');
    try {
      const res = await fetch(`${base}/tv/off`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showStatus('TV is off', 'connected');
        updatePowerButton(false);
      } else {
        showStatus(data.error || 'Failed', 'error');
      }
    } catch (err) {
      showStatus(`Error: ${err.message}`, 'error');
    }
  } else {
    showStatus('Waking TV...', 'connected');
    try {
      const res = await fetch(`${base}/tv/wake`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showStatus('TV is awake!', 'connected');
      } else {
        showStatus('WoL sent — waiting for TV...', 'connected');
      }
      // WoL was sent either way — check actual state
      updatePowerButton(true);
      fetchStatus();
      subscribeVolume();
    } catch (err) {
      showStatus(`Wake error: ${err.message}`, 'error');
    }
  }
  btn.classList.remove('waking');
  // Hold powerBusy for 10s to prevent poll from overriding state during TV transition
  setTimeout(() => { powerBusy = false; }, 10000);
}

// Auto-connect on load
function isLocalNetwork() {
  const host = window.location.hostname;
  return host === 'localhost' ||
         host.endsWith('.local') ||
         /^192\.168\./.test(host) ||
         /^10\./.test(host) ||
         /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
}

if (isLocalNetwork()) {
  // Served from the Pi — use same origin (lx200pi.local:3000 or IP), hide settings
  localStorage.setItem(STORAGE_KEY, window.location.origin);
  document.querySelector('.settings').style.display = 'none';
} else {
  // Served from GitHub Pages — prompt for server URL
  serverInput.value = localStorage.getItem(STORAGE_KEY) || '';
}
fetchStatus();
startPolling();
subscribeVolume();
