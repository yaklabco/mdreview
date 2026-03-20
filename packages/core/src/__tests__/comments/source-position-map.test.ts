/**
 * Tests for Source Position Map
 *
 * Verifies the inline syntax stripping with offset tracking that enables
 * accurate comment footnote reference insertion into formatted markdown.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSourceMap,
  findInsertionPoint,
} from '../../comments/source-position-map';

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

  it('should strip link syntax keeping display text', () => {
    const map = buildSourceMap('[click](https://example.com)');
    expect(map.plainText).toBe('click');
    expect(map.spans.some((s) => s.type === 'link')).toBe(true);
  });

  it('should stop at comment separator', () => {
    const md = 'Content **here**\n\n<!-- mdview:comments -->\n[^comment-1]: stuff';
    const map = buildSourceMap(md);
    expect(map.plainText).toBe('Content here\n\n');
    expect(map.rawSource).toBe('Content **here**\n\n');
  });

  it('should handle empty string', () => {
    const map = buildSourceMap('');
    expect(map.plainText).toBe('');
    expect(map.offsets).toEqual([]);
    expect(map.spans).toEqual([]);
  });
});

describe('findInsertionPoint', () => {
  it('should find insertion point for plain text', () => {
    const map = buildSourceMap('Hello world');
    const point = findInsertionPoint(map, 'world');
    expect(point).toBe(11);
  });

  it('should find insertion point after bold text', () => {
    const map = buildSourceMap('Hello **important** text');
    const point = findInsertionPoint(map, 'important');
    expect(point).toBe(19);
  });

  it('should find insertion point after link', () => {
    const map = buildSourceMap('Click [here](https://example.com) for more');
    const point = findInsertionPoint(map, 'here');
    expect(point).toBe(33);
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
    expect(point).toBe(30);
  });
});

describe('source map insertion integration', () => {
  it('should allow correct footnote insertion after bold text', () => {
    const md = 'This is **important** for the review.';
    const map = buildSourceMap(md);
    const point = findInsertionPoint(map, 'important');
    expect(point).not.toBeNull();
    const result = md.slice(0, point!) + '[^comment-1]' + md.slice(point!);
    expect(result).toBe('This is **important**[^comment-1] for the review.');
  });
});
