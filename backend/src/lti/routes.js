import express from 'express';
import ltiHandler from './handler.js';

const router = express.Router();

/**
 * GET /.well-known/openid-configuration
 * OIDC Discovery endpoint for Moodle
 */
router.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = process.env.API_URL || 'http://localhost:3001';
  const discovery = ltiHandler.generateDiscoveryDocument(baseUrl);
  res.json(discovery);
});

/**
 * POST /lti/launch
 * Main LTI 1.3 Launch endpoint
 * Receives JWT from Moodle via form_post
 */
router.post('/launch', async (req, res) => {
  try {
    const idToken = req.body.id_token;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing id_token in request' });
    }

    // Validate LTI launch
    const validation = await ltiHandler.validateLaunch(
      idToken,
      process.env.MOODLE_CLIENT_ID,
      process.env.MOODLE_CLIENT_SECRET
    );

    if (!validation.isValid) {
      console.error('LTI validation failed:', validation.error);
      return res.status(401).json({ error: validation.error });
    }

    // Create session
    const sessionId = createSession(validation);

    // Set secure session cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Redirect to frontend dashboard
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard?session=${sessionId}`);
  } catch (error) {
    console.error('LTI Launch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /lti/auth
 * OIDC Authorization endpoint
 * This is called by Moodle to initiate the OIDC flow
 */
router.get('/auth', (req, res) => {
  try {
    const { login_hint, client_id, response_type, scope, response_mode } = req.query;

    // In LTI 1.3, Moodle expects to be redirected back to complete the flow
    // This is a simplified implementation
    // In production, you'd implement full OIDC AuthCode flow

    res.status(400).json({
      error: 'This endpoint requires full OIDC implementation',
      note: 'Use form_post response_mode for LTI 1.3 launches',
    });
  } catch (error) {
    console.error('OIDC Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /lti/token
 * OIDC Token endpoint
 * Called by Moodle to exchange auth code for token
 */
router.post('/token', (req, res) => {
  try {
    const { grant_type, code, client_id, client_secret } = req.body;

    // Simplified implementation
    // In production, implement full token exchange

    res.status(400).json({
      error: 'Token endpoint not fully implemented',
    });
  } catch (error) {
    console.error('Token endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /.well-known/jwks.json
 * JWKS endpoint - returns public keys for this tool
 * (Moodle can verify tokens signed by us)
 */
router.get('/.well-known/jwks.json', (req, res) => {
  // Simplified: return empty for now
  // In production, return tool's public keys if you sign tokens
  const emptyJWKS = {
    keys: [],
  };

  res.json(emptyJWKS);
});

/**
 * Session Storage (In-Memory)
 * TODO: Replace with Redis or database later
 */
const sessions = new Map();

function createSession(validation) {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  sessions.set(sessionId, {
    userId: validation.userId,
    name: validation.name,
    email: validation.email,
    courseId: validation.ltiClaims.courseId,
    courseName: validation.ltiClaims.courseName,
    role: validation.ltiClaims.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return sessionId;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);

  // Check expiration
  if (session && session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Middleware: Verify LTI Session
 */
export function requireLTISession(req, res, next) {
  const sessionId = req.cookies?.session_id || req.query?.session;

  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Attach session to request
  req.session = session;
  req.sessionId = sessionId;

  next();
}

export default router;
