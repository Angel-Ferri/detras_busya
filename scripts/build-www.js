const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

const HTML_FILES = [
  'index.html',
  'como_llegar.html',
  'mapa.html',
  'paradas.html',
  'chofer.html',
  'panel.html',
  'panel_paradas.html'
];

const DIRS = ['estilos', 'script', 'datos', 'vendor'];

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(src, dst, skip) {
  if (!fs.existsSync(src)) return;
  mkdirp(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip && skip(entry.name, path.join(src, entry.name))) return;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

// Limpia y crea www/
rmrf(WWW);
mkdirp(WWW);

// HTML: copiar y quitar analytics/ads del APK (solo web los usa)
for (const f of HTML_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) continue;
  let html = fs.readFileSync(src, 'utf8');
  // Eliminar gtag (script externo + bloque inline)
  html = html.replace(/<script\s+async\s+src="https:\/\/www\.googletagmanager\.com\/gtag\/js[^"]*"><\/script>\s*/g, '');
  html = html.replace(/<script>\s*\n\s*window\.dataLayer[\s\S]*?<\/script>\s*/g, '');
  // Eliminar AdSense
  html = html.replace(/<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com[^"]*"><\/script>\s*/g, '');
  fs.writeFileSync(path.join(WWW, f), html, 'utf8');
}

// Carpetas principales
for (const d of DIRS) {
  copyDir(path.join(ROOT, d), path.join(WWW, d), (name) => {
    // scripts muertos / copias
    if (d === 'script' && (name === 'planificador copy 2.js' || name === 'planificador feito.js' || name === 'panel.demo.js')) return true;
    // estilos copia
    if (d === 'estilos' && name === 'style copy.css') return true;
    return false;
  });
}

// Tiles: solo z13 a z16 (maxNativeZoom 16 en el APK)
const tilesSrc = path.join(ROOT, 'tiles');
const tilesDst = path.join(WWW, 'tiles');
if (fs.existsSync(tilesSrc)) {
  mkdirp(tilesDst);
  for (const z of ['13', '14', '15', '16']) {
    const s = path.join(tilesSrc, 'osm', z);
    const d = path.join(tilesDst, 'osm', z);
    if (fs.existsSync(s)) copyDir(s, d);
  }
}

// Icono y favicon
for (const f of ['autobus-escolar.ico']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
}

// Manifest y service worker (si existen)
for (const f of ['manifest.webmanifest', 'sw.js']) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
}

console.log('www/ generada correctamente.');
