// LG TV Remote - Proxy Server
// Bridges HTTP requests from the webapp to the LG TV via WebSocket

const express = require('express');
const cors = require('cors');
const lgtv = require('lgtv2');

// ── Configuration ──────────────────────────────────────────────
// Set your TV's IP address here, or pass it as an environment variable:
//   TV_IP=192.168.1.100 node server.js
const TV_IP = process.env.TV_IP || '192.168.1.238';
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

// ── API Endpoints ─────────────────────────────────────────────

// Switch audio to TV speakers (for gaming)
app.post('/audio/gaming', async (req, res) => {
  try {
    console.log('Switching to TV Speakers (Gaming Mode)');
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'tv_speaker' });
    res.json({ success: true, output: 'tv_speaker' });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Switch audio to HDMI ARC / Sonos (for normal TV)
app.post('/audio/normal', async (req, res) => {
  try {
    console.log('Switching to HDMI ARC (Normal Mode)');
    await tvRequest('ssap://audio/changeSoundOutput', { output: 'external_arc' });
    res.json({ success: true, output: 'external_arc' });
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
  console.log('');
  console.log('If this is the first time connecting, accept the pairing prompt on your TV.');
});
