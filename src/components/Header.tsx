import React from 'react';
import { Plus, Radio, Zap } from 'lucide-react';
import { AppPage } from '../types';

interface HeaderProps {
  currentPage: AppPage;
  activeCount: number;
  wsConnected: boolean;
  onLaunchClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  activeCount,
  wsConnected,
  onLaunchClick
}) => {
  const titles: Record<AppPage, string> = {
    overview: 'Control Center Overview',
    conversations: 'Conversation History',
    monitor: 'Live Execution Monitor',
    sessions: 'CLI Session Runner',
    files: 'Workspace Explorer & Git',
    analytics: 'Token Analytics',
    tasks: 'Tasks & Environment',
    settings: 'Antigravity Settings'
  };

  return (
    <header style={{
      height: 'var(--header-height)',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--bg-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
          {titles[currentPage]}
        </h1>
        {activeCount > 0 ? (
          <span className="badge badge-active" style={{ fontSize: '10px' }}>
            <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
            {activeCount} Active
          </span>
        ) : (
          <span className="badge badge-idle" style={{ fontSize: '10px' }}>Idle</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* WebSocket status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', color: wsConnected ? 'var(--success)' : 'var(--danger)',
          background: wsConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          padding: '4px 8px', borderRadius: '6px', fontWeight: 500
        }}>
          {wsConnected ? <Radio size={12} className="pulse-dot" /> : <Radio size={12} />}
          <span>{wsConnected ? 'Live WS' : 'Offline'}</span>
        </div>

        {/* Quick Launch Button */}
        <button
          onClick={onLaunchClick}
          className="btn btn-primary"
          style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '12px', borderRadius: '7px' }}
        >
          <Plus size={14} />
          <span style={{ display: 'none' }} className="sm-inline">New Session</span>
          <span className="xs-inline">Run</span>
        </button>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .sm-inline { display: inline !important; }
          .xs-inline { display: none !important; }
        }
      `}</style>
    </header>
  );
};
