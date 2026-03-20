import { ipcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { StateManager } from './state-manager';
import type { ElectronFileAdapter } from './adapters/file-adapter';
import type { ElectronIdentityAdapter } from './adapters/identity-adapter';
import type { ElectronExportAdapter } from './adapters/export-adapter';
import type { CacheManager, CachedResult, Preferences } from '@mdview/core';

export interface IPCHandlerDeps {
  stateManager: StateManager;
  cacheManager: CacheManager;
  fileAdapter: ElectronFileAdapter;
  identityAdapter: ElectronIdentityAdapter;
  exportAdapter: ElectronExportAdapter;
  getWindow: () => BrowserWindow | null;
  getOpenFilePath: () => string | null;
}

export function registerIpcHandlers(deps: IPCHandlerDeps): void {
  const {
    stateManager,
    cacheManager,
    fileAdapter,
    identityAdapter,
    exportAdapter,
    getWindow,
    getOpenFilePath,
  } = deps;

  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => {
    return stateManager.getState();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_PREFERENCES, async (_event, prefs: Partial<Preferences>) => {
    await stateManager.updatePreferences(prefs);
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.PREFERENCES_UPDATED, prefs);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.CACHE_GENERATE_KEY,
    async (
      _event,
      filePath: string,
      contentHash: string,
      theme: string,
      prefs: Record<string, unknown>
    ) => {
      return cacheManager.generateKey(filePath, contentHash, theme, prefs);
    }
  );

  ipcMain.handle(IPC_CHANNELS.CACHE_GET, (_event, key: string) => {
    return cacheManager.get(key);
  });

  ipcMain.handle(IPC_CHANNELS.CACHE_SET, (_event, key: string, result: CachedResult) => {
    cacheManager.set(key, result);
  });

  ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, path: string) => {
    return fileAdapter.readFile(path);
  });

  ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, path: string, content: string) => {
    return fileAdapter.writeFile(path, content);
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_FILE_CHANGED, async (_event, url: string, lastHash: string) => {
    return fileAdapter.checkChanged(url, lastHash);
  });

  const fileWatchers = new Map<string, () => void>();

  ipcMain.handle(IPC_CHANNELS.WATCH_FILE, (_event, path: string) => {
    if (fileWatchers.has(path)) return;

    const unwatch = fileAdapter.watch(path, () => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.FILE_CHANGED, path);
      }
    });
    fileWatchers.set(path, unwatch);
  });

  ipcMain.handle(IPC_CHANNELS.UNWATCH_FILE, (_event, path: string) => {
    const unwatch = fileWatchers.get(path);
    if (unwatch) {
      unwatch();
      fileWatchers.delete(path);
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_USERNAME, () => {
    return identityAdapter.getUsername();
  });

  ipcMain.handle(
    IPC_CHANNELS.SAVE_FILE,
    async (_event, options: { filename: string; mimeType: string; data: ArrayBuffer }) => {
      return exportAdapter.saveFile({
        filename: options.filename,
        mimeType: options.mimeType,
        data: options.data,
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRINT_TO_PDF,
    async (_event, options?: { pageSize?: string; margins?: string; landscape?: boolean }) => {
      return exportAdapter.printToPDF(options);
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_OPEN_FILE_PATH, () => {
    return getOpenFilePath();
  });
}
