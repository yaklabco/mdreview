import type { AppState, Preferences, CachedResult } from '@mdview/core';
import type { FileChangeInfo, FileWriteResult } from '@mdview/core';

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

  // Event listeners (main → renderer)
  onFileChanged(callback: (path: string) => void): () => void;
  onPreferencesUpdated(callback: (prefs: Partial<Preferences>) => void): () => void;
  onThemeChanged(callback: (theme: string) => void): () => void;
}

declare global {
  interface Window {
    mdview: MdviewPreloadAPI;
  }
}
