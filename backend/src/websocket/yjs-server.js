import * as Y from 'yjs';
import { getSession } from '../lti/routes.js';
import { ProjectState, AuditLog } from '../db/models.js';

/**
 * WebSocket Handler for Yjs CRDT Collaboration
 * 
 * Each project is a "room" with its own Yjs document
 * Updates are broadcast to all connected users in that room
 */

class YjsServer {
  constructor() {
    this.docs = new Map(); // projectId -> Y.Doc
    this.connections = new Map(); // projectId -> Set of socket IDs
    this.users = new Map(); // socket.id -> { userId, name, email }
    this.saveInterval = 5 * 60 * 1000; // Save every 5 minutes
  }

  /**
   * Initialize WebSocket handlers on Socket.io instance
   */
  initializeWebSocket(io) {
    io.on('connection', (socket) => {
      console.log(`✅ WebSocket connected: ${socket.id}`);

      // Handle project join
      socket.on('join-project', (data) => {
        this.handleJoinProject(socket, data);
      });

      // Handle Yjs updates
      socket.on('yjs-update', (data) => {
        this.handleYjsUpdate(socket, data);
      });

      // Handle user cursor/awareness
      socket.on('cursor-move', (data) => {
        this.handleCursorMove(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error (${socket.id}):`, error);
      });
    });
  }

  /**
   * Handle: User joins a project
   */
  async handleJoinProject(socket, data) {
    try {
      const { projectId, sessionId } = data;
      const session = getSession(sessionId);

      if (!session) {
        socket.emit('error', { message: 'Invalid session' });
        return;
      }

      // Store user info
      this.users.set(socket.id, {
        userId: session.userId,
        name: session.name,
        email: session.email,
      });

      // Join Socket.io room
      socket.join(`project:${projectId}`);

      // Get or create Yjs document
      let ydoc = this.docs.get(projectId);

      if (!ydoc) {
        ydoc = await this.loadYjsDocument(projectId);
        this.docs.set(projectId, ydoc);

        // Schedule periodic saves
        this.scheduleSave(projectId);
      }

      // Send initial state to client
      const state = Y.encodeStateAsUpdate(ydoc);

      socket.emit('yjs-state', {
        projectId,
        state: Array.from(state),
        clientID: socket.id,
        users: this.getRoomUsers(projectId),
      });

      // Notify others
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: session.userId,
        name: session.name,
      });

      console.log(`👤 User ${session.name} joined project ${projectId}`);

      // Log action (non-blocking - don't let DB errors break WebSocket)
      AuditLog.create({
        projectId,
        userId: session.userId,
        action: 'joined',
      }).catch(err => console.warn('AuditLog write failed:', err.message));
    } catch (error) {
      console.error('handleJoinProject error:', error);
      socket.emit('error', { message: 'Failed to join project' });
    }
  }

  /**
   * Handle: Yjs update from client
   */
  async handleYjsUpdate(socket, data) {
    try {
      const { projectId, update } = data;
      const user = this.users.get(socket.id);

      if (!user || !projectId) {
        return;
      }

      // Get Yjs document
      const ydoc = this.docs.get(projectId);

      if (!ydoc) {
        socket.emit('error', { message: 'Project not found' });
        return;
      }

      // Apply update from client
      const updateBuffer = Buffer.from(update);
      Y.applyUpdate(ydoc, updateBuffer);

      // Broadcast to all users in room (except sender)
      socket.to(`project:${projectId}`).emit('yjs-update', {
        update: Array.from(updateBuffer),
        clientID: socket.id,
        userId: user.userId,
        userName: user.name,
      });

      // Log significant actions (non-blocking)
      AuditLog.create({
        projectId,
        userId: user.userId,
        action: 'edited',
        details: { updateSize: updateBuffer.length },
      }).catch(err => console.warn('AuditLog write failed:', err.message));
    } catch (error) {
      console.error('handleYjsUpdate error:', error);
    }
  }

  /**
   * Handle: User cursor position (for awareness)
   */
  handleCursorMove(socket, data) {
    const { projectId, x, y, selection } = data;
    const user = this.users.get(socket.id);

    if (!user) {
      return;
    }

    // Broadcast cursor position to others
    socket.to(`project:${projectId}`).emit('cursor-update', {
      clientID: socket.id,
      userId: user.userId,
      userName: user.name,
      x,
      y,
      selection,
    });
  }

  /**
   * Handle: User disconnect
   */
  async handleDisconnect(socket) {
    const user = this.users.get(socket.id);

    if (user) {
      console.log(`❌ User ${user.name} disconnected`);
      this.users.delete(socket.id);

      // Notify others in all rooms they were in
      const sockets = await socket.adapter.sockets.get(socket.id);
      // (Note: socket is already disconnected, so this is just cleanup)
    }
  }

  /**
   * Load Yjs document from database
   */
  async loadYjsDocument(projectId) {
    const ydoc = new Y.Doc();

    try {
      // Get latest state from database
      const latestState = await ProjectState.findOne({
        where: { projectId },
        order: [['version', 'DESC']],
        limit: 1,
      });

      if (latestState && latestState.yjsState) {
        Y.applyUpdate(ydoc, Buffer.from(latestState.yjsState));
      } else {
        // Initialize with empty structure
        const ymap = ydoc.getMap('project');
        ymap.set('name', 'New Project');
        ymap.set('createdAt', new Date().toISOString());

        // Initialize arrays for content
        ydoc.getArray('nodes'); // For MindMap or Whiteboard nodes
        ydoc.getArray('connections');
      }
    } catch (error) {
      console.error('Error loading Yjs document:', error);
    }

    return ydoc;
  }

  /**
   * Schedule periodic save to database
   */
  scheduleSave(projectId) {
    const saveTimer = setInterval(async () => {
      const ydoc = this.docs.get(projectId);

      if (!ydoc) {
        clearInterval(saveTimer);
        return;
      }

      try {
        const state = Y.encodeStateAsUpdate(ydoc);

        // Get current version
        const latest = await ProjectState.findOne({
          where: { projectId },
          order: [['version', 'DESC']],
          limit: 1,
        });

        const nextVersion = (latest?.version || 0) + 1;

        // Save snapshot
        await ProjectState.create({
          projectId,
          yjsState: state,
          version: nextVersion,
        });

        console.log(`💾 Saved project ${projectId} (v${nextVersion})`);
      } catch (error) {
        console.error('Error saving Yjs state:', error);
      }
    }, this.saveInterval);
  }

  /**
   * Get all users currently in a project room
   */
  getRoomUsers(projectId) {
    const users = [];

    for (const [socketId, user] of this.users.entries()) {
      users.push({
        socketId,
        userId: user.userId,
        name: user.name,
        email: user.email,
      });
    }

    return users;
  }

  /**
   * Cleanup: Remove document from memory if no users connected
   */
  cleanupUnusedDocuments(io) {
    setInterval(() => {
      for (const [projectId, ydoc] of this.docs.entries()) {
        // Check if any sockets are in this room
        const sockets = io.sockets.adapter.rooms.get(`project:${projectId}`);

        if (!sockets || sockets.size === 0) {
          console.log(`🗑️ Cleaning up unused document: ${projectId}`);
          this.docs.delete(projectId);
        }
      }
    }, 60 * 1000); // Check every minute
  }
}

export default new YjsServer();
