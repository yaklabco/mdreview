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
  'service.namespace': 'electron-renderer',
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

describe('CommentManager logging spans', () => {
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

  it('emits comment.add.start and comment.add.end with status=ok on success', async () => {
    const file = createMockFileAdapter();
    const identity = createMockIdentityAdapter();

    manager = new CommentManager({ file, identity });
    await manager.initialize(SAMPLE_MARKDOWN, '/test/doc.md', createMinimalPreferences());

    await manager.addComment('test document', 'a comment body');

    await new Promise((r) => setTimeout(r, 10));
    await shutdownLogging();

    const startRec = transport.records.find((r) => r.body === 'comment.add.start');
    const endRec = transport.records.find((r) => r.body === 'comment.add.end');

    expect(startRec).toBeDefined();
    expect(endRec).toBeDefined();
    expect(startRec?.traceId).toBeDefined();
    expect(startRec?.traceId).toBe(endRec?.traceId);
    expect(startRec?.attributes['mdview.comment.op']).toBe('add');
    // span.setAttribute mutations are visible on the end record (and any
    // exception event) since the start record is emitted before fn runs.
    expect(endRec?.attributes['mdview.file.path']).toBe('/test/doc.md');
    expect(endRec?.attributes['mdview.comment.id']).toBeDefined();
    expect(endRec?.attributes['mdview.span.status']).toBe('ok');
    expect(endRec?.attributes['duration_ns']).toBeTypeOf('number');
  });

  it('emits comment.resolve.start/end on a successful resolveComment', async () => {
    const mdWithComment = `# Hello

Test[@1] content.

<!-- mdview:annotations [{"id":1,"anchor":{"text":"Test"},"body":"A note","author":"tester","date":"2024-01-01T00:00:00.000Z"}] -->
`;
    const file = createMockFileAdapter();
    const identity = createMockIdentityAdapter();

    manager = new CommentManager({ file, identity });
    await manager.initialize(mdWithComment, '/test/doc.md', createMinimalPreferences());

    await manager.resolveComment('comment-1');

    await new Promise((r) => setTimeout(r, 10));
    await shutdownLogging();

    const startRec = transport.records.find((r) => r.body === 'comment.resolve.start');
    const endRec = transport.records.find((r) => r.body === 'comment.resolve.end');

    expect(startRec).toBeDefined();
    expect(endRec).toBeDefined();
    expect(startRec?.attributes['mdview.comment.op']).toBe('resolve');
    expect(endRec?.attributes['mdview.comment.id']).toBe('comment-1');
    expect(endRec?.attributes['mdview.span.status']).toBe('ok');
    expect(endRec?.traceId).toBe(startRec?.traceId);
  });

  it('emits start, exception, and end (status=error) when addComment write fails', async () => {
    const writeError = new Error('disk full');
    const file = createMockFileAdapter({
      writeFile: vi.fn().mockRejectedValue(writeError),
    });
    const identity = createMockIdentityAdapter();

    manager = new CommentManager({ file, identity });
    await manager.initialize(SAMPLE_MARKDOWN, '/test/doc.md', createMinimalPreferences());

    // addComment now rethrows on write failure so the surrounding span emits
    // an exception event and an end record with status=error.
    await expect(manager.addComment('test document', 'a comment body')).rejects.toThrow(
      'disk full'
    );

    // Allow microtasks to drain so all span records reach the transport.
    await new Promise((r) => setTimeout(r, 10));
    await shutdownLogging();

    const errorRecords = transport.records.filter((r) => r.severityText === 'ERROR');
    expect(errorRecords.length).toBeGreaterThan(0);

    const exceptionRec = transport.records.find((r) => r.body === 'exception');
    expect(exceptionRec).toBeDefined();
    expect(exceptionRec?.attributes['mdview.span.name']).toBe('comment.add');
    expect(exceptionRec?.attributes['exception.message']).toBe('disk full');
    expect(exceptionRec?.attributes['exception.type']).toBe('Error');
    expect(exceptionRec?.traceId).toBeDefined();

    const endRec = transport.records.find((r) => r.body === 'comment.add.end');
    expect(endRec).toBeDefined();
    expect(endRec?.attributes['mdview.span.status']).toBe('error');
    expect(endRec?.traceId).toBe(exceptionRec?.traceId);
  });
});
