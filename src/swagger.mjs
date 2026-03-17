import swaggerJSDoc from "swagger-jsdoc";

import { SERVER_VERSION, SERVER_NAME } from "./constants.mjs";

const swaggerOptions = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Talent Network API',
      version: SERVER_VERSION,
      description: 'API with search and fetch endpoints to match anonymized candidates based on skills, experience, and project history',
    },
    servers: [
      {
        url: 'https://mcp-talent-network-938427813842.europe-north1.run.app/api/v1',
        description: 'Production server (Google Cloud Run)',
      },
    ],
    components: {
      securitySchemes: {
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
      { OAuth2: ['openid', 'email', 'profile'] }
    ]
  },
  apis: ['./src/api-router-v1.mjs'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
