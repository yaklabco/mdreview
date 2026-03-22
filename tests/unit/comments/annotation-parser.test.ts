/**
 * Tests for annotation parser — v2 format with v1 backward compatibility
 */

import { describe, it, expect, vi } from 'vitest';
import { parseAnnotations, detectFormat } from '@mdreview/core';

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

  describe('v2 anchor mapping', () => {
    it('should map anchor.text to selectedText', () => {
      const markdown = `Important[@1] stuff.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Important" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].selectedText).toBe('Important');
    });

    it('should map anchor.prefix to anchorPrefix', () => {
      const markdown = `The Important[@1] stuff.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Important", "prefix": "The " },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].anchorPrefix).toBe('The ');
    });

    it('should map anchor.suffix to anchorSuffix', () => {
      const markdown = `Important[@1] stuff.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Important", "suffix": " stuff" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].anchorSuffix).toBe(' stuff');
    });

    it('should leave anchorPrefix/anchorSuffix undefined when not present', () => {
      const markdown = `Important[@1] stuff.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Important" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].anchorPrefix).toBeUndefined();
      expect(result.comments[0].anchorSuffix).toBeUndefined();
    });
  });

  describe('v2 thread mapping', () => {
    it('should map thread entries to replies with generated IDs', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "Main comment",
    "author": "alice",
    "date": "2026-03-01T10:00:00Z",
    "thread": [
      { "author": "bob", "body": "Good catch", "date": "2026-03-02T10:00:00Z" },
      { "author": "carol", "body": "Agreed", "date": "2026-03-02T11:00:00Z" }
    ]
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].replies).toHaveLength(2);
      expect(result.comments[0].replies![0].id).toBe('reply-1');
      expect(result.comments[0].replies![0].author).toBe('bob');
      expect(result.comments[0].replies![0].body).toBe('Good catch');
      expect(result.comments[0].replies![1].id).toBe('reply-2');
      expect(result.comments[0].replies![1].author).toBe('carol');
    });

    it('should leave replies undefined when no thread present', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].replies).toBeUndefined();
    });

    it('should leave replies undefined when thread is empty', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "thread": []
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].replies).toBeUndefined();
    });
  });

  describe('v2 optional fields', () => {
    it('should parse tags', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "tags": ["blocking", "suggestion"]
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].tags).toEqual(['blocking', 'suggestion']);
    });

    it('should leave tags undefined when not present', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].tags).toBeUndefined();
    });

    it('should leave tags undefined when empty array', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "tags": []
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].tags).toBeUndefined();
    });

    it('should parse reactions', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "reactions": { "\ud83d\udc4d": ["bob", "carol"] }
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].reactions).toEqual({ '\ud83d\udc4d': ['bob', 'carol'] });
    });

    it('should leave reactions undefined when not present', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].reactions).toBeUndefined();
    });

    it('should leave reactions undefined when empty object', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "reactions": {}
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].reactions).toBeUndefined();
    });

    it('should parse context', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z",
    "context": {
      "line": 5,
      "section": "Install",
      "sectionLevel": 2,
      "breadcrumb": ["Getting Started", "Install"]
    }
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].context).toBeDefined();
      expect(result.comments[0].context!.line).toBe(5);
      expect(result.comments[0].context!.section).toBe('Install');
      expect(result.comments[0].context!.sectionLevel).toBe(2);
      expect(result.comments[0].context!.breadcrumb).toEqual(['Getting Started', 'Install']);
    });

    it('should leave context undefined when not present', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].context).toBeUndefined();
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

    it('should handle annotations with no inline markers', () => {
      const markdown = `Some text here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toHaveLength(1);
      expect(result.cleanedMarkdown).toBe('Some text here.');
    });

    it('should handle missing optional fields in annotation', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text" },
    "body": "note",
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      const c = result.comments[0];
      expect(c.resolved).toBe(false);
      expect(c.tags).toBeUndefined();
      expect(c.replies).toBeUndefined();
      expect(c.reactions).toBeUndefined();
      expect(c.context).toBeUndefined();
      expect(c.anchorPrefix).toBeUndefined();
      expect(c.anchorSuffix).toBeUndefined();
    });

    it('should handle multiple [@N] markers on the same line', () => {
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
    "author": "a",
    "date": "2026-01-01T00:00:00Z"
  }
] -->`;

      const result = parseAnnotations(markdown);
      expect(result.cleanedMarkdown).toBe('First and second words.');
    });

    it('should handle annotation block on a single line', () => {
      const markdown = `Text[@1] here.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Text"},"body":"note","author":"a","date":"2026-01-01T00:00:00Z"}] -->`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment-1');
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

    it('should parse v1 resolved comments', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","resolved":true} -->
    Resolved.`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].resolved).toBe(true);
    });

    it('should parse v1 metadata selectedText', () => {
      const markdown = `Some **important**[^comment-1] text.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","selectedText":"important"} -->
    Comment`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].selectedText).toBe('important');
    });

    it('should parse v1 context metadata', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","selectedText":"text","line":5,"section":"Install","sectionLevel":2,"breadcrumb":["Getting Started","Install"]} -->
    Comment`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].context).toBeDefined();
      expect(result.comments[0].context!.line).toBe(5);
      expect(result.comments[0].context!.section).toBe('Install');
    });

    it('should parse v1 tags', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","tags":["blocking","suggestion"]} -->
    Comment`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].tags).toEqual(['blocking', 'suggestion']);
    });

    it('should parse v1 replies', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","replies":[{"id":"reply-1","author":"bob","body":"Good catch","date":"2026-03-04T10:00:00Z"}]} -->
    Comment`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].replies).toHaveLength(1);
      expect(result.comments[0].replies![0].id).toBe('reply-1');
    });

    it('should parse v1 reactions', () => {
      const markdown = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","reactions":{"\ud83d\udc4d":["bob"]}} -->
    Comment`;

      const result = parseAnnotations(markdown);
      expect(result.comments[0].reactions).toEqual({ '\ud83d\udc4d': ['bob'] });
    });

    it('should handle v1 multiple comments', () => {
      const markdown = `First text[^comment-1] and second text[^comment-2] in the doc.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z"} -->
    First comment body.
[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-02T11:00:00Z"} -->
    Second comment body.`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].id).toBe('comment-1');
      expect(result.comments[1].id).toBe('comment-2');
    });

    it('should handle v1 malformed JSON gracefully', () => {
      const markdown = `Text[^comment-1] and more text[^comment-2] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {bad json} -->
    Skipped.
[^comment-2]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->
    Parsed.`;

      const result = parseAnnotations(markdown);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('comment-2');
    });
  });
});
