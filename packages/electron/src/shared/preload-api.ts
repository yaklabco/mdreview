import type { AppState, Preferences, CachedResult } from '@mdreview/core';
import type { FileChangeInfo, FileWriteResult } from '@mdreview/core';
import type {
  WorkspaceState,
  TabState,
  TabGroupState,
  TabGroupColor,
  DirectoryEntry,
} from './workspace-types';

export interface MdreviewPreloadAPI {
  // State
  getState(): Promise<AppState>;
  updatePreferences(prefs: Partial<Preferences>): Promise<void>;

  // Cache
  cacheGenerateKey(
    filePath: string,
    contentHash: string,
    theme: string,
    prefs: Record<string, unknown>
  ): Promise<string>;
  cacheGet(key: string): Promise<CachedResult | null>;
  cacheSet(key: string, result: CachedResult): Promise<void>;

  // File I/O
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<FileWriteResult>;
  checkFileChanged(url: string, lastHash: string): Promise<FileChangeInfo>;
  watchFile(path: string): Promise<void>;
  unwatchFile(path: string): Promise<void>;

  // Identity
  getUsername(): Promise<string>;

  // Export
  saveFile(options: { filename: string; mimeType: string; data: ArrayBuffer }): Promise<void>;
  printToPDF(options?: {
    pageSize?: string;
    margins?: string;
    landscape?: boolean;
  }): Promise<ArrayBuffer>;

  // File open path (from CLI args or file association)
  getOpenFilePath(): Promise<string | null>;

  // File dialogs
  showOpenFileDialog(): Promise<string[] | null>;
  showOpenFolderDialog(): Promise<string | null>;
  getRecentFiles(): Promise<string[]>;
  addRecentFile(path: string): Promise<void>;
  clearRecentFiles(): Promise<void>;

  // Workspace state
  getWorkspaceState(): Promise<WorkspaceState>;
  openTab(filePath: string): Promise<TabState>;
  closeTab(tabId: string): Promise<void>;
  setActiveTab(tabId: string): Promise<void>;
  updateTabMetadata(tabId: string, metadata: Partial<TabState>): Promise<void>;
  updateTabScroll(tabId: string, position: number): Promise<void>;
  setSidebarVisible(visible: boolean): Promise<void>;
  setSidebarWidth(width: number): Promise<void>;
  setTabBarVisible(visible: boolean): Promise<void>;
  setHeaderBarVisible(visible: boolean): Promise<void>;
  setOpenFolder(path: string | null): Promise<void>;
  openExternal(url: string): Promise<void>;

  // Tab groups
  createTabGroup(name: string, color: TabGroupColor, tabIds: string[]): Promise<TabGroupState>;
  updateTabGroup(
    groupId: string,
    updates: Partial<Pick<TabGroupState, 'name' | 'color' | 'collapsed' | 'tabIds'>>
  ): Promise<void>;
  deleteTabGroup(groupId: string): Promise<void>;

  // Directory
  listDirectory(dirPath: string, options?: { showAllFiles?: boolean }): Promise<DirectoryEntry[]>;
  watchDirectory(dirPath: string): Promise<void>;
  unwatchDirectory(dirPath: string): Promise<void>;

  // Event listeners (main → renderer)
  onFileChanged(callback: (path: string) => void): () => void;
  onPreferencesUpdated(callback: (prefs: Partial<Preferences>) => void): () => void;
  onThemeChanged(callback: (theme: string) => void): () => void;
  onOpenFile(callback: (path: string) => void): () => void;
  onOpenFolder(callback: (path: string) => void): () => void;
  onMenuCommand(callback: (command: string) => void): () => void;
  onWorkspaceUpdated(callback: (state: WorkspaceState) => void): () => void;
  onTabOpened(callback: (tab: TabState) => void): () => void;
  onTabClosed(callback: (tabId: string) => void): () => void;
  onActiveTabChanged(callback: (tabId: string) => void): () => void;
  onDirectoryChanged(callback: (dirPath: string) => void): () => void;
}

declare global {
  interface Window {
    mdreview: MdreviewPreloadAPI;
  }
}
