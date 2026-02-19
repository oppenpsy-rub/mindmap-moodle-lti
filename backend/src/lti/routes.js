import express from 'express';
import ltiHandler from './handler.js';

const router = express.Router();

// ─────────────────────────────────────────────
// Session Storage (In-Memory)
// TODO: Replace with Redis or database for production / multi-instance
// ─────────────────────────────────────────────

const sessions = new Map();

export function createSession(validation) {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  sessions.set(sessionId, {
    userId: validation.userId,
    name: validation.name,
    email: validation.email,
    courseId: validation.ltiClaims?.courseId || null,
    courseName: validation.ltiClaims?.courseName || null,
    role: validation.ltiClaims?.role || 'student',
    resourceLinkId: validation.ltiClaims?.resourceLinkId || null,
    deploymentId: validation.ltiClaims?.deploymentId || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return sessionId;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);

  if (session && session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session || null;
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

  req.session = session;
  req.sessionId = sessionId;
  next();
}

// ─────────────────────────────────────────────
// LTI 1.3 Endpoints
// ─────────────────────────────────────────────

/**
 * GET/POST /lti/login
 * Third-party Login Initiation (OIDC)
 * Moodle calls this first to start the launch flow
 */
router.get('/login', (req, res) => handleLogin(req, res));
router.post('/login', (req, res) => handleLogin(req, res));

function handleLogin(req, res) {
  try {
    const params = { ...req.query, ...req.body };

    console.log('🔓 LTI Login Initiation:', {
      iss: params.iss,
      login_hint: params.login_hint,
      target_link_uri: params.target_link_uri,
    });

    const redirectUrl = ltiHandler.handleLoginInitiation(params);

    console.log('↪  Redirecting to Moodle auth endpoint');
    res.redirect(303, redirectUrl);
  } catch (error) {
    console.error('❌ LTI Login error:', error.message);
    res.status(400).json({
      error: 'LTI login initiation failed',
      message: error.message,
    });
  }
}

/**
 * POST /lti/launch
 * Authentication Response (Resource Link Launch)
 * Moodle POSTs id_token + state here after user authenticates
 */
router.post('/launch', async (req, res) => {
  try {
    const { id_token, state } = req.body;

    if (!id_token) {
      return res.status(400).json({ error: 'Missing id_token in request' });
    }
    if (!state) {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    console.log('🚀 LTI Launch received');

    // Validate the JWT
    const validation = await ltiHandler.validateLaunch(id_token, state);

    if (!validation.isValid) {
      console.error('❌ LTI validation failed:', validation.error);
      return res.status(401).json({ error: validation.error });
    }

    console.log('✅ LTI Launch valid:', {
      user: validation.name,
      email: validation.email,
      course: validation.ltiClaims.courseName,
      role: validation.ltiClaims.role,
    });

    // Create session
    const sessionId = createSession(validation);

    // Set session cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Redirect to frontend with session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?session=${sessionId}`);
  } catch (error) {
    console.error('❌ LTI Launch error:', error.message);
    console.error(error.stack);

    // Show a user-friendly error page
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="de">
      <head><meta charset="utf-8"><title>LTI Launch Fehler</title>
      <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}
      .error{background:white;padding:40px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:500px;text-align:center}
      h1{color:#e53e3e;margin-bottom:12px}p{color:#666}code{background:#f0f0f0;padding:2px 8px;border-radius:4px;font-size:13px}</style></head>
      <body><div class="error">
        <h1>LTI Launch fehlgeschlagen</h1>
        <p>Die Verbindung zu Moodle konnte nicht hergestellt werden.</p>
        <p><code>${error.message}</code></p>
        <p style="margin-top:20px">Bitte gehen Sie zurück zu Moodle und versuchen Sie es erneut.</p>
      </div></body></html>
    `);
  }
});

/**
 * GET /lti/jwks
 * Tool's JWKS endpoint — Moodle fetches this during tool registration
 */
router.get('/jwks', (req, res) => {
  res.json(ltiHandler.getToolJWKS());
});

/**
 * GET /lti/config
 * Tool configuration endpoint (JSON) — for easy Moodle registration
 * Moodle admin can paste this URL to auto-configure the tool
 */
router.get('/config', (req, res) => {
  const toolUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  res.json({
    title: 'MoodBoard — Kollaboratives Board',
    description: 'MoodBoard: Kollaboratives Mindmap- und Whiteboard-Tool für Moodle',
    oidc_initiation_url: `${toolUrl}/lti/login`,
    target_link_uri: `${toolUrl}/lti/launch`,
    public_jwk_url: `${toolUrl}/lti/jwks`,
    extensions: [
      {
        platform: 'moodle',
        settings: {
          placements: [
            {
              placement: 'course_navigation',
              message_type: 'LtiResourceLinkRequest',
              target_link_uri: `${toolUrl}/lti/launch`,
            },
          ],
        },
      },
    ],
    custom_parameters: {},
    scopes: [
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    ],
    claims: ['sub', 'name', 'email', 'iss'],
  });
});

/**
 * GET /lti/info
 * Debug endpoint (dev only) — shows current LTI configuration
 */
router.get('/info', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const toolUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
  const platform = ltiHandler.getPlatformConfig();

  res.json({
    tool: {
      loginUrl: `${toolUrl}/lti/login`,
      launchUrl: `${toolUrl}/lti/launch`,
      jwksUrl: `${toolUrl}/lti/jwks`,
      configUrl: `${toolUrl}/lti/config`,
    },
    platform: {
      issuer: platform.issuer || '⚠️ NOT SET (LTI_PLATFORM_ISS)',
      clientId: platform.clientId || '⚠️ NOT SET (LTI_CLIENT_ID)',
      authEndpoint: platform.authEndpoint || '⚠️ NOT SET (LTI_AUTH_ENDPOINT)',
      tokenEndpoint: platform.tokenEndpoint || '⚠️ NOT SET (LTI_TOKEN_ENDPOINT)',
      jwksEndpoint: platform.jwksEndpoint || '⚠️ NOT SET (LTI_JWKS_ENDPOINT)',
    },
    activeSessions: sessions.size,
  });
});

export default router;
