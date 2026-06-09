import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    sourcePath: text('source_path').notNull(),
    fileName: text('file_name').notNull(),
    fileExtension: text('file_extension'),
    mimeType: text('mime_type'),
    fileSize: integer('file_size').notNull(),
    checksumBefore: text('checksum_before').notNull(),
    checksumAfter: text('checksum_after'),
    s3Bucket: text('s3_bucket').notNull(),
    s3Key: text('s3_key').notNull(),
    s3StorageClass: text('s3_storage_class').default('STANDARD'),
    uploadedAt: text('uploaded_at').notNull(),
    lastVerifiedAt: text('last_verified_at'),
    status: text('status').default('active'),
  },
  (t) => ({
    sourcePathIdx: index('idx_files_source_path').on(t.sourcePath),
    fileNameIdx: index('idx_files_file_name').on(t.fileName),
    uploadedAtIdx: index('idx_files_uploaded_at').on(t.uploadedAt),
    checksumIdx: index('idx_files_checksum').on(t.checksumBefore),
    s3KeyIdx: index('idx_files_s3_key').on(t.s3Key),
    statusIdx: index('idx_files_status').on(t.status),
  })
);

export const fileTags = sqliteTable(
  'file_tags',
  {
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fileId, t.tag] }),
    tagIdx: index('idx_file_tags_tag').on(t.tag),
    fileIdIdx: index('idx_file_tags_file_id').on(t.fileId),
  })
);

export const fileProperties = sqliteTable(
  'file_properties',
  {
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    value: text('value').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fileId, t.name] }),
    nameIdx: index('idx_file_properties_name').on(t.name),
    nameValueIdx: index('idx_file_properties_name_value').on(t.name, t.value),
  })
);

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type FileTag = typeof fileTags.$inferSelect;
export type FileProperty = typeof fileProperties.$inferSelect;

export type FileWithMeta = File & {
  tags: string[];
  properties: Record<string, string>;
};
