/**
 * Unit tests for CommentManager
 *
 * Tests the CRUD orchestrator that connects parser, serializer, UI,
 * highlights, and native host messaging.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentManager } from '../../../src/comments/comment-manager';
import type { Comment, CommentParseResult, AppState } from '../../../src/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../src/comments/comment-parser', () => ({
  parseComments: vi.fn(),
}));

vi.mock('../../../src/comments/comment-serializer', () => ({
  generateNextCommentId: vi.fn(),
  addComment: vi.fn(),
  removeComment: vi.fn(),
  updateComment: vi.fn(),
  resolveComment: vi.fn(),
}));

vi.mock('../../../src/comments/comment-ui', () => ({
  CommentUI: vi.fn().mockImplementation(() => ({
    createGutter: vi.fn(() => document.createElement('div')),
    renderCard: vi.fn(() => document.createElement('div')),
    renderInputForm: vi.fn(() => document.createElement('div')),
    showToast: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('../../../src/comments/comment-highlight', () => ({
  CommentHighlighter: vi.fn().mockImplementation(() => ({
    highlightComment: vi.fn(() => document.createElement('span')),
    removeHighlight: vi.fn(),
    setActive: vi.fn(),
    clearActive: vi.fn(),
    setResolved: vi.fn(),
    getHighlightElement: vi.fn(),
  })),
}));

import { parseComments } from '../../../src/comments/comment-parser';
import {
  generateNextCommentId,
  addComment as serializerAddComment,
  removeComment as serializerRemoveComment,
  updateComment as serializerUpdateComment,
  resolveComment as serializerResolveComment,
} from '../../../src/comments/comment-serializer';

const mockParseComments = vi.mocked(parseComments);
const mockGenerateNextId = vi.mocked(generateNextCommentId);
const mockSerializerAdd = vi.mocked(serializerAddComment);
const mockSerializerRemove = vi.mocked(serializerRemoveComment);
const mockSerializerUpdate = vi.mocked(serializerUpdateComment);
const mockSerializerResolve = vi.mocked(serializerResolveComment);

// ── Fixtures ───────────────────────────────────────────────────────────────

const sampleComment: Comment = {
  id: 'comment-1',
  selectedText: 'hello world',
  body: 'This needs review',
  author: 'tester',
  date: '2026-03-03T10:00:00Z',
  resolved: false,
};

const sampleParseResult: CommentParseResult = {
  cleanedMarkdown: '# Title\n\nhello world\n',
  comments: [sampleComment],
};

const sampleMarkdown =
  '# Title\n\nhello world[^comment-1]\n\n<!-- mdview:comments -->\n[^comment-1]: <!-- mdview:comment {"author":"tester","date":"2026-03-03T10:00:00Z"} -->\n    This needs review\n';

const defaultPreferences: AppState['preferences'] = {
  theme: 'github-light',
  autoTheme: false,
  lightTheme: 'github-light',
  darkTheme: 'github-dark',
  syntaxTheme: 'github',
  autoReload: false,
  lineNumbers: true,
  enableHtml: false,
  syncTabs: false,
  logLevel: 'none',
  commentsEnabled: true,
  commentAuthor: 'Test Author',
};

// ── Setup ──────────────────────────────────────────────────────────────────

describe('CommentManager', () => {
  let manager: CommentManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure sendNativeMessage is mocked on chrome.runtime
    (chrome.runtime as Record<string, unknown>).sendNativeMessage = vi
      .fn()
      .mockResolvedValue({ success: true });

    // Default mock return values
    mockParseComments.mockReturnValue(sampleParseResult);
    mockGenerateNextId.mockReturnValue('comment-2');
    mockSerializerAdd.mockReturnValue('updated markdown after add');
    mockSerializerRemove.mockReturnValue('updated markdown after remove');
    mockSerializerUpdate.mockReturnValue('updated markdown after update');
    mockSerializerResolve.mockReturnValue('updated markdown after resolve');

    manager = new CommentManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  // ── initialize() ────────────────────────────────────────────────────────

  describe('initialize()', () => {
    test('parses existing comments and returns CommentParseResult', async () => {
      const result = await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );

      expect(mockParseComments).toHaveBeenCalledWith(sampleMarkdown);
      expect(result).toEqual(sampleParseResult);
    });

    test('stores author from preferences', async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );

      // Verify the stored author is used when adding a new comment
      await manager.addComment('some text', 'new comment body');

      // The comment passed to the serializer should have the author from preferences
      const addCall = mockSerializerAdd.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.author).toBe('Test Author');
    });
  });

  // ── addComment() ────────────────────────────────────────────────────────

  describe('addComment()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('generates next ID and serializes into markdown', async () => {
      await manager.addComment('some text', 'A comment');

      expect(mockGenerateNextId).toHaveBeenCalled();
      expect(mockSerializerAdd).toHaveBeenCalled();

      const addCall = mockSerializerAdd.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.id).toBe('comment-2');
      expect(commentArg.selectedText).toBe('some text');
      expect(commentArg.body).toBe('A comment');
      expect(commentArg.resolved).toBe(false);
    });

    test('calls writeFile with updated markdown', async () => {
      await manager.addComment('some text', 'A comment');

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalledWith(
        'com.mdview.filewriter',
        {
          action: 'write',
          path: '/path/to/file.md',
          content: 'updated markdown after add',
        }
      );
    });

    test('adds comment to internal list', async () => {
      await manager.addComment('some text', 'A comment');

      const comments = manager.getComments();
      // Original comment from parse + newly added one
      expect(comments).toHaveLength(2);
      expect(comments[1].id).toBe('comment-2');
      expect(comments[1].body).toBe('A comment');
    });
  });

  // ── editComment() ──────────────────────────────────────────────────────

  describe('editComment()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('updates body in serialized markdown and writes', async () => {
      await manager.editComment('comment-1', 'Updated body');

      expect(mockSerializerUpdate).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1',
        'Updated body'
      );

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalledWith(
        'com.mdview.filewriter',
        {
          action: 'write',
          path: '/path/to/file.md',
          content: 'updated markdown after update',
        }
      );

      // Internal state should be updated
      const comments = manager.getComments();
      const edited = comments.find((c) => c.id === 'comment-1');
      expect(edited?.body).toBe('Updated body');
    });
  });

  // ── resolveComment() ──────────────────────────────────────────────────

  describe('resolveComment()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('sets resolved flag and writes', async () => {
      await manager.resolveComment('comment-1');

      expect(mockSerializerResolve).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1'
      );

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalledWith(
        'com.mdview.filewriter',
        {
          action: 'write',
          path: '/path/to/file.md',
          content: 'updated markdown after resolve',
        }
      );

      // Internal state should be updated
      const comments = manager.getComments();
      const resolved = comments.find((c) => c.id === 'comment-1');
      expect(resolved?.resolved).toBe(true);
    });
  });

  // ── deleteComment() ────────────────────────────────────────────────────

  describe('deleteComment()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('removes comment and writes', async () => {
      await manager.deleteComment('comment-1');

      expect(mockSerializerRemove).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1'
      );

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalledWith(
        'com.mdview.filewriter',
        {
          action: 'write',
          path: '/path/to/file.md',
          content: 'updated markdown after remove',
        }
      );

      // Internal state should have the comment removed
      const comments = manager.getComments();
      expect(comments.find((c) => c.id === 'comment-1')).toBeUndefined();
    });
  });

  // ── isWriteInProgress() ────────────────────────────────────────────────

  describe('isWriteInProgress()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('returns true during writes and stays true during grace period', async () => {
      vi.useFakeTimers();

      // Initially false
      expect(manager.isWriteInProgress()).toBe(false);

      // Create a promise that we can control
      let resolveNativeMessage!: (value: unknown) => void;
      const nativeMessagePromise = new Promise((resolve) => {
        resolveNativeMessage = resolve;
      });

      (chrome.runtime.sendNativeMessage as ReturnType<typeof vi.fn>).mockReturnValue(
        nativeMessagePromise
      );

      // Start the write but don't await it yet
      const writePromise = manager.addComment('text', 'body');

      // Should be true while write is in progress
      expect(manager.isWriteInProgress()).toBe(true);

      // Resolve the native message
      resolveNativeMessage({ success: true });
      await writePromise;

      // Should still be true during the grace period
      expect(manager.isWriteInProgress()).toBe(true);

      // Advance past the grace period (1000ms)
      vi.advanceTimersByTime(1000);

      // Now should be false
      expect(manager.isWriteInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  // ── getComments() ──────────────────────────────────────────────────────

  describe('getComments()', () => {
    test('returns a copy of comments array', async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );

      const comments1 = manager.getComments();
      const comments2 = manager.getComments();

      // Should return equal contents
      expect(comments1).toEqual(comments2);

      // But should be different array instances (copy, not reference)
      expect(comments1).not.toBe(comments2);
    });
  });

  // ── destroy() ──────────────────────────────────────────────────────────

  describe('destroy()', () => {
    test('cleans up UI', async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );

      // Import the mock to verify destroy was called
      const { CommentUI } = await import(
        '../../../src/comments/comment-ui'
      );
      const mockInstance = vi.mocked(CommentUI).mock.results[0]
        .value as { destroy: ReturnType<typeof vi.fn> };

      manager.destroy();

      expect(mockInstance.destroy).toHaveBeenCalled();
    });
  });
});
