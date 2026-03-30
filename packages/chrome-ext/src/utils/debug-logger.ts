/**
 * Debug Logger — Chrome extension shim
 *
 * Re-exports the platform-agnostic debug-logger from @mdreview/core,
 * pre-configured with a Chrome StorageAdapter that reads from
 * chrome.storage.sync.  Existing callers continue to import
 * `debug` and `debugLogger` without any changes.
 */

// Import type from barrel (type-only imports are tree-shaken, no runtime cost).
// Import value from subpath to avoid pulling heavy deps into the SW bundle.
import type { LogLevel } from '@mdreview/core';
import { DebugLogger as CoreDebugLogger } from '@mdreview/core/utils/debug-logger';
import { ChromeStorageAdapter } from '../adapters';

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
