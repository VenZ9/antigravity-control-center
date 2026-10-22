import EventEmitter from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG } from '../config.js';
import { checkConversationLock, getConversationTranscript } from './conversationService.js';
import { listConversationSummaries } from '../db/antigravityReader.js';

export const monitorEvents = new EventEmitter();

let activeWatcher = null;
let pollTimer = null;
let lastKnownActiveId = null;
let lastSeenStepCount = {};

export function getActiveSessions() {
  const presenceDir = path.join(CONFIG.AGY_DIR, 'presence');
  const activeList = [];

  if (fs.existsSync(presenceDir)) {
    const lockFiles = fs.readdirSync(presenceDir).filter(f => f.endsWith('.lock'));
    for (const f of lockFiles) {
      const id = f.replace('.lock', '');
      const lock = checkConversationLock(id);
      if (lock.isLocked) {
        activeList.push(id);
      }
    }
  }

  // Fallback to recent in conversation_summaries.db with CASCADE_RUN_STATUS_RUNNING
  if (activeList.length === 0) {
    const recents = listConversationSummaries({ limit: 5 });
    for (const r of recents) {
      if (r.status === 'CASCADE_RUN_STATUS_RUNNING') {
        const lock = checkConversationLock(r.conversation_id);
        if (lock.isLocked) {
          activeList.push(r.conversation_id);
        }
      }
    }
  }

  return activeList;
}

export async function getLiveSnapshot() {
  const activeIds = getActiveSessions();
  const targetId = activeIds[0] || (listConversationSummaries({ limit: 1 })[0]?.conversation_id);

  if (!targetId) {
    return {
      activeSessions: [],
      selectedSessionId: null,
      isLive: false,
      summary: null,
      latestPrompt: null,
      latestResponse: null,
      recentSteps: [],
      recentFileChanges: []
    };
  }

  const summaries = listConversationSummaries();
  const summary = summaries.find(s => s.conversation_id === targetId) || null;
  const lock = checkConversationLock(targetId);

  const transcriptData = await getConversationTranscript(targetId);
  const steps = transcriptData.steps || [];

  // Find latest user prompt
  let latestPrompt = null;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === 'USER_INPUT' || steps[i].source === 'USER_EXPLICIT') {
      latestPrompt = steps[i];
      break;
    }
  }

  // Find latest response / thinking
  let latestResponse = null;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === 'PLANNER_RESPONSE' || steps[i].source === 'MODEL') {
      latestResponse = steps[i];
      break;
    }
  }

  // Extract recent file modifications from tool calls
  const fileChanges = [];
  for (const s of steps) {
    if (s.tool_calls && Array.isArray(s.tool_calls)) {
      for (const tc of s.tool_calls) {
        if (tc.tool_name === 'write_file' || tc.tool_name === 'edit_file') {
          fileChanges.push({
            tool: tc.tool_name,
            path: tc.args?.Path || tc.args?.path || 'unknown',
            step_index: s.step_index,
            timestamp: s.created_at
          });
        }
      }
    }
  }

  return {
    activeSessions: activeIds,
    selectedSessionId: targetId,
    isLive: lock.isLocked,
    summary,
    totalSteps: steps.length,
    latestPrompt,
    latestResponse,
    recentSteps: steps.slice(-15),
    recentFileChanges: fileChanges.slice(-10)
  };
}

// Start watching for real-time changes
export function startLiveMonitoring() {
  stopLiveMonitoring();

  const checkUpdates = async () => {
    try {
      const activeIds = getActiveSessions();
      const currentId = activeIds[0];

      if (currentId) {
        const brainLog = path.join(CONFIG.AGY_DIR, 'brain', currentId, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(brainLog)) {
          const stats = fs.statSync(brainLog);
          const prevSize = lastSeenStepCount[currentId] || 0;
          if (stats.size !== prevSize) {
            lastSeenStepCount[currentId] = stats.size;
            const snapshot = await getLiveSnapshot();
            monitorEvents.emit('snapshot_update', snapshot);
          }
        }
      }

      // Check if active ID changed
      if (currentId !== lastKnownActiveId) {
        lastKnownActiveId = currentId;
        const snapshot = await getLiveSnapshot();
        monitorEvents.emit('active_session_change', {
          activeSessions: activeIds,
          selectedSessionId: currentId,
          snapshot
        });
      }
    } catch (err) {
      // Ignore background transient read errors
    }
  };

  // Poll every 2.5s as fallback
  pollTimer = setInterval(checkUpdates, 2500);

  // Safe single-file or directory watch with ENOSPC safety & error listener
  const presenceDir = path.join(CONFIG.AGY_DIR, 'presence');
  if (fs.existsSync(presenceDir)) {
    try {
      // Watching the small presence directory (non-recursive) avoids exhausting inotify watches
      activeWatcher = fs.watch(presenceDir, { recursive: false }, () => {
        checkUpdates();
      });
      activeWatcher.on('error', (err) => {
        // ENOSPC or watch error: fallback to polling seamlessly
        console.warn('[LiveMonitor] Inotify watch limited on Android, relying on interval polling:', err.message);
        if (activeWatcher) {
          try { activeWatcher.close(); } catch {}
          activeWatcher = null;
        }
      });
    } catch (err) {
      console.warn('[LiveMonitor] Inotify watch initialization skipped on Android, using interval polling:', err.message);
    }
  }
}

export function stopLiveMonitoring() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (activeWatcher) {
    try {
      activeWatcher.close();
    } catch {}
    activeWatcher = null;
  }
}
