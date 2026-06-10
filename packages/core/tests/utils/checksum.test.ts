import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { sha256File } from '../../src/utils/checksum';

let tmpFile: string;

beforeEach(() => {
  tmpFile = join(tmpdir(), `archivault-checksum-test-${Date.now()}.bin`);
});

afterEach(() => {
  try { unlinkSync(tmpFile); } catch { /* already gone */ }
});

describe('sha256File', () => {
  it('computes the correct hash for known content', async () => {
    const content = Buffer.from('archivault checksum test');
    const expected = createHash('sha256').update(content).digest('hex');
    writeFileSync(tmpFile, content);
    expect(await sha256File(tmpFile)).toBe(expected);
  });

  it('computes the known hash for an empty file', async () => {
    writeFileSync(tmpFile, Buffer.alloc(0));
    // SHA256 of empty input is always this value
    expect(await sha256File(tmpFile)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('produces a 64-character hex string', async () => {
    writeFileSync(tmpFile, 'hello');
    const hash = await sha256File(tmpFile);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different content', async () => {
    const file2 = `${tmpFile}.2`;
    writeFileSync(tmpFile, 'content-one');
    writeFileSync(file2, 'content-two');
    try {
      const h1 = await sha256File(tmpFile);
      const h2 = await sha256File(file2);
      expect(h1).not.toBe(h2);
    } finally {
      try { unlinkSync(file2); } catch { /* ignore */ }
    }
  });

  it('produces the same hash on repeated reads', async () => {
    writeFileSync(tmpFile, 'stable content');
    const h1 = await sha256File(tmpFile);
    const h2 = await sha256File(tmpFile);
    expect(h1).toBe(h2);
  });
});
