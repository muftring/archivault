import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import {
  loadConfig,
  saveConfig,
  getDb,
  listFiles,
  getFileById,
  uploadFile,
  downloadFile,
  addTag,
  removeTag,
  setProperty,
  removeProperty,
  updateFileStatus,
} from '@s3sync/core';
import type { ListFilesOptions, UploadOptions } from '@s3sync/core';

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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../src/renderer/index.html'));
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

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('config:load', () => loadConfig());
ipcMain.handle('config:save', (_e, updates: Record<string, string>) => {
  saveConfig(updates);
});

ipcMain.handle('files:list', async (_e, opts: ListFilesOptions) => {
  return listFiles(opts);
});

ipcMain.handle('files:get', async (_e, id: string) => {
  return getFileById(id);
});

ipcMain.handle('files:upload', async (event, opts: UploadOptions) => {
  return uploadFile({
    ...opts,
    onProgress: (loaded, total) => {
      event.sender.send('upload:progress', { loaded, total });
    },
  });
});

ipcMain.handle('files:download', async (event, fileId: string, destDir: string) => {
  const config = loadConfig();
  return downloadFile({
    fileId,
    destDir,
    s3Config: { region: config.region, profile: config.profile },
    verifyChecksum: true,
    onProgress: (loaded, total) => {
      event.sender.send('download:progress', { loaded, total });
    },
  });
});

ipcMain.handle('files:delete', async (_e, id: string) => {
  return updateFileStatus(id, 'deleted');
});

ipcMain.handle('files:archive', async (_e, id: string) => {
  return updateFileStatus(id, 'archived');
});

ipcMain.handle('tags:add', async (_e, fileId: string, tag: string) => addTag(fileId, tag));
ipcMain.handle('tags:remove', async (_e, fileId: string, tag: string) => removeTag(fileId, tag));
ipcMain.handle('props:set', async (_e, fileId: string, name: string, value: string) => setProperty(fileId, name, value));
ipcMain.handle('props:remove', async (_e, fileId: string, name: string) => removeProperty(fileId, name));

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, defaultName: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: defaultName });
  return result.canceled ? null : result.filePath;
});
