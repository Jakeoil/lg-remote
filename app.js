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

// Toggle mute
async function toggleMute() {
  const data = await sendCommand('/volume/mute');
  if (data && data.muted !== undefined) {
    updateMuteDisplay(data.muted);
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

// Adjust volume up or down (step buttons)
async function adjustVolume(direction) {
  const data = await sendCommand(`/volume/${direction}`);
  if (data && data.volume !== undefined) {
    updateVolumeDisplay(data.volume);
  }
}

// Set volume to specific level (slider)
let volumeDebounce = null;
function onSliderInput(val) {
  document.getElementById('volume-level').textContent = val;
  clearTimeout(volumeDebounce);
  volumeDebounce = setTimeout(() => {
    const base = getBaseUrl();
    if (!base) return;
    fetch(`${base}/volume/set`, {
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

// Fetch and display current Sonos volume and mute state
async function fetchSonosVolume() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const [volRes, muteRes] = await Promise.all([
      fetch(`${base}/sonos/volume`).then(r => r.json()),
      fetch(`${base}/sonos/mute`).then(r => r.json())
    ]);
    if (volRes.volume !== undefined) updateSonosVolumeDisplay(volRes.volume);
    if (muteRes.muted !== null && muteRes.muted !== undefined) updateSonosMuteDisplay(muteRes.muted);
  } catch (err) {
    // silently fail
  }
}

function updateSonosVolumeDisplay(vol) {
  document.getElementById('sonos-volume-level').textContent = vol;
  document.getElementById('sonos-slider').value = vol;
}

// Toggle Sonos mute
async function toggleSonosMute() {
  const btn = document.getElementById('sonos-mute-btn');
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
    if (data.muted !== undefined) updateSonosMuteDisplay(data.muted);
  } catch (err) {
    // silently fail
  }
}

function updateSonosMuteDisplay(muted) {
  const btn = document.getElementById('sonos-mute-btn');
  if (muted) {
    btn.classList.add('muted');
  } else {
    btn.classList.remove('muted');
  }
}

// Set Sonos volume via slider input (debounced)
let sonosDebounce = null;
function onSonosSliderInput(val) {
  document.getElementById('sonos-volume-level').textContent = val;
  clearTimeout(sonosDebounce);
  sonosDebounce = setTimeout(() => {
    const base = getBaseUrl();
    if (!base) return;
    fetch(`${base}/sonos/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: parseInt(val, 10) })
    }).catch(() => {});
  }, 100);
}

// Adjust Sonos volume by step (+1 or -1)
async function adjustSonosVolume(delta) {
  const slider = document.getElementById('sonos-slider');
  const current = parseInt(slider.value, 10) || 0;
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
    if (data.volume !== undefined) updateSonosVolumeDisplay(data.volume);
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

  const sonosBar = document.getElementById('sonos-volume-bar');
  if (output === 'external_arc') {
    sonosBar.style.display = '';
    fetchSonosVolume();
  } else {
    sonosBar.style.display = 'none';
  }
}

// Fetch current audio output status from proxy server
async function fetchStatus() {
  const base = getBaseUrl();
  if (!base) return;

  try {
    const res = await fetch(`${base}/status`);
    const data = await res.json();
    if (!res.ok) {
      flashPollLight(false);
      if (!powerBusy) updatePowerButton(false);
      const allBtns = [gamingBtn, normalBtn, headphoneBtn];
      allBtns.forEach(b => b.classList.remove('active'));
      showStatus('TV is off', 'connected');
      return;
    }

    flashPollLight(true);
    if (!powerBusy) updatePowerButton(true);
    updateAudioOutput(data.output);
  } catch (err) {
    flashPollLight(false);
    showStatus(`Cannot reach server`, 'error');
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

    // Update Sonos indicator and ghost Sonos volume bar if not reachable
    if (sonosRes) {
      const sonosBar = document.getElementById('sonos-volume-bar');
      if (sonosRes.reachable) {
        sonosDot.className = 'dot dot-on';
        sonosState.textContent = 'Online';
        sonosBar.classList.remove('ghosted');
      } else if (plugRes && plugRes.state === 'on') {
        sonosDot.className = 'dot dot-booting';
        sonosState.textContent = 'Booting';
        sonosBar.classList.add('ghosted');
      } else {
        sonosDot.className = 'dot dot-off';
        sonosState.textContent = 'Offline';
        sonosBar.classList.add('ghosted');
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
    if (data.volume !== undefined) updateVolumeDisplay(data.volume);
    if (data.muted !== undefined) updateMuteDisplay(data.muted);
    if (data.output !== undefined) updateAudioOutput(data.output);
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
const isLocal = window.location.origin.includes('192.168.1.');

if (isLocal) {
  // Served locally — use same host as server, hide settings
  localStorage.setItem(STORAGE_KEY, window.location.origin);
  document.querySelector('.settings').style.display = 'none';
} else {
  // Served from GitHub Pages — prompt for server URL
  serverInput.value = localStorage.getItem(STORAGE_KEY) || '';
}
fetchStatus();
startPolling();
subscribeVolume();
