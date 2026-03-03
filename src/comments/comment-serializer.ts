/**
 * Comment Serializer
 *
 * Generates markdown with footnote references injected and footnote bodies appended.
 * Handles add, update, delete, and resolve operations on raw markdown strings.
 *
 * Markdown format:
 *   Some highlighted text[^comment-1] in context.
 *
 *   <!-- mdview:comments -->
 *   [^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
 *       This API endpoint needs error handling
 *       for the 404 case.
 */

import type { Comment, CommentMetadata } from '../types';

const COMMENT_SEPARATOR = '<!-- mdview:comments -->';
const COMMENT_ID_PATTERN = /\[\^comment-(\d+)\]/g;
const FOOTNOTE_DEF_PATTERN =
  /^\[\^(comment-\d+)\]: <!-- mdview:comment (\{[^}]+\}) -->/;

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
  const metaJson = buildMetadataJson(meta);
  const header = `[^${comment.id}]: <!-- mdview:comment ${metaJson} -->`;
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
function insertReference(
  contentSection: string,
  selectedText: string,
  commentId: string
): string {
  const ref = `[^${commentId}]`;
  // We need to find the first occurrence of selectedText that is NOT
  // already followed by [^comment-...]
  const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `${escapedText}(?!\\[\\^comment-\\d+\\])`,
  );
  const match = pattern.exec(contentSection);
  if (match) {
    const insertPos = match.index + match[0].length;
    return (
      contentSection.slice(0, insertPos) +
      ref +
      contentSection.slice(insertPos)
    );
  }
  // Fallback: if no unmatched occurrence, just append to first occurrence
  const idx = contentSection.indexOf(selectedText);
  if (idx !== -1) {
    const insertPos = idx + selectedText.length;
    return (
      contentSection.slice(0, insertPos) +
      ref +
      contentSection.slice(insertPos)
    );
  }
  return contentSection;
}

/**
 * Split markdown into content (above separator) and comments section (below).
 * Returns [contentSection, commentsSection | null].
 */
function splitAtSeparator(markdown: string): [string, string | null] {
  const sepIdx = markdown.indexOf(COMMENT_SEPARATOR);
  if (sepIdx === -1) {
    return [markdown, null];
  }
  const content = markdown.slice(0, sepIdx);
  const comments = markdown.slice(sepIdx + COMMENT_SEPARATOR.length);
  return [content, comments];
}

/**
 * Add a comment: insert reference after selectedText, append footnote body
 * after separator.
 */
export function addComment(markdown: string, comment: Comment): string {
  const [contentSection, existingComments] = splitAtSeparator(markdown);

  // Insert reference in content
  const updatedContent = insertReference(
    contentSection,
    comment.selectedText,
    comment.id
  );

  // Build footnote block
  const footnoteBlock = buildFootnoteBlock(comment);

  if (existingComments !== null) {
    // Separator already exists; append the new footnote
    const trimmedComments = existingComments.trimEnd();
    return (
      updatedContent +
      COMMENT_SEPARATOR +
      (trimmedComments ? trimmedComments + '\n\n' : '\n') +
      footnoteBlock + '\n'
    );
  } else {
    // No separator yet; add it
    const trimmedContent = updatedContent.trimEnd();
    return (
      trimmedContent +
      '\n\n' +
      COMMENT_SEPARATOR +
      '\n' +
      footnoteBlock + '\n'
    );
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
  return blocks
    .map((b) => [b.headerLine, ...b.bodyLines].join('\n'))
    .join('\n\n');
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
  return (
    cleanedContent +
    COMMENT_SEPARATOR +
    '\n' +
    serialized + '\n'
  );
}

/**
 * Update a comment's body: replace the body lines under the matching footnote
 * while keeping the metadata header unchanged.
 */
export function updateComment(
  markdown: string,
  commentId: string,
  newBody: string
): string {
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
  return (
    contentSection +
    COMMENT_SEPARATOR +
    '\n' +
    serialized + '\n'
  );
}

/**
 * Resolve a comment: parse the metadata JSON, set resolved:true, re-serialize.
 */
export function resolveComment(markdown: string, commentId: string): string {
  const [contentSection, commentsSection] = splitAtSeparator(markdown);

  if (commentsSection === null) {
    return markdown;
  }

  const blocks = parseFootnoteBlocks(commentsSection);
  const updatedBlocks = blocks.map((b) => {
    if (b.id === commentId) {
      // Parse the metadata from the header line
      const defMatch = FOOTNOTE_DEF_PATTERN.exec(b.headerLine);
      if (defMatch) {
        const meta: CommentMetadata = JSON.parse(defMatch[2]);
        meta.resolved = true;
        const metaJson = buildMetadataJson(meta);
        const newHeader = `[^${b.id}]: <!-- mdview:comment ${metaJson} -->`;
        return { ...b, headerLine: newHeader };
      }
    }
    return b;
  });

  const serialized = serializeFootnoteBlocks(updatedBlocks);
  return (
    contentSection +
    COMMENT_SEPARATOR +
    '\n' +
    serialized + '\n'
  );
}
