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
  addCommentAtOffset,
  removeComment,
  updateComment,
  resolveComment,
  updateCommentMetadata,
  addReply,
  toggleReaction,
} from '../../../src/comments/comment-serializer';
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
      '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","selectedText":"highlighted text"} -->'
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

describe('addCommentAtOffset', () => {
  it('should insert reference after bold text using source map', () => {
    const md = 'This is **important** for the review.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'important' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('**important**[^comment-1]');
    expect(result).toContain('[^comment-1]: <!-- mdview:comment');
  });

  it('should insert reference after link using source map', () => {
    const md = 'Click [the link](https://example.com) to continue.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'the link' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('[the link](https://example.com)[^comment-1]');
  });

  it('should fall back to text search when source map fails', () => {
    const md = 'Some text here.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'nonexistent' });
    const result = addCommentAtOffset(md, comment, sourceMap);

    // Falls back to addComment, which can't find it either, so no reference
    expect(result).toContain('Some text here.');
    expect(result).toContain('[^comment-1]: <!-- mdview:comment');
  });

  it('should disambiguate with context', () => {
    const md = 'The word test and another test here.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment({ selectedText: 'test' });
    const result = addCommentAtOffset(md, comment, sourceMap, {
      prefix: 'another ',
      suffix: ' here',
    });

    // Should annotate the second "test"
    expect(result).toContain('another test[^comment-1] here');
  });

  it('should include selectedText in footnote metadata', () => {
    const md = 'Some highlighted text in context.\n';
    const sourceMap = buildSourceMap(md);
    const comment = makeComment();
    const result = addCommentAtOffset(md, comment, sourceMap);

    expect(result).toContain('"selectedText":"highlighted text"');
  });
});

describe('addComment metadata', () => {
  it('should include selectedText in footnote metadata', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).toContain('"selectedText":"highlighted text"');
  });

  it('should not include selectedText when it is empty', () => {
    const md = 'Some text.\n';
    const comment = makeComment({ selectedText: '' });
    const result = addComment(md, comment);

    expect(result).not.toContain('"selectedText"');
  });
});

describe('comment context in metadata', () => {
  it('should include context fields when comment has context', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ context: sampleContext });
    const result = addComment(md, comment);

    expect(result).toContain('"line":5');
    expect(result).toContain('"section":"Installation"');
    expect(result).toContain('"sectionLevel":2');
    expect(result).toContain('"breadcrumb":["Getting Started","Installation"]');
  });

  it('should omit context fields when comment has no context', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"line"');
    expect(result).not.toContain('"section"');
    expect(result).not.toContain('"sectionLevel"');
    expect(result).not.toContain('"breadcrumb"');
  });

  it('should omit section/sectionLevel when context has no heading', () => {
    const md = 'Some highlighted text in context.\n';
    const noHeadingContext: CommentContext = {
      line: 1,
      breadcrumb: [],
    };
    const comment = makeComment({ context: noHeadingContext });
    const result = addComment(md, comment);

    expect(result).toContain('"line":1');
    expect(result).not.toContain('"section"');
    expect(result).not.toContain('"sectionLevel"');
    expect(result).not.toContain('"breadcrumb"');
  });

  it('should preserve context fields through resolveComment', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","selectedText":"highlighted text","line":5,"section":"Installation","sectionLevel":2,"breadcrumb":["Getting Started","Installation"]} -->`,
      '    This is a comment',
    ].join('\n');

    const result = resolveComment(md, 'comment-1');

    // Context fields should survive resolution
    expect(result).toContain('"resolved":true');
    expect(result).toContain('"line":5');
    expect(result).toContain('"section":"Installation"');
    expect(result).toContain('"sectionLevel":2');
    expect(result).toContain('"breadcrumb":["Getting Started","Installation"]');
  });

  it('should handle metadata with array fields (regex safety)', () => {
    // This tests that the serializer regex can handle breadcrumb arrays
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","breadcrumb":["A","B","C"]} -->`,
      '    A comment',
    ].join('\n');

    // resolveComment parses then re-serializes — tests the regex
    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved":true');
    expect(result).toContain('"breadcrumb":["A","B","C"]');
  });
});

describe('tags in metadata', () => {
  it('should include tags array when comment has tags', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ tags: ['blocking', 'suggestion'] });
    const result = addComment(md, comment);

    expect(result).toContain('"tags":["blocking","suggestion"]');
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

  it('should preserve tags through resolveComment', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","tags":["blocking","nit"]} -->`,
      '    A comment',
    ].join('\n');

    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved":true');
    expect(result).toContain('"tags":["blocking","nit"]');
  });

  it('should include tags alongside other metadata fields', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({
      context: sampleContext,
      tags: ['question'],
    });
    const result = addComment(md, comment);

    expect(result).toContain('"tags":["question"]');
    expect(result).toContain('"line":5');
    expect(result).toContain('"section":"Installation"');
  });
});

describe('replies and reactions in metadata', () => {
  it('should include replies in metadata JSON when comment has replies', () => {
    const md = 'Some highlighted text in context.\n';
    const replies: CommentReply[] = [
      { id: 'reply-1', author: 'bob', body: 'Good catch', date: '2026-03-04T10:00:00Z' },
    ];
    const comment = makeComment({ replies });
    const result = addComment(md, comment);

    expect(result).toContain('"replies":[{"id":"reply-1","author":"bob","body":"Good catch","date":"2026-03-04T10:00:00Z"}]');
  });

  it('should omit replies when empty array', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ replies: [] });
    const result = addComment(md, comment);

    expect(result).not.toContain('"replies"');
  });

  it('should omit replies when undefined', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment();
    const result = addComment(md, comment);

    expect(result).not.toContain('"replies"');
  });

  it('should include reactions in metadata JSON', () => {
    const md = 'Some highlighted text in context.\n';
    const comment = makeComment({ reactions: { '\u{1F44D}': ['bob', 'carol'] } });
    const result = addComment(md, comment);

    expect(result).toContain('"reactions"');
    expect(result).toContain('"bob"');
    expect(result).toContain('"carol"');
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

  it('should preserve replies and reactions through resolveComment', () => {
    const md = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","replies":[{"id":"reply-1","author":"bob","body":"Nice","date":"2026-03-04T10:00:00Z"}],"reactions":{"\u{1F44D}":["bob"]}} -->`,
      '    A comment',
    ].join('\n');

    const result = resolveComment(md, 'comment-1');

    expect(result).toContain('"resolved":true');
    expect(result).toContain('"replies":[');
    expect(result).toContain('"reactions":{');
  });
});

describe('updateCommentMetadata', () => {
  const mdWithComment = [
    'Some highlighted text[^comment-1] in context.',
    '',
    '<!-- mdview:comments -->',
    '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
    '    This is a comment',
  ].join('\n');

  it('should call updater with parsed metadata and rebuild header', () => {
    const result = updateCommentMetadata(mdWithComment, 'comment-1', (meta) => {
      meta.resolved = true;
    });

    expect(result).toContain('"resolved":true');
    expect(result).toContain('    This is a comment');
  });

  it('should preserve body and other comments', () => {
    const md = [
      'A[^comment-1] and B[^comment-2] here.',
      '',
      '<!-- mdview:comments -->',
      '[^comment-1]: <!-- mdview:comment {"author":"alice","date":"2026-03-03T14:30:00Z"} -->',
      '    First comment',
      '',
      '[^comment-2]: <!-- mdview:comment {"author":"bob","date":"2026-03-03T15:00:00Z"} -->',
      '    Second comment',
    ].join('\n');

    const result = updateCommentMetadata(md, 'comment-1', (meta) => {
      meta.resolved = true;
    });

    expect(result).toContain('    First comment');
    expect(result).toContain('    Second comment');
    // Only comment-1 should have resolved
    expect(result).toMatch(/\[\^comment-1\]:.*"resolved":true/);
    const comment2Line = result.split('\n').find((l) => l.includes('[^comment-2]:'));
    expect(comment2Line).not.toContain('"resolved"');
  });

  it('should return unchanged markdown when comment not found', () => {
    const result = updateCommentMetadata(mdWithComment, 'comment-999', (meta) => {
      meta.resolved = true;
    });

    expect(result).toBe(mdWithComment);
  });

  it('should return unchanged markdown when no comments section', () => {
    const md = 'No comments here.';
    const result = updateCommentMetadata(md, 'comment-1', (meta) => {
      meta.resolved = true;
    });

    expect(result).toBe(md);
  });
});

describe('addReply', () => {
  const mdWithComment = [
    'Some highlighted text[^comment-1] in context.',
    '',
    '<!-- mdview:comments -->',
    '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
    '    This is a comment',
  ].join('\n');

  it('should add a reply to comment metadata', () => {
    const reply: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'Good catch',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown, replyId } = addReply(mdWithComment, 'comment-1', reply);

    expect(replyId).toBe('reply-1');
    expect(markdown).toContain('"replies":[{"id":"reply-1","author":"bob","body":"Good catch","date":"2026-03-04T10:00:00Z"}]');
  });

  it('should generate sequential reply IDs', () => {
    const reply1: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'First reply',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown: md1 } = addReply(mdWithComment, 'comment-1', reply1);

    const reply2: Omit<CommentReply, 'id'> = {
      author: 'carol',
      body: 'Second reply',
      date: '2026-03-04T11:00:00Z',
    };
    const { markdown: md2, replyId } = addReply(md1, 'comment-1', reply2);

    expect(replyId).toBe('reply-2');
    expect(md2).toContain('"id":"reply-1"');
    expect(md2).toContain('"id":"reply-2"');
  });

  it('should preserve comment body and other metadata', () => {
    const reply: Omit<CommentReply, 'id'> = {
      author: 'bob',
      body: 'Reply',
      date: '2026-03-04T10:00:00Z',
    };
    const { markdown } = addReply(mdWithComment, 'comment-1', reply);

    expect(markdown).toContain('    This is a comment');
    expect(markdown).toContain('"author":"reviewer"');
    expect(markdown).toContain('"date":"2026-03-03T14:30:00Z"');
  });
});

describe('toggleReaction', () => {
  const mdWithComment = [
    'Some highlighted text[^comment-1] in context.',
    '',
    '<!-- mdview:comments -->',
    '[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z"} -->',
    '    This is a comment',
  ].join('\n');

  it('should add a reaction when none exist', () => {
    const result = toggleReaction(mdWithComment, 'comment-1', '\u{1F44D}', 'bob');

    expect(result).toContain('"reactions"');
    expect(result).toContain('"bob"');
  });

  it('should add author to existing emoji reaction', () => {
    const mdWithReaction = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","reactions":{"\u{1F44D}":["alice"]}} -->`,
      '    This is a comment',
    ].join('\n');

    const result = toggleReaction(mdWithReaction, 'comment-1', '\u{1F44D}', 'bob');

    expect(result).toContain('"alice"');
    expect(result).toContain('"bob"');
  });

  it('should remove author when toggling off existing reaction', () => {
    const mdWithReaction = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","reactions":{"\u{1F44D}":["bob","alice"]}} -->`,
      '    This is a comment',
    ].join('\n');

    const result = toggleReaction(mdWithReaction, 'comment-1', '\u{1F44D}', 'bob');

    expect(result).not.toContain('"bob"');
    expect(result).toContain('"alice"');
  });

  it('should remove emoji key when last author is toggled off', () => {
    const mdWithReaction = [
      'Some highlighted text[^comment-1] in context.',
      '',
      '<!-- mdview:comments -->',
      `[^comment-1]: <!-- mdview:comment {"author":"reviewer","date":"2026-03-03T14:30:00Z","reactions":{"\u{1F44D}":["bob"]}} -->`,
      '    This is a comment',
    ].join('\n');

    const result = toggleReaction(mdWithReaction, 'comment-1', '\u{1F44D}', 'bob');

    // Reactions should be removed entirely when empty
    expect(result).not.toContain('"reactions"');
  });

  it('should preserve comment body', () => {
    const result = toggleReaction(mdWithComment, 'comment-1', '\u{1F44D}', 'bob');

    expect(result).toContain('    This is a comment');
  });
});
