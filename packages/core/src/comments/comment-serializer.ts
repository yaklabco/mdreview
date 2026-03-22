/**
 * Comment Serializer (v1)
 *
 * Generates markdown with footnote references injected and footnote bodies appended.
 * Handles add, update, delete, and resolve operations on raw markdown strings.
 *
 * Markdown format:
 *   Some highlighted text[^comment-1] in context.
 *
 *   <!-- mdreview:comments -->
 *   [^comment-1]: <!-- mdreview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
 *       This API endpoint needs error handling
 *       for the 404 case.
 *
 * @deprecated Use `annotation-serializer.ts` instead. This module is no longer
 * imported by production code.
 */

import type { Comment, CommentMetadata, CommentReply } from '../types/index';
import type { SourcePositionMap, SelectionContext } from './source-position-map';
import { findInsertionPoint } from './source-position-map';

const COMMENT_SEPARATOR = '<!-- mdreview:comments -->';
const COMMENT_SEPARATOR_LEGACY = '<!-- mdview:comments -->';
const COMMENT_ID_PATTERN = /\[\^comment-(\d+)\]/g;
const FOOTNOTE_DEF_PATTERN = /^\[\^(comment-\d+)\]: <!-- md(?:view|review):comment (.+?) -->/;

/**
 * Scan the markdown for `[^comment-N]` patterns and return `comment-(max+1)`.
 */
export function generateNextCommentId(markdown: string): string {
  let max = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(COMMENT_ID_PATTERN.source, 'g');
  while ((match = pattern.exec(markdown)) !== null) {
    const num = parseInt(match[1], 10);
    if (num > max) {
      max = num;
    }
  }
  return `comment-${max + 1}`;
}

/**
 * Build the metadata JSON string for a comment footnote.
 * Omits the `resolved` key when it is false/undefined to keep the format clean.
 */
function buildMetadataJson(meta: CommentMetadata): string {
  const obj: Record<string, unknown> = {
    author: meta.author,
    date: meta.date,
  };
  if (meta.resolved) {
    obj.resolved = true;
  }
  if (meta.selectedText) {
    obj.selectedText = meta.selectedText;
  }
  // Positional context fields
  if (meta.line !== undefined) {
    obj.line = meta.line;
  }
  if (meta.section !== undefined) {
    obj.section = meta.section;
  }
  if (meta.sectionLevel !== undefined) {
    obj.sectionLevel = meta.sectionLevel;
  }
  if (meta.breadcrumb !== undefined && meta.breadcrumb.length > 0) {
    obj.breadcrumb = meta.breadcrumb;
  }
  if (meta.tags !== undefined && meta.tags.length > 0) {
    obj.tags = meta.tags;
  }
  if (meta.replies !== undefined && meta.replies.length > 0) {
    obj.replies = meta.replies;
  }
  if (meta.reactions !== undefined && Object.keys(meta.reactions).length > 0) {
    obj.reactions = meta.reactions;
  }
  return JSON.stringify(obj);
}

/**
 * Format the footnote body lines, each indented with 4 spaces.
 */
function formatFootnoteBody(body: string): string {
  return body
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

/**
 * Build a complete footnote definition block.
 */
function buildFootnoteBlock(comment: Comment): string {
  const meta: CommentMetadata = {
    author: comment.author,
    date: comment.date,
  };
  if (comment.resolved) {
    meta.resolved = true;
  }
  if (comment.selectedText) {
    meta.selectedText = comment.selectedText;
  }
  if (comment.context) {
    meta.line = comment.context.line;
    meta.section = comment.context.section;
    meta.sectionLevel = comment.context.sectionLevel;
    meta.breadcrumb = comment.context.breadcrumb;
  }
  if (comment.tags && comment.tags.length > 0) {
    meta.tags = comment.tags;
  }
  if (comment.replies && comment.replies.length > 0) {
    meta.replies = comment.replies;
  }
  if (comment.reactions && Object.keys(comment.reactions).length > 0) {
    meta.reactions = comment.reactions;
  }
  const metaJson = buildMetadataJson(meta);
  const header = `[^${comment.id}]: <!-- mdreview:comment ${metaJson} -->`;
  const body = formatFootnoteBody(comment.body);
  return `${header}\n${body}`;
}

/**
 * Find the selectedText in the content portion of the markdown (above the
 * comments separator) and insert the footnote reference after the first
 * unmatched occurrence.
 *
 * "Unmatched" means the occurrence is not already immediately followed by
 * a `[^comment-N]` reference.
 */
function insertReference(contentSection: string, selectedText: string, commentId: string): string {
  const ref = `[^${commentId}]`;
  // We need to find the first occurrence of selectedText that is NOT
  // already followed by [^comment-...]
  const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedText}(?!\\[\\^comment-\\d+\\])`);
  const match = pattern.exec(contentSection);
  if (match) {
    const insertPos = match.index + match[0].length;
    return contentSection.slice(0, insertPos) + ref + contentSection.slice(insertPos);
  }
  // Fallback: if no unmatched occurrence, just append to first occurrence
  const idx = contentSection.indexOf(selectedText);
  if (idx !== -1) {
    const insertPos = idx + selectedText.length;
    return contentSection.slice(0, insertPos) + ref + contentSection.slice(insertPos);
  }
  return contentSection;
}

/**
 * Split markdown into content (above separator) and comments section (below).
 * Returns [contentSection, commentsSection | null].
 */
function splitAtSeparator(markdown: string): [string, string | null] {
  let sepIdx = markdown.indexOf(COMMENT_SEPARATOR);
  let sepLen = COMMENT_SEPARATOR.length;
  if (sepIdx === -1) {
    sepIdx = markdown.indexOf(COMMENT_SEPARATOR_LEGACY);
    sepLen = COMMENT_SEPARATOR_LEGACY.length;
  }
  if (sepIdx === -1) {
    return [markdown, null];
  }
  const content = markdown.slice(0, sepIdx);
  const comments = markdown.slice(sepIdx + sepLen);
  return [content, comments];
}

/**
 * Add a comment: insert reference after selectedText, append footnote body
 * after separator.
 */
export function addComment(markdown: string, comment: Comment): string {
  const [contentSection, existingComments] = splitAtSeparator(markdown);

  // Insert reference in content
  const updatedContent = insertReference(contentSection, comment.selectedText, comment.id);

  // Build footnote block
  const footnoteBlock = buildFootnoteBlock(comment);

  if (existingComments !== null) {
    // Separator already exists; append the new footnote
    const trimmedComments = existingComments.trimEnd();
    return (
      updatedContent +
      COMMENT_SEPARATOR +
      (trimmedComments ? trimmedComments + '\n\n' : '\n') +
      footnoteBlock +
      '\n'
    );
  } else {
    // No separator yet; add it
    const trimmedContent = updatedContent.trimEnd();
    return trimmedContent + '\n\n' + COMMENT_SEPARATOR + '\n' + footnoteBlock + '\n';
  }
}

/**
 * Add a comment using a pre-built source position map for accurate insertion.
 * Falls back to `addComment()` (text-search based) if the map can't find the position.
 */
export function addCommentAtOffset(
  markdown: string,
  comment: Comment,
  sourceMap: SourcePositionMap,
  context?: SelectionContext
): string {
  const offset = findInsertionPoint(sourceMap, comment.selectedText, context);

  if (offset === null) {
    // Fallback to text-search based insertion
    return addComment(markdown, comment);
  }

  const [contentSection, existingComments] = splitAtSeparator(markdown);

  // Insert the reference at the exact offset in the content section
  const ref = `[^${comment.id}]`;
  const updatedContent = contentSection.slice(0, offset) + ref + contentSection.slice(offset);

  // Build footnote block
  const footnoteBlock = buildFootnoteBlock(comment);

  if (existingComments !== null) {
    const trimmedComments = existingComments.trimEnd();
    return (
      updatedContent +
      COMMENT_SEPARATOR +
      (trimmedComments ? trimmedComments + '\n\n' : '\n') +
      footnoteBlock +
      '\n'
    );
  } else {
    const trimmedContent = updatedContent.trimEnd();
    return trimmedContent + '\n\n' + COMMENT_SEPARATOR + '\n' + footnoteBlock + '\n';
  }
}

/**
 * Parse the comments section into individual footnote blocks.
 * Each block is: { id, headerLine, bodyLines[] }.
 */
interface FootnoteBlock {
  id: string;
  headerLine: string;
  bodyLines: string[];
}

function parseFootnoteBlocks(commentsSection: string): FootnoteBlock[] {
  const lines = commentsSection.split('\n');
  const blocks: FootnoteBlock[] = [];
  let current: FootnoteBlock | null = null;

  for (const line of lines) {
    const defMatch = FOOTNOTE_DEF_PATTERN.exec(line);
    if (defMatch) {
      if (current) {
        blocks.push(current);
      }
      current = {
        id: defMatch[1],
        headerLine: line,
        bodyLines: [],
      };
    } else if (current && line.startsWith('    ')) {
      current.bodyLines.push(line);
    } else if (current && line.trim() === '') {
      // Blank line between blocks -- finalize current
      blocks.push(current);
      current = null;
    }
  }
  if (current) {
    blocks.push(current);
  }
  return blocks;
}

/**
 * Serialize footnote blocks back to a comments section string.
 */
function serializeFootnoteBlocks(blocks: FootnoteBlock[]): string {
  return blocks.map((b) => [b.headerLine, ...b.bodyLines].join('\n')).join('\n\n');
}

/**
 * Remove a comment: remove the inline reference and the footnote body.
 * Remove the separator if no comments remain.
 */
export function removeComment(markdown: string, commentId: string): string {
  const [contentSection, commentsSection] = splitAtSeparator(markdown);

  // Remove inline reference [^commentId]
  const ref = `[^${commentId}]`;
  const cleanedContent = contentSection.split(ref).join('');

  if (commentsSection === null) {
    return cleanedContent;
  }

  // Parse and filter footnote blocks
  const blocks = parseFootnoteBlocks(commentsSection);
  const remaining = blocks.filter((b) => b.id !== commentId);

  if (remaining.length === 0) {
    // No comments remain; remove separator and trailing whitespace
    return cleanedContent.trimEnd() + '\n';
  }

  // Rebuild with separator and remaining blocks
  const serialized = serializeFootnoteBlocks(remaining);
  return cleanedContent + COMMENT_SEPARATOR + '\n' + serialized + '\n';
}

/**
 * Update a comment's body: replace the body lines under the matching footnote
 * while keeping the metadata header unchanged.
 */
export function updateComment(markdown: string, commentId: string, newBody: string): string {
  const [contentSection, commentsSection] = splitAtSeparator(markdown);

  if (commentsSection === null) {
    return markdown;
  }

  const blocks = parseFootnoteBlocks(commentsSection);
  const updatedBlocks = blocks.map((b) => {
    if (b.id === commentId) {
      return {
        ...b,
        bodyLines: newBody.split('\n').map((line) => `    ${line}`),
      };
    }
    return b;
  });

  const serialized = serializeFootnoteBlocks(updatedBlocks);
  return contentSection + COMMENT_SEPARATOR + '\n' + serialized + '\n';
}

/**
 * Resolve a comment: parse the metadata JSON, set resolved:true, re-serialize.
 */
export function resolveComment(markdown: string, commentId: string): string {
  return updateCommentMetadata(markdown, commentId, (meta) => {
    meta.resolved = true;
  });
}

/**
 * Generic metadata updater: parse a comment's metadata JSON, call the updater
 * function to mutate it, then rebuild the header line. Preserves body and
 * other comments.
 */
export function updateCommentMetadata(
  markdown: string,
  commentId: string,
  updater: (meta: CommentMetadata) => void
): string {
  const [contentSection, commentsSection] = splitAtSeparator(markdown);

  if (commentsSection === null) {
    return markdown;
  }

  const blocks = parseFootnoteBlocks(commentsSection);
  let found = false;

  const updatedBlocks = blocks.map((b) => {
    if (b.id === commentId) {
      const defMatch = FOOTNOTE_DEF_PATTERN.exec(b.headerLine);
      if (defMatch) {
        found = true;
        const meta: CommentMetadata = JSON.parse(defMatch[2]) as CommentMetadata;
        updater(meta);
        const metaJson = buildMetadataJson(meta);
        const newHeader = `[^${b.id}]: <!-- mdreview:comment ${metaJson} -->`;
        return { ...b, headerLine: newHeader };
      }
    }
    return b;
  });

  if (!found) {
    return markdown;
  }

  const serialized = serializeFootnoteBlocks(updatedBlocks);
  return contentSection + COMMENT_SEPARATOR + '\n' + serialized + '\n';
}

/**
 * Add a reply to a comment. Generates a sequential reply ID scoped to the
 * parent comment. Returns the updated markdown and the generated reply ID.
 */
export function addReply(
  markdown: string,
  commentId: string,
  reply: Omit<CommentReply, 'id'>
): { markdown: string; replyId: string } {
  let replyId = '';

  const updated = updateCommentMetadata(markdown, commentId, (meta) => {
    const replies = meta.replies ?? [];
    // Generate sequential ID: reply-1, reply-2, ...
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
    meta.replies = replies;
  });

  return { markdown: updated, replyId };
}

/**
 * Toggle an emoji reaction for an author on a comment.
 * Adds the author if not present; removes if already present.
 * Removes the emoji key entirely when no authors remain.
 */
export function toggleReaction(
  markdown: string,
  commentId: string,
  emoji: string,
  author: string
): string {
  return updateCommentMetadata(markdown, commentId, (meta) => {
    const reactions = meta.reactions ?? {};
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

    // Only set reactions if non-empty
    if (Object.keys(reactions).length > 0) {
      meta.reactions = reactions;
    } else {
      delete meta.reactions;
    }
  });
}
