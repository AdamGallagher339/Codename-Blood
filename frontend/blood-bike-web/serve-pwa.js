#!/usr/bin/env node
/**
 * Lightweight PWA server that:
 * 1. Serves the production build (dist/blood-bike-web/browser) as static files
 * 2. Proxies /api/* requests to the Go backend on localhost:8080
 * 3. Falls back to index.html for Angular client-side routing
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 4200;
const BACKEND = 'http://localhost:8080';
const DIST = path.join(__dirname, 'dist', 'blood-bike-web', 'browser');

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map':  'application/json',
};

function proxyToBackend(req, res) {
  const opts = {
    hostname: 'localhost',
    port: 8080,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:8080' },
  };
  const proxy = http.request(opts, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res, { end: true });
  });
  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend unavailable');
  });
  req.pipe(proxy, { end: true });
}

function serveStatic(req, res) {
  let filePath = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  // Directory → index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  // If file exists, serve it
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  // Fallback to index.html (Angular SPA routing)
  const index = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(index).pipe(res);
}

const server = http.createServer((req, res) => {
  // Proxy /api requests to Go backend
  if (req.url.startsWith('/api')) {
    return proxyToBackend(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PWA server running at http://0.0.0.0:${PORT}`);
  console.log(`Proxying /api/* → ${BACKEND}`);
  console.log(`Serving static files from ${DIST}`);
});
