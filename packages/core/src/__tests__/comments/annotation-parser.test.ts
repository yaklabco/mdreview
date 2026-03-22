/**
 * Tests for annotation parser — v2 format with v1 backward compatibility
 */

import { describe, it, expect, vi } from 'vitest';
import { parseAnnotations, detectFormat } from '../../comments/annotation-parser';

describe('detectFormat', () => {
  it('should detect v1 format from sentinel', () => {
    const md = `# Hello\n\n<!-- mdview:comments -->\n[^comment-1]: <!-- mdview:comment {"author":"a","date":"2026-01-01T00:00:00Z"} -->\n    body`;
    expect(detectFormat(md)).toBe('v1');
  });

  it('should detect v2 format from sentinel', () => {
    const md = `# Hello\n\n<!-- mdview:annotations [{"id":1,"anchor":{"text":"Hello"},"body":"note","author":"a","date":"2026-01-01T00:00:00Z"}] -->`;
    expect(detectFormat(md)).toBe('v2');
  });

  it('should return none when neither sentinel is present', () => {
    expect(detectFormat('# Just a document\n\nSome text.')).toBe('none');
  });

  it('should return v1 when both sentinels present (v1 takes priority)', () => {
    const md = `# Hello\n\n<!-- mdview:comments -->\n<!-- mdview:annotations [] -->`;
    expect(detectFormat(md)).toBe('v1');
  });

  it('should handle empty string', () => {
    expect(detectFormat('')).toBe('none');
  });
});

describe('parseAnnotations', () => {
  describe('No annotations', () => {
    it('should return unchanged markdown and empty array when no annotations exist', () => {
      const markdown = `# Hello World\n\nThis is a paragraph.\n\n## Section Two\n\nMore content here.`;
      const result = parseAnnotations(markdown);
      expect(result.cleanedMarkdown).toBe(markdown);
      expect(result.comments).toEqual([]);
    });

    it('should handle empty markdown', () => {
      const result = parseAnnotations('');
      expect(result.cleanedMarkdown).toBe('');
      expect(result.comments).toEqual([]);
    });
  });

  describe('v2 single annotation', () => {
    it('should parse a single annotation with all fields', () => {
      const markdown = `Some highlighted[@1] text in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted", "prefix": "Some ", "suffix": " text" },
    "body": "This needs attention",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);

      expect(result.comments).toHaveLength(1);
      const comment = result.comments[0];
      expect(comment.id).toBe('comment-1');
      expect(comment.selectedText).toBe('highlighted');
      expect(comment.anchorPrefix).toBe('Some ');
      expect(comment.anchorSuffix).toBe(' text');
      expect(comment.body).toBe('This needs attention');
      expect(comment.author).toBe('reviewer');
      expect(comment.date).toBe('2026-03-03T14:30:00Z');
      expect(comment.resolved).toBe(false);
    });

    it('should remove [@N] markers from cleaned markdown', () => {
      const markdown = `Some highlighted[@1] text in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted" },
    "body": "A comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.cleanedMarkdown).toBe('Some highlighted text in context.');
      expect(result.cleanedMarkdown).not.toContain('[@1]');
      expect(result.cleanedMarkdown).not.toContain('mdview:annotations');
      expect(result.cleanedMarkdown).not.toContain('mdreview:annotations');
    });
  });

  describe('v2 multiple annotations', () => {
    it('should parse multiple annotations', () => {
      const markdown = `First[@1] and second[@2] words.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "First" },
    "body": "First comment",
    "author": "alice",
    "date": "2026-03-01T10:00:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "second" },
    "body": "Second comment",
    "author": "bob",
    "date": "2026-03-02T11:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[0].author).toBe('alice');
      expect(result.comments[0].body).toBe('First comment');
      expect(result.comments[1].id).toBe('comment-2');
      expect(result.comments[1].author).toBe('bob');
      expect(result.comments[1].body).toBe('Second comment');
    });

    it('should remove all [@N] markers from cleaned markdown', () => {
      const markdown = `First[@1] and second[@2] words.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "First" },
    "body": "c1",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "second" },
    "body": "c2",
    "author": "b",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.cleanedMarkdown).toBe('First and second words.');
    });
  });

  describe('v2 resolved annotations', () => {
    it('should parse resolved flag', () => {
      const markdown = `Some text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "text" },
    "body": "Resolved",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z",
    "resolved": true
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].resolved).toBe(true);
    });

    it('should default resolved to false when not specified', () => {
      const markdown = `Some text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "text" },
    "body": "Not resolved",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].resolved).toBe(false);
    });
  });

  describe('v2 edge cases', () => {
    it('should handle malformed JSON gracefully (warn, return empty)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const markdown = `Text[@1] here.

<!-- mdview:annotations [this is not json] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toEqual([]);
      expect(result.cleanedMarkdown).toBe('Text here.');
      consoleSpy.mockRestore();
    });

    it('should handle empty annotations array', () => {
      const markdown = `Some text here.

<!-- mdview:annotations [] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toEqual([]);
      expect(result.cleanedMarkdown).toBe('Some text here.');
    });
  });

  describe('v1 backward compatibility', () => {
    it('should parse v1 format comments through delegation', () => {
      const markdown = `Some highlighted text[^comment-1] in context.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This API endpoint needs error handling
    for the 404 case.`;

      const result = parseAnnotations(markdown);

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[0].selectedText).toBe('text');
      expect(result.comments[0].body).toBe(
        'This API endpoint needs error handling\nfor the 404 case.'
      );
      expect(result.comments[0].author).toBe('reviewer');
      expect(result.comments[0].date).toBe('2026-03-03T14:30:00Z');
      expect(result.comments[0].resolved).toBe(false);
    });

    it('should remove v1 comment references from cleaned markdown', () => {
      const markdown = `Some highlighted text[^comment-1] in context.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    This is a comment.`;

      const result = parseAnnotations(markdown);
      expect(result.cleanedMarkdown).toBe('Some highlighted text in context.');
    });
  });
});
