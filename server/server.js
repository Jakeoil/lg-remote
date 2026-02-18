// LG TV Remote - Proxy Server
// Bridges HTTP requests from the webapp to the LG TV via WebSocket
// Also controls Sonos soundbar via local UPnP/SOAP API

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const lgtv = require('lgtv2');
const http = require('http');
const net = require('net');
const { Client } = require('tplink-smarthome-api');
const wol = require('wake_on_lan');
const { discoverDevices } = require('./discover');

// ── Configuration (from .env, overridden by discovery) ───────
let TV_IP = process.env.TV_IP;
let TV_MAC = process.env.TV_MAC || null;
let SONOS_IP = process.env.SONOS_IP;
let SONOS_RINCON = process.env.SONOS_RINCON;
let KASA_IP = process.env.KASA_IP;
let ROKU_IP = process.env.ROKU_IP;
const PORT = process.env.PORT || 3000;

// ── Kasa smart plug (TP-Link EP10) ───────────────────────────
const kasaClient = new Client();
let kasaPlug = null;

// ── Express setup ──────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));  // serve frontend files

// ── LG TV connection ──────────────────────────────────────────
let tvConnection = null;
let tvConnected = false;

// Connect to the TV. The lgtv2 library handles pairing automatically -
// on first connection, an "accept" prompt appears on the TV screen.
// The client key is saved to ~/.lgtv2/client-key for future connections.
function connectTV() {
  return new Promise((resolve, reject) => {
    // If already connected, reuse
    if (tvConnection && tvConnected) {
      return resolve(tvConnection);
    }

    console.log(`Connecting to LG TV at ${TV_IP}...`);
    const connection = lgtv({
      url: `wss://${TV_IP}:3001`,
      wsconfig: {
        tlsOptions: {
          rejectUnauthorized: false,
          ciphers: 'DEFAULT:@SECLEVEL=0',
          minVersion: 'TLSv1.2'
        }
      }
    });

    connection.on('connect', () => {
      console.log('Connected to LG TV');
      tvConnection = connection;
      tvConnected = true;
      subscribeVolume(connection);
      resolve(connection);
    });

    connection.on('error', (err) => {
      console.error('TV connection error:', err.message);
      tvConnected = false;
      reject(err);
    });

    connection.on('close', () => {
      console.log('TV connection closed');
      tvConnected = false;
      tvConnection = null;
    });

    // Timeout if the TV doesn't respond (e.g. TV is off)
    setTimeout(() => {
      if (!tvConnected) {
        reject(new Error('Connection timed out - is the TV on?'));
      }
    }, 10000);
  });
}

// ── Volume subscription via SSE ──────────────────────────────
let currentVolume = null;
let currentMute = false;
const sseClients = new Set();

function subscribeVolume(conn) {
  conn.subscribe('ssap://audio/getVolume', (err, res) => {
    if (err) return console.error('Volume subscribe error:', err.message);
    const status = res.volumeStatus || res;
    const vol = status.volume;
    const muted = status.muteStatus;
    if (vol !== undefined) currentVolume = vol;
    if (muted !== undefined) currentMute = muted;
    const msg = { volume: currentVolume, muted: currentMute };
    for (const client of sseClients) {
      client.write(`data: ${JSON.stringify(msg)}\n\n`);
    }
  });
}

app.get('/volume/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  if (currentVolume !== null) {
    res.write(`data: ${JSON.stringify({ volume: currentVolume, muted: currentMute })}\n\n`);
  }
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.post('/volume/mute', async (req, res) => {
  try {
    const vol = await tvRequest('ssap://audio/getVolume', {});
    const status = vol.volumeStatus || vol;
    const newMute = !status.muteStatus;
    await tvRequest('ssap://audio/setMute', { mute: newMute });
    res.json({ success: true, muted: newMute });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/volume/set', async (req, res) => {
  try {
    const vol = Math.max(0, Math.min(100, parseInt(req.body.volume, 10)));
    await tvRequest('ssap://audio/setVolume', { volume: vol });
    res.json({ success: true, volume: vol });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Send a request to the TV and return the response
function tvRequest(uri, payload) {
  return new Promise(async (resolve, reject) => {
    try {
      const conn = await connectTV();
      conn.request(uri, payload, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Sonos control ─────────────────────────────────────────────
// Send a SOAP command to the Sonos via its local UPnP API (port 1400)
function sonosRequest(endpoint, service, action, body) {
  return new Promise((resolve, reject) => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:${service}:1">
      ${body}
    </u:${action}>
  </s:Body>
</s:Envelope>`;

    const options = {
      hostname: SONOS_IP,
      port: 1400,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'SOAPAction': `"urn:schemas-upnp-org:service:${service}:1#${action}"`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

function sonosStop() {
  console.log('Stopping Sonos...');
  return sonosRequest(
    '/MediaRenderer/AVTransport/Control',
    'AVTransport', 'Stop',
    '<InstanceID>0</InstanceID>'
  );
}

function sonosPlayTV() {
  console.log('Switching Sonos to TV input and playing...');
  return sonosRequest(
    '/MediaRenderer/AVTransport/Control',
    'AVTransport', 'SetAVTransportURI',
    `<InstanceID>0</InstanceID>
      <CurrentURI>x-sonos-htastream:${SONOS_RINCON}:spdif</CurrentURI>
      <CurrentURIMetaData></CurrentURIMetaData>`
  ).then(() => sonosRequest(
    '/MediaRenderer/AVTransport/Control',
    'AVTransport', 'Play',
    '<InstanceID>0</InstanceID><Speed>1</Speed>'
  ));
}

function sonosMute(mute) {
  console.log(`${mute ? 'Muting' : 'Unmuting'} Sonos...`);
  return sonosRequest(
    '/MediaRenderer/RenderingControl/Control',
    'RenderingControl', 'SetMute',
    `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredMute>${mute ? 1 : 0}</DesiredMute>`
  );
}

// ── Kasa smart plug control ───────────────────────────────────
async function getPlug() {
  if (kasaPlug) return kasaPlug;
  try {
    kasaPlug = await kasaClient.getDevice({ host: KASA_IP });
    console.log('Connected to Kasa plug:', kasaPlug.alias);
    return kasaPlug;
  } catch (err) {
    console.error('Kasa plug not reachable:', err.message);
    return null;
  }
}

async function plugOn() {
  const plug = await getPlug();
  if (!plug) throw new Error('Kasa plug not reachable');
  console.log('Turning Sonos plug ON...');
  await plug.setPowerState(true);
}

async function plugOff() {
  const plug = await getPlug();
  if (!plug) throw new Error('Kasa plug not reachable');
  console.log('Turning Sonos plug OFF...');
  await plug.setPowerState(false);
}

async function plugStatus() {
  const plug = await getPlug();
  if (!plug) return { reachable: false, state: 'unknown' };
  const info = await plug.getSysInfo();
  return { reachable: true, state: info.relay_state === 1 ? 'on' : 'off' };
}

// Check if Sonos is reachable by attempting a TCP connection to port 1400
function sonosReachable() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(1400, SONOS_IP);
  });
}

// ── Roku control (stub) ───────────────────────────────────────
// Roku ECP API: http://ROKU_IP:8060 — no auth required
// Docs: https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md
// TODO: implement Roku commands (keypress, launch, query, etc.)

// ── API Endpoints ─────────────────────────────────────────────

// Gaming Mode: kill Sonos power via plug, then switch TV to speakers
app.post('/audio/gaming', async (req, res) => {
  try {
    console.log('=== Gaming Mode ===');
    // Switch TV first — if TV is off this will fail before we touch Sonos
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'tv_speaker' });
    const plug = await getPlug();
    if (plug) {
      await plugOff();
    } else {
      await sonosStop();
      await sonosMute(true);
    }
    res.json({ success: true, output: 'tv_speaker', sonos: plug ? 'powered_off' : 'stopped' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Normal Mode: power on Sonos via plug, wait for boot, switch TV to ARC
app.post('/audio/normal', async (req, res) => {
  try {
    console.log('=== Normal Mode ===');
    const plug = await getPlug();
    if (plug) {
      await plugOn();
      // Wait for Sonos to boot and become reachable
      console.log('Waiting for Sonos to boot...');
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        if (await sonosReachable()) {
          console.log('Sonos is online');
          // Extra settle time after becoming reachable
          await new Promise(r => setTimeout(r, 3000));
          break;
        }
        attempts++;
        console.log(`Waiting for Sonos... (${attempts})`);
      }
      if (attempts >= 30) {
        throw new Error('Sonos did not come online after power on');
      }
    }
    await sonosPlayTV();
    await sonosMute(false);
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'external_arc' });
    res.json({ success: true, output: 'external_arc', sonos: 'playing' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Headphone Mode: power off Sonos, switch TV to optical + speakers, mute speakers
app.post('/audio/headphone', async (req, res) => {
  try {
    console.log('=== Headphone Mode ===');
    // Switch TV first — if TV is off this will fail before we touch Sonos
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'tv_external_speaker' });
    // Small delay to let TV settle after output switch before muting
    await new Promise(r => setTimeout(r, 500));
    await tvRequest('ssap://audio/setMute', { mute: true });
    const plug = await getPlug();
    if (plug) {
      await plugOff();
    } else {
      await sonosStop();
      await sonosMute(true);
    }
    res.json({ success: true, output: 'tv_external_speaker', muted: true, sonos: plug ? 'powered_off' : 'stopped' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Volume up
app.post('/volume/up', async (req, res) => {
  try {
    await tvRequest('ssap://audio/volumeUp', {});
    const vol = await tvRequest('ssap://audio/getVolume', {});
    const volume = vol.volumeStatus ? vol.volumeStatus.volume : vol.volume;
    res.json({ success: true, volume });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Volume down
app.post('/volume/down', async (req, res) => {
  try {
    await tvRequest('ssap://audio/volumeDown', {});
    const vol = await tvRequest('ssap://audio/getVolume', {});
    const volume = vol.volumeStatus ? vol.volumeStatus.volume : vol.volume;
    res.json({ success: true, volume });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get current audio output status
app.get('/status', async (req, res) => {
  try {
    const result = await tvRequest('ssap://audio/getSoundOutput', {});
    res.json({ output: result.soundOutput || result.output || 'unknown' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Kasa plug on/off/status
app.post('/plug/on', async (req, res) => {
  try {
    await plugOn();
    res.json({ success: true, state: 'on' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plug/off', async (req, res) => {
  try {
    await plugOff();
    res.json({ success: true, state: 'off' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/plug/status', async (req, res) => {
  try {
    const status = await plugStatus();
    res.json(status);
  } catch (err) {
    res.json({ reachable: false, state: 'unknown', error: err.message });
  }
});

// Sonos reachability status
app.get('/sonos/status', async (req, res) => {
  const reachable = await sonosReachable();
  res.json({ reachable });
});

// ── Discovery endpoint ────────────────────────────────────────
function applyDiscovery(results) {
  if (results.tv) {
    if (!process.env.TV_IP) TV_IP = results.tv.ip;
    if (results.tv.mac && !process.env.TV_MAC) TV_MAC = results.tv.mac;
    console.log(`  TV: ${TV_IP}${TV_IP === results.tv.ip ? ' (discovered)' : ' (from .env)'}`);
  }
  if (results.sonos) {
    if (!process.env.SONOS_IP) SONOS_IP = results.sonos.ip;
    if (results.sonos.rincon && !process.env.SONOS_RINCON) SONOS_RINCON = results.sonos.rincon;
    console.log(`  Sonos: ${SONOS_IP}${SONOS_IP === results.sonos.ip ? ' (discovered)' : ' (from .env)'}`);
  }
  if (results.roku) {
    if (!process.env.ROKU_IP) ROKU_IP = results.roku.ip;
    console.log(`  Roku: ${ROKU_IP}${ROKU_IP === results.roku.ip ? ' (discovered)' : ' (from .env)'}`);
  }
  if (results.kasa) {
    if (!process.env.KASA_IP) KASA_IP = results.kasa.ip;
    // Reset cached plug so it reconnects with new IP
    kasaPlug = null;
    console.log(`  Kasa: ${KASA_IP}${KASA_IP === results.kasa.ip ? ' (discovered)' : ' (from .env)'}`);
  }
}

app.get('/discover', async (req, res) => {
  try {
    const results = await discoverDevices();
    applyDiscovery(results);
    res.json({
      discovered: results,
      active: { tv: TV_IP, tvMac: TV_MAC, sonos: SONOS_IP, sonosRincon: SONOS_RINCON, kasa: KASA_IP, roku: ROKU_IP }
    });
  } catch (err) {
    console.error('Discovery error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TV power control ─────────────────────────────────────────
app.get('/tv/status', async (req, res) => {
  res.json({ reachable: tvConnected });
});

app.post('/tv/off', async (req, res) => {
  try {
    await tvRequest('ssap://system/turnOff', {});
    tvConnected = false;
    tvConnection = null;
    res.json({ success: true, message: 'TV is off' });
  } catch (err) {
    console.error('TV off error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/tv/wake', async (req, res) => {
  if (!TV_MAC) {
    return res.status(400).json({ error: 'TV MAC address not known. Run discovery first or set TV_MAC in .env' });
  }

  console.log(`Sending WoL magic packet to ${TV_MAC}...`);
  try {
    await new Promise((resolve, reject) => {
      wol.wake(TV_MAC, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Poll TV port 3001 until it responds (up to 60 seconds)
    console.log('Waiting for TV to wake up...');
    let awake = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const reachable = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(3001, TV_IP);
      });
      if (reachable) {
        awake = true;
        console.log('TV is awake!');
        break;
      }
      console.log(`Waiting for TV... (${i + 1})`);
    }

    if (awake) {
      // Establish WebSocket connection so tvConnected becomes true
      connectTV().catch(() => {});
      res.json({ success: true, message: 'TV is awake' });
    } else {
      res.json({ success: false, message: 'WoL sent but TV did not respond within 60 seconds' });
    }
  } catch (err) {
    console.error('WoL error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Start server ──────────────────────────────────────────────
async function start() {
  // Run discovery before starting (best-effort, don't block on failure)
  try {
    const results = await discoverDevices();
    applyDiscovery(results);
  } catch (err) {
    console.error('Discovery failed, using .env values:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log(`LG TV Remote proxy server running on http://0.0.0.0:${PORT}`);
    console.log(`TV IP: ${TV_IP || 'not configured'}`);
    console.log(`TV MAC: ${TV_MAC || 'not known'}`);
    console.log(`Sonos IP: ${SONOS_IP || 'not configured'}`);
    console.log(`Kasa plug IP: ${KASA_IP || 'not configured'}`);
    console.log(`Roku IP: ${ROKU_IP || 'not configured'}`);
    console.log('');
    console.log('If this is the first time connecting, accept the pairing prompt on your TV.');
  });
}

start();
