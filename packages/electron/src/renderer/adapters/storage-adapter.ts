import type { StorageAdapter } from '@mdview/core';

export class ElectronRendererStorageAdapter implements StorageAdapter {
  async getSync(keys: string | string[]): Promise<Record<string, unknown>> {
    const state = await window.mdview.getState();
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (key === 'preferences') {
        result[key] = state.preferences;
      }
    }
    return result;
  }

  async setSync(data: Record<string, unknown>): Promise<void> {
    if (data.preferences) {
      await window.mdview.updatePreferences(data.preferences as Record<string, unknown>);
    }
  }

  async getLocal(keys: string | string[]): Promise<Record<string, unknown>> {
    const state = await window.mdview.getState();
    const keyList = Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of keyList) {
      if (key === 'ui') result[key] = state.ui;
      if (key === 'document') result[key] = state.document;
    }
    return result;
  }

  setLocal(_data: Record<string, unknown>): Promise<void> {
    return Promise.resolve();
  }
}
