/**
 * Integration tests for v1 → v2 annotation migration.
 *
 * Verifies that v1 documents are seamlessly migrated to v2 format
 * when a mutation is performed, preserving all data.
 */

import { describe, it, expect } from 'vitest';
import { parseAnnotations } from '@mdreview/core';
import { addComment } from '@mdreview/core';
import type { Comment } from '@mdreview/core';

function makeNewComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-99',
    selectedText: 'target',
    body: 'New comment',
    author: 'reviewer',
    date: '2026-03-10T10:00:00Z',
    resolved: false,
    ...overrides,
  };
}

describe('v1 → v2 migration', () => {
  it('should migrate v1 document to v2 when adding a comment', () => {
    const v1Md = `# Title

Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text"} -->
    First comment body.`;

    const result = addComment(v1Md, makeNewComment());

    // Should be v2 format
    expect(result).toContain('<!-- mdreview:annotations');
    expect(result).not.toContain('<!-- mdview:comments -->');
    expect(result).not.toContain('[^comment-');

    // All comments present
    const parsed = parseAnnotations(result);
    expect(parsed.comments.length).toBeGreaterThanOrEqual(2);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated).toBeDefined();
    expect(migrated!.selectedText).toBe('text');
    expect(migrated!.body).toBe('First comment body.');
  });

  it('should migrate v1 with replies', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","replies":[{"id":"reply-1","author":"bob","body":"Good catch","date":"2026-03-02T10:00:00Z"},{"id":"reply-2","author":"carol","body":"Agreed","date":"2026-03-02T11:00:00Z"}]} -->
    First comment.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated!.replies).toHaveLength(2);
    expect(migrated!.replies![0].author).toBe('bob');
    expect(migrated!.replies![1].author).toBe('carol');
  });

  it('should migrate v1 with reactions', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","reactions":{"\u{1F44D}":["bob","carol"],"\u{2764}\u{FE0F}":["alice"]}} -->
    First comment.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated!.reactions).toBeDefined();
    expect(migrated!.reactions!['\u{1F44D}']).toEqual(['bob', 'carol']);
    expect(migrated!.reactions!['\u{2764}\u{FE0F}']).toEqual(['alice']);
  });

  it('should migrate v1 with context', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","line":3,"section":"Setup","sectionLevel":2,"breadcrumb":["Getting Started","Setup"]} -->
    Comment with context.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated!.context).toBeDefined();
    expect(migrated!.context!.line).toBe(3);
    expect(migrated!.context!.section).toBe('Setup');
    expect(migrated!.context!.sectionLevel).toBe(2);
    expect(migrated!.context!.breadcrumb).toEqual(['Getting Started', 'Setup']);
  });

  it('should migrate v1 resolved comments', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","resolved":true} -->
    Resolved comment.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated!.resolved).toBe(true);
  });

  it('should migrate v1 with tags', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","tags":["blocking","nit"]} -->
    Tagged comment.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');
    expect(migrated!.tags).toEqual(['blocking', 'nit']);
  });

  it('should handle empty v1 (separator but no comments)', () => {
    const v1Md = `Some text here and target there.

<!-- mdview:comments -->`;

    const result = addComment(v1Md, makeNewComment());

    expect(result).toContain('<!-- mdreview:annotations');
    expect(result).not.toContain('<!-- mdview:comments -->');

    const parsed = parseAnnotations(result);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].id).toBe('comment-99');
  });

  it('should migrate multiple v1 comments', () => {
    const v1Md = `First text[^comment-1] and second text[^comment-2] and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"First text"} -->
    First comment body.
[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-02T11:00:00Z","selectedText":"second text"} -->
    Second comment body.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);

    expect(parsed.comments.length).toBeGreaterThanOrEqual(3);
    const c1 = parsed.comments.find((c) => c.id === 'comment-1');
    const c2 = parsed.comments.find((c) => c.id === 'comment-2');
    expect(c1!.body).toBe('First comment body.');
    expect(c2!.body).toBe('Second comment body.');
  });

  it('should produce valid v2 markdown after migration', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text"} -->
    A comment.`;

    const result = addComment(v1Md, makeNewComment());

    // Verify it can be parsed again
    const parsed = parseAnnotations(result);
    expect(parsed.comments.length).toBeGreaterThanOrEqual(2);

    // Verify cleaned markdown is clean
    expect(parsed.cleanedMarkdown).not.toContain('[^comment-');
    expect(parsed.cleanedMarkdown).not.toContain('[@');
    expect(parsed.cleanedMarkdown).not.toContain('mdview:');
  });

  it('should handle v1 with all metadata fields combined', () => {
    const v1Md = `Some text[^comment-1] here and target there.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","resolved":true,"line":5,"section":"API","sectionLevel":2,"breadcrumb":["Docs","API"],"tags":["blocking"],"replies":[{"id":"reply-1","author":"bob","body":"Fixed","date":"2026-03-02T10:00:00Z"}],"reactions":{"\u{1F44D}":["bob"]}} -->
    Full metadata comment.`;

    const result = addComment(v1Md, makeNewComment());
    const parsed = parseAnnotations(result);
    const migrated = parsed.comments.find((c) => c.id === 'comment-1');

    expect(migrated!.resolved).toBe(true);
    expect(migrated!.context!.line).toBe(5);
    expect(migrated!.context!.section).toBe('API');
    expect(migrated!.tags).toEqual(['blocking']);
    expect(migrated!.replies).toHaveLength(1);
    expect(migrated!.reactions).toEqual({ '\u{1F44D}': ['bob'] });
    expect(migrated!.body).toBe('Full metadata comment.');
  });
});
