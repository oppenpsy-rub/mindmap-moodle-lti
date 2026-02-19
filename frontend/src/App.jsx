import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import MindMapEditor from './components/MindMapEditor.jsx';
import WhiteboardEditor from './components/WhiteboardEditor.jsx';
import './App.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimer = null;

    const initSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlSession = params.get('session') || params.get('session_id');

      if (urlSession) {
        setSessionId(urlSession);
        setSessionReady(true);
        return;
      }

      if (import.meta.env.DEV) {
        try {
          const response = await fetch('/dev/mock-session', {
            method: 'POST',
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setSessionId(data.sessionId);
            setUserName(data.user?.name || 'Developer');
            setSessionReady(true);
            setSessionError(null);
            retryCount = 0;
          } else {
            throw new Error(`Server antwortet mit Status ${response.status}`);
          }
        } catch (error) {
          retryCount++;
          if (retryCount <= maxRetries) {
            const delay = Math.min(2000 * retryCount, 10000);
            setSessionError(`Verbinde mit Backend... (Versuch ${retryCount}/${maxRetries})`);
            retryTimer = setTimeout(initSession, delay);
          } else {
            setSessionError('Backend nicht erreichbar. Bitte starte den Backend-Server (node server.js im backend-Ordner).');
          }
        }
      } else {
        setSessionError('Kein LTI-Session gefunden. Bitte über Moodle starten.');
      }
    };
    initSession();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  const handleOpenBoard = (board) => {
    setSelectedBoard(board);
    setView(board.boardType === 'whiteboard' ? 'whiteboard' : 'mindmap');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedBoard(null);
  };

  if (!sessionReady) {
    return (
      <div className="app">
        <div className="app-loading">
          {sessionError ? (
            <>
              <h2>Verbindung wird hergestellt...</h2>
              <p>{sessionError}</p>
              <button
                onClick={() => {
                  setSessionError(null);
                  window.location.reload();
                }}
                style={{ marginTop: 16, padding: '8px 20px', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'var(--color-primary, #6366f1)', color: '#fff', fontSize: 14 }}
              >
                Erneut versuchen
              </button>
            </>
          ) : (
            <>
              <div className="spinner" />
              <h2>Connecting...</h2>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {view === 'dashboard' && (
        <Dashboard
          onOpenBoard={handleOpenBoard}
          sessionId={sessionId}
          userName={userName}
        />
      )}

      {view === 'mindmap' && selectedBoard && (
        <MindMapEditor
          projectId={selectedBoard.id}
          projectName={selectedBoard.name}
          sessionId={sessionId}
          onBack={handleBackToDashboard}
        />
      )}

      {view === 'whiteboard' && selectedBoard && (
        <WhiteboardEditor
          projectId={selectedBoard.id}
          projectName={selectedBoard.name}
          sessionId={sessionId}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

export default App;
