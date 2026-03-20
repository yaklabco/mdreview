import type { StorageAdapter } from '@mdview/core';

export class ChromeStorageAdapter implements StorageAdapter {
  async getSync(keys: string | string[]): Promise<Record<string, unknown>> {
    return chrome.storage.sync.get(keys) as Promise<Record<string, unknown>>;
  }

  async setSync(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.sync.set(data);
  }

  async getLocal(keys: string | string[]): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(keys) as Promise<Record<string, unknown>>;
  }

  async setLocal(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.set(data);
  }
}
