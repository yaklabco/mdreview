import {
  initLogging,
  type LogRecord,
  type LogTransport,
  type ResourceAttrs,
  type TransportResult,
} from '@mdreview/core/logging';
import type { BridgeHealth } from '@mdreview/core';
import { CompositeTransport } from './composite-transport';
import { IndexedDBTransport } from './indexeddb-transport';
import { NativeHostTransport } from './native-host-transport';
import { createBridgeRecovery, type BridgeRecovery } from './bridge-recovery';

export interface SwLoggingHandles {
  transport: CompositeTransport;
  recovery: BridgeRecovery;
}

export interface InitSwLoggingOpts {
  bridge: Pick<BridgeHealth, 'onStateChange'>;
  version: string;
  /** Optional override for tests. */
  transport?: CompositeTransport;
}

/**
 * Wire the service worker logger:
 *  - native-host primary transport
 *  - IndexedDB fallback buffer
 *  - composite transport that falls back on primary failure
 *  - bridge-recovery flusher that drains buffered logs on reconnect
 */
export function initSwLogging(opts: InitSwLoggingOpts): SwLoggingHandles {
  const transport =
    opts.transport ??
    new CompositeTransport({
      primary: new NativeHostTransport(),
      fallback: new IndexedDBTransport(),
    });

  const resource: ResourceAttrs = {
    'service.name': 'mdview',
    'service.version': opts.version,
    'service.namespace': 'chrome-sw',
    'deployment.environment': 'prod',
    'host.os': 'unknown',
  };

  initLogging({ transport, resource });

  const recovery = createBridgeRecovery({ bridge: opts.bridge, transport });
  recovery.start();

  return { transport, recovery };
}

/**
 * Handle a single `LOG_BATCH` message on the service worker side. Returns a
 * response shape compatible with `RemoteTransport`'s expectations:
 * `{ ok: boolean, reason?: string }`.
 *
 * Exported so unit tests can exercise the routing in isolation from the
 * `chrome.runtime.onMessage` listener.
 */
export async function handleLogBatchMessage(
  transport: Pick<LogTransport, 'export'>,
  payload: { records?: unknown }
): Promise<{ ok: boolean; reason?: string }> {
  if (!Array.isArray(payload.records)) {
    return { ok: false, reason: 'records must be an array' };
  }
  try {
    const result: TransportResult = await transport.export(payload.records as readonly LogRecord[]);
    if (result.ok) return { ok: true };
    return { ok: false, reason: result.reason ?? 'unknown' };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
