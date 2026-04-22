import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { MdreviewPreloadAPI } from '../shared/preload-api';

const api: MdreviewPreloadAPI = {
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

  // File dialogs
  showOpenFileDialog: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_FILE_DIALOG),
  showOpenFolderDialog: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_OPEN_FOLDER_DIALOG),
  getRecentFiles: () => ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_FILES),
  addRecentFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.ADD_RECENT_FILE, path),
  clearRecentFiles: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_RECENT_FILES),

  // Workspace state
  getWorkspaceState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_WORKSPACE_STATE),
  openTab: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_TAB, filePath),
  closeTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_TAB, tabId),
  setActiveTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.SET_ACTIVE_TAB, tabId),
  updateTabMetadata: (tabId, metadata) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAB_METADATA, tabId, metadata),
  updateTabScroll: (tabId, position) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAB_SCROLL, tabId, position),
  setSidebarVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.SET_SIDEBAR_VISIBLE, visible),
  setSidebarWidth: (width) => ipcRenderer.invoke(IPC_CHANNELS.SET_SIDEBAR_WIDTH, width),
  setTabBarVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.SET_TAB_BAR_VISIBLE, visible),
  setHeaderBarVisible: (visible) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_HEADER_BAR_VISIBLE, visible),
  setOpenFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.SET_OPEN_FOLDER, path),
  openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),

  // Context menu
  showContextMenu: (context) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_CONTEXT_MENU, context),
  revealInFinder: (path) => ipcRenderer.invoke(IPC_CHANNELS.REVEAL_IN_FINDER, path),

  // Tab groups
  createTabGroup: (name, color, tabIds) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_TAB_GROUP, name, color, tabIds),
  updateTabGroup: (groupId, updates) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TAB_GROUP, groupId, updates),
  deleteTabGroup: (groupId) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_TAB_GROUP, groupId),

  // Directory
  listDirectory: (dirPath, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIST_DIRECTORY, dirPath, options),
  watchDirectory: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.WATCH_DIRECTORY, dirPath),
  unwatchDirectory: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_DIRECTORY, dirPath),

  // Git
  gitIsRepo: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_IS_REPO),
  gitGetBranch: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_GET_BRANCH),
  gitListBranches: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_LIST_BRANCHES),
  gitCheckout: (branch) => ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, branch),
  gitStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS),
  gitStage: (paths) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, paths),
  gitUnstage: (paths) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, paths),
  gitCommit: (message) => ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, message),
  gitStash: () => ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH),

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
  onOpenFile: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on(IPC_CHANNELS.OPEN_FILE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OPEN_FILE, listener);
  },
  onOpenFolder: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on(IPC_CHANNELS.OPEN_FOLDER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OPEN_FOLDER, listener);
  },
  onMenuCommand: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, command: string) => callback(command);
    ipcRenderer.on(IPC_CHANNELS.MENU_COMMAND, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_COMMAND, listener);
  },
  onWorkspaceUpdated: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) =>
      callback(state as never);
    ipcRenderer.on(IPC_CHANNELS.WORKSPACE_UPDATED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.WORKSPACE_UPDATED, listener);
  },
  onTabOpened: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, tab: unknown) => callback(tab as never);
    ipcRenderer.on(IPC_CHANNELS.TAB_OPENED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TAB_OPENED, listener);
  },
  onTabClosed: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, tabId: string) => callback(tabId);
    ipcRenderer.on(IPC_CHANNELS.TAB_CLOSED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TAB_CLOSED, listener);
  },
  onActiveTabChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, tabId: string) => callback(tabId);
    ipcRenderer.on(IPC_CHANNELS.ACTIVE_TAB_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ACTIVE_TAB_CHANGED, listener);
  },
  onDirectoryChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, dirPath: string) => callback(dirPath);
    ipcRenderer.on(IPC_CHANNELS.DIRECTORY_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DIRECTORY_CHANGED, listener);
  },
};

contextBridge.exposeInMainWorld('mdreview', api);
