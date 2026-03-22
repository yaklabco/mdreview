/**
 * Tests for Annotation Serializer (v2 format)
 *
 * Verifies v2 annotation operations: generating IDs, adding, removing,
 * updating, resolving comments, replies, reactions, and v1 migration.
 */

import { describe, it, expect } from 'vitest';
import {
  generateNextCommentId,
  addComment,
  addCommentAtOffset,
  removeComment,
  updateComment,
  resolveComment,
  addReply,
  toggleReaction,
} from '../../comments/annotation-serializer';
import { parseAnnotations } from '../../comments/annotation-parser';
import { buildSourceMap } from '../../comments/source-position-map';
import type { Comment, CommentReply } from '../../types/index';

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

  it('should return "comment-2" when annotation 1 exists', () => {
    const md = `Text[@1] here.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Text"},"body":"note","author":"a","date":"2026-01-01T00:00:00Z"}] -->`;
    expect(generateNextCommentId(md)).toBe('comment-2');
  });
});

describe('addComment', () => {
  it('should add a [@N] marker and annotation block', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('Some highlighted text[@1] in context.');
    expect(result).toContain('<!-- mdreview:annotations');
    expect(result).toContain('"id": 1');
    expect(result).toContain('"text": "highlighted text"');
    expect(result).toContain('"body": "This is a comment"');
  });
});

describe('removeComment', () => {
  it('should remove the [@N] marker and annotation entry', () => {
    const md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('[@1]');
    expect(result).not.toContain('This is a comment');
    expect(result).toContain('Some highlighted text in context.');
  });
});

describe('updateComment', () => {
  it('should replace the body while keeping other fields unchanged', () => {
    const md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "Original body text",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;
    const result = updateComment(md, 'comment-1', 'Updated body text');

    expect(result).toContain('"body": "Updated body text"');
    expect(result).not.toContain('Original body text');
  });
});

describe('resolveComment', () => {
  it('should set resolved:true in annotation JSON', () => {
    const md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;
    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved": true');
  });
});

describe('addCommentAtOffset', () => {
  it('should insert marker after bold text using source map', () => {
    const md = 'This is **important** for the review.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'important' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('**important**[@1]');
    expect(result).toContain('<!-- mdreview:annotations');
  });
});

describe('addReply', () => {
  const v2Md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;

  it('should add a reply to annotation thread', () => {
    const reply: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'Good catch',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown, replyId } = addReply(v2Md, 'comment-1', reply);

    expect(replyId).toBe('reply-1');
    expect(markdown).toContain('"thread"');
    expect(markdown).toContain('"author": "bob"');
  });
});

describe('toggleReaction', () => {
  const v2Md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;

  it('should add a reaction when none exist', () => {
    const result = toggleReaction(v2Md, 'comment-1', '\u{1F44D}', 'bob');

    expect(result).toContain('"reactions"');
    const parsed = parseAnnotations(result);
    expect(parsed.comments[0].reactions).toBeDefined();
    expect(parsed.comments[0].reactions!['\u{1F44D}']).toContain('bob');
  });
});

describe('round-trip: serialize then parse', () => {
  it('should round-trip a basic comment', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].id).toBe('comment-1');
    expect(parsed.comments[0].selectedText).toBe('highlighted text');
    expect(parsed.comments[0].body).toBe('This is a comment');
  });
});
