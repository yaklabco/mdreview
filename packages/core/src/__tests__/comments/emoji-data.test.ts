/**
 * Tests for emoji data module
 */

import { describe, it, expect } from 'vitest';
import { QUICK_EMOJIS, EMOJI_CATEGORIES, searchEmojis } from '../../comments/emoji-data';

describe('QUICK_EMOJIS', () => {
  it('should have exactly 12 entries', () => {
    expect(QUICK_EMOJIS).toHaveLength(12);
  });

  it('should include common reaction emojis', () => {
    const chars = QUICK_EMOJIS.map((e) => e.char);
    expect(chars).toContain('\u{1F44D}'); // thumbs up
    expect(chars).toContain('\u{1F44E}'); // thumbs down
    expect(chars).toContain('\u{2764}\u{FE0F}'); // red heart
    expect(chars).toContain('\u{1F680}'); // rocket
    expect(chars).toContain('\u{2705}'); // check mark
    expect(chars).toContain('\u{274C}'); // cross mark
  });
});

describe('EMOJI_CATEGORIES', () => {
  it('should have exactly 8 categories', () => {
    expect(EMOJI_CATEGORIES).toHaveLength(8);
  });

  it('should have name and emojis on each category', () => {
    for (const cat of EMOJI_CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.emojis.length).toBeGreaterThan(0);
    }
  });
});

describe('searchEmojis', () => {
  it('should find emojis by name', () => {
    const results = searchEmojis('thumbs');
    expect(results.length).toBeGreaterThan(0);
    const chars = results.map((e) => e.char);
    expect(chars).toContain('\u{1F44D}');
  });

  it('should find emojis by keyword', () => {
    const results = searchEmojis('fire');
    expect(results.length).toBeGreaterThan(0);
    const chars = results.map((e) => e.char);
    expect(chars).toContain('\u{1F525}');
  });

  it('should return empty array for no match', () => {
    const results = searchEmojis('zzzznotanemoji');
    expect(results).toEqual([]);
  });

  it('should return empty array for empty query', () => {
    const results = searchEmojis('');
    expect(results).toEqual([]);
  });
});
