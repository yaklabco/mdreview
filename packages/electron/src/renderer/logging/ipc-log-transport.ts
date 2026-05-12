import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';

/**
 * Renderer-side LogTransport that ships batches to the Electron main process
 * via the preload-bridged `logBatch` invoke. The main-side handler forwards to
 * the shared FileTransport so renderer records land in the same JSONL file as
 * main-process records.
 *
 * On rejection (main absent, IPC closed during teardown, etc.) we surface
 * `ok: false` so the processor's RingBuffer retains the batch for retry.
 */
export class IpcLogTransport implements LogTransport {
  constructor(private readonly send: (records: readonly LogRecord[]) => Promise<void>) {}

  async export(records: readonly LogRecord[]): Promise<TransportResult> {
    try {
      await this.send(records);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
