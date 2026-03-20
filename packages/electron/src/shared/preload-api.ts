import type { AppState, Preferences, CachedResult } from '@mdview/core';
import type { FileChangeInfo, FileWriteResult } from '@mdview/core';
import type { WorkspaceState, TabState, DirectoryEntry } from './workspace-types';

export interface MdviewPreloadAPI {
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
  setOpenFolder(path: string | null): Promise<void>;

  // Directory
  listDirectory(dirPath: string): Promise<DirectoryEntry[]>;
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
    mdview: MdviewPreloadAPI;
  }
}
