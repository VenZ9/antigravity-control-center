import { CONFIG } from '../config.js';
import { getCsrfToken, verifyCsrf } from '../security/guards.js';
import {
  getAllConversationsWithStatus,
  getConversationWithStatus,
  getConversationTranscript,
  getStepOutputFile,
  searchConversations,
  syncConversationFtsIndex
} from '../services/conversationService.js';
import { getLiveSnapshot, getActiveSessions } from '../services/liveMonitorService.js';
import {
  listManagedSessions,
  getManagedSession,
  createManagedSession,
  stopManagedSession,
  sendInputToSession,
  sendMessageToSession
} from '../services/sessionManager.js';
import {
  listDirectory,
  readFilePreview,
  getGitStatus,
  getGitDiff
} from '../services/fileExplorerService.js';
import { getTokenAnalytics } from '../services/tokenAnalyticsService.js';
import {
  getSettings,
  updateSettings,
  restoreSettingsBackup
} from '../services/settingsService.js';
import {
  getSystemEnvironment,
  getMcpServers,
  getPlugins,
  getBackgroundTasks,
  getTaskLog
} from '../services/systemEnvService.js';

export async function handleApiRequest(req, res, pathname, query, body) {
  // Common JSON headers
  const sendJson = (data, statusCode = 200) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(data));
  };

  const sendError = (message, statusCode = 400) => {
    sendJson({ error: message, success: false }, statusCode);
  };

  try {
    // CSRF token endpoint
    if (pathname === '/api/csrf-token' && req.method === 'GET') {
      return sendJson({ csrfToken: getCsrfToken() });
    }

    // Verify CSRF for mutations
    if (!verifyCsrf(req)) {
      return sendError('Forbidden: Invalid or missing CSRF token', 403);
    }

    // Status
    if (pathname === '/api/status' && req.method === 'GET') {
      const active = getActiveSessions();
      return sendJson({
        status: 'online',
        activeSessionsCount: active.length,
        activeSessions: active,
        version: CONFIG.VERSION,
        workspaceRoot: CONFIG.WORKSPACE_ROOT,
        platform: process.platform
      });
    }

    // Conversations
    if (pathname === '/api/conversations' && req.method === 'GET') {
      const conversations = getAllConversationsWithStatus({
        status: query.get('status') || null,
        agent: query.get('agent') || null,
        workspace: query.get('workspace') || null,
        sortBy: query.get('sortBy') || 'last_modified_time',
        sortOrder: query.get('sortOrder') || 'desc',
        limit: query.get('limit') ? parseInt(query.get('limit'), 10) : 50,
        offset: query.get('offset') ? parseInt(query.get('offset'), 10) : 0
      });
      return sendJson({ conversations });
    }

    if (pathname === '/api/conversations/search' && req.method === 'GET') {
      const q = query.get('q') || '';
      const conversations = searchConversations(q);
      return sendJson({ conversations, query: q });
    }

    if (pathname === '/api/conversations/sync-fts' && req.method === 'POST') {
      syncConversationFtsIndex();
      return sendJson({ success: true, message: 'FTS index synchronized' });
    }

    const convDetailMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9-]+)$/);
    if (convDetailMatch && req.method === 'GET') {
      const conversationId = convDetailMatch[1];
      const conversation = getConversationWithStatus(conversationId);
      if (!conversation) return sendError('Conversation not found', 404);
      return sendJson({ conversation });
    }

    const convTranscriptMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9-]+)\/transcript$/);
    if (convTranscriptMatch && req.method === 'GET') {
      const conversationId = convTranscriptMatch[1];
      const full = query.get('full') === 'true';
      const limit = query.get('limit') ? parseInt(query.get('limit'), 10) : 0;
      const offset = query.get('offset') ? parseInt(query.get('offset'), 10) : 0;

      const transcript = await getConversationTranscript(conversationId, { full, limit, offset });
      return sendJson(transcript);
    }

    const stepOutMatch = pathname.match(/^\/api\/conversations\/([a-zA-Z0-9-]+)\/steps\/(\d+)\/output$/);
    if (stepOutMatch && req.method === 'GET') {
      const conversationId = stepOutMatch[1];
      const stepIndex = parseInt(stepOutMatch[2], 10);
      const output = getStepOutputFile(conversationId, stepIndex);
      return sendJson({ conversationId, stepIndex, output });
    }

    // Live Monitor Snapshot
    if (pathname === '/api/live/snapshot' && req.method === 'GET') {
      const snapshot = await getLiveSnapshot();
      return sendJson(snapshot);
    }

    // Managed Sessions
    if (pathname === '/api/sessions' && req.method === 'GET') {
      const sessions = listManagedSessions();
      return sendJson({ sessions });
    }

    if (pathname === '/api/sessions' && req.method === 'POST') {
      const payload = JSON.parse(body || '{}');
      const session = createManagedSession(payload);
      return sendJson({ success: true, session });
    }

    const sessionDetailMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)$/);
    if (sessionDetailMatch && req.method === 'GET') {
      const sessionId = sessionDetailMatch[1];
      const session = getManagedSession(sessionId);
      if (!session) return sendError('Session not found', 404);
      return sendJson({ session });
    }

    const sessionStopMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)\/stop$/);
    if (sessionStopMatch && req.method === 'POST') {
      const sessionId = sessionStopMatch[1];
      const stopped = stopManagedSession(sessionId);
      return sendJson({ success: stopped });
    }

    const sessionInputMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)\/input$/);
    if (sessionInputMatch && req.method === 'POST') {
      const sessionId = sessionInputMatch[1];
      const { input } = JSON.parse(body || '{}');
      if (typeof input !== 'string') return sendError('Input must be a string');
      const sent = await sendMessageToSession(sessionId, input);
      return sendJson({ success: true, sent });
    }

    const sessionMsgMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)\/message$/);
    if (sessionMsgMatch && req.method === 'POST') {
      const sessionId = sessionMsgMatch[1];
      const { content, attachments } = JSON.parse(body || '{}');
      if (!content || typeof content !== 'string') return sendError('Message content is required');
      const result = await sendMessageToSession(sessionId, content, attachments);
      return sendJson({ success: true, result });
    }

    const sessionTransMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)\/transcript$/);
    if (sessionTransMatch && req.method === 'GET') {
      const sessionId = sessionTransMatch[1];
      const session = getManagedSession(sessionId);
      if (!session) return sendError('Session not found', 404);
      if (session.conversation_id) {
        const transcript = await getConversationTranscript(session.conversation_id, { full: true });
        return sendJson(transcript);
      }
      return sendJson({ conversationId: null, totalSteps: 0, steps: [] });
    }

    // Files Explorer
    if (pathname === '/api/files/tree' && req.method === 'GET') {
      const dirPath = query.get('path') || CONFIG.WORKSPACE_ROOT;
      const data = listDirectory(dirPath);
      return sendJson(data);
    }

    if (pathname === '/api/files/preview' && req.method === 'GET') {
      const filePath = query.get('path');
      if (!filePath) return sendError('Missing path parameter');
      const data = readFilePreview(filePath);
      return sendJson(data);
    }

    if (pathname === '/api/files/git-status' && req.method === 'GET') {
      const workspacePath = query.get('workspace') || CONFIG.WORKSPACE_ROOT;
      const status = getGitStatus(workspacePath);
      return sendJson(status);
    }

    if (pathname === '/api/files/git-diff' && req.method === 'GET') {
      const workspacePath = query.get('workspace') || CONFIG.WORKSPACE_ROOT;
      const filePath = query.get('file') || null;
      const diff = getGitDiff(workspacePath, filePath);
      return sendJson(diff);
    }

    // Analytics
    if (pathname === '/api/analytics' && req.method === 'GET') {
      const analytics = getTokenAnalytics();
      return sendJson(analytics);
    }

    // Settings
    if (pathname === '/api/settings' && req.method === 'GET') {
      const settingsData = getSettings();
      return sendJson(settingsData);
    }

    if (pathname === '/api/settings' && req.method === 'POST') {
      const { settings, mtime } = JSON.parse(body || '{}');
      if (!settings) return sendError('Missing settings object');
      const result = updateSettings(settings, mtime);
      return sendJson(result);
    }

    if (pathname === '/api/settings/restore' && req.method === 'POST') {
      const result = restoreSettingsBackup();
      return sendJson(result);
    }

    // Tasks & Environment
    if (pathname === '/api/tasks' && req.method === 'GET') {
      const conversationId = query.get('conversationId') || null;
      const tasks = getBackgroundTasks(conversationId);
      return sendJson({ tasks });
    }

    const taskLogMatch = pathname.match(/^\/api\/tasks\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_]+)\/log$/);
    if (taskLogMatch && req.method === 'GET') {
      const convId = taskLogMatch[1];
      const taskId = taskLogMatch[2];
      const logContent = getTaskLog(convId, taskId);
      return sendJson({ conversationId: convId, taskId, log: logContent });
    }

    if (pathname === '/api/mcp' && req.method === 'GET') {
      const servers = getMcpServers();
      return sendJson({ servers });
    }

    if (pathname === '/api/plugins' && req.method === 'GET') {
      const plugins = getPlugins();
      return sendJson({ plugins });
    }

    if (pathname === '/api/env' && req.method === 'GET') {
      const env = getSystemEnvironment();
      return sendJson({ env });
    }

    return sendError('Endpoint not found', 404);
  } catch (err) {
    console.error(`[API Error] ${pathname}:`, err);
    return sendError(err.message, 500);
  }
}
