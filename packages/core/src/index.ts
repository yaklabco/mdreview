// @mdview/core - shared rendering engine
export const VERSION = '0.0.1';

// Types
export type * from './types/index';

// Themes
export { default as catppuccinFrappe } from './themes/catppuccin-frappe';
export { default as catppuccinLatte } from './themes/catppuccin-latte';
export { default as catppuccinMacchiato } from './themes/catppuccin-macchiato';
export { default as catppuccinMocha } from './themes/catppuccin-mocha';
export { default as githubDark } from './themes/github-dark';
export { default as githubLight } from './themes/github-light';
export { default as monokaiPro } from './themes/monokai-pro';
export { default as monokai } from './themes/monokai';

// Comment parsers & serializers
// v2 annotation format (current)
export { detectFormat, parseAnnotations } from './comments/annotation-parser';
export {
  generateNextCommentId,
  addComment,
  addCommentAtOffset,
  removeComment,
  updateComment,
  resolveComment,
  updateCommentMetadata,
  addReply,
  toggleReaction,
} from './comments/annotation-serializer';
// v1 comment format (legacy)
export { parseComments } from './comments/comment-parser';
// Context & utilities
export * from './comments/comment-context';
export * from './comments/source-position-map';
export * from './comments/emoji-data';

// Utilities
export * from './utils/section-splitter';
export * from './utils/filename-generator';
export * from './utils/toc-stripper';
export { FileScanner } from './utils/file-scanner';
export type { WatchFileOptions } from './utils/file-scanner';

// Markdown converter
export { MarkdownConverter, markdownConverter } from './markdown-converter';
export type { ConvertOptions } from './markdown-converter';

// Cache manager
export { CacheManager, cacheManager } from './cache-manager';
export type { CacheOptions } from './cache-manager';

// Frontmatter extractor
export { extractFrontmatter, renderFrontmatterHtml } from './frontmatter-extractor';
export type { FrontmatterResult } from './frontmatter-extractor';

// Platform adapters
export * from './adapters';
