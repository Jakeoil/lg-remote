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
    if (res.ok) {
      updatePowerButton(true);
      const data = await res.json();
      if (data.output) updateAudioOutput(data.output);
    } else {
      updatePowerButton(false);
    }
  } catch (e) {
    updatePowerButton(false);
  }
}

// ── Unified volume (sliding ruler) ───────────────────────────────

let activeVolume = 'sonos'; // 'lg' or 'sonos'
let ruler = null;

const LG_ICON_SVG = '<svg class="brand-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.522 14.078h3.27v1.33h-4.847v-6.83h1.577v5.5zm6.74-1.274h1.284v1.195c-.236.09-.698.18-1.137.18-1.42 0-1.893-.721-1.893-2.186 0-1.398.45-2.221 1.869-2.221.791 0 1.24.248 1.612.722l.982-.903c-.6-.855-1.646-1.114-2.629-1.114-2.208 0-3.368 1.205-3.368 3.504 0 2.288 1.047 3.528 3.358 3.528 1.06 0 2.096-.27 2.66-.665V11.53h-2.739v1.274zM5.291 6.709a5.29 5.29 0 1 1 0 10.582 5.291 5.291 0 1 1 0-10.582m3.16 8.457a4.445 4.445 0 0 0 1.31-3.161v-.242l-.22.001H6.596v.494h2.662l-.001.015a3.985 3.985 0 0 1-3.965 3.708 3.95 3.95 0 0 1-2.811-1.165 3.952 3.952 0 0 1-1.164-2.811c0-1.061.414-2.059 1.164-2.81a3.951 3.951 0 0 1 2.81-1.164l.252.003v-.495l-.251-.003a4.475 4.475 0 0 0-4.47 4.469c0 1.194.465 2.316 1.309 3.161a4.444 4.444 0 0 0 3.16 1.31 4.444 4.444 0 0 0 3.162-1.31m-2.91-1.297V9.644H5.04v4.72h1.556v-.495H5.543zm-1.265-3.552a.676.676 0 1 0-.675.674.676.676 0 0 0 .675-.674"/></svg>';

const SONOS_ICON_SVG = '<svg class="brand-icon" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.988 12.36l-2.813-2.634v4.429h.837V11.7l2.813 2.633V9.905h-.837zM6.464 9.665A2.3 2.3 0 0 0 4.13 12c0 1.257 1.077 2.334 2.334 2.334A2.3 2.3 0 0 0 8.798 12a2.3 2.3 0 0 0-2.334-2.334m0 3.83A1.482 1.482 0 0 1 4.968 12c0-.838.658-1.496 1.496-1.496S7.96 11.162 7.96 12s-.658 1.496-1.496 1.496M2.694 12c-.24-.18-.54-.3-.958-.419-.838-.24-.838-.479-.838-.598 0-.24.299-.48.718-.48.36 0 .658.18.778.24l.06.06.658-.479-.06-.06s-.538-.598-1.436-.598c-.419 0-.838.12-1.137.359-.3.24-.479.598-.479.958s.18.718.479.957c.24.18.538.3.957.42.838.239.838.478.838.598 0 .239-.299.478-.718.478-.359 0-.658-.18-.778-.239l-.06-.06-.658.479.06.06s.538.598 1.436.598c.42 0 .838-.12 1.137-.359.3-.24.48-.598.48-.957 0-.36-.18-.659-.48-.958m14.843-2.334A2.3 2.3 0 0 0 15.202 12a2.337 2.337 0 0 0 2.334 2.334A2.3 2.3 0 0 0 19.87 12a2.337 2.337 0 0 0-2.334-2.334m0 3.83A1.482 1.482 0 0 1 16.04 12c0-.838.658-1.496 1.496-1.496s1.496.658 1.496 1.496-.718 1.496-1.496 1.496m3.77-1.556c.24.18.54.3.958.42.838.239.838.478.838.598 0 .239-.299.478-.718.478-.36 0-.658-.18-.778-.239h-.06l-.658.479.06.06s.538.598 1.436.598c.419 0 .838-.12 1.137-.359s.479-.598.479-.958-.18-.718-.479-.957c-.24-.18-.538-.3-.957-.42-.838-.239-.838-.478-.838-.598 0-.239.299-.478.718-.478.359 0 .658.18.778.239l.06.06.658-.479-.06-.06s-.538-.598-1.436-.598c-.42 0-.838.12-1.137.359-.3.24-.48.598-.48.957-.059.36.12.659.48.898"/></svg>';

// Init ruler after layout so canvas.offsetWidth is correct
requestAnimationFrame(() => {
  const canvas = document.getElementById('sonos-ruler');
  ruler = new SlidingRuler(canvas, {
    height: 46,
    volume: 0,
    onChange: vol => {
      const base = getBaseUrl();
      if (!base) return;
      const endpoint = activeVolume === 'sonos' ? '/sonos/volume' : '/volume/set';
      fetch(`${base}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: vol })
      }).catch(() => {});
    }
  });
});

function updateAudioOutput(output) {
  const brand = document.getElementById('ruler-brand');
  if (output === 'external_arc') {
    activeVolume = 'sonos';
    brand.innerHTML = SONOS_ICON_SVG;
    fetchActiveVolume();
  } else {
    activeVolume = 'lg';
    brand.innerHTML = LG_ICON_SVG;
    // LG volume arrives via SSE
  }
}

let sonosFetching = false;
function fetchActiveVolume() {
  if (activeVolume === 'sonos') {
    if (sonosFetching) return;
    sonosFetching = true;
    const base = getBaseUrl();
    if (!base) { sonosFetching = false; return; }
    Promise.all([
      fetch(`${base}/sonos/volume`).then(r => r.json()),
      fetch(`${base}/sonos/mute`).then(r => r.json())
    ]).then(([volRes, muteRes]) => {
      if (volRes.volume !== undefined && ruler && activeVolume === 'sonos') ruler.setVolume(volRes.volume);
      if (muteRes.muted != null) {
        document.getElementById('sonos-mute-btn').classList.toggle('muted', muteRes.muted);
      }
    }).catch(() => {}).finally(() => { sonosFetching = false; });
  }
}

async function toggleSonosMute() {
  const btn = document.getElementById('sonos-mute-btn');
  const base = getBaseUrl();
  if (!base) return;
  if (activeVolume === 'sonos') {
    const muted = !btn.classList.contains('muted');
    try {
      const res = await fetch(`${base}/sonos/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted })
      });
      const data = await res.json();
      if (data.muted !== undefined) btn.classList.toggle('muted', data.muted);
    } catch (e) {}
  } else {
    try {
      const res = await fetch(`${base}/volume/mute`, { method: 'POST' });
      const data = await res.json();
      if (data.muted !== undefined) btn.classList.toggle('muted', data.muted);
    } catch (e) {}
  }
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

// ── SSE — route volume updates based on active device ──

function subscribeVolumeEvents() {
  const base = getBaseUrl();
  if (!base) return;
  const es = new EventSource(`${base}/volume/events`);
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.output !== undefined) updateAudioOutput(d.output);
    if (activeVolume === 'lg') {
      if (d.volume !== undefined && ruler) ruler.setVolume(d.volume);
      if (d.muted !== undefined) {
        document.getElementById('sonos-mute-btn').classList.toggle('muted', d.muted);
      }
    }
    if (activeVolume === 'sonos') fetchActiveVolume();
  };
  es.onerror = () => { es.close(); setTimeout(subscribeVolumeEvents, 5000); };
}

// ── Init ──────────────────────────────────────────────────────────

fetchPowerStatus();
setInterval(fetchPowerStatus, 15000);
subscribeVolumeEvents();
