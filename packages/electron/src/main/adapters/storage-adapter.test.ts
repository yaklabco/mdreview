import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronStorageAdapter } from './storage-adapter';

function createMockStore() {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => data.get(key) ?? defaultValue),
    set: vi.fn((key: string, value: unknown) => data.set(key, value)),
    has: vi.fn((key: string) => data.has(key)),
    delete: vi.fn((key: string) => data.delete(key)),
    clear: vi.fn(() => data.clear()),
    store: {} as Record<string, unknown>,
    _data: data,
  };
}

describe('ElectronStorageAdapter', () => {
  let syncStore: ReturnType<typeof createMockStore>;
  let localStore: ReturnType<typeof createMockStore>;
  let adapter: ElectronStorageAdapter;

  beforeEach(() => {
    syncStore = createMockStore();
    localStore = createMockStore();
    adapter = new ElectronStorageAdapter(syncStore as never, localStore as never);
  });

  describe('getSync', () => {
    it('should return empty object for missing keys', async () => {
      const result = await adapter.getSync('nonexistent');
      expect(result).toEqual({});
    });

    it('should return stored value for a single key', async () => {
      syncStore._data.set('theme', 'github-dark');
      const result = await adapter.getSync('theme');
      expect(result).toEqual({ theme: 'github-dark' });
    });

    it('should return multiple values for an array of keys', async () => {
      syncStore._data.set('theme', 'github-dark');
      syncStore._data.set('autoReload', true);
      const result = await adapter.getSync(['theme', 'autoReload']);
      expect(result).toEqual({ theme: 'github-dark', autoReload: true });
    });

    it('should skip missing keys in array request', async () => {
      syncStore._data.set('theme', 'github-dark');
      const result = await adapter.getSync(['theme', 'missing']);
      expect(result).toEqual({ theme: 'github-dark' });
    });
  });

  describe('setSync', () => {
    it('should store values', async () => {
      await adapter.setSync({ theme: 'monokai', autoReload: false });
      expect(syncStore.set).toHaveBeenCalledWith('theme', 'monokai');
      expect(syncStore.set).toHaveBeenCalledWith('autoReload', false);
    });

    it('should be retrievable after set', async () => {
      await adapter.setSync({ lineNumbers: true });
      const result = await adapter.getSync('lineNumbers');
      expect(result).toEqual({ lineNumbers: true });
    });
  });

  describe('getLocal', () => {
    it('should return empty object for missing keys', async () => {
      const result = await adapter.getLocal('missing');
      expect(result).toEqual({});
    });

    it('should return stored local value', async () => {
      localStore._data.set('scrollPosition', 42);
      const result = await adapter.getLocal('scrollPosition');
      expect(result).toEqual({ scrollPosition: 42 });
    });
  });

  describe('setLocal', () => {
    it('should store local values', async () => {
      await adapter.setLocal({ scrollPosition: 100 });
      expect(localStore.set).toHaveBeenCalledWith('scrollPosition', 100);
    });

    it('should be retrievable after set', async () => {
      await adapter.setLocal({ path: '/tmp/test.md' });
      const result = await adapter.getLocal('path');
      expect(result).toEqual({ path: '/tmp/test.md' });
    });
  });
});
