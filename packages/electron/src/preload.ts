import { contextBridge, ipcRenderer } from 'electron';
import type { ListFilesOptions, FolderChildrenOptions } from '@archivault/core';
import type { UploadBatchOptions } from './main';

contextBridge.exposeInMainWorld('archivault', {
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (updates: Record<string, unknown>) => ipcRenderer.invoke('config:save', updates),
  },

  files: {
    list: (opts: ListFilesOptions) => ipcRenderer.invoke('files:list', opts),
    count: (opts: Omit<ListFilesOptions, 'limit' | 'offset' | 'orderBy' | 'orderDir'>) =>
      ipcRenderer.invoke('files:count', opts),
    get: (id: string) => ipcRenderer.invoke('files:get', id),
    uploadBatch: (opts: UploadBatchOptions) => ipcRenderer.invoke('files:uploadBatch', opts),
    download: (fileId: string, destDir: string) =>
      ipcRenderer.invoke('files:download', fileId, destDir),
    verify: (fileId: string) => ipcRenderer.invoke('files:verify', fileId),
    verifyBatch: (opts: { unverified?: boolean; limit?: number }) =>
      ipcRenderer.invoke('files:verifyBatch', opts),
    delete: (id: string) => ipcRenderer.invoke('files:delete', id),
    archive: (id: string) => ipcRenderer.invoke('files:archive', id),
  },

  tags: {
    add: (fileId: string, tag: string) => ipcRenderer.invoke('tags:add', fileId, tag),
    remove: (fileId: string, tag: string) => ipcRenderer.invoke('tags:remove', fileId, tag),
    list: () => ipcRenderer.invoke('tags:list'),
  },

  props: {
    set: (fileId: string, name: string, value: string) =>
      ipcRenderer.invoke('props:set', fileId, name, value),
    remove: (fileId: string, name: string) => ipcRenderer.invoke('props:remove', fileId, name),
    listNames: () => ipcRenderer.invoke('props:listNames'),
  },

  db: {
    setup: () => ipcRenderer.invoke('db:setup'),
  },

  folders: {
    listChildren: (parentPath: string | null, opts?: FolderChildrenOptions) =>
      ipcRenderer.invoke('folders:listChildren', parentPath, opts),
  },

  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  },

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const validChannels = ['uploadBatch:progress', 'download:progress', 'verify:progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    }
  },

  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
});
