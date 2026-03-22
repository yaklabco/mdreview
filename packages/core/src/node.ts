// @mdreview/core/node - lightweight entry point for Node.js (Electron main process)
// Excludes browser-only modules (workers, mermaid, DOM renderers)

export const VERSION = '0.0.1';

// Types
export type * from './types/index';

// Default state & preferences
export { DEFAULT_PREFERENCES, DEFAULT_STATE } from './default-state';

// Cache manager
export { CacheManager, cacheManager } from './cache-manager';
export type { CacheOptions } from './cache-manager';

// Platform adapters
export * from './adapters';

// Debug logger
export { DebugLogger, createDebugLogger, createDebug, debug } from './utils/debug-logger';
export type { DebugHelpers } from './utils/debug-logger';
