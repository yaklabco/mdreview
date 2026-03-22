import { describe, it, expect } from 'vitest';
import { parseComments } from '@mdreview/core';
import {
  addComment,
  removeComment,
  resolveComment,
  updateComment,
  generateNextCommentId,
  addReply,
  toggleReaction,
} from '../../packages/core/src/comments/comment-serializer';
import { computeCommentContext } from '@mdreview/core';
import type { Comment } from '@mdreview/core';

describe('Comment System Integration', () => {
  const baseMarkdown =
    '# Test Document\n\nThe quick brown fox jumps over the lazy dog.\n\nAnother paragraph here.';

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
    // selectedText is now stored in the footnote metadata, so full text survives round-trip
    expect(parsed.comments[0].selectedText).toBe('brown fox');
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

describe('Replies and Reactions Integration', () => {
  const baseMarkdown = '# Test Document\n\nSome content here.\n\nMore content.';

  it('should round-trip: add comment with replies then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Needs expansion.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
      replies: [
        { id: 'reply-1', author: 'bob', body: 'I agree', date: '2026-03-03T11:00:00Z' },
        { id: 'reply-2', author: 'carol', body: 'Me too', date: '2026-03-03T12:00:00Z' },
      ],
    };

    const withComment = addComment(baseMarkdown, comment);
    const parsed = parseComments(withComment);

    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].replies).toHaveLength(2);
    expect(parsed.comments[0].replies![0].author).toBe('bob');
    expect(parsed.comments[0].replies![0].body).toBe('I agree');
    expect(parsed.comments[0].replies![1].author).toBe('carol');
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should round-trip: add comment with reactions then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Nice!',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
      reactions: { '👍': ['bob', 'carol'], '❤️': ['alice'] },
    };

    const withComment = addComment(baseMarkdown, comment);
    const parsed = parseComments(withComment);

    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].reactions).toBeDefined();
    expect(parsed.comments[0].reactions!['👍']).toEqual(['bob', 'carol']);
    expect(parsed.comments[0].reactions!['❤️']).toEqual(['alice']);
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should round-trip: add reply via addReply then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Question here.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, comment);
    const result1 = addReply(md, 'comment-1', {
      author: 'bob',
      body: 'First reply',
      date: '2026-03-03T11:00:00Z',
    });
    md = result1.markdown;
    expect(result1.replyId).toBe('reply-1');

    const result2 = addReply(md, 'comment-1', {
      author: 'carol',
      body: 'Second reply',
      date: '2026-03-03T12:00:00Z',
    });
    md = result2.markdown;
    expect(result2.replyId).toBe('reply-2');

    const parsed = parseComments(md);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].replies).toHaveLength(2);
    expect(parsed.comments[0].replies![0].id).toBe('reply-1');
    expect(parsed.comments[0].replies![0].body).toBe('First reply');
    expect(parsed.comments[0].replies![1].id).toBe('reply-2');
    expect(parsed.comments[0].replies![1].body).toBe('Second reply');
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should round-trip: toggle reaction on then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'A comment.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, comment);
    md = toggleReaction(md, 'comment-1', '👍', 'bob');
    md = toggleReaction(md, 'comment-1', '👍', 'carol');
    md = toggleReaction(md, 'comment-1', '❤️', 'alice');

    const parsed = parseComments(md);
    expect(parsed.comments[0].reactions!['👍']).toEqual(['bob', 'carol']);
    expect(parsed.comments[0].reactions!['❤️']).toEqual(['alice']);
  });

  it('should round-trip: toggle reaction off then parse', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'A comment.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, comment);
    md = toggleReaction(md, 'comment-1', '👍', 'bob');
    md = toggleReaction(md, 'comment-1', '👍', 'carol');

    // Toggle bob off
    md = toggleReaction(md, 'comment-1', '👍', 'bob');

    const parsed = parseComments(md);
    expect(parsed.comments[0].reactions!['👍']).toEqual(['carol']);

    // Toggle carol off too — emoji key should be removed
    md = toggleReaction(md, 'comment-1', '👍', 'carol');

    const parsed2 = parseComments(md);
    expect(parsed2.comments[0].reactions).toBeUndefined();
  });

  it('should round-trip: replies and reactions together', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Discussion point.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, comment);
    const { markdown } = addReply(md, 'comment-1', {
      author: 'bob',
      body: 'Interesting point',
      date: '2026-03-03T11:00:00Z',
    });
    md = markdown;
    md = toggleReaction(md, 'comment-1', '🎉', 'carol');

    const parsed = parseComments(md);
    expect(parsed.comments[0].replies).toHaveLength(1);
    expect(parsed.comments[0].replies![0].body).toBe('Interesting point');
    expect(parsed.comments[0].reactions!['🎉']).toEqual(['carol']);
    expect(parsed.cleanedMarkdown).toBe(baseMarkdown);
  });

  it('should preserve replies and reactions through resolve', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Fix this.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    let md = addComment(baseMarkdown, comment);
    const { markdown } = addReply(md, 'comment-1', {
      author: 'bob',
      body: 'Done',
      date: '2026-03-03T11:00:00Z',
    });
    md = markdown;
    md = toggleReaction(md, 'comment-1', '✅', 'alice');
    md = resolveComment(md, 'comment-1');

    const parsed = parseComments(md);
    expect(parsed.comments[0].resolved).toBe(true);
    expect(parsed.comments[0].replies).toHaveLength(1);
    expect(parsed.comments[0].reactions!['✅']).toEqual(['alice']);
  });

  it('should handle backward compatibility: old comments without replies/reactions', () => {
    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'content',
      body: 'Old comment.',
      author: 'alice',
      date: '2026-03-03T10:00:00Z',
      resolved: false,
    };

    const md = addComment(baseMarkdown, comment);
    const parsed = parseComments(md);

    expect(parsed.comments[0].replies).toBeUndefined();
    expect(parsed.comments[0].reactions).toBeUndefined();
  });
});

describe('Comment Context Integration', () => {
  const structuredMarkdown = [
    '# Getting Started',
    '',
    '## Installation',
    '',
    'Run npm install to get started.',
    '',
    '## Configuration',
    '',
    'Edit the config file to set options.',
  ].join('\n');

  it('should round-trip context fields through add and parse', () => {
    // Compute context for "config file" on line 9
    const offset = structuredMarkdown.indexOf('config file');
    const context = computeCommentContext(structuredMarkdown, offset);

    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'config file',
      body: 'Needs more detail',
      author: 'reviewer',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
      context,
    };

    const withComment = addComment(structuredMarkdown, comment);
    const parsed = parseComments(withComment);

    expect(parsed.comments).toHaveLength(1);
    const parsedCtx = parsed.comments[0].context;
    expect(parsedCtx).toBeDefined();
    expect(parsedCtx!.line).toBe(9);
    expect(parsedCtx!.section).toBe('Configuration');
    expect(parsedCtx!.sectionLevel).toBe(2);
    expect(parsedCtx!.breadcrumb).toEqual(['Getting Started', 'Configuration']);
  });

  it('should handle document without headings', () => {
    const plainMarkdown = 'Just some text here.\n\nAnother paragraph.';
    const offset = plainMarkdown.indexOf('some text');
    const context = computeCommentContext(plainMarkdown, offset);

    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'some text',
      body: 'Comment',
      author: 'reviewer',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
      context,
    };

    const withComment = addComment(plainMarkdown, comment);
    const parsed = parseComments(withComment);

    expect(parsed.comments).toHaveLength(1);
    const parsedCtx = parsed.comments[0].context;
    expect(parsedCtx).toBeDefined();
    expect(parsedCtx!.line).toBe(1);
    expect(parsedCtx!.section).toBeUndefined();
    expect(parsedCtx!.breadcrumb).toEqual([]);
  });

  it('should preserve context through edit operation', () => {
    const offset = structuredMarkdown.indexOf('config file');
    const context = computeCommentContext(structuredMarkdown, offset);

    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'config file',
      body: 'Original comment',
      author: 'reviewer',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
      context,
    };

    let md = addComment(structuredMarkdown, comment);
    md = updateComment(md, 'comment-1', 'Updated comment body');
    const parsed = parseComments(md);

    expect(parsed.comments[0].body).toBe('Updated comment body');
    const parsedCtx = parsed.comments[0].context;
    expect(parsedCtx).toBeDefined();
    expect(parsedCtx!.line).toBe(9);
    expect(parsedCtx!.section).toBe('Configuration');
    expect(parsedCtx!.breadcrumb).toEqual(['Getting Started', 'Configuration']);
  });

  it('should preserve context through resolve operation', () => {
    const offset = structuredMarkdown.indexOf('npm install');
    const context = computeCommentContext(structuredMarkdown, offset);

    const comment: Comment = {
      id: 'comment-1',
      selectedText: 'npm install',
      body: 'Which version?',
      author: 'reviewer',
      date: '2026-03-03T14:30:00Z',
      resolved: false,
      context,
    };

    let md = addComment(structuredMarkdown, comment);
    md = resolveComment(md, 'comment-1');
    const parsed = parseComments(md);

    expect(parsed.comments[0].resolved).toBe(true);
    const parsedCtx = parsed.comments[0].context;
    expect(parsedCtx).toBeDefined();
    expect(parsedCtx!.line).toBe(5);
    expect(parsedCtx!.section).toBe('Installation');
    expect(parsedCtx!.breadcrumb).toEqual(['Getting Started', 'Installation']);
  });
});
