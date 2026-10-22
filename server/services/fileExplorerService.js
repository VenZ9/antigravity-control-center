import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CONFIG } from '../config.js';
import { validateSafePath, isSensitiveFile } from '../security/guards.js';

export function listDirectory(dirPath, allowedRoot = CONFIG.WORKSPACE_ROOT) {
  const safeDir = validateSafePath(dirPath || allowedRoot, allowedRoot);

  if (!fs.existsSync(safeDir)) {
    throw new Error('Directory does not exist');
  }

  const stat = fs.statSync(safeDir);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  const entries = fs.readdirSync(safeDir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    // Hide .git internals from tree
    if (entry.name === '.git') continue;

    const fullPath = path.join(safeDir, entry.name);
    const isSensitive = isSensitiveFile(fullPath);

    result.push({
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      isSymlink: entry.isSymbolicLink(),
      isSensitive
    });
  }

  // Sort directories first, then alphabetically
  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    currentPath: safeDir,
    parentPath: safeDir !== path.resolve(allowedRoot) ? path.dirname(safeDir) : null,
    entries: result
  };
}

export function readFilePreview(filePath, allowedRoot = CONFIG.WORKSPACE_ROOT) {
  const safeFile = validateSafePath(filePath, allowedRoot);

  if (isSensitiveFile(safeFile)) {
    throw new Error('Access denied: Sensitive file cannot be previewed');
  }

  if (!fs.existsSync(safeFile)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(safeFile);
  if (stat.isDirectory()) {
    throw new Error('Path is a directory');
  }

  // Reject files larger than 1MB for preview
  if (stat.size > 1024 * 1024) {
    return {
      path: safeFile,
      name: path.basename(safeFile),
      size: stat.size,
      isTruncated: true,
      content: '(File too large for web preview: ' + Math.round(stat.size / 1024) + ' KB)'
    };
  }

  const content = fs.readFileSync(safeFile, 'utf-8');
  return {
    path: safeFile,
    name: path.basename(safeFile),
    size: stat.size,
    isTruncated: false,
    content
  };
}

export function getGitStatus(workspacePath = CONFIG.WORKSPACE_ROOT) {
  const safeDir = validateSafePath(workspacePath, CONFIG.WORKSPACE_ROOT);
  const isWin = process.platform === 'win32';

  // Check if directory is inside a git repository
  try {
    const isRepo = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: safeDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: isWin
    }).trim();

    if (isRepo !== 'true') {
      return { isGitRepo: false, files: [], branch: null, error: null };
    }

    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd: safeDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: isWin
    }).trim() || 'detached HEAD';

    const statusOutput = execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: safeDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: isWin
    });

    const lines = statusOutput.split('\n').filter(Boolean);
    const files = lines.map(line => {
      const code = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      return {
        status: code.trim(),
        path: filePath,
        isSensitive: isSensitiveFile(filePath)
      };
    });

    return {
      isGitRepo: true,
      branch,
      files,
      uncommittedCount: files.length
    };
  } catch (err) {
    return {
      isGitRepo: false,
      branch: null,
      files: [],
      error: 'Not a git repository or git error'
    };
  }
}

export function getGitDiff(workspacePath = CONFIG.WORKSPACE_ROOT, filePath = null) {
  const safeDir = validateSafePath(workspacePath, CONFIG.WORKSPACE_ROOT);
  const isWin = process.platform === 'win32';

  try {
    const args = ['diff'];
    if (filePath) {
      const safeTarget = validateSafePath(path.join(safeDir, filePath), safeDir);
      if (isSensitiveFile(safeTarget)) {
        throw new Error('Access denied: Cannot diff sensitive file');
      }
      args.push('--', path.relative(safeDir, safeTarget));
    }

    const diffOutput = execFileSync('git', args, {
      cwd: safeDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 2 * 1024 * 1024,
      shell: isWin
    });

    return {
      diff: diffOutput,
      hasChanges: diffOutput.trim().length > 0
    };
  } catch (err) {
    return {
      diff: '',
      hasChanges: false,
      error: err.message
    };
  }
}
