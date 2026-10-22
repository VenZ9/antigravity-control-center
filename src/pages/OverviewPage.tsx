import React, { useEffect, useState } from 'react';
import { 
  Sparkles, RefreshCw, Play, ArrowRight, Activity, 
  FolderGit2, Settings, Cpu, Database, Terminal, Layers, 
  Clock, Shield 
} from 'lucide-react';
import { AppPage, ConversationSummary } from '../types';
import { API } from '../api/client';

interface OverviewProps {
  onNavigate: (page: AppPage) => void;
  onOpenConversation: (convId: string) => void;
  onOpenNewSession: () => void;
}

export const OverviewPage: React.FC<OverviewProps> = ({
  onNavigate,
  onOpenConversation,
  onOpenNewSession
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [env, setEnv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncingFts, setSyncingFts] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [convsRes, analyticsRes, envRes] = await Promise.all([
        API.getConversations({ limit: 6 }),
        API.getAnalytics(),
        API.getEnv()
      ]);
      setConversations(convsRes.conversations || []);
      setAnalytics(analyticsRes);
      setEnv(envRes.env);
    } catch (err) {
      console.error('Failed to load overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFts = async () => {
    try {
      setSyncingFts(true);
      await API.syncFts();
      alert('Search index synchronized successfully!');
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingFts(false);
    }
  };

  const activeConvs = conversations.filter(c => c.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(18, 21, 32, 1) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-violet">
                <Shield size={11} style={{ marginRight: '3px' }} />
                Termux ARM64
              </span>
              <span className="badge" style={{ background: '#171B2A', color: '#94A3B8', border: '1px solid var(--border-subtle)' }}>
                agy v{env?.agyVersion || '1.4.4'}
              </span>
              <span className="badge" style={{ background: '#171B2A', color: '#94A3B8', border: '1px solid var(--border-subtle)' }}>
                Node {env?.nodeVersion || '26.4.0'}
              </span>
            </div>
            <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Antigravity Control Center
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Local management dashboard running on Android localhost (Port 4300).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSyncFts}
              disabled={syncingFts}
              className="btn btn-secondary"
              style={{ minHeight: '38px', height: '38px', fontSize: '12px', padding: '0 12px', borderRadius: '7px' }}
            >
              <RefreshCw size={13} className={syncingFts ? 'spin' : ''} />
              {syncingFts ? 'Indexing...' : 'Sync Search'}
            </button>
            <button
              onClick={onOpenNewSession}
              className="btn btn-primary"
              style={{ minHeight: '38px', height: '38px', fontSize: '12px', padding: '0 14px', borderRadius: '7px' }}
            >
              <Play size={13} fill="currentColor" />
              New Run
            </button>
          </div>
        </div>
      </div>

      {/* Active Session Notification Card */}
      {activeConvs.length > 0 && (
        <div className="card" style={{
          borderColor: 'rgba(16, 185, 129, 0.4)',
          background: 'rgba(16, 185, 129, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="pulse-dot" />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: '14px' }}>
                  CLI Session Actively Executing
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {activeConvs[0].title || activeConvs[0].conversation_id}
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('monitor')}
              className="btn btn-primary"
              style={{ minHeight: '36px', height: '36px', fontSize: '12px', background: 'var(--success)', borderRadius: '7px' }}
            >
              Watch Live Stream <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px'
      }}>
        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={13} style={{ color: 'var(--accent-violet)' }} />
            Conversations
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
            {conversations.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-violet)', marginTop: '4px' }}>
            Stored locally
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} style={{ color: activeConvs.length > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
            Active Runs
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: activeConvs.length > 0 ? 'var(--success)' : 'var(--text-main)', marginTop: '6px' }}>
            {activeConvs.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeConvs.length > 0 ? 'Executing now' : 'Idle'}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={13} style={{ color: '#38BDF8' }} />
            Total Tokens
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
            {analytics?.grandTotal?.total_tokens ? analytics.grandTotal.total_tokens.toLocaleString() : '0'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {analytics?.recordedEventsCount || 0} turn events
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={13} style={{ color: 'var(--warning)' }} />
            Free Memory
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
            {env?.freeMem ? `${Math.round(env.freeMem / 1024 * 10) / 10} GB` : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Device RAM
          </div>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
            Recent Conversations
          </h3>
          <button
            onClick={() => onNavigate('conversations')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-violet)',
              fontSize: '12.5px',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>View all ({conversations.length})</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} className="skeleton" style={{ height: '56px', width: '100%' }} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No Antigravity conversations discovered yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {conversations.slice(0, 5).map(conv => (
              <div
                key={conv.conversation_id}
                onClick={() => onOpenConversation(conv.conversation_id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: '8px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', transition: 'all 0.15s ease'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title || 'Untitled Conversation'}
                    </span>
                    {conv.isActive && (
                      <span className="badge badge-active" style={{ fontSize: '10px', padding: '2px 6px' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.preview || 'No preview text'}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {conv.step_count} steps
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {conv.last_modified_time ? new Date(conv.last_modified_time).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Launch / Shortcuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        <div
          onClick={() => onNavigate('monitor')}
          className="card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-violet)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Live Activity Monitor</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time streaming agent steps</div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('files')}
          className="card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FolderGit2 size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Git Changes & Diffs</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Workspace file inspector</div>
          </div>
        </div>

        <div
          onClick={() => onNavigate('settings')}
          className="card"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px' }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Settings size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>CLI Settings</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure model & editor</div>
          </div>
        </div>
      </div>
    </div>
  );
};
