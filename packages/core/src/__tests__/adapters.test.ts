import {
  NoopStorageAdapter,
  NoopMessagingAdapter,
  NoopFileAdapter,
  NoopIdentityAdapter,
  NoopExportAdapter,
  createNoopAdapters,
} from '../adapters';
import type {
  StorageAdapter,
  MessagingAdapter,
  FileAdapter,
  IdentityAdapter,
  ExportAdapter,
  PlatformAdapters,
} from '../adapters';

describe('Platform Adapters', () => {
  describe('StorageAdapter (NoopStorageAdapter)', () => {
    let storage: StorageAdapter;

    beforeEach(() => {
      storage = new NoopStorageAdapter();
    });

    it('returns empty object for unknown sync keys', async () => {
      const result = await storage.getSync('nonexistent');
      expect(result).toEqual({});
    });

    it('stores and retrieves sync values', async () => {
      await storage.setSync({ theme: 'github-dark', fontSize: 14 });
      const result = await storage.getSync(['theme', 'fontSize']);
      expect(result).toEqual({ theme: 'github-dark', fontSize: 14 });
    });

    it('returns empty object for unknown local keys', async () => {
      const result = await storage.getLocal(['missing']);
      expect(result).toEqual({});
    });

    it('stores and retrieves local values', async () => {
      await storage.setLocal({ scrollPos: 500 });
      const result = await storage.getLocal('scrollPos');
      expect(result).toEqual({ scrollPos: 500 });
    });

    it('handles string key argument for getSync', async () => {
      await storage.setSync({ preferences: { logLevel: 'debug' } });
      const result = await storage.getSync('preferences');
      expect(result).toEqual({ preferences: { logLevel: 'debug' } });
    });
  });

  describe('MessagingAdapter (NoopMessagingAdapter)', () => {
    let messaging: MessagingAdapter;

    beforeEach(() => {
      messaging = new NoopMessagingAdapter();
    });

    it('returns empty object for any message', async () => {
      const result = await messaging.send({ type: 'GET_STATE' });
      expect(result).toEqual({});
    });

    it('handles messages with payloads', async () => {
      const result = await messaging.send({
        type: 'CACHE_GET',
        payload: { key: 'test-key' },
      });
      expect(result).toEqual({});
    });
  });

  describe('FileAdapter (NoopFileAdapter)', () => {
    let file: FileAdapter;

    beforeEach(() => {
      file = new NoopFileAdapter();
    });

    it('writeFile returns failure', async () => {
      const result = await file.writeFile('/tmp/test.md', '# Hello');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('readFile throws', async () => {
      await expect(file.readFile('/tmp/test.md')).rejects.toThrow(
        'No file adapter configured'
      );
    });

    it('checkChanged returns unchanged', async () => {
      const result = await file.checkChanged('file:///test.md', 'abc123');
      expect(result.changed).toBe(false);
    });

    it('watch returns a no-op unsubscribe function', () => {
      const unsubscribe = file.watch('/tmp', () => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // should not throw
    });
  });

  describe('IdentityAdapter (NoopIdentityAdapter)', () => {
    let identity: IdentityAdapter;

    beforeEach(() => {
      identity = new NoopIdentityAdapter();
    });

    it('returns empty string username', async () => {
      const username = await identity.getUsername();
      expect(username).toBe('');
    });
  });

  describe('ExportAdapter (NoopExportAdapter)', () => {
    let exporter: ExportAdapter;

    beforeEach(() => {
      exporter = new NoopExportAdapter();
    });

    it('saveFile completes without error', async () => {
      await expect(
        exporter.saveFile({
          filename: 'test.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: new Blob(['test']),
        })
      ).resolves.toBeUndefined();
    });

    it('printToPDF is not defined on noop adapter', () => {
      expect(exporter.printToPDF).toBeUndefined();
    });
  });

  describe('createNoopAdapters()', () => {
    it('returns a complete PlatformAdapters bundle', () => {
      const adapters: PlatformAdapters = createNoopAdapters();
      expect(adapters.storage).toBeInstanceOf(NoopStorageAdapter);
      expect(adapters.messaging).toBeInstanceOf(NoopMessagingAdapter);
      expect(adapters.file).toBeInstanceOf(NoopFileAdapter);
      expect(adapters.identity).toBeInstanceOf(NoopIdentityAdapter);
      expect(adapters.export).toBeInstanceOf(NoopExportAdapter);
    });
  });

  describe('Custom mock adapters satisfy interfaces', () => {
    it('custom StorageAdapter implementation works', async () => {
      const store = new Map<string, unknown>();
      const custom: StorageAdapter = {
        async getSync(keys) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const k of keyList) {
            if (store.has(k)) result[k] = store.get(k);
          }
          return result;
        },
        async setSync(data) {
          for (const [k, v] of Object.entries(data)) store.set(k, v);
        },
        async getLocal(keys) {
          return this.getSync(keys);
        },
        async setLocal(data) {
          return this.setSync(data);
        },
      };

      await custom.setSync({ key1: 'value1' });
      expect(await custom.getSync('key1')).toEqual({ key1: 'value1' });
    });

    it('custom FileAdapter with in-memory fs works', async () => {
      const files = new Map<string, string>();
      const custom: FileAdapter = {
        async writeFile(path, content) {
          files.set(path, content);
          return { success: true };
        },
        async readFile(path) {
          const content = files.get(path);
          if (!content) throw new Error(`File not found: ${path}`);
          return content;
        },
        async checkChanged(_url, _lastHash) {
          return { changed: true, newHash: 'new-hash' };
        },
        watch(_path, _callback) {
          return () => {};
        },
      };

      await custom.writeFile('/test.md', '# Hello');
      const content = await custom.readFile('/test.md');
      expect(content).toBe('# Hello');
    });
  });
});
