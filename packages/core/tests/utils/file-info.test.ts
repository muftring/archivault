import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getFileInfo, formatBytes } from '../../src/utils/file-info';

let tmpFile: string;

afterEach(() => {
  try { unlinkSync(tmpFile); } catch { /* already gone */ }
});

describe('getFileInfo', () => {
  it('returns correct fileName', () => {
    tmpFile = join(tmpdir(), 'report.pdf');
    writeFileSync(tmpFile, 'pdf content');
    expect(getFileInfo(tmpFile).fileName).toBe('report.pdf');
  });

  it('returns correct fileExtension (without dot, lowercase)', () => {
    tmpFile = join(tmpdir(), 'Photo.JPG');
    writeFileSync(tmpFile, 'jpeg data');
    expect(getFileInfo(tmpFile).fileExtension).toBe('jpg');
  });

  it('returns empty string for files without an extension', () => {
    tmpFile = join(tmpdir(), 'Makefile');
    writeFileSync(tmpFile, 'make content');
    expect(getFileInfo(tmpFile).fileExtension).toBe('');
  });

  it('returns correct MIME type for common extensions', () => {
    tmpFile = join(tmpdir(), 'style.css');
    writeFileSync(tmpFile, 'body {}');
    expect(getFileInfo(tmpFile).mimeType).toBe('text/css');
  });

  it('falls back to application/octet-stream for unknown extensions', () => {
    tmpFile = join(tmpdir(), 'data.xyz123');
    writeFileSync(tmpFile, 'binary');
    expect(getFileInfo(tmpFile).mimeType).toBe('application/octet-stream');
  });

  it('returns the correct fileSize in bytes', () => {
    tmpFile = join(tmpdir(), 'sized.txt');
    const content = 'hello world'; // 11 bytes
    writeFileSync(tmpFile, content);
    expect(getFileInfo(tmpFile).fileSize).toBe(11);
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes (< 1 KB)', () => {
    expect(formatBytes(512)).toBe('512.00 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.00 TB');
  });
});
