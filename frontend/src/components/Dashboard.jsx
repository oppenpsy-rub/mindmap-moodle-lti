import React, { useState, useEffect } from 'react';
import APIService from '../utils/api.js';
import './Dashboard.css';

function Dashboard({ onOpenBoard, sessionId, userName }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('mindmap');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const data = await APIService.getProjects();
      setBoards(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const board = await APIService.createProject(newName.trim(), newType);
      setBoards([board, ...boards]);
      setShowCreate(false);
      setNewName('');
      setNewType('mindmap');
      onOpenBoard(board);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, boardId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this board permanently?')) return;
    try {
      await APIService.deleteProject(boardId);
      setBoards(boards.filter((b) => b.id !== boardId));
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = filter === 'all'
    ? boards
    : boards.filter((b) => b.boardType === filter);

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="dashboard">
      {/* Nav */}
      <div className="dashboard-nav">
        <div className="nav-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="3" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="21"/>
            <line x1="3" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="21" y2="12"/>
            <line x1="5.6" y1="5.6" x2="7.8" y2="7.8"/>
            <line x1="16.2" y1="16.2" x2="18.4" y2="18.4"/>
            <line x1="5.6" y1="18.4" x2="7.8" y2="16.2"/>
            <line x1="16.2" y1="7.8" x2="18.4" y2="5.6"/>
          </svg>
          MoodBoard
        </div>
        <div className="nav-user">
          <span>{userName || 'User'}</span>
          <div className="nav-user-avatar">
            {(userName || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        <div className="dashboard-inner">
          <div className="dashboard-header">
            <h1>My Boards</h1>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Board
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Tabs */}
          <div className="board-tabs">
            {['all', 'mindmap', 'whiteboard'].map((t) => (
              <button
                key={t}
                className={`tab ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}
              >
                {t === 'all' ? 'All' : t === 'mindmap' ? 'Mindmaps' : 'Whiteboards'}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="loading-state">Loading boards...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                {filter === 'whiteboard' ? '🎨' : filter === 'mindmap' ? '🧠' : '📋'}
              </div>
              <h3>No {filter === 'all' ? 'boards' : filter + 's'} yet</h3>
              <p>Create your first board to get started</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + New Board
              </button>
            </div>
          ) : (
            <div className="boards-grid">
              {filtered.map((board) => (
                <div
                  key={board.id}
                  className="board-card"
                  onClick={() => onOpenBoard(board)}
                >
                  <div className="board-card-header">
                    <div className={`board-type-icon ${board.boardType || 'mindmap'}`}>
                      {board.boardType === 'whiteboard' ? '🎨' : '🧠'}
                    </div>
                    <div>
                      <div className="board-card-title">{board.name}</div>
                      <div className="board-card-type">{board.boardType || 'mindmap'}</div>
                    </div>
                  </div>
                  <div className="board-card-meta">
                    Modified {formatDate(board.updatedAt || board.createdAt)}
                  </div>
                  <div className="board-card-actions">
                    <button
                      className="board-card-delete"
                      onClick={(e) => handleDelete(e, board.id)}
                      title="Delete board"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Board</h2>
            <form className="create-form" onSubmit={handleCreate}>
              <div className="form-group">
                <label>Board Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lecture Notes, Brainstorming..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Board Type</label>
                <div className="board-type-selector">
                  <div
                    className={`type-option ${newType === 'mindmap' ? 'selected' : ''}`}
                    onClick={() => setNewType('mindmap')}
                  >
                    <div className="type-option-icon">🧠</div>
                    <div className="type-option-label">Mindmap</div>
                    <div className="type-option-desc">Hierarchical nodes with connections</div>
                  </div>
                  <div
                    className={`type-option ${newType === 'whiteboard' ? 'selected' : ''}`}
                    onClick={() => setNewType('whiteboard')}
                  >
                    <div className="type-option-icon">🎨</div>
                    <div className="type-option-label">Whiteboard</div>
                    <div className="type-option-desc">Freeform canvas with shapes & drawing</div>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newName.trim() || creating}>
                  {creating ? 'Creating...' : 'Create Board'}
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
