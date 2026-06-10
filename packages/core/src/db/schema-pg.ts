import { pgTable, text, integer, index, primaryKey } from 'drizzle-orm/pg-core';

export const files = pgTable(
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
    uploadedBy: text('uploaded_by'),
    lastVerifiedAt: text('last_verified_at'),
    status: text('status').default('active'),
  },
  (t) => ({
    sourcePathIdx: index('idx_files_source_path').on(t.sourcePath),
    fileNameIdx: index('idx_files_file_name').on(t.fileName),
    uploadedAtIdx: index('idx_files_uploaded_at').on(t.uploadedAt),
    uploadedByIdx: index('idx_files_uploaded_by').on(t.uploadedBy),
    checksumIdx: index('idx_files_checksum').on(t.checksumBefore),
    s3KeyIdx: index('idx_files_s3_key').on(t.s3Key),
    statusIdx: index('idx_files_status').on(t.status),
  })
);

export const fileTags = pgTable(
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

export const fileProperties = pgTable(
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
