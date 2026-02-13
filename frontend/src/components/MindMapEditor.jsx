import React, { useEffect, useRef, useState } from 'react';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration.js';
import * as Y from 'yjs';
import './MindMapEditor.css';

export function MindMapEditor({ projectId, sessionId, onBack }) {
  const editorRef = useRef(null);

  const [projectName, setProjectName] = useState('Untitled');
  const [editorContent, setEditorContent] = useState('# New MindMap\n## Topic 1\n## Topic 2');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  // Initialize Yjs collaboration
  const { yjsDoc, connected, sendUpdate } = useYjsCollaboration(
    projectId,
    sessionId
  );

  // Bind Yjs text to editor
  useEffect(() => {
    if (!yjsDoc) return;

    const yText = yjsDoc.getText('mindmap-content');
    const yProject = yjsDoc.getMap('project');

    // Load initial content from Yjs
    const initialContent = yText.toString();
    if (initialContent) {
      setEditorContent(initialContent);
    }

    const initialName = yProject.get('name');
    if (initialName) {
      setProjectName(initialName);
    }

    // Subscribe to remote changes
    const textObserver = (event) => {
      const changes = event.changes.added.concat(event.changes.updated);
      if (changes.length > 0) {
        const newContent = yText.toString();
        setEditorContent(newContent);
      }
    };

    const projectObserver = (event) => {
      event.keysChanged.forEach((key) => {
        if (key === 'name') {
          setProjectName(yProject.get('name') || 'Untitled');
        }
      });
    };

    yText.observe(textObserver);
    yProject.observe(projectObserver);

    return () => {
      yText.unobserve(textObserver);
      yProject.unobserve(projectObserver);
    };
  }, [yjsDoc]);

  const handleEditorChange = (e) => {
    const newContent = e.target.value;
    setEditorContent(newContent);

    // Send update to Yjs
    if (yjsDoc) {
      const yText = yjsDoc.getText('mindmap-content');
      const diff = newContent.length - editorContent.length;

      if (diff > 0) {
        // Text was added
        yText.insert(editorContent.length, newContent.slice(editorContent.length));
      } else if (diff < 0) {
        // Text was deleted
        yText.delete(newContent.length, -diff);
      }
    }
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setProjectName(newName);

    if (yjsDoc) {
      const yProject = yjsDoc.getMap('project');
      yProject.set('name', newName);
    }
  };

  const handleExport = () => {
    const element = document.createElement('a');
    const file = new Blob([editorContent], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${projectName}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="mindmap-editor">
      <div className="editor-header">
        <button className="btn btn-back" onClick={onBack}>
          ← Back
        </button>
        <input
          type="text"
          className="project-title"
          value={projectName}
          onChange={handleNameChange}
          placeholder="Project name"
        />
        <div className="header-actions">
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Connected' : '○ Reconnecting...'}
          </span>
          <button className="btn btn-sm btn-secondary" onClick={handleExport}>
            Download
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="editor-container">
        <textarea
          ref={editorRef}
          className="editor-textarea"
          value={editorContent}
          onChange={handleEditorChange}
          placeholder="# My MindMap&#10;## Topic 1&#10;## Topic 2"
        />
        <div className="preview-pane">
          <h3>📝 Preview (Plain Text - Markmap coming soon)</h3>
          <pre>{editorContent}</pre>
        </div>
      </div>

      {users.length > 1 && (
        <div className="active-users">
          <small>
            {users.length} people editing: {users.map((u) => u.name).join(', ')}
          </small>
        </div>
      )}
    </div>
  );
}

export default MindMapEditor;
