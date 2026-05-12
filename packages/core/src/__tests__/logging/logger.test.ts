import { describe, expect, it } from 'vitest';
import type { LogRecord, ResourceAttrs } from '../../logging/log-record';
import { createLogger } from '../../logging/logger';

const RESOURCE: ResourceAttrs = {
  'service.name': 'mdview',
  'service.version': '0.0.0-test',
  'service.namespace': 'electron-main',
  'deployment.environment': 'dev',
  'host.os': 'test',
};

function setup(opts: Partial<{ now: () => number; idSeed: number }> = {}) {
  const records: LogRecord[] = [];
  let seed = opts.idSeed ?? 1;
  const logger = createLogger({
    emit: (r) => records.push(r),
    resource: RESOURCE,
    now: opts.now ?? (() => 1_700_000_000_000),
    randomBytes: (n: number) => {
      // deterministic: ascending bytes from seed
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        out[i] = seed++ & 0xff;
      }
      return out;
    },
  });
  return { logger, records };
}

describe('Logger basic emit', () => {
  it('emits a record with severityNumber, body, attributes, resource', () => {
    const { logger, records } = setup();
    logger.info('hello', { a: 1 });
    expect(records).toHaveLength(1);
    const r = records[0];
    expect(r.severityNumber).toBe(9);
    expect(r.severityText).toBe('INFO');
    expect(r.body).toBe('hello');
    expect(r.attributes.a).toBe(1);
    expect(r.resource).toEqual(RESOURCE);
    expect(r.timestamp).toBe(1_700_000_000_000 * 1_000_000);
  });

  it('lifts exception attrs from an Error on error()', () => {
    const { logger, records } = setup();
    const err = new TypeError('bad');
    err.stack = 'STACK';
    logger.error('boom', { ctx: 'x' }, err);
    expect(records[0].attributes['exception.type']).toBe('TypeError');
    expect(records[0].attributes['exception.message']).toBe('bad');
    expect(records[0].attributes['exception.stacktrace']).toBe('STACK');
    expect(records[0].attributes.ctx).toBe('x');
    expect(records[0].severityNumber).toBe(17);
  });

  it('caller-provided exception attrs win over lifted ones', () => {
    const { logger, records } = setup();
    logger.error('x', { 'exception.message': 'override' }, new Error('orig'));
    expect(records[0].attributes['exception.message']).toBe('override');
  });
});

describe('Logger child', () => {
  it('records code.namespace from child name', () => {
    const { logger, records } = setup();
    logger.child('comments').info('x');
    expect(records[0].attributes['code.namespace']).toBe('comments');
  });

  it('dot-joins nested namespaces', () => {
    const { logger, records } = setup();
    logger.child('comments').child('ui').info('x');
    expect(records[0].attributes['code.namespace']).toBe('comments.ui');
  });

  it('child inherits and merges base attrs (call-site wins)', () => {
    const { logger, records } = setup();
    const c = logger.child('comments', { a: 1, b: 2 });
    c.info('x', { b: 99 });
    expect(records[0].attributes.a).toBe(1);
    expect(records[0].attributes.b).toBe(99);
  });
});

describe('Logger withSpan (sync)', () => {
  it('emits start and end sharing traceId/spanId, with duration_ns', () => {
    let t = 1_700_000_000_000;
    const { logger, records } = setup({ now: () => t });
    const out = logger.withSpan('comment.add', (span) => {
      t += 50;
      span.setAttribute('mdview.comment.id', 'c1');
      return 'done';
    });
    expect(out).toBe('done');
    expect(records).toHaveLength(2);
    expect(records[0].body).toBe('comment.add.start');
    expect(records[1].body).toBe('comment.add.end');
    expect(records[0].traceId).toBe(records[1].traceId);
    expect(records[0].spanId).toBe(records[1].spanId);
    expect((records[0].traceId ?? '').length).toBe(32);
    expect((records[0].spanId ?? '').length).toBe(16);
    expect(records[1].attributes['duration_ns']).toBe(50 * 1_000_000);
    expect(records[1].attributes['mdview.span.status']).toBe('ok');
    expect(records[1].attributes['mdview.comment.id']).toBe('c1');
  });

  it('records exception event + error status on throw, then rethrows', () => {
    const { logger, records } = setup();
    const fail = new Error('boom');
    expect(() =>
      logger.withSpan('op', () => {
        throw fail;
      })
    ).toThrow('boom');
    expect(records.map((r) => r.body)).toEqual(['op.start', 'exception', 'op.end']);
    expect(records[1].attributes['exception.message']).toBe('boom');
    expect(records[2].attributes['mdview.span.status']).toBe('error');
  });
});

describe('Logger withSpan (async)', () => {
  it('handles async fn with successful resolution', async () => {
    const { logger, records } = setup();
    const out = await logger.withSpan('op', () => Promise.resolve('ok'));
    expect(out).toBe('ok');
    expect(records).toHaveLength(2);
    expect(records[1].attributes['mdview.span.status']).toBe('ok');
  });

  it('handles async rejection: exception event + error status + rethrow', async () => {
    const { logger, records } = setup();
    const p = logger.withSpan('op', () => Promise.reject(new Error('async-boom')));
    await expect(p).rejects.toThrow('async-boom');
    expect(records.map((r) => r.body)).toEqual(['op.start', 'exception', 'op.end']);
    expect(records[2].attributes['mdview.span.status']).toBe('error');
  });

  it('addEvent emits a record with the span trace/span ids', () => {
    const { logger, records } = setup();
    logger.withSpan('op', (span) => {
      span.addEvent('checkpoint', { k: 'v' });
    });
    expect(records.map((r) => r.body)).toEqual(['op.start', 'checkpoint', 'op.end']);
    expect(records[1].attributes.k).toBe('v');
    expect(records[1].attributes['mdview.span.event']).toBe('checkpoint');
    expect(records[1].traceId).toBe(records[0].traceId);
    expect(records[1].spanId).toBe(records[0].spanId);
  });
});
