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
serverInput.value = localStorage.getItem(STORAGE_KEY) || 'http://192.168.1.239:3000';

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

// Update output radio buttons to match current state
function updateOutputRadio(output) {
  const radios = document.querySelectorAll('#output-radios input[type="radio"]');
  radios.forEach(r => { r.checked = r.value === output; });
}

// Fetch current audio output status from proxy server
async function fetchStatus() {
  const base = getBaseUrl();
  if (!base) return;

  try {
    const res = await fetch(`${base}/status`);
    const data = await res.json();
    if (!res.ok) {
      showStatus(data.error || `Server error (${res.status})`, 'error');
      return;
    }

    // Update status text, mode buttons, and output radio
    const allBtns = [gamingBtn, normalBtn, headphoneBtn];
    allBtns.forEach(b => b.classList.remove('active'));
    if (data.output === 'tv_speaker') {
      showStatus('Current Audio: TV Speakers', 'connected');
      gamingBtn.classList.add('active');
    } else if (data.output === 'external_arc') {
      showStatus('Current Audio: HDMI ARC / Sonos', 'connected');
      normalBtn.classList.add('active');
    } else if (data.output === 'tv_external_speaker') {
      showStatus('Current Audio: Optical / Headphones', 'connected');
      headphoneBtn.classList.add('active');
    } else {
      showStatus(`Audio: ${data.output || 'Unknown'}`, 'connected');
    }
    updateOutputRadio(data.output);
  } catch (err) {
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

// Poll device status every 5 seconds
let pollInterval = null;
function startPolling() {
  if (pollInterval) return;
  fetchDeviceStatus();
  pollInterval = setInterval(fetchDeviceStatus, 5000);
}

// Subscribe to real-time volume updates via SSE
let volumeSource = null;
function subscribeVolume() {
  const base = getBaseUrl();
  if (!base || volumeSource) return;
  volumeSource = new EventSource(`${base}/volume/events`);
  volumeSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.volume !== undefined) {
      updateVolumeDisplay(data.volume);
    }
    if (data.muted !== undefined) {
      updateMuteDisplay(data.muted);
    }
  };
  volumeSource.onerror = () => {
    volumeSource.close();
    volumeSource = null;
  };
}

// Auto-connect on load
// If served from the Pi or Mac server, use same origin. Otherwise use saved URL.
if (!localStorage.getItem(STORAGE_KEY)) {
  const origin = window.location.origin;
  if (origin.includes('192.168.1.')) {
    // Served from local network (Pi or Mac) — use same origin
    localStorage.setItem(STORAGE_KEY, origin);
    serverInput.value = origin;
  } else {
    // Served from GitHub Pages or elsewhere — prompt user to enter server address
    serverInput.value = '';
    serverInput.placeholder = 'Enter server IP:port';
  }
}
fetchStatus();
startPolling();
subscribeVolume();
