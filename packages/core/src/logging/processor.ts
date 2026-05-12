import { RingBuffer } from './ring-buffer';
import type { LogRecord } from './log-record';
import type { LogTransport } from './transport';

export interface ProcessorOpts {
  transport: LogTransport;
  maxBatch?: number;
  flushIntervalMs?: number;
  ringMaxBytes?: number;
}

interface ResolvedOpts {
  transport: LogTransport;
  maxBatch: number;
  flushIntervalMs: number;
  ringMaxBytes: number;
}

export class BatchLogRecordProcessor {
  private pending: LogRecord[] = [];
  private ring: RingBuffer<LogRecord>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  constructor(private opts: ResolvedOpts) {
    this.ring = new RingBuffer<LogRecord>({
      maxBytes: opts.ringMaxBytes,
      sizeOf: (r) => JSON.stringify(r).length,
    });
  }

  emit(record: LogRecord): void {
    this.pending.push(record);
    if (this.pending.length >= this.opts.maxBatch) {
      void this.flush();
    } else if (this.timer === null) {
      this.timer = setTimeout(() => void this.flush(), this.opts.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const drained = this.ring.drain();
    const batch = [...drained, ...this.pending];
    this.pending = [];
    if (batch.length === 0) return;

    this.flushing = true;
    try {
      const result = await this.opts.transport.export(batch);
      if (!result.ok) {
        for (const r of batch) this.ring.push(r);
      }
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    if (this.opts.transport.shutdown) {
      await this.opts.transport.shutdown();
    }
  }
}

export function createProcessor(opts: ProcessorOpts): BatchLogRecordProcessor {
  return new BatchLogRecordProcessor({
    transport: opts.transport,
    maxBatch: opts.maxBatch ?? 64,
    flushIntervalMs: opts.flushIntervalMs ?? 2000,
    ringMaxBytes: opts.ringMaxBytes ?? 1_048_576,
  });
}
