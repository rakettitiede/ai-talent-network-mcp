import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { TEST_CONFIG } from '../test/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBEDDINGS_DIR = join(__dirname, '../test/fixtures/openai-embeddings');

const queries = Object.entries(TEST_CONFIG.TEST_SEARCH_QUERY)
  .filter(([, v]) => typeof v === 'string' && v.length > 0)
  .map(([key, v]) => ({
    key,
    raw: v,
    normalized: String(v.toLowerCase()).replace(/\s+/g, ' ').trim(),
  }));

const missing = queries.filter(({ normalized }) => {
  const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  return !existsSync(join(EMBEDDINGS_DIR, `${hash}.json`));
});

if (missing.length === 0) {
  console.log(`✅ All ${queries.length} search query fixtures present`);
  process.exit(0);
} else {
  console.error(`\n ${'='.repeat(60)}`);
  console.error(` _______________________________________________`);
  console.error(`< ❌ Missing OpenAI embedding fixtures for tests >`);
  console.error(` -----------------------------------------------`);
  console.error(`        \\   ^__^`);
  console.error(`         \\  (oo)\\_______`);
  console.error(`            (__)\\       )\\/\\`);
  console.error(`                ||----w |`);
  console.error(`                ||     ||`);
  console.error(`\n📋 Missing fixtures:`);
  for (const { key, raw } of missing) {
    console.error(`     • TEST_SEARCH_QUERY.${key}: '${raw.substring(0, 50)}${raw.length > 50 ? '...' : ''}'`);
  }
  console.error(`\n💡 Tip: Run these commands to capture the missing fixtures:`);
  console.error(`     export OPENAI_KEY=<your-key>`);
  console.error(`     node test/scripts/capture-refresh-embeddings.mjs`);
  console.error(`     node test/scripts/generate-fixture-index.mjs`);
  console.error(`${'='.repeat(60)}\n`);
  process.exit(1);
}
