import React, { useState } from 'react';
import { User, Sparkles, Copy, Check, Brain, ChevronDown, ChevronRight, Paperclip, FileText } from 'lucide-react';
import { TranscriptStep } from '../types';
import { MarkdownView } from './MarkdownView';
import { ToolAccordion } from './ToolAccordion';
import { sanitizeUserMessage } from '../utils/sanitize';

interface ChatMessageProps {
  step: TranscriptStep;
  stepOutput?: string | null;
  onViewStepOutput?: (stepIndex: number) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  step,
  stepOutput,
  onViewStepOutput
}) => {
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const isUser = step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT';

  // Sanitize user prompt to remove raw <USER_REQUEST>, <ADDITIONAL_METADATA>, etc.
  const { text: cleanUserText, attachments: userAttachments } = isUser
    ? sanitizeUserMessage(step.content)
    : { text: '', attachments: [] };

  const handleCopyMessage = async () => {
    try {
      const textToCopy = isUser ? cleanUserText : (step.content || step.thinking || '');
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isUser) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        margin: '14px 0',
        paddingLeft: '15%'
      }}>
        {/* User Bubble */}
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          flexDirection: 'row-reverse'
        }}>
          {/* User Avatar */}
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-violet)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
          }}>
            <User size={16} />
          </div>

          <div style={{
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            borderTopRightRadius: '4px',
            padding: '12px 16px',
            maxWidth: '100%',
            color: 'var(--text-main)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
          }}>
            {/* Attached files badges if present */}
            {userAttachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {userAttachments.map((att, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      background: 'rgba(139, 92, 246, 0.22)',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#E2E8F0',
                      fontFamily: 'monospace'
                    }}
                    title={att.path}
                  >
                    <Paperclip size={11} style={{ color: 'var(--accent-violet)' }} />
                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              fontSize: '14px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {cleanUserText}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
              marginTop: '6px',
              fontSize: '10.5px',
              color: 'var(--text-muted)'
            }}>
              <span>{step.created_at ? new Date(step.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span>•</span>
              <span>#{step.step_index}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assistant / Agent Message
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      margin: '14px 0',
      paddingRight: '10%'
    }}>
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        width: '100%'
      }}>
        {/* Assistant Avatar */}
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(124, 58, 237, 0.3)'
        }}>
          <Sparkles size={17} />
        </div>

        {/* Message Container Card */}
        <div style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          borderTopLeftRadius: '4px',
          padding: '14px 18px',
          flex: 1,
          minWidth: 0,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
        }}>
          {/* Header metadata */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '12px' }}>
                Antigravity Agent
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Step #{step.step_index}
              </span>
            </div>

            {typeof step.input_tokens === 'number' && (
              <span style={{ fontFamily: 'monospace', color: 'var(--accent-violet)', fontSize: '10.5px' }}>
                {step.input_tokens} in / {step.output_tokens || 0} out
                {step.cache_read_tokens ? ` (${step.cache_read_tokens} cached)` : ''}
              </span>
            )}
          </div>

          {/* Collapsible Thinking Process Accordion */}
          {step.thinking && (
            <div style={{
              marginBottom: '12px',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              backgroundColor: 'rgba(139, 92, 246, 0.04)',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowThinking(!showThinking)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-violet)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Brain size={14} />
                  <span>Thinking Process</span>
                </div>
                {showThinking ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {showThinking && (
                <div style={{
                  padding: '10px 14px',
                  borderTop: '1px solid rgba(139, 92, 246, 0.15)',
                  backgroundColor: '#07090F',
                  color: '#94A3B8',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
                }}>
                  {step.thinking}
                </div>
              )}
            </div>
          )}

          {/* Tool Calls Accordions */}
          {step.tool_calls && step.tool_calls.length > 0 && (
            <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {step.tool_calls.map((tool, tIdx) => (
                <ToolAccordion
                  key={tIdx}
                  tool={tool}
                  stepIndex={step.step_index}
                  output={stepOutput}
                  onViewOutput={onViewStepOutput ? () => onViewStepOutput(step.step_index) : undefined}
                />
              ))}
            </div>
          )}

          {/* Main Assistant Content */}
          {step.content && (
            <MarkdownView content={step.content} />
          )}

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <span>{step.created_at ? new Date(step.created_at).toLocaleTimeString() : ''}</span>

            <button
              onClick={handleCopyMessage}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                color: copied ? 'var(--success)' : 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
              title="Copy message text"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
