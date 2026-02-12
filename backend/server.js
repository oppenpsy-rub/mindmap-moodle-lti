import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import custom modules
import ltiRoutes from './src/lti/routes.js';
import projectsApi from './src/api/projects.js';
import yjsServer from './src/websocket/yjs-server.js';
import { testConnection, syncDatabase } from './src/db/connection.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', apiLimiter);

// ============================================================
// HEALTH CHECK (for Render Keep-Alive)
// ============================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// ============================================================
// LTI 1.3 ROUTES
// ============================================================

// OIDC Discovery
app.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = process.env.API_URL || `http://localhost:${PORT}`;
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/lti/auth`,
    token_endpoint: `${baseUrl}/lti/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['id_token'],
    response_modes_supported: ['form_post'],
  });
});

// JWKS endpoint (empty for now, tool doesn't sign tokens)
app.get('/.well-known/jwks.json', (req, res) => {
  res.json({ keys: [] });
});

// LTI routes
app.use('/lti', ltiRoutes);

// ============================================================
// REST API ROUTES
// ============================================================

app.use('/api', projectsApi);

// TEST ENDPOINT
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is running!',
    environment: NODE_ENV,
    database: 'Connected',
  });
});

// ============================================================
// WEBSOCKET: YJS COLLABORATION
// ============================================================

yjsServer.initializeWebSocket(io);
yjsServer.cleanupUnusedDocuments(io);

// ============================================================
// ERROR HANDLERS
// ============================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ============================================================
// STARTUP SEQUENCE
// ============================================================

async function startup() {
  try {
    // Test database connection
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.warn('⚠️  Database connection failed. Running in limited mode (API endpoints will fail).');
      
      // In development, continue without database
      if (NODE_ENV !== 'production') {
        console.log('💡 Tip: Add All-Inkl MySQL credentials to .env to enable database features');
      } else {
        console.error('❌ Database required in production. Exiting.');
        process.exit(1);
      }
    } else {
      // Sync database schema only if connected
      await syncDatabase();
    }

    // Start HTTP/WebSocket server
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════╗');
      console.log('║   MindMap Moodle LTI Tool Backend      ║');
      console.log('╚════════════════════════════════════════╝');
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
      if (dbConnected) {
        console.log(`🗄️  Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
      }
      console.log(`🔒 Environment: ${NODE_ENV}`);
      console.log('');
      console.log('Available endpoints:');
      console.log('  GET  /health                 - Health check');
      console.log('  GET  /.well-known/openid-configuration - OIDC Discovery');
      console.log('  POST /lti/launch             - LTI 1.3 Launch');
      console.log('  GET  /api/projects           - List projects');
      console.log('  POST /api/projects           - Create project');
      console.log('  GET  /api/projects/:id       - Get project');
      console.log('  PUT  /api/projects/:id       - Update project');
      console.log('  DELETE /api/projects/:id     - Delete project');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Startup error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start the server
startup();
