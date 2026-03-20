/**
 * Debug Logger — Chrome extension shim
 *
 * Re-exports the platform-agnostic debug-logger from @mdview/core,
 * pre-configured with a Chrome StorageAdapter that reads from
 * chrome.storage.sync.  Existing callers continue to import
 * `debug` and `debugLogger` without any changes.
 */

import type { StorageAdapter, LogLevel } from '@mdview/core';
import { DebugLogger as CoreDebugLogger } from '@mdview/core';

// ---------------------------------------------------------------------------
// Chrome StorageAdapter (sync-only for preferences)
// ---------------------------------------------------------------------------

class ChromeStorageAdapter implements StorageAdapter {
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

// ---------------------------------------------------------------------------
// Singleton with Chrome adapter
// ---------------------------------------------------------------------------

const chromeAdapter = new ChromeStorageAdapter();
export const debugLogger = new CoreDebugLogger(chromeAdapter);

// Export convenience functions — identical shape to the original
export const debug = {
  log: (context: string, ...args: unknown[]) => debugLogger.log(context, ...args),
  debug: (context: string, ...args: unknown[]) => debugLogger.debug(context, ...args),
  info: (context: string, ...args: unknown[]) => debugLogger.info(context, ...args),
  warn: (context: string, ...args: unknown[]) => debugLogger.warn(context, ...args),
  error: (context: string, ...args: unknown[]) => debugLogger.error(context, ...args),
  group: (context: string, label: string) => debugLogger.group(context, label),
  groupEnd: () => debugLogger.groupEnd(),
  table: (context: string, data: unknown) => debugLogger.table(context, data),
  time: (context: string, label: string) => debugLogger.time(context, label),
  timeEnd: (context: string, label: string) => debugLogger.timeEnd(context, label),
  setLogLevel: (level: LogLevel) => debugLogger.setLogLevel(level),
  getLogLevel: () => debugLogger.getLogLevel(),
  // Compat
  setDebugMode: (enabled: boolean) => debugLogger.setLogLevel(enabled ? 'debug' : 'error'),
  isDebugEnabled: () => debugLogger.getLogLevel() === 'debug',
};
