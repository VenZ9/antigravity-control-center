import { spawn, execSync } from 'node:child_process';
import EventEmitter from 'node:events';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG } from '../config.js';
import { getControlCenterDb } from '../db/controlCenterDb.js';
import { validateSafePath } from '../security/guards.js';

export const sessionEvents = new EventEmitter();

// Active child processes mapped by session id:
// sessionId -> { child, sessionId, workspace, model, effort, conversationId, status, stdoutBuffer, stderrBuffer }
const runningProcesses = new Map();

// Map UI human-readable model labels to exact CLI slugs accepted by agy
export const MODEL_SLUG_MAP = {
  'Gemini 3.8 Flash (High)': { slug: 'gemini-3.8-flash-high', supportsEffortFlag: false },
  'Gemini 3.8 Flash (Medium)': { slug: 'gemini-3.8-flash-medium', supportsEffortFlag: false },
  'Gemini 3.8 Flash (Low)': { slug: 'gemini-3.8-flash-low', supportsEffortFlag: false },
  'Claude Sonnet 4.6 (Thinking)': { slug: 'claude-sonnet-4-6', supportsEffortFlag: false },
  'Claude Opus 4.6 (Thinking)': { slug: 'claude-opus-4-6-thinking', supportsEffortFlag: false },
  'GPT-OSS 120B (Medium)': { slug: 'gpt-oss-120b-medium', supportsEffortFlag: false },

  // Base slugs and direct aliases
  'gemini-3.8-flash-high': { slug: 'gemini-3.8-flash-high', supportsEffortFlag: false },
  'gemini-3.8-flash-medium': { slug: 'gemini-3.8-flash-medium', supportsEffortFlag: false },
  'gemini-3.8-flash-low': { slug: 'gemini-3.8-flash-low', supportsEffortFlag: false },
  'claude-sonnet-4-6': { slug: 'claude-sonnet-4-6', supportsEffortFlag: false },
  'claude-opus-4-6-thinking': { slug: 'claude-opus-4-6-thinking', supportsEffortFlag: false },
  'gpt-oss-120b-medium': { slug: 'gpt-oss-120b-medium', supportsEffortFlag: false },
  'gemini-3.8-flash': { slug: 'gemini-3.8-flash', supportsEffortFlag: true },
  'gemini-2.5-pro': { slug: 'gemini-2.5-pro', supportsEffortFlag: false },
  'gemini-2.5-flash': { slug: 'gemini-2.5-flash', supportsEffortFlag: false }
};

export function resolveModelArgs(model, effort) {
  if (!model) return [];

  const trimmed = model.trim();
  const entry = MODEL_SLUG_MAP[trimmed];
  const slug = entry ? entry.slug : trimmed.toLowerCase().replace(/[\s()]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const args = ['--model', slug];

  // Only append --effort if:
  // 1. Model does NOT already encode effort in its slug (-high, -medium, -low, -thinking, -max, -xhigh)
  // 2. The model definition explicitly supports the separate --effort flag
  const alreadyHasEffort = /-(high|medium|low|thinking|xhigh|max)$/i.test(slug);
  if (!alreadyHasEffort && entry?.supportsEffortFlag && effort) {
    args.push('--effort', effort.toLowerCase());
  }

  return args;
}

export function listManagedSessions() {
  const db = getControlCenterDb();
  const stmt = db.prepare(`
    SELECT * FROM managed_sessions ORDER BY started_at DESC LIMIT 50
  `);
  const sessions = stmt.all();

  return sessions.map(s => ({
    ...s,
    isActiveProcess: runningProcesses.has(s.id)
  }));
}

export function getManagedSession(sessionId) {
  const db = getControlCenterDb();
  const stmt = db.prepare('SELECT * FROM managed_sessions WHERE id = ?');
  const session = stmt.get(sessionId);
  if (!session) return null;

  const logsStmt = db.prepare('SELECT * FROM session_logs WHERE session_id = ? ORDER BY id ASC');
  session.logs = logsStmt.all(sessionId);
  session.isActiveProcess = runningProcesses.has(sessionId);
  return session;
}

/**
 * Spawns an interactive agy process in stream-json mode for a managed session.
 */
function spawnInteractiveProcess(sessionRecord, initialPrompt = null) {
  const sessionId = sessionRecord.id;
  const safeWorkspace = validateSafePath(sessionRecord.workspace_path || CONFIG.WORKSPACE_ROOT, CONFIG.WORKSPACE_ROOT);

  // Construct CLI arguments array
  const args = [];
  if (sessionRecord.model) {
    args.push(...resolveModelArgs(sessionRecord.model, sessionRecord.effort));
  }

  // Resume previous conversation if available
  if (sessionRecord.conversation_id) {
    args.push('--conversation', sessionRecord.conversation_id);
  }

  // Multi-turn stream-json mode
  args.push('--input-format', 'stream-json', '--output-format', 'stream-json');

  const db = getControlCenterDb();

  const isWindows = process.platform === 'win32';
  const child = spawn('agy', args, {
    cwd: safeWorkspace,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      NO_COLOR: '0'
    },
    shell: isWindows,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const procInfo = {
    child,
    sessionId,
    workspace: safeWorkspace,
    model: sessionRecord.model,
    effort: sessionRecord.effort,
    conversationId: sessionRecord.conversation_id || null,
    status: initialPrompt ? 'running' : 'idle',
    stdoutBuffer: '',
    stderrBuffer: ''
  };

  runningProcesses.set(sessionId, procInfo);

  const appendLog = (streamType, content) => {
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO session_logs (session_id, stream_type, content, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, streamType, content, now);
    } catch {}

    sessionEvents.emit('session_output', {
      sessionId,
      streamType,
      content,
      timestamp: now
    });
  };

  appendLog('system', `[Session Started] agy ${args.join(' ')}\nCWD: ${safeWorkspace}`);

  // Process stdout NDJSON line by line
  child.stdout.on('data', chunk => {
    procInfo.stdoutBuffer += chunk.toString();
    const lines = procInfo.stdoutBuffer.split('\n');
    procInfo.stdoutBuffer = lines.pop(); // keep remainder

    for (const line of lines) {
      if (!line.trim()) continue;

      appendLog('stdout', line);

      try {
        const parsed = JSON.parse(line);

        if (parsed.event === 'init') {
          const convId = parsed.conversation_id;
          if (convId) {
            procInfo.conversationId = convId;
            try {
              db.prepare('UPDATE managed_sessions SET conversation_id = ? WHERE id = ?').run(convId, sessionId);
            } catch {}
            sessionEvents.emit('session_init', {
              sessionId,
              conversationId: convId,
              init: parsed.init
            });
          }
        } else if (parsed.event === 'step_update') {
          sessionEvents.emit('session_step_update', {
            sessionId,
            conversationId: procInfo.conversationId,
            step: parsed.step_update
          });
        } else if (parsed.event === 'result') {
          // Turn completed
          procInfo.status = 'idle';
          try {
            db.prepare('UPDATE managed_sessions SET status = ? WHERE id = ?').run('idle', sessionId);
          } catch {}

          sessionEvents.emit('session_status', { sessionId, status: 'idle' });
          sessionEvents.emit('session_turn_result', {
            sessionId,
            conversationId: procInfo.conversationId,
            status: parsed.result?.status,
            response: parsed.result?.response || '',
            error: parsed.result?.error,
            durationSeconds: parsed.result?.duration_seconds,
            usage: parsed.result?.usage,
            timestamp: new Date().toISOString()
          });
        }
      } catch {
        // Line wasn't JSON, already logged as raw stdout
      }
    }
  });

  child.stderr.on('data', chunk => {
    procInfo.stderrBuffer += chunk.toString();
    const lines = procInfo.stderrBuffer.split('\n');
    procInfo.stderrBuffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      appendLog('stderr', line);
    }
  });

  child.on('error', err => {
    const endedAt = new Date().toISOString();
    try {
      db.prepare(`
        UPDATE managed_sessions
        SET status = 'failed', ended_at = ?, last_error = ?
        WHERE id = ?
      `).run(endedAt, err.message, sessionId);
    } catch {}

    appendLog('system', `[Error] Failed to execute agy: ${err.message}`);
    runningProcesses.delete(sessionId);
    sessionEvents.emit('session_status', { sessionId, status: 'failed', error: err.message });
  });

  child.on('close', (code, signal) => {
    // Flush remainders
    if (procInfo.stdoutBuffer) appendLog('stdout', procInfo.stdoutBuffer);
    if (procInfo.stderrBuffer) appendLog('stderr', procInfo.stderrBuffer);

    const endedAt = new Date().toISOString();
    const isCancelled = signal === 'SIGINT' || signal === 'SIGTERM' || procInfo.status === 'cancelled';
    const finalStatus = isCancelled ? 'cancelled' : (code === 0 ? 'idle' : 'failed');
    const errorMsg = code === 0 ? null : (isCancelled ? `Interrupted${signal ? ` with ${signal}` : ''}` : `Process exited with code ${code}`);

    try {
      db.prepare(`
        UPDATE managed_sessions
        SET status = ?, ended_at = ?, last_error = ?
        WHERE id = ?
      `).run(finalStatus, endedAt, errorMsg, sessionId);
    } catch {}

    appendLog('system', `[Session Process Exited] Status: ${finalStatus}${errorMsg ? ` (${errorMsg})` : ''}`);
    runningProcesses.delete(sessionId);
    sessionEvents.emit('session_status', { sessionId, status: finalStatus, code, signal });
  });

  // If initial prompt provided, write immediately to stdin
  if (initialPrompt && initialPrompt.trim()) {
    try {
      const payload = JSON.stringify({
        event: 'user',
        message: { content: initialPrompt.trim() }
      }) + '\n';
      child.stdin.write(payload);

      db.prepare('UPDATE managed_sessions SET status = ? WHERE id = ?').run('running', sessionId);
      sessionEvents.emit('session_status', { sessionId, status: 'running' });
      sessionEvents.emit('session_turn_start', {
        sessionId,
        content: initialPrompt.trim(),
        timestamp: new Date().toISOString()
      });
    } catch (writeErr) {
      appendLog('system', `[Error writing prompt] ${writeErr.message}`);
    }
  }

  return procInfo;
}

export function createManagedSession(params) {
  let { sessionName, workspacePath, model, effort, prompt, resumeConversationId, attachments } = params;

  // Validate workspace path
  const safeWorkspace = validateSafePath(workspacePath || CONFIG.WORKSPACE_ROOT, CONFIG.WORKSPACE_ROOT);

  // If attachments provided with initial prompt, inject them
  if (prompt && Array.isArray(attachments) && attachments.length > 0) {
    const fileList = attachments.map(p => `- ${p}`).join('\n');
    prompt = `The user has attached the following files. Use your tools to inspect them:\n${fileList}\n\n${prompt.trim()}`;
  }

  const sessionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const initialStatus = prompt && prompt.trim() ? 'running' : 'idle';

  const db = getControlCenterDb();
  const insertStmt = db.prepare(`
    INSERT INTO managed_sessions (
      id, session_name, workspace_path, model, effort, status, started_at, conversation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    sessionId,
    sessionName || `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    safeWorkspace,
    model || 'Gemini 3.8 Flash (High)',
    effort || 'high',
    initialStatus,
    startedAt,
    resumeConversationId || null
  );

  const sessionRecord = {
    id: sessionId,
    session_name: sessionName,
    workspace_path: safeWorkspace,
    model: model || 'Gemini 3.8 Flash (High)',
    effort: effort || 'high',
    conversation_id: resumeConversationId || null
  };

  // Launch interactive child process in persistent stream-json mode
  spawnInteractiveProcess(sessionRecord, prompt);

  return {
    sessionId,
    status: initialStatus,
    workspace: safeWorkspace
  };
}

/**
 * Sends a new user message turn into an ongoing or newly-resumed interactive session.
 * Accepts optional array of attachment file paths.
 */
export async function sendMessageToSession(sessionId, content, attachments = []) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new Error('Message content is required');
  }

  let promptPayload = content.trim();

  // If user attached files, inject them into the prompt sent to agy
  if (Array.isArray(attachments) && attachments.length > 0) {
    const fileList = attachments.map(p => `- ${path.resolve(p)}`).join('\n');
    promptPayload = `The user has attached the following files. Use your tools to inspect them:\n${fileList}\n\n${promptPayload}`;
  }

  const db = getControlCenterDb();
  let procInfo = runningProcesses.get(sessionId);

  // If process is active and stdin is open, write message directly
  if (procInfo && procInfo.child && !procInfo.child.stdin.writableEnded) {
    const payload = JSON.stringify({
      event: 'user',
      message: { content: promptPayload }
    }) + '\n';

    procInfo.child.stdin.write(payload);
    procInfo.status = 'running';

    try {
      db.prepare('UPDATE managed_sessions SET status = ? WHERE id = ?').run('running', sessionId);
    } catch {}

    sessionEvents.emit('session_status', { sessionId, status: 'running' });
    sessionEvents.emit('session_turn_start', {
      sessionId,
      content: promptPayload,
      timestamp: new Date().toISOString()
    });

    return { success: true, sessionId, status: 'running' };
  }

  // Fallback: Process was idle/exited or this is a past session being resumed.
  // Re-spawn interactive process with --conversation and inject the message!
  const sessionRecord = getManagedSession(sessionId);
  if (!sessionRecord) {
    throw new Error('Session not found');
  }

  spawnInteractiveProcess(sessionRecord, promptPayload);
  return { success: true, sessionId, status: 'running' };
}

export function sendInputToSession(sessionId, input) {
  return sendMessageToSession(sessionId, input);
}

export function stopManagedSession(sessionId) {
  const procInfo = runningProcesses.get(sessionId);
  const db = getControlCenterDb();

  if (procInfo) {
    procInfo.status = 'cancelled';
    if (procInfo.child && !procInfo.child.killed) {
      if (process.platform === 'win32') {
        try {
          // On Windows, SIGINT is not supported for arbitrary processes.
          // Terminate the full process tree cleanly with taskkill.
          execSync(`taskkill /pid ${procInfo.child.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // Process may have already exited
        }
      } else {
        // Graceful interrupt with SIGINT on Unix-like systems (Linux/macOS/Termux)
        try {
          procInfo.child.kill('SIGINT');
        } catch {
          try { procInfo.child.kill('SIGTERM'); } catch {}
        }
      }
    }
  }

  try {
    db.prepare('UPDATE managed_sessions SET status = ? WHERE id = ?').run('cancelled', sessionId);
  } catch {}

  sessionEvents.emit('session_status', { sessionId, status: 'cancelled' });
  return true;
}
