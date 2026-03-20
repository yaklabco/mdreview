/**
 * Unit tests for Mermaid Renderer
 * Covers: render queue, timeout cleanup, and state management
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestContainer, cleanupTestContainer, mockConsole } from '../../helpers/test-utils';
import { waitFor } from '../../helpers/mocks';

// vi.mock factories are hoisted - cannot reference outer variables
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn().mockResolvedValue({ diagramType: 'flowchart-v2', config: {} }),
    render: vi.fn().mockResolvedValue({ svg: '<svg id="test">mock</svg>', diagramType: 'flowchart-v2' }),
  },
}));

vi.mock('panzoom', () => ({
  default: vi.fn().mockReturnValue({
    dispose: vi.fn(),
    getTransform: vi.fn().mockReturnValue({ scale: 1, x: 0, y: 0 }),
    moveTo: vi.fn(),
    zoomAbs: vi.fn(),
    zoomTo: vi.fn(),
    smoothZoomAbs: vi.fn(),
  }),
}));

// Import after mocks are set up
import mermaid from 'mermaid';
import Panzoom from 'panzoom';
import { MermaidRenderer } from '../../../src/renderers/mermaid-renderer';

describe('MermaidRenderer', () => {
  let renderer: MermaidRenderer;
  let container: HTMLElement;
  let consoleMock: { restore: () => void };

  beforeEach(() => {
    consoleMock = mockConsole();
    container = createTestContainer();
    vi.clearAllMocks();

    // Reset mermaid mocks to success state
    vi.mocked(mermaid.parse).mockResolvedValue({ diagramType: 'flowchart-v2', config: {} });
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg id="test">mock diagram</svg>', diagramType: 'flowchart-v2' });

    renderer = new MermaidRenderer();
  });

  afterEach(() => {
    renderer.cleanup();
    cleanupTestContainer(container);
    consoleMock.restore();
  });

  /**
   * Helper: create a mermaid container element in the DOM with code registered
   */
  function createMermaidContainer(id: string, code: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'mermaid-container mermaid-pending';
    el.innerHTML = '<div class="mermaid-loading">Rendering diagram...</div>';
    el.setAttribute('data-mermaid-code', code);
    container.appendChild(el);

    // Register in global registry
    const win = window as { __MDVIEW_MERMAID_CODE__?: Map<string, string> };
    if (!win.__MDVIEW_MERMAID_CODE__) {
      win.__MDVIEW_MERMAID_CODE__ = new Map();
    }
    win.__MDVIEW_MERMAID_CODE__.set(id, code);

    return el;
  }

  describe('renderDiagram', () => {
    test('should render a valid mermaid diagram', async () => {
      const el = createMermaidContainer('mermaid-test1', 'graph TD\n  A-->B');

      await renderer.renderDiagram('mermaid-test1');

      expect(mermaid.parse).toHaveBeenCalledWith('graph TD\n  A-->B');
      expect(mermaid.render).toHaveBeenCalled();
      expect(el.classList.contains('mermaid-ready')).toBe(true);
      expect(el.classList.contains('mermaid-pending')).toBe(false);
      expect(el.querySelector('.mermaid-rendered')).not.toBeNull();
    });

    test('should show error for invalid syntax', async () => {
      vi.mocked(mermaid.parse).mockRejectedValue(new Error('Parse error: invalid syntax'));
      const el = createMermaidContainer('mermaid-bad', 'not valid mermaid');

      await renderer.renderDiagram('mermaid-bad');

      expect(el.classList.contains('mermaid-error')).toBe(true);
      expect(el.innerHTML).toContain('Mermaid Diagram Error');
    });

    test('should skip already-rendered containers', async () => {
      const el = createMermaidContainer('mermaid-done', 'graph TD\n  A-->B');
      // Simulate already rendered by adding SVG
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-rendered';
      wrapper.innerHTML = '<svg>already rendered</svg>';
      el.innerHTML = '';
      el.appendChild(wrapper);

      await renderer.renderDiagram('mermaid-done');

      // Should not call mermaid.render again
      expect(mermaid.render).not.toHaveBeenCalled();
    });

    test('should handle missing container gracefully', async () => {
      await renderer.renderDiagram('nonexistent-id');
      expect(mermaid.render).not.toHaveBeenCalled();
    });

    test('should handle missing code gracefully', async () => {
      const el = document.createElement('div');
      el.id = 'mermaid-nocode';
      el.className = 'mermaid-container mermaid-pending';
      container.appendChild(el);

      await renderer.renderDiagram('mermaid-nocode');

      expect(mermaid.render).not.toHaveBeenCalled();
    });
  });

  describe('render queue serialization', () => {
    test('should serialize concurrent renders through the queue', async () => {
      createMermaidContainer('mermaid-q1', 'graph TD\n  A-->B');
      createMermaidContainer('mermaid-q2', 'graph TD\n  C-->D');

      // Make the first render slow - resolves only when we call resolveFirst()
      let resolveFirst!: (value: { svg: string; diagramType: string }) => void;
      vi.mocked(mermaid.render)
        .mockImplementationOnce(
          () => new Promise((resolve) => { resolveFirst = resolve; })
        )
        .mockResolvedValueOnce({ svg: '<svg>second</svg>', diagramType: 'flowchart-v2' });

      // Start first render - it will proceed through validateSyntax, then block on mermaid.render
      const p1 = renderer.renderDiagram('mermaid-q1');

      // Wait for validateSyntax (mermaid.parse) to resolve so mermaid.render gets called
      await waitFor(10);

      // Now start second render - isRendering should be true, so it gets queued
      void renderer.renderDiagram('mermaid-q2');

      // First render's mermaid.render should have been called once
      expect(mermaid.render).toHaveBeenCalledTimes(1);

      // Complete first render
      resolveFirst({ svg: '<svg>first</svg>', diagramType: 'flowchart-v2' });
      await p1;

      // Wait for queue processing
      await waitFor(50);

      // Second render should have been processed from queue
      expect(mermaid.render).toHaveBeenCalledTimes(2);
    });

    test('should reset isRendering flag even on error', async () => {
      createMermaidContainer('mermaid-err', 'graph TD\n  A-->B');
      createMermaidContainer('mermaid-after', 'graph TD\n  C-->D');

      // First render fails at mermaid.render
      vi.mocked(mermaid.render)
        .mockRejectedValueOnce(new Error('Render failed'))
        .mockResolvedValueOnce({ svg: '<svg>recovered</svg>', diagramType: 'flowchart-v2' });

      // First render - will fail
      await renderer.renderDiagram('mermaid-err');

      const errEl = document.getElementById('mermaid-err');
      expect(errEl?.classList.contains('mermaid-error')).toBe(true);

      // Second render should work since isRendering was reset in finally
      await renderer.renderDiagram('mermaid-after');

      const afterEl = document.getElementById('mermaid-after');
      expect(afterEl?.classList.contains('mermaid-ready')).toBe(true);
    });
  });

  describe('render timeout', () => {
    test('should timeout after 5 seconds and show error', async () => {
      vi.useFakeTimers();

      createMermaidContainer('mermaid-slow', 'graph TD\n  A-->B');

      // parse resolves immediately, but render never resolves
      vi.mocked(mermaid.render).mockImplementation(() => new Promise(() => {}));

      const renderPromise = renderer.renderDiagram('mermaid-slow');

      // Allow microtasks (validateSyntax) to run
      await vi.advanceTimersByTimeAsync(0);

      // Advance past the 5-second timeout
      await vi.advanceTimersByTimeAsync(5100);

      await renderPromise;

      const el = document.getElementById('mermaid-slow');
      expect(el?.classList.contains('mermaid-error')).toBe(true);
      expect(el?.innerHTML).toContain('Render timeout');

      vi.useRealTimers();
    });

    test('should reset isRendering after timeout so queue continues', async () => {
      vi.useFakeTimers();

      createMermaidContainer('mermaid-timeout1', 'graph TD\n  A-->B');
      createMermaidContainer('mermaid-timeout2', 'graph TD\n  C-->D');

      // First render hangs, second succeeds
      vi.mocked(mermaid.render)
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValueOnce({ svg: '<svg>recovered</svg>', diagramType: 'flowchart-v2' });

      const p1 = renderer.renderDiagram('mermaid-timeout1');

      // Let validateSyntax complete and mermaid.render start
      await vi.advanceTimersByTimeAsync(0);

      // Queue second render
      renderer.renderDiagram('mermaid-timeout2');

      // Trigger timeout for first render
      await vi.advanceTimersByTimeAsync(5100);

      await p1;

      // Wait for queue to process second render
      await vi.advanceTimersByTimeAsync(100);

      const el1 = document.getElementById('mermaid-timeout1');
      expect(el1?.classList.contains('mermaid-error')).toBe(true);

      const el2 = document.getElementById('mermaid-timeout2');
      expect(el2?.classList.contains('mermaid-ready')).toBe(true);

      vi.useRealTimers();
    });

    test('should clean up orphaned mermaid DOM elements after timeout', async () => {
      vi.useFakeTimers();

      createMermaidContainer('mermaid-orphan', 'graph TD\n  A-->B');

      // Simulate mermaid leaving orphaned SVG elements during rendering
      vi.mocked(mermaid.render).mockImplementation(async (svgId: string) => {
        const orphan = document.createElement('svg');
        orphan.id = svgId;
        document.body.appendChild(orphan);
        // Hang forever
        return new Promise(() => {});
      });

      const renderPromise = renderer.renderDiagram('mermaid-orphan');

      // Let validateSyntax + mermaid.render start
      await vi.advanceTimersByTimeAsync(0);

      // Trigger timeout
      await vi.advanceTimersByTimeAsync(5100);

      await renderPromise;

      // Orphaned SVG should have been cleaned up
      const orphanedSvg = document.getElementById('mermaid-svg-mermaid-orphan');
      expect(orphanedSvg).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('renderAll', () => {
    test('should render all pending diagrams in a container', async () => {
      createMermaidContainer('mermaid-all1', 'graph TD\n  A-->B');
      createMermaidContainer('mermaid-all2', 'graph TD\n  C-->D');

      // Force no observer for immediate rendering
      renderer.cleanup();
      renderer = new MermaidRenderer();
      (renderer as any).observer = null;

      await renderer.renderAll(container);

      // Both should be rendered (queue processes sequentially)
      await waitFor(100);

      expect(mermaid.render).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    test('should dispose all panzoom instances', async () => {
      createMermaidContainer('mermaid-cleanup1', 'graph TD\n  A-->B');
      await renderer.renderDiagram('mermaid-cleanup1');

      const panzoomInstance = vi.mocked(Panzoom).mock.results[0]?.value;
      renderer.cleanup();

      expect(panzoomInstance.dispose).toHaveBeenCalled();
    });

    test('should not throw on double cleanup', () => {
      renderer.cleanup();
      expect(() => renderer.cleanup()).not.toThrow();
    });
  });
});
