import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { insertFile } from '../../src/db/queries';
import { listFolderChildren } from '../../src/db/folders';
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

describe('listFolderChildren', () => {
  it('derives multiple top-level roots at the virtual root', async () => {
    await insertFile(makeFile({ id: 'a', sourcePath: '/Users/alice/photo.jpg', fileName: 'photo.jpg' }));
    await insertFile(makeFile({ id: 'b', sourcePath: '/home/bob/doc.pdf', fileName: 'doc.pdf' }));

    const root = await listFolderChildren(null);
    const names = root.folders.map((f) => f.name);
    expect(names).toContain('Users');
    expect(names).toContain('home');
    expect(root.files).toHaveLength(0);
  });

  it('lists a file with no directory component at the virtual root', async () => {
    await insertFile(makeFile({ id: 'rootfile', sourcePath: '/img.jpg', fileName: 'img.jpg' }));

    const root = await listFolderChildren(null);
    expect(root.files.map((f) => f.id)).toContain('rootfile');
  });

  it('classifies exact-depth files vs deeper descendants correctly', async () => {
    await insertFile(makeFile({ id: 'direct', sourcePath: '/Users/alice/notes.txt', fileName: 'notes.txt' }));
    await insertFile(makeFile({ id: 'nested', sourcePath: '/Users/alice/Photos/img.jpg', fileName: 'img.jpg' }));

    const listing = await listFolderChildren('Users/alice');
    expect(listing.files.map((f) => f.id)).toEqual(['direct']);
    expect(listing.folders.map((f) => f.name)).toEqual(['Photos']);
  });

  it('handles mixed backslash and forward-slash paths in the same dataset', async () => {
    await insertFile(makeFile({ id: 'win', sourcePath: 'C:\\Users\\alice\\Photos\\img.jpg', fileName: 'img.jpg' }));
    await insertFile(makeFile({ id: 'unix', sourcePath: '/Users/alice/Photos/img2.jpg', fileName: 'img2.jpg' }));

    const root = await listFolderChildren(null);
    const names = root.folders.map((f) => f.name);
    expect(names).toContain('C:');
    expect(names).toContain('Users');

    const winPhotos = await listFolderChildren('C:/Users/alice/Photos');
    expect(winPhotos.files.map((f) => f.id)).toEqual(['win']);
  });

  it('computes a recursive item count for subfolders', async () => {
    await insertFile(makeFile({ id: 'a', sourcePath: '/Users/alice/Photos/2024/a.jpg', fileName: 'a.jpg' }));
    await insertFile(makeFile({ id: 'b', sourcePath: '/Users/alice/Photos/2024/b.jpg', fileName: 'b.jpg' }));
    await insertFile(makeFile({ id: 'c', sourcePath: '/Users/alice/Photos/c.jpg', fileName: 'c.jpg' }));

    const listing = await listFolderChildren('Users/alice');
    const photos = listing.folders.find((f) => f.name === 'Photos');
    expect(photos?.itemCount).toBe(3);
  });

  it('defaults to active status, hiding folders that only contain archived/deleted files', async () => {
    await insertFile(makeFile({ id: 'archived', sourcePath: '/Users/alice/Old/file.txt', status: 'archived' }));

    const listing = await listFolderChildren('Users/alice');
    expect(listing.folders.map((f) => f.name)).not.toContain('Old');

    const withArchived = await listFolderChildren('Users/alice', { status: 'archived' });
    expect(withArchived.folders.map((f) => f.name)).toContain('Old');
  });

  it('returns an empty listing for a folder with no children', async () => {
    await insertFile(makeFile({ id: 'a', sourcePath: '/Users/alice/file.txt' }));

    const listing = await listFolderChildren('Users/alice/EmptyFolder');
    expect(listing.folders).toEqual([]);
    expect(listing.files).toEqual([]);
  });
});
