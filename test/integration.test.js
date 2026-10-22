import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import path from 'node:path';
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';

const TEST_PORT = 4399;
const projectRoot = path.resolve(import.meta.dirname, '..');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('Integration Test: Server lifecycle and API endpoints', async () => {
  // Start server on test port with explicit cwd
  const serverProc = spawn('node', ['server/index.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(TEST_PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Wait until server logs "Listening on"
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timed out')), 5000);
    serverProc.stdout.on('data', chunk => {
      if (chunk.toString().includes('Listening on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProc.stderr.on('data', chunk => {
      console.error('SERVER STDERR:', chunk.toString());
    });
  });

  try {
    // 1. Static HTML serving
    const indexRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(indexRes.statusCode, 200);
    assert.ok(indexRes.body.includes('<!DOCTYPE html>'));
    assert.ok(indexRes.body.includes('Antigravity Control Center'));

    // 2. Host header security check
    const badHostRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/',
      method: 'GET',
      headers: { host: 'evil-attacker.com:4399' }
    });
    assert.strictEqual(badHostRes.statusCode, 403);
    assert.ok(badHostRes.body.includes('Invalid Host Header'));

    // 3. CSRF token
    const csrfRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/csrf-token',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(csrfRes.statusCode, 200);
    const csrfData = JSON.parse(csrfRes.body);
    assert.ok(csrfData.csrfToken);

    // 4. Status API
    const statusRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/status',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(statusRes.statusCode, 200);
    const statusData = JSON.parse(statusRes.body);
    assert.strictEqual(statusData.status, 'online');

    // 5. Conversations list
    const convsRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/conversations?limit=3',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(convsRes.statusCode, 200);
    const convsData = JSON.parse(convsRes.body);
    assert.ok(Array.isArray(convsData.conversations));
    assert.ok(convsData.conversations.length > 0);

    // 6. Live snapshot
    const snapRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/live/snapshot',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(snapRes.statusCode, 200);
    const snapData = JSON.parse(snapRes.body);
    assert.ok(snapData);
    assert.ok(Array.isArray(snapData.activeSessions));

    // 7. Settings API
    const settingsRes = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/settings',
      method: 'GET',
      headers: { host: `127.0.0.1:${TEST_PORT}` }
    });
    assert.strictEqual(settingsRes.statusCode, 200);
    const settingsData = JSON.parse(settingsRes.body);
    assert.ok(settingsData.settings);
    assert.ok(Array.isArray(settingsData.supportedModels));

    // 8. WebSocket connection
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`, {
      headers: { origin: `http://127.0.0.1:${TEST_PORT}` }
    });

    const wsMessage = await new Promise((resolve, reject) => {
      ws.on('message', (msg) => {
        resolve(JSON.parse(msg.toString()));
      });
      ws.on('error', reject);
    });

    assert.strictEqual(wsMessage.type, 'connected');
    ws.close();

  } finally {
    serverProc.kill('SIGTERM');
  }
});
