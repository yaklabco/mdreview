/**
 * Regression tests for export bugs:
 * 1. Mermaid diagrams missing from DOCX export
 * 2. Extension only exporting headers for large docs (progressive hydration sections)
 * 3. Content collector dropping multi-child div contents
 * 4. SVGConverter→DOCXGenerator ID mismatch causing blank diagrams
 */
import { describe, it, expect } from 'vitest';
import { ContentCollector } from '../utils/content-collector';
import { SVGConverter } from '../utils/svg-converter';

describe('ContentCollector export regressions', () => {
  describe('mermaid diagrams inside section wrappers', () => {
    it('should collect mermaid nodes inside mdreview-section divs', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="title">Title</h1>
          <p>Introduction paragraph.</p>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
          <h2 id="architecture">Architecture</h2>
          <p>Here is a diagram:</p>
          <div class="mermaid-container mermaid-ready" id="mermaid-abc123" data-mermaid-code="graph TD; A-->B">
            <div class="mermaid-rendered">
              <svg width="200" height="100" viewBox="0 0 200 100"></svg>
            </div>
          </div>
          <p>After the diagram.</p>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const mermaidNodes = result.nodes.filter((n) => n.type === 'mermaid');
      expect(mermaidNodes).toHaveLength(1);
      expect(mermaidNodes[0].attributes.id).toBe('mermaid-abc123');
    });

    it('should collect mermaid nodes at top level (non-progressive)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h1 id="title">Title</h1>
        <p>Introduction.</p>
        <div class="mermaid-container mermaid-ready" id="mermaid-xyz789" data-mermaid-code="graph LR; X-->Y">
          <div class="mermaid-rendered">
            <svg width="300" height="150" viewBox="0 0 300 150"></svg>
          </div>
        </div>
        <p>After diagram.</p>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const mermaidNodes = result.nodes.filter((n) => n.type === 'mermaid');
      expect(mermaidNodes).toHaveLength(1);
      expect(mermaidNodes[0].attributes.id).toBe('mermaid-xyz789');
      expect(mermaidNodes[0].attributes.width).toBe('300');
      expect(mermaidNodes[0].attributes.height).toBe('150');
    });

    it('should collect multiple mermaid diagrams across multiple sections', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="title">Design Doc</h1>
          <div class="mermaid-container mermaid-ready" id="mermaid-flow1" data-mermaid-code="graph TD; A-->B">
            <div class="mermaid-rendered">
              <svg width="200" height="100" viewBox="0 0 200 100"></svg>
            </div>
          </div>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
          <h2 id="sequence">Sequence</h2>
          <div class="mermaid-container mermaid-ready" id="mermaid-seq1" data-mermaid-code="sequenceDiagram">
            <div class="mermaid-rendered">
              <svg width="400" height="300" viewBox="0 0 400 300"></svg>
            </div>
          </div>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
          <h2 id="state">State</h2>
          <p>State transitions:</p>
          <div class="mermaid-container mermaid-ready" id="mermaid-state1" data-mermaid-code="stateDiagram-v2">
            <div class="mermaid-rendered">
              <svg width="350" height="250" viewBox="0 0 350 250"></svg>
            </div>
          </div>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const mermaidNodes = result.nodes.filter((n) => n.type === 'mermaid');
      expect(mermaidNodes).toHaveLength(3);
      expect(mermaidNodes.map((n) => n.attributes.id)).toEqual([
        'mermaid-flow1',
        'mermaid-seq1',
        'mermaid-state1',
      ]);
    });
  });

  describe('full content from progressive hydration sections', () => {
    it('should collect all content from section wrapper divs (not just headings)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="title">Document Title</h1>
          <p>This is the introduction paragraph with important content.</p>
          <p>This is a second paragraph.</p>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
          <h2 id="details">Details</h2>
          <p>Detail paragraph one.</p>
          <p>Detail paragraph two.</p>
          <ul><li>Item one</li><li>Item two</li></ul>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
          <h2 id="code-section">Code Section</h2>
          <div class="code-block-wrapper" data-language="typescript">
            <pre><code class="language-typescript">const x = 1;</code></pre>
          </div>
          <div class="table-wrapper">
            <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
          </div>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      // Should have headings
      const headings = result.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(3);

      // Should have paragraphs (not just headings!)
      const paragraphs = result.nodes.filter((n) => n.type === 'paragraph');
      expect(paragraphs.length).toBeGreaterThanOrEqual(4);

      // Should have list
      const lists = result.nodes.filter((n) => n.type === 'list');
      expect(lists).toHaveLength(1);

      // Should have code block (unwrapped from code-block-wrapper)
      const codeBlocks = result.nodes.filter((n) => n.type === 'code');
      expect(codeBlocks).toHaveLength(1);
      expect(codeBlocks[0].content).toContain('const x = 1');

      // Should have table (unwrapped from table-wrapper)
      const tables = result.nodes.filter((n) => n.type === 'table');
      expect(tables).toHaveLength(1);
    });

    it('should not lose content from unhydrated skeleton sections', () => {
      // Simulate a skeleton that was NOT hydrated (still has placeholder)
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-skeleton" id="section-0" data-hydrated="false" style="min-height: 300px;">
          <h2 class="section-heading">Section Title</h2>
          <div class="section-placeholder">
            <div class="placeholder-shimmer"></div>
          </div>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      // Should still collect the heading
      const headings = result.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(1);
      expect(headings[0].content).toBe('Section Title');
    });

    it('should handle deeply nested section content (blockquotes, nested lists)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h2 id="quotes">Quotes</h2>
          <blockquote><p>This is a blockquote.</p></blockquote>
          <ul>
            <li>Top level item
              <ul>
                <li>Nested item</li>
              </ul>
            </li>
          </ul>
          <hr>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const headings = result.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(1);

      const blockquotes = result.nodes.filter((n) => n.type === 'blockquote');
      expect(blockquotes).toHaveLength(1);

      const lists = result.nodes.filter((n) => n.type === 'list');
      expect(lists).toHaveLength(1);

      const hrs = result.nodes.filter((n) => n.type === 'hr');
      expect(hrs).toHaveLength(1);
    });

    it('should handle mixed hydrated and unhydrated sections', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="intro">Introduction</h1>
          <p>This section is fully hydrated with real content.</p>
        </div>
        <div class="mdreview-section mdreview-section-skeleton" id="section-1" data-hydrated="false">
          <h2 class="section-heading">Details</h2>
          <div class="section-placeholder"><div class="placeholder-shimmer"></div></div>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
          <h2 id="conclusion">Conclusion</h2>
          <p>Final thoughts here.</p>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const headings = result.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(3);

      // Hydrated sections should contribute paragraphs
      const paragraphs = result.nodes.filter((n) => n.type === 'paragraph');
      expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve node order matching document order', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
          <h1 id="title">Title</h1>
          <p>Intro</p>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
          <h2 id="mid">Middle</h2>
          <p>Body</p>
        </div>
        <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
          <h2 id="end">End</h2>
          <p>Conclusion</p>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      const types = result.nodes.map(
        (n) => `${n.type}:${typeof n.content === 'string' ? n.content : ''}`
      );
      expect(types).toEqual([
        'heading:Title',
        'paragraph:Intro',
        'heading:Middle',
        'paragraph:Body',
        'heading:End',
        'paragraph:Conclusion',
      ]);
    });
  });

  describe('multi-child div regression (commit 6665cdd)', () => {
    it('should not return null for divs with multiple children', () => {
      // This was the exact bug: processContainer returned null
      // when a div had more than one child element
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mdreview-section" id="section-0">
          <h2>Heading</h2>
          <p>First paragraph.</p>
          <p>Second paragraph.</p>
          <p>Third paragraph.</p>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      // Must have all 4 elements, not just the heading
      expect(result.nodes).toHaveLength(4);
      expect(result.nodes[0].type).toBe('heading');
      expect(result.nodes[1].type).toBe('paragraph');
      expect(result.nodes[2].type).toBe('paragraph');
      expect(result.nodes[3].type).toBe('paragraph');
    });

    it('should flatten nested generic divs correctly', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div>
          <div>
            <h1>Deep Heading</h1>
            <p>Deep paragraph.</p>
          </div>
        </div>
      `;

      const collector = new ContentCollector();
      const result = collector.collect(container);

      expect(result.nodes.length).toBeGreaterThanOrEqual(2);
      const heading = result.nodes.find((n) => n.type === 'heading');
      expect(heading).toBeDefined();
      expect(heading!.content).toBe('Deep Heading');
    });
  });

  describe('ContentCollector + SVGConverter ID agreement', () => {
    it('should produce matching IDs between collector mermaid nodes and converter images', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <h1>Doc</h1>
        <div class="mermaid-container mermaid-ready" id="mermaid-abc">
          <div class="mermaid-rendered">
            <svg width="200" height="100" viewBox="0 0 200 100" id="mermaid-svg-abc">
              <rect width="200" height="100" fill="white"/>
            </svg>
          </div>
        </div>
        <div class="mermaid-container mermaid-ready" id="mermaid-def">
          <div class="mermaid-rendered">
            <svg width="300" height="150" viewBox="0 0 300 150" id="mermaid-svg-def">
              <rect width="300" height="150" fill="white"/>
            </svg>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      // Step 1: Collect content (as ExportController does)
      const collector = new ContentCollector();
      const content = collector.collect(container);

      // Step 2: Query mermaid SVGs (as ExportController does)
      const svgElements = Array.from(
        container.querySelectorAll<SVGElement>('.mermaid-container svg')
      );

      // Step 3: Convert SVGs (as ExportController does)
      const converter = new SVGConverter();
      const images = converter.convertAll(svgElements);

      // Verify: every mermaid node ID from the collector has a matching image
      const mermaidNodes = content.nodes.filter((n) => n.type === 'mermaid');
      expect(mermaidNodes).toHaveLength(2);

      for (const node of mermaidNodes) {
        const id = node.attributes.id as string;
        expect(images.has(id)).toBe(true);
        expect(images.get(id)!.format).toBe('svg');
        expect(images.get(id)!.width).toBeGreaterThan(0);
      }

      container.remove();
    });

    it('should NOT match when using generic svg query (demonstrates the old bug)', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="mermaid-container mermaid-ready" id="mermaid-only">
          <div class="mermaid-rendered">
            <svg width="200" height="100" viewBox="0 0 200 100">
              <rect width="200" height="100" fill="white"/>
            </svg>
          </div>
        </div>
        <svg width="16" height="16" id="unrelated-icon"><circle r="8"/></svg>
      `;
      document.body.appendChild(container);

      // The correct query: only mermaid SVGs
      const mermaidSvgs = Array.from(
        container.querySelectorAll<SVGElement>('.mermaid-container svg')
      );
      expect(mermaidSvgs).toHaveLength(1);

      // The old buggy query: ALL svgs
      const allSvgs = Array.from(container.querySelectorAll<SVGElement>('svg'));
      expect(allSvgs).toHaveLength(2); // Would include the icon

      container.remove();
    });
  });
});
