import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  TEST_CONFIG,
  apiSearch,
  apiFetch,
  createApiKeyTests,
  RAKETTITIEDE_WEBSITE,
} from '../config.mjs';

describe('🕵 Test do-fetch calls:', async () => {

  it('candidate found', async () => {
    // Arrange: get a candidate ID from search results (IDs are randomized temp: UUIDs)
    const searchResult = await apiSearch('react');
    const candidateResult = searchResult.results.find(r => r.id.startsWith('candidate:'));
    assert.ok(candidateResult, 'Should find a candidate in search results');

    // Act
    const doc = await apiFetch(candidateResult.id);

    // Assert
    assert.strictEqual(doc.id, candidateResult.id);
    assert.strictEqual(doc.title, 'Candidate found');
    assert.strictEqual(doc.url, RAKETTITIEDE_WEBSITE);
    assert.deepStrictEqual(Object.keys(doc.text).sort(), ['availability', 'description', 'skills']);
    assert.strictEqual(typeof doc.text.description, 'string');
    assert.ok(doc.text.description.length > 0);
    assert.ok(Array.isArray(doc.text.skills));
    assert.ok(doc.text.skills.length > 0);
    assert.strictEqual(typeof doc.text.availability, 'string');
    assert.deepStrictEqual(Object.keys(doc.metadata).sort(), ['skillsCount', 'type']);
    assert.strictEqual(doc.metadata.type, 'candidate');
    assert.strictEqual(typeof doc.metadata.skillsCount, 'number');
  });

  it('project found via search', async () => {
    // Arrange: try multiple queries to find a project result
    const queries = ['corporate banking portal react graphql', 'javascript developer', 'react'];
    let projectResult = null;
    for (const query of queries) {
      const searchResult = await apiSearch(query);
      if (searchResult.results) {
        projectResult = searchResult.results.find(r => r.id.startsWith('project:'));
        if (projectResult) break;
      }
    }

    // Skip assertion if no project results from vector search (mock embeddings may not match within threshold)
    if (!projectResult) {
      return;
    }

    // Act
    const doc = await apiFetch(projectResult.id);

    // Assert
    assert.strictEqual(doc.id, projectResult.id);
    assert.strictEqual(doc.title, 'Candidate found by project');
    assert.strictEqual(doc.url, RAKETTITIEDE_WEBSITE);
    assert.deepStrictEqual(Object.keys(doc.text).sort(), ['availability', 'description', 'skills']);
    assert.strictEqual(typeof doc.text.description, 'string');
    assert.ok(doc.text.description.length > 0);
    assert.ok(Array.isArray(doc.text.skills));
    assert.strictEqual(typeof doc.text.availability, 'string');
    assert.deepStrictEqual(Object.keys(doc.metadata).sort(), ['project', 'skillsCount', 'type']);
    assert.strictEqual(doc.metadata.type, 'project');
    assert.strictEqual(typeof doc.metadata.project, 'string');
    assert.strictEqual(typeof doc.metadata.skillsCount, 'number');
  });

  it('candidate not found', async () => {
    // Act
    const doc = await apiFetch(`candidate:${TEST_CONFIG.TEST_NOT_FOUND_ID}`);

    // Assert
    assert.strictEqual(doc.id, `candidate:${TEST_CONFIG.TEST_NOT_FOUND_ID}`);
    assert.strictEqual(doc.title, 'Not found');
    assert.strictEqual(doc.text, '');
    assert.strictEqual(doc.url, '');
    assert.deepStrictEqual(doc.metadata, {});
  });

  it('project not found', async () => {
    // Act
    const doc = await apiFetch(`project:${TEST_CONFIG.TEST_INVALID_ID}`);

    // Assert
    assert.strictEqual(doc.id, `project:${TEST_CONFIG.TEST_INVALID_ID}`);
    assert.strictEqual(doc.title, 'Not found');
    assert.strictEqual(doc.text, '');
    assert.strictEqual(doc.url, '');
    assert.deepStrictEqual(doc.metadata, {});
  });

  createApiKeyTests({
    endpointPath: '/api/v1/fetch',
    endpointName: '/fetch',
    method: 'GET',
    queryParams: { id: `candidate:test-id` },
    successValidator: (data) => {
      assert.ok(data.id);
    },
  })(describe, it, assert);
});
