import React, { useState, useEffect } from 'react';
import APIService from '../utils/api.js';
import './ProjectDetail.css';

export function ProjectDetail({ projectId, onClose, onEditorSelect }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editorType, setEditorType] = useState('mindmap'); // 'mindmap' | 'whiteboard'

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await APIService.getProject(projectId);
      setProject(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditor = () => {
    onEditorSelect(editorType);
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <p>Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <p className="error">Error: {error}</p>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal project-detail" onClick={(e) => e.stopPropagation()}>
        <h2>{project?.name || 'Untitled Project'}</h2>

        {project?.description && (
          <p className="description">{project.description}</p>
        )}

        <div className="project-meta">
          <small>Created: {new Date(project?.createdAt).toLocaleDateString()}</small>
          {project?.updatedAt && (
            <small>Updated: {new Date(project.updatedAt).toLocaleDateString()}</small>
          )}
        </div>

        <div className="editor-selection">
          <h3>Choose an Editor</h3>
          <div className="editor-options">
            <label className="editor-option">
              <input
                type="radio"
                name="editorType"
                value="mindmap"
                checked={editorType === 'mindmap'}
                onChange={(e) => setEditorType(e.target.value)}
              />
              <div className="option-content">
                <h4>🧠 MindMap</h4>
                <p>Hierarchical outline view with visual mind map display</p>
              </div>
            </label>

            <label className="editor-option">
              <input
                type="radio"
                name="editorType"
                value="whiteboard"
                checked={editorType === 'whiteboard'}
                onChange={(e) => setEditorType(e.target.value)}
              />
              <div className="option-content">
                <h4>🎨 Whiteboard</h4>
                <p>Freeform drawing and shape creation canvas</p>
              </div>
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleOpenEditor} className="btn btn-primary">
            Open in {editorType === 'mindmap' ? 'MindMap' : 'Whiteboard'}
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
