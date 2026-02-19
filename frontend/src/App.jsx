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
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper: create a demo/mock session
  const createDemoSession = async () => {
    setLoading(true);
    setSessionError(null);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiBase}/dev/mock-session`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setUserName(data.user?.name || 'Demo User');
        setSessionReady(true);
      } else {
        throw new Error(`Status ${response.status}`);
      }
    } catch (error) {
      setSessionError('Demo-Session konnte nicht erstellt werden: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlSession = params.get('session') || params.get('session_id');

      // 1. Session from URL (LTI launch redirect)
      if (urlSession) {
        setSessionId(urlSession);
        setSessionReady(true);
        setLoading(false);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      // 2. Dev mode: auto-create mock session
      if (import.meta.env.DEV) {
        await createDemoSession();
        return;
      }

      // 3. Production: check if demo mode is active
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const statusRes = await fetch(`${apiBase}/dev/status`, { credentials: 'include' });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.demoMode) {
            setDemoAvailable(true);
            // Auto-login in demo mode
            await createDemoSession();
            return;
          }
        }
      } catch {
        // Not in demo mode, that's fine
      }

      // 4. No session available
      setSessionError('Kein LTI-Session gefunden. Bitte über Moodle starten.');
      setLoading(false);
    };

    initSession();
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
          {loading ? (
            <>
              <div className="spinner" />
              <h2>Verbindung wird hergestellt...</h2>
            </>
          ) : sessionError ? (
            <>
              <h2>MoodBoard</h2>
              <p style={{ color: '#888', marginBottom: 16 }}>{sessionError}</p>
              {demoAvailable && (
                <button
                  onClick={createDemoSession}
                  style={{ marginTop: 8, padding: '10px 24px', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'var(--color-primary, #6366f1)', color: '#fff', fontSize: 15, fontWeight: 600 }}
                >
                  Demo starten
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                style={{ marginTop: 12, padding: '8px 20px', cursor: 'pointer', borderRadius: 8, border: '1px solid #ddd', background: 'transparent', color: '#666', fontSize: 14 }}
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
