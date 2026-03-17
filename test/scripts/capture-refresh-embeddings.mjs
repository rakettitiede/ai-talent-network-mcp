#!/usr/bin/env node
/**
 * Standalone script to capture Vertex AI embeddings for refresh test fixtures
 *
 * Reads Agileday fixtures and TEST_SEARCH_QUERY values, calls Vertex AI to generate embeddings.
 * Run ONCE with application default credentials to capture fixtures.
 *
 * Usage:
 *   gcloud auth application-default login
 *   node test/scripts/capture-refresh-embeddings.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { TEST_CONFIG } from '../config.mjs';
import { GCP_SCOPE, GCP_VERTEX_URL } from '../../src/constants.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '../../test/fixtures');
const AGILEDAY_DIR = join(FIXTURES_DIR, 'agileday');
const EMBEDDINGS_DIR = join(FIXTURES_DIR, 'vertex-ai-embeddings');

if (!existsSync(EMBEDDINGS_DIR)) {
  mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

function generateHash(text) {
  return createHash('sha256').update(text).digest('hex').substring(0, 16);
}

const auth = new GoogleAuth({ scopes: [GCP_SCOPE] });
const client = await auth.getClient();

async function generateEmbedding(text) {
  const { data } = await client.request({
    url: GCP_VERTEX_URL,
    method: 'POST',
    data: { instances: [{ content: text }] },
  });
  return data;
}

async function captureFixture(text) {
  const hash = generateHash(text);
  const fixturePath = join(EMBEDDINGS_DIR, `${hash}.json`);

  if (existsSync(fixturePath)) {
    console.log(`⏭️  Skipping (already captured): "${text.substring(0, 60)}"`);
    return;
  }

  try {
    const response = await generateEmbedding(text);
    const fixture = { text, model: 'text-embedding-005', response };
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
    console.log(`✅ Captured: "${text.substring(0, 60)}"`);
  } catch (error) {
    console.error(`❌ Failed to capture "${text.substring(0, 60)}":`, error.message);
  }
}

// Collect texts from Agileday fixtures (employee externalDescriptions + project descriptions)
const textsToCapture = new Set();

// Employee externalDescriptions
const employeePath = join(AGILEDAY_DIR, 'employee.json');
if (existsSync(employeePath)) {
  const data = JSON.parse(readFileSync(employeePath, 'utf-8'));
  const employees = Array.isArray(data) ? data : [data];
  for (const emp of employees) {
    if (emp.externalDescription) textsToCapture.add(emp.externalDescription);
  }
}

// Project descriptions (separate fixture — /api/v1/history_project)
const projectPath = join(AGILEDAY_DIR, 'history_project.json');
if (existsSync(projectPath)) {
  const data = JSON.parse(readFileSync(projectPath, 'utf-8'));
  const projects = Array.isArray(data) ? data : [data];
  for (const proj of projects) {
    if (proj.description) textsToCapture.add(proj.description);
  }
}

// Collect search query strings from TEST_CONFIG
for (const value of Object.values(TEST_CONFIG.TEST_SEARCH_QUERY)) {
  if (typeof value === 'string' && value.trim()) {
    textsToCapture.add(value.toLowerCase().replace(/\s+/g, ' ').trim());
  }
}

console.log(`📋 Capturing embeddings for ${textsToCapture.size} unique texts...`);
for (const text of textsToCapture) {
  await captureFixture(text);
}
console.log('✨ Done! Run node test/scripts/generate-fixture-index.mjs next.');
