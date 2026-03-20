import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommentManager } from '../comments/comment-manager';
import type { FileAdapter, IdentityAdapter, FileWriteResult } from '../adapters';
import type { AppState } from '../types/index';

/**
 * Minimal mock DOM environment for CommentManager tests.
 * The manager requires DOM elements (window, document, etc.) which
 * jsdom provides. We mock the UI and highlighter dependencies since
 * they are browser-specific and not extracted to core yet.
 */

// Mock the DOM-dependent comment UI modules (now in core/src/comments/)
vi.mock('../comments/comment-ui', () => {
  class MockCommentUI {
    setCurrentAuthor = vi.fn();
    renderCard = vi.fn().mockReturnValue(document.createElement('div'));
    renderInputForm = vi.fn().mockReturnValue(document.createElement('div'));
    renderReplyForm = vi.fn().mockReturnValue(document.createElement('div'));
    renderEmojiPicker = vi.fn().mockReturnValue(document.createElement('div'));
    showToast = vi.fn();
    destroy = vi.fn();
  }
  return { CommentUI: MockCommentUI };
});

vi.mock('../comments/comment-highlight', () => {
  class MockCommentHighlighter {
    highlightComment = vi.fn();
    clearActive = vi.fn();
    setActive = vi.fn();
    setResolved = vi.fn();
    removeHighlight = vi.fn();
    getHighlightElement = vi.fn().mockReturnValue(null);
  }
  return { CommentHighlighter: MockCommentHighlighter };
});

function createMockFileAdapter(
  overrides: Partial<FileAdapter> = {}
): FileAdapter {
  return {
    writeFile: vi.fn().mockResolvedValue({ success: true } as FileWriteResult),
    readFile: vi.fn().mockResolvedValue(''),
    checkChanged: vi.fn().mockResolvedValue({ changed: false }),
    watch: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function createMockIdentityAdapter(
  overrides: Partial<IdentityAdapter> = {}
): IdentityAdapter {
  return {
    getUsername: vi.fn().mockResolvedValue('test-user'),
    ...overrides,
  };
}

function createMinimalPreferences(): AppState['preferences'] {
  return {
    theme: 'github-light',
    autoTheme: false,
    lightTheme: 'github-light',
    darkTheme: 'github-dark',
    syntaxTheme: 'default',
    autoReload: false,
    lineNumbers: false,
    enableHtml: false,
    syncTabs: false,
    logLevel: 'none',
    commentsEnabled: true,
  };
}

const SAMPLE_MARKDOWN = `# Hello World

This is a test document.

Some content here.
`;

describe('CommentManager (core)', () => {
  let manager: CommentManager;

  beforeEach(() => {
    // Set up a basic DOM container
    const container = document.createElement('div');
    container.id = 'mdview-container';
    container.textContent = 'This is a test document. Some content here.';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('with FileAdapter and IdentityAdapter', () => {
    it('uses IdentityAdapter to get username when no author is configured', async () => {
      const identity = createMockIdentityAdapter({
        getUsername: vi.fn().mockResolvedValue('adapter-user'),
      });
      const file = createMockFileAdapter();

      manager = new CommentManager({ file, identity });
      const result = await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      expect(identity.getUsername).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.comments).toEqual([]);
    });

    it('prefers preferences.commentAuthor over IdentityAdapter', async () => {
      const identity = createMockIdentityAdapter({
        getUsername: vi.fn().mockResolvedValue('adapter-user'),
      });
      const file = createMockFileAdapter();

      manager = new CommentManager({ file, identity });
      const prefs = createMinimalPreferences();
      prefs.commentAuthor = 'pref-author';

      await manager.initialize(SAMPLE_MARKDOWN, '/test/file.md', prefs);

      // Should NOT call getUsername since author is already set
      expect(identity.getUsername).not.toHaveBeenCalled();
    });

    it('uses FileAdapter.writeFile when adding a comment', async () => {
      const file = createMockFileAdapter();
      const identity = createMockIdentityAdapter();

      manager = new CommentManager({ file, identity });
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      await manager.addComment('test document', 'My note');

      expect(file.writeFile).toHaveBeenCalledWith(
        '/test/file.md',
        expect.stringContaining('My note')
      );
    });

    it('uses FileAdapter.writeFile when editing a comment', async () => {
      const mdWithComment = `# Hello World

This is a test[@1] document.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"test"},"body":"My note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      const file = createMockFileAdapter();
      const identity = createMockIdentityAdapter();

      manager = new CommentManager({ file, identity });
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await manager.editComment('comment-1', 'Updated note');

      expect(file.writeFile).toHaveBeenCalledWith(
        '/test/file.md',
        expect.stringContaining('Updated note')
      );
    });

    it('uses FileAdapter.writeFile when resolving a comment', async () => {
      const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      const file = createMockFileAdapter();
      const identity = createMockIdentityAdapter();

      manager = new CommentManager({ file, identity });
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await manager.resolveComment('comment-1');

      expect(file.writeFile).toHaveBeenCalled();
    });

    it('uses FileAdapter.writeFile when deleting a comment', async () => {
      const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      const file = createMockFileAdapter();
      const identity = createMockIdentityAdapter();

      manager = new CommentManager({ file, identity });
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await manager.deleteComment('comment-1');

      expect(file.writeFile).toHaveBeenCalled();
    });

    it('reports write errors from FileAdapter', async () => {
      const file = createMockFileAdapter({
        writeFile: vi.fn().mockResolvedValue({
          success: false,
          error: 'Permission denied',
        }),
      });
      const identity = createMockIdentityAdapter();

      manager = new CommentManager({ file, identity });
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      // Should not throw even if write fails
      await expect(
        manager.addComment('test', 'note')
      ).resolves.not.toThrow();
    });
  });

  describe('graceful degradation without adapters', () => {
    it('initializes without any adapters', async () => {
      manager = new CommentManager();
      const result = await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      expect(result).toBeDefined();
      expect(result.comments).toEqual([]);
    });

    it('uses empty username when no adapter and no preference set', async () => {
      manager = new CommentManager();
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      // Comments created should have empty author
      const comments = manager.getComments();
      expect(comments).toEqual([]);
    });

    it('addComment works without FileAdapter (skips write)', async () => {
      manager = new CommentManager();
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      // Should not throw even without file adapter
      await expect(
        manager.addComment('test document', 'A note')
      ).resolves.not.toThrow();

      const comments = manager.getComments();
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('A note');
    });

    it('editComment works without FileAdapter', async () => {
      const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      manager = new CommentManager();
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await expect(
        manager.editComment('comment-1', 'Updated')
      ).resolves.not.toThrow();
    });

    it('deleteComment works without FileAdapter', async () => {
      const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      manager = new CommentManager();
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await expect(
        manager.deleteComment('comment-1')
      ).resolves.not.toThrow();

      expect(manager.getComments()).toHaveLength(0);
    });

    it('resolveComment works without FileAdapter', async () => {
      const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
      manager = new CommentManager();
      await manager.initialize(
        mdWithComment,
        '/test/file.md',
        createMinimalPreferences()
      );

      await expect(
        manager.resolveComment('comment-1')
      ).resolves.not.toThrow();
    });

    it('provides partial adapters — only FileAdapter', async () => {
      const file = createMockFileAdapter();

      manager = new CommentManager({ file });
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      await manager.addComment('test document', 'note');

      // File adapter should be used for write
      expect(file.writeFile).toHaveBeenCalled();
    });

    it('provides partial adapters — only IdentityAdapter', async () => {
      const identity = createMockIdentityAdapter({
        getUsername: vi.fn().mockResolvedValue('identity-only-user'),
      });

      manager = new CommentManager({ identity });
      await manager.initialize(
        SAMPLE_MARKDOWN,
        '/test/file.md',
        createMinimalPreferences()
      );

      expect(identity.getUsername).toHaveBeenCalled();

      // addComment should still work (no file write, but no crash)
      await expect(
        manager.addComment('test', 'note')
      ).resolves.not.toThrow();
    });
  });

  describe('isWriteInProgress', () => {
    it('returns false initially', () => {
      manager = new CommentManager();
      expect(manager.isWriteInProgress()).toBe(false);
    });
  });
});
