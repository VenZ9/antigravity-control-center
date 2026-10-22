let cachedCsrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/csrf-token');
    const data = await res.json();
    cachedCsrfToken = data.csrfToken;
    return cachedCsrfToken || '';
  } catch {
    return '';
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  // Attach CSRF token on mutating requests
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    if (token) {
      headers.set('X-CSRF-Token', token);
    }
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Request failed`);
  }

  return data as T;
}

export const API = {
  // Status
  getStatus: () => apiFetch<{ status: string; activeSessions: string[]; version: string }>('/api/status'),

  // Conversations
  getConversations: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch<{ conversations: any[] }>(`/api/conversations${query ? '?' + query : ''}`);
  },
  searchConversations: (q: string) => apiFetch<{ conversations: any[]; query: string }>(`/api/conversations/search?q=${encodeURIComponent(q)}`),
  getConversation: (id: string) => apiFetch<{ conversation: any }>(`/api/conversations/${id}`),
  getTranscript: (id: string, options: { full?: boolean; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams(options as any).toString();
    return apiFetch<{ conversationId: string; totalSteps: number; steps: any[] }>(`/api/conversations/${id}/transcript${query ? '?' + query : ''}`);
  },
  getStepOutput: (convId: string, stepIndex: number) => apiFetch<{ conversationId: string; stepIndex: number; output: string }>(`/api/conversations/${convId}/steps/${stepIndex}/output`),
  syncFts: () => apiFetch<{ success: boolean; message: string }>('/api/conversations/sync-fts', { method: 'POST' }),

  // Live Monitor
  getLiveSnapshot: () => apiFetch<any>('/api/live/snapshot'),

  // Managed Sessions
  getSessions: () => apiFetch<{ sessions: any[] }>('/api/sessions'),
  getSession: (id: string) => apiFetch<{ session: any }>(`/api/sessions/${id}`),
  createSession: (payload: any) => apiFetch<{ success: boolean; session: any }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  stopSession: (id: string) => apiFetch<{ success: boolean }>(`/api/sessions/${id}/stop`, { method: 'POST' }),
  sendSessionInput: (id: string, input: string) => apiFetch<{ success: boolean }>(`/api/sessions/${id}/input`, {
    method: 'POST',
    body: JSON.stringify({ input })
  }),
  sendSessionMessage: (id: string, content: string, attachments?: string[]) => apiFetch<{ success: boolean; result: any }>(`/api/sessions/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments })
  }),
  getSessionTranscript: (id: string) => apiFetch<{ conversationId: string | null; totalSteps: number; steps: any[] }>(`/api/sessions/${id}/transcript`),

  // File Upload
  uploadFiles: async (files: File[]): Promise<{ success: boolean; filePath: string; fileName: string; size: number; files: { filePath: string; fileName: string; size: number }[] }> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }
    const token = await getCsrfToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Upload failed with status ${response.status}`);
    }
    return data;
  },

  // File Explorer
  getFileTree: (path?: string) => apiFetch<any>(`/api/files/tree${path ? '?path=' + encodeURIComponent(path) : ''}`),
  getFilePreview: (path: string) => apiFetch<any>(`/api/files/preview?path=${encodeURIComponent(path)}`),
  getGitStatus: (workspace?: string) => apiFetch<any>(`/api/files/git-status${workspace ? '?workspace=' + encodeURIComponent(workspace) : ''}`),
  getGitDiff: (workspace?: string, file?: string) => {
    const params = new URLSearchParams();
    if (workspace) params.set('workspace', workspace);
    if (file) params.set('file', file);
    return apiFetch<any>(`/api/files/git-diff?${params.toString()}`);
  },

  // Analytics
  getAnalytics: () => apiFetch<any>('/api/analytics'),

  // Settings
  getSettings: () => apiFetch<any>('/api/settings'),
  updateSettings: (settings: any, mtime: number | null) => apiFetch<any>('/api/settings', {
    method: 'POST',
    body: JSON.stringify({ settings, mtime })
  }),
  restoreSettings: () => apiFetch<any>('/api/settings/restore', { method: 'POST' }),

  // Tasks & Environment
  getTasks: (conversationId?: string) => apiFetch<{ tasks: any[] }>(`/api/tasks${conversationId ? '?conversationId=' + encodeURIComponent(conversationId) : ''}`),
  getTaskLog: (convId: string, taskId: string) => apiFetch<{ conversationId: string; taskId: string; log: string }>(`/api/tasks/${convId}/${taskId}/log`),
  getMcpServers: () => apiFetch<{ servers: any[] }>('/api/mcp'),
  getPlugins: () => apiFetch<{ plugins: any[] }>('/api/plugins'),
  getEnv: () => apiFetch<{ env: any }>('/api/env')
};
