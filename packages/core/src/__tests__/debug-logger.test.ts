import type { StorageAdapter } from '../adapters';
import { DebugLogger, createDebugLogger, createDebug } from '../utils/debug-logger';

describe('DebugLogger', () => {
  describe('works with mock StorageAdapter that returns preferences', () => {
    it('loads log level from storage adapter', async () => {
      const mockAdapter: StorageAdapter = {
        getSync(_keys: string | string[]) {
          return Promise.resolve({
            preferences: { logLevel: 'debug' },
          });
        },
        setSync() {
          return Promise.resolve();
        },
        getLocal() {
          return Promise.resolve({});
        },
        setLocal() {
          return Promise.resolve();
        },
      };

      const logger = new DebugLogger(mockAdapter);
      // Wait for async init to complete
      await logger.ready;

      expect(logger.getLogLevel()).toBe('debug');
    });

    it('respects legacy debug boolean from storage', async () => {
      const mockAdapter: StorageAdapter = {
        getSync(_keys: string | string[]) {
          return Promise.resolve({
            preferences: { debug: true },
          });
        },
        setSync() {
          return Promise.resolve();
        },
        getLocal() {
          return Promise.resolve({});
        },
        setLocal() {
          return Promise.resolve();
        },
      };

      const logger = new DebugLogger(mockAdapter);
      await logger.ready;

      expect(logger.getLogLevel()).toBe('debug');
    });

    it('defaults to error when storage has preferences without logLevel or debug', async () => {
      const mockAdapter: StorageAdapter = {
        getSync(_keys: string | string[]) {
          return Promise.resolve({
            preferences: { theme: 'github-light' },
          });
        },
        setSync() {
          return Promise.resolve();
        },
        getLocal() {
          return Promise.resolve({});
        },
        setLocal() {
          return Promise.resolve();
        },
      };

      const logger = new DebugLogger(mockAdapter);
      await logger.ready;

      expect(logger.getLogLevel()).toBe('error');
    });

    it('defaults to error when storage adapter rejects', async () => {
      const mockAdapter: StorageAdapter = {
        getSync() {
          return Promise.reject(new Error('storage unavailable'));
        },
        setSync() {
          return Promise.resolve();
        },
        getLocal() {
          return Promise.resolve({});
        },
        setLocal() {
          return Promise.resolve();
        },
      };

      const logger = new DebugLogger(mockAdapter);
      await logger.ready;

      expect(logger.getLogLevel()).toBe('error');
    });
  });

  describe('works without any adapter (graceful degradation)', () => {
    it('defaults to error log level without adapter', () => {
      const logger = new DebugLogger();
      expect(logger.getLogLevel()).toBe('error');
    });

    it('allows setting log level manually', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('info');
      expect(logger.getLogLevel()).toBe('info');
    });
  });

  describe('log level filtering works correctly', () => {
    let consoleSpy: {
      log: ReturnType<typeof vi.spyOn>;
      debug: ReturnType<typeof vi.spyOn>;
      info: ReturnType<typeof vi.spyOn>;
      warn: ReturnType<typeof vi.spyOn>;
      error: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('at level none, suppresses all output', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('none');

      logger.error('ctx', 'msg');
      logger.warn('ctx', 'msg');
      logger.info('ctx', 'msg');
      logger.debug('ctx', 'msg');
      logger.log('ctx', 'msg');

      expect(consoleSpy.error).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('at level error, only shows errors', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('error');

      logger.error('ctx', 'err msg');
      logger.warn('ctx', 'warn msg');
      logger.info('ctx', 'info msg');
      logger.log('ctx', 'log msg');

      expect(consoleSpy.error).toHaveBeenCalledWith('[ctx]', 'err msg');
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('at level warn, shows errors and warnings', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('warn');

      logger.error('ctx', 'err msg');
      logger.warn('ctx', 'warn msg');
      logger.info('ctx', 'info msg');
      logger.log('ctx', 'log msg');

      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith('[ctx]', 'warn msg');
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('at level info, shows errors, warnings, and info', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('info');

      logger.error('ctx', 'err');
      logger.warn('ctx', 'warn');
      logger.info('ctx', 'info');
      logger.log('ctx', 'log');

      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledWith('[ctx]', 'info');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('at level debug, shows everything', () => {
      const logger = new DebugLogger();
      logger.setLogLevel('debug');

      logger.error('ctx', 'err');
      logger.warn('ctx', 'warn');
      logger.info('ctx', 'info');
      logger.debug('ctx', 'dbg');
      logger.log('ctx', 'log');

      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.debug).toHaveBeenCalledWith('[ctx]', 'dbg');
      expect(consoleSpy.log).toHaveBeenCalledWith('[ctx]', 'log');
    });
  });

  describe('factory functions', () => {
    it('createDebugLogger returns a DebugLogger instance', () => {
      const logger = createDebugLogger();
      expect(logger).toBeInstanceOf(DebugLogger);
    });

    it('createDebugLogger accepts an optional adapter', async () => {
      const mockAdapter: StorageAdapter = {
        getSync() {
          return Promise.resolve({ preferences: { logLevel: 'warn' as const } });
        },
        setSync() {
          return Promise.resolve();
        },
        getLocal() {
          return Promise.resolve({});
        },
        setLocal() {
          return Promise.resolve();
        },
      };

      const logger = createDebugLogger(mockAdapter);
      await logger.ready;
      expect(logger.getLogLevel()).toBe('warn');
    });

    it('createDebug returns convenience object with all methods', () => {
      const d = createDebug();
      expect(typeof d.log).toBe('function');
      expect(typeof d.debug).toBe('function');
      expect(typeof d.info).toBe('function');
      expect(typeof d.warn).toBe('function');
      expect(typeof d.error).toBe('function');
      expect(typeof d.group).toBe('function');
      expect(typeof d.groupEnd).toBe('function');
      expect(typeof d.table).toBe('function');
      expect(typeof d.time).toBe('function');
      expect(typeof d.timeEnd).toBe('function');
      expect(typeof d.setLogLevel).toBe('function');
      expect(typeof d.getLogLevel).toBe('function');
      expect(typeof d.setDebugMode).toBe('function');
      expect(typeof d.isDebugEnabled).toBe('function');
    });

    it('createDebug convenience methods delegate to logger', () => {
      const d = createDebug();
      d.setLogLevel('debug');
      expect(d.getLogLevel()).toBe('debug');
      expect(d.isDebugEnabled()).toBe(true);

      d.setDebugMode(false);
      expect(d.getLogLevel()).toBe('error');
      expect(d.isDebugEnabled()).toBe(false);
    });
  });
});
