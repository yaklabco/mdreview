import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CompositeTransport } from '../../background/logging/composite-transport';
import { IndexedDBTransport } from '../../background/logging/indexeddb-transport';
import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';

function rec(timestampMs: number, body: string): LogRecord {
  return {
    timestamp: timestampMs * 1_000_000,
    observedTimestamp: timestampMs * 1_000_000,
    severityNumber: 9,
    severityText: 'INFO',
    body,
    attributes: {},
    resource: {
      'service.name': 'mdview',
      'service.version': '0',
      'service.namespace': 'chrome-sw',
      'deployment.environment': 'dev',
      'host.os': 't',
    },
  };
}

class StubPrimary implements LogTransport {
  results: TransportResult[] = [];
  calls: LogRecord[][] = [];
  resultIndex = 0;
  shutdownCount = 0;

  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.calls.push([...records]);
    return Promise.resolve(this.results[this.resultIndex++] ?? { ok: true });
  }

  shutdown(): Promise<void> {
    this.shutdownCount++;
    return Promise.resolve();
  }
}

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('CompositeTransport.export', () => {
  it('returns ok:true and skips IDB when primary succeeds', async () => {
    const primary = new StubPrimary();
    primary.results = [{ ok: true }];
    const fallback = new IndexedDBTransport();
    const t = new CompositeTransport({ primary, fallback });
    expect(await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a')])).toEqual({ ok: true });
    expect(await fallback.listBuckets()).toEqual([]);
    await t.shutdown();
  });

  it('writes to IDB and returns ok:true when primary fails', async () => {
    const primary = new StubPrimary();
    primary.results = [{ ok: false, reason: 'down' }];
    const fallback = new IndexedDBTransport();
    const t = new CompositeTransport({ primary, fallback });
    expect((await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a')])).ok).toBe(true);
    expect(await fallback.listBuckets()).toEqual(['2026-05-11']);
    await t.shutdown();
  });

  it('returns ok:false when both primary and fallback fail', async () => {
    const primary = new StubPrimary();
    primary.results = [{ ok: false, reason: 'p' }];
    const fallback = {
      export: () => Promise.resolve({ ok: false, reason: 'f' }),
      shutdown: () => Promise.resolve(),
      listBuckets: () => Promise.resolve([] as string[]),
      getBucket: () => Promise.resolve([] as LogRecord[]),
      deleteBucket: () => Promise.resolve(),
    } as unknown as IndexedDBTransport;
    const t = new CompositeTransport({ primary, fallback });
    const r = await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a')]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('p');
    expect(r.reason).toContain('f');
  });

  it('shutdown closes both primary and fallback', async () => {
    const primary = new StubPrimary();
    const fallback = new IndexedDBTransport();
    const t = new CompositeTransport({ primary, fallback });
    await t.shutdown();
    expect(primary.shutdownCount).toBe(1);
  });
});

describe('CompositeTransport.flushFromIdb', () => {
  it('drains in ascending date order and deletes on success', async () => {
    const fallback = new IndexedDBTransport();
    await fallback.export([rec(Date.UTC(2026, 4, 12, 0), 'b')]);
    await fallback.export([rec(Date.UTC(2026, 4, 11, 0), 'a')]);
    const primary = new StubPrimary();
    primary.results = [{ ok: true }, { ok: true }];
    const t = new CompositeTransport({ primary, fallback });
    const result = await t.flushFromIdb();
    expect(result).toEqual({ flushed: 2, remaining: 0 });
    expect(primary.calls[0]?.map((r) => r.body)).toEqual(['a']);
    expect(primary.calls[1]?.map((r) => r.body)).toEqual(['b']);
    expect(await fallback.listBuckets()).toEqual([]);
    await t.shutdown();
  });

  it('stops at first failure and does not delete the failed bucket', async () => {
    const fallback = new IndexedDBTransport();
    await fallback.export([rec(Date.UTC(2026, 4, 11, 0), 'a')]);
    await fallback.export([rec(Date.UTC(2026, 4, 12, 0), 'b')]);
    const primary = new StubPrimary();
    primary.results = [{ ok: true }, { ok: false, reason: 'down' }];
    const t = new CompositeTransport({ primary, fallback });
    const result = await t.flushFromIdb();
    expect(result).toEqual({ flushed: 1, remaining: 1 });
    expect(await fallback.listBuckets()).toEqual(['2026-05-12']);
    await t.shutdown();
  });

  it('reports zero flushed when no buckets are present', async () => {
    const fallback = new IndexedDBTransport();
    const primary = new StubPrimary();
    const t = new CompositeTransport({ primary, fallback });
    expect(await t.flushFromIdb()).toEqual({ flushed: 0, remaining: 0 });
    await t.shutdown();
  });
});
