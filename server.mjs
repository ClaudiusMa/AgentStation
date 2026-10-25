// AgentStation local server: static public/, GET /api/state, GET /api/stream (SSE).
import http from 'node:http';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './lib/collect.mjs';

const PORT = Number(process.env.PORT) || 4477;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MIN_INTERVAL_MS = 2000; // collect at most this often, however many clients
const HEARTBEAT_MS = 15000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// ---------- shared, rate-limited collection ----------
let latest = null;      // { state, json, body } body = json without generatedAt, for change detection
let lastRun = 0;
let inflight = null;

function getState() {
  if (latest && Date.now() - lastRun < MIN_INTERVAL_MS) return Promise.resolve(latest);
  if (inflight) return inflight;
  lastRun = Date.now();
  inflight = collect()
    .then((state) => {
      const { generatedAt, ...rest } = state;
      latest = { state, json: JSON.stringify(state), body: JSON.stringify(rest) };
      return latest;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

// ---------- SSE ----------
const clients = new Set(); // { res, sentBody }
let ticker = null;

function send(client, snap) {
  if (client.sentBody === snap.body) return;
  client.sentBody = snap.body;
  client.res.write(`event: state\ndata: ${snap.json}\n\n`);
}

async function tick() {
  try {
    const snap = await getState();
    for (const c of clients) send(c, snap);
  } catch (e) {
    for (const c of clients) c.res.write(`event: error\ndata: ${JSON.stringify({ error: String(e.message || e) })}\n\n`);
  }
}

function startTicker() {
  if (ticker) return;
  ticker = setInterval(tick, MIN_INTERVAL_MS);
  ticker.hb = setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, HEARTBEAT_MS);
}
function stopTicker() {
  if (!ticker || clients.size) return;
  clearInterval(ticker); clearInterval(ticker.hb); ticker = null;
}

function stream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const client = { res, sentBody: null };
  clients.add(client);
  startTicker();
  getState().then((snap) => send(client, snap), () => {});
  req.on('close', () => { clients.delete(client); stopTicker(); });
}

// ---------- static ----------
async function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  let file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    let st = await fsp.stat(file);
    if (st.isDirectory()) { file = path.join(file, 'index.html'); st = await fsp.stat(file); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    (await fsp.open(file)).createReadStream().pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  if (pathname === '/api/state') {
    try {
      const snap = await getState();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(snap.json);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  if (pathname === '/api/stream') return stream(req, res);
  return serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => console.log(`AgentStation on http://localhost:${PORT}`));
