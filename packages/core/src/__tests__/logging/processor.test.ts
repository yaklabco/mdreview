import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProcessor } from '../../logging/processor';
import type { LogRecord } from '../../logging/log-record';
import type { LogTransport, TransportResult } from '../../logging/transport';

function makeRecord(i: number): LogRecord {
  return {
    timestamp: i,
    observedTimestamp: i,
    severityNumber: 9,
    severityText: 'INFO',
    body: `msg-${i}`,
    attributes: {},
    resource: {
      'service.name': 'mdview',
      'service.version': '0.0.0-test',
      'service.namespace': 'electron-main',
      'deployment.environment': 'dev',
      'host.os': 'test',
    },
  };
}

class StubTransport implements LogTransport {
  calls: LogRecord[][] = [];
  result: TransportResult = { ok: true };
  shutdownCalled = false;
  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.calls.push([...records]);
    return Promise.resolve(this.result);
  }
  shutdown(): Promise<void> {
    this.shutdownCalled = true;
    return Promise.resolve();
  }
}

describe('BatchLogRecordProcessor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes when batch size reaches maxBatch', async () => {
    const t = new StubTransport();
    const p = createProcessor({ transport: t, maxBatch: 3, flushIntervalMs: 9999 });
    p.emit(makeRecord(1));
    p.emit(makeRecord(2));
    expect(t.calls.length).toBe(0);
    p.emit(makeRecord(3));
    await vi.waitFor(() => expect(t.calls.length).toBe(1));
    expect(t.calls[0]).toHaveLength(3);
  });

  it('flushes when flushIntervalMs elapses', async () => {
    const t = new StubTransport();
    const p = createProcessor({ transport: t, maxBatch: 999, flushIntervalMs: 500 });
    p.emit(makeRecord(1));
    p.emit(makeRecord(2));
    expect(t.calls.length).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(t.calls.length).toBe(1);
    expect(t.calls[0]).toHaveLength(2);
  });

  it('pushes records to ring on transport failure and drains them on next flush', async () => {
    const t = new StubTransport();
    t.result = { ok: false, reason: 'boom' };
    const p = createProcessor({ transport: t, maxBatch: 2, flushIntervalMs: 9999 });
    p.emit(makeRecord(1));
    p.emit(makeRecord(2));
    await vi.waitFor(() => expect(t.calls.length).toBe(1));
    // first attempt failed; records buffered in ring
    t.result = { ok: true };
    p.emit(makeRecord(3));
    p.emit(makeRecord(4));
    await vi.waitFor(() => expect(t.calls.length).toBe(2));
    // second flush sends ring contents first, then new batch
    expect(t.calls[1].map((r) => r.timestamp)).toEqual([1, 2, 3, 4]);
  });

  it('shutdown flushes pending and calls transport.shutdown', async () => {
    const t = new StubTransport();
    const p = createProcessor({ transport: t, maxBatch: 999, flushIntervalMs: 9999 });
    p.emit(makeRecord(1));
    await p.shutdown();
    expect(t.calls.length).toBe(1);
    expect(t.calls[0]).toHaveLength(1);
    expect(t.shutdownCalled).toBe(true);
  });

  it('does not flush when emit() is called and pending is empty after a prior flush', async () => {
    const t = new StubTransport();
    const p = createProcessor({ transport: t, maxBatch: 1, flushIntervalMs: 9999 });
    p.emit(makeRecord(1));
    await vi.waitFor(() => expect(t.calls.length).toBe(1));
    // no further emit, no further flush
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.calls.length).toBe(1);
  });

  it('respects ringMaxBytes by evicting oldest buffered failures', async () => {
    const t = new StubTransport();
    t.result = { ok: false, reason: 'boom' };
    // ringMaxBytes is bytes of JSON-serialised records; pick a small value to force eviction.
    // One record's JSON is well under 200 bytes for this test shape, so set 250 bytes -> ~1 record fits.
    const p = createProcessor({
      transport: t,
      maxBatch: 1,
      flushIntervalMs: 9999,
      ringMaxBytes: 250,
    });
    p.emit(makeRecord(1));
    await vi.waitFor(() => expect(t.calls.length).toBe(1));
    p.emit(makeRecord(2));
    await vi.waitFor(() => expect(t.calls.length).toBe(2));
    p.emit(makeRecord(3));
    await vi.waitFor(() => expect(t.calls.length).toBe(3));
    // ring should have evicted older records, retaining most recent.
    t.result = { ok: true };
    p.emit(makeRecord(4));
    await vi.waitFor(() => expect(t.calls.length).toBe(4));
    const final = t.calls[3].map((r) => r.timestamp);
    // Latest attempt sends whatever survived in ring + the new record.
    expect(final[final.length - 1]).toBe(4);
    expect(final.length).toBeLessThanOrEqual(2);
  });
});
