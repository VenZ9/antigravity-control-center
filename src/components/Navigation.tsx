import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Activity,
  Terminal,
  FolderTree,
  BarChart3,
  CheckSquare,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { AppPage } from '../types';

interface NavProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  activeCount: number;
}

export const Navigation: React.FC<NavProps> = ({ currentPage, onPageChange, activeCount }) => {
  const mainNavItems = [
    { page: 'overview' as AppPage, label: 'Overview', icon: LayoutDashboard },
    { page: 'conversations' as AppPage, label: 'History', icon: MessageSquare },
    { page: 'monitor' as AppPage, label: 'Live', icon: Activity },
    { page: 'sessions' as AppPage, label: 'Sessions', icon: Terminal },
    { page: 'files' as AppPage, label: 'Files', icon: FolderTree }
  ];

  const secondaryNavItems = [
    { page: 'analytics' as AppPage, label: 'Analytics', icon: BarChart3 },
    { page: 'tasks' as AppPage, label: 'Tasks & MCP', icon: CheckSquare },
    { page: 'settings' as AppPage, label: 'Settings', icon: Settings }
  ];

  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  return (
    <>
      {/* Desktop Sidebar (>= 768px) */}
      <aside style={{
        display: 'none',
        width: '240px',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-subtle)',
        flexDirection: 'column',
        padding: '16px',
        flexShrink: 0
      }} className="desktop-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingLeft: '8px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700,
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            AG
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-main)' }}>Antigravity</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Control Center</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '8px 8px 4px 8px', letterSpacing: '0.05em' }}>
            Workspace
          </div>
          {mainNavItems.map(item => {
            const active = currentPage === item.page;
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onPageChange(item.page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: active ? 'var(--accent-violet-glow)' : 'transparent',
                  color: active ? 'var(--accent-violet)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
                {item.page === 'monitor' && activeCount > 0 && (
                  <span style={{ marginLeft: 'auto' }} className="pulse-dot" />
                )}
              </button>
            );
          })}

          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '18px 8px 4px 8px', letterSpacing: '0.05em' }}>
            Management
          </div>
          {secondaryNavItems.map(item => {
            const active = currentPage === item.page;
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => onPageChange(item.page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: active ? 'var(--accent-violet-glow)' : 'transparent',
                  color: active ? 'var(--accent-violet)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 99, backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 'var(--bottom-nav-height)', left: 0, right: 0,
              background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)',
              padding: '16px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
              boxShadow: '0 -10px 25px rgba(0,0,0,0.5)'
            }}
          >
            {secondaryNavItems.map(item => {
              const Icon = item.icon;
              const active = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => {
                    onPageChange(item.page);
                    setMobileDrawerOpen(false);
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    padding: '14px', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                    background: active ? 'var(--accent-violet-glow)' : 'var(--bg-card)',
                    color: active ? 'var(--accent-violet)' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  <span style={{ fontSize: '11.5px', fontWeight: 500 }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation (< 768px) */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--bottom-nav-height)',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom, 0)'
      }} className="mobile-bottom-nav">
        {mainNavItems.map(item => {
          const active = currentPage === item.page;
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '4px', height: '100%',
                background: 'transparent', border: 'none',
                color: active ? 'var(--accent-violet)' : 'var(--text-secondary)',
                cursor: 'pointer', position: 'relative'
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {item.page === 'monitor' && activeCount > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-4px' }} className="pulse-dot" />
                )}
              </div>
              <span style={{ fontSize: '10px', fontWeight: active ? 600 : 500 }}>{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '4px', height: '100%',
            background: 'transparent', border: 'none',
            color: ['analytics', 'tasks', 'settings'].includes(currentPage) ? 'var(--accent-violet)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <MoreHorizontal size={20} />
          <span style={{ fontSize: '10px', fontWeight: 500 }}>More</span>
        </button>
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: flex !important; }
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </>
  );
};
