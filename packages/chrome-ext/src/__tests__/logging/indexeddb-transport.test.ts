import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBTransport } from '../../background/logging/indexeddb-transport';
import type { LogRecord } from '@mdreview/core/logging';

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

let openTransports: IndexedDBTransport[] = [];

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  openTransports = [];
});

afterEach(async () => {
  for (const t of openTransports) {
    try {
      await t.shutdown();
    } catch {
      /* best-effort */
    }
  }
  openTransports = [];
});

function track(t: IndexedDBTransport): IndexedDBTransport {
  openTransports.push(t);
  return t;
}

describe('IndexedDBTransport', () => {
  it('stores records under their date bucket', async () => {
    const t = track(new IndexedDBTransport());
    const result = await t.export([
      rec(Date.UTC(2026, 4, 11, 10), 'a'),
      rec(Date.UTC(2026, 4, 11, 11), 'b'),
    ]);
    expect(result).toEqual({ ok: true });
    expect(await t.listBuckets()).toEqual(['2026-05-11']);
    expect((await t.getBucket('2026-05-11')).map((r) => r.body)).toEqual(['a', 'b']);
  });

  it('listBuckets returns ascending dates', async () => {
    const t = track(new IndexedDBTransport());
    await t.export([rec(Date.UTC(2026, 4, 13, 0), 'c')]);
    await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a'), rec(Date.UTC(2026, 4, 12, 0), 'b')]);
    expect(await t.listBuckets()).toEqual(['2026-05-11', '2026-05-12', '2026-05-13']);
  });

  it('deleteBucket removes only the named date', async () => {
    const t = track(new IndexedDBTransport());
    await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a'), rec(Date.UTC(2026, 4, 12, 0), 'b')]);
    await t.deleteBucket('2026-05-11');
    expect(await t.listBuckets()).toEqual(['2026-05-12']);
    expect((await t.getBucket('2026-05-12')).map((r) => r.body)).toEqual(['b']);
  });

  it('survives reopen (new instance sees prior writes)', async () => {
    const t1 = new IndexedDBTransport();
    await t1.export([rec(Date.UTC(2026, 4, 11, 0), 'a')]);
    await t1.shutdown();
    const t2 = track(new IndexedDBTransport());
    expect(await t2.listBuckets()).toEqual(['2026-05-11']);
  });

  it('returns ok:false on transaction error', async () => {
    const t = new IndexedDBTransport({ dbName: 'forced-fail-test' });
    const orig = (globalThis as unknown as { indexedDB: unknown }).indexedDB;
    (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
      open: () => {
        const req: {
          onerror?: (ev: { target: { error: Error } }) => void;
          onsuccess?: () => void;
          onupgradeneeded?: () => void;
        } = {};
        setTimeout(() => req.onerror?.({ target: { error: new Error('boom') } }), 0);
        return req;
      },
    };
    const result = await t.export([rec(Date.UTC(2026, 4, 11, 0), 'a')]);
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe('string');
    (globalThis as unknown as { indexedDB: unknown }).indexedDB = orig;
  });
});
