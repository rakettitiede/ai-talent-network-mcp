#!/usr/bin/env node
/**
 * Generates an index file mapping text inputs to fixture hashes
 * Run this after capturing fixtures to generate test/fixtures/openai-embeddings/index.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../../test/fixtures/openai-embeddings');
const INDEX_FILE = join(FIXTURES_DIR, 'index.mjs');

if (!existsSync(FIXTURES_DIR)) {
  console.error(`❌ Fixtures directory not found: ${FIXTURES_DIR}`);
  console.error('   Run tests first to capture fixtures.');
  process.exit(1);
}

const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
const index = {};

console.log(`📦 Processing ${files.length} fixture files...`);

for (const file of files) {
  try {
    const fixturePath = join(FIXTURES_DIR, file);
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const hash = file.replace('.json', '');
    
    // Verify fixture structure
    if (!fixture.text || !fixture.response || !fixture.response.data || !fixture.response.data[0]) {
      console.warn(`⚠️  Skipping invalid fixture ${file}: missing required fields`);
      continue;
    }
    
    // Verify embedding array exists and has correct length
    const embedding = fixture.response.data[0].embedding;
    if (!Array.isArray(embedding) || embedding.length !== 1536) {
      console.warn(`⚠️  Skipping fixture ${file}: invalid embedding (expected 1536 dimensions, got ${embedding?.length || 0})`);
      continue;
    }
    
    index[fixture.text] = hash;
  } catch (error) {
    console.warn(`⚠️  Failed to process fixture ${file}:`, error.message);
  }
}

const indexContent = `// This file is auto-generated after fixtures are captured
// It maps text inputs to fixture file hashes for easier lookup
// 
// To regenerate this index after capturing new fixtures, run:
// node test/scripts/generate-fixture-index.mjs

export default ${JSON.stringify(index, null, 2)};
`;

writeFileSync(INDEX_FILE, indexContent);
console.log(`✅ Generated fixture index with ${Object.keys(index).length} entries`);
console.log(`   Index file: ${INDEX_FILE}`);
