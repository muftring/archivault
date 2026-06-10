import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, saveConfig, configPath } from '../src/config';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `archivault-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
  vi.stubEnv('ARCHIVAULT_CONFIG_DIR', testDir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(testDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('');
    expect(cfg.region).toBe('us-east-1');
    expect(cfg.storageClass).toBe('INTELLIGENT_TIERING');
    expect(cfg.database).toBeUndefined();
  });

  it('merges file values over defaults', () => {
    writeFileSync(
      join(testDir, 'config.json'),
      JSON.stringify({ bucket: 'my-bucket', region: 'eu-west-1' })
    );
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('my-bucket');
    expect(cfg.region).toBe('eu-west-1');
    expect(cfg.storageClass).toBe('INTELLIGENT_TIERING'); // default preserved
  });

  it('returns defaults on malformed JSON', () => {
    writeFileSync(join(testDir, 'config.json'), '{ bad json }');
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('');
    expect(cfg.region).toBe('us-east-1');
  });

  it('loads nested database config', () => {
    writeFileSync(
      join(testDir, 'config.json'),
      JSON.stringify({
        database: {
          type: 'postgres',
          postgres: { host: 'db.example.com', port: 5433, username: 'admin' },
        },
      })
    );
    const cfg = loadConfig();
    expect(cfg.database?.type).toBe('postgres');
    expect(cfg.database?.postgres?.host).toBe('db.example.com');
    expect(cfg.database?.postgres?.port).toBe(5433);
    expect(cfg.database?.postgres?.username).toBe('admin');
  });
});

describe('saveConfig', () => {
  it('creates the config file', () => {
    saveConfig({ bucket: 'test-bucket' });
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('test-bucket');
  });

  it('merges with existing config (top-level fields)', () => {
    saveConfig({ bucket: 'first-bucket' });
    saveConfig({ region: 'ap-southeast-1' });
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('first-bucket');
    expect(cfg.region).toBe('ap-southeast-1');
  });

  it('deep-merges database.postgres without clobbering other database fields', () => {
    saveConfig({ database: { type: 'postgres', postgres: { host: 'localhost', port: 5432 } } });
    saveConfig({ database: { postgres: { username: 'admin', password: 'secret' } } });
    const cfg = loadConfig();
    expect(cfg.database?.type).toBe('postgres');
    expect(cfg.database?.postgres?.host).toBe('localhost');
    expect(cfg.database?.postgres?.port).toBe(5432);
    expect(cfg.database?.postgres?.username).toBe('admin');
    expect(cfg.database?.postgres?.password).toBe('secret');
  });

  it('deep-merges database.sqlite without losing other database keys', () => {
    saveConfig({ database: { type: 'sqlite', sqlite: { path: '/old/path' } } });
    saveConfig({ database: { sqlite: { path: '/new/path' } } });
    const cfg = loadConfig();
    expect(cfg.database?.type).toBe('sqlite');
    expect(cfg.database?.sqlite?.path).toBe('/new/path');
  });

  it('a top-level update preserves existing database config', () => {
    saveConfig({ database: { type: 'postgres', postgres: { host: 'db.host' } } });
    saveConfig({ bucket: 'new-bucket' });
    const cfg = loadConfig();
    expect(cfg.bucket).toBe('new-bucket');
    expect(cfg.database?.type).toBe('postgres');
    expect(cfg.database?.postgres?.host).toBe('db.host');
  });
});

describe('configPath', () => {
  it('reflects the ARCHIVAULT_CONFIG_DIR env var', () => {
    expect(configPath()).toBe(join(testDir, 'config.json'));
  });
});
