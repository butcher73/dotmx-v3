/**
 * E2E Tests: Authentication Workflow
 * 
 * Real HTTP requests to actual running API server with test database
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, generateTestEmail, generateTestPassword, type TestServer } from './test-server';

describe('E2E: Authentication - Real Server', () => {
  let server: TestServer;
  let baseUrl: string;
  let testEmail: string;
  let testPassword: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('User Registration', () => {
    test('Register new user with valid credentials', async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(201);  // Registration returns 201
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
      expect(data.tokens).toBeDefined();
    });

    test('Reject duplicate email registration', async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect([400, 409, 422]).toContain(response.status);
    });

    test('Reject registration with invalid email', async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: testPassword,
        }),
      });

      expect([400, 422]).toContain(response.status);
    });

    test('Reject registration with weak password', async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: generateTestEmail(),
          password: 'weak',
        }),
      });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('User Login', () => {
    test('Login with valid credentials', async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.tokens).toBeDefined();
      expect(data.tokens.access_token).toBeDefined();
      expect(data.tokens.refresh_token).toBeDefined();
      
      // Store tokens for subsequent tests
      accessToken = data.tokens.access_token;
      refreshToken = data.tokens.refresh_token;
    });

    test('Reject login with wrong password', async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongP@ssword123!',
        }),
      });

      expect([400, 401, 403]).toContain(response.status);
    });

    test('Reject login with non-existent user', async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@test.local',
          password: testPassword,
        }),
      });

      expect([400, 401, 404]).toContain(response.status);
    });
  });

  describe('Protected Endpoints', () => {
    test('Access protected endpoint with valid token', async () => {
      // Always login fresh to ensure we have a valid token
      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      expect(loginResponse.status).toBe(200);
      
      const loginData = await loginResponse.json();
      const token = loginData.tokens?.access_token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Update module-level tokens
      accessToken = token;
      refreshToken = loginData.tokens?.refresh_token;

      const response = await fetch(`${baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
    });

    test('Reject protected endpoint without token', async () => {
      const response = await fetch(`${baseUrl}/auth/me`, {
        method: 'GET',
      });

      expect([401, 403]).toContain(response.status);
    });

    test('Reject protected endpoint with invalid token', async () => {
      const response = await fetch(`${baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Token Refresh', () => {
    test('Refresh token with valid refresh token', async () => {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tokens).toBeDefined();
      expect(data.tokens.access_token).toBeDefined();
      
      // Update access token
      accessToken = data.tokens.access_token;
    });

    test('Reject refresh with invalid refresh token', async () => {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: 'invalid-refresh-token',
        }),
      });

      expect([400, 401]).toContain(response.status);
    });
  });

  describe('Logout', () => {
    test('Logout with valid refresh token', async () => {
      const response = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(response.status).toBe(200);
    });
  });
});
