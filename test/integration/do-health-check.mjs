import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG } from '../config.mjs';

describe('🩺 Test check-health calls', () => {

  it('should return 200 for health check', async () => {
    // Arrange
    const healthUrl = TEST_CONFIG.SERVER_URL;

    // Act
    const response = await fetch(healthUrl);

    // Assert
    assert.strictEqual(response.status, 200);
    assert.ok(response.ok);
  });
});
