import React, { useEffect, useState } from 'react';
import { 
  ListChecks, Server, Puzzle, Cpu, RefreshCw, 
  FileText, Terminal, CheckCircle2 
} from 'lucide-react';
import { BackgroundTask, McpServer, PluginInfo, SystemEnv } from '../types';
import { API } from '../api/client';
import { Modal } from '../components/Modal';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [env, setEnv] = useState<SystemEnv | null>(null);
  const [loading, setLoading] = useState(true);

  // Task Log Modal
  const [selectedTaskLog, setSelectedTaskLog] = useState<{ id: string; content: string } | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [tasksRes, mcpRes, pluginsRes, envRes] = await Promise.all([
        API.getTasks(),
        API.getMcpServers(),
        API.getPlugins(),
        API.getEnv()
      ]);
      setTasks(tasksRes.tasks || []);
      setMcpServers(mcpRes.servers || []);
      setPlugins(pluginsRes.plugins || []);
      setEnv(envRes.env);
    } catch (err) {
      console.error('Failed to load tasks and environment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTaskLog = async (task: BackgroundTask) => {
    try {
      setLoadingLog(true);
      const res = await API.getTaskLog(task.conversationId, task.taskId);
      setSelectedTaskLog({ id: task.taskId, content: res.log });
    } catch (err: any) {
      alert(`Could not load log: ${err.message}`);
    } finally {
      setLoadingLog(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Background Tasks Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListChecks size={16} style={{ color: 'var(--accent-violet)' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>Background Tasks ({tasks.length})</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Async commands, subagents, and background processes.
            </p>
          </div>
          <button
            onClick={loadAll}
            className="btn btn-secondary"
            style={{ minHeight: '30px', height: '30px', padding: '0 10px', fontSize: '11px', borderRadius: '6px' }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[1, 2].map(n => <div key={n} className="skeleton" style={{ height: '48px', width: '100%' }} />)}
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No background task logs found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {tasks.map(task => (
              <div
                key={`${task.conversationId}-${task.taskId}`}
                onClick={() => handleOpenTaskLog(task)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px',
                  border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    {task.taskId}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Conv: {task.conversationId.substring(0, 8)}... • Log size: {Math.round(task.size / 1024 * 10) / 10} KB
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '10px', borderRadius: '5px' }}
                  >
                    View Log
                  </button>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(task.mtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: MCP Servers & Plugins */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* MCP Servers */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Server size={16} style={{ color: 'var(--accent-violet)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              Configured MCP Servers ({mcpServers.length})
            </h3>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: '56px', width: '100%' }} />
          ) : mcpServers.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
              No MCP servers configured in Antigravity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mcpServers.map(s => (
                <div
                  key={s.name}
                  style={{
                    padding: '8px 12px', background: 'var(--bg-elevated)',
                    borderRadius: '6px', border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-violet)' }}>
                      {s.name}
                    </span>
                    <span className="badge badge-active" style={{ fontSize: '9px', padding: '2px 5px' }}>
                      {s.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.commandOrUrl}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Installed Plugins */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Puzzle size={16} style={{ color: 'var(--accent-violet)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              Installed Plugins ({plugins.length})
            </h3>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: '56px', width: '100%' }} />
          ) : plugins.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
              No plugins installed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {plugins.map(p => (
                <div
                  key={p.name}
                  style={{
                    padding: '8px 12px', background: 'var(--bg-elevated)',
                    borderRadius: '6px', border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                      {p.name}
                    </span>
                    <span className="badge badge-violet" style={{ fontSize: '9px', padding: '2px 5px' }}>
                      {p.status}
                    </span>
                  </div>
                  {Object.entries(p.details || {}).map(([k, v]) => (
                    <div key={k} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {k}: <strong>{v}</strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics & Environment */}
      {env && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Cpu size={16} style={{ color: 'var(--accent-violet)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              System Environment & Diagnostics
            </h3>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px',
            fontSize: '12px'
          }}>
            <div>Architecture: <strong>{env.arch} ({env.os})</strong></div>
            <div>Kernel: <strong>{env.kernel}</strong></div>
            <div>Node.js: <strong>{env.nodeVersion}</strong></div>
            <div>npm: <strong>{env.npmVersion}</strong></div>
            <div>Git: <strong>{env.gitVersion}</strong></div>
            <div>Antigravity CLI: <strong>v{env.agyVersion}</strong></div>
            <div>Uptime: <strong>{Math.round(env.uptime / 3600)} hours</strong></div>
            <div>Data Dir: <strong style={{ fontFamily: 'monospace', fontSize: '11px' }}>{env.agyDataDir}</strong></div>
          </div>
          {env.diskInfo && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Disk Usage: {env.diskInfo}
            </div>
          )}
        </div>
      )}

      {/* Task Log Modal */}
      <Modal
        isOpen={!!selectedTaskLog}
        onClose={() => setSelectedTaskLog(null)}
        title={`Task Log: ${selectedTaskLog?.id || ''}`}
        maxWidth="750px"
      >
        <div className="code-box" style={{ maxHeight: '60vh' }}>
          {selectedTaskLog?.content || '(No log content recorded)'}
        </div>
      </Modal>
    </div>
  );
};
