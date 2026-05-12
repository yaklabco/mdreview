import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../../logging/ring-buffer';

describe('RingBuffer', () => {
  it('stores items up to max size', () => {
    const b = new RingBuffer<number>({ maxBytes: 1024, sizeOf: () => 8 });
    b.push(1);
    b.push(2);
    expect(b.drain()).toEqual([1, 2]);
  });

  it('evicts oldest when over maxBytes', () => {
    const b = new RingBuffer<number>({ maxBytes: 24, sizeOf: () => 8 });
    b.push(1);
    b.push(2);
    b.push(3);
    b.push(4); // 32 bytes -> trim to 24
    expect(b.drain()).toEqual([2, 3, 4]);
  });

  it('drain empties the buffer', () => {
    const b = new RingBuffer<number>({ maxBytes: 1024, sizeOf: () => 8 });
    b.push(1);
    b.drain();
    expect(b.drain()).toEqual([]);
  });

  it('reports current size', () => {
    const b = new RingBuffer<number>({ maxBytes: 1024, sizeOf: () => 8 });
    expect(b.size).toBe(0);
    b.push(1);
    b.push(2);
    expect(b.size).toBe(2);
  });
});
