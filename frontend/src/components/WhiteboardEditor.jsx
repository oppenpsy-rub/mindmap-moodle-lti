import React, { useEffect, useRef, useState } from 'react';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration.js';
import * as Y from 'yjs';
import './WhiteboardEditor.css';

export function WhiteboardEditor({ projectId, sessionId, onBack }) {
  const rContainer = useRef(null);
  const rCanvasRef = useRef(null);
  const rDrawing = useRef(false);
  const rShapes = useRef([]);
  const rLastX = useRef(0);
  const rLastY = useRef(0);
  const [projectName, setProjectName] = useState('Untitled');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [drawMode, setDrawMode] = useState('pen');
  const [color, setColor] = useState('#000000');

  // Initialize Yjs collaboration
  const { yjsDoc, connected } = useYjsCollaboration(
    projectId,
    sessionId
  );

  // Initialize canvas
  useEffect(() => {
    if (!rContainer.current || !yjsDoc) return;

    const canvas = document.createElement('canvas');
    canvas.width = rContainer.current.offsetWidth;
    canvas.height = rContainer.current.offsetHeight;
    canvas.className = 'whiteboard-canvas';
    
    rContainer.current.appendChild(canvas);
    rCanvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up drawing interactions
    canvas.addEventListener('mousedown', (e) => {
      rDrawing.current = true;
      const rect = canvas.getBoundingClientRect();
      rLastX.current = e.clientX - rect.left;
      rLastY.current = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!rDrawing.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(rLastX.current, rLastY.current);
      ctx.lineTo(x, y);
      ctx.stroke();

      rLastX.current = x;
      rLastY.current = y;
    });

    canvas.addEventListener('mouseup', () => {
      rDrawing.current = false;
    });

    canvas.addEventListener('mouseleave', () => {
      rDrawing.current = false;
    });

    // Load initial data from Yjs
    const yProject = yjsDoc.getMap('project');
    const initialName = yProject.get('name');
    if (initialName) {
      setProjectName(initialName);
    }

    // Subscribe to remote changes
    const projectObserver = (event) => {
      event.keysChanged.forEach((key) => {
        if (key === 'name') {
          setProjectName(yProject.get('name') || 'Untitled');
        }
      });
    };

    yProject.observe(projectObserver);

    return () => {
      yProject.unobserve(projectObserver);
      if (rContainer.current && canvas.parentNode === rContainer.current) {
        rContainer.current.removeChild(canvas);
      }
    };
  }, [yjsDoc, color]);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setProjectName(newName);

    if (yjsDoc) {
      const yProject = yjsDoc.getMap('project');
      yProject.set('name', newName);
    }
  };

  const handleClear = () => {
    const canvas = rCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleExport = () => {
    const canvas = rCanvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${projectName}.png`;
    link.click();
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
          <select value={color} onChange={(e) => setColor(e.target.value)} className="color-picker">
            <option value="#000000">Black</option>
            <option value="#FF0000">Red</option>
            <option value="#0000FF">Blue</option>
            <option value="#00AA00">Green</option>
            <option value="#FF6600">Orange</option>
          </select>
          <button className="btn btn-sm btn-secondary" onClick={handleClear}>
            Clear
          </button>
          <button className="btn btn-sm btn-secondary" onClick={handleExport}>
            Export PNG
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
