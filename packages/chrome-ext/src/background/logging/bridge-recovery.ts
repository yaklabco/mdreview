import type { BridgeHealth } from '@mdreview/core';
import type { CompositeTransport } from './composite-transport';

export interface BridgeRecoveryOpts {
  bridge: Pick<BridgeHealth, 'onStateChange'>;
  transport: Pick<CompositeTransport, 'flushFromIdb'>;
  /** Debounce window in milliseconds. Defaults to 1000. */
  debounceMs?: number;
  /** Optional injection points for tests. */
  scheduleTimeout?: (cb: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

export interface BridgeRecovery {
  start(): void;
  stop(): void;
}

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Watches bridge-health state transitions and triggers a buffered-log flush
 * each time the bridge re-enters the `connected` state.
 *
 * The flush is debounced so a flapping bridge does not thrash the native
 * messaging host. Transitions out of `connected` cancel any pending flush;
 * a subsequent `connected` re-arms the debounce window.
 *
 * Errors from `flushFromIdb` are caught and logged to `console.warn` because
 * the recovery loop runs before the logger stack itself is fully wired and we
 * must not push exceptions through Chrome's event listeners.
 */
export function createBridgeRecovery(opts: BridgeRecoveryOpts): BridgeRecovery {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const schedule =
    opts.scheduleTimeout ??
    ((cb: () => void, ms: number) =>
      (globalThis as { setTimeout: typeof setTimeout }).setTimeout(cb, ms));
  const cancel =
    opts.clearTimeout ??
    ((handle: unknown) =>
      (globalThis as { clearTimeout: typeof clearTimeout }).clearTimeout(
        handle as ReturnType<typeof setTimeout>
      ));

  let stopped = false;
  let pending: unknown = null;
  let started = false;

  function clearPending(): void {
    if (pending !== null) {
      cancel(pending);
      pending = null;
    }
  }

  function runFlush(): void {
    pending = null;
    if (stopped) return;
    try {
      const result = opts.transport.flushFromIdb();
      // flushFromIdb returns a Promise; swallow any rejection.
      void Promise.resolve(result).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[bridge-recovery] flushFromIdb rejected:', err);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[bridge-recovery] flushFromIdb threw:', err);
    }
  }

  function onState(state: 'connected' | 'reconnecting' | 'disconnected'): void {
    if (stopped) return;
    if (state === 'connected') {
      clearPending();
      pending = schedule(runFlush, debounceMs);
      return;
    }
    // Any transition out of connected cancels the pending flush. We re-arm
    // on the next connect.
    clearPending();
  }

  return {
    start(): void {
      if (started) return;
      started = true;
      opts.bridge.onStateChange(onState);
    },
    stop(): void {
      stopped = true;
      clearPending();
    },
  };
}
