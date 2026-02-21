// channels-app.js — frontend logic for the channels page

const STORAGE_KEY = 'lg-remote-server-url';

function getBaseUrl() {
  return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/+$/, '');
}

// Auto-connect: same logic as main app
function isLocalNetwork() {
  const host = window.location.hostname;
  return host === 'localhost' ||
         host.endsWith('.local') ||
         /^192\.168\./.test(host) ||
         /^10\./.test(host) ||
         /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
}

if (isLocalNetwork()) {
  localStorage.setItem(STORAGE_KEY, window.location.origin);
}

// ── Power ────────────────────────────────────────────────────────

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
  if (!base || powerBusy) return;
  powerBusy = true;
  const btn = document.getElementById('power-btn');
  btn.classList.add('waking');

  if (tvOn) {
    try {
      await fetch(`${base}/tv/off`, { method: 'POST' });
      updatePowerButton(false);
    } catch (e) {}
  } else {
    try {
      await fetch(`${base}/tv/wake`, { method: 'POST' });
      updatePowerButton(true);
    } catch (e) {}
  }

  btn.classList.remove('waking');
  setTimeout(() => { powerBusy = false; }, 10000);
}

async function fetchPowerStatus() {
  const base = getBaseUrl();
  if (!base || powerBusy) return;
  try {
    const res = await fetch(`${base}/status`);
    if (res.ok) updatePowerButton(true);
    else updatePowerButton(false);
  } catch (e) {
    updatePowerButton(false);
  }
}

// ── Sonos volume ─────────────────────────────────────────────────

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
  } catch (e) {}
}

function updateSonosVolumeDisplay(vol) {
  document.getElementById('sonos-volume-level').textContent = vol;
  document.getElementById('sonos-slider').value = vol;
}

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

async function adjustSonosVolume(delta) {
  const slider = document.getElementById('sonos-slider');
  const next = Math.max(0, Math.min(100, (parseInt(slider.value, 10) || 0) + delta));
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
  } catch (e) {}
}

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
  } catch (e) {}
}

function updateSonosMuteDisplay(muted) {
  document.getElementById('sonos-mute-btn').classList.toggle('muted', muted);
}

// ── Channel / app actions ─────────────────────────────────────────

async function tuneChannel(channelId, displayVal) {
  const base = getBaseUrl();
  if (!base) return;
  if (displayVal) document.getElementById('ch-input').value = displayVal;
  try {
    await fetch(`${base}/channels/tune`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    });
  } catch (e) {}
}

function subchannelUp() {
  const input = document.getElementById('ch-input');
  const val = input.value.trim();
  if (!val) return;
  const dot = val.lastIndexOf('.');
  if (dot === -1) return;
  const major = val.slice(0, dot);
  const minor = parseInt(val.slice(dot + 1), 10);
  if (isNaN(minor)) return;
  input.value = `${major}.${minor + 1}`;
  goChannel();
}

async function launchApp(id) {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/channels/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  } catch (e) {}
}

async function sendKey(key) {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/channels/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
  } catch (e) {}
  if (key === 'CHANNELUP' || key === 'CHANNELDOWN') {
    setTimeout(fetchCurrentChannel, 900);
  }
}

async function fetchCurrentChannel() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/channels/current`);
    const data = await res.json();
    if (data.channelNumber) {
      document.getElementById('ch-input').value = data.channelNumber;
    }
  } catch (e) {}
}

function goChannel() {
  const val = document.getElementById('ch-input').value.trim();
  if (!val) return;
  const base = getBaseUrl();
  if (!base) return;
  fetch(`${base}/channels/tune`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelNumber: val })
  }).catch(() => {});
  setTimeout(fetchCurrentChannel, 900);
}

// Allow Enter key in channel input
document.getElementById('ch-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') goChannel();
});

// ── Viewport height fix (compensates for mobile URL bar) ──────────

function updateAppHeight() {
  document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
}
window.addEventListener('resize', updateAppHeight);
updateAppHeight();

// ── Init ──────────────────────────────────────────────────────────

fetchPowerStatus();
fetchSonosVolume();
setInterval(fetchPowerStatus, 15000);
