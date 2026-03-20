import type { StorageAdapter } from '@mdview/core';
import type ElectronStore from 'electron-store';

export class ElectronStorageAdapter implements StorageAdapter {
  constructor(
    private syncStore: ElectronStore,
    private localStore: ElectronStore
  ) {}

  getSync(keys: string | string[]): Promise<Record<string, unknown>> {
    return Promise.resolve(this.getFromStore(this.syncStore, keys));
  }

  setSync(data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      this.syncStore.set(key, value);
    }
    return Promise.resolve();
  }

  getLocal(keys: string | string[]): Promise<Record<string, unknown>> {
    return Promise.resolve(this.getFromStore(this.localStore, keys));
  }

  setLocal(data: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      this.localStore.set(key, value);
    }
    return Promise.resolve();
  }

  private getFromStore(store: ElectronStore, keys: string | string[]): Record<string, unknown> {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (store.has(key)) {
        result[key] = store.get(key);
      }
    }
    return result;
  }
}
