# Margin Comments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a margin comment system that lets users annotate local markdown files with Google Docs-style comment cards, persisted as structured footnotes.

**Architecture:** Comments are stripped from raw markdown before the render pipeline, stored as `Comment` objects, then rendered as highlight wrappers + margin cards after DOM enhancement. File writes go through a Chrome native messaging host. The system only activates on `file://` URLs.

**Tech Stack:** TypeScript, Chrome Extensions Manifest V3, Native Messaging API, CSS custom properties, Vitest + jsdom

**Design doc:** `docs/plans/2026-03-03-margin-comments-design.md`

---

## Task 1: Comment Type Definitions

**Files:**
- Modify: `src/types/index.d.ts`

**Step 1: Add comment types to the type definitions file**

Add the following types after the existing `ExportUIState` interface (after line 455):

```typescript
// Comment feature types

/**
 * A single comment attached to text in the markdown
 */
export interface Comment {
  id: string;                // e.g. "comment-1"
  selectedText: string;      // The text the comment is anchored to
  body: string;              // The comment content
  author: string;            // From extension settings
  date: string;              // ISO 8601 timestamp
  resolved: boolean;         // Whether the comment has been resolved
}

/**
 * Result of parsing comments from raw markdown
 */
export interface CommentParseResult {
  cleanedMarkdown: string;   // Markdown with comment footnotes stripped
  comments: Comment[];       // Extracted comments
}

/**
 * Comment metadata stored in the footnote HTML comment
 */
export interface CommentMetadata {
  author: string;
  date: string;
  resolved?: boolean;
}
```

Also add `commentsEnabled` and `commentAuthor` to the `AppState.preferences` interface (after line 51, after `tocStyle`):

```typescript
    // Comments
    commentsEnabled?: boolean;  // Enable/disable comments feature
    commentAuthor?: string;     // Author name for new comments
```

**Step 2: Commit**

```
feat(types): add comment type definitions
```

---

## Task 2: Comment Parser

Parses `[^comment-*]` footnotes with `<!-- mdview:comment ... -->` metadata from raw markdown. Returns cleaned markdown + extracted comments. Pure function, no DOM needed.

**Files:**
- Create: `src/comments/comment-parser.ts`
- Create: `tests/unit/comments/comment-parser.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseComments } from '../../../src/comments/comment-parser';

describe('parseComments', () => {
  describe('basic parsing', () => {
    it('should return unchanged markdown when no comments exist', () => {
      const markdown = '# Hello\n\nSome text here.';
      const result = parseComments(markdown);
      expect(result.cleanedMarkdown).toBe(markdown);
      expect(result.comments).toEqual([]);
    });

    it('should extract a single comment', () => {
      const markdown = [
        '# Hello',
        '',
        'Some text here[^comment-1] and more.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    This needs clarification.',
      ].join('\n');

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]).toEqual({
        id: 'comment-1',
        selectedText: 'text here',
        body: 'This needs clarification.',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      });
    });

    it('should remove comment footnote references from cleaned markdown', () => {
      const markdown = [
        '# Hello',
        '',
        'Some text here[^comment-1] and more.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    This needs clarification.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.cleanedMarkdown).toBe('# Hello\n\nSome text here and more.');
    });

    it('should extract multiple comments', () => {
      const markdown = [
        'First[^comment-1] and second[^comment-2] text.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    First comment.',
        '',
        '[^comment-2]: <!-- mdview:comment {"author":"alice","date":"2026-03-03T15:00:00Z"} -->',
        '    Second comment.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[1].id).toBe('comment-2');
      expect(result.comments[1].author).toBe('alice');
    });

    it('should handle resolved comments', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z","resolved":true} -->',
        '    Fixed it.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.comments[0].resolved).toBe(true);
    });
  });

  describe('selected text extraction', () => {
    it('should extract word before footnote reference as selected text', () => {
      const markdown = [
        'The quick brown fox[^comment-1] jumps over.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    Comment body.',
      ].join('\n');

      const result = parseComments(markdown);
      // The selected text is the word(s) immediately before the reference
      // For now, capture the preceding word. The full selected range can be
      // enhanced later with a more sophisticated heuristic.
      expect(result.comments[0].selectedText).toBe('fox');
    });

    it('should handle reference at end of line', () => {
      const markdown = [
        'End of line reference[^comment-1]',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    Comment body.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.comments[0].selectedText).toBe('reference');
    });
  });

  describe('preserving regular footnotes', () => {
    it('should not strip regular footnotes (without mdview marker)', () => {
      const markdown = [
        'Some text[^1] here.',
        '',
        '[^1]: A regular footnote.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.cleanedMarkdown).toBe(markdown);
      expect(result.comments).toEqual([]);
    });

    it('should strip comment footnotes but keep regular footnotes', () => {
      const markdown = [
        'Regular[^1] and comment[^comment-1] here.',
        '',
        '[^1]: A regular footnote.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    A comment.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.cleanedMarkdown).toContain('[^1]');
      expect(result.cleanedMarkdown).toContain('[^1]: A regular footnote.');
      expect(result.cleanedMarkdown).not.toContain('[^comment-1]');
      expect(result.comments).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty markdown', () => {
      const result = parseComments('');
      expect(result.cleanedMarkdown).toBe('');
      expect(result.comments).toEqual([]);
    });

    it('should handle malformed comment metadata gracefully', () => {
      const markdown = [
        'Text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {invalid json} -->',
        '    Comment body.',
      ].join('\n');

      const result = parseComments(markdown);
      // Should skip malformed comments rather than crashing
      expect(result.comments).toEqual([]);
    });

    it('should handle multi-line comment bodies', () => {
      const markdown = [
        'Text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    First line of comment.',
        '    Second line of comment.',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.comments[0].body).toBe('First line of comment.\nSecond line of comment.');
    });

    it('should handle comment separator without any comments after it', () => {
      const markdown = [
        '# Hello',
        '',
        '<!-- mdview:comments -->',
      ].join('\n');

      const result = parseComments(markdown);
      expect(result.cleanedMarkdown).toBe('# Hello');
      expect(result.comments).toEqual([]);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest --run tests/unit/comments/comment-parser.test.ts`
Expected: FAIL - module not found

**Step 3: Implement comment-parser.ts**

```typescript
/**
 * Comment Parser
 * Extracts mdview comment footnotes from raw markdown, returning
 * cleaned markdown and structured Comment objects.
 */

import type { Comment, CommentMetadata, CommentParseResult } from '../types';

const COMMENT_REF_PATTERN = /\[\^comment-(\d+)\]/g;
const COMMENT_SEPARATOR = '<!-- mdview:comments -->';
const COMMENT_FOOTNOTE_PATTERN =
  /^\[\^comment-(\d+)\]:\s*<!--\s*mdview:comment\s+(\{.*?\})\s*-->\s*\n((?:    .+(?:\n|$))*)/gm;

/**
 * Parse mdview comment footnotes from raw markdown.
 * Strips comment references and footnote bodies, returns them as Comment objects.
 * Regular (non-mdview) footnotes are left untouched.
 */
export function parseComments(markdown: string): CommentParseResult {
  if (!markdown) {
    return { cleanedMarkdown: '', comments: [] };
  }

  const comments: Comment[] = [];

  // Find the comment separator and split
  const separatorIndex = markdown.indexOf(COMMENT_SEPARATOR);
  if (separatorIndex === -1) {
    // No comments section at all
    return { cleanedMarkdown: markdown, comments: [] };
  }

  const contentPart = markdown.substring(0, separatorIndex);
  const commentsPart = markdown.substring(separatorIndex + COMMENT_SEPARATOR.length);

  // Parse each comment footnote from the comments section
  const commentIds = new Set<string>();
  let match: RegExpExecArray | null;
  const footnotePattern = new RegExp(COMMENT_FOOTNOTE_PATTERN.source, 'gm');

  while ((match = footnotePattern.exec(commentsPart)) !== null) {
    const id = `comment-${match[1]}`;
    const metadataJson = match[2];
    const bodyRaw = match[3];

    let metadata: CommentMetadata;
    try {
      metadata = JSON.parse(metadataJson);
    } catch {
      // Skip malformed comments
      continue;
    }

    // Clean up body: remove 4-space indent, trim trailing newlines
    const body = bodyRaw
      .split('\n')
      .map((line) => line.replace(/^    /, ''))
      .filter((line, i, arr) => !(i === arr.length - 1 && line === ''))
      .join('\n');

    // Find the selected text (word before the reference in the content)
    const selectedText = extractSelectedText(contentPart, id);

    comments.push({
      id,
      selectedText,
      body,
      author: metadata.author,
      date: metadata.date,
      resolved: metadata.resolved ?? false,
    });

    commentIds.add(id);
  }

  // Remove comment references from the content
  let cleanedContent = contentPart;
  for (const commentId of commentIds) {
    cleanedContent = cleanedContent.replaceAll(`[^${commentId}]`, '');
  }

  // Trim the trailing whitespace/newlines before the separator
  cleanedContent = cleanedContent.replace(/\n+$/, '');

  return { cleanedMarkdown: cleanedContent, comments };
}

/**
 * Extract the word immediately before a footnote reference.
 * This is used as a simple heuristic for the "selected text".
 */
function extractSelectedText(content: string, commentId: string): string {
  const ref = `[^${commentId}]`;
  const refIndex = content.indexOf(ref);
  if (refIndex === -1) return '';

  // Walk backwards from the reference to find the preceding word
  const before = content.substring(0, refIndex);
  const wordMatch = before.match(/(\S+)\s*$/);
  return wordMatch ? wordMatch[1] : '';
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest --run tests/unit/comments/comment-parser.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(comments): add comment parser for extracting footnote comments
```

---

## Task 3: Comment Serializer

Generates markdown with footnote references injected and footnote bodies appended. Handles add, update, and delete operations. Pure function, no DOM.

**Files:**
- Create: `src/comments/comment-serializer.ts`
- Create: `tests/unit/comments/comment-serializer.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  addComment,
  removeComment,
  updateComment,
  resolveComment,
  generateNextCommentId,
} from '../../../src/comments/comment-serializer';
import type { Comment } from '../../../src/types';

describe('comment-serializer', () => {
  describe('generateNextCommentId', () => {
    it('should return comment-1 for empty markdown', () => {
      expect(generateNextCommentId('')).toBe('comment-1');
    });

    it('should return the next available ID', () => {
      const markdown = 'text[^comment-1] and more[^comment-3].';
      expect(generateNextCommentId(markdown)).toBe('comment-4');
    });
  });

  describe('addComment', () => {
    it('should add a comment reference and footnote to clean markdown', () => {
      const markdown = '# Hello\n\nThe quick brown fox jumps over.';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'brown fox',
        body: 'What color is the fox?',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const result = addComment(markdown, comment);

      expect(result).toContain('brown fox[^comment-1]');
      expect(result).toContain('<!-- mdview:comments -->');
      expect(result).toContain('[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->');
      expect(result).toContain('    What color is the fox?');
    });

    it('should append to existing comments section', () => {
      const markdown = [
        '# Hello',
        '',
        'First[^comment-1] and second text.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    First comment.',
      ].join('\n');

      const comment: Comment = {
        id: 'comment-2',
        selectedText: 'second',
        body: 'New comment.',
        author: 'alice',
        date: '2026-03-03T15:00:00Z',
        resolved: false,
      };

      const result = addComment(markdown, comment);

      expect(result).toContain('second[^comment-2]');
      expect(result).toContain('[^comment-2]: <!-- mdview:comment {"author":"alice","date":"2026-03-03T15:00:00Z"} -->');
      // Should only have one separator
      expect(result.split('<!-- mdview:comments -->').length).toBe(2);
    });

    it('should handle selected text that appears multiple times by using first unmatched occurrence', () => {
      const markdown = 'The fox and the fox ran.';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'fox',
        body: 'Which fox?',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const result = addComment(markdown, comment);
      // Should add reference after the first occurrence
      expect(result).toMatch(/The fox\[\^comment-1\] and the fox ran\./);
    });

    it('should handle multi-line comment bodies', () => {
      const markdown = 'Some text here.';
      const comment: Comment = {
        id: 'comment-1',
        selectedText: 'text',
        body: 'Line one.\nLine two.',
        author: 'james',
        date: '2026-03-03T14:30:00Z',
        resolved: false,
      };

      const result = addComment(markdown, comment);
      expect(result).toContain('    Line one.\n    Line two.');
    });
  });

  describe('removeComment', () => {
    it('should remove comment reference and footnote body', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    A comment.',
      ].join('\n');

      const result = removeComment(markdown, 'comment-1');

      expect(result).not.toContain('[^comment-1]');
      expect(result).not.toContain('A comment.');
      expect(result).toBe('Some text here.');
    });

    it('should remove separator when last comment is deleted', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    A comment.',
      ].join('\n');

      const result = removeComment(markdown, 'comment-1');
      expect(result).not.toContain('<!-- mdview:comments -->');
    });

    it('should keep separator and other comments when one is deleted', () => {
      const markdown = [
        'First[^comment-1] and second[^comment-2] text.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    First comment.',
        '',
        '[^comment-2]: <!-- mdview:comment {"author":"alice","date":"2026-03-03T15:00:00Z"} -->',
        '    Second comment.',
      ].join('\n');

      const result = removeComment(markdown, 'comment-1');

      expect(result).not.toContain('[^comment-1]');
      expect(result).toContain('[^comment-2]');
      expect(result).toContain('Second comment.');
      expect(result).toContain('<!-- mdview:comments -->');
    });
  });

  describe('updateComment', () => {
    it('should update the body of an existing comment', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    Old body.',
      ].join('\n');

      const result = updateComment(markdown, 'comment-1', 'New body.');

      expect(result).toContain('    New body.');
      expect(result).not.toContain('Old body.');
    });
  });

  describe('resolveComment', () => {
    it('should add resolved:true to comment metadata', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z"} -->',
        '    A comment.',
      ].join('\n');

      const result = resolveComment(markdown, 'comment-1');

      expect(result).toContain('"resolved":true');
    });

    it('should not duplicate resolved flag', () => {
      const markdown = [
        'Some text[^comment-1] here.',
        '',
        '<!-- mdview:comments -->',
        '[^comment-1]: <!-- mdview:comment {"author":"james","date":"2026-03-03T14:30:00Z","resolved":true} -->',
        '    A comment.',
      ].join('\n');

      const result = resolveComment(markdown, 'comment-1');

      // Should still have exactly one resolved:true
      const matches = result.match(/"resolved":true/g);
      expect(matches).toHaveLength(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest --run tests/unit/comments/comment-serializer.test.ts`
Expected: FAIL

**Step 3: Implement comment-serializer.ts**

Build the five exported functions: `addComment`, `removeComment`, `updateComment`, `resolveComment`, `generateNextCommentId`. Each manipulates the raw markdown string directly. Key logic:

- `addComment`: Find `selectedText` in the content portion, insert `[^comment-N]` after it, append footnote body after the separator (creating separator if needed).
- `removeComment`: Remove `[^comment-N]` references from content, remove footnote block, remove separator if no comments remain.
- `updateComment`: Replace the body lines (indented with 4 spaces) under the matching footnote.
- `resolveComment`: Parse the metadata JSON, add `"resolved":true`, re-serialize.
- `generateNextCommentId`: Scan for `[^comment-N]` patterns, return `comment-(max+1)`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest --run tests/unit/comments/comment-serializer.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(comments): add comment serializer for markdown footnote operations
```

---

## Task 4: Theme Integration

Add comment-specific CSS variables to all 8 themes and the ThemeColors interface.

**Files:**
- Modify: `src/types/index.d.ts` (ThemeColors interface)
- Modify: `src/themes/github-light.ts`
- Modify: `src/themes/github-dark.ts`
- Modify: `src/themes/catppuccin-latte.ts`
- Modify: `src/themes/catppuccin-frappe.ts`
- Modify: `src/themes/catppuccin-macchiato.ts`
- Modify: `src/themes/catppuccin-mocha.ts`
- Modify: `src/themes/monokai.ts`
- Modify: `src/themes/monokai-pro.ts`
- Modify: `src/core/theme-engine.ts` (compile new variables)

**Step 1: Add new color properties to ThemeColors**

In `src/types/index.d.ts`, add to the `ThemeColors` interface after `info`:

```typescript
  // Comment highlighting
  commentHighlight: string;          // Active comment text highlight
  commentHighlightResolved: string;  // Resolved comment text highlight
  commentCardBg: string;             // Comment card background
```

**Step 2: Add colors to each theme file**

For light themes (github-light, catppuccin-latte):
```typescript
commentHighlight: 'rgba(255, 212, 59, 0.3)',       // Warm yellow
commentHighlightResolved: 'rgba(255, 212, 59, 0.1)', // Dim yellow
commentCardBg: '#f6f8fa',
```

For dark themes (github-dark, catppuccin-frappe, catppuccin-macchiato, catppuccin-mocha, monokai, monokai-pro):
```typescript
commentHighlight: 'rgba(255, 183, 77, 0.25)',       // Muted amber
commentHighlightResolved: 'rgba(255, 183, 77, 0.08)', // Dim amber
commentCardBg: '<theme-specific secondary bg>',
```

Choose appropriate card background colors per theme variant.

**Step 3: Add CSS variable compilation in theme-engine.ts**

In the `compileThemeToCSS` method (or wherever CSS variables are set), add:
```typescript
'--md-comment-highlight': theme.colors.commentHighlight,
'--md-comment-highlight-resolved': theme.colors.commentHighlightResolved,
'--md-comment-card-bg': theme.colors.commentCardBg,
```

**Step 4: Verify existing theme-engine tests still pass**

Run: `npx vitest --run tests/unit/core/theme-engine.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(themes): add comment highlight and card CSS variables to all themes
```

---

## Task 5: Comment CSS & Layout

Add all CSS for comment highlights, cards, the right gutter, and responsive behavior.

**Files:**
- Modify: `src/content/content.css`

**Step 1: Add comment CSS rules**

Add a new section to `content.css` for the comment system. Key rules:

```css
/* ============================================
 * Comment System
 * ============================================ */

/* Layout: right gutter when comments are active */
body.mdview-active.has-comments #mdview-container {
  max-width: calc(var(--md-max-width, 980px) - 280px);
  margin-left: auto;
  margin-right: 280px;
}

/* Full-width mode with comments */
body.mdview-active.has-comments.full-width #mdview-container {
  max-width: calc(100% - 280px);
  margin-left: 0;
  margin-right: 280px;
}

/* Comment gutter */
.mdview-comment-gutter {
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100vh;
  overflow-y: auto;
  padding: 16px 12px;
  box-sizing: border-box;
  z-index: 100;
}

/* Comment card */
.mdview-comment-card {
  background: var(--md-comment-card-bg, var(--md-code-bg, #f6f8fa));
  border-left: 3px solid var(--md-link, #0969da);
  border-radius: 0 6px 6px 0;
  padding: 10px 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px var(--md-shadow, rgba(0,0,0,0.1));
  font-size: 13px;
  line-height: 1.4;
  font-family: var(--md-font-family);
  color: var(--md-fg);
  transition: opacity 0.2s, box-shadow 0.2s;
  position: relative;
}

.mdview-comment-card:hover,
.mdview-comment-card.active {
  box-shadow: 0 2px 8px var(--md-shadow, rgba(0,0,0,0.15));
}

/* Resolved card */
.mdview-comment-card.resolved {
  opacity: 0.5;
  border-left-color: var(--md-fg-muted, #6e7781);
}

.mdview-comment-card.resolved .comment-body {
  text-decoration: line-through;
}

/* Card header */
.mdview-comment-card .comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.mdview-comment-card .comment-author {
  font-weight: 600;
  font-size: 12px;
  color: var(--md-fg);
}

.mdview-comment-card .comment-date {
  font-size: 11px;
  color: var(--md-fg-muted, #6e7781);
}

/* Card body */
.mdview-comment-card .comment-body {
  color: var(--md-fg-secondary, #57606a);
}

/* Overflow menu */
.mdview-comment-card .comment-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 16px;
  color: var(--md-fg-muted);
  border-radius: 3px;
  line-height: 1;
}

.mdview-comment-card .comment-menu-btn:hover {
  background: var(--md-bg-secondary, #f6f8fa);
}

/* Resolved badge */
.mdview-comment-card .resolved-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--md-success, #1a7f37);
  color: #fff;
  margin-left: 6px;
}

/* Text highlight */
.mdview-comment-highlight {
  background-color: var(--md-comment-highlight);
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.mdview-comment-highlight:hover,
.mdview-comment-highlight.active {
  background-color: var(--md-comment-highlight);
  filter: brightness(0.92);
}

.mdview-comment-highlight.resolved {
  background-color: var(--md-comment-highlight-resolved);
}

/* Comment input form */
.mdview-comment-input {
  background: var(--md-comment-card-bg, var(--md-code-bg));
  border: 1px solid var(--md-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 8px var(--md-shadow, rgba(0,0,0,0.15));
}

.mdview-comment-input textarea {
  width: 100%;
  min-height: 60px;
  border: 1px solid var(--md-border-light);
  border-radius: 4px;
  padding: 8px;
  font-family: var(--md-font-family);
  font-size: 13px;
  resize: vertical;
  background: var(--md-bg);
  color: var(--md-fg);
  box-sizing: border-box;
}

.mdview-comment-input textarea:focus {
  outline: none;
  border-color: var(--md-link);
  box-shadow: 0 0 0 2px var(--md-selection);
}

.mdview-comment-input .comment-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.mdview-comment-input button {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--md-border);
  background: var(--md-bg);
  color: var(--md-fg);
}

.mdview-comment-input button.primary {
  background: var(--md-link);
  color: #fff;
  border-color: var(--md-link);
}

/* Narrow viewport: collapse gutter */
@media (max-width: 1024px) {
  body.mdview-active.has-comments #mdview-container {
    max-width: var(--md-max-width, 980px);
    margin-right: auto;
  }

  body.mdview-active.has-comments.full-width #mdview-container {
    max-width: 100%;
    margin-right: 0;
  }

  .mdview-comment-gutter {
    display: none;
  }
}

/* Toast notification */
.mdview-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--md-fg);
  color: var(--md-bg);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 10000;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.2s, transform 0.2s;
}

.mdview-toast.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Step 2: Commit**

```
feat(css): add comment system styles, gutter layout, and responsive breakpoints
```

---

## Task 6: Comment Highlight Module

Wraps matching text in the rendered DOM with highlight spans. Handles hover cross-referencing between highlights and cards.

**Files:**
- Create: `src/comments/comment-highlight.ts`
- Create: `tests/unit/comments/comment-highlight.test.ts`

**Step 1: Write the failing tests**

Test `wrapTextWithHighlight` (finds text node matching `selectedText`, wraps in `<span class="mdview-comment-highlight">`), `removeHighlight` (unwraps span), and `setActiveHighlight`/`clearActiveHighlight` (toggle `.active` class).

Key test cases:
- Wrapping text that appears once in a paragraph
- Wrapping text that spans part of a text node
- Removing a highlight (unwrap span, restore text node)
- Setting/clearing active state
- Handling resolved state (adds `.resolved` class)

**Step 2: Run tests to verify they fail**

**Step 3: Implement comment-highlight.ts**

Core approach: Use `TreeWalker` with `NodeFilter.SHOW_TEXT` to find text nodes containing the `selectedText`. Wrap the matching range with a `<span>` element. Store the comment ID as a `data-comment-id` attribute.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```
feat(comments): add text highlight module for comment markers
```

---

## Task 7: Comment UI Module

Renders margin comment cards, the context menu entry, the comment input form, and overflow menu. Handles all user interactions.

**Files:**
- Create: `src/comments/comment-ui.ts`
- Create: `tests/unit/comments/comment-ui.test.ts`

**Step 1: Write the failing tests**

Test cases for the `CommentUI` class:
- `renderCard(comment)` - Creates DOM element with author, date, body, overflow menu
- `renderCard` with resolved comment - Has `.resolved` class and badge
- `renderInputForm()` - Creates textarea with Save/Cancel buttons
- `renderGutter(comments)` - Creates gutter container with cards positioned
- `showContextMenu(selection)` - Shows "Add Comment" option at selection position
- Overflow menu click dispatches `mdview:comment:edit`, `mdview:comment:resolve`, `mdview:comment:delete` custom events
- Save button dispatches `mdview:comment:save` with comment body
- Cancel button removes input form
- Cmd+Enter in textarea triggers save

**Step 2: Run tests to verify they fail**

**Step 3: Implement comment-ui.ts**

Build the `CommentUI` class following patterns from `TocRenderer` and `ExportUI`:
- `renderGutter()` creates the fixed right gutter container
- `renderCard()` builds individual cards with header (author + date + overflow menu) and body
- `renderInputForm()` builds textarea + action buttons
- `setupContextMenu()` listens for `contextmenu` events when text is selected
- Custom events for all actions (edit, resolve, delete, save) so the manager can orchestrate
- `destroy()` cleans up all event listeners and DOM elements

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```
feat(comments): add comment UI with cards, gutter, context menu, and input form
```

---

## Task 8: Native Messaging Host

Small Node.js script that writes files on behalf of the extension. Includes installer script and Chrome manifest.

**Files:**
- Create: `src/native-host/host.js`
- Create: `src/native-host/manifest.json`
- Create: `src/native-host/install.sh`
- Modify: `public/manifest.json` (add `nativeMessaging` permission)
- Create: `tests/unit/comments/native-host.test.ts`

**Step 1: Write the failing tests**

Test the message protocol logic (extractable as a pure function):
- Valid write message → calls fs.writeFile with correct path and content
- Rejects non-markdown file paths (`.js`, `.sh`, etc.)
- Handles missing `path` or `content` fields
- Returns `{success: true}` on successful write
- Returns `{error: "..."}` on failure

**Step 2: Run tests to verify they fail**

**Step 3: Implement the native host**

`host.js` - Node.js script using stdio protocol:
```javascript
#!/usr/bin/env node
// Chrome native messaging host for mdview file writes
// Protocol: length-prefixed JSON messages via stdin/stdout

const fs = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.mdx'];

function readMessage() { /* read 4-byte length prefix, then JSON */ }
function writeMessage(msg) { /* write 4-byte length prefix + JSON */ }

function handleMessage(msg) {
  if (msg.action !== 'write') return writeMessage({ error: 'Unknown action' });

  const ext = path.extname(msg.path).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return writeMessage({ error: `Refused: not a markdown file (${ext})` });
  }

  try {
    fs.writeFileSync(msg.path, msg.content, 'utf8');
    writeMessage({ success: true });
  } catch (err) {
    writeMessage({ error: err.message });
  }
}

// Main loop
process.stdin.on('readable', () => { /* read and handle messages */ });
```

`manifest.json`:
```json
{
  "name": "com.mdview.filewriter",
  "description": "MDView file write host",
  "path": "/usr/local/lib/mdview/host.js",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://EXTENSION_ID/"]
}
```

`install.sh`:
```bash
#!/bin/bash
# Install mdview native messaging host
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$HOST_DIR"
# Copy host script and generate manifest with correct path
# ...
```

**Step 4: Add `nativeMessaging` permission to manifest.json**

In `public/manifest.json`, add to the `permissions` array:

```json
"permissions": ["storage", "nativeMessaging"]
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest --run tests/unit/comments/native-host.test.ts`

**Step 6: Commit**

```
feat(comments): add native messaging host for file writes
```

---

## Task 9: Comment Manager

Orchestrates CRUD operations. Connects parser, serializer, UI, highlights, and native host. Manages the auto-reload guard.

**Files:**
- Create: `src/comments/comment-manager.ts`
- Create: `tests/unit/comments/comment-manager.test.ts`

**Step 1: Write the failing tests**

Test the `CommentManager` class (mock the native host and DOM):
- `initialize(markdown, filePath)` - Parses existing comments, sets up UI
- `addComment(selectedText, body)` - Serializes new comment, writes file, patches DOM
- `editComment(id, newBody)` - Updates comment, writes file
- `resolveComment(id)` - Sets resolved flag, writes file, updates highlight
- `deleteComment(id)` - Removes comment, writes file, removes highlight
- Auto-reload guard: `isWriteInProgress()` returns true during writes
- `getComments()` returns current comment list
- Only initializes for `file://` URLs

**Step 2: Run tests to verify they fail**

**Step 3: Implement comment-manager.ts**

```typescript
export class CommentManager {
  private comments: Comment[] = [];
  private rawMarkdown: string = '';
  private filePath: string = '';
  private writeInProgress = false;
  private ui: CommentUI | null = null;

  async initialize(markdown: string, filePath: string, preferences: AppState['preferences']): Promise<CommentParseResult> {
    // Parse existing comments
    // Set up UI if comments enabled and file:// URL
    // Wire up event listeners for UI actions
  }

  async addComment(selectedText: string, body: string): Promise<void> {
    // Generate next ID
    // Create Comment object
    // Serialize into markdown
    // Write file via native host
    // Optimistically patch DOM
  }

  async editComment(id: string, newBody: string): Promise<void> { /* ... */ }
  async resolveComment(id: string): Promise<void> { /* ... */ }
  async deleteComment(id: string): Promise<void> { /* ... */ }

  private async writeFile(content: string): Promise<void> {
    this.writeInProgress = true;
    try {
      await chrome.runtime.sendNativeMessage('com.mdview.filewriter', {
        action: 'write',
        path: this.filePath,
        content,
      });
    } finally {
      this.writeInProgress = false;
    }
  }

  isWriteInProgress(): boolean { return this.writeInProgress; }
  getComments(): Comment[] { return [...this.comments]; }
  destroy(): void { /* cleanup UI, listeners */ }
}
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```
feat(comments): add comment manager orchestrating CRUD and file writes
```

---

## Task 10: Render Pipeline Integration

Hook the comment parser into the pre-parse stage and comment UI into the post-enhance stage.

**Files:**
- Modify: `src/core/render-pipeline.ts`

**Step 1: Verify existing render-pipeline tests still pass as baseline**

Run: `npx vitest --run tests/unit/core/render-pipeline.test.ts`
Expected: All PASS

**Step 2: Add pre-parse hook**

In the `render()` method (around line 132-141, after TOC stripping), add comment stripping:

```typescript
// Strip comment footnotes before parsing
let commentParseResult: CommentParseResult | null = null;
if ((preferences as { commentsEnabled?: boolean }).commentsEnabled) {
  const { parseComments } = await import('../comments/comment-parser');
  commentParseResult = parseComments(processedMarkdown);
  processedMarkdown = commentParseResult.cleanedMarkdown;
}
```

Do the same in `renderWithProgressiveHydration()` (around line 536-545).

**Step 3: Store commentParseResult on the pipeline instance for post-enhance access**

Add a private field:
```typescript
private lastCommentParseResult: CommentParseResult | null = null;
```

Set it after parsing, return it via a getter `getLastCommentParseResult()`.

**Step 4: Run render-pipeline tests to verify no regressions**

Run: `npx vitest --run tests/unit/core/render-pipeline.test.ts`
Expected: All PASS

**Step 5: Commit**

```
feat(pipeline): integrate comment parser into pre-parse stage
```

---

## Task 11: Content Script Integration

Wire up the comment manager in the content script, including the auto-reload guard.

**Files:**
- Modify: `src/content/content-script.ts`

**Step 1: Add comment manager initialization**

After the Export UI setup (around line 264), add:

```typescript
// Setup Comments (only for local files)
if (this.state?.preferences.commentsEnabled && window.location.protocol === 'file:') {
  await this.setupComments(content, filePath);
}
```

**Step 2: Implement setupComments method**

```typescript
private commentManager: CommentManager | null = null;

private async setupComments(markdown: string, filePath: string): Promise<void> {
  try {
    const { CommentManager } = await import('../comments/comment-manager');
    this.commentManager = new CommentManager();
    await this.commentManager.initialize(markdown, filePath, this.state!.preferences);
    debug.info('MDView', 'Comments initialized');
  } catch (error) {
    debug.error('MDView', 'Failed to setup comments:', error);
  }
}
```

**Step 3: Add auto-reload guard**

In `setupAutoReload`, modify the `debouncedReload` to check the comment manager:

```typescript
// Skip reload if we just wrote comments
if (this.commentManager?.isWriteInProgress()) {
  debug.debug('MDView', 'Skipping reload - comment write in progress');
  return;
}
```

**Step 4: Add cleanup**

In `cleanup()`, add `this.commentManager?.destroy()`.

**Step 5: Commit**

```
feat(comments): integrate comment manager into content script
```

---

## Task 12: Settings Integration

Add author name and comments toggle to the options page and popup.

**Files:**
- Modify: `src/options/options.html` (add author name field)
- Modify: `src/options/options.ts` (handle new setting)
- Modify: `src/popup/popup.html` (add comments toggle)
- Modify: `src/popup/popup.ts` (handle new toggle)
- Modify: `src/background/service-worker.ts` (default preferences)

**Step 1: Add "Author Name" field to options Appearance section**

After the existing font settings in `options.html`:

```html
<div class="setting-group">
  <label for="comment-author" class="setting-label">Comment Author Name</label>
  <input type="text" id="comment-author" class="setting-input" placeholder="Your name" />
  <p class="setting-description">Name shown on your comments. Used when annotating markdown files.</p>
</div>
```

**Step 2: Add "Comments" toggle to popup**

Add a toggle switch in `popup.html`:

```html
<div class="setting-row">
  <span class="setting-label">Comments</span>
  <label class="toggle">
    <input type="checkbox" id="comments-enabled" />
    <span class="toggle-slider"></span>
  </label>
</div>
```

**Step 3: Wire up the settings in options.ts and popup.ts**

Follow the existing patterns for loading/saving preferences via `chrome.storage.sync`.

**Step 4: Add defaults to service-worker.ts**

In the default preferences object, add:
```typescript
commentsEnabled: true,
commentAuthor: '',
```

**Step 5: Commit**

```
feat(settings): add comment author name and enable toggle to options and popup
```

---

## Task 13: Integration Tests

End-to-end round-trip tests covering the full comment lifecycle.

**Files:**
- Create: `tests/integration/comments.test.ts`

**Step 1: Write integration tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseComments } from '../../src/comments/comment-parser';
import { addComment, removeComment, resolveComment, updateComment } from '../../src/comments/comment-serializer';
import type { Comment } from '../../src/types';

describe('Comment System Integration', () => {
  const baseMarkdown = '# Test Document\n\nThe quick brown fox jumps over the lazy dog.\n\nAnother paragraph here.';

  it('should round-trip: add comment then parse it back', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'What species?',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const withComment = addComment(baseMarkdown, comment);
    const parsed = parseComments(withComment);

    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].body).toBe('What species?');
    expect(parsed.comments[0].author).toBe('james');
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should round-trip: add, resolve, then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'What species?',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const withComment = addComment(baseMarkdown, comment);
    const resolved = resolveComment(withComment, 'comment-1');
    const parsed = parseComments(resolved);

    expect(parsed.comments[0].resolved).toBe(true);
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should round-trip: add, edit, then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'Original.',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const withComment = addComment(baseMarkdown, comment);
    const edited = updateComment(withComment, 'comment-1', 'Updated.');
    const parsed = parseComments(edited);

    expect(parsed.comments[0].body).toBe('Updated.');
  });

  it('should round-trip: add, delete, get clean markdown back', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'A comment.',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const withComment = addComment(baseMarkdown, comment);
    const deleted = removeComment(withComment, 'comment-1');

    expect(deleted).toBe(baseMarkdown);
  });

  it('should handle multiple comments added sequentially', () => {
    const comment1: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'Comment one.',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const comment2: Comment = {
      id: 'comment-2',
      selectedText: 'lazy dog',
      body: 'Comment two.',
      author: 'alice',
      date: '2026-03-03T15:00:00Z',
      resolved: false,
    };

    let markdown = addComment(baseMarkdown, comment1);
    markdown = addComment(markdown, comment2);

    const parsed = parseComments(markdown);
    expect(parsed.comments).toHaveLength(2);
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });
});
```

**Step 2: Run integration tests**

Run: `npx vitest --run tests/integration/comments.test.ts`
Expected: All PASS

**Step 3: Run full test suite**

Run: `npx vitest --run`
Expected: All 414+ tests PASS (existing + new)

**Step 4: Commit**

```
test(comments): add integration tests for full comment lifecycle
```

---

## Task Summary

| Task | Component | Type | Dependencies |
|------|-----------|------|--------------|
| 1 | Type definitions | Types | None |
| 2 | Comment parser | Pure logic | Task 1 |
| 3 | Comment serializer | Pure logic | Task 1 |
| 4 | Theme integration | Config | Task 1 |
| 5 | Comment CSS & layout | Styles | None |
| 6 | Comment highlight | DOM | Task 1 |
| 7 | Comment UI | DOM | Task 1, 5 |
| 8 | Native messaging host | Infrastructure | None |
| 9 | Comment manager | Orchestrator | Tasks 2, 3, 6, 7, 8 |
| 10 | Pipeline integration | Core | Task 2 |
| 11 | Content script integration | Core | Tasks 9, 10 |
| 12 | Settings | UI | Task 1 |
| 13 | Integration tests | Testing | Tasks 2, 3 |

**Parallelizable:** Tasks 2+3 (parser & serializer), Tasks 4+5 (themes & CSS), Tasks 6+7+8 (highlight, UI, host) can each be done in parallel within their group.
