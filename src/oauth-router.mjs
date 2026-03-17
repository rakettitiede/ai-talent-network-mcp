import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
} from './constants.mjs';

const router = Router();

// In-memory store for OAuth state (code -> tokens mapping)
// Keys expire after 5 minutes (cleaned up on access)
const pendingTokens = new Map();
const PENDING_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

// Clean expired entries
function cleanExpired() {
  const now = Date.now();
  for (const [key, value] of pendingTokens) {
    if (now > value.expiresAt) {
      pendingTokens.delete(key);
    }
  }
}

// Generate a short-lived code
function generateCode() {
  return crypto.randomBytes(32).toString('hex');
}

// Extract email from Google's id_token (JWT) for logging
function extractEmailFromIdToken(idToken) {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return decoded.email || null;
  } catch {
    return null;
  }
}

/**
 * GET /oauth/authorize
 * 
 * Custom GPT redirects user here. We redirect to Google.
 * Query params from Custom GPT:
 *   - redirect_uri: where Custom GPT wants the final redirect
 *   - state: Custom GPT's state (we pass through)
 *   - response_type: "code" (we ignore, always use code)
 *   - client_id: Custom GPT's client_id (we ignore, use our Google client_id)
 */
router.get('/authorize', (req, res) => {
  const { redirect_uri, state } = req.query;
  console.log(`🔐 GET /oauth/authorize`);

  if (!redirect_uri) {
    console.log(`🔐 /oauth/authorize failed: missing redirect_uri`);
    return res.status(400).json({ error: 'redirect_uri is required' });
  }

  // Build our callback URL (where Google will redirect back)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const ourCallbackUrl = `${protocol}://${host}/oauth/callback`;

  // Store Custom GPT's redirect_uri and state so we can use them in callback
  // We encode this in Google's state parameter
  const oauthState = Buffer.from(JSON.stringify({
    redirectUri: redirect_uri,
    originalState: state || '',
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');

  // Redirect to Google OAuth
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', ourCallbackUrl);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', oauthState);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  console.log(`🔐 /oauth/authorize redirecting to Google OAuth`);
  res.redirect(googleAuthUrl.toString());
});

/**
 * GET /oauth/callback
 * 
 * Google redirects here after user authenticates.
 * We exchange Google's code for tokens, store them, redirect to Custom GPT.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  console.log(`🔑 GET /oauth/callback`);

  if (error) {
    console.error(`🔑 /oauth/callback failed: Google OAuth error: ${error}`);
    return res.status(400).json({ error: `Google OAuth error: ${error}` });
  }

  if (!code || !state) {
    console.error(`🔑 /oauth/callback failed: missing code or state`);
    return res.status(400).json({ error: 'Missing code or state' });
  }

  // Decode state to get Custom GPT's redirect_uri
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    console.error(`🔑 /oauth/callback failed: invalid state parameter`);
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  const { redirectUri, originalState } = stateData;

  // Build our callback URL for token exchange
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const ourCallbackUrl = `${protocol}://${host}/oauth/callback`;

  // Exchange code for tokens with Google
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: ourCallbackUrl,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`🔑 /oauth/callback failed: Google token exchange failed`);
      return res.status(502).json({ error: 'Failed to exchange code with Google' });
    }

    const tokens = await tokenResponse.json();

    // Generate our temporary code and store the tokens
    cleanExpired();
    const tempCode = generateCode();
    pendingTokens.set(tempCode, {
      tokens,
      expiresAt: Date.now() + PENDING_TOKEN_TTL
    });

    // Redirect to Custom GPT with our temporary code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', tempCode);
    if (originalState) {
      redirectUrl.searchParams.set('state', originalState);
    }

    const email = extractEmailFromIdToken(tokens.id_token);
    console.log(`🔑 /oauth/callback success: ${email || 'unknown user'} authenticated`);
    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error(`🔑 /oauth/callback error:`, err.message);
    return res.status(500).json({ error: 'Internal server error during OAuth' });
  }
});

/**
 * POST /oauth/token
 * 
 * Custom GPT calls this to exchange our temporary code for tokens.
 * We return Google's tokens directly.
 */
router.post('/token', express.urlencoded({ extended: false }), (req, res) => {
  const { code, grant_type } = req.body;
  console.log(`🎫 POST /oauth/token`);

  if (grant_type !== 'authorization_code') {
    console.log(`🎫 /oauth/token failed: unsupported grant_type`);
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (!code) {
    console.log(`🎫 /oauth/token failed: missing code`);
    return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
  }

  cleanExpired();
  const pending = pendingTokens.get(code);

  if (!pending) {
    console.log(`🎫 /oauth/token failed: code expired or invalid`);
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired or invalid' });
  }

  // Remove the code (one-time use)
  pendingTokens.delete(code);

  const email = extractEmailFromIdToken(pending.tokens.id_token);
  console.log(`🎫 /oauth/token success: tokens exchanged for ${email || 'unknown user'}`);
  // Return Google's tokens to Custom GPT
  res.json(pending.tokens);
});

export { router as oauthRouter };
