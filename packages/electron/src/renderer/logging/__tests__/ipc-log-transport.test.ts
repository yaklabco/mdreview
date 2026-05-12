import { describe, it, expect, vi } from 'vitest';
import type { LogRecord } from '@mdreview/core/logging';
import { IpcLogTransport } from '../ipc-log-transport';

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
    'service.namespace': 'electron-renderer',
    'deployment.environment': 'dev',
    'host.os': 't',
  },
};

describe('IpcLogTransport', () => {
  it('resolves ok:true when send resolves', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const t = new IpcLogTransport(send);
    expect(await t.export([REC])).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith([REC]);
  });

  it('resolves ok:false with reason when send rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('boom'));
    const t = new IpcLogTransport(send);
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('boom');
    }
  });

  it('coerces non-Error rejections to a string reason', async () => {
    const send = vi.fn().mockRejectedValue('plain reason');
    const t = new IpcLogTransport(send);
    const r = await t.export([REC]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('plain reason');
    }
  });
});
