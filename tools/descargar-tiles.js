const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const TILES = path.join(ROOT, 'tiles', 'osm');

// Bounding box de Villa Mercedes + margen (para cubrir las paradas de acceso).
const BOUNDS = { minLat: -33.735, maxLat: -33.600, minLng: -65.525, maxLng: -65.380 };

function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function tileUrl(z, x, y) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function downloadOne(z, x, y) {
  return new Promise((resolve) => {
    const dir = path.join(TILES, String(z), String(x));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, y + '.png');
    if (fs.existsSync(file) && fs.statSync(file).size > 0) { resolve('skip'); return; }
    const opts = { headers: { 'User-Agent': 'BusyaOffline/1.0 (+https://github.com/Angel-Ferri/detras_busya)' } };
    https.get(tileUrl(z, x, y), opts, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve('http' + res.statusCode); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 100) { resolve('small'); return; }
        fs.writeFileSync(file, buf);
        resolve('ok');
      });
    }).on('error', (e) => resolve('err:' + e.code));
  });
}

async function main() {
  const tasks = [];
  for (let z = 13; z <= 16; z++) {
    const tl = latLngToTile(BOUNDS.maxLat, BOUNDS.minLng, z);
    const br = latLngToTile(BOUNDS.minLat, BOUNDS.maxLng, z);
    for (let x = tl.x; x <= br.x; x++) {
      for (let y = tl.y; y <= br.y; y++) {
        tasks.push({ z, x, y });
      }
    }
  }
  console.log('Tiles a verificar:', tasks.length);
  let ok = 0, skip = 0, fail = 0;
  const CONC = 4;
  for (let i = 0; i < tasks.length; i += CONC) {
    const batch = tasks.slice(i, i + CONC);
    const results = await Promise.all(batch.map(t => downloadOne(t.z, t.x, t.y)));
    for (const r of results) {
      if (r === 'ok') ok++;
      else if (r === 'skip') skip++;
      else fail++;
    }
    // Pausa para respetar la politica de uso de tiles de OSM.
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`Descargados: ${ok}, ya existian: ${skip}, fallidos: ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
