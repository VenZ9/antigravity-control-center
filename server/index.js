import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { verifyHost } from './security/guards.js';
import { handleApiRequest } from './routes/api.js';
import { handleFileUpload } from './services/uploadService.js';
import { setupWebSocketServer } from './routes/wsHandler.js';
import { startLiveMonitoring, stopLiveMonitoring } from './services/liveMonitorService.js';
import { syncConversationFtsIndex } from './services/conversationService.js';
import { closeControlCenterDb } from './db/controlCenterDb.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const distDir = path.join(process.cwd(), 'dist');

const server = http.createServer(async (req, res) => {
  // 1. Host header security verification
  if (!verifyHost(req, CONFIG.HOST, CONFIG.PORT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Invalid Host Header');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 2. Handle API endpoints
  if (pathname.startsWith('/api/')) {
    // Stream multipart file uploads directly to upload service
    if (pathname === '/api/upload' && req.method === 'POST') {
      handleFileUpload(req, res);
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Safeguard max payload size (5MB)
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      await handleApiRequest(req, res, pathname, url.searchParams, body);
    });
    return;
  }

  // 3. Serve Static Assets (Production SPA)
  let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);

  // If path doesn't exist, fall back to SPA index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    });
    res.end(content);
    return;
  }

  // Default fallback if dist not built yet
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Antigravity Control Center</title></head>
      <body style="background:#0b0d13;color:#e2e8f0;font-family:sans-serif;padding:2rem;text-align:center;">
        <h2>Antigravity Control Center Server Running</h2>
        <p>Port: ${CONFIG.PORT} | Host: ${CONFIG.HOST}</p>
        <p>Frontend assets are building. Please wait or run <code>npm run build</code>.</p>
      </body>
    </html>
  `);
});

// Setup WebSockets
setupWebSocketServer(server, CONFIG);

// Start Server
server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`[Antigravity Control Center] Listening on http://${CONFIG.HOST}:${CONFIG.PORT}`);
  
  // Background initialization
  try {
    startLiveMonitoring();
    syncConversationFtsIndex();
    console.log('[Antigravity Control Center] Live monitoring & FTS index initialized.');
  } catch (err) {
    console.error('[Antigravity Control Center] Initialization warning:', err.message);
  }
});

// Graceful termination
const shutdown = () => {
  console.log('\n[Antigravity Control Center] Shutting down cleanly...');
  stopLiveMonitoring();
  closeControlCenterDb();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
