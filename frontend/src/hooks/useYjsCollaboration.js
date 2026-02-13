import { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import io from 'socket.io-client';

/**
 * Custom hook for Yjs collaboration
 * Handles WebSocket connection, document sync, and user awareness
 */
export function useYjsCollaboration(projectId, sessionId) {
  const [yjsDoc, setYjsDoc] = useState(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const providerRef = useRef(null);

  useEffect(() => {
    if (!projectId || !sessionId) {
      return;
    }

    const initializeCollaboration = async () => {
      try {
        // Create new Yjs document
        const doc = new Y.Doc();

        // Connect to backend via WebSocket
        const socket = io(process.env.VITE_WS_URL, {
          query: { sessionId },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        // Handle connection
        socket.on('connect', () => {
          console.log('WebSocket connected:', socket.id);
          setConnected(true);
          setError(null);

          // Request to join project
          socket.emit('join-project', {
            projectId,
            sessionId,
          });
        });

        // Handle initial Yjs state
        socket.on('yjs-state', (data) => {
          console.log('Received initial Yjs state');

          // Apply received state
          if (data.state && data.state.length > 0) {
            Y.applyUpdate(doc, new Uint8Array(data.state));
          }

          setUsers(data.users || []);
          setYjsDoc(doc);
        });

        // Handle remote Yjs updates
        socket.on('yjs-update', (data) => {
          if (data.update && data.update.length > 0) {
            Y.applyUpdate(doc, new Uint8Array(data.update));
          }
        });

        // Handle user awareness
        socket.on('user-joined', (data) => {
          console.log(`User joined: ${data.name}`);
          setUsers((prev) => [
            ...prev,
            {
              userId: data.userId,
              name: data.name,
              socketId: data.socketId,
            },
          ]);
        });

        socket.on('cursor-update', (data) => {
          // Handle cursor positions for awareness
          // TODO: Update UI to show remote cursors
        });

        // Handle errors
        socket.on('error', (data) => {
          console.error('WebSocket error:', data.message);
          setError(data.message);
          setConnected(false);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          console.log('WebSocket disconnected');
          setConnected(false);
        });

        // Reconnect handler
        socket.on('reconnect', () => {
          console.log('WebSocket reconnected');
          setConnected(true);
        });
      } catch (err) {
        console.error('Collaboration setup error:', err);
        setError(err.message);
      }
    };

    initializeCollaboration();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, [projectId, sessionId]);

  // Send local Yjs updates to other users
  const sendUpdate = (update) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('yjs-update', {
        projectId,
        update: Array.from(update),
      });
    }
  };

  // Send cursor position
  const sendCursor = (x, y, selection) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('cursor-move', {
        projectId,
        x,
        y,
        selection,
      });
    }
  };

  return {
    yjsDoc,
    connected,
    users,
    error,
    sendUpdate,
    sendCursor,
    socket: socketRef.current,
  };
}

export default useYjsCollaboration;
