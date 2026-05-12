import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initLogging,
  shutdownLogging,
  type LogRecord,
  type LogTransport,
  type ResourceAttrs,
  type TransportResult,
} from '@mdreview/core/logging';
import { recordBridgeAttempt } from '../../background/logging/bridge-attempt';

const RESOURCE: ResourceAttrs = {
  'service.name': 'mdview',
  'service.version': '0.0.0-test',
  'service.namespace': 'chrome-sw',
  'deployment.environment': 'dev',
  'host.os': 'test',
};

class CapturingTransport implements LogTransport {
  records: LogRecord[] = [];
  export(records: readonly LogRecord[]): Promise<TransportResult> {
    this.records.push(...records);
    return Promise.resolve({ ok: true });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

describe('recordBridgeAttempt', () => {
  let transport: CapturingTransport;

  beforeEach(() => {
    transport = new CapturingTransport();
    initLogging({
      transport,
      resource: RESOURCE,
      maxBatch: 1,
      flushIntervalMs: 9999,
    });
  });

  afterEach(async () => {
    await shutdownLogging();
  });

  it('emits a bridge.attempt.ok record on a successful attempt', async () => {
    recordBridgeAttempt('WRITE_FILE', 7, 'ok', 12.5);

    await new Promise((r) => setTimeout(r, 5));
    await shutdownLogging();

    const rec = transport.records.find((r) => r.body === 'bridge.attempt.ok');
    expect(rec).toBeDefined();
    expect(rec?.severityText).toBe('INFO');
    expect(rec?.attributes['mdview.ipc.channel']).toBe('WRITE_FILE');
    expect(rec?.attributes['mdview.bridge.attempt']).toBe(7);
    expect(rec?.attributes['mdview.bridge.outcome']).toBe('ok');
    expect(rec?.attributes['duration_ms']).toBe(12.5);
  });

  it('emits a bridge.attempt.failed record with exception attrs on a failed attempt', async () => {
    const err = new Error('native host disconnected');

    recordBridgeAttempt('WRITE_FILE', 9, 'error', 30, err);

    await new Promise((r) => setTimeout(r, 5));
    await shutdownLogging();

    const rec = transport.records.find((r) => r.body === 'bridge.attempt.failed');
    expect(rec).toBeDefined();
    expect(rec?.severityText).toBe('ERROR');
    expect(rec?.attributes['mdview.ipc.channel']).toBe('WRITE_FILE');
    expect(rec?.attributes['mdview.bridge.attempt']).toBe(9);
    expect(rec?.attributes['mdview.bridge.outcome']).toBe('error');
    expect(rec?.attributes['duration_ms']).toBe(30);
    expect(rec?.attributes['exception.type']).toBe('Error');
    expect(rec?.attributes['exception.message']).toBe('native host disconnected');
  });

  it('handles non-Error rejections by wrapping them as Error', async () => {
    recordBridgeAttempt('GET_USERNAME', 1, 'error', 5, 'string failure');

    await new Promise((r) => setTimeout(r, 5));
    await shutdownLogging();

    const rec = transport.records.find((r) => r.body === 'bridge.attempt.failed');
    expect(rec).toBeDefined();
    expect(rec?.attributes['mdview.ipc.channel']).toBe('GET_USERNAME');
    expect(rec?.attributes['exception.message']).toBe('string failure');
  });
});
