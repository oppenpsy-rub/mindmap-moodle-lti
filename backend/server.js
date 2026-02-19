import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

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

app.use(helmet({ crossOriginResourcePolicy: false, crossOriginOpenerPolicy: false }));
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

// Development-only: Create mock LTI session for testing
if (NODE_ENV === 'development') {
  app.post('/dev/mock-session', (req, res) => {
    try {
      // Create a mock user validation object
      const mockValidation = {
        userId: `dev_user_${Date.now()}`,
        name: 'Test Developer',
        email: 'dev@example.com',
        ltiClaims: {
          courseId: 'course_001',
          courseName: 'Development Course',
          role: 'Instructor',
        },
      };

      // Create session using the exported function
      const sessionId = createSession(mockValidation);
      
      // Set session cookie with explicit path and domain
      res.cookie('session_id', sessionId, {
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      console.log('✅ Mock session created:', sessionId);
      console.log('   User:', mockValidation.userId);
      
      res.json({
        success: true,
        sessionId,
        user: {
          userId: mockValidation.userId,
          name: mockValidation.name,
          email: mockValidation.email,
        },
        message: '✅ Mock session created! You can now use the API.',
        note: 'Session cookie is set in your browser automatically.',
      });
    } catch (error) {
      console.error('Mock session error:', error);
      res.status(500).json({ error: 'Failed to create mock session' });
    }
  });

  app.get('/dev/mock-session', (req, res) => {
    res.json({
      endpoint: 'POST /dev/mock-session',
      description: 'Creates a mock LTI session for development testing',
      usage: 'Call this endpoint before accessing /api/* endpoints',
      curl: 'curl -X POST http://localhost:3001/dev/mock-session -c cookies.txt',
      then: 'Reload your browser - the dashboard will now work!',
    });
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
