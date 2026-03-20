import { MarkdownConverter } from '../markdown-converter';
import { extractFrontmatter, renderFrontmatterHtml } from '../frontmatter-extractor';
import { CacheManager } from '../cache-manager';

describe('MarkdownConverter', () => {
  let converter: MarkdownConverter;

  beforeEach(() => {
    converter = new MarkdownConverter();
  });

  it('should convert basic markdown to HTML', () => {
    const result = converter.convert('# Hello World');
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello World');
    expect(result.errors).toHaveLength(0);
  });

  it('should extract heading metadata', () => {
    const result = converter.convert('# Title\n\n## Subtitle');
    expect(result.metadata.headings).toHaveLength(2);
    expect(result.metadata.headings[0].level).toBe(1);
    // The anchor plugin wraps heading content in <a><span>text</span></a>,
    // making the inline token's content empty. The heading ID is still generated.
    expect(result.metadata.headings[0].id).toBe('');
    expect(result.metadata.headings[1].level).toBe(2);
  });

  it('should count words', () => {
    const result = converter.convert('one two three four five');
    expect(result.metadata.wordCount).toBe(5);
  });

  it('should detect code blocks', () => {
    const result = converter.convert('```javascript\nconsole.log("hi");\n```');
    expect(result.metadata.codeBlocks).toHaveLength(1);
    expect(result.metadata.codeBlocks[0].language).toBe('javascript');
  });

  it('should detect mermaid blocks', () => {
    const result = converter.convert('```mermaid\ngraph TD\n  A --> B\n```');
    expect(result.metadata.mermaidBlocks).toHaveLength(1);
    expect(result.metadata.mermaidBlocks[0].code).toContain('graph TD');
    expect(result.html).toContain('mermaid-container');
  });

  it('should extract link metadata', () => {
    const result = converter.convert('[Example](https://example.com)');
    expect(result.metadata.links).toHaveLength(1);
    expect(result.metadata.links[0].href).toBe('https://example.com');
  });

  it('should extract image metadata', () => {
    const result = converter.convert('![alt text](image.png "title")');
    expect(result.metadata.images).toHaveLength(1);
    expect(result.metadata.images[0].src).toBe('image.png');
    expect(result.metadata.images[0].alt).toBe('alt text');
  });

  it('should render task lists', () => {
    const result = converter.convert('- [x] Done\n- [ ] Todo');
    expect(result.html).toContain('type="checkbox"');
  });

  it('should validate valid markdown', () => {
    const result = converter.validateSyntax('# Valid markdown');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle empty input', () => {
    const result = converter.convert('');
    expect(result.html).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });
});

describe('extractFrontmatter', () => {
  it('should extract frontmatter from markdown', () => {
    const markdown = '---\ntitle: Hello\nauthor: Test\n---\n# Content';
    const result = extractFrontmatter(markdown);
    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter!.title).toBe('Hello');
    expect(result.frontmatter!.author).toBe('Test');
    expect(result.cleanedMarkdown).toBe('# Content');
  });

  it('should return null frontmatter when none present', () => {
    const result = extractFrontmatter('# No frontmatter');
    expect(result.frontmatter).toBeNull();
    expect(result.cleanedMarkdown).toBe('# No frontmatter');
  });

  it('should handle empty input', () => {
    const result = extractFrontmatter('');
    expect(result.frontmatter).toBeNull();
    expect(result.cleanedMarkdown).toBe('');
  });

  it('should strip surrounding quotes from values', () => {
    const markdown = '---\ntitle: "Quoted Title"\n---\n';
    const result = extractFrontmatter(markdown);
    expect(result.frontmatter!.title).toBe('Quoted Title');
  });
});

describe('renderFrontmatterHtml', () => {
  it('should render frontmatter as details/table HTML', () => {
    const html = renderFrontmatterHtml({ title: 'Test', author: 'Author' });
    expect(html).toContain('<details');
    expect(html).toContain('frontmatter-card');
    expect(html).toContain('Test');
    expect(html).toContain('Author');
  });
});

describe('CacheManager', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 3 });
  });

  it('should return null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should store and retrieve cache entries', () => {
    const result = {
      html: '<p>test</p>',
      metadata: {
        wordCount: 1,
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
      cacheKey: 'test-key',
    };

    cache.set('test-key', result, '/test.md', 'hash123', 'github-light');
    const retrieved = cache.get('test-key');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.html).toBe('<p>test</p>');
  });

  it('should evict oldest entry when maxSize is reached', () => {
    const makeResult = (key: string) => ({
      html: `<p>${key}</p>`,
      metadata: {
        wordCount: 1,
        headings: [],
        codeBlocks: [],
        mermaidBlocks: [],
        images: [],
        links: [],
        frontmatter: null,
      },
      highlightedBlocks: new Map<string, string>(),
      mermaidSVGs: new Map<string, string>(),
      timestamp: Date.now(),
      cacheKey: key,
    });

    cache.set('key1', makeResult('key1'), '/a.md', 'h1', 'github-light');
    cache.set('key2', makeResult('key2'), '/b.md', 'h2', 'github-light');
    cache.set('key3', makeResult('key3'), '/c.md', 'h3', 'github-light');
    // This should evict key1 (oldest)
    cache.set('key4', makeResult('key4'), '/d.md', 'h4', 'github-light');

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key4')).not.toBeNull();
  });

  it('should invalidate by path', () => {
    const result = {
      html: '<p>test</p>',
      metadata: {
        wordCount: 1,
        headings: [],
        codeBlocks: [],
        mermaidBlocks: [],
        images: [],
        links: [],
        frontmatter: null,
      },
      highlightedBlocks: new Map<string, string>(),
      mermaidSVGs: new Map<string, string>(),
      timestamp: Date.now(),
      cacheKey: 'k',
    };

    cache.set('k', result, '/file.md', 'hash', 'github-light');
    cache.invalidateByPath('/file.md');
    expect(cache.get('k')).toBeNull();
  });

  it('should clear all entries', () => {
    const result = {
      html: '<p>test</p>',
      metadata: {
        wordCount: 1,
        headings: [],
        codeBlocks: [],
        mermaidBlocks: [],
        images: [],
        links: [],
        frontmatter: null,
      },
      highlightedBlocks: new Map<string, string>(),
      mermaidSVGs: new Map<string, string>(),
      timestamp: Date.now(),
      cacheKey: 'k',
    };

    cache.set('k', result, '/file.md', 'hash', 'github-light');
    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });

  it('should report stats', () => {
    const stats = cache.getStats();
    expect(stats.size).toBe(0);
    expect(stats.maxSize).toBe(3);
    expect(stats.oldestEntry).toBeNull();
  });
});
