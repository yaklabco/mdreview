/**
 * Tests for Comment Serializer (v1 format)
 *
 * Verifies markdown footnote-based comment operations:
 * generating IDs, adding, removing, updating, and resolving comments.
 */

import { describe, it, expect } from 'vitest';
import {
  generateNextCommentId,
  addComment,
  removeComment,
  updateComment,
  resolveComment,
} from '../../comments/comment-serializer';
import type { Comment } from '../../types/index';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    selectedText: 'highlighted text',
    body: 'This is a comment',
    author: 'reviewer',
    date: '2026-03-03T14:30:00Z',
    resolved: false,
    ...overrides,
  };
}

describe('generateNextCommentId', () => {
  it('should return "comment-1" for empty markdown', () => {
    expect(generateNextCommentId('')).toBe('comment-1');
  });

  it('should return "comment-2" when comment-1 exists', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdreview:comments -->',
      '[^comment-1]: <!-- mdreview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    expect(generateNextCommentId(md)).toBe('comment-2');
  });
});

describe('addComment', () => {
  it('should add a reference after selectedText and a footnote body at the end', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('Some highlighted text[^comment-1] in context.');
    expect(result).toContain('<!-- mdreview:comments -->');
    expect(result).toContain('[^comment-1]: <!-- mdreview:comment');
    expect(result).toContain('    This is a comment');
  });
});

describe('removeComment', () => {
  it('should remove the reference and footnote body', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdreview:comments -->',
      '[^comment-1]: <!-- mdreview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('[^comment-1]');
    expect(result).not.toContain('This is a comment');
    expect(result).toContain('Some highlighted text in context.');
  });
});

describe('updateComment', () => {
  it('should replace the body text while keeping metadata unchanged', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdreview:comments -->',
      '[^comment-1]: <!-- mdreview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Original body text',
    ].join('\n');
    const result = updateComment(md, 'comment-1', 'Updated body text');

    expect(result).toContain('    Updated body text');
    expect(result).not.toContain('Original body text');
  });
});

describe('resolveComment', () => {
  it('should add "resolved":true to metadata JSON', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdreview:comments -->',
      '[^comment-1]: <!-- mdreview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved":true');
  });
});
