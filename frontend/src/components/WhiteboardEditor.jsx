import React, { useEffect, useRef, useState } from 'react';
import { TldrawApp, ColorStyle, tDraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration.js';
import * as Y from 'yjs';
import './WhiteboardEditor.css';

export function WhiteboardEditor({ projectId, sessionId, onBack }) {
  const rContainer = useRef(null);
  const rTldrawApp = useRef(null);
  const [projectName, setProjectName] = useState('Untitled');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  // Initialize Yjs collaboration
  const { yjsDoc, connected } = useYjsCollaboration(
    projectId,
    sessionId
  );

  // Initialize tldraw app
  useEffect(() => {
    if (!rContainer.current || !yjsDoc) return;

    const yShapes = yjsDoc.getMap('whiteboard-shapes');
    const yProject = yjsDoc.getMap('project');
    let isUpdatingFromYjs = false;

    // Initialize tldraw
    const app = new TldrawApp();
    rTldrawApp.current = app;

    // Load initial data from Yjs
    const initialName = yProject.get('name');
    if (initialName) {
      setProjectName(initialName);
    }

    const initialShapes = yShapes.toJSON();
    if (Object.keys(initialShapes).length > 0) {
      // Load shapes into tldraw
      app.loadAppState(initialShapes);
    }

    // Subscribe to remote shape changes
    const shapesObserver = (event) => {
      if (isUpdatingFromYjs) return;
      
      event.keysChanged.forEach((key) => {
        const shape = yShapes.get(key);
        if (shape) {
          app.updateShapes([shape], true);
        }
      });

      event.added.forEach((item) => {
        const key = item.content.getKey();
        const shape = yShapes.get(key);
        if (shape) {
          app.createShapes([shape]);
        }
      });

      event.deleted.forEach((item) => {
        const key = item.content.getKey();
        app.deleteShapes([key]);
      });
    };

    const projectObserver = (event) => {
      event.keysChanged.forEach((key) => {
        if (key === 'name') {
          setProjectName(yProject.get('name') || 'Untitled');
        }
      });
    };

    yShapes.observe(shapesObserver);
    yProject.observe(projectObserver);

    // Listen to tldraw changes and sync to Yjs
    const handleChangeV2 = (state, reason) => {
      if (reason === 'config-change' || reason === 'session-tick') {
        return;
      }

      isUpdatingFromYjs = true;
      const appState = app.appState;
      const newShapes = app.shapes;

      newShapes.forEach((shape) => {
        yShapes.set(shape.id, shape);
      });

      isUpdatingFromYjs = false;
    };

    app.on('change-v2', handleChangeV2);

    return () => {
      yShapes.unobserve(shapesObserver);
      yProject.unobserve(projectObserver);
      app.off('change-v2', handleChangeV2);
    };
  }, [yjsDoc]);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setProjectName(newName);

    if (yjsDoc) {
      const yProject = yjsDoc.getMap('project');
      yProject.set('name', newName);
    }
  };

  const handleExport = () => {
    if (!rTldrawApp.current) return;

    const app = rTldrawApp.current;
    const svg = app.getSvg(app.selectedIds);
    
    if (svg) {
      const element = document.createElement('a');
      const file = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
      element.href = URL.createObjectURL(file);
      element.download = `${projectName}.svg`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="whiteboard-editor">
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
            Export SVG
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="canvas-container" ref={rContainer} />

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

export default WhiteboardEditor;
