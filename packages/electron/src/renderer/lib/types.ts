import type {
  AppConfig,
  DatabaseType,
  FileWithMeta,
  ListFilesOptions,
  FolderChildrenOptions,
  FolderEntry,
  FolderListing,
} from '@archivault/core';

export type { AppConfig, DatabaseType, FileWithMeta, ListFilesOptions, FolderChildrenOptions, FolderEntry, FolderListing };

export interface UploadBatchOptions {
  bucket: string;
  sourcePath: string;
  recursive: boolean;
  storageClass?: string;
  uploadedBy?: string;
  tags?: string[];
  properties?: Record<string, string>;
  dryRun?: boolean;
}

export interface UploadBatchPreviewItem {
  filePath: string;
  fileSize: number;
}

export interface UploadBatchFileResult {
  filePath: string;
  fileId: string;
  s3Key: string;
  fileSize: number;
}

export interface UploadBatchFileError {
  filePath: string;
  message: string;
}

export interface UploadBatchResult {
  dryRun: boolean;
  preview?: UploadBatchPreviewItem[];
  uploaded: number;
  failed: number;
  totalBytes: number;
  results: UploadBatchFileResult[];
  errors: UploadBatchFileError[];
}

export interface VerifyResult {
  fileId: string;
  checksum: string;
  checksumMatch: boolean;
}

export interface VerifyBatchResult {
  results: Array<{ fileId: string; fileName: string; checksum: string; checksumMatch: boolean }>;
  errors: Array<{ fileId: string; fileName: string; message: string }>;
}

export interface UploadBatchProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  loaded: number;
  total: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

export interface VerifyProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
}

export interface DownloadResult {
  destPath: string;
  checksum: string;
  fileSize: number;
  checksumMatch: boolean | null;
}

export type FileFilterState = Omit<ListFilesOptions, 'limit' | 'offset'>;

declare global {
  interface Window {
    archivault: {
      config: {
        load: () => Promise<AppConfig>;
        save: (updates: Partial<AppConfig>) => Promise<void>;
      };
      files: {
        list: (opts: ListFilesOptions) => Promise<FileWithMeta[]>;
        count: (opts: Omit<ListFilesOptions, 'limit' | 'offset' | 'orderBy' | 'orderDir'>) => Promise<number>;
        get: (id: string) => Promise<FileWithMeta | null>;
        uploadBatch: (opts: UploadBatchOptions) => Promise<UploadBatchResult>;
        download: (fileId: string, destDir: string) => Promise<DownloadResult>;
        verify: (fileId: string) => Promise<VerifyResult>;
        verifyBatch: (opts: { unverified?: boolean; limit?: number }) => Promise<VerifyBatchResult>;
        delete: (id: string) => Promise<void>;
        archive: (id: string) => Promise<void>;
      };
      tags: {
        add: (fileId: string, tag: string) => Promise<void>;
        remove: (fileId: string, tag: string) => Promise<void>;
        list: () => Promise<string[]>;
      };
      props: {
        set: (fileId: string, name: string, value: string) => Promise<void>;
        remove: (fileId: string, name: string) => Promise<void>;
        listNames: () => Promise<string[]>;
      };
      db: {
        setup: () => Promise<{ dbType: string }>;
      };
      folders: {
        listChildren: (parentPath: string | null, opts?: FolderChildrenOptions) => Promise<FolderListing>;
      };
      dialog: {
        openDirectory: () => Promise<string | null>;
        saveFile: (name: string) => Promise<string | null>;
      };
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
      off: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}
