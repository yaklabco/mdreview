/**
 * Tests for comment parser - extracts structured comments from markdown footnotes
 */

import { describe, it, expect } from 'vitest';
import { parseComments } from '../../../src/comments/comment-parser';

describe('parseComments', () => {
  describe('No comments', () => {
    it('should return unchanged markdown and empty array when no comments exist', () => {
      const markdown = `# Hello World

This is a paragraph.

## Section Two

More content here.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe(markdown);
      expect(result.comments).toEqual([]);
    });

    it('should handle empty markdown', () => {
      const result = parseComments('');

      expect(result.cleanedMarkdown).toBe('');
      expect(result.comments).toEqual([]);
    });
  });

  describe('Single comment extraction', () => {
    it('should extract a single comment with all fields', () => {
      const markdown = `Some highlighted text[^comment-1] in context.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This API endpoint needs error handling
    for the 404 case.`;

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(1);
      const comment = result.comments[0];
      expect(comment.id).toBe('comment-1');
      expect(comment.selectedText).toBe('text');
      expect(comment.body).toBe('This API endpoint needs error handling\nfor the 404 case.');
      expect(comment.author).toBe('reviewer');
      expect(comment.date).toBe('2026-03-03T14:30:00Z');
      expect(comment.resolved).toBe(false);
    });

    it('should remove comment reference from cleaned markdown', () => {
      const markdown = `Some highlighted text[^comment-1] in context.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This is a comment.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe('Some highlighted text in context.');
      expect(result.cleanedMarkdown).not.toContain('[^comment-1]');
      expect(result.cleanedMarkdown).not.toContain('mdview:comment');
    });
  });

  describe('Multiple comments', () => {
    it('should extract multiple comments', () => {
      const markdown = `First text[^comment-1] and second text[^comment-2] in the doc.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z"} -->
    First comment body.
[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-02T11:00:00Z"} -->
    Second comment body.`;

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[0].author).toBe('alice');
      expect(result.comments[0].body).toBe('First comment body.');
      expect(result.comments[1].id).toBe('comment-2');
      expect(result.comments[1].author).toBe('bob');
      expect(result.comments[1].body).toBe('Second comment body.');
    });

    it('should remove all comment references from cleaned markdown', () => {
      const markdown = `First text[^comment-1] and second text[^comment-2] in the doc.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z"} -->
    First comment.
[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-02T11:00:00Z"} -->
    Second comment.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe('First text and second text in the doc.');
    });
  });

  describe('Resolved comments', () => {
    it('should parse resolved flag from metadata', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","resolved":true} -->
    This was resolved.`;

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].resolved).toBe(true);
    });

    it('should default resolved to false when not specified', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Not resolved.`;

      const result = parseComments(markdown);

      expect(result.comments[0].resolved).toBe(false);
    });
  });

  describe('Selected text extraction', () => {
    it('should extract the word immediately before the reference', () => {
      const markdown = `The important word[^comment-1] follows.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Comment on word.`;

      const result = parseComments(markdown);

      expect(result.comments[0].selectedText).toBe('word');
    });

    it('should handle reference at end of line', () => {
      const markdown = `End of line reference[^comment-1]

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Comment at end.`;

      const result = parseComments(markdown);

      expect(result.comments[0].selectedText).toBe('reference');
    });

    it('should handle reference after punctuation', () => {
      const markdown = `Some sentence here.[^comment-1] Next sentence.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Comment after period.`;

      const result = parseComments(markdown);

      expect(result.comments[0].selectedText).toBe('here.');
    });

    it('should use empty string when no word precedes reference', () => {
      const markdown = `[^comment-1] at the start.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Comment at start.`;

      const result = parseComments(markdown);

      expect(result.comments[0].selectedText).toBe('');
    });
  });

  describe('Regular footnotes preservation', () => {
    it('should preserve regular footnotes that do not match comment pattern', () => {
      const markdown = `Some text with a footnote[^1] and more content.

[^1]: This is a regular footnote.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe(markdown);
      expect(result.comments).toEqual([]);
    });

    it('should preserve regular footnotes when mixed with comment footnotes', () => {
      const markdown = `Text with footnote[^1] and comment[^comment-1] together.

[^1]: Regular footnote content.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This is a comment.`;

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.cleanedMarkdown).toContain('[^1]');
      expect(result.cleanedMarkdown).toContain('[^1]: Regular footnote content.');
      expect(result.cleanedMarkdown).not.toContain('[^comment-1]');
      expect(result.cleanedMarkdown).not.toContain('mdview:comment');
    });
  });

  describe('Multi-line comment bodies', () => {
    it('should collect indented continuation lines as body', () => {
      const markdown = `Text here[^comment-1] in doc.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Line one of the comment.
    Line two of the comment.
    Line three of the comment.`;

      const result = parseComments(markdown);

      expect(result.comments[0].body).toBe(
        'Line one of the comment.\nLine two of the comment.\nLine three of the comment.'
      );
    });

    it('should handle single-line comment body', () => {
      const markdown = `Text here[^comment-1] in doc.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Single line comment.`;

      const result = parseComments(markdown);

      expect(result.comments[0].body).toBe('Single line comment.');
    });
  });

  describe('Malformed metadata', () => {
    it('should skip comments with invalid JSON metadata', () => {
      const markdown = `Text[^comment-1] and more text[^comment-2] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {bad json} -->
    This should be skipped.
[^comment-2]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This should be parsed.`;

      const result = parseComments(markdown);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment-2');
    });

    it('should not crash on completely malformed footnote lines', () => {
      const markdown = `Text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: This is not a proper mdview comment.`;

      const result = parseComments(markdown);

      expect(result.comments).toEqual([]);
    });
  });

  describe('Comment separator edge cases', () => {
    it('should handle comment separator with no comments after it', () => {
      const markdown = `Some text in the document.

<!-- mdview:comments -->`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe('Some text in the document.');
      expect(result.comments).toEqual([]);
    });

    it('should trim trailing whitespace before separator', () => {
      const markdown = `Some text in the document.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    A comment.`;

      const result = parseComments(markdown);

      // Trailing whitespace on the content lines should be trimmed
      expect(result.cleanedMarkdown).not.toMatch(/\s+$/);
    });
  });

  describe('Reference removal details', () => {
    it('should remove reference inline without leaving double spaces', () => {
      const markdown = `The word[^comment-1] is here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Comment.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe('The word is here.');
      expect(result.cleanedMarkdown).not.toContain('  ');
    });

    it('should handle multiple references on the same line', () => {
      const markdown = `First[^comment-1] and second[^comment-2] words.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z"} -->
    Comment one.
[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-02T11:00:00Z"} -->
    Comment two.`;

      const result = parseComments(markdown);

      expect(result.cleanedMarkdown).toBe('First and second words.');
    });
  });
});
