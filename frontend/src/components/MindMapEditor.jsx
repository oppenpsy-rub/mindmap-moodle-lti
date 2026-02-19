import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useYjsCollaboration } from '../hooks/useYjsCollaboration.js';
import './MindMapEditor.css';

// ─── Constants ────────────────────────────────────────────
const COLORS = [
  '#4A90D9', '#50C878', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#10B981', '#F97316', '#6366F1',
  '#1E293B', '#64748B', '#0EA5E9', '#D946EF', '#14B8A6',
];

const SHAPES = ['rounded', 'pill', 'ellipse', 'diamond'];

const EMOJIS = [
  '💡', '⭐', '✅', '❌', '❓', '🔥', '💎', '🎯',
  '📌', '⚡', '🔑', '💬', '📝', '🏆', '🎨', '🚀',
  '📊', '🔔', '⚠️', '❤️', '👍', '📎', '🧩', '🌟',
];

const FONT_SIZES = { sm: 11, md: 14, lg: 18 };
const NODE_H = 42;
const NODE_PAD = 20;
const H_GAP = 180;
const V_GAP = 16;
const MIN_W = 110;
const DRAG_THRESHOLD = 5;

function uid() {
  return 'n' + Math.random().toString(36).slice(2, 10);
}

function nodeWidth(node) {
  const fs = FONT_SIZES[node.fontSize || 'md'] || 14;
  const baseW = Math.max(MIN_W, node.text.length * fs * 0.58 + NODE_PAD * 2);
  const emojiExtra = node.emoji ? 22 : 0;
  const shapeMult = node.shape === 'diamond' ? 1.4 : node.shape === 'ellipse' ? 1.15 : 1;
  return Math.round((baseW + emojiExtra) * shapeMult);
}

function normalizeNode(node) {
  return {
    shape: 'rounded',
    emoji: '',
    fontSize: 'md',
    lineStyle: 'solid',
    notes: '',
    collapsed: false,
    ...node,
  };
}

// ─── Tree Layout ──────────────────────────────────────────
function buildTree(nodes) {
  const tree = {};
  Object.values(nodes).forEach((n) => {
    tree[n.id] = { ...n, _children: [] };
  });
  Object.values(tree).forEach((n) => {
    if (n.parentId && tree[n.parentId]) {
      tree[n.parentId]._children.push(n.id);
    }
  });
  return tree;
}

function layoutTree(nodes, rootId) {
  if (!rootId || !nodes[rootId]) return {};
  const tree = buildTree(nodes);
  const positions = {};

  function subtreeH(id) {
    const node = tree[id];
    if (!node) return NODE_H;
    const kids = node.collapsed ? [] : node._children.filter((c) => tree[c]);
    if (kids.length === 0) return NODE_H;
    return kids.reduce((sum, c) => sum + subtreeH(c), 0) + (kids.length - 1) * V_GAP;
  }

  function place(id, x, yCenter) {
    const node = tree[id];
    if (!node) return;
    const w = nodeWidth(node);
    positions[id] = { x, y: yCenter - NODE_H / 2, w };
    const kids = node.collapsed ? [] : node._children.filter((c) => tree[c]);
    if (kids.length === 0) return;
    const totalH = subtreeH(id);
    let curY = yCenter - totalH / 2;
    for (const cid of kids) {
      const ch = subtreeH(cid);
      place(cid, x + w + H_GAP, curY + ch / 2);
      curY += ch + V_GAP;
    }
  }

  const rootH = subtreeH(rootId);
  place(rootId, 80, Math.max(rootH / 2, 350));
  return positions;
}

// ─── Subtree IDs ──────────────────────────────────────────
function getSubtreeIds(nodeId, nodes) {
  const ids = [nodeId];
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of Object.values(nodes)) {
      if (n.parentId === cur) {
        ids.push(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

// ─── Visible nodes ────────────────────────────────────────
function getVisibleIds(nodes, rootId) {
  const visible = new Set();
  const walk = (id) => {
    visible.add(id);
    if (nodes[id]?.collapsed) return;
    for (const n of Object.values(nodes)) {
      if (n.parentId === id) walk(n.id);
    }
  };
  if (rootId) walk(rootId);
  return visible;
}

// ─── Default Data ─────────────────────────────────────────
function createDefaultNodes() {
  const rootId = uid();
  const c1 = uid(), c2 = uid(), c3 = uid();
  const gc1 = uid(), gc2 = uid();
  return {
    rootId,
    nodes: {
      [rootId]: normalizeNode({ id: rootId, text: 'Hauptthema', parentId: null, color: '#4A90D9', emoji: '💡', shape: 'pill', fontSize: 'lg' }),
      [c1]: normalizeNode({ id: c1, text: 'Idee 1', parentId: rootId, color: '#50C878', emoji: '⭐' }),
      [c2]: normalizeNode({ id: c2, text: 'Idee 2', parentId: rootId, color: '#EF4444', emoji: '🔥' }),
      [c3]: normalizeNode({ id: c3, text: 'Idee 3', parentId: rootId, color: '#8B5CF6', emoji: '🎯' }),
      [gc1]: normalizeNode({ id: gc1, text: 'Detail A', parentId: c1, color: '#06B6D4' }),
      [gc2]: normalizeNode({ id: gc2, text: 'Detail B', parentId: c1, color: '#10B981' }),
    },
  };
}

// ─── Shape Renderer ───────────────────────────────────────
function renderShape(shape, w, h, color, isSelected) {
  const stroke = isSelected ? '#6366F1' : 'none';
  const sw = isSelected ? 2.5 : 0;
  switch (shape) {
    case 'pill':
      return <rect width={w} height={h} rx={h / 2} fill={color} stroke={stroke} strokeWidth={sw} />;
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={color} stroke={stroke} strokeWidth={sw} />;
    case 'diamond': {
      const pts = `${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`;
      return <polygon points={pts} fill={color} stroke={stroke} strokeWidth={sw} />;
    }
    case 'rounded':
    default:
      return <rect width={w} height={h} rx={10} fill={color} stroke={stroke} strokeWidth={sw} />;
  }
}

// ─── Shape Preview ────────────────────────────────────────
function ShapePreview({ shape, color, active }) {
  return (
    <svg width="36" height="24" viewBox="0 0 36 24">
      {renderShape(shape, 34, 22, active ? color : '#cbd5e1', false)}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export default function MindMapEditor({ projectId, projectName, sessionId, onBack }) {
  const [nodes, setNodes] = useState({});
  const [rootId, setRootId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [name, setName] = useState(projectName || 'Untitled');
  const [showPanel, setShowPanel] = useState(true);
  const [panelTab, setPanelTab] = useState('style');
  const [contextMenu, setContextMenu] = useState(null);

  // Pan / Zoom
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const nodesRef = useRef(nodes);
  const localUpdate = useRef(false);

  const { yjsDoc, connected } = useYjsCollaboration(projectId, sessionId);

  // Keep nodesRef in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ── Yjs Sync ──────────────────────────────────────────
  useEffect(() => {
    if (!yjsDoc) return;
    const yNodes = yjsDoc.getMap('mindmap-nodes');
    const yMeta = yjsDoc.getMap('mindmap-meta');

    const loaded = {};
    yNodes.forEach((val, key) => {
      try { loaded[key] = normalizeNode(typeof val === 'string' ? JSON.parse(val) : val); } catch {}
    });

    if (Object.keys(loaded).length === 0) {
      const def = createDefaultNodes();
      localUpdate.current = true;
      yjsDoc.transact(() => {
        Object.entries(def.nodes).forEach(([k, v]) => yNodes.set(k, JSON.stringify(v)));
        yMeta.set('rootId', def.rootId);
      });
      localUpdate.current = false;
      setNodes(def.nodes);
      setRootId(def.rootId);
    } else {
      setNodes(loaded);
      setRootId(yMeta.get('rootId'));
    }

    const observer = () => {
      if (localUpdate.current) return;
      const updated = {};
      yNodes.forEach((val, key) => {
        try { updated[key] = normalizeNode(typeof val === 'string' ? JSON.parse(val) : val); } catch {}
      });
      setNodes(updated);
      setRootId(yMeta.get('rootId') || null);
    };

    yNodes.observe(observer);
    yMeta.observe(observer);
    return () => { yNodes.unobserve(observer); yMeta.unobserve(observer); };
  }, [yjsDoc]);

  // ── Sync to Yjs ───────────────────────────────────────
  const syncToYjs = useCallback((newNodes, newRootId) => {
    if (!yjsDoc) return;
    const yNodes = yjsDoc.getMap('mindmap-nodes');
    const yMeta = yjsDoc.getMap('mindmap-meta');
    localUpdate.current = true;
    yjsDoc.transact(() => {
      const keys = [];
      yNodes.forEach((_, k) => keys.push(k));
      keys.forEach((k) => { if (!newNodes[k]) yNodes.delete(k); });
      Object.entries(newNodes).forEach(([k, v]) => yNodes.set(k, JSON.stringify(v)));
      if (newRootId) yMeta.set('rootId', newRootId);
    });
    localUpdate.current = false;
  }, [yjsDoc]);

  // ── Layout positions ──────────────────────────────────
  const layoutPositions = useMemo(() => layoutTree(nodes, rootId), [nodes, rootId]);

  const getNodePos = useCallback((nodeId) => {
    const node = nodes[nodeId];
    if (!node) return null;
    const w = nodeWidth(node);
    if (node.x != null && node.y != null) return { x: node.x, y: node.y, w };
    const lp = layoutPositions[nodeId];
    return lp ? { ...lp, w } : { x: 0, y: 0, w };
  }, [nodes, layoutPositions]);

  // ── Visible nodes ─────────────────────────────────────
  const visibleIds = useMemo(() => getVisibleIds(nodes, rootId), [nodes, rootId]);

  // ── Child count ───────────────────────────────────────
  const childCount = useMemo(() => {
    const cc = {};
    Object.values(nodes).forEach((n) => {
      if (n.parentId) cc[n.parentId] = (cc[n.parentId] || 0) + 1;
    });
    return cc;
  }, [nodes]);

  // ── Node Operations ───────────────────────────────────
  const updateNode = useCallback((id, updates) => {
    if (!nodes[id]) return;
    const updated = { ...nodes, [id]: { ...nodes[id], ...updates } };
    setNodes(updated);
    syncToYjs(updated, rootId);
  }, [nodes, rootId, syncToYjs]);

  const addChild = useCallback((parentId = null) => {
    const pid = parentId || selected || rootId;
    if (!pid || !nodes[pid]) return;
    const id = uid();
    const colorIdx = Object.keys(nodes).length % COLORS.length;
    const newNode = normalizeNode({ id, text: 'Neues Thema', parentId: pid, color: COLORS[colorIdx] });
    const updated = { ...nodes, [id]: newNode };
    if (updated[pid].collapsed) updated[pid] = { ...updated[pid], collapsed: false };
    setNodes(updated);
    setSelected(id);
    syncToYjs(updated, rootId);
    setTimeout(() => { setEditing(id); setEditText('Neues Thema'); }, 60);
  }, [selected, rootId, nodes, syncToYjs]);

  const addSibling = useCallback(() => {
    if (!selected || !nodes[selected]) return;
    const parentId = nodes[selected].parentId;
    if (!parentId) return;
    const id = uid();
    const colorIdx = Object.keys(nodes).length % COLORS.length;
    const newNode = normalizeNode({ id, text: 'Neues Thema', parentId, color: COLORS[colorIdx] });
    const updated = { ...nodes, [id]: newNode };
    setNodes(updated);
    setSelected(id);
    syncToYjs(updated, rootId);
    setTimeout(() => { setEditing(id); setEditText('Neues Thema'); }, 60);
  }, [selected, nodes, rootId, syncToYjs]);

  const deleteNode = useCallback((nodeId = null) => {
    const target = nodeId || selected;
    if (!target || target === rootId) return;
    const toDelete = new Set();
    const collect = (id) => { toDelete.add(id); Object.values(nodes).filter((n) => n.parentId === id).forEach((n) => collect(n.id)); };
    collect(target);
    const updated = {};
    Object.entries(nodes).forEach(([k, v]) => { if (!toDelete.has(k)) updated[k] = v; });
    setNodes(updated);
    if (selected === target) setSelected(null);
    setEditing(null);
    syncToYjs(updated, rootId);
  }, [selected, nodes, rootId, syncToYjs]);

  const toggleCollapse = useCallback((id) => {
    if (!nodes[id]) return;
    updateNode(id, { collapsed: !nodes[id].collapsed });
  }, [nodes, updateNode]);

  const finishEdit = useCallback(() => {
    if (!editing) return;
    const text = editText.trim() || 'Thema';
    updateNode(editing, { text });
    setEditing(null);
  }, [editing, editText, updateNode]);

  const autoLayout = useCallback(() => {
    const updated = {};
    Object.entries(nodes).forEach(([k, v]) => {
      const { x, y, ...rest } = v;
      updated[k] = rest;
    });
    setNodes(updated);
    syncToYjs(updated, rootId);
  }, [nodes, rootId, syncToYjs]);

  // ── Drag & Drop ───────────────────────────────────────
  const handleNodeMouseDown = useCallback((e, nodeId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const subtreeIds = getSubtreeIds(nodeId, nodes);
    const startPositions = {};
    subtreeIds.forEach(id => {
      const pos = getNodePos(id);
      if (pos) startPositions[id] = { x: pos.x, y: pos.y };
    });
    dragRef.current = { nodeId, subtreeIds, startPositions, originX: e.clientX, originY: e.clientY, moved: false };
  }, [nodes, getNodePos]);

  // ── Pan / Zoom / Mouse ────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'svg' || e.target.classList.contains('mm-bg')) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
      wrapRef.current?.classList.add('grabbing');
      setContextMenu(null);
    }
  }, [offset]);

  const handleMouseMove = useCallback((e) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = (e.clientX - drag.originX) / scale;
      const dy = (e.clientY - drag.originY) / scale;
      if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        drag.moved = true;
      }
      if (drag.moved) {
        const { subtreeIds, startPositions } = drag;
        setNodes(prev => {
          const updated = { ...prev };
          for (const id of subtreeIds) {
            const sp = startPositions[id];
            if (sp) updated[id] = { ...updated[id], x: sp.x + dx, y: sp.y + dy };
          }
          return updated;
        });
      }
      return;
    }
    if (isPanning.current) {
      setOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
  }, [scale]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      if (dragRef.current.moved) {
        syncToYjs(nodesRef.current, rootId);
      } else {
        setSelected(dragRef.current.nodeId);
      }
      dragRef.current = null;
      return;
    }
    isPanning.current = false;
    wrapRef.current?.classList.remove('grabbing');
  }, [rootId, syncToYjs]);

  // ── Context Menu ──────────────────────────────────────
  const handleContextMenu = useCallback((e, nodeId = null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    if (nodeId) setSelected(nodeId);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // ── Keyboard ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (editing) return;
      if (e.key === 'Tab') { e.preventDefault(); addChild(); }
      else if (e.key === 'Enter' && selected && nodes[selected]) {
        e.preventDefault(); setEditing(selected); setEditText(nodes[selected].text);
      }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && selected !== rootId) {
        e.preventDefault(); deleteNode();
      }
      else if (e.key === 'Escape') { setSelected(null); setContextMenu(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, selected, addChild, deleteNode, nodes, rootId]);

  // ── Wheel Zoom ────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setScale((s) => Math.min(3, Math.max(0.15, s * delta)));
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Compute edges ─────────────────────────────────────
  const edges = useMemo(() => {
    const result = [];
    Object.values(nodes).forEach((node) => {
      if (!node.parentId || !visibleIds.has(node.id)) return;
      const parentPos = getNodePos(node.parentId);
      const childPos = getNodePos(node.id);
      if (!parentPos || !childPos) return;
      const x1 = parentPos.x + parentPos.w;
      const y1 = parentPos.y + NODE_H / 2;
      const x2 = childPos.x;
      const y2 = childPos.y + NODE_H / 2;
      const mx = (x1 + x2) / 2;
      result.push({
        key: `${node.parentId}-${node.id}`,
        d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
        color: nodes[node.parentId]?.color || '#ccc',
        lineStyle: node.lineStyle || 'solid',
      });
    });
    return result;
  }, [nodes, visibleIds, getNodePos]);

  // ── Inline edit position ──────────────────────────────
  let editPos = null;
  if (editing) {
    const p = getNodePos(editing);
    if (p) {
      editPos = {
        left: p.x * scale + offset.x + (p.w * scale) / 2,
        top: p.y * scale + offset.y + (NODE_H * scale) / 2,
      };
    }
  }

  // ── Export ────────────────────────────────────────────
  const handleExport = () => {
    const data = JSON.stringify({ rootId, nodes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name || 'mindmap'}.json`;
    a.click();
  };

  const zoomIn = () => setScale((s) => Math.min(3, s * 1.2));
  const zoomOut = () => setScale((s) => Math.max(0.15, s / 1.2));
  const zoomReset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const selectedNode = selected ? nodes[selected] : null;

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <div className="mindmap-editor">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="mm-header">
        <button className="mm-back" onClick={onBack} title="Zurück">←</button>
        <input
          className="mm-title-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board-Name"
        />
        <div className="mm-header-right">
          <button className="mm-header-btn" onClick={autoLayout} title="Automatisches Layout wiederherstellen">
            ⚡ Auto-Layout
          </button>
          <div className={`mm-status ${connected ? 'online' : 'offline'}`}>
            <span className="mm-status-dot" />
            {connected ? 'Verbunden' : 'Offline'}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={handleExport}>📥 Export</button>
          <button
            className={`mm-header-btn ${showPanel && selectedNode ? 'active' : ''}`}
            onClick={() => setShowPanel(!showPanel)}
          >
            ☰ Panel
          </button>
        </div>
      </div>

      <div className="mm-body">
        {/* ── Toolbar ────────────────────────────────────── */}
        <div className="mm-toolbar">
          <span className="mm-tool-label">Knoten</span>
          <button className="mm-tool" onClick={() => addChild()} title="Kind hinzufügen (Tab)">
            <svg width="18" height="18" viewBox="0 0 18 18"><line x1="9" y1="3" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <button className="mm-tool" onClick={addSibling} title="Geschwister hinzufügen" disabled={!selected || selected === rootId}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 9h10M14 9l-3-3M14 9l-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="mm-tool" onClick={() => { if (selected) { setEditing(selected); setEditText(nodes[selected]?.text || ''); }}} title="Bearbeiten (Enter)" disabled={!selected}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M13.5 2.5l2 2-9 9H4.5v-2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><line x1="4" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button className="mm-tool" onClick={() => deleteNode()} title="Löschen (Entf)" disabled={!selected || selected === rootId}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>

          <div className="mm-tool-divider" />
          <span className="mm-tool-label">Ansicht</span>
          <button className="mm-tool" onClick={() => selected && toggleCollapse(selected)} title="Auf-/Zuklappen" disabled={!selected || !childCount[selected]}>
            <svg width="18" height="18" viewBox="0 0 18 18"><rect x="2" y="4" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button className="mm-tool" onClick={autoLayout} title="Auto-Layout">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 3h5v5H3zM10 3h5v5h-5zM6.5 10v3h5v-3M9 8v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* ── Canvas ─────────────────────────────────────── */}
        <div
          className="mm-canvas-wrap"
          ref={wrapRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => handleContextMenu(e)}
          onClick={(e) => {
            if (e.target === wrapRef.current || e.target.tagName === 'svg' || e.target.classList.contains('mm-bg'))
              setSelected(null);
          }}
        >
          <svg ref={svgRef} className="mm-canvas">
            <rect className="mm-bg" width="100%" height="100%" fill="#f8fafc" />
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
              <defs>
                <pattern id="mmgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="0.7" fill="#e2e8f0" />
                </pattern>
                <filter id="nodeshadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08"/>
                </filter>
              </defs>
              <rect width="12000" height="8000" x="-6000" y="-3000" fill="url(#mmgrid)" />

              {/* Edges */}
              {edges.map((e) => (
                <path
                  key={e.key}
                  className={`mm-edge mm-edge-${e.lineStyle}`}
                  d={e.d}
                  stroke={e.color}
                />
              ))}

              {/* Nodes */}
              {Object.values(nodes).map((node) => {
                if (!visibleIds.has(node.id)) return null;
                const pos = getNodePos(node.id);
                if (!pos) return null;
                const isSelected = selected === node.id;
                const w = pos.w;
                const hasKids = childCount[node.id] > 0;
                const fs = FONT_SIZES[node.fontSize || 'md'];
                const isBeingDragged = dragRef.current?.moved && dragRef.current.subtreeIds?.includes(node.id);

                return (
                  <g
                    key={node.id}
                    className={`mm-node ${isSelected ? 'mm-node-selected' : ''}`}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditing(node.id); setEditText(node.text); }}
                    onContextMenu={(e) => handleContextMenu(e, node.id)}
                    style={{ cursor: isBeingDragged ? 'grabbing' : 'grab' }}
                    filter={isSelected ? 'url(#nodeshadow)' : undefined}
                  >
                    {/* Selection ring */}
                    {isSelected && (
                      <rect
                        width={w + 6} height={NODE_H + 6} x={-3} y={-3}
                        rx={14} fill="none" stroke="#6366F1" strokeWidth={2}
                        strokeDasharray="6 3" opacity={0.6}
                      />
                    )}

                    {/* Shape */}
                    {renderShape(node.shape || 'rounded', w, NODE_H, node.color || '#4A90D9', false)}

                    {/* Emoji + Text */}
                    {editing !== node.id && (
                      <text
                        className="mm-node-text"
                        x={w / 2}
                        y={NODE_H / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fs}
                      >
                        {node.emoji ? `${node.emoji} ` : ''}{node.text.length > 28 ? node.text.slice(0, 28) + '…' : node.text}
                      </text>
                    )}

                    {/* Notes indicator */}
                    {node.notes && (
                      <g>
                        <circle cx={w - 6} cy={6} r={5} fill="#F59E0B" stroke="#fff" strokeWidth={1.5} />
                        <text x={w - 6} y={7} textAnchor="middle" dominantBaseline="central" fontSize={7} fill="#fff" fontWeight="700">N</text>
                      </g>
                    )}

                    {/* Collapse button */}
                    {hasKids && (
                      <g
                        className="mm-collapse-btn"
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
                      >
                        <circle cx={w + 16} cy={NODE_H / 2} r={11} fill="#fff" stroke="#cbd5e1" strokeWidth={1.5} />
                        <text x={w + 16} y={NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={node.collapsed ? 10 : 14} fill="#64748b" fontWeight="600">
                          {node.collapsed ? `+${childCount[node.id]}` : '−'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* ── Inline Edit ──────────────────────────────── */}
          {editing && editPos && (
            <div className="mm-inline-edit" style={{ left: editPos.left, top: editPos.top }}>
              <input
                className="mm-inline-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishEdit();
                  if (e.key === 'Escape') setEditing(null);
                }}
                onBlur={finishEdit}
                autoFocus
              />
            </div>
          )}

          {/* ── Context Menu ─────────────────────────────── */}
          {contextMenu && (
            <div className="mm-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
              {contextMenu.nodeId ? (
                <>
                  <div className="mm-ctx-item" onClick={() => { setEditing(contextMenu.nodeId); setEditText(nodes[contextMenu.nodeId]?.text || ''); setContextMenu(null); }}>
                    <span className="mm-ctx-icon">✏️</span> Bearbeiten
                  </div>
                  <div className="mm-ctx-item" onClick={() => { addChild(contextMenu.nodeId); setContextMenu(null); }}>
                    <span className="mm-ctx-icon">➕</span> Kind hinzufügen
                  </div>
                  {contextMenu.nodeId !== rootId && (
                    <div className="mm-ctx-item" onClick={() => { setSelected(contextMenu.nodeId); addSibling(); setContextMenu(null); }}>
                      <span className="mm-ctx-icon">↩️</span> Geschwister hinzufügen
                    </div>
                  )}
                  {childCount[contextMenu.nodeId] > 0 && (
                    <div className="mm-ctx-item" onClick={() => { toggleCollapse(contextMenu.nodeId); setContextMenu(null); }}>
                      <span className="mm-ctx-icon">{nodes[contextMenu.nodeId]?.collapsed ? '📂' : '📁'}</span>
                      {nodes[contextMenu.nodeId]?.collapsed ? 'Aufklappen' : 'Zuklappen'}
                    </div>
                  )}
                  <div className="mm-ctx-divider" />
                  <div className="mm-ctx-sub-section">
                    <span className="mm-ctx-sub-label">Form</span>
                    <div className="mm-ctx-shapes">
                      {SHAPES.map(s => (
                        <button
                          key={s}
                          className={`mm-ctx-shape ${nodes[contextMenu.nodeId]?.shape === s ? 'active' : ''}`}
                          onClick={() => { updateNode(contextMenu.nodeId, { shape: s }); }}
                          title={s === 'rounded' ? 'Rechteck' : s === 'pill' ? 'Abgerundet' : s === 'ellipse' ? 'Ellipse' : 'Raute'}
                        >
                          <svg width="24" height="16" viewBox="0 0 24 16">
                            {renderShape(s, 22, 14, nodes[contextMenu.nodeId]?.color || '#4A90D9', false)}
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mm-ctx-sub-section">
                    <span className="mm-ctx-sub-label">Farbe</span>
                    <div className="mm-ctx-colors">
                      {COLORS.slice(0, 10).map(c => (
                        <div
                          key={c}
                          className={`mm-ctx-color ${nodes[contextMenu.nodeId]?.color === c ? 'active' : ''}`}
                          style={{ background: c }}
                          onClick={() => { updateNode(contextMenu.nodeId, { color: c }); }}
                        />
                      ))}
                    </div>
                  </div>
                  {contextMenu.nodeId !== rootId && (
                    <>
                      <div className="mm-ctx-divider" />
                      <div className="mm-ctx-item mm-ctx-danger" onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null); }}>
                        <span className="mm-ctx-icon">🗑️</span> Löschen
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="mm-ctx-item" onClick={() => { addChild(rootId); setContextMenu(null); }}>
                  <span className="mm-ctx-icon">➕</span> Neuen Knoten hinzufügen
                </div>
              )}
            </div>
          )}

          {/* ── Zoom Controls ────────────────────────────── */}
          <div className="mm-zoom-controls">
            <button className="mm-zoom-btn" onClick={zoomIn} title="Vergrößern">+</button>
            <div className="mm-zoom-level" onClick={zoomReset} title="Zurücksetzen">{Math.round(scale * 100)}%</div>
            <button className="mm-zoom-btn" onClick={zoomOut} title="Verkleinern">−</button>
          </div>

          {/* ── Help ─────────────────────────────────────── */}
          <div className="mm-help">
            <kbd>Tab</kbd> Kind &nbsp; <kbd>Enter</kbd> Bearbeiten &nbsp; <kbd>Entf</kbd> Löschen &nbsp;
            <kbd>Scroll</kbd> Zoom &nbsp; <span className="mm-help-drag">⟷ Knoten ziehen zum Verschieben</span>
          </div>
        </div>

        {/* ── Properties Panel ───────────────────────────── */}
        {showPanel && selectedNode && (
          <div className="mm-panel">
            <div className="mm-panel-head">
              <span className="mm-panel-title">Eigenschaften</span>
              <button className="mm-panel-close" onClick={() => setShowPanel(false)}>✕</button>
            </div>

            <div className="mm-panel-tabs">
              <button className={`mm-ptab ${panelTab === 'style' ? 'active' : ''}`} onClick={() => setPanelTab('style')}>Stil</button>
              <button className={`mm-ptab ${panelTab === 'notes' ? 'active' : ''}`} onClick={() => setPanelTab('notes')}>
                Notizen {selectedNode.notes ? '●' : ''}
              </button>
            </div>

            <div className="mm-panel-body">
              {panelTab === 'style' ? (
                <>
                  {/* Text */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Text</label>
                    <input
                      className="mm-pinput"
                      value={selectedNode.text}
                      onChange={(e) => updateNode(selected, { text: e.target.value })}
                    />
                  </div>

                  {/* Shape */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Form</label>
                    <div className="mm-shape-grid">
                      {SHAPES.map(s => (
                        <button
                          key={s}
                          className={`mm-shape-opt ${selectedNode.shape === s ? 'active' : ''}`}
                          onClick={() => updateNode(selected, { shape: s })}
                        >
                          <ShapePreview shape={s} color={selectedNode.color || '#4A90D9'} active={selectedNode.shape === s} />
                          <span className="mm-shape-label">
                            {s === 'rounded' ? 'Eckig' : s === 'pill' ? 'Rund' : s === 'ellipse' ? 'Oval' : 'Raute'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Farbe</label>
                    <div className="mm-color-grid">
                      {COLORS.map(c => (
                        <div
                          key={c}
                          className={`mm-cdot ${selectedNode.color === c ? 'active' : ''}`}
                          style={{ background: c }}
                          onClick={() => updateNode(selected, { color: c })}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Emoji */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Icon</label>
                    <div className="mm-emoji-grid">
                      <button
                        className={`mm-emoji-btn ${!selectedNode.emoji ? 'active' : ''}`}
                        onClick={() => updateNode(selected, { emoji: '' })}
                      >✕</button>
                      {EMOJIS.map(em => (
                        <button
                          key={em}
                          className={`mm-emoji-btn ${selectedNode.emoji === em ? 'active' : ''}`}
                          onClick={() => updateNode(selected, { emoji: em })}
                        >{em}</button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Schriftgröße</label>
                    <div className="mm-btn-row">
                      {[['sm', 'S'], ['md', 'M'], ['lg', 'L']].map(([key, label]) => (
                        <button
                          key={key}
                          className={`mm-opt-btn ${(selectedNode.fontSize || 'md') === key ? 'active' : ''}`}
                          onClick={() => updateNode(selected, { fontSize: key })}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Line Style */}
                  <div className="mm-psection">
                    <label className="mm-plabel">Verbindungslinie</label>
                    <div className="mm-btn-row">
                      {[['solid', '───'], ['dashed', '- - -'], ['dotted', '· · ·']].map(([key, label]) => (
                        <button
                          key={key}
                          className={`mm-opt-btn ${(selectedNode.lineStyle || 'solid') === key ? 'active' : ''}`}
                          onClick={() => updateNode(selected, { lineStyle: key })}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mm-psection">
                  <label className="mm-plabel">Notizen zu „{selectedNode.text}"</label>
                  <textarea
                    className="mm-notes-area"
                    value={selectedNode.notes || ''}
                    onChange={(e) => updateNode(selected, { notes: e.target.value })}
                    placeholder="Hier Notizen, Details oder Beschreibungen eingeben..."
                    rows={12}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
