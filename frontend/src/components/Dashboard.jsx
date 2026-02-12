import React, { useState, useEffect } from 'react';
import APIService from '../utils/api.js';
import './Dashboard.css';

export function Dashboard({ onProjectSelect, sessionId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await APIService.getProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();

    if (!newProjectName.trim()) {
      return;
    }

    try {
      const newProject = await APIService.createProject(newProjectName, '');
      setProjects([newProject, ...projects]);
      setNewProjectName('');
      setShowCreateModal(false);
      // Auto-select new project
      onProjectSelect(newProject.id);
    } catch (err) {
      setError('Failed to create project');
      console.error(err);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Really delete this project?')) {
      try {
        await APIService.deleteProject(projectId);
        setProjects(projects.filter((p) => p.id !== projectId));
      } catch (err) {
        setError('Failed to delete project');
        console.error(err);
      }
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>🧠 MindMap Projects</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <h3>{project.name}</h3>
              {project.description && <p className="description">{project.description}</p>}
              <div className="meta">
                <small>{new Date(project.createdAt).toLocaleDateString()}</small>
              </div>
              <div className="actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onProjectSelect(project.id)}
                >
                  Open
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteProject(project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <input
                type="text"
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
