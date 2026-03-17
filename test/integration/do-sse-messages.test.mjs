import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG } from '../config.mjs';

describe('🔌 Test SSE and Messages endpoints - Stage 1:', () => {

  describe('GET /sse endpoint - HTTP status codes', () => {
    it('Test 1.1.1: GET /sse returns 200 with valid API key (header)', async () => {
      // Arrange
      const sseUrl = `${TEST_CONFIG.SERVER_URL}/sse`;

      // Act
      const response = await fetch(sseUrl, {
        headers: {
          'x-api-key': TEST_CONFIG.API_KEY,
        },
      });

      // Assert
      assert.strictEqual(response.status, 200);
      assert.ok(response.ok);
      
      // Cleanup: Cancel the SSE stream to close the connection and prevent resource leaks
      // This triggers res.on('close') on the server side, cleaning up the session
      if (response.body) {
        try {
          await response.body.cancel();
          // Give the server a moment to process the close event
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch {
          // Ignore errors - connection may already be closed
        }
      }
    });

    it('Test 1.1.2: GET /sse returns 200 with valid API key (query)', async () => {
      // Arrange
      const sseUrl = `${TEST_CONFIG.SERVER_URL}/sse?api_key=${TEST_CONFIG.API_KEY}`;

      // Act
      const response = await fetch(sseUrl);

      // Assert
      assert.strictEqual(response.status, 200);
      assert.ok(response.ok);
      
      // Cleanup: Cancel the SSE stream to close the connection and prevent resource leaks
      // This triggers res.on('close') on the server side, cleaning up the session
      if (response.body) {
        try {
          await response.body.cancel();
          // Give the server a moment to process the close event
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch {
          // Ignore errors - connection may already be closed
        }
      }
    });

    it('Test 1.1.3: GET /sse returns 401 without API key', async () => {
      // Arrange
      const sseUrl = `${TEST_CONFIG.SERVER_URL}/sse`;

      // Act
      const response = await fetch(sseUrl);

      // Assert
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.ok, false);
    });
  });

  describe('POST /messages endpoint - HTTP status codes', () => {
    it('Test 1.2.1: POST /messages returns 400 without sessionId', async () => {
      // Arrange
      const messagesUrl = `${TEST_CONFIG.SERVER_URL}/messages`;
      const body = {};

      // Act
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Assert
      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.ok, false);
    });

    it('Test 1.2.2: POST /messages returns 400 with invalid sessionId', async () => {
      // Arrange
      const messagesUrl = `${TEST_CONFIG.SERVER_URL}/messages?sessionId=invalid-session-id`;
      const body = {};

      // Act
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Assert
      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.ok, false);
    });
  });
});
