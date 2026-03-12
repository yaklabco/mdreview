/**
 * Annotation Serializer (v2)
 *
 * Generates markdown with `[@N]` inline markers and a structured JSON
 * annotation block in `<!-- mdview:annotations [...] -->`.
 *
 * Drop-in replacement for comment-serializer: same exported function
 * signatures. On v1 input, automatically migrates to v2 format.
 */

import type { Comment, CommentReply } from '../types';
import type { SourcePositionMap, SelectionContext } from './source-position-map';
import { findInsertionPoint } from './source-position-map';
import { parseComments } from './comment-parser';

const V1_SENTINEL = '<!-- mdview:comments -->';
const V2_SENTINEL_PREFIX = '<!-- mdview:annotations';
const V2_BLOCK_PATTERN = /<!-- mdview:annotations\s+(\[[\s\S]*?\])\s*-->/;
const V2_MARKER_PATTERN = /\[@(\d+)\]/g;

// ─── v2 annotation JSON shape ────────────────────────────────────────

interface Annotation {
  id: number;
  anchor: { text: string; prefix?: string; suffix?: string };
  body: string;
  author: string;
  date: string;
  resolved?: boolean;
  tags?: string[];
  thread?: Array<{ author: string; body: string; date: string }>;
  reactions?: Record<string, string[]>;
  context?: {
    line?: number;
    section?: string;
    sectionLevel?: number;
    breadcrumb?: string[];
  };
}

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Split markdown into content (above annotation block) and annotations array.
 */
function splitAtAnnotationBlock(
  markdown: string
): [string, Annotation[] | null] {
  const blockMatch = markdown.match(V2_BLOCK_PATTERN);
  if (!blockMatch) {
    return [markdown, null];
  }

  const blockStart = markdown.indexOf(V2_SENTINEL_PREFIX);
  const content = markdown.slice(0, blockStart);

  try {
    const annotations = JSON.parse(blockMatch[1]) as Annotation[];
    return [content, annotations];
  } catch {
    return [content, null];
  }
}

/**
 * Pretty-print the annotation block with 2-space indentation.
 */
function serializeAnnotationBlock(annotations: Annotation[]): string {
  const json = JSON.stringify(annotations, null, 2);
  return `<!-- mdview:annotations ${json} -->`;
}

/**
 * Convert an internal Comment to a v2 annotation JSON object.
 */
function commentToAnnotation(comment: Comment): Annotation {
  const numId = parseInt(comment.id.replace('comment-', ''), 10);

  const anchor: Annotation['anchor'] = { text: comment.selectedText };
  if (comment.anchorPrefix) anchor.prefix = comment.anchorPrefix;
  if (comment.anchorSuffix) anchor.suffix = comment.anchorSuffix;

  const annotation: Annotation = {
    id: numId,
    anchor,
    body: comment.body,
    author: comment.author,
    date: comment.date,
  };

  if (comment.resolved) {
    annotation.resolved = true;
  }

  if (comment.tags && comment.tags.length > 0) {
    annotation.tags = comment.tags;
  }

  if (comment.replies && comment.replies.length > 0) {
    annotation.thread = comment.replies.map((r) => ({
      author: r.author,
      body: r.body,
      date: r.date,
    }));
  }

  if (comment.reactions && Object.keys(comment.reactions).length > 0) {
    annotation.reactions = comment.reactions;
  }

  if (comment.context) {
    const ctx: Annotation['context'] = {};
    if (comment.context.line !== undefined) ctx.line = comment.context.line;
    if (comment.context.section !== undefined)
      ctx.section = comment.context.section;
    if (comment.context.sectionLevel !== undefined)
      ctx.sectionLevel = comment.context.sectionLevel;
    if (comment.context.breadcrumb && comment.context.breadcrumb.length > 0)
      ctx.breadcrumb = comment.context.breadcrumb;
    if (Object.keys(ctx).length > 0) annotation.context = ctx;
  }

  return annotation;
}

/**
 * Convert a v2 annotation to an internal Comment.
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

  if (annotation.anchor.prefix) comment.anchorPrefix = annotation.anchor.prefix;
  if (annotation.anchor.suffix) comment.anchorSuffix = annotation.anchor.suffix;

  if (annotation.tags && annotation.tags.length > 0) {
    comment.tags = annotation.tags as Comment['tags'];
  }

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

  if (annotation.reactions && Object.keys(annotation.reactions).length > 0) {
    comment.reactions = annotation.reactions;
  }

  if (annotation.context && annotation.context.line !== undefined) {
    comment.context = {
      line: annotation.context.line,
      section: annotation.context.section,
      sectionLevel: annotation.context.sectionLevel,
      breadcrumb: annotation.context.breadcrumb ?? [],
    };
  }

  return comment;
}

/**
 * Detect v1 sentinel and fully migrate to v2 format.
 * Returns the markdown with all v1 content replaced by v2.
 */
function migrateV1Content(markdown: string): string {
  const result = parseComments(markdown);

  // Start with cleaned content (v1 refs already stripped by parser)
  let content = result.cleanedMarkdown;

  // Re-insert markers in v2 format
  for (const comment of result.comments) {
    const numId = parseInt(comment.id.replace('comment-', ''), 10);
    const marker = `[@${numId}]`;
    const idx = content.indexOf(comment.selectedText);
    if (idx !== -1) {
      const insertPos = idx + comment.selectedText.length;
      content = content.slice(0, insertPos) + marker + content.slice(insertPos);
    }
  }

  // Build annotation block
  const annotations = result.comments.map(commentToAnnotation);
  const block = serializeAnnotationBlock(annotations);

  return content.trimEnd() + '\n\n' + block + '\n';
}

/**
 * If markdown contains v1 sentinel, migrate it. Otherwise return as-is.
 */
function ensureV2(markdown: string): string {
  if (markdown.includes(V1_SENTINEL)) {
    return migrateV1Content(markdown);
  }
  return markdown;
}

/**
 * Insert a `[@N]` marker after the first unmatched occurrence of selectedText
 * in the content section.
 */
function insertMarker(
  contentSection: string,
  selectedText: string,
  numId: number
): string {
  const marker = `[@${numId}]`;
  const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Find first occurrence not already followed by [@N]
  const pattern = new RegExp(`${escapedText}(?!\\[@\\d+\\])`);
  const match = pattern.exec(contentSection);
  if (match) {
    const insertPos = match.index + match[0].length;
    return (
      contentSection.slice(0, insertPos) +
      marker +
      contentSection.slice(insertPos)
    );
  }
  // Fallback: append to first occurrence
  const idx = contentSection.indexOf(selectedText);
  if (idx !== -1) {
    const insertPos = idx + selectedText.length;
    return (
      contentSection.slice(0, insertPos) +
      marker +
      contentSection.slice(insertPos)
    );
  }
  return contentSection;
}

// ─── Exported API (same signatures as v1 serializer) ─────────────────

/**
 * Scan for `[@N]` markers and annotation `"id": N` to find the next ID.
 */
export function generateNextCommentId(markdown: string): string {
  let max = 0;

  // Check [@N] markers
  let match: RegExpExecArray | null;
  const markerPattern = new RegExp(V2_MARKER_PATTERN.source, 'g');
  while ((match = markerPattern.exec(markdown)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) max = num;
  }

  // Check "id": N in annotation block
  const idPattern = /"id":\s*(\d+)/g;
  while ((match = idPattern.exec(markdown)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) max = num;
  }

  // Also check v1 patterns for migration scenarios
  const v1Pattern = /\[\^comment-(\d+)\]/g;
  while ((match = v1Pattern.exec(markdown)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) max = num;
  }

  return `comment-${max + 1}`;
}

/**
 * Add a comment: insert `[@N]` marker after selectedText, append to annotation block.
 */
export function addComment(markdown: string, comment: Comment): string {
  // Migrate v1 if needed
  const md = ensureV2(markdown);

  const [contentSection, existingAnnotations] = splitAtAnnotationBlock(md);
  const numId = parseInt(comment.id.replace('comment-', ''), 10);

  // Insert marker in content
  const updatedContent = insertMarker(contentSection, comment.selectedText, numId);

  // Build annotation
  const annotation = commentToAnnotation(comment);

  const annotations = existingAnnotations ? [...existingAnnotations, annotation] : [annotation];
  const block = serializeAnnotationBlock(annotations);

  return updatedContent.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Add a comment using a pre-built source position map for accurate insertion.
 * Falls back to `addComment()` if the map can't find the position.
 */
export function addCommentAtOffset(
  markdown: string,
  comment: Comment,
  sourceMap: SourcePositionMap,
  context?: SelectionContext
): string {
  const offset = findInsertionPoint(sourceMap, comment.selectedText, context);

  if (offset === null) {
    return addComment(markdown, comment);
  }

  // Migrate v1 if needed
  const md = ensureV2(markdown);

  const [contentSection, existingAnnotations] = splitAtAnnotationBlock(md);
  const numId = parseInt(comment.id.replace('comment-', ''), 10);
  const marker = `[@${numId}]`;

  // Insert marker at exact offset
  const updatedContent =
    contentSection.slice(0, offset) + marker + contentSection.slice(offset);

  const annotation = commentToAnnotation(comment);
  const annotations = existingAnnotations ? [...existingAnnotations, annotation] : [annotation];
  const block = serializeAnnotationBlock(annotations);

  return updatedContent.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Remove a comment: remove `[@N]` marker and annotation entry.
 * Removes block entirely if no annotations remain.
 */
export function removeComment(markdown: string, commentId: string): string {
  const md = ensureV2(markdown);

  const [contentSection, annotations] = splitAtAnnotationBlock(md);

  if (!annotations) {
    // No annotation block — just strip any markers
    const numId = parseInt(commentId.replace('comment-', ''), 10);
    return contentSection.split(`[@${numId}]`).join('');
  }

  const numId = parseInt(commentId.replace('comment-', ''), 10);

  // Remove inline marker
  const cleanedContent = contentSection.split(`[@${numId}]`).join('');

  // Remove annotation entry
  const remaining = annotations.filter((a) => a.id !== numId);

  if (remaining.length === 0) {
    return cleanedContent.trimEnd() + '\n';
  }

  const block = serializeAnnotationBlock(remaining);
  return cleanedContent.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Update a comment's body in the annotation block.
 */
export function updateComment(
  markdown: string,
  commentId: string,
  newBody: string
): string {
  const md = ensureV2(markdown);

  const [contentSection, annotations] = splitAtAnnotationBlock(md);
  if (!annotations) return markdown;

  const numId = parseInt(commentId.replace('comment-', ''), 10);
  let found = false;

  const updated = annotations.map((a) => {
    if (a.id === numId) {
      found = true;
      return { ...a, body: newBody };
    }
    return a;
  });

  if (!found) return markdown;

  const block = serializeAnnotationBlock(updated);
  return contentSection.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Resolve a comment: set `resolved: true`.
 */
export function resolveComment(markdown: string, commentId: string): string {
  return updateCommentMetadata(markdown, commentId, (c) => {
    c.resolved = true;
  });
}

/**
 * Generic metadata updater: parse annotation, call updater to mutate
 * the Comment, then re-serialize.
 */
export function updateCommentMetadata(
  markdown: string,
  commentId: string,
  updater: (comment: Comment) => void
): string {
  const md = ensureV2(markdown);

  const [contentSection, annotations] = splitAtAnnotationBlock(md);
  if (!annotations) return markdown;

  const numId = parseInt(commentId.replace('comment-', ''), 10);
  let found = false;

  const updated = annotations.map((a) => {
    if (a.id === numId) {
      found = true;
      const comment = annotationToComment(a);
      updater(comment);
      return commentToAnnotation(comment);
    }
    return a;
  });

  if (!found) return markdown;

  const block = serializeAnnotationBlock(updated);
  return contentSection.trimEnd() + '\n\n' + block + '\n';
}

/**
 * Add a reply to a comment's thread.
 */
export function addReply(
  markdown: string,
  commentId: string,
  reply: Omit<CommentReply, 'id'>
): { markdown: string; replyId: string } {
  let replyId = '';

  const updated = updateCommentMetadata(markdown, commentId, (comment) => {
    const replies = comment.replies ?? [];
    let maxNum = 0;
    for (const r of replies) {
      const match = /^reply-(\d+)$/.exec(r.id);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    replyId = `reply-${maxNum + 1}`;
    replies.push({ id: replyId, ...reply });
    comment.replies = replies;
  });

  return { markdown: updated, replyId };
}

/**
 * Toggle an emoji reaction for an author on a comment.
 */
export function toggleReaction(
  markdown: string,
  commentId: string,
  emoji: string,
  author: string
): string {
  return updateCommentMetadata(markdown, commentId, (comment) => {
    const reactions = comment.reactions ?? {};
    const authors = reactions[emoji] ?? [];

    const idx = authors.indexOf(author);
    if (idx >= 0) {
      authors.splice(idx, 1);
      if (authors.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = authors;
      }
    } else {
      reactions[emoji] = [...authors, author];
    }

    if (Object.keys(reactions).length > 0) {
      comment.reactions = reactions;
    } else {
      delete comment.reactions;
    }
  });
}
