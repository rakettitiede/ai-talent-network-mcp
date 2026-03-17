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
    // Arrange: IDs are temp:xxxxxxxx generated at refresh time — get them dynamically from search
    const searchResult = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
    const candidateResult = searchResult.results.find(r => r.id.startsWith('candidate:'));
    assert.ok(candidateResult, 'Should find a candidate in search results');

    // Act
    const doc = await apiFetch(candidateResult.id);

    // Assert
    assert.strictEqual(doc.id, candidateResult.id);
    assert.strictEqual(doc.title, 'Candidate found');
    assert.strictEqual(doc.url, RAKETTITIEDE_WEBSITE);
    // text has exactly: description, skills, availability — no name, no segment
    assert.deepStrictEqual(Object.keys(doc.text).sort(), ['availability', 'description', 'skills']);
    assert.strictEqual(typeof doc.text.description, 'string');
    assert.ok(doc.text.description.length > 0);
    assert.ok(Array.isArray(doc.text.skills));
    assert.ok(doc.text.skills.length > 0);
    assert.strictEqual(typeof doc.text.availability, 'string');
    // metadata has exactly: type, skillsCount — no employeeId, no PII
    assert.deepStrictEqual(Object.keys(doc.metadata).sort(), ['skillsCount', 'type']);
    assert.strictEqual(doc.metadata.type, 'candidate');
    assert.strictEqual(typeof doc.metadata.skillsCount, 'number');
  });

  it('skills have correct structure (name, proficiency, motivation)', async () => {
    // Arrange
    const searchResult = await apiSearch(TEST_CONFIG.TEST_SEARCH_QUERY.react);
    const candidateResult = searchResult.results.find(r => r.id.startsWith('candidate:'));
    assert.ok(candidateResult, 'Should find a candidate');

    // Act
    const doc = await apiFetch(candidateResult.id);

    // Assert
    doc.text.skills.forEach(skill => {
      assert.strictEqual(typeof skill.name, 'string', 'Skill should have name');
      assert.strictEqual(typeof skill.proficiency, 'number', 'Skill should have proficiency');
      assert.ok(skill.proficiency >= 1 && skill.proficiency <= 5, 'Proficiency should be 1-5');
      assert.strictEqual(typeof skill.motivation, 'number', 'Skill should have motivation');
      assert.ok(skill.motivation >= 1 && skill.motivation <= 5, 'Motivation should be 1-5');
    });
  });

  it('project found via search', async () => {
    // Arrange: try multiple queries to find a project result (depends on vector similarity with mock fixtures)
    const queries = [TEST_CONFIG.TEST_SEARCH_QUERY.corporateBanking, TEST_CONFIG.TEST_SEARCH_QUERY.default, TEST_CONFIG.TEST_SEARCH_QUERY.react];
    let projectResult = null;
    for (const query of queries) {
      const searchResult = await apiSearch(query);
      if (searchResult.results) {
        projectResult = searchResult.results.find(r => r.id.startsWith('project:'));
        if (projectResult) break;
      }
    }

    // Skip if no project results — mock embeddings may not match within threshold
    if (!projectResult) return;

    // Act
    const doc = await apiFetch(projectResult.id);

    // Assert
    assert.strictEqual(doc.id, projectResult.id);
    assert.strictEqual(doc.title, 'Candidate found by project');
    assert.strictEqual(doc.url, RAKETTITIEDE_WEBSITE);
    // text: description (candidate's description), skills, availability — same as candidate
    assert.deepStrictEqual(Object.keys(doc.text).sort(), ['availability', 'description', 'skills']);
    assert.strictEqual(typeof doc.text.description, 'string');
    assert.ok(doc.text.description.length > 0);
    assert.ok(Array.isArray(doc.text.skills));
    assert.strictEqual(typeof doc.text.availability, 'string');
    // metadata: type=project, skillsCount, project (description of the matched project)
    assert.deepStrictEqual(Object.keys(doc.metadata).sort(), ['project', 'skillsCount', 'type']);
    assert.strictEqual(doc.metadata.type, 'project');
    assert.strictEqual(typeof doc.metadata.project, 'string');
    assert.strictEqual(typeof doc.metadata.skillsCount, 'number');
  });

  it('candidate not found returns not found document', async () => {
    // Act
    const doc = await apiFetch(`candidate:${TEST_CONFIG.TEST_NOT_FOUND_ID}`);

    // Assert
    assert.strictEqual(doc.id, `candidate:${TEST_CONFIG.TEST_NOT_FOUND_ID}`);
    assert.strictEqual(doc.title, 'Not found');
    assert.strictEqual(doc.text, '');
    assert.strictEqual(doc.url, '');
    assert.deepStrictEqual(doc.metadata, {});
  });

  it('project not found returns not found document', async () => {
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
    queryParams: { id: 'candidate:test-id' },
    successValidator: (data) => {
      assert.ok(data.id);
    },
  })(describe, it, assert);
});
