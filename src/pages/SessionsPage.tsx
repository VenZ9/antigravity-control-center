import React, { useEffect, useState, useRef } from 'react';
import { 
  Send, Square, Sparkles, Terminal, MessageSquare, Plus, 
  Layers, ChevronDown, Folder, ArrowDown, Copy, Check, 
  Clock, CheckCircle2, AlertCircle, RefreshCw, X, Shield,
  Paperclip, Maximize2, Minimize2, Loader2, FileText
} from 'lucide-react';
import { ManagedSession, TranscriptStep } from '../types';
import { API } from '../api/client';
import { wsClient } from '../api/ws';
import { Modal } from '../components/Modal';
import { ChatMessage } from '../components/ChatMessage';
import { MarkdownView } from '../components/MarkdownView';

interface SessionsProps {
  initialResumeId?: string | null;
  onClearResumeId?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

interface AttachedFile {
  name: string;
  path: string;
  size: number;
}

export const SessionsPage: React.FC<SessionsProps> = ({ 
  initialResumeId, 
  onClearResumeId,
  isFocusMode = false,
  onToggleFocusMode
}) => {
  const [sessions, setSessions] = useState<ManagedSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ManagedSession | null>(null);
  const [loading, setLoading] = useState(true);

  // View mode: ChatGPT style vs Monospace Raw Terminal Logs
  const [viewMode, setViewMode] = useState<'chat' | 'logs'>('chat');

  // Chat messages / trajectory steps
  const [steps, setSteps] = useState<TranscriptStep[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');

  // File Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autoscroll state
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Session Drawer / History Switcher Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // New Session Modal Form
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [selectedModel, setSelectedModel] = useState('Gemini 3.8 Flash (High)');
  const [selectedEffort, setSelectedEffort] = useState('high');
  const [newSessionPrompt, setNewSessionPrompt] = useState('');
  const [resumeId, setResumeId] = useState(initialResumeId || '');
  const [submitting, setSubmitting] = useState(false);

  // Raw logs copy feedback
  const [copiedLogs, setCopiedLogs] = useState(false);

  useEffect(() => {
    if (initialResumeId) {
      setResumeId(initialResumeId);
      setIsNewModalOpen(true);
      if (onClearResumeId) onClearResumeId();
    }
  }, [initialResumeId]);

  useEffect(() => {
    loadSessions();

    // WebSocket event listeners for live interactive chat
    const unsubTurnStart = wsClient.on('session_turn_start', (data: any) => {
      if (selectedSessionId && data.sessionId === selectedSessionId) {
        setIsResponding(true);
        // Ensure user turn is visible
        setSteps(prev => {
          const hasLastUser = prev.length > 0 && prev[prev.length - 1].content === data.content;
          if (hasLastUser) return prev;
          return [
            ...prev,
            {
              step_index: prev.length,
              type: 'USER_INPUT',
              source: 'USER_EXPLICIT',
              content: data.content,
              created_at: data.timestamp || new Date().toISOString()
            }
          ];
        });
        scrollChatToBottom();
      }
    });

    const unsubTurnResult = wsClient.on('session_turn_result', (data: any) => {
      if (selectedSessionId && data.sessionId === selectedSessionId) {
        setIsResponding(false);
        // Refresh transcript from server to capture all thoughts and tool calls
        reloadTranscript(selectedSessionId);
      }
    });

    const unsubStatus = wsClient.on('session_status', (data: any) => {
      setSessions(prev => prev.map(s => s.id === data.sessionId ? { ...s, status: data.status } : s));
      if (selectedSessionId === data.sessionId) {
        setCurrentSession(prev => prev ? { ...prev, status: data.status } : null);
        if (data.status === 'idle' || data.status === 'completed' || data.status === 'cancelled' || data.status === 'failed') {
          setIsResponding(false);
        } else if (data.status === 'running') {
          setIsResponding(true);
        }
      }
    });

    const unsubOutput = wsClient.on('session_output', (data: any) => {
      if (selectedSessionId && data.sessionId === selectedSessionId) {
        setCurrentSession(prev => {
          if (!prev) return null;
          return {
            ...prev,
            logs: [...(prev.logs || []), data]
          };
        });
        if (!isScrolledUp && terminalEndRef.current) {
          terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });

    return () => {
      unsubTurnStart();
      unsubTurnResult();
      unsubStatus();
      unsubOutput();
    };
  }, [selectedSessionId, isScrolledUp]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await API.getSessions();
      const list = res.sessions || [];
      setSessions(list);
      if (list.length && !selectedSessionId) {
        selectSession(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (id: string) => {
    setSelectedSessionId(id);
    setIsHistoryModalOpen(false);
    setIsScrolledUp(false);
    try {
      const res = await API.getSession(id);
      setCurrentSession(res.session);
      setIsResponding(res.session.status === 'running');
      await reloadTranscript(id);
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  };

  const reloadTranscript = async (sessionId: string) => {
    try {
      setLoadingTranscript(true);
      const res = await API.getSessionTranscript(sessionId);
      if (res.steps && res.steps.length > 0) {
        setSteps(res.steps);
      } else {
        setSteps([]);
      }
      setTimeout(scrollChatToBottom, 80);
    } catch (err) {
      console.error('Failed to load session transcript:', err);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const scrollChatToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsScrolledUp(false);
    }
  };

  const handleScrollChat = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 80);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const fileArray = Array.from(files);
      const res = await API.uploadFiles(fileArray);

      if (res.files && res.files.length > 0) {
        const newAttachments: AttachedFile[] = res.files.map(f => ({
          name: f.fileName,
          path: f.filePath,
          size: f.size
        }));
        setAttachedFiles(prev => [...prev, ...newAttachments]);
      }
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const message = inputPrompt.trim();
    if ((!message && attachedFiles.length === 0) || isResponding) return;

    const attachmentPaths = attachedFiles.map(a => a.path);
    const textToSend = message || 'Please inspect the attached files.';

    if (!selectedSessionId) {
      // Create session first if none exists
      handleCreateAndSend(textToSend, attachmentPaths);
      return;
    }

    // Format content with attachments header if present
    let optimisticContent = textToSend;
    if (attachmentPaths.length > 0) {
      const fileList = attachmentPaths.map(p => `- ${p}`).join('\n');
      optimisticContent = `The user has attached the following files. Use your tools to inspect them:\n${fileList}\n\n${textToSend}`;
    }

    // Optimistically append user message to chat immediately
    const optimisticStep: TranscriptStep = {
      step_index: steps.length,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: optimisticContent,
      created_at: new Date().toISOString()
    };
    setSteps(prev => [...prev, optimisticStep]);
    setInputPrompt('');
    setAttachedFiles([]);
    setIsResponding(true);
    setTimeout(scrollChatToBottom, 50);

    try {
      await API.sendSessionMessage(selectedSessionId, textToSend, attachmentPaths);
    } catch (err: any) {
      alert(`Send error: ${err.message}`);
      setIsResponding(false);
    }
  };

  const handleCreateAndSend = async (message: string, attachments: string[] = []) => {
    try {
      setSubmitting(true);
      const res = await API.createSession({
        sessionName: `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        workspacePath,
        model: selectedModel,
        effort: selectedEffort,
        prompt: message,
        attachments
      });

      setInputPrompt('');
      setAttachedFiles([]);
      setIsNewModalOpen(false);
      await loadSessions();
      selectSession(res.session.sessionId);
    } catch (err: any) {
      alert(`Failed to launch session: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStopSession = async () => {
    if (!selectedSessionId) return;
    try {
      await API.stopSession(selectedSessionId);
      setIsResponding(false);
    } catch (err: any) {
      alert(`Stop error: ${err.message}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyLogs = async () => {
    if (!currentSession?.logs) return;
    try {
      const fullText = currentSession.logs.map((l: any) => `[${l.timestamp?.substring(11, 19) || ''}] [${l.stream_type}] ${l.content}`).join('\n');
      await navigator.clipboard.writeText(fullText);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {}
  };

  const activeSessions = sessions.filter(s => s.status === 'running' || s.isActiveProcess);
  const pastSessions = sessions.filter(s => s.status !== 'running' && !s.isActiveProcess);

  const starterPrompts = [
    'Inspect git status and summarize uncommitted changes',
    'Audit dependencies and check for security vulnerabilities',
    'Analyze workspace directory structure and project health',
    'Summarize recent conversations and active agent tasks'
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: isFocusMode ? '0' : '12px',
      height: isFocusMode ? '100dvh' : 'auto',
      width: '100%'
    }}>
      {/* Top Session Control & Switcher Bar */}
      <div className="card" style={{
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        borderRadius: isFocusMode ? 0 : '12px',
        borderTop: isFocusMode ? 'none' : undefined,
        borderLeft: isFocusMode ? 'none' : undefined,
        borderRight: isFocusMode ? 'none' : undefined,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        zIndex: 10
      }}>
        {/* Current Session Selector Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="btn btn-secondary"
            style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '13px', borderRadius: '8px', gap: '8px' }}
          >
            <Layers size={14} style={{ color: 'var(--accent-violet)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentSession?.session_name || 'Select Session'}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {currentSession && (
            <span className={`badge ${
              currentSession.status === 'running' || isResponding ? 'badge-active' :
              (currentSession.status === 'cancelled' ? 'badge-warning' : 'badge-idle')
            }`} style={{ fontSize: '10px' }}>
              {(currentSession.status === 'running' || isResponding) && <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />}
              {isResponding ? 'Responding' : currentSession.status}
            </span>
          )}
        </div>

        {/* View Mode, Focus Mode & New Chat Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('chat')}
              style={{
                background: viewMode === 'chat' ? 'var(--accent-violet)' : 'transparent',
                color: viewMode === 'chat' ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderRadius: '6px', padding: '4px 10px',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <MessageSquare size={12} />
              Chat
            </button>
            <button
              onClick={() => setViewMode('logs')}
              style={{
                background: viewMode === 'logs' ? 'var(--accent-violet)' : 'transparent',
                color: viewMode === 'logs' ? '#fff' : 'var(--text-secondary)',
                border: 'none', borderRadius: '6px', padding: '4px 10px',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <Terminal size={12} />
              Logs
            </button>
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="btn btn-primary"
            style={{ minHeight: '34px', height: '34px', padding: '0 12px', fontSize: '12px', borderRadius: '7px' }}
          >
            <Plus size={14} />
            New Chat
          </button>

          {/* Focus Mode Toggle Button */}
          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className="btn btn-secondary"
              style={{ minHeight: '34px', height: '34px', width: '34px', padding: 0, borderRadius: '7px' }}
              title={isFocusMode ? 'Exit Full-Screen Focus Mode' : 'Enter Full-Screen Focus Mode'}
              aria-label={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode'}
            >
              {isFocusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div
        className="chat-window"
        style={{
          borderRadius: isFocusMode ? 0 : '16px',
          border: isFocusMode ? 'none' : '1px solid var(--border-subtle)',
          height: isFocusMode ? 'calc(100dvh - 58px)' : undefined,
          flex: isFocusMode ? 1 : undefined
        }}
      >
        {viewMode === 'chat' ? (
          <>
            {/* Scrollable Chat Area */}
            <div
              ref={chatScrollRef}
              onScroll={handleScrollChat}
              className="chat-messages-scroll"
            >
              {loadingTranscript ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 0' }}>
                  <div className="skeleton" style={{ height: '60px', width: '60%', alignSelf: 'flex-end' }} />
                  <div className="skeleton" style={{ height: '120px', width: '85%', alignSelf: 'flex-start' }} />
                </div>
              ) : steps.length === 0 && !isResponding ? (
                /* Empty Chat Starter Screen */
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  margin: 'auto', padding: '30px 16px', textAlign: 'center', maxWidth: '480px'
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', marginBottom: '14px', boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)'
                  }}>
                    <Sparkles size={24} />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Antigravity Chat Session Ready
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                    Type an instruction or attach files below to start an interactive multi-turn session. You can ask questions, run commands, and review file edits in real time.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    {starterPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInputPrompt(p);
                        }}
                        style={{
                          textAlign: 'left', padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', fontSize: '12.5px', cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        &rarr; {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {steps.map((step, idx) => (
                    <ChatMessage
                      key={step.step_index || idx}
                      step={step}
                    />
                  ))}

                  {/* Responding / Thinking State */}
                  {isResponding && (
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      margin: '12px 0',
                      paddingRight: '15%'
                    }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0
                      }}>
                        <Sparkles size={16} />
                      </div>

                      <div style={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        borderTopLeftRadius: '4px',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          Thinking & executing
                        </span>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Floating Jump to Bottom Button */}
            {isScrolledUp && (
              <button
                onClick={scrollChatToBottom}
                className="scroll-bottom-btn"
                style={{ bottom: '74px' }}
                title="Scroll to bottom"
                aria-label="Scroll to bottom"
              >
                <ArrowDown size={18} />
              </button>
            )}

            {/* Sticky Bottom Input Bar */}
            <div className="chat-input-sticky">
              {/* Attachment Chips Display */}
              {attachedFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                  {attachedFiles.map((att, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'rgba(139, 92, 246, 0.16)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        fontSize: '11px',
                        color: '#E2E8F0',
                        maxWidth: '220px'
                      }}
                    >
                      <Paperclip size={12} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {att.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        ({Math.round(att.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '3px'
                        }}
                        title="Remove file"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                {/* Hidden File Input */}
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />

                {/* Paperclip Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isResponding || isUploading}
                  className="btn btn-secondary"
                  style={{
                    minHeight: '44px', width: '44px', padding: 0, borderRadius: '10px', flexShrink: 0,
                    opacity: isResponding || isUploading ? 0.6 : 1
                  }}
                  title="Attach files to prompt (up to 15MB)"
                  aria-label="Attach file"
                >
                  {isUploading ? <Loader2 size={16} className="spin" /> : <Paperclip size={16} />}
                </button>

                {/* Textarea */}
                <textarea
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isResponding
                      ? 'Agent is working on current turn...'
                      : attachedFiles.length > 0
                        ? 'Add an instruction for attached files (or press Enter)...'
                        : 'Ask Antigravity anything... (Enter to send, Shift+Enter for newline)'
                  }
                  disabled={isResponding}
                  rows={1}
                  className="input-field"
                  style={{
                    minHeight: '44px',
                    maxHeight: '120px',
                    padding: '10px 14px',
                    fontSize: '13.5px',
                    resize: 'none',
                    lineHeight: '1.45',
                    borderRadius: '10px',
                    flex: 1
                  }}
                />

                {/* Send / Stop Buttons */}
                {isResponding ? (
                  <button
                    type="button"
                    onClick={handleStopSession}
                    className="btn btn-danger"
                    style={{ minHeight: '44px', width: '44px', padding: 0, borderRadius: '10px', flexShrink: 0 }}
                    title="Stop / Interrupt agent"
                  >
                    <Square size={16} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={(!inputPrompt.trim() && attachedFiles.length === 0) || isResponding || isUploading}
                    className="btn btn-primary"
                    style={{
                      minHeight: '44px', width: '44px', padding: 0, borderRadius: '10px', flexShrink: 0,
                      opacity: (!inputPrompt.trim() && attachedFiles.length === 0) || isUploading ? 0.5 : 1
                    }}
                    title="Send prompt"
                  >
                    <Send size={16} />
                  </button>
                )}
              </form>
            </div>
          </>
        ) : (
          /* Raw Monospace Terminal Output Window */
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
              padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Session Terminal Output ({currentSession?.logs?.length || 0} lines)
              </span>
              {currentSession?.logs && currentSession.logs.length > 0 && (
                <button
                  onClick={handleCopyLogs}
                  className="btn btn-secondary"
                  style={{ minHeight: '28px', height: '28px', fontSize: '11px', padding: '0 8px' }}
                >
                  {copiedLogs ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                  <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div
              ref={terminalContainerRef}
              className="code-box"
              style={{
                flex: 1,
                overflowY: 'auto',
                borderRadius: 0,
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              {!currentSession?.logs || currentSession.logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                  No output logs captured for this session yet.
                </div>
              ) : (
                currentSession.logs.map((log: any, i: number) => {
                  const color = log.stream_type === 'stderr' ? 'var(--danger)' :
                                (log.stream_type === 'system' ? 'var(--accent-violet)' : '#CBD5E1');
                  return (
                    <div key={log.id || i} style={{ color, wordBreak: 'break-all', fontSize: '12px', lineHeight: '1.45' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginRight: '8px', userSelect: 'none' }}>
                        {log.timestamp ? log.timestamp.substring(11, 19) : ''}
                      </span>
                      {log.content}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Session Switcher & History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Session History & Switcher"
        maxWidth="600px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Sessions */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-violet)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Active Sessions ({activeSessions.length})
            </div>
            {activeSessions.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
                No actively executing sessions right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeSessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => selectSession(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: selectedSessionId === s.id ? 'var(--accent-violet-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${selectedSessionId === s.id ? 'var(--accent-violet)' : 'rgba(16, 185, 129, 0.4)'}`
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                        {s.session_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.model} • {s.workspace_path}
                      </div>
                    </div>
                    <span className="badge badge-active" style={{ fontSize: '10px' }}>
                      <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Sessions */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Past Sessions ({pastSessions.length})
            </div>
            {pastSessions.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
                No past sessions recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {pastSessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => selectSession(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: selectedSessionId === s.id ? 'var(--accent-violet-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${selectedSessionId === s.id ? 'var(--accent-violet)' : 'var(--border-subtle)'}`
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                        {s.session_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.model} • {new Date(s.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="badge badge-idle" style={{ fontSize: '10px' }}>
                      Resume &rarr;
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* New Session Configuration Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Start New Chat Session"
      >
        <form onSubmit={e => { e.preventDefault(); handleCreateAndSend(newSessionPrompt); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Session Name (Optional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Refactor API endpoints"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Workspace Directory
            </label>
            <div style={{ position: 'relative' }}>
              <Folder size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                value={workspacePath}
                placeholder="Leave blank for default workspace root"
                onChange={e => setWorkspacePath(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Model
              </label>
              <select
                className="input-field"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                <option value="Gemini 3.8 Flash (High)">Gemini 3.8 Flash (High)</option>
                <option value="Gemini 3.8 Flash (Medium)">Gemini 3.8 Flash (Medium)</option>
                <option value="Gemini 3.8 Flash (Low)">Gemini 3.8 Flash (Low)</option>
                <option value="Claude Sonnet 4.6 (Thinking)">Claude Sonnet 4.6 (Thinking)</option>
                <option value="Claude Opus 4.6 (Thinking)">Claude Opus 4.6 (Thinking)</option>
                <option value="GPT-OSS 120B (Medium)">GPT-OSS 120B (Medium)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Effort
              </label>
              <select
                className="input-field"
                value={selectedEffort}
                onChange={e => setSelectedEffort(e.target.value)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="xhigh">Extra High</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Initial Prompt (Optional)
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Leave empty to start clean chat, or type your first prompt..."
              value={newSessionPrompt}
              onChange={e => setNewSessionPrompt(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
