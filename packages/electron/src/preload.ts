import { contextBridge, ipcRenderer } from 'electron';
import type { ListFilesOptions, UploadOptions } from '@archivault/core';

contextBridge.exposeInMainWorld('archivault', {
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (updates: Record<string, string>) => ipcRenderer.invoke('config:save', updates),
  },

  files: {
    list: (opts: ListFilesOptions) => ipcRenderer.invoke('files:list', opts),
    get: (id: string) => ipcRenderer.invoke('files:get', id),
    upload: (opts: UploadOptions) => ipcRenderer.invoke('files:upload', opts),
    download: (fileId: string, destDir: string) =>
      ipcRenderer.invoke('files:download', fileId, destDir),
    delete: (id: string) => ipcRenderer.invoke('files:delete', id),
    archive: (id: string) => ipcRenderer.invoke('files:archive', id),
  },

  tags: {
    add: (fileId: string, tag: string) => ipcRenderer.invoke('tags:add', fileId, tag),
    remove: (fileId: string, tag: string) => ipcRenderer.invoke('tags:remove', fileId, tag),
  },

  props: {
    set: (fileId: string, name: string, value: string) =>
      ipcRenderer.invoke('props:set', fileId, name, value),
    remove: (fileId: string, name: string) => ipcRenderer.invoke('props:remove', fileId, name),
  },

  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  },

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const validChannels = ['upload:progress', 'download:progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    }
  },

  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
});
