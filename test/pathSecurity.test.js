import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import os from 'node:os';
import { validateSafePath, isSensitiveFile, verifyHost, verifyCsrf } from '../server/security/guards.js';

test('Path Security: blocks path traversal outside allowed root', () => {
  const allowedRoot = os.tmpdir();

  // Valid path inside allowedRoot
  const validPath = path.join(allowedRoot, 'subdir', 'file.txt');
  const safe = validateSafePath(validPath, allowedRoot);
  assert.ok(safe.startsWith(allowedRoot));

  // Traversal attempts
  assert.throws(() => {
    validateSafePath('/etc/passwd', allowedRoot);
  }, /Access denied/);

  assert.throws(() => {
    validateSafePath(path.join(allowedRoot, '..', '..', 'system'), allowedRoot);
  }, /Access denied/);
});

test('Path Security: detects sensitive files', () => {
  assert.strictEqual(isSensitiveFile('/home/user/.env'), true);
  assert.strictEqual(isSensitiveFile('/home/user/.env.production'), true);
  assert.strictEqual(isSensitiveFile('/home/user/.ssh/id_rsa'), true);
  assert.strictEqual(isSensitiveFile('/home/user/cert.pem'), true);
  assert.strictEqual(isSensitiveFile('/home/user/token.json'), true);
  assert.strictEqual(isSensitiveFile('/home/user/antigravity-oauth-token'), true);

  // Normal safe files
  assert.strictEqual(isSensitiveFile('/home/user/main.js'), false);
  assert.strictEqual(isSensitiveFile('/home/user/App.tsx'), false);
  assert.strictEqual(isSensitiveFile('/home/user/package.json'), false);

  // Windows-style paths
  assert.strictEqual(isSensitiveFile('C:\\Users\\User\\.env'), true);
  assert.strictEqual(isSensitiveFile('C:\\Users\\User\\.ssh\\id_rsa'), true);
  assert.strictEqual(isSensitiveFile('C:\\Users\\User\\src\\index.ts'), false);
});

test('Host Security: validates Host headers', () => {
  assert.strictEqual(verifyHost({ headers: { host: 'localhost:4300' } }, '127.0.0.1', 4300), true);
  assert.strictEqual(verifyHost({ headers: { host: '127.0.0.1:4300' } }, '127.0.0.1', 4300), true);
  assert.strictEqual(verifyHost({ headers: { host: 'evil-rebinding.com:4300' } }, '127.0.0.1', 4300), false);
  assert.strictEqual(verifyHost({ headers: {} }, '127.0.0.1', 4300), false);
});
