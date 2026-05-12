import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';

const DEFAULT_HOST_NAME = 'com.mdreview.filewriter';
const DEFAULT_TIMEOUT_MS = 5_000;

export interface NativeHostTransportOpts {
  /** Native messaging host id. Defaults to the mdview file writer host. */
  hostName?: string;
  /** Per-batch timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

interface ChromeRuntimeLike {
  sendNativeMessage(host: string, message: unknown, callback: (response?: unknown) => void): void;
  lastError?: { message?: string };
}

/**
 * Primary Chrome log transport. Sends batches to the native messaging host
 * as `{ action: 'log_batch', records }` and resolves with the outcome.
 *
 * The transport never throws; transport failure is always communicated as
 * `{ ok: false, reason }` so the composite transport can fall back without
 * losing records.
 */
export class NativeHostTransport implements LogTransport {
  private readonly hostName: string;
  private readonly timeoutMs: number;

  constructor(opts?: NativeHostTransportOpts) {
    this.hostName = opts?.hostName ?? DEFAULT_HOST_NAME;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  export(records: readonly LogRecord[]): Promise<TransportResult> {
    return new Promise<TransportResult>((resolve) => {
      const runtime = getRuntime();
      if (!runtime) {
        resolve({ ok: false, reason: 'chrome.runtime unavailable' });
        return;
      }

      const message = { action: 'log_batch', records: [...records] };
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, reason: 'timeout' });
      }, this.timeoutMs);

      const finish = (result: TransportResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      try {
        runtime.sendNativeMessage(this.hostName, message, (response?: unknown) => {
          // Re-read runtime after the callback because chrome stamps
          // lastError on the runtime object synchronously inside the cb.
          const post = getRuntime();
          const lastError = post?.lastError;
          if (lastError) {
            finish({ ok: false, reason: lastError.message ?? 'lastError' });
            return;
          }
          if (!isSuccessResponse(response)) {
            finish({ ok: false, reason: 'protocol' });
            return;
          }
          finish({ ok: true });
        });
      } catch (err) {
        finish({ ok: false, reason: errorReason(err) });
      }
    });
  }
}

function getRuntime(): ChromeRuntimeLike | undefined {
  const c = (globalThis as { chrome?: { runtime?: ChromeRuntimeLike } }).chrome;
  return c?.runtime;
}

function isSuccessResponse(response: unknown): boolean {
  return (
    response !== null &&
    typeof response === 'object' &&
    (response as { success?: unknown }).success === true
  );
}

function errorReason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}
