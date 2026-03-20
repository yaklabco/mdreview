/**
 * Tests for Comment Context
 *
 * Verifies that computeCommentContext correctly derives positional context
 * (line number, section heading, breadcrumb) from a character offset in
 * raw markdown content. This metadata enables AI agents reading the file
 * to immediately understand where each comment is anchored.
 */

import { describe, it, expect } from 'vitest';
import { computeCommentContext } from '@mdview/core';

// ─── Simple documents ────────────────────────────────────────────────

describe('computeCommentContext', () => {
  it('should return line number and section for offset in a section', () => {
    const md = ['# Title', '', '## Installation', '', 'Run npm install to get started.'].join('\n');

    // Offset pointing to "npm" on line 5 (0-indexed line 4)
    const offset = md.indexOf('npm');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(5);
    expect(ctx.section).toBe('Installation');
    expect(ctx.sectionLevel).toBe(2);
    expect(ctx.breadcrumb).toEqual(['Title', 'Installation']);
  });

  it('should handle offset before any heading (preamble)', () => {
    const md = [
      'Some preamble text here.',
      '',
      '# First Heading',
      '',
      'Content under heading.',
    ].join('\n');

    const offset = md.indexOf('preamble');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(1);
    expect(ctx.section).toBeUndefined();
    expect(ctx.sectionLevel).toBeUndefined();
    expect(ctx.breadcrumb).toEqual([]);
  });

  it('should handle document with no headings', () => {
    const md = ['Just some plain text.', '', 'Another paragraph of text.'].join('\n');

    const offset = md.indexOf('Another');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(3);
    expect(ctx.section).toBeUndefined();
    expect(ctx.sectionLevel).toBeUndefined();
    expect(ctx.breadcrumb).toEqual([]);
  });

  it('should build nested breadcrumb (h1 > h2 > h3)', () => {
    const md = [
      '# Getting Started',
      '',
      '## Installation',
      '',
      '### Prerequisites',
      '',
      'You need Node.js 18+.',
    ].join('\n');

    const offset = md.indexOf('Node.js');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(7);
    expect(ctx.section).toBe('Prerequisites');
    expect(ctx.sectionLevel).toBe(3);
    expect(ctx.breadcrumb).toEqual(['Getting Started', 'Installation', 'Prerequisites']);
  });

  it('should handle offset at the very start of document (offset 0)', () => {
    const md = '# Title\n\nContent here.';

    const ctx = computeCommentContext(md, 0);

    expect(ctx.line).toBe(1);
    expect(ctx.section).toBe('Title');
    expect(ctx.sectionLevel).toBe(1);
    expect(ctx.breadcrumb).toEqual(['Title']);
  });

  it('should handle offset at the end of document', () => {
    const md = ['# Title', '', '## Section', '', 'Last word.'].join('\n');

    const offset = md.length;
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(5);
    expect(ctx.section).toBe('Section');
    expect(ctx.sectionLevel).toBe(2);
    expect(ctx.breadcrumb).toEqual(['Title', 'Section']);
  });

  it('should handle skipped heading levels (h1 > h3, no h2)', () => {
    const md = ['# Title', '', '### Deep Section', '', 'Content in deep section.'].join('\n');

    const offset = md.indexOf('Content');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(5);
    expect(ctx.section).toBe('Deep Section');
    expect(ctx.sectionLevel).toBe(3);
    expect(ctx.breadcrumb).toEqual(['Title', 'Deep Section']);
  });

  it('should reset breadcrumb correctly for peer sections', () => {
    const md = [
      '# Guide',
      '',
      '## Alpha',
      '',
      '### Alpha Sub',
      '',
      'Alpha sub content.',
      '',
      '## Beta',
      '',
      'Beta content here.',
    ].join('\n');

    // Offset in Beta section
    const offset = md.indexOf('Beta content');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(11);
    expect(ctx.section).toBe('Beta');
    expect(ctx.sectionLevel).toBe(2);
    // Alpha and Alpha Sub should NOT be in the breadcrumb
    expect(ctx.breadcrumb).toEqual(['Guide', 'Beta']);
  });

  it('should handle offset on a heading line itself', () => {
    const md = ['# Title', '', '## Section Name', '', 'Content.'].join('\n');

    const offset = md.indexOf('## Section Name');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(3);
    expect(ctx.section).toBe('Section Name');
    expect(ctx.sectionLevel).toBe(2);
    expect(ctx.breadcrumb).toEqual(['Title', 'Section Name']);
  });

  it('should handle empty string', () => {
    const ctx = computeCommentContext('', 0);

    expect(ctx.line).toBe(1);
    expect(ctx.breadcrumb).toEqual([]);
  });

  it('should clamp offset beyond text length', () => {
    const md = '# Title\n\nShort.';
    const ctx = computeCommentContext(md, 9999);

    // Should not crash; line should be the last line
    expect(ctx.line).toBe(3);
    expect(ctx.section).toBe('Title');
  });

  it('should handle multiple h1 headings', () => {
    const md = [
      '# Part One',
      '',
      'Part one content.',
      '',
      '# Part Two',
      '',
      'Part two content.',
    ].join('\n');

    const offset = md.indexOf('Part two content');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(7);
    expect(ctx.section).toBe('Part Two');
    expect(ctx.sectionLevel).toBe(1);
    // Part One should be cleared from breadcrumb
    expect(ctx.breadcrumb).toEqual(['Part Two']);
  });

  it('should handle heading with code fences (not confused by # inside code)', () => {
    const md = [
      '# Title',
      '',
      '```bash',
      '# this is a bash comment',
      '```',
      '',
      '## Real Section',
      '',
      'Content here.',
    ].join('\n');

    const offset = md.indexOf('Content here');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.section).toBe('Real Section');
    expect(ctx.sectionLevel).toBe(2);
    expect(ctx.breadcrumb).toEqual(['Title', 'Real Section']);
  });
});
