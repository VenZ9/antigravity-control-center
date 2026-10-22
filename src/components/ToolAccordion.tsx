import React, { useState } from 'react';
import { Wrench, ChevronDown, ChevronRight, Copy, Check, Terminal, FileCode, CheckCircle2 } from 'lucide-react';
import { ToolCall } from '../types';

interface ToolAccordionProps {
  tool: ToolCall;
  stepIndex?: number;
  output?: string | null;
  onViewOutput?: () => void;
}

export const ToolAccordion: React.FC<ToolAccordionProps> = ({
  tool,
  stepIndex,
  output,
  onViewOutput
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedArgs, setCopiedArgs] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const getToolIcon = (name: string) => {
    if (name.includes('command') || name.includes('bash') || name.includes('terminal')) {
      return <Terminal size={14} color="var(--accent-violet)" />;
    }
    if (name.includes('file')) {
      return <FileCode size={14} color="var(--accent-violet)" />;
    }
    return <Wrench size={14} color="var(--accent-violet)" />;
  };

  const getArgsSummary = () => {
    const args = tool.args || {};
    if (args.CommandLine) return String(args.CommandLine);
    if (args.command) return String(args.command);
    if (args.Path) return String(args.Path);
    if (args.path) return String(args.path);
    if (args.query) return `"${args.query}"`;
    const keys = Object.keys(args);
    return keys.length > 0 ? `${keys.join(', ')}` : 'no arguments';
  };

  const handleCopyArgs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(tool.args || {}, null, 2));
      setCopiedArgs(true);
      setTimeout(() => setCopiedArgs(false), 2000);
    } catch {}
  };

  const handleCopyOutput = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    } catch {}
  };

  return (
    <div style={{
      margin: '6px 0',
      borderRadius: '8px',
      border: '1px solid var(--border-subtle)',
      background: '#07090E',
      overflow: 'hidden',
      transition: 'border-color 0.15s ease'
    }}>
      {/* Accordion Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isOpen ? '#0E121C' : '#090C14',
          transition: 'background-color 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, paddingRight: '8px' }}>
          {getToolIcon(tool.tool_name)}
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'monospace',
            color: 'var(--accent-violet)'
          }}>
            {tool.tool_name}
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '300px'
          }}>
            {getArgsSummary()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--success)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <CheckCircle2 size={10} />
            executed
          </span>
          {isOpen ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Accordion Content */}
      {isOpen && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: '#05070B',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Arguments block */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tool Parameters
              </span>
              <button
                onClick={handleCopyArgs}
                className="btn btn-secondary"
                style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '10px' }}
              >
                {copiedArgs ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedArgs ? 'Copied' : 'Copy Parameters'}</span>
              </button>
            </div>
            <pre style={{
              margin: 0,
              padding: '10px',
              borderRadius: '6px',
              background: '#0A0D15',
              border: '1px solid var(--border-subtle)',
              fontSize: '11.5px',
              fontFamily: 'monospace',
              color: '#CBD5E1',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {JSON.stringify(tool.args || {}, null, 2)}
            </pre>
          </div>

          {/* Output block if available */}
          {output && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Execution Output
                </span>
                <button
                  onClick={handleCopyOutput}
                  className="btn btn-secondary"
                  style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '10px' }}
                >
                  {copiedOutput ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedOutput ? 'Copied' : 'Copy Output'}</span>
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: '10px',
                borderRadius: '6px',
                background: '#0A0D15',
                border: '1px solid var(--border-subtle)',
                fontSize: '11.5px',
                fontFamily: 'monospace',
                color: '#94A3B8',
                maxHeight: '220px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {output}
              </pre>
            </div>
          )}

          {!output && onViewOutput && (
            <button
              onClick={onViewOutput}
              className="btn btn-secondary"
              style={{ minHeight: '30px', height: '30px', fontSize: '11px', alignSelf: 'flex-start' }}
            >
              Fetch Raw Output File
            </button>
          )}
        </div>
      )}
    </div>
  );
};
