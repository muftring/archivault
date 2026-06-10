import { beforeEach, afterEach, vi } from 'vitest';
import { getDb, closeDb } from '../src/db/client';

/**
 * Sets up an isolated in-memory SQLite database for each test and tears it
 * down afterwards. Also stubs ARCHIVAULT_CONFIG_DIR so loadConfig() returns
 * plain defaults (type=sqlite) regardless of any real config on the machine.
 */
export function setupTestDb(): void {
  beforeEach(() => {
    vi.stubEnv('ARCHIVAULT_CONFIG_DIR', '/nonexistent-archivault-test-dir');
    getDb(':memory:');
  });

  afterEach(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
}
