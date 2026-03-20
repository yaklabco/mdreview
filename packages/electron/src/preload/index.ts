import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { MdviewPreloadAPI } from '../shared/preload-api';

const api: MdviewPreloadAPI = {
  // State
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  updatePreferences: (prefs) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PREFERENCES, prefs),

  // Cache
  cacheGenerateKey: (filePath, contentHash, theme, prefs) =>
    ipcRenderer.invoke(IPC_CHANNELS.CACHE_GENERATE_KEY, filePath, contentHash, theme, prefs),
  cacheGet: (key) => ipcRenderer.invoke(IPC_CHANNELS.CACHE_GET, key),
  cacheSet: (key, result) => ipcRenderer.invoke(IPC_CHANNELS.CACHE_SET, key, result),

  // File I/O
  readFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, path),
  writeFile: (path, content) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, path, content),
  checkFileChanged: (url, lastHash) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHECK_FILE_CHANGED, url, lastHash),
  watchFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.WATCH_FILE, path),
  unwatchFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_FILE, path),

  // Identity
  getUsername: () => ipcRenderer.invoke(IPC_CHANNELS.GET_USERNAME),

  // Export
  saveFile: (options) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE, options),
  printToPDF: (options) => ipcRenderer.invoke(IPC_CHANNELS.PRINT_TO_PDF, options),

  // File path
  getOpenFilePath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_OPEN_FILE_PATH),

  // Event listeners
  onFileChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.FILE_CHANGED, listener);
  },
  onPreferencesUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, prefs: Record<string, unknown>) =>
      callback(prefs);
    ipcRenderer.on(IPC_CHANNELS.PREFERENCES_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PREFERENCES_UPDATED, listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: string) => callback(theme);
    ipcRenderer.on(IPC_CHANNELS.THEME_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.THEME_CHANGED, listener);
  },
};

contextBridge.exposeInMainWorld('mdview', api);
