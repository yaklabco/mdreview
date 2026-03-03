import { describe, it, expect } from 'vitest';
import { parseComments } from '../../src/comments/comment-parser';
import {
  addComment,
  removeComment,
  resolveComment,
  updateComment,
  generateNextCommentId,
} from '../../src/comments/comment-serializer';
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
    // Parser extracts only the word immediately before the [^comment-N] ref
    // "brown fox[^comment-1]" -> \S+ captures "fox"
    expect(parsed.comments[0].selectedText).toBe('fox');
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

    // removeComment adds a trailing newline when all comments are removed
    expect(deleted).toBe(baseMarkdown + '\n');
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

  it('should generate correct next ID after adding comments', () => {
    const comment1: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'First.',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const withComment = addComment(baseMarkdown, comment1);
    const nextId = generateNextCommentId(withComment);
    expect(nextId).toBe('comment-2');
  });

  it('should handle add, delete first, keep second', () => {
    const comment1: Comment = {
      id: 'comment-1',
      selectedText: 'brown fox',
      body: 'First.',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    const comment2: Comment = {
      id: 'comment-2',
      selectedText: 'lazy dog',
      body: 'Second.',
      author: 'alice',
      date: '2026-03-03T15:00:00Z',
      resolved: false,
    };

    let markdown = addComment(baseMarkdown, comment1);
    markdown = addComment(markdown, comment2);
    markdown = removeComment(markdown, 'comment-1');

    const parsed = parseComments(markdown);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].id).toBe('comment-2');
    expect(parsed.comments[0].body).toBe('Second.');
  });

  it('should handle complex lifecycle: add, resolve, edit, add another, delete first', () => {
    const c1: Comment = {
      id: 'comment-1',
      selectedText: 'quick',
      body: 'Speed?',
      author: 'james',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, c1);
    md = resolveComment(md, 'comment-1');
    md = updateComment(md, 'comment-1', 'Fast enough.');

    const c2: Comment = {
      id: 'comment-2',
      selectedText: 'Another',
      body: 'More context needed.',
      author: 'alice',
      date: '2026-03-03T15:00:00Z',
      resolved: false,
    };

    md = addComment(md, c2);
    md = removeComment(md, 'comment-1');

    const parsed = parseComments(md);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].id).toBe('comment-2');
    expect(parsed.comments[0].body).toBe('More context needed.');
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });
});
