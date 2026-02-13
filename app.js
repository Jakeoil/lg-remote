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

// Load saved server URL on page load
serverInput.value = localStorage.getItem(STORAGE_KEY) || '';

// Connect button handler - saves URL and fetches status
connectBtn.addEventListener('click', () => {
  const url = serverInput.value.trim().replace(/\/+$/, ''); // strip trailing slash
  if (!url) return;
  localStorage.setItem(STORAGE_KEY, url);
  fetchStatus();
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

// Switch audio mode (gaming = TV speakers, normal = HDMI ARC)
async function setMode(mode) {
  const btn = mode === 'gaming' ? gamingBtn : normalBtn;
  btn.classList.add('sending');
  await sendCommand(`/audio/${mode}`);
  btn.classList.remove('sending');
}

// Adjust volume up or down
async function adjustVolume(direction) {
  await sendCommand(`/volume/${direction}`);
}

// Fetch current audio output status from proxy server
async function fetchStatus() {
  const base = getBaseUrl();
  if (!base) return;

  try {
    const res = await fetch(`${base}/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Update status text and highlight the active mode button
    if (data.output === 'tv_speaker') {
      showStatus('Current Audio: TV Speakers', 'connected');
      gamingBtn.classList.add('active');
      normalBtn.classList.remove('active');
    } else if (data.output === 'external_arc') {
      showStatus('Current Audio: HDMI ARC / Sonos', 'connected');
      normalBtn.classList.add('active');
      gamingBtn.classList.remove('active');
    } else {
      showStatus(`Audio: ${data.output || 'Unknown'}`, 'connected');
      gamingBtn.classList.remove('active');
      normalBtn.classList.remove('active');
    }
  } catch (err) {
    showStatus(`Cannot reach server`, 'error');
  }
}

// Update the status bar display
function showStatus(message, type) {
  statusText.textContent = message;
  statusEl.className = 'status ' + (type || '');
}

// Auto-connect on load if a server URL is saved
if (getBaseUrl()) {
  fetchStatus();
}
