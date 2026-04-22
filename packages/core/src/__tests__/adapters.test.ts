import {
  NoopStorageAdapter,
  NoopMessagingAdapter,
  NoopFileAdapter,
  NoopIdentityAdapter,
  NoopExportAdapter,
  NoopGitAdapter,
  NoopBridgeHealth,
  createNoopAdapters,
} from '../adapters';
import type {
  StorageAdapter,
  MessagingAdapter,
  FileAdapter,
  IdentityAdapter,
  ExportAdapter,
  GitAdapter,
  BridgeHealth,
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
      await expect(file.readFile('/tmp/test.md')).rejects.toThrow('No file adapter configured');
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(exporter.printToPDF).toBeUndefined();
    });
  });

  describe('GitAdapter (NoopGitAdapter)', () => {
    let git: GitAdapter;

    beforeEach(() => {
      git = new NoopGitAdapter();
    });

    it('isGitRepo returns false', async () => {
      const result = await git.isGitRepo();
      expect(result).toBe(false);
    });

    it('getCurrentBranch returns empty string', async () => {
      const branch = await git.getCurrentBranch();
      expect(branch).toBe('');
    });

    it('listBranches returns empty local array and empty current', async () => {
      const branches = await git.listBranches();
      expect(branches).toEqual({ local: [], current: '' });
    });

    it('getStatus returns empty array', async () => {
      const status = await git.getStatus();
      expect(status).toEqual([]);
    });

    it('checkout completes without error', async () => {
      await expect(git.checkout('main')).resolves.toBeUndefined();
    });

    it('stage completes without error', async () => {
      await expect(git.stage(['file.ts'])).resolves.toBeUndefined();
    });

    it('unstage completes without error', async () => {
      await expect(git.unstage(['file.ts'])).resolves.toBeUndefined();
    });

    it('commit returns empty string', async () => {
      const sha = await git.commit('test commit');
      expect(sha).toBe('');
    });
  });

  describe('BridgeHealth (NoopBridgeHealth)', () => {
    let health: BridgeHealth;

    beforeEach(() => {
      health = new NoopBridgeHealth();
    });

    it('state is disconnected', () => {
      expect(health.state).toBe('disconnected');
    });

    it('lastHeartbeat is null', () => {
      expect(health.lastHeartbeat).toBeNull();
    });

    it('consecutiveFailures is 0', () => {
      expect(health.consecutiveFailures).toBe(0);
    });

    it('connect completes without error', async () => {
      await expect(health.connect()).resolves.toBeUndefined();
    });

    it('disconnect does not throw', () => {
      expect(() => health.disconnect()).not.toThrow();
    });

    it('onStateChange does not throw', () => {
      expect(() => health.onStateChange(() => {})).not.toThrow();
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

    it('includes git adapter', () => {
      const adapters = createNoopAdapters();
      expect(adapters.git).toBeInstanceOf(NoopGitAdapter);
    });

    it('includes bridgeHealth', () => {
      const adapters = createNoopAdapters();
      expect(adapters.bridgeHealth).toBeInstanceOf(NoopBridgeHealth);
    });
  });

  describe('Custom mock adapters satisfy interfaces', () => {
    it('custom StorageAdapter implementation works', async () => {
      const store = new Map<string, unknown>();
      const custom: StorageAdapter = {
        getSync(keys) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, unknown> = {};
          for (const k of keyList) {
            if (store.has(k)) result[k] = store.get(k);
          }
          return Promise.resolve(result);
        },
        setSync(data) {
          for (const [k, v] of Object.entries(data)) store.set(k, v);
          return Promise.resolve();
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
        writeFile(path, content) {
          files.set(path, content);
          return Promise.resolve({ success: true });
        },
        readFile(path) {
          const content = files.get(path);
          if (!content) return Promise.reject(new Error(`File not found: ${path}`));
          return Promise.resolve(content);
        },
        checkChanged(_url, _lastHash) {
          return Promise.resolve({ changed: true, newHash: 'new-hash' });
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
