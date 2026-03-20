/**
 * Test that all public APIs are accessible via the @mdview/core barrel export.
 */
import {
  // Version
  VERSION,
  // Themes
  githubLight,
  githubDark,
  catppuccinLatte,
  catppuccinFrappe,
  catppuccinMacchiato,
  catppuccinMocha,
  monokai,
  monokaiPro,
  // Comment parsers (v2 annotation format)
  detectFormat,
  parseAnnotations,
  // Comment serializers (v2 annotation format)
  generateNextCommentId,
  addComment,
  addCommentAtOffset,
  removeComment,
  updateComment,
  resolveComment,
  updateCommentMetadata,
  addReply,
  toggleReaction,
  // Comment parsers (v1 legacy)
  parseComments,
  // Comment context & utilities
  computeCommentContext,
  buildSourceMap,
  findInsertionPoint,
  QUICK_EMOJIS,
  EMOJI_CATEGORIES,
  searchEmojis,
  // Utilities
  splitIntoSections,
  splitIntoChunks,
  FilenameGenerator,
  stripTableOfContents,
  // Markdown converter
  MarkdownConverter,
  markdownConverter,
  // Cache manager
  CacheManager,
  cacheManager,
  // Frontmatter
  extractFrontmatter,
  renderFrontmatterHtml,
  // Debug logger
  DebugLogger,
  createDebugLogger,
  createDebug,
} from '../index';

describe('@mdview/core barrel export', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });

  it('exports all 8 themes', () => {
    const themes = [
      githubLight,
      githubDark,
      catppuccinLatte,
      catppuccinFrappe,
      catppuccinMacchiato,
      catppuccinMocha,
      monokai,
      monokaiPro,
    ];
    for (const theme of themes) {
      expect(theme).toHaveProperty('name');
      expect(theme).toHaveProperty('colors');
      expect(theme).toHaveProperty('variant');
    }
  });

  it('exports v2 annotation parsers', () => {
    expect(typeof detectFormat).toBe('function');
    expect(typeof parseAnnotations).toBe('function');
  });

  it('exports v2 annotation serializer functions', () => {
    expect(typeof generateNextCommentId).toBe('function');
    expect(typeof addComment).toBe('function');
    expect(typeof addCommentAtOffset).toBe('function');
    expect(typeof removeComment).toBe('function');
    expect(typeof updateComment).toBe('function');
    expect(typeof resolveComment).toBe('function');
    expect(typeof updateCommentMetadata).toBe('function');
    expect(typeof addReply).toBe('function');
    expect(typeof toggleReaction).toBe('function');
  });

  it('exports v1 legacy parser', () => {
    expect(typeof parseComments).toBe('function');
  });

  it('exports comment context and utilities', () => {
    expect(typeof computeCommentContext).toBe('function');
    expect(typeof buildSourceMap).toBe('function');
    expect(typeof findInsertionPoint).toBe('function');
    expect(QUICK_EMOJIS).toBeDefined();
    expect(EMOJI_CATEGORIES).toBeDefined();
    expect(typeof searchEmojis).toBe('function');
  });

  it('exports utility functions', () => {
    expect(typeof splitIntoSections).toBe('function');
    expect(typeof splitIntoChunks).toBe('function');
    expect(FilenameGenerator).toBeDefined();
    expect(typeof stripTableOfContents).toBe('function');
  });

  it('exports markdown converter', () => {
    expect(MarkdownConverter).toBeDefined();
    expect(markdownConverter).toBeInstanceOf(MarkdownConverter);
  });

  it('exports cache manager', () => {
    expect(CacheManager).toBeDefined();
    expect(cacheManager).toBeInstanceOf(CacheManager);
  });

  it('exports frontmatter functions', () => {
    expect(typeof extractFrontmatter).toBe('function');
    expect(typeof renderFrontmatterHtml).toBe('function');
  });

  it('exports debug logger', () => {
    expect(DebugLogger).toBeDefined();
    expect(typeof createDebugLogger).toBe('function');
    expect(typeof createDebug).toBe('function');
  });
});
