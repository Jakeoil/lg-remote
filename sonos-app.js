// sonos-app.js — frontend logic for the Sonos control page

const STORAGE_KEY = 'lg-remote-server-url';

function getBaseUrl() {
  return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/+$/, '');
}

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

// ── Rulers ──────────────────────────────────────────────────────

let volumeRuler, bassRuler, trebleRuler, heightRuler, subRuler, speechRuler;

function postJSON(path, body) {
  const base = getBaseUrl();
  if (!base) return Promise.reject();
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

requestAnimationFrame(() => {
  volumeRuler = new SlidingRuler(document.getElementById('volume-ruler'), {
    height: 46, volume: 0, min: 0, max: 100,
    onChange: vol => postJSON('/sonos/volume', { volume: vol }).catch(() => {})
  });

  const eqOpts = { visibleRange: 15, labels: {'-10':'-10', '-5':'-5', 0:'0', 5:'5', 10:'10'} };

  bassRuler = new SlidingRuler(document.getElementById('bass-ruler'), {
    height: 40, volume: 0, min: -10, max: 10, ...eqOpts,
    onChange: val => postJSON('/sonos/bass', { value: val }).catch(() => {})
  });

  trebleRuler = new SlidingRuler(document.getElementById('treble-ruler'), {
    height: 40, volume: 0, min: -10, max: 10, ...eqOpts,
    onChange: val => postJSON('/sonos/treble', { value: val }).catch(() => {})
  });

  heightRuler = new SlidingRuler(document.getElementById('height-ruler'), {
    height: 40, volume: 0, min: -10, max: 10, ...eqOpts,
    onChange: val => postJSON('/sonos/eq/HeightChannelLevel', { value: val }).catch(() => {})
  });

  subRuler = new SlidingRuler(document.getElementById('sub-ruler'), {
    height: 40, volume: 0, min: -10, max: 10, ...eqOpts,
    onChange: val => postJSON('/sonos/eq/SubGain', { value: val }).catch(() => {})
  });

  speechRuler = new SlidingRuler(document.getElementById('speech-ruler'), {
    height: 40, volume: 0, min: 0, max: 4, visibleRange: 3,
    labels: { 0: 'Off', 1: 'Low', 2: 'Med', 3: 'High', 4: 'Max' },
    onChange: val => setSpeechLevel(val)
  });

  loadAll();
});

// ── Batch load ──────────────────────────────────────────────────

async function loadAll() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/sonos/eq/all`);
    const d = await res.json();

    if (d.volume != null && volumeRuler) volumeRuler.setVolume(d.volume);
    if (d.bass != null && bassRuler) bassRuler.setVolume(d.bass);
    if (d.treble != null && trebleRuler) trebleRuler.setVolume(d.treble);
    if (d.HeightChannelLevel != null && heightRuler) heightRuler.setVolume(d.HeightChannelLevel);
    if (d.SubGain != null && subRuler) subRuler.setVolume(d.SubGain);

    if (d.muted != null) {
      document.getElementById('mute-btn').classList.toggle('muted', d.muted);
    }

    // Toggles
    setToggle('toggle-night', d.NightMode);
    setToggle('toggle-loudness', d.loudness);
    setToggle('toggle-surround', d.SurroundEnable);
    setToggle('toggle-surround-mode', d.SurroundMode);

    // Speech enhancement
    if (d.SpeechEnhanceEnabled != null && speechRuler) {
      const level = d.SpeechEnhanceEnabled ? (d.DialogLevel || 1) : 0;
      speechRuler.setVolume(level);
    }
  } catch (e) {}
}

function setToggle(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.classList.toggle('active', !!val);
}

// ── Mute ────────────────────────────────────────────────────────

async function toggleMute() {
  const btn = document.getElementById('mute-btn');
  const muted = !btn.classList.contains('muted');
  try {
    const res = await postJSON('/sonos/mute', { muted });
    const data = await res.json();
    if (data.muted !== undefined) btn.classList.toggle('muted', data.muted);
  } catch (e) {}
}

// ── Toggle buttons ──────────────────────────────────────────────

async function toggleEQ(type) {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/sonos/eq/${type}`);
    const d = await res.json();
    const newVal = d.value ? 0 : 1;
    await postJSON(`/sonos/eq/${type}`, { value: newVal });
    const idMap = {
      NightMode: 'toggle-night',
      SurroundEnable: 'toggle-surround',
      SurroundMode: 'toggle-surround-mode'
    };
    setToggle(idMap[type], newVal);
  } catch (e) {}
}

async function toggleLoudness() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/sonos/loudness`);
    const d = await res.json();
    const newVal = !d.value;
    await postJSON('/sonos/loudness', { value: newVal });
    setToggle('toggle-loudness', newVal);
  } catch (e) {}
}

// ── Transport ───────────────────────────────────────────────────

function transport(action) {
  postJSON(`/sonos/transport/${action}`, {}).catch(() => {});
}

// ── Device status ───────────────────────────────────────────────

const plugDot = document.getElementById('plug-dot');
const plugState = document.getElementById('plug-state');
const sonosDot = document.getElementById('sonos-dot');
const sonosState = document.getElementById('sonos-state');

async function fetchDeviceStatus() {
  const base = getBaseUrl();
  if (!base) return;
  try {
    const [plugRes, sonosRes] = await Promise.all([
      fetch(`${base}/plug/status`).then(r => r.json()).catch(() => null),
      fetch(`${base}/sonos/status`).then(r => r.json()).catch(() => null)
    ]);
    if (plugRes && plugRes.reachable) {
      plugDot.className = 'dot ' + (plugRes.state === 'on' ? 'dot-on' : 'dot-off');
      plugState.textContent = plugRes.state === 'on' ? 'On' : 'Off';
    } else {
      plugDot.className = 'dot dot-unknown';
      plugState.textContent = 'N/A';
    }
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
  } catch (e) {}
}

async function togglePlug() {
  const base = getBaseUrl();
  if (!base) return;
  const current = plugState.textContent.toLowerCase();
  const action = current === 'on' ? 'off' : 'on';
  try {
    await postJSON(`/plug/${action}`, {});
  } catch (e) {}
  fetchDeviceStatus();
}

// ── Speech enhancement ──────────────────────────────────────────

async function setSpeechLevel(level) {
  try {
    if (level === 0) {
      await postJSON('/sonos/eq/SpeechEnhanceEnabled', { value: 0 });
    } else {
      await postJSON('/sonos/eq/SpeechEnhanceEnabled', { value: 1 });
      await postJSON('/sonos/eq/DialogLevel', { value: level });
    }
  } catch (e) {}
}

// ── Now Playing ─────────────────────────────────────────────────

async function showNowPlaying() {
  const overlay = document.getElementById('np-overlay');
  overlay.classList.remove('hidden');

  const base = getBaseUrl();
  if (!base) return;
  try {
    const res = await fetch(`${base}/sonos/now-playing`);
    const d = await res.json();

    if (!d.playing || !d.title) {
      document.getElementById('np-title').textContent = '';
      document.getElementById('np-artist').textContent = '';
      document.getElementById('np-album').textContent = '';
      document.getElementById('np-pos').textContent = '';
      document.getElementById('np-dur').textContent = '';
      document.getElementById('np-art-wrap').className = 'np-art-wrap no-art';
      document.getElementById('np-title').innerHTML = '<span class="np-nothing">Nothing playing</span>';
      return;
    }

    document.getElementById('np-title').textContent = d.title || '';
    document.getElementById('np-artist').textContent = d.artist || '';
    document.getElementById('np-album').textContent = d.album || '';
    document.getElementById('np-pos').textContent = d.position || '';
    document.getElementById('np-dur').textContent = d.duration || '';

    const artWrap = document.getElementById('np-art-wrap');
    if (d.albumArt) {
      artWrap.className = 'np-art-wrap';
      document.getElementById('np-art').src = d.albumArt;
    } else {
      artWrap.className = 'np-art-wrap no-art';
    }
  } catch (e) {
    document.getElementById('np-title').innerHTML = '<span class="np-nothing">Could not fetch</span>';
  }
}

function hideNowPlaying() {
  document.getElementById('np-overlay').classList.add('hidden');
}

// ── Init ────────────────────────────────────────────────────────

fetchDeviceStatus();
setInterval(fetchDeviceStatus, 10000);
