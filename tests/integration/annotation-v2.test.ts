/**
 * Integration tests for v2 annotation format.
 *
 * Full round-trip tests: add → parse → verify, CRUD lifecycle,
 * anchor round-trip, thread IDs, reactions, and large documents.
 */

import { describe, it, expect } from 'vitest';
import { parseAnnotations } from '@mdreview/core';
import {
  addComment,
  removeComment,
  updateComment,
  resolveComment,
  addReply,
  toggleReaction,
  generateNextCommentId,
} from '@mdreview/core';
import type { Comment, CommentContext } from '@mdreview/core';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    selectedText: 'some text',
    body: 'A comment',
    author: 'alice',
    date: '2026-03-03T14:30:00Z',
    resolved: false,
    ...overrides,
  };
}

describe('Full round-trip', () => {
  it('should preserve all fields through add → parse', () => {
    const md = 'The quick brown fox jumps over the lazy dog.\n';
    const context: CommentContext = {
      line: 1,
      section: 'Intro',
      sectionLevel: 1,
      breadcrumb: ['Intro'],
    };
    const comment = makeComment({
      selectedText: 'brown fox',
      body: 'Should this be a red fox?',
      author: 'editor',
      date: '2026-03-10T09:00:00Z',
      context,
      tags: ['suggestion', 'nit'],
      replies: [
        { id: 'reply-1', author: 'writer', body: 'Good point', date: '2026-03-10T10:00:00Z' },
      ],
      reactions: { '\u{1F44D}': ['writer'], '\u{2764}\u{FE0F}': ['editor'] },
      anchorPrefix: 'quick ',
      anchorSuffix: ' jumps',
    });

    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    expect(parsed.comments).toHaveLength(1);
    const c = parsed.comments[0];
    expect(c.id).toBe('comment-1');
    expect(c.selectedText).toBe('brown fox');
    expect(c.body).toBe('Should this be a red fox?');
    expect(c.author).toBe('editor');
    expect(c.date).toBe('2026-03-10T09:00:00Z');
    expect(c.resolved).toBe(false);
    expect(c.context?.line).toBe(1);
    expect(c.context?.section).toBe('Intro');
    expect(c.context?.sectionLevel).toBe(1);
    expect(c.context?.breadcrumb).toEqual(['Intro']);
    expect(c.tags).toEqual(['suggestion', 'nit']);
    expect(c.replies).toHaveLength(1);
    expect(c.replies![0].author).toBe('writer');
    expect(c.replies![0].body).toBe('Good point');
    expect(c.reactions).toEqual({ '\u{1F44D}': ['writer'], '\u{2764}\u{FE0F}': ['editor'] });
    expect(c.anchorPrefix).toBe('quick ');
    expect(c.anchorSuffix).toBe(' jumps');
  });
});

describe('CRUD lifecycle', () => {
  it('should handle add → resolve → edit → add another → delete first', () => {
    let md = 'Alpha beta gamma delta.\n';

    // Add first comment
    const c1 = makeComment({ id: 'comment-1', selectedText: 'beta', body: 'Comment on beta' });
    md = addComment(md, c1);
    let parsed = parseAnnotations(md);
    expect(parsed.comments).toHaveLength(1);

    // Resolve first comment
    md = resolveComment(md, 'comment-1');
    parsed = parseAnnotations(md);
    expect(parsed.comments[0].resolved).toBe(true);

    // Edit first comment
    md = updateComment(md, 'comment-1', 'Updated body');
    parsed = parseAnnotations(md);
    expect(parsed.comments[0].body).toBe('Updated body');
    expect(parsed.comments[0].resolved).toBe(true);

    // Add second comment
    const c2 = makeComment({ id: 'comment-2', selectedText: 'gamma', body: 'Comment on gamma' });
    md = addComment(md, c2);
    parsed = parseAnnotations(md);
    expect(parsed.comments).toHaveLength(2);

    // Delete first comment
    md = removeComment(md, 'comment-1');
    parsed = parseAnnotations(md);
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.comments[0].id).toBe('comment-2');
    expect(parsed.comments[0].body).toBe('Comment on gamma');

    // Cleaned markdown should not have markers for deleted comment
    expect(parsed.cleanedMarkdown).not.toContain('[@1]');
    expect(parsed.cleanedMarkdown).toContain('Alpha beta gamma delta.');
  });
});

describe('Anchor round-trip', () => {
  it('should preserve prefix and suffix through serialize → parse', () => {
    const md = 'Before target after content.\n';
    const comment = makeComment({
      selectedText: 'target',
      anchorPrefix: 'Before ',
      anchorSuffix: ' after',
    });
    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    expect(parsed.comments[0].anchorPrefix).toBe('Before ');
    expect(parsed.comments[0].anchorSuffix).toBe(' after');
  });

  it('should handle missing prefix and suffix', () => {
    const md = 'Target content.\n';
    const comment = makeComment({ selectedText: 'Target' });
    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    expect(parsed.comments[0].anchorPrefix).toBeUndefined();
    expect(parsed.comments[0].anchorSuffix).toBeUndefined();
  });
});

describe('Thread ID generation', () => {
  it('should generate sequential reply IDs', () => {
    let md = 'Some text in the document.\n';
    const comment = makeComment({ selectedText: 'text' });
    md = addComment(md, comment);

    const r1 = { author: 'bob', body: 'Reply 1', date: '2026-03-04T10:00:00Z' };
    const result1 = addReply(md, 'comment-1', r1);
    expect(result1.replyId).toBe('reply-1');

    const r2 = { author: 'carol', body: 'Reply 2', date: '2026-03-04T11:00:00Z' };
    const result2 = addReply(result1.markdown, 'comment-1', r2);
    expect(result2.replyId).toBe('reply-2');

    const r3 = { author: 'dave', body: 'Reply 3', date: '2026-03-04T12:00:00Z' };
    const result3 = addReply(result2.markdown, 'comment-1', r3);
    expect(result3.replyId).toBe('reply-3');

    // Verify all replies are present
    const parsed = parseAnnotations(result3.markdown);
    expect(parsed.comments[0].replies).toHaveLength(3);
    expect(parsed.comments[0].replies![0].id).toBe('reply-1');
    expect(parsed.comments[0].replies![1].id).toBe('reply-2');
    expect(parsed.comments[0].replies![2].id).toBe('reply-3');
  });
});

describe('Reaction toggle', () => {
  it('should add and remove reactions', () => {
    let md = 'Some text in the document.\n';
    const comment = makeComment({ selectedText: 'text' });
    md = addComment(md, comment);

    // Add reaction
    md = toggleReaction(md, 'comment-1', '\u{1F44D}', 'bob');
    let parsed = parseAnnotations(md);
    expect(parsed.comments[0].reactions).toEqual({ '\u{1F44D}': ['bob'] });

    // Add another author
    md = toggleReaction(md, 'comment-1', '\u{1F44D}', 'carol');
    parsed = parseAnnotations(md);
    expect(parsed.comments[0].reactions!['\u{1F44D}']).toEqual(['bob', 'carol']);

    // Remove first author
    md = toggleReaction(md, 'comment-1', '\u{1F44D}', 'bob');
    parsed = parseAnnotations(md);
    expect(parsed.comments[0].reactions!['\u{1F44D}']).toEqual(['carol']);

    // Remove last author — reaction should be gone
    md = toggleReaction(md, 'comment-1', '\u{1F44D}', 'carol');
    parsed = parseAnnotations(md);
    expect(parsed.comments[0].reactions).toBeUndefined();
  });
});

describe('Large document', () => {
  it('should handle 20+ annotations correctly', () => {
    let md = '';
    for (let i = 1; i <= 25; i++) {
      md += `Paragraph ${i} with unique-word-${i} content.\n\n`;
    }

    // Add 25 comments
    for (let i = 1; i <= 25; i++) {
      const comment = makeComment({
        id: `comment-${i}`,
        selectedText: `unique-word-${i}`,
        body: `Comment ${i}`,
        author: i % 2 === 0 ? 'alice' : 'bob',
        date: `2026-03-${String(i).padStart(2, '0')}T10:00:00Z`,
      });
      md = addComment(md, comment);
    }

    const parsed = parseAnnotations(md);
    expect(parsed.comments).toHaveLength(25);

    // Verify all comments are correctly anchored
    for (let i = 1; i <= 25; i++) {
      const c = parsed.comments.find((c) => c.id === `comment-${i}`);
      expect(c).toBeDefined();
      expect(c!.selectedText).toBe(`unique-word-${i}`);
      expect(c!.body).toBe(`Comment ${i}`);
    }

    // Cleaned markdown should not contain any markers
    expect(parsed.cleanedMarkdown).not.toMatch(/\[@\d+\]/);

    // Verify next ID
    const nextId = generateNextCommentId(md);
    expect(nextId).toBe('comment-26');
  });
});

describe('Cleaned markdown output', () => {
  it('should produce clean markdown without markers or annotation block', () => {
    const md = 'Hello world, this is a test document.\n';
    const comment = makeComment({ selectedText: 'world' });
    const serialized = addComment(md, comment);
    const parsed = parseAnnotations(serialized);

    expect(parsed.cleanedMarkdown).toBe('Hello world, this is a test document.');
    expect(parsed.cleanedMarkdown).not.toContain('[@');
    expect(parsed.cleanedMarkdown).not.toContain('mdview:annotations');
  });
});
