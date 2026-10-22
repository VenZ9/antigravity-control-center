import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { CONFIG } from '../config.js';
import { listConversationSummaries, getConversationSummaryById } from '../db/antigravityReader.js';
import { getControlCenterDb } from '../db/controlCenterDb.js';

// Safe non-blocking lock check for a conversation ID
export function checkConversationLock(conversationId) {
  const lockPath = path.join(CONFIG.AGY_DIR, 'presence', `${conversationId}.lock`);
  if (!fs.existsSync(lockPath)) {
    return { hasLockFile: false, isLocked: false };
  }

  // Windows platform handling: flock does not exist on Windows.
  // When an agy process on Windows holds an exclusive lock, opening it read/write fails with EBUSY/EPERM.
  if (process.platform === 'win32') {
    try {
      const fd = fs.openSync(lockPath, 'r+');
      fs.closeSync(fd);
      return { hasLockFile: true, isLocked: false };
    } catch {
      return { hasLockFile: true, isLocked: true };
    }
  }

  try {
    // Run flock non-blockingly on Unix/Linux/Termux
    execFileSync('flock', ['-n', '-x', lockPath, 'true'], { stdio: 'ignore', timeout: 1000 });
    // Exit code 0 means lock was acquired, so another process does NOT hold it
    return { hasLockFile: true, isLocked: false };
  } catch (err) {
    // Exit code 1 or lock contention means another process holds it
    return { hasLockFile: true, isLocked: true };
  }
}

export function parseJsonlFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const items = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      items.push(obj);
    } catch (err) {
      // Gracefully handle partial/corrupt record
      items.push({
        parse_error: true,
        raw: line.substring(0, 500),
        step_index: i
      });
    }
  }

  if (options.limit && options.limit > 0) {
    const offset = options.offset || 0;
    return items.slice(offset, offset + options.limit);
  }

  return items;
}

export async function getConversationTranscript(conversationId, options = {}) {
  const brainDir = path.join(CONFIG.AGY_DIR, 'brain', conversationId);
  const logDir = path.join(brainDir, '.system_generated', 'logs');
  const compactTranscriptPath = path.join(logDir, 'transcript.jsonl');
  const fullTranscriptPath = path.join(logDir, 'transcript_full.jsonl');

  // Choose full if requested or if compact doesn't exist
  let targetPath = compactTranscriptPath;
  if (options.full && fs.existsSync(fullTranscriptPath)) {
    targetPath = fullTranscriptPath;
  } else if (!fs.existsSync(compactTranscriptPath) && fs.existsSync(fullTranscriptPath)) {
    targetPath = fullTranscriptPath;
  }

  const steps = parseJsonlFile(targetPath, options);

  // If a step has step output stored on disk (e.g. .system_generated/steps/<idx>/output.txt), note it
  const stepsDir = path.join(brainDir, '.system_generated', 'steps');
  for (const step of steps) {
    if (step && typeof step.step_index === 'number') {
      const stepOutFile = path.join(stepsDir, String(step.step_index), 'output.txt');
      if (fs.existsSync(stepOutFile)) {
        step.has_output_file = true;
        step.output_file_path = stepOutFile;
      }
    }
  }

  return {
    conversationId,
    totalSteps: steps.length,
    steps
  };
}

export function getStepOutputFile(conversationId, stepIndex) {
  const brainDir = path.join(CONFIG.AGY_DIR, 'brain', conversationId);
  const stepOutFile = path.join(brainDir, '.system_generated', 'steps', String(stepIndex), 'output.txt');
  if (!fs.existsSync(stepOutFile)) {
    return null;
  }
  return fs.readFileSync(stepOutFile, 'utf-8');
}

export function getConversationWithStatus(conversationId) {
  const summary = getConversationSummaryById(conversationId);
  const lockInfo = checkConversationLock(conversationId);
  return {
    ...summary,
    isActive: lockInfo.isLocked,
    hasLockFile: lockInfo.hasLockFile
  };
}

export function getAllConversationsWithStatus(options = {}) {
  const summaries = listConversationSummaries(options);
  return summaries.map(s => {
    const lockInfo = checkConversationLock(s.conversation_id);
    return {
      ...s,
      isActive: lockInfo.isLocked,
      hasLockFile: lockInfo.hasLockFile
    };
  });
}

// Index conversations into FTS5 in control_center.db
export function syncConversationFtsIndex() {
  const db = getControlCenterDb();
  const summaries = listConversationSummaries();

  const insertStmt = db.prepare(`
    INSERT INTO fts_conversations (conversation_id, title, preview, content)
    VALUES (?, ?, ?, ?)
  `);

  try {
    db.exec('DELETE FROM fts_conversations;'); // Refresh index
    for (const s of summaries) {
      let content = s.preview || '';
      // Read compact transcript snippet if available
      const transcriptPath = path.join(CONFIG.AGY_DIR, 'brain', s.conversation_id, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(transcriptPath)) {
        try {
          const raw = fs.readFileSync(transcriptPath, 'utf-8');
          const lines = raw.split('\n').slice(0, 20); // First 20 steps
          const textSnippets = [];
          for (const line of lines) {
            if (!line) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.content) textSnippets.push(String(obj.content).substring(0, 300));
              if (obj.thinking) textSnippets.push(String(obj.thinking).substring(0, 150));
            } catch {}
          }
          content += ' ' + textSnippets.join(' ');
        } catch {}
      }

      insertStmt.run(s.conversation_id, s.title || '', s.preview || '', content);
    }
  } catch (err) {
    console.error('[FTS] Sync error:', err.message);
  }
}

export function searchConversations(query) {
  if (!query || query.trim() === '') {
    return getAllConversationsWithStatus();
  }

  const db = getControlCenterDb();
  const sanitized = query.replace(/[^\w\s-]/g, ' ').trim();
  if (!sanitized) return getAllConversationsWithStatus();

  try {
    const stmt = db.prepare(`
      SELECT conversation_id, title, preview
      FROM fts_conversations
      WHERE fts_conversations MATCH ?
      LIMIT 50
    `);
    const ftsResults = stmt.all(`${sanitized}*`);
    const matchedIds = new Set(ftsResults.map(r => r.conversation_id));

    const all = getAllConversationsWithStatus();
    return all.filter(c => matchedIds.has(c.conversation_id));
  } catch (err) {
    // Fallback to substring matching if FTS syntax error
    const lower = query.toLowerCase();
    const all = getAllConversationsWithStatus();
    return all.filter(c => 
      (c.title && c.title.toLowerCase().includes(lower)) ||
      (c.preview && c.preview.toLowerCase().includes(lower)) ||
      (c.conversation_id && c.conversation_id.toLowerCase().includes(lower))
    );
  }
}
