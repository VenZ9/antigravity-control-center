export type AppPage =
  | 'overview'
  | 'conversations'
  | 'monitor'
  | 'sessions'
  | 'files'
  | 'analytics'
  | 'tasks'
  | 'settings';

export interface ConversationSummary {
  conversation_id: string;
  title: string;
  preview: string;
  step_count: number;
  last_modified_time: string;
  workspace_uris: string;
  status: string;
  source: string;
  project_id: string;
  agent_name: string;
  parent_conversation_id: string;
  nesting_depth: number;
  isActive?: boolean;
  hasLockFile?: boolean;
}

export interface ToolCall {
  tool_name: string;
  args?: Record<string, any>;
  call_id?: string;
}

export interface TranscriptStep {
  step_index: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  parse_error?: boolean;
  raw?: string;
  has_output_file?: boolean;
  output_file_path?: string;
}

export interface ManagedSession {
  id: string;
  session_name: string;
  workspace_path: string;
  model: string;
  effort: string;
  status: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  ended_at?: string;
  last_error?: string;
  conversation_id?: string;
  isActiveProcess?: boolean;
  logs?: SessionLog[];
}

export interface SessionLog {
  id: number;
  session_id: string;
  stream_type: 'stdout' | 'stderr' | 'system';
  content: string;
  timestamp: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  isSensitive: boolean;
}

export interface GitFileStatus {
  status: string;
  path: string;
  isSensitive: boolean;
}

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  files: GitFileStatus[];
  uncommittedCount?: number;
  error?: string | null;
}

export interface TokenAnalytics {
  source: string;
  disclaimer: string;
  grandTotal: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
  };
  recordedEventsCount: number;
  conversationRankings: Array<{
    conversationId: string;
    title: string;
    stepCount: number;
    lastModified: string | null;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
  }>;
  dailyUsage: Array<{
    date: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
  }>;
}

export interface SettingsData {
  settings: {
    model?: string;
    editor?: string;
    editorMode?: 'vim' | 'insert' | 'emacs';
    trustedWorkspaces?: string[];
    useTerminalCursor?: boolean;
    seasonalThemesOff?: boolean;
    statusLine?: string | boolean;
    copyOnSelect?: boolean;
    [key: string]: any;
  };
  mtime: number | null;
  exists: boolean;
  supportedModels: string[];
}

export interface SystemEnv {
  os: string;
  platform: string;
  arch: string;
  kernel: string;
  hostname: string;
  uptime: number;
  freeMem: number;
  totalMem: number;
  agyVersion: string;
  nodeVersion: string;
  npmVersion: string;
  gitVersion: string;
  diskInfo: string;
  agyDataDir: string;
}

export interface McpServer {
  name: string;
  type: string;
  status: string;
  commandOrUrl: string;
}

export interface PluginInfo {
  name: string;
  status: string;
  details: Record<string, string>;
}

export interface BackgroundTask {
  conversationId: string;
  taskId: string;
  fileName: string;
  size: number;
  mtime: number;
  path: string;
}
