import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, '../fixtures/agileday');

const fixtures = {};

export function loadFixtures() {
  const fixtureFiles = [
    'employee',
    'history_project',
    'project',
    'opening',
    'allocation_reporting'
  ];

  for (const name of fixtureFiles) {
    const filePath = join(FIXTURES_DIR, `${name}.json`);
    try {
      const content = readFileSync(filePath, 'utf-8');
      fixtures[name] = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load fixture ${name}:`, error.message);
      fixtures[name] = [];
    }
  }

  return fixtures;
}

export function getFixture(name) {
  if (!fixtures[name]) {
    loadFixtures();
  }
  return fixtures[name] || [];
}

export function getFixtureCount() {
  return Object.keys(fixtures).length;
}
