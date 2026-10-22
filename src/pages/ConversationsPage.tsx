import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, SlidersHorizontal, ArrowDown, Play, Code, 
  Sparkles, Calendar, Layers, X, Terminal, RefreshCw, FileText
} from 'lucide-react';
import { ConversationSummary, TranscriptStep } from '../types';
import { API } from '../api/client';
import { Modal } from '../components/Modal';
import { ChatMessage } from '../components/ChatMessage';

interface ConversationsProps {
  onOpenSessionWithResume?: (convId: string) => void;
}

export const ConversationsPage: React.FC<ConversationsProps> = ({ onOpenSessionWithResume }) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle'>('all');
  const [sortBy, setSortBy] = useState<'last_modified_time' | 'step_count'>('last_modified_time');
  const [loading, setLoading] = useState(true);

  // Modal State for Transcript View
  const [selectedConv, setSelectedConv] = useState<ConversationSummary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptStep[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeStepOutput, setActiveStepOutput] = useState<{ stepIndex: number; output: string } | null>(null);

  // Smart Autoscroll in Transcript Modal
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [searchQuery, statusFilter, sortBy]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      if (searchQuery.trim()) {
        const res = await API.searchConversations(searchQuery);
        let list = res.conversations || [];
        if (statusFilter === 'active') list = list.filter(c => c.isActive);
        if (statusFilter === 'idle') list = list.filter(c => !c.isActive);
        setConversations(list);
      } else {
        const res = await API.getConversations({
          sortBy,
          status: statusFilter === 'active' ? 'CASCADE_RUN_STATUS_RUNNING' : (statusFilter === 'idle' ? 'CASCADE_RUN_STATUS_IDLE' : undefined),
          limit: 100
        });
        setConversations(res.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTranscript = async (conv: ConversationSummary) => {
    setSelectedConv(conv);
    setShowRawJson(false);
    setActiveStepOutput(null);
    setIsScrolledUp(false);
    try {
      setLoadingTranscript(true);
      const res = await API.getTranscript(conv.conversation_id, { full: true });
      setTranscript(res.steps || []);
      // Scroll to bottom after loading
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load transcript:', err);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    // If distance from bottom is greater than 80px, consider user scrolled up
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 80);
  };

  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsScrolledUp(false);
    }
  };

  const handleViewStepOutput = async (stepIndex: number) => {
    if (!selectedConv) return;
    try {
      const res = await API.getStepOutput(selectedConv.conversation_id, stepIndex);
      setActiveStepOutput({ stepIndex, output: res.output });
    } catch (err: any) {
      alert(`Could not load step output: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Controls Bar */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            className="input-field"
            placeholder="Search conversations, titles, or prompt content (FTS5)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', paddingRight: searchQuery ? '36px' : '12px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
            {(['all', 'active', 'idle'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  background: statusFilter === tab ? 'var(--accent-violet)' : 'transparent',
                  color: statusFilter === tab ? '#fff' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '6px', padding: '6px 14px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="input-field"
              style={{ minHeight: '34px', height: '34px', padding: '4px 8px', fontSize: '12px', width: 'auto' }}
            >
              <option value="last_modified_time">Recently Modified</option>
              <option value="step_count">Step Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Conversations List with Skeleton Loading */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="card" style={{ height: '94px', padding: '16px' }}>
              <div className="skeleton" style={{ width: '40%', height: '16px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '80%', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '25%', height: '10px' }} />
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '4px' }}>
            No conversations found
          </div>
          <div style={{ fontSize: '12px' }}>
            Try adjusting your search query or status filter.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {conversations.map(conv => (
            <div
              key={conv.conversation_id}
              onClick={() => handleOpenTranscript(conv)}
              className="card"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderColor: conv.isActive ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title || 'Untitled Conversation'}
                    </span>
                    {conv.isActive && (
                      <span className="badge badge-active" style={{ fontSize: '10px', padding: '2px 6px' }}>
                        <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-violet)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.conversation_id}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className="badge" style={{ background: '#171B2A', color: '#94A3B8', fontSize: '11px', border: '1px solid var(--border-subtle)' }}>
                    <Layers size={10} style={{ marginRight: '3px' }} />
                    {conv.step_count} steps
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <Calendar size={11} />
                    {conv.last_modified_time ? new Date(conv.last_modified_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>

              {conv.preview && (
                <div style={{
                  fontSize: '12.5px', color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.45'
                }}>
                  {conv.preview}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transcript Detail Modal (ChatGPT / Grok Style) */}
      <Modal
        isOpen={!!selectedConv}
        onClose={() => setSelectedConv(null)}
        title={selectedConv?.title || 'Conversation Transcript'}
        maxWidth="840px"
      >
        {selectedConv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
            {/* Modal Header controls */}
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: '10px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  ID: {selectedConv.conversation_id}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Total turns: <strong style={{ color: 'var(--text-main)' }}>{transcript.length}</strong> | Status: <span className="badge badge-idle" style={{ fontSize: '9px', padding: '1px 5px' }}>{selectedConv.status}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="btn btn-secondary"
                  style={{ minHeight: '32px', height: '32px', fontSize: '11px', padding: '0 10px', borderRadius: '6px' }}
                >
                  <Code size={13} />
                  {showRawJson ? 'Chat View' : 'Raw JSON'}
                </button>
                {onOpenSessionWithResume && (
                  <button
                    onClick={() => {
                      const id = selectedConv.conversation_id;
                      setSelectedConv(null);
                      onOpenSessionWithResume(id);
                    }}
                    className="btn btn-primary"
                    style={{ minHeight: '32px', height: '32px', fontSize: '11px', padding: '0 12px', borderRadius: '6px' }}
                  >
                    <Play size={12} fill="currentColor" />
                    Resume in Runner
                  </button>
                )}
              </div>
            </div>

            {loadingTranscript ? (
              <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="skeleton" style={{ height: '70px', width: '70%', alignSelf: 'flex-end' }} />
                <div className="skeleton" style={{ height: '140px', width: '85%', alignSelf: 'flex-start' }} />
                <div className="skeleton" style={{ height: '50px', width: '65%', alignSelf: 'flex-end' }} />
              </div>
            ) : showRawJson ? (
              <div className="code-box" style={{ maxHeight: '65vh' }}>
                {JSON.stringify(transcript, null, 2)}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* Chat Container */}
                <div
                  ref={chatScrollRef}
                  onScroll={handleScroll}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '65vh',
                    overflowY: 'auto',
                    paddingRight: '6px'
                  }}
                >
                  {transcript.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                      No trajectory steps found in this transcript.
                    </div>
                  ) : (
                    transcript.map((step, idx) => (
                      <ChatMessage
                        key={step.step_index || idx}
                        step={step}
                        stepOutput={activeStepOutput?.stepIndex === step.step_index ? activeStepOutput.output : null}
                        onViewStepOutput={step.has_output_file ? handleViewStepOutput : undefined}
                      />
                    ))
                  )}
                </div>

                {/* Floating "Scroll to Bottom" Button */}
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

            {/* Step Output Inspection Panel */}
            {activeStepOutput && (
              <div style={{
                marginTop: '10px', padding: '14px', background: '#05070A',
                border: '1px solid var(--border-subtle)', borderRadius: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={14} style={{ color: 'var(--accent-violet)' }} />
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-main)' }}>
                      Execution Output: Step #{activeStepOutput.stepIndex}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveStepOutput(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="code-box" style={{ maxHeight: '250px' }}>
                  {activeStepOutput.output}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
