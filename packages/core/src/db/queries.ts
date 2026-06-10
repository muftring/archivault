import { eq, like, gte, lte, and, inArray, desc, asc, sql } from 'drizzle-orm';
import { getDb, getActiveTables } from './client';
import type { NewFile, FileWithMeta } from './schema';

export interface ListFilesOptions {
  pathPrefix?: string;
  fileName?: string;
  fromDate?: string;
  toDate?: string;
  uploadedBy?: string;
  tags?: string[];
  propertyName?: string;
  propertyValue?: string;
  status?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'uploaded_at' | 'file_name' | 'file_size';
  orderDir?: 'asc' | 'desc';
}

export async function insertFile(record: NewFile): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();
  await db.insert(files).values(record);
}

export async function insertFileTags(fileId: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileTags } = getActiveTables();
  await db.insert(fileTags).values(tags.map((tag) => ({ fileId, tag })));
}

export async function insertFileProperties(
  fileId: string,
  props: Record<string, string>
): Promise<void> {
  const entries = Object.entries(props);
  if (entries.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileProperties } = getActiveTables();
  await db
    .insert(fileProperties)
    .values(entries.map(([name, value]) => ({ fileId, name, value })));
}

export async function getFileById(id: string): Promise<FileWithMeta | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();
  const row = await db.query.files.findFirst({ where: eq(files.id, id) });
  if (!row) return null;
  return enrichWithMeta([row]).then((r) => r[0] ?? null);
}

export async function getFileByS3Key(s3Key: string): Promise<FileWithMeta | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();
  const row = await db.query.files.findFirst({ where: eq(files.s3Key, s3Key) });
  if (!row) return null;
  return enrichWithMeta([row]).then((r) => r[0] ?? null);
}

export async function listFiles(opts: ListFilesOptions = {}): Promise<FileWithMeta[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files, fileTags, fileProperties } = getActiveTables();

  const {
    pathPrefix,
    fileName,
    fromDate,
    toDate,
    uploadedBy,
    tags,
    propertyName,
    propertyValue,
    status = 'active',
    limit = 50,
    offset = 0,
    orderBy = 'uploaded_at',
    orderDir = 'desc',
  } = opts;

  const conditions = [];

  if (status) conditions.push(eq(files.status, status));
  if (pathPrefix) conditions.push(like(files.sourcePath, `${pathPrefix}%`));
  if (fileName) conditions.push(like(files.fileName, `%${fileName}%`));
  if (fromDate) conditions.push(gte(files.uploadedAt, fromDate));
  if (toDate) conditions.push(lte(files.uploadedAt, toDate));
  if (uploadedBy) conditions.push(eq(files.uploadedBy, uploadedBy));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderCol =
    orderBy === 'file_name'
      ? files.fileName
      : orderBy === 'file_size'
      ? files.fileSize
      : files.uploadedAt;
  const orderFn = orderDir === 'asc' ? asc : desc;

  let rows = await db.query.files.findMany({
    where,
    limit,
    offset,
    orderBy: orderFn(orderCol),
  });

  if (tags && tags.length > 0) {
    const taggedIds = await db
      .select({ fileId: fileTags.fileId })
      .from(fileTags)
      .where(inArray(fileTags.tag, tags))
      .groupBy(fileTags.fileId)
      .having(sql`count(distinct ${fileTags.tag}) = ${tags.length}`);
    const ids = new Set(taggedIds.map((r: { fileId: string }) => r.fileId));
    rows = rows.filter((r: { id: string }) => ids.has(r.id));
  }

  if (propertyName) {
    const propConditions = [eq(fileProperties.name, propertyName)];
    if (propertyValue) propConditions.push(eq(fileProperties.value, propertyValue));
    const propIds = await db
      .select({ fileId: fileProperties.fileId })
      .from(fileProperties)
      .where(and(...propConditions));
    const ids = new Set(propIds.map((r: { fileId: string }) => r.fileId));
    rows = rows.filter((r: { id: string }) => ids.has(r.id));
  }

  return enrichWithMeta(rows);
}

export async function updateChecksumAfter(id: string, checksum: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();
  await db
    .update(files)
    .set({ checksumAfter: checksum, lastVerifiedAt: new Date().toISOString() })
    .where(eq(files.id, id));
}

export async function updateFileStatus(
  id: string,
  status: 'active' | 'deleted' | 'archived'
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { files } = getActiveTables();
  await db.update(files).set({ status }).where(eq(files.id, id));
}

export async function addTag(fileId: string, tag: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileTags } = getActiveTables();
  await db.insert(fileTags).values({ fileId, tag }).onConflictDoNothing();
}

export async function removeTag(fileId: string, tag: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileTags } = getActiveTables();
  await db
    .delete(fileTags)
    .where(and(eq(fileTags.fileId, fileId), eq(fileTags.tag, tag)));
}

export async function setProperty(
  fileId: string,
  name: string,
  value: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileProperties } = getActiveTables();
  await db
    .insert(fileProperties)
    .values({ fileId, name, value })
    .onConflictDoUpdate({ target: [fileProperties.fileId, fileProperties.name], set: { value } });
}

export async function removeProperty(fileId: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileProperties } = getActiveTables();
  await db
    .delete(fileProperties)
    .where(and(eq(fileProperties.fileId, fileId), eq(fileProperties.name, name)));
}

async function enrichWithMeta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[]
): Promise<FileWithMeta[]> {
  if (rows.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;
  const { fileTags, fileProperties } = getActiveTables();
  const ids = rows.map((r) => r.id);

  const [tagRows, propRows] = await Promise.all([
    db.select().from(fileTags).where(inArray(fileTags.fileId, ids)),
    db.select().from(fileProperties).where(inArray(fileProperties.fileId, ids)),
  ]);

  const tagMap = new Map<string, string[]>();
  for (const t of tagRows) {
    if (!tagMap.has(t.fileId)) tagMap.set(t.fileId, []);
    tagMap.get(t.fileId)!.push(t.tag);
  }

  const propMap = new Map<string, Record<string, string>>();
  for (const p of propRows) {
    if (!propMap.has(p.fileId)) propMap.set(p.fileId, {});
    propMap.get(p.fileId)![p.name] = p.value;
  }

  return rows.map((r) => ({
    ...r,
    tags: tagMap.get(r.id) ?? [],
    properties: propMap.get(r.id) ?? {},
  }));
}
