import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import {
  insertFile,
  insertFileTags,
  insertFileProperties,
  getFileById,
  getFileByS3Key,
  listFiles,
  addTag,
  removeTag,
  setProperty,
  removeProperty,
  updateChecksumAfter,
  updateFileStatus,
} from '../../src/db/queries';
import type { NewFile } from '../../src/db/schema';
import { setupTestDb } from '../helpers';

setupTestDb();

function makeFile(overrides: Partial<NewFile> = {}): NewFile {
  return {
    id: randomUUID(),
    sourcePath: '/home/user/photos/img.jpg',
    fileName: 'img.jpg',
    fileExtension: 'jpg',
    mimeType: 'image/jpeg',
    fileSize: 204800,
    checksumBefore: randomUUID().replace(/-/g, ''),
    checksumAfter: null,
    s3Bucket: 'my-archive',
    s3Key: `objects/${randomUUID()}`,
    s3StorageClass: 'INTELLIGENT_TIERING',
    uploadedAt: '2024-06-01T12:00:00.000Z',
    uploadedBy: null,
    lastVerifiedAt: null,
    status: 'active',
    ...overrides,
  };
}

describe('insertFile / getFileById', () => {
  it('inserts and retrieves a file', async () => {
    const file = makeFile();
    await insertFile(file);
    const result = await getFileById(file.id);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(file.id);
    expect(result!.fileName).toBe('img.jpg');
    expect(result!.s3Bucket).toBe('my-archive');
    expect(result!.tags).toEqual([]);
    expect(result!.properties).toEqual({});
  });

  it('returns null for an unknown id', async () => {
    const result = await getFileById(randomUUID());
    expect(result).toBeNull();
  });

  it('stores uploadedBy', async () => {
    const file = makeFile({ uploadedBy: 'alice' });
    await insertFile(file);
    const result = await getFileById(file.id);
    expect(result!.uploadedBy).toBe('alice');
  });
});

describe('getFileByS3Key', () => {
  it('retrieves a file by its S3 key', async () => {
    const file = makeFile({ s3Key: 'objects/unique-key-abc' });
    await insertFile(file);
    const result = await getFileByS3Key('objects/unique-key-abc');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(file.id);
  });

  it('returns null for an unknown S3 key', async () => {
    expect(await getFileByS3Key('no/such/key')).toBeNull();
  });
});

describe('listFiles', () => {
  it('returns active files by default', async () => {
    await insertFile(makeFile({ id: 'a', status: 'active' }));
    await insertFile(makeFile({ id: 'b', status: 'deleted' }));
    const results = await listFiles();
    expect(results.map((f) => f.id)).toContain('a');
    expect(results.map((f) => f.id)).not.toContain('b');
  });

  it('filters by explicit status', async () => {
    await insertFile(makeFile({ id: 'c', status: 'archived' }));
    await insertFile(makeFile({ id: 'd', status: 'active' }));
    const results = await listFiles({ status: 'archived' });
    expect(results.map((f) => f.id)).toContain('c');
    expect(results.map((f) => f.id)).not.toContain('d');
  });

  it('filters by pathPrefix', async () => {
    await insertFile(makeFile({ id: 'e', sourcePath: '/docs/report.pdf' }));
    await insertFile(makeFile({ id: 'f', sourcePath: '/photos/sunset.jpg' }));
    const results = await listFiles({ pathPrefix: '/docs' });
    expect(results.map((f) => f.id)).toContain('e');
    expect(results.map((f) => f.id)).not.toContain('f');
  });

  it('filters by fileName substring', async () => {
    await insertFile(makeFile({ id: 'g', fileName: 'annual-report-2024.pdf' }));
    await insertFile(makeFile({ id: 'h', fileName: 'photo.jpg' }));
    const results = await listFiles({ fileName: 'annual' });
    expect(results.map((f) => f.id)).toContain('g');
    expect(results.map((f) => f.id)).not.toContain('h');
  });

  it('filters by uploadedBy', async () => {
    await insertFile(makeFile({ id: 'i', uploadedBy: 'alice' }));
    await insertFile(makeFile({ id: 'j', uploadedBy: 'bob' }));
    const results = await listFiles({ uploadedBy: 'alice' });
    expect(results.map((f) => f.id)).toContain('i');
    expect(results.map((f) => f.id)).not.toContain('j');
  });

  it('filters by date range', async () => {
    await insertFile(makeFile({ id: 'k', uploadedAt: '2023-01-15T00:00:00.000Z' }));
    await insertFile(makeFile({ id: 'l', uploadedAt: '2024-03-20T00:00:00.000Z' }));
    await insertFile(makeFile({ id: 'm', uploadedAt: '2025-06-01T00:00:00.000Z' }));
    const results = await listFiles({
      fromDate: '2024-01-01T00:00:00.000Z',
      toDate: '2024-12-31T00:00:00.000Z',
    });
    const ids = results.map((f) => f.id);
    expect(ids).not.toContain('k');
    expect(ids).toContain('l');
    expect(ids).not.toContain('m');
  });

  it('respects limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await insertFile(makeFile({ id: `page-${i}`, uploadedAt: `2024-0${i + 1}-01T00:00:00.000Z` }));
    }
    const page1 = await listFiles({ limit: 2, offset: 0, orderBy: 'uploaded_at', orderDir: 'asc' });
    const page2 = await listFiles({ limit: 2, offset: 2, orderBy: 'uploaded_at', orderDir: 'asc' });
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].id).toBe('page-0');
    expect(page2[0].id).toBe('page-2');
  });

  it('sorts ascending and descending', async () => {
    await insertFile(makeFile({ id: 'older', uploadedAt: '2023-01-01T00:00:00.000Z' }));
    await insertFile(makeFile({ id: 'newer', uploadedAt: '2025-01-01T00:00:00.000Z' }));
    const asc = await listFiles({ orderBy: 'uploaded_at', orderDir: 'asc' });
    const desc = await listFiles({ orderBy: 'uploaded_at', orderDir: 'desc' });
    expect(asc[0].id).toBe('older');
    expect(desc[0].id).toBe('newer');
  });
});

describe('tags', () => {
  it('insertFileTags stores tags and enriches file', async () => {
    const file = makeFile({ id: 'tagged-1' });
    await insertFile(file);
    await insertFileTags(file.id, ['nature', 'landscape']);
    const result = await getFileById(file.id);
    expect(result!.tags).toHaveLength(2);
    expect(result!.tags).toContain('nature');
    expect(result!.tags).toContain('landscape');
  });

  it('addTag adds a tag', async () => {
    const file = makeFile({ id: 'tagged-2' });
    await insertFile(file);
    await addTag(file.id, 'important');
    const result = await getFileById(file.id);
    expect(result!.tags).toContain('important');
  });

  it('addTag is idempotent', async () => {
    const file = makeFile({ id: 'tagged-3' });
    await insertFile(file);
    await addTag(file.id, 'dedup');
    await addTag(file.id, 'dedup');
    const result = await getFileById(file.id);
    expect(result!.tags.filter((t) => t === 'dedup')).toHaveLength(1);
  });

  it('removeTag removes a tag', async () => {
    const file = makeFile({ id: 'tagged-4' });
    await insertFile(file);
    await insertFileTags(file.id, ['keep', 'drop']);
    await removeTag(file.id, 'drop');
    const result = await getFileById(file.id);
    expect(result!.tags).toContain('keep');
    expect(result!.tags).not.toContain('drop');
  });

  it('listFiles filters by tags (all tags must match)', async () => {
    const a = makeFile({ id: 'tfilter-a' });
    const b = makeFile({ id: 'tfilter-b' });
    const c = makeFile({ id: 'tfilter-c' });
    await insertFile(a);
    await insertFile(b);
    await insertFile(c);
    await insertFileTags(a.id, ['x', 'y']);
    await insertFileTags(b.id, ['x']);
    await insertFileTags(c.id, ['y']);
    // both tags → only a matches
    const results = await listFiles({ tags: ['x', 'y'], limit: 100 });
    const ids = results.map((f) => f.id);
    expect(ids).toContain('tfilter-a');
    expect(ids).not.toContain('tfilter-b');
    expect(ids).not.toContain('tfilter-c');
  });
});

describe('properties', () => {
  it('insertFileProperties stores properties and enriches file', async () => {
    const file = makeFile({ id: 'prop-1' });
    await insertFile(file);
    await insertFileProperties(file.id, { camera: 'Canon EOS', iso: '400' });
    const result = await getFileById(file.id);
    expect(result!.properties).toEqual({ camera: 'Canon EOS', iso: '400' });
  });

  it('setProperty creates a new property', async () => {
    const file = makeFile({ id: 'prop-2' });
    await insertFile(file);
    await setProperty(file.id, 'location', 'Paris');
    const result = await getFileById(file.id);
    expect(result!.properties.location).toBe('Paris');
  });

  it('setProperty updates an existing property', async () => {
    const file = makeFile({ id: 'prop-3' });
    await insertFile(file);
    await setProperty(file.id, 'rating', '3');
    await setProperty(file.id, 'rating', '5');
    const result = await getFileById(file.id);
    expect(result!.properties.rating).toBe('5');
  });

  it('removeProperty removes a property', async () => {
    const file = makeFile({ id: 'prop-4' });
    await insertFile(file);
    await insertFileProperties(file.id, { keep: 'yes', drop: 'no' });
    await removeProperty(file.id, 'drop');
    const result = await getFileById(file.id);
    expect(result!.properties).toEqual({ keep: 'yes' });
  });

  it('listFiles filters by property name', async () => {
    const a = makeFile({ id: 'pfilter-a' });
    const b = makeFile({ id: 'pfilter-b' });
    await insertFile(a);
    await insertFile(b);
    await setProperty(a.id, 'project', 'alpha');
    const results = await listFiles({ propertyName: 'project', limit: 100 });
    const ids = results.map((f) => f.id);
    expect(ids).toContain('pfilter-a');
    expect(ids).not.toContain('pfilter-b');
  });

  it('listFiles filters by property name and value', async () => {
    const a = makeFile({ id: 'pfilter-c' });
    const b = makeFile({ id: 'pfilter-d' });
    await insertFile(a);
    await insertFile(b);
    await setProperty(a.id, 'status', 'approved');
    await setProperty(b.id, 'status', 'pending');
    const results = await listFiles({ propertyName: 'status', propertyValue: 'approved', limit: 100 });
    const ids = results.map((f) => f.id);
    expect(ids).toContain('pfilter-c');
    expect(ids).not.toContain('pfilter-d');
  });
});

describe('updateChecksumAfter', () => {
  it('updates checksumAfter and sets lastVerifiedAt', async () => {
    const file = makeFile({ id: 'cksum-1' });
    await insertFile(file);
    expect((await getFileById(file.id))!.checksumAfter).toBeNull();
    expect((await getFileById(file.id))!.lastVerifiedAt).toBeNull();

    await updateChecksumAfter(file.id, 'abcdef1234567890');
    const updated = await getFileById(file.id);
    expect(updated!.checksumAfter).toBe('abcdef1234567890');
    expect(updated!.lastVerifiedAt).not.toBeNull();
  });
});

describe('updateFileStatus', () => {
  it('updates the status field', async () => {
    const file = makeFile({ id: 'status-1' });
    await insertFile(file);
    await updateFileStatus(file.id, 'archived');
    const updated = await getFileById(file.id);
    expect(updated!.status).toBe('archived');
  });

  it('archived files do not appear in default listing', async () => {
    const file = makeFile({ id: 'status-2' });
    await insertFile(file);
    await updateFileStatus(file.id, 'archived');
    const results = await listFiles();
    expect(results.map((f) => f.id)).not.toContain('status-2');
  });
});
