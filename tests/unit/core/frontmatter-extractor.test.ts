/**
 * Unit tests for Frontmatter Extractor
 */

import { describe, test, expect } from 'vitest';
import { extractFrontmatter, renderFrontmatterHtml } from '@mdview/core';

describe('extractFrontmatter', () => {
  test('returns null frontmatter for empty string', () => {
    const result = extractFrontmatter('');
    expect(result.frontmatter).toBeNull();
    expect(result.cleanedMarkdown).toBe('');
  });

  test('returns null frontmatter when no frontmatter present', () => {
    const md = '# Hello\n\nSome content';
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toBeNull();
    expect(result.cleanedMarkdown).toBe(md);
  });

  test('extracts standard key-value pairs', () => {
    const md = `---
title: My Document
author: Jane Doe
---

# Hello`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: 'My Document',
      author: 'Jane Doe',
    });
    expect(result.cleanedMarkdown).toBe('\n# Hello');
  });

  test('splits only on first colon (URLs in values)', () => {
    const md = `---
website: https://example.com
repo: https://github.com/user/repo
---

Content`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      website: 'https://example.com',
      repo: 'https://github.com/user/repo',
    });
  });

  test('strips surrounding quotes from values', () => {
    const md = `---
title: "Quoted Title"
author: 'Single Quoted'
plain: No quotes
---
`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: 'Quoted Title',
      author: 'Single Quoted',
      plain: 'No quotes',
    });
  });

  test('does not extract when --- is not at line 1', () => {
    const md = `# Hello

---
title: Not Frontmatter
---`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toBeNull();
    expect(result.cleanedMarkdown).toBe(md);
  });

  test('handles empty values', () => {
    const md = `---
title:
author: Someone
---

Content`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: '',
      author: 'Someone',
    });
  });

  test('ignores lines without colons inside frontmatter block', () => {
    const md = `---
title: My Doc
this has no colon
author: Someone
---

Content`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: 'My Doc',
      author: 'Someone',
    });
  });

  test('handles frontmatter with no trailing content', () => {
    const md = `---
title: Only Frontmatter
---`;
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: 'Only Frontmatter',
    });
    expect(result.cleanedMarkdown).toBe('');
  });

  test('handles Windows line endings (CRLF)', () => {
    const md = '---\r\ntitle: CRLF Doc\r\nauthor: Test\r\n---\r\n\r\nContent';
    const result = extractFrontmatter(md);
    expect(result.frontmatter).toEqual({
      title: 'CRLF Doc',
      author: 'Test',
    });
  });
});

describe('renderFrontmatterHtml', () => {
  test('renders a details/summary card with key-value table', () => {
    const html = renderFrontmatterHtml({ title: 'My Doc', author: 'Jane' });
    expect(html).toContain('<details');
    expect(html).toContain('class="frontmatter-card"');
    expect(html).toContain('<summary');
    expect(html).toContain('Frontmatter');
    expect(html).toContain('<table');
    expect(html).toContain('title');
    expect(html).toContain('My Doc');
    expect(html).toContain('author');
    expect(html).toContain('Jane');
  });

  test('escapes HTML in keys and values', () => {
    const html = renderFrontmatterHtml({
      '<script>': '<img onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
  });

  test('renders each key-value as a table row', () => {
    const html = renderFrontmatterHtml({ a: '1', b: '2', c: '3' });
    const rowCount = (html.match(/<tr/g) || []).length;
    expect(rowCount).toBe(3);
  });
});
