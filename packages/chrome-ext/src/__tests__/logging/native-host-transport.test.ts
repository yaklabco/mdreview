import { afterEach, describe, expect, it } from 'vitest';
import { NativeHostTransport } from '../../background/logging/native-host-transport';
import type { LogRecord } from '@mdreview/core/logging';

const REC: LogRecord = {
  timestamp: 1,
  observedTimestamp: 1,
  severityNumber: 9,
  severityText: 'INFO',
  body: 'x',
  attributes: {},
  resource: {
    'service.name': 'mdview',
    'service.version': '0',
    'service.namespace': 'chrome-sw',
    'deployment.environment': 'dev',
    'host.os': 't',
  },
};

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('NativeHostTransport', () => {
  it('returns ok:true on a success response', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(_h: string, _m: unknown, cb: (r?: unknown) => void) {
          cb({ success: true });
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 100 });
    expect(await t.export([REC])).toEqual({ ok: true });
  });

  it('uses the project native host name by default', async () => {
    let observedHost: string | null = null;
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(host: string, _m: unknown, cb: (r?: unknown) => void) {
          observedHost = host;
          cb({ success: true });
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 100 });
    await t.export([REC]);
    expect(observedHost).toBe('com.mdreview.filewriter');
  });

  it('sends a log_batch payload with the records', async () => {
    let observed: unknown = null;
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(_h: string, msg: unknown, cb: (r?: unknown) => void) {
          observed = msg;
          cb({ success: true });
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 100 });
    await t.export([REC]);
    expect(observed).toMatchObject({ action: 'log_batch' });
    const records = (observed as { records: LogRecord[] }).records;
    expect(records).toHaveLength(1);
    expect(records[0]?.body).toBe('x');
  });

  it('returns ok:false reason from chrome.runtime.lastError', async () => {
    const chromeStub = {
      runtime: {
        sendNativeMessage(_h: string, _m: unknown, cb: (r?: unknown) => void) {
          chromeStub.runtime.lastError = { message: 'host down' };
          cb();
        },
        lastError: undefined as { message: string } | undefined,
      },
    };
    (globalThis as { chrome?: unknown }).chrome = chromeStub;
    const t = new NativeHostTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('host down');
  });

  it('returns ok:false reason:protocol when response has no success', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(_h: string, _m: unknown, cb: (r?: unknown) => void) {
          cb({ error: 'nope' });
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('protocol');
  });

  it('returns ok:false reason:protocol when response is undefined and no lastError', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(_h: string, _m: unknown, cb: (r?: unknown) => void) {
          cb(undefined);
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 100 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('protocol');
  });

  it('returns timeout when callback is never invoked', async () => {
    (globalThis as { chrome?: unknown }).chrome = {
      runtime: {
        sendNativeMessage(_h: string, _m: unknown, _cb: (r?: unknown) => void) {
          /* never call */
        },
        lastError: undefined,
      },
    };
    const t = new NativeHostTransport({ timeoutMs: 20 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('timeout');
  });

  it('returns ok:false reason when chrome.runtime is unavailable', async () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    const t = new NativeHostTransport({ timeoutMs: 20 });
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
  });
});
