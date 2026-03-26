/**
 * Integration tests for the full DOCX export pipeline.
 *
 * These tests wire ContentCollector → SVGConverter → DOCXGenerator against
 * realistic DOM structures and verify the generated DOCX blob is correct.
 *
 * They exist to catch two specific regressions:
 *   1. Mermaid diagrams silently missing from DOCX output
 *   2. Large documents with progressive hydration exporting only headings
 */
import { describe, it, expect } from 'vitest';
import { ContentCollector } from '../utils/content-collector';
import { SVGConverter } from '../utils/svg-converter';
import { DOCXGenerator } from '../utils/docx-generator';
import JSZip from 'jszip';

// ── helpers ──────────────────────────────────────────────────────────

/** Unzip a DOCX blob and return the main document.xml content as text. */
async function extractDocumentXml(blob: Blob): Promise<string> {
  // JSDOM Blob may not have arrayBuffer(), so read via FileReader-style workaround
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) throw new Error('document.xml not found in DOCX');
  return docXml.async('text');
}

/** Count occurrences of a substring in text. */
function countOccurrences(text: string, substring: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(substring, pos)) !== -1) {
    count++;
    pos += substring.length;
  }
  return count;
}

/**
 * Run the full export pipeline on a container: collect → convert SVGs → generate DOCX.
 * Returns the blob and the raw document.xml text.
 */
async function exportContainer(container: HTMLElement) {
  const collector = new ContentCollector();
  const content = collector.collect(container);

  const svgElements = Array.from(container.querySelectorAll<SVGElement>('.mermaid-container svg'));
  const converter = new SVGConverter();
  const images = converter.convertAll(svgElements);

  const generator = new DOCXGenerator();
  const blob = await generator.generate(content, images, { title: content.title });

  const xml = await extractDocumentXml(blob);
  return { blob, xml, content, images };
}

// ── tests ────────────────────────────────────────────────────────────

describe('DOCX export integration — mermaid diagrams', () => {
  it('should include mermaid diagram images in the generated DOCX', async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Architecture</h1>
      <p>Here is the system diagram:</p>
      <div class="mermaid-container mermaid-ready" id="mermaid-arch1">
        <div class="mermaid-rendered">
          <svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="200" fill="#f0f0f0"/>
            <text x="200" y="100" text-anchor="middle">System</text>
          </svg>
        </div>
      </div>
      <p>And a sequence diagram:</p>
      <div class="mermaid-container mermaid-ready" id="mermaid-seq1">
        <div class="mermaid-rendered">
          <svg width="300" height="150" viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg">
            <rect width="300" height="150" fill="#e0e0e0"/>
            <text x="150" y="75" text-anchor="middle">Sequence</text>
          </svg>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const { blob, xml, content, images } = await exportContainer(container);

    // ── content collector found both diagrams
    const mermaidNodes = content.nodes.filter((n) => n.type === 'mermaid');
    expect(mermaidNodes).toHaveLength(2);

    // ── SVG converter produced images keyed by the same IDs
    expect(images.size).toBe(2);
    expect(images.has('mermaid-arch1')).toBe(true);
    expect(images.has('mermaid-seq1')).toBe(true);

    // ── DOCX blob is non-trivial (contains actual image data)
    expect(blob.size).toBeGreaterThan(1000);

    // ── document.xml references images (w:drawing elements for ImageRun)
    const drawingCount = countOccurrences(xml, '<w:drawing>');
    expect(drawingCount).toBe(2);

    container.remove();
  });

  it('should produce an empty diagram slot when SVG query misses mermaid containers', async () => {
    // This simulates the OLD bug: querying 'svg' instead of '.mermaid-container svg'
    // would pick up non-mermaid SVGs and miss the ID match in DOCXGenerator.
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>Doc</h1>
      <div class="mermaid-container mermaid-ready" id="mermaid-dia1">
        <div class="mermaid-rendered">
          <svg width="200" height="100" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="100" fill="white"/>
          </svg>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const collector = new ContentCollector();
    const content = collector.collect(container);
    expect(content.nodes.filter((n) => n.type === 'mermaid')).toHaveLength(1);

    // ── CORRECT query: .mermaid-container svg → ID matches
    const correctSvgs = Array.from(
      container.querySelectorAll<SVGElement>('.mermaid-container svg')
    );
    const converter = new SVGConverter();
    const correctImages = converter.convertAll(correctSvgs);
    expect(correctImages.has('mermaid-dia1')).toBe(true);

    const generator = new DOCXGenerator();
    const goodBlob = await generator.generate(content, correctImages);
    const goodXml = await extractDocumentXml(goodBlob);
    expect(countOccurrences(goodXml, '<w:drawing>')).toBe(1);

    // ── WRONG query (old bug): passing an empty images map → diagram is silently dropped
    const emptyImages = new Map<string, never>();
    const badBlob = await generator.generate(content, emptyImages);
    const badXml = await extractDocumentXml(badBlob);
    expect(countOccurrences(badXml, '<w:drawing>')).toBe(0);

    // ── The correct approach must produce a larger file than the broken one
    expect(goodBlob.size).toBeGreaterThan(badBlob.size);

    container.remove();
  });

  it('should include mermaid diagrams nested inside progressive hydration sections', async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
        <h1>Title</h1>
        <p>Intro text.</p>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
        <h2>Diagram Section</h2>
        <div class="mermaid-container mermaid-ready" id="mermaid-nested">
          <div class="mermaid-rendered">
            <svg width="500" height="250" viewBox="0 0 500 250" xmlns="http://www.w3.org/2000/svg">
              <rect width="500" height="250" fill="#fafafa"/>
            </svg>
          </div>
        </div>
        <p>Description after diagram.</p>
      </div>
    `;
    document.body.appendChild(container);

    const { xml, content, images } = await exportContainer(container);

    // collector found the diagram inside the section wrapper
    expect(content.nodes.filter((n) => n.type === 'mermaid')).toHaveLength(1);

    // converter mapped it by container ID
    expect(images.has('mermaid-nested')).toBe(true);

    // DOCX contains the image
    expect(countOccurrences(xml, '<w:drawing>')).toBe(1);

    container.remove();
  });
});

describe('DOCX export integration — large document content', () => {
  it('should export all paragraphs from progressive hydration sections, not just headings', async () => {
    // This is the exact scenario that was broken: a large doc split into
    // mdreview-section divs where each section has a heading + multiple paragraphs.
    // The old bug caused processContainer() to return null for multi-child divs,
    // so only sections with a single heading child survived.
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
        <h1>Introduction</h1>
        <p>This is the opening paragraph of a large design document.</p>
        <p>It contains multiple paragraphs of important content.</p>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
        <h2>Requirements</h2>
        <p>The system must handle 10k requests per second.</p>
        <p>Latency must stay below 50ms at p99.</p>
        <ul><li>Scalability</li><li>Reliability</li><li>Observability</li></ul>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
        <h2>Implementation</h2>
        <p>We will use a microservices architecture.</p>
        <pre><code class="language-go">func main() { http.ListenAndServe(":8080", nil) }</code></pre>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-3" data-hydrated="true">
        <h2>Timeline</h2>
        <table>
          <thead><tr><th>Phase</th><th>Duration</th></tr></thead>
          <tbody>
            <tr><td>Design</td><td>2 weeks</td></tr>
            <tr><td>Build</td><td>4 weeks</td></tr>
          </tbody>
        </table>
      </div>
    `;
    document.body.appendChild(container);

    const { xml, content } = await exportContainer(container);

    // ── Must have all 4 headings
    const headings = content.nodes.filter((n) => n.type === 'heading');
    expect(headings).toHaveLength(4);

    // ── Must have paragraphs (this is what the old bug dropped)
    const paragraphs = content.nodes.filter((n) => n.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThanOrEqual(5);

    // ── Must have the list
    const lists = content.nodes.filter((n) => n.type === 'list');
    expect(lists).toHaveLength(1);

    // ── Must have the code block
    const codeBlocks = content.nodes.filter((n) => n.type === 'code');
    expect(codeBlocks).toHaveLength(1);

    // ── Must have the table
    const tables = content.nodes.filter((n) => n.type === 'table');
    expect(tables).toHaveLength(1);

    // ── The DOCX XML must contain paragraph text, not just headings
    expect(xml).toContain('10k requests per second');
    expect(xml).toContain('microservices architecture');
    expect(xml).toContain('Scalability');
    expect(xml).toContain('Design');

    // ── Sanity: blob is big enough to contain real content
    expect(content.metadata.wordCount).toBeGreaterThan(20);

    container.remove();
  });

  it('should export content from 10+ sections without dropping any', async () => {
    const container = document.createElement('div');
    const sectionCount = 12;

    let html = '';
    for (let i = 0; i < sectionCount; i++) {
      html += `
        <div class="mdreview-section mdreview-section-hydrated" id="section-${i}" data-hydrated="true">
          <h2>Section ${i}</h2>
          <p>Content for section ${i} with unique marker SECT${i}MARKER.</p>
        </div>
      `;
    }
    container.innerHTML = html;
    document.body.appendChild(container);

    const { xml, content } = await exportContainer(container);

    // ── All headings present
    const headings = content.nodes.filter((n) => n.type === 'heading');
    expect(headings).toHaveLength(sectionCount);

    // ── All paragraphs present (one per section)
    const paragraphs = content.nodes.filter((n) => n.type === 'paragraph');
    expect(paragraphs).toHaveLength(sectionCount);

    // ── Every section's content appears in the DOCX XML
    for (let i = 0; i < sectionCount; i++) {
      expect(xml).toContain(`SECT${i}MARKER`);
    }

    container.remove();
  });

  it('should export a mixed document with sections, diagrams, code, and tables', async () => {
    // Realistic large document with all element types
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="mdreview-section mdreview-section-hydrated" id="section-0" data-hydrated="true">
        <h1>System Design</h1>
        <p>Overview of the architecture.</p>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-1" data-hydrated="true">
        <h2>Architecture</h2>
        <p>The system uses event-driven microservices.</p>
        <div class="mermaid-container mermaid-ready" id="mermaid-arch">
          <div class="mermaid-rendered">
            <svg width="600" height="300" viewBox="0 0 600 300" xmlns="http://www.w3.org/2000/svg">
              <rect width="600" height="300" fill="white"/>
              <text x="300" y="150" text-anchor="middle">Architecture</text>
            </svg>
          </div>
        </div>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-2" data-hydrated="true">
        <h2>API</h2>
        <div class="code-block-wrapper" data-language="typescript">
          <pre><code class="language-typescript">app.get('/health', (req, res) => res.json({ ok: true }));</code></pre>
        </div>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-3" data-hydrated="true">
        <h2>Data Flow</h2>
        <div class="mermaid-container mermaid-ready" id="mermaid-flow">
          <div class="mermaid-rendered">
            <svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="200" fill="white"/>
              <text x="200" y="100" text-anchor="middle">Flow</text>
            </svg>
          </div>
        </div>
        <p>Data flows from ingestion to storage.</p>
      </div>
      <div class="mdreview-section mdreview-section-hydrated" id="section-4" data-hydrated="true">
        <h2>SLOs</h2>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Metric</th><th>Target</th></tr></thead>
            <tbody>
              <tr><td>Availability</td><td>99.9%</td></tr>
              <tr><td>Latency p99</td><td>50ms</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const { xml, content, images } = await exportContainer(container);

    // headings
    expect(content.nodes.filter((n) => n.type === 'heading')).toHaveLength(5);

    // paragraphs (not dropped!)
    expect(content.nodes.filter((n) => n.type === 'paragraph').length).toBeGreaterThanOrEqual(3);

    // mermaid diagrams collected AND converted
    expect(content.nodes.filter((n) => n.type === 'mermaid')).toHaveLength(2);
    expect(images.size).toBe(2);
    expect(images.has('mermaid-arch')).toBe(true);
    expect(images.has('mermaid-flow')).toBe(true);

    // DOCX contains both diagram images
    expect(countOccurrences(xml, '<w:drawing>')).toBe(2);

    // code block
    expect(content.nodes.filter((n) => n.type === 'code')).toHaveLength(1);
    expect(xml).toContain('health');

    // table (unwrapped from table-wrapper)
    expect(content.nodes.filter((n) => n.type === 'table')).toHaveLength(1);
    expect(xml).toContain('Availability');
    expect(xml).toContain('99.9%');

    container.remove();
  });
});
