import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import custom modules
import ltiRoutes, { createSession } from './src/lti/routes.js';
import ltiHandler from './src/lti/handler.js';
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

app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  // Allow iframe embedding (required for LTI tools in Moodle)
  frameguard: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      frameSrc: ["'self'"],
      frameAncestors: ['*'],  // Allow Moodle to embed us
    },
  },
}));
app.use(cors({
  origin: function (origin, callback) {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
    // Allow requests with no origin (mobile apps, curl, same-origin proxy)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // In dev, allow all origins
    }
  },
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

// JWKS endpoint (tool's public keys)
app.get('/.well-known/jwks.json', (req, res) => {
  res.json(ltiHandler.getToolJWKS());
});

// LTI routes (login, launch, jwks, config, info)
app.use('/lti', ltiRoutes);

// ============================================================
// DEVELOPMENT ENDPOINTS (Development Mode Only)
// ============================================================

// Demo/Dev mode: Create mock LTI session for testing
// Active in development OR when DEMO_MODE=true in production
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (NODE_ENV === 'development' || DEMO_MODE) {
  if (DEMO_MODE) console.log('🎭 DEMO MODE active — mock sessions available without Moodle');

  app.post('/dev/mock-session', (req, res) => {
    try {
      const mockValidation = {
        userId: `demo_user_${Date.now()}`,
        name: DEMO_MODE ? 'Demo User' : 'Test Developer',
        email: 'demo@example.com',
        ltiClaims: {
          courseId: 'course_001',
          courseName: DEMO_MODE ? 'Demo Course' : 'Development Course',
          role: 'Instructor',
        },
      };

      const sessionId = createSession(mockValidation);

      res.cookie('session_id', sessionId, {
        path: '/',
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: NODE_ENV === 'production' ? 'None' : 'Lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      console.log('✅ Mock session created:', sessionId);

      res.json({
        success: true,
        sessionId,
        user: {
          userId: mockValidation.userId,
          name: mockValidation.name,
          email: mockValidation.email,
        },
      });
    } catch (error) {
      console.error('Mock session error:', error);
      res.status(500).json({ error: 'Failed to create mock session' });
    }
  });

  // Info endpoint for demo status
  app.get('/dev/status', (req, res) => {
    res.json({ demoMode: true });
  });
}


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

// ============================================================
// STATIC FRONTEND (Production)
// ============================================================

if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// 404 handler (only in dev, production uses SPA fallback)
if (NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });
}

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
    // Initialize LTI key pair
    await ltiHandler.initializeKeys();

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
      console.log('║        MoodBoard — Backend              ║');
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

// Prevent crashes from unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason);
  // Don't exit - keep running
});

process.on('uncaughtException', (error) => {
  console.error('⚠️  Uncaught Exception:', error.message);
  console.error(error.stack);
  // Don't exit for recoverable errors
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ETIMEDOUT') {
    console.log('↪  Recoverable error, continuing...');
  } else {
    console.error('❌ Fatal error, shutting down...');
    process.exit(1);
  }
});

// Start the server
startup();
