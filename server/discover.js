// Auto-discovery for network devices
// Uses mDNS (Bonjour), SSDP, and TP-Link broadcast to find devices

const { execFile } = require('child_process');
const Bonjour = require('bonjour-service');
const { Client: SsdpClient } = require('node-ssdp');
const { Client: KasaClient } = require('tplink-smarthome-api');

const DISCOVERY_TIMEOUT = 5000; // 5 seconds

async function discoverDevices() {
  console.log('Starting device discovery...');
  const results = {};

  await Promise.all([
    discoverMdns(results),
    discoverSsdp(results),
    discoverKasa(results),
  ]);

  // Look up TV MAC from ARP table if we found an IP but no MAC
  if (results.tv && results.tv.ip && !results.tv.mac) {
    results.tv.mac = await arpLookup(results.tv.ip);
    if (results.tv.mac) {
      console.log(`  TV MAC (from ARP): ${results.tv.mac}`);
    }
  }

  console.log('Discovery results:', JSON.stringify(results, null, 2));
  return results;
}

// mDNS: find LG TV via Google Cast and Sonos via _sonos._tcp
function discoverMdns(results) {
  return new Promise((resolve) => {
    const bonjour = new Bonjour.default();

    // Browse for Google Cast devices (LG TV advertises as one)
    const castBrowser = bonjour.find({ type: 'googlecast' }, (service) => {
      const name = (service.name || '').toLowerCase();
      const txt = service.txt || {};
      const model = (txt.md || '').toLowerCase();
      if (name.includes('lg') || model.includes('oled') || model.includes('lg')) {
        const ip = service.addresses && service.addresses.find(a => a.includes('.'));
        if (ip && !results.tv) {
          // Extract MAC from service id field (format: UUID with MAC embedded)
          let mac = null;
          const id = txt.id;
          if (id) {
            // Google Cast id is often a hex string; try to extract MAC-like pattern
            const macMatch = id.match(/([0-9a-f]{2}[:-]){5}[0-9a-f]{2}/i);
            if (macMatch) mac = macMatch[0];
          }
          results.tv = { ip, mac, source: 'mdns', name: service.name };
          console.log(`  Found LG TV: ${ip} (${service.name})`);
        }
      }
    });

    // Browse for Sonos devices
    const sonosBrowser = bonjour.find({ type: 'sonos' }, (service) => {
      const ip = service.addresses && service.addresses.find(a => a.includes('.'));
      if (ip && !results.sonos) {
        // Extract RINCON from service name or txt records
        let rincon = null;
        const fullName = service.fqdn || service.name || '';
        const rinconMatch = fullName.match(/(RINCON_[A-Z0-9]+)/);
        if (rinconMatch) rincon = rinconMatch[1];
        results.sonos = { ip, rincon, source: 'mdns', name: service.name };
        console.log(`  Found Sonos: ${ip} (${service.name})`);
      }
    });

    setTimeout(() => {
      castBrowser.stop();
      sonosBrowser.stop();
      bonjour.destroy();
      resolve();
    }, DISCOVERY_TIMEOUT);
  });
}

// SSDP: find Roku via roku:ecp search target
function discoverSsdp(results) {
  return new Promise((resolve) => {
    const client = new SsdpClient();

    client.on('response', (headers, statusCode, rinfo) => {
      const st = headers.ST || '';
      const location = headers.LOCATION || '';

      // Roku: search target is roku:ecp
      if (st.includes('roku') && !results.roku) {
        // Location header contains the Roku URL, e.g. http://192.168.1.244:8060/
        const urlMatch = location.match(/http:\/\/([\d.]+)/);
        const ip = urlMatch ? urlMatch[1] : rinfo.address;
        results.roku = { ip, source: 'ssdp' };
        console.log(`  Found Roku: ${ip}`);
      }

      // Sonos fallback via SSDP if not found via mDNS
      if (!results.sonos && location.includes(':1400')) {
        const urlMatch = location.match(/http:\/\/([\d.]+)/);
        if (urlMatch) {
          results.sonos = { ip: urlMatch[1], rincon: null, source: 'ssdp' };
          console.log(`  Found Sonos (SSDP fallback): ${urlMatch[1]}`);
        }
      }
    });

    // Search for Roku specifically
    client.search('roku:ecp');
    // Also do a general search for Sonos fallback
    client.search('urn:schemas-upnp-org:device:ZonePlayer:1');

    setTimeout(() => {
      client.stop();
      resolve();
    }, DISCOVERY_TIMEOUT);
  });
}

// Kasa: use tplink-smarthome-api broadcast discovery
function discoverKasa(results) {
  return new Promise((resolve) => {
    const client = new KasaClient();

    client.startDiscovery({
      deviceTypes: ['plug'],
      discoveryTimeout: DISCOVERY_TIMEOUT,
    });

    client.on('device-new', (device) => {
      if (!results.kasa) {
        results.kasa = { ip: device.host, source: 'kasa', name: device.alias };
        console.log(`  Found Kasa plug: ${device.host} (${device.alias})`);
      }
    });

    setTimeout(() => {
      client.stopDiscovery();
      resolve();
    }, DISCOVERY_TIMEOUT);
  });
}

// Look up MAC address from ARP table for a given IP
function arpLookup(ip) {
  return new Promise((resolve) => {
    execFile('arp', [ip], (err, stdout) => {
      if (err) return resolve(null);
      // macOS: "? (192.168.1.238) at 44:27:45:6:d6:e2 on en0"
      // Linux: "Address HWtype HWaddress..." or "192.168.1.238 ether 44:27:45:06:d6:e2 C eth0"
      const match = stdout.match(/([0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2}/i);
      if (match) {
        // Normalize to colon-separated, zero-padded uppercase
        const mac = match[0].split(/[:-]/).map(b => b.padStart(2, '0').toUpperCase()).join(':');
        resolve(mac);
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = { discoverDevices };
