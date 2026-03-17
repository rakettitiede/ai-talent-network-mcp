import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../fixtures/openai-embeddings');

/**
 * Hash text using the same algorithm as fixture naming
 * @param {string} text - The text to hash
 * @returns {string} First 16 characters of SHA256 hash
 */
function hashText(text) {
  return createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Loads all fixtures from disk and creates an in-memory map
 * @returns {Map<string, object>} Map of text hash -> fixture response
 */
export function loadFixtures() {
  const fixtureMap = new Map();
  
  if (!existsSync(FIXTURES_DIR)) {
    console.warn(`⚠️  Fixtures directory not found: ${FIXTURES_DIR}`);
    return fixtureMap;
  }
  
  try {
    const files = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const fixturePath = join(FIXTURES_DIR, file);
        const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
        
        // Store by text hash for lookup (filename hash equals text hash, so store once)
        if (fixture.text) {
          const textHash = hashText(fixture.text);
          fixtureMap.set(textHash, fixture.response);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load fixture ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Error loading fixtures:`, error.message);
  }
  
  return fixtureMap;
}

/**
 * Looks up a fixture by input text
 * @param {string} text - The text to look up
 * @param {Map<string, object>} fixtureMap - The fixture map
 * @returns {object|null} The fixture response or null if not found
 */
export function lookupFixture(text, fixtureMap) {
  const hash = hashText(text);
  return fixtureMap.get(hash) || null;
}

