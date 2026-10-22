import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { CONFIG } from '../config.js';

export function getSystemEnvironment() {
  const isWin = process.platform === 'win32';

  let agyVersion = 'unknown';
  try {
    agyVersion = execFileSync('agy', ['--version'], { encoding: 'utf-8', timeout: 3000, shell: isWin }).trim();
  } catch {}

  let nodeVersion = process.version;
  let npmVersion = 'unknown';
  try {
    npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf-8', timeout: 3000, shell: isWin }).trim();
  } catch {}

  let gitVersion = 'unknown';
  try {
    gitVersion = execFileSync('git', ['--version'], { encoding: 'utf-8', timeout: 3000, shell: isWin }).trim();
  } catch {}

  let diskInfo = 'unknown';
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync('.');
      const freeGb = ((stats.bfree * stats.bsize) / (1024 ** 3)).toFixed(1);
      const totalGb = ((stats.blocks * stats.bsize) / (1024 ** 3)).toFixed(1);
      diskInfo = `${freeGb} GB free of ${totalGb} GB`;
    } else {
      const df = execFileSync('df', ['-h', '.'], { encoding: 'utf-8', timeout: 3000 });
      const lines = df.trim().split('\n');
      if (lines.length > 1) diskInfo = lines[1];
    }
  } catch {}

  return {
    os: os.type(),
    platform: process.platform,
    arch: process.arch,
    kernel: os.release(),
    hostname: os.hostname(),
    uptime: Math.round(os.uptime()),
    freeMem: Math.round(os.freemem() / (1024 * 1024)),
    totalMem: Math.round(os.totalmem() / (1024 * 1024)),
    agyVersion,
    nodeVersion,
    npmVersion,
    gitVersion,
    diskInfo,
    agyDataDir: CONFIG.AGY_DIR
  };
}

export function getMcpServers() {
  const isWin = process.platform === 'win32';
  try {
    const out = execFileSync('agy', ['mcp', 'list'], { encoding: 'utf-8', timeout: 5000, shell: isWin });
    const lines = out.trim().split('\n');
    const servers = [];
    if (lines.length > 1) {
      // First line is header: NAME TYPE STATUS COMMAND/URL
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 3) {
          servers.push({
            name: parts[0],
            type: parts[1],
            status: parts[2],
            commandOrUrl: parts.slice(3).join(' ')
          });
        }
      }
    }
    return servers;
  } catch (err) {
    // Fallback: inspect directory ~/.gemini/antigravity-cli/mcp
    const mcpDir = path.join(CONFIG.AGY_DIR, 'mcp');
    if (fs.existsSync(mcpDir)) {
      const dirs = fs.readdirSync(mcpDir, { withFileTypes: true });
      return dirs.filter(d => d.isDirectory()).map(d => ({
        name: d.name,
        type: 'local',
        status: 'configured',
        commandOrUrl: path.join(mcpDir, d.name)
      }));
    }
    return [];
  }
}

export function getPlugins() {
  const isWin = process.platform === 'win32';
  try {
    const out = execFileSync('agy', ['plugin', 'list'], { encoding: 'utf-8', timeout: 5000, shell: isWin });
    const lines = out.trim().split('\n');
    const plugins = [];
    let current = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (current) plugins.push(current);
        // e.g. - gemini-api (enabled, 2.2.0)
        const match = trimmed.match(/-\s+([^\s]+)\s+\(([^)]+)\)/);
        current = {
          name: match ? match[1] : trimmed.replace('- ', ''),
          status: match ? match[2] : 'installed',
          details: {}
        };
      } else if (current && trimmed.includes(':')) {
        const [k, ...v] = trimmed.split(':');
        current.details[k.trim()] = v.join(':').trim();
      }
    }
    if (current) plugins.push(current);
    return plugins;
  } catch (err) {
    return [];
  }
}

export function getBackgroundTasks(conversationId = null) {
  const brainDir = path.join(CONFIG.AGY_DIR, 'brain');
  if (!fs.existsSync(brainDir)) return [];

  const targetIds = conversationId ? [conversationId] : fs.readdirSync(brainDir);
  const tasks = [];

  for (const cid of targetIds) {
    const tasksDir = path.join(brainDir, cid, '.system_generated', 'tasks');
    if (!fs.existsSync(tasksDir)) continue;

    const files = fs.readdirSync(tasksDir);
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(tasksDir, file);
        const stat = fs.statSync(filePath);
        tasks.push({
          conversationId: cid,
          taskId: file.replace('.log', ''),
          fileName: file,
          size: stat.size,
          mtime: stat.mtimeMs,
          path: filePath
        });
      }
    }
  }

  // Sort by most recently modified
  tasks.sort((a, b) => b.mtime - a.mtime);
  return tasks;
}

export function getTaskLog(conversationId, taskId) {
  const logFile = path.join(CONFIG.AGY_DIR, 'brain', conversationId, '.system_generated', 'tasks', `${taskId}.log`);
  if (!fs.existsSync(logFile)) {
    throw new Error('Task log file not found');
  }
  return fs.readFileSync(logFile, 'utf-8');
}
