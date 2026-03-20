/**
 * Tests for comment parser - extracts structured comments from markdown footnotes
 */

import { describe, it, expect } from 'vitest';
import { parseComments } from '../../comments/comment-parser';

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
  });
});
