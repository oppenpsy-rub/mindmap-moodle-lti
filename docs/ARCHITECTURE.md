# Architecture & Design Decisions

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOODLE INSTANCE (RUB)                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ LTI 1.3 Launch                                              │  │
│  │ POST /lti/launch + JWT                                     │  │
│  └──────────────────────┬──────────────────────────────────────┘  │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │   MindMap Tool Backend               │
        │   (Render / RUB)                    │
        │                                     │
        │ ┌─────────────────────────────────┐ │
        │ │ LTI Handler                     │ │
        │ │ - JWT Validation                │ │
        │ │ - Session Management            │ │
        │ └──────────────┬──────────────────┘ │
        │                │                    │
        │ ┌──────────────▼──────────────────┐ │
        │ │ Express Server                  │ │
        │ │ - REST API (/api/*)             │ │
        │ │ - WebSocket (Socket.io)         │ │
        │ │ - CORS & Security               │ │
        │ └──────────────┬──────────────────┘ │
        │                │                    │
        │ ┌──────────────▼──────────────────┐ │
        │ │ Yjs CRDT Engine                 │ │
        │ │ - Real-time Sync                │ │
        │ │ - Conflict Resolution           │ │
        │ │ - Operational Transformation    │ │
        │ └──────────────┬──────────────────┘ │
        │                │                    │
        └─────────────────┼────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │   MySQL Database (All-Inkl / RUB)   │
        │                                     │
        │ - project_states (Yjs snapshots)    │
        │ - projects (metadata)               │
        │ - project_members (permissions)     │
        │ - audit_log (security)              │
        └─────────────────────────────────────┘


Frontend Architecture
┌──────────────────────────────────────────────────┐
│            Vercel / RUB                          │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ React 18 App (Vite)                        │ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ Dashboard (ProjectList)               │  │ │
│  │ │ - Shows all projects                 │  │ │
│  │ │ - Create/Delete projects             │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ Editor (MindMap or Whiteboard)        │  │ │
│  │ │ - Real-time editing                  │  │ │
│  │ │ - Yjs synced                         │  │ │
│  │ │ - User awareness (cursors, names)    │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  │                                            │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ WebSocket Client (Socket.io)         │  │ │
│  │ │ - Connects to backend                │  │ │
│  │ │ - Sends/receives Yjs updates         │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Technology Stack Rationale

### Frontend: React 18 + Vite

**Why React?**
- Large ecosystem (10,000+ packages for collaborative editing)
- Fast re-renders with virtual DOM
- Rich component library
- Great tooling & community

**Why Vite?** (instead of Create React App)
- 10x faster development builds
- ESM-native (modern JavaScript modules)
- Tiny bundle size
- Built-in HMR (Hot Module Replacement)

**Alternatives considered & rejected:**
- Vue.js: Smaller ecosystem, fewer CRDT libraries
- Svelte: Lack of CRDT libraries, smaller community
- Angular: Overkill, slower, verbose

### Backend: Node.js + Express

**Why Node.js?**
- JavaScript on both frontend & backend (easier code sharing)
- Non-blocking I/O (perfect for real-time WebSocket)
- Massive npm ecosystem
- Yjs libraries mature in Node.js

**Why Express?** (instead of Next.js, Fastify)
- Lightweight & minimal
- Perfect fit for WebSocket + REST API
- Massive adoption, lots of tutorials
- Easy to deploy on Render/RUB

**Alternatives considered & rejected:**
- Next.js: Adds complexity, overkill for this use case
- Fastify: Slightly faster, but Express good enough
- Django/Python: LTI libraries better in Node.js

### Real-time Sync: Yjs CRDT

**Why Yjs?** (instead of OT, Automerge, Firestore)
- **Fastest CRDT**: Sub-millisecond conflict resolution
- **Network agnostic**: Works with WebSocket, WebRTC, P2P, HTTP
- **Binary encoding**: Smallest message deltas
- **Mature**: Used by Figma, VSCode Teams, Atlassian
- **JavaScript native**: Direct integration with our stack

**How it works:**
```javascript
// Each client has a Yjs document
const ydoc = new Y.Doc();
const ymap = ydoc.getMap('shared-state');

// Changes made locally
ymap.set('key', 'value');

// Automatically synced to other clients
// Even if same key edited simultaneously → Yjs handles it!
```

**Conflict resolution example:**
```
Time:     0    1    2    3    4    5    6
Client A: Edit "A" ──────────────────┐
Client B:              Edit "B" ──────┤
Conflict:    Both edit same position  │
Result:      Yjs merges alphabetically: "AB" or "BA"
             (deterministic, all clients get same result)
```

**Alternatives considered & rejected:**
- Operational Transformation (old Google Docs tech): Slower, complex
- Automerge: Good but slower than Yjs, more Rust-focused
- Firestore: Proprietary, lock-in, expensive, not CRDT

### WebSocket: Socket.io

**Why Socket.io?** (instead of plain WebSocket)
- Automatic reconnection (critical for mobile users)
- Fallback to HTTP Long-polling (compatible with proxies)
- Built-in room management (easy to isolate projects)
- Acknowledgments (verify message delivery)

**How rooms work:**
```javascript
io.of('/projects/:id').on('connection', (socket) => {
  // Each project is a room
  // Updates only broadcast to users in that room
  socket.emit('yjs-update', data);
});
```

**Alternatives considered & rejected:**
- Raw WebSocket: No auto-reconnect, no fallback, more work
- gRPC: Overkill, harder to debug, not browser-native
- SignalR: Microsoft-specific, doesn't fit our stack

### Database: MySQL/MariaDB (All-Inkl)

**Why MySQL?**
- You already have it (All-Inkl access)
- Industry standard for universities
- JSON support (store Yjs binary states as BLOB)
- Easy backup/restore with mysqldump

**Data model:**
```sql
-- Projects (metadata)
CREATE TABLE projects (
  id CHAR(36),                     -- UUID
  name VARCHAR(255),
  created_by VARCHAR(255),         -- Moodle User ID
  course_id VARCHAR(255),          -- For organization
  created_at TIMESTAMP
);

-- Project States (Yjs snapshots)
CREATE TABLE project_states (
  id INT,
  project_id CHAR(36),
  yjs_state LONGBLOB,              -- Binary Yjs state
  version INT,                     -- Snapshot version
  created_at TIMESTAMP
);

-- Permissions
CREATE TABLE project_members (
  project_id CHAR(36),
  user_id VARCHAR(255),
  role ENUM('editor', 'viewer'),   -- Can edit or just view
  joined_at TIMESTAMP
);

-- Security audit
CREATE TABLE audit_log (
  id INT,
  project_id CHAR(36),
  user_id VARCHAR(255),
  action VARCHAR(255),             -- "created", "edited", etc
  created_at TIMESTAMP
);
```

**Why Yjs states as BLOB?**
- Binary format (small, 80% smaller than JSON)
- Directly usable by y-websocket provider
- Efficient snapshots (compress with zlib if needed)

**Migration path to PostgreSQL (for RUB):**
```bash
# MySQL → PostgreSQL is straightforward
# Yjs states don't change (BYTEA type in PostgreSQL)
# Just run: pg_restore from mysqldump export
```

## Real-time Collaboration Flow

```
User A (Browser 1)           Yjs CRDT (Server)        User B (Browser 2)
         │                           │                         │
         ├────── Edit "X" ──────────>│                         │
         │    Socket.io + Yjs        │                         │
         │                           │<─── Broadcast Yjs ──────┤
         │                           │    Update (binary)      │
         │<─── ACK + Echo ───────────┤                         │
         │                           ├─ Persist to DB ──────→  │
         │                           │                    MySQL │
         │                           │                         │
         │  (If offline)             │   (Offline User)        │
         │  Local changes buffered   │   Queues updates        │
         │  WebSocket reconnects ────┤────────────────────────>│
         │  Sends local changes      │   Sync on reconnect     │
         │                           │   Yjs resolves conflicts │
         ├────────────────────────────────────────────────────│
         │  All clients converge to same state (eventual consistency)
         │
```

## Design Decisions Documentation

### Decision 1: LTI 1.3 vs Custom OAuth

**Chosen:** LTI 1.3

**Why:**
- Standard (every Moodle supports it)
- No double-login (automatic)
- Course context passed automatically
- Secure (OAuth2 + JWT)

**Rejected:** Custom OAuth because Moodle already knows LTI

### Decision 2: Frontend hosted on Vercel vs Render

**Chosen:** Vercel for frontend, Render for backend

**Why:**
- Vercel optimized for static + API routes
- Fast global CDN
- Easy deploy (GitHub integration)
- Render better for persistent server

**Rejected:** Same platform because Vercel serverless has 10s timeout (WebSocket needs persistent connection)

### Decision 3: Polling vs WebSocket

**Chosen:** WebSocket

**Why:**
- True real-time (sub-100ms latency)
- Server-initiated updates (not just client-pulled)
- Lower network usage (deltas, not full state)

**Rejected:** Polling because:
- 500ms refresh = 120 requests/min per user
- Latency very noticeable
- Battery drain on mobile

### Decision 4: Store full snapshots vs incremental updates

**Chosen:** Hybrid - snapshots every 5 min + incremental updates

**Why:**
```javascript
// Problem if only incremental:
// Need to replay 1000 updates to reconstruct state = slow

// Problem if only snapshots:
// Can't do undo/redo, version history

// Solution: Snapshots for initial load, updates for history
const snapshots = await getLatestSnapshot(projectId);    // Fast
const incremental = await getUpdates(projectId, time);   // For history
```

**Rejected:** 
- Full snapshots on every change (DB overwhelm)
- Only updates (startup slow)

## Scalability Considerations

### For 100 users editing simultaneously

**Problem:** 100 users × 50 updates/min = 5,000 updates/min

**Solution 1: Socket.io rooms**
```javascript
io.of('/projects/:id').emit('yjs-update');
// Only users in project 123 get the update
// Not broadcast to all users globally
```

**Solution 2: Database batching**
```javascript
// Don't save every update
// Buffer 50 updates, save every 10 seconds
// Trades: Slight data loss risk for DB performance
```

**Solution 3: Caching layer (future)**
```javascript
// Add Redis for session state
// y-redis provider for Yjs
// Offload from database
```

### Network bandwidth

**Yjs binary encoding is tiny:**
```
Text change "hello" → "hello world"
  JSON approach: {"text": "hello world"}    = 25 bytes
  Yjs approach:  [binary update]            = 8 bytes
  Savings: 68% reduction
```

With 100 users, Socket.io broadcast still < 100 KB/sec

## Security Architecture

### LTI 1.3 Authentication Flow

```
Moodle signs request with private key
        │
        ▼ (Browser POSTs to /lti/launch)
Tool receives JWT in request
        │
        ▼ (Fetches Moodle public key from OIDC endpoint)
Tool verifies signature
        │
        ▼ (If valid, extract user data from JWT payload)
Tool creates session
        │
        ▼ (Sets HTTPOnly, Secure cookie)
Frontend sends cookie with every request
        │
        ▼ (Backend validates cookie before allowing access)
Access granted to authenticated user only
```

### Session Security

```javascript
// HTTPOnly cookie (JavaScript can't read it)
res.cookie('session_id', sessionId, {
  httpOnly: true,      // Can't be stolen by XSS
  secure: true,        // Only HTTPS
  sameSite: 'Lax',    // CSRF protection
  maxAge: 24 * 60 * 60 * 1000  // 24 hours
});
```

## Testing Strategy

### Unit Tests

```javascript
// Backend: LTI JWT validation
test('Valid JWT creates session', ...);
test('Invalid signature rejects', ...);
test('Expired JWT rejects', ...);

// Frontend: Component rendering
test('ProjectList renders all projects', ...);
test('Edit updates local Yjs state', ...);
```

### Integration Tests

```javascript
// LTI Launch → Moodle JWT → Session → Dashboard
test('End-to-end LTI launch', ...);
test('WebSocket auto-reconnect', ...);
test('Yjs conflict resolution', ...);
```

### E2E Tests

```javascript
// Open 2 browsers, both edit simultaneously
test('Real-time sync between 2 users', ...);
test('Offline user sync on reconnect', ...);
test('Logout destroys session', ...);
```

## Deployment Architecture

### MVP (Weeks 1-8)

```
GitHub ──→ Render (Backend)
      ──→ Vercel (Frontend)
           ↓
      Keep-Alive Cronjob (GitHub Actions)
           ↓
      All-Inkl MySQL (Database)
```

### Production (RUB)

```
GitHub ──→ RUB Docker (Backend + Frontend)
           ↓
      RUB PostgreSQL (Database)
      
(Render & Vercel can be retired)
```

## Performance Targets

| Metric | Target | How |
|--------|--------|-----|
| **Initial Load** | < 2 sec | CDN (Vercel), lazy loading |
| **Update Latency** | < 100 ms | WebSocket + Yjs |
| **DB Query** | < 50 ms | Indexed queries, connection pooling |
| **Concurrent Users** | 100+ | Socket.io rooms, horizontal scaling |

## Monitoring & Alerting (Future)

```javascript
// Add Sentry for error tracking
Sentry.captureException(error);

// Add Datadog/New Relic for performance
// Add Google Cloud Logging for audit trails
```

---

**Last updated:** 2025-02-12
