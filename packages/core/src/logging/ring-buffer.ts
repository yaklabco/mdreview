export interface RingBufferOpts<T> {
  maxBytes: number;
  sizeOf: (item: T) => number;
}

export class RingBuffer<T> {
  private items: T[] = [];
  private bytes = 0;

  constructor(private opts: RingBufferOpts<T>) {}

  push(item: T): void {
    this.items.push(item);
    this.bytes += this.opts.sizeOf(item);
    while (this.bytes > this.opts.maxBytes && this.items.length > 0) {
      const dropped = this.items.shift() as T;
      this.bytes -= this.opts.sizeOf(dropped);
    }
  }

  drain(): T[] {
    const out = this.items;
    this.items = [];
    this.bytes = 0;
    return out;
  }

  get size(): number {
    return this.items.length;
  }
}
