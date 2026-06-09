import { statSync } from 'fs';
import { basename, extname } from 'path';
import { lookup as mimeLookup } from 'mime-types';

export interface FileInfo {
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
}

export function getFileInfo(filePath: string): FileInfo {
  const stats = statSync(filePath);
  const fileName = basename(filePath);
  const fileExtension = extname(filePath).toLowerCase().replace(/^\./, '');
  const mimeType = (mimeLookup(filePath) || 'application/octet-stream') as string;

  return {
    fileName,
    fileExtension,
    mimeType,
    fileSize: stats.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024;   // 8 MB
