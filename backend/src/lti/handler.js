import jwt from 'jsonwebtoken';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

/**
 * LTI 1.3 Handler for OAuth2/OIDC Authentication
 * 
 * Flow:
 * 1. Moodle sends JWT signed with its private key
 * 2. We fetch Moodle's public key from OIDC endpoint
 * 3. We verify JWT signature
 * 4. Extract user context and create session
 */

class LTIHandler {
  constructor() {
    this.publicKeyCache = new Map(); // Cache Moodle's public keys
    this.cacheExpiry = 3600000; // 1 hour
  }

  /**
   * Fetch Moodle's public keys from OIDC endpoint
   */
  async fetchPublicKeys(issuer) {
    const cacheKey = `${issuer}_keys`;
    const cached = this.publicKeyCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    try {
      // OIDC discovery endpoint
      const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
      const discovery = await axios.get(discoveryUrl, { timeout: 5000 });
      const jwksUrl = discovery.data.jwks_uri;

      // Fetch JWKS (JSON Web Key Set)
      const jwksResponse = await axios.get(jwksUrl, { timeout: 5000 });
      const keys = jwksResponse.data.keys;

      // Cache for 1 hour
      this.publicKeyCache.set(cacheKey, {
        keys,
        expiresAt: Date.now() + this.cacheExpiry,
      });

      return keys;
    } catch (error) {
      console.error('Error fetching public keys from Moodle:', error.message);
      throw new Error('Failed to fetch Moodle public keys');
    }
  }

  /**
   * Find the correct public key by kid (key ID)
   */
  findPublicKeyByKid(keys, kid) {
    return keys.find((key) => key.kid === kid);
  }

  /**
   * Main: Validate LTI 1.3 Launch Request
   * Input: JWT id_token from Moodle
   * Output: User context object if valid
   */
  async validateLaunch(idToken, clientId, clientSecret) {
    try {
      // Decode without verification first to get the header
      const decoded = jwt.decode(idToken, { complete: true });

      if (!decoded) {
        throw new Error('Invalid JWT format');
      }

      const { kid, alg } = decoded.header;
      const { iss, exp, iat, sub, name, email } = decoded.payload;

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (exp && exp < now) {
        throw new Error('Token has expired');
      }

      // Fetch Moodle's public keys
      const publicKeys = await this.fetchPublicKeys(iss);
      const publicKey = this.findPublicKeyByKid(publicKeys, kid);

      if (!publicKey) {
        throw new Error(`Public key with kid ${kid} not found`);
      }

      // Convert JWK to PEM format
      const pem = this.jwkToPem(publicKey);

      // Verify signature using Moodle's public key
      const verified = jwt.verify(idToken, pem, {
        algorithms: [alg],
        issuer: iss,
      });

      // Extract additional LTI claims
      const ltiClaims = this.extractLTIClaims(decoded.payload);

      return {
        userId: sub,
        name: name || 'Unknown User',
        email: email || '',
        issuer: iss,
        ltiClaims,
        rawPayload: decoded.payload,
        isValid: true,
      };
    } catch (error) {
      console.error('LTI Launch validation error:', error.message);
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract LTI-specific claims from JWT payload
   */
  extractLTIClaims(payload) {
    return {
      courseId: payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id || null,
      courseName: payload['https://purl.imsglobal.org/spec/lti/claim/context']?.label || null,
      role: payload['https://purl.imsglobal.org/spec/lti/claim/roles']?.[0] || 'user',
      platformId: payload['https://purl.imsglobal.org/spec/lti/claim/tool_platform']?.guid || null,
      resourceLinkId: payload['https://purl.imsglobal.org/spec/lti/claim/resource_link']?.id || null,
      deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] || null,
      nrpsServiceUrl: payload['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice_url'] || null,
      agsServiceUrl: payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.url || null,
    };
  }

  /**
   * Convert JWK (JSON Web Key) to PEM format
   * Simplified: Uses the 'x5c' field from JWK if available
   */
  jwkToPem(jwk) {
    if (jwk.x5c && jwk.x5c.length > 0) {
      // x5c contains X.509 certificate chain
      const cert = jwk.x5c[0];
      return `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----`;
    }

    throw new Error('JWK to PEM conversion failed: x5c not found');
  }

  /**
   * Generate OIDC Discovery Document for this tool
   * (Moodle will fetch this to register the tool)
   */
  generateDiscoveryDocument(toolUrl) {
    return {
      issuer: toolUrl,
      authorization_endpoint: `${toolUrl}/lti/auth`,
      token_endpoint: `${toolUrl}/lti/token`,
      jwks_uri: `${toolUrl}/.well-known/jwks.json`,
      response_types_supported: ['id_token'],
      response_modes_supported: ['form_post'],
      grant_types_supported: ['client_credentials'],
      token_endpoint_auth_methods_supported: ['private_key_jwt'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      claims_supported: [
        'iss',
        'sub',
        'aud',
        'exp',
        'iat',
        'name',
        'email',
      ],
    };
  }
}

export default new LTIHandler();
