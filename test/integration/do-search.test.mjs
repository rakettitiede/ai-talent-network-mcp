import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG, apiSearch, createApiKeyTests, RAKETTITIEDE_WEBSITE } from '../config.mjs';

describe('🔍 Test do-search basic functionality:', async () => {

  describe('Edge cases query handling', () => {
    it('should handle empty string query', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.empty);

      // Assert
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle null query', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.null);

      // Assert
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle undefined query', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.undefined);

      // Assert
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle special characters query', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.specialChars);

      // Assert
      assert.strictEqual(Array.isArray(result.results), true);
      assert.strictEqual(result.results.length, 0);
    });

    it('should handle long query', async () => {
      // Arrange
      const query = 'a'.repeat(TEST_CONFIG.TEST_SEARCH_QUERY.long.length);

      // Act
      const result = await apiSearch(query);

      // Assert
      assert.strictEqual(Array.isArray(result.results), true);
      assert.strictEqual(result.results.length, 0);
    });

  });

  describe('Basic Return Structure', () => {
    it('should return object with results property', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.default);

      // Assert
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual('results' in result, true);
    });

    it('should return results as array', async () => {
      // Act
      const result = await apiSearch('react');

      // Assert
      assert.strictEqual(Array.isArray(result.results), true);
      assert.ok(result.results.length > 0);
    });

    it('should return empty results array when no matches', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.notMatches);

      // Assert
      assert.strictEqual(result.results.length, 0);
    });

    it('should return results with expected structure when matches found', async () => {
      // Act
      const result = await apiSearch('react');

      // Assert
      assert.strictEqual(Array.isArray(result.results), true);
      assert.strictEqual(result.results.length > 0, true);
      result.results.forEach(item => {
        assert.strictEqual(typeof item.id, 'string');
        assert.strictEqual(typeof item.title, 'string');
        assert.strictEqual(typeof item.url, 'string');
        assert.strictEqual(item.id.startsWith('candidate:') || item.id.startsWith('project:'), true);
        // Verify title format: Availability — reason(s)
        assert.ok(item.title.includes('—'), 'Title should contain em dash separator');
        assert.strictEqual(item.url, RAKETTITIEDE_WEBSITE);
      });
    });
  });

  describe('Search endpoint integration', () => {
    it('should return results when searching by skill', async () => {
      // Act
      const data = await apiSearch('react');

      // Assert
      assert.strictEqual(Array.isArray(data.results), true);
      assert.ok(data.results.length > 0);
      // All results should have the correct title format
      data.results.forEach(item => {
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, 'Title should have two parts separated by em dash');
      });
    });
  });

  createApiKeyTests({
    endpointPath: '/api/v1/search',
    endpointName: '/search',
    method: 'GET',
    queryParams: { q: 'test' },
  })(describe, it, assert);

  describe('Availability Format Scenarios', () => {
    it('should show "Available now" for candidates with no current openings', async () => {
      // Act
      const result = await apiSearch('react');

      // Assert: at least one result should show "Available now"
      const availableNow = result.results.filter(r => r.title.includes('Available now'));
      assert.ok(availableNow.length > 0, 'Should have at least one "Available now" candidate');
    });

    it('should show "Available after <date>" for candidates with ending projects', async () => {
      // Act: search for java to find Jane Smith who has a project ending 2026-12-31
      const result = await apiSearch('java');

      // Assert
      const availableAfter = result.results.filter(r => r.title.includes('Available after'));
      assert.ok(availableAfter.length > 0, 'Should have at least one "Available after" candidate');
      availableAfter.forEach(item => {
        assert.ok(item.title.match(/Available after \d{4}-\d{2}-\d{2}/),
          'Should match expected date format');
        // Should NOT contain project names
        assert.ok(!item.title.includes('current project'), 'Should not contain project name details');
      });
    });

    it('should show "Currently unavailable" for candidates with no end date projects', async () => {
      // Act: search for react to find Bob Johnson who has a project with no end date
      const result = await apiSearch('react');

      // Assert
      const unavailable = result.results.filter(r => r.title.includes('Currently unavailable'));
      assert.ok(unavailable.length > 0, 'Should have at least one "Currently unavailable" candidate');
      unavailable.forEach(item => {
        // Should NOT contain project names or "no end date" detail
        assert.ok(!item.title.includes('current project'), 'Should not contain project name details');
      });
    });

    it('should correctly format availability in title with proper structure', async () => {
      // Act
      const result = await apiSearch('react');

      // Assert: All results should have proper structure
      assert.ok(result.results.length > 0, 'Should return results');
      result.results.forEach(item => {
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, 'Title should have two parts separated by em dash');

        const [availability] = parts;

        const availabilityPatterns = [
          /^Available now$/,
          /^Available after \d{4}-\d{2}-\d{2}$/,
          /^Currently unavailable$/
        ];

        const matchesPattern = availabilityPatterns.some(pattern =>
          pattern.test(availability)
        );

        assert.ok(matchesPattern, `Availability should match one of the simplified patterns: "${availability}"`);
      });
    });
  });

  describe('Results Map deduplication and merging', () => {
    it('should return properly formatted results when searching for React (may match by skill/description)', async () => {
      // Act
      const result = await apiSearch('React');

      // Assert: Should return results
      assert.ok(result.results.length > 0, 'Should return results');

      // All results should be properly formatted
      result.results.forEach(item => {
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, 'Each result should have proper structure');
        assert.ok(parts[1].length > 0, 'Should have match reason(s)');
        assert.strictEqual(item.url, RAKETTITIEDE_WEBSITE);
      });
    });

    it('should deduplicate when matched by both skill and description (appears once with combined reasons)', async () => {
      // Arrange: Search for a skill that also appears in descriptions
      const query = 'React';

      // Act
      const result = await apiSearch(query);

      // Assert: Check that candidate IDs are unique (no duplicates)
      const candidateIds = result.results.map(r => r.id);
      const uniqueIds = [...new Set(candidateIds)];
      assert.strictEqual(candidateIds.length, uniqueIds.length, 'Each candidate/project should appear only once');
    });

    it('should format results with correct structure', async () => {
      // Act
      const result = await apiSearch('javascript developer');

      // Assert: Each result should have the correct structure
      result.results.forEach(item => {
        assert.strictEqual(typeof item.id, 'string', 'Result should have id');
        assert.strictEqual(typeof item.title, 'string', 'Result should have title');
        assert.strictEqual(typeof item.url, 'string', 'Result should have url');

        // Verify title structure: Availability — reason(s)
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, 'Title should have availability and reasons separated by em dash');
      });
    });
  });
});
