import React, { useState } from 'react';
import { marked } from 'marked';
import { Check, Copy } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
}

interface CodeBlockProps {
  language?: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayLang = language || 'code';

  return (
    <div style={{
      margin: '12px 0',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      background: '#07090E'
    }}>
      {/* Code Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        backgroundColor: '#0F121C',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: 'var(--text-muted)'
      }}>
        <span style={{ textTransform: 'lowercase', color: 'var(--accent-violet)', fontWeight: 600 }}>
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: copied ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: copied ? 'var(--success)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Copy code to clipboard"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Content */}
      <pre style={{
        margin: 0,
        padding: '12px 14px',
        overflowX: 'auto',
        fontSize: '12.5px',
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        color: '#E2E8F0',
        whiteSpace: 'pre'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  if (!content) return null;

  try {
    const tokens = marked.lexer(content, { breaks: true, gfm: true });

    return (
      <div className="markdown-body" style={{ color: 'var(--text-main)', fontSize: '13.5px', lineHeight: 1.65 }}>
        {tokens.map((token, index) => {
          if (token.type === 'code') {
            return (
              <CodeBlock
                key={index}
                language={token.lang}
                code={token.text}
              />
            );
          }

          const html = marked.parser([token]);
          return (
            <div
              key={index}
              dangerouslySetInnerHTML={{ __html: html }}
              style={{ margin: '4px 0' }}
            />
          );
        })}
      </div>
    );
  } catch (err) {
    // Fallback to plain text if parsing error
    return (
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', lineHeight: 1.6 }}>
        {content}
      </div>
    );
  }
};
