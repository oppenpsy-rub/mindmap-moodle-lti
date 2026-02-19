import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration.js';
import './WhiteboardEditor.css';

// Lazy-load tldraw; falls back to custom canvas if unavailable
const TldrawWrapper = lazy(() =>
  import('tldraw').then((mod) => {
    // Also import its CSS
    import('tldraw/tldraw.css');
    return { default: ({ projectId }) => <mod.Tldraw persistenceKey={`wb-${projectId}`} /> };
  }).catch(() => {
    return { default: () => null }; // will trigger fallback
  })
);

// ─── Fallback Canvas Whiteboard ───────────────────────────
function FallbackCanvas({ yjsDoc }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(2);
  const [shapes, setShapes] = useState([]);
  const currentPath = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;
    redraw(ctx, canvas);

    const handleResize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
      redraw(ctx, canvas);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) redraw(ctx, canvas);
  }, [shapes]);

  const redraw = (ctx, canvas) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw shapes
    shapes.forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'path' && shape.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (shape.type === 'rect') {
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === 'circle') {
        ctx.beginPath();
        const r = Math.sqrt(shape.w * shape.w + shape.h * shape.h) / 2;
        ctx.arc(shape.x + shape.w / 2, shape.y + shape.h / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === 'sticky') {
        ctx.fillStyle = shape.color;
        ctx.fillRect(shape.x, shape.y, 160, 120);
        ctx.strokeStyle = '#00000020';
        ctx.strokeRect(shape.x, shape.y, 160, 120);
        ctx.fillStyle = '#1e293b';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText(shape.text || 'Note', shape.x + 12, shape.y + 30);
      }
    });
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e) => {
    const pos = getPos(e);

    if (tool === 'sticky') {
      const text = prompt('Sticky note text:', 'Note');
      if (text) {
        setShapes([...shapes, {
          type: 'sticky', x: pos.x, y: pos.y,
          color: '#fef3c7', text, lineWidth: 1,
        }]);
      }
      return;
    }

    isDrawing.current = true;
    lastPos.current = pos;
    currentPath.current = [pos];
  };

  const handleMove = (e) => {
    if (!isDrawing.current) return;
    const pos = getPos(e);
    const ctx = ctxRef.current;

    if (tool === 'pen' || tool === 'eraser') {
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? 20 : lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      currentPath.current.push(pos);
    }

    lastPos.current = pos;
  };

  const handleUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === 'pen' && currentPath.current.length > 1) {
      setShapes([...shapes, {
        type: 'path', points: currentPath.current,
        color, lineWidth,
      }]);
    } else if (tool === 'rect' || tool === 'circle') {
      const start = currentPath.current[0];
      const end = lastPos.current;
      setShapes([...shapes, {
        type: tool, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y),
        color, lineWidth,
      }]);
    }

    currentPath.current = [];
  };

  const clearCanvas = () => {
    setShapes([]);
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) redraw(ctx, canvas);
  };

  const TOOLS = [
    { id: 'pen', icon: '✏️', label: 'Pen' },
    { id: 'eraser', icon: '🧹', label: 'Eraser' },
    { id: 'rect', icon: '⬜', label: 'Rectangle' },
    { id: 'circle', icon: '⭕', label: 'Circle' },
    { id: 'sticky', icon: '📝', label: 'Sticky Note' },
  ];

  const PALETTE = ['#1e293b', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Tool bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
        borderBottom: '1px solid var(--color-border)', background: '#fff',
      }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            style={{
              padding: '6px 10px', border: 'none', borderRadius: 6,
              background: tool === t.id ? 'var(--color-primary-light)' : 'transparent',
              color: tool === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            title={t.label}
          >
            {t.icon} <span style={{ fontSize: 12 }}>{t.label}</span>
          </button>
        ))}

        <span style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' }} />

        {PALETTE.map((c) => (
          <div
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 22, height: 22, borderRadius: 4, background: c, cursor: 'pointer',
              border: color === c ? '2px solid var(--color-text)' : '2px solid transparent',
            }}
          />
        ))}

        <span style={{ width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' }} />

        <select
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 12 }}
        >
          <option value={1}>Thin</option>
          <option value={2}>Normal</option>
          <option value={4}>Thick</option>
          <option value={8}>Bold</option>
        </select>

        <button
          onClick={clearCanvas}
          style={{
            marginLeft: 'auto', padding: '4px 12px', border: '1px solid var(--color-border)',
            borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, cursor: tool === 'sticky' ? 'crosshair' : 'default' }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
        />
      </div>
    </div>
  );
}

// ─── Error Boundary for tldraw ────────────────────────────
class TldrawErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.warn('tldraw failed to load:', error); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ─── Main Whiteboard Component ────────────────────────────
export default function WhiteboardEditor({ projectId, projectName, sessionId, onBack }) {
  const [name, setName] = useState(projectName || 'Untitled');
  const { yjsDoc, connected } = useYjsCollaboration(projectId, sessionId);

  return (
    <div className="whiteboard-editor">
      {/* Header */}
      <div className="wb-header">
        <button className="wb-back" onClick={onBack} title="Back to dashboard">←</button>
        <input
          className="wb-title-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board name"
        />
        <div className="wb-header-right">
          <div className={`wb-status ${connected ? 'online' : 'offline'}`}>
            <span className="wb-status-dot" />
            {connected ? 'Connected' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="wb-canvas-container">
        <Suspense fallback={<FallbackCanvas yjsDoc={yjsDoc} />}>
          <TldrawErrorBoundary fallback={<FallbackCanvas yjsDoc={yjsDoc} />}>
            <TldrawWrapper projectId={projectId} />
          </TldrawErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}
