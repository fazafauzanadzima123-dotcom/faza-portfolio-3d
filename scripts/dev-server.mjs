import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function loadDotEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadDotEnvLocal();

function startPythonBridge() {
  return new Promise((resolve, reject) => {
    const pyScript = [
      'import sys',
      'from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer',
      'from pathlib import Path',
      `api_dir = r"${path.join(ROOT_DIR, 'api')}"`,
      'if api_dir not in sys.path: sys.path.insert(0, api_dir)',
      'import security_check, export_cv',
      'class Router(BaseHTTPRequestHandler):',
      '    def do_GET(self):',
      '        if self.path.startswith("/api/export_cv"):',
      '            export_cv.handler.do_GET(self)',
      '        elif self.path.startswith("/api/security_check"):',
      '            security_check.handler.do_GET(self)',
      '        else:',
      '            self.send_response(404); self.end_headers()',
      '    def do_POST(self):',
      '        if self.path.startswith("/api/security_check"):',
      '            security_check.handler.do_POST(self)',
      '        else:',
      '            self.send_response(404); self.end_headers()',
      '    def log_message(self, fmt, *args): return',
      'srv = ThreadingHTTPServer(("127.0.0.1", 0), Router)',
      'print(f"PY_PORT={srv.server_address[1]}", flush=True)',
      'srv.serve_forever()'
    ].join('\n');

    const child = spawn('python', ['-u', '-c', pyScript], {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let settled = false;
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      const match = text.match(/PY_PORT=(\d+)/);
      if (match && !settled) {
        settled = true;
        resolve({ child, port: Number(match[1]) });
      }
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(`[py-bridge] ${chunk.toString('utf8')}`);
    });

    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`Python bridge exited early with code ${code}`));
      }
    });
  });
}

async function readIncomingBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleNodeApi(req, res, moduleRelPath) {
  const modUrl = pathToFileURL(path.join(ROOT_DIR, moduleRelPath)).href;
  const mod = await import(`${modUrl}?t=${Date.now()}`);
  const method = (req.method || 'GET').toUpperCase();
  const fn = mod[method];
  if (typeof fn !== 'function') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Metode HTTP tidak didukung.' }));
    return;
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await readIncomingBody(req);
  const fullUrl = `http://${req.headers.host || `127.0.0.1:${PORT}`}${req.url}`;
  const webReq = new Request(fullUrl, {
    method,
    headers: req.headers,
    body
  });
  const webRes = await fn(webReq);
  const resHeaders = { ...SECURITY_HEADERS };
  webRes.headers.forEach((value, key) => {
    resHeaders[key] = value;
  });
  res.writeHead(webRes.status, resHeaders);
  const arrayBuf = await webRes.arrayBuffer();
  res.end(Buffer.from(arrayBuf));
}

async function proxyPythonApi(req, res, pyPort) {
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readIncomingBody(req);
  const upstream = await fetch(`http://127.0.0.1:${pyPort}${req.url}`, {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    body
  });
  const resHeaders = { ...SECURITY_HEADERS };
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'transfer-encoding') {
      resHeaders[key] = value;
    }
  });
  res.writeHead(upstream.status, resHeaders);
  const arrayBuf = await upstream.arrayBuffer();
  res.end(Buffer.from(arrayBuf));
}

async function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(PUBLIC_DIR, safePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end('Forbidden');
    return;
  }

  let targetFile = fullPath;
  try {
    const info = await stat(targetFile);
    if (info.isDirectory()) {
      targetFile = path.join(targetFile, 'index.html');
    }
  } catch {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(targetFile).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileBuffer = await readFile(targetFile);
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': contentType });
  res.end(fileBuffer);
}

const pyBridge = await startPythonBridge();

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/api/health') {
      await handleNodeApi(req, res, 'api/health.js');
    } else if (pathname === '/api/portfolio') {
      await handleNodeApi(req, res, 'api/portfolio.js');
    } else if (pathname === '/api/contact') {
      await handleNodeApi(req, res, 'api/contact.js');
    } else if (pathname === '/api/security_check' || pathname === '/api/export_cv') {
      await proxyPythonApi(req, res, pyBridge.port);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (error) {
    console.error('dev_server_error', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Kesalahan server pengembangan lokal.' }));
  }
});

function shutdown() {
  pyBridge.child.kill();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Faza portfolio dev server listening at http://127.0.0.1:${PORT}`);
});
