import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { sequelize } from '../src/db/connection.js';
import ltiHandler from '../src/lti/handler.js';

describe('LTI Handler', () => {
  it('should generate OIDC discovery document', () => {
    const doc = ltiHandler.generateDiscoveryDocument('http://localhost:3001');

    expect(doc).toHaveProperty('issuer');
    expect(doc).toHaveProperty('authorization_endpoint');
    expect(doc).toHaveProperty('token_endpoint');
    expect(doc).toHaveProperty('jwks_uri');
  });

  it('should reject invalid JWT', async () => {
    const result = await ltiHandler.validateLaunch(
      'invalid.jwt.token',
      'test_client_id',
      'test_secret'
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('API Endpoints', () => {
  beforeAll(async () => {
    // Setup test database
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.drop();
    await sequelize.close();
  });

  describe('Health Check', () => {
    it('GET /health should return OK', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'OK');
    });
  });

  describe('OIDC Discovery', () => {
    it('GET /.well-known/openid-configuration should return discovery doc', async () => {
      const res = await request(app).get('/.well-known/openid-configuration');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('issuer');
      expect(res.body).toHaveProperty('token_endpoint');
    });

    it('GET /.well-known/jwks.json should return keys', async () => {
      const res = await request(app).get('/.well-known/jwks.json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('keys');
    });
  });

  describe('API Errors', () => {
    it('GET /nonexistent should return 404', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('POST /api/projects without session should return 401', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project' });

      expect(res.status).toBe(401);
    });
  });
});

describe('Database', () => {
  it('should connect to database', async () => {
    try {
      await sequelize.authenticate();
      expect(true).toBe(true); // Connection successful
    } catch (error) {
      expect(error).toBeNull(); // Fail if error
    }
  });
});
