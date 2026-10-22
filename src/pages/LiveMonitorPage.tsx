import React, { useEffect, useState, useRef } from 'react';
import { 
  Radio, Sparkles, User, FileCode, ArrowDown, RefreshCw, 
  Terminal, Activity, Eye, CheckCircle2 
} from 'lucide-react';
import { API } from '../api/client';
import { wsClient } from '../api/ws';
import { ChatMessage } from '../components/ChatMessage';

export const LiveMonitorPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSnapshot();

    // Subscribe to live WebSocket snapshot updates
    const unsubscribe = wsClient.on('snapshot_update', (updatedSnapshot: any) => {
      setSnapshot(updatedSnapshot);
      if (autoScroll && !isScrolledUp && streamContainerRef.current) {
        streamContainerRef.current.scrollTo({
          top: streamContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });

    const unsubscribeSessionChange = wsClient.on('active_session_change', (data: any) => {
      if (data.snapshot) {
        setSnapshot(data.snapshot);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSessionChange();
    };
  }, [autoScroll, isScrolledUp]);

  const loadSnapshot = async () => {
    try {
      setLoading(true);
      const res = await API.getLiveSnapshot();
      setSnapshot(res);
      setTimeout(() => {
        if (streamContainerRef.current) {
          streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!streamContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = streamContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 80);
  };

  const scrollToBottom = () => {
    if (streamContainerRef.current) {
      streamContainerRef.current.scrollTo({
        top: streamContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsScrolledUp(false);
    }
  };

  const isLive = snapshot?.isLive;
  const recentSteps = snapshot?.recentSteps || [];
  const fileChanges = snapshot?.recentFileChanges || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Session State Banner */}
      <div className="card" style={{
        borderColor: isLive ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
        background: isLive ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLive ? (
              <span className="pulse-dot" />
            ) : (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {snapshot?.summary?.title || (isLive ? 'Active Agent Session' : 'No Active Session')}
                </span>
                <span className={`badge ${isLive ? 'badge-active' : 'badge-idle'}`}>
                  {isLive ? 'Running' : 'Idle'}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                Session ID: {snapshot?.selectedSessionId || 'none'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            <button
              onClick={loadSnapshot}
              className="btn btn-secondary"
              style={{ minHeight: '32px', height: '32px', fontSize: '11px', padding: '0 10px', borderRadius: '6px' }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Latest Prompt & Latest Response Quick Look */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {/* Latest User Prompt */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-violet)' }}>
            <User size={14} />
            Latest User Prompt
          </div>
          <div style={{
            fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)',
            padding: '10px 12px', borderRadius: '8px', minHeight: '60px', maxHeight: '130px',
            overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.45', border: '1px solid var(--border-subtle)'
          }}>
            {snapshot?.latestPrompt?.content || 'No prompt in active buffer'}
          </div>
        </div>

        {/* Latest Agent Activity */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--success)' }}>
            <Sparkles size={14} />
            Latest Agent Action
          </div>
          <div style={{
            fontSize: '13px', color: 'var(--text-main)', background: 'var(--bg-elevated)',
            padding: '10px 12px', borderRadius: '8px', minHeight: '60px', maxHeight: '130px',
            overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.45', border: '1px solid var(--border-subtle)'
          }}>
            {snapshot?.latestResponse?.tool_calls?.length ? (
              <div>
                <span style={{ color: 'var(--accent-violet)', fontWeight: 600 }}>
                  Calling Tool: {snapshot.latestResponse.tool_calls[0].tool_name}
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  {JSON.stringify(snapshot.latestResponse.tool_calls[0].args || {})}
                </div>
              </div>
            ) : (
              snapshot?.latestResponse?.content || snapshot?.latestResponse?.thinking || 'Awaiting agent response...'
            )}
          </div>
        </div>
      </div>

      {/* Recent File Changes Ticker */}
      {fileChanges.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
            <FileCode size={15} style={{ color: 'var(--accent-violet)' }} />
            Recent File Changes (Recorded via Tool Invocations)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {fileChanges.map((fc: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px',
                  fontSize: '12px', border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span className="badge badge-violet" style={{ fontSize: '9px', padding: '2px 5px' }}>
                    {fc.tool}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fc.path}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  Step #{fc.step_index}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Stream of Steps in ChatGPT/Grok Chat Bubble format */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--accent-violet)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
              Live Trajectory Stream ({recentSteps.length})
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Real-time WebSocket feed
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton" style={{ height: '60px', width: '65%', alignSelf: 'flex-end' }} />
            <div className="skeleton" style={{ height: '120px', width: '85%', alignSelf: 'flex-start' }} />
          </div>
        ) : recentSteps.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Terminal size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              No recent steps recorded in this conversation.
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Launch a run from the CLI Session Runner to observe steps in real-time.
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div
              ref={streamContainerRef}
              onScroll={handleScroll}
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '62vh',
                overflowY: 'auto',
                paddingRight: '6px'
              }}
            >
              {recentSteps.map((step: any, idx: number) => (
                <ChatMessage
                  key={step.step_index || idx}
                  step={step}
                />
              ))}
            </div>

            {/* Floating Jump to Bottom Button */}
            {isScrolledUp && (
              <button
                onClick={scrollToBottom}
                className="scroll-bottom-btn"
                title="Scroll to bottom"
                aria-label="Scroll to bottom"
              >
                <ArrowDown size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
