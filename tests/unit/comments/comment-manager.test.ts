/**
 * Unit tests for CommentManager
 *
 * Tests the CRUD orchestrator that connects parser, serializer, UI,
 * highlights, and native host messaging.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentManager } from '../../../src/comments/comment-manager';
import type { Comment, CommentParseResult, AppState, CommentTag } from '../../../src/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../src/comments/annotation-parser', () => ({
  parseComments: vi.fn(),
}));

vi.mock('../../../src/comments/annotation-serializer', () => ({
  generateNextCommentId: vi.fn(),
  addComment: vi.fn(),
  addCommentAtOffset: vi.fn(),
  removeComment: vi.fn(),
  updateComment: vi.fn(),
  updateCommentMetadata: vi.fn(),
  resolveComment: vi.fn(),
  addReply: vi.fn(),
  toggleReaction: vi.fn(),
}));

vi.mock('../../../src/comments/source-position-map', () => ({
  buildSourceMap: vi.fn(() => ({
    rawSource: '',
    plainText: '',
    offsets: [],
    spans: [],
  })),
  findInsertionPoint: vi.fn(() => 10),
}));

vi.mock('../../../src/comments/comment-context', () => ({
  computeCommentContext: vi.fn(() => ({
    line: 3,
    section: 'Title',
    sectionLevel: 1,
    breadcrumb: ['Title'],
  })),
}));

vi.mock('../../../src/comments/comment-ui', () => ({
  CommentUI: vi.fn().mockImplementation(() => ({
    createGutter: vi.fn(() => document.createElement('div')),
    renderCard: vi.fn(() => document.createElement('div')),
    renderInputForm: vi.fn(() => document.createElement('div')),
    renderReplyForm: vi.fn(() => document.createElement('div')),
    renderEmojiPicker: vi.fn(() => document.createElement('div')),
    setCurrentAuthor: vi.fn(),
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

import { parseComments } from '../../../src/comments/annotation-parser';
import {
  generateNextCommentId,
  addComment as serializerAddComment,
  addCommentAtOffset as serializerAddCommentAtOffset,
  removeComment as serializerRemoveComment,
  updateComment as serializerUpdateComment,
  updateCommentMetadata as serializerUpdateCommentMetadata,
  resolveComment as serializerResolveComment,
  addReply as serializerAddReply,
  toggleReaction as serializerToggleReaction,
} from '../../../src/comments/annotation-serializer';
import { computeCommentContext } from '../../../src/comments/comment-context';
import { findInsertionPoint } from '../../../src/comments/source-position-map';

const mockParseComments = vi.mocked(parseComments);
const mockGenerateNextId = vi.mocked(generateNextCommentId);
const mockSerializerAdd = vi.mocked(serializerAddComment);
const mockSerializerAddAtOffset = vi.mocked(serializerAddCommentAtOffset);
const mockSerializerRemove = vi.mocked(serializerRemoveComment);
const mockSerializerUpdate = vi.mocked(serializerUpdateComment);
const mockSerializerUpdateMetadata = vi.mocked(serializerUpdateCommentMetadata);
const mockSerializerResolve = vi.mocked(serializerResolveComment);
const mockSerializerAddReply = vi.mocked(serializerAddReply);
const mockSerializerToggleReaction = vi.mocked(serializerToggleReaction);
const mockComputeContext = vi.mocked(computeCommentContext);
const mockFindInsertionPoint = vi.mocked(findInsertionPoint);

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

    // writeFile relays through service worker via sendMessage
    (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });

    // Reset mutable state on shared fixture
    delete (sampleComment as any).replies;
    delete (sampleComment as any).reactions;

    // Default mock return values
    mockParseComments.mockReturnValue(sampleParseResult);
    mockGenerateNextId.mockReturnValue('comment-2');
    mockSerializerAdd.mockReturnValue('updated markdown after add');
    mockSerializerAddAtOffset.mockReturnValue('updated markdown after add');
    mockSerializerRemove.mockReturnValue('updated markdown after remove');
    mockSerializerUpdate.mockReturnValue('updated markdown after update');
    mockSerializerUpdateMetadata.mockImplementation((md) => md + ' with metadata');
    mockSerializerResolve.mockReturnValue('updated markdown after resolve');
    mockSerializerAddReply.mockReturnValue({ markdown: 'updated markdown after reply', replyId: 'reply-1' });
    mockSerializerToggleReaction.mockReturnValue('updated markdown after reaction');

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
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.author).toBe('Test Author');
    });

    test('queries system username when commentAuthor is empty', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>)
        .mockImplementation((msg: { type: string }) => {
          if (msg.type === 'GET_USERNAME') {
            return Promise.resolve({ username: 'systemuser' });
          }
          return Promise.resolve({ success: true });
        });

      const prefsWithNoAuthor = { ...defaultPreferences, commentAuthor: '' };
      await manager.initialize(sampleMarkdown, '/path/to/file.md', prefsWithNoAuthor);

      // Verify GET_USERNAME was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_USERNAME' });

      // Add a comment and verify the system username is used
      await manager.addComment('some text', 'body');
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.author).toBe('systemuser');
    });

    test('uses empty author if GET_USERNAME fails', async () => {
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>)
        .mockImplementation((msg: { type: string }) => {
          if (msg.type === 'GET_USERNAME') {
            return Promise.reject(new Error('native host not installed'));
          }
          return Promise.resolve({ success: true });
        });

      const prefsWithNoAuthor = { ...defaultPreferences, commentAuthor: '' };
      await manager.initialize(sampleMarkdown, '/path/to/file.md', prefsWithNoAuthor);

      // Should not throw, just leave author empty
      await manager.addComment('some text', 'body');
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.author).toBe('');
    });

    test('does not query username when commentAuthor is set', async () => {
      await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // Should NOT have sent GET_USERNAME
      const calls = (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
      const usernameCall = calls.find(
        (c: unknown[]) => (c[0] as { type: string })?.type === 'GET_USERNAME'
      );
      expect(usernameCall).toBeUndefined();
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
      expect(mockSerializerAddAtOffset).toHaveBeenCalled();

      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.id).toBe('comment-2');
      expect(commentArg.selectedText).toBe('some text');
      expect(commentArg.body).toBe('A comment');
      expect(commentArg.resolved).toBe(false);
    });

    test('calls writeFile with updated markdown', async () => {
      await manager.addComment('some text', 'A comment');

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after add',
        },
      });
    });

    test('adds comment to internal list', async () => {
      await manager.addComment('some text', 'A comment');

      const comments = manager.getComments();
      // Original comment from parse + newly added one
      expect(comments).toHaveLength(2);
      expect(comments[1].id).toBe('comment-2');
      expect(comments[1].body).toBe('A comment');
    });

    test('computes positional context and attaches it to the comment', async () => {
      await manager.addComment('some text', 'A comment');

      // computeCommentContext should have been called
      expect(mockComputeContext).toHaveBeenCalled();

      // The comment passed to the serializer should have context
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.context).toBeDefined();
      expect(commentArg.context!.line).toBe(3);
      expect(commentArg.context!.section).toBe('Title');
      expect(commentArg.context!.breadcrumb).toEqual(['Title']);
    });

    test('uses findInsertionPoint offset for context computation', async () => {
      mockFindInsertionPoint.mockReturnValue(42);

      await manager.addComment('some text', 'A comment');

      // computeCommentContext should receive the offset from findInsertionPoint
      const contextCall = mockComputeContext.mock.calls[0];
      expect(contextCall[1]).toBe(42);
    });

    test('falls back to indexOf when source map returns null offset', async () => {
      mockFindInsertionPoint.mockReturnValue(null);

      // Use text that exists in sampleMarkdown's content section
      await manager.addComment('hello world', 'A comment');

      // Should still compute context via indexOf fallback
      expect(mockComputeContext).toHaveBeenCalled();
    });

    test('passes tags to the serialized comment', async () => {
      const tags: CommentTag[] = ['blocking', 'suggestion'];
      await manager.addComment('some text', 'A comment', tags);

      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.tags).toEqual(['blocking', 'suggestion']);
    });

    test('omits tags when not provided', async () => {
      await manager.addComment('some text', 'A comment');

      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.tags).toBeUndefined();
    });

    test('skips context when both source map and indexOf fail', async () => {
      mockFindInsertionPoint.mockReturnValue(null);

      // Use text that does NOT exist in the markdown
      await manager.addComment('nonexistent text', 'A comment');

      // Context should not be computed
      expect(mockComputeContext).not.toHaveBeenCalled();

      // Comment should still be created, just without context
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.context).toBeUndefined();
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

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after update',
        },
      });

      // Internal state should be updated
      const comments = manager.getComments();
      const edited = comments.find((c) => c.id === 'comment-1');
      expect(edited?.body).toBe('Updated body');
    });
  });

  describe('editComment() with tags', () => {
    beforeEach(async () => {
      // Initialize with a comment that has tags
      const taggedComment: Comment = {
        ...sampleComment,
        tags: ['blocking'],
      };
      mockParseComments.mockReturnValue({
        cleanedMarkdown: '# Title\n\nhello world\n',
        comments: [taggedComment],
      });
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('updates tags on existing comment in memory', async () => {
      await manager.editComment('comment-1', 'Updated body', ['nit', 'suggestion']);

      const comments = manager.getComments();
      const edited = comments.find((c) => c.id === 'comment-1');
      expect(edited?.tags).toEqual(['nit', 'suggestion']);
    });

    test('persists tags to file via updateCommentMetadata', async () => {
      await manager.editComment('comment-1', 'Updated body', ['nit', 'suggestion']);

      // updateCommentMetadata should be called to persist tags
      expect(mockSerializerUpdateMetadata).toHaveBeenCalledWith(
        'updated markdown after update',
        'comment-1',
        expect.any(Function)
      );
    });

    test('does not call updateCommentMetadata when tags are unchanged', async () => {
      // Edit body only, pass same tags
      await manager.editComment('comment-1', 'Updated body', ['blocking']);

      expect(mockSerializerUpdateMetadata).not.toHaveBeenCalled();
    });

    test('clears tags when empty array passed', async () => {
      await manager.editComment('comment-1', 'Updated body', []);

      const comments = manager.getComments();
      const edited = comments.find((c) => c.id === 'comment-1');
      expect(edited?.tags).toBeUndefined();

      // Should still persist the cleared tags
      expect(mockSerializerUpdateMetadata).toHaveBeenCalled();
    });

    test('does not call updateCommentMetadata when tags not provided', async () => {
      await manager.editComment('comment-1', 'Updated body');

      expect(mockSerializerUpdateMetadata).not.toHaveBeenCalled();
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

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after resolve',
        },
      });

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

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after remove',
        },
      });

      // Internal state should have the comment removed
      const comments = manager.getComments();
      expect(comments.find((c) => c.id === 'comment-1')).toBeUndefined();
    });
  });

  // ── handleAddCommentRequest() ──────────────────────────────────────────

  describe('handleAddCommentRequest()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('shows input form and adds comment on save', async () => {
      // Import the mock UI to check renderInputForm was called
      const { CommentUI } = await import('../../../src/comments/comment-ui');
      const mockUIInstance = vi.mocked(CommentUI).mock.results[0].value as {
        renderInputForm: ReturnType<typeof vi.fn>;
        renderCard: ReturnType<typeof vi.fn>;
        showToast: ReturnType<typeof vi.fn>;
      };

      // Set up renderInputForm to call onSave immediately
      mockUIInstance.renderInputForm.mockImplementation(
        (onSave: (body: string, tags: CommentTag[]) => void) => {
          const form = document.createElement('div');
          // Simulate user typing and saving
          setTimeout(() => onSave('My comment', ['blocking']), 0);
          return form;
        }
      );

      manager.handleAddCommentRequest('selected text');

      // Wait for the async onSave callback
      await new Promise((r) => setTimeout(r, 10));

      expect(mockUIInstance.renderInputForm).toHaveBeenCalled();
      expect(mockSerializerAddAtOffset).toHaveBeenCalled();

      // Verify tags were passed through
      const addCall = mockSerializerAddAtOffset.mock.calls[0];
      const commentArg = addCall[1] as Comment;
      expect(commentArg.tags).toEqual(['blocking']);
    });

    test('does not add comment if body is empty on save', async () => {
      const { CommentUI } = await import('../../../src/comments/comment-ui');
      const mockUIInstance = vi.mocked(CommentUI).mock.results[0].value as {
        renderInputForm: ReturnType<typeof vi.fn>;
      };

      mockUIInstance.renderInputForm.mockImplementation(
        (onSave: (body: string, tags: CommentTag[]) => void) => {
          const form = document.createElement('div');
          setTimeout(() => onSave('', []), 0);
          return form;
        }
      );

      manager.handleAddCommentRequest('selected text');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSerializerAddAtOffset).not.toHaveBeenCalled();
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
      let resolveSendMessage!: (value: unknown) => void;
      const sendMessagePromise = new Promise((resolve) => {
        resolveSendMessage = resolve;
      });

      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockReturnValue(
        sendMessagePromise
      );

      // Start the write but don't await it yet
      const writePromise = manager.addComment('text', 'body');

      // Should be true while write is in progress
      expect(manager.isWriteInProgress()).toBe(true);

      // Resolve the send message
      resolveSendMessage({ success: true });
      await writePromise;

      // Should still be true during the grace period
      expect(manager.isWriteInProgress()).toBe(true);

      // Advance past the grace period (2000ms)
      vi.advanceTimersByTime(2000);

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

  // ── repositionAllCards() ────────────────────────────────────────────────

  describe('repositionAllCards()', () => {
    test('positions cards based on highlight Y and cascades overlaps', async () => {
      const { CommentHighlighter } = await import(
        '../../../src/comments/comment-highlight'
      );

      // We need fresh initialization to get a highlighter instance
      const mgr = new CommentManager();

      // Set up card rendering to produce real elements with measurable height
      const { CommentUI } = await import('../../../src/comments/comment-ui');

      // Create two comments at similar positions
      const comment1: Comment = {
        id: 'comment-1',
        selectedText: 'text 1',
        body: 'body 1',
        author: 'author',
        date: '2026-03-03T10:00:00Z',
        resolved: false,
      };
      const comment2: Comment = {
        id: 'comment-2',
        selectedText: 'text 2',
        body: 'body 2',
        author: 'author',
        date: '2026-03-03T11:00:00Z',
        resolved: false,
      };

      mockParseComments.mockReturnValue({
        cleanedMarkdown: '# Doc\ntext 1\ntext 2\n',
        comments: [comment1, comment2],
      });

      // Create real DOM elements for highlights at similar Y positions
      const highlight1 = document.createElement('span');
      const highlight2 = document.createElement('span');
      document.body.appendChild(highlight1);
      document.body.appendChild(highlight2);

      // Mock getBoundingClientRect for consistent positioning
      highlight1.getBoundingClientRect = vi.fn(() => ({
        top: 100,
        bottom: 120,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }));

      highlight2.getBoundingClientRect = vi.fn(() => ({
        top: 110, // Close to highlight1 — would overlap
        bottom: 130,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: 110,
        toJSON: () => ({}),
      }));

      // Mock highlighter to return these elements
      const mockHighlighter = vi.mocked(CommentHighlighter);
      mockHighlighter.mockImplementation(
        () =>
          ({
            highlightComment: vi.fn(),
            removeHighlight: vi.fn(),
            setActive: vi.fn(),
            clearActive: vi.fn(),
            setResolved: vi.fn(),
            getHighlightElement: vi.fn((id: string) => {
              if (id === 'comment-1') return highlight1;
              if (id === 'comment-2') return highlight2;
              return null;
            }),
          }) as any
      );

      // Cards will be rendered as real divs but with zero offsetHeight in jsdom
      // We mock offsetHeight via Object.defineProperty on the card elements
      const mockUIImpl = vi.mocked(CommentUI);
      mockUIImpl.mockImplementation(
        () =>
          ({
            createGutter: vi.fn(() => document.createElement('div')),
            renderCard: vi.fn((comment: Comment) => {
              const card = document.createElement('div');
              card.className = 'mdview-comment-card';
              card.dataset.commentId = comment.id;
              // Give cards a height of 40px
              Object.defineProperty(card, 'offsetHeight', { value: 40, configurable: true });
              return card;
            }),
            renderInputForm: vi.fn(() => document.createElement('div')),
            renderReplyForm: vi.fn(() => document.createElement('div')),
            renderEmojiPicker: vi.fn(() => document.createElement('div')),
            setCurrentAuthor: vi.fn(),
            showToast: vi.fn(),
            destroy: vi.fn(),
          }) as any
      );

      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // After initialization, repositionAllCards is called.
      // Get the two cards from the DOM
      const cards = document.querySelectorAll('.mdview-comment-card');
      expect(cards.length).toBe(2);

      const card1 = cards[0] as HTMLElement;
      const card2 = cards[1] as HTMLElement;

      // card1 should be at its highlight position
      const card1Top = parseFloat(card1.style.top);
      expect(card1Top).toBe(100); // highlight1 rect.top + scrollY(0)

      // card2 should be cascaded down: card1Top + card1Height(40) + gap(8)
      const card2Top = parseFloat(card2.style.top);
      expect(card2Top).toBe(148); // 100 + 40 + 8

      mgr.destroy();
      highlight1.remove();
      highlight2.remove();
    });
  });

  // ── addReply() ─────────────────────────────────────────────────────────

  describe('addReply()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('calls serializer addReply with correct args and writes file', async () => {
      await manager.addReply('comment-1', 'Good catch');

      expect(mockSerializerAddReply).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1',
        expect.objectContaining({
          author: 'Test Author',
          body: 'Good catch',
        })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after reply',
        },
      });
    });

    test('updates internal state with the reply', async () => {
      await manager.addReply('comment-1', 'Nice');

      const comments = manager.getComments();
      const comment = comments.find((c) => c.id === 'comment-1');
      expect(comment?.replies).toHaveLength(1);
      expect(comment?.replies![0].id).toBe('reply-1');
      expect(comment?.replies![0].body).toBe('Nice');
      expect(comment?.replies![0].author).toBe('Test Author');
    });
  });

  // ── toggleReaction() ──────────────────────────────────────────────────

  describe('toggleReaction()', () => {
    beforeEach(async () => {
      await manager.initialize(
        sampleMarkdown,
        '/path/to/file.md',
        defaultPreferences
      );
    });

    test('calls serializer toggleReaction and writes file', async () => {
      await manager.toggleReaction('comment-1', '\u{1F44D}');

      expect(mockSerializerToggleReaction).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1',
        '\u{1F44D}',
        'Test Author'
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'WRITE_FILE',
        payload: {
          path: '/path/to/file.md',
          content: 'updated markdown after reaction',
        },
      });
    });

    test('updates internal state with the reaction (toggle on)', async () => {
      await manager.toggleReaction('comment-1', '\u{1F44D}');

      const comments = manager.getComments();
      const comment = comments.find((c) => c.id === 'comment-1');
      expect(comment?.reactions).toBeDefined();
      expect(comment?.reactions!['\u{1F44D}']).toContain('Test Author');
    });

    test('updates internal state with the reaction (toggle off)', async () => {
      // First add the reaction
      const commentWithReaction = {
        ...sampleComment,
        reactions: { '\u{1F44D}': ['Test Author'] },
      };
      mockParseComments.mockReturnValue({
        cleanedMarkdown: '# Title\n\nhello world\n',
        comments: [commentWithReaction],
      });

      const mgr = new CommentManager();
      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      await mgr.toggleReaction('comment-1', '\u{1F44D}');

      const comments = mgr.getComments();
      const comment = comments.find((c) => c.id === 'comment-1');
      // Emoji key should be removed entirely when last author is toggled off
      expect(comment?.reactions?.['\u{1F44D}']).toBeUndefined();

      mgr.destroy();
    });
  });

  // ── event wiring ─────────────────────────────────────────────────────

  describe('event wiring', () => {
    test('handles mdview:comment:reply event', async () => {
      const { CommentUI } = await import('../../../src/comments/comment-ui');

      const mgr = new CommentManager();

      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // Get the UI instance created during initialize
      const mockUIInstance = vi.mocked(CommentUI).mock.results[vi.mocked(CommentUI).mock.results.length - 1].value as {
        renderReplyForm: ReturnType<typeof vi.fn>;
        renderCard: ReturnType<typeof vi.fn>;
        setCurrentAuthor: ReturnType<typeof vi.fn>;
        showToast: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
      };

      // Create a card in the DOM so showReplyForm can find it
      const card = document.createElement('div');
      card.className = 'mdview-comment-card';
      card.dataset.commentId = 'comment-1';
      const body = document.createElement('div');
      body.className = 'comment-body';
      card.appendChild(body);
      document.body.appendChild(card);

      // Dispatch the reply event
      document.dispatchEvent(
        new CustomEvent('mdview:comment:reply', {
          detail: { commentId: 'comment-1' },
        })
      );

      // Should have called renderReplyForm
      expect(mockUIInstance.renderReplyForm).toHaveBeenCalled();

      mgr.destroy();
    });

    test('handles mdview:comment:react event', async () => {
      await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      document.dispatchEvent(
        new CustomEvent('mdview:comment:react', {
          detail: { commentId: 'comment-1', emoji: '\u{1F44D}' },
        })
      );

      // Wait for async handler
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSerializerToggleReaction).toHaveBeenCalledWith(
        sampleMarkdown,
        'comment-1',
        '\u{1F44D}',
        'Test Author'
      );
    });
  });

  // ── setCurrentAuthor ──────────────────────────────────────────────────

  describe('setCurrentAuthor on initialize', () => {
    test('passes author to UI via setCurrentAuthor', async () => {
      await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      const { CommentUI } = await import('../../../src/comments/comment-ui');
      const mockUIInstance = vi.mocked(CommentUI).mock.results[vi.mocked(CommentUI).mock.results.length - 1].value as {
        setCurrentAuthor: ReturnType<typeof vi.fn>;
      };

      expect(mockUIInstance.setCurrentAuthor).toHaveBeenCalledWith('Test Author');
    });
  });

  // ── minimized card support ──────────────────────────────────────────────

  describe('minimized card support', () => {
    test('handles mdview:comment:reposition event by repositioning cards', async () => {
      const { CommentHighlighter } = await import(
        '../../../src/comments/comment-highlight'
      );
      const { CommentUI } = await import('../../../src/comments/comment-ui');

      const mgr = new CommentManager();

      // Create a highlight element for the card
      const highlight = document.createElement('span');
      document.body.appendChild(highlight);
      highlight.getBoundingClientRect = vi.fn(() => ({
        top: 100, bottom: 120, left: 0, right: 100,
        width: 100, height: 20, x: 0, y: 100, toJSON: () => ({}),
      }));

      // Mock highlighter
      const mockHighlighter = vi.mocked(CommentHighlighter);
      mockHighlighter.mockImplementation(() => ({
        highlightComment: vi.fn(),
        removeHighlight: vi.fn(),
        setActive: vi.fn(),
        clearActive: vi.fn(),
        setResolved: vi.fn(),
        getHighlightElement: vi.fn(() => highlight),
      }) as any);

      // Mock UI to produce real card elements
      vi.mocked(CommentUI).mockImplementation(() => ({
        createGutter: vi.fn(() => document.createElement('div')),
        renderCard: vi.fn((comment: Comment) => {
          const card = document.createElement('div');
          card.className = 'mdview-comment-card';
          card.dataset.commentId = comment.id;
          Object.defineProperty(card, 'offsetHeight', { value: 40, configurable: true });
          return card;
        }),
        renderInputForm: vi.fn(() => document.createElement('div')),
        renderReplyForm: vi.fn(() => document.createElement('div')),
        renderEmojiPicker: vi.fn(() => document.createElement('div')),
        setCurrentAuthor: vi.fn(),
        showToast: vi.fn(),
        destroy: vi.fn(),
      }) as any);

      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // Get the card and record its initial position
      const card = document.querySelector('.mdview-comment-card') as HTMLElement;
      expect(card).not.toBeNull();
      const initialTop = card.style.top;

      // Change the highlight position
      highlight.getBoundingClientRect = vi.fn(() => ({
        top: 200, bottom: 220, left: 0, right: 100,
        width: 100, height: 20, x: 0, y: 200, toJSON: () => ({}),
      }));

      // Dispatch reposition event
      document.dispatchEvent(new CustomEvent('mdview:comment:reposition'));

      // Card should have been repositioned
      expect(card.style.top).toBe('200px');
      expect(card.style.top).not.toBe(initialTop);

      mgr.destroy();
      highlight.remove();
    });

    test('refreshCardContent preserves minimized state on old card', async () => {
      const { CommentUI } = await import('../../../src/comments/comment-ui');

      const mgr = new CommentManager();

      // Mock renderCard to produce cards with correct structure
      let renderCallCount = 0;
      vi.mocked(CommentUI).mockImplementation(() => ({
        createGutter: vi.fn(() => document.createElement('div')),
        renderCard: vi.fn((comment: Comment) => {
          renderCallCount++;
          const card = document.createElement('div');
          card.className = 'mdview-comment-card';
          card.dataset.commentId = comment.id;
          return card;
        }),
        renderInputForm: vi.fn(() => document.createElement('div')),
        renderReplyForm: vi.fn(() => document.createElement('div')),
        renderEmojiPicker: vi.fn(() => document.createElement('div')),
        setCurrentAuthor: vi.fn(),
        showToast: vi.fn(),
        destroy: vi.fn(),
      }) as any);

      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // Simulate the user expanding the card (remove .minimized)
      const card = document.querySelector('.mdview-comment-card') as HTMLElement;
      card.classList.remove('minimized');

      // Trigger a reply which calls refreshCardContent internally
      await mgr.addReply('comment-1', 'A reply');

      // New card should NOT have .minimized (state preserved from expanded old card)
      const newCard = document.querySelector(
        '.mdview-comment-card[data-comment-id="comment-1"]'
      ) as HTMLElement;
      expect(newCard.classList.contains('minimized')).toBe(false);

      mgr.destroy();
    });

    test('refreshCardContent preserves minimized state when card was minimized', async () => {
      const { CommentUI } = await import('../../../src/comments/comment-ui');

      const mgr = new CommentManager();

      vi.mocked(CommentUI).mockImplementation(() => ({
        createGutter: vi.fn(() => document.createElement('div')),
        renderCard: vi.fn((comment: Comment) => {
          const card = document.createElement('div');
          card.className = 'mdview-comment-card minimized';
          card.dataset.commentId = comment.id;
          return card;
        }),
        renderInputForm: vi.fn(() => document.createElement('div')),
        renderReplyForm: vi.fn(() => document.createElement('div')),
        renderEmojiPicker: vi.fn(() => document.createElement('div')),
        setCurrentAuthor: vi.fn(),
        showToast: vi.fn(),
        destroy: vi.fn(),
      }) as any);

      await mgr.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

      // Card starts minimized (from renderCard mock)
      const card = document.querySelector('.mdview-comment-card') as HTMLElement;
      expect(card.classList.contains('minimized')).toBe(true);

      // Trigger refreshCardContent via addReply
      await mgr.addReply('comment-1', 'A reply');

      // New card should still have .minimized
      const newCard = document.querySelector(
        '.mdview-comment-card[data-comment-id="comment-1"]'
      ) as HTMLElement;
      expect(newCard.classList.contains('minimized')).toBe(true);

      mgr.destroy();
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
