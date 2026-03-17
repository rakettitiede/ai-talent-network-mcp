#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as vec from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabasePath } from '../src/storage.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '..', 'migrations');

function runMigrations() {
  const dbPath = getDatabasePath();
  console.log(`📊 Running migrations on: ${dbPath}`);
  
  const db = new Database(dbPath);
  
  // Load sqlite-vec extension (required for virtual tables)
  vec.load(db);
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  console.log(`Found ${files.length} migration files`);
  
  for (const file of files) {
    console.log(`  ⚡ Applying: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      db.exec(sql);
      console.log(`  ✅ Success: ${file}`);
    } catch (error) {
      console.error(`  ❌ Error in ${file}:`, error.message);
      db.close();
      process.exit(1);
    }
  }
  
  db.close();
  console.log('✨ All migrations completed successfully');
}

runMigrations();
