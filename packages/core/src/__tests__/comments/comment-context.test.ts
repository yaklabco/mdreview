/**
 * Tests for Comment Context
 *
 * Verifies that computeCommentContext correctly derives positional context
 * (line number, section heading, breadcrumb) from a character offset in
 * raw markdown content.
 */

import { describe, it, expect } from 'vitest';
import { computeCommentContext } from '../../comments/comment-context';

describe('computeCommentContext', () => {
  it('should return line number and section for offset in a section', () => {
    const md = [
      '# Title',
      '',
      '## Installation',
      '',
      'Run npm install to get started.',
    ].join('\n');

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
    expect(ctx.breadcrumb).toEqual([
      'Getting Started',
      'Installation',
      'Prerequisites',
    ]);
  });

  it('should handle empty string', () => {
    const ctx = computeCommentContext('', 0);

    expect(ctx.line).toBe(1);
    expect(ctx.breadcrumb).toEqual([]);
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

    const offset = md.indexOf('Beta content');
    const ctx = computeCommentContext(md, offset);

    expect(ctx.line).toBe(11);
    expect(ctx.section).toBe('Beta');
    expect(ctx.sectionLevel).toBe(2);
    expect(ctx.breadcrumb).toEqual(['Guide', 'Beta']);
  });
});
