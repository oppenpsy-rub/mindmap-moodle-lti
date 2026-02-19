import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import io from 'socket.io-client';

export function useYjsCollaboration(projectId, sessionId) {
  const [yjsDoc, setYjsDoc] = useState(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const socketRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    if (!projectId || !sessionId) return;

    const doc = new Y.Doc();
    docRef.current = doc;

    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
      query: { sessionId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-project', { projectId, sessionId });
    });

    socket.on('yjs-state', (data) => {
      if (data.state && data.state.length > 0) {
        Y.applyUpdate(doc, new Uint8Array(data.state), 'remote');
      }
      setUsers(data.users || []);
      setYjsDoc(doc);
    });

    socket.on('yjs-update', (data) => {
      if (data.update && data.update.length > 0) {
        Y.applyUpdate(doc, new Uint8Array(data.update), 'remote');
      }
    });

    socket.on('user-joined', (data) => {
      setUsers((prev) => [...prev.filter(u => u.userId !== data.userId), {
        userId: data.userId,
        name: data.name,
        socketId: data.socketId,
      }]);
    });

    socket.on('error', (data) => {
      console.error('WS error:', data.message);
      setConnected(false);
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('reconnect', () => setConnected(true));

    // Send local updates to server
    const updateHandler = (update, origin) => {
      if (origin !== 'remote' && socket.connected) {
        socket.emit('yjs-update', {
          projectId,
          update: Array.from(update),
        });
      }
    };
    doc.on('update', updateHandler);

    return () => {
      doc.off('update', updateHandler);
      // Stop reconnection attempts before disconnecting
      socket.io.opts.reconnection = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      doc.destroy();
      docRef.current = null;
      setConnected(false);
      setYjsDoc(null);
      setUsers([]);
    };
  }, [projectId, sessionId]);

  return { yjsDoc, connected, users };
}
