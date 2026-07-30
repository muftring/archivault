import { mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { downloadByKey } from './download';
import { updateChecksumAfter } from '../db/queries';
import type { S3Config } from './client';
import type { FileWithMeta } from '../db/schema';

export interface VerifyResult {
  fileId: string;
  checksum: string;
  checksumMatch: boolean;
}

export async function verifyFile(
  file: Pick<FileWithMeta, 'id' | 's3Bucket' | 's3Key' | 'checksumBefore'>,
  s3Config?: S3Config,
  onProgress?: (loaded: number, total: number) => void
): Promise<VerifyResult> {
  const tmpDir = join(tmpdir(), 'archivault-verify');
  mkdirSync(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, file.id);

  try {
    const { checksum } = await downloadByKey(file.s3Bucket, file.s3Key, tmpPath, s3Config, onProgress);
    await updateChecksumAfter(file.id, checksum);
    return { fileId: file.id, checksum, checksumMatch: checksum === file.checksumBefore };
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // already removed or never written
    }
  }
}
