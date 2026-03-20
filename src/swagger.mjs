import swaggerJSDoc from "swagger-jsdoc";
import { SERVER_VERSION, SERVER_URL, PARTNER } from "./constants.mjs";

const swaggerOptions = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: `${PARTNER} Talent Network Node`,
      version: SERVER_VERSION,
      description: 'Search and fetch anonymized consultant candidates. No personal data is stored or returned.',
    },
    servers: [
      {
        url: `${SERVER_URL}/api/v1`,
        description: 'Production server (Google Cloud Run)',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication via X-API-Key header'
        },
        ApiKeyQuery: {
          type: 'apiKey',
          in: 'query',
          name: 'api_key',
          description: 'API key authentication via query parameter'
        },
        OAuth2: {
          type: 'oauth2',
          description: 'OAuth2 authentication via Google',
          flows: {
            authorizationCode: {
              authorizationUrl: '/oauth/authorize',
              tokenUrl: '/oauth/token',
              scopes: {
                'openid': 'OpenID Connect',
                'email': 'Access email address',
                'profile': 'Access user profile'
              }
            }
          }
        }
      }
    },
    security: [
      { ApiKeyHeader: [] },
      { ApiKeyQuery: [] },
      { OAuth2: ['openid', 'email', 'profile'] }
    ]
  },
  apis: ['./src/api-router-v1.mjs'],
};

const rawSpec = swaggerJSDoc(swaggerOptions);

// Inject partner-specific operationIds so multiple nodes can be connected
// to the same CustomGPT (e.g. Minna) without operationId collisions.
// e.g. PARTNER=rakettitiede → rakettitiedeSearchCandidates, rakettitiedeFetchCandidate
const camelPartner = PARTNER.charAt(0).toLowerCase() + PARTNER.slice(1);
if (rawSpec.paths) {
  for (const path of Object.values(rawSpec.paths)) {
    for (const operation of Object.values(path)) {
      if (operation.operationId) {
        operation.operationId = camelPartner + operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1);
      }
    }
  }
}

export const swaggerSpec = rawSpec;
