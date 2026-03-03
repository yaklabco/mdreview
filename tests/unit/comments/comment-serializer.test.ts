/**
 * Tests for Comment Serializer
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
} from '../../../src/comments/comment-serializer';
import type { Comment } from '../../../src/types';

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

  it('should return "comment-1" for markdown with no comments', () => {
    const md = '# Hello\n\nSome paragraph text.\n';
    expect(generateNextCommentId(md)).toBe('comment-1');
  });

  it('should return "comment-2" when comment-1 exists', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    expect(generateNextCommentId(md)).toBe('comment-2');
  });

  it('should return next ID after the highest existing number', () => {
    const md = [
      'Text[^comment-1] and more[^comment-3] here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Comment one',
      '',
      '[^comment-3]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Comment three',
    ].join('\n');
    expect(generateNextCommentId(md)).toBe('comment-4');
  });

  it('should handle non-sequential IDs correctly', () => {
    const md = [
      'A[^comment-5] B[^comment-2] C[^comment-9].',
      '',
      '<!-- mdview:comments -->',
      '[^comment-2]: <!-- mdview:comment {"author":"a","date":"2026-01-01T00:00:00Z"} -->',
      '    Two',
      '',
      '[^comment-5]: <!-- mdview:comment {"author":"a","date":"2026-01-01T00:00:00Z"} -->',
      '    Five',
      '',
      '[^comment-9]: <!-- mdview:comment {"author":"a","date":"2026-01-01T00:00:00Z"} -->',
      '    Nine',
    ].join('\n');
    expect(generateNextCommentId(md)).toBe('comment-10');
  });
});

describe('addComment', () => {
  it('should add a reference after selectedText and a footnote body at the end', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('Some highlighted text[^comment-1] in context.');
    expect(result).toContain('<!-- mdview:comments -->');
    expect(result).toContain(
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->'
    );
    expect(result).toContain('    This is a comment');
  });

  it('should create the comments separator if none exists', () => {
    const md = '# Title\n\nSome highlighted text here.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('<!-- mdview:comments -->');
    // Separator should appear exactly once
    const separatorCount = (result.match(/<!-- mdview:comments -->/g) || []).length;
    expect(separatorCount).toBe(1);
  });

  it('should append to existing comments section without duplicating separator', () => {
    const md = [
      'Text A[^comment-1] and text B here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    First comment',
    ].join('\n');
    const comment = makeComment({
      id: 'comment-2',
      selectedText: 'text B',
      body: 'Second comment',
    });
    const result = addComment(md, comment);

    // Only one separator
    const separatorCount = (result.match(/<!-- mdview:comments -->/g) || []).length;
    expect(separatorCount).toBe(1);

    // Both comments present
    expect(result).toContain('[^comment-1]:');
    expect(result).toContain('[^comment-2]:');
    expect(result).toContain('text B[^comment-2]');
  });

  it('should handle selectedText that appears multiple times by matching first unmatched occurrence', () => {
    const md = 'The word hello appears. Then hello appears again.\n';
    const comment1 = makeComment({
      id: 'comment-1',
      selectedText: 'hello',
      body: 'First hello',
    });

    const result1 = addComment(md, comment1);
    // First occurrence gets the reference
    expect(result1).toContain('The word hello[^comment-1] appears.');
    // Second occurrence is untouched
    expect(result1).toContain('Then hello appears again.');

    // Now add a second comment targeting the same text
    const comment2 = makeComment({
      id: 'comment-2',
      selectedText: 'hello',
      body: 'Second hello',
    });
    const result2 = addComment(result1, comment2);
    // First occurrence already has comment-1
    expect(result2).toContain('hello[^comment-1]');
    // Second occurrence now gets comment-2
    expect(result2).toContain('hello[^comment-2]');
  });

  it('should indent multi-line comment bodies with 4 spaces', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({
      body: 'This API endpoint needs error handling\nfor the 404 case.',
    });
    const result = addComment(md, comment);

    expect(result).toContain('    This API endpoint needs error handling');
    expect(result).toContain('    for the 404 case.');
  });

  it('should not add resolved key to metadata when comment is not resolved', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ resolved: false });
    const result = addComment(md, comment);

    expect(result).not.toContain('"resolved"');
  });

  it('should add resolved key to metadata when comment is resolved', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ resolved: true });
    const result = addComment(md, comment);

    expect(result).toContain('"resolved":true');
  });
});

describe('removeComment', () => {
  it('should remove the reference and footnote body', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('[^comment-1]');
    expect(result).not.toContain('This is a comment');
    expect(result).toContain('Some highlighted text in context.');
  });

  it('should remove the separator when the last comment is deleted', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('<!-- mdview:comments -->');
  });

  it('should keep the separator and other comments when one of many is deleted', () => {
    const md = [
      'Text A[^comment-1] and text B[^comment-2] here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    First comment',
      '',
      '[^comment-2]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T15:00:00Z"} -->',
      '    Second comment',
    ].join('\n');
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('[^comment-1]');
    expect(result).not.toContain('First comment');
    expect(result).toContain('<!-- mdview:comments -->');
    expect(result).toContain('[^comment-2]');
    expect(result).toContain('Second comment');
    expect(result).toContain('Text A and text B[^comment-2] here.');
  });

  it('should handle removing a comment with multi-line body', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Line one of comment',
      '    Line two of comment',
      '    Line three of comment',
    ].join('\n');
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('Line one');
    expect(result).not.toContain('Line two');
    expect(result).not.toContain('Line three');
  });
});

describe('updateComment', () => {
  it('should replace the body text while keeping metadata unchanged', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Original body text',
    ].join('\n');
    const result = updateComment(md, 'comment-1', 'Updated body text');

    expect(result).toContain(
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->'
    );
    expect(result).toContain('    Updated body text');
    expect(result).not.toContain('Original body text');
  });

  it('should handle updating to a multi-line body', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Original body text',
    ].join('\n');
    const result = updateComment(md, 'comment-1', 'Line one\nLine two');

    expect(result).toContain('    Line one');
    expect(result).toContain('    Line two');
    expect(result).not.toContain('Original body text');
  });

  it('should handle updating a multi-line body to a single-line body', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    Original line one',
      '    Original line two',
    ].join('\n');
    const result = updateComment(md, 'comment-1', 'Single line');

    expect(result).toContain('    Single line');
    expect(result).not.toContain('Original line one');
    expect(result).not.toContain('Original line two');
  });

  it('should not affect other comments when updating one', () => {
    const md = [
      'Text A[^comment-1] and text B[^comment-2] here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    First comment body',
      '',
      '[^comment-2]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T15:00:00Z"} -->',
      '    Second comment body',
    ].join('\n');
    const result = updateComment(md, 'comment-1', 'Updated first body');

    expect(result).toContain('    Updated first body');
    expect(result).not.toContain('First comment body');
    expect(result).toContain('    Second comment body');
  });
});

describe('resolveComment', () => {
  it('should add "resolved":true to metadata JSON', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    This is a comment',
    ].join('\n');
    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved":true');
    expect(result).toContain('"author":"reviewer"');
    expect(result).toContain('"date":"2026-03-03T14:30:00Z"');
  });

  it('should not duplicate resolved flag if already resolved', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","resolved":true} -->',
      '    This is a comment',
    ].join('\n');
    const result = resolveComment(md, 'comment-1');

    // Should still be resolved
    expect(result).toContain('"resolved":true');
    // Count occurrences of "resolved" - should be exactly 1
    const resolvedCount = (result.match(/"resolved"/g) || []).length;
    expect(resolvedCount).toBe(1);
  });

  it('should not affect other comments when resolving one', () => {
    const md = [
      'Text A[^comment-1] and text B[^comment-2] here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
      '    First comment',
      '',
      '[^comment-2]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T15:00:00Z"} -->',
      '    Second comment',
    ].join('\n');
    const result = resolveComment(md, 'comment-1');

    // comment-1 should be resolved
    expect(result).toMatch(
      /\[\^comment-1\]:.*"resolved":true/
    );
    // comment-2 should NOT have resolved
    const comment2Line = result
      .split('\n')
      .find((l) => l.includes('[^comment-2]:'));
    expect(comment2Line).toBeDefined();
    expect(comment2Line).not.toContain('"resolved"');
  });
});
