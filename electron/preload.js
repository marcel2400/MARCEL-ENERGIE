'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atelier', {
  clientsList: (query, limit) => ipcRenderer.invoke('clients:list', query, limit),
  clientGet: (id) => ipcRenderer.invoke('clients:get', id),
  clientSave: (data) => ipcRenderer.invoke('clients:save', data),
  clientDelete: (id) => ipcRenderer.invoke('clients:delete', id),
  clientDuplicates: (data, excludeId) => ipcRenderer.invoke('clients:duplicates', data, excludeId),

  globalSearch: (query) => ipcRenderer.invoke('search:global', query),

  adresseSearch: (query) => ipcRenderer.invoke('adresse:search', query),

  stats: () => ipcRenderer.invoke('stats:get'),

  settingGet: (key) => ipcRenderer.invoke('settings:get', key),
  settingSet: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  appInfo: () => ipcRenderer.invoke('app:info'),

  backupsCreate: (label) => ipcRenderer.invoke('backups:create', label),
  backupsList: () => ipcRenderer.invoke('backups:list'),
  backupsRestore: (name) => ipcRenderer.invoke('backups:restore', name),
  backupsImport: () => ipcRenderer.invoke('backups:import'),
  backupsExport: () => ipcRenderer.invoke('backups:export'),

  openPath: (target) => ipcRenderer.invoke('shell:openPath', target),
  openExternal: (url) => ipcRenderer.invoke('shell:external', url),
});
