/**
 * Comment parser for extracting structured comments from markdown footnotes.
 *
 * Comments are stored as footnotes with `[^comment-*]` references in the markdown
 * content, with metadata embedded in HTML comments following the `<!-- mdview:comment {...} -->`
 * pattern. A `<!-- mdview:comments -->` separator divides the document content from
 * the comment section.
 */

import type { Comment, CommentMetadata, CommentParseResult } from '../types';

const COMMENT_SEPARATOR = '<!-- mdview:comments -->';
const COMMENT_REF_PATTERN = /\[\^comment-(\w+)\]/g;
const FOOTNOTE_DEF_PATTERN = /^\[\^comment-(\w+)\]:\s*<!-- mdview:comment\s+(.+?)\s*-->\s*$/;
const BODY_CONTINUATION_PATTERN = /^    (.*)$/;

/**
 * Parse comments from markdown text.
 *
 * Splits markdown at the `<!-- mdview:comments -->` separator, parses footnote
 * definitions from the comments section, extracts the selected text from the
 * content section, and returns cleaned markdown with comment references removed.
 */
export function parseComments(markdown: string): CommentParseResult {
  const separatorIndex = markdown.indexOf(COMMENT_SEPARATOR);

  if (separatorIndex === -1) {
    return { cleanedMarkdown: markdown, comments: [] };
  }

  const contentPortion = markdown.substring(0, separatorIndex);
  const commentsPortion = markdown.substring(separatorIndex + COMMENT_SEPARATOR.length);

  const comments = parseCommentFootnotes(commentsPortion, contentPortion);
  const cleanedMarkdown = removeCommentReferences(contentPortion.trimEnd());

  return { cleanedMarkdown, comments };
}

/**
 * Parse comment footnote definitions from the comments section of the markdown.
 */
function parseCommentFootnotes(commentSection: string, contentSection: string): Comment[] {
  const lines = commentSection.split('\n');
  const comments: Comment[] = [];

  let currentId: string | null = null;
  let currentMetadata: CommentMetadata | null = null;
  let currentBodyLines: string[] = [];

  for (const line of lines) {
    // Try to match a footnote definition line
    const defMatch = line.match(FOOTNOTE_DEF_PATTERN);

    if (defMatch) {
      // Flush previous comment if any
      if (currentId !== null && currentMetadata !== null) {
        comments.push(buildComment(currentId, currentMetadata, currentBodyLines, contentSection));
      }

      currentId = defMatch[1];
      currentBodyLines = [];

      // Parse the JSON metadata
      try {
        currentMetadata = JSON.parse(defMatch[2]) as CommentMetadata;
      } catch {
        // Malformed JSON - skip this comment
        currentId = null;
        currentMetadata = null;
        currentBodyLines = [];
      }
      continue;
    }

    // Try to match a continuation line (indented with 4 spaces)
    if (currentId !== null && currentMetadata !== null) {
      const bodyMatch = line.match(BODY_CONTINUATION_PATTERN);
      if (bodyMatch) {
        currentBodyLines.push(bodyMatch[1]);
      }
    }
  }

  // Flush the last comment
  if (currentId !== null && currentMetadata !== null) {
    comments.push(buildComment(currentId, currentMetadata, currentBodyLines, contentSection));
  }

  return comments;
}

/**
 * Build a Comment object from parsed footnote data.
 */
function buildComment(
  id: string,
  metadata: CommentMetadata,
  bodyLines: string[],
  contentSection: string,
): Comment {
  return {
    id: `comment-${id}`,
    selectedText: extractSelectedText(id, contentSection),
    body: bodyLines.join('\n'),
    author: metadata.author,
    date: metadata.date,
    resolved: metadata.resolved ?? false,
  };
}

/**
 * Extract the word immediately before a `[^comment-N]` reference in the content.
 */
function extractSelectedText(id: string, content: string): string {
  const refPattern = new RegExp(`(\\S+)\\[\\^comment-${escapeRegExp(id)}\\]`);
  const match = content.match(refPattern);
  return match ? match[1] : '';
}

/**
 * Remove all `[^comment-*]` references from the content section.
 */
function removeCommentReferences(content: string): string {
  return content.replace(COMMENT_REF_PATTERN, '');
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
