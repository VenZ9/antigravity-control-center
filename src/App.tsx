import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppPage } from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { OverviewPage } from './pages/OverviewPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { LiveMonitorPage } from './pages/LiveMonitorPage';
import { SessionsPage } from './pages/SessionsPage';
import { FilesPage } from './pages/FilesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { wsClient } from './api/ws';
import { API } from './api/client';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AppPage>('overview');
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    const unsubConn = wsClient.on('connection_status', (data: any) => {
      setWsConnected(data.connected);
    });

    const unsubSessionChange = wsClient.on('active_session_change', (data: any) => {
      setActiveSessionsCount(data.activeSessions?.length || 0);
    });

    // Initial status fetch
    API.getStatus().then(res => {
      setActiveSessionsCount(res.activeSessions?.length || 0);
    }).catch(() => {});

    return () => {
      unsubConn();
      unsubSessionChange();
    };
  }, []);

  const handleOpenConversationInTranscript = (_convId: string) => {
    setCurrentPage('conversations');
  };

  const handleOpenSessionWithResume = (convId: string) => {
    setResumeSessionId(convId);
    setCurrentPage('sessions');
  };

  const showFocus = isFocusMode && currentPage === 'sessions';

  return (
    <div className={`app-container ${showFocus ? 'focus-mode-container' : ''}`} style={showFocus ? { paddingBottom: 0, height: '100dvh' } : {}}>
      {!showFocus && (
        <Navigation
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          activeCount={activeSessionsCount}
        />
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: showFocus ? '100dvh' : 'auto'
      }}>
        {!showFocus && (
          <Header
            currentPage={currentPage}
            activeCount={activeSessionsCount}
            wsConnected={wsConnected}
            onLaunchClick={() => setCurrentPage('sessions')}
          />
        )}

        <main style={{
          padding: showFocus ? 0 : '16px',
          maxWidth: showFocus ? '100%' : '1200px',
          width: '100%',
          margin: '0 auto',
          flex: 1,
          height: showFocus ? '100dvh' : 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {currentPage === 'overview' && (
                <OverviewPage
                  onNavigate={setCurrentPage}
                  onOpenConversation={handleOpenConversationInTranscript}
                  onOpenNewSession={() => setCurrentPage('sessions')}
                />
              )}

              {currentPage === 'conversations' && (
                <ConversationsPage
                  onOpenSessionWithResume={handleOpenSessionWithResume}
                />
              )}

              {currentPage === 'monitor' && <LiveMonitorPage />}

              {currentPage === 'sessions' && (
                <SessionsPage
                  initialResumeId={resumeSessionId}
                  onClearResumeId={() => setResumeSessionId(null)}
                  isFocusMode={showFocus}
                  onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
                />
              )}

              {currentPage === 'files' && <FilesPage />}

              {currentPage === 'analytics' && <AnalyticsPage />}

              {currentPage === 'tasks' && <TasksPage />}

              {currentPage === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
