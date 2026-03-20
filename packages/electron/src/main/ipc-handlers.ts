import { ipcMain, dialog, shell, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { StateManager } from './state-manager';
import type { ElectronFileAdapter } from './adapters/file-adapter';
import type { ElectronIdentityAdapter } from './adapters/identity-adapter';
import type { ElectronExportAdapter } from './adapters/export-adapter';
import type { RecentFilesManager } from './recent-files';
import type { DirectoryService } from './directory-service';
import type { CacheManager, CachedResult, Preferences } from '@mdview/core';
import type { TabState } from '../shared/workspace-types';

export interface IPCHandlerDeps {
  stateManager: StateManager;
  cacheManager: CacheManager;
  fileAdapter: ElectronFileAdapter;
  identityAdapter: ElectronIdentityAdapter;
  exportAdapter: ElectronExportAdapter;
  recentFiles?: RecentFilesManager;
  directoryService?: DirectoryService;
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
    recentFiles,
    directoryService,
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

  // File dialogs
  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_FILE_DIALOG, async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx'] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_FOLDER_DIALOG, async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // Recent files
  ipcMain.handle(IPC_CHANNELS.GET_RECENT_FILES, () => {
    return recentFiles?.getFiles() ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.ADD_RECENT_FILE, (_event, path: string) => {
    recentFiles?.addFile(path);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_RECENT_FILES, () => {
    recentFiles?.clear();
  });

  // Workspace state
  ipcMain.handle(IPC_CHANNELS.GET_WORKSPACE_STATE, () => {
    return stateManager.getWorkspaceState();
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_TAB, (_event, filePath: string) => {
    const tab = stateManager.openTab(filePath);
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TAB_OPENED, tab);
      win.webContents.send(IPC_CHANNELS.ACTIVE_TAB_CHANGED, tab.id);
    }
    return tab;
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_TAB, (_event, tabId: string) => {
    stateManager.closeTab(tabId);
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TAB_CLOSED, tabId);
      const ws = stateManager.getWorkspaceState();
      if (ws.activeTabId) {
        win.webContents.send(IPC_CHANNELS.ACTIVE_TAB_CHANGED, ws.activeTabId);
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.SET_ACTIVE_TAB, (_event, tabId: string) => {
    stateManager.setActiveTab(tabId);
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.ACTIVE_TAB_CHANGED, tabId);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_TAB_METADATA,
    (_event, tabId: string, metadata: Partial<TabState>) => {
      stateManager.updateTabMetadata(tabId, metadata);
    }
  );

  ipcMain.handle(IPC_CHANNELS.UPDATE_TAB_SCROLL, (_event, tabId: string, position: number) => {
    stateManager.updateTabScrollPosition(tabId, position);
  });

  ipcMain.handle(IPC_CHANNELS.SET_SIDEBAR_VISIBLE, (_event, visible: boolean) => {
    stateManager.setSidebarVisible(visible);
  });

  ipcMain.handle(IPC_CHANNELS.SET_SIDEBAR_WIDTH, (_event, width: number) => {
    stateManager.setSidebarWidth(width);
  });

  ipcMain.handle(IPC_CHANNELS.SET_OPEN_FOLDER, (_event, path: string | null) => {
    stateManager.setOpenFolder(path);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Directory service
  ipcMain.handle(IPC_CHANNELS.LIST_DIRECTORY, (_event, dirPath: string) => {
    return directoryService?.listDirectory(dirPath) ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.WATCH_DIRECTORY, (_event, dirPath: string) => {
    directoryService?.watchDirectory(dirPath, () => {
      const win = getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.DIRECTORY_CHANGED, dirPath);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.UNWATCH_DIRECTORY, (_event, dirPath: string) => {
    directoryService?.unwatchDirectory(dirPath);
  });
}
