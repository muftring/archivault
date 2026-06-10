import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type DatabaseType = 'sqlite' | 'postgres';

export interface SqliteConfig {
  path?: string;
}

export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface DatabaseConfig {
  type?: DatabaseType;
  sqlite?: SqliteConfig;
  postgres?: PostgresConfig;
}

export interface AppConfig {
  bucket: string;
  region: string;
  profile?: string;
  storageClass: string;
  /** @deprecated Use database.sqlite.path instead */
  dbPath?: string;
  endpoint?: string;
  database?: DatabaseConfig;
}

function getConfigDir(): string {
  return process.env.ARCHIVAULT_CONFIG_DIR ?? join(homedir(), '.archivault');
}

const DEFAULTS: AppConfig = {
  bucket: '',
  region: 'us-east-1',
  storageClass: 'INTELLIGENT_TIERING',
};

export function configPath(): string {
  return join(getConfigDir(), 'config.json');
}

export function loadConfig(): AppConfig {
  const file = configPath();
  if (!existsSync(file)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(update: Partial<AppConfig>): void {
  mkdirSync(getConfigDir(), { recursive: true });
  const current = loadConfig();
  const merged: AppConfig = { ...current, ...update };
  if (update.database !== undefined) {
    const cur = current.database ?? {};
    const upd = update.database;
    merged.database = {
      ...cur,
      ...upd,
      sqlite:
        upd.sqlite !== undefined || cur.sqlite !== undefined
          ? { ...(cur.sqlite ?? {}), ...(upd.sqlite ?? {}) }
          : undefined,
      postgres:
        upd.postgres !== undefined || cur.postgres !== undefined
          ? { ...(cur.postgres ?? {}), ...(upd.postgres ?? {}) }
          : undefined,
    };
  }
  writeFileSync(configPath(), JSON.stringify(merged, null, 2));
}
