import { describe, expect, it, vi } from 'vitest';
import { handleLogBatchMessage } from '../../background/logging/sw-init';
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
    'service.namespace': 'chrome-sw',
    'deployment.environment': 'dev',
    'host.os': 't',
  },
};

describe('handleLogBatchMessage', () => {
  it('forwards records to the transport and returns ok:true on success', async () => {
    const exportFn = vi.fn().mockResolvedValue({ ok: true });
    const result = await handleLogBatchMessage({ export: exportFn }, { records: [REC] });
    expect(exportFn).toHaveBeenCalledWith([REC]);
    expect(result).toEqual({ ok: true });
  });

  it('returns ok:false with reason when transport fails', async () => {
    const exportFn = vi.fn().mockResolvedValue({ ok: false, reason: 'down' });
    const result = await handleLogBatchMessage({ export: exportFn }, { records: [REC] });
    expect(result).toEqual({ ok: false, reason: 'down' });
  });

  it('returns ok:false when transport rejects', async () => {
    const exportFn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await handleLogBatchMessage({ export: exportFn }, { records: [REC] });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('boom');
  });

  it('rejects payloads where records is not an array', async () => {
    const exportFn = vi.fn();
    const result = await handleLogBatchMessage(
      { export: exportFn },
      { records: 'nope' as unknown }
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/array/i);
    expect(exportFn).not.toHaveBeenCalled();
  });

  it('rejects payloads where records is missing', async () => {
    const exportFn = vi.fn();
    const result = await handleLogBatchMessage({ export: exportFn }, {});
    expect(result.ok).toBe(false);
    expect(exportFn).not.toHaveBeenCalled();
  });
});
