import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommentManager } from '../../comments/comment-manager';
import type { FileAdapter, IdentityAdapter, FileWriteResult } from '../../adapters';
import type { AppState } from '../../types/index';
import {
  initLogging,
  shutdownLogging,
  type LogRecord,
  type LogTransport,
  type ResourceAttrs,
  type TransportResult,
} from '../../logging';

vi.mock('../../comments/comment-ui', () => {
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

vi.mock('../../comments/comment-highlight', () => {
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

const RESOURCE: ResourceAttrs = {
  'service.name': 'mdview',
  'service.version': '0.0.0-test',
  'service.namespace': 'core-test',
  'deployment.environment': 'dev',
  'host.os': 'test',
};

class CapturingTransport implements LogTransport {
  records: LogRecord[] = [];
  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.records.push(...records);
    return Promise.resolve({ ok: true });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function createMockFileAdapter(overrides: Partial<FileAdapter> = {}): FileAdapter {
  return {
    writeFile: vi.fn().mockResolvedValue({ success: true } as FileWriteResult),
    readFile: vi.fn().mockResolvedValue(''),
    checkChanged: vi.fn().mockResolvedValue({ changed: false }),
    watch: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

function createMockIdentityAdapter(overrides: Partial<IdentityAdapter> = {}): IdentityAdapter {
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

describe('CommentManager logging (comment.write.failed)', () => {
  let manager: CommentManager;
  let transport: CapturingTransport;

  beforeEach(() => {
    transport = new CapturingTransport();
    initLogging({
      transport,
      resource: RESOURCE,
      maxBatch: 1,
      flushIntervalMs: 9999,
    });

    const container = document.createElement('div');
    container.id = 'mdreview-container';
    container.textContent = 'This is a test document. Some content here.';
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (manager) manager.destroy();
    document.body.innerHTML = '';
    await shutdownLogging();
  });

  it('emits a structured error log when the file write fails', async () => {
    const writeError = new Error('disk full');
    const file = createMockFileAdapter({
      writeFile: vi.fn().mockRejectedValue(writeError),
    });
    const identity = createMockIdentityAdapter();

    manager = new CommentManager({ file, identity });
    await manager.initialize(SAMPLE_MARKDOWN, '/test/doc.md', createMinimalPreferences());

    await manager.addComment('test document', 'a comment body');

    // Allow microtasks to drain so the error record reaches the transport.
    await new Promise((r) => setTimeout(r, 10));
    await shutdownLogging();

    const errorRecords = transport.records.filter((r) => r.severityText === 'ERROR');
    expect(errorRecords.length).toBeGreaterThan(0);

    const rec = errorRecords.find((r) => r.body === 'comment.write.failed');
    expect(rec).toBeDefined();
    expect(rec?.attributes['mdview.comment.op']).toBe('add');
    expect(rec?.attributes['mdview.file.path']).toBe('/test/doc.md');
    expect(rec?.attributes['exception.message']).toBe('disk full');
    expect(rec?.attributes['exception.type']).toBe('Error');
  });
});
