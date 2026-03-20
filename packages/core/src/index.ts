// @mdview/core - shared rendering engine
// Modules will be exported here as they are extracted from the Chrome extension.
export const VERSION = '0.0.1';

// Types
export type * from './types/index';

// Markdown converter
export { MarkdownConverter, markdownConverter } from './markdown-converter';
export type { ConvertOptions } from './markdown-converter';

// Cache manager
export { CacheManager, cacheManager } from './cache-manager';
export type { CacheOptions } from './cache-manager';

// Frontmatter extractor
export { extractFrontmatter, renderFrontmatterHtml } from './frontmatter-extractor';
export type { FrontmatterResult } from './frontmatter-extractor';
