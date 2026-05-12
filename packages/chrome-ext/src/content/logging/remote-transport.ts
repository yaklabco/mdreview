import type { LogRecord, LogTransport, TransportResult } from '@mdreview/core/logging';

const DEFAULT_TIMEOUT_MS = 5_000;

export interface RemoteTransportOpts {
  /** Per-batch timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

interface ChromeRuntimeLike {
  sendMessage(message: unknown, callback: (response?: unknown) => void): void;
  lastError?: { message?: string };
}

/**
 * `LogTransport` for content scripts and the popup. Forwards each batch to
 * the service worker as a `LOG_BATCH` message; the SW owns the actual
 * native-host / IndexedDB plumbing.
 *
 * Like the other Chrome transports, this never throws; failures surface as
 * `{ ok: false, reason }` so upstream code can decide what to do.
 */
export class RemoteTransport implements LogTransport {
  private readonly timeoutMs: number;

  constructor(opts?: RemoteTransportOpts) {
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  export(records: readonly LogRecord[]): Promise<TransportResult> {
    return new Promise<TransportResult>((resolve) => {
      const runtime = getRuntime();
      if (!runtime) {
        resolve({ ok: false, reason: 'chrome.runtime unavailable' });
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, reason: 'timeout' });
      }, this.timeoutMs);

      const finish = (result: TransportResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const message = { type: 'LOG_BATCH', records: [...records] };
      try {
        runtime.sendMessage(message, (response?: unknown) => {
          const post = getRuntime();
          const lastError = post?.lastError;
          if (lastError) {
            finish({ ok: false, reason: lastError.message ?? 'lastError' });
            return;
          }
          if (!isObject(response)) {
            finish({ ok: false, reason: 'protocol' });
            return;
          }
          const ok = (response as { ok?: unknown }).ok;
          if (ok === true) {
            finish({ ok: true });
            return;
          }
          const reason = (response as { reason?: unknown }).reason;
          finish({
            ok: false,
            reason: typeof reason === 'string' ? reason : 'protocol',
          });
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

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
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
