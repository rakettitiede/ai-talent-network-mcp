#!/usr/bin/env node
/**
 * Standalone script to capture OpenAI embeddings for refresh test fixtures
 * 
 * This script reads Agileday fixtures and calls OpenAI API to generate embeddings.
 * Run this ONCE with a real OpenAI API key to capture fixtures for refresh operations.
 * 
 * Usage:
 *   export OPENAI_KEY=<your-openai-key>
 *   node test/scripts/capture-refresh-embeddings.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { TEST_CONFIG } from '../config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '../../test/fixtures');
const AGILEDAY_DIR = join(FIXTURES_DIR, 'agileday');
const EMBEDDINGS_DIR = join(FIXTURES_DIR, 'openai-embeddings');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';

// Ensure embeddings directory exists
if (!existsSync(EMBEDDINGS_DIR)) {
  mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

// Get OpenAI API key from environment
const OPENAI_KEY = process.env.OPENAI_KEY;
if (!OPENAI_KEY) {
  console.error('❌ OPENAI_KEY environment variable is required');
  console.error('   Set it with: export OPENAI_KEY=<your-openai-key>');
  process.exit(1);
}

/**
 * Generate hash for text (SHA256, first 16 chars)
 */
function generateHash(text) {
  return createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Call OpenAI API to generate embedding
 */
async function generateEmbedding(text) {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  return await response.json();
}

/**
 * Save fixture to disk
 */
function saveFixture(hash, text, response) {
  const fixturePath = join(EMBEDDINGS_DIR, `${hash}.json`);
  const fixture = {
    text,
    model: EMBEDDING_MODEL,
    response,
  };
  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
}

/**
 * Process a single text and save fixture
 */
async function processText(text, type, index) {
  const hash = generateHash(text);
  const fixturePath = join(EMBEDDINGS_DIR, `${hash}.json`);

  // Skip if fixture already exists (idempotent)
  if (existsSync(fixturePath)) {
    console.log(`⏭️  Skipping ${type} #${index + 1} (fixture already exists): ${text.substring(0, 50)}...`);
    return;
  }

  try {
    console.log(`📸 Capturing embedding for ${type} #${index + 1}: ${text.substring(0, 50)}...`);
    const response = await generateEmbedding(text);
    saveFixture(hash, text, response);
    console.log(`   ✅ Saved: ${hash}.json`);
  } catch (error) {
    console.error(`   ❌ Failed to capture ${type} #${index + 1}:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting embedding capture for refresh test fixtures...\n');

  // Read Agileday fixtures
  const employeePath = join(AGILEDAY_DIR, 'employee.json');
  const projectPath = join(AGILEDAY_DIR, 'history_project.json');

  if (!existsSync(employeePath)) {
    console.error(`❌ Employee fixture not found: ${employeePath}`);
    process.exit(1);
  }

  if (!existsSync(projectPath)) {
    console.error(`❌ Project fixture not found: ${projectPath}`);
    process.exit(1);
  }

  const employees = JSON.parse(readFileSync(employeePath, 'utf-8'));
  const projects = JSON.parse(readFileSync(projectPath, 'utf-8'));

  console.log(`📊 Found ${employees.length} employees and ${projects.length} projects\n`);

  // Process employee externalDescription fields
  console.log('👥 Processing employee descriptions...');
  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    if (employee.externalDescription) {
      await processText(employee.externalDescription, 'employee', i);
    }
  }

  // Process project description fields
  console.log('\n📁 Processing project descriptions...');
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    if (project.description) {
      await processText(project.description, 'project', i);
    }
  }

  const searchQueries = [...new Set(
    Object.values(TEST_CONFIG.TEST_SEARCH_QUERY)
      .filter(v => typeof v === 'string' && v.length > 0)
      .map(v => String(v.toLowerCase()).replace(/\s+/g, ' ').trim())
  )];

  console.log('\n🔍 Processing search queries...');
  for (let i = 0; i < searchQueries.length; i++) {
    await processText(searchQueries[i], 'search-query', i);
  }

  console.log('\n🎉 Embedding capture complete!');
  console.log(`   Fixtures saved to: ${EMBEDDINGS_DIR}`);
  console.log('\n💡 Next step: Run test/scripts/generate-fixture-index.mjs to update the index');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
