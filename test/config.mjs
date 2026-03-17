import { spawn } from 'child_process';

export const TEST_CONFIG = {
  SERVER_URL: `http://localhost:8080`,
  AGILEDAY_BASE_URL: 'http://localhost:3000',
  API_KEY: 'test-api-key',
  GCP_MOCK_VERTEX_URL: 'http://localhost:3001/v1/projects/test-project/locations/europe-north1/publishers/google/models/text-embedding-005:predict',

  TEST_NOT_FOUND_ID: '00000000-0000-0000-0000-000000000000',
  TEST_INVALID_ID: 'invalid-id-123',

  TEST_SEARCH_QUERY: {
    default: 'javascript developer',
    react: 'react',
    java: 'java',
    python: 'python',
    kubernetes: 'kubernetes',
    test: 'test',
    corporateBanking: 'corporate banking portal react graphql',
    empty: '',
    null: null,
    undefined: undefined,
    specialChars: 'test@#$%^&*()',
    long: 'a'.repeat(1000),
    notMatches: 'undefined Null',
  },
};

export const RAKETTITIEDE_WEBSITE = 'https://www.rakettitiede.com';

// Generic API request utility
export async function makeApiRequest({
  endpointPath,
  method = 'GET',
  queryParams = {},
  headers = {},
  body = null,
  includeApiKey = true,
  apiKeyInQuery = false,
}) {
  const url = `${TEST_CONFIG.SERVER_URL}${endpointPath}`;
  const params = new URLSearchParams(queryParams);

  if (includeApiKey && apiKeyInQuery) {
    params.set('api_key', TEST_CONFIG.API_KEY);
  }

  const urlWithParams = params.toString() ? `${url}?${params}` : url;

  const fetchOptions = {
    method,
    headers: { ...headers },
  };

  if (includeApiKey && !apiKeyInQuery) {
    fetchOptions.headers['X-API-Key'] = TEST_CONFIG.API_KEY;
  }

  if (body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(urlWithParams, fetchOptions);
  return response;
}

export async function apiSearch(query) {
  const response = await makeApiRequest({
    endpointPath: '/api/v1/search',
    queryParams: { q: query ?? '' },
    apiKeyInQuery: true,
  });
  return await response.json();
}

export async function apiFetch(id) {
  const response = await makeApiRequest({
    endpointPath: '/api/v1/fetch',
    queryParams: { id },
    apiKeyInQuery: true,
  });
  return await response.json();
}

export async function apiRefresh(token) {
  const response = await makeApiRequest({
    endpointPath: '/api/v1/refresh',
    method: 'POST',
    body: { token },
  });
  return await response.json();
}

export function createApiKeyTests({
  endpointPath,
  endpointName,
  method = 'GET',
  queryParams = {},
  body = null,
  successValidator = null,
  testQueryParam = true,
}) {
  return (describe, it, assert) => {
    describe('API Key authentication', () => {
      it(`should accept valid API key in header for ${endpointName} endpoint`, async () => {
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          includeApiKey: true,
          apiKeyInQuery: false,
        });
        assert.strictEqual(response.status, 200);
        assert.ok(response.ok);
        if (successValidator) {
          const data = await response.json();
          successValidator(data);
        }
      });

      if (testQueryParam) {
        it(`should accept valid API key in query parameter for ${endpointName} endpoint`, async () => {
          const response = await makeApiRequest({
            endpointPath,
            method,
            queryParams,
            body,
            includeApiKey: true,
            apiKeyInQuery: true,
          });
          assert.strictEqual(response.status, 200);
          assert.ok(response.ok);
          if (successValidator) {
            const data = await response.json();
            successValidator(data);
          }
        });
      }

      it(`should reject request without API key for ${endpointName} endpoint`, async () => {
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          includeApiKey: false,
        });
        assert.strictEqual(response.status, 401);
        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'Unauthorized' });
      });

      it(`should reject request with invalid API key for ${endpointName} endpoint`, async () => {
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          headers: { 'X-API-Key': 'invalid-api-key' },
          includeApiKey: false,
        });
        assert.strictEqual(response.status, 401);
        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'Unauthorized' });
      });
    });
  };
}

export class MockApiServerManager {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.serverReady = false;
      const cwd = new URL('../', import.meta.url).pathname;
      const mockApiPath = new URL('../test/agileday-api-mock/index.mjs', import.meta.url).pathname;
      this.serverProcess = spawn(process.execPath, [mockApiPath], {
        env: {
          PORT: '3000',
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('🚀 Mock Agileday API server running') && !this.serverReady) {
          this.serverReady = true;
          resolve(this.serverProcess);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error:') || output.includes('EADDRINUSE')) {
          reject(new Error(`Mock API server error: ${data.toString()}`));
        }
      });

      this.serverProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (!this.serverProcess) return Promise.resolve();
    return new Promise((resolve) => {
      this.serverProcess.kill('SIGINT');
      this.serverProcess.on('exit', () => {
        this.serverProcess = null;
        this.serverReady = false;
        resolve();
      });
    });
  }
}

export class MockVertexAiServerManager {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.serverReady = false;
      const cwd = new URL('../', import.meta.url).pathname;
      const mockVertexAiPath = new URL('../test/vertex-ai-mock/index.mjs', import.meta.url).pathname;
      this.serverProcess = spawn(process.execPath, [mockVertexAiPath], {
        env: {
          VERTEX_MOCK_PORT: '3001',
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('🚀 Mock Vertex AI server running') && !this.serverReady) {
          this.serverReady = true;
          resolve(this.serverProcess);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error:') || output.includes('EADDRINUSE')) {
          reject(new Error(`Mock Vertex AI server error: ${data.toString()}`));
        }
      });

      this.serverProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (!this.serverProcess) return Promise.resolve();
    return new Promise((resolve) => {
      this.serverProcess.kill('SIGINT');
      this.serverProcess.on('exit', () => {
        this.serverProcess = null;
        this.serverReady = false;
        resolve();
      });
    });
  }
}

export class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.serverReady = false;
      const cwd = new URL('../', import.meta.url).pathname;
      this.serverProcess = spawn(process.execPath, [new URL('../src/index.mjs', import.meta.url).pathname], {
        env: {
          AGILEDAY_BASE_URL: TEST_CONFIG.AGILEDAY_BASE_URL,
          API_KEY: TEST_CONFIG.API_KEY,
          GCP_MOCK_VERTEX_URL: TEST_CONFIG.GCP_MOCK_VERTEX_URL,
          NODE_ENV: 'test',
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd,
      });

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('🚀 Listening on') && !this.serverReady) {
          this.serverReady = true;
          resolve(this.serverProcess);
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error:') || output.includes('FATAL')) {
          reject(new Error(`Server error: ${data.toString()}`));
        }
      });

      this.serverProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (!this.serverProcess) return Promise.resolve();
    return new Promise((resolve) => {
      this.serverProcess.kill('SIGINT');
      this.serverProcess.on('exit', () => {
        this.serverProcess = null;
        this.serverReady = false;
        resolve();
      });
    });
  }
}
