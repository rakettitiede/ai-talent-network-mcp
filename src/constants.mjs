import pkg from "../package.json" with { type: "json" };

const GCP_EMBEDDING_MODEL_NAME = 'text-embedding-005';

export const AGILEDAY_BASE_URL = process.env.AGILEDAY_BASE_URL;
export const API_KEY = process.env.API_KEY;
export const DATABASE_NAME = "talent-network.sqlite";
export const DATABASE_NAME_DEVELOPMENT = "development-db.sqlite";
export const GCP_EMBEDDING_DIMENSIONS = 768;
export const GCP_LOCATION = process.env.GCP_LOCATION || 'europe-north1';
export const GCP_MOCK_VERTEX_URL = process.env.GCP_MOCK_VERTEX_URL || '';
export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'ai-cv-match-471207';
export const GCP_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
export const GCP_VERTEX_URL = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${GCP_EMBEDDING_MODEL_NAME}:predict`;
export const GCS_BUCKET = process.env.GCS_BUCKET || "";
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
export const NODE_ENV = process.env.NODE_ENV || "development";
export const PORT = process.env.PORT || 8080;
export const PYRY_BOT_TOKEN = process.env.PYRY_BOT_TOKEN;
export const RAKETTITIEDE_WEBSITE = 'https://www.rakettitiede.com';
export const REFRESH_DATA = process.env.REFRESH_DATA === "1"? true : false;
export const SERVER_NAME = pkg.name;
export const SERVER_VERSION = pkg.version;
export const SLACK_API_BASE_URL = process.env.SLACK_API_BASE_URL || "https://slack.com";
