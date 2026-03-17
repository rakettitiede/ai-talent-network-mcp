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

    it('should return empty results array when no matches', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.notMatches);

      // Assert
      assert.strictEqual(result.results.length, 0);
    });
  });

  describe('Basic Return Structure', () => {
    it('should return object with results and count properties', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual('results' in result, true);
      assert.strictEqual('count' in result, true);
    });

    it('should return results as array with correct structure', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      assert.strictEqual(Array.isArray(result.results), true);
      assert.ok(result.results.length > 0);
      result.results.forEach(item => {
        assert.strictEqual(typeof item.id, 'string');
        assert.strictEqual(typeof item.title, 'string');
        assert.strictEqual(typeof item.url, 'string');
        // ID format: candidate:temp:xxxxxxxx or project:temp:xxxxxxxx
        assert.ok(item.id.startsWith('candidate:') || item.id.startsWith('project:'), `ID should start with candidate: or project: — got: ${item.id}`);
        // Title format: "availability — reason(s)" — no names, no segments
        assert.ok(item.title.includes('—'), 'Title should contain em dash separator');
        assert.ok(!item.title.includes('(EMPLOYEE)') && !item.title.includes('(SUBCONTRACTOR)'), 'Title should not contain segment');
        // URL is always Rakettitiede website — no personal Agileday links
        assert.strictEqual(item.url, RAKETTITIEDE_WEBSITE);
      });
    });

    it('count should match results length', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      assert.strictEqual(result.count, result.results.length);
    });
  });

  createApiKeyTests({
    endpointPath: '/api/v1/search',
    endpointName: '/search',
    method: 'GET',
    queryParams: { q: TEST_CONFIG.TEST_SEARCH_QUERY.test },
  })(describe, it, assert);

  describe('Availability Format', () => {
    it('should format all availability strings with one of three valid patterns', async () => {
      // Arrange: availability comes from employee_availability view — no project names, just status
      const availabilityPatterns = [
        /^Available now$/,
        /^Available after \d{4}-\d{2}-\d{2}$/,
        /^Currently unavailable$/,
      ];

      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      assert.ok(result.results.length > 0, 'Should return results');
      result.results.forEach(item => {
        const [availability] = item.title.split(' — ');
        const matchesPattern = availabilityPatterns.some(p => p.test(availability));
        assert.ok(matchesPattern, `Availability "${availability}" should match one of: Available now, Available after YYYY-MM-DD, Currently unavailable`);
      });
    });

    it('should have at least one "Available now" result when searching react', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      const availableNow = result.results.filter(r => r.title.startsWith('Available now'));
      assert.ok(availableNow.length > 0, 'Should have at least one Available now candidate');
    });

    it('should have at least one "Available after" result when searching java', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.java);

      // Assert
      const availableAfter = result.results.filter(r => r.title.startsWith('Available after'));
      assert.ok(availableAfter.length > 0, 'Should have at least one Available after candidate');
    });

    it('should have at least one "Currently unavailable" result when searching react', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      const unavailable = result.results.filter(r => r.title.startsWith('Currently unavailable'));
      assert.ok(unavailable.length > 0, 'Should have at least one Currently unavailable candidate');
    });
  });

  describe('Results deduplication', () => {
    it('should never return duplicate IDs', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      const ids = result.results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      assert.strictEqual(ids.length, uniqueIds.length, 'Each candidate/project should appear only once');
    });

    it('should combine multiple match reasons — no duplicates even with multiple strategies', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.default);

      // Assert
      const ids = result.results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      assert.strictEqual(ids.length, uniqueIds.length, 'No duplicates even with multiple search strategies');
    });

    it('should format combined reasons separated by em dash', async () => {
      // Act
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);

      // Assert
      result.results.forEach(item => {
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, `Title should have exactly two parts separated by " — ": got "${item.title}"`);
        assert.ok(parts[1].length > 0, 'Should have at least one reason');
      });
    });
  });
});
