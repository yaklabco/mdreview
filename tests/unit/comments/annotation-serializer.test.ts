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
  updateCommentMetadata,
  addReply,
  toggleReaction,
} from '../../../src/comments/annotation-serializer';
import { parseAnnotations } from '../../../src/comments/annotation-parser';
import { buildSourceMap } from '../../../src/comments/source-position-map';
import type { Comment, CommentContext, CommentReply } from '../../../src/types';

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

const sampleContext: CommentContext = {
  line: 5,
  section: 'Installation',
  sectionLevel: 2,
  breadcrumb: ['Getting Started', 'Installation'],
};

describe('generateNextCommentId', () => {
  it('should return "comment-1" for empty markdown', () => {
    expect(generateNextCommentId('')).toBe('comment-1');
  });

  it('should return "comment-1" for markdown with no annotations', () => {
    const md = '# Hello\n\nSome paragraph text.\n';
    expect(generateNextCommentId(md)).toBe('comment-1');
  });

  it('should return "comment-2" when annotation 1 exists', () => {
    const md = `Text[@1] here.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Text"},"body":"note","author":"a","date":"2026-01-01T00:00:00Z"}] -->`;
    expect(generateNextCommentId(md)).toBe('comment-2');
  });

  it('should return next ID after the highest existing number', () => {
    const md = `A[@1] B[@3] here.

<!-- mdview:annotations [
  {"id":1,"anchor":{"text":"A"},"body":"c1","author":"a","date":"2026-01-01T00:00:00Z"},
  {"id":3,"anchor":{"text":"B"},"body":"c3","author":"a","date":"2026-01-01T00:00:00Z"}
] -->`;
    expect(generateNextCommentId(md)).toBe('comment-4');
  });

  it('should handle non-sequential IDs correctly', () => {
    const md = `A[@5] B[@2] C[@9] here.

<!-- mdview:annotations [
  {"id":2,"anchor":{"text":"B"},"body":"c2","author":"a","date":"2026-01-01T00:00:00Z"},
  {"id":5,"anchor":{"text":"A"},"body":"c5","author":"a","date":"2026-01-01T00:00:00Z"},
  {"id":9,"anchor":{"text":"C"},"body":"c9","author":"a","date":"2026-01-01T00:00:00Z"}
] -->`;
    expect(generateNextCommentId(md)).toBe('comment-10');
  });
});

describe('addComment', () => {
  it('should add a [@N] marker and annotation block', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('Some highlighted text[@1] in context.');
    expect(result).toContain('<!-- mdview:annotations');
    expect(result).toContain('"id": 1');
    expect(result).toContain('"text": "highlighted text"');
    expect(result).toContain('"body": "This is a comment"');
    expect(result).toContain('"author": "reviewer"');
  });

  it('should create the annotation block if none exists', () => {
    const md = '# Title\n\nSome highlighted text here.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('<!-- mdview:annotations');
    const blockCount = (result.match(/<!-- mdview:annotations/g) || []).length;
    expect(blockCount).toBe(1);
  });

  it('should append to existing annotation block without duplicating', () => {
    const md = `Text A[@1] and text B here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text A" },
    "body": "First comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  }
] -->`;
    const comment = makeComment({
      id: 'comment-2',
      selectedText: 'text B',
      body: 'Second comment',
    });
    const result = addComment(md, comment);

    const blockCount = (result.match(/<!-- mdview:annotations/g) || []).length;
    expect(blockCount).toBe(1);
    expect(result).toContain('"id": 1');
    expect(result).toContain('"id": 2');
    expect(result).toContain('text B[@2]');
  });

  it('should handle selectedText that appears multiple times', () => {
    const md = 'The word hello appears. Then hello appears again.\n';
    const comment1 = makeComment({
      id: 'comment-1',
      selectedText: 'hello',
      body: 'First hello',
    });
    const result1 = addComment(md, comment1);
    expect(result1).toContain('The word hello[@1] appears.');
    expect(result1).toContain('Then hello appears again.');

    const comment2 = makeComment({
      id: 'comment-2',
      selectedText: 'hello',
      body: 'Second hello',
    });
    const result2 = addComment(result1, comment2);
    expect(result2).toContain('hello[@1]');
    expect(result2).toContain('hello[@2]');
  });

  it('should not include resolved key when comment is not resolved', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ resolved: false });
    const result = addComment(md, comment);

    expect(result).not.toContain('"resolved"');
  });

  it('should include resolved key when comment is resolved', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ resolved: true });
    const result = addComment(md, comment);

    expect(result).toContain('"resolved": true');
  });

  it('should use numeric ID in JSON output', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ id: 'comment-3' });
    const result = addComment(md, comment);

    expect(result).toContain('"id": 3');
    expect(result).not.toContain('"id": "comment-3"');
  });

  it('should use anchor object with text field', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('"anchor"');
    expect(result).toContain('"text": "highlighted text"');
  });

  it('should include anchor prefix and suffix when present', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({
      anchorPrefix: 'Some ',
      anchorSuffix: ' in',
    });
    const result = addComment(md, comment);

    expect(result).toContain('"prefix": "Some "');
    expect(result).toContain('"suffix": " in"');
  });

  it('should omit anchor prefix/suffix when not present', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"prefix"');
    expect(result).not.toContain('"suffix"');
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

  it('should remove the annotation block when last comment is deleted', () => {
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

    expect(result).not.toContain('<!-- mdview:annotations');
  });

  it('should keep other annotations when one of many is deleted', () => {
    const md = `Text A[@1] and text B[@2] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text A" },
    "body": "First comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "text B" },
    "body": "Second comment",
    "author": "reviewer",
    "date": "2026-03-03T15:00:00Z"
  }
] -->`;
    const result = removeComment(md, 'comment-1');

    expect(result).not.toContain('[@1]');
    expect(result).not.toContain('First comment');
    expect(result).toContain('<!-- mdview:annotations');
    expect(result).toContain('[@2]');
    expect(result).toContain('Second comment');
    expect(result).toContain('Text A and text B[@2] here.');
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
    expect(result).toContain('"author": "reviewer"');
  });

  it('should not affect other annotations', () => {
    const md = `Text A[@1] and text B[@2] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text A" },
    "body": "First comment body",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "text B" },
    "body": "Second comment body",
    "author": "reviewer",
    "date": "2026-03-03T15:00:00Z"
  }
] -->`;
    const result = updateComment(md, 'comment-1', 'Updated first body');

    expect(result).toContain('"body": "Updated first body"');
    expect(result).not.toContain('First comment body');
    expect(result).toContain('"body": "Second comment body"');
  });

  it('should return unchanged markdown when no annotation block exists', () => {
    const md = 'No annotations here.';
    const result = updateComment(md, 'comment-1', 'New body');
    expect(result).toBe(md);
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
    expect(result).toContain('"author": "reviewer"');
  });

  it('should not duplicate resolved flag if already resolved', () => {
    const md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z",
    "resolved": true
  }
] -->`;
    const result = resolveComment(md, 'comment-1');
    expect(result).toContain('"resolved": true');
    const resolvedCount = (result.match(/"resolved"/g) || []).length;
    expect(resolvedCount).toBe(1);
  });

  it('should not affect other annotations when resolving one', () => {
    const md = `Text A[@1] and text B[@2] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "Text A" },
    "body": "First comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "text B" },
    "body": "Second comment",
    "author": "reviewer",
    "date": "2026-03-03T15:00:00Z"
  }
] -->`;
    const result = resolveComment(md, 'comment-1');

    // Parse back to verify
    const parsed = parseAnnotations(result);
    expect(parsed.comments[0].resolved).toBe(true);
    expect(parsed.comments[1].resolved).toBe(false);
  });
});

describe('addCommentAtOffset', () => {
  it('should insert marker after bold text using source map', () => {
    const md = 'This is **important** for the review.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'important' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('**important**[@1]');
    expect(result).toContain('<!-- mdview:annotations');
  });

  it('should insert marker after link using source map', () => {
    const md = 'Click [the link](https://example.com) to continue.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'the link' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('[the link](https://example.com)[@1]');
  });

  it('should fall back to text search when source map fails', () => {
    const md = 'Some text here.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'nonexistent' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('Some text here.');
    expect(result).toContain('<!-- mdview:annotations');
  });

  it('should disambiguate with context', () => {
    const md = 'The word test and another test here.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'test' });
    const result = addCommentAtOffset(md, comment, sourceMap, {
      prefix: 'another ',
      suffix: ' here',
    });

    expect(result).toContain('another test[@1] here');
  });
});

describe('annotation metadata', () => {
  it('should include anchor.text in output', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('"text": "highlighted text"');
  });

  it('should not include anchor.text when selectedText is empty', () => {
    const md = 'Some text.\n';
    const comment = makeComment({ selectedText: '' });
    const result = addComment(md, comment);

    expect(result).toContain('"text": ""');
  });
});

describe('context in annotations', () => {
  it('should include context when comment has context', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ context: sampleContext });
    const result = addComment(md, comment);

    expect(result).toContain('"context"');
    expect(result).toContain('"line": 5');
    expect(result).toContain('"section": "Installation"');
    expect(result).toContain('"sectionLevel": 2');
  });

  it('should omit context when comment has no context', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"context"');
  });

  it('should preserve context through resolveComment', () => {
    const md = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z",
    "context": {
      "line": 5,
      "section": "Installation",
      "sectionLevel": 2,
      "breadcrumb": ["Getting Started", "Installation"]
    }
  }
] -->`;

    const result = resolveComment(md, 'comment-1');
    expect(result).toContain('"resolved": true');
    expect(result).toContain('"line": 5');
    expect(result).toContain('"section": "Installation"');
  });
});

describe('tags in annotations', () => {
  it('should include tags when comment has tags', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ tags: ['blocking', 'suggestion'] });
    const result = addComment(md, comment);

    expect(result).toContain('"tags"');
    expect(result).toContain('"blocking"');
    expect(result).toContain('"suggestion"');
  });

  it('should omit tags when comment has no tags', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"tags"');
  });

  it('should omit tags when tags array is empty', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ tags: [] });
    const result = addComment(md, comment);

    expect(result).not.toContain('"tags"');
  });
});

describe('thread (replies) in annotations', () => {
  it('should serialize replies as thread array', () => {
    const md = 'Some highlighted text in context.\n';
    const replies: CommentReply[] = [
      { id: 'reply-1', author: 'bob', body: 'Good catch', date: '2026-03-04T10:00:00Z' },
    ];
    const comment = makeComment({ replies });
    const result = addComment(md, comment);

    expect(result).toContain('"thread"');
    expect(result).toContain('"author": "bob"');
    expect(result).toContain('"body": "Good catch"');
    // thread entries should NOT have id field
    expect(result).not.toMatch(/"id":\s*"reply-1"/);
  });

  it('should omit thread when replies is empty', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ replies: [] });
    const result = addComment(md, comment);

    expect(result).not.toContain('"thread"');
  });

  it('should omit thread when replies is undefined', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"thread"');
  });
});

describe('reactions in annotations', () => {
  it('should include reactions in annotation JSON', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ reactions: { '\u{1F44D}': ['bob', 'carol'] } });
    const result = addComment(md, comment);

    expect(result).toContain('"reactions"');
  });

  it('should omit reactions when empty object', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ reactions: {} });
    const result = addComment(md, comment);

    expect(result).not.toContain('"reactions"');
  });

  it('should omit reactions when undefined', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"reactions"');
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
    expect(markdown).toContain('"body": "Good catch"');
  });

  it('should generate sequential reply IDs', () => {
    const reply1: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'First reply',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown: md1 } = addReply(v2Md, 'comment-1', reply1);

    const reply2: Omit<CommentReply, 'id'> = {
      author: 'carol',
      body: 'Second reply',
      date: '2026-03-04T11:00:00Z',
    };
    const { markdown: md2, replyId } = addReply(md1, 'comment-1', reply2);

    expect(replyId).toBe('reply-2');
    // Parse back to verify both replies
    const parsed = parseAnnotations(md2);
    expect(parsed.comments[0].replies).toHaveLength(2);
  });

  it('should preserve comment body and other metadata', () => {
    const reply: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'Reply',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown } = addReply(v2Md, 'comment-1', reply);

    expect(markdown).toContain('"body": "This is a comment"');
    expect(markdown).toContain('"author": "reviewer"');
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

  it('should remove author when toggling off existing reaction', () => {
    const mdWithReaction = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z",
    "reactions": { "\u{1F44D}": ["bob", "alice"] }
  }
] -->`;

    const result = toggleReaction(mdWithReaction, 'comment-1', '\u{1F44D}', 'bob');
    const parsed = parseAnnotations(result);
    expect(parsed.comments[0].reactions!['\u{1F44D}']).not.toContain('bob');
    expect(parsed.comments[0].reactions!['\u{1F44D}']).toContain('alice');
  });

  it('should remove emoji key when last author is toggled off', () => {
    const mdWithReaction = `Some highlighted text[@1] in context.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "highlighted text" },
    "body": "This is a comment",
    "author": "reviewer",
    "date": "2026-03-03T14:30:00Z",
    "reactions": { "\u{1F44D}": ["bob"] }
  }
] -->`;

    const result = toggleReaction(mdWithReaction, 'comment-1', '\u{1F44D}', 'bob');
    const parsed = parseAnnotations(result);
    expect(parsed.comments[0].reactions).toBeUndefined();
  });
});

describe('updateCommentMetadata', () => {
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

  it('should call updater with parsed comment and rebuild', () => {
    const result = updateCommentMetadata(v2Md, 'comment-1', (c) => {
      c.resolved = true;
    });

    expect(result).toContain('"resolved": true');
  });

  it('should preserve other annotations', () => {
    const md = `A[@1] and B[@2] here.

<!-- mdview:annotations [
  {
    "id": 1,
    "anchor": { "text": "A" },
    "body": "First comment",
    "author": "alice",
    "date": "2026-03-03T14:30:00Z"
  },
  {
    "id": 2,
    "anchor": { "text": "B" },
    "body": "Second comment",
    "author": "bob",
    "date": "2026-03-03T15:00:00Z"
  }
] -->`;

    const result = updateCommentMetadata(md, 'comment-1', (c) => {
      c.resolved = true;
    });

    const parsed = parseAnnotations(result);
    expect(parsed.comments[0].resolved).toBe(true);
    expect(parsed.comments[1].resolved).toBe(false);
  });

  it('should return unchanged markdown when comment not found', () => {
    const result = updateCommentMetadata(v2Md, 'comment-999', (c) => {
      c.resolved = true;
    });
    expect(result).toBe(v2Md);
  });

  it('should return unchanged markdown when no annotation block', () => {
    const md = 'No annotations here.';
    const result = updateCommentMetadata(md, 'comment-1', (c) => {
      c.resolved = true;
    });
    expect(result).toBe(md);
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
    expect(parsed.comments[0].author).toBe('reviewer');
    expect(parsed.comments[0].date).toBe('2026-03-03T14:30:00Z');
    expect(parsed.comments[0].resolved).toBe(false);
  });

  it('should round-trip comment with all optional fields', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({
      context: sampleContext,
      tags: ['blocking', 'nit'],
      replies: [
        { id: 'reply-1', author: 'bob', body: 'Nice', date: '2026-03-04T10:00:00Z' },
      ],
      reactions: { '\u{1F44D}': ['bob'] },
      anchorPrefix: 'Some ',
      anchorSuffix: ' in',
    });
    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    const c = parsed.comments[0];
    expect(c.context?.line).toBe(5);
    expect(c.context?.section).toBe('Installation');
    expect(c.tags).toEqual(['blocking', 'nit']);
    expect(c.replies).toHaveLength(1);
    expect(c.replies![0].author).toBe('bob');
    expect(c.reactions).toEqual({ '\u{1F44D}': ['bob'] });
    expect(c.anchorPrefix).toBe('Some ');
    expect(c.anchorSuffix).toBe(' in');
  });
});

describe('v1 input migration', () => {
  it('should migrate v1 content to v2 when adding a comment', () => {
    const v1Md = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text"} -->
    First comment.`;

    const newComment = makeComment({
      id: 'comment-2',
      selectedText: 'here',
      body: 'New comment',
    });

    const result = addComment(v1Md, newComment);

    // Should be v2 format now
    expect(result).toContain('<!-- mdview:annotations');
    expect(result).not.toContain('<!-- mdview:comments -->');
    expect(result).not.toContain('[^comment-');

    // All existing comments should be migrated
    const parsed = parseAnnotations(result);
    expect(parsed.comments.length).toBeGreaterThanOrEqual(2);
    const migratedFirst = parsed.comments.find(c => c.id === 'comment-1');
    expect(migratedFirst).toBeDefined();
    expect(migratedFirst!.selectedText).toBe('text');
    expect(migratedFirst!.body).toBe('First comment.');
  });

  it('should migrate v1 with replies and reactions', () => {
    const v1Md = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","replies":[{"id":"reply-1","author":"bob","body":"Nice","date":"2026-03-02T10:00:00Z"}],"reactions":{"\u{1F44D}":["bob"]}} -->
    First comment.`;

    const newComment = makeComment({
      id: 'comment-2',
      selectedText: 'here',
      body: 'New comment',
    });

    const result = addComment(v1Md, newComment);
    const parsed = parseAnnotations(result);
    const migratedFirst = parsed.comments.find(c => c.id === 'comment-1');
    expect(migratedFirst!.replies).toHaveLength(1);
    expect(migratedFirst!.reactions).toBeDefined();
  });

  it('should migrate v1 resolved comments', () => {
    const v1Md = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","resolved":true} -->
    Resolved comment.`;

    const newComment = makeComment({
      id: 'comment-2',
      selectedText: 'here',
      body: 'New comment',
    });

    const result = addComment(v1Md, newComment);
    const parsed = parseAnnotations(result);
    const migratedFirst = parsed.comments.find(c => c.id === 'comment-1');
    expect(migratedFirst!.resolved).toBe(true);
  });

  it('should migrate v1 with context', () => {
    const v1Md = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","line":3,"section":"Setup","sectionLevel":2,"breadcrumb":["Setup"]} -->
    Comment with context.`;

    const newComment = makeComment({
      id: 'comment-2',
      selectedText: 'here',
      body: 'New comment',
    });

    const result = addComment(v1Md, newComment);
    const parsed = parseAnnotations(result);
    const migratedFirst = parsed.comments.find(c => c.id === 'comment-1');
    expect(migratedFirst!.context).toBeDefined();
    expect(migratedFirst!.context!.line).toBe(3);
    expect(migratedFirst!.context!.section).toBe('Setup');
  });

  it('should migrate v1 with tags', () => {
    const v1Md = `Some text[^comment-1] here.

<!-- mdview:comments -->
[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-01T10:00:00Z","selectedText":"text","tags":["blocking","nit"]} -->
    Tagged comment.`;

    const newComment = makeComment({
      id: 'comment-2',
      selectedText: 'here',
      body: 'New comment',
    });

    const result = addComment(v1Md, newComment);
    const parsed = parseAnnotations(result);
    const migratedFirst = parsed.comments.find(c => c.id === 'comment-1');
    expect(migratedFirst!.tags).toEqual(['blocking', 'nit']);
  });
});
