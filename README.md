# 🧠 MindMap & Whiteboard Collaboration Tool for Moodle (LTI)

A modern, real-time collaborative MindMap and Whiteboard editor integrated with Moodle via LTI 1.3. Built with React, Node.js, Yjs CRDT, and WebSockets for seamless collaboration without requiring separate login.

## ✨ Features

- **🔐 LTI 1.3 Integration**: Secure OAuth2-based authentication with automatic Moodle login (no double-login)
- **🧠 MindMap Editor**: Create and edit hierarchical mind maps in real-time
- **🎨 Whiteboard**: Draw, sketch, and annotate with shapes, text, and freehand drawing
- **👥 Real-time Collaboration**: Multiple users editing simultaneously with conflict-free CRDT (Yjs)
- **👤 User Awareness**: See who's online, their cursor positions, and recent activities
- **💾 Persistent Storage**: Save projects to All-Inkl MySQL with automatic snapshots
- **📤 Export Options**: Download projects as PNG, PDF, JSON, or SVG
- **🌐 No Sleep**: Keep-Alive GitHub Actions Cronjob ensures Render backend stays active
- **🚀 Scalable Architecture**: Easy migration from Render to RUB-owned servers

## 🛠️ Tech Stack

| Component | Technology | Why? |
|-----------|-----------|------|
| **Frontend** | React 18 + Vite | Modern, fast, great dev experience |
| **Backend** | Node.js + Express | Perfect for WebSocket, LTI libraries available |
| **Real-time Sync** | Yjs CRDT + Socket.io | Fastest CRDT implementation, handles conflicts automatically |
| **Database** | MySQL/MariaDB (All-Inkl) | You have existing access, easy to migrate later |
| **Hosting (MVP)** | Vercel (Frontend) + Render (Backend) | Kostenlos, mit Keep-Alive bleibt Render aktiv |
| **LTI Standard** | LTI 1.3 with OAuth2 | Current standard, secure, Moodle-native support |

## 📋 Prerequisites

- Node.js >= 18
- Docker & Docker Compose (for local development)
- All-Inkl MySQL credentials
- Moodle 4.0+ with LTI Admin access

## 🚀 Quick Start (Local Development)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/mindmap-moodle-lti.git
cd mindmap-moodle-lti
```

### 2. Setup Environment Variables

**Backend:**
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your All-Inkl MySQL credentials
```

**Frontend:**
```bash
cp frontend/.env.example frontend/.env
```

### 3. Local Setup with Docker Compose

```bash
# Start all services (Backend, Frontend, MySQL)
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f backend
```

Services will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- MySQL: localhost:3306
- Health Check: http://localhost:3001/health

### 4. Manual Setup (without Docker)

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend (in another terminal):**
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### LTI 1.3 Registration in Moodle

1. Go to **Moodle Admin → Plugins → LTI Tool**
2. Register External Tool:
   - **Tool Name**: MindMap Collaboration Tool
   - **Tool URL**: `https://your-render-app.render.com/lti/launch`
   - **Client ID**: (You'll get this from registration)
   - **Client Secret**: (You'll get this from registration)
   - **OIDC Discovery URL**: `https://your-render-app.render.com/.well-known/openid-configuration`
3. Save and use the generated Client ID & Secret in your `.env`

### GitHub Actions Keep-Alive

To prevent Render from sleeping:

1. Go to **GitHub Repository Settings → Secrets and Variables → Actions**
2. Add Secret: `RENDER_APP_URL` = `your-app.render.com`
3. Workflow will run every 10 minutes to keep backend alive ✅

## 📝 Project Structure

```
.
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── lti/            # LTI 1.3 authentication
│   │   ├── api/            # REST API endpoints
│   │   ├── websocket/      # Socket.io & Yjs
│   │   └── db/             # Database models
│   ├── server.js           # Entry point
│   ├── package.json
│   └── Dockerfile
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── pages/         # App pages
│   │   ├── components/    # React components
│   │   └── hooks/         # Custom hooks (Yjs, WebSocket)
│   ├── index.html
│   ├── vite.config.js
│   └── Dockerfile
├── .github/
│   └── workflows/
│       ├── keep-render-alive.yml  # GitHub Actions Cronjob
│       └── test-deploy.yml        # Auto-test on push
├── docs/                  # Documentation
├── docker-compose.yml     # Local dev & production setup
└── README.md
```

## 🧪 Testing

**Backend:**
```bash
cd backend
npm test
```

**Frontend:**
```bash
cd frontend
npm test
```

**E2E:** Open frontend in 2 browser tabs → edit simultaneously → verify sync

## 📦 Deployment

### To Render (MVP Phase)

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

Quick summary:
1. Push code to GitHub
2. Connect GitHub repo to Render
3. Set environment variables in Render dashboard
4. Deploy automatically on `git push`

### To RUB Servers (Production)

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker-Compose migration guide.

Quick summary:
```bash
# On RUB server
git clone <repo>
cd mindmap-moodle-lti
docker-compose up -d
```

## 🔒 Security Considerations

- **LTI 1.3 OAuth2**: No plain passwords, automatically manages auth
- **HTTPS/TLS**: Required for production (Vercel & Render provide automatic SSL)
- **CORS**: Configured to only allow specified frontend domains
- **Rate Limiting**: API rate limits (100 req/15min per IP)
- **GDPR**: All user data stays in EU (All-Inkl + Render EU servers)
- **Session Management**: Automatic timeout after 24 hours
- **.env**: Never commit secrets, use `.env.example` as template

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Backend not connecting to MySQL** | Check DB credentials in `.env`, verify All-Inkl DB is accessible |
| **Render keeps sleeping** | GitHub Actions Keep-Alive needs to be enabled (see GitHub Secrets) |
| **WebSocket connection fails** | Check CORS settings in `backend/server.js`, ensure frontend URL is whitelisted |
| **Real-time sync not working** | Verify Socket.io is connected, check browser console for errors |

## 📚 Documentation

- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment to Render & RUB
- [GDPR-COMPLIANCE.md](docs/GDPR-COMPLIANCE.md) - Data protection & privacy
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design & decisions
- [LTI-SETUP.md](docs/LTI-SETUP.md) - Detailed LTI 1.3 configuration

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT License - See LICENSE file

## 📧 Support

For bugs, feature requests, or deployment help:
- Open an issue on GitHub
- Check existing docs in `/docs`
- Contact: [your-email@example.com](mailto:your-email@example.com)

---

**Made with ❤️ for collaborative learning at German Universities**
