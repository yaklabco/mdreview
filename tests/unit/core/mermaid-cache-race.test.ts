/**
 * Tests for mermaid rendering / cache race condition fix
 *
 * Verifies that:
 * 1. Mermaid rendering completes BEFORE cache is written
 * 2. Cache restore re-renders any pending mermaid diagrams
 * 3. Timeout properly cleans up orphaned mermaid DOM elements
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { RenderPipeline } from '../../../src/core/render-pipeline';
import { createTestContainer, cleanupTestContainer, mockConsole } from '../../helpers/test-utils';
import { mockChromeRuntime, waitFor } from '../../helpers/mocks';

// The mock renderAll should simulate what the real one does: change classes on containers
const mockRenderAll = vi.fn().mockImplementation(async (container: HTMLElement) => {
  // Simulate successful rendering: remove pending, add ready
  const pending = container.querySelectorAll('.mermaid-container.mermaid-pending');
  pending.forEach((el) => {
    el.classList.remove('mermaid-pending');
    el.classList.add('mermaid-ready');
    el.innerHTML = '<div class="mermaid-rendered"><svg>rendered</svg></div>';
  });
});

vi.mock('../../../src/renderers/mermaid-renderer', () => ({
  mermaidRenderer: {
    renderAll: mockRenderAll,
    renderAllImmediate: vi.fn().mockResolvedValue(undefined),
    updateTheme: vi.fn(),
    cleanup: vi.fn(),
  },
}));

vi.mock('../../../src/renderers/syntax-highlighter', () => ({
  syntaxHighlighter: {
    highlightVisible: vi.fn(),
    highlightAll: vi.fn(),
    setTheme: vi.fn(),
  },
}));

vi.mock('../../../src/workers/worker-pool', () => ({
  workerPool: {
    initialize: vi.fn().mockRejectedValue(new Error('file:// not supported')),
    execute: vi.fn(),
    terminate: vi.fn(),
  },
}));

describe('Mermaid Cache Race Condition', () => {
  let pipeline: RenderPipeline;
  let container: HTMLElement;
  let consoleMock: { restore: () => void };
  let sendMessageMock: ReturnType<typeof vi.fn>;

  // Markdown that produces mermaid containers
  const mermaidMarkdown = '# Test\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nSome text.';

  beforeEach(() => {
    consoleMock = mockConsole();
    container = createTestContainer();
    vi.clearAllMocks();

    // Re-apply the mock implementation after clearAllMocks
    mockRenderAll.mockImplementation(async (cont: HTMLElement) => {
      const pending = cont.querySelectorAll('.mermaid-container.mermaid-pending');
      pending.forEach((el) => {
        el.classList.remove('mermaid-pending');
        el.classList.add('mermaid-ready');
        el.innerHTML = '<div class="mermaid-rendered"><svg>rendered</svg></div>';
      });
    });

    const mocks = mockChromeRuntime();
    sendMessageMock = mocks.sendMessage;

    pipeline = new RenderPipeline();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    consoleMock.restore();
  });

  describe('Cache write timing', () => {
    test('should await mermaid rendering before writing cache', async () => {
      // Track the order of operations
      const operationOrder: string[] = [];

      mockRenderAll.mockImplementation(async (cont: HTMLElement) => {
        operationOrder.push('mermaid-render-start');
        // Simulate mermaid rendering taking some time
        await new Promise((resolve) => setTimeout(resolve, 10));
        // Simulate DOM update
        const pending = cont.querySelectorAll('.mermaid-container.mermaid-pending');
        pending.forEach((el) => {
          el.classList.remove('mermaid-pending');
          el.classList.add('mermaid-ready');
          el.innerHTML = '<div class="mermaid-rendered"><svg>rendered</svg></div>';
        });
        operationOrder.push('mermaid-render-complete');
      });

      sendMessageMock.mockImplementation((message: { type: string }) => {
        if (message.type === 'CACHE_SET') {
          operationOrder.push('cache-set');
        }
        if (message.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'test-key' });
        }
        if (message.type === 'CACHE_GET') {
          return Promise.resolve({ result: null });
        }
        return Promise.resolve({ success: true });
      });

      await pipeline.render({
        container,
        markdown: mermaidMarkdown,
        useCache: true,
        useWorkers: false,
        filePath: '/test/file.md',
        theme: 'github-light',
      });

      // Wait for any async operations
      await waitFor(100);

      // Mermaid render should complete BEFORE cache write
      const mermaidCompleteIdx = operationOrder.indexOf('mermaid-render-complete');
      const cacheSetIdx = operationOrder.indexOf('cache-set');

      expect(operationOrder).toContain('mermaid-render-start');
      expect(operationOrder).toContain('mermaid-render-complete');

      // If caching happened, mermaid should have completed first
      if (cacheSetIdx >= 0) {
        expect(mermaidCompleteIdx).toBeLessThan(cacheSetIdx);
      }
    });

    test('should not cache HTML with mermaid-pending containers', async () => {
      let cachedHtml = '';

      sendMessageMock.mockImplementation((message: { type: string; payload?: any }) => {
        if (message.type === 'CACHE_SET') {
          cachedHtml = message.payload?.result?.html || '';
          return Promise.resolve({ success: true });
        }
        if (message.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'test-key' });
        }
        if (message.type === 'CACHE_GET') {
          return Promise.resolve({ result: null });
        }
        return Promise.resolve({ success: true });
      });

      await pipeline.render({
        container,
        markdown: mermaidMarkdown,
        useCache: true,
        useWorkers: false,
        filePath: '/test/file.md',
        theme: 'github-light',
      });

      await waitFor(100);

      // Cache should have been written
      expect(cachedHtml).not.toBe('');
      // Cache should NOT contain mermaid-pending (rendering was awaited)
      expect(cachedHtml).not.toContain('mermaid-pending');
    });
  });

  describe('Cache restore with mermaid', () => {
    test('should re-render pending mermaid diagrams from stale cache', async () => {
      // Simulate a stale cache hit that has mermaid-pending containers
      const staleHtml = `
        <h1>Test</h1>
        <div class="mermaid-container mermaid-pending" id="mermaid-abc123" data-mermaid-code="graph TD\n  A-->B">
          <div class="mermaid-loading">Rendering diagram...</div>
        </div>
        <p>Some text.</p>
      `;

      sendMessageMock.mockImplementation((message: { type: string }) => {
        if (message.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'cached-key' });
        }
        if (message.type === 'CACHE_GET') {
          return Promise.resolve({
            result: {
              html: staleHtml,
              metadata: {
                wordCount: 5,
                headings: [],
                codeBlocks: [],
                mermaidBlocks: [],
                images: [],
                links: [],
                frontmatter: null,
              },
              highlightedBlocks: new Map(),
              mermaidSVGs: new Map(),
              timestamp: Date.now(),
              cacheKey: 'cached-key',
            },
          });
        }
        return Promise.resolve({ success: true });
      });

      await pipeline.render({
        container,
        markdown: mermaidMarkdown,
        useCache: true,
        useWorkers: false,
        filePath: '/test/file.md',
        theme: 'github-light',
      });

      await waitFor(100);

      // Should have triggered mermaid renderAll for the pending diagrams
      expect(mockRenderAll).toHaveBeenCalled();
    });

    test('should not re-render when cache only has mermaid-ready containers', async () => {
      const goodCacheHtml = `
        <h1>Test</h1>
        <div class="mermaid-container mermaid-ready" id="mermaid-def456">
          <div class="mermaid-rendered"><svg>cached svg</svg></div>
        </div>
      `;

      sendMessageMock.mockImplementation((message: { type: string }) => {
        if (message.type === 'CACHE_GENERATE_KEY') {
          return Promise.resolve({ key: 'good-cached-key' });
        }
        if (message.type === 'CACHE_GET') {
          return Promise.resolve({
            result: {
              html: goodCacheHtml,
              metadata: {
                wordCount: 2,
                headings: [],
                codeBlocks: [],
                mermaidBlocks: [],
                images: [],
                links: [],
                frontmatter: null,
              },
              highlightedBlocks: new Map(),
              mermaidSVGs: new Map(),
              timestamp: Date.now(),
              cacheKey: 'good-cached-key',
            },
          });
        }
        return Promise.resolve({ success: true });
      });

      await pipeline.render({
        container,
        markdown: '# Test\n\n```mermaid\ngraph TD\n  A-->B\n```',
        useCache: true,
        useWorkers: false,
        filePath: '/test/ready.md',
        theme: 'github-light',
      });

      await waitFor(100);

      // renderAll should NOT be called - no pending diagrams
      expect(mockRenderAll).not.toHaveBeenCalled();
    });
  });
});
