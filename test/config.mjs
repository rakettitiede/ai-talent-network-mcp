import { spawn } from 'child_process';

export const TEST_CONFIG = {
  SERVER_URL: `http://localhost:8080`,
  AGILEDAY_BASE_URL: 'http://localhost:3000',
  API_KEY: 'test-api-key',
  OPENAI_BASE_URL: 'http://localhost:3001/v1',
  OPENAI_KEY: 'test-openai-key',

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

export const RAKETTITIEDE_WEBSITE = 'https://www.rakettiidee.com';

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
  
  // Add API key to query params if requested
  if (includeApiKey && apiKeyInQuery) {
    params.set('api_key', TEST_CONFIG.API_KEY);
  }
  
  const urlWithParams = params.toString() ? `${url}?${params}` : url;
  
  const fetchOptions = {
    method,
    headers: { ...headers },
  };
  
  // Add API key to headers if requested
  if (includeApiKey && !apiKeyInQuery) {
    fetchOptions.headers['X-API-Key'] = TEST_CONFIG.API_KEY;
  }
  
  // Add body for POST requests
  if (body) {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }
  
  const response = await fetch(urlWithParams, fetchOptions);
  return response;
}

// API request utilities for integration tests
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

/**
 * Creates reusable API key authentication tests for an endpoint
 * @param {Object} options - Configuration for the API key tests
 * @param {string} options.endpointPath - The endpoint path (e.g., '/api/v1/search', '/api/v1/fetch')
 * @param {string} options.endpointName - The endpoint name for test descriptions (e.g., '/search', '/fetch')
 * @param {string} [options.method='GET'] - HTTP method ('GET' or 'POST')
 * @param {Object} [options.queryParams={}] - Query parameters for the request
 * @param {Object} [options.body=null] - Request body (for POST requests)
 * @param {Function} [options.successValidator] - Optional function to validate successful response
 * @param {boolean} [options.testQueryParam=true] - Whether to test API key in query parameter (default: true)
 * @returns {Function} A function that creates test cases when called with describe, it, assert
 */
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
        // Act
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          includeApiKey: true,
          apiKeyInQuery: false,
        });

        // Assert
        assert.strictEqual(response.status, 200);
        assert.ok(response.ok);
        
        if (successValidator) {
          const data = await response.json();
          successValidator(data);
        }
      });

      if (testQueryParam) {
        it(`should accept valid API key in query parameter for ${endpointName} endpoint`, async () => {
          // Act
          const response = await makeApiRequest({
            endpointPath,
            method,
            queryParams,
            body,
            includeApiKey: true,
            apiKeyInQuery: true,
          });

          // Assert
          assert.strictEqual(response.status, 200);
          assert.ok(response.ok);
          
          if (successValidator) {
            const data = await response.json();
            successValidator(data);
          }
        });
      }

      it(`should reject request without API key for ${endpointName} endpoint`, async () => {
        // Act
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          includeApiKey: false,
        });

        // Assert
        assert.strictEqual(response.status, 401);
        const data = await response.json();
        assert.deepStrictEqual(data, { error: 'Unauthorized' });
      });

      it(`should reject request with invalid API key for ${endpointName} endpoint`, async () => {
        // Act
        const response = await makeApiRequest({
          endpointPath,
          method,
          queryParams,
          body,
          headers: { 'X-API-Key': 'invalid-api-key' },
          includeApiKey: false, // We're manually setting invalid key in headers
        });

        // Assert
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
        cwd: cwd,
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
    if (!this.serverProcess) {
      return Promise.resolve();
    }

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

export class MockOpenAiServerManager {
  constructor() {
    this.serverProcess = null;
    this.serverReady = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.serverReady = false;
      const cwd = new URL('../', import.meta.url).pathname;
      const mockOpenAiPath = new URL('../test/openai-api-mock/index.mjs', import.meta.url).pathname;
      this.serverProcess = spawn(process.execPath, [mockOpenAiPath], {
        env: {
          OPENAI_MOCK_PORT: '3001',
          OPENAI_BASE_URL: TEST_CONFIG.OPENAI_BASE_URL,
          OPENAI_KEY: TEST_CONFIG.OPENAI_KEY,
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd,
      });
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('🚀 Mock OpenAI API server running') && !this.serverReady) {
          this.serverReady = true;
          resolve(this.serverProcess);
        }
      });
      
      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error:') || output.includes('EADDRINUSE')) {
          reject(new Error(`Mock OpenAI API server error: ${data.toString()}`));
        }
      });
      
      this.serverProcess.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (!this.serverProcess) {
      return Promise.resolve();
    }

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
          OPENAI_BASE_URL: TEST_CONFIG.OPENAI_BASE_URL,
          OPENAI_KEY: TEST_CONFIG.OPENAI_KEY,
          NODE_ENV: 'test',
          ...process.env,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd,
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
    if (!this.serverProcess) {
      return Promise.resolve();
    }

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
