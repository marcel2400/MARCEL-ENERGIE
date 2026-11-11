'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { openDb } = require('./db');
const { searchAddresses } = require('./adresse');

let db = null;
let mainWindow = null;

const BACKUP_DIR_NAME = 'sauvegardes';
const MAX_BACKUPS = 30;

function userDataDir() {
  return app.getPath('userData');
}

function dbPath() {
  return path.join(userDataDir(), 'atelier.db');
}

function backupDir() {
  const dir = path.join(userDataDir(), BACKUP_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeBackupName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.db`;
}

function createBackup(label = '') {
  const dir = backupDir();
  const base = label ? `sauvegarde-${label}.db` : safeBackupName();
  const target = path.join(dir, base);
  fs.copyFileSync(dbPath(), target);
  pruneBackups();
  return base;
}

function pruneBackups() {
  const dir = backupDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
  while (files.length > MAX_BACKUPS) {
    const oldest = files.shift();
    try { fs.unlinkSync(path.join(dir, oldest)); } catch { /* ignoré */ }
  }
}

function listBackups() {
  const dir = backupDir();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse()
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { name: f, size: st.size, date: st.mtime.toISOString() };
    });
}

function isValidDbFile(filePath) {
  try {
    const test = openDb(filePath);
    test.clientsList('', 1);
    test.close();
    return true;
  } catch {
    return false;
  }
}

function closeDbAndReplace(source) {
  createBackup('avant-restauration');
  db.close();
  fs.copyFileSync(source, dbPath());
  for (const suffix of ['-wal', '-shm']) {
    const f = dbPath() + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  app.relaunch();
  app.exit(0);
}

function registerIpc() {
  ipcMain.handle('clients:list', (_e, query, limit) => db.clientsList(query, limit));
  ipcMain.handle('clients:get', (_e, id) => db.clientGet(id));
  ipcMain.handle('clients:save', (_e, data) => db.clientSave(data));
  ipcMain.handle('clients:delete', (_e, id) => db.clientDelete(id));
  ipcMain.handle('clients:duplicates', (_e, data, excludeId) => db.clientDuplicates(data, excludeId));

  ipcMain.handle('search:global', (_e, query) => db.globalSearch(query));

  ipcMain.handle('adresse:search', (_e, query) => searchAddresses(query));

  ipcMain.handle('stats:get', () => db.stats());

  ipcMain.handle('settings:get', (_e, key) => db.settingGet(key));
  ipcMain.handle('settings:set', (_e, key, value) => db.settingSet(key, value));

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dbPath: dbPath(),
    backupDir: backupDir(),
    platform: process.platform,
  }));

  ipcMain.handle('backups:create', (_e, label) => {
    try {
      const name = createBackup(label);
      return { ok: true, name };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('backups:list', () => listBackups());

  ipcMain.handle('backups:restore', (_e, name) => {
    const dir = backupDir();
    const source = path.join(dir, path.basename(name));
    if (!fs.existsSync(source)) return { ok: false, error: 'Sauvegarde introuvable.' };
    if (!isValidDbFile(source)) return { ok: false, error: 'Fichier de sauvegarde invalide.' };
    closeDbAndReplace(source);
    return { ok: true };
  });

  ipcMain.handle('backups:import', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer une base de données',
      filters: [{ name: 'Base de données', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, error: 'Annulé.' };
    const file = res.filePaths[0];
    if (!isValidDbFile(file)) return { ok: false, error: 'Ce fichier n’est pas une base Atelier Manager valide.' };
    closeDbAndReplace(file);
    return { ok: true };
  });

  ipcMain.handle('backups:export', async () => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter une copie de la base',
      defaultPath: 'atelier-export.db',
      filters: [{ name: 'Base de données', extensions: ['db'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, error: 'Annulé.' };
    fs.copyFileSync(dbPath(), res.filePath);
    return { ok: true, path: res.filePath };
  });

  ipcMain.handle('shell:openPath', (_e, target) => shell.openPath(target));
  ipcMain.handle('shell:external', (_e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return true;
  });
}

function autoBackupOnStart() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const done = db.settingGet('last_auto_backup');
    if (done !== today) {
      createBackup();
      db.settingSet('last_auto_backup', today);
    }
  } catch (err) {
    console.error('Sauvegarde automatique impossible :', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#f4f6fa',
    autoHideMenuBar: true,
    title: 'Atelier Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  db = openDb(dbPath());
  autoBackupOnStart();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('Erreur non gérée :', err);
});
