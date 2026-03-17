/**
 * Refresh Endpoint Tests
 * 
 * NOTE: Database population happens in global-setup.mjs before tests run.
 * This test only verifies the endpoint behavior (response codes, API key auth).
 * 
 * IMPORTANT: API key tests use empty body (no token) to avoid triggering actual
 * database refresh, which would cause race conditions with concurrent tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { makeApiRequest } from '../config.mjs';

describe('🔄 Test refresh endpoint:', () => {
  // Note: Database is already populated in global-setup.mjs

  it('Refresh endpoint returns 400 when token is missing', async () => {
    // Act
    const response = await makeApiRequest({
      endpointPath: '/api/v1/refresh',
      method: 'POST',
      body: {},
    });

    // Assert
    assert.strictEqual(response.status, 400);
    const data = await response.json();
    assert.strictEqual(data.error, 'Missing token');
  });

  describe('API Key authentication', () => {
    // These tests use empty body to avoid triggering actual refresh
    // We verify API key is checked BEFORE token validation

    it('should reject request without API key for /refresh endpoint', async () => {
      // Act
      const response = await makeApiRequest({
        endpointPath: '/api/v1/refresh',
        method: 'POST',
        body: {},
        includeApiKey: false,
      });

      // Assert - should get 401 (unauthorized) before checking token
      assert.strictEqual(response.status, 401);
      const data = await response.json();
      assert.deepStrictEqual(data, { error: 'Unauthorized' });
    });

    it('should reject request with invalid API key for /refresh endpoint', async () => {
      // Act
      const response = await makeApiRequest({
        endpointPath: '/api/v1/refresh',
        method: 'POST',
        body: {},
        headers: { 'X-API-Key': 'invalid-api-key' },
        includeApiKey: false,
      });

      // Assert - should get 401 (unauthorized) before checking token
      assert.strictEqual(response.status, 401);
      const data = await response.json();
      assert.deepStrictEqual(data, { error: 'Unauthorized' });
    });

    it('should accept valid API key in header for /refresh endpoint (returns 400 for missing token)', async () => {
      // Act - valid API key but no token
      const response = await makeApiRequest({
        endpointPath: '/api/v1/refresh',
        method: 'POST',
        body: {},
        includeApiKey: true,
        apiKeyInQuery: false,
      });

      // Assert - should pass API key check and get 400 for missing token
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.strictEqual(data.error, 'Missing token');
    });

    it('should accept valid API key in query parameter for /refresh endpoint (returns 400 for missing token)', async () => {
      // Act - valid API key in query but no token
      const response = await makeApiRequest({
        endpointPath: '/api/v1/refresh',
        method: 'POST',
        body: {},
        includeApiKey: true,
        apiKeyInQuery: true,
      });

      // Assert - should pass API key check and get 400 for missing token
      assert.strictEqual(response.status, 400);
      const data = await response.json();
      assert.strictEqual(data.error, 'Missing token');
    });
  });
});
