/**
 * Tests for Source Position Map
 *
 * Verifies the inline syntax stripping with offset tracking that enables
 * accurate comment footnote reference insertion into formatted markdown.
 */

import { describe, it, expect } from 'vitest';
import { buildSourceMap, findInsertionPoint } from '@mdview/core';

// ─── buildSourceMap ──────────────────────────────────────────────────

describe('buildSourceMap', () => {
  it('should produce identity mapping for plain text', () => {
    const map = buildSourceMap('Hello world');
    expect(map.plainText).toBe('Hello world');
    expect(map.offsets).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(map.spans).toEqual([]);
  });

  it('should strip bold markers and track offsets', () => {
    const map = buildSourceMap('**bold**');
    expect(map.plainText).toBe('bold');
    expect(map.offsets).toEqual([2, 3, 4, 5]);
    expect(map.spans).toHaveLength(1);
    expect(map.spans[0]).toMatchObject({
      sourceStart: 0,
      sourceEnd: 8,
      plainStart: 0,
      plainEnd: 4,
      type: 'bold',
    });
  });

  it('should strip italic markers with asterisks', () => {
    const map = buildSourceMap('*italic*');
    expect(map.plainText).toBe('italic');
    expect(map.offsets).toEqual([1, 2, 3, 4, 5, 6]);
    expect(map.spans).toHaveLength(1);
    expect(map.spans[0]).toMatchObject({
      type: 'italic',
      sourceStart: 0,
      sourceEnd: 8,
    });
  });

  it('should strip italic markers with underscores', () => {
    const map = buildSourceMap('_italic_');
    expect(map.plainText).toBe('italic');
    expect(map.spans[0]).toMatchObject({ type: 'italic' });
  });

  it('should strip bold markers with underscores', () => {
    const map = buildSourceMap('__bold__');
    expect(map.plainText).toBe('bold');
    expect(map.spans[0]).toMatchObject({
      type: 'bold',
      sourceStart: 0,
      sourceEnd: 8,
    });
  });

  it('should strip strikethrough markers', () => {
    const map = buildSourceMap('~~deleted~~');
    expect(map.plainText).toBe('deleted');
    expect(map.spans[0]).toMatchObject({
      type: 'strikethrough',
      sourceStart: 0,
      sourceEnd: 11,
    });
  });

  it('should strip inline code backticks', () => {
    const map = buildSourceMap('`code`');
    expect(map.plainText).toBe('code');
    expect(map.offsets).toEqual([1, 2, 3, 4]);
    expect(map.spans[0]).toMatchObject({
      type: 'code',
      sourceStart: 0,
      sourceEnd: 6,
    });
  });

  it('should handle double backtick code spans', () => {
    const map = buildSourceMap('``co`de``');
    expect(map.plainText).toBe('co`de');
    expect(map.spans[0]).toMatchObject({
      type: 'code',
      sourceStart: 0,
      sourceEnd: 9,
    });
  });

  it('should strip link syntax keeping display text', () => {
    const map = buildSourceMap('[click](https://example.com)');
    expect(map.plainText).toBe('click');
    expect(map.spans.some((s) => s.type === 'link')).toBe(true);
    const linkSpan = map.spans.find((s) => s.type === 'link')!;
    expect(linkSpan.sourceEnd).toBe(28); // after ')'
  });

  it('should strip image syntax keeping alt text', () => {
    const map = buildSourceMap('![logo](img.png)');
    expect(map.plainText).toBe('logo');
    expect(map.spans.some((s) => s.type === 'image')).toBe(true);
    const imgSpan = map.spans.find((s) => s.type === 'image')!;
    expect(imgSpan.sourceEnd).toBe(16);
  });

  it('should handle escape sequences', () => {
    const map = buildSourceMap('\\*not italic\\*');
    expect(map.plainText).toBe('*not italic*');
    expect(map.spans.filter((s) => s.type === 'escape')).toHaveLength(2);
  });

  it('should handle escaped backslash', () => {
    const map = buildSourceMap('\\\\backslash');
    expect(map.plainText).toBe('\\backslash');
  });

  it('should handle bold text with surrounding context', () => {
    const map = buildSourceMap('Hello **world** and more');
    expect(map.plainText).toBe('Hello world and more');
    const boldSpan = map.spans.find((s) => s.type === 'bold')!;
    expect(boldSpan.sourceStart).toBe(6);
    expect(boldSpan.sourceEnd).toBe(15);
  });

  it('should handle link with surrounding context', () => {
    const map = buildSourceMap('See [docs](url) for info');
    expect(map.plainText).toBe('See docs for info');
  });

  it('should handle nested bold inside link', () => {
    const map = buildSourceMap('[**bold link**](url)');
    expect(map.plainText).toBe('bold link');
    // Should have both link and bold spans
    expect(map.spans.some((s) => s.type === 'link')).toBe(true);
    expect(map.spans.some((s) => s.type === 'bold')).toBe(true);
    // The link span should encompass the whole construct
    const linkSpan = map.spans.find((s) => s.type === 'link')!;
    expect(linkSpan.sourceStart).toBe(0);
    expect(linkSpan.sourceEnd).toBe(20);
  });

  it('should handle mixed formatting in a sentence', () => {
    const map = buildSourceMap('Hello **world** and [link](url)!');
    expect(map.plainText).toBe('Hello world and link!');
  });

  it('should handle multi-line content', () => {
    const map = buildSourceMap('Line **one**\nLine *two*');
    expect(map.plainText).toBe('Line one\nLine two');
  });

  it('should stop at comment separator', () => {
    const md = 'Content **here**\n\n<!-- mdview:comments -->\n[^comment-1]: stuff';
    const map = buildSourceMap(md);
    expect(map.plainText).toBe('Content here\n\n');
    expect(map.rawSource).toBe('Content **here**\n\n');
  });

  it('should stop at v2 annotation sentinel', () => {
    const md = 'Content **here**\n\n<!-- mdview:annotations [{"id":1}] -->';
    const map = buildSourceMap(md);
    expect(map.plainText).toBe('Content here\n\n');
    expect(map.rawSource).toBe('Content **here**\n\n');
  });

  it('should pick the earlier of v1 or v2 sentinel', () => {
    const md = 'Content here\n\n<!-- mdview:comments -->\nstuff\n<!-- mdview:annotations [] -->';
    const map = buildSourceMap(md);
    expect(map.plainText).toBe('Content here\n\n');
    expect(map.rawSource).toBe('Content here\n\n');
  });

  it('should pick v2 sentinel when it comes first', () => {
    const md = 'Content here\n\n<!-- mdview:annotations [] -->\n<!-- mdview:comments -->';
    const map = buildSourceMap(md);
    expect(map.plainText).toBe('Content here\n\n');
    expect(map.rawSource).toBe('Content here\n\n');
  });

  it('should handle [@N] markers in source text', () => {
    // [@N] markers are part of the source but should map through normally
    const md = 'Text[@1] here';
    const map = buildSourceMap(md);
    // The marker is literal text in the source, so it appears in plainText
    expect(map.plainText).toContain('[@1]');
  });

  it('should handle empty string', () => {
    const map = buildSourceMap('');
    expect(map.plainText).toBe('');
    expect(map.offsets).toEqual([]);
    expect(map.spans).toEqual([]);
  });

  it('should handle bold italic (***text***)', () => {
    // ***text*** is bold wrapping italic (or vice versa)
    // ** then * then text then * then **
    const map = buildSourceMap('***bold italic***');
    expect(map.plainText).toBe('bold italic');
  });

  it('should handle italic inside bold', () => {
    const map = buildSourceMap('**some *italic* here**');
    expect(map.plainText).toBe('some italic here');
  });

  it('should handle code inside bold (code not processed)', () => {
    // Within `code`, nothing else is processed
    const map = buildSourceMap('`**not bold**`');
    expect(map.plainText).toBe('**not bold**');
  });

  it('should handle unmatched markers as plain text', () => {
    const map = buildSourceMap('a * b * c');
    // Space after * means not italic
    expect(map.plainText).toBe('a * b * c');
  });

  it('should handle link with empty text', () => {
    const map = buildSourceMap('[](url)');
    expect(map.plainText).toBe('');
    const linkSpan = map.spans.find((s) => s.type === 'link')!;
    expect(linkSpan.sourceEnd).toBe(7);
  });

  it('should handle consecutive formatted words', () => {
    const map = buildSourceMap('**bold** and *italic*');
    expect(map.plainText).toBe('bold and italic');
    expect(map.spans).toHaveLength(2);
  });

  it('should handle italic immediately followed by bold', () => {
    // *italic***bold** — the italic parser grabs *italic***, and the remaining
    // bold** is parsed as nested italic markers. The plain text is still correct.
    const map = buildSourceMap('*italic***bold**');
    expect(map.plainText).toBe('italicbold');
    expect(map.spans.some((s) => s.type === 'italic')).toBe(true);
  });

  it('should handle bold immediately followed by italic', () => {
    // **bold***italic* has an ambiguous *** run between constructs.
    // The bold closer skips the *** (sees 3 markers), so the bold content
    // includes the trailing *, and the remaining *italic* is not parsed as italic.
    // This matches the heuristic's documented limitation for adjacent constructs.
    const map = buildSourceMap('**bold***italic*');
    expect(map.plainText).toBe('bold*italic*');
  });
});

// ─── findInsertionPoint ──────────────────────────────────────────────

describe('findInsertionPoint', () => {
  it('should find insertion point for plain text', () => {
    const map = buildSourceMap('Hello world');
    const point = findInsertionPoint(map, 'world');
    // "world" is at offsets [6..10], insertion after = 11
    expect(point).toBe(11);
  });

  it('should find insertion point after bold text', () => {
    const map = buildSourceMap('Hello **important** text');
    const point = findInsertionPoint(map, 'important');
    // Should insert after ** (sourceEnd of bold span = 19)
    expect(point).toBe(19);
  });

  it('should find insertion point after link', () => {
    const map = buildSourceMap('Click [here](https://example.com) for more');
    const point = findInsertionPoint(map, 'here');
    // Should insert after ')' — the link span's sourceEnd
    expect(point).toBe(33);
  });

  it('should find insertion point after italic text', () => {
    const map = buildSourceMap('This is *emphasized* text');
    const point = findInsertionPoint(map, 'emphasized');
    expect(point).toBe(20); // after closing *
  });

  it('should find insertion point for text spanning bold boundary', () => {
    const map = buildSourceMap('Hello **world** today');
    const point = findInsertionPoint(map, 'world');
    expect(point).toBe(15); // after **
  });

  it('should return null for text not found', () => {
    const map = buildSourceMap('Hello world');
    const point = findInsertionPoint(map, 'missing');
    expect(point).toBeNull();
  });

  it('should return null for empty selectedText', () => {
    const map = buildSourceMap('Hello world');
    const point = findInsertionPoint(map, '');
    expect(point).toBeNull();
  });

  it('should disambiguate using prefix context', () => {
    const map = buildSourceMap('The word test and another test here');
    const point = findInsertionPoint(map, 'test', {
      prefix: 'another ',
      suffix: ' here',
    });
    // Second "test" starts at index 26, ends at 29, insertion at 30
    expect(point).toBe(30);
  });

  it('should disambiguate using suffix context', () => {
    const map = buildSourceMap('foo bar foo baz');
    const point = findInsertionPoint(map, 'foo', {
      prefix: '',
      suffix: ' baz',
    });
    // Second foo is at index 8
    expect(point).toBe(11);
  });

  it('should handle selection at end of string', () => {
    const map = buildSourceMap('Hello world');
    const point = findInsertionPoint(map, 'world');
    expect(point).toBe(11);
  });

  it('should handle nested bold link', () => {
    const map = buildSourceMap('See **[bold link](url)** here');
    const point = findInsertionPoint(map, 'bold link');
    // Should insert after the outermost construct (bold span's sourceEnd = 24)
    expect(point).toBe(24);
  });

  it('should handle image alt text insertion', () => {
    const map = buildSourceMap('An ![icon](pic.png) in text');
    const point = findInsertionPoint(map, 'icon');
    expect(point).toBe(19); // after ')'
  });

  it('should handle selection of partial plain text', () => {
    const map = buildSourceMap('Hello beautiful world');
    const point = findInsertionPoint(map, 'beautiful');
    expect(point).toBe(15); // after 'l' in 'beautiful'
  });

  it('should handle strikethrough text', () => {
    const map = buildSourceMap('Not ~~deleted~~ anymore');
    const point = findInsertionPoint(map, 'deleted');
    expect(point).toBe(15); // after ~~
  });
});

// ─── Integration: insertion into raw markdown ────────────────────────

describe('source map insertion integration', () => {
  it('should allow correct footnote insertion after bold text', () => {
    const md = 'This is **important** for the review.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'important');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('This is **important**[^comment-1] for the review.');
  });

  it('should allow correct footnote insertion after link text', () => {
    const md = 'Click [the link](https://example.com) to continue.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'the link');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('Click [the link](https://example.com)[^comment-1] to continue.');
  });

  it('should allow correct footnote insertion after nested bold link', () => {
    const md = 'See **[important link](url)** for details.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'important link');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('See **[important link](url)**[^comment-1] for details.');
  });

  it('should allow correct footnote insertion for plain text', () => {
    const md = 'Simple text here.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'text');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('Simple text[^comment-1] here.');
  });

  it('should allow correct footnote insertion after inline code', () => {
    const md = 'Use `console.log` for debugging.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'console.log');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('Use `console.log`[^comment-1] for debugging.');
  });

  it('should handle mixed formatting correctly', () => {
    const md = 'The **bold** text and *italic* words and [link](url) here.';
    const map = buildSourceMap(md);

    // Test bold
    const p1 = findInsertionPoint(map, 'bold');
    expect(md.slice(0, p1!) + '[^c]' + md.slice(p1!)).toContain('**bold**[^c]');

    // Test italic
    const p2 = findInsertionPoint(map, 'italic');
    expect(md.slice(0, p2!) + '[^c]' + md.slice(p2!)).toContain('*italic*[^c]');

    // Test link
    const p3 = findInsertionPoint(map, 'link');
    expect(md.slice(0, p3!) + '[^c]' + md.slice(p3!)).toContain('[link](url)[^c]');
  });
});
