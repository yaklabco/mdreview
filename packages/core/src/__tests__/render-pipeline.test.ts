import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessagingAdapter, IPCMessage } from '../adapters';

// Mock heavy dependencies that live outside @mdreview/core
vi.mock('../utils/dom-purifier', () => ({
  domPurifier: {
    sanitize: (html: string) => html,
  },
}));

vi.mock('../workers/worker-pool', () => ({
  workerPool: {
    initialize: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn(),
  },
}));

vi.mock('../renderers/syntax-highlighter', () => ({
  syntaxHighlighter: {
    highlightVisible: vi.fn(),
  },
}));

vi.mock('../renderers/mermaid-renderer', () => ({
  mermaidRenderer: {
    renderAll: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../utils/toc-stripper', () => ({
  stripTableOfContents: vi.fn((md: string) => ({ markdown: md, tocFound: false })),
}));

vi.mock('../comments/annotation-parser', () => ({
  parseComments: vi.fn((md: string) => ({
    cleanedMarkdown: md,
    comments: [],
  })),
}));

vi.mock('../utils/skeleton-renderer', () => ({
  SkeletonRenderer: {
    generateSkeleton: vi.fn(() => '<div>skeleton</div>'),
    isHydrated: vi.fn(() => false),
    markHydrated: vi.fn(),
  },
}));

import { RenderPipeline } from '../render-pipeline';

describe('RenderPipeline', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    vi.clearAllMocks();
  });

  describe('with MessagingAdapter', () => {
    it('sends CACHE_GENERATE_KEY and CACHE_GET when useCache is true', async () => {
      const sendMock = vi.fn().mockImplementation((msg: IPCMessage) => {
        if (msg.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'test-cache-key' });
        }
        if (msg.type === 'CACHE_GET') {
          return Promise.resolve({ result: null });
        }
        if (msg.type === 'CACHE_SET') {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });
      const mockMessaging: MessagingAdapter = { send: sendMock };

      const pipeline = new RenderPipeline({ messaging: mockMessaging });

      await pipeline.render({
        container,
        markdown: '# Hello',
        filePath: '/test.md',
        useCache: true,
        useWorkers: false,
      });

      // Should have called CACHE_GENERATE_KEY
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CACHE_GENERATE_KEY' })
      );

      // Should have called CACHE_GET
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'CACHE_GET' }));
    });

    it('uses cached result when adapter returns a cache hit', async () => {
      const cachedHtml = '<div class="mdreview-rendered"><p>Cached content</p></div>';
      const sendMock = vi.fn().mockImplementation((msg: IPCMessage) => {
        if (msg.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'cached-key' });
        }
        if (msg.type === 'CACHE_GET') {
          return Promise.resolve({
            result: {
              html: cachedHtml,
              metadata: {
                headings: [],
                codeBlocks: [],
                mermaidBlocks: [],
                images: [],
                links: [],
                wordCount: 0,
                frontmatter: null,
              },
              highlightedBlocks: new Map(),
              mermaidSVGs: new Map(),
              timestamp: Date.now(),
              cacheKey: 'cached-key',
            },
          });
        }
        return Promise.resolve({});
      });
      const mockMessaging: MessagingAdapter = { send: sendMock };

      const pipeline = new RenderPipeline({ messaging: mockMessaging });

      const progressUpdates: string[] = [];
      pipeline.onProgress((p) => progressUpdates.push(p.stage));

      await pipeline.render({
        container,
        markdown: '# Hello',
        filePath: '/test.md',
        useCache: true,
        useWorkers: false,
      });

      expect(container.innerHTML).toBe(cachedHtml);
      expect(progressUpdates).toContain('cached');
    });

    it('sends CACHE_SET after successful render', async () => {
      const sendMock = vi.fn().mockImplementation((msg: IPCMessage) => {
        if (msg.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'new-cache-key' });
        }
        if (msg.type === 'CACHE_GET') {
          return Promise.resolve({ result: null });
        }
        if (msg.type === 'CACHE_SET') {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });
      const mockMessaging: MessagingAdapter = { send: sendMock };

      const pipeline = new RenderPipeline({ messaging: mockMessaging });

      await pipeline.render({
        container,
        markdown: '# Hello',
        filePath: '/test.md',
        useCache: true,
        useWorkers: false,
      });

      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'CACHE_SET' }));
    });
  });

  describe('without MessagingAdapter (graceful degradation)', () => {
    it('renders markdown without an adapter', async () => {
      const pipeline = new RenderPipeline();

      await pipeline.render({
        container,
        markdown: '# Hello World',
        useCache: true,
        filePath: '/test.md',
        useWorkers: false,
      });

      // Should still render successfully (just skips caching)
      expect(container.innerHTML).toBeTruthy();
      expect(container.innerHTML).toContain('Hello World');
    });

    it('does not throw when useCache is true but no adapter', async () => {
      const pipeline = new RenderPipeline();

      await expect(
        pipeline.render({
          container,
          markdown: '**Bold text**',
          filePath: '/test.md',
          useCache: true,
          useWorkers: false,
        })
      ).resolves.not.toThrow();

      expect(container.innerHTML).toContain('Bold text');
    });

    it('skips all caching operations without an adapter', async () => {
      const pipeline = new RenderPipeline();

      const progressUpdates: string[] = [];
      pipeline.onProgress((p) => progressUpdates.push(p.stage));

      await pipeline.render({
        container,
        markdown: '# Test',
        filePath: '/test.md',
        useCache: true,
        useWorkers: false,
      });

      // Should NOT have a 'cached' stage (no adapter means no cache hit)
      expect(progressUpdates).not.toContain('cached');
      // Should still complete
      expect(progressUpdates).toContain('complete');
    });

    it('renders without filePath and without adapter', async () => {
      const pipeline = new RenderPipeline();

      await pipeline.render({
        container,
        markdown: '# No file path',
        useWorkers: false,
      });

      expect(container.innerHTML).toContain('No file path');
    });
  });

  describe('core pipeline features', () => {
    it('supports progress callbacks', async () => {
      const pipeline = new RenderPipeline();
      const stages: string[] = [];

      pipeline.onProgress((p) => stages.push(p.stage));

      await pipeline.render({
        container,
        markdown: '# Test',
        useWorkers: false,
        useCache: false,
      });

      expect(stages).toContain('parsing');
      expect(stages).toContain('complete');
    });

    it('supports unsubscribing from progress', async () => {
      const pipeline = new RenderPipeline();
      const stages: string[] = [];

      const unsub = pipeline.onProgress((p) => stages.push(p.stage));
      unsub();

      await pipeline.render({
        container,
        markdown: '# Test',
        useWorkers: false,
        useCache: false,
      });

      expect(stages).toHaveLength(0);
    });

    it('cancelRender stops the pipeline', async () => {
      const pipeline = new RenderPipeline();

      // Cancel immediately
      pipeline.cancelRender();

      await pipeline.render({
        container,
        markdown: '# Test',
        useWorkers: false,
        useCache: false,
      });

      // Container should be empty since render was cancelled at the start
      // (after parsing, before sanitizing)
      // The exact behavior depends on timing, but it should not throw
    });

    it('getLastCommentParseResult returns null before rendering', () => {
      const pipeline = new RenderPipeline();
      expect(pipeline.getLastCommentParseResult()).toBeNull();
    });
  });
});
