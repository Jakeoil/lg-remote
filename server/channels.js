// channels.js — Express router for channel/app launching
// Mounted at /channels in server.js
const express = require('express');

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

  return router;
};
