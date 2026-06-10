import { createReadStream } from 'fs';
import { PutObjectCommand, HeadObjectCommand, StorageClass } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import { getS3Client } from './client';
import { getFileInfo, MULTIPART_THRESHOLD, MULTIPART_PART_SIZE } from '../utils/file-info';
import { sha256File } from '../utils/checksum';
import { insertFile, insertFileTags, insertFileProperties } from '../db/queries';
import type { S3Config } from './client';

export interface UploadOptions {
  bucket: string;
  filePath: string;
  uploadedBy?: string;
  tags?: string[];
  properties?: Record<string, string>;
  storageClass?: string;
  s3Config?: S3Config;
  onProgress?: (loaded: number, total: number) => void;
}

export interface UploadResult {
  fileId: string;
  s3Key: string;
  checksum: string;
  fileSize: number;
}

export async function uploadFile(opts: UploadOptions): Promise<UploadResult> {
  const {
    bucket,
    filePath,
    uploadedBy,
    tags = [],
    properties = {},
    storageClass = 'STANDARD',
    s3Config,
    onProgress,
  } = opts;

  const client = getS3Client(s3Config);
  const info = getFileInfo(filePath);
  const checksumBefore = await sha256File(filePath);

  const fileId = uuidv4();
  const s3Key = `${uuidv4()}/${uuidv4()}`;

  if (info.fileSize >= MULTIPART_THRESHOLD) {
    await multipartUpload(client, bucket, s3Key, filePath, info.fileSize, storageClass, onProgress);
  } else {
    await singleUpload(client, bucket, s3Key, filePath, info.mimeType, storageClass, onProgress);
  }

  await insertFile({
    id: fileId,
    sourcePath: filePath,
    fileName: info.fileName,
    fileExtension: info.fileExtension,
    mimeType: info.mimeType,
    fileSize: info.fileSize,
    checksumBefore,
    checksumAfter: null,
    s3Bucket: bucket,
    s3Key,
    s3StorageClass: storageClass,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy ?? null,
    lastVerifiedAt: null,
    status: 'active',
  });

  await insertFileTags(fileId, tags);
  await insertFileProperties(fileId, properties);

  return { fileId, s3Key, checksum: checksumBefore, fileSize: info.fileSize };
}

async function singleUpload(
  client: ReturnType<typeof getS3Client>,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
  storageClass: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const { size } = require('fs').statSync(filePath) as { size: number };
  onProgress?.(0, size);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      StorageClass: storageClass as StorageClass,
    })
  );

  onProgress?.(size, size);
}

async function multipartUpload(
  client: ReturnType<typeof getS3Client>,
  bucket: string,
  key: string,
  filePath: string,
  fileSize: number,
  storageClass: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      StorageClass: storageClass as StorageClass,
    },
    partSize: MULTIPART_PART_SIZE,
    queueSize: 4,
    leavePartsOnError: false,
  });

  if (onProgress) {
    upload.on('httpUploadProgress', (progress) => {
      onProgress(progress.loaded ?? 0, fileSize);
    });
  }

  await upload.done();
}

export async function objectExists(bucket: string, key: string, s3Config?: S3Config): Promise<boolean> {
  const client = getS3Client(s3Config);
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
