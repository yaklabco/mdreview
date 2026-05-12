import { afterEach, describe, expect, it } from 'vitest';
import { RemoteTransport } from '../../content/logging/remote-transport';
import type { LogRecord } from '@mdreview/core/logging';

const REC: LogRecord = {
  timestamp: 1,
  observedTimestamp: 1,
  severityNumber: 9,
  severityText: 'INFO',
  body: 'hi',
  attributes: {},
  resource: {
    'service.name': 'mdview',
    'service.version': '0',
    'service.namespace': 'chrome-content',
    'deployment.environment': 'dev',
    'host.os': 't',
  },
};

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('RemoteTransport', () => {
  it('returns ok:true when the SW responds { ok: true }', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage(_m: unknown, cb: (r?: unknown) => void) {
          cb({ ok: true });
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 100 });
    expect(await t.export([REC])).toEqual({ ok: true });
  });

  it('sends a LOG_BATCH message with the records', async () => {
    let observed: unknown = null;
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage(msg: unknown, cb: (r?: unknown) => void) {
          observed = msg;
          cb({ ok: true });
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 100 });
    await t.export([REC]);
    expect(observed).toMatchObject({ type: 'LOG_BATCH' });
    const records = (observed as { records: LogRecord[] }).records;
    expect(records).toHaveLength(1);
    expect(records[0]?.body).toBe('hi');
  });

  it('returns ok:false with chrome.runtime.lastError message', async () => {
    const chromeStub = {
      runtime: {
        sendMessage(_m: unknown, cb: (r?: unknown) => void) {
          chromeStub.runtime.lastError = { message: 'no SW' };
          cb();
        },
        lastError: undefined as { message: string } | undefined,
      },
    };
    (globalThis as { chrome?: unknown }).chrome = chromeStub;
    const t = new RemoteTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('no SW');
  });

  it('returns ok:false reason:protocol when response has no ok', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage(_m: unknown, cb: (r?: unknown) => void) {
          cb({ error: 'nope' });
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('protocol');
  });

  it('returns the SW-provided reason when ok is false', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage(_m: unknown, cb: (r?: unknown) => void) {
          cb({ ok: false, reason: 'sw failed' });
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('sw failed');
  });

  it('returns timeout when callback is never invoked', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage(_m: unknown, _cb: (r?: unknown) => void) {
          /* never call */
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 20 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('timeout');
  });

  it('returns ok:false reason when sendMessage throws synchronously', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendMessage() {
          throw new Error('extension context invalidated');
        },
        lastError: undefined,
      },
    };
    const t = new RemoteTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('extension context invalidated');
  });
});
