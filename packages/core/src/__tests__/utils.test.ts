import {
  splitIntoSections,
  splitIntoChunks,
  getInitialSections,
  type MarkdownSection,
} from '../utils/section-splitter';
import { FilenameGenerator } from '../utils/filename-generator';
import { stripTableOfContents } from '../utils/toc-stripper';

describe('section-splitter', () => {
  describe('splitIntoSections', () => {
    it('should split markdown by headings', () => {
      const md = '# Heading 1\nContent 1\n## Heading 2\nContent 2';
      const sections = splitIntoSections(md);
      expect(sections).toHaveLength(2);
      expect(sections[0].heading).toBe('Heading 1');
      expect(sections[1].heading).toBe('Heading 2');
    });

    it('should return a single section for markdown without headings', () => {
      const md = 'Just some text\nwith multiple lines';
      const sections = splitIntoSections(md);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBeUndefined();
    });

    it('should not split on headings inside code fences', () => {
      const md = '# Real Heading\n```\n# Not a heading\n```\nMore content';
      const sections = splitIntoSections(md);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('Real Heading');
    });

    it('should assign sequential section IDs', () => {
      const md = '# A\ntext\n## B\ntext\n### C\ntext';
      const sections = splitIntoSections(md);
      expect(sections.map((s) => s.id)).toEqual(['section-0', 'section-1', 'section-2']);
    });

    it('should track line numbers', () => {
      const md = '# First\nline 1\nline 2\n## Second\nline 3';
      const sections = splitIntoSections(md);
      expect(sections[0].startLine).toBe(0);
      expect(sections[0].endLine).toBe(2);
      expect(sections[1].startLine).toBe(3);
      expect(sections[1].endLine).toBe(4);
    });
  });

  describe('splitIntoChunks', () => {
    it('should split large content into chunks', () => {
      const line = 'x'.repeat(100) + '\n';
      const md = line.repeat(100);
      const sections = splitIntoChunks(md, 500);
      expect(sections.length).toBeGreaterThan(1);
      sections.forEach((s) => {
        expect(s.id).toMatch(/^chunk-\d+$/);
      });
    });

    it('should return single chunk for small content', () => {
      const md = 'small text';
      const sections = splitIntoChunks(md);
      expect(sections).toHaveLength(1);
    });
  });

  describe('getInitialSections', () => {
    const makeSections = (count: number): MarkdownSection[] =>
      Array.from({ length: count }, (_, i) => ({
        markdown: `Section ${i}`,
        startLine: i * 2,
        endLine: i * 2 + 1,
        heading: `Heading ${i}`,
        level: 1,
        id: `section-${i}`,
      }));

    it('should return up to maxSections sections', () => {
      const sections = makeSections(10);
      const initial = getInitialSections(sections, { maxSections: 2 });
      expect(initial).toHaveLength(2);
    });

    it('should return at least one section even if maxSize is very small', () => {
      const sections = makeSections(5);
      const initial = getInitialSections(sections, { maxSize: 1 });
      expect(initial).toHaveLength(1);
    });

    it('should return sections up to a specific ID', () => {
      const sections = makeSections(5);
      const initial = getInitialSections(sections, { upToSectionId: 'section-2' });
      // Should include sections 0, 1, 2 plus one more for context
      expect(initial).toHaveLength(4);
    });
  });
});

describe('filename-generator', () => {
  it('should generate a filename with default template', () => {
    const result = FilenameGenerator.generate({ title: 'My Document', extension: 'pdf' });
    expect(result).toBe('my-document.pdf');
  });

  it('should sanitize illegal characters', () => {
    const result = FilenameGenerator.generate({ title: 'file<>:"/\\|?*name', extension: 'txt' });
    expect(result).toBe('filename.txt');
  });

  it('should handle empty title', () => {
    const result = FilenameGenerator.generate({ title: '', extension: 'docx' });
    expect(result).toBe('document.docx');
  });

  it('should use a custom template with date vars', () => {
    const result = FilenameGenerator.generate({
      title: 'Report',
      extension: 'pdf',
      template: '{title}-{year}',
    });
    const year = new Date().getFullYear();
    expect(result).toBe(`report-${year}.pdf`);
  });

  it('should truncate overly long filenames', () => {
    const longTitle = 'a'.repeat(300);
    const result = FilenameGenerator.generate({ title: longTitle, extension: 'pdf' });
    // 200 char max + '.pdf' = 204
    expect(result.length).toBeLessThanOrEqual(204);
  });
});

describe('toc-stripper', () => {
  it('should return original markdown when no TOC is found', () => {
    const md = '# Hello\nSome content';
    const result = stripTableOfContents(md);
    expect(result.tocFound).toBe(false);
    expect(result.markdown).toBe(md);
  });

  it('should strip a TOC section with anchor links', () => {
    const md = [
      '# My Doc',
      '',
      '## Table of Contents',
      '- [Section 1](#section-1)',
      '- [Section 2](#section-2)',
      '- [Section 3](#section-3)',
      '',
      '## Section 1',
      'Content 1',
    ].join('\n');
    const result = stripTableOfContents(md);
    expect(result.tocFound).toBe(true);
    expect(result.markdown).not.toContain('Table of Contents');
    expect(result.markdown).toContain('Section 1');
    expect(result.markdown).toContain('Content 1');
  });

  it('should not strip a heading named Contents without anchor links', () => {
    const md = [
      '## Contents',
      'This is just regular content, not a TOC.',
      '',
      '## Other',
      'More content',
    ].join('\n');
    const result = stripTableOfContents(md);
    expect(result.tocFound).toBe(false);
  });

  it('should accept an optional logger', () => {
    const logs: string[] = [];
    const logger = {
      debug: (_ctx: string, msg: string) => logs.push(msg),
      info: (_ctx: string, msg: string) => logs.push(msg),
    };
    const md = '# Doc\nNo TOC here';
    stripTableOfContents(md, logger);
    expect(logs.length).toBeGreaterThan(0);
  });
});
