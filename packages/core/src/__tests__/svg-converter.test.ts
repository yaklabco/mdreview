/**
 * SVGConverter regression tests
 *
 * Guards against:
 * - Mermaid container ID not matching ContentCollector's mermaid node IDs
 * - Dimension extraction failures
 * - foreignObject conversion breaking diagram text
 * - convertAll silently dropping diagrams on error
 */
import { describe, it, expect } from 'vitest';
import { SVGConverter } from '../utils/svg-converter';

/**
 * Helper: create a minimal SVG element inside an optional mermaid container.
 * Returns the SVG (which is what SVGConverter.convert() receives).
 */
function createMermaidSvg(
  containerId: string,
  opts: { width?: number; height?: number; svgId?: string } = {}
): { svg: SVGElement; container: HTMLDivElement } {
  const { width = 200, height = 100, svgId } = opts;
  const container = document.createElement('div');
  container.className = 'mermaid-container mermaid-ready';
  container.id = containerId;

  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-rendered';
  container.appendChild(wrapper);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  if (svgId) svg.id = svgId;
  wrapper.appendChild(svg);

  // Must be in the document for closest() to work
  document.body.appendChild(container);

  return { svg, container };
}

function createStandaloneSvg(
  id: string,
  opts: { width?: number; height?: number } = {}
): SVGElement {
  const { width = 16, height = 16 } = opts;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = id;
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  document.body.appendChild(svg);
  return svg;
}

describe('SVGConverter', () => {
  describe('mermaid container ID matching', () => {
    it('should use the mermaid container ID, not the SVG element ID', () => {
      const { svg, container } = createMermaidSvg('mermaid-abc123', {
        svgId: 'mermaid-svg-inner',
      });

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.id).toBe('mermaid-abc123');
      container.remove();
    });

    it('should fall back to SVG id when not inside a mermaid container', () => {
      const svg = createStandaloneSvg('standalone-icon');

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.id).toBe('standalone-icon');
      svg.remove();
    });

    it('should generate a fallback ID when neither container nor SVG has one', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '50');
      svg.setAttribute('height', '50');
      document.body.appendChild(svg);

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.id).toMatch(/^svg-\d+$/);
      svg.remove();
    });
  });

  describe('convertAll', () => {
    it('should produce a Map keyed by mermaid container IDs', () => {
      const { svg: svg1, container: c1 } = createMermaidSvg('mermaid-aaa', {
        width: 300,
        height: 200,
      });
      const { svg: svg2, container: c2 } = createMermaidSvg('mermaid-bbb', {
        width: 400,
        height: 250,
      });

      const converter = new SVGConverter();
      const images = converter.convertAll([svg1, svg2]);

      expect(images.size).toBe(2);
      expect(images.has('mermaid-aaa')).toBe(true);
      expect(images.has('mermaid-bbb')).toBe(true);
      expect(images.get('mermaid-aaa')!.width).toBe(300);
      expect(images.get('mermaid-bbb')!.width).toBe(400);

      c1.remove();
      c2.remove();
    });

    it('should skip failing SVGs and still convert the rest', () => {
      const { svg: goodSvg, container } = createMermaidSvg('mermaid-good', {
        width: 100,
        height: 50,
      });

      // Create an SVG that will fail serialization by detaching it
      const badSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      // Override serializeToString to throw for this SVG
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const origSerialize = XMLSerializer.prototype.serializeToString;
      let callCount = 0;
      XMLSerializer.prototype.serializeToString = function (node) {
        callCount++;
        if (callCount === 1) throw new Error('Simulated failure');
        return origSerialize.call(this, node);
      };

      const converter = new SVGConverter();
      const images = converter.convertAll([badSvg, goodSvg]);

      // Restore
      XMLSerializer.prototype.serializeToString = origSerialize;

      expect(images.size).toBe(1);
      expect(images.has('mermaid-good')).toBe(true);

      container.remove();
    });
  });

  describe('dimension extraction', () => {
    it('should read width/height attributes', () => {
      const { svg, container } = createMermaidSvg('mermaid-dim1', { width: 500, height: 300 });

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.width).toBe(500);
      expect(result.height).toBe(300);
      container.remove();
    });

    it('should fall back to viewBox when width/height missing', () => {
      const container = document.createElement('div');
      container.className = 'mermaid-container mermaid-ready';
      container.id = 'mermaid-vb';
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-rendered';
      container.appendChild(wrapper);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 800 400');
      // No width/height attributes
      wrapper.appendChild(svg);
      document.body.appendChild(container);

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.width).toBe(800);
      expect(result.height).toBe(400);
      container.remove();
    });
  });

  describe('SVG output format', () => {
    it('should produce base64-encoded SVG format', () => {
      const { svg, container } = createMermaidSvg('mermaid-fmt', { width: 100, height: 50 });

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      expect(result.format).toBe('svg');
      expect(result.data).toBeTruthy();
      // Decode and verify it's valid SVG XML
      const decoded = atob(result.data);
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('xmlns="http://www.w3.org/2000/svg"');

      container.remove();
    });
  });

  describe('foreignObject conversion', () => {
    it('should replace foreignObject elements with SVG text', () => {
      const container = document.createElement('div');
      container.className = 'mermaid-container mermaid-ready';
      container.id = 'mermaid-fo';
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-rendered';
      container.appendChild(wrapper);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.innerHTML = `
        <foreignObject x="10" y="10" width="80" height="30">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <span>Node Label</span>
          </div>
        </foreignObject>
      `;
      wrapper.appendChild(svg);
      document.body.appendChild(container);

      const converter = new SVGConverter();
      const result = converter.convert(svg);

      // foreignObject should have been replaced — the output SVG
      // should contain text with "Node Label" but no foreignObject
      const decoded = atob(result.data);
      expect(decoded).not.toContain('foreignObject');
      expect(decoded).toContain('Node Label');

      container.remove();
    });
  });
});
