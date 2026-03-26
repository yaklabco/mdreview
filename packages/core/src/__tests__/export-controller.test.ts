/**
 * ExportController regression tests
 *
 * Guards against:
 * - Mermaid diagrams not being force-rendered before export
 * - Wrong SVG query selector missing mermaid diagrams
 * - Content from progressive hydration sections being dropped
 * - Export pipeline silently swallowing errors
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the mermaid renderer so renderAllImmediate is observable
const mockRenderAllImmediate = vi.fn().mockResolvedValue(undefined);
vi.mock('../renderers/mermaid-renderer', () => ({
  mermaidRenderer: {
    renderAllImmediate: mockRenderAllImmediate,
  },
}));

// Mock DOCXGenerator to avoid @jamesainslie/docx dependency in unit tests
vi.mock('../utils/docx-generator', () => ({
  DOCXGenerator: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.generate = vi
      .fn()
      .mockResolvedValue(new Blob(['mock-docx'], { type: 'application/octet-stream' }));
  }),
}));

import { ExportController } from '../export-controller';
import { ContentCollector } from '../utils/content-collector';
import { SVGConverter } from '../utils/svg-converter';

describe('ExportController', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    container.id = 'mdreview-container';
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  describe('mermaid force-rendering before export', () => {
    it('should call renderAllImmediate when mermaid containers exist', async () => {
      container.innerHTML = `
        <h1>Title</h1>
        <p>Content</p>
        <div class="mermaid-container mermaid-ready" id="mermaid-test1">
          <div class="mermaid-rendered">
            <svg width="200" height="100" viewBox="0 0 200 100"></svg>
          </div>
        </div>
      `;

      const controller = new ExportController();
      // Stub downloadBlob to prevent actual download
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      await controller.export(container, { format: 'docx', filename: 'test' });

      expect(mockRenderAllImmediate).toHaveBeenCalledWith(container);
    });

    it('should skip renderAllImmediate when no mermaid containers exist', async () => {
      container.innerHTML = `
        <h1>Title</h1>
        <p>Just text, no diagrams.</p>
      `;

      const controller = new ExportController();
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      await controller.export(container, { format: 'docx', filename: 'test' });

      expect(mockRenderAllImmediate).not.toHaveBeenCalled();
    });

    it('should still export even if renderAllImmediate throws', async () => {
      mockRenderAllImmediate.mockRejectedValueOnce(new Error('mermaid init failed'));

      container.innerHTML = `
        <h1>Title</h1>
        <div class="mermaid-container mermaid-pending" id="mermaid-broken">
          <div class="mermaid-loading">Loading...</div>
        </div>
      `;

      const controller = new ExportController();
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      // Should not throw — the error is caught and export continues
      await expect(
        controller.export(container, { format: 'docx', filename: 'test' })
      ).resolves.toBeUndefined();
    });
  });

  describe('SVG query selector', () => {
    it('should only query SVGs inside .mermaid-container, not all SVGs', async () => {
      container.innerHTML = `
        <h1>Title</h1>
        <div class="mermaid-container mermaid-ready" id="mermaid-dia1">
          <div class="mermaid-rendered">
            <svg width="200" height="100" id="mermaid-svg-1" viewBox="0 0 200 100">
              <rect width="200" height="100" fill="white"/>
            </svg>
          </div>
        </div>
        <p>Some text with an icon <svg width="16" height="16" id="icon-svg"><circle r="8"/></svg></p>
      `;

      const convertAllSpy = vi.spyOn(SVGConverter.prototype, 'convertAll');

      const controller = new ExportController();
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      await controller.export(container, { format: 'docx', filename: 'test' });

      // The SVGs passed to convertAll should only be mermaid SVGs
      const svgsArg = convertAllSpy.mock.calls[0][0];
      expect(svgsArg).toHaveLength(1);
      expect(svgsArg[0].id).toBe('mermaid-svg-1');

      convertAllSpy.mockRestore();
    });
  });

  describe('progressive hydration section content', () => {
    it('should collect all content from section wrappers in a full export flow', async () => {
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="title">Architecture</h1>
          <p>This system uses microservices.</p>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
          <h2 id="components">Components</h2>
          <p>API Gateway handles routing.</p>
          <p>Auth service validates tokens.</p>
          <ul><li>Gateway</li><li>Auth</li><li>Data</li></ul>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
          <h2 id="diagrams">Diagrams</h2>
          <div class="mermaid-container mermaid-ready" id="mermaid-arch">
            <div class="mermaid-rendered">
              <svg width="400" height="200" viewBox="0 0 400 200">
                <rect width="400" height="200" fill="white"/>
              </svg>
            </div>
          </div>
        </div>
      `;

      const collectSpy = vi.spyOn(ContentCollector.prototype, 'collect');

      const controller = new ExportController();
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      await controller.export(container, { format: 'docx', filename: 'test' });

      interface ContentNode {
        type: string;
        attributes: Record<string, string>;
      }
      interface CollectedContent {
        nodes: ContentNode[];
      }
      const collectedContent = collectSpy.mock.results[0]?.value as CollectedContent;

      // Must have headings
      const headings = collectedContent.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(3);

      // Must have paragraphs (the actual content, not just headings!)
      const paragraphs = collectedContent.nodes.filter((n) => n.type === 'paragraph');
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);

      // Must have the list
      const lists = collectedContent.nodes.filter((n) => n.type === 'list');
      expect(lists).toHaveLength(1);

      // Must have the mermaid diagram
      const mermaids = collectedContent.nodes.filter((n) => n.type === 'mermaid');
      expect(mermaids).toHaveLength(1);
      expect(mermaids[0].attributes.id).toBe('mermaid-arch');

      collectSpy.mockRestore();
    });
  });

  describe('progress reporting', () => {
    it('should report progress through all stages', async () => {
      container.innerHTML = '<h1>Simple Doc</h1><p>Content.</p>';

      const stages: string[] = [];
      const controller = new ExportController();
      (controller as unknown as Record<string, unknown>)['downloadBlob'] = vi
        .fn()
        .mockResolvedValue(undefined);

      await controller.export(container, { format: 'docx', filename: 'test' }, (progress) => {
        if (!stages.includes(progress.stage)) {
          stages.push(progress.stage);
        }
      });

      expect(stages).toContain('collecting');
      expect(stages).toContain('converting');
      expect(stages).toContain('generating');
      expect(stages).toContain('downloading');
    });
  });
});
