/**
 * Annotation Parser (v2) — unified entry point for parsing both v1 and v2
 * comment formats from markdown.
 *
 * v2 uses `[@N]` inline markers and a structured JSON annotation block
 * in `<!-- mdview:annotations [...] -->` at the end of the document.
 *
 * v1 uses `[^comment-N]` footnote references and `<!-- mdview:comments -->`
 * separator with footnote definitions.
 */

import type { Comment, CommentContext, CommentParseResult, CommentReply } from '../types/index';
import { parseComments } from './comment-parser';

const V1_SENTINEL = '<!-- mdview:comments -->';
const V2_SENTINEL_PREFIX = '<!-- mdview:annotations';
const V2_MARKER_PATTERN = /\[@\d+\]/g;
const V2_BLOCK_PATTERN = /<!-- mdview:annotations\s+(\[[\s\S]*?\])\s*-->/;

/**
 * v2 annotation JSON shape (as stored in the markdown file).
 */
interface Annotation {
  id: number;
  anchor: {
    text: string;
    prefix?: string;
    suffix?: string;
  };
  body: string;
  author: string;
  date: string;
  resolved?: boolean;
  tags?: string[];
  thread?: Array<{
    author: string;
    body: string;
    date: string;
  }>;
  reactions?: Record<string, string[]>;
  context?: {
    line?: number;
    section?: string;
    sectionLevel?: number;
    breadcrumb?: string[];
  };
}

/**
 * Detect whether a markdown string uses v1, v2, or no comment format.
 */
export function detectFormat(markdown: string): 'v1' | 'v2' | 'none' {
  const hasV1 = markdown.includes(V1_SENTINEL);
  const hasV2 = markdown.includes(V2_SENTINEL_PREFIX);

  if (hasV1) return 'v1';
  if (hasV2) return 'v2';
  return 'none';
}

/**
 * Parse annotations from markdown text.
 * Detects format automatically: v1 is delegated to comment-parser,
 * v2 is handled natively.
 */
export function parseAnnotations(markdown: string): CommentParseResult {
  const format = detectFormat(markdown);

  if (format === 'v1') {
    return parseComments(markdown);
  }

  if (format === 'v2') {
    return parseV2(markdown);
  }

  return { cleanedMarkdown: markdown, comments: [] };
}

/**
 * Alias for backward-compatible import as `parseComments`.
 */
export { parseAnnotations as parseComments };

/**
 * Parse v2 annotation format.
 */
function parseV2(markdown: string): CommentParseResult {
  // Find the annotation block
  const blockMatch = markdown.match(V2_BLOCK_PATTERN);
  if (!blockMatch) {
    // Has sentinel prefix but malformed — strip markers and return empty
    const cleanedMarkdown = stripV2Markers(stripV2Block(markdown));
    return { cleanedMarkdown, comments: [] };
  }

  // Parse JSON array
  let annotations: Annotation[];
  try {
    annotations = JSON.parse(blockMatch[1]) as Annotation[];
  } catch {
    console.warn('[MDView] Failed to parse v2 annotation JSON');
    const cleanedMarkdown = stripV2Markers(stripV2Block(markdown));
    return { cleanedMarkdown, comments: [] };
  }

  // Build Comment objects
  const comments = annotations.map(annotationToComment);

  // Remove the annotation block and [@N] markers from content
  const cleanedMarkdown = stripV2Markers(stripV2Block(markdown));

  return { cleanedMarkdown, comments };
}

/**
 * Remove the `<!-- mdview:annotations [...] -->` block from the end of the document.
 */
function stripV2Block(markdown: string): string {
  const idx = markdown.indexOf(V2_SENTINEL_PREFIX);
  if (idx === -1) return markdown;
  return markdown.slice(0, idx).trimEnd();
}

/**
 * Remove all `[@N]` markers from content.
 */
function stripV2Markers(content: string): string {
  return content.replace(V2_MARKER_PATTERN, '');
}

/**
 * Convert a v2 annotation JSON object to an internal Comment.
 */
function annotationToComment(annotation: Annotation): Comment {
  const comment: Comment = {
    id: `comment-${annotation.id}`,
    selectedText: annotation.anchor.text,
    body: annotation.body,
    author: annotation.author,
    date: annotation.date,
    resolved: annotation.resolved ?? false,
  };

  // Anchor context
  if (annotation.anchor.prefix) {
    comment.anchorPrefix = annotation.anchor.prefix;
  }
  if (annotation.anchor.suffix) {
    comment.anchorSuffix = annotation.anchor.suffix;
  }

  // Positional context
  if (annotation.context && annotation.context.line !== undefined) {
    const ctx: CommentContext = {
      line: annotation.context.line,
      section: annotation.context.section,
      sectionLevel: annotation.context.sectionLevel,
      breadcrumb: annotation.context.breadcrumb ?? [],
    };
    comment.context = ctx;
  }

  // Tags
  if (annotation.tags && annotation.tags.length > 0) {
    comment.tags = annotation.tags as Comment['tags'];
  }

  // Thread → replies
  if (annotation.thread && annotation.thread.length > 0) {
    comment.replies = annotation.thread.map(
      (t, i): CommentReply => ({
        id: `reply-${i + 1}`,
        author: t.author,
        body: t.body,
        date: t.date,
      })
    );
  }

  // Reactions
  if (annotation.reactions && Object.keys(annotation.reactions).length > 0) {
    comment.reactions = annotation.reactions;
  }

  return comment;
}
