/**
 * Consumer smoke test for @mdreview/core's published tarball.
 *
 * Imports from ../dist/index.js (the same entry that `exports["."].import`
 * points at) and exercises the MarkdownConverter barrel. If this file runs
 * green after `bun run build`, the tarball that will land on npm contains
 * a working runtime bundle.
 */

import { describe, expect, it } from 'vitest';
import { MarkdownConverter } from '../dist/index.js';

describe('@mdreview/core consumer smoke', () => {
  it('renders a heading and a mermaid block from the dist bundle', () => {
    const converter = new MarkdownConverter();
    const markdown = [
      '# Smoke Test Heading',
      '',
      '```mermaid',
      'graph TD',
      'A --> B',
      '```',
      '',
    ].join('\n');

    const result = converter.convert(markdown);

    expect(result.errors).toEqual([]);
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('mermaid');
    expect(result.metadata.mermaidBlocks).toHaveLength(1);
  });
});
