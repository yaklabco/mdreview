import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';
import type { IndexedDBTransport } from './indexeddb-transport';

export interface CompositeTransportOpts {
  primary: LogTransport;
  fallback: IndexedDBTransport;
}

/**
 * Layers a primary transport (native host) over an IndexedDB fallback so the
 * Chrome extension never silently drops a batch when the bridge is down.
 *
 * On a failed primary export, records are persisted to IDB and the caller is
 * told the batch was accepted. `flushFromIdb` drains buffered buckets back
 * through the primary once the bridge recovers.
 */
export class CompositeTransport implements LogTransport {
  private readonly primary: LogTransport;
  private readonly fallback: IndexedDBTransport;

  constructor(opts: CompositeTransportOpts) {
    this.primary = opts.primary;
    this.fallback = opts.fallback;
  }

  async export(records: readonly LogRecord[]): Promise<TransportResult> {
    const primaryResult = await this.primary.export(records);
    if (primaryResult.ok) return { ok: true };

    const fallbackResult = await this.fallback.export(records);
    if (fallbackResult.ok) return { ok: true };

    const primaryReason = primaryResult.reason ?? 'unknown';
    const fallbackReason = fallbackResult.reason ?? 'unknown';
    return {
      ok: false,
      reason: `primary: ${primaryReason}, fallback: ${fallbackReason}`,
    };
  }

  /**
   * Drain buffered IDB buckets through the primary transport in ascending
   * date order. Stops at the first transport failure, leaving the failed
   * bucket and any later ones in place for the next attempt.
   */
  async flushFromIdb(): Promise<{ flushed: number; remaining: number }> {
    const dates = await this.fallback.listBuckets();
    let flushed = 0;
    for (const date of dates) {
      const records = await this.fallback.getBucket(date);
      const result = await this.primary.export(records);
      if (!result.ok) {
        return { flushed, remaining: dates.length - flushed };
      }
      await this.fallback.deleteBucket(date);
      flushed++;
    }
    return { flushed, remaining: dates.length - flushed };
  }

  async shutdown(): Promise<void> {
    if (this.primary.shutdown) {
      await this.primary.shutdown();
    }
    await this.fallback.shutdown();
  }
}
