import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './client';
import { getFileById } from '../db/queries';
import { updateChecksumAfter } from '../db/queries';
import { sha256Stream } from '../utils/checksum';
import { createHash } from 'crypto';
import { Readable, Transform } from 'stream';
import type { S3Config } from './client';

export interface DownloadOptions {
  fileId: string;
  destDir: string;
  s3Config?: S3Config;
  verifyChecksum?: boolean;
  onProgress?: (loaded: number, total: number) => void;
}

export interface DownloadResult {
  destPath: string;
  checksum: string;
  fileSize: number;
  checksumMatch: boolean | null;
}

export async function downloadFile(opts: DownloadOptions): Promise<DownloadResult> {
  const { fileId, destDir, s3Config, verifyChecksum = true, onProgress } = opts;

  const record = await getFileById(fileId);
  if (!record) throw new Error(`File record not found: ${fileId}`);

  const client = getS3Client(s3Config);
  const response = await client.send(
    new GetObjectCommand({ Bucket: record.s3Bucket, Key: record.s3Key })
  );

  if (!response.Body) throw new Error('Empty response body from S3');

  const destPath = join(destDir, record.fileName);
  mkdirSync(dirname(destPath), { recursive: true });

  const fileSize = response.ContentLength ?? record.fileSize;
  const hash = createHash('sha256');
  let loaded = 0;

  const hashTransform = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      loaded += chunk.length;
      onProgress?.(loaded, fileSize);
      this.push(chunk);
      cb();
    },
  });

  const body = response.Body as Readable;
  const writer = createWriteStream(destPath);

  await pipeline(body, hashTransform, writer);

  const checksum = hash.digest('hex');

  if (verifyChecksum) {
    await updateChecksumAfter(fileId, checksum);
  }

  const checksumMatch = verifyChecksum ? checksum === record.checksumBefore : null;

  return { destPath, checksum, fileSize: loaded, checksumMatch };
}

export async function downloadByKey(
  bucket: string,
  s3Key: string,
  destPath: string,
  s3Config?: S3Config,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ checksum: string; fileSize: number }> {
  const client = getS3Client(s3Config);
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: s3Key })
  );

  if (!response.Body) throw new Error('Empty response body from S3');

  const fileSize = response.ContentLength ?? 0;
  const hash = createHash('sha256');
  let loaded = 0;

  const hashTransform = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      loaded += chunk.length;
      onProgress?.(loaded, fileSize);
      this.push(chunk);
      cb();
    },
  });

  mkdirSync(dirname(destPath), { recursive: true });
  const writer = createWriteStream(destPath);
  await pipeline(response.Body as Readable, hashTransform, writer);

  return { checksum: hash.digest('hex'), fileSize: loaded };
}
