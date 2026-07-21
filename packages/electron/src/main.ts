import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, basename } from 'path';
import { statSync } from 'fs';
import {
  loadConfig,
  saveConfig,
  getDb,
  listFiles,
  countFiles,
  listDistinctTags,
  listDistinctPropertyNames,
  getFileById,
  uploadFile,
  collectUploadPaths,
  downloadFile,
  verifyFile,
  addTag,
  removeTag,
  setProperty,
  removeProperty,
  updateFileStatus,
  applyPgSchema,
} from '@archivault/core';
import type { ListFilesOptions, S3Config } from '@archivault/core';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, 'renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  const config = loadConfig();
  getDb(config.dbPath);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

function currentS3Config(): S3Config {
  const config = loadConfig();
  return { region: config.region, profile: config.profile, endpoint: config.endpoint };
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('config:load', () => loadConfig());
ipcMain.handle('config:save', (_e, updates: Record<string, unknown>) => {
  saveConfig(updates);
});

ipcMain.handle('files:list', async (_e, opts: ListFilesOptions) => {
  return listFiles(opts);
});

ipcMain.handle('files:count', async (_e, opts: Omit<ListFilesOptions, 'limit' | 'offset' | 'orderBy' | 'orderDir'>) => {
  return countFiles(opts);
});

ipcMain.handle('files:get', async (_e, id: string) => {
  return getFileById(id);
});

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

ipcMain.handle('files:uploadBatch', async (event, opts: UploadBatchOptions) => {
  const paths = collectUploadPaths(opts.sourcePath, opts.recursive);

  if (opts.dryRun) {
    return {
      dryRun: true as const,
      preview: paths.map((filePath) => ({ filePath, fileSize: statSync(filePath).size })),
      uploaded: 0,
      failed: 0,
      totalBytes: 0,
      results: [],
      errors: [],
    };
  }

  const results: Array<{ filePath: string; fileId: string; s3Key: string; fileSize: number }> = [];
  const errors: Array<{ filePath: string; message: string }> = [];
  let totalBytes = 0;

  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i];
    try {
      const result = await uploadFile({
        bucket: opts.bucket,
        filePath,
        uploadedBy: opts.uploadedBy,
        tags: opts.tags,
        properties: opts.properties,
        storageClass: opts.storageClass,
        s3Config: currentS3Config(),
        onProgress: (loaded, total) => {
          event.sender.send('uploadBatch:progress', {
            fileIndex: i,
            fileCount: paths.length,
            fileName: basename(filePath),
            loaded,
            total,
          });
        },
      });
      results.push({ filePath, fileId: result.fileId, s3Key: result.s3Key, fileSize: result.fileSize });
      totalBytes += result.fileSize;
    } catch (err: unknown) {
      errors.push({ filePath, message: (err as Error).message });
    }
  }

  return {
    dryRun: false as const,
    uploaded: results.length,
    failed: errors.length,
    totalBytes,
    results,
    errors,
  };
});

ipcMain.handle('files:download', async (event, fileId: string, destDir: string) => {
  return downloadFile({
    fileId,
    destDir,
    s3Config: currentS3Config(),
    verifyChecksum: true,
    onProgress: (loaded, total) => {
      event.sender.send('download:progress', { loaded, total });
    },
  });
});

ipcMain.handle('files:verify', async (_e, fileId: string) => {
  const file = await getFileById(fileId);
  if (!file) throw new Error(`File record not found: ${fileId}`);
  return verifyFile(file, currentS3Config());
});

ipcMain.handle('files:verifyBatch', async (event, opts: { unverified?: boolean; limit?: number }) => {
  let filesToVerify = await listFiles({
    status: 'active',
    limit: opts.limit ?? 100,
    orderBy: 'uploaded_at',
    orderDir: 'asc',
  });

  if (opts.unverified) {
    filesToVerify = filesToVerify.filter((f) => !f.lastVerifiedAt);
  }

  const results: Array<{ fileId: string; fileName: string; checksum: string; checksumMatch: boolean }> = [];
  const errors: Array<{ fileId: string; fileName: string; message: string }> = [];

  for (let i = 0; i < filesToVerify.length; i++) {
    const file = filesToVerify[i];
    event.sender.send('verify:progress', {
      fileIndex: i,
      fileCount: filesToVerify.length,
      fileName: file.fileName,
    });
    try {
      const result = await verifyFile(file, currentS3Config());
      results.push({ fileName: file.fileName, ...result });
    } catch (err: unknown) {
      errors.push({ fileId: file.id, fileName: file.fileName, message: (err as Error).message });
    }
  }

  return { results, errors };
});

ipcMain.handle('files:delete', async (_e, id: string) => {
  return updateFileStatus(id, 'deleted');
});

ipcMain.handle('files:archive', async (_e, id: string) => {
  return updateFileStatus(id, 'archived');
});

ipcMain.handle('tags:add', async (_e, fileId: string, tag: string) => addTag(fileId, tag));
ipcMain.handle('tags:remove', async (_e, fileId: string, tag: string) => removeTag(fileId, tag));
ipcMain.handle('tags:list', async () => listDistinctTags());

ipcMain.handle('props:set', async (_e, fileId: string, name: string, value: string) => setProperty(fileId, name, value));
ipcMain.handle('props:remove', async (_e, fileId: string, name: string) => removeProperty(fileId, name));
ipcMain.handle('props:listNames', async () => listDistinctPropertyNames());

ipcMain.handle('db:setup', async () => {
  const config = loadConfig();
  const dbType = config.database?.type ?? 'sqlite';
  if (dbType === 'postgres') {
    getDb();
    await applyPgSchema();
  } else {
    getDb(config.dbPath);
  }
  return { dbType };
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: defaultName });
  return result.canceled ? null : result.filePath;
});
