import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

// Generate a random CSRF secret on server startup
let csrfSecret = crypto.randomBytes(32).toString('hex');

export function getCsrfToken() {
  return csrfSecret;
}

export function verifyCsrf(req) {
  // Safe HTTP methods don't need CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true;
  }
  const token = req.headers['x-csrf-token'];
  return token && token === csrfSecret;
}

export function verifyHost(req, allowedHost, allowedPort) {
  const hostHeader = req.headers['host'];
  if (!hostHeader) return false;

  const validHosts = [
    `127.0.0.1:${allowedPort}`,
    `localhost:${allowedPort}`,
    `127.0.0.1`,
    `localhost`
  ];

  if (allowedHost && !validHosts.includes(`${allowedHost}:${allowedPort}`)) {
    validHosts.push(`${allowedHost}:${allowedPort}`);
    validHosts.push(allowedHost);
  }

  // Remove port if present for base comparison
  return validHosts.includes(hostHeader);
}

export function verifyWsOrigin(origin, allowedHost, allowedPort) {
  if (!origin) return true; // Local clients might not send Origin
  try {
    const url = new URL(origin);
    const validHostnames = ['127.0.0.1', 'localhost'];
    if (allowedHost) validHostnames.push(allowedHost);
    return validHostnames.includes(url.hostname);
  } catch {
    return false;
  }
}

// Sensitive file patterns that must never be read or previewed
const SENSITIVE_PATTERNS = [
  /(^|[/\\])\.env(\..+)?$/i,
  /(^|[/\\])id_rsa(\..+)?$/i,
  /(^|[/\\])id_ed25519(\..+)?$/i,
  /\.(pem|key|pkcs12|p12|pfx|keystore)$/i,
  /token/i,
  /secret/i,
  /credential/i,
  /(^|[/\\])\.git[/\\]objects[/\\]/i,
  /(^|[/\\])antigravity-oauth-token$/i
];

export function isSensitiveFile(filePath) {
  const base = path.basename(filePath);
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(filePath) || pattern.test(base));
}

export function validateSafePath(requestedPath, allowedRoot) {
  if (!requestedPath || !allowedRoot) {
    throw new Error('Path and allowed root are required');
  }

  // Resolve absolute paths
  const resolvedRoot = path.resolve(allowedRoot);
  const resolvedPath = path.resolve(requestedPath);

  // Must start with allowed root
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Access denied: Path outside allowed workspace');
  }

  // If path exists, check realpath to prevent symlink traversal
  if (fs.existsSync(resolvedPath)) {
    try {
      const real = fs.realpathSync(resolvedPath);
      const realRoot = fs.realpathSync(resolvedRoot);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new Error('Access denied: Symlink resolves outside allowed workspace');
      }
    } catch (err) {
      throw new Error(`Failed to resolve canonical path: ${err.message}`);
    }
  }

  return resolvedPath;
}
