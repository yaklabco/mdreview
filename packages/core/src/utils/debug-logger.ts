/**
 * Debug Logger (platform-agnostic)
 * Centralized logging utility that respects verbosity level preference.
 *
 * Uses an optional StorageAdapter to load the log level from persistent
 * storage.  When no adapter is provided the logger degrades gracefully
 * to the default level ('error').
 */

import type { LogLevel } from '../types/index';
import type { StorageAdapter } from '../adapters';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class DebugLogger {
  private logLevel: LogLevel = 'error'; // Default to error so we see failures
  /** Resolves once async init (storage load) is complete. */
  readonly ready: Promise<void>;

  constructor(adapter?: StorageAdapter) {
    if (adapter) {
      this.ready = this.loadDebugState(adapter);
    } else {
      this.ready = Promise.resolve();
    }
  }

  private async loadDebugState(adapter: StorageAdapter): Promise<void> {
    try {
      const result = (await adapter.getSync('preferences')) as {
        preferences?: { logLevel?: LogLevel; debug?: boolean };
      };
      if (result.preferences?.logLevel) {
        this.logLevel = result.preferences.logLevel;
      } else if (result.preferences?.debug) {
        // Migration: if debug was true, use debug level, otherwise use error (default)
        this.logLevel = 'debug';
      } else {
        this.logLevel = 'error';
      }
    } catch {
      // If we can't access storage, default to error
      this.logLevel = 'error';
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[this.logLevel] >= LEVEL_PRIORITY[level];
  }

  log(context: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      console.log(`[${context}]`, ...(args as any[]));
    }
  }

  debug(context: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      console.debug(`[${context}]`, ...(args as any[]));
    }
  }

  info(context: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      console.info(`[${context}]`, ...(args as any[]));
    }
  }

  warn(context: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      console.warn(`[${context}]`, ...(args as any[]));
    }
  }

  error(context: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      console.error(`[${context}]`, ...(args as any[]));
    }
  }

  group(context: string, label: string): void {
    if (this.shouldLog('debug')) {
      console.group(`[${context}] ${label}`);
    }
  }

  groupEnd(): void {
    if (this.shouldLog('debug')) {
      console.groupEnd();
    }
  }

  table(context: string, data: unknown): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(`[${context}]`);
      console.table(data);
    }
  }

  time(context: string, label: string): void {
    if (this.shouldLog('debug')) {
      console.time(`[${context}] ${label}`);
    }
  }

  timeEnd(context: string, label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(`[${context}] ${label}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Create a new DebugLogger, optionally loading preferences from an adapter. */
export function createDebugLogger(adapter?: StorageAdapter): DebugLogger {
  return new DebugLogger(adapter);
}

/** Convenience object that mirrors the original `debug` export shape. */
export interface DebugHelpers {
  log: (context: string, ...args: unknown[]) => void;
  debug: (context: string, ...args: unknown[]) => void;
  info: (context: string, ...args: unknown[]) => void;
  warn: (context: string, ...args: unknown[]) => void;
  error: (context: string, ...args: unknown[]) => void;
  group: (context: string, label: string) => void;
  groupEnd: () => void;
  table: (context: string, data: unknown) => void;
  time: (context: string, label: string) => void;
  timeEnd: (context: string, label: string) => void;
  setLogLevel: (level: LogLevel) => void;
  getLogLevel: () => LogLevel;
  setDebugMode: (enabled: boolean) => void;
  isDebugEnabled: () => boolean;
}

/** Create a convenience `debug` helper object backed by the given logger. */
export function createDebug(adapter?: StorageAdapter): DebugHelpers {
  const logger = new DebugLogger(adapter);
  return {
    log: (context: string, ...args: unknown[]) => logger.log(context, ...args),
    debug: (context: string, ...args: unknown[]) => logger.debug(context, ...args),
    info: (context: string, ...args: unknown[]) => logger.info(context, ...args),
    warn: (context: string, ...args: unknown[]) => logger.warn(context, ...args),
    error: (context: string, ...args: unknown[]) => logger.error(context, ...args),
    group: (context: string, label: string) => logger.group(context, label),
    groupEnd: () => logger.groupEnd(),
    table: (context: string, data: unknown) => logger.table(context, data),
    time: (context: string, label: string) => logger.time(context, label),
    timeEnd: (context: string, label: string) => logger.timeEnd(context, label),
    setLogLevel: (level: LogLevel) => logger.setLogLevel(level),
    getLogLevel: () => logger.getLogLevel(),
    // Compat
    setDebugMode: (enabled: boolean) => logger.setLogLevel(enabled ? 'debug' : 'error'),
    isDebugEnabled: () => logger.getLogLevel() === 'debug',
  };
}
