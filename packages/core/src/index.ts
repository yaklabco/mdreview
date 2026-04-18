// @mdreview/core - shared rendering engine
export const VERSION = '0.1.0';

// Types
export type * from './types/index';

// Default state & preferences
export { DEFAULT_PREFERENCES, DEFAULT_STATE } from './default-state';

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
// Comment manager
export { CommentManager } from './comments/comment-manager';
export type { CommentManagerAdapters } from './comments/comment-manager';
// Comment UI
export { CommentHighlighter } from './comments/comment-highlight';
export { CommentUI } from './comments/comment-ui';
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
export { DOMPurifierUtil, domPurifier } from './utils/dom-purifier';
export { SkeletonRenderer } from './utils/skeleton-renderer';
export type { SkeletonSection } from './utils/skeleton-renderer';
export { ScrollManager } from './utils/scroll-manager';

// Markdown converter
export { MarkdownConverter, markdownConverter } from './markdown-converter';
export type { ConvertOptions } from './markdown-converter';

// Cache manager
export { CacheManager, cacheManager } from './cache-manager';
export type { CacheOptions } from './cache-manager';

// Frontmatter extractor
export { extractFrontmatter, renderFrontmatterHtml } from './frontmatter-extractor';
export type { FrontmatterResult } from './frontmatter-extractor';

// Debug logger
export { DebugLogger, createDebugLogger, createDebug, debug } from './utils/debug-logger';
export type { DebugHelpers } from './utils/debug-logger';

// Theme engine
export { ThemeEngine } from './theme-engine';
export type { ThemeInfo, ThemeOverrides } from './theme-engine';

// Render pipeline
export { RenderPipeline } from './render-pipeline';
export type {
  RenderOptions,
  RenderProgress,
  ProgressCallback,
  RenderPipelineOptions,
} from './render-pipeline';

// Renderers
export {
  SyntaxHighlighter,
  syntaxHighlighter,
  SYNTAX_THEME_MAP,
} from './renderers/syntax-highlighter';
export type { HighlightResult, DetectionResult } from './renderers/syntax-highlighter';
export { MermaidRenderer, mermaidRenderer } from './renderers/mermaid-renderer';
export type { MermaidOptions, DiagramControls } from './renderers/mermaid-renderer';

// Export modules
export { ContentCollector } from './utils/content-collector';
export { SVGConverter } from './utils/svg-converter';
export { DOCXGenerator } from './utils/docx-generator';
export { PDFGenerator } from './utils/pdf-generator';
export { ExportController } from './export-controller';

// UI
export { TocRenderer } from './ui/toc-renderer';
export { ExportUI } from './ui/export-ui';
export type { CoreExportUIOptions } from './ui/export-ui';

// Lazy section renderer
export { LazySectionRenderer } from './lazy-section-renderer';
export type { LazySectionOptions } from './lazy-section-renderer';

// Platform adapters
export * from './adapters';

// Workers
export { WorkerPool, workerPool } from './workers/worker-pool';
export type { WorkerPoolOptions } from './workers/worker-pool';
export { handleParseTask } from './workers/tasks/parse-task';
export { handleHighlightTask } from './workers/tasks/highlight-task';
export { handleMermaidTask } from './workers/tasks/mermaid-task';
