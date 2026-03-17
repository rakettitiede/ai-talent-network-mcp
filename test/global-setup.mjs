import { ServerManager, MockApiServerManager, MockVertexAiServerManager, makeApiRequest } from './config.mjs';

let serverManager;
let mockApiManager;
let mockVertexAiManager;

export async function globalSetup() {
  console.log('🔧 Global test setup: Starting servers...');

  try {
    // Start Mock Vertex AI Server (needed for embeddings in tests)
    mockVertexAiManager = new MockVertexAiServerManager();
    await mockVertexAiManager.start();
    console.log('✅ Mock Vertex AI server started');

    // Start Mock API Server (needed for refresh tests)
    mockApiManager = new MockApiServerManager();
    await mockApiManager.start();
    console.log('✅ Mock API server started');

    // Start MCP Server (needed for all integration tests)
    serverManager = new ServerManager();
    await serverManager.start();
    console.log('✅ MCP server started');

    // Populate database with fixture data via refresh endpoint (e2e test)
    console.log('📊 Populating database with fixture data via refresh endpoint...');

    let refreshAttempts = 0;
    const maxAttempts = 3;
    let refreshSuccess = false;

    while (refreshAttempts < maxAttempts && !refreshSuccess) {
      refreshAttempts++;
      try {
        const response = await makeApiRequest({
          endpointPath: '/api/v1/refresh',
          method: 'POST',
          body: { token: 'test-token' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Refresh failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('='.repeat(50));
        console.log('🎉 Database populated:', result.message);
        console.log('='.repeat(50));

        // Wait a bit for database writes to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify database was populated correctly
        const verifyResponse = await makeApiRequest({
          endpointPath: '/api/v1/search',
          queryParams: { q: 'react' },
        });

        if (!verifyResponse.ok) {
          throw new Error(`Database verification failed: ${verifyResponse.status}`);
        }

        const verifyResult = await verifyResponse.json();
        if (verifyResult.results && verifyResult.results.length > 0) {
          console.log(`✅ Database verification: Found ${verifyResult.results.length} result(s) for test query`);
          refreshSuccess = true;
        } else {
          if (refreshAttempts < maxAttempts) {
            console.warn(`⚠️  Database verification failed (attempt ${refreshAttempts}/${maxAttempts}), retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error('Database verification failed: No results found after refresh. Database may not be populated correctly.');
          }
        }
      } catch (error) {
        if (refreshAttempts >= maxAttempts) {
          throw error;
        }
        console.warn(`⚠️  Refresh attempt ${refreshAttempts} failed, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✅ Global setup complete - all servers running');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    // Clean up any partially started servers
    if (mockVertexAiManager) {
      await mockVertexAiManager.stop().catch(() => {});
    }
    if (mockApiManager) {
      await mockApiManager.stop().catch(() => {});
    }
    if (serverManager) {
      await serverManager.stop().catch(() => {});
    }
    throw error; // Re-throw to prevent tests from running
  }
}

export async function globalTeardown() {
  // Wait a brief moment to ensure all test output is flushed
  await new Promise(resolve => setImmediate(resolve));

  console.log('🧹 Global test teardown: Stopping servers...');

  try {
    if (serverManager) {
      await serverManager.stop();
      console.log('✅ MCP server stopped');
    }

    if (mockApiManager) {
      await mockApiManager.stop();
      console.log('✅ Mock API server stopped');
    }

    if (mockVertexAiManager) {
      await mockVertexAiManager.stop();
      console.log('✅ Mock Vertex AI server stopped');
    }

    console.log('✅ Global teardown complete');
  } catch (error) {
    console.error('❌ Global teardown error:', error);
  }
}
