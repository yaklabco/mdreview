import { afterEach, describe, expect, it } from 'vitest';
import { getLogger, initLogging, shutdownLogging } from '../../logging';
import type { LogRecord } from '../../logging/log-record';
import type { LogTransport, TransportResult } from '../../logging/transport';

class CollectingTransport implements LogTransport {
  records: LogRecord[] = [];
  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.records.push(...records);
    return Promise.resolve({ ok: true });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const RESOURCE = {
  'service.name': 'mdview' as const,
  'service.version': '0.0.0-test',
  'service.namespace': 'electron-main' as const,
  'deployment.environment': 'dev' as const,
  'host.os': 'test',
};

afterEach(async () => {
  await shutdownLogging();
});

describe('public surface', () => {
  it('returns same logger instance from getLogger across calls', () => {
    const a = getLogger('x');
    const b = getLogger('x');
    expect(a).toBe(b);
  });

  it('buffers records emitted before init and replays them on init', async () => {
    const transport = new CollectingTransport();
    const log = getLogger('boot');
    log.info('one');
    log.info('two', { k: 'v' });

    initLogging({ transport, resource: RESOURCE, maxBatch: 1, flushIntervalMs: 9999 });

    // After init the processor flushes synchronously due to maxBatch=1; allow microtasks to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(transport.records.map((r) => r.body)).toEqual(['one', 'two']);
    expect(transport.records[1].attributes.k).toBe('v');
  });

  it('post-init emits go directly to transport', async () => {
    const transport = new CollectingTransport();
    initLogging({ transport, resource: RESOURCE, maxBatch: 1, flushIntervalMs: 9999 });

    const log = getLogger('post');
    log.info('hello');
    await new Promise((r) => setTimeout(r, 0));
    expect(transport.records).toHaveLength(1);
    expect(transport.records[0].body).toBe('hello');
    expect(transport.records[0].resource).toEqual(RESOURCE);
  });

  it('shutdown flushes and clears state; subsequent getLogger returns a fresh instance', async () => {
    const transport = new CollectingTransport();
    initLogging({ transport, resource: RESOURCE, maxBatch: 999, flushIntervalMs: 9999 });
    const a = getLogger('y');
    a.info('pending');
    await shutdownLogging();
    expect(transport.records.map((r) => r.body)).toEqual(['pending']);
    const b = getLogger('y');
    expect(b).not.toBe(a);
  });

  it('preserves logger identity across init', async () => {
    const transport = new CollectingTransport();
    const log = getLogger('keep-me');
    initLogging({ transport, resource: RESOURCE, maxBatch: 1, flushIntervalMs: 9999 });
    const same = getLogger('keep-me');
    expect(same).toBe(log);
    log.info('after');
    await new Promise((r) => setTimeout(r, 0));
    expect(transport.records.map((r) => r.body)).toEqual(['after']);
  });
});
