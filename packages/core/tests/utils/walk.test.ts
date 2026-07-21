import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { collectUploadPaths } from '../../src/utils/walk';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'archivault-walk-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('collectUploadPaths', () => {
  it('returns a single file path unchanged', () => {
    const file = join(dir, 'solo.txt');
    writeFileSync(file, 'content');
    expect(collectUploadPaths(file, false)).toEqual([file]);
  });

  it('returns only top-level files when non-recursive', () => {
    writeFileSync(join(dir, 'a.txt'), 'a');
    writeFileSync(join(dir, 'b.txt'), 'b');
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'c.txt'), 'c');

    const results = collectUploadPaths(dir, false);
    expect(results).toHaveLength(2);
    expect(results).toContain(join(dir, 'a.txt'));
    expect(results).toContain(join(dir, 'b.txt'));
  });

  it('recurses into subdirectories when recursive is true', () => {
    writeFileSync(join(dir, 'a.txt'), 'a');
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'c.txt'), 'c');
    mkdirSync(join(dir, 'nested', 'deeper'));
    writeFileSync(join(dir, 'nested', 'deeper', 'd.txt'), 'd');

    const results = collectUploadPaths(dir, true);
    expect(results).toHaveLength(3);
    expect(results).toContain(join(dir, 'a.txt'));
    expect(results).toContain(join(dir, 'nested', 'c.txt'));
    expect(results).toContain(join(dir, 'nested', 'deeper', 'd.txt'));
  });

  it('returns an empty array for an empty directory', () => {
    expect(collectUploadPaths(dir, true)).toEqual([]);
  });
});
