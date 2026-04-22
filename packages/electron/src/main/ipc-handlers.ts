import { ipcMain, dialog, shell, Menu, type BrowserWindow } from 'electron';
import { createHash } from 'crypto';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { StateManager } from './state-manager';
import type { ElectronFileAdapter } from './adapters/file-adapter';
import type { ElectronIdentityAdapter } from './adapters/identity-adapter';
import type { ElectronExportAdapter } from './adapters/export-adapter';
import type { RecentFilesManager } from './recent-files';
import type { DirectoryService } from './directory-service';
import type { ElectronGitService } from './git-service';
import type { CacheManager, CachedResult, Preferences } from '@mdreview/core/node';
import type { TabState, TabGroupState, TabGroupColor } from '../shared/workspace-types';

export interface IPCHandlerDeps {
  stateManager: StateManager;
  cacheManager: CacheManager;
  fileAdapter: ElectronFileAdapter;
  identityAdapter: ElectronIdentityAdapter;
  exportAdapter: ElectronExportAdapter;
  recentFiles?: RecentFilesManager;
  directoryService?: DirectoryService;
  gitService?: ElectronGitService;
  getWindow: () => BrowserWindow | null;
  getOpenFilePath: () => string | null;
}

/**
 * Register all IPC handlers. Returns a dispose function that cleans up
 * file/directory watchers. Must be called before the window is destroyed.
 */
export function registerIpcHandlers(deps: IPCHandlerDeps): () => void {
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
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.PREFERENCES_UPDATED, prefs);
      if ((prefs as Record<string, unknown>).theme) {
        win.webContents.send(IPC_CHANNELS.THEME_CHANGED, (prefs as Record<string, unknown>).theme);
      }
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.CACHE_GENERATE_KEY,
    (
      _event,
      filePath: string,
      contentHash: string,
      theme: string,
      prefs: Record<string, unknown>
    ) => {
      const input = JSON.stringify({ path: filePath, content: contentHash, theme, prefs });
      return createHash('sha256').update(input).digest('hex');
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
      if (win && !win.isDestroyed()) {
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
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.TAB_OPENED, tab);
      win.webContents.send(IPC_CHANNELS.ACTIVE_TAB_CHANGED, tab.id);
    }
    return tab;
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_TAB, (_event, tabId: string) => {
    stateManager.closeTab(tabId);
    const win = getWindow();
    if (win && !win.isDestroyed()) {
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
    if (win && !win.isDestroyed()) {
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

  ipcMain.handle(IPC_CHANNELS.SET_TAB_BAR_VISIBLE, (_event, visible: boolean) => {
    stateManager.setTabBarVisible(visible);
  });

  ipcMain.handle(IPC_CHANNELS.SET_HEADER_BAR_VISIBLE, (_event, visible: boolean) => {
    stateManager.setHeaderBarVisible(visible);
  });

  ipcMain.handle(IPC_CHANNELS.SET_OPEN_FOLDER, (_event, path: string | null) => {
    stateManager.setOpenFolder(path);
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Tab groups
  ipcMain.handle(
    IPC_CHANNELS.CREATE_TAB_GROUP,
    (_event, name: string, color: TabGroupColor, tabIds: string[]) => {
      return stateManager.createTabGroup(name, color, tabIds);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_TAB_GROUP,
    (
      _event,
      groupId: string,
      updates: Partial<Pick<TabGroupState, 'name' | 'color' | 'collapsed' | 'tabIds'>>
    ) => {
      stateManager.updateTabGroup(groupId, updates);
    }
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_TAB_GROUP, (_event, groupId: string) => {
    stateManager.deleteTabGroup(groupId);
  });

  // Context menu
  ipcMain.handle(
    IPC_CHANNELS.SHOW_CONTEXT_MENU,
    (_event, context: { hasSelection: boolean; selectionText: string; filePath: string }) => {
      const win = getWindow();
      if (!win || win.isDestroyed()) return;

      const sendCommand = (command: string) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.MENU_COMMAND, command);
        }
      };

      const template: Electron.MenuItemConstructorOptions[] = [];

      if (context.hasSelection) {
        const text = context.selectionText;
        const truncated = text.length > 20 ? text.slice(0, 20) + '...' : text;

        template.push(
          { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => sendCommand('context:copy') },
          { type: 'separator' },
          { label: 'Leave a Comment', click: () => sendCommand('context:comment') },
          { type: 'separator' },
          {
            label: `Look Up "${truncated}"`,
            click: () => sendCommand('context:lookup'),
          },
          {
            label: 'Search with Google',
            click: () => sendCommand('context:search'),
          },
          { type: 'separator' },
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            click: () => sendCommand('context:select-all'),
          }
        );
      } else {
        template.push(
          {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            click: () => sendCommand('context:select-all'),
          },
          { type: 'separator' },
          { label: 'Copy File Path', click: () => sendCommand('context:copy-path') },
          { label: 'Reveal in Finder', click: () => sendCommand('context:reveal') },
          { type: 'separator' },
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: () => sendCommand('context:reload'),
          }
        );
      }

      const menu = Menu.buildFromTemplate(template);
      menu.popup();
    }
  );

  ipcMain.handle(IPC_CHANNELS.REVEAL_IN_FINDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // Directory service
  ipcMain.handle(
    IPC_CHANNELS.LIST_DIRECTORY,
    (_event, dirPath: string, options?: { showAllFiles?: boolean }) => {
      return directoryService?.listDirectory(dirPath, options) ?? [];
    }
  );

  ipcMain.handle(IPC_CHANNELS.WATCH_DIRECTORY, (_event, dirPath: string) => {
    directoryService?.watchDirectory(dirPath, () => {
      const win = getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.DIRECTORY_CHANGED, dirPath);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.UNWATCH_DIRECTORY, (_event, dirPath: string) => {
    directoryService?.unwatchDirectory(dirPath);
  });

  // Git operations
  ipcMain.handle(IPC_CHANNELS.GIT_IS_REPO, () => deps.gitService?.isGitRepo() ?? false);

  ipcMain.handle(IPC_CHANNELS.GIT_GET_BRANCH, () => deps.gitService?.getCurrentBranch() ?? '');

  ipcMain.handle(
    IPC_CHANNELS.GIT_LIST_BRANCHES,
    () => deps.gitService?.listBranches() ?? { local: [], current: '' }
  );

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, (_event, branch: string) =>
    deps.gitService?.checkout(branch)
  );

  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, () => deps.gitService?.getStatus() ?? []);

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, (_event, paths: string[]) =>
    deps.gitService?.stage(paths)
  );

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, (_event, paths: string[]) =>
    deps.gitService?.unstage(paths)
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT,
    (_event, message: string) => deps.gitService?.commit(message) ?? ''
  );

  ipcMain.handle(IPC_CHANNELS.GIT_STASH, () => deps.gitService?.stash());

  // Return cleanup function to stop all file watchers before window destruction
  return () => {
    for (const unwatch of fileWatchers.values()) {
      unwatch();
    }
    fileWatchers.clear();
  };
}
