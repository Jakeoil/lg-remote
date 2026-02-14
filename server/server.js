// LG TV Remote - Proxy Server
// Bridges HTTP requests from the webapp to the LG TV via WebSocket
// Also controls Sonos soundbar via local UPnP/SOAP API

const express = require('express');
const cors = require('cors');
const lgtv = require('lgtv2');
const http = require('http');

// ── Configuration ──────────────────────────────────────────────
const TV_IP = process.env.TV_IP || '192.168.1.238';
const SONOS_IP = process.env.SONOS_IP || '192.168.1.245';
const SONOS_RINCON = 'RINCON_74CA606BC09101400';
const ROKU_IP = process.env.ROKU_IP || '192.168.1.244';
const ROKU_PORT = 8060; // Roku ECP (External Control Protocol)
const PORT = process.env.PORT || 3000;

// ── Express setup ──────────────────────────────────────────────
const app = express();
app.use(cors());            // allow requests from GitHub Pages
app.use(express.json());

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

// ── Roku control (stub) ───────────────────────────────────────
// Roku ECP API: http://ROKU_IP:8060 — no auth required
// Docs: https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md
// TODO: implement Roku commands (keypress, launch, query, etc.)

// ── API Endpoints ─────────────────────────────────────────────

// Gaming Mode: stop Sonos, then switch TV to speakers
app.post('/audio/gaming', async (req, res) => {
  try {
    console.log('=== Gaming Mode ===');
    await sonosStop();
    await sonosMute(true);
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'tv_speaker' });
    res.json({ success: true, output: 'tv_speaker', sonos: 'stopped' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Normal Mode: wake Sonos to TV input, then switch TV to ARC
app.post('/audio/normal', async (req, res) => {
  try {
    console.log('=== Normal Mode ===');
    await sonosPlayTV();
    await sonosMute(false);
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'external_arc' });
    res.json({ success: true, output: 'external_arc', sonos: 'playing' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Volume up
app.post('/volume/up', async (req, res) => {
  try {
    await tvRequest('ssap://audio/volumeUp', {});
    res.json({ success: true });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Volume down
app.post('/volume/down', async (req, res) => {
  try {
    await tvRequest('ssap://audio/volumeDown', {});
    res.json({ success: true });
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

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'running', tvConnected });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`LG TV Remote proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`TV IP: ${TV_IP}`);
  console.log(`Sonos IP: ${SONOS_IP}`);
  console.log(`Roku IP: ${ROKU_IP}`);
  console.log('');
  console.log('If this is the first time connecting, accept the pairing prompt on your TV.');
});
