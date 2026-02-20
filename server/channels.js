// channels.js — Express router for channel/app launching
// Mounted at /channels in server.js
const express = require('express');
const WebSocket = require('ws');

const VALID_KEYS = new Set(['UP','DOWN','LEFT','RIGHT','ENTER','BACK','HOME','MENU','EXIT']);

// Cached pointer input socket
let inputSocket = null;

async function getInputSocket(tvRequest) {
  if (inputSocket && inputSocket.readyState === WebSocket.OPEN) {
    return inputSocket;
  }
  const result = await tvRequest('ssap://com.webos.service.networkinput/getPointerInputSocket', {});
  const socketPath = result.socketPath;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(socketPath, { rejectUnauthorized: false });
    ws.on('open', () => {
      inputSocket = ws;
      resolve(ws);
    });
    ws.on('close', () => { inputSocket = null; });
    ws.on('error', (err) => { inputSocket = null; reject(err); });
    setTimeout(() => reject(new Error('Input socket timeout')), 5000);
  });
}

module.exports = function(tvRequest) {
  const router = express.Router();

  // List TV channels (for discovery)
  router.get('/list', async (req, res) => {
    try {
      const result = await tvRequest('ssap://tv/getChannelList', {});
      res.json(result.channelList || result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all installed launch points (for discovery)
  router.get('/apps', async (req, res) => {
    try {
      const result = await tvRequest('ssap://com.webos.applicationManager/listLaunchPoints', {});
      res.json(result.launchPoints.map(a => ({ id: a.id, title: a.title })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Launch a streaming app by ID
  router.post('/launch', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing app id' });
      await tvRequest('ssap://system.launcher/launch', { id });
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tune to an OTA channel by signalChannelId
  router.post('/tune', async (req, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
      await tvRequest('ssap://tv/openChannel', { channelId });
      res.json({ success: true, channelId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send a navigation key press
  router.post('/key', async (req, res) => {
    try {
      const { key } = req.body;
      if (!key || !VALID_KEYS.has(key)) {
        return res.status(400).json({ error: `Invalid key. Valid: ${[...VALID_KEYS].join(', ')}` });
      }
      const ws = await getInputSocket(tvRequest);
      ws.send(JSON.stringify({ type: 'button', name: key }));
      res.json({ success: true, key });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
