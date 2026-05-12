import { afterEach, describe, expect, it } from 'vitest';
import { getLogger, initLogging, shutdownLogging } from '../../logging';
import type { LogRecord, LogTransport, ResourceAttrs, TransportResult } from '../../logging';

const RESOURCE: ResourceAttrs = {
  'service.name': 'mdview',
  'service.version': '0.0.0-test',
  'service.namespace': 'electron-main',
  'deployment.environment': 'dev',
  'host.os': 'test',
};

class FlakyTransport implements LogTransport {
  calls = 0;
  delivered: LogRecord[] = [];
  // First export fails; subsequent ones succeed.
  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.calls += 1;
    if (this.calls === 1) {
      return Promise.resolve({ ok: false, reason: 'simulated outage' });
    }
    this.delivered.push(...records);
    return Promise.resolve({ ok: true });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

afterEach(async () => {
  await shutdownLogging();
});

describe('logging pipeline wire-up', () => {
  it('recovers all records after a transient transport failure', async () => {
    const transport = new FlakyTransport();
    initLogging({
      transport,
      resource: RESOURCE,
      // Tight batch + interval so the test completes quickly.
      maxBatch: 10,
      flushIntervalMs: 50,
      ringMaxBytes: 1_048_576,
    });

    const log = getLogger('smoke');
    for (let i = 0; i < 100; i += 1) {
      log.info(`msg-${i}`, { i });
    }

    // Let the processor flush, fail, then re-flush.
    // Two flush windows plus a margin.
    await new Promise((r) => setTimeout(r, 250));
    await shutdownLogging(); // forces a final flush

    expect(transport.calls).toBeGreaterThanOrEqual(2);
    // All 100 records made it through, possibly across multiple successful batches.
    expect(transport.delivered.map((r) => r.attributes.i)).toEqual(
      Array.from({ length: 100 }, (_, i) => i)
    );
  });
});
