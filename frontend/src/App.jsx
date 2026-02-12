import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import MindMapEditor from './components/MindMapEditor.jsx';
import WhiteboardEditor from './components/WhiteboardEditor.jsx';
import ProjectDetail from './components/ProjectDetail.jsx';
import './App.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedEditorType, setSelectedEditorType] = useState(null);
  const [sessionId] = useState(
    new URLSearchParams(window.location.search).get('session_id') ||
      `session_${Date.now()}`
  );

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
    setView('detail');
  };

  const handleEditorSelect = (editorType) => {
    setSelectedEditorType(editorType);
    setView('editor');
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedProjectId(null);
    setSelectedEditorType(null);
  };

  const handleCloseDetail = () => {
    setView('dashboard');
    setSelectedProjectId(null);
  };

  return (
    <div className="app">
      {view === 'dashboard' && (
        <Dashboard 
          onProjectSelect={handleProjectSelect} 
          sessionId={sessionId}
        />
      )}
      
      {view === 'detail' && selectedProjectId && (
        <ProjectDetail
          projectId={selectedProjectId}
          onClose={handleCloseDetail}
          onEditorSelect={handleEditorSelect}
        />
      )}
      
      {view === 'editor' && selectedProjectId && selectedEditorType === 'mindmap' && (
        <MindMapEditor
          projectId={selectedProjectId}
          sessionId={sessionId}
          onBack={handleBackToDashboard}
        />
      )}

      {view === 'editor' && selectedProjectId && selectedEditorType === 'whiteboard' && (
        <WhiteboardEditor
          projectId={selectedProjectId}
          sessionId={sessionId}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

export default App;
