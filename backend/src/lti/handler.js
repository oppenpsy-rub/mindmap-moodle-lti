import * as jose from 'jose';
import crypto from 'crypto';

/**
 * LTI 1.3 Handler
 * 
 * Implements the full OIDC / LTI 1.3 launch flow:
 * 
 * 1. Moodle → GET/POST /lti/login  (Third-party Login Initiation)
 *    Tool generates state+nonce, redirects to Moodle's auth endpoint
 * 
 * 2. Moodle → POST /lti/launch  (Authentication Response)
 *    Tool verifies state, fetches Moodle's JWKS, verifies JWT,
 *    extracts user + course context, creates session, redirects to frontend
 */

class LTIHandler {
  constructor() {
    // Cache for platform JWKS
    this.jwksCache = new Map();
    this.jwksCacheExpiry = 3600000; // 1 hour

    // Pending OIDC states (state → { nonce, timestamp })
    // In production: use Redis or DB for multi-instance
    this.pendingStates = new Map();

    // Tool's own RSA key pair (loaded from env or generated)
    this.toolKeyPair = null;
    this.toolJWKS = null;
  }

  /**
   * Initialize tool's RSA key pair
   * Used for signing service requests (AGS, NRPS) to Moodle
   */
  async initializeKeys() {
    const privateKeyPem = process.env.TOOL_PRIVATE_KEY;
    const publicKeyPem = process.env.TOOL_PUBLIC_KEY;

    if (privateKeyPem && publicKeyPem) {
      try {
        const privateKey = await jose.importPKCS8(
          privateKeyPem.replace(/\\n/g, '\n'),
          'RS256'
        );
        const publicKey = await jose.importSPKI(
          publicKeyPem.replace(/\\n/g, '\n'),
          'RS256'
        );

        this.toolKeyPair = { privateKey, publicKey };

        // Export public key as JWK for JWKS endpoint
        const jwk = await jose.exportJWK(publicKey);
        jwk.kid = process.env.TOOL_KEY_ID || 'tool-key-1';
        jwk.alg = 'RS256';
        jwk.use = 'sig';
        this.toolJWKS = { keys: [jwk] };

        console.log('🔑 Tool RSA key pair loaded');
      } catch (err) {
        console.warn('⚠️  Could not load tool RSA keys:', err.message);
        console.log('   Run: node src/lti/generate-keys.js');
        this.toolJWKS = { keys: [] };
      }
    } else {
      console.log('ℹ️  No TOOL_PRIVATE_KEY/TOOL_PUBLIC_KEY in .env');
      console.log('   LTI launch will work, but LTI services (grades, roster) won\'t.');
      console.log('   Run: node src/lti/generate-keys.js');
      this.toolJWKS = { keys: [] };
    }
  }

  /**
   * Get registered platform (Moodle) config from environment
   */
  getPlatformConfig() {
    return {
      issuer: process.env.LTI_PLATFORM_ISS,           // e.g. https://moodle.example.com
      clientId: process.env.LTI_CLIENT_ID,             // from Moodle tool registration
      authEndpoint: process.env.LTI_AUTH_ENDPOINT,     // e.g. https://moodle.example.com/mod/lti/auth.php
      tokenEndpoint: process.env.LTI_TOKEN_ENDPOINT,   // e.g. https://moodle.example.com/mod/lti/token.php
      jwksEndpoint: process.env.LTI_JWKS_ENDPOINT,     // e.g. https://moodle.example.com/mod/lti/certs.php
    };
  }

  // ─────────────────────────────────────────────
  // Step 1: OIDC Login Initiation
  // ─────────────────────────────────────────────

  /**
   * Handle third-party login initiation from Moodle
   * Moodle sends: iss, login_hint, target_link_uri, lti_message_hint, client_id
   * Tool must redirect back to Moodle's auth endpoint
   */
  handleLoginInitiation(params) {
    const platform = this.getPlatformConfig();

    const { iss, login_hint, target_link_uri, lti_message_hint, client_id } = params;

    // Validate issuer matches configured platform
    if (platform.issuer && iss && iss !== platform.issuer) {
      throw new Error(`Unknown platform issuer: ${iss}`);
    }

    // Generate state and nonce
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Store for verification in step 2 (expires in 10 minutes)
    this.pendingStates.set(state, {
      nonce,
      timestamp: Date.now(),
      targetLinkUri: target_link_uri,
    });

    // Cleanup old states (older than 10 min)
    this._cleanupOldStates();

    // Build redirect URL to Moodle's authorization endpoint
    const authUrl = new URL(platform.authEndpoint);
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('response_mode', 'form_post');
    authUrl.searchParams.set('prompt', 'none');
    authUrl.searchParams.set('client_id', client_id || platform.clientId);
    authUrl.searchParams.set('redirect_uri', target_link_uri);
    authUrl.searchParams.set('login_hint', login_hint);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    if (lti_message_hint) {
      authUrl.searchParams.set('lti_message_hint', lti_message_hint);
    }

    return authUrl.toString();
  }

  // ─────────────────────────────────────────────
  // Step 2: Validate Launch (Authentication Response)
  // ─────────────────────────────────────────────

  /**
   * Validate the LTI 1.3 launch JWT
   * Moodle POSTs: id_token (JWT), state
   */
  async validateLaunch(idToken, state) {
    const platform = this.getPlatformConfig();

    // 1. Verify state
    const pending = this.pendingStates.get(state);
    if (!pending) {
      throw new Error('Invalid or expired state parameter');
    }
    this.pendingStates.delete(state);

    // Check state age (max 10 minutes)
    if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
      throw new Error('Login request expired (>10 min)');
    }

    // 2. Fetch Moodle's JWKS (public keys)
    const jwksUrl = platform.jwksEndpoint;
    const JWKS = await this._getJWKS(jwksUrl);

    // 3. Verify JWT signature, expiration, issuer, audience
    const { payload } = await jose.jwtVerify(idToken, JWKS, {
      issuer: platform.issuer,
      audience: platform.clientId,
      clockTolerance: 30, // 30 seconds tolerance
    });

    // 4. Verify nonce
    if (payload.nonce !== pending.nonce) {
      throw new Error('Nonce mismatch');
    }

    // 5. Verify LTI message type
    const messageType = payload['https://purl.imsglobal.org/spec/lti/claim/message_type'];
    if (messageType !== 'LtiResourceLinkRequest' && messageType !== 'LtiDeepLinkingRequest') {
      throw new Error(`Unsupported LTI message type: ${messageType}`);
    }

    // 6. Verify LTI version
    const version = payload['https://purl.imsglobal.org/spec/lti/claim/version'];
    if (version !== '1.3.0') {
      console.warn(`Warning: LTI version is ${version}, expected 1.3.0`);
    }

    // 7. Extract user and context info
    const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'] || {};
    const roles = payload['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
    const resourceLink = payload['https://purl.imsglobal.org/spec/lti/claim/resource_link'] || {};
    const toolPlatform = payload['https://purl.imsglobal.org/spec/lti/claim/tool_platform'] || {};

    // Determine simplified role
    let role = 'student';
    const roleUrns = roles.map(r => r.toLowerCase());
    if (roleUrns.some(r => r.includes('administrator'))) role = 'admin';
    else if (roleUrns.some(r => r.includes('instructor') || r.includes('teachingassistant'))) role = 'instructor';

    return {
      isValid: true,
      userId: payload.sub,
      name: payload.name || payload.given_name || 'User',
      email: payload.email || '',
      ltiClaims: {
        courseId: context.id || null,
        courseName: context.label || context.title || null,
        role,
        roles, // full role URN array
        platformId: toolPlatform.guid || null,
        resourceLinkId: resourceLink.id || null,
        resourceLinkTitle: resourceLink.title || null,
        deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] || null,
      },
      services: {
        nrps: payload['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'] || null,
        ags: payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'] || null,
      },
      rawPayload: payload,
    };
  }

  // ─────────────────────────────────────────────
  // JWKS Management
  // ─────────────────────────────────────────────

  /**
   * Get remote JWKS with caching
   */
  async _getJWKS(jwksUrl) {
    const cached = this.jwksCache.get(jwksUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.jwks;
    }

    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    this.jwksCache.set(jwksUrl, {
      jwks,
      expiresAt: Date.now() + this.jwksCacheExpiry,
    });
    return jwks;
  }

  /**
   * Get tool's own JWKS (for /jwks.json endpoint)
   */
  getToolJWKS() {
    return this.toolJWKS || { keys: [] };
  }

  // ─────────────────────────────────────────────
  // LTI Services (optional: Grades, Roster)
  // ─────────────────────────────────────────────

  /**
   * Get an OAuth2 access token from Moodle for service calls
   * Uses client_credentials grant with JWT assertion
   */
  async getServiceToken(scopes) {
    if (!this.toolKeyPair) {
      throw new Error('Tool key pair not configured - cannot request service tokens');
    }

    const platform = this.getPlatformConfig();

    // Create JWT assertion
    const assertion = await new jose.SignJWT({})
      .setProtectedHeader({
        alg: 'RS256',
        kid: process.env.TOOL_KEY_ID || 'tool-key-1',
      })
      .setIssuer(platform.clientId)
      .setSubject(platform.clientId)
      .setAudience(platform.tokenEndpoint)
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti(crypto.randomUUID())
      .sign(this.toolKeyPair.privateKey);

    // Request access token
    const response = await fetch(platform.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: assertion,
        scope: Array.isArray(scopes) ? scopes.join(' ') : scopes,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token request failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  _cleanupOldStates() {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    for (const [state, data] of this.pendingStates) {
      if (data.timestamp < tenMinAgo) {
        this.pendingStates.delete(state);
      }
    }
  }
}

export default new LTIHandler();
