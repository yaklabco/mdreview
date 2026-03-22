/**
 * Platform adapter interfaces for @mdreview/core.
 *
 * These abstractions replace direct Chrome extension API calls,
 * allowing the core rendering engine to run in any environment
 * (Chrome extension, Electron, Node.js, tests).
 */

import type {} from './types/index';

// ---------------------------------------------------------------------------
// StorageAdapter — replaces chrome.storage.sync/local
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  /** Read values by key from persistent (synced) storage */
  getSync(keys: string | string[]): Promise<Record<string, unknown>>;
  /** Write values to persistent (synced) storage */
  setSync(data: Record<string, unknown>): Promise<void>;
  /** Read values by key from local-only storage */
  getLocal(keys: string | string[]): Promise<Record<string, unknown>>;
  /** Write values to local-only storage */
  setLocal(data: Record<string, unknown>): Promise<void>;
}

// ---------------------------------------------------------------------------
// MessagingAdapter — replaces chrome.runtime.sendMessage
// ---------------------------------------------------------------------------

/** Message envelope used for cross-context IPC */
export interface IPCMessage {
  type: string;
  payload?: unknown;
}

export interface MessagingAdapter {
  /** Send a message and await a response */
  send(message: IPCMessage): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// FileAdapter — replaces native host file I/O and file watching
// ---------------------------------------------------------------------------

export interface FileWriteResult {
  success: boolean;
  error?: string;
}

export interface FileChangeInfo {
  changed: boolean;
  newHash?: string;
  error?: string;
}

export interface FileAdapter {
  /** Write content to a file at the given path */
  writeFile(path: string, content: string): Promise<FileWriteResult>;
  /** Read content from a file at the given path */
  readFile(path: string): Promise<string>;
  /** Check if a file has changed since the last known hash */
  checkChanged(url: string, lastHash: string): Promise<FileChangeInfo>;
  /** Watch a file/directory for changes, returns an unsubscribe function */
  watch(path: string, callback: () => void): () => void;
}

// ---------------------------------------------------------------------------
// IdentityAdapter — replaces GET_USERNAME native host message
// ---------------------------------------------------------------------------

export interface IdentityAdapter {
  /** Get the current user's display name or system username */
  getUsername(): Promise<string>;
}

// ---------------------------------------------------------------------------
// ExportAdapter — replaces browser download / printToPDF
// ---------------------------------------------------------------------------

export interface ExportSaveOptions {
  /** Suggested filename */
  filename: string;
  /** MIME type of the content */
  mimeType: string;
  /** File content as Blob or ArrayBuffer */
  data: Blob | ArrayBuffer;
}

export interface ExportAdapter {
  /** Save/download a file (browser download or native save dialog) */
  saveFile(options: ExportSaveOptions): Promise<void>;
  /** Print the current view to PDF (Electron: webContents.printToPDF) */
  printToPDF?(options?: {
    pageSize?: string;
    margins?: string;
    landscape?: boolean;
  }): Promise<ArrayBuffer>;
}

// ---------------------------------------------------------------------------
// PlatformAdapters — combined context for dependency injection
// ---------------------------------------------------------------------------

export interface PlatformAdapters {
  storage: StorageAdapter;
  messaging: MessagingAdapter;
  file: FileAdapter;
  identity: IdentityAdapter;
  export: ExportAdapter;
}

// ---------------------------------------------------------------------------
// No-op defaults for graceful degradation
// ---------------------------------------------------------------------------

/** Storage adapter that stores nothing (in-memory, ephemeral) */
export class NoopStorageAdapter implements StorageAdapter {
  private syncStore = new Map<string, unknown>();
  private localStore = new Map<string, unknown>();

  getSync(keys: string | string[]): Promise<Record<string, unknown>> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (this.syncStore.has(key)) {
        result[key] = this.syncStore.get(key);
      }
    }
    return Promise.resolve(result);
  }

  setSync(data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      this.syncStore.set(key, value);
    }
    return Promise.resolve();
  }

  getLocal(keys: string | string[]): Promise<Record<string, unknown>> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (this.localStore.has(key)) {
        result[key] = this.localStore.get(key);
      }
    }
    return Promise.resolve(result);
  }

  setLocal(data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      this.localStore.set(key, value);
    }
    return Promise.resolve();
  }
}

/** Messaging adapter that returns empty responses */
export class NoopMessagingAdapter implements MessagingAdapter {
  send(_message: IPCMessage): Promise<unknown> {
    return Promise.resolve({});
  }
}

/** File adapter that rejects all operations */
export class NoopFileAdapter implements FileAdapter {
  writeFile(_path: string, _content: string): Promise<FileWriteResult> {
    return Promise.resolve({ success: false, error: 'No file adapter configured' });
  }

  readFile(_path: string): Promise<string> {
    return Promise.reject(new Error('No file adapter configured'));
  }

  checkChanged(_url: string, _lastHash: string): Promise<FileChangeInfo> {
    return Promise.resolve({ changed: false });
  }

  watch(_path: string, _callback: () => void): () => void {
    return () => {};
  }
}

/** Identity adapter that returns empty username */
export class NoopIdentityAdapter implements IdentityAdapter {
  getUsername(): Promise<string> {
    return Promise.resolve('');
  }
}

/** Export adapter that does nothing */
export class NoopExportAdapter implements ExportAdapter {
  async saveFile(_options: ExportSaveOptions): Promise<void> {
    // No-op in environments without export capability
  }
}

/** Create a PlatformAdapters bundle with all no-op defaults */
export function createNoopAdapters(): PlatformAdapters {
  return {
    storage: new NoopStorageAdapter(),
    messaging: new NoopMessagingAdapter(),
    file: new NoopFileAdapter(),
    identity: new NoopIdentityAdapter(),
    export: new NoopExportAdapter(),
  };
}
