import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TEST_CONFIG, apiSearch, createApiKeyTests, RAKETTITIEDE_WEBSITE } from '../config.mjs';

describe('🔍 Test do-search basic functionality:', async () => {

  describe('Edge cases query handling', () => {
    it('should handle empty string query', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.empty);
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle null query', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.null);
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle undefined query', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.undefined);
      assert.strictEqual(result.error, 'Missing query parameter ?q=');
    });

    it('should handle special characters query', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.specialChars);
      assert.strictEqual(Array.isArray(result.results), true);
      assert.strictEqual(result.results.length, 0);
    });

    it('should handle long query', async () => {
      const result = await apiSearch('a'.repeat(TEST_CONFIG.TEST_SEARCH_QUERY.long.length));
      assert.strictEqual(Array.isArray(result.results), true);
      assert.strictEqual(result.results.length, 0);
    });

    it('should return empty results array when no matches', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.notMatches);
      assert.strictEqual(result.results.length, 0);
    });
  });

  describe('Basic Return Structure', () => {
    it('should return object with results and count properties', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual('results' in result, true);
      assert.strictEqual('count' in result, true);
    });

    it('should return results as array with correct structure', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
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
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
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
      // Availability comes from employee_availability view — no project names, just status
      const availabilityPatterns = [
        /^Available now$/,
        /^Available after \d{4}-\d{2}-\d{2}$/,
        /^Currently unavailable$/,
      ];

      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      assert.ok(result.results.length > 0, 'Should return results');

      result.results.forEach(item => {
        const [availability] = item.title.split(' — ');
        const matchesPattern = availabilityPatterns.some(p => p.test(availability));
        assert.ok(matchesPattern, `Availability "${availability}" should match one of: Available now, Available after YYYY-MM-DD, Currently unavailable`);
      });
    });

    it('should have at least one "Available now" result', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      const availableNow = result.results.filter(r => r.title.startsWith('Available now'));
      assert.ok(availableNow.length > 0, 'Should have at least one Available now candidate');
    });

    it('should have at least one "Available after" result when searching java', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.java);
      const availableAfter = result.results.filter(r => r.title.startsWith('Available after'));
      assert.ok(availableAfter.length > 0, 'Should have at least one Available after candidate');
    });

    it('should have at least one "Currently unavailable" result when searching react', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      const unavailable = result.results.filter(r => r.title.startsWith('Currently unavailable'));
      assert.ok(unavailable.length > 0, 'Should have at least one Currently unavailable candidate');
    });
  });

  describe('Results deduplication', () => {
    it('should never return duplicate IDs', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      const ids = result.results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      assert.strictEqual(ids.length, uniqueIds.length, 'Each candidate/project should appear only once');
    });

    it('should combine multiple match reasons into one result with comma-separated reasons', async () => {
      // Search for a term that matches both skills and description — same candidate should appear once
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.default);
      const ids = result.results.map(r => r.id);
      const uniqueIds = [...new Set(ids)];
      assert.strictEqual(ids.length, uniqueIds.length, 'No duplicates even with multiple search strategies');
    });

    it('should format combined reasons separated by comma', async () => {
      const result = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
      result.results.forEach(item => {
        const parts = item.title.split(' — ');
        assert.strictEqual(parts.length, 2, `Title should have exactly two parts separated by " — ": got "${item.title}"`);
        assert.ok(parts[1].length > 0, 'Should have at least one reason');
      });
    });
  });
});
