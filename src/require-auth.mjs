import { API_KEY, NODE_ENV, GOOGLE_CLIENT_ID, GOOGLE_TOKENINFO_URL } from "./constants.mjs";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const response = await fetch(
        `${GOOGLE_TOKENINFO_URL}?access_token=${token}`
      );

      if (response.ok) {
        const tokenInfo = await response.json();

        if (tokenInfo.aud === GOOGLE_CLIENT_ID) {
          req.user = {
            id: tokenInfo.sub,
            email: tokenInfo.email,
            authMethod: 'oauth'
          };
          console.log(`🛡️ OAuth authentication (user: ${tokenInfo.email})`);
          return next();
        }
      }
    } catch (err) {
      if (NODE_ENV !== 'production') {
        console.log('Bearer token validation failed:', err.message);
      }
    }
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (NODE_ENV === "production") {
    console.log(`🔑 API key authentication ${apiKey ? '[PRESENT]' : '[MISSING]'}`);
  }

  if (apiKey === API_KEY) {
    req.user = { id: 'api-key', email: null, authMethod: 'api-key' };
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}
