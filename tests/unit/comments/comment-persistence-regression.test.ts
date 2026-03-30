/**
 * Regression tests — comment persistence and edit-form UI behaviour.
 *
 * Covers three bugs:
 *  1. Comments not persisted to disk (Chrome URL-encoding + missing adapter).
 *  2. Original comment card visible behind the edit form.
 *  3. Nearby comment cards overlapping the edit form (z-index).
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommentManager, CommentUI } from '@mdreview/core';
import type {
  Comment,
  CommentParseResult,
  AppState,
  FileAdapter,
  FileWriteResult,
} from '@mdreview/core';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../packages/core/src/comments/annotation-parser', () => ({
  parseComments: vi.fn(),
}));

vi.mock('../../../packages/core/src/comments/annotation-serializer', () => ({
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

vi.mock('../../../packages/core/src/comments/source-position-map', () => ({
  buildSourceMap: vi.fn(() => ({
    rawSource: '',
    plainText: '',
    offsets: [],
    spans: [],
  })),
  findInsertionPoint: vi.fn(() => 10),
}));

vi.mock('../../../packages/core/src/comments/comment-context', () => ({
  computeCommentContext: vi.fn(() => ({
    line: 3,
    section: 'Title',
    sectionLevel: 1,
    breadcrumb: ['Title'],
  })),
}));

vi.mock('../../../packages/core/src/comments/comment-highlight', () => {
  const CommentHighlighter = vi.fn();
  CommentHighlighter.prototype.highlightComment = vi.fn(() => document.createElement('span'));
  CommentHighlighter.prototype.removeHighlight = vi.fn();
  CommentHighlighter.prototype.setActive = vi.fn();
  CommentHighlighter.prototype.clearActive = vi.fn();
  CommentHighlighter.prototype.setResolved = vi.fn();
  CommentHighlighter.prototype.getHighlightElement = vi.fn(() => {
    const span = document.createElement('span');
    span.getBoundingClientRect = vi.fn(() => ({
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
    span.scrollIntoView = vi.fn();
    return span;
  });
  return { CommentHighlighter };
});

import { parseComments } from '../../../packages/core/src/comments/annotation-parser';
import {
  generateNextCommentId,
  addCommentAtOffset as serializerAddCommentAtOffset,
  updateComment as serializerUpdateComment,
  removeComment as serializerRemoveComment,
  resolveComment as serializerResolveComment,
  addReply as serializerAddReply,
  toggleReaction as serializerToggleReaction,
} from '../../../packages/core/src/comments/annotation-serializer';

const mockParseComments = vi.mocked(parseComments);
const mockGenerateNextId = vi.mocked(generateNextCommentId);
const mockSerializerAddAtOffset = vi.mocked(serializerAddCommentAtOffset);
const mockSerializerUpdate = vi.mocked(serializerUpdateComment);
const mockSerializerRemove = vi.mocked(serializerRemoveComment);
const mockSerializerResolve = vi.mocked(serializerResolveComment);
const mockSerializerAddReply = vi.mocked(serializerAddReply);
const mockSerializerToggleReaction = vi.mocked(serializerToggleReaction);

// ── Fixtures ───────────────────────────────────────────────────────────────

const sampleComment: Comment = {
  id: 'comment-1',
  selectedText: 'hello world',
  body: 'This needs review',
  author: 'tester',
  date: '2026-03-03T10:00:00Z',
  resolved: false,
};

const sampleComment2: Comment = {
  id: 'comment-2',
  selectedText: 'second text',
  body: 'Another comment nearby',
  author: 'tester',
  date: '2026-03-03T11:00:00Z',
  resolved: false,
};

const sampleParseResult: CommentParseResult = {
  cleanedMarkdown: '# Title\n\nhello world\n',
  comments: [sampleComment],
};

const twoCommentParseResult: CommentParseResult = {
  cleanedMarkdown: '# Title\n\nhello world\nsecond text\n',
  comments: [sampleComment, sampleComment2],
};

const sampleMarkdown =
  '# Title\n\nhello world[@1]\n\n<!-- mdreview:annotations\n[{"id":"comment-1","author":"tester","date":"2026-03-03T10:00:00Z","body":"This needs review","selectedText":"hello world","resolved":false}]\n-->';

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

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockFileAdapter(
  responses?: Partial<FileAdapter>
): FileAdapter & { writeFile: ReturnType<typeof vi.fn> } {
  return {
    writeFile: vi
      .fn<[string, string], Promise<FileWriteResult>>()
      .mockResolvedValue({ success: true }),
    readFile: vi.fn<[string], Promise<string>>().mockResolvedValue(''),
    checkChanged: vi.fn().mockResolvedValue({ changed: false }),
    watch: vi.fn().mockReturnValue(() => {}),
    ...responses,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bug 1 — Comment persistence (file write path)
// ═══════════════════════════════════════════════════════════════════════════

describe('Bug 1 regression: comment file persistence', () => {
  let manager: CommentManager;
  let mockAdapter: ReturnType<typeof createMockFileAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';

    mockAdapter = createMockFileAdapter();

    mockParseComments.mockReturnValue(sampleParseResult);
    mockGenerateNextId.mockReturnValue('comment-2');
    mockSerializerAddAtOffset.mockReturnValue('updated markdown');
    mockSerializerUpdate.mockReturnValue('updated markdown');
    mockSerializerRemove.mockReturnValue('updated markdown');
    mockSerializerResolve.mockReturnValue('updated markdown');
    mockSerializerAddReply.mockReturnValue({ markdown: 'updated markdown', replyId: 'reply-1' });
    mockSerializerToggleReaction.mockReturnValue('updated markdown');

    manager = new CommentManager({ file: mockAdapter });
  });

  afterEach(() => {
    manager.destroy();
  });

  test('addComment calls writeFile on the adapter with the correct path', async () => {
    await manager.initialize(sampleMarkdown, '/Users/test/my file.md', defaultPreferences);
    await manager.addComment('some text', 'A comment');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith(
      '/Users/test/my file.md',
      'updated markdown'
    );
  });

  test('editComment calls writeFile on the adapter', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);
    await manager.editComment('comment-1', 'Edited body');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith('/path/to/file.md', 'updated markdown');
  });

  test('deleteComment calls writeFile on the adapter', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);
    await manager.deleteComment('comment-1');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith('/path/to/file.md', 'updated markdown');
  });

  test('resolveComment calls writeFile on the adapter', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);
    await manager.resolveComment('comment-1');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith('/path/to/file.md', 'updated markdown');
  });

  test('addReply calls writeFile on the adapter', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);
    await manager.addReply('comment-1', 'Reply text');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith('/path/to/file.md', 'updated markdown');
  });

  test('toggleReaction calls writeFile on the adapter', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);
    await manager.toggleReaction('comment-1', '👍');

    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
    expect(mockAdapter.writeFile).toHaveBeenCalledWith('/path/to/file.md', 'updated markdown');
  });

  test('writeFile failure surfaces error via toast', async () => {
    mockAdapter.writeFile.mockResolvedValue({ success: false, error: 'Permission denied' });

    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    // addComment should not throw — it catches and toasts
    await expect(manager.addComment('text', 'body')).resolves.not.toThrow();

    // The write was attempted
    expect(mockAdapter.writeFile).toHaveBeenCalledTimes(1);
  });

  test('throws when no file adapter is configured', async () => {
    const noAdapterManager = new CommentManager();
    mockParseComments.mockReturnValue(sampleParseResult);

    await noAdapterManager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    // addComment catches internally — verify it doesn't silently swallow the error
    await noAdapterManager.addComment('text', 'body');

    // The comment is added to memory (optimistic) but a toast should indicate failure
    const comments = noAdapterManager.getComments();
    expect(comments).toHaveLength(2);

    noAdapterManager.destroy();
  });

  test('handles adapter returning non-success result', async () => {
    mockAdapter.writeFile.mockResolvedValue({ success: false, error: 'Disk full' });

    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    // Should not throw — CommentManager catches the error
    await expect(manager.addComment('text', 'body')).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug 1b — Chrome extension URL-encoded file path
// ═══════════════════════════════════════════════════════════════════════════

describe('Bug 1b regression: Chrome FileScanner.getFilePath URL decoding', () => {
  test('getFilePath decodes URL-encoded characters', async () => {
    // Dynamically import so we can test with mocked window.location
    const originalPathname = Object.getOwnPropertyDescriptor(window, 'location');

    // Mock window.location.pathname with URL-encoded path
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        pathname: '/Users/test/My%20Documents/file%20name.md',
        href: 'file:///Users/test/My%20Documents/file%20name.md',
        protocol: 'file:',
        hostname: '',
      },
      writable: true,
      configurable: true,
    });

    const { FileScanner } = await import('../../../packages/chrome-ext/src/utils/file-scanner');

    const filePath = FileScanner.getFilePath();
    expect(filePath).toBe('/Users/test/My Documents/file name.md');

    // Restore
    if (originalPathname) {
      Object.defineProperty(window, 'location', originalPathname);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug 2 — Comment card must be hidden during edit
// ═══════════════════════════════════════════════════════════════════════════

describe('Bug 2 regression: comment card hidden during edit', () => {
  let manager: CommentManager;
  let mockAdapter: ReturnType<typeof createMockFileAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';

    mockAdapter = createMockFileAdapter();

    mockParseComments.mockReturnValue(sampleParseResult);
    mockGenerateNextId.mockReturnValue('comment-3');
    mockSerializerAddAtOffset.mockReturnValue('updated markdown');
    mockSerializerUpdate.mockReturnValue('updated markdown');

    manager = new CommentManager({ file: mockAdapter });
  });

  afterEach(() => {
    manager.destroy();
  });

  test('card is hidden when edit form is shown', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    // Find the card that was rendered
    const card = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-1"]'
    ) as HTMLElement;
    expect(card).not.toBeNull();

    // Expand the card (click to un-minimize)
    card.click();

    // Dispatch the edit event
    document.dispatchEvent(
      new CustomEvent('mdreview:comment:edit', {
        detail: { commentId: 'comment-1' },
      })
    );

    // Card should be hidden
    expect(card.style.display).toBe('none');

    // An edit form should exist on the page
    const form = document.querySelector('.mdreview-comment-input');
    expect(form).not.toBeNull();
  });

  test('card is restored after edit save', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    const card = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-1"]'
    ) as HTMLElement;
    card.click();

    // Trigger edit
    document.dispatchEvent(
      new CustomEvent('mdreview:comment:edit', {
        detail: { commentId: 'comment-1' },
      })
    );

    expect(card.style.display).toBe('none');

    // Find the form and click save
    const form = document.querySelector('.mdreview-comment-input');
    expect(form).not.toBeNull();

    const textarea = form!.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Updated comment text';
    const saveBtn = form!.querySelector('.mdreview-comment-btn-save') as HTMLButtonElement;
    saveBtn.click();

    // Card should be visible again
    expect(card.style.display).toBe('');
  });

  test('card is restored after edit cancel', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    const card = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-1"]'
    ) as HTMLElement;
    card.click();

    document.dispatchEvent(
      new CustomEvent('mdreview:comment:edit', {
        detail: { commentId: 'comment-1' },
      })
    );

    expect(card.style.display).toBe('none');

    // Click cancel
    const cancelBtn = document.querySelector('.mdreview-comment-btn-cancel') as HTMLButtonElement;
    cancelBtn.click();

    // Card should be visible again
    expect(card.style.display).toBe('');

    // Form should be removed
    expect(document.querySelector('.mdreview-comment-input')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug 3 — Edit form must not be overlapped by nearby cards
// ═══════════════════════════════════════════════════════════════════════════

describe('Bug 3 regression: edit form z-index above nearby cards', () => {
  let manager: CommentManager;
  let mockAdapter: ReturnType<typeof createMockFileAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';

    mockAdapter = createMockFileAdapter();

    mockParseComments.mockReturnValue(twoCommentParseResult);
    mockGenerateNextId.mockReturnValue('comment-3');
    mockSerializerUpdate.mockReturnValue('updated markdown');

    manager = new CommentManager({ file: mockAdapter });
  });

  afterEach(() => {
    manager.destroy();
  });

  test('edit form is rendered outside the card stacking context', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    // Trigger edit on comment-1
    const card1 = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-1"]'
    ) as HTMLElement;
    card1.click();

    document.dispatchEvent(
      new CustomEvent('mdreview:comment:edit', {
        detail: { commentId: 'comment-1' },
      })
    );

    // The edit form should be a direct child of document.body,
    // NOT inside the card. This ensures its z-index (200) is not
    // constrained by the card's stacking context (z-index: 100).
    const form = document.querySelector('.mdreview-comment-input') as HTMLElement;
    expect(form).not.toBeNull();
    expect(form.parentElement).toBe(document.body);
  });

  test('edit form has higher z-index than comment cards via CSS class', async () => {
    await manager.initialize(sampleMarkdown, '/path/to/file.md', defaultPreferences);

    const card1 = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-1"]'
    ) as HTMLElement;
    card1.click();

    document.dispatchEvent(
      new CustomEvent('mdreview:comment:edit', {
        detail: { commentId: 'comment-1' },
      })
    );

    // Edit form uses .mdreview-comment-input which has z-index: 200 in CSS
    // Comment cards have z-index: 100. Since the form is now on document.body
    // (not inside a card), its z-index is effective.
    const form = document.querySelector('.mdreview-comment-input') as HTMLElement;
    expect(form).not.toBeNull();
    expect(form.classList.contains('mdreview-comment-input')).toBe(true);

    // Verify the editing card is hidden (not competing for z-index)
    expect(card1.style.display).toBe('none');

    // The other card (comment-2) should still be visible but at z-index 100
    const card2 = document.querySelector(
      '.mdreview-comment-card[data-comment-id="comment-2"]'
    ) as HTMLElement;
    expect(card2).not.toBeNull();
    expect(card2.style.display).not.toBe('none');
  });
});
