const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const port = parseInt(process.argv[3] || '8800', 10);
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.join(root, url);
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found: ' + url); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(port, () => console.log('Serving ' + root + ' on http://localhost:' + port));
