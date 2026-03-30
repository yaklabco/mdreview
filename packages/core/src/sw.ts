/**
 * Lightweight entry point for Chrome extension service workers.
 *
 * Re-exports only the symbols the SW actually needs (CacheManager,
 * DEFAULT_STATE, types) WITHOUT pulling in mermaid, highlight.js,
 * markdown-it, or any other heavy rendering dependency.
 *
 * Using the barrel `@mdreview/core` in a service worker causes
 * a 1MB+ bundle that exceeds Chrome's SW registration time limit.
 */

export { CacheManager, cacheManager } from './cache-manager';
export { DEFAULT_STATE, DEFAULT_PREFERENCES } from './default-state';
export type { AppState, ThemeName, CachedResult, Preferences } from './types/index';
