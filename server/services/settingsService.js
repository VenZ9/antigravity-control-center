import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CONFIG } from '../config.js';

const SETTINGS_PATH = path.join(CONFIG.AGY_DIR, 'settings.json');
const BACKUP_PATH = path.join(CONFIG.AGY_DIR, 'settings.json.bak');

export const VERIFIED_MODELS = [
  'Gemini 3.8 Flash (High)',
  'Gemini 3.8 Flash (Medium)',
  'Gemini 3.8 Flash (Low)',
  'Claude Sonnet 4.6 (Thinking)',
  'Claude Opus 4.6 (Thinking)',
  'GPT-OSS 120B (Medium)'
];

export function getSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return {
      settings: {},
      mtime: null,
      exists: false
    };
  }

  const stat = fs.statSync(SETTINGS_PATH);
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse settings.json: ${err.message}`);
  }

  return {
    settings: parsed,
    mtime: stat.mtimeMs,
    exists: true,
    supportedModels: VERIFIED_MODELS
  };
}

export function validateSettings(newSettings) {
  const errors = [];
  const cleaned = {};

  if ('model' in newSettings) {
    if (typeof newSettings.model !== 'string' || !newSettings.model.trim()) {
      errors.push('model must be a non-empty string');
    } else {
      cleaned.model = newSettings.model.trim();
    }
  }

  if ('editor' in newSettings) {
    if (typeof newSettings.editor !== 'string') {
      errors.push('editor must be a string');
    } else {
      cleaned.editor = newSettings.editor.trim();
    }
  }

  if ('editorMode' in newSettings) {
    if (typeof newSettings.editorMode !== 'string' || !['vim', 'insert', 'emacs'].includes(newSettings.editorMode.toLowerCase())) {
      errors.push('editorMode must be "vim", "insert", or "emacs"');
    } else {
      cleaned.editorMode = newSettings.editorMode.toLowerCase();
    }
  }

  if ('trustedWorkspaces' in newSettings) {
    if (!Array.isArray(newSettings.trustedWorkspaces)) {
      errors.push('trustedWorkspaces must be an array of directory paths');
    } else {
      cleaned.trustedWorkspaces = newSettings.trustedWorkspaces.filter(p => typeof p === 'string' && p.trim().length > 0);
    }
  }

  if ('useTerminalCursor' in newSettings) {
    cleaned.useTerminalCursor = Boolean(newSettings.useTerminalCursor);
  }

  if ('seasonalThemesOff' in newSettings) {
    cleaned.seasonalThemesOff = Boolean(newSettings.seasonalThemesOff);
  }

  if ('statusLine' in newSettings) {
    cleaned.statusLine = newSettings.statusLine;
  }

  if ('copyOnSelect' in newSettings) {
    cleaned.copyOnSelect = Boolean(newSettings.copyOnSelect);
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned
  };
}

export function updateSettings(newSettings, expectedMtime = null) {
  const current = getSettings();

  // Detect external concurrent modifications
  if (expectedMtime && current.mtime && Math.abs(current.mtime - expectedMtime) > 50) {
    throw new Error('Concurrent modification detected: settings.json was modified externally. Please reload settings.');
  }

  const validation = validateSettings(newSettings);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Merge with existing settings (preserve other keys if any)
  const merged = {
    ...current.settings,
    ...validation.cleaned
  };

  const serialized = JSON.stringify(merged, null, 2) + '\n';
  const tempPath = path.join(CONFIG.AGY_DIR, `settings.json.tmp.${crypto.randomBytes(6).toString('hex')}`);

  try {
    // 1. Create backup if settings.json exists
    if (fs.existsSync(SETTINGS_PATH)) {
      fs.copyFileSync(SETTINGS_PATH, BACKUP_PATH);
    }

    // 2. Write to temp file
    fs.writeFileSync(tempPath, serialized, { mode: 0o600 });

    // 3. Atomic rename
    fs.renameSync(tempPath, SETTINGS_PATH);

    const newStat = fs.statSync(SETTINGS_PATH);
    return {
      success: true,
      settings: merged,
      mtime: newStat.mtimeMs
    };
  } catch (err) {
    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    // Attempt restore from backup if settings file was damaged
    if (fs.existsSync(BACKUP_PATH) && !fs.existsSync(SETTINGS_PATH)) {
      try { fs.copyFileSync(BACKUP_PATH, SETTINGS_PATH); } catch {}
    }
    throw new Error(`Atomic write failed: ${err.message}`);
  }
}

export function restoreSettingsBackup() {
  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error('No settings backup found');
  }

  fs.copyFileSync(BACKUP_PATH, SETTINGS_PATH);
  return getSettings();
}
