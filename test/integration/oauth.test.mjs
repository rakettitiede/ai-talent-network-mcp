import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG } from '../config.mjs';

const { SERVER_URL } = TEST_CONFIG;

describe('🔐 OAuth Proxy Endpoints', () => {
  describe('GET /oauth/authorize', () => {
    it('redirects to Google with correct parameters', async () => {
      const response = await fetch(
        `${SERVER_URL}/oauth/authorize?redirect_uri=http://example.com/callback&state=test123`,
        { redirect: 'manual' }
      );

      assert.strictEqual(response.status, 302);

      const location = response.headers.get('location');
      assert.ok(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
      assert.ok(location.includes('response_type=code'));
      assert.ok(location.includes('scope=openid'));
      assert.ok(location.includes('access_type=offline'));
    });

    it('returns 400 if redirect_uri is missing', async () => {
      const response = await fetch(`${SERVER_URL}/oauth/authorize`);

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'redirect_uri is required');
    });

    it('preserves state parameter in Google redirect', async () => {
      const response = await fetch(
        `${SERVER_URL}/oauth/authorize?redirect_uri=http://example.com/callback&state=mystate123`,
        { redirect: 'manual' }
      );

      const location = response.headers.get('location');
      assert.ok(location.includes('state='));

      const url = new URL(location);
      const state = url.searchParams.get('state');
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());

      assert.strictEqual(decoded.originalState, 'mystate123');
      assert.strictEqual(decoded.redirectUri, 'http://example.com/callback');
      assert.ok(decoded.nonce);
    });
  });

  describe('GET /oauth/callback', () => {
    it('returns 400 if code is missing', async () => {
      const state = Buffer.from(JSON.stringify({
        redirectUri: 'http://example.com/callback',
        originalState: 'test',
        nonce: 'abc123'
      })).toString('base64url');

      const response = await fetch(`${SERVER_URL}/oauth/callback?state=${state}`);

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'Missing code or state');
    });

    it('returns 400 if state is missing', async () => {
      const response = await fetch(`${SERVER_URL}/oauth/callback?code=somecode`);

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'Missing code or state');
    });

    it('returns 400 if state is invalid', async () => {
      const response = await fetch(
        `${SERVER_URL}/oauth/callback?code=somecode&state=invalidbase64`
      );

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'Invalid state parameter');
    });
  });

  describe('POST /oauth/token', () => {
    it('returns error for missing code', async () => {
      const response = await fetch(`${SERVER_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code'
      });

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'invalid_request');
      assert.strictEqual(body.error_description, 'code is required');
    });

    it('returns error for invalid code', async () => {
      const response = await fetch(`${SERVER_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&code=invalid123'
      });

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'invalid_grant');
      assert.strictEqual(body.error_description, 'Code expired or invalid');
    });

    it('returns error for unsupported grant_type', async () => {
      const response = await fetch(`${SERVER_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials&code=test'
      });

      assert.strictEqual(response.status, 400);
      const body = await response.json();
      assert.strictEqual(body.error, 'unsupported_grant_type');
    });
  });
});
