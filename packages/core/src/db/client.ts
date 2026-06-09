import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb(dbPath?: string): ReturnType<typeof drizzle<typeof schema>> {
  if (_db) return _db;

  const resolvedPath = dbPath ?? defaultDbPath();
  mkdirSync(join(resolvedPath, '..'), { recursive: true });

  _sqlite = new Database(resolvedPath);
  applyPragmas(_sqlite);
  applySchema(_sqlite);

  _db = drizzle(_sqlite, { schema });
  return _db;
}

export function closeDb(): void {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}

export function defaultDbPath(): string {
  return join(homedir(), '.archivault', 'files.db');
}

function applyPragmas(sqlite: Database.Database): void {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('cache_size = -64000');  // 64 MB page cache
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('mmap_size = 268435456'); // 256 MB mmap
}

function applySchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_extension TEXT,
      mime_type TEXT,
      file_size INTEGER NOT NULL,
      checksum_before TEXT NOT NULL,
      checksum_after TEXT,
      s3_bucket TEXT NOT NULL,
      s3_key TEXT NOT NULL,
      s3_storage_class TEXT DEFAULT 'STANDARD',
      uploaded_at TEXT NOT NULL,
      last_verified_at TEXT,
      status TEXT DEFAULT 'active'
    );

    CREATE INDEX IF NOT EXISTS idx_files_source_path ON files(source_path);
    CREATE INDEX IF NOT EXISTS idx_files_file_name ON files(file_name);
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);
    CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum_before);
    CREATE INDEX IF NOT EXISTS idx_files_s3_key ON files(s3_key);
    CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);

    CREATE TABLE IF NOT EXISTS file_tags (
      file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (file_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);

    CREATE TABLE IF NOT EXISTS file_properties (
      file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (file_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_file_properties_name ON file_properties(name);
    CREATE INDEX IF NOT EXISTS idx_file_properties_name_value ON file_properties(name, value);
  `);
}
