import { eq } from 'drizzle-orm';
import { getDb, getActiveTables } from './client';
import { enrichWithMeta } from './queries';
import type { FileWithMeta } from './schema';

export interface FolderChildrenOptions {
  status?: string;
}

export interface FolderEntry {
  name: string;
  path: string;
  itemCount: number;
}

export interface FolderListing {
  path: string | null;
  folders: FolderEntry[];
  files: FileWithMeta[];
}

function toSegments(rawPath: string): string[] {
  return rawPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0);
}

export async function listFolderChildren(
  parentPath: string | null,
  opts: FolderChildrenOptions = {}
): Promise<FolderListing> {
  const { status = 'active' } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();

  const where = status ? eq(files.status, status) : undefined;

  const rows = await db.query.files.findMany({
    where,
    columns: {
      id: true,
      sourcePath: true,
      fileName: true,
      fileExtension: true,
      mimeType: true,
      fileSize: true,
      checksumBefore: true,
      checksumAfter: true,
      s3Bucket: true,
      s3Key: true,
      s3StorageClass: true,
      uploadedAt: true,
      uploadedBy: true,
      lastVerifiedAt: true,
      status: true,
    },
  });

  const targetSegments = parentPath ? toSegments(parentPath) : [];
  const subfolderCounts = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exactMatchRows: any[] = [];

  for (const row of rows) {
    const folderSegments = toSegments(row.sourcePath).slice(0, -1);
    if (folderSegments.length < targetSegments.length) continue;

    let isDescendant = true;
    for (let i = 0; i < targetSegments.length; i++) {
      if (folderSegments[i] !== targetSegments[i]) {
        isDescendant = false;
        break;
      }
    }
    if (!isDescendant) continue;

    if (folderSegments.length === targetSegments.length) {
      exactMatchRows.push(row);
    } else {
      const childName = folderSegments[targetSegments.length];
      subfolderCounts.set(childName, (subfolderCounts.get(childName) ?? 0) + 1);
    }
  }

  const folders: FolderEntry[] = Array.from(subfolderCounts.entries())
    .map(([name, itemCount]) => ({
      name,
      path: targetSegments.length ? `${targetSegments.join('/')}/${name}` : name,
      itemCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  return {
    path: parentPath,
    folders,
    files: await enrichWithMeta(exactMatchRows),
  };
}
