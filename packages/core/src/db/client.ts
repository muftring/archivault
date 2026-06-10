import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { PoolConfig } from 'pg';
import * as sqliteSchema from './schema';
import * as pgSchema from './schema-pg';
import { loadConfig } from '../config';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

type ActiveSchema = typeof sqliteSchema | typeof pgSchema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _sqlite: Database.Database | null = null;
let _pool: Pool | null = null;
let _activeSchema: ActiveSchema = sqliteSchema;

export function getDb(dbPath?: string): ReturnType<typeof drizzleSqlite<typeof sqliteSchema>> {
  if (_db) return _db;

  const config = loadConfig();
  const dbType = config.database?.type ?? 'sqlite';

  if (dbType === 'postgres') {
    const pg = config.database?.postgres ?? {};
    const poolConfig: PoolConfig = {
      host: pg.host ?? 'localhost',
      port: pg.port ?? 5432,
      database: pg.database ?? 'archivault',
      user: pg.username,
      password: pg.password,
    };
    if (pg.ssl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    if (pg.schema) {
      poolConfig.options = `-c search_path=${pg.schema},public`;
    }
    _pool = new Pool(poolConfig);
    _activeSchema = pgSchema;
    _db = drizzlePg(_pool, { schema: pgSchema });
  } else {
    const resolvedPath =
      dbPath ??
      config.database?.sqlite?.path ??
      config.dbPath ??
      defaultDbPath();
    if (resolvedPath !== ':memory:') {
      mkdirSync(join(resolvedPath, '..'), { recursive: true });
    }
    _sqlite = new Database(resolvedPath);
    applyPragmas(_sqlite);
    applySchema(_sqlite);
    _activeSchema = sqliteSchema;
    _db = drizzleSqlite(_sqlite, { schema: sqliteSchema });
  }

  return _db;
}

export function getActiveTables(): ActiveSchema {
  return _activeSchema;
}

export async function applyPgSchema(): Promise<void> {
  if (!_pool) throw new Error('Postgres pool not initialized. Call getDb() first.');
  const client = await _pool.connect();
  try {
    await client.query(SCHEMA_SQL);
    // Idempotent migrations for existing databases
    await client.query(
      'ALTER TABLE files ADD COLUMN IF NOT EXISTS uploaded_by TEXT'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)'
    );
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  _sqlite?.close();
  _sqlite = null;
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
  _db = null;
  _activeSchema = sqliteSchema;
}

export function defaultDbPath(): string {
  return join(homedir(), '.archivault', 'files.db');
}

function applyPragmas(sqlite: Database.Database): void {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('cache_size = -64000');
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('mmap_size = 268435456');
}

function applySchema(sqlite: Database.Database): void {
  sqlite.exec(SCHEMA_SQL);
  migrate(sqlite);
}

function migrate(sqlite: Database.Database): void {
  const cols = (
    sqlite.prepare('PRAGMA table_info(files)').all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!cols.includes('uploaded_by')) {
    sqlite.exec('ALTER TABLE files ADD COLUMN uploaded_by TEXT');
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)');
  }
}

const SCHEMA_SQL = `
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
    uploaded_by TEXT,
    last_verified_at TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE INDEX IF NOT EXISTS idx_files_source_path ON files(source_path);
  CREATE INDEX IF NOT EXISTS idx_files_file_name ON files(file_name);
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files(uploaded_at);
  CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
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
`;
